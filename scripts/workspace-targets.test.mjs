import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WORKSPACE_TARGET_REGISTRY_PATH,
  checkWorkspaceTargetBindingStaleness,
  createWorkspaceTargetBinding,
  discoverWorkspaceTargetRegistry,
  fingerprintWorkspaceTargetRegistry,
  getAffectedTargetClosure,
  getTargetDependencyClosure,
  getVerificationTargetClosure,
  loadWorkspaceTargetRegistry,
  normalizeWorkspaceTargetRegistry,
  persistWorkspaceTargetRegistry,
  registerWorkspaceTarget,
  resolveCapabilityRoute,
  resolveTargetCommand,
  resolveTargetsByCapability,
} from '../runtime/orchestration/workspace-targets.mjs';
import {
  checkContractStaleness,
  createDevelopmentContract,
  renderDevelopmentContractMarkdown,
} from '../runtime/orchestration/development-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

function tempProject(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-workspace-targets-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

function writeDir(rootDir, relative) {
  const dir = path.join(rootDir, relative);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function baseRegistry(rootDir) {
  writeDir(rootDir, 'units/alpha');
  writeDir(rootDir, 'units/beta');
  writeDir(rootDir, 'shared/common');
  return {
    schemaVersion: 1,
    targets: {
      '@alpha': {
        path: 'units/alpha',
        kind: 'arbitrary-kind-a',
        dependencies: ['shared/common'],
        commands: {
          check: 'node alpha-check.mjs',
          build: 'node alpha-build.mjs',
        },
        capabilities: ['quality-check', 'artifact-build'],
        verification: ['check'],
        adapter: null,
      },
      'service:beta': {
        path: 'units/beta',
        kind: 'totally-different-kind',
        dependencies: ['shared/common'],
        commands: {
          check: 'node beta-check.mjs',
        },
        capabilities: ['quality-check'],
        verification: ['check'],
        adapter: { projectOwned: true },
      },
      'shared/common': {
        path: 'shared/common',
        kind: null,
        dependencies: [],
        commands: {
          verify: 'node common-verify.mjs',
        },
        capabilities: ['shared-contract'],
        verification: ['verify'],
        adapter: null,
      },
    },
  };
}

function contractTask(targetBinding) {
  return {
    id: 'TASK-TARGET-BINDING',
    projectId: 'proj-target-binding',
    status: 'approved',
    objective: 'Bind one task to project-defined workspace targets',
    scope: { in: ['units/'], out: [] },
    requirements: ['REQ-TARGET'],
    acceptanceCriteria: [{
      id: 'AC-TARGET',
      statement: 'Target binding is preserved',
      source: 'REQ-TARGET',
      verificationType: ['test'],
      requiredEvidence: true,
    }],
    architectureConstraints: [],
    designConstraints: [],
    securityConstraints: [],
    risk: { level: 1, reasons: [] },
    requiredVerification: ['tests'],
    requiredReviewers: ['code-reviewer'],
    targetBinding,
  };
}

test('AC-004 accepts arbitrary project-defined target IDs without core changes', (t) => {
  const rootDir = tempProject(t);
  const normalized = normalizeWorkspaceTargetRegistry(baseRegistry(rootDir), { rootDir });
  assert.deepEqual(Object.keys(normalized.targets), ['@alpha', 'service:beta', 'shared/common']);

  const extended = registerWorkspaceTarget(normalized, 'custom/project-unit', {
    path: '.',
    kind: 'project-owned-description',
    dependencies: [],
    commands: {},
    capabilities: ['anything-the-project-defines'],
    verification: [],
    adapter: null,
  });
  assert.ok(extended.targets['custom/project-unit']);
});

test('AC-005 discovery finds repository boundaries without fixed topology or domain target names', (t) => {
  const rootDir = tempProject(t);
  writeDir(rootDir, 'clients/red');
  writeDir(rootDir, 'components/green/inner');
  fs.writeFileSync(path.join(rootDir, 'clients/red', 'package.json'), '{"name":"red"}\n');
  fs.writeFileSync(path.join(rootDir, 'components/green', 'pyproject.toml'), '[project]\nname="green"\n');
  fs.writeFileSync(path.join(rootDir, 'components/green/inner', 'go.mod'), 'module example.test/inner\n');

  const discovered = discoverWorkspaceTargetRegistry(rootDir);
  const paths = Object.values(discovered.targets).map((target) => target.path).sort();
  assert.deepEqual(paths, ['clients/red', 'components/green', 'components/green/inner']);
  for (const target of Object.values(discovered.targets)) {
    assert.equal(target.kind, 'discovered-boundary');
    assert.deepEqual(target.capabilities, []);
    assert.deepEqual(target.commands, {});
  }
});

test('single-root repositories remain valid and discovery falls back to one generic root target', (t) => {
  const rootDir = tempProject(t);
  fs.writeFileSync(path.join(rootDir, 'README.txt'), 'no recognised build manifest\n');
  const discovered = discoverWorkspaceTargetRegistry(rootDir);
  assert.equal(Object.keys(discovered.targets).length, 1);
  assert.equal(discovered.targets.root.path, '.');
});

test('dependency, affected and verification closures are deterministic', (t) => {
  const rootDir = tempProject(t);
  const registry = normalizeWorkspaceTargetRegistry(baseRegistry(rootDir), { rootDir });

  assert.deepEqual(getTargetDependencyClosure(registry, ['@alpha']), ['@alpha', 'shared/common']);
  assert.deepEqual(getAffectedTargetClosure(registry, ['shared/common']), ['@alpha', 'service:beta', 'shared/common']);
  assert.deepEqual(getVerificationTargetClosure(registry, ['shared/common']), ['@alpha', 'service:beta', 'shared/common']);
});

test('unknown dependencies and cycles fail closed', (t) => {
  const rootDir = tempProject(t);
  writeDir(rootDir, 'a');
  writeDir(rootDir, 'b');

  assert.throws(() => normalizeWorkspaceTargetRegistry({
    schemaVersion: 1,
    targets: {
      a: { path: 'a', dependencies: ['missing'], commands: {}, capabilities: [], verification: [], adapter: null },
    },
  }, { rootDir }), /unknown target/);

  assert.throws(() => normalizeWorkspaceTargetRegistry({
    schemaVersion: 1,
    targets: {
      a: { path: 'a', dependencies: ['b'], commands: {}, capabilities: [], verification: [], adapter: null },
      b: { path: 'b', dependencies: ['a'], commands: {}, capabilities: [], verification: [], adapter: null },
    },
  }, { rootDir }), /dependency cycle/);
});

test('AC-007 and AC-039 route by declared capability/configuration, never target name or kind', (t) => {
  const rootDir = tempProject(t);
  const registry = normalizeWorkspaceTargetRegistry(baseRegistry(rootDir), { rootDir });

  assert.deepEqual(resolveTargetsByCapability(registry, 'quality-check', { commandName: 'check' }), ['@alpha', 'service:beta']);

  const beta = resolveCapabilityRoute(registry, {
    capability: 'quality-check',
    commandName: 'check',
    preferredTargets: ['service:beta'],
    rootDir,
  });
  assert.equal(beta.targetId, 'service:beta');
  assert.equal(beta.command, 'node beta-check.mjs');
  assert.equal(beta.cwd, path.join(rootDir, 'units', 'beta'));

  const alpha = resolveTargetCommand(registry, '@alpha', 'build', { rootDir });
  assert.equal(alpha.command, 'node alpha-build.mjs');
  assert.ok(alpha.capabilities.includes('artifact-build'));
});

test('target paths may not escape the project root', (t) => {
  const rootDir = tempProject(t);
  assert.throws(() => normalizeWorkspaceTargetRegistry({
    schemaVersion: 1,
    targets: {
      escape: {
        path: '../outside',
        dependencies: [],
        commands: {},
        capabilities: [],
        verification: [],
        adapter: null,
      },
    },
  }, { rootDir }), /may not escape|escapes/);
});

test('workspace registry persistence is stable and supports optimistic fingerprint protection', (t) => {
  const rootDir = tempProject(t);
  const initial = baseRegistry(rootDir);
  const saved = persistWorkspaceTargetRegistry(initial, rootDir);
  const loaded = loadWorkspaceTargetRegistry(rootDir);
  assert.equal(saved.fingerprint, fingerprintWorkspaceTargetRegistry(loaded));

  const changed = structuredClone(loaded);
  changed.targets['@alpha'].capabilities.push('new-project-capability');
  const updated = persistWorkspaceTargetRegistry(changed, rootDir, { expectedFingerprint: saved.fingerprint });
  assert.notEqual(updated.fingerprint, saved.fingerprint);

  assert.throws(() => persistWorkspaceTargetRegistry(loaded, rootDir, { expectedFingerprint: saved.fingerprint }), /changed since it was read/);
});

test('AC-006 Development Contracts bind primary, affected and verification targets plus registry fingerprint', (t) => {
  const rootDir = tempProject(t);
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs/spec.md'), '# Spec\nREQ-TARGET\n');
  const saved = persistWorkspaceTargetRegistry(baseRegistry(rootDir), rootDir);

  const targetBinding = createWorkspaceTargetBinding(saved.registry, {
    primary: '@alpha',
    affected: ['@alpha'],
    verification: ['@alpha', 'shared/common'],
  });

  const contract = createDevelopmentContract({
    rootDir,
    task: contractTask(targetBinding),
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
    createdAt: '2026-10-07T18:30:00.000Z',
  });

  assert.equal(contract.schemaVersion, '1.3.0');
  assert.equal(contract.workspaceTargets.registryPath, WORKSPACE_TARGET_REGISTRY_PATH);
  assert.equal(contract.workspaceTargets.registryFingerprint, saved.fingerprint);
  assert.equal(contract.workspaceTargets.primary, '@alpha');
  assert.deepEqual(contract.workspaceTargets.affected, ['@alpha']);
  assert.deepEqual(contract.workspaceTargets.verification, ['@alpha', 'shared/common']);
  assert.match(renderDevelopmentContractMarkdown(contract), /## Workspace Targets/);
  assert.equal(checkContractStaleness(contract, rootDir).stale, false);
});

test('target registry changes make a target-aware Development Contract stale', (t) => {
  const rootDir = tempProject(t);
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs/spec.md'), '# Spec\nREQ-TARGET\n');
  const saved = persistWorkspaceTargetRegistry(baseRegistry(rootDir), rootDir);

  const contract = createDevelopmentContract({
    rootDir,
    task: contractTask({
      primary: '@alpha',
      affected: ['@alpha'],
      verification: ['@alpha', 'shared/common'],
    }),
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
    createdAt: '2026-10-07T18:31:00.000Z',
  });

  const changed = structuredClone(saved.registry);
  changed.targets['@alpha'].commands.check = 'node changed-check.mjs';
  persistWorkspaceTargetRegistry(changed, rootDir, { expectedFingerprint: saved.fingerprint });

  const staleness = checkContractStaleness(contract, rootDir);
  assert.equal(staleness.stale, true);
  assert.equal(staleness.workspaceTargets.stale, true);
  assert.ok(staleness.changes.some((change) => change.code === 'WORKSPACE_REGISTRY_CHANGED'));
});

test('workspace target binding rejects unknown target references', (t) => {
  const rootDir = tempProject(t);
  const registry = normalizeWorkspaceTargetRegistry(baseRegistry(rootDir), { rootDir });
  assert.throws(() => createWorkspaceTargetBinding(registry, { primary: 'not-there' }), /Unknown workspace target/);
});

test('repository workspace registry is valid and routes its declared validation capability', () => {
  const registry = loadWorkspaceTargetRegistry(REPO_ROOT);
  assert.ok(registry.targets['dkf-framework']);
  const route = resolveCapabilityRoute(registry, {
    capability: 'release-validation',
    commandName: 'test',
    rootDir: REPO_ROOT,
  });
  assert.equal(route.targetId, 'dkf-framework');
  assert.equal(route.command, 'npm run release:validate');
});

test('Workspace Target Registry schema and Development Contract schema expose v0.12 T02 contracts', () => {
  const workspaceSchema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'schemas', 'workspace-target-registry.schema.json'), 'utf8'));
  const contractSchema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'schemas', 'development-contract.schema.json'), 'utf8'));
  assert.equal(workspaceSchema.title, 'Development Kit Workspace Target Registry');
  assert.ok(contractSchema.properties.schemaVersion.enum.includes('1.3.0'));
  assert.ok(contractSchema.properties.workspaceTargets);
});
