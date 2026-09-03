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
import {
  loadDiscoveryState,
  computeDiscoveryFingerprint,
  confirmRequirementCandidate,
  adoptRequirementCandidate,
  rejectRequirementCandidate,
  supersedeRequirementCandidate,
  resolveOpenQuestion,
  supersedeOpenQuestion,
  classifyRequirementScope,
  batchPrepareRequirementConfirmation,
  batchCommitRequirementConfirmation,
  batchPrepareScopeClassification,
  batchCommitScopeClassification,
} from './idea-discovery.mjs';
import { computeIdeaStageState, approveCurrentIdeaBrief } from './idea-state.mjs';
import {
  appendConsumptionReceipt,
  findMatchingReceipt,
  loadConsumptions,
  validateConsumptionEvidence,
} from './idea-consumptions.mjs';
import {
  createPODecision,
  persistPODecision,
} from './po-decisions.mjs';

export const IDEA_WORKFLOW_SCHEMA_VERSION = '1.0.0';

export const IDEA_WORKFLOW_PHASES = Object.freeze([
  'INITIAL_DISCOVERY',
  'REQUIREMENTS_INTERVIEW',
  'DESIGN_APPLICABILITY_CHECK',
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
  'DESIGN_APPLICABILITY',
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
  'IN_PROGRESS',
  'NOT_STARTED',
]);

export const LEGAL_WORKFLOW_TRANSITIONS = Object.freeze({
  INITIAL_DISCOVERY: Object.freeze(['REQUIREMENTS_INTERVIEW', 'DESIGN_APPLICABILITY_CHECK', 'DESIGN_SYSTEM_SETUP', 'IDEA_CHALLENGE']),
  REQUIREMENTS_INTERVIEW: Object.freeze(['REQUIREMENTS_INTERVIEW', 'DESIGN_APPLICABILITY_CHECK', 'DESIGN_SYSTEM_SETUP', 'IDEA_CHALLENGE']),
  DESIGN_APPLICABILITY_CHECK: Object.freeze(['DESIGN_SYSTEM_SETUP', 'IDEA_CHALLENGE']),
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

export const VALID_DESIGN_SYSTEM_STATUSES = Object.freeze([
  'not_required',
  'unconfigured',
  'deferred',
  'references_requested',
  'references_received',
  'generating',
  'draft',
  'awaiting_approval',
  'approved',
  'amendment_pending',
  'superseded',
]);

export const VALID_DESIGN_SYSTEM_DISPOSITIONS = Object.freeze([
  'ATTACH_REFERENCES',
  'EXISTING_DESIGN_MD',
  'DERIVE_EXISTING_APP',
  'NEW_DIRECTION',
  'DEFERRED',
]);

export function validateDesignSystemStateStructure(data) {
  if (!data || typeof data !== 'object') {
    throw new IdeaWorkflowError('Invalid design-system-state.json: must be a JSON object', 'DK_DESIGN_STATE_CORRUPT');
  }
  if (data.schemaVersion !== 1) {
    throw new IdeaWorkflowError(`Invalid design-system-state schemaVersion: ${data.schemaVersion}`, 'DK_DESIGN_STATE_CORRUPT');
  }
  if (!VALID_DESIGN_SYSTEM_STATUSES.includes(data.status)) {
    throw new IdeaWorkflowError(`Invalid design-system-state status: ${data.status}`, 'DK_DESIGN_STATE_CORRUPT');
  }
  if (data.disposition !== null && data.disposition !== undefined && !VALID_DESIGN_SYSTEM_DISPOSITIONS.includes(data.disposition)) {
    throw new IdeaWorkflowError(`Invalid design-system-state disposition: ${data.disposition}`, 'DK_DESIGN_STATE_CORRUPT');
  }
  if (data.setupDisposition !== null && data.setupDisposition !== undefined && !VALID_DESIGN_SYSTEM_DISPOSITIONS.includes(data.setupDisposition)) {
    throw new IdeaWorkflowError(`Invalid design-system-state setupDisposition: ${data.setupDisposition}`, 'DK_DESIGN_STATE_CORRUPT');
  }

  // Candidate 20: Consistency checks
  if (data.confirmedBy === 'AI' || data.applicabilityConfirmedBy === 'AI' || data.setupDecisionAuthority === 'AI') {
    throw new IdeaWorkflowError('Design authority cannot be confirmed by AI', 'DK_DESIGN_STATE_CORRUPT');
  }

  if (data.applicable === false) {
    if (data.applicabilityConfirmedBy !== 'PRODUCT_OWNER') {
      throw new IdeaWorkflowError("applicable=false requires applicabilityConfirmedBy = 'PRODUCT_OWNER'", 'DK_DESIGN_STATE_CORRUPT');
    }
  }

  if (data.applicable !== null && data.applicable !== undefined) {
    if (data.applicabilityConfirmedBy && data.applicabilityConfirmedBy !== 'PRODUCT_OWNER') {
      throw new IdeaWorkflowError("Design applicability must be confirmed by PRODUCT_OWNER", 'DK_DESIGN_STATE_CORRUPT');
    }
    if (data.applicabilityDecisionId && (!data.applicabilityDecisionId.startsWith('POD-') || !data.applicabilityFingerprint)) {
      throw new IdeaWorkflowError("Design applicability decision requires valid decision ID and fingerprint", 'DK_DESIGN_STATE_CORRUPT');
    }
  }

  if (data.status === 'not_required') {
    if (data.applicable !== false) {
      throw new IdeaWorkflowError("status='not_required' requires applicable=false", 'DK_DESIGN_STATE_CORRUPT');
    }
  }

  if (data.applicable === true && data.status === 'not_required') {
    throw new IdeaWorkflowError("Contradictory state: applicable=true but status='not_required'", 'DK_DESIGN_STATE_CORRUPT');
  }

  if (data.updatedAt && isNaN(Date.parse(data.updatedAt))) {
    throw new IdeaWorkflowError(`Invalid updatedAt in design-system-state.json: ${data.updatedAt}`, 'DK_DESIGN_STATE_CORRUPT');
  }
  return true;
}

export function loadDesignSystemState(rootDir = process.cwd()) {
  const filePath = getDesignSystemStateFilePath(rootDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    validateDesignSystemStateStructure(data);
    return data;
  } catch (err) {
    if (err instanceof IdeaWorkflowError) throw err;
    throw new IdeaWorkflowError(`Corrupt design-system-state.json: ${err.message}`, 'DK_DESIGN_STATE_CORRUPT');
  }
}

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
    applicable: stateData.applicable !== undefined ? stateData.applicable : null,
    applicabilityConfirmedBy: stateData.applicabilityConfirmedBy || null,
    applicabilityDecisionId: stateData.applicabilityDecisionId || null,
    applicabilityFingerprint: stateData.applicabilityFingerprint || null,
    setupDisposition: stateData.setupDisposition || null,
    setupDecisionAuthority: stateData.setupDecisionAuthority || null,
    setupAnsweredAt: stateData.setupAnsweredAt || null,
    details: stateData.details || null,
    updatedAt: new Date().toISOString(),
  };

  validateDesignSystemStateStructure(payload);
  const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
  return payload;
}

export function persistWorkflowCheckpoint(rootDir = process.cwd(), checkpointData = {}) {
  const disc = loadDiscoveryState(rootDir);
  const dir = path.join(rootDir, '.development-kit', 'idea');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const existing = loadWorkflowCheckpoint(rootDir);
  const currentPhase = checkpointData.currentPhase || 'INITIAL_DISCOVERY';

  if (existing) {
    if (!isValidWorkflowTransition(existing.currentPhase, currentPhase)) {
      throw new IdeaWorkflowError(
        `Invalid workflow transition from ${existing.currentPhase} to ${currentPhase}`,
        'DK_INVALID_IDEA_WORKFLOW_TRANSITION'
      );
    }
  }

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

export function validateWorkflowConsistency(rootDir = process.cwd(), { ideaStage, discoveryState, checkpoint } = {}) {
  const stage = ideaStage || computeIdeaStageState(rootDir);
  const disc = discoveryState || loadDiscoveryState(rootDir);
  const cp = checkpoint !== undefined ? checkpoint : loadWorkflowCheckpoint(rootDir);

  if (stage.state === 'BLOCKED' && stage.blockerType === 'RUNTIME_FRAMEWORK') {
    throw new IdeaWorkflowError(`Lifecycle state is BLOCKED: ${stage.issues?.[0]?.message}`, stage.issues?.[0]?.code || 'DK_LIFECYCLE_STATE_CORRUPT');
  }

  if (cp) {
    if (cp.discoveryRevision !== disc.revision || cp.discoveryFingerprint !== disc.fingerprint) {
      // Candidate 20: Crash recovery reconciliation using durable consumption receipts
      let crashReconciled = false;
      try {
        const matchingReceipt = findMatchingReceipt(rootDir, {
          interactionFingerprint: cp.pendingInteraction?.fingerprint,
          workflowRevisionBefore: cp.workflowRevision,
          preDiscoveryRevision: cp.discoveryRevision,
          preDiscoveryFingerprint: cp.discoveryFingerprint,
        });

        if (matchingReceipt) {
          if (
            matchingReceipt.postDiscoveryRevision === disc.revision &&
            matchingReceipt.postDiscoveryFingerprint === disc.fingerprint &&
            matchingReceipt.authority === 'PRODUCT_OWNER'
          ) {
            crashReconciled = true;
          }
        }
      } catch (_) {
        // Any ambiguous or corrupted receipt fails closed below
      }

      if (!crashReconciled) {
        throw new IdeaWorkflowError(
          `Workflow discovery binding (${cp.discoveryRevision}:${cp.discoveryFingerprint}) does not match discovery.json (${disc.revision}:${disc.fingerprint})`,
          'DK_WORKFLOW_DISCOVERY_BINDING_MISMATCH'
        );
      }
    }

    if (stage.state === 'NOT_STARTED') {
      if (cp.currentPhase !== 'INITIAL_DISCOVERY' && cp.currentPhase !== 'COMPLETE') {
        throw new IdeaWorkflowError('Idea stage is NOT_STARTED but workflow cursor indicates advanced phase', 'DK_WORKFLOW_CONSISTENCY_ERROR');
      }
    }

    if (stage.state === 'DISCOVERY_IN_PROGRESS') {
      if (cp.currentPhase === 'COMPLETE') {
        throw new IdeaWorkflowError('Idea stage is DISCOVERY_IN_PROGRESS but workflow cursor is COMPLETE', 'DK_WORKFLOW_CONSISTENCY_ERROR');
      }
    }

    if (stage.state === 'APPROVED') {
      if (cp.status === 'PENDING' && cp.pendingInteraction && cp.pendingInteraction.type !== 'NONE') {
        throw new IdeaWorkflowError('Idea stage is APPROVED but workflow cursor has a pending interaction', 'DK_WORKFLOW_CONSISTENCY_ERROR');
      }
    }

    if (cp.currentPhase === 'COMPLETE' && stage.state !== 'APPROVED' && stage.state !== 'NOT_STARTED') {
      throw new IdeaWorkflowError(`Workflow cursor is COMPLETE but idea stage is ${stage.state} (must be APPROVED)`, 'DK_WORKFLOW_CONSISTENCY_ERROR');
    }

    if (stage.state === 'READY_FOR_APPROVAL') {
      if (['INITIAL_DISCOVERY', 'REQUIREMENTS_INTERVIEW', 'DESIGN_APPLICABILITY_CHECK', 'DESIGN_SYSTEM_SETUP', 'IDEA_CHALLENGE'].includes(cp.currentPhase)) {
        throw new IdeaWorkflowError(
          `Idea stage is READY_FOR_APPROVAL but workflow cursor is in early phase ${cp.currentPhase}`,
          'DK_WORKFLOW_CONSISTENCY_ERROR'
        );
      }
    }

    if (cp.currentPhase === 'BRIEF_APPROVAL' && stage.state !== 'READY_FOR_APPROVAL' && stage.state !== 'APPROVED') {
      throw new IdeaWorkflowError(
        `Workflow cursor is BRIEF_APPROVAL but Idea Brief is not READY_FOR_APPROVAL (state is ${stage.state})`,
        'DK_WORKFLOW_CONSISTENCY_ERROR'
      );
    }

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

    if (cp.currentPhase === 'DESIGN_SYSTEM_SETUP' && cp.status === 'PENDING') {
      const designState = loadDesignSystemState(rootDir);
      if (designState && (designState.setupDisposition != null || (designState.status && designState.status !== 'unconfigured'))) {
        throw new IdeaWorkflowError(
          `Workflow cursor is DESIGN_SYSTEM_SETUP but canonical Design Authority is already resolved (${designState.status})`,
          'DK_WORKFLOW_CONSISTENCY_ERROR'
        );
      }
    }

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

export function isDesignAuthorityApplicable(rootDir = process.cwd(), disc = null) {
  const canonical = loadDesignSystemState(rootDir);
  if (canonical && canonical.applicable === false && canonical.applicabilityConfirmedBy === 'PRODUCT_OWNER') {
    return false;
  }
  if (canonical && canonical.applicable === true) {
    return true;
  }
  if (canonical && canonical.status === 'not_required' && canonical.applicable === false) {
    return false;
  }
  if (canonical && (canonical.status === 'deferred' || canonical.status === 'approved' || canonical.status === 'references_requested')) {
    return true;
  }
  return null;
}

export function resolveIdeaWorkflowState(rootDir = process.cwd(), { bypassCheckpointValidation = false } = {}) {
  const ideaStage = computeIdeaStageState(rootDir);
  const disc = loadDiscoveryState(rootDir);
  const cp = loadWorkflowCheckpoint(rootDir);

  if (!bypassCheckpointValidation) {
    validateWorkflowConsistency(rootDir, { ideaStage, discoveryState: disc, checkpoint: cp });
  }

  // APPROVED is authoritative: the idea lifecycle overrides any stale checkpoint state.
  // This check must come before the checkpoint resume guard so that a PENDING BRIEF_APPROVAL
  // checkpoint is never resumed after approveCurrentIdeaBrief() has run.
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

  if (cp && cp.status === 'PENDING' && cp.pendingInteraction) {
    if (cp.discoveryRevision === disc.revision && cp.discoveryFingerprint === disc.fingerprint) {
      // Same-discovery receipt recovery must run before normal pending-interaction resume
      const matchingReceipt = findMatchingReceipt(rootDir, {
        interactionFingerprint: cp.pendingInteraction.fingerprint,
        workflowRevisionBefore: cp.workflowRevision,
        preDiscoveryRevision: cp.discoveryRevision,
        preDiscoveryFingerprint: cp.discoveryFingerprint,
      });
      if (matchingReceipt) {
        validateConsumptionEvidence(matchingReceipt, rootDir);
        // Interaction was proven consumed in this exact discovery state: reconcile and advance to next interaction
        return determineNextInteractionFromDiscovery(rootDir, ideaStage, disc, cp);
      }

      // Staleness guard: if the checkpoint phase is DESIGN_SYSTEM_SETUP or DESIGN_APPLICABILITY_CHECK
      // but canonical design authority is already resolved, the checkpoint is stale.
      let checkpointIsStale = false;
      if (cp.currentPhase === 'DESIGN_APPLICABILITY_CHECK') {
        const designState = loadDesignSystemState(rootDir);
        if (designState && designState.applicable !== null) {
          checkpointIsStale = true;
        }
      } else if (cp.currentPhase === 'DESIGN_SYSTEM_SETUP') {
        const designState = loadDesignSystemState(rootDir);
        if (designState && (designState.setupDisposition != null || (designState.status && designState.status !== 'unconfigured'))) {
          checkpointIsStale = true;
        }
      }
      if (!checkpointIsStale) {
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
    }
  }

  if (disc.requirements.length === 0 && disc.openQuestions.length === 0) {
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'INITIAL_DISCOVERY',
      pendingInteraction: null,
      status: 'NOT_STARTED',
      checkpoint: cp,
      action: 'START_INITIAL_DISCOVERY',
      recommendedNextCommand: '/dk-idea',
    };
  }

  return determineNextInteractionFromDiscovery(rootDir, ideaStage, disc, cp);
}

function determineNextInteractionFromDiscovery(rootDir, ideaStage, disc, cp) {
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

  const isApplicable = isDesignAuthorityApplicable(rootDir, disc);
  const canonicalDesign = loadDesignSystemState(rootDir);

  // If design applicability is not yet explicitly decided by Product Owner, prompt DESIGN_APPLICABILITY
  if (isApplicable === null && (!cp || cp.currentPhase === 'INITIAL_DISCOVERY' || cp.currentPhase === 'REQUIREMENTS_INTERVIEW')) {
    const pi = {
      type: 'DESIGN_APPLICABILITY',
      id: 'INTERACTION-DESIGN-APPLICABILITY',
      prompt: 'Does this product have a visual user interface requiring frontend design governance?',
      options: [
        '1. Visual user interface',
        '2. Non-visual/backend/CLI/library',
        '3. Custom write-in',
      ],
    };
    pi.fingerprint = computeInteractionFingerprint(pi);
    return {
      ideaStage: ideaStage.state,
      workflowPhase: 'DESIGN_APPLICABILITY_CHECK',
      pendingInteraction: pi,
      status: 'PENDING',
      checkpoint: cp,
      action: 'PROMPT_DESIGN_APPLICABILITY',
      recommendedNextCommand: '/dk-idea',
    };
  }

  const designSetupDone = canonicalDesign && (canonicalDesign.setupDisposition != null || (canonicalDesign.status && canonicalDesign.status !== 'unconfigured'));

  if (isApplicable === true && !designSetupDone && (!cp || cp.currentPhase === 'INITIAL_DISCOVERY' || cp.currentPhase === 'REQUIREMENTS_INTERVIEW' || cp.currentPhase === 'DESIGN_APPLICABILITY_CHECK')) {
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

  const ideaChallengeDone = cp && (
    cp.currentPhase === 'REQUIREMENT_CONFIRMATION' ||
    cp.currentPhase === 'SCOPE_CONFIRMATION' ||
    cp.currentPhase === 'BRIEF_DRAFT' ||
    cp.currentPhase === 'BRIEF_APPROVAL' ||
    cp.currentPhase === 'COMPLETE'
  );
  if (!ideaChallengeDone && (designSetupDone || isApplicable === false || (isApplicable === true && cp?.currentPhase === 'DESIGN_SYSTEM_SETUP'))) {
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

  const unclassifiedRequirements = disc.requirements.filter(
    (r) => r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED' && (!r.scopeDisposition || r.scopeDisposition === 'UNCLASSIFIED')
  );
  if (unclassifiedRequirements.length > 0) {
    const activeCandidates = disc.requirements.filter((r) => r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED');
    const existingProposal = (cp?.pendingInteraction?.type === 'SCOPE_CONFIRMATION' && cp.pendingInteraction.metadata?.scopeProposal)
      ? cp.pendingInteraction.metadata.scopeProposal
      : (disc.advisoryScopeProposal || null);

    const isCompleteProposal = existingProposal && typeof existingProposal === 'object' && activeCandidates.length > 0 && activeCandidates.every((req) => {
      const val = existingProposal[req.id] || existingProposal[req.id.toUpperCase()];
      return val && ['MUST', 'SHOULD', 'FUTURE', 'EXCLUDED'].includes(val.toUpperCase());
    });

    if (!isCompleteProposal) {
      // Do not present SCOPE_CONFIRMATION if complete proposal is not established
      return {
        ideaStage: ideaStage.state,
        workflowPhase: 'SCOPE_CONFIRMATION',
        pendingInteraction: null,
        status: 'IN_PROGRESS',
        checkpoint: cp,
        action: 'PROPOSE_SCOPE_CLASSIFICATION',
        recommendedNextCommand: '/dk-idea',
      };
    }

    const scopeProposal = {};
    for (const req of activeCandidates) {
      scopeProposal[req.id] = (existingProposal[req.id] || existingProposal[req.id.toUpperCase()]).toUpperCase();
    }

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
        candidates: activeCandidates,
        scopeProposal,
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

export function presentCurrentInteraction(rootDir = process.cwd(), payload = {}) {
  const state = resolveIdeaWorkflowState(rootDir, { bypassCheckpointValidation: true });

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

export function validatePendingInteractionForConsumption(rootDir = process.cwd(), expectedType, expectedId = null, expectedFingerprint = null) {
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

  if (!expectedFingerprint) {
    throw new IdeaWorkflowError(
      'Missing expectedInteractionFingerprint: Product Owner responses must bind exact presented interaction',
      'DK_MISSING_INTERACTION_FINGERPRINT'
    );
  }

  if (expectedFingerprint !== cp.pendingInteraction.fingerprint) {
    throw new IdeaWorkflowError(
      `Caller expected interaction fingerprint mismatch (${expectedFingerprint} !== ${cp.pendingInteraction.fingerprint})`,
      'DK_STALE_INTERACTION_RESPONSE'
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

export function recordDesignAuthoritySetup(rootDir = process.cwd(), {
  disposition,
  confirmedBy,
  details = null,
  expectedInteractionFingerprint = null,
} = {}) {
  if (!disposition || !VALID_DESIGN_SYSTEM_DISPOSITIONS.includes(disposition)) {
    throw new IdeaWorkflowError(`Invalid design system setup disposition: ${disposition}`, 'DK_INVALID_DESIGN_SETUP');
  }
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for design setup", 'DK_UNAUTHORIZED_DESIGN_SETUP');
  }

  const cp = validatePendingInteractionForConsumption(rootDir, 'DESIGN_SYSTEM_SETUP', 'INTERACTION-DESIGN-SETUP', expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);

  let canonicalStatus = 'unconfigured';
  if (disposition === 'DEFERRED') {
    canonicalStatus = 'deferred';
  } else if (disposition === 'ATTACH_REFERENCES') {
    canonicalStatus = 'references_requested';
  } else if (disposition === 'EXISTING_DESIGN_MD') {
    // Truthful semantics: do not claim draft unless design.md actually exists
    canonicalStatus = 'unconfigured';
  } else if (disposition === 'DERIVE_EXISTING_APP') {
    // Truthful semantics: do not claim references_received unless evidence ingested
    canonicalStatus = 'unconfigured';
  } else if (disposition === 'NEW_DIRECTION') {
    canonicalStatus = 'unconfigured';
  }

  persistDesignSystemState(rootDir, {
    status: canonicalStatus,
    disposition,
    confirmedBy,
    setupDisposition: disposition,
    setupDecisionAuthority: 'PRODUCT_OWNER',
    setupAnsweredAt: new Date().toISOString(),
    details: details || null,
  });

  const postDisc = loadDiscoveryState(rootDir);
  appendConsumptionReceipt(rootDir, {
    interactionType: 'DESIGN_SYSTEM_SETUP',
    interactionId: 'INTERACTION-DESIGN-SETUP',
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: [],
    resultingArtifactApprovalId: null,
  });

  return presentCurrentInteraction(rootDir);
}

export function recordIdeaChallengeResponse(rootDir = process.cwd(), {
  response,
  confirmedBy,
  expectedInteractionFingerprint = null,
} = {}) {
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for idea challenge", 'DK_UNAUTHORIZED_IDEA_CHALLENGE');
  }

  const cp = validatePendingInteractionForConsumption(rootDir, 'IDEA_CHALLENGE', 'INTERACTION-IDEA-CHALLENGE', expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);
  const postDisc = preDisc;

  appendConsumptionReceipt(rootDir, {
    interactionType: 'IDEA_CHALLENGE',
    interactionId: 'INTERACTION-IDEA-CHALLENGE',
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: [],
    resultingArtifactApprovalId: null,
  });

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
      candidates: postDisc.requirements.filter((r) => r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED'),
    },
  };
  pi.fingerprint = computeInteractionFingerprint(pi);

  return persistWorkflowCheckpoint(rootDir, {
    currentPhase: 'REQUIREMENT_CONFIRMATION',
    pendingInteraction: pi,
    status: 'PENDING',
  });
}

export function consumeDiscoveryQuestionResponse(rootDir = process.cwd(), {
  questionId,
  resolution = 'ANSWERED',
  resolvedBy,
  deferredTarget = null,
  notes = null,
  expectedInteractionFingerprint = null,
} = {}) {
  if (!questionId) {
    throw new IdeaWorkflowError('questionId is required to consume question response', 'DK_INVALID_QUESTION_ID');
  }
  if (!resolvedBy || resolvedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit resolvedBy = 'PRODUCT_OWNER' required to resolve discovery question", 'DK_UNAUTHORIZED_RESOLUTION');
  }

  const cp = validatePendingInteractionForConsumption(rootDir, 'DISCOVERY_QUESTION', questionId, expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);

  const updatedQ = resolveOpenQuestion(rootDir, {
    id: questionId,
    resolution,
    resolvedBy,
    deferredTarget,
    notes,
  });

  const postDisc = loadDiscoveryState(rootDir);
  const podId = updatedQ?.resolutionDecision?.decisionId;

  appendConsumptionReceipt(rootDir, {
    interactionType: 'DISCOVERY_QUESTION',
    interactionId: questionId,
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: podId ? [podId] : [],
    resultingArtifactApprovalId: null,
  });

  return presentCurrentInteraction(rootDir);
}

export function consumeRequirementConfirmation(rootDir = process.cwd(), {
  action = 'CONFIRM',
  confirmedBy,
  candidateIds = null,
  modifications = [],
  allowAdoption = false,
  expectedInteractionFingerprint = null,
} = {}) {
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for requirement confirmation", 'DK_UNAUTHORIZED_CONFIRMATION');
  }

  const cp = validatePendingInteractionForConsumption(rootDir, 'REQUIREMENT_CONFIRMATION', 'INTERACTION-REQ-CONFIRMATION', expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);

  if (action === 'MODIFY') {
    throw new IdeaWorkflowError(
      'action=MODIFY on consumeRequirementConfirmation is deprecated. Use consumeRequirementModification to supersede individual requirement candidates.',
      'DK_DEPRECATED_MODIFICATION_ACTION'
    );
  }

  // Candidate 20: Staged Commit Atomic Group Confirmation
  const prep = batchPrepareRequirementConfirmation(preDisc, confirmedBy, { allowAdoption });
  if (prep.status !== 'PREPARED') {
    throw new IdeaWorkflowError(
      `Requirement confirmation aborted: ${prep.errors.join('; ')}`,
      'DK_REQUIREMENT_CONFIRMATION_FAILED'
    );
  }

  batchCommitRequirementConfirmation(rootDir, prep);
  const postDisc = loadDiscoveryState(rootDir);

  appendConsumptionReceipt(rootDir, {
    interactionType: 'REQUIREMENT_CONFIRMATION',
    interactionId: 'INTERACTION-REQ-CONFIRMATION',
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: prep.pods.map((p) => p.id),
    resultingArtifactApprovalId: null,
  });

  return presentCurrentInteraction(rootDir);
}

export function consumeRequirementRejection(rootDir = process.cwd(), {
  id,
  confirmedBy,
  reason = null,
  expectedInteractionFingerprint = null,
} = {}) {
  if (!id) {
    throw new IdeaWorkflowError('Requirement ID required for rejection', 'DK_INVALID_REQ_ID');
  }
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for requirement rejection", 'DK_UNAUTHORIZED_DEACTIVATION');
  }

  const cp = validatePendingInteractionForConsumption(rootDir, 'REQUIREMENT_CONFIRMATION', 'INTERACTION-REQ-CONFIRMATION', expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);

  const updatedReq = rejectRequirementCandidate(rootDir, { id, confirmedBy, reason });
  const postDisc = loadDiscoveryState(rootDir);
  const podId = updatedReq?.deactivationDecision?.decisionId;

  appendConsumptionReceipt(rootDir, {
    interactionType: 'REQUIREMENT_CONFIRMATION',
    interactionId: 'INTERACTION-REQ-CONFIRMATION',
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: podId ? [podId] : [],
    resultingArtifactApprovalId: null,
  });

  return presentCurrentInteraction(rootDir);
}

export function consumeRequirementModification(rootDir = process.cwd(), {
  oldId,
  newCandidate,
  expectedInteractionFingerprint = null,
} = {}) {
  const cp = validatePendingInteractionForConsumption(rootDir, 'REQUIREMENT_CONFIRMATION', 'INTERACTION-REQ-CONFIRMATION', expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);

  const res = supersedeRequirementCandidate(rootDir, oldId, newCandidate);
  const postDisc = loadDiscoveryState(rootDir);
  const podId = res?.superseded?.supersessionDecision?.decisionId;

  appendConsumptionReceipt(rootDir, {
    interactionType: 'REQUIREMENT_CONFIRMATION',
    interactionId: 'INTERACTION-REQ-CONFIRMATION',
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: podId ? [podId] : [],
    resultingArtifactApprovalId: null,
  });

  presentCurrentInteraction(rootDir);
  return res;
}

export function consumeQuestionSupersession(rootDir = process.cwd(), {
  oldId,
  newQuestion,
  expectedInteractionFingerprint = null,
} = {}) {
  const cp = validatePendingInteractionForConsumption(rootDir, 'DISCOVERY_QUESTION', oldId, expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);

  const res = supersedeOpenQuestion(rootDir, oldId, newQuestion);
  const postDisc = loadDiscoveryState(rootDir);
  const podId = res?.superseded?.supersessionDecision?.decisionId;

  appendConsumptionReceipt(rootDir, {
    interactionType: 'DISCOVERY_QUESTION',
    interactionId: oldId,
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: podId ? [podId] : [],
    resultingArtifactApprovalId: null,
  });

  presentCurrentInteraction(rootDir);
  return res;
}

export function consumeScopeConfirmation(rootDir = process.cwd(), {
  scopeMapping = {},
  confirmedBy,
  expectedInteractionFingerprint = null,
} = {}) {
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for scope confirmation", 'DK_UNAUTHORIZED_SCOPE_CLASSIFICATION');
  }

  const cp = validatePendingInteractionForConsumption(rootDir, 'SCOPE_CONFIRMATION', 'INTERACTION-SCOPE-CONFIRMATION', expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);

  // Candidate 20: Bind to exact persisted scopeProposal metadata
  const expectedProposal = cp.pendingInteraction.metadata?.scopeProposal;
  if (expectedProposal) {
    for (const [reqId, expectedScope] of Object.entries(expectedProposal)) {
      const providedScope = scopeMapping[reqId] || scopeMapping[reqId.toUpperCase()];
      if (!providedScope || providedScope !== expectedScope) {
        throw new IdeaWorkflowError(
          `Scope proposal mismatch for ${reqId}: expected ${expectedScope}, provided ${providedScope || 'none'}`,
          'DK_SCOPE_PROPOSAL_MISMATCH'
        );
      }
    }
  }

  const prep = batchPrepareScopeClassification(preDisc, scopeMapping, confirmedBy);
  if (prep.status !== 'PREPARED') {
    throw new IdeaWorkflowError(
      `Scope classification aborted: ${prep.errors.join('; ')}`,
      'DK_SCOPE_CLASSIFICATION_FAILED'
    );
  }

  batchCommitScopeClassification(rootDir, prep);
  const postDisc = loadDiscoveryState(rootDir);

  appendConsumptionReceipt(rootDir, {
    interactionType: 'SCOPE_CONFIRMATION',
    interactionId: 'INTERACTION-SCOPE-CONFIRMATION',
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: prep.pods.map((p) => p.id),
    resultingArtifactApprovalId: null,
  });

  return presentCurrentInteraction(rootDir);
}

export function consumeBriefApproval(rootDir = process.cwd(), {
  approvingAuthority,
  linkedPodIds = [],
  expectedInteractionFingerprint = null,
} = {}) {
  if (!approvingAuthority || approvingAuthority !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit approvingAuthority = 'PRODUCT_OWNER' required for brief approval", 'DK_UNAUTHORIZED_APPROVAL');
  }

  const cp = validatePendingInteractionForConsumption(rootDir, 'BRIEF_APPROVAL', 'INTERACTION-BRIEF-APPROVAL', expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);

  const approval = approveCurrentIdeaBrief(rootDir, { approvingAuthority, linkedPodIds });
  const postDisc = loadDiscoveryState(rootDir);

  appendConsumptionReceipt(rootDir, {
    interactionType: 'BRIEF_APPROVAL',
    interactionId: 'INTERACTION-BRIEF-APPROVAL',
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: Array.isArray(linkedPodIds) ? linkedPodIds : [],
    resultingArtifactApprovalId: approval?.approvalId || null,
  });

  return presentCurrentInteraction(rootDir);
}

export function consumeDesignApplicabilityResponse(rootDir = process.cwd(), {
  choice,
  confirmedBy,
  expectedInteractionFingerprint = null,
} = {}) {
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for design applicability", 'DK_UNAUTHORIZED_DESIGN_APPLICABILITY');
  }
  if (!choice || typeof choice !== 'string') {
    throw new IdeaWorkflowError('Valid choice is required for design applicability', 'DK_INVALID_DESIGN_APPLICABILITY_CHOICE');
  }

  const cp = validatePendingInteractionForConsumption(rootDir, 'DESIGN_APPLICABILITY', 'INTERACTION-DESIGN-APPLICABILITY', expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);

  let applicable = null;
  const norm = choice.trim().toLowerCase();
  if (norm.startsWith('2') || norm.includes('non-visual') || norm.includes('backend') || norm.includes('cli') || norm.includes('library')) {
    applicable = false;
  } else if (norm.startsWith('1') || norm.includes('visual')) {
    applicable = true;
  } else {
    // Custom write-in: do not guess or infer applicable=false unless explicitly resolved
    throw new IdeaWorkflowError(
      'Custom write-in for design applicability must be explicitly resolved to visual (applicable=true) or non-visual (applicable=false)',
      'DK_AMBIGUOUS_DESIGN_APPLICABILITY'
    );
  }

  const podRevision = (preDisc.revision || 0) + 1;
  const poDecision = createPODecision({
    id: `POD-DESIGN-APPLICABILITY-${String(podRevision).padStart(3, '0')}`,
    statement: `Product Owner determined frontend design governance applicability: ${applicable ? 'APPLICABLE' : 'NOT_APPLICABLE'}`,
    status: 'APPROVED',
    provenance: 'product-owner',
    decisionType: 'DESIGN_APPLICABILITY',
    decisionData: {
      choice,
      applicable,
    },
    affectedRequirements: [],
  });
  persistPODecision(poDecision, rootDir);

  persistDesignSystemState(rootDir, {
    status: applicable ? 'unconfigured' : 'not_required',
    applicable,
    applicabilityConfirmedBy: 'PRODUCT_OWNER',
    applicabilityDecisionId: poDecision.id,
    applicabilityFingerprint: poDecision.fingerprint,
    decidedAt: poDecision.createdAt,
    confirmedBy: 'PRODUCT_OWNER',
  });

  const postDisc = loadDiscoveryState(rootDir);
  appendConsumptionReceipt(rootDir, {
    interactionType: 'DESIGN_APPLICABILITY',
    interactionId: 'INTERACTION-DESIGN-APPLICABILITY',
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: postDisc.revision,
    postDiscoveryFingerprint: postDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: [poDecision.id],
    resultingArtifactApprovalId: null,
  });

  return presentCurrentInteraction(rootDir);
}

export function recordScopeProposal(rootDir = process.cwd(), {
  scopeProposal = {},
} = {}) {
  const disc = loadDiscoveryState(rootDir);
  const activeCandidates = disc.requirements.filter((r) => r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED');
  if (activeCandidates.length === 0) {
    throw new IdeaWorkflowError('Cannot propose scope: no active requirements exist', 'DK_NO_ACTIVE_REQUIREMENTS');
  }

  const normalizedProposal = {};
  for (const req of activeCandidates) {
    const val = scopeProposal[req.id] || scopeProposal[req.id.toUpperCase()];
    if (!val || !['MUST', 'SHOULD', 'FUTURE', 'EXCLUDED'].includes(val.toUpperCase())) {
      throw new IdeaWorkflowError(`Complete scope proposal required. Missing or invalid classification for ${req.id}`, 'DK_INCOMPLETE_SCOPE_PROPOSAL');
    }
    normalizedProposal[req.id] = val.toUpperCase();
  }

  // Update discovery state advisoryScopeProposal
  disc.advisoryScopeProposal = normalizedProposal;
  const filePath = path.join(rootDir, '.development-kit', 'idea', 'discovery.json');
  const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(disc, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);

  return presentCurrentInteraction(rootDir);
}

export function consumeScopeAdjustment(rootDir = process.cwd(), {
  scopeProposal = {},
  confirmedBy,
  expectedInteractionFingerprint = null,
} = {}) {
  if (!confirmedBy || confirmedBy !== 'PRODUCT_OWNER') {
    throw new IdeaWorkflowError("Explicit confirmedBy = 'PRODUCT_OWNER' required for scope adjustment", 'DK_UNAUTHORIZED_SCOPE_ADJUSTMENT');
  }

  const cp = validatePendingInteractionForConsumption(rootDir, 'SCOPE_CONFIRMATION', 'INTERACTION-SCOPE-CONFIRMATION', expectedInteractionFingerprint);
  const preDisc = loadDiscoveryState(rootDir);
  const activeCandidates = preDisc.requirements.filter((r) => r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED');

  const normalizedProposal = {};
  for (const req of activeCandidates) {
    const val = scopeProposal[req.id] || scopeProposal[req.id.toUpperCase()];
    if (!val || !['MUST', 'SHOULD', 'FUTURE', 'EXCLUDED'].includes(val.toUpperCase())) {
      throw new IdeaWorkflowError(`Complete replacement scope proposal required. Missing or invalid for ${req.id}`, 'DK_INCOMPLETE_SCOPE_PROPOSAL');
    }
    normalizedProposal[req.id] = val.toUpperCase();
  }

  appendConsumptionReceipt(rootDir, {
    interactionType: 'SCOPE_CONFIRMATION',
    interactionId: 'INTERACTION-SCOPE-CONFIRMATION',
    interactionFingerprint: cp.pendingInteraction.fingerprint,
    workflowRevisionBefore: cp.workflowRevision,
    preDiscoveryRevision: preDisc.revision,
    preDiscoveryFingerprint: preDisc.fingerprint,
    postDiscoveryRevision: preDisc.revision,
    postDiscoveryFingerprint: preDisc.fingerprint,
    authority: 'PRODUCT_OWNER',
    resultingPodIds: [],
    resultingArtifactApprovalId: null,
  });

  const nextInteraction = {
    type: 'SCOPE_CONFIRMATION',
    id: 'INTERACTION-SCOPE-CONFIRMATION',
    prompt: 'Do you confirm this scope classification (Must, Should, Future, Excluded)?',
    options: [
      '1. Confirm scope classification',
      '2. Adjust scope classification',
      '3. Custom write-in',
    ],
    metadata: {
      candidates: activeCandidates,
      scopeProposal: normalizedProposal,
    },
  };
  nextInteraction.fingerprint = computeInteractionFingerprint(nextInteraction);

  return persistWorkflowCheckpoint(rootDir, {
    currentPhase: 'SCOPE_CONFIRMATION',
    pendingInteraction: nextInteraction,
    status: 'PENDING',
  });
}
