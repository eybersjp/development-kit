/**
 * Serializes migration inspection/backup/cutover with every supported legacy
 * state writer. This is a local, cooperative cross-process gate, NOT a defence
 * against arbitrary same-account hostile processes (Issue #72).
 *
 * An orphaned gate is deliberately NOT reclaimed by elapsed time: an
 * uncertain writer or migration must never be bypassed. Offline recovery
 * requires proving all participating processes have stopped and preserving
 * the lock bytes before an operator removes it.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SLEEP = new Int32Array(new SharedArrayBuffer(4));
const LOCK_NAME = '.state-migration.lock';

export class MigrationGateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MigrationGateError';
  }
}

function assertSafeDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new MigrationGateError('Migration gate parent is not a real directory');
  }
}

function inspectGate(lockPath) {
  try {
    const stat = fs.lstatSync(lockPath, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n) {
      throw new MigrationGateError('Unsafe migration gate link or object type');
    }
    return stat;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function withMigrationGate(rootDir, operation, { timeoutMs = 2000 } = {}) {
  const root = path.resolve(rootDir);
  assertSafeDirectory(root);
  const parent = path.join(root, '.development-kit');
  fs.mkdirSync(parent, { recursive: true });
  assertSafeDirectory(parent);
  const lockPath = path.join(parent, LOCK_NAME);
  const token = crypto.randomUUID();
  const start = Date.now();
  let fd;
  for (;;) {
    try {
      fd = fs.openSync(lockPath, 'wx', 0o600);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      inspectGate(lockPath);
      if (Date.now() - start >= timeoutMs) {
        throw new MigrationGateError(
          'Migration/cutover gate is held or orphaned; preserve it and retry only after safe operator recovery',
        );
      }
      Atomics.wait(SLEEP, 0, 0, 25);
    }
  }
  let identity;
  try {
    identity = fs.fstatSync(fd, { bigint: true });
    fs.writeFileSync(fd, JSON.stringify({
      schemaVersion: 1, token, pid: process.pid, acquiredAt: new Date().toISOString(),
    }) + '\n', 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  let outcome;
  let operationError;
  try {
    outcome = operation();
  } catch (error) {
    operationError = error;
  }
  let releaseError;
  try {
    assertSafeDirectory(parent);
    const current = inspectGate(lockPath);
    if (!current || current.dev !== identity.dev || current.ino !== identity.ino) {
      throw new MigrationGateError('Migration gate identity changed; preserving evidence');
    }
    const record = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (record.token !== token || record.pid !== process.pid) {
      throw new MigrationGateError('Migration gate ownership changed; preserving evidence');
    }
    fs.unlinkSync(lockPath);
  } catch (error) {
    releaseError = error;
  }
  if (operationError && releaseError) {
    throw new AggregateError([operationError, releaseError],
      'Migration operation and gate cleanup both failed; outcome uncertain');
  }
  if (operationError) throw operationError;
  if (releaseError) throw releaseError;
  return outcome;
}
