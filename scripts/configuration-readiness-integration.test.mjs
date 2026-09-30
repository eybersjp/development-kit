import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  evaluateConfigurationReadiness,
  saveConfigurationRegistry,
  loadConfigurationRegistry,
  saveConfigurationGateState,
  loadConfigurationGateState,
  GATE_STATES,
  REQUIREMENT_STATUSES,
} from '../runtime/orchestration/configuration-readiness.mjs';

import {
  evaluateAcceptance,
  validateAcceptanceRecord,
} from '../runtime/orchestration/acceptance-engine.mjs';

import {
  createVerificationRecord,
} from '../runtime/orchestration/evidence-store.mjs';

import {
  validatePlanModel,
} from '../runtime/orchestration/plan-validator.mjs';

import {
  createDevelopmentContract,
  validateDevelopmentContract,
} from '../runtime/orchestration/development-contract.mjs';

import {
  enforceAutopilotOrchestrationGate,
} from '../runtime/autopilot/orchestration-result-gate.mjs';

import {
  createPolicyBoundDevelopmentContract,
} from '../runtime/orchestration/contract-policy.mjs';

import {
  RuntimeApiService,
} from '../runtime/api/runtime-api-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');

function makeTempProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-cfg-integration-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '.development-kit', 'secrets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'spec.md'), '# Spec\nREQ-1: Auth\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'docs', 'architecture.md'), '# Architecture\nAuth boundary\n', 'utf8');
  return dir;
}

function baseTask(overrides = {}) {
  return {
    id: 'TASK-001',
    projectId: 'test-proj',
    status: 'approved',
    objective: 'Implement payments',
    scope: { in: ['Payments'], out: [] },
    requirements: ['REQ-1'],
    acceptanceCriteria: [
      { id: 'AC-1', statement: 'Stripe charge succeeds', source: 'REQ-1', verificationType: ['test'] }
    ],
    architectureConstraints: ['Use Stripe SDK'],
    securityConstraints: ['Do not leak secret key'],
    risk: { level: 2, reasons: ['Payment processing'] },
    requiredVerification: ['specification', 'tests'],
    requiredReviewers: ['security-reviewer'],
    ...overrides,
  };
}

test('CFG-INT-01: Plan validator verifies configurationDependencies against available requirements', () => {
  const available = ['DATABASE_URL', 'STRIPE_SECRET_KEY'];

  // Valid plan
  const validPlan = {
    declaredTaskCount: 1,
    declaredDependencyEdges: [],
    requiredResources: [],
    requiredAcceptanceCriteria: ['AC-001'],
    availableConfigurationRequirements: available,
    tasks: [
      {
        id: 'TASK-001',
        dependsOn: [],
        acceptanceCriteria: ['AC-001'],
        owns: [],
        configurationDependencies: ['DATABASE_URL'],
      }
    ]
  };
  const validResult = validatePlanModel(validPlan);
  assert.equal(validResult.valid, true);

  // Invalid plan with unknown configuration dependency
  const invalidPlan = {
    declaredTaskCount: 1,
    declaredDependencyEdges: [],
    requiredResources: [],
    requiredAcceptanceCriteria: ['AC-001'],
    availableConfigurationRequirements: available,
    tasks: [
      {
        id: 'TASK-001',
        dependsOn: [],
        acceptanceCriteria: ['AC-001'],
        owns: [],
        configurationDependencies: ['NON_EXISTENT_KEY'],
      }
    ]
  };
  const invalidResult = validatePlanModel(invalidPlan);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.issues.some(i => i.code === 'UNKNOWN_CONFIGURATION_DEPENDENCY'));
});

test('CFG-INT-02: Contract creation supports schemaVersion 1.1.0 with configurationDependencies', (t) => {
  const root = makeTempProject(t);
  const task = baseTask({
    configurationDependencies: [
      {
        id: 'CFG-001',
        name: 'STRIPE_SECRET_KEY',
        kind: 'secret',
        required: true,
        requiredBy: 'runtime-verification',
        provider: 'Stripe',
      }
    ]
  });

  const contract = createDevelopmentContract({
    rootDir: root,
    task,
    authoritativeSources: [
      { path: 'docs/spec.md', kind: 'specification', authority: 'required' },
      { path: 'docs/architecture.md', kind: 'architecture', authority: 'required' },
    ],
    schemaVersion: '1.1.0',
    createdAt: '2026-09-01T12:00:00.000Z',
  });

  assert.equal(contract.schemaVersion, '1.1.0');
  assert.equal(contract.configurationDependencies.length, 1);
  assert.equal(contract.configurationDependencies[0].name, 'STRIPE_SECRET_KEY');
  assert.equal(validateDevelopmentContract(contract), true);
});

test('CFG-INT-03: Acceptance engine blocks acceptance when configuration action is required or invalid', (t) => {
  const root = makeTempProject(t);
  const contract = createPolicyBoundDevelopmentContract({
    rootDir: root,
    task: baseTask(),
    authoritativeSources: [
      { path: 'docs/spec.md', kind: 'specification', authority: 'required' },
    ],
    createdAt: '2026-09-01T12:00:00.000Z',
  });

  const verification = createVerificationRecord({
    contract,
    runId: 'run-001',
    role: 'spec-verifier',
    sourceFingerprint: contract.sourceFingerprint,
    createdAt: '2026-09-01T12:05:00.000Z',
    criteria: [
      { id: contract.acceptanceCriteria[0].id, verdict: 'PASS', status: 'PASS', evidence: [{ type: 'test', id: 'test-1' }] }
    ]
  });

  // Case 1: WAITING_FOR_USER blocks acceptance
  const waitingGate = {
    gate: 'SECRET_READINESS_GATE',
    state: GATE_STATES.WAITING_FOR_USER,
    blockingRequirements: ['CFG-001'],
  };
  const record1 = evaluateAcceptance({
    contract,
    verification,
    configurationReadiness: waitingGate,
    rootDir: root,
  });
  assert.equal(record1.state, 'BLOCKED');
  assert.ok(record1.blockers.some(b => b.code === 'CONFIGURATION_ACTION_REQUIRED'));

  // Case 2: BLOCKED configuration gate blocks acceptance
  const blockedGate = {
    gate: 'SECRET_READINESS_GATE',
    state: GATE_STATES.BLOCKED,
    blockingRequirements: ['CFG-001'],
  };
  const record2 = evaluateAcceptance({
    contract,
    verification,
    configurationReadiness: blockedGate,
    rootDir: root,
  });
  assert.equal(record2.state, 'BLOCKED');
  assert.ok(record2.blockers.some(b => b.code === 'CONFIGURATION_INVALID'));
});

test('CFG-INT-04: Acceptance engine handles deferred requirements and blocks release-critical dependencies', (t) => {
  const root = makeTempProject(t);
  const contract = createPolicyBoundDevelopmentContract({
    rootDir: root,
    task: baseTask(),
    authoritativeSources: [
      { path: 'docs/spec.md', kind: 'specification', authority: 'required' },
    ],
    createdAt: '2026-09-01T12:00:00.000Z',
  });

  const verification = createVerificationRecord({
    contract,
    runId: 'run-001',
    role: 'spec-verifier',
    sourceFingerprint: contract.sourceFingerprint,
    createdAt: '2026-09-01T12:05:00.000Z',
    criteria: [
      { id: contract.acceptanceCriteria[0].id, verdict: 'PASS', status: 'PASS', evidence: [{ type: 'test', id: 'test-1' }] }
    ]
  });

  // Save registry with release-critical deferred requirement
  const registry = {
    schemaVersion: '1.0.0',
    projectId: 'test-proj',
    requirements: [
      {
        id: 'CFG-001',
        name: 'PROD_DB_URL',
        kind: 'secret',
        status: REQUIREMENT_STATUSES.DEFERRED_BY_PRODUCT_OWNER,
        required: true,
        requiredBy: 'release',
      },
      {
        id: 'CFG-002',
        name: 'TEST_API_KEY',
        kind: 'secret',
        status: REQUIREMENT_STATUSES.DEFERRED_BY_PRODUCT_OWNER,
        required: true,
        requiredBy: 'runtime-verification',
      }
    ]
  };
  saveConfigurationRegistry(root, registry);

  const clearedWithDeferred = {
    gate: 'SECRET_READINESS_GATE',
    state: GATE_STATES.CLEARED_WITH_DEFERRED_REQUIREMENTS,
    blockingRequirements: [],
    deferredRequirements: ['CFG-001', 'CFG-002'],
  };

  const record = evaluateAcceptance({
    contract,
    verification,
    configurationReadiness: clearedWithDeferred,
    rootDir: root,
  });

  // Because CFG-001 is requiredBy 'release', acceptance MUST be BLOCKED
  assert.equal(record.state, 'BLOCKED');
  assert.ok(record.blockers.some(b => b.code === 'CONFIGURATION_RELEASE_REQUIREMENT_MISSING' && b.requirementId === 'CFG-001'));
  assert.ok(record.pending.some(p => p.code === 'CONFIGURATION_VERIFICATION_DEFERRED' && p.requirementId === 'CFG-002'));
});

test('CFG-INT-05: CLI --operation=configuration-readiness discover, status, and decision', (t) => {
  const root = makeTempProject(t);
  const script = path.join(REPO_ROOT, 'scripts', 'orchestration.mjs');

  // Create .env.example
  fs.writeFileSync(path.join(root, '.env.example'), 'TEST_SECRET_VAR=placeholder\n', 'utf8');

  // 1. Discover
  const resDiscover = spawnSync(process.execPath, [
    script,
    '--operation=configuration-readiness',
    '--action=discover',
    `--input-json=${JSON.stringify({ rootDir: root })}`
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(resDiscover.status, 0, resDiscover.stderr);
  const jsonDiscover = JSON.parse(resDiscover.stdout);
  assert.equal(jsonDiscover.success, true);
  assert.ok(jsonDiscover.result.requirements.length >= 1);
  assert.equal(jsonDiscover.result.requirements[0].name, 'TEST_SECRET_VAR');

  // 2. Status
  const resStatus = spawnSync(process.execPath, [
    script,
    '--operation=configuration-readiness',
    '--action=status',
    `--input-json=${JSON.stringify({ rootDir: root })}`
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(resStatus.status, 0, resStatus.stderr);
  const jsonStatus = JSON.parse(resStatus.stdout);
  assert.equal(jsonStatus.success, true);
  assert.equal(jsonStatus.result.gate.gate, 'SECRET_READINESS_GATE');

  // 3. Defer Decision
  const reqId = jsonDiscover.result.requirements[0].id;
  const resDecision = spawnSync(process.execPath, [
    script,
    '--operation=configuration-readiness',
    '--action=decision',
    `--input-json=${JSON.stringify({ rootDir: root, requirementId: reqId, decision: 'defer', confirmed: true })}`
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(resDecision.status, 0, resDecision.stderr);
  const jsonDecision = JSON.parse(resDecision.stdout);
  assert.equal(jsonDecision.success, true);
  assert.equal(jsonDecision.result.result.requirement.status, 'DEFERRED_BY_PRODUCT_OWNER');
});

test('CFG-INT-06: Autopilot orchestration gate fails closed when configuration readiness is BLOCKED or WAITING', () => {
  const verifyState = {
    currentStage: 'VERIFY',
    orchestration: {
      activeContractId: 'INC-001',
      activeRunId: 'run-001',
      sourceFingerprint: `sha256:${'a'.repeat(64)}`,
      verificationVerdict: 'PASS',
      acceptanceState: 'ACCEPTED',
      requiredGates: [],
      completedGates: [],
    }
  };

  // Attempting to complete VERIFY while configuration is WAITING_FOR_USER throws
  assert.throws(() => {
    enforceAutopilotOrchestrationGate(verifyState, {
      status: 'completed',
      orchestration: {
        ...verifyState.orchestration,
        configurationReadiness: {
          gateState: 'WAITING_FOR_USER',
          blockingRequirements: ['CFG-001'],
        }
      }
    });
  }, /VERIFY stage cannot complete while configuration readiness gate is WAITING_FOR_USER/);

  // Attempting to complete COMPLETE while configuration is BLOCKED throws
  const completeState = {
    ...verifyState,
    currentStage: 'COMPLETE',
  };
  assert.throws(() => {
    enforceAutopilotOrchestrationGate(completeState, {
      status: 'completed',
      orchestration: {
        ...completeState.orchestration,
        configurationReadiness: {
          gateState: 'BLOCKED',
          blockingRequirements: ['CFG-001'],
        }
      }
    });
  }, /COMPLETE stage cannot complete while configuration readiness gate is BLOCKED/);
});

test('CFG-INT-07: Runtime API exposes /v1/configuration-readiness and decision endpoint safely', async (t) => {
  const root = makeTempProject(t);
  const registry = {
    schemaVersion: '1.0.0',
    projectId: 'test-proj',
    requirements: [
      {
        id: 'CFG-001',
        name: 'SUPER_SECRET_TOKEN',
        kind: 'secret',
        status: REQUIREMENT_STATUSES.MISSING,
        required: true,
        requiredBy: 'runtime-verification',
        target: { type: 'environment-variable', file: '.env.local', variable: 'SUPER_SECRET_TOKEN' }
      }
    ]
  };
  saveConfigurationRegistry(root, registry);

  const api = new RuntimeApiService({ rootDir: root, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  // GET /v1/configuration-readiness
  const getRes = await fetch(`${started.url}/v1/configuration-readiness`);
  assert.equal(getRes.status, 200);
  const getJson = await getRes.json();
  assert.equal(getJson.gate.gate, 'SECRET_READINESS_GATE');
  assert.equal(getJson.requirements.length, 1);
  assert.equal(getJson.requirements[0].name, 'SUPER_SECRET_TOKEN');
  // Invariant: no plaintext value exposed
  assert.equal(getJson.requirements[0].value, undefined);

  // POST /v1/configuration-readiness/decision
  const postRes = await fetch(`${started.url}/v1/configuration-readiness/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify({
      requirementId: 'CFG-001',
      decision: 'defer',
      confirmed: true,
    })
  });
  assert.equal(postRes.status, 200);
  const postJson = await postRes.json();
  assert.equal(postJson.result.success, true);
  assert.equal(postJson.result.requirement.status, 'DEFERRED_BY_PRODUCT_OWNER');
});
