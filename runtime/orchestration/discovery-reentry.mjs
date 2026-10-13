import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

const AUTHORITY_STAGES = Object.freeze({
  specification: 'DEFINE',
  architecture: 'DESIGN',
  plan: 'PLAN',
  implementation: 'IMPLEMENT',
});
const AUTHORITY_APPROVAL_STAGES = new Set(['DEFINE', 'DESIGN']);
const REENTRY_ORDER = ['DEFINE', 'DESIGN', 'PLAN', 'IMPLEMENT'];
const DISCOVERY_STORE_ROOT = '.development-kit/discovery/events';
const discoveryFile = (rootDir, discoveryId) =>
  path.join(rootDir, DISCOVERY_STORE_ROOT, discoveryId + '.json');

function deriveAuthorityRequirements(classification, affectedAuthority) {
  if (!DISCOVERY_CLASSIFICATIONS.includes(classification)) {
    throw new DiscoveryError(`Unknown classification: ${classification}`);
  }
  if (!Array.isArray(affectedAuthority)) {
    throw new DiscoveryError('affectedAuthority must be an array');
  }
  const candidates = [REENTRY_STAGE_MAP[classification]];
  for (const authority of affectedAuthority) {
    if (!authority || typeof authority !== 'object' || Array.isArray(authority)) {
      throw new DiscoveryError('affectedAuthority entries must be objects');
    }
    requireText(authority.path, 'affectedAuthority.path');
    if (!Object.hasOwn(AUTHORITY_STAGES, authority.kind)) {
      throw new DiscoveryError(`Unknown affected authority kind: ${authority.kind}`);
    }
    if (authority.sections !== undefined &&
        (!Array.isArray(authority.sections) ||
          authority.sections.some(section => typeof section !== 'string' || !section.trim()))) {
      throw new DiscoveryError('affectedAuthority.sections must be an array of non-empty strings');
    }
    candidates.push(AUTHORITY_STAGES[authority.kind]);
  }
  const stage = candidates.sort((a, b) => REENTRY_ORDER.indexOf(a) - REENTRY_ORDER.indexOf(b))[0];
  return { stage, requiresHumanApproval: AUTHORITY_APPROVAL_STAGES.has(stage) };
}


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

  const { stage: expectedStage, requiresHumanApproval: mandatoryApproval } =
    deriveAuthorityRequirements(event.classification, event.affectedAuthority);
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
  if (event.requiresHumanApproval !== mandatoryApproval) {
    throw new DiscoveryError('Human approval requirement conflicts with authoritative discovery classification');
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

  return deriveAuthorityRequirements(classification, affectedAuthority);

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
  rootDir = null,
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
  if (rootDir !== null) persistDiscoveryEvent(event, rootDir);
  return event;
}

export function persistDiscoveryEvent(event, rootDir = process.cwd()) {
  validateDiscoveryEvent(event);
  const file = discoveryFile(rootDir, event.discoveryId);
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const content = JSON.stringify(event, null, 2) + '\n';
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') === content) return { path: file, created: false };
    throw new DiscoveryError('Refusing to overwrite a previously recorded discovery ID');
  }
  const temp = path.join(directory, '.pending-' + crypto.randomBytes(12).toString('hex'));
  const fd = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    // Exclusive publication: never replace an existing committed event.
    fs.linkSync(temp, file);
  } finally {
    fs.unlinkSync(temp);
  }
  return { path: file, created: true };
}

export function loadDiscoveryEvents(rootDir = process.cwd()) {
  const directory = path.join(rootDir, DISCOVERY_STORE_ROOT);
  if (!fs.existsSync(directory)) return [];
  const events = [];
  for (const name of fs.readdirSync(directory).filter(n => n.endsWith('.json')).sort()) {
    if (!/^disc-[a-zA-Z0-9_-]{8,64}\.json$/.test(name)) {
      throw new DiscoveryError('Unsafe discovery event filename');
    }
    const event = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
    validateDiscoveryEvent(event);
    if (name !== event.discoveryId + '.json') throw new DiscoveryError('Discovery event ID and filename disagree');
    events.push(event);
  }
  return events;
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
