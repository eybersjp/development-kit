import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  captureRepositoryContextInputs,
  clearContextCache,
  resolveRepositoryContextCache,
} from '../runtime/orchestration/context-cache.mjs';
import {
  checkExecutionCapsuleStaleness,
  createExecutionCapsule,
  prepareExecutionCapsule,
  validateExecutionCapsule,
} from '../runtime/orchestration/execution-capsule.mjs';
import {
  buildContextPackage,
  assertIndependentVerificationContext,
} from '../runtime/orchestration/context-package.mjs';
import { createDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';
import {
  compareCostRecords,
  createCostRecord,
} from '../runtime/orchestration/cost-observatory.mjs';
import { persistWorkspaceTargetRegistry } from '../runtime/orchestration/workspace-targets.mjs';

function tempProject(t, { bindBeta = false, manyFiles = false } = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-execution-capsule-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'units', 'alpha', 'tests'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'units', 'beta', 'tests'), { recursive: true });

  fs.writeFileSync(
    path.join(rootDir, 'docs', 'spec.md'),
    '# Specification\n\n## REQ-1\nApproved behavior only.\n\n## REQ-2\nUnrelated requirement.\n',
    'utf8',
  );
  fs.writeFileSync(path.join(rootDir, 'units', 'alpha', 'index.mjs'), 'export const alpha = 1;\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'units', 'alpha', 'tests', 'alpha.test.mjs'), 'export const alphaTest = true;\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'units', 'beta', 'index.mjs'), 'export const beta = 1;\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'units', 'beta', 'tests', 'beta.test.mjs'), 'export const betaTest = true;\n', 'utf8');

  if (manyFiles) {
    for (let i = 0; i < 80; i += 1) {
      fs.writeFileSync(path.join(rootDir, 'units', 'alpha', `module-${String(i).padStart(3, '0')}.mjs`), `export const a${i} = ${i};\n`, 'utf8');
      fs.writeFileSync(path.join(rootDir, 'units', 'beta', `module-${String(i).padStart(3, '0')}.mjs`), `export const b${i} = ${i};\n`, 'utf8');
    }
  }

  persistWorkspaceTargetRegistry({
    schemaVersion: 1,
    targets: {
      alpha: {
        path: 'units/alpha',
        kind: 'arbitrary-a',
        dependencies: [],
        commands: { test: 'node tests/alpha.test.mjs' },
        capabilities: ['quality'],
        verification: ['test'],
        adapter: null,
      },
      beta: {
        path: 'units/beta',
        kind: 'arbitrary-b',
        dependencies: [],
        commands: { test: 'node tests/beta.test.mjs' },
        capabilities: ['quality'],
        verification: ['test'],
        adapter: null,
      },
    },
  }, rootDir);

  const task = {
    id: bindBeta ? 'TASK-CAPSULE-COMPARE' : 'TASK-CAPSULE',
    projectId: 'proj-capsule',
    status: 'approved',
    objective: 'Build deterministic compact role context',
    scope: { in: ['units/alpha'], out: ['Do not change unrelated targets'] },
    requirements: ['REQ-1'],
    acceptanceCriteria: [{
      id: 'AC-CAPSULE',
      statement: 'Capsule remains fresh and source-authoritative',
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
    targetBinding: {
      primary: 'alpha',
      affected: ['alpha'],
      verification: bindBeta ? ['alpha', 'beta'] : ['alpha'],
    },
  };

  const contract = createDevelopmentContract({
    rootDir,
    task,
    authoritativeSources: [{
      path: 'docs/spec.md',
      kind: 'specification',
      authority: 'required',
      sections: ['REQ-1'],
    }],
    createdAt: '2026-10-07T19:10:00.000Z',
  });

  return { rootDir, contract };
}

function capsuleInput(contract, rootDir, overrides = {}) {
  return {
    contract,
    rootDir,
    targetIds: ['alpha'],
    relevantFiles: ['units/alpha/index.mjs'],
    relevantTests: ['units/alpha/tests/alpha.test.mjs'],
    changedFiles: ['units/alpha/index.mjs'],
    runId: 'run-capsule',
    lifecycleId: 'life-capsule',
    verifiedRuntimeFacts: [{
      id: 'fact-node-runtime',
      value: { available: true },
      observedAt: '2026-10-07T19:11:00.000Z',
      provenance: {
        kind: 'verification-command',
        id: 'node-version-check',
        fingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    }],
    upstreamAcceptedTasks: [{
      taskId: 'TASK-UPSTREAM',
      contractId: 'INC-TASK-UPSTREAM',
      sourceFingerprint: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      acceptanceFingerprint: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    }],
    requiredGateProfileIds: ['standard-current-gates'],
    createdAt: '2026-10-07T19:12:00.000Z',
    ...overrides,
  };
}

test('AC-008 identical semantic inputs produce the same deterministic capsule across cache miss/hit', (t) => {
  const { rootDir, contract } = tempProject(t);
  const first = prepareExecutionCapsule(capsuleInput(contract, rootDir));
  const second = prepareExecutionCapsule(capsuleInput(contract, rootDir, {
    createdAt: '2026-10-07T19:13:00.000Z',
  }));

  assert.equal(first.cache.status, 'MISS');
  assert.equal(second.cache.status, 'HIT');
  assert.equal(first.capsule.capsuleId, second.capsule.capsuleId);
  assert.equal(first.capsule.capsuleFingerprint, second.capsule.capsuleFingerprint);
  assert.equal(validateExecutionCapsule(second.capsule), true);
});

test('AC-008 capsule feeds fresh implementation and independent verification contexts without replacing source rehydration', (t) => {
  const { rootDir, contract } = tempProject(t);
  const prepared = prepareExecutionCapsule(capsuleInput(contract, rootDir));

  const implementation = buildContextPackage({
    contract,
    role: 'implementation-agent',
    rootDir,
    executionCapsule: prepared.capsule,
    createdAt: '2026-10-07T19:14:00.000Z',
  });

  assert.equal(implementation.executionCapsule.capsuleId, prepared.capsule.capsuleId);
  assert.equal(implementation.isolationMetadata.repositoryReRead, false);
  assert.equal(implementation.isolationMetadata.repositoryContextFromCapsule, true);
  assert.equal(implementation.isolationMetadata.capsuleFreshnessVerified, true);
  assert.equal(implementation.isolationMetadata.authoritativeSourcesReRead, true);
  assert.equal(implementation.authoritativeSources[0].delivery.mode, 'scoped');
  assert.match(implementation.authoritativeSources[0].content, /Approved behavior only/);
  assert.doesNotMatch(implementation.authoritativeSources[0].content, /Unrelated requirement/);

  const verifier = buildContextPackage({
    contract,
    role: 'spec-reviewer',
    rootDir,
    executionCapsule: prepared.capsule,
    createdAt: '2026-10-07T19:15:00.000Z',
  });
  assert.equal(assertIndependentVerificationContext(verifier), true);
  assert.equal(verifier.isolationMetadata.sourceRehydrated, true);
});

test('AC-009 relevant repository file changes invalidate a capsule and block role-context construction', (t) => {
  const { rootDir, contract } = tempProject(t);
  const prepared = prepareExecutionCapsule(capsuleInput(contract, rootDir));

  fs.writeFileSync(path.join(rootDir, 'units', 'alpha', 'index.mjs'), 'export const alpha = 2;\n', 'utf8');

  const stale = checkExecutionCapsuleStaleness({
    capsule: prepared.capsule,
    contract,
    rootDir,
  });
  assert.equal(stale.stale, true);
  assert.ok(stale.changes.some((change) => change.code === 'CAPSULE_CACHE_STALE'));

  assert.throws(() => buildContextPackage({
    contract,
    role: 'implementation-agent',
    rootDir,
    executionCapsule: prepared.capsule,
  }), /stale Execution Capsule/);
});

test('AC-009 authoritative source changes still invalidate the contract/capsule before context construction', (t) => {
  const { rootDir, contract } = tempProject(t);
  const prepared = prepareExecutionCapsule(capsuleInput(contract, rootDir));

  fs.appendFileSync(path.join(rootDir, 'docs', 'spec.md'), '\nChanged authority.\n', 'utf8');
  const stale = checkExecutionCapsuleStaleness({
    capsule: prepared.capsule,
    contract,
    rootDir,
  });

  assert.equal(stale.stale, true);
  assert.ok(stale.changes.some((change) => change.code === 'CAPSULE_CONTRACT_STALE'));
  assert.throws(() => buildContextPackage({
    contract,
    role: 'spec-reviewer',
    rootDir,
    executionCapsule: prepared.capsule,
  }), /stale Development Contract|stale Execution Capsule/);
});

test('unrelated target changes do not invalidate a target-scoped capsule when authority remains unchanged', (t) => {
  const { rootDir, contract } = tempProject(t);
  const prepared = prepareExecutionCapsule(capsuleInput(contract, rootDir));

  fs.writeFileSync(path.join(rootDir, 'units', 'beta', 'index.mjs'), 'export const beta = 99;\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'units', 'beta', 'extra.mjs'), 'export {};\n', 'utf8');

  const report = checkExecutionCapsuleStaleness({
    capsule: prepared.capsule,
    contract,
    rootDir,
  });
  assert.equal(report.stale, false);

  const next = prepareExecutionCapsule(capsuleInput(contract, rootDir, {
    changedFiles: [],
    createdAt: '2026-10-07T19:16:00.000Z',
  }));
  assert.equal(next.cache.status, 'HIT');
});

test('missing disposable cache invalidates the old capsule, while a full cache miss rebuilds correct context', (t) => {
  const { rootDir, contract } = tempProject(t);
  const prepared = prepareExecutionCapsule(capsuleInput(contract, rootDir));
  clearContextCache(rootDir);

  const stale = checkExecutionCapsuleStaleness({
    capsule: prepared.capsule,
    contract,
    rootDir,
  });
  assert.equal(stale.stale, true);
  assert.ok(stale.changes.some((change) => change.code === 'CAPSULE_CACHE_ENTRY_MISSING'));

  const rebuilt = prepareExecutionCapsule(capsuleInput(contract, rootDir, {
    createdAt: '2026-10-07T19:17:00.000Z',
  }));
  assert.equal(rebuilt.cache.status, 'MISS');

  const context = buildContextPackage({
    contract,
    role: 'implementation-agent',
    rootDir,
    executionCapsule: rebuilt.capsule,
  });
  assert.equal(context.isolationMetadata.capsuleFreshnessVerified, true);
});

test('present changed files automatically join the capsule invalidation set', (t) => {
  const { rootDir, contract } = tempProject(t);
  const prepared = prepareExecutionCapsule(capsuleInput(contract, rootDir, {
    relevantFiles: [],
    changedFiles: ['units/alpha/index.mjs'],
  }));

  assert.deepEqual(
    prepared.capsule.repositoryContext.relevantFiles.map((ref) => ref.path),
    ['units/alpha/index.mjs'],
  );

  fs.writeFileSync(path.join(rootDir, 'units', 'alpha', 'index.mjs'), 'export const alpha = 55;\n', 'utf8');
  const report = checkExecutionCapsuleStaleness({
    capsule: prepared.capsule,
    contract,
    rootDir,
  });
  assert.equal(report.stale, true);
  assert.ok(report.changes.some((change) => change.code === 'CAPSULE_CACHE_STALE'));
});

test('createExecutionCapsule rejects forged or internally inconsistent cache entries', (t) => {
  const { rootDir, contract } = tempProject(t);
  const resolution = resolveRepositoryContextCache({
    contract,
    rootDir,
    targetIds: ['alpha'],
    relevantFiles: ['units/alpha/index.mjs'],
  });
  const forged = structuredClone(resolution);
  forged.entry.entryFingerprint = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';

  assert.throws(() => createExecutionCapsule({
    contract,
    rootDir,
    cacheResolution: forged,
    changedFiles: [],
    createdAt: '2026-10-07T19:18:00.000Z',
  }), /cacheResolution entry is invalid/);
});

test('capsule stores authority references and provenance, not copied source history or authoritative summaries', (t) => {
  const { rootDir, contract } = tempProject(t);
  const prepared = prepareExecutionCapsule(capsuleInput(contract, rootDir));
  const capsule = prepared.capsule;

  assert.equal(capsule.authoritativeSources[0].path, 'docs/spec.md');
  assert.equal(Object.hasOwn(capsule.authoritativeSources[0], 'content'), false);
  assert.equal(capsule.verifiedRuntimeFacts[0].authority, 'non-authoritative-observation');
  assert.equal(capsule.verifiedRuntimeFacts[0].provenance.kind, 'verification-command');
  assert.deepEqual(capsule.targetDelta.changedTargets, ['alpha']);
  assert.deepEqual(capsule.targetDelta.affectedTargets, ['alpha']);
  assert.deepEqual(capsule.targetDelta.dependencyTargets, ['alpha']);
});

test('AC-035 Cost Observatory reports measured target-orientation and context-volume improvement where observable', (t) => {
  const { rootDir, contract } = tempProject(t, { bindBeta: true, manyFiles: true });

  const baselineSnapshot = captureRepositoryContextInputs({
    contract,
    rootDir,
    targetIds: ['alpha', 'beta'],
    relevantFiles: ['units/alpha/index.mjs', 'units/beta/index.mjs'],
    relevantTests: ['units/alpha/tests/alpha.test.mjs', 'units/beta/tests/beta.test.mjs'],
  });
  const baselineContext = buildContextPackage({
    contract,
    role: 'implementation-agent',
    rootDir,
    repositoryState: {
      authority: 'non-authoritative-repository-orientation',
      targetFacts: baselineSnapshot.targetFacts,
    },
    createdAt: '2026-10-07T19:20:00.000Z',
  });

  prepareExecutionCapsule(capsuleInput(contract, rootDir, {
    changedFiles: [],
    createdAt: '2026-10-07T19:21:00.000Z',
  }));
  const currentPrepared = prepareExecutionCapsule(capsuleInput(contract, rootDir, {
    changedFiles: [],
    createdAt: '2026-10-07T19:22:00.000Z',
  }));
  assert.equal(currentPrepared.cache.status, 'HIT');

  const currentContext = buildContextPackage({
    contract,
    role: 'implementation-agent',
    rootDir,
    executionCapsule: currentPrepared.capsule,
    createdAt: '2026-10-07T19:23:00.000Z',
  });

  const baselineRecord = createCostRecord({
    operationId: 'capsule-baseline',
    contractId: contract.contractId,
    taskId: contract.taskId,
    role: 'implementation-agent',
    context: JSON.stringify(baselineContext),
    counters: {
      repositoryReads: baselineSnapshot.metrics.repositoryReads,
      repositoryScans: baselineSnapshot.metrics.repositoryScans,
      cacheHits: 0,
      cacheMisses: 0,
    },
    startedAt: '2026-10-07T19:24:00.000Z',
    completedAt: '2026-10-07T19:24:01.000Z',
  });
  const currentRecord = createCostRecord({
    operationId: 'capsule-current',
    contractId: contract.contractId,
    taskId: contract.taskId,
    role: 'implementation-agent',
    context: JSON.stringify(currentContext),
    counters: {
      repositoryReads: currentPrepared.cache.metrics.repositoryReads,
      repositoryScans: currentPrepared.cache.metrics.repositoryScans,
      cacheHits: currentPrepared.cache.metrics.cacheHits,
      cacheMisses: currentPrepared.cache.metrics.cacheMisses,
    },
    startedAt: '2026-10-07T19:25:00.000Z',
    completedAt: '2026-10-07T19:25:01.000Z',
  });

  const comparison = compareCostRecords(baselineRecord, currentRecord);
  process.stdout.write(`T03_COST_EVIDENCE ${JSON.stringify({
    baselineContextBytes: baselineRecord.contextBytes,
    currentContextBytes: currentRecord.contextBytes,
    contextBytesReductionPercent: comparison.metrics.contextBytes.reductionPercent,
    baselineEstimatedContextTokens: baselineRecord.estimatedContextTokens,
    currentEstimatedContextTokens: currentRecord.estimatedContextTokens,
    estimatedContextTokensReductionPercent: comparison.metrics.estimatedContextTokens.reductionPercent,
    baselineRepositoryScans: baselineRecord.repositoryScans,
    currentRepositoryScans: currentRecord.repositoryScans,
    repositoryScansReductionPercent: comparison.metrics.repositoryScans.reductionPercent,
    cacheHits: currentRecord.cacheHits,
    cacheMisses: currentRecord.cacheMisses,
  })}\n`);
  assert.equal(comparison.metrics.repositoryScans.reductionPercent, 50);
  assert.ok(comparison.metrics.contextBytes.reductionPercent > 0);
  assert.ok(comparison.metrics.estimatedContextTokens.reductionPercent > 0);
});
