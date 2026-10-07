import crypto from 'node:crypto';
import fs from 'node:fs';
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
  return Object.freeze({
    root,
    stateRoot,
    events: path.join(stateRoot, STATE_EVENTS_FILE),
    snapshot: path.join(stateRoot, STATE_SNAPSHOT_FILE),
    index: path.join(stateRoot, STATE_INDEX_FILE),
    schema: path.join(stateRoot, STATE_SCHEMA_FILE),
    lock: path.join(stateRoot, 'state.lock'),
  });
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
  return filePath;
}

function acquireStateLock(rootDir, timeoutMs = 5000) {
  const paths = statePaths(rootDir);
  fs.mkdirSync(paths.stateRoot, { recursive: true });
  const owner = `state-lock-${crypto.randomUUID()}`;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const fd = fs.openSync(paths.lock, 'wx');
      try {
        fs.writeFileSync(fd, JSON.stringify({ owner, acquiredAt: new Date().toISOString() }), 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      return { path: paths.lock, owner };
    } catch (error) {
      if (error.code !== 'EEXIST') throw new StateEngineError(`Unable to acquire State Engine lock: ${error.message}`);
      try {
        const stat = fs.statSync(paths.lock);
        if (Date.now() - stat.mtimeMs > 15_000) {
          fs.unlinkSync(paths.lock);
          continue;
        }
      } catch {}
      const waitStart = Date.now();
      while (Date.now() - waitStart < 25) {}
    }
  }
  throw new StateEngineError('State Engine lock acquisition timed out');
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

  const expectedSchema = stablePretty(schemaDocument());
  if (fs.existsSync(paths.schema)) {
    const existing = fs.readFileSync(paths.schema, 'utf8');
    if (existing !== expectedSchema) {
      let parsed;
      try { parsed = JSON.parse(existing); } catch {}
      if (parsed?.schemaVersion !== STATE_ENGINE_SCHEMA_VERSION) {
        throw new StateEngineError('State Engine schema.json is incompatible with runtime schema');
      }
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
  if (!fs.existsSync(paths.schema) || !fs.existsSync(paths.events)) return false;
  try {
    const schema = JSON.parse(fs.readFileSync(paths.schema, 'utf8'));
    return schema.schemaVersion === STATE_ENGINE_SCHEMA_VERSION;
  } catch {
    return false;
  }
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
  return parseLedger(fs.readFileSync(paths.events, 'utf8'));
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

export function rebuildStateSnapshot(rootDir = process.cwd()) {
  const events = loadCanonicalEvents(rootDir);
  const snapshot = rebuildSnapshotFromEvents(events);
  persistDerived(snapshot, rootDir);
  return snapshot;
}

export function loadStateSnapshot(rootDir = process.cwd(), { rebuildIfNeeded = true } = {}) {
  const paths = statePaths(rootDir);
  if (!fs.existsSync(paths.events)) return null;
  const events = loadCanonicalEvents(rootDir);
  const canonical = rebuildSnapshotFromEvents(events);

  if (!fs.existsSync(paths.snapshot)) {
    if (!rebuildIfNeeded) return null;
    persistDerived(canonical, rootDir);
    return canonical;
  }

  let current;
  try {
    current = JSON.parse(fs.readFileSync(paths.snapshot, 'utf8'));
    validateStateSnapshot(current);
  } catch (error) {
    if (!rebuildIfNeeded) throw error;
    persistDerived(canonical, rootDir);
    return canonical;
  }

  if (stableJson(current) !== stableJson(canonical)) {
    if (!rebuildIfNeeded) throw new StateEngineError('Materialized snapshot does not match canonical history');
    persistDerived(canonical, rootDir);
    return canonical;
  }
  return current;
}

export function rebuildStateIndex(rootDir = process.cwd()) {
  const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true }) ?? emptySnapshot();
  const paths = ensureStateEngineLayout(rootDir);
  const index = buildStateIndex(snapshot);
  atomicWrite(paths.index, stablePretty(index));
  return index;
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

function writeLedgerAtomically(existingContent, newEvents, rootDir) {
  const paths = ensureStateEngineLayout(rootDir);
  let prefix = existingContent;
  if (prefix && !prefix.endsWith('\n')) prefix += '\n';
  const suffix = newEvents.map((event) => JSON.stringify(stable(event))).join('\n');
  const nextContent = suffix ? `${prefix}${suffix}\n` : prefix;
  atomicWrite(paths.events, nextContent);
}

function commitPreparedEvents(newEvents, rootDir = process.cwd()) {
  if (!Array.isArray(newEvents) || newEvents.length === 0) {
    const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true }) ?? emptySnapshot();
    return { events: [], snapshot, index: loadStateIndex(rootDir, { rebuildIfNeeded: true }) };
  }

  const lock = acquireStateLock(rootDir);
  try {
    const paths = ensureStateEngineLayout(rootDir);
    const existingContent = fs.readFileSync(paths.events, 'utf8');
    const existing = parseLedger(existingContent);
    let previous = existing.at(-1) ?? null;
    for (const event of newEvents) {
      validateStateEvent(event, previous);
      previous = event;
    }

    writeLedgerAtomically(existingContent, newEvents, rootDir);
    const allEvents = [...existing, ...newEvents];
    const snapshot = rebuildSnapshotFromEvents(allEvents);
    const { index } = persistDerived(snapshot, rootDir);
    return { events: newEvents, snapshot, index };
  } finally {
    releaseStateLock(lock);
  }
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

  ensureStateEngineLayout(rootDir);
  const currentSnapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: true }) ?? emptySnapshot();
  const current = currentSnapshot.entities[normalizedType]?.[normalizedId] ?? null;

  if (current && revision < current.stateRevision) {
    throw new StateEngineError(`Refusing stateRevision regression for ${normalizedType}/${normalizedId}`);
  }
  if (current && stableJson(current.state) === stableJson(nextState)) {
    return Object.freeze({ changed: false, event: null, snapshot: currentSnapshot });
  }

  const context = nextEventContext(rootDir);
  const payload = current
    ? {
        stateRevision: revision,
        operations: diffValues(current.state, nextState),
      }
    : {
        stateRevision: revision,
        state: nextState,
      };

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

  const committed = commitPreparedEvents([event], rootDir);
  return Object.freeze({
    changed: true,
    event,
    snapshot: committed.snapshot,
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
  ensureStateEngineLayout(rootDir);
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
  const committed = commitPreparedEvents([event], rootDir);
  return Object.freeze({ event, snapshot: committed.snapshot });
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
    .filter((entry) => entry.isFile() && entry.name !== 'state.lock' && !entry.name.includes('.tmp-'))
    .length;
}

export { stableJson as canonicalStateJson, sha256 as stateSha256 };
