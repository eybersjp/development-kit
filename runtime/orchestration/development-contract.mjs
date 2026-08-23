import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DEVELOPMENT_CONTRACT_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_CORRECTION_ATTEMPTS = 3;

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

function normalizeRelativePath(sourcePath) {
  if (typeof sourcePath !== 'string' || sourcePath.trim() === '') {
    throw new ContractValidationError('Authoritative source path must be a non-empty string');
  }

  const normalized = sourcePath.trim().replaceAll('\\', '/');
  if (path.isAbsolute(normalized)) {
    throw new ContractValidationError(`Authoritative source path must be project-relative: ${sourcePath}`);
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
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ContractValidationError('Constraint entries must be strings or objects');
    }
    return structuredClone(item);
  });
}

function normalizeIdentifier(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContractValidationError(`${label} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized)) {
    throw new ContractValidationError(`${label} contains unsupported characters: ${normalized}`);
  }
  return normalized;
}

function defaultContractId(taskId) {
  const task = normalizeIdentifier(taskId, 'task.id');
  return `INC-${task}`;
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
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
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
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ContractValidationError('Acceptance criteria must be strings or objects');
    }

    const statement = typeof value.statement === 'string' ? value.statement.trim() : '';
    if (!statement) {
      throw new ContractValidationError('Acceptance criterion statement may not be empty');
    }

    const source = typeof value.source === 'string' && value.source.trim() ? value.source.trim() : null;
    const generatedId = `AC-${sha256(`${statement}\0${source ?? ''}`).slice(0, 12).toUpperCase()}`;
    const id = normalizeIdentifier(value.id ?? generatedId, 'acceptance criterion id');
    if (ids.has(id)) {
      throw new ContractValidationError(`Duplicate acceptance criterion id: ${id}`);
    }
    ids.add(id);

    const verificationType = normalizeStringArray(value.verificationType ?? ['test']);
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContractValidationError('executionSafety must be an object');
  }

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
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    throw new ContractValidationError('task must be an object');
  }
  if (!(task.status === 'approved' || task.approved === true)) {
    throw new ContractValidationError('Development Contracts may only be created from an approved task');
  }

  const taskId = normalizeIdentifier(task.id, 'task.id');
  const resolvedProjectId = normalizeIdentifier(projectId ?? task.projectId, 'projectId');
  const resolvedContractId = normalizeIdentifier(contractId ?? defaultContractId(taskId), 'contractId');
  const objective = typeof task.objective === 'string' ? task.objective.trim() : '';
  if (!objective) throw new ContractValidationError('task.objective is required');
  if (Number.isNaN(Date.parse(createdAt))) throw new ContractValidationError('createdAt must be an ISO-compatible timestamp');

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
    approvalPolicy: task.approvalPolicy && typeof task.approvalPolicy === 'object'
      ? structuredClone(task.approvalPolicy)
      : {},
    sourceFingerprint: computeSourceFingerprint(sources),
  };

  validateDevelopmentContract(contract);
  return contract;
}

export function validateDevelopmentContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new ContractValidationError('Contract must be a non-null object');
  }

  const requiredStrings = ['schemaVersion', 'contractId', 'projectId', 'taskId', 'createdAt', 'status', 'objective', 'sourceFingerprint'];
  for (const field of requiredStrings) {
    if (typeof contract[field] !== 'string' || contract[field].trim() === '') errors.push(`Missing or invalid ${field}`);
  }

  if (contract.schemaVersion !== DEVELOPMENT_CONTRACT_SCHEMA_VERSION) errors.push(`Unsupported schemaVersion: ${contract.schemaVersion}`);
  if (contract.status !== 'approved') errors.push('Contract status must be approved before execution');
  if (!contract.scope || !Array.isArray(contract.scope.in) || !Array.isArray(contract.scope.out)) errors.push('scope.in and scope.out must be arrays');
  if (!Array.isArray(contract.authoritativeSources) || contract.authoritativeSources.length === 0) errors.push('authoritativeSources must contain at least one source');
  if (!Array.isArray(contract.acceptanceCriteria) || contract.acceptanceCriteria.length === 0) errors.push('acceptanceCriteria must contain at least one criterion');
  if (!contract.executionSafety || typeof contract.executionSafety !== 'object') errors.push('executionSafety is required');
  if (!contract.risk || !Number.isInteger(contract.risk.level)) errors.push('risk.level must be an integer');
  if (!contract.correctionPolicy || !Number.isInteger(contract.correctionPolicy.maxAttempts) || contract.correctionPolicy.maxAttempts < 0) errors.push('correctionPolicy.maxAttempts must be a non-negative integer');

  const criterionIds = new Set();
  for (const criterion of contract.acceptanceCriteria ?? []) {
    if (!criterion?.id || !criterion?.statement) errors.push('Each acceptance criterion requires id and statement');
    if (criterionIds.has(criterion?.id)) errors.push(`Duplicate acceptance criterion id: ${criterion.id}`);
    criterionIds.add(criterion?.id);
  }

  if (Array.isArray(contract.authoritativeSources) && contract.authoritativeSources.length > 0) {
    const expected = computeSourceFingerprint(contract.authoritativeSources);
    if (contract.sourceFingerprint !== expected) errors.push('sourceFingerprint does not match authoritativeSources');
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
  const safeId = normalizeIdentifier(contractId, 'contractId');
  return path.join(rootDir, '.development-kit', 'contracts', safeId);
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
    let fingerprint = null;
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
  const existing = loadDevelopmentContract(contractId, options.rootDir ?? process.cwd());

  if (existing) {
    const staleness = checkContractStaleness(existing, options.rootDir ?? process.cwd());
    if (staleness.stale) {
      throw new StaleContractError(`Existing Development Contract is stale: ${contractId}`, staleness);
    }
    return { contract: existing, created: false, persistence: null };
  }

  const contract = createDevelopmentContract({ ...options, contractId });
  const persistence = persistDevelopmentContract(contract, options.rootDir ?? process.cwd());
  return { contract, created: true, persistence };
}
