import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  estimateTextTokens,
  materializeScopedContent,
} from '../runtime/orchestration/token-efficiency.mjs';
import { buildContextPackage } from '../runtime/orchestration/context-package.mjs';
import { createPolicyBoundDevelopmentContract } from '../runtime/orchestration/contract-policy.mjs';
import { buildTokenAudit } from './token-audit.mjs';

function tempProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dkf-token-efficiency-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  return root;
}

function task() {
  return {
    id: 'TASK-TOK-001',
    projectId: 'token-efficiency',
    status: 'approved',
    objective: 'Reduce context bloat without weakening authority',
    scope: { in: ['runtime/'], out: ['Do not weaken verification'] },
    requirements: ['REQ-TOK-1'],
    acceptanceCriteria: [{
      id: 'AC-TOK-001',
      statement: 'Requested source sections are delivered without unrelated sections',
      source: 'REQ-TOK-1',
      verificationType: ['test'],
      requiredEvidence: true,
    }],
    architectureConstraints: [],
    designConstraints: [],
    securityConstraints: [],
    risk: { level: 1, reasons: ['Context packaging'] },
    requiredVerification: ['tests'],
    requiredReviewers: ['code-reviewer'],
  };
}

test('token estimator is deterministic and provider independent', () => {
  assert.equal(estimateTextTokens(''), 0);
  assert.equal(estimateTextTokens('1234'), 1);
  assert.equal(estimateTextTokens('12345'), 2);
});

test('Markdown heading selectors deliver only the matched section', () => {
  const source = [
    '# Specification',
    '',
    '## REQ-TOK-1',
    'Keep this requirement.',
    'More required detail.',
    '',
    '## REQ-TOK-2',
    'Do not include this unrelated requirement.',
    '',
  ].join('\n');

  const result = materializeScopedContent(source, ['REQ-TOK-1']);
  assert.equal(result.deliveryMode, 'scoped');
  assert.match(result.content, /Keep this requirement/);
  assert.doesNotMatch(result.content, /unrelated requirement/);
  assert.ok(result.deliveredTokens < result.rawTokens);
});

test('stable marker selectors return a bounded excerpt', () => {
  const lines = Array.from({ length: 40 }, (_, index) => `line-${index + 1}`);
  lines[20] = 'REQ-MARKER-7 preserve this behaviour';
  const result = materializeScopedContent(lines.join('\n'), ['REQ-MARKER-7']);
  assert.equal(result.deliveryMode, 'scoped');
  assert.match(result.content, /REQ-MARKER-7/);
  assert.doesNotMatch(result.content, /line-1\n/);
  assert.ok(result.deliveredChars < result.rawChars);
});

test('explicit line ranges are supported', () => {
  const source = ['one', 'two', 'three', 'four', 'five'].join('\n');
  const result = materializeScopedContent(source, ['L2-L4']);
  assert.equal(result.deliveryMode, 'scoped');
  assert.match(result.content, /two\nthree\nfour/);
  assert.doesNotMatch(result.content, /\none\n/);
  assert.doesNotMatch(result.content, /five/);
});

test('unresolved selectors fail safe to full content with an explicit warning', () => {
  const source = '# Spec\nREQ-1 present\n';
  const result = materializeScopedContent(source, ['REQ-DOES-NOT-EXIST']);
  assert.equal(result.deliveryMode, 'full-fallback');
  assert.equal(result.content, source);
  assert.equal(result.warnings[0].code, 'FULL_FALLBACK_UNRESOLVED_SELECTOR');
});

test('role context scopes source content and reports token savings', (t) => {
  const root = tempProject(t);
  const spec = [
    '# Specification',
    '',
    '## REQ-TOK-1',
    'Required line A.',
    'Required line B.',
    '',
    '## REQ-OTHER',
    ...Array.from({ length: 80 }, (_, index) => `Unrelated detail ${index + 1}.`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'docs', 'spec.md'), spec, 'utf8');

  const contract = createPolicyBoundDevelopmentContract({
    rootDir: root,
    task: task(),
    authoritativeSources: [{
      path: 'docs/spec.md',
      kind: 'specification',
      authority: 'required',
      sections: ['REQ-TOK-1'],
    }],
  });

  const context = buildContextPackage({
    contract,
    role: 'implementation-agent',
    rootDir: root,
  });

  const delivered = context.authoritativeSources[0];
  assert.equal(delivered.delivery.mode, 'scoped');
  assert.match(delivered.content, /Required line A/);
  assert.doesNotMatch(delivered.content, /Unrelated detail 80/);
  assert.ok(context.tokenProfile.rawSourceTokens > context.tokenProfile.deliveredSourceTokens);
  assert.ok(context.tokenProfile.estimatedSourceTokensSaved > 0);
  assert.ok(context.tokenProfile.sourceSavingsPercent > 50);
  assert.equal(typeof context.tokenProfile.overBudget, 'boolean');
});

test('whole-file fingerprint staleness still blocks sectioned contexts', (t) => {
  const root = tempProject(t);
  fs.writeFileSync(path.join(root, 'docs', 'spec.md'), '# Spec\nREQ-TOK-1 approved\n', 'utf8');
  const contract = createPolicyBoundDevelopmentContract({
    rootDir: root,
    task: task(),
    authoritativeSources: [{
      path: 'docs/spec.md',
      kind: 'specification',
      authority: 'required',
      sections: ['REQ-TOK-1'],
    }],
  });

  fs.appendFileSync(path.join(root, 'docs', 'spec.md'), '\nREQ-TOK-2 changed later\n');
  assert.throws(
    () => buildContextPackage({ contract, role: 'spec-reviewer', rootDir: root }),
    /stale Development Contract/,
  );
});

test('oversized package is reported, not silently truncated', (t) => {
  const root = tempProject(t);
  fs.writeFileSync(path.join(root, 'docs', 'spec.md'), '# Spec\nREQ-TOK-1 approved\n', 'utf8');
  const contract = createPolicyBoundDevelopmentContract({
    rootDir: root,
    task: task(),
    authoritativeSources: [{
      path: 'docs/spec.md',
      kind: 'specification',
      authority: 'required',
      sections: ['REQ-TOK-1'],
    }],
  });

  const context = buildContextPackage({
    contract,
    role: 'code-reviewer',
    rootDir: root,
    repositoryState: { diff: 'x'.repeat(60000) },
  });

  assert.equal(context.tokenProfile.overBudget, true);
  assert.ok(context.tokenProfile.warnings.some((warning) => warning.code === 'CONTEXT_BUDGET_EXCEEDED'));
  assert.equal(context.repositoryState.diff.length, 60000);
});


test('static DKF instruction hot paths stay inside post-hardening budgets', () => {
  const report = buildTokenAudit();
  assert.equal(report.priorityRuntimeSkills.withinBudget, true, JSON.stringify(report.priorityRuntimeSkills));
  assert.equal(report.implementationHotPath.withinBudget, true, JSON.stringify(report.implementationHotPath));
  assert.ok(report.priorityRuntimeSkills.reductionPercent >= 45);
  assert.ok(report.implementationHotPath.reductionPercent >= 50);
});
