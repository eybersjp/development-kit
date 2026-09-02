/**
 * Development Kit — Deterministic IDEA Stage Workflow Engine & Checkpoint Manager
 *
 * Persists, validates, and transitions the exact resumable interaction state for the IDEA lifecycle stage.
 * File location: .development-kit/idea/workflow.json
 * Canonical Design Authority location: .development-kit/design-system-state.json
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

export const LEGAL_WORKFLOW_TRANSITIONS = Object.freeze({
  INITIAL_DISCOVERY: Object.freeze(['REQUIREMENTS_INTERVIEW', 'DESIGN_SYSTEM_SETUP', 'IDEA_CHALLENGE']),
  REQUIREMENTS_INTERVIEW: Object.freeze(['REQUIREMENTS_INTERVIEW', 'DESIGN_SYSTEM_SETUP', 'IDEA_CHALLENGE']),
  DESIGN_SYSTEM_SETUP: Object.freeze(['IDEA_CHALLENGE']),
  IDEA_CHALLENGE: Object.freeze(['REQUIREMENT_CONFIRMATION']),
  REQUIREMENT_CONFIRMATION: Object.freeze(['REQUIREMENT_CONFIRMATION', 'SCOPE_CONFIRMATION']),
  SCOPE_CONFIRMATION: Object.freeze(['SCOPE_CONFIRMATION', 'BRIEF_DRAFT', 'BRIEF_APPROVAL']),
  BRIEF_DRAFT: Object.freeze(['BRIEF_APPROVAL', 'BRIEF_DRAFT']),
  BRIEF_APPROVAL: Object.freeze(['BRIEF_DRAFT', 'COMPLETE']),
  COMPLETE: Object.freeze([]),
});

export class IdeaWorkflowError extends Error {
  constructor(message, code = 'DK_IDEA_WORKFLOW_ERROR', details = null) {
    super(message);
    this.name = 'IdeaWorkflowError';
    this.code = code;
    this.details = details;
  }
}

export function isValidWorkflowTransition(fromPhase, toPhase) {
  if (fromPhase === toPhase) return true;
  const allowed = LEGAL_WORKFLOW_TRANSITIONS[fromPhase];
  return Array.isArray(allowed) && allowed.includes(toPhase);
}

export function getWorkflowFilePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea', 'workflow.json');
}

export function getDesignSystemStateFilePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'design-system-state.json');
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
    const expectedFingerprint = computeInteractionFingerprint(pi);
    if (pi.fingerprint && pi.fingerprint !== expectedFingerprint) {
      throw new IdeaWorkflowError(
        `Pending interaction fingerprint mismatch. Found ${pi.fingerprint}, expected ${expectedFingerprint}`,
        'DK_INTERACTION_FINGERPRINT_MISMATCH'
      );
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

    // If pendingInteraction exists, recompute and verify fingerprint
    if (data.pendingInteraction) {
      const expectedFingerprint = computeInteractionFingerprint(data.pendingInteraction);
      if (data.pendingInteraction.fingerprint !== expectedFingerprint) {
        throw new IdeaWorkflowError(
          `Pending interaction content tampered or mismatched on load: ${data.pendingInteraction.fingerprint} !== ${expectedFingerprint}`,
          'DK_INTERACTION_FINGERPRINT_MISMATCH'
        );
      }
    }

    return data;
  } catch (err) {
    if (err instanceof IdeaWorkflowError) throw err;
    throw new IdeaWorkflowError(`Corrupt workflow checkpoint: ${err.message}`, 'DK_WORKFLOW_CORRUPT');
  }
}

/**
 * Load Canonical Design Authority State
 */
export function loadDesignSystemState(rootDir = process.cwd()) {
  const filePath = getDesignSystemStateFilePath(rootDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new IdeaWorkflowError(`Corrupt design-system-state.json: ${err.message}`, 'DK_DESIGN_STATE_CORRUPT');
  }
}

/**
 * Persist Canonical Design Authority State
 */
export function persistDesignSystemState(rootDir = process.cwd(), stateData = {}) {
  const filePath = getDesignSystemStateFilePath(rootDir);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const payload = {
    schemaVersion: 1,
    status: stateData.status || 'unconfigured',
    disposition: stateData.disposition || null,
    confirmedBy: stateData.confirmedBy || null,
    details: stateData.details || null,
    updatedAt: new Date().toISOString(),
  };
  const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
  return payload;
}

/**
 * Low-level workflow checkpoint persistence (internal runtime / test use).
 * Enforces discovery binding, content-bound fingerprint, transition validity, and monotonic revision.
 */
export function persistWorkflowCheckpoint(rootDir = process.cwd(), checkpointData = {}) {
  const disc = loadDiscoveryState(rootDir);
  const dir = path.join(rootDir, '.development-kit', 'idea');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const existing = loadWorkflowCheckpoint(rootDir);
  const currentPhase = checkpointData.currentPhase || 'INITIAL_DISCOVERY';

  if (existing) {
    // Check workflow transition validity
    if (!isValidWorkflowTransition(existing.currentPhase, currentPhase)) {
      throw new IdeaWorkflowError(
        `Invalid workflow transition from ${existing.currentPhase} to ${currentPhase}`,
        'DK_INVALID_IDEA_WORKFLOW_TRANSITION'
      );
    }
  }

  // Monotonic revision enforcement
  let nextRevision = existing ? (existing.workflowRevision || 0) + 1 : 1;
  if (typeof checkpointData.workflowRevision === 'number') {
    if (existing && checkpointData.workflowRevision <= (existing.workflowRevision || 0)) {
      throw new IdeaWorkflowError(
        `Cannot roll back or reuse workflowRevision: requested ${checkpointData.workflowRevision} <= current ${existing.workflowRevision}`,
        'DK_WORKFLOW_REVISION_ROLLBACK'
      );
    }
    if (existing && checkpointData.workflowRevision > nextRevision) {
      throw new IdeaWorkflowError(
        `Cannot jump workflowRevision: requested ${checkpointData.workflowRevision} > next ${nextRevision}`,
        'DK_WORKFLOW_REVISION_JUMP'
      );
    }
  }

  let pendingInteraction = null;
  if (checkpointData.pendingInteraction) {
    const pi = checkpointData.pendingInteraction;
    const computed = computeInteractionFingerprint(pi);
    if (pi.fingerprint && pi.fingerprint !== computed) {
      throw new IdeaWorkflowError(
        `Caller-supplied pending interaction fingerprint ${pi.fingerprint} does not match computed ${computed}`,
        'DK_INTERACTION_FINGERPRINT_MISMATCH'
      );
    }
    pendingInteraction = {
      type: pi.type,
      id: pi.id || null,
      prompt: pi.prompt || null,
      options: pi.options || null,
      metadata: pi.metadata || null,
      fingerprint: computed,
    };
  }

  // Bind canonical Design Authority status
  const canonicalDesign = loadDesignSystemState(rootDir);
  const designSnapshot = canonicalDesign ? canonicalDesign.status : null;

  const payload = {
    schemaVersion: IDEA_WORKFLOW_SCHEMA_VERSION,
    workflowRevision: nextRevision,
    currentPhase,
    pendingInteraction,
    discoveryRevision: disc.revision,
    discoveryFingerprint: disc.fingerprint,
    status: checkpointData.status || (pendingInteraction ? 'PENDING' : 'COMPLETED'),
    designAuthorityStatus: designSnapshot,
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
 * Fails closed if impossible combinations, broken links, or binding mismatches are detected.
 */
export function validateWorkflowConsistency(rootDir = process.cwd(), { ideaStage, discoveryState, checkpoint } = {}) {
  const stage = ideaStage || computeIdeaStageState(rootDir);
  const disc = discoveryState || loadDiscoveryState(rootDir);
  const cp = checkpoint !== undefined ? checkpoint : loadWorkflowCheckpoint(rootDir);

  // If stage is BLOCKED by runtime framework, propagate
  if (stage.state === 'BLOCKED' && stage.blockerType === 'RUNTIME_FRAMEWORK') {
    throw new IdeaWorkflowError(`Lifecycle state is BLOCKED: ${stage.issues?.[0]?.message}`, stage.issues?.[0]?.code || 'DK_LIFECYCLE_STATE_CORRUPT');
  }

  if (cp) {
    // 1. Enforce Discovery Revision and Fingerprint Binding
    // Special case: If cp recorded a pending interaction that was satisfied/consumed by a discovery mutation,
    // the workflow is transitioning out of that pending state to derive the next phase.
    const isAnsweredDiscoveryQuestion =
      cp.status === 'PENDING' &&
      cp.pendingInteraction &&
      cp.pendingInteraction.type === 'DISCOVERY_QUESTION' &&
      cp.pendingInteraction.id &&
      disc.openQuestions.some(
        (q) =>
          q.id.toUpperCase() === cp.pendingInteraction.id.toUpperCase() &&
          ['ANSWERED', 'DEFERRED', 'REJECTED', 'SUPERSEDED'].includes(q.resolution)
      );

    const isSatisfiedRequirementConfirmation =
      cp.status === 'PENDING' &&
      cp.pendingInteraction &&
      cp.pendingInteraction.type === 'REQUIREMENT_CONFIRMATION' &&
      disc.requirements.length > 0 &&
      disc.requirements.every((r) => r.resolutionState !== 'UNRESOLVED');

    const isSatisfiedScopeConfirmation =
      cp.status === 'PENDING' &&
      cp.pendingInteraction &&
      cp.pendingInteraction.type === 'SCOPE_CONFIRMATION' &&
      disc.requirements.length > 0 &&
      disc.requirements.every((r) => r.resolutionState === 'SUPERSEDED' || r.resolutionState === 'REJECTED' || (r.scopeDisposition && r.scopeDisposition !== 'UNCLASSIFIED'));

    const isTransitioningConsumedState = isAnsweredDiscoveryQuestion || isSatisfiedRequirementConfirmation || isSatisfiedScopeConfirmation;

    if (!isTransitioningConsumedState) {
      if (cp.discoveryRevision !== disc.revision) {
        throw new IdeaWorkflowError(
          `Workflow discoveryRevision (${cp.discoveryRevision}) does not match discovery.json revision (${disc.revision})`,
          'DK_WORKFLOW_DISCOVERY_BINDING_MISMATCH'
        );
      }
      if (cp.discoveryFingerprint !== disc.fingerprint) {
        throw new IdeaWorkflowError(
          `Workflow discoveryFingerprint (${cp.discoveryFingerprint}) does not match discovery.json fingerprint (${disc.fingerprint})`,
          'DK_WORKFLOW_DISCOVERY_BINDING_MISMATCH'
        );
      }
    }

    // 2. NOT_STARTED consistency: cannot be in advanced phase
    if (stage.state === 'NOT_STARTED') {
      if (cp.currentPhase !== 'INITIAL_DISCOVERY' && cp.currentPhase !== 'COMPLETE') {
        throw new IdeaWorkflowError('Idea stage is NOT_STARTED but workflow cursor indicates advanced phase', 'DK_WORKFLOW_CONSISTENCY_ERROR');
      }
    }

    // 3. DISCOVERY_IN_PROGRESS consistency: cannot be COMPLETE
    if (stage.state === 'DISCOVERY_IN_PROGRESS') {
      if (cp.currentPhase === 'COMPLETE') {
        throw new IdeaWorkflowError('Idea stage is DISCOVERY_IN_PROGRESS but workflow cursor is COMPLETE', 'DK_WORKFLOW_CONSISTENCY_ERROR');
      }
    }

    // 4. APPROVED consistency: cannot have pending interaction (unless transitioning from satisfied BRIEF_APPROVAL)
    if (stage.state === 'APPROVED') {
      if (cp.status === 'PENDING' && cp.pendingInteraction && cp.pendingInteraction.type !== 'NONE' && cp.pendingInteraction.type !== 'BRIEF_APPROVAL') {
        throw new IdeaWorkflowError('Idea stage is APPROVED but workflow cursor has a pending interaction', 'DK_WORKFLOW_CONSISTENCY_ERROR');
      }
    }

    // 5. COMPLETE phase consistency: only allowed when Idea Stage is APPROVED
    if (cp.currentPhase === 'COMPLETE' && stage.state !== 'APPROVED' && stage.state !== 'NOT_STARTED') {
      throw new IdeaWorkflowError(`Workflow cursor is COMPLETE but idea stage is ${stage.state} (must be APPROVED)`, 'DK_WORKFLOW_CONSISTENCY_ERROR');
    }

    // 6. READY_FOR_APPROVAL consistency: cannot have early interview/design/challenge pending
    if (stage.state === 'READY_FOR_APPROVAL') {
      if (['INITIAL_DISCOVERY', 'REQUIREMENTS_INTERVIEW', 'DESIGN_SYSTEM_SETUP', 'IDEA_CHALLENGE'].includes(cp.currentPhase)) {
        throw new IdeaWorkflowError(
          `Idea stage is READY_FOR_APPROVAL but workflow cursor is in early phase ${cp.currentPhase}`,
          'DK_WORKFLOW_CONSISTENCY_ERROR'
        );
      }
    }

    // 7. BRIEF_APPROVAL consistency: only when brief is READY_FOR_APPROVAL
    if (cp.currentPhase === 'BRIEF_APPROVAL' && stage.state !== 'READY_FOR_APPROVAL' && stage.state !== 'APPROVED') {
      throw new IdeaWorkflowError(
        `Workflow cursor is BRIEF_APPROVAL but Idea Brief is not READY_FOR_APPROVAL (state is ${stage.state})`,
        'DK_WORKFLOW_CONSISTENCY_ERROR'
      );
    }

    // 8. SCOPE_CONFIRMATION consistency: active requirements must not be UNRESOLVED
    if (cp.currentPhase === 'SCOPE_CONFIRMATION') {
      const unconfirmed = disc.requirements.filter(
        (r) => r.resolutionState === 'UNRESOLVED' && r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED'
      );
      if (unconfirmed.length > 0) {
        throw new IdeaWorkflowError(
          `Workflow cursor is SCOPE_CONFIRMATION but active requirements remain UNRESOLVED (${unconfirmed.map(u => u.id).join(', ')})`,
          'DK_WORKFLOW_CONSISTENCY_ERROR'
        );
      }
    }

    // 9. REQUIREMENT_CONFIRMATION consistency: active requirement candidates must exist
    if (cp.currentPhase === 'REQUIREMENT_CONFIRMATION') {
      const activeCandidates = disc.requirements.filter(
        (r) => r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED'
      );
      if (activeCandidates.length === 0) {
        throw new IdeaWorkflowError(
          'Workflow cursor is REQUIREMENT_CONFIRMATION but no active candidate requirements exist',
          'DK_WORKFLOW_CONSISTENCY_ERROR'
        );
      }
    }

    // 10. DESIGN_SYSTEM_SETUP consistency: if canonical design authority is already resolved, cannot be pending setup
    if (cp.currentPhase === 'DESIGN_SYSTEM_SETUP' && cp.status === 'PENDING') {
      const designState = loadDesignSystemState(rootDir);
      if (designState && designState.status && designState.status !== 'unconfigured') {
        throw new IdeaWorkflowError(
          `Workflow cursor is DESIGN_SYSTEM_SETUP but canonical Design Authority is already resolved (${designState.status})`,
          'DK_WORKFLOW_CONSISTENCY_ERROR'
        );
      }
    }

    // 11. Discovery question binding
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
 * Determines whether Design Authority is applicable based on canonical design state,
 * explicit metadata, or discovery requirements.
 */
export function isDesignAuthorityApplicable(rootDir = process.cwd(), disc = null) {
  const canonical = loadDesignSystemState(rootDir);
  if (canonical && canonical.status === 'not_required') {
    return false;
  }
  if (canonical && (canonical.status === 'deferred' || canonical.status === 'approved' || canonical.status === 'references_requested')) {
    return true;
  }
  const discovery = disc || loadDiscoveryState(rootDir);
  // Check if any confirmed/stated requirement explicitly mentions non-visual / backend-only
  const isExplicitBackend = discovery.requirements.some((r) =>
    r.resolutionState !== 'REJECTED' && r.resolutionState !== 'SUPERSEDED' &&
    /\b(backend[- ]only|cli[- ]only|headless|non[- ]visual|no[- ]ui|library[- ]only)\b/i.test(r.statement)
  );
  if (isExplicitBackend) {
    return false;
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
    let isSatisfied = false;
    if (cp.pendingInteraction.type === 'DISCOVERY_QUESTION' && cp.pendingInteraction.id) {
      const q = disc.openQuestions.find((item) => item.id.toUpperCase() === cp.pendingInteraction.id.toUpperCase());
      if (q && (q.resolution === 'ANSWERED' || q.resolution === 'DEFERRED' || q.resolution === 'REJECTED' || q.resolution === 'SUPERSEDED')) {
        isSatisfied = true;
      }
    } else if (cp.pendingInteraction.type === 'REQUIREMENT_CONFIRMATION') {
      if (disc.requirements.length > 0 && disc.requirements.every((r) => r.resolutionState !== 'UNRESOLVED')) {
        isSatisfied = true;
      }
    } else if (cp.pendingInteraction.type === 'SCOPE_CONFIRMATION') {
      if (disc.requirements.length > 0 && disc.requirements.every((r) => r.resolutionState === 'SUPERSEDED' || r.resolutionState === 'REJECTED' || (r.scopeDisposition && r.scopeDisposition !== 'UNCLASSIFIED'))) {
        isSatisfied = true;
      }
    }

    if (isSatisfied) {
      return determineNextInteractionFromDiscovery(rootDir, ideaStage, disc, cp);
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
    const pi = {
      type: 'DISCOVERY_QUESTION',
      id: nextQ.id,
      prompt: nextQ.question,
      options: null,
    };
    pi.fingerprint = computeInteractionFingerprint(pi);
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'REQUIREMENTS_INTERVIEW',
      pendingInteraction: pi,
      status: 'PENDING',
      checkpoint: cp,
      action: 'ASK_DISCOVERY_QUESTION',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // Check Design Authority setup
  const isApplicable = isDesignAuthorityApplicable(rootDir, disc);
  const canonicalDesign = loadDesignSystemState(rootDir);
  const designSetupDone = canonicalDesign && canonicalDesign.status && canonicalDesign.status !== 'unconfigured';

  if (isApplicable && !designSetupDone && (!cp || cp.currentPhase === 'INITIAL_DISCOVERY' || cp.currentPhase === 'REQUIREMENTS_INTERVIEW')) {
    const pi = {
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
    };
    pi.fingerprint = computeInteractionFingerprint(pi);
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'DESIGN_SYSTEM_SETUP',
      pendingInteraction: pi,
      status: 'PENDING',
      checkpoint: cp,
      action: 'PROMPT_DESIGN_SYSTEM_SETUP',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // Check Idea Challenge
  const ideaChallengeDone = cp && (
    cp.currentPhase === 'REQUIREMENT_CONFIRMATION' ||
    cp.currentPhase === 'SCOPE_CONFIRMATION' ||
    cp.currentPhase === 'BRIEF_DRAFT' ||
    cp.currentPhase === 'BRIEF_APPROVAL' ||
    cp.currentPhase === 'COMPLETE'
  );
  if (!ideaChallengeDone && (cp?.currentPhase === 'DESIGN_SYSTEM_SETUP' || (!isApplicable && (!cp || cp.currentPhase === 'REQUIREMENTS_INTERVIEW')))) {
    const pi = {
      type: 'IDEA_CHALLENGE',
      id: 'INTERACTION-IDEA-CHALLENGE',
      prompt: 'Challenge assumptions and test whether this is the real problem.',
      options: [
        '1. Proceed with current problem formulation',
        '2. Challenge problem definition',
        '3. Custom write-in',
      ],
    };
    pi.fingerprint = computeInteractionFingerprint(pi);
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'IDEA_CHALLENGE',
      pendingInteraction: pi,
      status: 'PENDING',
      checkpoint: cp,
      action: 'PROMPT_IDEA_CHALLENGE',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // Check unconfirmed requirements
  const unconfirmedRequirements = disc.requirements.filter((r) => r.resolutionState === 'UNRESOLVED');
  if (unconfirmedRequirements.length > 0) {
    const pi = {
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
    };
    pi.fingerprint = computeInteractionFingerprint(pi);
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'REQUIREMENT_CONFIRMATION',
      pendingInteraction: pi,
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
    const pi = {
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
    };
    pi.fingerprint = computeInteractionFingerprint(pi);
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'SCOPE_CONFIRMATION',
      pendingInteraction: pi,
      status: 'PENDING',
      checkpoint: cp,
      action: 'PROMPT_SCOPE_CONFIRMATION',
      recommendedNextCommand: '/dk-idea',
    };
  }

  // If READY_FOR_APPROVAL
  if (ideaStage.state === 'READY_FOR_APPROVAL') {
    const pi = {
      type: 'BRIEF_APPROVAL',
      id: 'INTERACTION-BRIEF-APPROVAL',
      prompt: 'Please confirm explicit Product Owner approval for the canonical Idea Brief.',
      options: [
        '1. Approve Idea Brief',
        '2. Request changes',
        '3. Defer',
      ],
    };
    pi.fingerprint = computeInteractionFingerprint(pi);
    return {
      ideaStage: 'READY_FOR_APPROVAL',
      workflowPhase: 'BRIEF_APPROVAL',
      pendingInteraction: pi,
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
 * Public operation to present/persist the expected runtime-derived interaction.
 * Restricts callers from setting arbitrary phases or manufacturing workflow position.
 */
export function presentCurrentInteraction(rootDir = process.cwd(), payload = {}) {
  const state = resolveIdeaWorkflowState(rootDir);

  if (!state.pendingInteraction) {
    if (state.workflowPhase === 'COMPLETE') {
      return persistWorkflowCheckpoint(rootDir, {
        currentPhase: 'COMPLETE',
        pendingInteraction: null,
        status: 'COMPLETED',
      });
    }
    if (state.workflowPhase === 'BRIEF_DRAFT') {
      return persistWorkflowCheckpoint(rootDir, {
        currentPhase: 'BRIEF_DRAFT',
        pendingInteraction: null,
        status: 'IN_PROGRESS',
      });
    }
    return persistWorkflowCheckpoint(rootDir, {
      currentPhase: state.workflowPhase,
      pendingInteraction: null,
      status: 'NOT_STARTED',
    });
  }

  // If payload supplies interactionId or fingerprint, verify match with runtime derived
  if (payload.expectedInteractionId && payload.expectedInteractionId !== state.pendingInteraction.id) {
    throw new IdeaWorkflowError(
      `expectedInteractionId mismatch: got ${payload.expectedInteractionId}, runtime derived ${state.pendingInteraction.id}`,
      'DK_INTERACTION_ID_MISMATCH'
    );
  }
  if (payload.expectedFingerprint && payload.expectedFingerprint !== state.pendingInteraction.fingerprint) {
    throw new IdeaWorkflowError(
      `expectedFingerprint mismatch: got ${payload.expectedFingerprint}, runtime derived ${state.pendingInteraction.fingerprint}`,
      'DK_INTERACTION_FINGERPRINT_MISMATCH'
    );
  }

  return persistWorkflowCheckpoint(rootDir, {
    currentPhase: state.workflowPhase,
    pendingInteraction: state.pendingInteraction,
    status: 'PENDING',
  });
}

/**
 * Validates that an active matching pending interaction exists before consuming a Product Owner response.
 */
export function validatePendingInteractionForConsumption(rootDir = process.cwd(), expectedType, expectedId = null) {
  const cp = loadWorkflowCheckpoint(rootDir);
  if (!cp) {
    throw new IdeaWorkflowError(
      `Cannot consume response: no workflow checkpoint exists (expected pending ${expectedType})`,
      'DK_NO_MATCHING_PENDING_INTERACTION'
    );
  }
  if (cp.status !== 'PENDING') {
    throw new IdeaWorkflowError(
      `Cannot consume response: workflow status is ${cp.status} (must be PENDING)`,
      'DK_NO_MATCHING_PENDING_INTERACTION'
    );
  }
  if (!cp.pendingInteraction) {
    throw new IdeaWorkflowError(
      `Cannot consume response: no pending interaction exists in workflow checkpoint`,
      'DK_NO_MATCHING_PENDING_INTERACTION'
    );
  }
  if (cp.pendingInteraction.type !== expectedType) {
    throw new IdeaWorkflowError(
      `Cannot consume response: pending interaction type is ${cp.pendingInteraction.type}, expected ${expectedType}`,
      'DK_NO_MATCHING_PENDING_INTERACTION'
    );
  }
  if (expectedId && cp.pendingInteraction.id && cp.pendingInteraction.id.toUpperCase() !== expectedId.toUpperCase()) {
    throw new IdeaWorkflowError(
      `Cannot consume response: pending interaction ID is ${cp.pendingInteraction.id}, expected ${expectedId}`,
      'DK_NO_MATCHING_PENDING_INTERACTION'
    );
  }

  const computedFingerprint = computeInteractionFingerprint(cp.pendingInteraction);
  if (cp.pendingInteraction.fingerprint !== computedFingerprint) {
    throw new IdeaWorkflowError(
      `Cannot consume response: pending interaction fingerprint mismatch (${cp.pendingInteraction.fingerprint} !== ${computedFingerprint})`,
      'DK_INTERACTION_FINGERPRINT_MISMATCH'
    );
  }

  const disc = loadDiscoveryState(rootDir);
  if (cp.discoveryRevision !== disc.revision || cp.discoveryFingerprint !== disc.fingerprint) {
    throw new IdeaWorkflowError(
      `Cannot consume response: discovery state changed since interaction was presented (${cp.discoveryRevision} !== ${disc.revision})`,
      'DK_WORKFLOW_DISCOVERY_BINDING_MISMATCH'
    );
  }

  return cp;
}

/**
 * Record Design Authority Setup decision into canonical design-system-state.json and advance workflow
 */
export function recordDesignAuthoritySetup(rootDir = process.cwd(), { disposition, confirmedBy, details = null } = {}) {
  if (!disposition) {
    throw new IdeaWorkflowError('Design system disposition is required', 'DK_INVALID_DESIGN_SETUP');
  }
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for design setup", 'DK_UNAUTHORIZED_DESIGN_SETUP');
  }

  // Validate that DESIGN_SYSTEM_SETUP is the active pending interaction
  validatePendingInteractionForConsumption(rootDir, 'DESIGN_SYSTEM_SETUP', 'INTERACTION-DESIGN-SETUP');

  // Map disposition to canonical status
  let canonicalStatus = 'unconfigured';
  if (disposition === 'DEFERRED' || disposition === 'defer') {
    canonicalStatus = 'deferred';
  } else if (disposition === 'ATTACH_REFERENCES' || disposition === 'references_requested') {
    canonicalStatus = 'references_requested';
  } else if (disposition === 'EXISTING_DESIGN_MD' || disposition === 'existing') {
    canonicalStatus = 'draft';
  } else if (disposition === 'DERIVE_EXISTING_APP' || disposition === 'reference_analysis') {
    canonicalStatus = 'references_received';
  } else if (disposition === 'NEW_DIRECTION' || disposition === 'create_required') {
    canonicalStatus = 'unconfigured';
  } else if (disposition === 'NOT_REQUIRED' || disposition === 'not_required') {
    canonicalStatus = 'not_required';
  }

  // 1. Persist/update canonical Design Authority state in .development-kit/design-system-state.json
  persistDesignSystemState(rootDir, {
    status: canonicalStatus,
    disposition,
    confirmedBy,
    details: details || null,
  });

  // 2. Advance workflow cursor to IDEA_CHALLENGE
  const pi = {
    type: 'IDEA_CHALLENGE',
    id: 'INTERACTION-IDEA-CHALLENGE',
    prompt: 'Challenge assumptions and test whether this is the real problem.',
    options: [
      '1. Proceed with current problem formulation',
      '2. Challenge problem definition',
      '3. Custom write-in',
    ],
  };
  pi.fingerprint = computeInteractionFingerprint(pi);

  return persistWorkflowCheckpoint(rootDir, {
    currentPhase: 'IDEA_CHALLENGE',
    pendingInteraction: pi,
    status: 'PENDING',
  });
}

/**
 * Record Idea Challenge response and advance workflow to REQUIREMENT_CONFIRMATION
 */
export function recordIdeaChallengeResponse(rootDir = process.cwd(), { response, confirmedBy } = {}) {
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for idea challenge", 'DK_UNAUTHORIZED_IDEA_CHALLENGE');
  }

  validatePendingInteractionForConsumption(rootDir, 'IDEA_CHALLENGE', 'INTERACTION-IDEA-CHALLENGE');

  const disc = loadDiscoveryState(rootDir);
  const pi = {
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
  };
  pi.fingerprint = computeInteractionFingerprint(pi);

  return persistWorkflowCheckpoint(rootDir, {
    currentPhase: 'REQUIREMENT_CONFIRMATION',
    pendingInteraction: pi,
    status: 'PENDING',
  });
}

