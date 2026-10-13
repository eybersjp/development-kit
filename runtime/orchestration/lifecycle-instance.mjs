import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CANONICAL_STAGES } from '../autopilot/transition-model.mjs';

export const LIFECYCLE_INSTANCE_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_LIFECYCLE_TYPE = 'standard';
export const DEFAULT_ROOT_LIFECYCLE_ID = 'lc-root-default';

export const LIFECYCLE_STATUSES = Object.freeze([
  'active',
  'completed',
  'paused',
  'blocked',
  'cancelled',
]);

const LIFECYCLE_ID_PATTERN = /^lc-[a-zA-Z0-9_-]{8,64}$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

export class LifecycleError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'LifecycleError';
    this.details = details;
  }
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new LifecycleError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value, label) {
  if (value === undefined || value === null) return null;
  return requireText(value, label);
}

function validateLifecycleId(id, label = 'lifecycleId') {
  const text = requireText(id, label);
  if (!LIFECYCLE_ID_PATTERN.test(text)) {
    throw new LifecycleError(`${label} must match pattern ${LIFECYCLE_ID_PATTERN}`);
  }
  return text;
}

export function generateLifecycleId(prefix = 'lc') {
  return `${prefix}-${crypto.randomBytes(12).toString('hex')}`;
}

export function validateLifecycleInstance(instance) {
  if (!instance || typeof instance !== 'object' || Array.isArray(instance)) {
    throw new LifecycleError('LifecycleInstance must be a non-null object');
  }

  if (instance.schemaVersion !== LIFECYCLE_INSTANCE_SCHEMA_VERSION) {
    throw new LifecycleError(`Unsupported lifecycle schema version: ${instance.schemaVersion}`);
  }

  validateLifecycleId(instance.lifecycleId, 'lifecycleId');
  if (instance.parentLifecycleId !== null) {
    validateLifecycleId(instance.parentLifecycleId, 'parentLifecycleId');
    if (instance.parentLifecycleId === instance.lifecycleId) {
      throw new LifecycleError('parentLifecycleId cannot equal lifecycleId');
    }
  }

  requireText(instance.type, 'type');
  requireText(instance.name, 'name');

  if (!CANONICAL_STAGES.includes(instance.stage)) {
    throw new LifecycleError(`Invalid canonical stage: ${instance.stage}`);
  }

  if (!LIFECYCLE_STATUSES.includes(instance.status)) {
    throw new LifecycleError(`Invalid lifecycle status: ${instance.status}`);
  }

  if (!Array.isArray(instance.targets)) {
    throw new LifecycleError('targets must be an array of strings');
  }
  for (const t of instance.targets) {
    requireText(t, 'target');
  }

  if (!Number.isInteger(instance.sourceRevision) || instance.sourceRevision < 1) {
    throw new LifecycleError('sourceRevision must be an integer >= 1');
  }

  if (typeof instance.sourceFingerprint !== 'string' || !SHA256_PATTERN.test(instance.sourceFingerprint)) {
    throw new LifecycleError(`sourceFingerprint must match sha256 pattern: ${instance.sourceFingerprint}`);
  }

  if (instance.completedStages !== undefined && instance.completedStages !== null) {
    if (!Array.isArray(instance.completedStages)) {
      throw new LifecycleError('completedStages must be an array');
    }
    for (const stage of instance.completedStages) {
      if (!CANONICAL_STAGES.includes(stage)) {
        throw new LifecycleError(`Invalid stage in completedStages: ${stage}`);
      }
    }
  }

  return true;
}

export function createLifecycleInstance({
  lifecycleId = generateLifecycleId(),
  parentLifecycleId = null,
  type = DEFAULT_LIFECYCLE_TYPE,
  name,
  stage = 'UNDERSTAND',
  status = 'active',
  targets = [],
  sourceRevision = 1,
  sourceFingerprint = 'sha256:' + '0'.repeat(64),
  completedStages = [],
  metadata = {},
  now = new Date().toISOString(),
} = {}) {
  const instanceName = name ? requireText(name, 'name') : `Lifecycle ${lifecycleId}`;
  const instance = {
    schemaVersion: LIFECYCLE_INSTANCE_SCHEMA_VERSION,
    lifecycleId: validateLifecycleId(lifecycleId, 'lifecycleId'),
    parentLifecycleId: parentLifecycleId ? validateLifecycleId(parentLifecycleId, 'parentLifecycleId') : null,
    type: requireText(type, 'type'),
    name: instanceName,
    stage: requireText(stage, 'stage'),
    status: requireText(status, 'status'),
    targets: Array.isArray(targets) ? [...new Set(targets.map(t => requireText(t, 'target')))] : [],
    sourceRevision: Number.isInteger(sourceRevision) && sourceRevision >= 1 ? sourceRevision : 1,
    sourceFingerprint: typeof sourceFingerprint === 'string' && SHA256_PATTERN.test(sourceFingerprint)
      ? sourceFingerprint
      : 'sha256:' + '0'.repeat(64),
    completedStages: Array.isArray(completedStages) ? [...new Set(completedStages)] : [],
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {},
    createdAt: now,
    updatedAt: now,
  };

  validateLifecycleInstance(instance);
  return instance;
}

export function advanceLifecycleStage(instance, nextStage, { now = new Date().toISOString() } = {}) {
  validateLifecycleInstance(instance);
  if (!CANONICAL_STAGES.includes(nextStage)) {
    throw new LifecycleError(`Unknown target canonical stage: ${nextStage}`);
  }

  const currentIndex = CANONICAL_STAGES.indexOf(instance.stage);
  const nextIndex = CANONICAL_STAGES.indexOf(nextStage);

  if (instance.status !== 'active') {
    throw new LifecycleError(`Cannot advance non-active lifecycle: ${instance.lifecycleId}`);
  }
  // Ordinary progression is strictly one canonical stage at a time. Controlled
  // backwards re-entry is a separate governed operation and cannot be achieved
  // by calling this low-level stage advancement helper.
  if (nextIndex !== currentIndex + 1) {
    throw new LifecycleError('Lifecycle stage transition must advance exactly one canonical stage');
  }

  const completedStages = new Set(instance.completedStages || []);
  if (currentIndex >= 0) {
    completedStages.add(instance.stage);
  }

  const updated = {
    ...instance,
    stage: nextStage,
    completedStages: Array.from(completedStages),
    updatedAt: now,
  };

  // Entering the COMPLETE stage does NOT mark the lifecycle accepted.
  // Only the independently evaluated deterministic acceptance result may
  // produce a completed status in evaluateLifecycleCompletion().
  updated.status = 'active';

  validateLifecycleInstance(updated);
  return updated;
}

/**
 * Evaluates completion semantics for a lifecycle instance.
 * - Scoped strictly to the specified lifecycle instance.
 * - Completing a child lifecycle instance does NOT complete or advance parent lifecycle instance.
 * - Parent acceptance is evaluated independently based on parent criteria and verification.
 * - External application/business domain status cannot complete or alter lifecycle state.
 */
export function evaluateLifecycleCompletion({
  instance,
  acceptanceState,
  domainState = null,
} = {}) {
  validateLifecycleInstance(instance);

  // Invariant DKF-120-AC-018: Arbitrary domain/business state cannot complete lifecycle.
  if (domainState !== null && domainState !== undefined) {
    if (typeof domainState === 'object') {
      const forbiddenBusinessFlags = [
        'isComplete', 'completed', 'released', 'shipped', 'approved', 'status'
      ];
      for (const flag of forbiddenBusinessFlags) {
        if (domainState[flag] === true || domainState[flag] === 'complete' || domainState[flag] === 'shipped') {
          // Explicitly ignore or isolate: business state flag does NOT dictate lifecycle completion!
        }
      }
    }
  }

  // Completion requires formal DKF acceptance state 'ACCEPTED' and stage 'COMPLETE' or transition to COMPLETE
  const isAccepted = acceptanceState === 'ACCEPTED';
  const isCompleteStage = instance.stage === 'COMPLETE';

  return {
    lifecycleId: instance.lifecycleId,
    parentLifecycleId: instance.parentLifecycleId,
    completed: isAccepted && isCompleteStage,
    status: (isAccepted && isCompleteStage) ? 'completed'
      : (instance.status === 'completed' ? 'active' : instance.status),
    acceptanceState: acceptanceState || 'PENDING',
  };
}

/**
 * Adapter ensuring legacy single-lifecycle projects continue to behave identically.
 */
export function ensureProjectLifecycle({
  stateEngine,
  rootDir = process.cwd(),
  legacyAutopilotState = null,
} = {}) {
  // If legacyAutopilotState exists and has no lifecycleId, bind to default root lifecycle
  if (legacyAutopilotState) {
    const existingLifecycleId = legacyAutopilotState.lifecycleId || DEFAULT_ROOT_LIFECYCLE_ID;
    return createLifecycleInstance({
      lifecycleId: existingLifecycleId,
      parentLifecycleId: null,
      type: 'legacy-project',
      name: 'Default Root Lifecycle',
      stage: legacyAutopilotState.currentStage || 'UNDERSTAND',
      status: legacyAutopilotState.workflowStatus === 'completed' ? 'completed' : 'active',
      sourceRevision: legacyAutopilotState.stateRevision || 1,
    });
  }

  return createLifecycleInstance({
    lifecycleId: DEFAULT_ROOT_LIFECYCLE_ID,
    parentLifecycleId: null,
    type: DEFAULT_LIFECYCLE_TYPE,
    name: 'Default Root Lifecycle',
    stage: 'UNDERSTAND',
    status: 'active',
  });
}
