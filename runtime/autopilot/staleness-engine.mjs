/**
 * Development Kit Autopilot — Artifact Staleness & Fingerprint Engine
 *
 * Computes artifact content hashes (SHA-256) and tracks upstream/downstream invalidation.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function computeFileFingerprint(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function updateArtifactFingerprints(state, artifactPaths = [], rootDir = process.cwd()) {
  if (!state) return state;
  if (!state.artifactFingerprints) {
    state.artifactFingerprints = {};
  }

  for (const relPath of artifactPaths) {
    const fullPath = path.resolve(rootDir, relPath);
    const hash = computeFileFingerprint(fullPath);
    if (hash) {
      state.artifactFingerprints[relPath] = {
        hash,
        updatedAt: new Date().toISOString()
      };
    }
  }

  return state;
}

export function checkArtifactStaleness(state, relPath, rootDir = process.cwd()) {
  if (!state || !state.artifactFingerprints || !state.artifactFingerprints[relPath]) {
    return false; // Unknown or untracked artifact
  }

  const fullPath = path.resolve(rootDir, relPath);
  const currentHash = computeFileFingerprint(fullPath);
  const storedHash = state.artifactFingerprints[relPath].hash;

  return currentHash !== storedHash;
}
