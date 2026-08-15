/**
 * Development Kit Runtime API — Phase 6 Test Suite
 *
 * Tests:
 * 1. Runtime API starts on loopback and serves GET /v1/status and /v1/health
 * 2. GET /v1/project returns identity and effective settings
 * 3. GET /v1/workflow returns current autopilot state or null
 * 4. GET /v1/memory and POST /v1/memory/query return accessible records
 * 5. GET /v1/decisions lists active decisions
 * 6. Non-GET requests without valid X-DK-Session-Token are rejected with 401
 * 7. Non-loopback Origin headers are rejected with 403 Forbidden
 * 8. Governed write (POST /v1/memory) with valid token creates record
 * 9. Governed patch (PATCH /v1/memory/:id) respects authority transition guards
 * 10. Archive and Delete endpoints correctly mutate record state
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { RuntimeApiService } from '../runtime/api/runtime-api-service.mjs';
import {
  MEMORY_SCHEMA_VERSION,
  MemoryType,
  MemoryScope,
  MemoryAuthority,
  MemoryStatus,
} from '../runtime/intelligence/memory-enums.mjs';

function makeTempProject(prefix = 'dk-phase6-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('1. Runtime API starts on loopback and serves GET /v1/status and /v1/health', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  assert.equal(started.host, '127.0.0.1');
  assert.ok(started.port > 0);

  const statusRes = await fetch(`${started.url}/v1/status`);
  assert.equal(statusRes.status, 200);
  const statusJson = await statusRes.json();
  assert.equal(statusJson.runtimeVersion, '0.7.0');
  assert.equal(statusJson.frameworkVersion, '0.6.1');

  const healthRes = await fetch(`${started.url}/v1/health`);
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.status, 'healthy');
});

test('2. GET /v1/project returns identity and effective settings', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const res = await fetch(`${started.url}/v1/project`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.identity.projectId);
  assert.equal(json.settings.controlCenter.autoOpen, false);
});

test('3. GET /v1/workflow returns current autopilot state or null', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const res = await fetch(`${started.url}/v1/workflow`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.state, null);
});

test('4. GET /v1/memory and POST /v1/memory/query return accessible records', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await api.memoryProvider.store({
    id: 'mem_api_test_1',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.FACT,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'API Fact',
    content: 'Served over HTTP endpoint',
    authority: MemoryAuthority.REPOSITORY_VERIFIED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'system' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const listRes = await fetch(`${started.url}/v1/memory`);
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.equal(listJson.records.length, 1);
  assert.equal(listJson.records[0].id, 'mem_api_test_1');

  // Query endpoint (POST requires session token)
  const queryRes = await fetch(`${started.url}/v1/memory/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify({ text: 'HTTP endpoint' }),
  });
  assert.equal(queryRes.status, 200);
  const queryJson = await queryRes.json();
  assert.equal(queryJson.results.length, 1);
});

test('5. GET /v1/decisions lists active decisions', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await api.memoryProvider.store({
    id: 'mem_dec_api_1',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Decision 1',
    content: 'Approved architecture item',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'user_decision' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const res = await fetch(`${started.url}/v1/decisions`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.decisions.length, 1);
  assert.equal(json.decisions[0].id, 'mem_dec_api_1');
});

test('6. Non-GET requests without valid X-DK-Session-Token are rejected with 401', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const unauthRes = await fetch(`${started.url}/v1/memory/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(unauthRes.status, 401);
  const json = await unauthRes.json();
  assert.match(json.message, /Invalid or missing X-DK-Session-Token/);
});

test('7. Non-loopback Origin headers are rejected with 403 Forbidden', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const attackRes = await fetch(`${started.url}/v1/status`, {
    headers: { Origin: 'http://malicious-external-site.com' },
  });

  assert.equal(attackRes.status, 403);
});

test('8. Governed write (POST /v1/memory) with valid token creates record', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  const newRecord = {
    id: 'mem_created_via_api',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.FACT,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Created Fact',
    content: 'Stored via POST /v1/memory',
    authority: MemoryAuthority.REPOSITORY_VERIFIED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'system' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const createRes = await fetch(`${started.url}/v1/memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify(newRecord),
  });

  assert.equal(createRes.status, 201);
  const createdJson = await createRes.json();
  assert.equal(createdJson.record.id, 'mem_created_via_api');
});

test('9. Governed patch (PATCH /v1/memory/:id) respects authority transition guards', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await api.memoryProvider.store({
    id: 'mem_inferred_patch',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Inferred Pattern',
    content: 'Automated extraction pattern',
    authority: MemoryAuthority.INFERRED,
    confidence: 0.9,
    status: MemoryStatus.ACTIVE,
    source: { type: 'workflow' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Attempt unconfirmed promotion to user-approved fails
  const failRes = await fetch(`${started.url}/v1/memory/mem_inferred_patch`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify({
      record: { authority: MemoryAuthority.USER_APPROVED },
      userConfirmed: false,
    }),
  });

  assert.notEqual(failRes.status, 200);

  // Confirmed promotion succeeds
  const successRes = await fetch(`${started.url}/v1/memory/mem_inferred_patch`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify({
      record: { authority: MemoryAuthority.USER_APPROVED },
      userConfirmed: true,
    }),
  });

  assert.equal(successRes.status, 200);
  const successJson = await successRes.json();
  assert.equal(successJson.record.authority, MemoryAuthority.USER_APPROVED);
});

test('10. Archive and Delete endpoints correctly mutate record state', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await api.memoryProvider.store({
    id: 'mem_mutate_target',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.FACT,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Target',
    content: 'To be archived and forgotten',
    authority: MemoryAuthority.REPOSITORY_VERIFIED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'system' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Archive
  const archiveRes = await fetch(`${started.url}/v1/memory/mem_mutate_target/archive`, {
    method: 'POST',
    headers: { 'X-DK-Session-Token': started.sessionToken },
  });
  assert.equal(archiveRes.status, 200);
  const archiveJson = await archiveRes.json();
  assert.equal(archiveJson.record.status, MemoryStatus.ARCHIVED);

  // Delete / Forget
  const deleteRes = await fetch(`${started.url}/v1/memory/mem_mutate_target`, {
    method: 'DELETE',
    headers: { 'X-DK-Session-Token': started.sessionToken },
  });
  assert.equal(deleteRes.status, 200);

  const getRes = await fetch(`${started.url}/v1/memory/mem_mutate_target`);
  assert.equal(getRes.status, 404);
});
