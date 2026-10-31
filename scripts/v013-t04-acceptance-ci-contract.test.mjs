import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');

test('T04-A13 v0.13 integration has a distinct source-bound risk-3 acceptance job', () => {
  assert.match(workflow, /^  t04_acceptance:\s*$/m,
    'v0.13 T04 must not rely on green platform tests as its acceptance verdict');
  const job = workflow.split(/^  t04_acceptance:\s*$/m)[1]?.split(/^  [a-z][\w-]*:\s*$/m)[0] ?? '';
  assert.match(job, /^    needs:\s*validate\s*$/m,
    'independent acceptance must depend on successful Ubuntu AND Windows matrix validation');
  assert.match(job, /github\.head_ref\s*==\s*'feature\/v0\.13-state-engine-v2'/,
    'historical/diagnostic PRs must never receive production T04 acceptance');
  assert.match(job, /scripts\/v013-t04-acceptance-gate\.mjs/,
    'the acceptance job must run a deterministic risk-3 gate, not a placeholder echo');
  assert.match(job, /GITHUB_TOKEN:/,
    'independent reviews and CI provenance must be checked with authenticated GitHub evidence');
});

test('T04-A14 acceptance gate source exists and requires independent immutable evidence', () => {
  const gatePath = path.join(root, 'scripts/v013-t04-acceptance-gate.mjs');
  assert.ok(fs.existsSync(gatePath), 'missing deterministic v0.13 T04 acceptance gate');
  const source = fs.readFileSync(gatePath, 'utf8');
  for (const required of ['decideAcceptance', 'reviewedCommit', 'architecture-reviewer',
    'code-reviewer', 'security-reviewer', 'GITHUB_RUN_ID', 'GITHUB_TOKEN',
    'CLEANUP_SAFE', 'windows']) {
    assert.ok(source.includes(required), 'acceptance gate lacks required evidence check: ' + required);
  }
});

test('T04-A15 risk-3 gate parses, fails closed outside authenticated CI and never uses historical PR #70', () => {
  const gate = path.join(root, 'scripts/v013-t04-acceptance-gate.mjs');
  const syntax = spawnSync(process.execPath, ['--check', gate], { cwd: root, encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const isolated = spawnSync(process.execPath, [gate], {
    cwd: root, encoding: 'utf8', env: {
      ...process.env, GITHUB_ACTIONS: 'false', GITHUB_TOKEN: '',
      GITHUB_REPOSITORY: 'eybersjp/development-kit',
    },
  });
  assert.notEqual(isolated.status, 0, 'Unauthenticated local invocation must never produce ACCEPTED');
  assert.doesNotMatch(isolated.stdout, /DKF130-T04 ACCEPTED/);
  const code = fs.readFileSync(gate, 'utf8');
  assert.match(code, /decideAcceptance\(\{/);
  assert.match(code, /assert\.equal\(decision\.state, 'ACCEPTED'/);
  assert.match(code, /physical\.artifactUrl/);
  assert.match(code, /validationRunIds/);
  assert.match(code, /review\.commit_id, reviewedCommit/);
  assert.match(code, /review\.state, 'APPROVED'/);
  assert.match(code, /securityControls/);
});

test('T04-A16 acceptance workflow reads exact PR head with least privilege', () => {
  const job = workflow.split(/^  t04_acceptance:\s*$/m)[1]?.split(/^  [a-z][\w-]*:\s*$/m)[0] ?? '';
  assert.match(job, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(job, /persist-credentials: false/);
  assert.match(job, /contents: read/);
  assert.match(job, /pull-requests: read/);
  assert.match(job, /issues: read/);
  assert.match(job, /actions: read/);
  assert.doesNotMatch(job, /contents: write|pull-requests: write|issues: write|actions: write/);
});

test('T04-A17 both platform validations execute the immutable PR head, never a synthetic merge', () => {
  const validate = workflow.split(/^  validate:\s*$/m)[1]?.split(/^  [a-z][\w-]*:\s*$/m)[0] ?? '';
  const checkout = validate.split(/      - name: Check out repository\s*\n/)[1]?.split(/      - name: /)[0] ?? '';
  assert.match(checkout, /uses: actions\/checkout@v7/);
  assert.match(checkout, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/,
    'Both Ubuntu and Windows must validate the exact reviewed head, not refs/pull/N/merge');
  assert.match(checkout, /persist-credentials: false/,
    'Validation must not retain checkout credentials from untrusted PR source');
});

test('T04-A18 acceptance gate binds validation receipts to authentic full CI workflow and mandatory steps', () => {
  const gate = fs.readFileSync(path.join(root, 'scripts/v013-t04-acceptance-gate.mjs'), 'utf8');
  assert.match(gate, /run\.path, '\.github\/workflows\/ci\.yml'/,
    'same-SHA workflow run IDs must identify the authoritative full CI workflow, not a synthetic green workflow');
  assert.match(gate, /run\.repository\?\.full_name, REPO/,
    'cross-repository validation runs must never count toward source acceptance');
  for (const step of [
    'Validate v0.13 State Engine V2 increment',
    'Validate v0.13 full compatibility regression',
    'Verify v0.13 risk-3 acceptance job contract (negative control)',
  ]) {
    assert.ok(gate.includes(step),
      'each OS validation must have a successful mandatory v0.13 step: ' + step);
  }
  assert.match(gate, /step\.conclusion === 'success'/,
    'the existence of a named validation step is insufficient without its successful conclusion');
});

test('T04-A19 later review revocation or stale reapproval cannot be hidden by an earlier receipt', async () => {
  const { assertCurrentRoleApproval } = await import('./v013-t04-review-provenance.mjs');
  const gate = fs.readFileSync(path.join(root, 'scripts/v013-t04-acceptance-gate.mjs'), 'utf8');
  assert.match(gate, /assertCurrentRoleApproval\(review, allSubmittedReviews, reviewedCommit\)/,
    'production acceptance must validate the latest effective GitHub review, not only the receipt ID');

  const sha = 'a'.repeat(40);
  const other = 'b'.repeat(40);
  const approval = { id: 101, state: 'APPROVED', commit_id: sha,
    user: { id: 90322, login: 'independent-code-reviewer' }, submitted_at: '2026-10-30T10:00:00Z' };
  const comment = { ...approval, id: 102, state: 'COMMENTED',
    submitted_at: '2026-10-30T10:30:00Z' };
  const revoked = { ...approval, id: 103, state: 'CHANGES_REQUESTED',
    submitted_at: '2026-10-30T11:00:00Z' };
  const staleReapproval = { ...approval, id: 104, commit_id: other,
    submitted_at: '2026-10-30T12:00:00Z' };
  assert.doesNotThrow(() => assertCurrentRoleApproval(approval, [approval, comment], sha));
  assert.throws(() => assertCurrentRoleApproval(approval, [approval, revoked], sha),
    /superseded|revoked|effective/i);
  assert.throws(() => assertCurrentRoleApproval(approval, [approval, staleReapproval], sha),
    /superseded|stale|effective/i);
  assert.throws(() => assertCurrentRoleApproval(approval,
    [{ ...approval, state: 'DISMISSED' }], sha), /approved|dismissed|effective/i);
  assert.throws(() => assertCurrentRoleApproval(approval, [approval, {
    ...approval, id: 105, state: 'CHANGES_REQUESTED',
    submitted_at: '2026-10-30T13:00:00Z',
  }], sha), /superseded|revoked|effective/i);
});


test('T04-A21 ACCEPTED verdict must be uploaded durably, only after a successful gate', () => {
  const job = workflow.split(/^  t04_acceptance:\s*$/m)[1]?.split(/^  [a-z][\w-]*:\s*$/m)[0] ?? '';
  const upload = job.split(/      - name: Preserve canonical T04 verdict evidence\s*\n/)[1]
    ?.split(/      - name: /)[0] ?? '';
  assert.ok(upload, 'T04 acceptance must persist its verdict outside the ephemeral runner');
  assert.match(upload, /if: \$\{\{ success\(\) \}\}/,
    'A failed acceptance gate must never upload a purported ACCEPTED verdict');
  assert.match(upload, /uses: actions\/upload-artifact@v4/,
    'Canonical ACCEPTED record must be retained as a GitHub Actions artifact');
  assert.match(upload, /name: dkf-v013-t04-acceptance-evidence-\$\{\{ github\.event\.pull_request\.head\.sha \}\}/,
    'Verdict artifact must identify its exact immutable reviewed source');
  assert.match(upload, /path: \.development-kit\/acceptance\/DKF130-T04\.json/,
    'Upload only the canonical deterministic Development Contract verdict');
  assert.match(upload, /if-no-files-found: error/,
    'Missing canonical verdict must fail the acceptance job, never silently pass');
  assert.match(upload, /include-hidden-files: true/,
    'The canonical verdict lives in a hidden .development-kit directory and must be included');
  assert.doesNotMatch(upload, /if-no-files-found: ignore/);
});


test('T04-A22 a security-control witness cannot cite an unrelated green workflow', () => {
  const gate = fs.readFileSync(path.join(root, 'scripts/v013-t04-acceptance-gate.mjs'), 'utf8');
  assert.match(gate, /validationRuns\.has\(witness\.workflowRunId\)/,
    'Each security-control witness must cite one of the authenticated, exact-SHA, full Ubuntu+Windows validation runs, not any unrelated green workflow');
});


test('T04-A23 physical NTFS power-loss approval must remain effective after later reviews', async () => {
  const gate = fs.readFileSync(path.join(root, 'scripts/v013-t04-acceptance-gate.mjs'), 'utf8');
  assert.match(gate, /assertCurrentRoleApproval\(physicalReview, allSubmittedReviews, reviewedCommit\)/,
    'Physical NTFS approval must be checked against the complete authenticated review timeline; an earlier APPROVED receipt can be revoked');

  const { assertCurrentRoleApproval } = await import('./v013-t04-review-provenance.mjs');
  const sha = 'a'.repeat(40);
  const approval = { id: 901, state: 'APPROVED', commit_id: sha,
    user: { id: 90323, login: 'independent-ntfs-reviewer' }, submitted_at: '2026-10-31T08:00:00Z' };
  const revoked = { ...approval, id: 902, state: 'CHANGES_REQUESTED',
    submitted_at: '2026-10-31T08:30:00Z' };
  const staleReapproval = { ...approval, id: 903, commit_id: 'b'.repeat(40),
    submitted_at: '2026-10-31T09:00:00Z' };
  assert.doesNotThrow(() => assertCurrentRoleApproval(approval, [approval], sha));
  assert.throws(() => assertCurrentRoleApproval(approval, [approval, revoked], sha),
    /superseded|revoked|effective/i);
  assert.throws(() => assertCurrentRoleApproval(approval, [approval, staleReapproval], sha),
    /superseded|stale|effective/i);
});

test('T04-A24 immutable reviewer identity prevents account-rename revocation bypass', async () => {
  const { assertCurrentRoleApproval } = await import('./v013-t04-review-provenance.mjs');
  const gate = fs.readFileSync(path.join(root, 'scripts/v013-t04-acceptance-gate.mjs'), 'utf8');
  assert.match(gate, /review\.user\.id/);
  assert.match(gate, /pr\.user\.id/);
  assert.match(gate, /physicalReview\.user\.id/);
  const sha = 'a'.repeat(40);
  const prior = { id: 2401, state: 'APPROVED', commit_id: sha,
    user: { id: 90321, login: 'reviewer-before-rename' },
    submitted_at: '2026-10-31T08:00:00Z' };
  const revoked = { ...prior, id: 2402, state: 'CHANGES_REQUESTED',
    user: { id: 90321, login: 'reviewer-after-rename' },
    submitted_at: '2026-10-31T09:00:00Z' };
  const stale = { ...prior, id: 2403, commit_id: 'b'.repeat(40),
    user: { id: 90321, login: 'reviewer-after-rename' },
    submitted_at: '2026-10-31T10:00:00Z' };
  assert.throws(() => assertCurrentRoleApproval(prior, [prior, revoked], sha),
    /superseded|revoked|effective/i);
  assert.throws(() => assertCurrentRoleApproval(prior, [prior, stale], sha),
    /superseded|stale|effective/i);
});


test('T04-A25 full platform-validation witnesses cannot require the overall run to pass the independent acceptance job', () => {
  // The first full runs on a reviewed source legitimately fail the separate
  // independent-acceptance job while both full OS validation jobs pass.
  // Requiring overall run.conclusion=success here creates an acceptance
  // deadlock: security controls cannot cite those otherwise valid runs.
  const gate = fs.readFileSync(path.join(root, 'scripts/v013-t04-acceptance-gate.mjs'), 'utf8');
  assert.match(gate, /validationRuns\\.has\\(witness\\.workflowRunId\\)/,
    'A control must still cite an authenticated, exact-source full-validation run');
  assert.match(gate, /assert\\.equal\\(witnessRun\\.head_sha, reviewedCommit\\)/,
    'A control cannot cite a different source');
  assert.doesNotMatch(gate, /witnessRun\\.conclusion\\s*,\\s*'success'/,
    'The overall CI run can fail solely because the separate independent acceptance gate correctly fails closed; validate both OS jobs and mandatory steps instead');
});
