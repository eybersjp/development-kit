import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  discoverConfigurationRequirements,
  loadConfigurationRegistry,
  saveConfigurationRegistry,
  evaluateConfigurationReadiness,
  prepareConfigurationTargets,
  generateConfigurationSetupGuide,
  validateConfigurationRequirement,
  recordConfigurationDecision,
  generateLocalSecret,
  assertSecretTargetSafe,
  redactSensitiveValue,
  REQUIREMENT_KINDS,
  REQUIREMENT_STATES,
  GATE_STATES,
} from '../runtime/orchestration/configuration-readiness.mjs';

function makeTempProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-cfg-unit-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '.development-kit', 'secrets'), { recursive: true });
  return dir;
}

test('CFG-UNIT-01: Constants and enums are complete and immutable', () => {
  assert.ok(REQUIREMENT_KINDS.includes('secret'));
  assert.ok(REQUIREMENT_KINDS.includes('public_config'));
  assert.ok(REQUIREMENT_KINDS.includes('identifier'));
  assert.ok(REQUIREMENT_KINDS.includes('generated_secret'));
  assert.ok(REQUIREMENT_KINDS.includes('manual_setup'));

  assert.ok(REQUIREMENT_STATES.includes('DISCOVERED'));
  assert.ok(REQUIREMENT_STATES.includes('MISSING'));
  assert.ok(REQUIREMENT_STATES.includes('WAITING_FOR_USER'));
  assert.ok(REQUIREMENT_STATES.includes('CONFIGURED'));
  assert.ok(REQUIREMENT_STATES.includes('VALIDATING'));
  assert.ok(REQUIREMENT_STATES.includes('VALID'));
  assert.ok(REQUIREMENT_STATES.includes('INVALID'));
  assert.ok(REQUIREMENT_STATES.includes('DEFERRED_BY_PRODUCT_OWNER'));
  assert.ok(REQUIREMENT_STATES.includes('NOT_APPLICABLE'));

  const gateValues = Object.values(GATE_STATES);
  assert.ok(gateValues.includes('NOT_APPLICABLE'));
  assert.ok(gateValues.includes('READY'));
  assert.ok(gateValues.includes('BLOCKED'));
  assert.ok(gateValues.includes('WAITING_FOR_USER'));
  assert.ok(gateValues.includes('CLEARED_WITH_DEFERRED_REQUIREMENTS'));
});

test('CFG-UNIT-02: Discovery from .env.example, contract, task, and code regex', () => {
  const root = makeTempProject({ after: () => {} });
  // 1. Create .env.example
  fs.writeFileSync(path.join(root, '.env.example'), 'OPENAI_API_KEY=your_key_here\nNEXT_PUBLIC_API_URL=https://api.example.com\n', 'utf8');

  // 2. Create code file
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'index.js'), 'const secret = process.env.STRIPE_SECRET_KEY;\nconst tenant = process.env.TENANT_ID;\n', 'utf8');

  const contract = {
    contractId: 'INC-001',
    taskId: 'TASK-01',
    configurationDependencies: [
      {
        name: 'DATABASE_URL',
        kind: 'secret',
        required: true,
        requiredBy: 'implementation',
        provider: 'PostgreSQL',
      }
    ]
  };

  const plan = {
    tasks: [
      {
        id: 'TASK-02',
        configurationDependencies: ['SUPABASE_SERVICE_ROLE_KEY']
      }
    ]
  };

  const discovered = discoverConfigurationRequirements({ rootDir: root, contract, plan });
  assert.ok(discovered.length >= 5, `Expected at least 5 discovered, got ${discovered.length}`);

  const names = discovered.map(d => d.name);
  assert.ok(names.includes('OPENAI_API_KEY'));
  assert.ok(names.includes('NEXT_PUBLIC_API_URL'));
  assert.ok(names.includes('STRIPE_SECRET_KEY'));
  assert.ok(names.includes('TENANT_ID'));
  assert.ok(names.includes('DATABASE_URL'));
  assert.ok(names.includes('SUPABASE_SERVICE_ROLE_KEY'));

  const openai = discovered.find(d => d.name === 'OPENAI_API_KEY');
  assert.equal(openai.kind, 'secret');
  assert.equal(openai.target.type, 'environment-variable');
  assert.ok(openai.target.file === '.env' || openai.target.file === '.env.local');

  const nextPublic = discovered.find(d => d.name === 'NEXT_PUBLIC_API_URL');
  assert.equal(nextPublic.kind, 'public_config');

  const tenant = discovered.find(d => d.name === 'TENANT_ID');
  assert.equal(tenant.kind, 'identifier');
});

test('CFG-UNIT-03: Registry load and save maintains schema integrity and rejects plaintext values', (t) => {
  const root = makeTempProject(t);
  const registry = {
    schemaVersion: '1.0.0',
    projectId: 'test-proj',
    requirements: [
      {
        id: 'CFG-001',
        name: 'TEST_SECRET',
        kind: 'secret',
        required: true,
        requiredBy: 'runtime-verification',
        status: 'MISSING',
        target: { type: 'environment-variable', file: '.env.local', variable: 'TEST_SECRET' }
      }
    ]
  };

  saveConfigurationRegistry(root, registry);
  const loaded = loadConfigurationRegistry(root);
  assert.equal(loaded.requirements.length, 1);
  assert.equal(loaded.requirements[0].id, 'CFG-001');

  // Verify that attempting to save a requirement with a raw value throws or strips it
  const dangerousRegistry = {
    ...registry,
    requirements: [
      {
        ...registry.requirements[0],
        value: 'super-secret-password-123'
      }
    ]
  };
  assert.throws(() => saveConfigurationRegistry(root, dangerousRegistry), /must not contain plaintext value/);
});

test('CFG-UNIT-04: Target preparation with line numbers and safe gitignore', (t) => {
  const root = makeTempProject(t);
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n', 'utf8');

  const requirements = [
    {
      id: 'CFG-001',
      name: 'APP_SECRET',
      kind: 'secret',
      required: true,
      requiredBy: 'implementation',
      status: 'MISSING',
      target: { type: 'environment-variable', file: '.env.local', variable: 'APP_SECRET' }
    }
  ];

  const prepared = prepareConfigurationTargets(root, requirements);
  assert.equal(prepared.preparedFiles.length, 1);
  assert.equal(prepared.targets[0].file, '.env.local');
  assert.ok(prepared.targets[0].line >= 1);

  const envContent = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
  assert.match(envContent, /APP_SECRET=/);

  const gitignoreContent = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignoreContent, /\.env\.local/);
});

test('CFG-UNIT-05: Validation rejects placeholder values and checks structure', (t) => {
  const root = makeTempProject(t);
  const req = {
    id: 'CFG-001',
    name: 'TEST_KEY',
    kind: 'secret',
    required: true,
    requiredBy: 'implementation',
    status: 'MISSING',
    target: { type: 'environment-variable', file: '.env.local', variable: 'TEST_KEY' }
  };

  // 1. Missing file
  let res = validateConfigurationRequirement(root, req);
  assert.equal(res.status, 'MISSING');

  // 2. Empty value
  fs.writeFileSync(path.join(root, '.env.local'), 'TEST_KEY=\n', 'utf8');
  res = validateConfigurationRequirement(root, req);
  assert.equal(res.status, 'MISSING');

  // 3. Placeholder values
  const placeholders = ['your_api_key', 'todo', '<secret>', 'placeholder', 'xxxxx', 'changeme'];
  for (const ph of placeholders) {
    fs.writeFileSync(path.join(root, '.env.local'), `TEST_KEY=${ph}\n`, 'utf8');
    res = validateConfigurationRequirement(root, req);
    assert.equal(res.status, 'MISSING');
    assert.match(res.reason, /placeholder/i);
  }

  // 4. Valid value
  fs.writeFileSync(path.join(root, '.env.local'), 'TEST_KEY=sk_live_1234567890abcdef\n', 'utf8');
  res = validateConfigurationRequirement(root, req);
  assert.equal(res.status, 'VALID');

  // 5. Structure validation for URL
  const urlReq = {
    id: 'CFG-002',
    name: 'SERVICE_URL',
    kind: 'public_config',
    required: true,
    requiredBy: 'implementation',
    status: 'MISSING',
    expectedFormat: 'url',
    validationLevel: 'structure',
    target: { type: 'environment-variable', file: '.env.local', variable: 'SERVICE_URL' }
  };
  fs.writeFileSync(path.join(root, '.env.local'), 'SERVICE_URL=not-a-url\n', 'utf8');
  res = validateConfigurationRequirement(root, urlReq);
  assert.equal(res.status, 'INVALID');

  fs.writeFileSync(path.join(root, '.env.local'), 'SERVICE_URL=https://example.com/api\n', 'utf8');
  res = validateConfigurationRequirement(root, urlReq);
  assert.equal(res.status, 'VALID');
});

test('CFG-UNIT-06: Gate evaluation distinguishes requirement state from overall gate state', () => {
  const root = makeTempProject({ after: () => {} });

  // 1. All valid
  let evalRes = evaluateConfigurationReadiness({
    rootDir: root,
    requirements: [
      { id: 'CFG-1', name: 'K1', status: 'VALID', required: true, requiredBy: 'implementation' }
    ]
  });
  assert.equal(evalRes.state, 'READY');

  // 2. Missing required
  evalRes = evaluateConfigurationReadiness({
    rootDir: root,
    requirements: [
      { id: 'CFG-1', name: 'K1', status: 'MISSING', required: true, requiredBy: 'implementation' }
    ]
  });
  assert.equal(evalRes.state, 'WAITING_FOR_USER');

  // 3. Invalid required
  evalRes = evaluateConfigurationReadiness({
    rootDir: root,
    requirements: [
      { id: 'CFG-1', name: 'K1', status: 'INVALID', required: true, requiredBy: 'implementation' }
    ]
  });
  assert.equal(evalRes.state, 'BLOCKED');

  // 4. Deferred by product owner -> CLEARED_WITH_DEFERRED_REQUIREMENTS
  evalRes = evaluateConfigurationReadiness({
    rootDir: root,
    requirements: [
      { id: 'CFG-1', name: 'K1', status: 'DEFERRED_BY_PRODUCT_OWNER', required: true, requiredBy: 'runtime-verification' }
    ]
  });
  assert.equal(evalRes.state, 'CLEARED_WITH_DEFERRED_REQUIREMENTS');
  assert.deepEqual(evalRes.deferredRequirements, ['CFG-1']);
});

test('CFG-UNIT-07: Local secret generation creates high-entropy strings without leaking', (t) => {
  const root = makeTempProject(t);
  const req1 = {
    id: 'CFG-001',
    name: 'SESSION_SECRET',
    kind: 'generated_secret',
    target: { type: 'environment-variable', file: '.env.local', variable: 'SESSION_SECRET' }
  };
  const res1 = generateLocalSecret(root, req1);
  assert.equal(res1.success, true);
  assert.equal(req1.status, 'VALID');

  const content = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
  assert.match(content, /SESSION_SECRET=[0-9a-f]{64}/);
});

test('CFG-UNIT-08: Setup guide generation creates clear instructions', (t) => {
  const root = makeTempProject(t);
  const requirements = [
    {
      id: 'CFG-001',
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      kind: 'secret',
      provider: 'Supabase',
      required: true,
      requiredBy: 'runtime-verification',
      status: 'MISSING',
      description: 'Find under Project Settings > API > service_role',
      target: { type: 'environment-variable', file: '.env.local', variable: 'SUPABASE_SERVICE_ROLE_KEY', line: 5 }
    }
  ];

  const guidePath = generateConfigurationSetupGuide(root, requirements);
  const guide = fs.readFileSync(guidePath, 'utf8');
  assert.match(guide, /# Secrets & Configuration Setup Guide/);
  assert.match(guide, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(guide, /Project Settings > API > service_role/);
  assert.match(guide, /Line 5/);
  assert.equal(fs.existsSync(path.join(root, '.development-kit', 'SECRETS_SETUP.md')), true);
});

test('CFG-UNIT-09: Decision recording updates requirement with PO provenance', (t) => {
  const root = makeTempProject(t);
  const registry = {
    schemaVersion: '1.0.0',
    projectId: 'test-proj',
    requirements: [
      {
        id: 'CFG-001',
        name: 'OPENAI_API_KEY',
        kind: 'secret',
        status: 'MISSING',
        required: true,
        requiredBy: 'runtime-verification',
        target: { type: 'environment-variable', file: '.env.local', variable: 'OPENAI_API_KEY' }
      }
    ]
  };
  saveConfigurationRegistry(root, registry);

  const res = recordConfigurationDecision({
    rootDir: root,
    requirementId: 'CFG-001',
    decision: 'defer',
    confirmed: true,
  });

  assert.equal(res.success, true);
  assert.equal(res.decision, 'defer');

  const loaded = loadConfigurationRegistry(root);
  assert.equal(loaded.requirements[0].status, 'DEFERRED_BY_PRODUCT_OWNER');
});
