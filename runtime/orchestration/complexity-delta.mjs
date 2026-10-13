import crypto from 'node:crypto';

export const COMPLEXITY_DELTA_SCHEMA_VERSION = '1.0.0';

export class ComplexityDeltaError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ComplexityDeltaError';
    this.details = details;
  }
}

/**
 * Computes deterministic complexity facts from repository/diff metrics (AC-028).
 * Identical inputs produce strictly identical deltas and hashes.
 */
export function computeComplexityDelta({
  filesAdded = 0,
  filesRemoved = 0,
  filesModified = 0,
  linesAdded = 0,
  linesDeleted = 0,
  dependenciesAdded = [],
  abstractionsExported = [],
  riskLevel = 1,
  alwaysReview = false,
  now = '2026-10-13T00:00:00.000Z',
} = {}) {
  // Invalid metric inputs must not silently suppress mandatory simplicity
  // review, and a decision fingerprint must include policy-affecting inputs.
  for (const [name, value] of Object.entries({
    filesAdded, filesRemoved, filesModified, linesAdded, linesDeleted,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new ComplexityDeltaError(`${name} must be a non-negative safe integer`);
    }
  }
  if (!Number.isInteger(riskLevel) || riskLevel < 1 || riskLevel > 3) {
    throw new ComplexityDeltaError('riskLevel must be an integer from 1 to 3');
  }
  if (typeof alwaysReview !== 'boolean') {
    throw new ComplexityDeltaError('alwaysReview must be boolean');
  }
  for (const [name, values] of Object.entries({ dependenciesAdded, abstractionsExported })) {
    if (!Array.isArray(values) || values.some(v => typeof v !== 'string' || !v.trim())) {
      throw new ComplexityDeltaError(`${name} must contain non-empty strings`);
    }
  }
  const normDeps = [...new Set(dependenciesAdded)].sort();
  const normAbstr = [...new Set(abstractionsExported)].sort();

  const triggerReasons = [];

  // Policy triggers for simplicity review (AC-029):
  // 1. Dependencies added
  if (normDeps.length > 0) {
    triggerReasons.push(`New dependencies introduced: ${normDeps.join(', ')}`);
  }

  // 2. Significant net file additions (>= 3)
  if (filesAdded >= 3) {
    triggerReasons.push(`High file addition count: ${filesAdded} files added`);
  }

  // 3. High line change volume (>= 500 lines added)
  if (linesAdded >= 500) {
    triggerReasons.push(`High line volume: ${linesAdded} lines added`);
  }

  // 4. Multiple new abstractions exported (>= 3)
  if (normAbstr.length >= 3) {
    triggerReasons.push(`Multiple new exported abstractions: ${normAbstr.length} abstractions`);
  }

  // 5. Existing mandatory policy (risk level >= 3 or explicit configuration)
  if (riskLevel >= 3) {
    triggerReasons.push(`Mandatory simplicity review required by risk level ${riskLevel}`);
  }
  if (alwaysReview) {
    triggerReasons.push('Mandatory simplicity review explicitly requested by project policy');
  }

  const requiresSimplicityReview = triggerReasons.length > 0;

  // Compute deterministic delta ID from normalized input payload
  const digestPayload = JSON.stringify({
    filesAdded,
    filesRemoved,
    filesModified,
    linesAdded,
    linesDeleted,
    normDeps,
    normAbstr,
    riskLevel,
    alwaysReview,
  });
  const hash = crypto.createHash('sha256').update(digestPayload).digest('hex').slice(0, 20);
  const deltaId = `cd-${hash}`;

  return {
    schemaVersion: COMPLEXITY_DELTA_SCHEMA_VERSION,
    deltaId,
    filesAdded,
    filesRemoved,
    filesModified,
    linesAdded,
    linesDeleted,
    dependenciesAdded: normDeps,
    abstractionsExported: normAbstr,
    requiresSimplicityReview,
    triggerReasons,
    computedAt: now,
  };
}
