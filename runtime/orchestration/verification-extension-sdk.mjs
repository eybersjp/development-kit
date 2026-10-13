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
  if (typeof actual !== 'number' || !Number.isFinite(actual)) {
    throw new VerificationExtensionError('actual must be a valid number');
  }
  if (typeof expected !== 'number' || !Number.isFinite(expected)) {
    throw new VerificationExtensionError('expected must be a valid number');
  }

  const diff = Math.abs(actual - expected);
  // No configured tolerance means exact numeric equality, not unconditional
  // PASS. A non-finite subtraction also cannot be considered verified.
  if (absoluteTolerance === null && relativeTolerance === null) {
    return {
      pass: actual === expected,
      diff,
      reason: actual === expected ? null : 'Exact numeric values differ and no tolerance was supplied',
    };
  }
  if (!Number.isFinite(diff)) {
    return { pass: false, diff, reason: 'Numeric comparison overflowed a finite result' };
  }

  if (absoluteTolerance !== null) {
    if (typeof absoluteTolerance !== 'number' || !Number.isFinite(absoluteTolerance) || absoluteTolerance < 0) {
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
    if (typeof relativeTolerance !== 'number' || !Number.isFinite(relativeTolerance) || relativeTolerance < 0) {
      throw new VerificationExtensionError('relativeTolerance must be a non-negative number');
    }
    const maxAllowed = Math.abs(expected) * relativeTolerance;
    if (!Number.isFinite(maxAllowed)) {
      return { pass: false, diff, reason: 'Relative tolerance arithmetic overflowed' };
    }
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

/**
 * Runs project-owned verification plugins without allowing plugins to author
 * their own authoritative PASS evidence. The returned criterion status is
 * input to a separate verifier, and acceptance still requires the canonical
 * source-bound verification record for each contract-required extension.
 */
export async function executeVerificationExtensions({
  registry, bindings, contract,
} = {}) {
  if (!(registry instanceof VerificationExtensionRegistry) ||
      !Array.isArray(bindings) || !contract || !Array.isArray(contract.acceptanceCriteria)) {
    throw new VerificationExtensionError('Extension execution requires registry, bindings and Development Contract');
  }
  const required = contract.approvalPolicy?.requiredExtensions ?? [];
  if (!Array.isArray(required)) throw new VerificationExtensionError('Invalid contract-required extensions');
  const results = [];
  for (const binding of required) {
    const configured = bindings.find(item => item?.extensionId === binding.extensionId &&
      item?.criterionId === binding.criterionId);
    const extension = registry.get(binding.extensionId);
    const criterion = contract.acceptanceCriteria.find(item => item.id === binding.criterionId);
    if (!criterion) throw new VerificationExtensionError('Extension criterion missing from approved contract');
    let status = 'FAIL';
    let reason = 'Required verification extension is not registered or its input is unavailable';
    if (configured && extension && typeof extension.verify === 'function') {
      try {
        const evaluated = await extension.verify(structuredClone(configured.input));
        if (evaluated && typeof evaluated === 'object' && evaluated.pass === true) {
          status = 'PASS';
          reason = null;
        } else {
          reason = evaluated?.reason || 'Extension returned a non-PASS result';
        }
      } catch (error) {
        reason = 'Required extension execution failed: ' + error.message;
      }
    }
    results.push({
      id: criterion.id,
      extensionId: binding.extensionId,
      status,
      reason,
      // A separate verifier must attach source-bound evidence and issue the
      // authoritative VerificationRecord; this is only test computation.
    });
  }
  return results;
}
