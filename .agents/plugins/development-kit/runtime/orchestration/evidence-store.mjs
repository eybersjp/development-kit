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
  'assertion',
  'external',
]);

export const TRUST_LEVELS = Object.freeze({
  E0: 'E0', // Agent prose assertion (non-authoritative)
  E1: 'E1', // Agent-supplied artifact (unverified file/screenshot)
  E2: 'E2', // DK-captured execution evidence
  E3: 'E3', // Independent deterministic verification
  E4: 'E4', // Authoritative external platform evidence
});

const TRUST_RANK = Object.freeze({
  E0: 0,
  E1: 1,
  E2: 2,
  E3: 3,
  E4: 4,
});

export function compareTrustLevel(actual, required) {
  const actualRank = TRUST_RANK[actual] ?? -1;
  const requiredRank = TRUST_RANK[required] ?? 0;
  return actualRank >= requiredRank;
}

export function inferTrustLevel(item) {
  if (!item || typeof item !== 'object') return TRUST_LEVELS.E0;
  if (item.type === 'assertion') return TRUST_LEVELS.E0;
  if (item.type === 'external' && item.authoritativeExternalState) return TRUST_LEVELS.E4;
  if (item.type === 'test' && item.deterministicVerification) return TRUST_LEVELS.E3;
  if (['test', 'command', 'runtime', 'browser'].includes(item.type)) {
    return TRUST_LEVELS.E2;
  }
  if (['source', 'diff', 'visual', 'manual', 'schema', 'migration', 'configuration'].includes(item.type)) {
    return TRUST_LEVELS.E1;
  }
  return TRUST_LEVELS.E0;
}

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

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

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

  const inferred = inferTrustLevel(item);
  let trustLevel = inferred;
  if (item.trustLevel !== undefined) {
    const declared = nonEmptyString(item.trustLevel, 'evidence.trustLevel').toUpperCase();
    if (!Object.values(TRUST_LEVELS).includes(declared)) {
      throw new EvidenceValidationError(`Unsupported evidence trust level: ${declared}`);
    }
    // Prevent unproven upgrading of trust level
    if (TRUST_RANK[declared] > TRUST_RANK[inferred]) {
      throw new EvidenceValidationError(`Declared evidence trust level ${declared} exceeds proven level ${inferred}`);
    }
    trustLevel = declared;
  }

  const normalized = { type, trustLevel };
  for (const [key, value] of Object.entries(item)) {
    if (key === 'type' || key === 'trustLevel' || value === undefined) continue;
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

function normalizeVerificationType(value, label = 'verification type') {
  return nonEmptyString(value, label).toLowerCase().replace(/[\s_]+/g, '-');
}

function normalizeVerificationTypeList(value = []) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new EvidenceValidationError('verificationType must be an array');
  return [...new Set(value.map((item) => normalizeVerificationType(item)))];
}

function evidenceMatchesVerificationType(requirement, evidence) {
  const normalized = normalizeVerificationType(requirement);
  if (evidence.some((item) => typeof item.verificationType === 'string'
    && normalizeVerificationType(item.verificationType) === normalized)) return true;

  const typeAliases = new Map([
    ['test', 'test'],
    ['tests', 'test'],
    ['unit', 'test'],
    ['unit-test', 'test'],
    ['unit-tests', 'test'],
    ['integration', 'test'],
    ['integration-test', 'test'],
    ['integration-tests', 'test'],
    ['regression', 'test'],
    ['regression-test', 'test'],
    ['regression-tests', 'test'],
    ['browser', 'browser'],
    ['runtime', 'runtime'],
    ['visual', 'visual'],
    ['schema', 'schema'],
    ['migration', 'migration'],
    ['configuration', 'configuration'],
    ['config', 'configuration'],
    ['manual', 'manual'],
    ['command', 'command'],
  ]);

  const expectedEvidenceType = typeAliases.get(normalized);
  return Boolean(expectedEvidenceType) && evidence.some((item) => item.type === expectedEvidenceType);
}

function validateVerificationTypeEvidence(entry, label) {
  if (entry.status !== 'PASS' || entry.requiredEvidence === false) return;
  for (const verificationType of entry.verificationType ?? []) {
    if (!evidenceMatchesVerificationType(verificationType, entry.evidence)) {
      throw new EvidenceValidationError(`PASS ${label} requires ${verificationType} verification evidence`);
    }
  }
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

function computeVerdict(entries, { optionalKey = null } = {}) {
  const relevant = optionalKey ? entries.filter((entry) => entry[optionalKey] !== false) : entries;
  if (relevant.some((entry) => entry.status === 'FAIL')) return VERDICTS.FAIL;
  if (relevant.some((entry) => ['PARTIAL', 'UNVERIFIED'].includes(entry.status))) return VERDICTS.INCOMPLETE;
  return VERDICTS.PASS;
}

function validateEvidenceBearingStatus(entry, label) {
  if (entry.status === 'PASS' && entry.requiredEvidence !== false) {
    if (entry.evidence.length === 0) {
      throw new EvidenceValidationError(`PASS ${label} requires evidence`);
    }
    const hasAuthoritativeEvidence = entry.evidence.some((ev) => ['E2', 'E3', 'E4'].includes(ev.trustLevel) || ['test', 'command', 'runtime', 'browser'].includes(ev.type));
    const allAssertions = entry.evidence.every((ev) => ev.trustLevel === 'E0' || ev.type === 'assertion');
    if (allAssertions || (!hasAuthoritativeEvidence && entry.minTrustLevel && ['E2', 'E3', 'E4'].includes(entry.minTrustLevel))) {
      throw new EvidenceValidationError(`PASS ${label} cannot be satisfied by E0 agent assertions alone`);
    }
  }
  if (entry.status === 'NOT_APPLICABLE' && !entry.reason) {
    throw new EvidenceValidationError(`NOT_APPLICABLE ${label} requires a reason`);
  }
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

    const normalized = { ...control, ...observed };
    validateEvidenceBearingStatus(normalized, `control ${control.id}`);
    return normalized;
  });

  const requiredControls = controls.filter((control) => control.required);
  const verifiedRequired = requiredControls.filter((control) => ['PASS', 'NOT_APPLICABLE'].includes(control.status));
  const manifest = {
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
    verdict: computeVerdict(controls, { optionalKey: 'required' }),
  };

  validateControlManifest(manifest);
  return manifest;
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
      verificationType: normalizeVerificationTypeList(criterion.verificationType),
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
    const normalized = { ...expected.get(id), status, evidence, reason };
    validateEvidenceBearingStatus(normalized, `criterion ${id}`);
    validateVerificationTypeEvidence(normalized, `criterion ${id}`);
    observed.set(id, normalized);
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
  if (typeof sourceFingerprint !== 'string' || !SHA256_PATTERN.test(sourceFingerprint)) {
    throw new EvidenceValidationError('sourceFingerprint must be a sha256 fingerprint');
  }
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new EvidenceValidationError('createdAt must be a valid timestamp');
  }

  const normalizedCriteria = normalizeVerificationCriteria(contract, criteria);
  const record = {
    schemaVersion: '1.0.0',
    contractId,
    runId: normalizedRunId,
    role: normalizedRole,
    contextIsolation,
    sourceFingerprint,
    createdAt,
    criteria: normalizedCriteria,
    verdict: computeVerdict(normalizedCriteria),
  };

  validateVerificationRecord(record);
  return record;
}

export function validateVerificationRecord(record) {
  if (!isPlainObject(record)) throw new EvidenceValidationError('verification record is required');
  identifier(record.contractId, 'verification.contractId');
  identifier(record.runId, 'verification.runId');
  const role = identifier(record.role, 'verification.role');
  if (!VERIFIER_ROLES.has(role)) throw new EvidenceValidationError(`Role may not produce an authoritative verification record: ${role}`);
  if (!['fresh', 'rehydrated'].includes(record.contextIsolation)) throw new EvidenceValidationError('Verification context must be fresh or rehydrated');
  if (typeof record.sourceFingerprint !== 'string' || !SHA256_PATTERN.test(record.sourceFingerprint)) throw new EvidenceValidationError('verification sourceFingerprint is invalid');
  if (typeof record.createdAt !== 'string' || Number.isNaN(Date.parse(record.createdAt))) throw new EvidenceValidationError('verification createdAt is invalid');
  if (!Array.isArray(record.criteria) || record.criteria.length === 0) throw new EvidenceValidationError('verification criteria must not be empty');

  const ids = new Set();
  for (const criterion of record.criteria) {
    if (!isPlainObject(criterion)) throw new EvidenceValidationError('verification criteria entries must be objects');
    const id = identifier(criterion.id, 'verification criterion id');
    if (ids.has(id)) throw new EvidenceValidationError(`Duplicate verification criterion id: ${id}`);
    ids.add(id);
    nonEmptyString(criterion.statement, `criterion ${id} statement`);
    if (!CRITERION_STATUSES.includes(criterion.status)) throw new EvidenceValidationError(`Unsupported criterion status for ${id}: ${criterion.status}`);
    const normalized = {
      ...criterion,
      verificationType: normalizeVerificationTypeList(criterion.verificationType),
      evidence: normalizeEvidenceList(criterion.evidence ?? []),
      reason: criterion.reason ?? null,
      requiredEvidence: criterion.requiredEvidence !== false,
    };
    validateEvidenceBearingStatus(normalized, `criterion ${id}`);
    validateVerificationTypeEvidence(normalized, `criterion ${id}`);
  }

  const expectedVerdict = computeVerdict(record.criteria);
  if (record.verdict !== expectedVerdict) {
    throw new EvidenceValidationError(`Verification verdict ${record.verdict} does not match computed verdict ${expectedVerdict}`);
  }
  return true;
}

export function validateControlManifest(manifest) {
  if (!isPlainObject(manifest)) throw new EvidenceValidationError('control manifest is required');
  identifier(manifest.contractId, 'control manifest contractId');
  identifier(manifest.runId, 'control manifest runId');
  identifier(manifest.domain, 'control manifest domain');
  if (!Array.isArray(manifest.controls) || manifest.controls.length === 0) throw new EvidenceValidationError('control manifest controls must not be empty');

  const ids = new Set();
  for (const control of manifest.controls) {
    if (!isPlainObject(control)) throw new EvidenceValidationError('control manifest entries must be objects');
    const id = identifier(control.id, 'control id');
    if (ids.has(id)) throw new EvidenceValidationError(`Duplicate control id: ${id}`);
    ids.add(id);
    nonEmptyString(control.statement, `control ${id} statement`);
    if (typeof control.required !== 'boolean') throw new EvidenceValidationError(`control ${id} required must be boolean`);
    if (typeof control.requiredEvidence !== 'boolean') throw new EvidenceValidationError(`control ${id} requiredEvidence must be boolean`);
    if (!CRITERION_STATUSES.includes(control.status)) throw new EvidenceValidationError(`Unsupported control status for ${id}: ${control.status}`);
    const normalized = {
      ...control,
      evidence: normalizeEvidenceList(control.evidence ?? []),
      reason: control.reason ?? null,
    };
    validateEvidenceBearingStatus(normalized, `control ${id}`);
  }

  const requiredControls = manifest.controls.filter((control) => control.required);
  const verifiedRequired = requiredControls.filter((control) => ['PASS', 'NOT_APPLICABLE'].includes(control.status));
  const expectedCoverage = {
    expectedRequired: requiredControls.length,
    verifiedRequired: verifiedRequired.length,
    percent: requiredControls.length === 0 ? 100 : Math.round((verifiedRequired.length / requiredControls.length) * 10000) / 100,
  };
  if (!isPlainObject(manifest.coverage)
    || manifest.coverage.expectedRequired !== expectedCoverage.expectedRequired
    || manifest.coverage.verifiedRequired !== expectedCoverage.verifiedRequired
    || manifest.coverage.percent !== expectedCoverage.percent) {
    throw new EvidenceValidationError('Control coverage summary does not match control statuses');
  }

  const expectedVerdict = computeVerdict(manifest.controls, { optionalKey: 'required' });
  if (manifest.verdict !== expectedVerdict) {
    throw new EvidenceValidationError(`Control manifest verdict ${manifest.verdict} does not match computed verdict ${expectedVerdict}`);
  }
  return true;
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
  validateVerificationRecord(record);
  const runDir = getRunDirectory(rootDir, record.contractId, record.runId);
  return persistImmutableJson(path.join(runDir, 'verification.json'), record);
}

export function persistControlManifest(manifest, rootDir = process.cwd()) {
  validateControlManifest(manifest);
  const runDir = getRunDirectory(rootDir, manifest.contractId, manifest.runId);
  const domain = identifier(manifest.domain, 'domain');
  return persistImmutableJson(path.join(runDir, `control-${domain}.json`), manifest);
}

export { CRITERION_STATUSES, EVIDENCE_TYPES, VERDICTS };
