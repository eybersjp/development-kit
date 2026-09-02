/**
 * Development Kit — Deterministic IDEA Stage Workflow Engine & Checkpoint Manager
 *
 * Persists and resolves the exact resumable interaction state for the IDEA lifecycle stage.
 * File location: .development-kit/idea/workflow.json
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadDiscoveryState, computeDiscoveryFingerprint } from './idea-discovery.mjs';
import { computeIdeaStageState } from './idea-state.mjs';

export const IDEA_WORKFLOW_SCHEMA_VERSION = '1.0.0';

export const IDEA_WORKFLOW_PHASES = Object.freeze([
  'INITIAL_DISCOVERY',
  'REQUIREMENTS_INTERVIEW',
  'DESIGN_SYSTEM_SETUP',
  'IDEA_CHALLENGE',
  'REQUIREMENT_CONFIRMATION',
  'SCOPE_CONFIRMATION',
  'BRIEF_DRAFT',
  'BRIEF_APPROVAL',
  'COMPLETE',
]);

export const PENDING_INTERACTION_TYPES = Object.freeze([
  'DISCOVERY_QUESTION',
  'DESIGN_SYSTEM_SETUP',
  'IDEA_CHALLENGE',
  'REQUIREMENT_CONFIRMATION',
  'SCOPE_CONFIRMATION',
  'BRIEF_APPROVAL',
  'NONE',
]);

export const INTERACTION_STATUSES = Object.freeze([
  'PENDING',
  'CONSUMED',
  'COMPLETED',
]);

export class IdeaWorkflowError extends Error {
  constructor(message, code = 'DK_IDEA_WORKFLOW_ERROR', details = null) {
    super(message);
    this.name = 'IdeaWorkflowError';
    this.code = code;
    this.details = details;
  }
}

export function getWorkflowFilePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea', 'workflow.json');
}

export function computeInteractionFingerprint(interaction) {
  if (!interaction || typeof interaction !== 'object') return null;
  const norm = {
    type: interaction.type,
    id: interaction.id || null,
    prompt: interaction.prompt ? interaction.prompt.trim() : null,
    options: Array.isArray(interaction.options) ? interaction.options.map((o) => (typeof o === 'string' ? o.trim() : o)) : null,
    metadata: interaction.metadata || null,
  };
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(norm), 'utf8').digest('hex')}`;
}

export function validateWorkflowStructure(data) {
  if (!data || typeof data !== 'object') {
    throw new IdeaWorkflowError('Workflow cursor must be an object', 'DK_WORKFLOW_CORRUPT');
  }
  if (data.schemaVersion !== IDEA_WORKFLOW_SCHEMA_VERSION) {
    throw new IdeaWorkflowError(`Invalid workflow schemaVersion: ${data.schemaVersion}`, 'DK_WORKFLOW_CORRUPT');
  }
  if (typeof data.workflowRevision !== 'number' || !Number.isInteger(data.workflowRevision) || data.workflowRevision < 0) {
    throw new IdeaWorkflowError(`Invalid workflowRevision: ${data.workflowRevision}`, 'DK_WORKFLOW_CORRUPT');
  }
  if (!IDEA_WORKFLOW_PHASES.includes(data.currentPhase)) {
    throw new IdeaWorkflowError(`Invalid currentPhase: ${data.currentPhase}`, 'DK_WORKFLOW_CORRUPT');
  }
  if (typeof data.discoveryRevision !== 'number' || !Number.isInteger(data.discoveryRevision) || data.discoveryRevision < 0) {
    throw new IdeaWorkflowError(`Invalid discoveryRevision: ${data.discoveryRevision}`, 'DK_WORKFLOW_CORRUPT');
  }
  if (!data.discoveryFingerprint || !/^sha256:[a-f0-9]{64}$/i.test(data.discoveryFingerprint)) {
    throw new IdeaWorkflowError(`Invalid discoveryFingerprint: ${data.discoveryFingerprint}`, 'DK_WORKFLOW_CORRUPT');
  }
  if (!INTERACTION_STATUSES.includes(data.status)) {
    throw new IdeaWorkflowError(`Invalid workflow status: ${data.status}`, 'DK_WORKFLOW_CORRUPT');
  }
  if (data.pendingInteraction !== null && data.pendingInteraction !== undefined) {
    if (typeof data.pendingInteraction !== 'object') {
      throw new IdeaWorkflowError('pendingInteraction must be an object or null', 'DK_WORKFLOW_CORRUPT');
    }
    const pi = data.pendingInteraction;
    if (!PENDING_INTERACTION_TYPES.includes(pi.type)) {
      throw new IdeaWorkflowError(`Invalid pendingInteraction type: ${pi.type}`, 'DK_WORKFLOW_CORRUPT');
    }
    if (pi.id !== null && pi.id !== undefined && typeof pi.id !== 'string') {
      throw new IdeaWorkflowError(`Invalid pendingInteraction id: ${pi.id}`, 'DK_WORKFLOW_CORRUPT');
    }
    if (pi.fingerprint && !/^sha256:[a-f0-9]{64}$/i.test(pi.fingerprint)) {
      throw new IdeaWorkflowError(`Invalid pendingInteraction fingerprint: ${pi.fingerprint}`, 'DK_WORKFLOW_CORRUPT');
    }
  }
  if (data.updatedAt && isNaN(Date.parse(data.updatedAt))) {
    throw new IdeaWorkflowError(`Invalid updatedAt timestamp: ${data.updatedAt}`, 'DK_WORKFLOW_CORRUPT');
  }
  return true;
}

export function loadWorkflowCheckpoint(rootDir = process.cwd()) {
  const filePath = getWorkflowFilePath(rootDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    validateWorkflowStructure(data);
    return data;
  } catch (err) {
    if (err instanceof IdeaWorkflowError) throw err;
    throw new IdeaWorkflowError(`Corrupt workflow checkpoint: ${err.message}`, 'DK_WORKFLOW_CORRUPT');
  }
}

export function persistWorkflowCheckpoint(rootDir = process.cwd(), checkpointData = {}) {
  const disc = loadDiscoveryState(rootDir);
  const dir = path.join(rootDir, '.development-kit', 'idea');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const existing = loadWorkflowCheckpoint(rootDir);
  const nextRevision = typeof checkpointData.workflowRevision === 'number'
    ? checkpointData.workflowRevision
    : (existing ? (existing.workflowRevision || 0) + 1 : 1);

  let pendingInteraction = null;
  if (checkpointData.pendingInteraction) {
    const pi = checkpointData.pendingInteraction;
    const fingerprint = pi.fingerprint || computeInteractionFingerprint(pi);
    pendingInteraction = {
      type: pi.type,
      id: pi.id || null,
      prompt: pi.prompt || null,
      options: pi.options || null,
      metadata: pi.metadata || null,
      fingerprint,
    };
  }

  const payload = {
    schemaVersion: IDEA_WORKFLOW_SCHEMA_VERSION,
    workflowRevision: nextRevision,
    currentPhase: checkpointData.currentPhase || 'INITIAL_DISCOVERY',
    pendingInteraction,
    discoveryRevision: disc.revision,
    discoveryFingerprint: disc.fingerprint,
    status: checkpointData.status || (pendingInteraction ? 'PENDING' : 'COMPLETED'),
    designAuthorityState: checkpointData.designAuthorityState !== undefined
      ? checkpointData.designAuthorityState
      : (existing?.designAuthorityState || null),
    updatedAt: new Date().toISOString(),
  };

  validateWorkflowStructure(payload);

  const filePath = getWorkflowFilePath(rootDir);
  const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);

  return payload;
}

/**
 * Validates consistency between coarse ideaStage, discoveryState, and workflow checkpoint.
 * Fails closed if impossible combinations or broken links are detected.
 */
export function validateWorkflowConsistency(rootDir = process.cwd(), { ideaStage, discoveryState, checkpoint } = {}) {
  const stage = ideaStage || computeIdeaStageState(rootDir);
  const disc = discoveryState || loadDiscoveryState(rootDir);
  const cp = checkpoint !== undefined ? checkpoint : loadWorkflowCheckpoint(rootDir);

  // If stage is BLOCKED by runtime framework, propagate
  if (stage.state === 'BLOCKED' && stage.blockerType === 'RUNTIME_FRAMEWORK') {
    throw new IdeaWorkflowError(`Lifecycle state is BLOCKED: ${stage.issues?.[0]?.message}`, stage.issues?.[0]?.code || 'DK_LIFECYCLE_STATE_CORRUPT');
  }

  // If NOT_STARTED
  if (stage.state === 'NOT_STARTED') {
    if (cp && cp.currentPhase !== 'INITIAL_DISCOVERY' && cp.currentPhase !== 'COMPLETE') {
      throw new IdeaWorkflowError('Idea stage is NOT_STARTED but workflow cursor indicates advanced phase', 'DK_WORKFLOW_CONSISTENCY_ERROR');
    }
  }

  // If APPROVED
  if (stage.state === 'APPROVED') {
    if (cp && cp.status === 'PENDING' && cp.pendingInteraction && cp.pendingInteraction.type !== 'NONE') {
      throw new IdeaWorkflowError('Idea stage is APPROVED but workflow cursor has a pending interaction', 'DK_WORKFLOW_CONSISTENCY_ERROR');
    }
  }

  // If checkpoint exists, check discovery binding
  if (cp) {
    if (cp.pendingInteraction && cp.pendingInteraction.type === 'DISCOVERY_QUESTION') {
      const qId = cp.pendingInteraction.id;
      if (qId) {
        const matched = disc.openQuestions.find((q) => q.id.toUpperCase() === qId.toUpperCase());
        if (!matched) {
          throw new IdeaWorkflowError(`Pending interaction references unknown question ${qId}`, 'DK_UNKNOWN_PENDING_QUESTION');
        }
      }
    }
  }

  return true;
}

/**
 * Resolves the deterministic resume interaction and current idea workflow position.
 * Pure read-only operation: does NOT mutate disk or registry.
 */
export function resolveIdeaWorkflowState(rootDir = process.cwd()) {
  const ideaStage = computeIdeaStageState(rootDir);
  const disc = loadDiscoveryState(rootDir);
  const cp = loadWorkflowCheckpoint(rootDir);

  validateWorkflowConsistency(rootDir, { ideaStage, discoveryState: disc, checkpoint: cp });

  // 1. If APPROVED, workflow is complete
  if (ideaStage.state === 'APPROVED') {
    return {
      ideaStage: 'APPROVED',
      workflowPhase: 'COMPLETE',
      pendingInteraction: null,
      status: 'COMPLETED',
      checkpoint: cp,
      action: 'COMPLETE',
      recommendedNextCommand: '/dk-spec',
    };
  }

  // 2. If an active checkpoint with PENDING interaction exists, resume it directly
  if (cp && cp.status === 'PENDING' && cp.pendingInteraction) {
    // If pending interaction is a DISCOVERY_QUESTION, check if it was already answered
    if (cp.pendingInteraction.type === 'DISCOVERY_QUESTION' && cp.pendingInteraction.id) {
      const q = disc.openQuestions.find((item) => item.id.toUpperCase() === cp.pendingInteraction.id.toUpperCase());
      if (q && (q.resolution === 'ANSWERED' || q.resolution === 'DEFERRED' || q.resolution === 'REJECTED' || q.resolution === 'SUPERSEDED')) {
        // Question was resolved since cursor was persisted. Transition to next logical phase deterministically
        return determineNextInteractionFromDiscovery(rootDir, ideaStage, disc, cp);
      }
    }

    return {
      ideaStage: ideaStage.state,
      workflowPhase: cp.currentPhase,
      pendingInteraction: cp.pendingInteraction,
      status: 'PENDING',
      checkpoint: cp,
      action: 'RESUME_PENDING_INTERACTION',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // 3. Otherwise, derive deterministic next action from authoritative discovery and idea stage
  return determineNextInteractionFromDiscovery(rootDir, ideaStage, disc, cp);
}

function determineNextInteractionFromDiscovery(rootDir, ideaStage, disc, cp) {
  const hasDiscovery = disc.requirements.length > 0 || disc.openQuestions.length > 0;

  if (!hasDiscovery && ideaStage.state === 'NOT_STARTED') {
    return {
      ideaStage: 'NOT_STARTED',
      workflowPhase: 'INITIAL_DISCOVERY',
      pendingInteraction: null,
      status: 'NOT_STARTED',
      checkpoint: cp,
      action: 'START_INITIAL_DISCOVERY',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // Check if there are unresolved open questions
  const unresolvedQuestions = disc.openQuestions.filter((q) => q.resolution === 'UNRESOLVED');
  if (unresolvedQuestions.length > 0) {
    const nextQ = unresolvedQuestions[0];
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'REQUIREMENTS_INTERVIEW',
      pendingInteraction: {
        type: 'DISCOVERY_QUESTION',
        id: nextQ.id,
        prompt: nextQ.question,
        options: null,
      },
      status: 'PENDING',
      checkpoint: cp,
      action: 'ASK_DISCOVERY_QUESTION',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // Check Design Authority setup
  const designSetupDone = cp && cp.designAuthorityState && cp.designAuthorityState.status;
  if (!designSetupDone && (!cp || cp.currentPhase === 'INITIAL_DISCOVERY' || cp.currentPhase === 'REQUIREMENTS_INTERVIEW')) {
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'DESIGN_SYSTEM_SETUP',
      pendingInteraction: {
        type: 'DESIGN_SYSTEM_SETUP',
        id: 'INTERACTION-DESIGN-SETUP',
        prompt: 'Design System Setup',
        options: [
          '1. Attach design references',
          '2. Use an existing design.md',
          '3. Derive the design system from an existing application',
          '4. Create a new design direction without references',
          '5. Defer for now (blocks first frontend implementation)',
        ],
      },
      status: 'PENDING',
      checkpoint: cp,
      action: 'PROMPT_DESIGN_SYSTEM_SETUP',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // Check Idea Challenge
  const ideaChallengeDone = cp && (cp.currentPhase === 'REQUIREMENT_CONFIRMATION' || cp.currentPhase === 'SCOPE_CONFIRMATION' || cp.currentPhase === 'BRIEF_DRAFT' || cp.currentPhase === 'BRIEF_APPROVAL' || cp.currentPhase === 'COMPLETE');
  if (!ideaChallengeDone && cp?.currentPhase === 'DESIGN_SYSTEM_SETUP') {
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'IDEA_CHALLENGE',
      pendingInteraction: {
        type: 'IDEA_CHALLENGE',
        id: 'INTERACTION-IDEA-CHALLENGE',
        prompt: 'Challenge assumptions and test whether this is the real problem.',
        options: [
          '1. Proceed with current problem formulation',
          '2. Challenge problem definition',
          '3. Custom write-in',
        ],
      },
      status: 'PENDING',
      checkpoint: cp,
      action: 'PROMPT_IDEA_CHALLENGE',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // Check unconfirmed requirements
  const unconfirmedRequirements = disc.requirements.filter((r) => r.resolutionState === 'UNRESOLVED');
  if (unconfirmedRequirements.length > 0) {
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'REQUIREMENT_CONFIRMATION',
      pendingInteraction: {
        type: 'REQUIREMENT_CONFIRMATION',
        id: 'INTERACTION-REQ-CONFIRMATION',
        prompt: 'Do you confirm these exact requirement statements as the requirements for this project?',
        options: [
          '1. Confirm exact statements',
          '2. Modify statements',
          '3. Custom write-in',
        ],
        metadata: {
          candidates: disc.requirements.filter((r) => r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED'),
        },
      },
      status: 'PENDING',
      checkpoint: cp,
      action: 'PROMPT_REQUIREMENT_CONFIRMATION',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // Check unclassified scope dispositions
  const unclassifiedRequirements = disc.requirements.filter(
    (r) => r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED' && (!r.scopeDisposition || r.scopeDisposition === 'UNCLASSIFIED')
  );
  if (unclassifiedRequirements.length > 0) {
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'SCOPE_CONFIRMATION',
      pendingInteraction: {
        type: 'SCOPE_CONFIRMATION',
        id: 'INTERACTION-SCOPE-CONFIRMATION',
        prompt: 'Do you confirm this scope classification (Must, Should, Future, Excluded)?',
        options: [
          '1. Confirm scope classification',
          '2. Adjust scope classification',
          '3. Custom write-in',
        ],
        metadata: {
          candidates: disc.requirements.filter((r) => r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED'),
        },
      },
      status: 'PENDING',
      checkpoint: cp,
      action: 'PROMPT_SCOPE_CONFIRMATION',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // If READY_FOR_APPROVAL
  if (ideaStage.state === 'READY_FOR_APPROVAL') {
    return {
      ideaStage: 'READY_FOR_APPROVAL',
      workflowPhase: 'BRIEF_APPROVAL',
      pendingInteraction: {
        type: 'BRIEF_APPROVAL',
        id: 'INTERACTION-BRIEF-APPROVAL',
        prompt: 'Please confirm explicit Product Owner approval for the canonical Idea Brief.',
        options: [
          '1. Approve Idea Brief',
          '2. Request changes',
          '3. Defer',
        ],
      },
      status: 'PENDING',
      checkpoint: cp,
      action: 'PROMPT_BRIEF_APPROVAL',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // Fallback for draft ready or reconciliation
  return {
    ideaStage: ideaStage.state,
    workflowPhase: 'BRIEF_DRAFT',
    pendingInteraction: null,
    status: 'IN_PROGRESS',
    checkpoint: cp,
    action: 'DRAFT_OR_RECONCILE_BRIEF',
    recommendedNextCommand: '/dk-idea',
  };
}

/**
 * Record Design Authority Setup decision into the workflow checkpoint
 */
export function recordDesignAuthoritySetup(rootDir = process.cwd(), { disposition, confirmedBy, details = null } = {}) {
  if (!disposition) {
    throw new IdeaWorkflowError('Design system disposition is required', 'DK_INVALID_DESIGN_SETUP');
  }
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for design setup", 'DK_UNAUTHORIZED_DESIGN_SETUP');
  }
  const existing = loadWorkflowCheckpoint(rootDir) || {
    currentPhase: 'DESIGN_SYSTEM_SETUP',
  };

  const setupState = {
    status: 'CONFIGURED',
    disposition,
    confirmedBy,
    details: details || null,
    configuredAt: new Date().toISOString(),
  };

  return persistWorkflowCheckpoint(rootDir, {
    ...existing,
    currentPhase: 'IDEA_CHALLENGE',
    designAuthorityState: setupState,
    pendingInteraction: {
      type: 'IDEA_CHALLENGE',
      id: 'INTERACTION-IDEA-CHALLENGE',
      prompt: 'Challenge assumptions and test whether this is the real problem.',
      options: [
        '1. Proceed with current problem formulation',
        '2. Challenge problem definition',
        '3. Custom write-in',
      ],
    },
    status: 'PENDING',
  });
}
