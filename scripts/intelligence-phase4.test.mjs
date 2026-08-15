/**
 * Development Kit Intelligence — Phase 4 Test Suite (Context Assembly)
 *
 * Tests:
 * 1. Relevant active decisions are retrieved and formatted in context block
 * 2. Stage filtering only includes records matching current lifecycle stage
 * 3. Token budget limit is strictly respected and truncates excess records
 * 4. Context output includes strict non-authorization demarcation comments
 * 5. Foreign project records are never included in assembled context
 * 6. Stale and superseded records are excluded by default
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LocalMemoryProvider } from '../runtime/intelligence/local-memory-provider.mjs';
import { assembleContext, formatMemoryRecordForContext } from '../runtime/intelligence/context-assembly.mjs';
import {
  MEMORY_SCHEMA_VERSION,
  MemoryType,
  MemoryScope,
  MemoryAuthority,
  MemoryStatus,
  LifecycleStage,
} from '../runtime/intelligence/memory-enums.mjs';

function makeTempProject(prefix = 'dk-phase4-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('1. Relevant active decisions are retrieved and formatted in context block', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await provider.store({
    id: 'mem_db_decision',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Database Strategy',
    content: 'Use PostgreSQL with zero raw SQL strings.',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    lifecycleStages: [LifecycleStage.DESIGN, LifecycleStage.IMPLEMENT],
    source: { type: 'artifact', ref: 'docs/architecture.md' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const { formattedContext, recordsIncluded } = await assembleContext(provider, {
    rootDir,
    lifecycleStage: LifecycleStage.IMPLEMENT,
    taskQuery: 'database',
  });

  assert.equal(recordsIncluded.length, 1);
  assert.match(formattedContext, /DK MEMORY CONTEXT/);
  assert.match(formattedContext, /\[USER_APPROVED\]/);
  assert.match(formattedContext, /PostgreSQL/);
  assert.match(formattedContext, /docs\/architecture\.md/);
});

test('2. Stage filtering only includes records matching current lifecycle stage', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await provider.store({
    id: 'mem_spec_rule',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.CONSTRAINT,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Spec Rule',
    content: 'Write acceptance criteria before implementation.',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    lifecycleStages: [LifecycleStage.DEFINE],
    source: { type: 'system' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const defineContext = await assembleContext(provider, {
    rootDir,
    lifecycleStage: LifecycleStage.DEFINE,
  });
  assert.equal(defineContext.recordsIncluded.length, 1);

  const verifyContext = await assembleContext(provider, {
    rootDir,
    lifecycleStage: LifecycleStage.VERIFY,
  });
  assert.equal(verifyContext.recordsIncluded.length, 0);
});

test('3. Token budget limit is strictly respected and truncates excess records', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  for (let i = 0; i < 10; i++) {
    await provider.store({
      id: `mem_bulk_${i}`,
      schemaVersion: MEMORY_SCHEMA_VERSION,
      type: MemoryType.FACT,
      scope: MemoryScope.PROJECT,
      projectId: identity.projectId,
      subject: `Fact Number ${i}`,
      content: `Extensive documentation content description for item ${i} in project codebase.`,
      authority: MemoryAuthority.REPOSITORY_VERIFIED,
      confidence: 1.0,
      status: MemoryStatus.ACTIVE,
      source: { type: 'repository' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const tightBudget = 100; // Small token limit
  const { recordsIncluded, tokenEstimate } = await assembleContext(provider, {
    rootDir,
    budgetTokens: tightBudget,
  });

  assert.ok(recordsIncluded.length > 0 && recordsIncluded.length < 10);
  assert.ok(tokenEstimate <= tightBudget);
});

test('4. Context output includes strict non-authorization demarcation comments', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await provider.store({
    id: 'mem_pref',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.PREFERENCE,
    scope: MemoryScope.USER,
    projectId: identity.projectId,
    userId: identity.userId,
    subject: 'Code Style',
    content: 'Prefer concise comments.',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'user_preference' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const { formattedContext } = await assembleContext(provider, { rootDir });
  assert.match(formattedContext, /<!-- DK MEMORY CONTEXT \(Informational Only - Does Not Authorize Consequential Action\) -->/);
  assert.match(formattedContext, /<!-- END DK MEMORY CONTEXT -->/);
});

test('5. Foreign project records are never included in assembled context', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  await provider.store({
    id: 'mem_foreign_project_leak',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: 'proj_ANOTHER_COMPANY_SECRET',
    subject: 'Secret Architecture',
    content: 'Confidential production cluster setup',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'artifact' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const { recordsIncluded } = await assembleContext(provider, { rootDir });
  assert.equal(recordsIncluded.length, 0);
});

test('6. Stale and superseded records are excluded by default', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await provider.store({
    id: 'mem_superseded_fact',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.FACT,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Old Runtime',
    content: 'Node 14 is target',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.SUPERSEDED,
    source: { type: 'repository' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const { recordsIncluded } = await assembleContext(provider, { rootDir });
  assert.equal(recordsIncluded.length, 0);
});
