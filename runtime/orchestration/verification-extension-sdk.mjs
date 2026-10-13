import crypto from 'node:crypto';
import fs from 'node:fs';

export const VERIFICATION_EXTENSION_SCHEMA_VERSION = '1.0.0';

export class VerificationExtensionError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'VerificationExtensionError';
    this.details = details;
  }
}

/**
 * Generic numeric tolerance check (AC-025)
 * Checks absolute and relative tolerance without any domain-specific logic.
 */
export function checkNumericTolerance({
  actual,
  expected,
  absoluteTolerance = null,
  relativeTolerance = null,
} = {}) {
  if (typeof actual !== 'number' || Number.isNaN(actual)) {
    throw new VerificationExtensionError('actual must be a valid number');
  }
  if (typeof expected !== 'number' || Number.isNaN(expected)) {
    throw new VerificationExtensionError('expected must be a valid number');
  }

  const diff = Math.abs(actual - expected);

  if (absoluteTolerance !== null) {
    if (typeof absoluteTolerance !== 'number' || absoluteTolerance < 0) {
      throw new VerificationExtensionError('absoluteTolerance must be a non-negative number');
    }
    if (diff > absoluteTolerance) {
      return {
        pass: false,
        diff,
        reason: `Exceeded absolute tolerance: diff ${diff} > ${absoluteTolerance}`,
      };
    }
  }

  if (relativeTolerance !== null) {
    if (typeof relativeTolerance !== 'number' || relativeTolerance < 0) {
      throw new VerificationExtensionError('relativeTolerance must be a non-negative number');
    }
    const maxAllowed = Math.abs(expected) * relativeTolerance;
    if (diff > maxAllowed) {
      return {
        pass: false,
        diff,
        reason: `Exceeded relative tolerance: diff ${diff} > ${maxAllowed} (${relativeTolerance * 100}%)`,
      };
    }
  }

  return {
    pass: true,
    diff,
    reason: null,
  };
}

/**
 * Evaluates generic invariant expressions or functions (AC-026).
 */
export function evaluateInvariant({
  name,
  condition,
  value,
} = {}) {
  let pass = false;
  let reason = null;

  try {
    if (typeof condition === 'function') {
      pass = Boolean(condition(value));
    } else if (typeof condition === 'boolean') {
      pass = condition;
    } else {
      throw new VerificationExtensionError('condition must be a function or boolean');
    }
  } catch (error) {
    pass = false;
    reason = `Invariant '${name}' execution error: ${error.message}`;
  }

  if (!pass && !reason) {
    reason = `Invariant '${name}' violated`;
  }

  return {
    name,
    pass,
    reason,
  };
}

/**
 * Validates reference dataset freshness (AC-027).
 */
export function checkDatasetFreshness({
  datasetPath,
  expectedFingerprint,
} = {}) {
  if (!fs.existsSync(datasetPath)) {
    return {
      fresh: false,
      reason: `Dataset file missing: ${datasetPath}`,
      currentFingerprint: null,
    };
  }

  const content = fs.readFileSync(datasetPath);
  const currentFingerprint = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;

  const fresh = currentFingerprint === expectedFingerprint;
  return {
    fresh,
    reason: fresh ? null : `Fingerprint mismatch: expected ${expectedFingerprint}, got ${currentFingerprint}`,
    currentFingerprint,
  };
}

/**
 * Verification Extension Registry
 */
export class VerificationExtensionRegistry {
  constructor() {
    this.extensions = new Map();
  }

  register(extension) {
    if (!extension || typeof extension !== 'object') {
      throw new VerificationExtensionError('Extension must be an object');
    }
    if (typeof extension.extensionId !== 'string' || !extension.extensionId.trim()) {
      throw new VerificationExtensionError('Extension must have a valid extensionId');
    }
    if (typeof extension.name !== 'string' || !extension.name.trim()) {
      throw new VerificationExtensionError('Extension must have a valid name');
    }
    this.extensions.set(extension.extensionId, extension);
  }

  get(extensionId) {
    return this.extensions.get(extensionId) || null;
  }

  list() {
    return Array.from(this.extensions.values());
  }
}
