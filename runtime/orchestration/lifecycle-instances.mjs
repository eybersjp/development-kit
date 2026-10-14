import crypto from 'node:crypto';

import { CANONICAL_STAGES } from '../autopilot/transition-model.mjs';
import {
  appendEntityState,
  listEntityRecords,
  loadEntityState,
} from './state-engine-v2.mjs';

export const LIFECYCLE_INSTANCE_SCHEMA_VERSION = '1.0.0';
export const PROJECT_STATE_NAMESPACE_SCHEMA_VERSION = '1.0.0';
export const LIFECYCLE_ENTITY_TYPE = 'lifecycle-instance';
export const PROJECT_STATE_ENTITY_TYPE = 'project-state-namespace';

export const LIFECYCLE_STATUSES = Object.freeze([
  'ACTIVE',
  'PAUSED',
  'BLOCKED',
  'COMPLETE',
  'CANCELLED',
]);

export const LIFECYCLE_ACCEPTANCE_STATES = Object.freeze([
  'PENDING',
  'ACCEPTED',
  'BLOCKED',
]);

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

export class LifecycleInstanceError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'LifecycleInstanceError';
    this.details = details;
  }
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new LifecycleInstanceError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function identifier(value, label) {
  const normalized = requiredText(value, label);
  if (!ID_PATTERN.test(normalized)) {
    throw new LifecycleInstanceError(`${label} contains unsupported characters`);
  }
  return normalized;
}

function optionalIdentifier(value, label) {
  if (value === undefined || value === null) return null;
  return identifier(value, label);
}

function fingerprint(value, label = 'sourceFingerprint') {
  const normalized = requiredText(value, label);
  if (!SHA256_PATTERN.test(normalized)) {
    throw new LifecycleInstanceError(`${label} must be a sha256 fingerprint`);
  }
  return normalized;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new LifecycleInstanceError(`${label} must be a valid timestamp`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new LifecycleInstanceError(`${label} must be a positive integer`);
  }
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value)) throw new LifecycleInstanceError(`${label} must be an array`);
  const seen = new Set();
  return value.map((entry) => {
    const normalized = identifier(entry, `${label} entry`);
    if (seen.has(normalized)) throw new LifecycleInstanceError(`${label} contains duplicate entry: ${normalized}`);
    seen.add(normalized);
    return normalized;
  });
}

function cloneSerializable(value, label) {
  try {
    return structuredClone(value);
  } catch {
    throw new LifecycleInstanceError(`${label} must be serializable`);
  }
}

function lifecycleStatus(value) {
  const normalized = requiredText(value, 'status');
  if (!LIFECYCLE_STATUSES.includes(normalized)) {
    throw new LifecycleInstanceError(`Unsupported lifecycle status: ${normalized}`);
  }
  return normalized;
}

function acceptanceState(value) {
  const normalized = requiredText(value, 'acceptanceState');
  if (!LIFECYCLE_ACCEPTANCE_STATES.includes(normalized)) {
    throw new LifecycleInstanceError(`Unsupported acceptance state: ${normalized}`);
  }
  return normalized;
}

function canonicalStage(value) {
  const normalized = requiredText(value, 'stage');
  if (!CANONICAL_STAGES.includes(normalized)) {
    throw new LifecycleInstanceError(`Unsupported lifecycle stage: ${normalized}`);
  }
  return normalized;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

export function validateLifecycleInstance(instance) {
  if (!plainObject(instance)) throw new LifecycleInstanceError('Lifecycle Instance must be an object');
  if (instance.schemaVersion !== LIFECYCLE_INSTANCE_SCHEMA_VERSION) {
    throw new LifecycleInstanceError(`Unsupported lifecycle schemaVersion: ${instance.schemaVersion}`);
  }
  identifier(instance.lifecycleId, 'lifecycleId');
  optionalIdentifier(instance.parentLifecycleId, 'parentLifecycleId');
  if (instance.parentLifecycleId === instance.lifecycleId) {
    throw new LifecycleInstanceError('Lifecycle Instance may not parent itself');
  }
  requiredText(instance.type, 'type');
  requiredText(instance.name, 'name');
  canonicalStage(instance.stage);
  lifecycleStatus(instance.status);
  stringArray(instance.targets, 'targets');
  positiveInteger(instance.sourceRevision, 'sourceRevision');
  fingerprint(instance.sourceFingerprint);
  positiveInteger(instance.stateRevision, 'stateRevision');
  acceptanceState(instance.acceptanceState);
  optionalIdentifier(instance.acceptanceContractId, 'acceptanceContractId');
  optionalIdentifier(instance.acceptanceRunId, 'acceptanceRunId');
  if (instance.acceptanceState === 'ACCEPTED' && !instance.acceptedAt) {
    throw new LifecycleInstanceError('Accepted lifecycle requires acceptedAt');
  }
  if (instance.acceptedAt !== null) timestamp(instance.acceptedAt, 'acceptedAt');
  timestamp(instance.createdAt, 'createdAt');
  timestamp(instance.updatedAt, 'updatedAt');
  if (Date.parse(instance.updatedAt) < Date.parse(instance.createdAt)) {
    throw new LifecycleInstanceError('updatedAt may not precede createdAt');
  }
  if (instance.status === 'COMPLETE') {
    if (instance.stage !== 'COMPLETE') throw new LifecycleInstanceError('Completed lifecycle must be at COMPLETE stage');
    if (instance.acceptanceState !== 'ACCEPTED') throw new LifecycleInstanceError('Completed lifecycle requires ACCEPTED lifecycle acceptance');
  }
  return true;
}

function loadRequiredLifecycle(lifecycleId, rootDir) {
  const id = identifier(lifecycleId, 'lifecycleId');
  const value = loadEntityState(LIFECYCLE_ENTITY_TYPE, id, rootDir);
  if (!value) throw new LifecycleInstanceError(`Lifecycle Instance not found: ${id}`);
  validateLifecycleInstance(value);
  return value;
}

export function loadLifecycleInstance(lifecycleId, rootDir = process.cwd()) {
  const id = identifier(lifecycleId, 'lifecycleId');
  const value = loadEntityState(LIFECYCLE_ENTITY_TYPE, id, rootDir);
  if (!value) return null;
  validateLifecycleInstance(value);
  return value;
}

export function listLifecycleInstances(rootDir = process.cwd()) {
  return listEntityRecords(LIFECYCLE_ENTITY_TYPE, rootDir)
    .map((record) => loadRequiredLifecycle(record.entityId, rootDir))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.lifecycleId.localeCompare(b.lifecycleId));
}

export function listChildLifecycleInstances(parentLifecycleId, rootDir = process.cwd()) {
  const parentId = identifier(parentLifecycleId, 'parentLifecycleId');
  return listLifecycleInstances(rootDir)
    .filter((instance) => instance.parentLifecycleId === parentId);
}

export function createLifecycleInstance({
  lifecycleId,
  parentLifecycleId = null,
  type = 'development',
  name,
  stage = 'UNDERSTAND',
  status = 'ACTIVE',
  targets = [],
  sourceRevision = 1,
  sourceFingerprint,
  acceptanceState: initialAcceptanceState = 'PENDING',
  acceptanceContractId = null,
  acceptanceRunId = null,
  createdAt = new Date().toISOString(),
  rootDir = process.cwd(),
} = {}) {
  const id = identifier(lifecycleId, 'lifecycleId');
  if (loadLifecycleInstance(id, rootDir)) {
    throw new LifecycleInstanceError(`Lifecycle Instance already exists: ${id}`);
  }

  const parentId = optionalIdentifier(parentLifecycleId, 'parentLifecycleId');
  if (parentId === id) throw new LifecycleInstanceError('Lifecycle Instance may not parent itself');
  if (parentId !== null) {
    const parent = loadRequiredLifecycle(parentId, rootDir);
    if (parent.status === 'CANCELLED') {
      throw new LifecycleInstanceError('Cannot create a child beneath a cancelled lifecycle');
    }
  }

  const at = timestamp(createdAt, 'createdAt');
  const instance = {
    schemaVersion: LIFECYCLE_INSTANCE_SCHEMA_VERSION,
    lifecycleId: id,
    parentLifecycleId: parentId,
    type: requiredText(type, 'type'),
    name: requiredText(name, 'name'),
    stage: canonicalStage(stage),
    status: lifecycleStatus(status),
    targets: stringArray(targets, 'targets'),
    sourceRevision: positiveInteger(sourceRevision, 'sourceRevision'),
    sourceFingerprint: fingerprint(sourceFingerprint),
    stateRevision: 1,
    acceptanceState: acceptanceState(initialAcceptanceState),
    acceptanceContractId: optionalIdentifier(acceptanceContractId, 'acceptanceContractId'),
    acceptanceRunId: optionalIdentifier(acceptanceRunId, 'acceptanceRunId'),
    acceptedAt: initialAcceptanceState === 'ACCEPTED' ? at : null,
    createdAt: at,
    updatedAt: at,
  };
  validateLifecycleInstance(instance);

  appendEntityState({
    rootDir,
    entityType: LIFECYCLE_ENTITY_TYPE,
    entityId: id,
    state: instance,
    actorClass: 'lifecycle-engine',
    timestamp: at,
    refs: {
      lifecycleId: id,
      contractId: instance.acceptanceContractId,
      runId: instance.acceptanceRunId,
    },
  });
  return Object.freeze(structuredClone(instance));
}

function persistLifecycle(instance, rootDir, actorClass = 'lifecycle-engine') {
  validateLifecycleInstance(instance);
  appendEntityState({
    rootDir,
    entityType: LIFECYCLE_ENTITY_TYPE,
    entityId: instance.lifecycleId,
    state: instance,
    actorClass,
    timestamp: instance.updatedAt,
    refs: {
      lifecycleId: instance.lifecycleId,
      contractId: instance.acceptanceContractId,
      runId: instance.acceptanceRunId,
    },
  });
  return Object.freeze(structuredClone(instance));
}

export function transitionLifecycleStage({
  lifecycleId,
  toStage,
  updatedAt = new Date().toISOString(),
  rootDir = process.cwd(),
} = {}) {
  const current = loadRequiredLifecycle(lifecycleId, rootDir);
  if (['COMPLETE', 'CANCELLED'].includes(current.status)) {
    throw new LifecycleInstanceError(`Cannot transition lifecycle in ${current.status} status`);
  }

  const nextStage = canonicalStage(toStage);
  const fromIndex = CANONICAL_STAGES.indexOf(current.stage);
  const toIndex = CANONICAL_STAGES.indexOf(nextStage);
  if (toIndex < fromIndex) {
    throw new LifecycleInstanceError('Backward lifecycle stage movement requires controlled re-entry and is not permitted by T05');
  }
  if (toIndex > fromIndex + 1) {
    throw new LifecycleInstanceError('Lifecycle stages must advance one canonical stage at a time');
  }
  if (toIndex === fromIndex) return Object.freeze(structuredClone(current));

  const next = {
    ...structuredClone(current),
    stage: nextStage,
    stateRevision: current.stateRevision + 1,
    updatedAt: timestamp(updatedAt, 'updatedAt'),
  };
  return persistLifecycle(next, rootDir);
}

export function recordLifecycleAcceptance({
  lifecycleId,
  state,
  contractId = null,
  runId = null,
  acceptedAt = new Date().toISOString(),
  rootDir = process.cwd(),
} = {}) {
  const current = loadRequiredLifecycle(lifecycleId, rootDir);
  if (current.status === 'CANCELLED') throw new LifecycleInstanceError('Cannot accept a cancelled lifecycle');
  const nextAcceptance = acceptanceState(state);
  const at = timestamp(acceptedAt, 'acceptedAt');

  const next = {
    ...structuredClone(current),
    acceptanceState: nextAcceptance,
    acceptanceContractId: optionalIdentifier(contractId, 'contractId'),
    acceptanceRunId: optionalIdentifier(runId, 'runId'),
    acceptedAt: nextAcceptance === 'ACCEPTED' ? at : null,
    stateRevision: current.stateRevision + 1,
    updatedAt: at,
  };
  return persistLifecycle(next, rootDir, 'acceptance-engine');
}

export function completeLifecycleInstance({
  lifecycleId,
  completedAt = new Date().toISOString(),
  rootDir = process.cwd(),
} = {}) {
  const current = loadRequiredLifecycle(lifecycleId, rootDir);
  if (current.status === 'COMPLETE') return Object.freeze(structuredClone(current));
  if (current.stage !== 'COMPLETE') {
    throw new LifecycleInstanceError('Lifecycle cannot complete before reaching COMPLETE stage');
  }
  if (current.acceptanceState !== 'ACCEPTED') {
    throw new LifecycleInstanceError('Lifecycle cannot complete without ACCEPTED lifecycle acceptance');
  }
  const at = timestamp(completedAt, 'completedAt');
  const next = {
    ...structuredClone(current),
    status: 'COMPLETE',
    stateRevision: current.stateRevision + 1,
    updatedAt: at,
  };
  return persistLifecycle(next, rootDir);
}

export function setLifecycleStatus({
  lifecycleId,
  status,
  updatedAt = new Date().toISOString(),
  rootDir = process.cwd(),
} = {}) {
  const current = loadRequiredLifecycle(lifecycleId, rootDir);
  const nextStatus = lifecycleStatus(status);
  if (nextStatus === 'COMPLETE') {
    throw new LifecycleInstanceError('Use completeLifecycleInstance() for COMPLETE status');
  }
  if (current.status === 'COMPLETE') throw new LifecycleInstanceError('Completed lifecycle status is immutable');
  const at = timestamp(updatedAt, 'updatedAt');
  const next = {
    ...structuredClone(current),
    status: nextStatus,
    stateRevision: current.stateRevision + 1,
    updatedAt: at,
  };
  return persistLifecycle(next, rootDir);
}

function compatibilityFingerprint(workflowState) {
  const identity = JSON.stringify({
    projectId: workflowState.projectId,
    workflowId: workflowState.workflowId,
    frameworkVersion: workflowState.frameworkVersion,
  });
  return sha256(identity);
}

export function ensureSingleLifecycleForWorkflow({
  workflowState,
  lifecycleId = null,
  name = 'Development lifecycle',
  type = 'development',
  targets = [],
  sourceFingerprint = null,
  rootDir = process.cwd(),
} = {}) {
  if (!plainObject(workflowState)) throw new LifecycleInstanceError('workflowState must be an object');
  const workflowId = identifier(workflowState.workflowId, 'workflowState.workflowId');
  const id = lifecycleId ? identifier(lifecycleId, 'lifecycleId') : identifier(`lc-${workflowId}`, 'lifecycleId');
  const existing = loadLifecycleInstance(id, rootDir);
  if (existing) return existing;

  const stage = canonicalStage(workflowState.currentStage);
  const orchestrationAcceptance = workflowState.orchestration?.acceptanceState;
  const accepted = orchestrationAcceptance === 'ACCEPTED';
  const status = workflowState.workflowStatus === 'completed' && accepted ? 'COMPLETE' : 'ACTIVE';

  return createLifecycleInstance({
    lifecycleId: id,
    parentLifecycleId: null,
    type,
    name,
    stage,
    status,
    targets,
    sourceRevision: 1,
    sourceFingerprint: sourceFingerprint
      ?? workflowState.orchestration?.sourceFingerprint
      ?? compatibilityFingerprint(workflowState),
    acceptanceState: accepted ? 'ACCEPTED' : 'PENDING',
    acceptanceContractId: accepted ? workflowState.orchestration?.activeContractId ?? null : null,
    acceptanceRunId: accepted ? workflowState.orchestration?.activeRunId ?? null : null,
    createdAt: workflowState.createdAt ?? new Date().toISOString(),
    rootDir,
  });
}

function namespaceId(value, label) {
  const normalized = requiredText(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized)) {
    throw new LifecycleInstanceError(`${label} contains unsupported characters`);
  }
  return normalized;
}

export function validateProjectStateNamespace(record) {
  if (!plainObject(record)) throw new LifecycleInstanceError('Project state namespace record must be an object');
  if (record.schemaVersion !== PROJECT_STATE_NAMESPACE_SCHEMA_VERSION) {
    throw new LifecycleInstanceError(`Unsupported project state namespace schemaVersion: ${record.schemaVersion}`);
  }
  namespaceId(record.namespace, 'namespace');
  namespaceId(record.stateId, 'stateId');
  positiveInteger(record.stateRevision, 'stateRevision');
  timestamp(record.createdAt, 'createdAt');
  timestamp(record.updatedAt, 'updatedAt');
  cloneSerializable(record.value, 'value');
  return true;
}

function projectStateEntityId(namespace, stateId) {
  return `${namespaceId(namespace, 'namespace')}::${namespaceId(stateId, 'stateId')}`;
}

export function setProjectStateNamespace({
  namespace,
  stateId = 'default',
  value,
  updatedAt = new Date().toISOString(),
  rootDir = process.cwd(),
} = {}) {
  const ns = namespaceId(namespace, 'namespace');
  const id = namespaceId(stateId, 'stateId');
  const entityId = projectStateEntityId(ns, id);
  const current = loadEntityState(PROJECT_STATE_ENTITY_TYPE, entityId, rootDir);
  if (current) validateProjectStateNamespace(current);
  const at = timestamp(updatedAt, 'updatedAt');
  const record = {
    schemaVersion: PROJECT_STATE_NAMESPACE_SCHEMA_VERSION,
    namespace: ns,
    stateId: id,
    value: cloneSerializable(value, 'value'),
    stateRevision: (current?.stateRevision ?? 0) + 1,
    createdAt: current?.createdAt ?? at,
    updatedAt: at,
  };
  validateProjectStateNamespace(record);
  appendEntityState({
    rootDir,
    entityType: PROJECT_STATE_ENTITY_TYPE,
    entityId,
    state: record,
    actorClass: 'project-state',
    timestamp: at,
  });
  return Object.freeze(structuredClone(record));
}

export function loadProjectStateNamespace(namespace, stateId = 'default', rootDir = process.cwd()) {
  const entityId = projectStateEntityId(namespace, stateId);
  const value = loadEntityState(PROJECT_STATE_ENTITY_TYPE, entityId, rootDir);
  if (!value) return null;
  validateProjectStateNamespace(value);
  return value;
}

export function lifecycleSummary(instance) {
  validateLifecycleInstance(instance);
  return Object.freeze({
    lifecycleId: instance.lifecycleId,
    parentLifecycleId: instance.parentLifecycleId,
    type: instance.type,
    name: instance.name,
    stage: instance.stage,
    status: instance.status,
    acceptanceState: instance.acceptanceState,
    targets: [...instance.targets],
    sourceRevision: instance.sourceRevision,
    sourceFingerprint: instance.sourceFingerprint,
  });
}
