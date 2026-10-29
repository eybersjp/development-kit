import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyT04ValidationRuns, assertT04BlockerIssuesClosed } from './t04-acceptance-ci-evidence.mjs';

const SOURCE = 'a'.repeat(40);
const RECEIPT_EXECUTION = 'd'.repeat(40);
const workflow = 316663377;
const mkRun = (id, changes = {}) => ({
  id,
  name: 'CI',
  event: 'pull_request',
  workflow_id: workflow,
  head_sha: SOURCE,
  head_repository: { full_name: 'eybersjp/development-kit' },
  pull_requests: [{ number: 70, head: { sha: SOURCE } }],
  jobs: [
    { name: 'Ubuntu full release validation', conclusion: 'success', status: 'completed' },
    { name: 'Windows full release validation', conclusion: 'success', status: 'completed' },
  ],
  ...changes,
});
const validate = (runs, executionCommit = SOURCE) => verifyT04ValidationRuns({
  runs, reviewedCommit: SOURCE, executionCommit, currentRunId: 200, expectedWorkflowId: workflow,
});

test('accepts only two distinct complete platform matrices on the same reviewed source', () => {
  const evidence = validate([mkRun(199), mkRun(200)]);
  assert.deepEqual(evidence.runIds, [199, 200]);
  assert.equal(evidence.reviewedCommit, SOURCE);
});

test('refuses to claim repeat validation from a single CI run', () => {
  assert.throws(() => validate([mkRun(200)]), /two distinct/i);
});

test('refuses validation from another immutable PR head', () => {
  assert.throws(() => validate([mkRun(199, { pull_requests: [{ number: 70, head: { sha: 'b'.repeat(40) } }] }), mkRun(200)]), /source|head/i);
});

test('refuses a failed or skipped Windows validation', () => {
  const jobs = mkRun(199).jobs.map(j => j.name.startsWith('Windows') ? { ...j, conclusion: 'skipped' } : j);
  assert.throws(() => validate([mkRun(199, { jobs }), mkRun(200)]), /Windows|success/i);
});

test('refuses duplicate CI run IDs as independent executions', () => {
  assert.throws(() => validate([mkRun(200), mkRun(200)]), /distinct|duplicate/i);
});

test('refuses a run from an untrusted repository or event', () => {
  assert.throws(() => validate([mkRun(199, { event: 'workflow_dispatch' }), mkRun(200)]), /pull_request|event/i);
  assert.throws(() => validate([mkRun(199, { head_repository: { full_name: 'other/repo' } }), mkRun(200)]), /repository/i);
});

test('refuses a run with a different merge/source commit even when PR head matches', () => {
  assert.throws(() => validate([mkRun(199, { head_sha: 'c'.repeat(40) }), mkRun(200)]), /same|commit|source/i);
});

test('refuses evidence if current acceptance run is absent', () => {
  assert.throws(() => validate([mkRun(198), mkRun(199)]), /current/i);
});


test('production acceptance gate consumes verified CI runs instead of asserting synthetic repeats', () => {
  const gate = fs.readFileSync(fileURLToPath(new URL('./t04-hardening-acceptance-gate.mjs', import.meta.url)), 'utf8');
  assert.match(gate, /await collectT04ValidationRuns\(/);
  assert.match(gate, /validatedCiRuns: VALIDATED_CI\.runIds/);
  assert.doesNotMatch(gate, /GITHUB-ACTIONS-37974556018-/);
});

test('acceptance refuses unresolved risk-3 issue #71 and Windows durability P1 #73', () => {
  const gate = fs.readFileSync(fileURLToPath(new URL('./t04-hardening-acceptance-gate.mjs', import.meta.url)), 'utf8');
  assert.match(gate, /await assertT04BlockerIssuesClosed/);
});

test('open or waived Windows durability issue prevents risk-3 acceptance', async () => {
  const githubApi = async endpoint => ({
    state: endpoint === 'issues/73' ? 'open' : 'closed',
    state_reason: 'completed',
  });
  await assert.rejects(() => assertT04BlockerIssuesClosed({ githubApi }), /#73.*open/i);
  const waived = async endpoint => ({
    state: 'closed',
    state_reason: endpoint === 'issues/73' ? 'not_planned' : 'completed',
  });
  await assert.rejects(() => assertT04BlockerIssuesClosed({ githubApi: waived }), /#73.*waived/i);
});

test('completed mandatory issue resolutions are necessary but not independent approval', async () => {
  const seen = [];
  const githubApi = async endpoint => {
    seen.push(endpoint);
    return { state: 'closed', state_reason: 'completed' };
  };
  assert.deepEqual(await assertT04BlockerIssuesClosed({ githubApi }), [71, 73]);
  assert.deepEqual(seen, ['issues/71', 'issues/73']);
});


test('allows receipt-only execution C after independently reviewed source R, without conflating identities', () => {
  const receiptRun = id => mkRun(id, {
    head_sha: 'c'.repeat(40),
    pull_requests: [{ number: 70, head: { sha: RECEIPT_EXECUTION }, base: { sha: 'e'.repeat(40) } }],
  });
  const result = validate([receiptRun(199), receiptRun(200)], RECEIPT_EXECUTION);
  assert.equal(result.reviewedCommit, SOURCE);
  assert.equal(result.executionCommit, RECEIPT_EXECUTION);
});

test('rejects an older CI run on another receipt-bearing execution commit', () => {
  const current = mkRun(200, { pull_requests: [{ number: 70, head: { sha: RECEIPT_EXECUTION } }] });
  assert.throws(() => validate([mkRun(199), current], RECEIPT_EXECUTION), /execution|head|source/i);
});

test('all three CI jobs explicitly check out the immutable PR head, not the moving merge ref', () => {
  const workflowYaml = fs.readFileSync(fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url)), 'utf8');
  const refs = workflowYaml.match(/ref:\\s*\\$\\{\\{\\s*github\\.event\\.pull_request\\.head\\.sha\\s*\\|\\|\\s*github\\.sha\\s*\\}\\}/g) || [];
  assert.equal(refs.length, 3, 'Ubuntu, Windows and acceptance must test the same immutable head');
});

test('acceptance gate binds actual checked-out HEAD to the authenticated PR event head', () => {
  const gate = fs.readFileSync(fileURLToPath(new URL('./t04-hardening-acceptance-gate.mjs', import.meta.url)), 'utf8');
  assert.match(gate, /GITHUB_EVENT_PATH/);
  assert.match(gate, /rev-parse.*HEAD/);
  assert.match(gate, /executionCommit:/);
});
