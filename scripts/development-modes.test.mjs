import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DEVELOPMENT_MODE,
  DEVELOPMENT_MODES,
  MANDATORY_CONTROLS,
  POLICY_VALUES,
  DevelopmentModeConfigurationError,
  getDefaultModeConfiguration,
  getModeProfile,
  resolveDevelopmentModeConfiguration,
} from '../runtime/development-modes/policy-contract.mjs';

const config = (mode, extra = {}) => ({ schemaVersion: 1, mode, ...extra });
const resolve = (mode, extra) => resolveDevelopmentModeConfiguration(config(mode, extra));

test('MOD-001 exposes exactly five developer-facing modes and a balanced default', () => {
  assert.deepEqual(Object.keys(DEVELOPMENT_MODES), [
    'rapid', 'balanced', 'spec-driven', 'doc-driven', 'maintenance-evolution',
  ]);
  assert.equal(DEFAULT_DEVELOPMENT_MODE, 'balanced');
  assert.deepEqual(getDefaultModeConfiguration(), config('balanced'));
  assert.equal(resolveDevelopmentModeConfiguration(getDefaultModeConfiguration()).mode, 'balanced');
});

test('MOD-002 resolves every named mode to a complete, frozen policy', () => {
  for (const mode of Object.keys(DEVELOPMENT_MODES)) {
    const result = resolve(mode);
    assert.deepEqual(Object.keys(result.effectivePolicies), Object.keys(POLICY_VALUES));
    for (const [key, values] of Object.entries(POLICY_VALUES)) {
      assert.ok(values.includes(result.effectivePolicies[key]), `${mode} / ${key}`);
    }
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.effectivePolicies));
    assert.equal(result.existingProjectAuditRequired, mode === 'maintenance-evolution');
    assert.strictEqual(result.mandatoryControls, MANDATORY_CONTROLS);
  }
});

test('MOD-003 feature profiles have different real policy levels, not merely labels', () => {
  assert.equal(getModeProfile('rapid').featureSpecifications, 'contextual');
  assert.equal(getModeProfile('balanced').featureSpecifications, 'standard');
  assert.equal(getModeProfile('spec-driven').featureSpecifications, 'mandatory');
  assert.equal(getModeProfile('spec-driven').testingDepth, 'contract');
  assert.equal(getModeProfile('doc-driven').documentationDepth, 'comprehensive');
  assert.equal(getModeProfile('doc-driven').documentationMaintenance, 'continuous');
  assert.equal(getModeProfile('rapid').contextPacking, 'lean');
});

test('MOD-004 maintenance inherits a methodology but adds repository-audit obligation', () => {
  const base = resolve('rapid');
  const existing = resolve('maintenance-evolution', { baseMethodology: 'rapid' });
  assert.deepEqual(existing.effectivePolicies, base.effectivePolicies);
  assert.equal(existing.existingProjectAuditRequired, true);
  assert.equal(existing.baseMethodology, 'rapid');
  assert.equal(existing.policySources.planningDepth, 'maintenance-inherits:rapid');
  assert.equal(resolve('maintenance-evolution').baseMethodology, 'balanced');
});

test('MOD-005 customPolicies change discretionary settings with explicit provenance', () => {
  const result = resolve('doc-driven', {
    customPolicies: { governance: 'lightweight', ownerAcceptance: 'baseline', contextPacking: 'lean' },
  });
  assert.equal(result.effectivePolicies.governance, 'lightweight');
  assert.equal(result.effectivePolicies.ownerAcceptance, 'baseline');
  assert.equal(result.effectivePolicies.contextPacking, 'lean');
  assert.equal(result.policySources.ownerAcceptance, 'customPolicies');
  assert.strictEqual(result.mandatoryControls, MANDATORY_CONTROLS);
});

test('MOD-006 projectOverrides can only maintain or strengthen configured policies', () => {
  const result = resolve('rapid', {
    customPolicies: { testingDepth: 'standard' },
    projectOverrides: { testingDepth: 'contract', ownerAcceptance: 'per-increment' },
  });
  assert.equal(result.effectivePolicies.testingDepth, 'contract');
  assert.equal(result.policySources.testingDepth, 'projectOverrides');
  assert.throws(() => resolve('rapid', {
    customPolicies: { testingDepth: 'contract' },
    projectOverrides: { testingDepth: 'essential' },
  }), /cannot weaken/);
  assert.throws(() => resolve('balanced', {
    projectOverrides: { ownerAcceptance: 'baseline' },
  }), /cannot weaken/);
});

test('MOD-007 context-packing preference is not treated as a governance escalation', () => {
  assert.throws(() => resolve('balanced', {
    projectOverrides: { contextPacking: 'full' },
  }), /not a stricter governance control/);
  assert.equal(resolve('balanced', {
    customPolicies: { contextPacking: 'full' },
  }).effectivePolicies.contextPacking, 'full');
});

test('MOD-008 config rejects unknown fields, malformed policy and attempted safety bypasses', () => {
  const invalid = [
    null, [], 'balanced', {},
    { mode: 'balanced' },
    config('nonexistent'),
    config('balanced', { baseMethodology: 'rapid' }),
    config('maintenance-evolution', { baseMethodology: 'maintenance-evolution' }),
    config('balanced', { mandatoryControls: [] }),
    config('balanced', { approvalPolicy: { requiredApprovals: [] } }),
    config('balanced', { customPolicies: { independentVerification: false } }),
    config('balanced', { customPolicies: { testingDepth: 'none' } }),
    config('balanced', { customPolicies: [] }),
    config('balanced', { projectOverrides: { governance: null } }),
    config('balanced', { extra: true }),
    config('balanced', { schemaVersion: 2 }),
    config('balanced', { schemaVersion: '1' }),
    config('balanced', { customPolicies: JSON.parse('{"__proto__":"bypass"}') }),
  ];
  for (const item of invalid) {
    assert.throws(() => resolveDevelopmentModeConfiguration(item),
      (error) => error instanceof DevelopmentModeConfigurationError
        && error.code === 'DK_MODE_CONFIG_INVALID');
  }
});

test('MOD-009 no mode, customization or override can edit mandatory control manifest', () => {
  assert.ok(Object.isFrozen(MANDATORY_CONTROLS));
  assert.ok(MANDATORY_CONTROLS.includes('independent-evidence-backed-verification'));
  assert.ok(MANDATORY_CONTROLS.includes('execution-safety-and-required-human-approvals'));
  assert.ok(MANDATORY_CONTROLS.includes('deterministic-runtime-acceptance'));
  for (const mode of Object.keys(DEVELOPMENT_MODES)) {
    assert.deepEqual(resolve(mode).mandatoryControls, MANDATORY_CONTROLS);
  }
});

test('MOD-010 mode policy resolution is deterministic, read-only and does not mutate input', () => {
  const input = config('rapid', {
    customPolicies: { documentationDepth: 'comprehensive' },
    projectOverrides: { testingDepth: 'standard' },
  });
  const snapshot = JSON.stringify(input);
  const first = resolveDevelopmentModeConfiguration(input);
  const second = resolveDevelopmentModeConfiguration(input);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), snapshot);
  assert.notStrictEqual(first.effectivePolicies, input.customPolicies);
  assert.ok(Object.isFrozen(first.policySources));
});
