import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  discoverConfigurationRequirements,
  saveConfigurationRegistry,
  loadConfigurationRegistry,
  evaluateConfigurationReadiness,
  saveConfigurationGateState,
  loadConfigurationGateState,
  prepareConfigurationTargets,
  generateConfigurationSetupGuide,
  validateConfigurationRequirement,
  recordConfigurationDecision,
  assertSecretTargetSafe,
  redactSensitiveValue,
  REQUIREMENT_STATUSES,
  GATE_STATES,
} from '../runtime/orchestration/configuration-readiness.mjs';

import {
  createPolicyBoundDevelopmentContract,
} from '../runtime/orchestration/contract-policy.mjs';

import {
  createVerificationRecord,
} from '../runtime/orchestration/evidence-store.mjs';

import {
  evaluateAcceptance,
} from '../runtime/orchestration/acceptance-engine.mjs';

import {
  buildContextPackage,
} from '../runtime/orchestration/context-package.mjs';

import {
  RuntimeApiService,
} from '../runtime/api/runtime-api-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');

const SENTINEL_SECRET = 'DKF_TEST_SECRET_DO_NOT_LEAK_94821';

function makeTempGitProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-cfg-sec-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // Initialize git repo
  spawnSync('git', ['init'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'DKF Test'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'test@dkf.local'], { cwd: dir });

  fs.mkdirSync(path.join(dir, '.development-kit', 'secrets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'spec.md'), '# Spec\nREQ-1: Auth\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'docs', 'architecture.md'), '# Architecture\nAuth boundary\n', 'utf8');

  // Initial commit
  spawnSync('git', ['add', '.'], { cwd: dir });
  spawnSync('git', ['commit', '-m', 'Initial commit'], { cwd: dir });

  return dir;
}

test('CFG-SEC-01: Sentinel secret is NEVER leaked to stdout, stderr, or log strings during validation', (t) => {
  const root = makeTempGitProject(t);

  // Write sentinel secret to .env.local
  fs.writeFileSync(path.join(root, '.env.local'), `SUPER_SECRET_KEY=${SENTINEL_SECRET}\n`, 'utf8');

  const req = {
    id: 'CFG-001',
    name: 'SUPER_SECRET_KEY',
    kind: 'secret',
    required: true,
    requiredBy: 'runtime-verification',
    target: { type: 'environment-variable', file: '.env.local', variable: 'SUPER_SECRET_KEY' }
  };

  const validation = validateConfigurationRequirement(root, req);
  assert.equal(validation.valid, true);

  // Stringify validation object and ensure SENTINEL_SECRET is absent
  const serialized = JSON.stringify(validation);
  assert.equal(serialized.includes(SENTINEL_SECRET), false, 'Sentinel secret leaked in validation record!');
});

test('CFG-SEC-02: Sentinel secret is NEVER saved into requirements.json or gate-state.json', (t) => {
  const root = makeTempGitProject(t);
  fs.writeFileSync(path.join(root, '.env.local'), `API_KEY=${SENTINEL_SECRET}\n`, 'utf8');

  const req = {
    id: 'CFG-001',
    name: 'API_KEY',
    kind: 'secret',
    required: true,
    requiredBy: 'runtime-verification',
    target: { type: 'environment-variable', file: '.env.local', variable: 'API_KEY' }
  };

  const registry = {
    schemaVersion: '1.0.0',
    projectId: 'test-proj',
    requirements: [req]
  };

  saveConfigurationRegistry(root, registry);
  const gateState = evaluateConfigurationReadiness({
    rootDir: root,
    requirements: [req]
  });
  saveConfigurationGateState(gateState, root);

  const reqContent = fs.readFileSync(path.join(root, '.development-kit', 'secrets', 'requirements.json'), 'utf8');
  assert.equal(reqContent.includes(SENTINEL_SECRET), false, 'Sentinel secret leaked into requirements.json!');

  const gateContent = fs.readFileSync(path.join(root, '.development-kit', 'secrets', 'gate-state.json'), 'utf8');
  assert.equal(gateContent.includes(SENTINEL_SECRET), false, 'Sentinel secret leaked into gate-state.json!');
});

test('CFG-SEC-03: Sentinel secret is NEVER emitted in SECRETS_SETUP.md guide', (t) => {
  const root = makeTempGitProject(t);
  fs.writeFileSync(path.join(root, '.env.local'), `STRIPE_KEY=${SENTINEL_SECRET}\n`, 'utf8');

  const req = {
    id: 'CFG-001',
    name: 'STRIPE_KEY',
    kind: 'secret',
    provider: 'Stripe',
    required: true,
    requiredBy: 'runtime-verification',
    target: { type: 'environment-variable', file: '.env.local', variable: 'STRIPE_KEY' }
  };

  const guidePath = generateConfigurationSetupGuide(root, [req]);
  const guideContent = fs.readFileSync(guidePath, 'utf8');
  assert.equal(guideContent.includes(SENTINEL_SECRET), false, 'Sentinel secret leaked into SECRETS_SETUP.md!');
});

test('CFG-SEC-04: Sentinel secret is NEVER injected into AI role context packages', (t) => {
  const root = makeTempGitProject(t);
  fs.writeFileSync(path.join(root, '.env.local'), `DATABASE_PASSWORD=${SENTINEL_SECRET}\n`, 'utf8');

  const req = {
    id: 'CFG-001',
    name: 'DATABASE_PASSWORD',
    kind: 'secret',
    required: true,
    requiredBy: 'implementation',
    target: { type: 'environment-variable', file: '.env.local', variable: 'DATABASE_PASSWORD' }
  };

  const task = {
    id: 'TASK-001',
    projectId: 'test-proj',
    status: 'approved',
    objective: 'Test secret safety in context',
    scope: { in: ['All'], out: [] },
    requirements: ['REQ-1'],
    acceptanceCriteria: [
      { id: 'AC-1', statement: 'DB connects securely', source: 'REQ-1', verificationType: ['test'] }
    ],
    architectureConstraints: [],
    securityConstraints: [],
    risk: { level: 1, reasons: [] },
    requiredVerification: ['specification'],
    requiredReviewers: ['spec-reviewer'],
    configurationDependencies: [req],
  };

  const contract = createPolicyBoundDevelopmentContract({
    rootDir: root,
    task,
    authoritativeSources: [
      { path: 'docs/spec.md', kind: 'specification', authority: 'required' },
    ],
    createdAt: '2026-09-01T12:00:00.000Z',
  });

  const contextPkg = buildContextPackage({
    contract,
    role: 'implementation-agent',
    rootDir: root,
  });

  const serialized = JSON.stringify(contextPkg);
  assert.equal(serialized.includes(SENTINEL_SECRET), false, 'Sentinel secret leaked into role context package!');
});

test('CFG-SEC-05: Sentinel secret is NEVER exposed in Runtime API or Control Center responses', async (t) => {
  const root = makeTempGitProject(t);
  fs.writeFileSync(path.join(root, '.env.local'), `TOKEN=${SENTINEL_SECRET}\n`, 'utf8');

  const registry = {
    schemaVersion: '1.0.0',
    projectId: 'test-proj',
    requirements: [
      {
        id: 'CFG-001',
        name: 'TOKEN',
        kind: 'secret',
        status: REQUIREMENT_STATUSES.VALID,
        required: true,
        requiredBy: 'runtime-verification',
        target: { type: 'environment-variable', file: '.env.local', variable: 'TOKEN' }
      }
    ]
  };
  saveConfigurationRegistry(root, registry);

  const api = new RuntimeApiService({ rootDir: root, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  // Check /v1/configuration-readiness
  const getRes = await fetch(`${started.url}/v1/configuration-readiness`);
  const getText = await getRes.text();
  assert.equal(getText.includes(SENTINEL_SECRET), false, 'Sentinel secret leaked in GET /v1/configuration-readiness!');

  // Check /v1/control-center/state
  const ccRes = await fetch(`${started.url}/v1/control-center/state`);
  const ccText = await ccRes.text();
  assert.equal(ccText.includes(SENTINEL_SECRET), false, 'Sentinel secret leaked in /v1/control-center/state!');
});

test('CFG-SEC-06: Git protection halts with security blocker if secret target is tracked by Git', (t) => {
  const root = makeTempGitProject(t);

  // Track .env.local in Git
  fs.writeFileSync(path.join(root, '.env.local'), 'SECRET_VAR=value\n', 'utf8');
  spawnSync('git', ['add', '.env.local'], { cwd: root });
  spawnSync('git', ['commit', '-m', 'Accidentally tracked .env.local'], { cwd: root });

  const safety = assertSecretTargetSafe(root, '.env.local');
  assert.equal(safety.safe, false);
  assert.equal(safety.tracked, true);
  assert.equal(safety.code, 'TARGET_TRACKED_BY_GIT');
  assert.match(safety.reason, /SECURITY BLOCKER/);

  // Validate requirement check reflects this security blocker
  const req = {
    id: 'CFG-001',
    name: 'SECRET_VAR',
    kind: 'secret',
    required: true,
    requiredBy: 'runtime-verification',
    target: { type: 'environment-variable', file: '.env.local', variable: 'SECRET_VAR' }
  };

  const validation = validateConfigurationRequirement(root, req);
  assert.equal(validation.status, REQUIREMENT_STATUSES.INVALID);
  assert.equal(validation.securityBlock, true);
});

test('CFG-SEC-07: redactSensitiveValue strips all instances of sensitive values', () => {
  const sensitive = [SENTINEL_SECRET, 'another-secret-token'];
  const text = `Log line: connect with ${SENTINEL_SECRET} or another-secret-token here`;
  const sanitized = redactSensitiveValue(text, sensitive);
  assert.equal(sanitized.includes(SENTINEL_SECRET), false);
  assert.equal(sanitized.includes('another-secret-token'), false);
  assert.match(sanitized, /\[REDACTED\]/);
});
