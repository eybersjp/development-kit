/**
 * Development Kit Intelligence — Phase 5 Test Suite (Candidate Extraction)
 *
 * Tests:
 * 1. Extraction from /dk-design generates decision candidates with inferred authority
 * 2. Extraction from /dk-debug with verified root cause assigns repository-verified authority
 * 3. Secrets / API tokens / passwords are filtered out and produce zero candidates
 * 4. Promoting a candidate produces a valid MemoryRecord ready for storage
 * 5. Extraction with explicit user confirmation allows user-approved candidate
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  extractMemoryCandidates,
  promoteCandidateToRecord,
  containsSensitiveData,
} from '../runtime/intelligence/candidate-extraction.mjs';
import { validateMemoryRecord } from '../runtime/intelligence/memory-schema.mjs';
import {
  MemoryType,
  MemoryAuthority,
  CandidateStatus,
} from '../runtime/intelligence/memory-enums.mjs';

function makeTempProject(prefix = 'dk-phase5-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('1. Extraction from /dk-design generates decision candidates with inferred authority', (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const workflowResult = {
    command: '/dk-design',
    items: [
      {
        subject: 'Architecture Strategy',
        content: 'Adopt event-driven messaging using Redis PubSub',
        isArchitectureDecision: true,
        userConfirmed: false,
      },
    ],
  };

  const candidates = extractMemoryCandidates(workflowResult, { rootDir });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].proposedType, MemoryType.DECISION);
  assert.equal(candidates[0].proposedAuthority, MemoryAuthority.INFERRED);
  assert.equal(candidates[0].status, CandidateStatus.PENDING);
});

test('2. Extraction from /dk-debug with verified root cause assigns repository-verified authority', (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const workflowResult = {
    command: '/dk-debug',
    items: [
      {
        subject: 'Memory Leak Bug',
        content: 'Unclosed file streams in log aggregator caused process crash',
        isVerifiedRootCause: true,
      },
    ],
  };

  const candidates = extractMemoryCandidates(workflowResult, { rootDir });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].proposedType, MemoryType.LESSON);
  assert.equal(candidates[0].proposedAuthority, MemoryAuthority.REPOSITORY_VERIFIED);
});

test('3. Secrets / API tokens / passwords are filtered out and produce zero candidates', (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const secretResult = {
    command: '/dk-review',
    items: [
      {
        subject: 'Secret in Code',
        content: 'Found token: api_key="sk_live_1234567890abcdef"',
      },
      {
        subject: 'GitHub Secret',
        content: 'ghp_123456789012345678901234567890123456',
      },
    ],
  };

  assert.equal(containsSensitiveData('api_key="sk_live_1234567890abcdef"'), true);
  const candidates = extractMemoryCandidates(secretResult, { rootDir });
  assert.equal(candidates.length, 0, 'Secrets must never be generated into memory candidates');
});

test('4. Promoting a candidate produces a valid MemoryRecord ready for storage', (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const workflowResult = {
    command: '/dk-design',
    items: [
      {
        subject: 'Database',
        content: 'Use PostgreSQL',
        isArchitectureDecision: true,
      },
    ],
  };

  const [candidate] = extractMemoryCandidates(workflowResult, { rootDir });
  assert.ok(candidate);

  // User promotes candidate to USER_APPROVED
  const record = promoteCandidateToRecord(candidate, {
    authority: MemoryAuthority.USER_APPROVED,
  });

  assert.equal(record.authority, MemoryAuthority.USER_APPROVED);
  assert.equal(record.subject, 'Database');
  assert.equal(validateMemoryRecord(record), true);
});

test('5. Extraction with explicit user confirmation allows user-approved candidate', (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const workflowResult = {
    command: '/dk-design',
    items: [
      {
        subject: 'Architecture Strategy',
        content: 'Confirmed architecture choice',
        isArchitectureDecision: true,
        userConfirmed: true,
      },
    ],
  };

  const [candidate] = extractMemoryCandidates(workflowResult, { rootDir });
  assert.equal(candidate.proposedAuthority, MemoryAuthority.USER_APPROVED);
});
