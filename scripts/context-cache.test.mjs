import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  clearContextCache,
  resolveRepositoryContextCache,
  validateContextCacheEntry,
} from '../runtime/orchestration/context-cache.mjs';
import { createDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';
import { persistWorkspaceTargetRegistry } from '../runtime/orchestration/workspace-targets.mjs';

function tempProject(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-context-cache-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'units', 'alpha', 'tests'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'units', 'beta'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Spec\n\n## REQ-1\nBuild the approved behavior.\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'units', 'alpha', 'index.mjs'), 'export const alpha = 1;\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'units', 'alpha', 'tests', 'alpha.test.mjs'), 'export const pass = true;\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'units', 'beta', 'index.mjs'), 'export const beta = 1;\n', 'utf8');

  persistWorkspaceTargetRegistry({
    schemaVersion: 1,
    targets: {
      alpha: {
        path: 'units/alpha',
        kind: 'project-defined-a',
        dependencies: [],
        commands: { test: 'node tests/alpha.test.mjs' },
        capabilities: ['quality'],
        verification: ['test'],
        adapter: null,
      },
      beta: {
        path: 'units/beta',
        kind: 'project-defined-b',
        dependencies: [],
        commands: {},
        capabilities: [],
        verification: [],
        adapter: null,
      },
    },
  }, rootDir);

  return rootDir;
}

function task(targetBinding = {
  primary: 'alpha',
  affected: ['alpha'],
  verification: ['alpha'],
}) {
  return {
    id: 'TASK-CACHE',
    projectId: 'proj-cache',
    status: 'approved',
    objective: 'Exercise deterministic repository context caching',
    scope: { in: ['units/alpha'], out: [] },
    requirements: ['REQ-1'],
    acceptanceCriteria: [{
      id: 'AC-CACHE',
      statement: 'Cache preserves correctness',
      source: 'REQ-1',
      verificationType: ['test'],
      requiredEvidence: true,
    }],
    architectureConstraints: [],
    designConstraints: [],
    securityConstraints: [],
    risk: { level: 2, reasons: [] },
    requiredVerification: ['tests'],
    requiredReviewers: ['code-reviewer'],
    targetBinding,
  };
}

function contract(rootDir, targetBinding) {
  return createDevelopmentContract({
    rootDir,
    task: task(targetBinding),
    authoritativeSources: [{
      path: 'docs/spec.md',
      kind: 'specification',
      authority: 'required',
      sections: ['REQ-1'],
    }],
    createdAt: '2026-10-07T19:00:00.000Z',
  });
}

test('AC-010 cache miss then deterministic hit reuses the same semantic entry', (t) => {
  const rootDir = tempProject(t);
  const c = contract(rootDir);

  const first = resolveRepositoryContextCache({
    contract: c,
    rootDir,
    relevantFiles: ['units/alpha/index.mjs'],
    relevantTests: ['units/alpha/tests/alpha.test.mjs'],
    createdAt: '2026-10-07T19:01:00.000Z',
  });
  assert.equal(first.status, 'MISS');
  assert.equal(first.metrics.cacheMisses, 1);
  assert.equal(first.metrics.orientationRebuilds, 1);
  assert.equal(validateContextCacheEntry(first.entry), true);

  const second = resolveRepositoryContextCache({
    contract: c,
    rootDir,
    relevantFiles: ['units/alpha/index.mjs'],
    relevantTests: ['units/alpha/tests/alpha.test.mjs'],
    createdAt: '2026-10-07T19:02:00.000Z',
  });
  assert.equal(second.status, 'HIT');
  assert.equal(second.metrics.cacheHits, 1);
  assert.equal(second.metrics.orientationRebuilds, 0);
  assert.equal(second.entry.cacheId, first.entry.cacheId);
  assert.equal(second.entry.inputFingerprint, first.entry.inputFingerprint);
  assert.equal(second.entry.entryFingerprint, first.entry.entryFingerprint);
});

test('AC-010 relevant file content change invalidates the cached input deterministically', (t) => {
  const rootDir = tempProject(t);
  const c = contract(rootDir);

  const first = resolveRepositoryContextCache({
    contract: c,
    rootDir,
    relevantFiles: ['units/alpha/index.mjs'],
  });
  fs.writeFileSync(path.join(rootDir, 'units', 'alpha', 'index.mjs'), 'export const alpha = 2;\n', 'utf8');

  const second = resolveRepositoryContextCache({
    contract: c,
    rootDir,
    relevantFiles: ['units/alpha/index.mjs'],
  });
  assert.equal(second.status, 'MISS');
  assert.equal(second.invalidationReason, 'INPUT_FINGERPRINT_CHANGED');
  assert.notEqual(second.entry.inputFingerprint, first.entry.inputFingerprint);
});

test('AC-010 relevant target structure change invalidates structural cache facts', (t) => {
  const rootDir = tempProject(t);
  const c = contract(rootDir);

  const first = resolveRepositoryContextCache({ contract: c, rootDir });
  fs.writeFileSync(path.join(rootDir, 'units', 'alpha', 'new-module.mjs'), 'export {};\n', 'utf8');
  const second = resolveRepositoryContextCache({ contract: c, rootDir });

  assert.equal(second.status, 'MISS');
  assert.equal(second.invalidationReason, 'INPUT_FINGERPRINT_CHANGED');
  assert.notEqual(
    second.entry.targetFacts[0].structureFingerprint,
    first.entry.targetFacts[0].structureFingerprint,
  );
});

test('irrelevant target file and structure changes do not invalidate an alpha-scoped cache', (t) => {
  const rootDir = tempProject(t);
  const c = contract(rootDir);

  const first = resolveRepositoryContextCache({
    contract: c,
    rootDir,
    targetIds: ['alpha'],
    relevantFiles: ['units/alpha/index.mjs'],
  });

  fs.writeFileSync(path.join(rootDir, 'units', 'beta', 'index.mjs'), 'export const beta = 99;\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'units', 'beta', 'extra.mjs'), 'export {};\n', 'utf8');

  const second = resolveRepositoryContextCache({
    contract: c,
    rootDir,
    targetIds: ['alpha'],
    relevantFiles: ['units/alpha/index.mjs'],
  });

  assert.equal(second.status, 'HIT');
  assert.equal(second.entry.inputFingerprint, first.entry.inputFingerprint);
  assert.equal(second.metrics.repositoryScans, 1);
});

test('corrupt cache content is never trusted and is rebuilt as a miss', (t) => {
  const rootDir = tempProject(t);
  const c = contract(rootDir);
  const first = resolveRepositoryContextCache({ contract: c, rootDir });
  fs.writeFileSync(first.cachePath, '{"schemaVersion":"broken"}\n', 'utf8');

  const rebuilt = resolveRepositoryContextCache({ contract: c, rootDir });
  assert.equal(rebuilt.status, 'MISS');
  assert.equal(rebuilt.invalidationReason, 'CACHE_ENTRY_INVALID');
  assert.equal(validateContextCacheEntry(rebuilt.entry), true);
});

test('cache deletion degrades to a correct miss rather than becoming authority loss', (t) => {
  const rootDir = tempProject(t);
  const c = contract(rootDir);
  const first = resolveRepositoryContextCache({ contract: c, rootDir });
  assert.equal(first.status, 'MISS');

  clearContextCache(rootDir);
  const rebuilt = resolveRepositoryContextCache({ contract: c, rootDir });
  assert.equal(rebuilt.status, 'MISS');
  assert.equal(validateContextCacheEntry(rebuilt.entry), true);
});

test('legacy non-target-aware contracts remain supported through one project-root cache boundary', (t) => {
  const rootDir = tempProject(t);
  const legacy = createDevelopmentContract({
    rootDir,
    task: {
      ...task(),
      id: 'TASK-LEGACY-CACHE',
      targetBinding: undefined,
    },
    authoritativeSources: [{
      path: 'docs/spec.md',
      kind: 'specification',
      authority: 'required',
      sections: ['REQ-1'],
    }],
    createdAt: '2026-10-07T19:03:00.000Z',
  });

  const resolved = resolveRepositoryContextCache({
    contract: legacy,
    rootDir,
    relevantFiles: ['units/alpha/index.mjs'],
  });
  assert.equal(resolved.status, 'MISS');
  assert.equal(resolved.entry.targetFacts[0].targetId, '__project_root__');
  assert.equal(resolved.entry.targetFacts[0].root, '.');
});
