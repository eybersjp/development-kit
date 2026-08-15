/**
 * Development Kit Intelligence — Phase 3 Test Suite (Staleness and Provenance)
 *
 * Tests:
 * 1. Artifact fingerprint computation matches file SHA-256
 * 2. Unchanged source artifact keeps record fresh and active
 * 3. Changed source artifact marks record as stale
 * 4. Record past expiresAt timestamp is identified as stale
 * 5. evaluateAndRefreshStaleness marks stale records in provider storage
 * 6. Superseded decision is excluded from active truth query but remains inspectable
 * 7. formatRecordProvenance produces clear structured provenance string
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LocalMemoryProvider } from '../runtime/intelligence/local-memory-provider.mjs';
import {
  computeRecordSourceFingerprint,
  isRecordStale,
  evaluateAndRefreshStaleness,
  formatRecordProvenance,
} from '../runtime/intelligence/staleness-provenance.mjs';
import {
  MEMORY_SCHEMA_VERSION,
  MemoryType,
  MemoryScope,
  MemoryAuthority,
  MemoryStatus,
} from '../runtime/intelligence/memory-enums.mjs';
import { computeFileFingerprint } from '../runtime/autopilot/staleness-engine.mjs';

function makeTempProject(prefix = 'dk-phase3-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('1. Artifact fingerprint computation matches file SHA-256', (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const artifactFile = join(rootDir, 'architecture.md');
  writeFileSync(artifactFile, '# Architecture\nPostgreSQL is our database.', 'utf8');

  const expectedHash = computeFileFingerprint(artifactFile);
  const calculatedHash = computeRecordSourceFingerprint(
    { type: 'artifact', ref: 'architecture.md' },
    rootDir,
  );

  assert.equal(calculatedHash, expectedHash);
  assert.ok(calculatedHash && calculatedHash.length === 64);
});

test('2. Unchanged source artifact keeps record fresh and active', (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const artifactFile = join(rootDir, 'architecture.md');
  writeFileSync(artifactFile, '# Architecture\nPostgreSQL is our database.', 'utf8');
  const hash = computeFileFingerprint(artifactFile);

  const record = {
    id: 'mem_fresh_1',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.FACT,
    scope: MemoryScope.PROJECT,
    projectId: 'proj_test',
    subject: 'db',
    content: 'PostgreSQL db',
    authority: MemoryAuthority.REPOSITORY_VERIFIED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'artifact', ref: 'architecture.md', fingerprint: hash },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.equal(isRecordStale(record, rootDir), false);
});

test('3. Changed source artifact marks record as stale', (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const artifactFile = join(rootDir, 'architecture.md');
  writeFileSync(artifactFile, '# Architecture\nPostgreSQL is our database.', 'utf8');
  const originalHash = computeFileFingerprint(artifactFile);

  const record = {
    id: 'mem_dependent_1',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.FACT,
    scope: MemoryScope.PROJECT,
    projectId: 'proj_test',
    subject: 'db',
    content: 'PostgreSQL db',
    authority: MemoryAuthority.REPOSITORY_VERIFIED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'artifact', ref: 'architecture.md', fingerprint: originalHash },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Modify file
  writeFileSync(artifactFile, '# Architecture\nChanged to DynamoDB.', 'utf8');

  assert.equal(isRecordStale(record, rootDir), true);
});

test('4. Record past expiresAt timestamp is identified as stale', () => {
  const pastDate = new Date(Date.now() - 60000).toISOString();
  const record = {
    id: 'mem_expired_1',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.FACT,
    scope: MemoryScope.PROJECT,
    projectId: 'proj_test',
    subject: 'temporary-token',
    content: 'OAuth access window',
    authority: MemoryAuthority.SYSTEM_VERIFIED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'system' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: pastDate,
  };

  assert.equal(isRecordStale(record), true);
});

test('5. evaluateAndRefreshStaleness marks stale records in provider storage', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const artifactFile = join(rootDir, 'spec.md');
  writeFileSync(artifactFile, '# Spec v1', 'utf8');
  const hash = computeFileFingerprint(artifactFile);

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  const record = {
    id: 'mem_stale_refresh_1',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Spec detail',
    content: 'Initial spec details',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'artifact', ref: 'spec.md', fingerprint: hash },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await provider.store(record);

  // Modify source artifact
  writeFileSync(artifactFile, '# Spec v2 - Heavily modified', 'utf8');

  const staleRecords = await evaluateAndRefreshStaleness(provider, rootDir);
  assert.equal(staleRecords.length, 1);
  assert.equal(staleRecords[0].id, 'mem_stale_refresh_1');
  assert.equal(staleRecords[0].status, MemoryStatus.STALE);

  const reloaded = await provider.get('mem_stale_refresh_1');
  assert.equal(reloaded.status, MemoryStatus.STALE);
});

test('6. Superseded decision is excluded from active truth query but remains inspectable', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);
  const oldRec = {
    id: 'mem_old_truth',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Runtime',
    content: 'Use Node 16',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'user_decision' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await provider.store(oldRec);

  await provider.supersede('mem_old_truth', {
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Runtime',
    content: 'Use Node 18 LTS',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'user_decision' },
  });

  // Active query only retrieves the new truth
  const activeResults = await provider.query({ types: [MemoryType.DECISION] });
  assert.equal(activeResults.length, 1);
  assert.equal(activeResults[0].record.content, 'Use Node 18 LTS');

  // Direct inspect still fetches the superseded historical record
  const inspectOld = await provider.get('mem_old_truth');
  assert.ok(inspectOld);
  assert.equal(inspectOld.status, MemoryStatus.SUPERSEDED);
});

test('7. formatRecordProvenance produces clear structured provenance string', () => {
  const record = {
    source: {
      type: 'artifact',
      ref: 'docs/architecture.md',
      fingerprint: 'a1b2c3d4e5f6g7h8i9',
      details: 'Approved by lead architect',
    },
  };

  const formatted = formatRecordProvenance(record);
  assert.match(formatted, /Source: artifact/);
  assert.match(formatted, /Reference: docs\/architecture\.md/);
  assert.match(formatted, /Fingerprint: a1b2c3d4\.\.\./);
  assert.match(formatted, /Details: Approved by lead architect/);
});
