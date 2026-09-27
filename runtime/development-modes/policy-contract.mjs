/**
 * Development Modes — Increment 001.
 * Pure policy definitions and resolution only. No bootstrap, persistence, lifecycle,
 * gate execution or approval-state mutation occurs in this module.
 */
export const DEVELOPMENT_MODE_SCHEMA_VERSION = 1;
export const DEFAULT_DEVELOPMENT_MODE = 'balanced';

export const DEVELOPMENT_MODES = Object.freeze({
  rapid: 'Rapid Development',
  balanced: 'Balanced Development',
  'spec-driven': 'Specification-Driven Development',
  'doc-driven': 'Documentation-Driven Development',
  'maintenance-evolution': 'Maintenance & Evolution',
});

const METHODOLOGIES = Object.freeze(['rapid', 'balanced', 'spec-driven', 'doc-driven']);

export const POLICY_VALUES = Object.freeze({
  planningDepth: Object.freeze(['minimal', 'standard', 'comprehensive']),
  documentationDepth: Object.freeze(['concise', 'standard', 'comprehensive']),
  architectureDepth: Object.freeze(['lightweight', 'core', 'comprehensive']),
  featureSpecifications: Object.freeze(['contextual', 'standard', 'mandatory']),
  testingDepth: Object.freeze(['essential', 'standard', 'contract', 'comprehensive']),
  documentationMaintenance: Object.freeze(['progressive', 'incremental', 'traceable', 'continuous']),
  governance: Object.freeze(['lightweight', 'standard', 'strict']),
  ownerAcceptance: Object.freeze(['baseline', 'per-increment']),
  // Context packing is a cost/preference setting, not a safety-strength ordering.
  contextPacking: Object.freeze(['lean', 'balanced', 'full']),
});

function freezeProfile(profile) {
  return Object.freeze({ ...profile });
}

const PROFILES = Object.freeze({
  rapid: freezeProfile({
    planningDepth: 'minimal',
    documentationDepth: 'concise',
    architectureDepth: 'lightweight',
    featureSpecifications: 'contextual',
    testingDepth: 'essential',
    documentationMaintenance: 'progressive',
    governance: 'lightweight',
    ownerAcceptance: 'baseline',
    contextPacking: 'lean',
  }),
  balanced: freezeProfile({
    planningDepth: 'standard',
    documentationDepth: 'standard',
    architectureDepth: 'core',
    featureSpecifications: 'standard',
    testingDepth: 'standard',
    documentationMaintenance: 'incremental',
    governance: 'standard',
    ownerAcceptance: 'per-increment',
    contextPacking: 'lean',
  }),
  'spec-driven': freezeProfile({
    planningDepth: 'standard',
    documentationDepth: 'standard',
    architectureDepth: 'core',
    featureSpecifications: 'mandatory',
    testingDepth: 'contract',
    documentationMaintenance: 'traceable',
    governance: 'strict',
    ownerAcceptance: 'per-increment',
    contextPacking: 'lean',
  }),
  'doc-driven': freezeProfile({
    planningDepth: 'comprehensive',
    documentationDepth: 'comprehensive',
    architectureDepth: 'comprehensive',
    featureSpecifications: 'mandatory',
    testingDepth: 'comprehensive',
    documentationMaintenance: 'continuous',
    governance: 'strict',
    ownerAcceptance: 'per-increment',
    contextPacking: 'balanced',
  }),
});

/**
 * This manifest describes invariants already owned by the existing runtime.
 * It is NOT a configurable gate list and does not claim to enforce the gates itself.
 */
export const MANDATORY_CONTROLS = Object.freeze([
  'canonical-nine-stage-lifecycle',
  'authoritative-development-contract',
  'independent-evidence-backed-verification',
  'source-freshness-and-provenance',
  'deterministic-runtime-acceptance',
  'execution-safety-and-required-human-approvals',
  'applicable-security-and-design-authority-controls',
  'release-validation',
]);

export class DevelopmentModeConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DevelopmentModeConfigurationError';
    this.code = 'DK_MODE_CONFIG_INVALID';
  }
}

function fail(message) {
  throw new DevelopmentModeConfigurationError(message);
}

function plainRecord(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail(`${field} must be a plain object`);
  }
}

function onlyKeys(value, allowed, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${field} contains unknown field: ${key}`);
  }
}

function validatePolicies(value, field, { strictProject = false } = {}) {
  if (value === undefined) return {};
  plainRecord(value, field);
  onlyKeys(value, Object.keys(POLICY_VALUES), field);
  const copy = {};
  for (const [key, selected] of Object.entries(value)) {
    if (strictProject && key === 'contextPacking') {
      fail('projectOverrides.contextPacking is not a stricter governance control; use customPolicies');
    }
    if (!POLICY_VALUES[key].includes(selected)) {
      fail(`${field}.${key} must be one of: ${POLICY_VALUES[key].join(', ')}`);
    }
    copy[key] = selected;
  }
  return copy;
}

export function getDefaultModeConfiguration() {
  return { schemaVersion: DEVELOPMENT_MODE_SCHEMA_VERSION, mode: DEFAULT_DEVELOPMENT_MODE };
}

export function getModeProfile(mode, { baseMethodology = DEFAULT_DEVELOPMENT_MODE } = {}) {
  if (!Object.hasOwn(DEVELOPMENT_MODES, mode)) fail(`Unknown development mode: ${String(mode)}`);
  if (mode === 'maintenance-evolution') {
    if (!METHODOLOGIES.includes(baseMethodology)) fail('Invalid maintenance baseMethodology');
    return freezeProfile(PROFILES[baseMethodology]);
  }
  return freezeProfile(PROFILES[mode]);
}

/**
 * Custom policies may adjust discretionary profile defaults. Project overrides may
 * only maintain or increase their rigor. Neither layer can address mandatory controls.
 * All inputs are validated before a new, immutable effective snapshot is returned.
 */
export function resolveDevelopmentModeConfiguration(config) {
  plainRecord(config, 'configuration');
  onlyKeys(config, ['schemaVersion', 'mode', 'baseMethodology', 'customPolicies', 'projectOverrides'], 'configuration');
  if (config.schemaVersion !== DEVELOPMENT_MODE_SCHEMA_VERSION) fail('Unsupported development mode schemaVersion');
  if (!Object.hasOwn(DEVELOPMENT_MODES, config.mode)) fail('Unknown or missing development mode');

  const maintenance = config.mode === 'maintenance-evolution';
  if (!maintenance && Object.hasOwn(config, 'baseMethodology')) {
    fail('baseMethodology is only valid for maintenance-evolution');
  }
  const baseMethodology = maintenance
    ? (config.baseMethodology ?? DEFAULT_DEVELOPMENT_MODE)
    : null;
  if (maintenance && !METHODOLOGIES.includes(baseMethodology)) fail('Invalid maintenance baseMethodology');

  const custom = validatePolicies(config.customPolicies, 'customPolicies');
  const project = validatePolicies(config.projectOverrides, 'projectOverrides', { strictProject: true });
  const effectivePolicies = { ...getModeProfile(config.mode, { baseMethodology }) };
  const policySources = Object.fromEntries(Object.keys(POLICY_VALUES).map((key) => [key,
    maintenance ? `maintenance-inherits:${baseMethodology}` : 'mode-profile']));
  for (const [key, value] of Object.entries(custom)) {
    effectivePolicies[key] = value;
    policySources[key] = 'customPolicies';
  }
  for (const [key, value] of Object.entries(project)) {
    if (POLICY_VALUES[key].indexOf(value) < POLICY_VALUES[key].indexOf(effectivePolicies[key])) {
      fail(`projectOverrides.${key} cannot weaken the selected profile/custom policy`);
    }
    effectivePolicies[key] = value;
    policySources[key] = 'projectOverrides';
  }
  return Object.freeze({
    schemaVersion: DEVELOPMENT_MODE_SCHEMA_VERSION,
    mode: config.mode,
    baseMethodology,
    existingProjectAuditRequired: maintenance,
    effectivePolicies: Object.freeze(effectivePolicies),
    policySources: Object.freeze(policySources),
    mandatoryControls: MANDATORY_CONTROLS,
  });
}
