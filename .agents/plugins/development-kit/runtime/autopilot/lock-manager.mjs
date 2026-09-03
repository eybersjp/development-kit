/**
 * Development Kit Autopilot — Lock & Lease Manager
 *
 * Manages short transaction locking (.development-kit/autopilot/state.lock)
 * using fs.openSync('wx') for atomic state operations, and active-action lease logic.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class LockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LockError';
  }
}

export function acquireTransactionLock(rootDir = process.cwd(), timeoutMs = 5000) {
  const lockDir = path.join(rootDir, '.development-kit', 'autopilot');
  if (!fs.existsSync(lockDir)) {
    fs.mkdirSync(lockDir, { recursive: true });
  }

  const lockPath = path.join(lockDir, 'state.lock');
  const ownerToken = `lock_${crypto.randomUUID()}`;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      const lockData = JSON.stringify({ ownerToken, acquiredAt: new Date().toISOString() });
      fs.writeSync(fd, lockData);
      fs.closeSync(fd);
      return { lockPath, ownerToken };
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Check if lock file is stale (> 10s)
        try {
          const stat = fs.statSync(lockPath);
          if (Date.now() - stat.mtimeMs > 10000) {
            fs.unlinkSync(lockPath);
            continue;
          }
        } catch {
          // Ignore unlink errors
        }
        // Small delay before retrying
        const startSync = Date.now();
        while (Date.now() - startSync < 50) {}
      } else {
        throw new LockError(`Failed to acquire lock: ${err.message}`);
      }
    }
  }

  throw new LockError('Transaction lock acquisition timed out');
}

export function releaseTransactionLock(lockInfo) {
  if (!lockInfo || !lockInfo.lockPath) return;
  try {
    if (fs.existsSync(lockInfo.lockPath)) {
      const content = JSON.parse(fs.readFileSync(lockInfo.lockPath, 'utf8'));
      if (content.ownerToken === lockInfo.ownerToken) {
        fs.unlinkSync(lockInfo.lockPath);
      }
    }
  } catch {
    // Best-effort release
  }
}
