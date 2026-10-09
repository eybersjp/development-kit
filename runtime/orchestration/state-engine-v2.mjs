import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const STATE_ENGINE_SCHEMA_VERSION = '2.0.0';
export const STATE_EVENT_SCHEMA_VERSION = '1.0.0';
export const STATE_SNAPSHOT_SCHEMA_VERSION = '2.0.0';
export const STATE_INDEX_SCHEMA_VERSION = '1.0.0';

export const STATE_ENGINE_ROOT = '.development-kit/state';
export const STATE_EVENTS_FILE = 'events.jsonl';
export const STATE_SNAPSHOT_FILE = 'snapshot.json';
export const STATE_INDEX_FILE = 'index.db';
export const STATE_SCHEMA_FILE = 'schema.json';

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const EVENT_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{1,95}$/;
const ENTITY_TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_ENTITY_ID_LENGTH = 512;
// Bounded blocking sleeps avoid starving a contended local state writer.
const STATE_LOCK_SLEEP = new Int32Array(new SharedArrayBuffer(4));
function waitStateLock(ms = 25) { Atomics.wait(STATE_LOCK_SLEEP, 0, 0, ms); }

export class StateEngineError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'StateEngineError';
    this.details = details;
  }
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function stablePretty(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StateEngineError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value, label) {
  if (value === undefined || value === null) return null;
  return requireText(value, label);
}

function entityType(value) {
  const normalized = requireText(value, 'entityType');
  if (!ENTITY_TYPE_PATTERN.test(normalized)) {
    throw new StateEngineError('entityType contains unsupported characters');
  }
  return normalized;
}

function entityId(value) {
  const normalized = requireText(value, 'entityId');
  if (normalized.length > MAX_ENTITY_ID_LENGTH || /[\r\n\0]/.test(normalized)) {
    throw new StateEngineError('entityId is invalid');
  }
  return normalized;
}

function eventType(value) {
  const normalized = requireText(value, 'eventType');
  if (!EVENT_TYPE_PATTERN.test(normalized)) {
    throw new StateEngineError('eventType is invalid');
  }
  return normalized;
}

function timestamp(value, label = 'timestamp') {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new StateEngineError(`${label} must be a valid timestamp`);
  }
  return value;
}

function stateRevision(value, { allowNull = false } = {}) {
  if (allowNull && (value === undefined || value === null)) return null;
  if (!Number.isInteger(value) || value < 1) {
    throw new StateEngineError('stateRevision must be a positive integer');
  }
  return value;
}

function statePaths(rootDir = process.cwd()) {
  const root = path.resolve(rootDir);
  const stateRoot = path.resolve(root, STATE_ENGINE_ROOT);
  const relative = path.relative(root, stateRoot);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new StateEngineError('State Engine path escapes project root');
  }
  const paths = Object.freeze({
    root,
    stateRoot,
    events: path.join(stateRoot, STATE_EVENTS_FILE),
    snapshot: path.join(stateRoot, STATE_SNAPSHOT_FILE),
    index: path.join(stateRoot, STATE_INDEX_FILE),
    schema: path.join(stateRoot, STATE_SCHEMA_FILE),
    lock: path.join(stateRoot, 'state.lock'),
    pending: path.join(stateRoot, 'pending-commit.json'),
  });
  if (fs.existsSync(stateRoot)) {
    assertStateRootRealpathSafe(paths);
    assertStateFilesNotLinks(paths);
  }
  return paths;
}

function assertStateRootRealpathSafe(paths) {
  const rootReal = fs.realpathSync(paths.root);
  const stateReal = fs.realpathSync(paths.stateRoot);
  const relative = path.relative(rootReal, stateReal);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new StateEngineError('State Engine root resolves outside project root');
  }
  return stateReal;
}

function assertStateFilesNotLinks(paths) {
  for (const field of ['events', 'snapshot', 'index', 'schema', 'pending', 'lock']) {
    try {
      const stat = fs.lstatSync(paths[field]);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new StateEngineError('State Engine internal file is not a regular file: ' + field);
      }
      if (stat.nlink > 1) {
        throw new StateEngineError('State Engine internal file has multiple hard links: ' + field);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function fsyncParentDirectory(directory) {
  // POSIX directory fsync preserves renames/journal creation across a power
  // loss; Windows does not support the same portable directory operation.
  if (process.platform === 'win32') return;
  const dirFd = fs.openSync(directory, 'r');
  try {
    fs.fsyncSync(dirFd);
  } finally {
    fs.closeSync(dirFd);
  }
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  const fd = fs.openSync(tempPath, 'wx');
  try {
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tempPath, filePath);
  fsyncParentDirectory(path.dirname(filePath));
  return filePath;
}

function acquireStateLock(rootDir, timeoutMs = 12000) {
  const paths = statePaths(rootDir);
  fs.mkdirSync(paths.stateRoot, { recursive: true });
  assertStateRootRealpathSafe(paths);
  const owner = 'state-lock-' + crypto.randomUUID();
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const fd = fs.openSync(paths.lock, 'wx');
      try {
        fs.writeFileSync(fd, JSON.stringify({
          owner,
          pid: process.pid,
          hostname: os.hostname(),
          acquiredAt: new Date().toISOString(),
        }), 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      return { path: paths.lock, owner };
    } catch (error) {
      if (error.code !== 'EEXIST') {
        // Windows can briefly deny create/open while another process closes or
        // removes this exact lock file. Retry a bounded transient sharing
        // violation; never interpret it as permission to steal the lock.
        if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code)) {
          throw new StateEngineError('Unable to acquire State Engine lock: ' + error.message);
        }
        waitStateLock(25);
        continue;
      }
      let stat;
      try {
        stat = fs.statSync(paths.lock);
      } catch (readError) {
        if (readError.code === 'ENOENT') continue;
        throw new StateEngineError('Cannot inspect existing State Engine lock: ' + readError.message);
      }
      if (Date.now() - stat.mtimeMs > 15_000) {
        let prior;
        try {
          prior = JSON.parse(fs.readFileSync(paths.lock, 'utf8'));
        } catch {
          // Corrupt or incomplete lock metadata must never authorize lock stealing.
          prior = null;
        }
        // A live local PID owns the lock regardless of its age. Remote and legacy
        // owners are treated as unknown and cannot be stolen automatically.
        if (prior && prior.hostname === os.hostname() && Number.isSafeInteger(prior.pid) && prior.pid > 0) {
          let alive = true;
          try {
            process.kill(prior.pid, 0);
          } catch (probeError) {
            if (probeError.code === 'ESRCH') alive = false;
          }
          if (!alive) {
            // Pathname compare-then-unlink is unsafe: another reclaimer may
            // install a fresh live lock between the check and unlink. mkdir
            // gives each local stale-lock reclaimer exclusive ownership of a
            // recovery guard, so other reclaimers cannot race its unlink.
            const reclaimGuard = paths.lock + '.reclaim';
            let guardOwned = false;
            let guardMarker = null;
            try {
              try {
                fs.mkdirSync(reclaimGuard, { mode: 0o700 });
                guardOwned = true;
                guardMarker = path.join(reclaimGuard, 'owner.json');
                const guardFd = fs.openSync(guardMarker, 'wx', 0o600);
                try {
                  fs.writeFileSync(guardFd, JSON.stringify({
                    pid: process.pid,
                    hostname: os.hostname(),
                    owner,
                    acquiredAt: new Date().toISOString(),
                  }));
                  fs.fsyncSync(guardFd);
                } finally {
                  fs.closeSync(guardFd);
                }
              } catch (guardError) {
                if (guardError.code !== 'EEXIST') throw guardError;
              }
              if (guardOwned) {
                let latest;
                try {
                  latest = fs.statSync(paths.lock);
                } catch (raceError) {
                  if (raceError.code !== 'ENOENT') throw raceError;
                }
                if (latest && latest.ino === stat.ino && latest.mtimeMs === stat.mtimeMs && latest.size === stat.size) {
                  let current;
                  try {
                    current = JSON.parse(fs.readFileSync(paths.lock, 'utf8'));
                  } catch (readError) {
                    if (readError.code !== 'ENOENT') throw readError;
                  }
                  if (current?.owner === prior.owner && current?.pid === prior.pid && current?.hostname === prior.hostname) {
                    // Verify ownership is still dead inside the reclaim guard.
                    let confirmedDead = false;
                    try {
                      process.kill(current.pid, 0);
                    } catch (probeError) {
                      confirmedDead = probeError.code === 'ESRCH';
                    }
                    if (confirmedDead) {
                      try {
                        fs.unlinkSync(paths.lock);
                      } catch (removeError) {
                        if (removeError.code !== 'ENOENT') throw removeError;
                      }
                    }
                  }
                }
              }
            } finally {
              if (guardOwned) {
                if (guardMarker && fs.existsSync(guardMarker)) fs.unlinkSync(guardMarker);
                fs.rmdirSync(reclaimGuard);
              }
            }
            if (guardOwned) continue;
          }
        }
      }
      // Use bounded, synchronous waiting so Node >=18 and current callers remain compatible.
      waitStateLock(25);
    }
  }
  throw new StateEngineError('State Engine lock acquisition timed out');
}

/**
 * Explicit OFFLINE maintenance operation. Never reclaim an orphaned guard in
 * the normal commit path: proving the reclaimer is gone requires inspecting
 * owner metadata and ruling out an active writer. The caller must take the
 * project out of service before acknowledging recovery.
 */
export function recoverAbandonedStateLock({ rootDir = process.cwd(), confirmOffline = false } = {}) {
  if (confirmOffline !== true) {
    throw new StateEngineError('Explicit offline confirmation is required for abandoned-lock recovery');
  }
  const paths = statePaths(rootDir);
  const guard = paths.lock + '.reclaim';
  if (!fs.existsSync(guard)) return Object.freeze({ recovered: false, reason: 'no guard' });
  const stat = fs.lstatSync(guard);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new StateEngineError('Abandoned lock guard is not a regular directory');
  }
  if (Date.now() - stat.mtimeMs < 60_000) {
    throw new StateEngineError('Refusing to reclaim a recently active State Engine guard');
  }
  const marker = path.join(guard, 'owner.json');
  if (fs.existsSync(marker)) {
    const owner = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (owner.hostname !== os.hostname() || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) {
      throw new StateEngineError('Cannot establish local guard ownership for offline recovery');
    }
    try {
      process.kill(owner.pid, 0);
      throw new StateEngineError('Refusing to remove a live State Engine recovery guard');
    } catch (probe) {
      if (probe.code !== 'ESRCH') throw probe;
    }
  }
  if (fs.existsSync(paths.lock)) {
    const lock = JSON.parse(fs.readFileSync(paths.lock, 'utf8'));
    if (lock.hostname !== os.hostname() || !Number.isSafeInteger(lock.pid) || lock.pid <= 0) {
      throw new StateEngineError('Offline guard recovery requires a provably local dead state lock');
    }
    try {
      process.kill(lock.pid, 0);
      throw new StateEngineError('Refusing to recover a guard while state lock owner is alive');
    } catch (probe) {
      if (probe.code !== 'ESRCH') throw probe;
    }
  }
  if (fs.existsSync(marker)) fs.unlinkSync(marker);
  fs.rmdirSync(guard);
  return Object.freeze({ recovered: true, mode: 'confirmed-offline' });
}

function releaseStateLock(lock) {
  if (!lock?.path) return;
  try {
    if (!fs.existsSync(lock.path)) return;
    const current = JSON.parse(fs.readFileSync(lock.path, 'utf8'));
    if (current.owner === lock.owner) fs.unlinkSync(lock.path);
  } catch {}
}

function schemaDocument() {
  return Object.freeze({
    schemaVersion: STATE_ENGINE_SCHEMA_VERSION,
    authority: {
      canonicalHistory: STATE_EVENTS_FILE,
      materializedSnapshot: STATE_SNAPSHOT_FILE,
      disposableIndex: STATE_INDEX_FILE,
    },
    contracts: {
      event: STATE_EVENT_SCHEMA_VERSION,
      snapshot: STATE_SNAPSHOT_SCHEMA_VERSION,
      index: STATE_INDEX_SCHEMA_VERSION,
    },
    invariants: [
      'events.jsonl is canonical runtime state history',
      'snapshot.json is derived from events.jsonl',
      'index.db is disposable and rebuildable',
      'event sequence is monotonic',
      'event hashes form a single integrity chain',
    ],
  });
}

export function ensureStateEngineLayout(rootDir = process.cwd()) {
  const paths = statePaths(rootDir);
  fs.mkdirSync(paths.stateRoot, { recursive: true });
  assertStateRootRealpathSafe(paths);

  const expectedSchema = stablePretty(schemaDocument());
  if (fs.existsSync(paths.schema)) {
    const existing = fs.readFileSync(paths.schema, 'utf8');
    if (existing !== expectedSchema) {
      throw new StateEngineError('State Engine schema.json does not match the runtime schema contract');
    }
  } else {
    atomicWrite(paths.schema, expectedSchema);
  }

  if (!fs.existsSync(paths.events)) atomicWrite(paths.events, '');
  if (!fs.existsSync(paths.snapshot)) atomicWrite(paths.snapshot, stablePretty(emptySnapshot()));
  if (!fs.existsSync(paths.index)) atomicWrite(paths.index, stablePretty(buildStateIndex(emptySnapshot())));

  return paths;
}

export function isStateEngineV2Active(rootDir = process.cwd()) {
  const paths = statePaths(rootDir);
  if (!fs.existsSync(paths.stateRoot)) return false;

  const schemaExists = fs.existsSync(paths.schema);
  const eventsExist = fs.existsSync(paths.events);
  if (!schemaExists && !eventsExist) return false;
  if (!schemaExists || !eventsExist) {
    throw new StateEngineError('State Engine V2 layout is incomplete');
  }

  const expectedSchema = stablePretty(schemaDocument());
  const actualSchema = fs.readFileSync(paths.schema, 'utf8');
  if (actualSchema !== expectedSchema) {
    throw new StateEngineError('State Engine schema.json does not match the runtime schema contract');
  }
  return true;
}

function emptySnapshot() {
  return {
    schemaVersion: STATE_SNAPSHOT_SCHEMA_VERSION,
    engineSchemaVersion: STATE_ENGINE_SCHEMA_VERSION,
    lastEventSequence: 0,
    lastEventHash: null,
    entities: {},
    migrations: [],
  };
}

function eventHashPayload(event) {
  const { eventHash, ...payload } = event;
  return payload;
}

function computeEventId(base) {
  const digest = crypto.createHash('sha256').update(stableJson(base)).digest('hex').slice(0, 20);
  return `evt-${String(base.sequence).padStart(10, '0')}-${digest}`;
}

function computeEventHash(event) {
  return sha256(stableJson(eventHashPayload(event)));
}

export function validateStateEvent(event, previous = null) {
  if (!plainObject(event)) throw new StateEngineError('State event must be an object');
  if (event.schemaVersion !== STATE_EVENT_SCHEMA_VERSION) {
    throw new StateEngineError(`Unsupported event schemaVersion: ${event.schemaVersion}`);
  }
  if (!Number.isInteger(event.sequence) || event.sequence < 1) throw new StateEngineError('Event sequence must be a positive integer');
  if (typeof event.eventId !== 'string' || !/^evt-\d{10}-[a-f0-9]{20}$/.test(event.eventId)) {
    throw new StateEngineError('Event eventId is invalid');
  }
  timestamp(event.timestamp, 'event.timestamp');
  requireText(event.actorClass, 'event.actorClass');
  eventType(event.eventType);

  if (event.entityType !== null) entityType(event.entityType);
  if (event.entityId !== null) entityId(event.entityId);
  for (const field of ['lifecycleId', 'taskId', 'contractId', 'runId']) optionalText(event[field], field);
  if (!plainObject(event.payload)) throw new StateEngineError('Event payload must be an object');

  if (previous === null) {
    if (event.sequence !== 1) throw new StateEngineError('First state event sequence must be 1');
    if (event.previousEventHash !== null) throw new StateEngineError('First state event previousEventHash must be null');
  } else {
    if (event.sequence !== previous.sequence + 1) throw new StateEngineError('Event sequence is not contiguous');
    if (event.previousEventHash !== previous.eventHash) throw new StateEngineError('Event previousEventHash does not match chain');
  }

  if (typeof event.eventHash !== 'string' || !SHA256_PATTERN.test(event.eventHash)) {
    throw new StateEngineError('Event eventHash is invalid');
  }
  if (event.eventHash !== computeEventHash(event)) {
    throw new StateEngineError(`Event hash mismatch at sequence ${event.sequence}`);
  }

  const base = { ...eventHashPayload(event) };
  delete base.eventId;
  if (event.eventId !== computeEventId(base)) {
    throw new StateEngineError(`Event ID mismatch at sequence ${event.sequence}`);
  }

  return true;
}

function parseLedger(content) {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  const events = [];
  let previous = null;

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) throw new StateEngineError(`Canonical state ledger contains a blank record at line ${i + 1}`);
    let event;
    try {
      event = JSON.parse(lines[i]);
    } catch (error) {
      throw new StateEngineError(`Canonical state ledger JSON is invalid at line ${i + 1}: ${error.message}`);
    }
    validateStateEvent(event, previous);
    events.push(event);
    previous = event;
  }
  return events;
}

export function loadCanonicalEvents(rootDir = process.cwd()) {
  const paths = statePaths(rootDir);
  if (!fs.existsSync(paths.events)) return [];
  if (fs.existsSync(paths.pending)) {
    return withStateLock(rootDir, () => parseLedger(fs.readFileSync(paths.events, 'utf8')));
  }
  const content = fs.readFileSync(paths.events, 'utf8');
  if (fs.existsSync(paths.pending)) {
    return withStateLock(rootDir, () => parseLedger(fs.readFileSync(paths.events, 'utf8')));
  }
  return parseLedger(content);
}

function normalizePathSegments(value) {
  if (!Array.isArray(value) || value.some((segment) => typeof segment !== 'string' || !segment || /[\r\n\0]/.test(segment))) {
    throw new StateEngineError('Patch operation path must be a non-empty string array');
  }
  return value;
}

function cloneSerializable(value, label) {
  try {
    const cloned = structuredClone(value);
    JSON.stringify(cloned);
    return cloned;
  } catch {
    throw new StateEngineError(`${label} must be JSON-serializable`);
  }
}

function diffValues(before, after, pathSegments = []) {
  if (stableJson(before) === stableJson(after)) return [];

  if (plainObject(before) && plainObject(after)) {
    const operations = [];
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const childPath = [...pathSegments, key];
      if (!(key in after)) {
        operations.push({ op: 'delete', path: childPath });
      } else if (!(key in before)) {
        operations.push({ op: 'set', path: childPath, value: cloneSerializable(after[key], 'Patch value') });
      } else {
        operations.push(...diffValues(before[key], after[key], childPath));
      }
    }
    return operations;
  }

  return [{ op: 'set', path: pathSegments, value: cloneSerializable(after, 'Patch value') }];
}

function setAtPath(target, segments, value) {
  if (segments.length === 0) return cloneSerializable(value, 'Patch root value');
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (!plainObject(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[segments.at(-1)] = cloneSerializable(value, 'Patch value');
  return target;
}

function deleteAtPath(target, segments) {
  if (segments.length === 0) throw new StateEngineError('Cannot delete the entity-state root');
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (!plainObject(cursor[key])) return target;
    cursor = cursor[key];
  }
  delete cursor[segments.at(-1)];
  return target;
}

function applyOperations(previousState, operations) {
  if (!Array.isArray(operations)) throw new StateEngineError('State event operations must be an array');
  let next = cloneSerializable(previousState, 'Previous state');
  for (const operation of operations) {
    if (!plainObject(operation)) throw new StateEngineError('Patch operation must be an object');
    const segments = normalizePathSegments(operation.path);
    if (operation.op === 'set') {
      next = setAtPath(next, segments, operation.value);
    } else if (operation.op === 'delete') {
      next = deleteAtPath(next, segments);
    } else {
      throw new StateEngineError(`Unsupported patch operation: ${operation.op}`);
    }
  }
  return next;
}

function ensureEntityBucket(snapshot, type) {
  if (!snapshot.entities[type]) snapshot.entities[type] = {};
  return snapshot.entities[type];
}

export function rebuildSnapshotFromEvents(events) {
  if (!Array.isArray(events)) throw new StateEngineError('events must be an array');
  const snapshot = emptySnapshot();
  let previous = null;

  for (const event of events) {
    validateStateEvent(event, previous);

    if (event.eventType === 'ENTITY_STATE_INITIALIZED') {
      if (event.entityType === null || event.entityId === null) throw new StateEngineError('State initialization event requires entity identity');
      const bucket = ensureEntityBucket(snapshot, event.entityType);
      if (bucket[event.entityId]) throw new StateEngineError(`Entity is initialized more than once: ${event.entityType}/${event.entityId}`);
      const state = cloneSerializable(event.payload.state, 'Initialized state');
      const revision = stateRevision(event.payload.stateRevision);
      bucket[event.entityId] = {
        stateRevision: revision,
        state,
        lastEventSequence: event.sequence,
        lastEventHash: event.eventHash,
        refs: {
          lifecycleId: event.lifecycleId,
          taskId: event.taskId,
          contractId: event.contractId,
          runId: event.runId,
        },
      };
    } else if (event.eventType === 'ENTITY_STATE_UPDATED') {
      if (event.entityType === null || event.entityId === null) throw new StateEngineError('State update event requires entity identity');
      const bucket = ensureEntityBucket(snapshot, event.entityType);
      const current = bucket[event.entityId];
      if (!current) throw new StateEngineError(`State update references unknown entity: ${event.entityType}/${event.entityId}`);
      const revision = stateRevision(event.payload.stateRevision);
      if (revision < current.stateRevision) {
        throw new StateEngineError(`Entity stateRevision regressed for ${event.entityType}/${event.entityId}`);
      }
      current.state = applyOperations(current.state, event.payload.operations);
      current.stateRevision = revision;
      current.lastEventSequence = event.sequence;
      current.lastEventHash = event.eventHash;
      current.refs = {
        lifecycleId: event.lifecycleId ?? current.refs.lifecycleId,
        taskId: event.taskId ?? current.refs.taskId,
        contractId: event.contractId ?? current.refs.contractId,
        runId: event.runId ?? current.refs.runId,
      };
    } else if (event.eventType === 'MIGRATION_COMPLETED') {
      const migrationId = requireText(event.payload.migrationId, 'migrationId');
      const sourceFingerprint = requireText(event.payload.sourceFingerprint, 'sourceFingerprint');
      if (!SHA256_PATTERN.test(sourceFingerprint)) throw new StateEngineError('Migration sourceFingerprint is invalid');
      if (!snapshot.migrations.some((migration) => migration.migrationId === migrationId)) {
        snapshot.migrations.push({
          migrationId,
          sourceFingerprint,
          completedAt: event.timestamp,
          entityCount: Number(event.payload.entityCount ?? 0),
          semanticEquivalence: event.payload.semanticEquivalence === true,
        });
      }
    }

    snapshot.lastEventSequence = event.sequence;
    snapshot.lastEventHash = event.eventHash;
    previous = event;
  }

  snapshot.migrations.sort((a, b) => a.migrationId.localeCompare(b.migrationId));
  return snapshot;
}

export function validateStateSnapshot(snapshot) {
  if (!plainObject(snapshot)) throw new StateEngineError('State snapshot must be an object');
  if (snapshot.schemaVersion !== STATE_SNAPSHOT_SCHEMA_VERSION) throw new StateEngineError('Unsupported snapshot schemaVersion');
  if (snapshot.engineSchemaVersion !== STATE_ENGINE_SCHEMA_VERSION) throw new StateEngineError('Snapshot engine schema mismatch');
  if (!Number.isInteger(snapshot.lastEventSequence) || snapshot.lastEventSequence < 0) throw new StateEngineError('Snapshot lastEventSequence is invalid');
  if (snapshot.lastEventHash !== null && !SHA256_PATTERN.test(snapshot.lastEventHash)) throw new StateEngineError('Snapshot lastEventHash is invalid');
  if (!plainObject(snapshot.entities)) throw new StateEngineError('Snapshot entities must be an object');
  if (!Array.isArray(snapshot.migrations)) throw new StateEngineError('Snapshot migrations must be an array');

  for (const [type, bucket] of Object.entries(snapshot.entities)) {
    entityType(type);
    if (!plainObject(bucket)) throw new StateEngineError(`Snapshot entity bucket is invalid: ${type}`);
    for (const [id, record] of Object.entries(bucket)) {
      entityId(id);
      if (!plainObject(record)) throw new StateEngineError('Snapshot entity record must be an object');
      stateRevision(record.stateRevision);
      if (!Number.isInteger(record.lastEventSequence) || record.lastEventSequence < 1) throw new StateEngineError('Entity lastEventSequence is invalid');
      if (!SHA256_PATTERN.test(record.lastEventHash)) throw new StateEngineError('Entity lastEventHash is invalid');
      cloneSerializable(record.state, 'Entity state');
    }
  }
  return true;
}

function indexArrayPush(map, key, value) {
  if (!key) return;
  if (!map[key]) map[key] = [];
  if (!map[key].includes(value)) map[key].push(value);
}

export function buildStateIndex(snapshot) {
  validateStateSnapshot(snapshot);
  const records = [];
  const byContract = {};
  const byTask = {};
  const byRun = {};
  const byLifecycle = {};

  for (const [type, bucket] of Object.entries(snapshot.entities).sort(([a], [b]) => a.localeCompare(b))) {
    for (const [id, record] of Object.entries(bucket).sort(([a], [b]) => a.localeCompare(b))) {
      const key = `${type}::${id}`;
      records.push({
        key,
        entityType: type,
        entityId: id,
        stateRevision: record.stateRevision,
        lastEventSequence: record.lastEventSequence,
        lastEventHash: record.lastEventHash,
      });
      indexArrayPush(byContract, record.refs?.contractId, key);
      indexArrayPush(byTask, record.refs?.taskId, key);
      indexArrayPush(byRun, record.refs?.runId, key);
      indexArrayPush(byLifecycle, record.refs?.lifecycleId, key);
    }
  }

  for (const map of [byContract, byTask, byRun, byLifecycle]) {
    for (const values of Object.values(map)) values.sort();
  }

  return {
    schemaVersion: STATE_INDEX_SCHEMA_VERSION,
    sourceSequence: snapshot.lastEventSequence,
    sourceHash: snapshot.lastEventHash,
    recordCount: records.length,
    records,
    byContract,
    byTask,
    byRun,
    byLifecycle,
  };
}

export function validateStateIndex(index, snapshot = null) {
  if (!plainObject(index)) throw new StateEngineError('State index must be an object');
  if (index.schemaVersion !== STATE_INDEX_SCHEMA_VERSION) throw new StateEngineError('Unsupported index schemaVersion');
  if (!Number.isInteger(index.sourceSequence) || index.sourceSequence < 0) throw new StateEngineError('Index sourceSequence is invalid');
  if (index.sourceHash !== null && !SHA256_PATTERN.test(index.sourceHash)) throw new StateEngineError('Index sourceHash is invalid');
  if (!Array.isArray(index.records)) throw new StateEngineError('Index records must be an array');
  if (index.recordCount !== index.records.length) throw new StateEngineError('Index recordCount mismatch');
  for (const field of ['byContract', 'byTask', 'byRun', 'byLifecycle']) {
    if (!plainObject(index[field])) throw new StateEngineError(`Index ${field} must be an object`);
  }
  if (snapshot) {
    validateStateSnapshot(snapshot);
    if (index.sourceSequence !== snapshot.lastEventSequence || index.sourceHash !== snapshot.lastEventHash) {
      throw new StateEngineError('State index is stale relative to snapshot');
    }
  }
  return true;
}

function persistDerived(snapshot, rootDir) {
  validateStateSnapshot(snapshot);
  const paths = ensureStateEngineLayout(rootDir);
  const index = buildStateIndex(snapshot);
  atomicWrite(paths.snapshot, stablePretty(snapshot));
  atomicWrite(paths.index, stablePretty(index));
  return { snapshot, index };
}

function repairDerivedLocked(rootDir) {
  // Snapshot repair replays the *current* ledger under the writer lock, never a
  // stale cached history from before another writer committed a later event.
  const paths = ensureStateEngineLayout(rootDir);
  const canonical = rebuildSnapshotFromEvents(parseLedger(fs.readFileSync(paths.events, 'utf8')));
  if (fs.existsSync(paths.snapshot)) {
    let witness = null;
    try {
      witness = JSON.parse(fs.readFileSync(paths.snapshot, 'utf8'));
      validateStateSnapshot(witness);
    } catch {
      witness = null;
    }
    if (witness && witness.lastEventSequence > canonical.lastEventSequence) {
      throw new StateEngineError('Canonical state history appears truncated relative to the materialized snapshot');
    }
    if (witness && witness.lastEventSequence === canonical.lastEventSequence
      && witness.lastEventHash !== canonical.lastEventHash) {
      throw new StateEngineError('Canonical state history hash differs from the materialized snapshot integrity witness');
    }
  }
  persistDerived(canonical, rootDir);
  return canonical;
}

export function rebuildStateSnapshot(rootDir = process.cwd()) {
  return withStateLock(rootDir, () => repairDerivedLocked(rootDir));
}

export function loadStateSnapshot(rootDir = process.cwd(), { rebuildIfNeeded = true } = {}) {
  const paths = statePaths(rootDir);
  if (!fs.existsSync(paths.events)) return null;
  const canonical = rebuildSnapshotFromEvents(loadCanonicalEvents(rootDir));

  if (!fs.existsSync(paths.snapshot)) {
    if (!rebuildIfNeeded) return null;
    return withStateLock(rootDir, () => repairDerivedLocked(rootDir));
  }

  let current;
  try {
    current = JSON.parse(fs.readFileSync(paths.snapshot, 'utf8'));
    validateStateSnapshot(current);
  } catch (error) {
    if (!rebuildIfNeeded) throw error;
    return withStateLock(rootDir, () => repairDerivedLocked(rootDir));
  }

  if (current.lastEventSequence > canonical.lastEventSequence) {
    // A legitimate writer can advance the snapshot between a reader's ledger
    // and snapshot reads. Check the latest canonical history before declaring
    // truncation, without silencing a genuine witnessed history regression.
    if (rebuildIfNeeded) {
      const refreshed = rebuildSnapshotFromEvents(loadCanonicalEvents(rootDir));
      if (refreshed.lastEventSequence > current.lastEventSequence
        || (refreshed.lastEventSequence === current.lastEventSequence
          && refreshed.lastEventHash === current.lastEventHash)) {
        return refreshed;
      }
    }
    throw new StateEngineError(
      'Canonical state history appears truncated relative to the materialized snapshot',
      {
        snapshotSequence: current.lastEventSequence,
        canonicalSequence: canonical.lastEventSequence,
        snapshotHash: current.lastEventHash,
        canonicalHash: canonical.lastEventHash,
      },
    );
  }
  if (current.lastEventSequence === canonical.lastEventSequence
    && current.lastEventHash !== canonical.lastEventHash) {
    throw new StateEngineError(
      'Canonical state history hash differs from the materialized snapshot integrity witness',
      {
        sequence: current.lastEventSequence,
        snapshotHash: current.lastEventHash,
        canonicalHash: canonical.lastEventHash,
      },
    );
  }
  if (stableJson(current) !== stableJson(canonical)) {
    if (!rebuildIfNeeded) throw new StateEngineError('Materialized snapshot does not match canonical history');
    return withStateLock(rootDir, () => repairDerivedLocked(rootDir));
  }
  return current;
}

export function rebuildStateIndex(rootDir = process.cwd()) {
  return withStateLock(rootDir, () => {
    const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true }) ?? emptySnapshot();
    const paths = ensureStateEngineLayout(rootDir);
    const index = buildStateIndex(snapshot);
    atomicWrite(paths.index, stablePretty(index));
    return index;
  });
}

export function loadStateIndex(rootDir = process.cwd(), { rebuildIfNeeded = true } = {}) {
  const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true }) ?? emptySnapshot();
  const paths = statePaths(rootDir);
  if (!fs.existsSync(paths.index)) {
    return rebuildIfNeeded ? rebuildStateIndex(rootDir) : null;
  }
  try {
    const index = JSON.parse(fs.readFileSync(paths.index, 'utf8'));
    validateStateIndex(index, snapshot);
    return index;
  } catch (error) {
    if (!rebuildIfNeeded) throw error;
    return rebuildStateIndex(rootDir);
  }
}

function buildEvent({
  sequence,
  previousEventHash,
  timestamp: at,
  actorClass,
  type,
  id: entityIdentifier = null,
  entity: entityKind = null,
  refs = {},
  payload,
}) {
  const base = {
    schemaVersion: STATE_EVENT_SCHEMA_VERSION,
    sequence,
    timestamp: timestamp(at, 'event timestamp'),
    actorClass: requireText(actorClass, 'actorClass'),
    eventType: eventType(type),
    entityType: entityKind === null ? null : entityType(entityKind),
    entityId: entityIdentifier === null ? null : entityId(entityIdentifier),
    lifecycleId: optionalText(refs.lifecycleId, 'lifecycleId'),
    taskId: optionalText(refs.taskId, 'taskId'),
    contractId: optionalText(refs.contractId, 'contractId'),
    runId: optionalText(refs.runId, 'runId'),
    payload: cloneSerializable(payload, 'Event payload'),
    previousEventHash: previousEventHash ?? null,
  };
  const eventId = computeEventId(base);
  const event = {
    ...base,
    eventId,
  };
  event.eventHash = computeEventHash(event);
  return event;
}

function appendDurably(filePath, appendedText, expectedIdentity = null) {
  // O_NOFOLLOW rejects a final-component symlink on supported POSIX hosts.
  // On Windows, verify the opened inode and current directory entry before
  // writing because path-only preflight cannot prevent a replacement race.
  const flags = fs.constants.O_WRONLY | fs.constants.O_APPEND | (fs.constants.O_NOFOLLOW ?? 0);
  const fd = fs.openSync(filePath, flags);
  try {
    const stat = fs.fstatSync(fd);
    const entry = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.nlink !== 1 || entry.isSymbolicLink() ||
      !entry.isFile() || entry.nlink !== 1 ||
      entry.dev !== stat.dev || entry.ino !== stat.ino) {
      throw new StateEngineError('Canonical event file symlink/inode mismatch or multiple hard links');
    }
    if (expectedIdentity && (stat.dev !== expectedIdentity.dev ||
      stat.ino !== expectedIdentity.ino || stat.size !== expectedIdentity.size)) {
      throw new StateEngineError('Canonical event inode changed between event preparation and append');
    }
    const bytes = Buffer.from(appendedText, 'utf8');
    let written = 0;
    while (written < bytes.length) {
      const amount = fs.writeSync(fd, bytes, written, bytes.length - written);
      if (amount <= 0) throw new StateEngineError('Canonical event append made no forward progress');
      written += amount;
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function recoverPendingCommitLocked(rootDir) {
  const paths = ensureStateEngineLayout(rootDir);
  if (!fs.existsSync(paths.pending)) return;
  let pending;
  try {
    pending = JSON.parse(fs.readFileSync(paths.pending, 'utf8'));
  } catch (error) {
    throw new StateEngineError('Pending State Engine commit is invalid: ' + error.message);
  }
  if (
    pending.schemaVersion !== '1.0.0'
    || !Number.isSafeInteger(pending.previousByteLength)
    || pending.previousByteLength < 0
    || !SHA256_PATTERN.test(pending.previousHash)
    || typeof pending.suffix !== 'string'
    || !pending.suffix.endsWith('\n')
  ) {
    throw new StateEngineError('Pending State Engine commit metadata is invalid');
  }
  // Bind every recovery operation to the same verified canonical descriptor.
  // Pathname truncation can otherwise modify a hardlinked external file when
  // an attacker replaces events.jsonl after the prefix has been inspected.
  const flags = fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW ?? 0);
  const fd = fs.openSync(paths.events, flags);
  let canonical;
  try {
    const opened = fs.fstatSync(fd);
    const entry = fs.lstatSync(paths.events);
    if (!opened.isFile() || !entry.isFile() || entry.isSymbolicLink() ||
      opened.nlink !== 1 || entry.nlink !== 1 ||
      opened.dev !== entry.dev || opened.ino !== entry.ino) {
      throw new StateEngineError('Recovery canonical ledger inode/symlink/hardlink integrity failed');
    }
    const bytes = Buffer.alloc(opened.size);
    let read = 0;
    while (read < bytes.length) {
      const amount = fs.readSync(fd, bytes, read, bytes.length - read, read);
      if (amount <= 0) throw new StateEngineError('Canonical ledger changed while recovering pending commit');
      read += amount;
    }
    if (bytes.length < pending.previousByteLength) {
      throw new StateEngineError('Canonical state history was truncated during a pending commit');
    }
    if (sha256(bytes.subarray(0, pending.previousByteLength)) !== pending.previousHash) {
      throw new StateEngineError('Canonical state prefix differs from pending commit integrity witness');
    }
    const existingSuffix = bytes.subarray(pending.previousByteLength);
    const expectedSuffix = Buffer.from(pending.suffix, 'utf8');
    if (!expectedSuffix.subarray(0, existingSuffix.length).equals(existingSuffix)) {
      throw new StateEngineError('Canonical state suffix conflicts with pending commit; refusing recovery');
    }
    if (existingSuffix.length < expectedSuffix.length) {
      // Truncate and repair through this FD, never a separately resolved path.
      fs.ftruncateSync(fd, pending.previousByteLength);
      let written = 0;
      while (written < expectedSuffix.length) {
        const amount = fs.writeSync(fd, expectedSuffix, written,
          expectedSuffix.length - written, pending.previousByteLength + written);
        if (amount <= 0) throw new StateEngineError('Pending recovery append made no forward progress');
        written += amount;
      }
      fs.fsyncSync(fd);
    }
    canonical = rebuildSnapshotFromEvents(
      parseLedger(Buffer.concat([bytes.subarray(0, pending.previousByteLength), expectedSuffix]).toString('utf8')),
    );
  } finally {
    fs.closeSync(fd);
  }
  // Reconstruct both derived views before acknowledging the durable commit.
  let witness = null;
  try {
    witness = JSON.parse(fs.readFileSync(paths.snapshot, 'utf8'));
    validateStateSnapshot(witness);
  } catch {
    witness = null;
  }
  if (witness && witness.lastEventSequence > canonical.lastEventSequence) {
    throw new StateEngineError('Cannot recover a pending commit over a later snapshot integrity witness');
  }
  if (witness && witness.lastEventSequence === canonical.lastEventSequence
    && witness.lastEventHash !== canonical.lastEventHash) {
    throw new StateEngineError('Pending recovery conflicts with snapshot integrity witness');
  }
  persistDerived(canonical, rootDir);
  fs.unlinkSync(paths.pending);
  fsyncParentDirectory(paths.stateRoot);
}

const ACTIVE_STATE_LOCKS = new Set();
function withStateLock(rootDir, task) {
  const key = path.resolve(rootDir);
  if (ACTIVE_STATE_LOCKS.has(key)) return task();
  const lock = acquireStateLock(rootDir);
  ACTIVE_STATE_LOCKS.add(key);
  try {
    recoverPendingCommitLocked(rootDir);
    return task();
  } finally {
    ACTIVE_STATE_LOCKS.delete(key);
    releaseStateLock(lock);
  }
}

function commitPreparedEventsLocked(newEvents, rootDir = process.cwd()) {
  if (!Array.isArray(newEvents) || newEvents.length === 0) {
    const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true }) ?? emptySnapshot();
    return { events: [], snapshot, index: loadStateIndex(rootDir, { rebuildIfNeeded: true }) };
  }

  const paths = ensureStateEngineLayout(rootDir);
  const expectedIdentity = fs.lstatSync(paths.events);
  const existingContent = fs.readFileSync(paths.events, 'utf8');
  const existing = parseLedger(existingContent);
  let previous = existing.at(-1) ?? null;
  for (const event of newEvents) {
    validateStateEvent(event, previous);
    previous = event;
  }
  const allEvents = [...existing, ...newEvents];
  // Validate and reconstruct before beginning a durable state mutation.
  const nextSnapshot = rebuildSnapshotFromEvents(allEvents);
  // A valid last event may lack the optional terminating newline. Preserve
  // record separation when appending, including in the crash-recovery journal.
  const separator = existingContent.length > 0 && !existingContent.endsWith('\n') ? '\n' : '';
  const suffix = separator + newEvents.map((event) => JSON.stringify(stable(event))).join('\n') + '\n';
  const pending = {
    schemaVersion: '1.0.0',
    previousByteLength: Buffer.byteLength(existingContent, 'utf8'),
    previousHash: sha256(Buffer.from(existingContent, 'utf8')),
    suffix,
  };
  atomicWrite(paths.pending, stablePretty(pending));
  // Physical append avoids O(history) rewrites; the pending journal permits
  // deterministic repair after a torn write or interrupted snapshot persist.
  appendDurably(paths.events, suffix, expectedIdentity);
  const { index } = persistDerived(nextSnapshot, rootDir);
  fs.unlinkSync(paths.pending);
  fsyncParentDirectory(paths.stateRoot);
  return { events: newEvents, snapshot: nextSnapshot, index };
}

function nextEventContext(rootDir) {
  const events = loadCanonicalEvents(rootDir);
  const previous = events.at(-1) ?? null;
  return {
    sequence: previous ? previous.sequence + 1 : 1,
    previousEventHash: previous?.eventHash ?? null,
    previous,
  };
}

export function appendEntityState({
  rootDir = process.cwd(),
  entityType: type,
  entityId: id,
  state,
  refs = {},
  actorClass = 'runtime',
  timestamp: at = new Date().toISOString(),
} = {}) {
  const normalizedType = entityType(type);
  const normalizedId = entityId(id);
  const nextState = cloneSerializable(state, 'Entity state');
  const revision = stateRevision(nextState.stateRevision);

  return withStateLock(rootDir, () => {
    const currentSnapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true }) ?? emptySnapshot();
    const current = currentSnapshot.entities[normalizedType]?.[normalizedId] ?? null;

    if (current && revision < current.stateRevision) {
      throw new StateEngineError('Refusing stateRevision regression for ' + normalizedType + '/' + normalizedId);
    }
    if (current && stableJson(current.state) === stableJson(nextState)) {
      return Object.freeze({ changed: false, event: null, snapshot: currentSnapshot });
    }

    const context = nextEventContext(rootDir);
    const payload = current
      ? { stateRevision: revision, operations: diffValues(current.state, nextState) }
      : { stateRevision: revision, state: nextState };
    const event = buildEvent({
      sequence: context.sequence,
      previousEventHash: context.previousEventHash,
      timestamp: at,
      actorClass,
      type: current ? 'ENTITY_STATE_UPDATED' : 'ENTITY_STATE_INITIALIZED',
      id: normalizedId,
      entity: normalizedType,
      refs,
      payload,
    });
    const committed = commitPreparedEventsLocked([event], rootDir);
    return Object.freeze({ changed: true, event, snapshot: committed.snapshot });
  });
}

export function appendMetadataEvent({
  rootDir = process.cwd(),
  eventType: type,
  payload,
  refs = {},
  actorClass = 'runtime',
  timestamp: at = new Date().toISOString(),
} = {}) {
  return withStateLock(rootDir, () => {
    const context = nextEventContext(rootDir);
    const event = buildEvent({
      sequence: context.sequence,
      previousEventHash: context.previousEventHash,
      timestamp: at,
      actorClass,
      type,
      id: null,
      entity: null,
      refs,
      payload,
    });
    const committed = commitPreparedEventsLocked([event], rootDir);
    return Object.freeze({ event, snapshot: committed.snapshot });
  });
}

export function loadEntityState(type, id, rootDir = process.cwd()) {
  const normalizedType = entityType(type);
  const normalizedId = entityId(id);
  const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true });
  const record = snapshot?.entities?.[normalizedType]?.[normalizedId];
  return record ? structuredClone(record.state) : null;
}

export function listEntityRecords(type, rootDir = process.cwd()) {
  const normalizedType = entityType(type);
  const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true });
  const bucket = snapshot?.entities?.[normalizedType] ?? {};
  return Object.entries(bucket)
    .map(([id, record]) => ({
      entityId: id,
      stateRevision: record.stateRevision,
      lastEventSequence: record.lastEventSequence,
      refs: structuredClone(record.refs),
    }))
    .sort((a, b) => a.entityId.localeCompare(b.entityId));
}

export function loadLatestEntityState(type, rootDir = process.cwd()) {
  const normalizedType = entityType(type);
  const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true });
  const bucket = snapshot?.entities?.[normalizedType] ?? {};
  const records = Object.entries(bucket)
    .map(([id, record]) => ({ id, record }))
    .sort((a, b) => b.record.lastEventSequence - a.record.lastEventSequence || a.id.localeCompare(b.id));
  if (records.length === 0) return null;
  return structuredClone(records[0].record.state);
}

export function hasCompletedStateMigration(rootDir = process.cwd(), sourceFingerprint = null) {
  const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true });
  const migrations = snapshot?.migrations ?? [];
  if (sourceFingerprint === null || sourceFingerprint === undefined) {
    return migrations.some((migration) => migration.semanticEquivalence === true);
  }
  return migrations.some((migration) => (
    migration.semanticEquivalence === true
    && migration.sourceFingerprint === sourceFingerprint
  ));
}

export function queryStateIndex({
  rootDir = process.cwd(),
  contractId = null,
  taskId = null,
  runId = null,
  lifecycleId = null,
} = {}) {
  const index = loadStateIndex(rootDir, { rebuildIfNeeded: true });
  const filters = [
    ['byContract', contractId],
    ['byTask', taskId],
    ['byRun', runId],
    ['byLifecycle', lifecycleId],
  ].filter(([, value]) => value !== null && value !== undefined);

  if (filters.length === 0) return structuredClone(index.records);

  let keys = null;
  for (const [field, value] of filters) {
    const current = new Set(index[field][String(value)] ?? []);
    keys = keys === null ? current : new Set([...keys].filter((key) => current.has(key)));
  }
  return index.records.filter((record) => keys.has(record.key)).map((record) => structuredClone(record));
}

export function verifyStateEngineIntegrity(rootDir = process.cwd()) {
  const events = loadCanonicalEvents(rootDir);
  const canonical = rebuildSnapshotFromEvents(events);
  const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: false });
  const index = loadStateIndex(rootDir, { rebuildIfNeeded: false });

  if (snapshot === null) throw new StateEngineError('State snapshot is missing');
  if (stableJson(snapshot) !== stableJson(canonical)) {
    throw new StateEngineError('State snapshot is not semantically equivalent to canonical history');
  }
  validateStateIndex(index, snapshot);
  const rebuiltIndex = buildStateIndex(snapshot);
  if (stableJson(index) !== stableJson(rebuiltIndex)) {
    throw new StateEngineError('State index is not semantically equivalent to rebuilt index');
  }

  return Object.freeze({
    valid: true,
    eventCount: events.length,
    entityCount: Object.values(snapshot.entities).reduce((sum, bucket) => sum + Object.keys(bucket).length, 0),
    lastEventSequence: snapshot.lastEventSequence,
    lastEventHash: snapshot.lastEventHash,
  });
}

export function cleanupOrphanedStateTemps(rootDir = process.cwd()) {
  const paths = statePaths(rootDir);
  if (!fs.existsSync(paths.stateRoot)) return [];
  const removed = [];
  for (const name of fs.readdirSync(paths.stateRoot)) {
    if (!name.includes('.tmp-')) continue;
    const candidate = path.join(paths.stateRoot, name);
    if (fs.statSync(candidate).isFile()) {
      fs.unlinkSync(candidate);
      removed.push(candidate);
    }
  }
  return removed;
}

export function getStateEnginePaths(rootDir = process.cwd()) {
  return statePaths(rootDir);
}

export function countStateEngineFiles(rootDir = process.cwd()) {
  const paths = statePaths(rootDir);
  if (!fs.existsSync(paths.stateRoot)) return 0;
  return fs.readdirSync(paths.stateRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'state.lock' && entry.name !== 'pending-commit.json' && !entry.name.includes('.tmp-'))
    .length;
}

export { stableJson as canonicalStateJson, sha256 as stateSha256 };
