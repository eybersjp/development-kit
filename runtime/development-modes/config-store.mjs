/**
 * Repository-owned, revisioned Development Modes selection.
 * One state file contains both the current selection and its history, so an
 * interrupted write cannot leave a pointer and journal referring to different revisions.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  getDefaultModeConfiguration,
  resolveDevelopmentModeConfiguration,
} from './policy-contract.mjs';

export class DevelopmentModeStoreError extends Error {
  constructor(message, code = 'DK_MODE_STORE_INVALID') {
    super(message);
    this.name = 'DevelopmentModeStoreError';
    this.code = code;
  }
}

export function getDevelopmentModePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'development-mode.json');
}

function fail(message, code) {
  throw new DevelopmentModeStoreError(message, code);
}

function safeStateDir(rootDir) {
  const dir = path.join(rootDir, '.development-kit');
  if (!fs.existsSync(dir)) {
    fail('Project is not bootstrapped: .development-kit directory missing', 'DK_MODE_BOOTSTRAP_MISSING');
  }
  if (fs.lstatSync(dir).isSymbolicLink() || !fs.lstatSync(dir).isDirectory()) {
    fail('Development Kit state directory must be a real directory, not a symlink');
  }
  return dir;
}

function safeFile(filePath) {
  let stat;
  try { stat = fs.lstatSync(filePath); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('Mode configuration must be a regular file, not a symlink or directory');
  }
}

function selectionOf(input) {
  // Fail closed against unknown values before normalizing any defaults.
  const resolved = resolveDevelopmentModeConfiguration(input);
  const selection = { schemaVersion: 1, mode: resolved.mode };
  if (resolved.baseMethodology) selection.baseMethodology = resolved.baseMethodology;
  if (input.customPolicies !== undefined) selection.customPolicies = structuredClone(input.customPolicies);
  if (input.projectOverrides !== undefined) selection.projectOverrides = structuredClone(input.projectOverrides);
  return selection;
}

function equal(a, b) {
  // Property order does not affect equality of a validated selection.
  return a.schemaVersion === b.schemaVersion && a.mode === b.mode
    && (a.baseMethodology ?? null) === (b.baseMethodology ?? null)
    && JSON.stringify(Object.entries(a.customPolicies ?? {}).sort()) === JSON.stringify(Object.entries(b.customPolicies ?? {}).sort())
    && JSON.stringify(Object.entries(a.projectOverrides ?? {}).sort()) === JSON.stringify(Object.entries(b.projectOverrides ?? {}).sort());
}

function validateRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)
    || Object.keys(record).some((key) => !['formatVersion', 'revision', 'selection', 'history'].includes(key))) {
    fail('Malformed Development Modes state record');
  }
  if (record.formatVersion !== 1 || !Number.isSafeInteger(record.revision)
    || record.revision < 1 || !Array.isArray(record.history)
    || record.history.length !== record.revision) {
    fail('Invalid Development Modes state version, revision, or history');
  }
  try { selectionOf(record.selection); } catch (error) { fail(`Invalid current selection: ${error.message}`); }
  for (const [index, entry] of record.history.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).some((key) => !['revision', 'at', 'actor', 'reason', 'source', 'selection'].includes(key))
      || entry.revision !== index + 1
      || typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at))
      || typeof entry.actor !== 'string' || !entry.actor.trim()
      || typeof entry.reason !== 'string' || !entry.reason.trim()
      || !['default', 'explicit', 'legacy-migration', 'mode-change'].includes(entry.source)
      || (index === 0 && entry.source === 'mode-change')
      || (index > 0 && entry.source !== 'mode-change')) {
      fail(`Invalid Development Modes history entry ${index + 1}`);
    }
    try { selectionOf(entry.selection); } catch (error) { fail(`Invalid history selection: ${error.message}`); }
    if (index > 0 && equal(entry.selection, record.history[index - 1].selection)) {
      fail('Redundant Development Modes history revision');
    }
  }
  if (!equal(record.history.at(-1).selection, record.selection)) {
    fail('Current mode selection differs from final history revision');
  }
  return record;
}

export function readDevelopmentMode(rootDir = process.cwd()) {
  const filePath = getDevelopmentModePath(rootDir);
  if (fs.existsSync(path.dirname(filePath))) safeStateDir(rootDir);
  if (!fs.existsSync(path.dirname(filePath))) return null;
  safeFile(filePath);
  if (!fs.existsSync(filePath)) return null;
  let record;
  try { record = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { fail(`Unable to read mode configuration: ${error.message}`); }
  return validateRecord(record);
}

export function inspectDevelopmentMode(rootDir = process.cwd()) {
  const record = readDevelopmentMode(rootDir);
  if (!record) return { status: 'absent' };
  return {
    status: 'configured',
    revision: record.revision,
    selection: structuredClone(record.selection),
    resolved: resolveDevelopmentModeConfiguration(record.selection),
    history: structuredClone(record.history),
  };
}

function withFileLock(rootDir, action) {
  const dir = safeStateDir(rootDir);
  const lockPath = path.join(dir, 'development-mode.lock');
  let fd;
  try { fd = fs.openSync(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') fail('Concurrent mode configuration writer: retry after current operation', 'DK_MODE_STORE_LOCKED');
    throw error;
  }
  try { return action(); }
  finally {
    fs.closeSync(fd);
    fs.unlinkSync(lockPath);
  }
}

function writeAtomic(rootDir, record) {
  validateRecord(record);
  const filePath = getDevelopmentModePath(rootDir);
  safeFile(filePath);
  const tmp = path.join(safeStateDir(rootDir), `development-mode.${process.pid}.${Date.now()}.tmp`);
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeFileSync(fd, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, filePath);
  } finally {
    if (fd !== null && fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

function entry(revision, selection, { actor, reason, source }) {
  if (typeof actor !== 'string' || !actor.trim() || actor.length > 128
    || typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
    fail('Mode change requires a nonblank actor and reason (maximum 128/1000 characters)');
  }
  return { revision, at: new Date().toISOString(), actor: actor.trim(), reason: reason.trim(), source, selection };
}

/** Existing valid configurations are not rewritten. Different selections need explicit change action. */
export function initializeDevelopmentMode(rootDir, requestedSelection = getDefaultModeConfiguration(), {
  source = 'default', actor = 'dk-bootstrap', reason = 'Project methodology initialized',
} = {}) {
  const selection = selectionOf(requestedSelection);
  if (!['default', 'explicit', 'legacy-migration'].includes(source)) fail('Invalid initialization source');
  return withFileLock(rootDir, () => {
    const existing = readDevelopmentMode(rootDir);
    if (existing) {
      if (!equal(existing.selection, selection)) {
        fail('Existing mode differs from requested selection; use --set-mode with revision and reason',
          'DK_MODE_EXPLICIT_CHANGE_REQUIRED');
      }
      return { changed: false, ...inspectDevelopmentMode(rootDir) };
    }
    const record = {
      formatVersion: 1,
      revision: 1,
      selection,
      history: [entry(1, selection, { actor, reason, source })],
    };
    writeAtomic(rootDir, record);
    return { changed: true, ...inspectDevelopmentMode(rootDir) };
  });
}

/** Compare-and-swap: never rebase a developer's explicit decision on stale state. */
export function changeDevelopmentMode(rootDir, requestedSelection, {
  expectedRevision, reason, actor = 'developer-cli',
} = {}) {
  const selection = selectionOf(requestedSelection);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    fail('A positive --expected-revision is required for mode changes', 'DK_MODE_REVISION_REQUIRED');
  }
  // Validate reason before taking the lock or touching the state.
  entry(1, selection, { actor, reason, source: 'mode-change' });
  return withFileLock(rootDir, () => {
    const existing = readDevelopmentMode(rootDir);
    if (!existing) fail('Mode configuration is absent; initialize the project first', 'DK_MODE_BOOTSTRAP_MISSING');
    if (existing.revision !== expectedRevision) {
      fail(`Mode revision conflict: expected ${expectedRevision}, current ${existing.revision}`,
        'DK_MODE_REVISION_CONFLICT');
    }
    if (equal(existing.selection, selection)) return { changed: false, ...inspectDevelopmentMode(rootDir) };
    const revision = existing.revision + 1;
    const updated = {
      formatVersion: 1, revision, selection,
      history: [...existing.history, entry(revision, selection, { actor, reason, source: 'mode-change' })],
    };
    writeAtomic(rootDir, updated);
    return { changed: true, ...inspectDevelopmentMode(rootDir) };
  });
}
