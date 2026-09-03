import { assertIndependentVerificationContext } from './context-package.mjs';
import { createVerificationRecord } from './evidence-store.mjs';
import { validateDevelopmentContract } from './development-contract.mjs';

export class VerificationEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerificationEngineError';
  }
}

export function verifyFromContext({ contextPackage, runId, criteria, createdAt } = {}) {
  assertIndependentVerificationContext(contextPackage);
  const contract = contextPackage.contract;
  validateDevelopmentContract(contract);
  if (contextPackage.contractId !== contract.contractId) {
    throw new VerificationEngineError('Context contractId does not match embedded Development Contract');
  }
  if (contextPackage.sourceFingerprint !== contract.sourceFingerprint) {
    throw new VerificationEngineError('Context source fingerprint does not match embedded Development Contract');
  }
  const role = contextPackage.role === 'spec-reviewer' ? 'spec-reviewer' : 'spec-verifier';
  return createVerificationRecord({
    contract,
    runId,
    role,
    contextIsolation: contextPackage.contextIsolation,
    sourceFingerprint: contextPackage.sourceFingerprint,
    criteria,
    createdAt,
  });
}
