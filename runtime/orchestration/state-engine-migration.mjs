import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

      if (states.length === 0) states = [manifest];
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
  if (components.some((part) => !part || part === '.' || part === '..')) {
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

export function restoreLegacyBackup({
  backupPath,
  targetRoot,
  overwrite = false,
} = {}) {
  if (typeof backupPath !== 'string' || !backupPath) throw new StateMigrationError('backupPath is required');
  if (typeof targetRoot !== 'string' || !targetRoot) throw new StateMigrationError('targetRoot is required');
  const bundle = readJson(backupPath, 'Legacy backup');
  validateBackupBundle(bundle);

  // Complete a full destination security and overwrite preflight before writing
  // even one byte; a later malicious backup path cannot leave a partial restore.
  const destinations = bundle.files.map((entry) => ({
    entry,
    destination: resolveSafeRestoreDestination(targetRoot, entry.path),
  }));
  for (const { entry, destination } of destinations) {
    if (fs.existsSync(destination) && !overwrite) {
      throw new StateMigrationError('Refusing to overwrite restored legacy path: ' + entry.path);
    }
  }

  // Path-based preflight + O_NOFOLLOW cannot secure an overwrite against a
  // concurrent parent-directory swap. Build and fsync a complete replacement
  // tree in an owner-only sibling directory. Publish by renaming the root
  // directory itself; no restored byte is ever opened through an attacker-
  // mutable path *inside* targetRoot.
  const resolvedRoot = path.resolve(targetRoot);
  const parent = path.dirname(resolvedRoot);
  const originalRootExists = fs.existsSync(resolvedRoot);
  const rootStat = originalRootExists ? fs.lstatSync(resolvedRoot) : null;
  if (rootStat && (!rootStat.isDirectory() || rootStat.isSymbolicLink())) {
    throw new StateMigrationError('Legacy backup restore root must be an ordinary directory');
  }
  const stage = fs.mkdtempSync(path.join(parent, '.dk-legacy-restore-stage-'));
  const displaced = stage + '-original';
  let promoted = false;
  let displacedOriginal = false;
  try {
    fs.chmodSync(stage, 0o700);
    if (originalRootExists) {
      fs.cpSync(resolvedRoot, stage, { recursive: true, force: true, dereference: false });
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
      // An atomic rename replaces the *directory entry* even if the prior
      // staging entry is a link; it never truncates an external hardlink inode.
      fs.renameSync(tempFile, destination);
      if (stateSha256(fs.readFileSync(destination)) !== entry.fingerprint) {
        throw new StateMigrationError('Staged legacy file failed fingerprint verification: ' + entry.path);
      }
      restored.push(entry.path);
    }

    // The stage is private while being populated. Before promotion, restore
    // the original root's traversal permissions and POSIX ownership so
    // existing service/group consumers keep their access after cutover.
    if (rootStat) {
      const stagedStat = fs.statSync(stage);
      if (process.platform !== 'win32' &&
        (stagedStat.uid !== rootStat.uid || stagedStat.gid !== rootStat.gid)) {
        fs.chownSync(stage, rootStat.uid, rootStat.gid);
      }
      fs.chmodSync(stage, rootStat.mode & 0o7777);
      fs.utimesSync(stage, rootStat.atime, rootStat.mtime);
    }

    // Moving the existing root out of the way does not follow a symlink.
    // Verify that the directory moved is still the original preflighted inode
    // before publishing the staged replacement.
    if (originalRootExists) {
      fs.renameSync(resolvedRoot, displaced);
      displacedOriginal = true;
      const moved = fs.lstatSync(displaced);
      if (moved.dev !== rootStat.dev || moved.ino !== rootStat.ino) {
        throw new StateMigrationError('Legacy backup restore root changed during staging');
      }
    }
    fs.renameSync(stage, resolvedRoot);
    promoted = true;
    displacedOriginal = false;
    if (originalRootExists) fs.rmSync(displaced, { recursive: true, force: true });
    return Object.freeze({
      restoredFiles: restored.sort(),
      sourceFingerprint: bundle.sourceFingerprint,
    });
  } finally {
    if (displacedOriginal) {
      try {
        if (!fs.existsSync(resolvedRoot)) fs.renameSync(displaced, resolvedRoot);
      } catch {}
    }
    if (!promoted) {
      try { fs.rmSync(stage, { recursive: true, force: true }); } catch {}
    }
  }
}

export function getLegacyBackupPath(rootDir = process.cwd()) {
  return path.join(getStateEnginePaths(rootDir).stateRoot, LEGACY_BACKUP_FILE);
}

export { validateBackupBundle };
