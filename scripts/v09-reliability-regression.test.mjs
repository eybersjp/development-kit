import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validatePlanModel } from '../runtime/orchestration/plan-validator.mjs';
import { evaluateControlCoverage, createVerificationRecord } from '../runtime/orchestration/evidence-store.mjs';
import { createPolicyBoundDevelopmentContract } from '../runtime/orchestration/contract-policy.mjs';
import { evaluateCommandSafety } from '../runtime/orchestration/execution-safety.mjs';
import { checkContractStaleness } from '../runtime/orchestration/development-contract.mjs';
import { fingerprintCanonicalArtifact, reconcileCanonicalArtifact } from '../runtime/orchestration/reconciliation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

function tempProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-v09-regression-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'spec.md'), '# Spec\nREQ-SEC-1 protect tenant boundaries\n', 'utf8');
  fs.writeFileSync(path.join(root, 'docs', 'architecture.md'), '# Architecture\nUse Supabase RLS.\n', 'utf8');
  return root;
}

function contract(rootDir) {
  return createPolicyBoundDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-04A',
      projectId: 'proposal-builder-regression',
      status: 'approved',
      objective: 'Harden the persistence and tenant security boundary',
      scope: { in: ['supabase/migrations/'], out: ['Do not touch unrelated Docker resources'] },
      requirements: ['REQ-SEC-1'],
      acceptanceCriteria: [{ id: 'AC-SEC-001', statement: 'Required security controls are verified', verificationType: ['test'], requiredEvidence: true }],
      architectureConstraints: ['Preserve Supabase architecture'],
      securityConstraints: ['Least privilege', 'Tenant isolation'],
      risk: { level: 3, reasons: ['Authorization and migrations'] },
      requiredVerification: ['tests', 'security'],
      requiredReviewers: ['security-reviewer'],
    },
    authoritativeSources: [
      { path: 'docs/spec.md', kind: 'specification', authority: 'required', sections: ['REQ-SEC-1'] },
      { path: 'docs/architecture.md', kind: 'architecture', authority: 'required' },
    ],
  });
}

test('Proposal Builder PLAN inconsistencies are computed, not trusted from prose', () => {
  const tasks = Array.from({ length: 22 }, (_, index) => {
    const n = index + 1;
    return {
      id: `TASK-${String(n).padStart(2, '0')}`,
      dependsOn: n === 1 ? [] : [`TASK-${String(n - 1).padStart(2, '0')}`],
      acceptanceCriteria: [`AC-${String(n).padStart(2, '0')}`],
      owns: n === 5 || n === 6 ? ['proposal_approvals'] : n === 7 || n === 8 ? ['migration:001'] : [],
    };
  });

  const report = validatePlanModel({
    declaredTaskCount: 20,
    tasks,
    declaredDependencyEdges: ['TASK-01->TASK-02'],
    requiredResources: ['proposal_approvals', 'approval_policies', 'migration:001'],
    requiredAcceptanceCriteria: ['AC-01', 'AC-22', 'AC-99'],
  });

  const codes = new Set(report.issues.map((issue) => issue.code));
  assert.equal(report.computed.taskCount, 22);
  assert.equal(report.valid, false);
  assert.ok(codes.has('TASK_COUNT_MISMATCH'));
  assert.ok(codes.has('DEPENDENCY_DIAGRAM_MISMATCH'));
  assert.ok(codes.has('MISSING_RESOURCE_OWNER'));
  assert.ok(codes.has('DUPLICATE_RESOURCE_OWNER'));
  assert.ok(codes.has('ACCEPTANCE_CRITERIA_UNCOVERED'));
});

test('17 passing tests out of 23 required security controls is INCOMPLETE at 73.91 percent', () => {
  const specialMissing = ['SEC-GRT-003', 'SEC-FUN-002', 'SEC-SCH-001', 'SEC-RBAC-001', 'SEC-MIG-001', 'SEC-ENV-001'];
  const passIds = Array.from({ length: 17 }, (_, index) => `SEC-PASS-${String(index + 1).padStart(3, '0')}`);
  const expectedControls = [...passIds, ...specialMissing].map((id) => ({ id, statement: `Required control ${id}`, required: true, requiredEvidence: true }));
  const results = passIds.map((id) => ({ id, status: 'PASS', evidence: [{ type: 'test', id: `pgTAP:${id}` }] }));

  const manifest = evaluateControlCoverage({
    contractId: 'INC-TASK-04A',
    runId: 'run-security',
    domain: 'security',
    expectedControls,
    results,
  });

  assert.equal(manifest.coverage.expectedRequired, 23);
  assert.equal(manifest.coverage.verifiedRequired, 17);
  assert.equal(manifest.coverage.percent, 73.91);
  assert.equal(manifest.verdict, 'INCOMPLETE');
  for (const id of specialMissing) {
    assert.equal(manifest.controls.find((control) => control.id === id).status, 'UNVERIFIED');
  }
});

test('project-local contract blocks the host-wide Docker cleanup from the field incident', (t) => {
  const root = tempProject(t);
  const activeContract = contract(root);
  const result = evaluateCommandSafety({
    command: 'docker rm -f $(docker ps -aq)',
    contract: activeContract,
    environment: { projectRoot: root },
  });
  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.blastRadius, 'host-wide');
  assert.equal(result.projectOwnershipProvable, false);
});

test('implementation agent cannot self-certify and source changes invalidate the contract', (t) => {
  const root = tempProject(t);
  const activeContract = contract(root);
  assert.throws(() => createVerificationRecord({
    contract: activeContract,
    runId: 'run-self-cert',
    role: 'implementation-agent',
    contextIsolation: 'fresh',
    sourceFingerprint: activeContract.sourceFingerprint,
    criteria: [{ id: 'AC-SEC-001', status: 'PASS', evidence: [{ type: 'test', id: 'fake-self-test' }] }],
  }), /may not produce an authoritative verification record/);

  fs.appendFileSync(path.join(root, 'docs', 'spec.md'), '\nREQ-SEC-2 changed after approval\n', 'utf8');
  assert.equal(checkContractStaleness(activeContract, root).stale, true);
});

test('Autopilot amendment replay is rejected after canonical artifact fingerprint changes', (t) => {
  const root = tempProject(t);
  const planPath = path.join(root, 'docs', 'implementation-plan.md');
  fs.writeFileSync(planPath, 'Declared tasks: 20\n', 'utf8');
  const original = fingerprintCanonicalArtifact(root, 'docs/implementation-plan.md');
  reconcileCanonicalArtifact({
    rootDir: root,
    path: 'docs/implementation-plan.md',
    expectedFingerprint: original,
    amendmentId: 'PLAN-FIX-001',
    operations: [{ type: 'replace', find: 'Declared tasks: 20', replace: 'Declared tasks: 22' }],
  });
  assert.throws(() => reconcileCanonicalArtifact({
    rootDir: root,
    path: 'docs/implementation-plan.md',
    expectedFingerprint: original,
    amendmentId: 'PLAN-STALE-REPLAY',
    operations: [{ type: 'replace', find: 'Declared tasks: 22', replace: 'Declared tasks: 20' }],
  }), /fingerprint changed/);
});

test('project installer is self-contained for v0.9 runtime and schema assets and version-aligned', (t) => {
  const root = tempProject(t);
  const installer = path.join(REPO_ROOT, 'scripts', 'install-antigravity.mjs');
  const result = spawnSync(process.execPath, [installer, '--project'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const pluginRoot = path.join(root, '.agents', 'plugins', 'development-kit');
  assert.ok(fs.existsSync(path.join(pluginRoot, 'runtime', 'orchestration', 'development-contract.mjs')));
  assert.ok(fs.existsSync(path.join(pluginRoot, 'runtime', 'orchestration', 'execution-safety.mjs')));
  assert.ok(fs.existsSync(path.join(pluginRoot, 'runtime', 'orchestration', 'evidence-store.mjs')));
  assert.ok(fs.existsSync(path.join(pluginRoot, 'schemas', 'development-contract.schema.json')));

  const installedManifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'plugin.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal(installedManifest.version, packageJson.version);
});
