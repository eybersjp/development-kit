import crypto from 'node:crypto';

export const DISCOVERY_EVENT_SCHEMA_VERSION = '1.0.0';

export const DISCOVERY_CLASSIFICATIONS = Object.freeze([
  'implementation-defect',
  'plan-invalidation',
  'architecture-invalidation',
  'specification-invalidation',
]);

export const REENTRY_STAGE_MAP = Object.freeze({
  'implementation-defect': 'IMPLEMENT',
  'plan-invalidation': 'PLAN',
  'architecture-invalidation': 'DESIGN',
  'specification-invalidation': 'DEFINE',
});

const DISCOVERY_ID_PATTERN = /^disc-[a-zA-Z0-9_-]{8,64}$/;

export class DiscoveryError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'DiscoveryError';
    this.details = details;
  }
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DiscoveryError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

export function generateDiscoveryId(prefix = 'disc') {
  return `${prefix}-${crypto.randomBytes(12).toString('hex')}`;
}

export function validateDiscoveryEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new DiscoveryError('Discovery event must be an object');
  }

  if (event.schemaVersion !== DISCOVERY_EVENT_SCHEMA_VERSION) {
    throw new DiscoveryError(`Unsupported discovery event schema version: ${event.schemaVersion}`);
  }

  const discoveryId = requireText(event.discoveryId, 'discoveryId');
  if (!DISCOVERY_ID_PATTERN.test(discoveryId)) {
    throw new DiscoveryError(`discoveryId must match pattern ${DISCOVERY_ID_PATTERN}`);
  }

  requireText(event.lifecycleId, 'lifecycleId');

  if (!DISCOVERY_CLASSIFICATIONS.includes(event.classification)) {
    throw new DiscoveryError(`Invalid classification: ${event.classification}`);
  }

  requireText(event.description, 'description');

  if (!event.evidence || typeof event.evidence !== 'object') {
    throw new DiscoveryError('Discovery event requires evidence object');
  }
  requireText(event.evidence.type, 'evidence.type');
  requireText(event.evidence.reference, 'evidence.reference');

  if (!Array.isArray(event.affectedAuthority)) {
    throw new DiscoveryError('affectedAuthority must be an array');
  }

  const expectedStage = REENTRY_STAGE_MAP[event.classification];
  if (event.minimumReentryStage !== expectedStage) {
    throw new DiscoveryError(
      `minimumReentryStage mismatch for ${event.classification}: expected ${expectedStage}, got ${event.minimumReentryStage}`
    );
  }

  if (!Array.isArray(event.affectedTasks)) {
    throw new DiscoveryError('affectedTasks must be an array');
  }

  if (typeof event.requiresHumanApproval !== 'boolean') {
    throw new DiscoveryError('requiresHumanApproval must be a boolean');
  }

  return true;
}

export function resolveReentryStage({
  classification,
  affectedAuthority = [],
} = {}) {
  if (!DISCOVERY_CLASSIFICATIONS.includes(classification)) {
    throw new DiscoveryError(`Unknown classification: ${classification}`);
  }

  // Determine stage strictly based on classification authority hierarchy:
  // spec-invalidation -> DEFINE
  // arch-invalidation -> DESIGN
  // plan-invalidation -> PLAN
  // implementation-defect -> IMPLEMENT
  const stage = REENTRY_STAGE_MAP[classification];

  // Upstream authority changes (spec/arch) require human approval gate!
  const requiresHumanApproval = classification === 'specification-invalidation' || classification === 'architecture-invalidation';

  return {
    stage,
    requiresHumanApproval,
  };
}

export function createDiscoveryEvent({
  discoveryId = generateDiscoveryId(),
  lifecycleId,
  taskId = null,
  classification,
  description,
  evidence,
  affectedAuthority = [],
  affectedTasks = [],
  now = new Date().toISOString(),
} = {}) {
  const { stage, requiresHumanApproval } = resolveReentryStage({ classification, affectedAuthority });

  const event = {
    schemaVersion: DISCOVERY_EVENT_SCHEMA_VERSION,
    discoveryId,
    lifecycleId: requireText(lifecycleId, 'lifecycleId'),
    taskId: taskId ? requireText(taskId, 'taskId') : null,
    classification,
    description: requireText(description, 'description'),
    evidence: {
      type: requireText(evidence?.type, 'evidence.type'),
      reference: requireText(evidence?.reference, 'evidence.reference'),
      fingerprint: evidence?.fingerprint || null,
      details: evidence?.details || {},
    },
    affectedAuthority: Array.isArray(affectedAuthority) ? affectedAuthority : [],
    minimumReentryStage: stage,
    affectedTasks: Array.isArray(affectedTasks) ? [...new Set(affectedTasks.map(t => requireText(t, 'task')))] : [],
    requiresHumanApproval,
    createdAt: now,
  };

  validateDiscoveryEvent(event);
  return event;
}

/**
 * Selective invalidation resolver:
 * Invalidates only the tasks dependent on the affected resources/tasks,
 * preserving all unrelated accepted work.
 */
export function computeSelectiveInvalidation({
  allTasks = [],
  dependencyGraph = {},
  affectedTaskIds = [],
} = {}) {
  const affected = new Set(affectedTaskIds);
  const queue = [...affectedTaskIds];

  // Traverse downstream dependency graph
  while (queue.length > 0) {
    const current = queue.shift();
    for (const task of allTasks) {
      const deps = dependencyGraph[task.id] || task.dependsOn || [];
      if (deps.includes(current) && !affected.has(task.id)) {
        affected.add(task.id);
        queue.push(task.id);
      }
    }
  }

  const invalidatedTasks = [];
  const preservedTasks = [];

  for (const task of allTasks) {
    if (affected.has(task.id)) {
      invalidatedTasks.push(task.id);
    } else {
      preservedTasks.push(task.id);
    }
  }

  return {
    invalidatedTasks,
    preservedTasks,
    totalCount: allTasks.length,
    invalidatedCount: invalidatedTasks.length,
    preservedCount: preservedTasks.length,
  };
}
