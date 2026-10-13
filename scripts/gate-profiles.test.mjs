import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  resolveGateProfiles,
  resolveContractGateProfiles,
  validateGateProfile,
  GateProfileError,
  BUILTIN_GATE_PROFILES,
} from '../runtime/orchestration/gate-profiles.mjs';
import { createDevelopmentContract, validateDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';
import { decideAcceptance } from '../runtime/orchestration/acceptance-engine.mjs';

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

test('AC-023: custom IDs cannot shadow built-in UI or consequential approval gates', t => {
  const contract = makeValidContract(t, { riskLevel: 1 });
  for (const id of ['gp-ui-design', 'gp-consequential', 'gp-high-assurance']) {
    assert.throws(() => resolveGateProfiles({
      contract,
      profileIds: [id],
      customProfiles: {
        [id]: {
          schemaVersion: '1.0.0', profileId: id, name: 'Malicious downgrade',
          verificationClasses: [], requiredReviewers: [],
          requiredControlDomains: [], requiredHumanApprovals: [],
        },
      },
    }), /Built-in gate profile cannot be overridden/);
  }
  assert.throws(() => resolveGateProfiles({
    contract, profileIds: ['gp-custom-one'],
    customProfiles: {
      'gp-custom-one': {
        schemaVersion: '1.0.0', profileId: 'gp-custom-two',
        name: 'Wrong identity', verificationClasses: [],
        requiredReviewers: [], requiredControlDomains: [], requiredHumanApprovals: [],
      },
    },
  }), /Custom gate profile ID does not match requested ID/);
  for (const malformed of [null, {}, 'gp-ui-design', [null]]) {
    assert.throws(() => resolveGateProfiles({ contract, profileIds: malformed }), GateProfileError);
  }
});

test('AC-023: acceptance derives consequential human gate and high-assurance review from contract', (t) => {
  const rootDir = createTempProject(t);
  const contract = createDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-GP-REQUIRED',
      projectId: 'proj_gp',
      status: 'approved',
      objective: 'Required profile cannot be omitted at acceptance',
      scope: { in: ['runtime/'], out: [] },
      requirements: ['REQ-1'],
      acceptanceCriteria: ['Verify required profiles'],
      risk: { level: 1, reasons: [] },
      requiredVerification: ['tests'],
      approvalPolicy: { requiredGateProfileIds: ['gp-consequential', 'gp-high-assurance'] },
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
  });
  const gates = resolveContractGateProfiles(contract);
  assert.ok(gates.humanApprovals.includes('consequential-action'));
  assert.ok(gates.reviewers.includes('security-reviewer'));
  assert.ok(gates.controlDomains.includes('security'));
  const result = decideAcceptance({ contract, verification: null, rootDir });
  assert.equal(result.state, 'PENDING');
  assert.ok(result.pending.some(x => x.code === 'MISSING_REQUIRED_APPROVAL' &&
    x.approvalId === 'consequential-action'));
  assert.ok(result.pending.some(x => x.code === 'MISSING_REQUIRED_REVIEW' &&
    x.role === 'security-reviewer'));
  assert.ok(result.pending.some(x => x.code === 'MISSING_CONTROL_DOMAIN' &&
    x.domain === 'security'));
});

test('AC-023: immutable required custom profile cannot be shadowed or omitted at run decision', t => {
  const rootDir = createTempProject(t);
  const contract = createDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-GP-CUSTOM', projectId: 'proj_gp', status: 'approved',
      objective: 'Custom gate policy is contract-owned',
      scope: { in: ['runtime/'], out: [] },
      requirements: ['REQ-1'], acceptanceCriteria: ['Custom profile requirement'],
      approvalPolicy: {
        requiredGateProfileIds: ['gp-project-approval'],
        customGateProfiles: {
          'gp-project-approval': {
            schemaVersion: '1.0.0', profileId: 'gp-project-approval',
            name: 'Human scoped review', verificationClasses: ['tests'],
            requiredReviewers: ['code-reviewer'], requiredControlDomains: [],
            requiredHumanApprovals: ['project-specific-review'],
          },
        },
      },
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
  });
  assert.ok(resolveContractGateProfiles(contract).humanApprovals.includes('project-specific-review'));
  const decision = decideAcceptance({ contract, rootDir });
  assert.ok(decision.pending.some(x => x.approvalId === 'project-specific-review'));
  const tampered = structuredClone(contract);
  tampered.approvalPolicy.customGateProfiles['gp-high-assurance'] = {
    schemaVersion: '1.0.0', profileId: 'gp-high-assurance', name: 'Fake',
    verificationClasses: [], requiredReviewers: [],
    requiredControlDomains: [], requiredHumanApprovals: [],
  };
  assert.throws(() => resolveContractGateProfiles(tampered), /Built-in gate profile cannot be overridden/);
});

test('F7: High-risk contracts without explicit profiles automatically enforce gp-high-assurance requirements and block acceptance', (t) => {
  const rootDir = createTempProject(t);
  const contract = createDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-GP-HIGH-RISK',
      projectId: 'proj_gp_hr',
      status: 'approved',
      objective: 'High-risk contract must enforce gp-high-assurance even with empty profile list',
      scope: { in: ['runtime/'], out: [] },
      requirements: ['REQ-1'],
      acceptanceCriteria: [
        { id: 'AC-1', statement: 'High risk requirement', verificationType: ['tests'], requiredEvidence: true },
      ],
      risk: { level: 3, reasons: ['Elevated system risk'] },
      requiredVerification: ['tests'],
      approvalPolicy: {
        requiredGateProfileIds: [],
        customGateProfiles: {},
        targetCapabilities: [],
      },
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
  });

  const gates = resolveContractGateProfiles(contract);
  assert.ok(gates.appliedProfiles.includes('gp-high-assurance'), 'Must include gp-high-assurance in appliedProfiles');
  assert.ok(gates.verification.includes('security-audit'), 'Must include security-audit verification class');
  assert.ok(gates.verification.includes('architecture-verification'), 'Must include architecture-verification class');
  assert.ok(gates.reviewers.includes('security-reviewer'), 'Must include security-reviewer');
  assert.ok(gates.reviewers.includes('architecture-reviewer'), 'Must include architecture-reviewer');
  assert.ok(gates.controlDomains.includes('security'), 'Must include security control domain');

  // Verify that acceptance blocks when security and architecture evidence is missing
  const acceptance = decideAcceptance({ contract, rootDir });
  assert.equal(acceptance.state, 'PENDING');
  assert.ok(acceptance.pending.some(x => x.code === 'MISSING_REQUIRED_VERIFICATION' && x.verification === 'security-audit'));
  assert.ok(acceptance.pending.some(x => x.code === 'MISSING_REQUIRED_VERIFICATION' && x.verification === 'architecture-verification'));
  assert.ok(acceptance.pending.some(x => x.code === 'MISSING_REQUIRED_REVIEW' && x.role === 'security-reviewer'));
  assert.ok(acceptance.pending.some(x => x.code === 'MISSING_REQUIRED_REVIEW' && x.role === 'architecture-reviewer'));
});
