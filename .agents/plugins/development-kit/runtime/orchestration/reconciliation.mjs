import fs from 'node:fs';
import path from 'node:path';

import { sha256 } from './development-contract.mjs';

export class ReconciliationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ReconciliationError';
    this.details = details;
  }
}

function resolveProjectFile(rootDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) throw new ReconciliationError('Artifact path is required');
  const normalized = relativePath.trim().replaceAll('\\', '/');
  if (path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//') || normalized.split('/').includes('..')) {
    throw new ReconciliationError('Artifact path must remain inside project root');
  }
  const root = path.resolve(rootDir);
  const absolute = path.resolve(root, normalized);
  const relative = path.relative(root, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new ReconciliationError('Artifact path escapes project root');
  return { normalized, absolute };
}

function fingerprint(content) {
  return `sha256:${sha256(Buffer.from(content, 'utf8'))}`;
}

function applyReplacement(content, operation, index) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw new ReconciliationError(`Operation ${index} must be an object`);
  if (operation.type !== 'replace') throw new ReconciliationError(`Unsupported amendment operation: ${operation.type}`);
  if (typeof operation.find !== 'string' || operation.find.length === 0) throw new ReconciliationError(`Operation ${index} requires non-empty find text`);
  if (typeof operation.replace !== 'string') throw new ReconciliationError(`Operation ${index} requires replacement text`);
  const matches = content.split(operation.find).length - 1;
  const expectedMatches = operation.expectedMatches ?? 1;
  if (!Number.isInteger(expectedMatches) || expectedMatches < 1) throw new ReconciliationError(`Operation ${index} expectedMatches must be positive`);
  if (matches !== expectedMatches) {
    throw new ReconciliationError(`Operation ${index} anchor match count ${matches} does not equal expected ${expectedMatches}`);
  }
  return content.split(operation.find).join(operation.replace);
}

export function reconcileCanonicalArtifact({
  rootDir = process.cwd(),
  path: artifactPath,
  expectedFingerprint,
  operations,
  amendmentId,
} = {}) {
  const resolved = resolveProjectFile(rootDir, artifactPath);
  if (!fs.existsSync(resolved.absolute) || !fs.statSync(resolved.absolute).isFile()) throw new ReconciliationError(`Canonical artifact not found: ${resolved.normalized}`);
  if (!Array.isArray(operations) || operations.length === 0) throw new ReconciliationError('At least one amendment operation is required');
  if (typeof amendmentId !== 'string' || !amendmentId.trim()) throw new ReconciliationError('amendmentId is required');
  if (typeof expectedFingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(expectedFingerprint)) {
    throw new ReconciliationError('expectedFingerprint is required for canonical amendment reconciliation');
  }

  const before = fs.readFileSync(resolved.absolute, 'utf8');
  const beforeFingerprint = fingerprint(before);
  if (expectedFingerprint !== beforeFingerprint) {
    throw new ReconciliationError('Canonical artifact fingerprint changed before amendment', [{ expectedFingerprint, beforeFingerprint }]);
  }

  let expectedAfter = before;
  operations.forEach((operation, index) => {
    expectedAfter = applyReplacement(expectedAfter, operation, index + 1);
  });
  if (expectedAfter === before) throw new ReconciliationError('Amendment produced no canonical artifact change');

  const temp = `${resolved.absolute}.dk-amend-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, expectedAfter, 'utf8');
  fs.renameSync(temp, resolved.absolute);

  const actualAfter = fs.readFileSync(resolved.absolute, 'utf8');
  if (actualAfter !== expectedAfter) {
    throw new ReconciliationError('Canonical artifact read-back differs from requested amendment');
  }

  const afterFingerprint = fingerprint(actualAfter);
  return {
    schemaVersion: '1.0.0',
    amendmentId: amendmentId.trim(),
    path: resolved.normalized,
    beforeFingerprint,
    afterFingerprint,
    operationCount: operations.length,
    changed: true,
  };
}

export function fingerprintCanonicalArtifact(rootDir, artifactPath) {
  const resolved = resolveProjectFile(rootDir, artifactPath);
  if (!fs.existsSync(resolved.absolute) || !fs.statSync(resolved.absolute).isFile()) throw new ReconciliationError(`Canonical artifact not found: ${resolved.normalized}`);
  return fingerprint(fs.readFileSync(resolved.absolute, 'utf8'));
}
