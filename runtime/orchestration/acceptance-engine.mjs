import { checkContractStaleness, validateDevelopmentContract } from './development-contract.mjs';
import { validateControlManifest, validateVerificationRecord } from './evidence-store.mjs';
import { validateReviewResult } from './review-result.mjs';
import { validateArchitectureDrift } from './architecture-drift.mjs';
import { selectRequiredGates } from './gate-selector.mjs';

const ACCEPTANCE_STATES = Object.freeze(['ACCEPTED', 'PENDING', 'BLOCKED']);

export class AcceptanceEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AcceptanceEngineError';
  }
}

function object(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validApproval(approval, contract) {
  return object(approval)
    && typeof approval.id === 'string'
    && approval.status === 'approved'
    && approval.contractId === contract.contractId
    && approval.sourceFingerprint === contract.sourceFingerprint;
}

function deriveRequiredGates(contract) {
  return selectRequiredGates(contract, {
    touchesUi: contract.designConstraints.length > 0
      || contract.authoritativeSources.some((source) => source.kind === 'design-authority' || /(^|\/)design\.md$/i.test(source.path)),
    securitySensitive: contract.securityConstraints.length > 0 || contract.risk.level >= 3,
    architectureSensitive: contract.risk.level >= 3 || contract.requiredReviewers.includes('architecture-reviewer'),
  });
}

export function decideAcceptance({
  contract,
  verification,
  reviews = [],
  controlManifests = [],
  approvals = [],
  architectureDrift = null,
  rootDir = process.cwd(),
  createdAt = new Date().toISOString(),
} = {}) {
  validateDevelopmentContract(contract);
  const blockers = [];
  const pending = [];
  const requiredGates = deriveRequiredGates(contract);

  const staleness = checkContractStaleness(contract, rootDir);
  if (staleness.stale) blockers.push({ code: 'STALE_CONTRACT', detail: staleness.changes });

  if (!verification) {
    pending.push({ code: 'MISSING_VERIFICATION' });
  } else {
    validateVerificationRecord(verification);
    if (verification.contractId !== contract.contractId) blockers.push({ code: 'VERIFICATION_CONTRACT_MISMATCH' });
    if (verification.sourceFingerprint !== contract.sourceFingerprint) blockers.push({ code: 'VERIFICATION_SOURCE_MISMATCH' });
    if (verification.verdict === 'FAIL') blockers.push({ code: 'VERIFICATION_FAILED' });
    if (verification.verdict === 'INCOMPLETE') pending.push({ code: 'VERIFICATION_INCOMPLETE' });
  }

  if (!Array.isArray(reviews)) throw new AcceptanceEngineError('reviews must be an array');
  const reviewByRole = new Map();
  for (const review of reviews) {
    validateReviewResult(review);
    if (review.contractId !== contract.contractId || review.sourceFingerprint !== contract.sourceFingerprint) {
      blockers.push({ code: 'REVIEW_CONTEXT_MISMATCH', role: review.role });
      continue;
    }
    if (reviewByRole.has(review.role)) throw new AcceptanceEngineError(`Duplicate review role result: ${review.role}`);
    reviewByRole.set(review.role, review);
    if (review.verdict === 'FAIL') blockers.push({ code: 'REVIEW_FAILED', role: review.role });
    if (review.verdict === 'INCOMPLETE') pending.push({ code: 'REVIEW_INCOMPLETE', role: review.role });
  }
  for (const role of requiredGates.reviewers) {
    if (!reviewByRole.has(role)) pending.push({ code: 'MISSING_REQUIRED_REVIEW', role });
  }

  if (!Array.isArray(controlManifests)) throw new AcceptanceEngineError('controlManifests must be an array');
  const controlsByDomain = new Map();
  for (const manifest of controlManifests) {
    validateControlManifest(manifest);
    if (manifest.contractId !== contract.contractId) blockers.push({ code: 'CONTROL_CONTRACT_MISMATCH', domain: manifest.domain });
    if (controlsByDomain.has(manifest.domain)) throw new AcceptanceEngineError(`Duplicate control manifest domain: ${manifest.domain}`);
    controlsByDomain.set(manifest.domain, manifest);
    if (manifest.verdict === 'FAIL') blockers.push({ code: 'CONTROL_FAILED', domain: manifest.domain });
    if (manifest.verdict === 'INCOMPLETE') pending.push({ code: 'CONTROL_INCOMPLETE', domain: manifest.domain });
  }
  for (const domain of requiredGates.controlDomains) {
    if (!controlsByDomain.has(domain)) pending.push({ code: 'MISSING_CONTROL_DOMAIN', domain });
  }

  if (architectureDrift) {
    validateArchitectureDrift(architectureDrift);
    if (architectureDrift.verdict !== 'PASS') blockers.push({ code: 'ARCHITECTURE_DRIFT_BLOCKED', findings: architectureDrift.findings });
  } else if (requiredGates.reviewers.includes('architecture-reviewer')) {
    pending.push({ code: 'MISSING_ARCHITECTURE_DRIFT_REVIEW' });
  }

  if (!Array.isArray(approvals)) throw new AcceptanceEngineError('approvals must be an array');
  const validApprovals = new Set(approvals.filter((approval) => validApproval(approval, contract)).map((approval) => approval.id));
  for (const approvalId of requiredGates.humanApprovals) {
    if (!validApprovals.has(approvalId)) pending.push({ code: 'MISSING_REQUIRED_APPROVAL', approvalId });
  }

  const state = blockers.length > 0 ? 'BLOCKED' : pending.length > 0 ? 'PENDING' : 'ACCEPTED';
  const record = {
    schemaVersion: '1.0.0',
    contractId: contract.contractId,
    taskId: contract.taskId,
    sourceFingerprint: contract.sourceFingerprint,
    createdAt,
    state,
    verificationVerdict: verification?.verdict ?? null,
    requiredGates,
    requiredReviewers: [...requiredGates.reviewers],
    completedReviewers: [...reviewByRole.entries()].filter(([, review]) => review.verdict === 'PASS').map(([role]) => role).sort(),
    blockers,
    pending,
  };
  validateAcceptanceRecord(record);
  return record;
}

export function validateAcceptanceRecord(record) {
  if (!object(record)) throw new AcceptanceEngineError('acceptance record is required');
  if (!ACCEPTANCE_STATES.includes(record.state)) throw new AcceptanceEngineError(`Unsupported acceptance state: ${record.state}`);
  if (!Array.isArray(record.blockers) || !Array.isArray(record.pending)) throw new AcceptanceEngineError('Acceptance record requires blocker and pending arrays');
  if (!object(record.requiredGates)
      || !Array.isArray(record.requiredGates.reviewers)
      || !Array.isArray(record.requiredGates.controlDomains)
      || !Array.isArray(record.requiredGates.humanApprovals)) {
    throw new AcceptanceEngineError('Acceptance record requires derived gate metadata');
  }
  const expected = record.blockers.length > 0 ? 'BLOCKED' : record.pending.length > 0 ? 'PENDING' : 'ACCEPTED';
  if (record.state !== expected) throw new AcceptanceEngineError(`Acceptance state must equal computed state ${expected}`);
  if (record.state === 'ACCEPTED' && (record.blockers.length || record.pending.length)) throw new AcceptanceEngineError('Accepted record may not contain unresolved gates');
  return true;
}

export { ACCEPTANCE_STATES };
