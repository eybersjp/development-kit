import fs from 'node:fs';
import path from 'node:path';

import { validateDevelopmentContract } from './development-contract.mjs';
import { selectRequiredGates } from './gate-selector.mjs';
import { selectExecutionStrategy } from './host-capabilities.mjs';
import { getRunDirectory } from './evidence-store.mjs';

const RUN_STATES = Object.freeze([
  'READY',
  'IMPLEMENTING',
  'VERIFYING',
  'REVIEWING',
  'CORRECTING',
  'PAUSED',
  'ACCEPTED',
  'BLOCKED',
]);

export class OrchestrationRunError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OrchestrationRunError';
  }
}

function id(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new OrchestrationRunError(`${label} is invalid`);
  return value;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function createOrchestrationRun({
  contract,
  runId,
  capabilities,
  impacts = {},
  createdAt = new Date().toISOString(),
} = {}) {
  validateDevelopmentContract(contract);
  const normalizedRunId = id(runId, 'runId');
  const gates = selectRequiredGates(contract, impacts);
  const strategy = selectExecutionStrategy({
    capabilities,
    contract,
    requiresVisualEvidence: Boolean(impacts.touchesUi),
  });
  if (strategy.strategy === 'blocked') {
    throw new OrchestrationRunError(`Host capability gate blocked run: ${strategy.reason}`);
  }
  const run = {
    schemaVersion: '1.0.0',
    contractId: contract.contractId,
    taskId: contract.taskId,
    runId: normalizedRunId,
    sourceFingerprint: contract.sourceFingerprint,
    createdAt,
    state: 'READY',
    executionStrategy: strategy.strategy,
    hostCapabilities: strategy.capabilities,
    manualEvidenceRequired: strategy.manualEvidenceRequired,
    requiredGates: gates,
    completedGates: [],
    correctionAttempt: 0,
    failureSignatures: [],
    verificationVerdict: null,
    acceptanceState: 'PENDING',
  };
  validateOrchestrationRun(run);
  return run;
}

export function updateRun(run, patch = {}) {
  validateOrchestrationRun(run);
  const next = structuredClone(run);
  const allowed = new Set([
    'state',
    'completedGates',
    'correctionAttempt',
    'failureSignatures',
    'verificationVerdict',
    'acceptanceState',
  ]);
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.has(key)) throw new OrchestrationRunError(`Run field is immutable or unsupported: ${key}`);
    next[key] = structuredClone(value);
  }
  validateOrchestrationRun(next);
  return next;
}

export function applyAcceptanceToRun(run, acceptance) {
  validateOrchestrationRun(run);
  if (!acceptance || acceptance.contractId !== run.contractId || acceptance.sourceFingerprint !== run.sourceFingerprint) {
    throw new OrchestrationRunError('Acceptance record does not match orchestration run');
  }
  const state = acceptance.state === 'ACCEPTED' ? 'ACCEPTED' : acceptance.state === 'BLOCKED' ? 'BLOCKED' : 'PAUSED';
  return updateRun(run, { state, acceptanceState: acceptance.state });
}

export function validateOrchestrationRun(run) {
  if (!run || typeof run !== 'object' || Array.isArray(run)) throw new OrchestrationRunError('orchestration run is required');
  id(run.contractId, 'contractId');
  id(run.taskId, 'taskId');
  id(run.runId, 'runId');
  if (!RUN_STATES.includes(run.state)) throw new OrchestrationRunError(`Unsupported run state: ${run.state}`);
  if (!Number.isInteger(run.correctionAttempt) || run.correctionAttempt < 0) throw new OrchestrationRunError('correctionAttempt must be a non-negative integer');
  if (!Array.isArray(run.failureSignatures) || !Array.isArray(run.completedGates)) throw new OrchestrationRunError('run arrays are invalid');
  if (!run.requiredGates || typeof run.requiredGates !== 'object') throw new OrchestrationRunError('requiredGates are required');
  if (!/^sha256:[a-f0-9]{64}$/.test(run.sourceFingerprint)) throw new OrchestrationRunError('sourceFingerprint is invalid');
  return true;
}

export function persistRunManifest(run, rootDir = process.cwd()) {
  validateOrchestrationRun(run);
  const runDir = getRunDirectory(rootDir, run.contractId, run.runId);
  fs.mkdirSync(runDir, { recursive: true });
  const filePath = path.join(runDir, 'manifest.json');
  const content = `${JSON.stringify(stable(run), null, 2)}\n`;
  if (fs.existsSync(filePath)) {
    if (fs.readFileSync(filePath, 'utf8') === content) return { created: false, path: filePath };
    throw new OrchestrationRunError(`Refusing to overwrite orchestration run manifest: ${run.runId}`);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return { created: true, path: filePath };
}

export function persistFinalRunState(run, rootDir = process.cwd()) {
  validateOrchestrationRun(run);
  if (!['ACCEPTED', 'BLOCKED'].includes(run.state)) throw new OrchestrationRunError('Final run state requires ACCEPTED or BLOCKED');
  const runDir = getRunDirectory(rootDir, run.contractId, run.runId);
  fs.mkdirSync(runDir, { recursive: true });
  const filePath = path.join(runDir, 'final-state.json');
  const content = `${JSON.stringify(stable(run), null, 2)}\n`;
  if (fs.existsSync(filePath)) {
    if (fs.readFileSync(filePath, 'utf8') === content) return { created: false, path: filePath };
    throw new OrchestrationRunError(`Refusing to overwrite final run state: ${run.runId}`);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return { created: true, path: filePath };
}

export function loadRunManifest(contractId, runId, rootDir = process.cwd()) {
  const filePath = path.join(getRunDirectory(rootDir, contractId, runId), 'manifest.json');
  if (!fs.existsSync(filePath)) return null;
  const run = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  validateOrchestrationRun(run);
  return run;
}

export { RUN_STATES };
