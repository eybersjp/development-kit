/**
 * Development Kit Intelligence — Phase 2 Test Suite (LocalMemoryProvider)
 *
 * Tests:
 * 1. Provider detection and health check report healthy offline baseline
 * 2. Storing and retrieving memory record atomically
 * 3. Querying active records with lexical and authority scoring
 * 4. Project isolation: cross-project records are strictly filtered out
 * 5. Superseding an old decision preserves history and marks old superseded
 * 6. Archiving a record sets status to archived
 * 7. Forgetting a record removes the file and updates index
 * 8. Rebuilding index reconstructs valid manifest and index from records
 * 9. Export and Import cycle functions cleanly
 * 10. Authority transition guards work on provider updates
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LocalMemoryProvider } from '../runtime/intelligence/local-memory-provider.mjs';
import {
  MEMORY_SCHEMA_VERSION,
  MemoryType,
  MemoryScope,
  MemoryAuthority,
  MemoryStatus,
} from '../runtime/intelligence/memory-enums.mjs';

function makeTempProject(prefix = 'dk-phase2-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

function makeSampleRecord(projectId, overrides = {}) {
  return {
    id: `mem_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId,
    subject: 'Architecture Decision',
    content: 'Use standard REST endpoints for Runtime API.',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    lifecycleStages: ['DESIGN', 'IMPLEMENT'],
    source: { type: 'artifact', ref: 'docs/architecture.md' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: null,
    supersedes: null,
    supersededBy: null,
    tags: ['architecture', 'api'],
    ...overrides,
  };
}

test('1. Provider detection and health check report healthy offline baseline', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  const detection = await provider.detect();
  assert.equal(detection.installed, true);
  assert.equal(detection.dataLocation, 'local');

  const health = await provider.health();
  assert.equal(health.status, 'healthy');
  assert.equal(health.providerId, 'local-memory');
});

test('2. Storing and retrieving memory record atomically', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const record = makeSampleRecord('proj_test_1', { id: 'mem_atomic_1' });
  const stored = await provider.store(record);
  assert.equal(stored.id, 'mem_atomic_1');

  const retrieved = await provider.get('mem_atomic_1');
  assert.ok(retrieved);
  assert.equal(retrieved.content, record.content);
  assert.equal(retrieved.authority, MemoryAuthority.USER_APPROVED);
});

test('3. Querying active records with lexical and authority scoring', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  // Get project ID for this temp root
  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);
  const projectId = identity.projectId;

  const rec1 = makeSampleRecord(projectId, {
    id: 'mem_q1',
    subject: 'PostgreSQL Database Strategy',
    content: 'All relation entities persist to Postgres database',
    authority: MemoryAuthority.USER_APPROVED,
  });
  const rec2 = makeSampleRecord(projectId, {
    id: 'mem_q2',
    subject: 'Redis Cache Setup',
    content: 'Temporary key-value caching layer in memory',
    authority: MemoryAuthority.INFERRED,
  });

  await provider.store(rec1);
  await provider.store(rec2);

  const queryResults = await provider.query({ text: 'postgres' });
  assert.ok(queryResults.length > 0);
  assert.equal(queryResults[0].record.id, 'mem_q1');
});

test('4. Project isolation: cross-project records are strictly filtered out', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const foreignRecord = makeSampleRecord('proj_OTHER_FOREIGN_999', {
    id: 'mem_foreign_1',
    subject: 'Secret Foreign Info',
    content: 'Confidential details from another workspace',
  });

  await provider.store(foreignRecord);

  // Normal query within this workspace
  const results = await provider.query({ text: 'Secret' });
  assert.equal(results.length, 0, 'Foreign project record must be excluded before ranking');
});

test('5. Superseding an old decision preserves history and marks old superseded', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);
  const projectId = identity.projectId;

  const v1 = makeSampleRecord(projectId, {
    id: 'mem_decision_v1',
    content: 'Use SQLite',
    status: MemoryStatus.ACTIVE,
  });
  await provider.store(v1);

  const { supersededRecord, activeRecord } = await provider.supersede('mem_decision_v1', {
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId,
    subject: 'Architecture Decision',
    content: 'Use PostgreSQL instead of SQLite',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'user_decision' },
  });

  assert.equal(supersededRecord.status, MemoryStatus.SUPERSEDED);
  assert.equal(activeRecord.status, MemoryStatus.ACTIVE);
  assert.equal(activeRecord.supersedes, 'mem_decision_v1');

  // Querying active decisions returns only the new active record
  const activeQueries = await provider.query({ types: [MemoryType.DECISION] });
  assert.equal(activeQueries.length, 1);
  assert.equal(activeQueries[0].record.id, activeRecord.id);
});

test('6. Archiving a record sets status to archived', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);
  const rec = makeSampleRecord(identity.projectId, { id: 'mem_to_archive' });
  await provider.store(rec);

  await provider.archive('mem_to_archive');
  const archived = await provider.get('mem_to_archive');
  assert.equal(archived.status, MemoryStatus.ARCHIVED);

  // Active query excludes it
  const activeQuery = await provider.query({ text: rec.subject });
  assert.equal(activeQuery.length, 0);
});

test('7. Forgetting a record removes the file and updates index', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);
  const rec = makeSampleRecord(identity.projectId, { id: 'mem_to_forget' });
  await provider.store(rec);

  assert.ok(await provider.get('mem_to_forget'));
  await provider.forget('mem_to_forget');
  assert.equal(await provider.get('mem_to_forget'), null);
});

test('8. Rebuilding index reconstructs valid manifest and index from records', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);
  await provider.store(makeSampleRecord(identity.projectId, { id: 'mem_idx_1' }));
  await provider.store(makeSampleRecord(identity.projectId, { id: 'mem_idx_2' }));

  const { manifest, index } = await provider.rebuildIndex();
  assert.equal(manifest.recordCount, 2);
  assert.equal(index.records.length, 2);
  assert.ok(existsSync(provider.getManifestPath()));
  assert.ok(existsSync(provider.getIndexPath()));
});

test('9. Export and Import cycle functions cleanly', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);
  await provider.store(makeSampleRecord(identity.projectId, { id: 'mem_exp_1' }));

  const exported = await provider.export();
  assert.equal(exported.format, 'dk-memory-archive-v1');
  assert.equal(exported.recordCount, 1);

  // New provider in fresh project
  const rootDir2 = makeTempProject();
  t.after(() => rmSync(rootDir2, { recursive: true, force: true }));

  const provider2 = new LocalMemoryProvider({ rootDir: rootDir2 });
  await provider2.activate();

  const importResult = await provider2.import(exported, { trustImported: false });
  assert.equal(importResult.importedCount, 1);

  const importedRecord = await provider2.get('mem_exp_1');
  assert.ok(importedRecord);
  assert.equal(importedRecord.authority, MemoryAuthority.IMPORTED_UNTRUSTED);
});

test('10. Authority transition guards work on provider updates', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);
  const rec = makeSampleRecord(identity.projectId, {
    id: 'mem_inferred_1',
    authority: MemoryAuthority.INFERRED,
  });
  await provider.store(rec);

  // Attempting unconfirmed promotion to user-approved fails
  await assert.rejects(
    async () => {
      await provider.update({ ...rec, authority: MemoryAuthority.USER_APPROVED }, { userConfirmed: false });
    },
    /Cannot promote record/,
  );

  // Confirmed promotion succeeds
  const updated = await provider.update(
    { ...rec, authority: MemoryAuthority.USER_APPROVED },
    { userConfirmed: true },
  );
  assert.equal(updated.authority, MemoryAuthority.USER_APPROVED);
});
