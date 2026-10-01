import { createHash } from 'node:crypto';
import {
  getDefaultModeConfiguration,
  resolveDevelopmentModeConfiguration,
} from './policy-contract.mjs';
import { inspectDevelopmentMode } from './config-store.mjs';

export const DEVELOPMENT_MODE_SNAPSHOT_SCHEMA_VERSION = 1;

export class DevelopmentModeIntegrationError extends Error {
  constructor(message, code = 'DK_MODE_INTEGRATION_INVALID') {
    super(message);
    this.name = 'DevelopmentModeIntegrationError';
    this.code = code;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function fingerprintPayload(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneResolved(resolved) {
  return {
    mode: resolved.mode,
    baseMethodology: resolved.baseMethodology,
    existingProjectAuditRequired: resolved.existingProjectAuditRequired,
    effectivePolicies: structuredClone(resolved.effectivePolicies),
    policySources: structuredClone(resolved.policySources),
    mandatoryControls: [...resolved.mandatoryControls],
  };
}

function snapshotPayload({ revision, selection, resolved, source }) {
  return {
    schemaVersion: DEVELOPMENT_MODE_SNAPSHOT_SCHEMA_VERSION,
    revision,
    selection,
    resolved,
    source,
  };
}

export function createDevelopmentModeSnapshot({
  revision,
  selection,
  source = 'persisted',
} = {}) {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new DevelopmentModeIntegrationError('Development Mode snapshot revision must be a non-negative integer');
  }
  if (!['persisted', 'backward-compatible-default'].includes(source)) {
    throw new DevelopmentModeIntegrationError(`Unsupported Development Mode snapshot source: ${source}`);
  }
  if (source === 'persisted' && revision < 1) {
    throw new DevelopmentModeIntegrationError('Persisted Development Mode snapshots require revision >= 1');
  }
  if (source === 'backward-compatible-default' && revision !== 0) {
    throw new DevelopmentModeIntegrationError('Backward-compatible default snapshot must use revision 0');
  }

  const normalizedSelection = structuredClone(selection);
  const resolved = cloneResolved(resolveDevelopmentModeConfiguration(normalizedSelection));
  const payload = snapshotPayload({ revision, selection: normalizedSelection, resolved, source });
  return deepFreeze({
    ...payload,
    fingerprint: fingerprintPayload(payload),
  });
}

export function validateDevelopmentModeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new DevelopmentModeIntegrationError('Development Mode snapshot must be an object');
  }
  const allowed = new Set(['schemaVersion', 'revision', 'selection', 'resolved', 'source', 'fingerprint']);
  for (const key of Object.keys(snapshot)) {
    if (!allowed.has(key)) {
      throw new DevelopmentModeIntegrationError(`Development Mode snapshot contains unsupported property: ${key}`);
    }
  }
  if (snapshot.schemaVersion !== DEVELOPMENT_MODE_SNAPSHOT_SCHEMA_VERSION) {
    throw new DevelopmentModeIntegrationError('Unsupported Development Mode snapshot schemaVersion');
  }

  const rebuilt = createDevelopmentModeSnapshot({
    revision: snapshot.revision,
    selection: snapshot.selection,
    source: snapshot.source,
  });

  if (JSON.stringify(canonicalize(snapshot.resolved)) !== JSON.stringify(canonicalize(rebuilt.resolved))) {
    throw new DevelopmentModeIntegrationError('Development Mode snapshot resolved policy does not match its selection');
  }
  if (snapshot.fingerprint !== rebuilt.fingerprint) {
    throw new DevelopmentModeIntegrationError('Development Mode snapshot fingerprint does not match content');
  }
  return true;
}

export function captureDevelopmentModeSnapshot(rootDir = process.cwd(), { allowBackwardCompatibleDefault = true } = {}) {
  const state = inspectDevelopmentMode(rootDir);
  if (state.status === 'configured') {
    return createDevelopmentModeSnapshot({
      revision: state.revision,
      selection: state.selection,
      source: 'persisted',
    });
  }
  if (!allowBackwardCompatibleDefault) {
    throw new DevelopmentModeIntegrationError(
      'Development Mode configuration is absent; bootstrap or migrate the project first',
      'DK_MODE_CONFIGURATION_REQUIRED',
    );
  }
  return createDevelopmentModeSnapshot({
    revision: 0,
    selection: getDefaultModeConfiguration(),
    source: 'backward-compatible-default',
  });
}

const LEVEL_ORDER = Object.freeze(['small', 'standard', 'comprehensive']);

function maxLevel(left, right) {
  const a = LEVEL_ORDER.indexOf(left);
  const b = LEVEL_ORDER.indexOf(right);
  if (a < 0 || b < 0) {
    throw new DevelopmentModeIntegrationError('Artifact level must be small, standard, or comprehensive');
  }
  return LEVEL_ORDER[Math.max(a, b)];
}

export function resolveModeAwareArtifactLevel({
  baseLevel,
  behaviorChange = false,
  snapshot,
} = {}) {
  validateDevelopmentModeSnapshot(snapshot);
  let level = baseLevel;
  if (!LEVEL_ORDER.includes(level)) {
    throw new DevelopmentModeIntegrationError('baseLevel must be small, standard, or comprehensive');
  }

  const policies = snapshot.resolved.effectivePolicies;
  if (behaviorChange && policies.featureSpecifications === 'mandatory') {
    level = maxLevel(level, 'standard');
  }
  if (policies.planningDepth === 'comprehensive' || policies.documentationDepth === 'comprehensive') {
    level = behaviorChange || baseLevel !== 'small' ? maxLevel(level, 'comprehensive') : maxLevel(level, 'standard');
  }
  return level;
}

export function getDevelopmentModeGuidance(snapshot) {
  validateDevelopmentModeSnapshot(snapshot);
  const { resolved } = snapshot;
  const p = resolved.effectivePolicies;
  return deepFreeze({
    mode: resolved.mode,
    baseMethodology: resolved.baseMethodology,
    revision: snapshot.revision,
    fingerprint: snapshot.fingerprint,
    requireRepositoryAudit: resolved.existingProjectAuditRequired,
    requireFeatureSpecification: p.featureSpecifications === 'mandatory',
    featureSpecificationPolicy: p.featureSpecifications,
    planningDepth: p.planningDepth,
    documentationDepth: p.documentationDepth,
    architectureDepth: p.architectureDepth,
    testingDepth: p.testingDepth,
    documentationMaintenance: p.documentationMaintenance,
    governance: p.governance,
    ownerAcceptance: p.ownerAcceptance,
    contextPacking: p.contextPacking,
    mandatoryControls: [...resolved.mandatoryControls],
  });
}
