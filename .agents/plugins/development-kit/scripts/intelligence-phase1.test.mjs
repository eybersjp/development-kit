/**
 * Development Kit Intelligence — Phase 1 Test Suite
 *
 * Covers:
 * 1. valid memory record accepted
 * 2. malformed memory record rejected
 * 3. invalid memory type rejected
 * 4. invalid authority rejected
 * 5. invalid status rejected
 * 6. invalid scope rejected
 * 7. invalid lifecycle stage rejected
 * 8. inferred memory cannot promote itself to user-approved
 * 9. imported-untrusted cannot become authoritative through generic update
 * 10. project partition keys are deterministic
 * 11. project identity separates unrelated projects
 * 12. project/workspace/user scopes resolve correctly
 * 13. supersession links preserve history
 * 14. invalid supersession rejected
 * 15. provenance requires appropriate source identity
 * 16. settings default autoOpen = false
 * 17. global autoOpen setting works
 * 18. project override beats global
 * 19. project false override beats global true
 * 20. missing project override falls back correctly
 * 21. malformed setting fails safely
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  MEMORY_SCHEMA_VERSION,
  MemoryType,
  MemoryScope,
  MemoryAuthority,
  MemoryStatus,
  CandidateStatus,
  LifecycleStage,
} from '../runtime/intelligence/memory-enums.mjs';

import {
  validateMemoryRecord,
  validateMemoryCandidate,
  validateAuthorityTransition,
  linkSupersession,
  MemoryValidationError,
} from '../runtime/intelligence/memory-schema.mjs';

import {
  getPartitionKey,
  resolveMemoryIdentity,
  isRecordAccessible,
} from '../runtime/intelligence/memory-identity.mjs';

import {
  resolveEffectiveSettings,
  validateSettings,
  DEFAULT_SETTINGS,
} from '../runtime/intelligence/settings.mjs';

function makeTempDir(prefix = 'dk-phase1-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

function createSampleRecord(overrides = {}) {
  return {
    id: 'mem_12345',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: 'proj_sample_123',
    subject: 'database',
    content: 'Use PostgreSQL as the primary database.',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    lifecycleStages: [LifecycleStage.DESIGN, LifecycleStage.IMPLEMENT],
    source: {
      type: 'artifact',
      ref: 'docs/architecture.md',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: null,
    supersedes: null,
    supersededBy: null,
    tags: ['architecture', 'database'],
    ...overrides,
  };
}

test('1. valid memory record accepted', () => {
  const record = createSampleRecord();
  assert.equal(validateMemoryRecord(record), true);
});

test('2. malformed memory record rejected', () => {
  assert.throws(() => validateMemoryRecord(null), MemoryValidationError);
  assert.throws(() => validateMemoryRecord({}), MemoryValidationError);
  assert.throws(() => validateMemoryRecord(createSampleRecord({ id: '' })), MemoryValidationError);
  assert.throws(() => validateMemoryRecord(createSampleRecord({ schemaVersion: 99 })), MemoryValidationError);
});

test('3. invalid memory type rejected', () => {
  assert.throws(
    () => validateMemoryRecord(createSampleRecord({ type: 'not-a-real-type' })),
    /Invalid or unknown memory type/,
  );
});

test('4. invalid authority rejected', () => {
  assert.throws(
    () => validateMemoryRecord(createSampleRecord({ authority: 'super-admin' })),
    /Invalid memory authority/,
  );
});

test('5. invalid status rejected', () => {
  assert.throws(
    () => validateMemoryRecord(createSampleRecord({ status: 'in-progress' })),
    /Invalid memory status/,
  );
});

test('6. invalid scope rejected', () => {
  assert.throws(
    () => validateMemoryRecord(createSampleRecord({ scope: 'cluster' })),
    /Invalid or unknown memory scope/,
  );
});

test('7. invalid lifecycle stage rejected', () => {
  assert.throws(
    () => validateMemoryRecord(createSampleRecord({ lifecycleStages: ['INVALID_STAGE'] })),
    /Invalid lifecycleStage/,
  );
});

test('8. inferred memory cannot promote itself to user-approved without confirmation', () => {
  const candidate = {
    candidateId: 'cand_123',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    proposedType: MemoryType.DECISION,
    proposedScope: MemoryScope.PROJECT,
    projectId: 'proj_123',
    subject: 'architecture',
    proposedContent: 'Inferred architecture pattern',
    proposedAuthority: MemoryAuthority.USER_APPROVED,
    extractionSource: 'agent_inference',
    confidence: 0.95,
    status: CandidateStatus.PENDING,
    source: { type: 'agent_run' },
  };

  assert.throws(
    () => validateMemoryCandidate(candidate),
    /Inferred candidate cannot claim user-approved authority directly/,
  );
});

test('9. imported-untrusted cannot become authoritative through generic update', () => {
  const untrustedRecord = createSampleRecord({
    authority: MemoryAuthority.IMPORTED_UNTRUSTED,
  });
  const promotedRecord = {
    ...untrustedRecord,
    authority: MemoryAuthority.SYSTEM_VERIFIED,
  };

  assert.throws(
    () => validateAuthorityTransition(untrustedRecord, promotedRecord, false),
    /Cannot promote imported-untrusted record/,
  );

  // Succeeds with explicit user confirmation
  assert.equal(validateAuthorityTransition(untrustedRecord, promotedRecord, true), true);
});

test('10. project partition keys are deterministic', () => {
  const id1 = { projectId: 'proj_abc', workspaceId: 'ws_123', userId: 'user_x' };
  const key1 = getPartitionKey(MemoryScope.PROJECT, id1);
  const key2 = getPartitionKey(MemoryScope.PROJECT, id1);
  assert.equal(key1, 'project:proj_abc');
  assert.equal(key1, key2);

  const wsKey = getPartitionKey(MemoryScope.WORKSPACE, id1);
  assert.equal(wsKey, 'workspace:ws_123');

  const userKey = getPartitionKey(MemoryScope.USER, id1);
  assert.equal(userKey, 'user:user_x');
});

test('11. project identity separates unrelated projects', () => {
  const projectA = { projectId: 'proj_A', workspaceId: 'ws_common', userId: 'user_1' };
  const projectB = { projectId: 'proj_B', workspaceId: 'ws_common', userId: 'user_1' };

  const recordA = createSampleRecord({ projectId: 'proj_A', scope: MemoryScope.PROJECT });

  assert.equal(isRecordAccessible(recordA, projectA), true);
  assert.equal(isRecordAccessible(recordA, projectB), false);
});

test('12. project/workspace/user scopes resolve correctly', () => {
  const identity = { projectId: 'proj_1', workspaceId: 'ws_1', userId: 'user_1' };

  const projRecord = createSampleRecord({ scope: MemoryScope.PROJECT, projectId: 'proj_1' });
  const wsRecord = createSampleRecord({ scope: MemoryScope.WORKSPACE, workspaceId: 'ws_1' });
  const userRecord = createSampleRecord({ scope: MemoryScope.USER, userId: 'user_1' });

  assert.equal(isRecordAccessible(projRecord, identity), true);
  assert.equal(isRecordAccessible(wsRecord, identity), true);
  assert.equal(isRecordAccessible(userRecord, identity), true);
});

test('13. supersession links preserve history', () => {
  const oldDecision = createSampleRecord({
    id: 'mem_decision_v1',
    content: 'Use SQLite',
    status: MemoryStatus.ACTIVE,
  });

  const newDecision = createSampleRecord({
    id: 'mem_decision_v2',
    content: 'Use PostgreSQL',
    status: MemoryStatus.ACTIVE,
  });

  const { supersededRecord, activeRecord } = linkSupersession(oldDecision, newDecision);

  assert.equal(supersededRecord.status, MemoryStatus.SUPERSEDED);
  assert.equal(supersededRecord.supersededBy, 'mem_decision_v2');
  assert.equal(activeRecord.status, MemoryStatus.ACTIVE);
  assert.equal(activeRecord.supersedes, 'mem_decision_v1');
});

test('14. invalid supersession rejected', () => {
  const record = createSampleRecord({ id: 'mem_self' });
  assert.throws(
    () => linkSupersession(record, record),
    /Cannot supersede record with itself/,
  );
});

test('15. provenance requires appropriate source identity', () => {
  assert.throws(
    () => validateMemoryRecord(createSampleRecord({ source: null })),
    /Memory record must include a source object/,
  );
  assert.throws(
    () => validateMemoryRecord(createSampleRecord({ source: { type: '' } })),
    /Memory source must specify a non-empty string type/,
  );
});

test('16. settings default autoOpen = false', () => {
  assert.equal(DEFAULT_SETTINGS.controlCenter.autoOpen, false);
});

test('17. global autoOpen setting works', (t) => {
  const tempProject = makeTempDir('dk-settings-proj-');
  const tempGlobal = join(makeTempDir('dk-settings-glob-'), 'global-settings.json');

  t.after(() => {
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(join(tempGlobal, '..'), { recursive: true, force: true });
  });

  writeFileSync(tempGlobal, JSON.stringify({ controlCenter: { autoOpen: true } }));

  const effective = resolveEffectiveSettings(tempProject, tempGlobal);
  assert.equal(effective.controlCenter.autoOpen, true);
});

test('18. project override beats global', (t) => {
  const tempProject = makeTempDir('dk-settings-proj-');
  const tempGlobal = join(makeTempDir('dk-settings-glob-'), 'global-settings.json');

  t.after(() => {
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(join(tempGlobal, '..'), { recursive: true, force: true });
  });

  mkdirSync(join(tempProject, '.development-kit'), { recursive: true });
  writeFileSync(tempGlobal, JSON.stringify({ controlCenter: { autoOpen: false } }));
  writeFileSync(
    join(tempProject, '.development-kit', 'settings.json'),
    JSON.stringify({ controlCenter: { autoOpen: true } }),
  );

  const effective = resolveEffectiveSettings(tempProject, tempGlobal);
  assert.equal(effective.controlCenter.autoOpen, true);
});

test('19. project false override beats global true', (t) => {
  const tempProject = makeTempDir('dk-settings-proj-');
  const tempGlobal = join(makeTempDir('dk-settings-glob-'), 'global-settings.json');

  t.after(() => {
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(join(tempGlobal, '..'), { recursive: true, force: true });
  });

  mkdirSync(join(tempProject, '.development-kit'), { recursive: true });
  writeFileSync(tempGlobal, JSON.stringify({ controlCenter: { autoOpen: true } }));
  writeFileSync(
    join(tempProject, '.development-kit', 'settings.json'),
    JSON.stringify({ controlCenter: { autoOpen: false } }),
  );

  const effective = resolveEffectiveSettings(tempProject, tempGlobal);
  assert.equal(effective.controlCenter.autoOpen, false);
});

test('20. missing project override falls back correctly', (t) => {
  const tempProject = makeTempDir('dk-settings-proj-');
  const tempGlobal = join(makeTempDir('dk-settings-glob-'), 'global-settings.json');

  t.after(() => {
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(join(tempGlobal, '..'), { recursive: true, force: true });
  });

  const effective = resolveEffectiveSettings(tempProject, tempGlobal);
  assert.equal(effective.controlCenter.autoOpen, false);
});

test('21. malformed setting fails safely', (t) => {
  const tempProject = makeTempDir('dk-settings-proj-');
  const tempGlobal = join(makeTempDir('dk-settings-glob-'), 'global-settings.json');

  t.after(() => {
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(join(tempGlobal, '..'), { recursive: true, force: true });
  });

  writeFileSync(tempGlobal, 'NOT_VALID_JSON{{{');

  const effective = resolveEffectiveSettings(tempProject, tempGlobal);
  assert.equal(effective.controlCenter.autoOpen, false);
});
