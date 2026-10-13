import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  resolveGateProfiles,
  validateGateProfile,
  GateProfileError,
  BUILTIN_GATE_PROFILES,
} from '../runtime/orchestration/gate-profiles.mjs';
import { createDevelopmentContract, validateDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';

function createTempProject(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-gate-profile-test-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Spec\nREQ-1: Valid spec\n', 'utf8');
  return rootDir;
}

function makeValidContract(t, { riskLevel = 1, requiredVerification = ['tests'], requiredReviewers = [] } = {}) {
  const rootDir = createTempProject(t);
  return createDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-GP-001',
      projectId: 'proj_gp_test',
      status: 'approved',
      objective: 'Gate profile testing contract',
      scope: { in: ['runtime/'], out: [] },
      requirements: ['REQ-1'],
      acceptanceCriteria: ['Valid criterion'],
      architectureConstraints: [],
      securityConstraints: [],
      risk: { level: riskLevel, reasons: ['Test risk reason'] },
      requiredVerification,
      requiredReviewers,
    },
    authoritativeSources: [
      { path: 'docs/spec.md', kind: 'specification', authority: 'required' }
    ],
    createdAt: new Date().toISOString(),
  });
}

test('AC-022: Gate profiles resolve generically from contract, risk, and target capabilities', (t) => {
  // Low-risk contract
  const lowRisk = makeValidContract(t, { riskLevel: 1 });
  const lowResult = resolveGateProfiles({ contract: lowRisk });
  assert.deepEqual(lowResult.reviewers, ['code-reviewer']);
  assert.deepEqual(lowResult.controlDomains, []);

  // High-risk contract (auto-resolves high assurance profile)
  const highRisk = makeValidContract(t, { riskLevel: 3 });
  const highResult = resolveGateProfiles({ contract: highRisk });
  assert.ok(highResult.reviewers.includes('architecture-reviewer'));
  assert.ok(highResult.reviewers.includes('security-reviewer'));
  assert.ok(highResult.controlDomains.includes('security'));

  // Target capabilities ('ui' auto-resolves gp-ui-design)
  const uiResult = resolveGateProfiles({
    contract: lowRisk,
    targetCapabilities: ['ui'],
  });
  assert.ok(uiResult.reviewers.includes('design-reviewer'));
  assert.ok(uiResult.verification.includes('browser-runtime-verification'));
});

test('AC-023: Profiles cannot downgrade existing mandatory verification or control gates', (t) => {
  const highRisk = makeValidContract(t, { riskLevel: 3 });

  // Custom adversarial profile attempting to declare empty reviewers
  const adversarialProfile = {
    schemaVersion: '1.0.0',
    profileId: 'gp-downgrade-attempt',
    name: 'Adversarial Downgrade',
    description: 'Attempts to downgrade gates',
    verificationClasses: [],
    requiredReviewers: [],
    requiredControlDomains: [],
    requiredHumanApprovals: [],
  };

  // Resolving against highRisk contract MUST still require high-risk mandatory gates (security, architecture)
  const result = resolveGateProfiles({
    contract: highRisk,
    profileIds: ['gp-downgrade-attempt'],
    customProfiles: { 'gp-downgrade-attempt': adversarialProfile },
  });

  assert.ok(result.reviewers.includes('security-reviewer'));
  assert.ok(result.reviewers.includes('architecture-reviewer'));
  assert.ok(result.controlDomains.includes('security'));
});

test('AC-023: Unknown required profile fails closed with GateProfileError', (t) => {
  const contract = makeValidContract(t, { riskLevel: 1 });
  assert.throws(
    () => resolveGateProfiles({ contract, profileIds: ['gp-unknown-profile-404'] }),
    /Unknown required gate profile: gp-unknown-profile-404/
  );
});
