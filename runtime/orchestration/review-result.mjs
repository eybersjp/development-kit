import { validateDevelopmentContract } from './development-contract.mjs';

const REVIEW_VERDICTS = Object.freeze(['PASS', 'FAIL', 'INCOMPLETE']);
const FINDING_SEVERITIES = Object.freeze(['INFO', 'WARNING', 'MAJOR', 'CRITICAL']);
const FINDING_DISPOSITIONS = Object.freeze(['OPEN', 'RESOLVED', 'ACCEPTED_RISK', 'NOT_APPLICABLE']);
const REVIEW_ROLES = new Set([
  'code-reviewer',
  'security-reviewer',
  'accessibility-reviewer',
  'design-reviewer',
  'simplicity-reviewer',
  'architecture-reviewer',
]);

export class ReviewResultError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReviewResultError';
  }
}

function object(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new ReviewResultError(`${label} must be a non-empty string`);
  return value.trim();
}

function normalizeEvidence(value = []) {
  if (!Array.isArray(value)) throw new ReviewResultError('finding evidence must be an array');
  return value.map((item) => {
    if (!object(item) || typeof item.type !== 'string' || !item.type.trim()) {
      throw new ReviewResultError('finding evidence entries require a type');
    }
    return structuredClone(item);
  });
}

function computedVerdict(findings) {
  const open = findings.filter((finding) => finding.disposition === 'OPEN');
  if (open.some((finding) => ['CRITICAL', 'MAJOR'].includes(finding.severity))) return 'FAIL';
  if (open.length > 0) return 'INCOMPLETE';
  return 'PASS';
}

export function createReviewResult({
  contract,
  runId,
  role,
  sourceFingerprint,
  contextIsolation = 'rehydrated',
  findings = [],
  createdAt = new Date().toISOString(),
} = {}) {
  validateDevelopmentContract(contract);
  const normalizedRole = text(role, 'role');
  if (!REVIEW_ROLES.has(normalizedRole)) throw new ReviewResultError(`Unsupported review role: ${normalizedRole}`);
  if (sourceFingerprint !== contract.sourceFingerprint) throw new ReviewResultError('Review source fingerprint does not match Development Contract');
  if (!['fresh', 'rehydrated'].includes(contextIsolation)) throw new ReviewResultError('Review context must be fresh or rehydrated');
  if (!Array.isArray(findings)) throw new ReviewResultError('findings must be an array');

  const ids = new Set();
  const normalizedFindings = findings.map((finding, index) => {
    if (!object(finding)) throw new ReviewResultError('findings must contain objects');
    const id = text(finding.id ?? `F-${String(index + 1).padStart(3, '0')}`, 'finding id');
    if (ids.has(id)) throw new ReviewResultError(`Duplicate finding id: ${id}`);
    ids.add(id);
    const severity = text(finding.severity, `finding ${id} severity`).toUpperCase();
    const disposition = text(finding.disposition ?? 'OPEN', `finding ${id} disposition`).toUpperCase();
    if (!FINDING_SEVERITIES.includes(severity)) throw new ReviewResultError(`Unsupported finding severity: ${severity}`);
    if (!FINDING_DISPOSITIONS.includes(disposition)) throw new ReviewResultError(`Unsupported finding disposition: ${disposition}`);
    const evidence = normalizeEvidence(finding.evidence ?? []);
    if (['MAJOR', 'CRITICAL'].includes(severity) && evidence.length === 0) {
      throw new ReviewResultError(`${severity} finding ${id} requires evidence`);
    }
    if (disposition === 'ACCEPTED_RISK' && !finding.approvalId) {
      throw new ReviewResultError(`Accepted-risk finding ${id} requires approvalId`);
    }
    return {
      id,
      title: text(finding.title, `finding ${id} title`),
      severity,
      disposition,
      evidence,
      approvalId: finding.approvalId ?? null,
      criterionIds: Array.isArray(finding.criterionIds) ? [...new Set(finding.criterionIds.map((value) => text(value, `finding ${id} criterion id`)))] : [],
    };
  });

  const result = {
    schemaVersion: '1.0.0',
    contractId: contract.contractId,
    runId: text(runId, 'runId'),
    role: normalizedRole,
    sourceFingerprint,
    contextIsolation,
    createdAt,
    findings: normalizedFindings,
    verdict: computedVerdict(normalizedFindings),
  };
  validateReviewResult(result);
  return result;
}

export function validateReviewResult(result) {
  if (!object(result)) throw new ReviewResultError('review result is required');
  text(result.contractId, 'review contractId');
  text(result.runId, 'review runId');
  if (!REVIEW_ROLES.has(result.role)) throw new ReviewResultError(`Unsupported review role: ${result.role}`);
  if (!['fresh', 'rehydrated'].includes(result.contextIsolation)) throw new ReviewResultError('Review context must be fresh or rehydrated');
  if (typeof result.sourceFingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(result.sourceFingerprint)) throw new ReviewResultError('Review source fingerprint is invalid');
  if (!Array.isArray(result.findings)) throw new ReviewResultError('Review findings must be an array');
  const expected = computedVerdict(result.findings);
  if (!REVIEW_VERDICTS.includes(result.verdict) || result.verdict !== expected) {
    throw new ReviewResultError(`Review verdict must equal computed verdict ${expected}`);
  }
  return true;
}

export { FINDING_DISPOSITIONS, FINDING_SEVERITIES, REVIEW_ROLES, REVIEW_VERDICTS };
