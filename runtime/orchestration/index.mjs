import {
  ensureDevelopmentContract,
  persistDevelopmentContract,
  validateDevelopmentContract,
} from './development-contract.mjs';
import { bindAuthoritativeSources, createPolicyBoundDevelopmentContract } from './contract-policy.mjs';
import { buildContextPackage } from './context-package.mjs';
import {
  createOrchestrationRun,
  persistFinalRunState,
  persistRunManifest,
  persistRunStateRevision,
  updateRun,
} from './orchestration-run.mjs';
import { decideAcceptance } from './acceptance-engine.mjs';
import { decideCorrection } from './correction-engine.mjs';

export function prepareTaskRun({
  rootDir = process.cwd(),
  projectId,
  task,
  authoritativeSources,
  contractId,
  runId,
  capabilities,
  impacts = {},
  createdAt,
} = {}) {
  const desiredContractId = contractId ?? `INC-${task?.id}`;
  const boundSources = bindAuthoritativeSources({ rootDir, task, authoritativeSources });
  let contract;
  try {
    contract = ensureDevelopmentContract({
      rootDir,
      projectId,
      task,
      authoritativeSources: boundSources,
      contractId: desiredContractId,
      createdAt,
    }).contract;
  } catch (error) {
    if (error?.name !== 'ContractValidationError') throw error;
    contract = createPolicyBoundDevelopmentContract({
      rootDir,
      projectId,
      task,
      authoritativeSources: boundSources,
      contractId: desiredContractId,
      createdAt,
    });
    persistDevelopmentContract(contract, rootDir);
  }

  validateDevelopmentContract(contract);
  const run = createOrchestrationRun({ contract, runId, capabilities, impacts, createdAt });
  persistRunManifest(run, rootDir);
  persistRunStateRevision(run, rootDir);
  return { contract, run };
}

export function createRoleContext({ contract, role, rootDir = process.cwd(), repositoryState, implementationReport, capabilities } = {}) {
  return buildContextPackage({
    contract,
    role,
    rootDir,
    repositoryState,
    implementationReport,
    capabilities,
    contextIsolation: role === 'implementation-agent' || role === 'implementer' ? 'fresh' : 'rehydrated',
  });
}

export function evaluateRun({ run, contract, verification, reviews, controlManifests, approvals, architectureDrift, rootDir = process.cwd() } = {}) {
  const acceptance = decideAcceptance({
    contract,
    verification,
    reviews,
    controlManifests,
    approvals,
    architectureDrift,
    rootDir,
  });
  const updatedRun = updateRun(run, {
    verificationVerdict: verification?.verdict ?? null,
    acceptanceState: acceptance.state,
    state: acceptance.state === 'ACCEPTED' ? 'ACCEPTED' : acceptance.state === 'BLOCKED' ? 'BLOCKED' : 'PAUSED',
  });
  persistRunStateRevision(updatedRun, rootDir);
  if (['ACCEPTED', 'BLOCKED'].includes(updatedRun.state)) persistFinalRunState(updatedRun, rootDir);
  return { acceptance, run: updatedRun };
}

export function planCorrection({ run, contract, verification, blockers = [], rootDir = process.cwd() } = {}) {
  const decision = decideCorrection({
    contract,
    verification,
    attempt: run.correctionAttempt,
    priorFailureSignatures: run.failureSignatures,
    blockers,
  });

  if (decision.action === 'NONE') return { decision, run };

  if (decision.action === 'PAUSE') {
    const pausedRun = updateRun(run, { state: 'PAUSED' });
    persistRunStateRevision(pausedRun, rootDir);
    return { decision, run: pausedRun };
  }

  const correctingRun = updateRun(run, {
    state: 'CORRECTING',
    correctionAttempt: decision.request.attempt,
    failureSignatures: [...run.failureSignatures, decision.failureSignature],
  });
  persistRunStateRevision(correctingRun, rootDir);
  return { decision, run: correctingRun };
}

export * from './development-contract.mjs';
export * from './contract-policy.mjs';
export * from './context-package.mjs';
export * from './verification-engine.mjs';
export * from './evidence-store.mjs';
export * from './review-result.mjs';
export * from './architecture-drift.mjs';
export * from './acceptance-engine.mjs';
export * from './correction-engine.mjs';
export * from './host-capabilities.mjs';
export * from './gate-selector.mjs';
export * from './orchestration-run.mjs';
export * from './execution-safety.mjs';
export * from './execution-broker.mjs';
export * from './reconciliation.mjs';
export * from './plan-validator.mjs';
export * from './authority-graph.mjs';
export * from './po-decisions.mjs';
