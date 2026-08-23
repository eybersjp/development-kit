import { createHash } from 'node:crypto';

import { validateDevelopmentContract } from './development-contract.mjs';
import { validateVerificationRecord } from './evidence-store.mjs';

const CORRECTION_ACTIONS = Object.freeze(['NONE', 'CORRECT', 'PAUSE']);
const HARD_PAUSE_CODES = new Set([
  'REQUIREMENT_AMBIGUITY',
  'ARCHITECTURE_DECISION',
  'DESIGN_DECISION',
  'SECURITY_DECISION',
  'CONSEQUENTIAL_ACTION',
  'HUMAN_APPROVAL_REQUIRED',
  'SCOPE_EXPANSION',
]);

export class CorrectionEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CorrectionEngineError';
  }
}

function failureSignature(failures) {
  const normalized = failures
    .map((failure) => `${failure.id}:${failure.status}:${failure.reason ?? ''}`)
    .sort()
    .join('|');
  return `sha256:${createHash('sha256').update(normalized).digest('hex')}`;
}

export function decideCorrection({
  contract,
  verification,
  attempt = 0,
  priorFailureSignatures = [],
  blockers = [],
} = {}) {
  validateDevelopmentContract(contract);
  validateVerificationRecord(verification);
  if (verification.contractId !== contract.contractId || verification.sourceFingerprint !== contract.sourceFingerprint) {
    return { action: 'PAUSE', reason: 'STALE_OR_MISMATCHED_CONTEXT', request: null, failureSignature: null };
  }
  if (!Number.isInteger(attempt) || attempt < 0) throw new CorrectionEngineError('attempt must be a non-negative integer');
  if (!Array.isArray(priorFailureSignatures) || !Array.isArray(blockers)) throw new CorrectionEngineError('priorFailureSignatures and blockers must be arrays');

  if (verification.verdict === 'PASS') {
    return { action: 'NONE', reason: 'VERIFICATION_PASSED', request: null, failureSignature: null };
  }
  if (blockers.some((blocker) => HARD_PAUSE_CODES.has(typeof blocker === 'string' ? blocker : blocker?.code))) {
    return { action: 'PAUSE', reason: 'NON_CORRECTABLE_BLOCKER', request: null, failureSignature: null };
  }
  if (contract.risk.level >= 3) {
    return { action: 'PAUSE', reason: 'HIGH_RISK_REQUIRES_HUMAN', request: null, failureSignature: null };
  }
  if (attempt >= contract.correctionPolicy.maxAttempts) {
    return { action: 'PAUSE', reason: 'MAX_ATTEMPTS_REACHED', request: null, failureSignature: null };
  }
  if (verification.verdict === 'INCOMPLETE') {
    return { action: 'PAUSE', reason: 'VERIFICATION_INCOMPLETE', request: null, failureSignature: null };
  }

  const failures = verification.criteria
    .filter((criterion) => ['FAIL', 'PARTIAL'].includes(criterion.status))
    .map((criterion) => ({
      id: criterion.id,
      expected: criterion.statement,
      status: criterion.status,
      observed: criterion.reason ?? 'Verifier reported non-compliance',
      evidence: structuredClone(criterion.evidence ?? []),
    }));
  if (failures.length === 0) {
    return { action: 'PAUSE', reason: 'NO_CORRECTABLE_FAILURES', request: null, failureSignature: null };
  }

  const signature = failureSignature(failures);
  if (priorFailureSignatures.includes(signature)) {
    return { action: 'PAUSE', reason: 'REPEATED_FAILURE', request: null, failureSignature: signature };
  }

  const request = {
    schemaVersion: '1.0.0',
    contractId: contract.contractId,
    taskId: contract.taskId,
    sourceFingerprint: contract.sourceFingerprint,
    attempt: attempt + 1,
    failures,
    allowedScope: [...contract.scope.in],
    prohibitedChanges: [...contract.scope.out],
    failureSignature: signature,
  };
  validateCorrectionRequest(request, contract);
  return { action: 'CORRECT', reason: 'SAFE_IMPLEMENTATION_FAILURE', request, failureSignature: signature };
}

export function validateCorrectionRequest(request, contract) {
  validateDevelopmentContract(contract);
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new CorrectionEngineError('correction request is required');
  if (request.contractId !== contract.contractId || request.taskId !== contract.taskId) throw new CorrectionEngineError('Correction request contract identity mismatch');
  if (request.sourceFingerprint !== contract.sourceFingerprint) throw new CorrectionEngineError('Correction request source fingerprint mismatch');
  if (!Number.isInteger(request.attempt) || request.attempt < 1 || request.attempt > contract.correctionPolicy.maxAttempts) throw new CorrectionEngineError('Correction request attempt exceeds policy');
  if (!Array.isArray(request.failures) || request.failures.length === 0) throw new CorrectionEngineError('Correction request requires failures');
  if (JSON.stringify(request.allowedScope) !== JSON.stringify(contract.scope.in)) throw new CorrectionEngineError('Correction request may not expand allowed scope');
  if (JSON.stringify(request.prohibitedChanges) !== JSON.stringify(contract.scope.out)) throw new CorrectionEngineError('Correction request may not alter prohibited scope');
  if (typeof request.failureSignature !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(request.failureSignature)) throw new CorrectionEngineError('Correction request failure signature is invalid');
  return true;
}

export { CORRECTION_ACTIONS };
