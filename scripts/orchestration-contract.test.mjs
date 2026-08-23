import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ContractPersistenceError,
  ContractValidationError,
  StaleContractError,
  checkContractStaleness,
  createDevelopmentContract,
  ensureDevelopmentContract,
  persistDevelopmentContract,
  renderDevelopmentContractMarkdown,
  validateDevelopmentContract,
} from '../runtime/orchestration/development-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');

function createTempProject(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-contract-test-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Approved specification\nREQ-1: Build the thing.\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'docs', 'architecture.md'), '# Architecture\nUse the approved boundary.\n', 'utf8');
  return rootDir;
}

function approvedTask(overrides = {}) {
  return {
    id: 'TASK-001',
    projectId: 'proj-contract-test',
    status: 'approved',
    objective: 'Implement one bounded increment',
    scope: {
      in: ['Implement the approved increment'],
      out: ['Do not deploy'],
    },
    requirements: ['REQ-1'],
    acceptanceCriteria: [
      {
        statement: 'The approved behavior is implemented',
        source: 'REQ-1',
        verificationType: ['test', 'code'],
      },
      'The implementation remains inside task scope',
    ],
    architectureConstraints: ['Preserve the approved architecture boundary'],
    securityConstraints: ['Do not broaden privilege'],
    risk: { level: 2, reasons: ['Security-sensitive change'] },
    requiredVerification: ['specification', 'tests'],
    requiredReviewers: ['spec-reviewer'],
    ...overrides,
  };
}

function authoritativeSources() {
  return [
    { path: 'docs/spec.md', kind: 'specification', authority: 'required', sections: ['REQ-1'] },
    { path: 'docs/architecture.md', kind: 'architecture', authority: 'required' },
  ];
}

test('ORCH-001 creates a validated contract with stable evidence boundary and execution safety defaults', (t) => {
  const rootDir = createTempProject(t);
  const contract = createDevelopmentContract({
    rootDir,
    task: approvedTask(),
    authoritativeSources: authoritativeSources(),
    createdAt: '2026-08-23T12:00:00.000Z',
  });

  assert.equal(validateDevelopmentContract(contract), true);
  assert.equal(contract.contractId, 'INC-TASK-001');
  assert.equal(contract.projectId, 'proj-contract-test');
  assert.match(contract.sourceFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(contract.executionSafety.resourceScope, 'project-only');
  assert.equal(contract.executionSafety.destructiveOperations, 'explicit-approval');
  assert.equal(contract.executionSafety.remoteMutation, 'explicit-contract');
  assert.equal(contract.acceptanceCriteria.length, 2);
  for (const criterion of contract.acceptanceCriteria) {
    assert.match(criterion.id, /^AC-[A-F0-9]{12}$/);
    assert.equal(criterion.requiredEvidence, true);
  }

  const markdown = renderDevelopmentContractMarkdown(contract);
  assert.match(markdown, /# Development Contract INC-TASK-001/);
  assert.match(markdown, /Destructive operations: \*\*explicit-approval\*\*/);
});

test('ORCH-001 generates acceptance criterion IDs from meaning rather than array position', (t) => {
  const rootDir = createTempProject(t);
  const baseCriteria = approvedTask().acceptanceCriteria;
  const first = createDevelopmentContract({
    rootDir,
    task: approvedTask({ acceptanceCriteria: baseCriteria }),
    authoritativeSources: authoritativeSources(),
    createdAt: '2026-08-23T12:00:00.000Z',
  });
  const second = createDevelopmentContract({
    rootDir,
    task: approvedTask({ acceptanceCriteria: [...baseCriteria].reverse() }),
    authoritativeSources: authoritativeSources(),
    createdAt: '2026-08-23T12:00:00.000Z',
  });

  const firstIds = new Map(first.acceptanceCriteria.map((criterion) => [criterion.statement, criterion.id]));
  const secondIds = new Map(second.acceptanceCriteria.map((criterion) => [criterion.statement, criterion.id]));
  assert.deepEqual(firstIds, secondIds);
});

test('ORCH-001 persists contract.json and contract.md idempotently but refuses silent contract mutation', (t) => {
  const rootDir = createTempProject(t);
  const contract = createDevelopmentContract({
    rootDir,
    task: approvedTask(),
    authoritativeSources: authoritativeSources(),
    createdAt: '2026-08-23T12:00:00.000Z',
  });

  const first = persistDevelopmentContract(contract, rootDir);
  assert.equal(first.created, true);
  assert.ok(fs.existsSync(first.jsonPath));
  assert.ok(fs.existsSync(first.markdownPath));

  const second = persistDevelopmentContract(contract, rootDir);
  assert.equal(second.created, false);

  const changed = structuredClone(contract);
  changed.objective = 'Silently changed objective';
  assert.throws(
    () => persistDevelopmentContract(changed, rootDir),
    ContractPersistenceError,
  );
});

test('ORCH-001 marks an existing contract stale when an authoritative source changes', (t) => {
  const rootDir = createTempProject(t);
  const contract = createDevelopmentContract({
    rootDir,
    task: approvedTask(),
    authoritativeSources: authoritativeSources(),
    createdAt: '2026-08-23T12:00:00.000Z',
  });
  persistDevelopmentContract(contract, rootDir);

  const fresh = checkContractStaleness(contract, rootDir);
  assert.equal(fresh.stale, false);
  assert.deepEqual(fresh.changes, []);

  fs.appendFileSync(path.join(rootDir, 'docs', 'spec.md'), '\nREQ-2: Material change.\n', 'utf8');
  const stale = checkContractStaleness(contract, rootDir);
  assert.equal(stale.stale, true);
  assert.equal(stale.changes.length, 1);
  assert.equal(stale.changes[0].path, 'docs/spec.md');

  assert.throws(
    () => ensureDevelopmentContract({
      rootDir,
      task: approvedTask(),
      authoritativeSources: authoritativeSources(),
      createdAt: '2026-08-23T12:00:00.000Z',
    }),
    StaleContractError,
  );
});

test('ORCH-001 creates a missing contract on demand for backward-compatible workflows', (t) => {
  const rootDir = createTempProject(t);
  const first = ensureDevelopmentContract({
    rootDir,
    task: approvedTask(),
    authoritativeSources: authoritativeSources(),
    createdAt: '2026-08-23T12:00:00.000Z',
  });
  assert.equal(first.created, true);

  const second = ensureDevelopmentContract({
    rootDir,
    task: approvedTask(),
    authoritativeSources: authoritativeSources(),
    createdAt: '2026-08-23T12:00:00.000Z',
  });
  assert.equal(second.created, false);
  assert.deepEqual(second.contract, first.contract);
});

test('ORCH-001 rejects unapproved tasks and authoritative-source path escape', (t) => {
  const rootDir = createTempProject(t);

  assert.throws(
    () => createDevelopmentContract({
      rootDir,
      task: approvedTask({ status: 'draft' }),
      authoritativeSources: authoritativeSources(),
    }),
    /only be created from an approved task/,
  );

  assert.throws(
    () => createDevelopmentContract({
      rootDir,
      task: approvedTask(),
      authoritativeSources: [{ path: '../outside.md', kind: 'specification', authority: 'required' }],
    }),
    ContractValidationError,
  );
});

test('development-contract JSON schema is packaged as valid JSON and contains safety requirements', () => {
  const schemaPath = path.join(REPO_ROOT, 'schemas', 'development-contract.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert.equal(schema.title, 'Development Kit Development Contract');
  assert.ok(schema.required.includes('executionSafety'));
  assert.ok(schema.required.includes('sourceFingerprint'));
  assert.equal(schema.properties.status.const, 'approved');
});
