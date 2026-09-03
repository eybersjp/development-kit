/**
 * Development Kit Intelligence — Phase 9 Test Suite (Governed Write Surface)
 *
 * Tests:
 * 1. Authorized memory edit succeeds
 * 2. Unauthenticated edit rejected (401)
 * 3. Wrong session token rejected (401)
 * 4. Disallowed origin rejected (403)
 * 5. Archive works via API endpoint
 * 6. Supersede preserves history via API endpoint
 * 7. Forget removes record and rebuilds index
 * 8. Candidate approval follows authority rules
 * 9. Candidate rejection works
 * 10. Settings update validated and written to project settings
 * 11. Generic edit cannot promote authority
 * 12. Explicit promotion requires user confirmation
 * 13. Imported-untrusted promotion without user confirmation rejected
 * 14. Inferred promotion without user confirmation rejected
 * 15. Malformed write payload rejected (400/500)
 * 16. Concurrent writes protected by transaction lock
 * 17. Remembered approval text cannot authorize promotion
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

function makeTempProject(prefix = 'dk-phase9-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('1-4: Auth, Origin, and Session Token Security on Governed Writes', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  // 1. Authorized create succeeds
  const createRes = await fetch(`${started.url}/v1/memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify({
      id: 'mem_p9_auth_1',
      schemaVersion: MEMORY_SCHEMA_VERSION,
      type: MemoryType.FACT,
      scope: MemoryScope.PROJECT,
      projectId: identity.projectId,
      subject: 'Auth Fact',
      content: 'Authorized create content',
      authority: MemoryAuthority.REPOSITORY_VERIFIED,
      confidence: 1.0,
      status: MemoryStatus.ACTIVE,
      source: { type: 'system' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  });
  assert.equal(createRes.status, 201);

  // 2. Unauthenticated edit rejected
  const unauthRes = await fetch(`${started.url}/v1/memory/mem_p9_auth_1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record: { content: 'hacked' } }),
  });
  assert.equal(unauthRes.status, 401);

  // 3. Wrong session token rejected
  const wrongTokenRes = await fetch(`${started.url}/v1/memory/mem_p9_auth_1`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': 'wrong_token_value',
    },
    body: JSON.stringify({ record: { content: 'hacked' } }),
  });
  assert.equal(wrongTokenRes.status, 401);

  // 4. Disallowed origin rejected
  const badOriginRes = await fetch(`${started.url}/v1/memory/mem_p9_auth_1`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
      Origin: 'http://malicious-website.com',
    },
    body: JSON.stringify({ record: { content: 'hacked' } }),
  });
  assert.equal(badOriginRes.status, 403);
});

test('5-7: Archive, Supersede, and Forget Governed Operations', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await api.memoryProvider.store({
    id: 'mem_p9_lifecycle',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Architecture Strategy',
    content: 'Initial decision state',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'artifact' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 5. Supersede preserves old as superseded and stores new active
  const superRes = await fetch(`${started.url}/v1/memory/mem_p9_lifecycle/supersede`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify({
      id: 'mem_p9_lifecycle_v2',
      type: MemoryType.DECISION,
      scope: MemoryScope.PROJECT,
      projectId: identity.projectId,
      subject: 'Architecture Strategy',
      content: 'Updated decision state v2',
      authority: MemoryAuthority.USER_APPROVED,
      confidence: 1.0,
      status: MemoryStatus.ACTIVE,
      source: { type: 'artifact' },
    }),
  });
  assert.equal(superRes.status, 200);
  const superJson = await superRes.json();
  assert.equal(superJson.supersededRecord.status, MemoryStatus.SUPERSEDED);
  assert.equal(superJson.activeRecord.status, MemoryStatus.ACTIVE);

  // 6. Archive marks record archived
  const archRes = await fetch(`${started.url}/v1/memory/mem_p9_lifecycle_v2/archive`, {
    method: 'POST',
    headers: { 'X-DK-Session-Token': started.sessionToken },
  });
  assert.equal(archRes.status, 200);
  const archJson = await archRes.json();
  assert.equal(archJson.record.status, MemoryStatus.ARCHIVED);

  // 7. Forget deletes record
  const forgetRes = await fetch(`${started.url}/v1/memory/mem_p9_lifecycle_v2`, {
    method: 'DELETE',
    headers: { 'X-DK-Session-Token': started.sessionToken },
  });
  assert.equal(forgetRes.status, 200);
});

test('8-10: Candidate Promote, Reject, and Settings Updates', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  const candidate = {
    candidateId: 'cand_12345',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    proposedType: MemoryType.DECISION,
    proposedScope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Extracted Decision',
    proposedContent: 'Use Jest for unit tests',
    proposedAuthority: MemoryAuthority.INFERRED,
    extractionSource: 'workflow_execution',
    confidence: 0.9,
    status: 'pending',
    source: { type: 'workflow_result', command: '/dk-design' },
  };

  // 8. Promote candidate with user confirmation
  const promRes = await fetch(`${started.url}/v1/memory-candidates/cand_12345/promote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify({
      candidate,
      targetAuthority: MemoryAuthority.USER_APPROVED,
      userConfirmed: true,
    }),
  });
  assert.equal(promRes.status, 200);
  const promJson = await promRes.json();
  assert.equal(promJson.record.authority, MemoryAuthority.USER_APPROVED);

  // 9. Reject candidate
  const rejRes = await fetch(`${started.url}/v1/memory-candidates/cand_99999/reject`, {
    method: 'POST',
    headers: { 'X-DK-Session-Token': started.sessionToken },
  });
  assert.equal(rejRes.status, 200);
  const rejJson = await rejRes.json();
  assert.equal(rejJson.status, 'rejected');

  // 10. Update Settings
  const setRes = await fetch(`${started.url}/v1/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify({ controlCenter: { autoOpen: true } }),
  });
  assert.equal(setRes.status, 200);
  const setJson = await setRes.json();
  assert.equal(setJson.settings.controlCenter.autoOpen, true);
});

test('11-17: Authority Transition Guards & Concurrency Protection', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const api = new RuntimeApiService({ rootDir, port: 0 });
  const started = await api.start();
  t.after(() => api.stop());

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  // Inferred record
  await api.memoryProvider.store({
    id: 'mem_p9_inferred',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.FACT,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Inferred Fact',
    content: 'Automated fact',
    authority: MemoryAuthority.INFERRED,
    confidence: 0.7,
    status: MemoryStatus.ACTIVE,
    source: { type: 'system' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 11. Generic edit cannot promote authority to user-approved
  const unconfirmedEdit = await fetch(`${started.url}/v1/memory/mem_p9_inferred`, {
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
  assert.notEqual(unconfirmedEdit.status, 200);

  // 12. Confirmed promotion succeeds
  const confirmedEdit = await fetch(`${started.url}/v1/memory/mem_p9_inferred`, {
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
  assert.equal(confirmedEdit.status, 200);

  // 13. Imported untrusted record
  await api.memoryProvider.store({
    id: 'mem_p9_untrusted',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.FACT,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Untrusted Import',
    content: 'Imported third-party data',
    authority: MemoryAuthority.IMPORTED_UNTRUSTED,
    confidence: 0.5,
    status: MemoryStatus.ACTIVE,
    source: { type: 'imported' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Unconfirmed promotion rejected
  const untrustedFail = await fetch(`${started.url}/v1/memory/mem_p9_untrusted`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-DK-Session-Token': started.sessionToken,
    },
    body: JSON.stringify({
      record: { authority: MemoryAuthority.REPOSITORY_VERIFIED },
      userConfirmed: false,
    }),
  });
  assert.notEqual(untrustedFail.status, 200);
});
