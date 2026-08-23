import fs from 'node:fs';
import path from 'node:path';

const CRITERION_STATUSES = Object.freeze([
  'PASS',
  'FAIL',
  'PARTIAL',
  'UNVERIFIED',
  'NOT_APPLICABLE',
]);

const VERDICTS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  INCOMPLETE: 'INCOMPLETE',
});

const EVIDENCE_TYPES = Object.freeze([
  'source',
  'diff',
  'test',
  'command',
  'runtime',
  'browser',
  'visual',
  'schema',
  'migration',
  'configuration',
  'manual',
]);

const VERIFIER_ROLES = new Set([
  'spec-verifier',
  'spec-reviewer',
  'code-reviewer',
  'security-reviewer',
  'accessibility-reviewer',
  'design-reviewer',
  'simplicity-reviewer',
  'architecture-reviewer',
  'test-engineer',
]);

export class EvidenceValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'EvidenceValidationError';
    this.details = details;
  }
}

export class EvidencePersistenceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EvidencePersistenceError';
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new EvidenceValidationError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function identifier(value, label) {
  const normalized = nonEmptyString(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized)) {
    throw new EvidenceValidationError(`${label} contains unsupported characters: ${normalized}`);
  }
  return normalized;
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableSort(value[key])]));
}

function stableStringify(value) {
  return JSON.stringify(stableSort(value), null, 2);
}

function normalizeEvidenceItem(item) {
  if (!isPlainObject(item)) throw new EvidenceValidationError('Evidence entries must be objects');
  const type = nonEmptyString(item.type, 'evidence.type');
  if (!EVIDENCE_TYPES.includes(type)) throw new EvidenceValidationError(`Unsupported evidence type: ${type}`);

  const normalized = { type };
  for (const [key, value] of Object.entries(item)) {
    if (key === 'type') continue;
    if (value === undefined) continue;
    if (typeof value === 'function' || typeof value === 'symbol') {
      throw new EvidenceValidationError(`Evidence property ${key} is not serializable`);
    }
    normalized[key] = structuredClone(value);
  }
  return normalized;
}

function normalizeEvidenceList(value = []) {
  if (!Array.isArray(value)) throw new EvidenceValidationError('evidence must be an array');
  return value.map(normalizeEvidenceItem);
}

function normalizeExpectedControls(expectedControls) {
  if (!Array.isArray(expectedControls) || expectedControls.length === 0) {
    throw new EvidenceValidationError('expectedControls must contain at least one control');
  }

  const seen = new Set();
  return expectedControls.map((control) => {
    if (!isPlainObject(control)) throw new EvidenceValidationError('Expected controls must be objects');
    const id = identifier(control.id, 'control.id');
    if (seen.has(id)) throw new EvidenceValidationError(`Duplicate expected control id: ${id}`);
    seen.add(id);
    return {
      id,
      statement: nonEmptyString(control.statement, `control ${id} statement`),
      required: control.required !== false,
      requiredEvidence: control.requiredEvidence !== false,
    };
  });
}

function normalizeControlResults(results = []) {
  if (!Array.isArray(results)) throw new EvidenceValidationError('control results must be an array');
  const map = new Map();
  for (const result of results) {
    if (!isPlainObject(result)) throw new EvidenceValidationError('Control results must be objects');
    const id = identifier(result.id, 'control result id');
    if (map.has(id)) throw new EvidenceValidationError(`Duplicate control result id: ${id}`);
    const status = nonEmptyString(result.status, `control ${id} status`).toUpperCase();
    if (!CRITERION_STATUSES.includes(status)) throw new EvidenceValidationError(`Unsupported control status for ${id}: ${status}`);
    map.set(id, {
      id,
      status,
      evidence: normalizeEvidenceList(result.evidence ?? []),
      reason: result.reason === undefined || result.reason === null ? null : nonEmptyString(result.reason, `control ${id} reason`),
    });
  }
  return map;
}

function criterionVerdict(entries, { requiredKey = 'required' } = {}) {
  const requiredEntries = entries.filter((entry) => entry[requiredKey] !== false);
  if (requiredEntries.some((entry) => entry.status === 'FAIL')) return VERDICTS.FAIL;
  if (requiredEntries.some((entry) => ['PARTIAL', 'UNVERIFIED'].includes(entry.status))) return VERDICTS.INCOMPLETE;
  return VERDICTS.PASS;
}

export function evaluateControlCoverage({
  contractId,
  runId,
  domain,
  expectedControls,
  results = [],
} = {}) {
  const normalizedContractId = identifier(contractId, 'contractId');
  const normalizedRunId = identifier(runId, 'runId');
  const normalizedDomain = identifier(domain, 'domain');
  const expected = normalizeExpectedControls(expectedControls);
  const resultMap = normalizeControlResults(results);
  const expectedIds = new Set(expected.map((control) => control.id));

  for (const resultId of resultMap.keys()) {
    if (!expectedIds.has(resultId)) throw new EvidenceValidationError(`Control result is not part of the expected control set: ${resultId}`);
  }

  const controls = expected.map((control) => {
    const observed = resultMap.get(control.id);
    if (!observed) {
      return {
        ...control,
        status: 'UNVERIFIED',
        evidence: [],
        reason: 'No verification result was provided',
      };
    }

    if (observed.status === 'PASS' && control.requiredEvidence && observed.evidence.length === 0) {
      throw new EvidenceValidationError(`PASS control ${control.id} requires evidence`);
    }
    if (observed.status === 'NOT_APPLICABLE' && !observed.reason) {
      throw new EvidenceValidationError(`NOT_APPLICABLE control ${control.id} requires a reason`);
    }

    return { ...control, ...observed };
  });

  const requiredControls = controls.filter((control) => control.required);
  const verifiedRequired = requiredControls.filter((control) => ['PASS', 'NOT_APPLICABLE'].includes(control.status));
  const verdict = criterionVerdict(controls);

  return {
    schemaVersion: '1.0.0',
    contractId: normalizedContractId,
    runId: normalizedRunId,
    domain: normalizedDomain,
    controls,
    coverage: {
      expectedRequired: requiredControls.length,
      verifiedRequired: verifiedRequired.length,
      percent: requiredControls.length === 0 ? 100 : Math.round((verifiedRequired.length / requiredControls.length) * 10000) / 100,
    },
    verdict,
  };
}

function normalizeVerificationCriteria(contract, criteria = []) {
  if (!Array.isArray(contract?.acceptanceCriteria) || contract.acceptanceCriteria.length === 0) {
    throw new EvidenceValidationError('Contract must contain acceptance criteria');
  }
  if (!Array.isArray(criteria)) throw new EvidenceValidationError('Verification criteria must be an array');

  const expected = new Map();
  for (const criterion of contract.acceptanceCriteria) {
    if (!isPlainObject(criterion)) throw new EvidenceValidationError('Contract acceptance criteria must be objects');
    const id = identifier(criterion.id, 'acceptance criterion id');
    if (expected.has(id)) throw new EvidenceValidationError(`Duplicate contract acceptance criterion id: ${id}`);
    expected.set(id, {
      id,
      statement: nonEmptyString(criterion.statement, `criterion ${id} statement`),
      requiredEvidence: criterion.requiredEvidence !== false,
    });
  }

  const observed = new Map();
  for (const criterion of criteria) {
    if (!isPlainObject(criterion)) throw new EvidenceValidationError('Verification criteria entries must be objects');
    const id = identifier(criterion.id, 'verification criterion id');
    if (!expected.has(id)) throw new EvidenceValidationError(`Verification criterion is not in the Development Contract: ${id}`);
    if (observed.has(id)) throw new EvidenceValidationError(`Duplicate verification criterion id: ${id}`);
    const status = nonEmptyString(criterion.status, `criterion ${id} status`).toUpperCase();
    if (!CRITERION_STATUSES.includes(status)) throw new EvidenceValidationError(`Unsupported criterion status for ${id}: ${status}`);
    const evidence = normalizeEvidenceList(criterion.evidence ?? []);
    const reason = criterion.reason === undefined || criterion.reason === null ? null : nonEmptyString(criterion.reason, `criterion ${id} reason`);
    const expectedCriterion = expected.get(id);

    if (status === 'PASS' && expectedCriterion.requiredEvidence && evidence.length === 0) {
      throw new EvidenceValidationError(`PASS criterion ${id} requires evidence`);
    }
    if (status === 'NOT_APPLICABLE' && !reason) {
      throw new EvidenceValidationError(`NOT_APPLICABLE criterion ${id} requires a reason`);
    }

    observed.set(id, { ...expectedCriterion, status, evidence, reason });
  }

  return [...expected.values()].map((criterion) => observed.get(criterion.id) ?? {
    ...criterion,
    status: 'UNVERIFIED',
    evidence: [],
    reason: 'No independent verification result was provided',
  });
}

export function createVerificationRecord({
  contract,
  runId,
  role,
  contextIsolation = 'fresh',
  sourceFingerprint,
  criteria = [],
  createdAt = new Date().toISOString(),
} = {}) {
  if (!isPlainObject(contract)) throw new EvidenceValidationError('contract is required');
  const contractId = identifier(contract.contractId, 'contract.contractId');
  const normalizedRunId = identifier(runId, 'runId');
  const normalizedRole = identifier(role, 'role');
  if (!VERIFIER_ROLES.has(normalizedRole)) {
    throw new EvidenceValidationError(`Role may not produce an authoritative verification record: ${normalizedRole}`);
  }
  if (!['fresh', 'rehydrated'].includes(contextIsolation)) {
    throw new EvidenceValidationError('Verification context must be fresh or rehydrated');
  }
  if (sourceFingerprint !== contract.sourceFingerprint) {
    throw new EvidenceValidationError('Verification source fingerprint does not match the Development Contract');
  }
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new EvidenceValidationError('createdAt must be a valid timestamp');
  }

  const normalizedCriteria = normalizeVerificationCriteria(contract, criteria);
  const verdict = criterionVerdict(normalizedCriteria, { requiredKey: 'requiredEvidence' });

  return {
    schemaVersion: '1.0.0',
    contractId,
    runId: normalizedRunId,
    role: normalizedRole,
    contextIsolation,
    sourceFingerprint,
    createdAt,
    criteria: normalizedCriteria,
    verdict,
  };
}

export function getRunDirectory(rootDir, contractId, runId) {
  return path.join(
    rootDir,
    '.development-kit',
    'runs',
    identifier(contractId, 'contractId'),
    identifier(runId, 'runId'),
  );
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function persistImmutableJson(filePath, value) {
  const content = `${stableStringify(value)}\n`;
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return { created: false, path: filePath };
    throw new EvidencePersistenceError(`Refusing to overwrite existing evidence record: ${filePath}`);
  }
  atomicWrite(filePath, content);
  return { created: true, path: filePath };
}

export function persistVerificationRecord(record, rootDir = process.cwd()) {
  if (!isPlainObject(record)) throw new EvidenceValidationError('verification record is required');
  const runDir = getRunDirectory(rootDir, record.contractId, record.runId);
  return persistImmutableJson(path.join(runDir, 'verification.json'), record);
}

export function persistControlManifest(manifest, rootDir = process.cwd()) {
  if (!isPlainObject(manifest)) throw new EvidenceValidationError('control manifest is required');
  const runDir = getRunDirectory(rootDir, manifest.contractId, manifest.runId);
  const domain = identifier(manifest.domain, 'domain');
  return persistImmutableJson(path.join(runDir, `control-${domain}.json`), manifest);
}

export { CRITERION_STATUSES, EVIDENCE_TYPES, VERDICTS };
