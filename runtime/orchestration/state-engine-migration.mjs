import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validateWorkflowState } from '../autopilot/validators.mjs';
import { validateOrchestrationRun } from './orchestration-run.mjs';
import {
  appendEntityState,
  appendMetadataEvent,
  canonicalStateJson,
  ensureStateEngineLayout,
  getStateEnginePaths,
  loadCanonicalEvents,
  loadEntityState,
  loadStateSnapshot,
  stateSha256,
  verifyStateEngineIntegrity,
} from './state-engine-v2.mjs';

export const LEGACY_BACKUP_SCHEMA_VERSION = '1.0.0';
export const LEGACY_MIGRATION_SCHEMA_VERSION = '1.0.0';
export const LEGACY_BACKUP_FILE = 'legacy-backup.json';

export class StateMigrationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'StateMigrationError';
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

function stablePretty(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new StateMigrationError(`${label} is invalid JSON: ${error.message}`);
  }
}

function projectRelative(rootDir, absolutePath) {
  const root = path.resolve(rootDir);
  const absolute = path.resolve(absolutePath);
  const relative = path.relative(root, absolute).replaceAll('\\', '/');
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new StateMigrationError('Legacy state path escapes project root');
  }
  return relative;
}

function resolveProjectPath(rootDir, relativePath) {
  const root = path.resolve(rootDir);
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(root, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new StateMigrationError(`Backup path escapes project root: ${relativePath}`);
  }
  return absolute;
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  const fd = fs.openSync(temp, 'wx');
  try {
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, filePath);
}

function listFilesRecursive(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  walk(directory);
  return files;
}

function collectLegacyBackupFiles(rootDir) {
  const files = new Set();
  const autopilotState = path.join(rootDir, '.development-kit', 'autopilot', 'state');
  for (const file of listFilesRecursive(autopilotState)) {
    const name = path.basename(file);
    if (name === 'current.json' || /^revision-\d{6}\.json$/.test(name)) files.add(file);
  }

  const runsRoot = path.join(rootDir, '.development-kit', 'runs');
  for (const file of listFilesRecursive(runsRoot)) {
    const name = path.basename(file);
    const parent = path.basename(path.dirname(file));
    if (
      name === 'manifest.json'
      || name === 'current-state.json'
      || name === 'final-state.json'
      || (parent === 'state-revisions' && /^\d{8}\.json$/.test(name))
    ) files.add(file);
  }

  return [...files].sort((a, b) => projectRelative(rootDir, a).localeCompare(projectRelative(rootDir, b)));
}

function buildBackupBundle(rootDir, files) {
  const entries = files.map((file) => {
    const content = fs.readFileSync(file);
    return {
      path: projectRelative(rootDir, file),
      fingerprint: stateSha256(content),
      bytes: content.length,
      contentBase64: content.toString('base64'),
    };
  });
  const manifest = entries.map(({ path: entryPath, fingerprint, bytes }) => ({ path: entryPath, fingerprint, bytes }));
  const sourceFingerprint = sha256(JSON.stringify(stable(manifest)));
  return {
    schemaVersion: LEGACY_BACKUP_SCHEMA_VERSION,
    sourceFingerprint,
    fileCount: entries.length,
    files: entries,
  };
}

function validateBackupBundle(bundle) {
  if (!plainObject(bundle) || bundle.schemaVersion !== LEGACY_BACKUP_SCHEMA_VERSION) {
    throw new StateMigrationError('Legacy backup bundle schema is invalid');
  }
  if (typeof bundle.sourceFingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(bundle.sourceFingerprint)) {
    throw new StateMigrationError('Legacy backup sourceFingerprint is invalid');
  }
  if (!Array.isArray(bundle.files) || bundle.fileCount !== bundle.files.length) {
    throw new StateMigrationError('Legacy backup file list is invalid');
  }
  const manifest = [];
  for (const entry of bundle.files) {
    if (!plainObject(entry) || typeof entry.path !== 'string' || typeof entry.contentBase64 !== 'string') {
      throw new StateMigrationError('Legacy backup entry is invalid');
    }
    // Node substitutes U+FFFD for unpaired UTF-16 surrogates when mapping
    // JavaScript paths to filesystem names. Distinct malicious strings can
    // otherwise resolve to the same on-disk file and silently overwrite.
    if (Buffer.from(entry.path, 'utf8').toString('utf8') !== entry.path) {
      throw new StateMigrationError('Legacy backup path contains ill-formed Unicode');
    }
    const pathParts = entry.path.split(/[/\\]+/).filter(Boolean);
    if (pathParts.some((part) => part !== '.' && part !== '..' && (part.endsWith('.') || part.endsWith(' ')))) {
      throw new StateMigrationError('Legacy backup path contains trailing dot or space: ' + entry.path);
    }
    const content = Buffer.from(entry.contentBase64, 'base64');
    if (content.length !== entry.bytes || stateSha256(content) !== entry.fingerprint) {
      throw new StateMigrationError(`Legacy backup entry integrity failed: ${entry.path}`);
    }
    manifest.push({ path: entry.path, fingerprint: entry.fingerprint, bytes: entry.bytes });
  }
  const actual = sha256(JSON.stringify(stable(manifest)));
  if (actual !== bundle.sourceFingerprint) {
    throw new StateMigrationError('Legacy backup sourceFingerprint does not match entries');
  }
  return true;
}

function persistLegacyBackup(rootDir, bundle) {
  validateBackupBundle(bundle);
  const paths = ensureStateEngineLayout(rootDir);
  const backupPath = path.join(paths.stateRoot, LEGACY_BACKUP_FILE);
  if (fs.existsSync(backupPath)) {
    const existing = readJson(backupPath, 'Existing legacy backup');
    validateBackupBundle(existing);
    if (existing.sourceFingerprint !== bundle.sourceFingerprint) {
      throw new StateMigrationError('Refusing to overwrite legacy backup with different source state');
    }
    return { backupPath, created: false };
  }
  atomicWrite(backupPath, stablePretty(bundle));
  return { backupPath, created: true };
}

function autopilotHistory(rootDir) {
  const stateDir = path.join(rootDir, '.development-kit', 'autopilot', 'state');
  if (!fs.existsSync(stateDir)) return null;

  const revisionFiles = fs.readdirSync(stateDir)
    .filter((name) => /^revision-\d{6}\.json$/.test(name))
    .sort();

  if (revisionFiles.length === 0) return null;
  const currentPath = path.join(stateDir, 'current.json');
  if (!fs.existsSync(currentPath)) throw new StateMigrationError('Legacy Autopilot current.json is missing');

  const pointer = readJson(currentPath, 'Legacy Autopilot current pointer');
  if (!Number.isInteger(pointer.currentRevision) || pointer.currentRevision < 1) {
    throw new StateMigrationError('Legacy Autopilot currentRevision is invalid');
  }
  const expectedCurrent = `revision-${String(pointer.currentRevision).padStart(6, '0')}.json`;
  if (pointer.currentRevisionFile !== expectedCurrent) {
    throw new StateMigrationError('Legacy Autopilot current pointer path is inconsistent');
  }
  if (!revisionFiles.includes(expectedCurrent)) {
    throw new StateMigrationError('Legacy Autopilot current revision file is missing');
  }

  for (let revision = 1; revision <= pointer.currentRevision; revision += 1) {
    const expected = `revision-${String(revision).padStart(6, '0')}.json`;
    if (!revisionFiles.includes(expected)) {
      throw new StateMigrationError(`Legacy Autopilot revision chain is missing ${expected}`);
    }
  }

  const states = [];
  for (const name of revisionFiles) {
    const number = Number(name.match(/(\d{6})/)[1]);
    if (number > pointer.currentRevision) {
      throw new StateMigrationError('Legacy Autopilot contains revisions newer than current pointer');
    }
    const state = readJson(path.join(stateDir, name), `Legacy Autopilot ${name}`);
    try { validateWorkflowState(state); } catch (error) {
      throw new StateMigrationError(`Legacy Autopilot state is invalid: ${name}: ${error.message}`);
    }
    if (state.stateRevision !== number) {
      throw new StateMigrationError(`Legacy Autopilot revision filename/stateRevision mismatch: ${name}`);
    }
    if (state.workflowId !== pointer.workflowId) {
      throw new StateMigrationError(`Legacy Autopilot workflow identity changes within revision chain: ${name}`);
    }
    states.push(state);
  }

  const current = states.at(-1);
  if (current.stateRevision !== pointer.currentRevision || current.workflowId !== pointer.workflowId) {
    throw new StateMigrationError('Legacy Autopilot current state does not match pointer identity');
  }

  return {
    entityType: 'autopilot-workflow',
    entityId: current.workflowId,
    refs: {},
    states,
    current,
  };
}

function orchestrationHistories(rootDir) {
  const runsRoot = path.join(rootDir, '.development-kit', 'runs');
  if (!fs.existsSync(runsRoot)) return [];
  const histories = [];

  const contractDirs = fs.readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const contractEntry of contractDirs) {
    const contractDir = path.join(runsRoot, contractEntry.name);
    const runDirs = fs.readdirSync(contractDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const runEntry of runDirs) {
      const runDir = path.join(contractDir, runEntry.name);
      const manifestPath = path.join(runDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = readJson(manifestPath, 'Legacy orchestration manifest');
      try { validateOrchestrationRun(manifest); } catch (error) {
        throw new StateMigrationError(`Legacy orchestration manifest is invalid: ${error.message}`);
      }

      const revisionDir = path.join(runDir, 'state-revisions');
      let states = [];
      if (fs.existsSync(revisionDir)) {
        const names = fs.readdirSync(revisionDir)
          .filter((name) => /^\d{8}\.json$/.test(name))
          .sort();

        if (names.length > 0) {
          const pointerPath = path.join(runDir, 'current-state.json');
          if (!fs.existsSync(pointerPath)) throw new StateMigrationError('Legacy orchestration current-state.json is missing');
          const pointer = readJson(pointerPath, 'Legacy orchestration current pointer');
          if (
            pointer.contractId !== manifest.contractId
            || pointer.runId !== manifest.runId
            || !Number.isInteger(pointer.stateRevision)
            || pointer.stateRevision < 1
          ) {
            throw new StateMigrationError('Legacy orchestration current pointer identity is invalid');
          }
          const expectedName = `${String(pointer.stateRevision).padStart(8, '0')}.json`;
          if (pointer.revisionPath !== `state-revisions/${expectedName}` || !names.includes(expectedName)) {
            throw new StateMigrationError('Legacy orchestration current pointer path is inconsistent');
          }
          for (let revision = 1; revision <= pointer.stateRevision; revision += 1) {
            const expected = `${String(revision).padStart(8, '0')}.json`;
            if (!names.includes(expected)) {
              throw new StateMigrationError(`Legacy orchestration revision chain is missing ${expected}`);
            }
          }

          for (const name of names) {
            const number = Number(name.replace('.json', ''));
            if (number > pointer.stateRevision) {
              throw new StateMigrationError('Legacy orchestration contains revisions newer than current pointer');
            }
            const state = readJson(path.join(revisionDir, name), `Legacy orchestration revision ${name}`);
            try { validateOrchestrationRun(state); } catch (error) {
              throw new StateMigrationError(`Legacy orchestration revision is invalid: ${name}: ${error.message}`);
            }
            if (state.stateRevision !== number) {
              throw new StateMigrationError(`Legacy orchestration filename/stateRevision mismatch: ${name}`);
            }
            if (state.contractId !== manifest.contractId || state.runId !== manifest.runId) {
              throw new StateMigrationError('Legacy orchestration revision identity does not match manifest');
            }
            states.push(state);
          }
          if (canonicalStateJson(states[0]) !== canonicalStateJson(manifest)) {
            throw new StateMigrationError('Legacy orchestration revision 1 differs from immutable manifest');
          }
        }
      }

      if (states.length === 0) {
        // Fresh v0.13 runs retain immutable manifests but persist revisions in
        // the canonical V2 ledger. A manifest without legacy revision files
        // is not a legacy revision-1 history when that run already exists in V2.
        const canonicalRun = loadEntityState('orchestration-run',
          `${manifest.contractId}/${manifest.runId}`, rootDir);
        if (canonicalRun) continue;
        states = [manifest];
      }
      const current = states.at(-1);

      const finalPath = path.join(runDir, 'final-state.json');
      if (fs.existsSync(finalPath)) {
        const finalState = readJson(finalPath, 'Legacy orchestration final-state');
        try { validateOrchestrationRun(finalState); } catch (error) {
          throw new StateMigrationError(`Legacy orchestration final-state is invalid: ${error.message}`);
        }
        if (canonicalStateJson(finalState) !== canonicalStateJson(current)) {
          throw new StateMigrationError('Legacy orchestration final-state differs from current state');
        }
      }

      histories.push({
        entityType: 'orchestration-run',
        entityId: `${manifest.contractId}/${manifest.runId}`,
        refs: {
          contractId: manifest.contractId,
          taskId: manifest.taskId,
          runId: manifest.runId,
        },
        states,
        current,
      });
    }
  }

  return histories;
}

export function inspectLegacyState(rootDir = process.cwd()) {
  const backupFiles = collectLegacyBackupFiles(rootDir);
  const backup = buildBackupBundle(rootDir, backupFiles);
  const histories = [];
  const autopilot = autopilotHistory(rootDir);
  if (autopilot) histories.push(autopilot);
  histories.push(...orchestrationHistories(rootDir));

  return Object.freeze({
    sourceFingerprint: backup.sourceFingerprint,
    legacyFileCount: backup.fileCount,
    backup,
    histories,
    entityCount: histories.length,
  });
}

function migrationId(sourceFingerprint) {
  return `mig-v2-${sourceFingerprint.slice('sha256:'.length, 'sha256:'.length + 24)}`;
}

function completedMigration(sourceFingerprint, rootDir) {
  const events = loadCanonicalEvents(rootDir);
  return events.find((event) => (
    event.eventType === 'MIGRATION_COMPLETED'
    && event.payload?.sourceFingerprint === sourceFingerprint
    && event.payload?.semanticEquivalence === true
  )) ?? null;
}

function migrateHistory(history, rootDir) {
  for (const legacyState of history.states) {
    const current = loadEntityState(history.entityType, history.entityId, rootDir);
    if (current) {
      if (current.stateRevision > legacyState.stateRevision) continue;
      if (current.stateRevision === legacyState.stateRevision) {
        if (canonicalStateJson(current) !== canonicalStateJson(legacyState)) {
          throw new StateMigrationError(
            `Existing State Engine entity differs from legacy state at revision ${legacyState.stateRevision}: ${history.entityType}/${history.entityId}`,
          );
        }
        continue;
      }
    }

    appendEntityState({
      rootDir,
      entityType: history.entityType,
      entityId: history.entityId,
      state: legacyState,
      refs: history.refs,
      actorClass: 'legacy-migration',
      timestamp: legacyState.updatedAt ?? legacyState.createdAt ?? new Date().toISOString(),
    });
  }
}

function verifySemanticEquivalence(histories, rootDir) {
  const mismatches = [];
  for (const history of histories) {
    const current = loadEntityState(history.entityType, history.entityId, rootDir);
    if (canonicalStateJson(current) !== canonicalStateJson(history.current)) {
      mismatches.push({
        entityType: history.entityType,
        entityId: history.entityId,
        expectedRevision: history.current.stateRevision,
        actualRevision: current?.stateRevision ?? null,
      });
    }
  }
  return {
    equivalent: mismatches.length === 0,
    mismatches,
  };
}

export function migrateLegacyStateToV2({
  rootDir = process.cwd(),
  completedAt = new Date().toISOString(),
} = {}) {
  const inspection = inspectLegacyState(rootDir);
  ensureStateEngineLayout(rootDir);

  const existingCompletion = completedMigration(inspection.sourceFingerprint, rootDir);
  if (existingCompletion) {
    verifyStateEngineIntegrity(rootDir);
    const backupPath = path.join(getStateEnginePaths(rootDir).stateRoot, LEGACY_BACKUP_FILE);
    if (!fs.existsSync(backupPath)) {
      throw new StateMigrationError('Completed migration is missing its recoverable legacy backup');
    }
    const backup = readJson(backupPath, 'Existing legacy backup');
    validateBackupBundle(backup);
    if (backup.sourceFingerprint !== inspection.sourceFingerprint) {
      throw new StateMigrationError('Completed migration backup no longer matches the legacy source fingerprint');
    }

    return Object.freeze({
      migrated: false,
      idempotent: true,
      migrationId: existingCompletion.payload.migrationId,
      sourceFingerprint: inspection.sourceFingerprint,
      legacyFileCount: inspection.legacyFileCount,
      entityCount: inspection.entityCount,
      semanticEquivalence: true,
      backupPath,
    });
  }

  const backupResult = persistLegacyBackup(rootDir, inspection.backup);

  for (const history of inspection.histories) migrateHistory(history, rootDir);

  const equivalence = verifySemanticEquivalence(inspection.histories, rootDir);
  if (!equivalence.equivalent) {
    throw new StateMigrationError('Legacy migration semantic-equivalence check failed', equivalence.mismatches);
  }

  const id = migrationId(inspection.sourceFingerprint);
  appendMetadataEvent({
    rootDir,
    eventType: 'MIGRATION_COMPLETED',
    actorClass: 'legacy-migration',
    timestamp: completedAt,
    payload: {
      schemaVersion: LEGACY_MIGRATION_SCHEMA_VERSION,
      migrationId: id,
      sourceFingerprint: inspection.sourceFingerprint,
      entityCount: inspection.entityCount,
      legacyFileCount: inspection.legacyFileCount,
      semanticEquivalence: true,
      legacyRetained: true,
      backupFile: LEGACY_BACKUP_FILE,
    },
  });

  verifyStateEngineIntegrity(rootDir);
  const snapshot = loadStateSnapshot(rootDir, { rebuildIfNeeded: false });
  const migration = snapshot.migrations.find((item) => item.migrationId === id);
  if (!migration?.semanticEquivalence) {
    throw new StateMigrationError('Migration completion is missing from reconstructed snapshot');
  }

  return Object.freeze({
    migrated: true,
    idempotent: false,
    migrationId: id,
    sourceFingerprint: inspection.sourceFingerprint,
    legacyFileCount: inspection.legacyFileCount,
    entityCount: inspection.entityCount,
    semanticEquivalence: true,
    legacyRetained: true,
    backupPath: backupResult.backupPath,
  });
}

function resolveSafeRestoreDestination(targetRoot, relativePath, { createMissing = false } = {}) {
  const root = path.resolve(targetRoot);
  const destination = resolveProjectPath(root, relativePath);
  if (createMissing) fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(root)) return destination;
  if (fs.lstatSync(root).isSymbolicLink()) {
    throw new StateMigrationError('Legacy backup restore root must not be a symbolic link');
  }
  const rootReal = fs.realpathSync(root);
  const components = path.relative(root, destination).split(path.sep);
  if (components.some((part) => !part || part === '.' || part === '..' || part.endsWith('.') || part.endsWith(' '))) {
    throw new StateMigrationError('Invalid legacy backup restore path');
  }
  let current = root;
  for (const component of components.slice(0, -1)) {
    current = path.join(current, component);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new StateMigrationError('Legacy backup restore path contains a symbolic link or junction: ' + relativePath);
      }
      if (!stat.isDirectory()) throw new StateMigrationError('Legacy backup restore parent is not a directory: ' + relativePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (createMissing) fs.mkdirSync(current);
      else continue;
    }
    const real = fs.realpathSync(current);
    const rel = path.relative(rootReal, real);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
      throw new StateMigrationError('Legacy backup restore escapes its target root: ' + relativePath);
    }
  }
  try {
    const existing = fs.lstatSync(destination);
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new StateMigrationError('Legacy backup restore destination must be a regular file: ' + relativePath);
    }
    if (existing.nlink > 1) {
      throw new StateMigrationError('Legacy backup restore destination has multiple hard links: ' + relativePath);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return destination;
}


export const RESTORE_TRANSACTION_SCHEMA_VERSION = '2.0.0';
const RESTORE_TERMINAL_PHASE = 'CLEANUP_SAFE';
const RESTORE_PHASES = Object.freeze([
  'PREPARED',
  'ORIGINAL_DISPLACED',
  'CANDIDATE_PUBLISHED',
  'PROMOTION_ACKNOWLEDGED',
  RESTORE_TERMINAL_PHASE,
]);

function restoreJournalDigest(targetRoot) {
  return crypto.createHash('sha256').update(path.resolve(targetRoot)).digest('hex').slice(0, 24);
}

/**
 * Stable sibling transaction log. It lives outside the root being replaced and
 * is intentionally retained after successful restore. New transactions append
 * to the same hash-chained JSONL history.
 */
function restoreJournalPath(targetRoot) {
  const root = path.resolve(targetRoot);
  return path.join(path.dirname(root), '.dk-restore-transaction-' + restoreJournalDigest(root) + '.jsonl');
}

/** Pre-v0.13 single-record journal retained for explicit compatibility recovery. */
function legacyRestoreJournalPath(targetRoot) {
  const root = path.resolve(targetRoot);
  return path.join(path.dirname(root), '.dk-restore-journal-' + restoreJournalDigest(root) + '.json');
}

function restoreRecordHash(record) {
  const { recordHash, ...payload } = record;
  return stateSha256(Buffer.from(JSON.stringify(stable(payload))));
}

function validateRestoreRecord(record, previous = null) {
  if (!plainObject(record) || record.schemaVersion !== RESTORE_TRANSACTION_SCHEMA_VERSION) {
    throw new StateMigrationError('Restore transaction record schema is invalid');
  }
  if (!Number.isInteger(record.sequence) || record.sequence < 1) {
    throw new StateMigrationError('Restore transaction sequence is invalid');
  }
  if (!/^[a-f0-9]{32}$/.test(record.transactionId || '')) {
    throw new StateMigrationError('Restore transactionId is invalid');
  }
  if (!RESTORE_PHASES.includes(record.phase)) {
    throw new StateMigrationError('Restore transaction phase is invalid');
  }
  if (typeof record.timestamp !== 'string' || Number.isNaN(Date.parse(record.timestamp))) {
    throw new StateMigrationError('Restore transaction timestamp is invalid');
  }
  if (typeof record.targetRoot !== 'string' || path.resolve(record.targetRoot) !== record.targetRoot) {
    throw new StateMigrationError('Restore transaction targetRoot is invalid');
  }
  if (typeof record.stageName !== 'string' || !/^\.dk-legacy-restore-stage-(?:[a-f0-9]{24}-)?[a-f0-9]{32}$/.test(record.stageName)) {
    throw new StateMigrationError('Restore transaction stageName is invalid');
  }
  if (record.existed !== true && record.existed !== false) {
    throw new StateMigrationError('Restore transaction existed witness is invalid');
  }
  if (!/^\d+$/.test(record.stageDev || '') || !/^\d+$/.test(record.stageIno || '')) {
    throw new StateMigrationError('Restore transaction stage identity is invalid');
  }
  if (record.existed && (!/^\d+$/.test(record.originalDev || '') || !/^\d+$/.test(record.originalIno || ''))) {
    throw new StateMigrationError('Restore transaction original identity is invalid');
  }
  if (previous === null) {
    if (record.sequence !== 1 || record.previousRecordHash !== null) {
      throw new StateMigrationError('First restore record chain witness is invalid');
    }
  } else {
    if (record.sequence !== previous.sequence + 1) {
      throw new StateMigrationError('Restore transaction sequence is not contiguous');
    }
    if (record.previousRecordHash !== previous.recordHash) {
      throw new StateMigrationError('Restore transaction previous hash does not match');
    }
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(record.recordHash || '')
      || record.recordHash !== restoreRecordHash(record)) {
    throw new StateMigrationError('Restore transaction record hash mismatch');
  }
  return true;
}

function inspectSafeRestoreJournal(journal) {
  let stat;
  try { stat = fs.lstatSync(journal, { bigint: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n) {
    throw new StateMigrationError('Unsafe restore transaction journal link or object type; refusing filesystem mutation');
  }
  return stat;
}

function loadRestoreJournal(targetRoot) {
  const journal = restoreJournalPath(targetRoot);
  if (!inspectSafeRestoreJournal(journal)) return [];
  const content = fs.readFileSync(journal, 'utf8');
  if (!content) return [];
  if (!content.endsWith('\n')) {
    throw new StateMigrationError('Restore transaction log has an incomplete trailing record; preserve it for operator recovery');
  }
  const lines = content.split('\n').filter(Boolean);
  const records = [];
  let previous = null;
  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new StateMigrationError('Restore transaction log contains invalid JSON: ' + error.message);
    }
    validateRestoreRecord(record, previous);
    records.push(record);
    previous = record;
  }
  return records;
}

function latestRestoreTransaction(records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const transactionId = records.at(-1).transactionId;
  const txRecords = records.filter((record) => record.transactionId === transactionId);
  const prepared = txRecords.find((record) => record.phase === 'PREPARED');
  if (!prepared) throw new StateMigrationError('Latest restore transaction is missing PREPARED witness');
  return {
    prepared,
    last: txRecords.at(-1),
    records: txRecords,
  };
}

function appendRestoreTransactionRecord({
  targetRoot,
  transaction,
  phase,
  outcome = null,
  now = new Date().toISOString(),
}) {
  if (!RESTORE_PHASES.includes(phase)) throw new StateMigrationError('Unknown restore transaction phase: ' + phase);
  const journal = restoreJournalPath(targetRoot);
  const records = loadRestoreJournal(targetRoot);
  const previous = records.at(-1) ?? null;
  const base = {
    schemaVersion: RESTORE_TRANSACTION_SCHEMA_VERSION,
    sequence: (previous?.sequence ?? 0) + 1,
    transactionId: transaction.transactionId,
    phase,
    timestamp: now,
    targetRoot: transaction.targetRoot,
    stageName: transaction.stageName,
    existed: transaction.existed,
    originalDev: transaction.originalDev,
    originalIno: transaction.originalIno,
    stageDev: transaction.stageDev,
    stageIno: transaction.stageIno,
    outcome,
    previousRecordHash: previous?.recordHash ?? null,
  };
  const record = { ...base, recordHash: restoreRecordHash(base) };

  fs.mkdirSync(path.dirname(journal), { recursive: true });
  const prior = inspectSafeRestoreJournal(journal);
  const existed = prior !== null;
  const noFollow = process.platform !== 'win32' ? (fs.constants.O_NOFOLLOW || 0) : 0;
  const flags = fs.constants.O_WRONLY | fs.constants.O_APPEND | noFollow |
    (existed ? 0 : fs.constants.O_CREAT | fs.constants.O_EXCL);
  const fd = fs.openSync(journal, flags, 0o600);
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.nlink !== 1n ||
        (prior && (opened.dev !== prior.dev || opened.ino !== prior.ino))) {
      throw new StateMigrationError('Restore transaction journal changed identity before append');
    }
    fs.writeFileSync(fd, JSON.stringify(record) + '\n', 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  // On first publication this is a namespace durability barrier. On Windows
  // it is not the sole witness: orphan stage/displaced directories are also
  // detected before any future destructive transaction.
  if (!existed) syncRestoreParent(path.dirname(journal));
  return Object.freeze(record);
}

function orphanRestoreWitnesses(targetRoot) {
  const root = path.resolve(targetRoot);
  const parent = path.dirname(root);
  if (!fs.existsSync(parent)) return [];
  const scopedPrefix = '.dk-legacy-restore-stage-' + restoreJournalDigest(root) + '-';
  return fs.readdirSync(parent)
    .filter((name) =>
      // New v0.13 stages are bound to this exact target; retained originals
      // belonging to another sibling project must not block its restore.
      (name.startsWith(scopedPrefix) &&
        /^[a-f0-9]{32}(?:-original)?$/.test(name.slice(scopedPrefix.length))) ||
      // Pre-scoped witnesses cannot be safely attributed without a journal.
      // Keep the historical conservative fail-closed behavior for those.
      /^\.dk-legacy-restore-stage-[a-f0-9]{32}(?:-original)?$/.test(name))
    .map((name) => path.join(parent, name))
    .sort();
}

/**
 * Windows path lookup is ordinarily case-insensitive, but the historical
 * transaction-log digest is based on the caller's exact path spelling.
 * When a published root is missing after a crash, realpath cannot recover
 * its original casing. Inspect bounded first-record witnesses in sibling
 * journals before treating a differently cased target as a fresh project.
 *
 * This is a fail-closed alias guard, not proof of physical power-loss
 * durability or a defence against a hostile same-account filesystem writer.
 */
/**
 * NTFS 8.3 ancestor spellings can refer to the same physical parent while
 * path.resolve() and the historical journal digest remain different. Compare
 * the existing parent directory's volume and file identity plus the leaf name.
 * This is a fail-closed witness-discovery check, not a claim against hostile
 * concurrent same-account directory replacement.
 */
function sameWindowsRestoreRootParentIdentity(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = path.resolve(left);
  const b = path.resolve(right);
  if (path.basename(a).normalize('NFC').toLowerCase() !==
      path.basename(b).normalize('NFC').toLowerCase()) return false;
  try {
    const pa = fs.statSync(path.dirname(a), { bigint: true });
    const pb = fs.statSync(path.dirname(b), { bigint: true });
    return pa.isDirectory() && pb.isDirectory() &&
      pa.dev === pb.dev && pa.ino === pb.ino;
  } catch {
    return false;
  }
}

function assertNoWindowsCaseAliasedRestoreJournal(targetRoot) {
  if (process.platform !== 'win32') return;
  const root = path.resolve(targetRoot);
  const parent = path.dirname(root);
  if (!fs.existsSync(parent)) return;
  const expectedJournal = path.basename(restoreJournalPath(root)).toLowerCase();
  const targetKey = root.normalize('NFC').toLowerCase();
  for (const name of fs.readdirSync(parent)) {
    if (!/^\.dk-restore-transaction-[a-f0-9]{24}\.jsonl$/i.test(name) ||
        name.toLowerCase() === expectedJournal) continue;
    const candidate = path.join(parent, name);
    const stat = fs.lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    const fd = fs.openSync(candidate, 'r');
    let firstLine;
    try {
      const bytes = Buffer.alloc(8192);
      const length = fs.readSync(fd, bytes, 0, bytes.length, 0);
      firstLine = bytes.subarray(0, length).toString('utf8').split('\n', 1)[0];
    } finally {
      fs.closeSync(fd);
    }
    let witness;
    try { witness = JSON.parse(firstLine); }
    catch { continue; }
    if (typeof witness?.targetRoot !== 'string' ||
        (path.resolve(witness.targetRoot).normalize('NFC').toLowerCase() !== targetKey &&
          !sameWindowsRestoreRootParentIdentity(witness.targetRoot, root))) continue;
    validateRestoreRecord(witness);
    throw new StateMigrationError(
      'Terminal restore root witness exists under a Windows case alias; refusing destructive mutation',
      { code: 'RESTORE_CASE_ALIAS_WITNESS', journal: candidate },
    );
  }
}

/**
 * A Windows journal may disappear from the durable namespace even when its
 * scoped stage/displaced-original directory survived. The stage digest then
 * cannot be attributed safely to a differently cased missing target root.
 * Reject a new restore anywhere in that parent until the orphan is recovered
 * by an operator; do not silently treat a sibling name as proof of safety.
 */
function assertNoWindowsOrphanRestoreStages(targetRoot) {
  if (process.platform !== 'win32') return;
  const parent = path.dirname(path.resolve(targetRoot));
  if (!fs.existsSync(parent)) return;
  for (const name of fs.readdirSync(parent)) {
    const match = /^\.dk-legacy-restore-stage-([a-f0-9]{24})-[a-f0-9]{32}(?:-original)?$/i.exec(name);
    if (!match) continue;
    const journal = path.join(parent, '.dk-restore-transaction-' + match[1] + '.jsonl');
    if (!inspectSafeRestoreJournal(journal)) {
      throw new StateMigrationError(
        'Orphan restore witnesses exist without a recovery journal; refusing destructive mutation',
        { code: 'RESTORE_WITNESS_WITHOUT_JOURNAL', witness: path.join(parent, name) },
      );
    }
  }
}

function assertNoUnjournaledRestoreWitness(targetRoot) {
  assertNoWindowsCaseAliasedRestoreJournal(targetRoot);
  assertNoWindowsOrphanRestoreStages(targetRoot);
  if (fs.existsSync(restoreJournalPath(targetRoot)) || fs.existsSync(legacyRestoreJournalPath(targetRoot))) return;
  const witnesses = orphanRestoreWitnesses(targetRoot);
  if (witnesses.length > 0) {
    throw new StateMigrationError(
      'Restore witnesses exist without a recovery journal; refusing destructive mutation',
      {
        code: 'RESTORE_WITNESS_WITHOUT_JOURNAL',
        witnesses,
      },
    );
  }
}

/**
 * Directory-entry ordering barrier for the restore transaction.
 *
 * POSIX: fsync(2) on the parent directory descriptor.
 * Windows: libuv opens directories with FILE_FLAG_BACKUP_SEMANTICS, and
 * fs.fsyncSync calls FlushFileBuffers. FlushFileBuffers needs a write-capable
 * handle ('r+'); a read-only handle fails EPERM. Microsoft documents a normal
 * (flags = 0) flush as writing cached file data *and metadata* and
 * synchronizing the storage cache (NtFlushBuffersFileEx; only
 * FLUSH_FLAGS_FILE_DATA_SYNC_ONLY is documented invalid for directory
 * handles). See docs/04-architecture/dkf-t04-windows-restore-durability-protocol.md
 * for the exact guarantee relied on and its limits.
 *
 * Any failure is fatal: callers never mutate or acknowledge past a barrier
 * that did not complete, so the journal and witnesses are retained.
 */
const WINDOWS_DURABILITY_HELPER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/windows-durable-rename.ps1',
);

/**
 * A successful PowerShell process exit is not sufficient to certify a durable
 * rename/flush. Reject incomplete, mismatched or negative helper responses
 * before any restore phase can be acknowledged. This validates API evidence,
 * not physical power-loss persistence on a particular NTFS device.
 */
export function validateWindowsDurabilityHelperResult(operation, result, expected = {}) {
  const invalid = (reason) => {
    throw new StateMigrationError('Windows durability helper returned unverified ' + reason, {
      code: 'WINDOWS_DURABILITY_HELPER_INVALID_RESULT',
      operation,
      diagnostic: operation === 'CreateSecureStage' ? {
        observedOperation: result?.operation,
        observedPath: result?.path,
        expectedPath: expected?.Path,
        observedProtected: result?.protected,
      } : undefined,
    });
  };
  if (!result || typeof result !== 'object' || Array.isArray(result)) invalid('result');
  // ACL helper calls are path-scoped and have no storage-profile field. The
  // parent restore path was separately probed; accept only an affirmative
  // response for the exact operation and expected source/destination paths.
  const samePath = (actual, requested) => {
    if (typeof actual !== 'string' || typeof requested !== 'string') return false;
    if (path.win32.normalize(actual).toLowerCase() ===
        path.win32.normalize(requested).toLowerCase()) return true;
    // Windows may expand an 8.3 path component (RUNNER~1 -> runneradmin)
    // while producing the helper response. Require both spellings to resolve
    // to the same ordinary directory or file identity; never accept mere
    // textual similarity, a reparse point, or a nonexistent destination.
    try {
      const a = fs.lstatSync(actual, { bigint: true });
      const b = fs.lstatSync(requested, { bigint: true });
      // Rename also applies to the retained V1 journal file, not only to
      // directories. Both aliases must identify the same ordinary object
      // of the same kind; never follow a symlink or accept a missing path.
      const sameKind = (a.isDirectory() && b.isDirectory()) ||
        (a.isFile() && b.isFile());
      return sameKind && !a.isSymbolicLink() && !b.isSymbolicLink() &&
        a.ino !== 0n && a.dev === b.dev && a.ino === b.ino;
    } catch {
      return false;
    }
  };
  // After a successful rename the source no longer exists, so its inode
  // cannot be compared directly. An expanded Windows 8.3 ancestor alias is
  // safe to recognize by the identical leaf name and the live identity of
  // the source parent directory. Never accept a different leaf or parent.
  const sameRenamedSource = (actual, requested) => {
    if (samePath(actual, requested)) return true;
    if (typeof actual !== 'string' || typeof requested !== 'string') return false;
    return path.win32.basename(actual).toLowerCase() ===
        path.win32.basename(requested).toLowerCase() &&
      samePath(path.win32.dirname(actual), path.win32.dirname(requested));
  };
  if (operation === 'CreateSecureStage') {
    if (result.operation !== operation || result.protected !== true ||
        !samePath(result.path, expected.Path)) invalid('private stage or path');
    return result;
  }
  if (operation === 'CopyAclTree') {
    if (result.operation !== operation || result.verified !== true ||
        !samePath(result.source, expected.From) ||
        !samePath(result.destination, expected.To)) invalid('ACL tree verification or path');
    return result;
  }
  const profile = operation === 'Probe' ? result : result.profile;
  if (!profile || profile.supportedAutomaticRestore !== true
      || profile.localFixed !== true
      || String(profile.fileSystem || '').toUpperCase() !== 'NTFS') {
    invalid('storage profile');
  }
  // The helper's success flags alone are insufficient: the response must
  // attest to the exact paths requested for this transaction. On Windows,
  // samePath also accepts a verified ordinary-directory 8.3 alias.
  if (operation === 'Probe') {
    if (expected.Path !== undefined && !samePath(profile.path, expected.Path)) {
      invalid('storage profile path');
    }
    return result;
  }
  if (result.operation !== operation) invalid('operation');
  if (operation === 'FlushDirectory') {
    if (expected.Path !== undefined && !samePath(profile.path, expected.Path)) {
      invalid('directory flush path');
    }
    if (result.flushed !== true) invalid('directory flush');
  } else if (operation === 'Rename') {
    if (expected.From !== undefined && !sameRenamedSource(result.source, expected.From)) {
      invalid('rename source path');
    }
    if (expected.To !== undefined && !samePath(result.destination, expected.To)) {
      invalid('rename destination path');
    }
    if (expected.To !== undefined &&
        !samePath(profile.path, path.win32.dirname(expected.To))) {
      invalid('rename parent-directory flush path');
    }
    if (result.renamed !== true || result.parentFlushCompleted !== true) {
      invalid('rename or parent-directory flush');
    }
  } else {
    invalid('operation');
  }
  return result;
}

function runWindowsDurabilityHelper(operation, args = {}) {
  if (process.platform !== 'win32') {
    throw new StateMigrationError('Windows durability helper may only run on Windows');
  }
  if (!fs.existsSync(WINDOWS_DURABILITY_HELPER)) {
    throw new StateMigrationError('Windows durability helper is missing', {
      code: 'WINDOWS_DURABILITY_HELPER_MISSING',
      helper: WINDOWS_DURABILITY_HELPER,
    });
  }

  const argv = [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', WINDOWS_DURABILITY_HELPER,
    '-Operation', operation,
  ];
  for (const [key, value] of Object.entries(args)) {
    if (value === null || value === undefined) continue;
    argv.push('-' + key, String(value));
  }

  const result = spawnSync('powershell.exe', argv, {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout: 30_000,
  });
  if (result.error || result.status !== 0) {
    throw new StateMigrationError('Windows durability helper failed; recovery evidence retained', {
      code: 'WINDOWS_DURABILITY_HELPER_FAILED',
      operation,
      status: result.status,
      cause: result.error?.message ?? String(result.stderr || result.stdout || 'unknown failure').trim(),
    });
  }

  const output = String(result.stdout || '').trim();
  if (!output) {
    throw new StateMigrationError('Windows durability helper returned no result');
  }
  let parsed;
  try {
    parsed = JSON.parse(output.split(/\r?\n/).filter(Boolean).at(-1));
  } catch (error) {
    throw new StateMigrationError('Windows durability helper returned invalid JSON', {
      operation,
      cause: error.message,
    });
  }
  return validateWindowsDurabilityHelperResult(operation, parsed, args);
}

function requireSupportedWindowsRestoreProfile(targetPath) {
  if (process.platform !== 'win32') return null;
  const profile = runWindowsDurabilityHelper('Probe', { Path: targetPath });
  if (profile?.supportedAutomaticRestore !== true
      || String(profile.fileSystem || '').toUpperCase() !== 'NTFS'
      || profile.localFixed !== true) {
    throw new StateMigrationError(
      'Windows automatic restore requires a local fixed NTFS durability profile',
      {
        code: 'UNSUPPORTED_WINDOWS_DURABILITY_TARGET',
        profile,
      },
    );
  }
  return profile;
}

function syncRestoreParent(parent) {
  if (process.platform === 'win32') {
    requireSupportedWindowsRestoreProfile(parent);
    runWindowsDurabilityHelper('FlushDirectory', { Path: parent });
    return;
  }

  let fd;
  try {
    fd = fs.openSync(parent, 'r');
    fs.fsyncSync(fd);
  } catch (error) {
    throw new StateMigrationError('Restore directory flush barrier failed; recovery evidence retained', {
      code: 'RESTORE_DIRECTORY_FLUSH_FAILED', directory: parent, cause: error.code || error.message,
    });
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function durableRestoreRename(from, to) {
  const parent = path.dirname(to);
  if (process.platform === 'win32') {
    requireSupportedWindowsRestoreProfile(parent);
    runWindowsDurabilityHelper('Rename', { From: from, To: to });
    return;
  }
  fs.renameSync(from, to);
  syncRestoreParent(parent);
}

function durableRestoreRollbackRename(from, to) {
  durableRestoreRename(from, to);
}

/**
 * Sync the staged file bytes and (on POSIX) every containing directory before
 * the promotion journal becomes durable. A rename alone does not durably
 * commit nested directory entries after sudden power loss.
 */
function syncRestoreTree(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue; // retain links as links, never follow
    if (entry.isDirectory()) {
      syncRestoreTree(item);
    } else if (entry.isFile()) {
      // FlushFileBuffers on Windows requires a write-capable handle; a
      // read-only descriptor can fail EPERM even when the file is writable.
      const fd = fs.openSync(item, process.platform === 'win32' ? 'r+' : 'r');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    } else {
      throw new StateMigrationError('Legacy restore stage contains an unsupported special file');
    }
  }
  syncRestoreParent(directory);
}

function inspectRestorePath(file) {
  try {
    return fs.lstatSync(file, { bigint: true });
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function sameRestoreIdentity(stat, dev, ino) {
  return Boolean(stat)
    && stat.isDirectory()
    && !stat.isSymbolicLink()
    && stat.dev.toString() === dev
    && stat.ino.toString() === ino;
}

function appendMissingSuccessfulRestorePhases(targetRoot, transaction, existingRecords, { outcome = 'promoted' } = {}) {
  const phases = new Set(existingRecords.map((record) => record.phase));
  if (transaction.existed && !phases.has('ORIGINAL_DISPLACED')) {
    appendRestoreTransactionRecord({ targetRoot, transaction, phase: 'ORIGINAL_DISPLACED' });
    phases.add('ORIGINAL_DISPLACED');
  }
  if (!phases.has('CANDIDATE_PUBLISHED')) {
    appendRestoreTransactionRecord({ targetRoot, transaction, phase: 'CANDIDATE_PUBLISHED' });
    phases.add('CANDIDATE_PUBLISHED');
  }
  if (!phases.has('PROMOTION_ACKNOWLEDGED')) {
    appendRestoreTransactionRecord({ targetRoot, transaction, phase: 'PROMOTION_ACKNOWLEDGED' });
    phases.add('PROMOTION_ACKNOWLEDGED');
  }
  if (!phases.has(RESTORE_TERMINAL_PHASE)) {
    appendRestoreTransactionRecord({
      targetRoot,
      transaction,
      phase: RESTORE_TERMINAL_PHASE,
      outcome,
    });
  }
}

function retainRecoveredLegacyRestoreJournal(journalPath, transactionId) {
  const retained = journalPath + '.retained-' + transactionId + '.json';
  if (fs.existsSync(retained)) {
    throw new StateMigrationError('Retained legacy restore journal already exists; refusing ambiguous cleanup', {
      code: 'LEGACY_RESTORE_RETAINED_JOURNAL_CONFLICT',
      retained,
    });
  }
  durableRestoreRename(journalPath, retained);
  return retained;
}

function recoverLegacyRestoreV1({ root, parent, journalPath }) {
  const tx = readJson(journalPath, 'Legacy restore journal');
  const expectedStage = '.dk-legacy-restore-stage-' + tx.transactionId;
  const stage = path.join(parent, expectedStage);
  const displaced = stage + '-original';
  if (!/^[a-f0-9]{32}$/.test(tx.transactionId || '')
    || tx.targetRoot !== root
    || tx.schemaVersion !== '1.0.0'
    || tx.stageName !== expectedStage
    || (tx.existed !== true && tx.existed !== false)
    || !/^\d+$/.test(tx.stageDev || '')
    || !/^\d+$/.test(tx.stageIno || '')
    || (tx.existed && (!/^\d+$/.test(tx.originalDev || '') || !/^\d+$/.test(tx.originalIno || '')))) {
    throw new StateMigrationError('Legacy restore journal contains an invalid transaction witness');
  }

  if (process.platform === 'win32') requireSupportedWindowsRestoreProfile(parent);

  const atRoot = inspectRestorePath(root);
  const inStage = inspectRestorePath(stage);
  const inDisplaced = inspectRestorePath(displaced);
  if (inStage && !sameRestoreIdentity(inStage, tx.stageDev, tx.stageIno)) {
    throw new StateMigrationError('Unrecognized staged restore directory; refusing v1 recovery');
  }
  if (inDisplaced && (!tx.existed || !sameRestoreIdentity(inDisplaced, tx.originalDev, tx.originalIno))) {
    throw new StateMigrationError('Displaced restore directory differs from v1 original witness');
  }

  let outcome;
  if (inDisplaced && !atRoot) {
    durableRestoreRollbackRename(displaced, root);
    outcome = 'rolled-back-original';
  } else if (inDisplaced && sameRestoreIdentity(atRoot, tx.stageDev, tx.stageIno)) {
    outcome = 'promoted-original-retained';
  } else if (!inDisplaced && (
    (!atRoot && !tx.existed)
    || (tx.existed && sameRestoreIdentity(atRoot, tx.originalDev, tx.originalIno))
  )) {
    outcome = 'uncommitted-original-unchanged';
  } else if (!tx.existed && sameRestoreIdentity(atRoot, tx.stageDev, tx.stageIno)) {
    outcome = 'promoted-new-root';
  } else {
    throw new StateMigrationError('Ambiguous v1 restore journal state; refusing automatic mutation');
  }

  if (inStage && fs.existsSync(stage)) {
    fs.rmSync(stage, { recursive: true, force: true });
    syncRestoreParent(parent);
  }

  const transaction = {
    transactionId: tx.transactionId,
    targetRoot: root,
    stageName: expectedStage,
    existed: tx.existed,
    originalDev: tx.originalDev ?? null,
    originalIno: tx.originalIno ?? null,
    stageDev: tx.stageDev,
    stageIno: tx.stageIno,
  };
  appendRestoreTransactionRecord({
    targetRoot: root,
    transaction,
    phase: 'PREPARED',
    outcome: 'imported-v1-recovery',
  });
  appendRestoreTransactionRecord({
    targetRoot: root,
    transaction,
    phase: RESTORE_TERMINAL_PHASE,
    outcome: 'legacy-v1-' + outcome,
  });

  const retainedJournal = retainRecoveredLegacyRestoreJournal(journalPath, tx.transactionId);
  return Object.freeze({
    recovered: true,
    legacyJournal: true,
    outcome,
    retainedJournal,
    displacedOriginal: outcome === 'promoted-original-retained' ? displaced : null,
  });
}

function requireTerminalRestoreRootWitness(root, transaction, rawOutcome) {
  // Historical V1 journals are imported with a legacy-v1- outcome prefix.
  // Normalize only that authenticated import marker; all other outcomes must
  // match the closed terminal outcome set and the exact on-disk root inode.
  const outcome = typeof rawOutcome === 'string' && rawOutcome.startsWith('legacy-v1-')
    ? rawOutcome.slice('legacy-v1-'.length) : rawOutcome;
  const rootWitness = inspectRestorePath(root);
  const promoted = outcome === 'promoted-new-root' || outcome === 'promoted-original-retained';
  const original = outcome === 'rolled-back-original' || outcome === 'uncommitted-original-unchanged';
  const witnessValid = promoted
    ? sameRestoreIdentity(rootWitness, transaction.stageDev, transaction.stageIno)
    : original
      ? transaction.existed
        ? sameRestoreIdentity(rootWitness, transaction.originalDev, transaction.originalIno)
        : !rootWitness
      : false;
  if (!witnessValid) {
    throw new StateMigrationError('Terminal restore root identity witness mismatch; refusing to supersede recovery evidence');
  }
  return true;
}

/**
 * Recover only an interrupted OFFLINE restore for the exact target root.
 * Recovery is witness-driven and never treats absence of a journal entry as
 * proof that no transaction existed.
 */
export function recoverLegacyRestore({ targetRoot, confirmOffline = false } = {}) {
  if (typeof targetRoot !== 'string' || !targetRoot) {
    throw new StateMigrationError('targetRoot is required for restore recovery');
  }
  if (confirmOffline !== true) {
    throw new StateMigrationError('Explicit offline confirmation is required for restore recovery');
  }

  const root = path.resolve(targetRoot);
  const parent = path.dirname(root);
  assertNoWindowsCaseAliasedRestoreJournal(root);
  assertNoWindowsOrphanRestoreStages(root);
  const legacyJournal = legacyRestoreJournalPath(root);
  if (fs.existsSync(legacyJournal)) {
    return recoverLegacyRestoreV1({ root, parent, journalPath: legacyJournal });
  }

  const records = loadRestoreJournal(root);
  if (records.length === 0) {
    assertNoUnjournaledRestoreWitness(root);
    return Object.freeze({ recovered: false });
  }

  const latest = latestRestoreTransaction(records);
  const tx = latest.prepared;
  const legacyStage = '.dk-legacy-restore-stage-' + tx.transactionId;
  const scopedStage = '.dk-legacy-restore-stage-' + restoreJournalDigest(root) + '-' + tx.transactionId;
  if (tx.targetRoot !== root || ![legacyStage, scopedStage].includes(tx.stageName)) {
    throw new StateMigrationError('Restore transaction witness does not match requested target root');
  }

  const stage = path.join(parent, tx.stageName);
  const displaced = stage + '-original';

  if (latest.last.phase === RESTORE_TERMINAL_PHASE) {
    // Never treat an authenticated terminal record as physical root evidence.
    requireTerminalRestoreRootWitness(root, tx, latest.last.outcome);
    return Object.freeze({
      recovered: false,
      alreadyComplete: true,
      transactionId: tx.transactionId,
      outcome: latest.last.outcome,
      transactionLog: restoreJournalPath(root),
    });
  }

  if (process.platform === 'win32') requireSupportedWindowsRestoreProfile(parent);

  const atRoot = inspectRestorePath(root);
  const inStage = inspectRestorePath(stage);
  const inDisplaced = inspectRestorePath(displaced);

  if (inStage && !sameRestoreIdentity(inStage, tx.stageDev, tx.stageIno)) {
    throw new StateMigrationError('Unrecognized staged restore directory; refusing recovery');
  }
  if (inDisplaced && (!tx.existed || !sameRestoreIdentity(inDisplaced, tx.originalDev, tx.originalIno))) {
    throw new StateMigrationError('Displaced restore directory differs from original witness');
  }

  // Crash after original displacement but before candidate publication: restore
  // the authenticated original and terminate the transaction as rolled back.
  if (inDisplaced && !atRoot) {
    durableRestoreRollbackRename(displaced, root);
    if (inStage && fs.existsSync(stage)) {
      fs.rmSync(stage, { recursive: true, force: true });
      syncRestoreParent(parent);
    }
    appendRestoreTransactionRecord({
      targetRoot: root,
      transaction: tx,
      phase: RESTORE_TERMINAL_PHASE,
      outcome: 'rolled-back-original',
    });
    return Object.freeze({
      recovered: true,
      outcome: 'rolled-back-original',
      transactionId: tx.transactionId,
      transactionLog: restoreJournalPath(root),
    });
  }

  // Candidate is already visible. Finish only the missing durable state
  // records, then make old-root cleanup a post-terminal maintenance action.
  if (sameRestoreIdentity(atRoot, tx.stageDev, tx.stageIno)
      && ((!tx.existed && !inDisplaced)
        || (tx.existed && inDisplaced))) {
    // The candidate may be visible after a successful rename whose parent
    // directory flush failed or never ran before process death. Retry the
    // publication namespace barrier *before* appending acknowledgement or
    // terminal records. On failure, preserve the nonterminal journal and both
    // candidate/original witnesses for another controlled recovery attempt.
    syncRestoreParent(parent);
    appendMissingSuccessfulRestorePhases(root, tx, latest.records, {
      outcome: tx.existed ? 'promoted-original-retained' : 'promoted-new-root',
    });

    // The old root is the only exact-inode rollback witness after promotion.
    // A terminal journal record cannot certify physical persistence of the
    // preceding Windows namespace operations. Retain it for separate offline
    // reviewed cleanup; never delete it as part of automatic recovery.
    let cleanupPending = tx.existed && fs.existsSync(displaced);
    if (inStage && fs.existsSync(stage)) {
      try {
        fs.rmSync(stage, { recursive: true, force: true });
        syncRestoreParent(parent);
      } catch {
        cleanupPending = true;
      }
    }

    return Object.freeze({
      recovered: true,
      outcome: tx.existed ? 'promoted-original-retained' : 'promoted-new-root',
      transactionId: tx.transactionId,
      transactionLog: restoreJournalPath(root),
      cleanupPending,
      displacedOriginal: cleanupPending && tx.existed ? displaced : null,
    });
  }

  // No destructive rename persisted. Preserve the authenticated original, drop
  // only the authenticated staging copy, and terminally record rollback.
  if (!inDisplaced && (
    (tx.existed && sameRestoreIdentity(atRoot, tx.originalDev, tx.originalIno))
    || (!tx.existed && !atRoot)
  )) {
    if (inStage && fs.existsSync(stage)) {
      fs.rmSync(stage, { recursive: true, force: true });
      syncRestoreParent(parent);
    }
    appendRestoreTransactionRecord({
      targetRoot: root,
      transaction: tx,
      phase: RESTORE_TERMINAL_PHASE,
      outcome: 'uncommitted-original-unchanged',
    });
    return Object.freeze({
      recovered: true,
      outcome: 'uncommitted-original-unchanged',
      transactionId: tx.transactionId,
      transactionLog: restoreJournalPath(root),
    });
  }

  throw new StateMigrationError('Ambiguous restore transaction state; refusing automatic mutation', {
    code: 'AMBIGUOUS_RESTORE_TRANSACTION',
    transactionId: tx.transactionId,
  });
}

/**
 * Snapshot descendant metadata before copying: cpSync recreates ownership
 * under the maintenance identity and may update source directory atimes.
 * Post-order records let directories receive their final times only after
 * all nested file handles have been visited.
 */
function collectRestoreMetadata(source, relative = '') {
  const stat = fs.lstatSync(source);
  const children = stat.isDirectory()
    ? fs.readdirSync(source).flatMap(name => collectRestoreMetadata(
      path.join(source, name), relative ? path.join(relative, name) : name,
    ))
    : [];
  return [...children, {
    relative, mode: stat.mode & 0o7777,
    uid: stat.uid, gid: stat.gid,
    atime: stat.atime, mtime: stat.mtime,
    kind: stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : stat.isSymbolicLink() ? 'symlink' : 'unsupported',
  }];
}

function applyRestoreMetadata(stage, records) {
  for (const entry of records) {
    const destination = entry.relative ? path.join(stage, entry.relative) : stage;
    const current = fs.lstatSync(destination);
    const sameKind = entry.kind === 'directory' ? current.isDirectory()
      : entry.kind === 'file' ? current.isFile()
      : entry.kind === 'symlink' ? current.isSymbolicLink() : false;
    if (!sameKind) throw new StateMigrationError('Staged restore object type differs from original metadata');
    if (process.platform !== 'win32' &&
      (current.uid !== entry.uid || current.gid !== entry.gid)) {
      if (entry.kind === 'symlink') fs.lchownSync(destination, entry.uid, entry.gid);
      else fs.chownSync(destination, entry.uid, entry.gid);
    }
    if (entry.kind === 'symlink') continue; // never follow
    fs.chmodSync(destination, entry.mode);
    fs.utimesSync(destination, entry.atime, entry.mtime);
    // Persist restored metadata, and avoid readdir once parent atime is set.
    if (entry.kind === 'directory') {
      syncRestoreParent(destination);
    } else if (process.platform !== 'win32') {
      const fd = fs.openSync(destination, 'r');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
  }
}

export function restoreLegacyBackup({
  backupPath,
  targetRoot,
  overwrite = false,
  confirmOffline = false,
} = {}) {
  if (typeof backupPath !== 'string' || !backupPath) throw new StateMigrationError('backupPath is required');
  if (typeof targetRoot !== 'string' || !targetRoot) throw new StateMigrationError('targetRoot is required');
  if (confirmOffline !== true) {
    throw new StateMigrationError('Legacy backup restoration requires explicit offline confirmation and an exclusively controlled local workspace');
  }

  const resolvedRoot = path.resolve(targetRoot);
  const parent = path.dirname(resolvedRoot);
  assertNoUnjournaledRestoreWitness(resolvedRoot);

  const legacyJournal = legacyRestoreJournalPath(resolvedRoot);
  if (fs.existsSync(legacyJournal)) {
    throw new StateMigrationError('Incomplete pre-v0.13 legacy restore exists; run recoverLegacyRestore with offline confirmation first');
  }

  const priorRecords = loadRestoreJournal(resolvedRoot);
  if (priorRecords.length > 0) {
    const latest = latestRestoreTransaction(priorRecords);
    if (latest.last.phase !== RESTORE_TERMINAL_PHASE) {
      throw new StateMigrationError('Incomplete legacy restore exists; run recoverLegacyRestore with offline confirmation first', {
        code: 'INCOMPLETE_RESTORE_TRANSACTION',
        transactionId: latest.prepared.transactionId,
        phase: latest.last.phase,
      });
    }
    // A second restore may not overwrite or supersede a terminal journal
    // whose prior root publication was lost across power interruption.
    requireTerminalRestoreRootWitness(resolvedRoot, latest.prepared, latest.last.outcome);
  }

  const bundle = readJson(backupPath, 'Legacy backup');
  validateBackupBundle(bundle);

  // Complete a full destination security and overwrite preflight before writing
  // even one byte; a later malicious backup path cannot leave a partial restore.
  const destinations = bundle.files.map((entry) => ({
    entry,
    destination: resolveSafeRestoreDestination(resolvedRoot, entry.path),
  }));
  const normalizedDestinations = new Set();
  for (const { entry, destination } of destinations) {
    const key = destination
      .normalize('NFC')
      .toLowerCase()
      .split(/[\\/]+/)
      .map((part) => part.replace(/[. ]+$/, ''))
      .join('/');
    if (normalizedDestinations.has(key)) {
      throw new StateMigrationError('Duplicate normalized backup restore destination: ' + entry.path);
    }
    normalizedDestinations.add(key);
  }
  for (const { entry, destination } of destinations) {
    if (fs.existsSync(destination) && !overwrite) {
      throw new StateMigrationError('Refusing to overwrite restored legacy path: ' + entry.path);
    }
  }

  const originalRootExists = fs.existsSync(resolvedRoot);
  const rootStat = originalRootExists ? fs.lstatSync(resolvedRoot) : null;
  const originalMetadata = originalRootExists ? collectRestoreMetadata(resolvedRoot) : [];
  const rootIdentity = originalRootExists ? fs.lstatSync(resolvedRoot, { bigint: true }) : null;
  if (rootStat && (!rootStat.isDirectory() || rootStat.isSymbolicLink())) {
    throw new StateMigrationError('Legacy backup restore root must be an ordinary directory');
  }

  // Windows support is positive/capability based. Unsupported storage fails
  // before the staging tree or any destructive target-root mutation exists.
  if (process.platform === 'win32') requireSupportedWindowsRestoreProfile(parent);
  syncRestoreParent(parent);

  const transactionId = crypto.randomBytes(16).toString('hex');
  const stage = path.join(parent, '.dk-legacy-restore-stage-' +
    restoreJournalDigest(resolvedRoot) + '-' + transactionId);
  const displaced = stage + '-original';
  if (process.platform === 'win32') {
    // Create a private protected NTFS DACL atomically. Keep it private while
    // copying sensitive descendants, then restore exact source ACLs in
    // post-order before publishing the candidate.
    runWindowsDurabilityHelper('CreateSecureStage', {
      Path: stage, ...(originalRootExists ? { From: resolvedRoot } : {}),
    });
  } else {
    fs.mkdirSync(stage, { mode: 0o700 });
  }

  let promoted = false;
  let displacedOriginal = false;
  let transaction = null;

  try {
    if (process.platform !== 'win32') fs.chmodSync(stage, 0o700);
    if (originalRootExists) {
      fs.cpSync(resolvedRoot, stage, {
        recursive: true,
        force: true,
        dereference: false,
        verbatimSymlinks: true,
      });
    }

    const restored = [];
    for (const { entry } of destinations) {
      const destination = resolveSafeRestoreDestination(stage, entry.path, { createMissing: true });
      const content = Buffer.from(entry.contentBase64, 'base64');
      const tempFile = destination + '.tmp-' + crypto.randomUUID();
      const fd = fs.openSync(tempFile, 'wx', 0o600);
      try {
        fs.writeFileSync(fd, content);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tempFile, destination);
      if (stateSha256(fs.readFileSync(destination)) !== entry.fingerprint) {
        throw new StateMigrationError('Staged legacy file failed fingerprint verification: ' + entry.path);
      }
      restored.push(entry.path);
    }

    syncRestoreTree(stage);
    if (rootStat) applyRestoreMetadata(stage, originalMetadata);
    if (process.platform === 'win32' && originalRootExists) {
      // Child ACLs are installed while the stage root is still private.
      // CopyAclTree applies the root ACL last, then re-verifies the whole
      // tree so inherited ACE propagation cannot silently widen children.
      runWindowsDurabilityHelper('CopyAclTree', { From: resolvedRoot, To: stage });
      syncRestoreTree(stage);
    }

    const stageStat = fs.lstatSync(stage, { bigint: true });
    transaction = {
      transactionId,
      stageName: path.basename(stage),
      targetRoot: resolvedRoot,
      existed: originalRootExists,
      originalDev: rootIdentity?.dev.toString() ?? null,
      originalIno: rootIdentity?.ino.toString() ?? null,
      stageDev: stageStat.dev.toString(),
      stageIno: stageStat.ino.toString(),
    };

    // W73-01: durable discoverable recovery intent precedes every destructive
    // root-directory rename.
    appendRestoreTransactionRecord({
      targetRoot: resolvedRoot,
      transaction,
      phase: 'PREPARED',
    });

    if (originalRootExists) {
      durableRestoreRename(resolvedRoot, displaced);
      displacedOriginal = true;

      const moved = fs.lstatSync(displaced, { bigint: true });
      if (!sameRestoreIdentity(moved, transaction.originalDev, transaction.originalIno)) {
        throw new StateMigrationError('Legacy backup restore root changed during staging');
      }
      appendRestoreTransactionRecord({
        targetRoot: resolvedRoot,
        transaction,
        phase: 'ORIGINAL_DISPLACED',
      });
    }

    // W73-03: publish candidate using the platform durability primitive.
    durableRestoreRename(stage, resolvedRoot);
    promoted = true;
    displacedOriginal = false;

    const published = fs.lstatSync(resolvedRoot, { bigint: true });
    if (!sameRestoreIdentity(published, transaction.stageDev, transaction.stageIno)) {
      throw new StateMigrationError('Published restore candidate differs from staged identity witness');
    }
    appendRestoreTransactionRecord({
      targetRoot: resolvedRoot,
      transaction,
      phase: 'CANDIDATE_PUBLISHED',
    });

    // Journal acknowledgement is an explicit persistent state transition, not
    // deletion of the only recovery authority.
    appendRestoreTransactionRecord({
      targetRoot: resolvedRoot,
      transaction,
      phase: 'PROMOTION_ACKNOWLEDGED',
    });
    appendRestoreTransactionRecord({
      targetRoot: resolvedRoot,
      transaction,
      phase: RESTORE_TERMINAL_PHASE,
      outcome: originalRootExists ? 'promoted-original-retained' : 'promoted-new-root',
    });

    // A completed restore retains the displaced original as an exact-inode
    // recovery witness. Its later disposal is a distinct offline operation,
    // requiring explicit retention/security approval and disk-space planning.
    // Do not destroy the original merely because the terminal log was fsynced.
    const cleanupPending = originalRootExists && fs.existsSync(displaced);

    return Object.freeze({
      restoredFiles: restored.sort(),
      sourceFingerprint: bundle.sourceFingerprint,
      transactionId,
      transactionLog: restoreJournalPath(resolvedRoot),
      cleanupPending,
      displacedOriginal: cleanupPending && originalRootExists ? displaced : null,
    });
  } finally {
    if (displacedOriginal) {
      try {
        if (!fs.existsSync(resolvedRoot)) {
          durableRestoreRollbackRename(displaced, resolvedRoot);
        }
      } catch {
        // Explicit recoverLegacyRestore remains the authority after any
        // ambiguous/failed in-process rollback.
      }
    }
    if (!promoted) {
      try {
        if (fs.existsSync(stage)) {
          fs.rmSync(stage, { recursive: true, force: true });
          syncRestoreParent(parent);
        }
      } catch {
        // Retain orphan stage witness on cleanup failure; future restore will
        // fail closed if no matching transaction log can be proven.
      }
    }
  }
}

export function getLegacyBackupPath(rootDir = process.cwd()) {
  return path.join(getStateEnginePaths(rootDir).stateRoot, LEGACY_BACKUP_FILE);
}

export { validateBackupBundle };
