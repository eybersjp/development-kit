import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DEVELOPMENT_CONTRACT_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_CORRECTION_ATTEMPTS = 3;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CONTRACT_KEYS = new Set([
  'schemaVersion',
  'contractId',
  'projectId',
  'taskId',
  'createdAt',
  'status',
  'objective',
  'scope',
  'authoritativeSources',
  'requirements',
  'acceptanceCriteria',
  'architectureConstraints',
  'designConstraints',
  'securityConstraints',
  'executionSafety',
  'risk',
  'requiredVerification',
  'requiredReviewers',
  'correctionPolicy',
  'approvalPolicy',
  'sourceFingerprint',
]);

export class ContractValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ContractValidationError';
    this.details = details;
  }
}

export class ContractPersistenceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContractPersistenceError';
  }
}

export class StaleContractError extends Error {
  constructor(message, staleness) {
    super(message);
    this.name = 'StaleContractError';
    this.staleness = staleness;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortObject(value[key])]),
  );
}

export function canonicalJson(value) {
  return JSON.stringify(sortObject(value));
}

export function stableStringify(value) {
  return JSON.stringify(sortObject(value), null, 2);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isPortableAbsolutePath(value) {
  return path.isAbsolute(value) || /^[A-Za-z]:\//.test(value) || value.startsWith('//');
}

function normalizeRelativePath(sourcePath) {
  if (typeof sourcePath !== 'string' || sourcePath.trim() === '') {
    throw new ContractValidationError('Authoritative source path must be a non-empty string');
  }

  const normalized = sourcePath.trim().replaceAll('\\', '/');
  if (isPortableAbsolutePath(normalized)) {
    throw new ContractValidationError(`Authoritative source path must be project-relative: ${sourcePath}`);
  }

  const segments = normalized.split('/');
  if (segments.includes('..')) {
    throw new ContractValidationError(`Authoritative source path may not traverse outside its project: ${sourcePath}`);
  }

  return normalized;
}

function resolveWithinRoot(rootDir, sourcePath) {
  const normalized = normalizeRelativePath(sourcePath);
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, normalized);
  const relative = path.relative(root, resolved);

  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ContractValidationError(`Authoritative source escapes project root: ${sourcePath}`);
  }

  return { normalized, resolved };
}

function normalizeStringArray(value = []) {
  if (!Array.isArray(value)) {
    throw new ContractValidationError('Expected an array of strings');
  }

  return [...new Set(value.map((item) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new ContractValidationError('Array entries must be non-empty strings');
    }
    return item.trim();
  }))];
}

function normalizeConstraintArray(value = []) {
  if (!Array.isArray(value)) {
    throw new ContractValidationError('Constraint collections must be arrays');
  }

  return value.map((item) => {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) throw new ContractValidationError('Constraint strings may not be empty');
      return trimmed;
    }
    if (!isPlainObject(item)) {
      throw new ContractValidationError('Constraint entries must be strings or plain objects');
    }
    return structuredClone(item);
  });
}

function normalizeIdentifier(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContractValidationError(`${label} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw new ContractValidationError(`${label} contains unsupported characters: ${normalized}`);
  }
  return normalized;
}

function defaultContractId(taskId) {
  return `INC-${normalizeIdentifier(taskId, 'task.id')}`;
}

function assertNoExtraKeys(value, allowedKeys, label, errors) {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(`${label} contains unsupported property: ${key}`);
  }
}

function validateStringArray(value, label, errors, { minItems = 0 } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (value.length < minItems) errors.push(`${label} must contain at least ${minItems} item(s)`);
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`${label} entries must be non-empty strings`);
      continue;
    }
    if (seen.has(item)) errors.push(`${label} contains duplicate entry: ${item}`);
    seen.add(item);
  }
}

function validateConstraintArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  for (const item of value) {
    if (typeof item === 'string') {
      if (!item.trim()) errors.push(`${label} may not contain empty strings`);
    } else if (!isPlainObject(item)) {
      errors.push(`${label} entries must be strings or plain objects`);
    }
  }
}

export function computeFileFingerprint(rootDir, sourcePath) {
  const { normalized, resolved } = resolveWithinRoot(rootDir, sourcePath);
  if (!fs.existsSync(resolved)) {
    throw new ContractValidationError(`Authoritative source does not exist: ${normalized}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new ContractValidationError(`Authoritative source must be a file: ${normalized}`);
  }
  return `sha256:${sha256(fs.readFileSync(resolved))}`;
}

export function resolveAuthoritativeSources(rootDir, authoritativeSources) {
  if (!Array.isArray(authoritativeSources) || authoritativeSources.length === 0) {
    throw new ContractValidationError('At least one authoritative source is required');
  }

  const seen = new Set();
  const resolved = authoritativeSources.map((source) => {
    if (!isPlainObject(source)) {
      throw new ContractValidationError('Authoritative source entries must be objects');
    }

    const sourcePath = normalizeRelativePath(source.path);
    const sections = normalizeStringArray(source.sections ?? []).sort();
    const key = `${sourcePath}\0${sections.join('\0')}`;
    if (seen.has(key)) {
      throw new ContractValidationError(`Duplicate authoritative source reference: ${sourcePath}`);
    }
    seen.add(key);

    const authority = source.authority ?? 'required';
    if (!['required', 'supporting'].includes(authority)) {
      throw new ContractValidationError(`Unsupported source authority: ${authority}`);
    }

    return {
      path: sourcePath,
      kind: typeof source.kind === 'string' && source.kind.trim() ? source.kind.trim() : 'project-source',
      authority,
      sections,
      fingerprint: computeFileFingerprint(rootDir, sourcePath),
    };
  });

  return resolved.sort((a, b) => {
    const left = `${a.path}\0${a.sections.join('\0')}`;
    const right = `${b.path}\0${b.sections.join('\0')}`;
    return left.localeCompare(right);
  });
}

export function computeSourceFingerprint(authoritativeSources) {
  const normalized = authoritativeSources.map((source) => ({
    path: source.path,
    kind: source.kind,
    authority: source.authority,
    sections: source.sections ?? [],
    fingerprint: source.fingerprint,
  }));
  return `sha256:${sha256(canonicalJson(normalized))}`;
}

export function normalizeAcceptanceCriteria(criteria = []) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new ContractValidationError('Approved tasks must define at least one acceptance criterion');
  }

  const ids = new Set();
  return criteria.map((criterion) => {
    const value = typeof criterion === 'string' ? { statement: criterion } : criterion;
    if (!isPlainObject(value)) {
      throw new ContractValidationError('Acceptance criteria must be strings or objects');
    }

    const statement = typeof value.statement === 'string' ? value.statement.trim() : '';
    if (!statement) throw new ContractValidationError('Acceptance criterion statement may not be empty');

    const source = typeof value.source === 'string' && value.source.trim() ? value.source.trim() : null;
    const generatedId = `AC-${sha256(`${statement}\0${source ?? ''}`).slice(0, 12).toUpperCase()}`;
    const id = normalizeIdentifier(value.id ?? generatedId, 'acceptance criterion id');
    if (ids.has(id)) throw new ContractValidationError(`Duplicate acceptance criterion id: ${id}`);
    ids.add(id);

    const verificationType = normalizeStringArray(value.verificationType ?? ['test']);
    if (verificationType.length === 0) {
      throw new ContractValidationError(`Acceptance criterion ${id} requires at least one verification type`);
    }

    return {
      id,
      statement,
      source,
      verificationType,
      requiredEvidence: value.requiredEvidence !== false,
    };
  });
}

function normalizeExecutionSafety(value = {}) {
  if (!isPlainObject(value)) throw new ContractValidationError('executionSafety must be an object');

  const resourceScope = value.resourceScope ?? 'project-only';
  const destructiveOperations = value.destructiveOperations ?? 'explicit-approval';
  const remoteMutation = value.remoteMutation ?? 'explicit-contract';

  if (!['project-only', 'declared-resources'].includes(resourceScope)) {
    throw new ContractValidationError(`Unsupported executionSafety.resourceScope: ${resourceScope}`);
  }
  if (!['forbidden', 'explicit-approval'].includes(destructiveOperations)) {
    throw new ContractValidationError(`Unsupported executionSafety.destructiveOperations: ${destructiveOperations}`);
  }
  if (!['forbidden', 'explicit-contract', 'allowed'].includes(remoteMutation)) {
    throw new ContractValidationError(`Unsupported executionSafety.remoteMutation: ${remoteMutation}`);
  }

  return { resourceScope, destructiveOperations, remoteMutation };
}

export function createDevelopmentContract({
  rootDir = process.cwd(),
  projectId,
  task,
  authoritativeSources,
  contractId,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!isPlainObject(task)) throw new ContractValidationError('task must be an object');
  if (!(task.status === 'approved' || task.approved === true)) {
    throw new ContractValidationError('Development Contracts may only be created from an approved task');
  }

  const taskId = normalizeIdentifier(task.id, 'task.id');
  const resolvedProjectId = normalizeIdentifier(projectId ?? task.projectId, 'projectId');
  const resolvedContractId = normalizeIdentifier(contractId ?? defaultContractId(taskId), 'contractId');
  const objective = typeof task.objective === 'string' ? task.objective.trim() : '';
  if (!objective) throw new ContractValidationError('task.objective is required');
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new ContractValidationError('createdAt must be an ISO-compatible timestamp');
  }

  const sources = resolveAuthoritativeSources(rootDir, authoritativeSources);
  const scope = task.scope ?? {};
  const risk = task.risk ?? {};
  const riskLevel = risk.level ?? 1;
  if (!Number.isInteger(riskLevel) || riskLevel < 0 || riskLevel > 4) {
    throw new ContractValidationError('risk.level must be an integer from 0 to 4');
  }

  const contract = {
    schemaVersion: DEVELOPMENT_CONTRACT_SCHEMA_VERSION,
    contractId: resolvedContractId,
    projectId: resolvedProjectId,
    taskId,
    createdAt,
    status: 'approved',
    objective,
    scope: {
      in: normalizeStringArray(scope.in ?? []),
      out: normalizeStringArray(scope.out ?? []),
    },
    authoritativeSources: sources,
    requirements: normalizeConstraintArray(task.requirements ?? []),
    acceptanceCriteria: normalizeAcceptanceCriteria(task.acceptanceCriteria),
    architectureConstraints: normalizeConstraintArray(task.architectureConstraints ?? []),
    designConstraints: normalizeConstraintArray(task.designConstraints ?? []),
    securityConstraints: normalizeConstraintArray(task.securityConstraints ?? []),
    executionSafety: normalizeExecutionSafety(task.executionSafety),
    risk: {
      level: riskLevel,
      reasons: normalizeStringArray(risk.reasons ?? []),
    },
    requiredVerification: normalizeStringArray(task.requiredVerification ?? []),
    requiredReviewers: normalizeStringArray(task.requiredReviewers ?? []),
    correctionPolicy: {
      maxAttempts: task.correctionPolicy?.maxAttempts ?? DEFAULT_CORRECTION_ATTEMPTS,
    },
    approvalPolicy: isPlainObject(task.approvalPolicy) ? structuredClone(task.approvalPolicy) : {},
    sourceFingerprint: computeSourceFingerprint(sources),
  };

  validateDevelopmentContract(contract);
  return contract;
}

export function validateDevelopmentContract(contract) {
  const errors = [];
  if (!isPlainObject(contract)) {
    throw new ContractValidationError('Contract must be a non-null object');
  }

  assertNoExtraKeys(contract, CONTRACT_KEYS, 'Contract', errors);

  const requiredStrings = ['schemaVersion', 'contractId', 'projectId', 'taskId', 'createdAt', 'status', 'objective', 'sourceFingerprint'];
  for (const field of requiredStrings) {
    if (typeof contract[field] !== 'string' || contract[field].trim() === '') errors.push(`Missing or invalid ${field}`);
  }

  for (const field of ['contractId', 'projectId', 'taskId']) {
    if (typeof contract[field] === 'string' && !IDENTIFIER_PATTERN.test(contract[field])) {
      errors.push(`${field} contains unsupported characters`);
    }
  }

  if (contract.schemaVersion !== DEVELOPMENT_CONTRACT_SCHEMA_VERSION) errors.push(`Unsupported schemaVersion: ${contract.schemaVersion}`);
  if (contract.status !== 'approved') errors.push('Contract status must be approved before execution');
  if (typeof contract.createdAt === 'string' && Number.isNaN(Date.parse(contract.createdAt))) errors.push('createdAt is not a valid timestamp');
  if (typeof contract.sourceFingerprint === 'string' && !SHA256_PATTERN.test(contract.sourceFingerprint)) errors.push('sourceFingerprint must be a sha256 fingerprint');

  if (!isPlainObject(contract.scope)) {
    errors.push('scope must be an object');
  } else {
    assertNoExtraKeys(contract.scope, new Set(['in', 'out']), 'scope', errors);
    validateStringArray(contract.scope.in, 'scope.in', errors);
    validateStringArray(contract.scope.out, 'scope.out', errors);
  }

  if (!Array.isArray(contract.authoritativeSources) || contract.authoritativeSources.length === 0) {
    errors.push('authoritativeSources must contain at least one source');
  } else {
    const sourceKeys = new Set(['path', 'kind', 'authority', 'sections', 'fingerprint']);
    const seenSources = new Set();
    for (const source of contract.authoritativeSources) {
      if (!isPlainObject(source)) {
        errors.push('authoritativeSources entries must be objects');
        continue;
      }
      assertNoExtraKeys(source, sourceKeys, 'authoritative source', errors);
      try {
        normalizeRelativePath(source.path);
      } catch (error) {
        errors.push(error.message);
      }
      if (typeof source.kind !== 'string' || !source.kind.trim()) errors.push('authoritative source kind must be a non-empty string');
      if (!['required', 'supporting'].includes(source.authority)) errors.push(`Unsupported source authority: ${source.authority}`);
      validateStringArray(source.sections, `sections for ${source.path ?? 'source'}`, errors);
      if (typeof source.fingerprint !== 'string' || !SHA256_PATTERN.test(source.fingerprint)) {
        errors.push(`Invalid source fingerprint for ${source.path ?? 'source'}`);
      }
      if (typeof source.path === 'string' && Array.isArray(source.sections)) {
        const key = `${source.path}\0${source.sections.join('\0')}`;
        if (seenSources.has(key)) errors.push(`Duplicate authoritative source reference: ${source.path}`);
        seenSources.add(key);
      }
    }
  }

  validateConstraintArray(contract.requirements, 'requirements', errors);
  validateConstraintArray(contract.architectureConstraints, 'architectureConstraints', errors);
  validateConstraintArray(contract.designConstraints, 'designConstraints', errors);
  validateConstraintArray(contract.securityConstraints, 'securityConstraints', errors);

  if (!Array.isArray(contract.acceptanceCriteria) || contract.acceptanceCriteria.length === 0) {
    errors.push('acceptanceCriteria must contain at least one criterion');
  } else {
    const criterionKeys = new Set(['id', 'statement', 'source', 'verificationType', 'requiredEvidence']);
    const criterionIds = new Set();
    for (const criterion of contract.acceptanceCriteria) {
      if (!isPlainObject(criterion)) {
        errors.push('Acceptance criteria entries must be objects');
        continue;
      }
      assertNoExtraKeys(criterion, criterionKeys, 'acceptance criterion', errors);
      if (typeof criterion.id !== 'string' || !IDENTIFIER_PATTERN.test(criterion.id)) errors.push('Acceptance criterion id is invalid');
      if (criterionIds.has(criterion.id)) errors.push(`Duplicate acceptance criterion id: ${criterion.id}`);
      criterionIds.add(criterion.id);
      if (typeof criterion.statement !== 'string' || !criterion.statement.trim()) errors.push(`Acceptance criterion ${criterion.id ?? '<unknown>'} requires a statement`);
      if (!(criterion.source === null || (typeof criterion.source === 'string' && criterion.source.trim()))) errors.push(`Acceptance criterion ${criterion.id ?? '<unknown>'} has invalid source`);
      validateStringArray(criterion.verificationType, `verificationType for ${criterion.id ?? 'criterion'}`, errors, { minItems: 1 });
      if (typeof criterion.requiredEvidence !== 'boolean') errors.push(`Acceptance criterion ${criterion.id ?? '<unknown>'} requiredEvidence must be boolean`);
    }
  }

  if (!isPlainObject(contract.executionSafety)) {
    errors.push('executionSafety must be an object');
  } else {
    assertNoExtraKeys(contract.executionSafety, new Set(['resourceScope', 'destructiveOperations', 'remoteMutation']), 'executionSafety', errors);
    if (!['project-only', 'declared-resources'].includes(contract.executionSafety.resourceScope)) errors.push('executionSafety.resourceScope is invalid');
    if (!['forbidden', 'explicit-approval'].includes(contract.executionSafety.destructiveOperations)) errors.push('executionSafety.destructiveOperations is invalid');
    if (!['forbidden', 'explicit-contract', 'allowed'].includes(contract.executionSafety.remoteMutation)) errors.push('executionSafety.remoteMutation is invalid');
  }

  if (!isPlainObject(contract.risk)) {
    errors.push('risk must be an object');
  } else {
    assertNoExtraKeys(contract.risk, new Set(['level', 'reasons']), 'risk', errors);
    if (!Number.isInteger(contract.risk.level) || contract.risk.level < 0 || contract.risk.level > 4) errors.push('risk.level must be an integer from 0 to 4');
    validateStringArray(contract.risk.reasons, 'risk.reasons', errors);
  }

  validateStringArray(contract.requiredVerification, 'requiredVerification', errors);
  validateStringArray(contract.requiredReviewers, 'requiredReviewers', errors);

  if (!isPlainObject(contract.correctionPolicy)) {
    errors.push('correctionPolicy must be an object');
  } else {
    assertNoExtraKeys(contract.correctionPolicy, new Set(['maxAttempts']), 'correctionPolicy', errors);
    if (!Number.isInteger(contract.correctionPolicy.maxAttempts) || contract.correctionPolicy.maxAttempts < 0) {
      errors.push('correctionPolicy.maxAttempts must be a non-negative integer');
    }
  }

  if (!isPlainObject(contract.approvalPolicy)) errors.push('approvalPolicy must be an object');

  if (Array.isArray(contract.authoritativeSources) && contract.authoritativeSources.length > 0) {
    try {
      const expected = computeSourceFingerprint(contract.authoritativeSources);
      if (contract.sourceFingerprint !== expected) errors.push('sourceFingerprint does not match authoritativeSources');
    } catch (error) {
      errors.push(`Unable to validate sourceFingerprint: ${error.message}`);
    }
  }

  if (errors.length > 0) throw new ContractValidationError('Development Contract validation failed', errors);
  return true;
}

export function renderDevelopmentContractMarkdown(contract) {
  validateDevelopmentContract(contract);
  const lines = [
    `# Development Contract ${contract.contractId}`,
    '',
    `**Task:** ${contract.taskId}`,
    `**Project:** ${contract.projectId}`,
    `**Status:** ${contract.status}`,
    `**Source fingerprint:** \`${contract.sourceFingerprint}\``,
    '',
    '## Objective',
    '',
    contract.objective,
    '',
    '## Scope',
    '',
    '### In',
    ...(contract.scope.in.length ? contract.scope.in.map((item) => `- ${item}`) : ['- None declared']),
    '',
    '### Out',
    ...(contract.scope.out.length ? contract.scope.out.map((item) => `- ${item}`) : ['- None declared']),
    '',
    '## Authoritative Sources',
    '',
    ...contract.authoritativeSources.map((source) => {
      const sections = source.sections.length ? ` [${source.sections.join(', ')}]` : '';
      return `- \`${source.path}\`${sections} — ${source.kind}; ${source.authority}; \`${source.fingerprint}\``;
    }),
    '',
    '## Acceptance Criteria',
    '',
    ...contract.acceptanceCriteria.map((criterion) => `- **${criterion.id}** — ${criterion.statement}`),
    '',
    '## Execution Safety',
    '',
    `- Resource scope: **${contract.executionSafety.resourceScope}**`,
    `- Destructive operations: **${contract.executionSafety.destructiveOperations}**`,
    `- Remote mutation: **${contract.executionSafety.remoteMutation}**`,
    '',
    '## Verification & Review',
    '',
    `- Required verification: ${contract.requiredVerification.length ? contract.requiredVerification.join(', ') : 'none declared'}`,
    `- Required reviewers: ${contract.requiredReviewers.length ? contract.requiredReviewers.join(', ') : 'none declared'}`,
    `- Risk level: ${contract.risk.level}`,
    `- Maximum correction attempts: ${contract.correctionPolicy.maxAttempts}`,
    '',
  ];

  return lines.join('\n');
}

export function getContractDirectory(rootDir, contractId) {
  return path.join(rootDir, '.development-kit', 'contracts', normalizeIdentifier(contractId, 'contractId'));
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function persistDevelopmentContract(contract, rootDir = process.cwd()) {
  validateDevelopmentContract(contract);
  const contractDir = getContractDirectory(rootDir, contract.contractId);
  const jsonPath = path.join(contractDir, 'contract.json');
  const markdownPath = path.join(contractDir, 'contract.md');
  const json = `${stableStringify(contract)}\n`;
  const markdown = renderDevelopmentContractMarkdown(contract);

  if (fs.existsSync(jsonPath) || fs.existsSync(markdownPath)) {
    const existingJson = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, 'utf8') : null;
    const existingMarkdown = fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, 'utf8') : null;
    if (existingJson === json && existingMarkdown === markdown) {
      return { created: false, contractDir, jsonPath, markdownPath };
    }
    throw new ContractPersistenceError(`Refusing to overwrite existing Development Contract: ${contract.contractId}`);
  }

  atomicWrite(jsonPath, json);
  atomicWrite(markdownPath, markdown);
  return { created: true, contractDir, jsonPath, markdownPath };
}

export function loadDevelopmentContract(contractId, rootDir = process.cwd()) {
  const jsonPath = path.join(getContractDirectory(rootDir, contractId), 'contract.json');
  if (!fs.existsSync(jsonPath)) return null;
  const contract = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  validateDevelopmentContract(contract);
  return contract;
}

export function checkContractStaleness(contract, rootDir = process.cwd()) {
  validateDevelopmentContract(contract);
  const changes = [];
  const currentSources = contract.authoritativeSources.map((source) => {
    let fingerprint;
    try {
      fingerprint = computeFileFingerprint(rootDir, source.path);
    } catch (error) {
      changes.push({
        path: source.path,
        status: 'missing-or-unreadable',
        expected: source.fingerprint,
        actual: null,
        error: error.message,
      });
      return { ...source, fingerprint: 'missing' };
    }

    if (fingerprint !== source.fingerprint) {
      changes.push({
        path: source.path,
        status: 'changed',
        expected: source.fingerprint,
        actual: fingerprint,
      });
    }
    return { ...source, fingerprint };
  });

  const currentSourceFingerprint = computeSourceFingerprint(currentSources);
  return {
    stale: changes.length > 0 || currentSourceFingerprint !== contract.sourceFingerprint,
    expectedSourceFingerprint: contract.sourceFingerprint,
    currentSourceFingerprint,
    changes,
  };
}

export function ensureDevelopmentContract(options = {}) {
  const taskId = options.task?.id;
  const contractId = normalizeIdentifier(options.contractId ?? defaultContractId(taskId), 'contractId');
  const rootDir = options.rootDir ?? process.cwd();
  const existing = loadDevelopmentContract(contractId, rootDir);

  if (existing) {
    const staleness = checkContractStaleness(existing, rootDir);
    if (staleness.stale) {
      throw new StaleContractError(`Existing Development Contract is stale: ${contractId}`, staleness);
    }
    return { contract: existing, created: false, persistence: null };
  }

  const contract = createDevelopmentContract({ ...options, contractId });
  const persistence = persistDevelopmentContract(contract, rootDir);
  return { contract, created: true, persistence };
}
