/**
 * Development Kit Autopilot — 9-Stage Transition State Machine
 *
 * Governs the lifecycle stages:
 * UNDERSTAND -> DEFINE -> DESIGN -> PLAN -> IMPLEMENT -> VERIFY -> REVIEW -> SIMPLIFY -> COMPLETE
 */

import crypto from 'node:crypto';
import { getProjectIdentity } from './project-identity.mjs';

export const CANONICAL_STAGES = [
  'UNDERSTAND',
  'DEFINE',
  'DESIGN',
  'PLAN',
  'IMPLEMENT',
  'VERIFY',
  'REVIEW',
  'SIMPLIFY',
  'COMPLETE'
];

export const STAGE_COMMAND_MAP = {
  UNDERSTAND: { command: '/dk-idea', agent: 'product-discovery-agent' },
  DEFINE: { command: '/dk-spec', agent: 'specification-agent' },
  DESIGN: { command: '/dk-design', agent: 'solution-architect-agent' },
  PLAN: { command: '/dk-tasks', agent: 'task-planner-agent' },
  IMPLEMENT: { command: '/dk-build', agent: 'implementation-agent' },
  VERIFY: { command: '/dk-test', agent: 'test-engineer' },
  REVIEW: { command: '/dk-review', agent: 'code-reviewer' },
  SIMPLIFY: { command: '/dk-simplify', agent: 'simplicity-reviewer' },
  COMPLETE: { command: '/dk-ship', agent: 'development-conductor' }
};

export function createInitialState(options = {}, rootDir = process.cwd()) {
  const identity = getProjectIdentity(rootDir);
  const workflowId = `wf_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  return {
    schemaVersion: '1.0.0',
    workflowId,
    projectId: identity.projectId,
    workspaceId: identity.workspaceId,
    workflowMode: options.mode || 'autopilot',
    autonomyLevel: options.autonomy || 'guided-autopilot',
    workflowStatus: 'executing',
    currentStage: 'UNDERSTAND',
    completedStages: [],
    skippedStages: [],
    blockedStages: [],
    activeAction: null,
    pendingApproval: null,
    pendingConfirmation: null,
    stateRevision: 1,
    createdAt: now,
    updatedAt: now,
    frameworkVersion: '0.4.0'
  };
}

export function pauseWorkflow(state) {
  if (!state) throw new Error('No state provided');
  if (state.workflowStatus === 'paused') throw new Error('Workflow is already paused');
  if (state.workflowStatus !== 'executing') throw new Error(`Cannot pause workflow in ${state.workflowStatus} status`);

  state.workflowStatus = 'paused';
  state.updatedAt = new Date().toISOString();
  return state;
}

export function resumeWorkflow(state) {
  if (!state) throw new Error('No state provided');
  if (state.workflowStatus === 'executing') throw new Error('Workflow is already executing');
  if (state.workflowStatus !== 'paused') throw new Error(`Cannot resume workflow in ${state.workflowStatus} status`);

  state.workflowStatus = 'executing';
  state.updatedAt = new Date().toISOString();
  return state;
}

export function renewActionLease(state, actionId, extensionMs = 30 * 60 * 1000) {
  if (!state.activeAction || state.activeAction.actionId !== actionId) {
    throw new Error(`Action ${actionId} is not active`);
  }

  const now = Date.now();
  const issuedAt = Date.parse(state.activeAction.issuedAt);
  const maxLeaseDuration = 2 * 60 * 60 * 1000; // 2 hours hard limit

  if (now - issuedAt > maxLeaseDuration) {
    throw new Error(`Maximum lease duration (2 hours) reached for action ${actionId}`);
  }

  const currentExpires = Date.parse(state.activeAction.leaseExpiresAt);
  if (now > currentExpires) {
    state.activeAction.status = 'lease_expired';
    throw new Error(`Lease for action ${actionId} has already expired`);
  }

  const newExpires = Math.min(currentExpires + extensionMs, issuedAt + maxLeaseDuration);
  state.activeAction.leaseExpiresAt = new Date(newExpires).toISOString();
  state.updatedAt = new Date().toISOString();
  return state;
}

export function checkLeaseExpiry(state) {
  if (state && state.activeAction && state.activeAction.status !== 'lease_expired') {
    const expiresAt = Date.parse(state.activeAction.leaseExpiresAt);
    if (Date.now() > expiresAt) {
      state.activeAction.status = 'lease_expired';
      state.updatedAt = new Date().toISOString();
    }
  }
  return state;
}

export function calculateNextAction(state) {
  if (!state || state.workflowStatus !== 'executing') {
    return {
      type: 'workflow_status',
      status: state ? state.workflowStatus : 'absent'
    };
  }

  checkLeaseExpiry(state);

  if (state.activeAction) {
    return state.activeAction;
  }

  const stage = state.currentStage;
  const config = STAGE_COMMAND_MAP[stage] || { command: '/dk-idea', agent: 'development-conductor' };
  const actionId = `act_${stage.toLowerCase()}_${Date.now()}`;

  const nextAction = {
    workflowId: state.workflowId,
    stateRevision: state.stateRevision,
    actionId,
    actionType: 'invoke_command',
    stage,
    command: config.command,
    responsibleAgent: config.agent,
    status: 'issued',
    issuedAt: new Date().toISOString(),
    leaseExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };

  return nextAction;
}

export function beginActionState(state, actionId) {
  if (state.workflowStatus === 'paused') {
    throw new Error('Workflow is paused');
  }

  checkLeaseExpiry(state);

  if (!state.activeAction || state.activeAction.actionId !== actionId) {
    throw new Error(`Action ${actionId} is not active or matched`);
  }

  if (state.activeAction.status === 'lease_expired') {
    throw new Error(`Lease for action ${actionId} has expired`);
  }

  state.activeAction.status = 'in_progress';
  state.updatedAt = new Date().toISOString();
  return state;
}

export function recordResultState(state, result) {
  if (state.workflowStatus === 'paused') {
    throw new Error('Workflow is paused');
  }

  if (state.stateRevision !== result.stateRevision) {
    throw new Error(`State revision mismatch: expected ${state.stateRevision}, got ${result.stateRevision}`);
  }

  if (!state.activeAction || state.activeAction.actionId !== result.actionId) {
    throw new Error(`Action ID mismatch or no active action: expected ${state.activeAction?.actionId}, got ${result.actionId}`);
  }

  checkLeaseExpiry(state);

  // Late result handling for expired lease -> route to manual_review
  if (state.activeAction.status === 'lease_expired') {
    result.status = 'manual_review';
    state.workflowStatus = 'recovering';
    state.activeAction.status = 'manual_review';
    state.activeAction.reviewReason = 'Late result submitted after action lease expiry';
    state.stateRevision += 1;
    state.updatedAt = new Date().toISOString();
    return state;
  }

  if (result.status === 'completed') {
    state.completedStages.push(state.currentStage);
    const currentIndex = CANONICAL_STAGES.indexOf(state.currentStage);
    if (currentIndex >= 0 && currentIndex < CANONICAL_STAGES.length - 1) {
      state.currentStage = CANONICAL_STAGES[currentIndex + 1];
    } else if (currentIndex === CANONICAL_STAGES.length - 1) {
      state.workflowStatus = 'completed';
    }
  } else if (result.status === 'manual_review') {
    state.workflowStatus = 'recovering';
  }

  state.activeAction = null;
  state.stateRevision += 1;
  state.updatedAt = new Date().toISOString();
  return state;
}
