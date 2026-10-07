import fs from 'node:fs';
import path from 'node:path';

export const COST_RECORD_SCHEMA_VERSION = '1.0.0';
export const COST_ESTIMATOR = 'logical-chars-div-4-v1';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const COUNT_FIELDS = Object.freeze([
  'repositoryReads',
  'repositoryScans',
  'agentInvocations',
  'toolCalls',
  'verificationCommands',
  'cacheHits',
  'cacheMisses',
]);
const OPTIONAL_TOKEN_FIELDS = Object.freeze([
  'providerInputTokens',
  'providerOutputTokens',
  'providerCachedTokens',
]);

export class CostObservatoryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CostObservatoryError';
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new CostObservatoryError(`${label} must be a valid identifier`);
  }
  return value;
}

function optionalId(value, label) {
  if (value === undefined || value === null) return null;
  return requireId(value, label);
}

function nonNegativeInteger(value, label, { nullable = false } = {}) {
  if (value === undefined) return nullable ? null : 0;
  if (value === null && nullable) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new CostObservatoryError(`${label} must be a non-negative integer${nullable ? ' or null' : ''}`);
  }
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new CostObservatoryError(`${label} must be a valid timestamp`);
  }
  return value;
}

export function normalizeLogicalText(value = '') {
  return String(value).replace(/\r\n?/g, '\n');
}

export function measureLogicalText(value = '') {
  const logical = normalizeLogicalText(value);
  return Object.freeze({
    logicalChars: logical.length,
    logicalBytes: Buffer.byteLength(logical, 'utf8'),
    estimatedTokens: Math.ceil(logical.length / 4),
    estimator: COST_ESTIMATOR,
  });
}

export function createCostMeter(initial = {}) {
  const counts = Object.fromEntries(
    COUNT_FIELDS.map((field) => [field, nonNegativeInteger(initial[field], field)]),
  );

  return {
    increment(field, amount = 1) {
      if (!COUNT_FIELDS.includes(field)) throw new CostObservatoryError(`Unsupported counter: ${field}`);
      const delta = nonNegativeInteger(amount, 'increment amount');
      counts[field] += delta;
      return counts[field];
    },
    snapshot() {
      return Object.freeze({ ...counts });
    },
  };
}

export function createCostRecord({
  operationId,
  lifecycleId = null,
  contractId = null,
  taskId = null,
  runId = null,
  role = null,
  context = '',
  providerUsage = null,
  counters = {},
  startedAt,
  completedAt,
} = {}) {
  requireId(operationId, 'operationId');
  const start = timestamp(startedAt, 'startedAt');
  const end = timestamp(completedAt, 'completedAt');
  if (Date.parse(end) < Date.parse(start)) {
    throw new CostObservatoryError('completedAt may not be before startedAt');
  }

  const contextMetric = measureLogicalText(context);
  const provider = providerUsage === null || providerUsage === undefined ? {} : providerUsage;
  if (typeof provider !== 'object' || Array.isArray(provider)) {
    throw new CostObservatoryError('providerUsage must be an object, null, or undefined');
  }

  const record = {
    schemaVersion: COST_RECORD_SCHEMA_VERSION,
    operationId,
    lifecycleId: optionalId(lifecycleId, 'lifecycleId'),
    contractId: optionalId(contractId, 'contractId'),
    taskId: optionalId(taskId, 'taskId'),
    runId: optionalId(runId, 'runId'),
    role: role === null || role === undefined ? null : requireId(role, 'role'),
    contextBytes: contextMetric.logicalBytes,
    estimatedContextTokens: contextMetric.estimatedTokens,
    contextEstimator: contextMetric.estimator,
    providerInputTokens: nonNegativeInteger(provider.inputTokens, 'providerUsage.inputTokens', { nullable: true }),
    providerOutputTokens: nonNegativeInteger(provider.outputTokens, 'providerUsage.outputTokens', { nullable: true }),
    providerCachedTokens: nonNegativeInteger(provider.cachedTokens, 'providerUsage.cachedTokens', { nullable: true }),
    repositoryReads: nonNegativeInteger(counters.repositoryReads, 'repositoryReads', { nullable: true }),
    repositoryScans: nonNegativeInteger(counters.repositoryScans, 'repositoryScans', { nullable: true }),
    agentInvocations: nonNegativeInteger(counters.agentInvocations, 'agentInvocations', { nullable: true }),
    toolCalls: nonNegativeInteger(counters.toolCalls, 'toolCalls', { nullable: true }),
    verificationCommands: nonNegativeInteger(counters.verificationCommands, 'verificationCommands', { nullable: true }),
    cacheHits: nonNegativeInteger(counters.cacheHits, 'cacheHits'),
    cacheMisses: nonNegativeInteger(counters.cacheMisses, 'cacheMisses'),
    startedAt: start,
    completedAt: end,
    elapsedMs: Date.parse(end) - Date.parse(start),
  };

  validateCostRecord(record);
  return Object.freeze(record);
}

export function validateCostRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new CostObservatoryError('Cost record must be an object');
  }
  if (record.schemaVersion !== COST_RECORD_SCHEMA_VERSION) {
    throw new CostObservatoryError(`Unsupported cost record schemaVersion: ${record.schemaVersion}`);
  }
  requireId(record.operationId, 'operationId');
  for (const [field, label] of [
    ['lifecycleId', 'lifecycleId'],
    ['contractId', 'contractId'],
    ['taskId', 'taskId'],
    ['runId', 'runId'],
    ['role', 'role'],
  ]) {
    optionalId(record[field], label);
  }
  nonNegativeInteger(record.contextBytes, 'contextBytes');
  nonNegativeInteger(record.estimatedContextTokens, 'estimatedContextTokens');
  if (record.contextEstimator !== COST_ESTIMATOR) {
    throw new CostObservatoryError(`Unsupported contextEstimator: ${record.contextEstimator}`);
  }
  for (const field of OPTIONAL_TOKEN_FIELDS) nonNegativeInteger(record[field], field, { nullable: true });
  for (const field of COUNT_FIELDS) {
    const nullable = !['cacheHits', 'cacheMisses'].includes(field);
    nonNegativeInteger(record[field], field, { nullable });
  }
  timestamp(record.startedAt, 'startedAt');
  timestamp(record.completedAt, 'completedAt');
  nonNegativeInteger(record.elapsedMs, 'elapsedMs');
  if (Date.parse(record.completedAt) - Date.parse(record.startedAt) !== record.elapsedMs) {
    throw new CostObservatoryError('elapsedMs does not match startedAt/completedAt');
  }
  return true;
}

export function compareCostRecords(baseline, current) {
  validateCostRecord(baseline);
  validateCostRecord(current);
  const fields = [
    'contextBytes',
    'estimatedContextTokens',
    'providerInputTokens',
    'providerOutputTokens',
    'providerCachedTokens',
    'repositoryReads',
    'repositoryScans',
    'agentInvocations',
    'toolCalls',
    'verificationCommands',
    'cacheHits',
    'cacheMisses',
    'elapsedMs',
  ];

  const metrics = {};
  for (const field of fields) {
    const before = baseline[field];
    const after = current[field];
    if (before === null || after === null || before === undefined || after === undefined) {
      metrics[field] = { before: before ?? null, after: after ?? null, delta: null, reductionPercent: null, available: false };
      continue;
    }
    const delta = after - before;
    const reductionPercent = before === 0
      ? null
      : Number((((before - after) / before) * 100).toFixed(2));
    metrics[field] = { before, after, delta, reductionPercent, available: true };
  }

  return Object.freeze({
    schemaVersion: '1.0.0',
    baselineOperationId: baseline.operationId,
    currentOperationId: current.operationId,
    metrics,
  });
}

export function getCostLedgerPath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'telemetry', 'cost-records.jsonl');
}

export function appendCostRecord(record, rootDir = process.cwd()) {
  validateCostRecord(record);
  const ledgerPath = getCostLedgerPath(rootDir);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, 'utf8');
  return { ledgerPath };
}

export function loadCostRecords(rootDir = process.cwd()) {
  const ledgerPath = getCostLedgerPath(rootDir);
  if (!fs.existsSync(ledgerPath)) return [];
  const content = fs.readFileSync(ledgerPath, 'utf8');
  const records = content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        throw new CostObservatoryError(`Invalid cost ledger JSON at line ${index + 1}`);
      }
      validateCostRecord(record);
      return record;
    });
  return records;
}
