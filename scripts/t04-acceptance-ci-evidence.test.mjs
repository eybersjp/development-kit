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
  path: '.github/workflows/ci.yml',
  head_sha: SOURCE,
  head_repository: { full_name: 'eybersjp/development-kit' },
  pull_requests: [{ number: 70, head: { sha: SOURCE }, base: { sha: 'b'.repeat(40) } }],
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
  const refs = workflowYaml.split("ref: ${{ github.head_ref == 'fix/v0.12-t04-state-engine-hardening' && github.event.pull_request.head.sha || github.sha }}").length - 1;
  assert.equal(refs, 3, 'Ubuntu, Windows and acceptance must test the same immutable head');
});

test('acceptance gate binds actual checked-out HEAD to the authenticated PR event head', () => {
  const gate = fs.readFileSync(fileURLToPath(new URL('./t04-hardening-acceptance-gate.mjs', import.meta.url)), 'utf8');
  assert.match(gate, /GITHUB_EVENT_PATH/);
  assert.match(gate, /rev-parse/);
  assert.match(gate, /HEAD/);
  assert.match(gate, /executionCommit:/);
});


test('refuses a previous PR merge-base revision even when head and run head_sha match', () => {
  const changedBase = mkRun(199, { pull_requests: [{
    number: 70, head: { sha: SOURCE }, base: { sha: 'e'.repeat(40) },
  }] });
  assert.throws(() => validate([changedBase, mkRun(200)]), /base|source|merge/i);
});


test('collector skips a cancelled matching run and finds an earlier successful full matrix', async () => {
  const cancelled = mkRun(199, { jobs: mkRun(199).jobs.map(j => ({
    ...j, conclusion: 'cancelled',
  })) });
  const current = mkRun(200);
  const prior = mkRun(198);
  const githubApi = async endpoint => {
    if (endpoint === 'actions/runs/200') return { ...current };
    if (endpoint === 'actions/workflows/' + workflow) return {
      id: workflow, path: '.github/workflows/ci.yml', name: 'CI',
    };
    if (endpoint.startsWith('actions/workflows/')) return {
      workflow_runs: [{ ...cancelled }, { ...prior }, { ...current }],
    };
    const isJobs = endpoint.startsWith('actions/runs/') && endpoint.endsWith('/jobs?per_page=100');
    if (isJobs) {
      const runId = Number(endpoint.slice('actions/runs/'.length).split('/')[0]);
      const run = [cancelled, prior, current].find(x => x.id === runId);
      return { total_count: run.jobs.length, jobs: run.jobs };
    }
    throw Error('Unexpected GitHub endpoint: ' + endpoint);
  };
  const { collectT04ValidationRuns } = await import('./t04-acceptance-ci-evidence.mjs');
  const result = await collectT04ValidationRuns({
    githubApi, reviewedCommit: SOURCE, executionCommit: SOURCE, currentRunId: 200,
  });
  assert.deepEqual(result.runIds, [198, 200]);
});

test('rejects an executed PR merge workflow blob that differs from reviewed source', async () => {
  const module = await import('./t04-acceptance-ci-evidence.mjs');
  assert.equal(typeof module.assertT04ExecutedWorkflowMatchesReviewed, 'function',
    'An authenticated merge-workflow source check is mandatory');
  const merge = 'e'.repeat(40);
  const base = 'b'.repeat(40);
  const tree = '1'.repeat(40);
  const reviewedWorkflowBlob = 'f'.repeat(40);
  const githubApi = async endpoint => {
    if (endpoint === 'git/ref/pull/70/merge') return {
      ref: 'refs/pull/70/merge', object: { sha: merge },
    };
    if (endpoint === 'git/commits/' + merge) return {
      parents: [{ sha: base }, { sha: SOURCE }], tree: { sha: tree },
    };
    if (endpoint === 'git/trees/' + tree + '?recursive=1') return {
      truncated: false, tree: [{
        path: '.github/workflows/ci.yml', type: 'blob', sha: 'c'.repeat(40),
      }],
    };
    throw Error('Unexpected endpoint: ' + endpoint);
  };
  await assert.rejects(() => module.assertT04ExecutedWorkflowMatchesReviewed({
    githubApi, executionCommit: SOURCE, baseCommit: base,
    runHeadSha: SOURCE, reviewedWorkflowBlob,
  }), /workflow|reviewed|source/i);
});

test('acceptance gate authenticates merge-ref workflow blob before producing a verdict', () => {
  const gate = fs.readFileSync(fileURLToPath(new URL('./t04-hardening-acceptance-gate.mjs', import.meta.url)), 'utf8');
  assert.match(gate, /await assertT04ExecutedWorkflowMatchesReviewed/);
});


test('accepts only the exact reviewed workflow blob on the authenticated merge commit', async () => {
  const { assertT04ExecutedWorkflowMatchesReviewed } = await import('./t04-acceptance-ci-evidence.mjs');
  const merge = 'e'.repeat(40), base = 'b'.repeat(40), treeSha = '1'.repeat(40);
  const workflowBlob = 'f'.repeat(40);
  const githubApi = async endpoint => {
    if (endpoint === 'git/ref/pull/70/merge') return {
      ref: 'refs/pull/70/merge', object: { sha: merge },
    };
    if (endpoint === 'git/commits/' + merge) return {
      parents: [{ sha: base }, { sha: SOURCE }], tree: { sha: treeSha },
    };
    if (endpoint === 'git/trees/' + treeSha + '?recursive=1') return {
      truncated: false, tree: [{
        path: '.github/workflows/ci.yml', type: 'blob', sha: workflowBlob,
      }],
    };
    throw Error('Unexpected endpoint: ' + endpoint);
  };
  const valid = await assertT04ExecutedWorkflowMatchesReviewed({
    githubApi, executionCommit: SOURCE, baseCommit: base,
    runHeadSha: merge, reviewedWorkflowBlob: workflowBlob,
  });
  assert.equal(valid.workflowBlob, workflowBlob);
  assert.equal(valid.mergeCommit, merge);
  await assert.rejects(() => assertT04ExecutedWorkflowMatchesReviewed({
    githubApi, executionCommit: SOURCE, baseCommit: 'c'.repeat(40),
    runHeadSha: merge, reviewedWorkflowBlob: workflowBlob,
  }), /parent|base|source/i);
});


test('rejects CI evidence from a different workflow file even if job names and ID look valid', () => {
  assert.throws(() => validate([
    mkRun(199, { path: '.github/workflows/other.yml' }), mkRun(200),
  ]), /workflow|path/i);
});

test('collector searches a second authenticated page for an older qualifying matrix', async () => {
  const current = mkRun(200), prior = mkRun(198);
  const unrelated = Array.from({ length: 100 }, (_, i) => mkRun(300 + i, {
    head_sha: 'c'.repeat(40),
  }));
  const githubApi = async endpoint => {
    if (endpoint === 'actions/runs/200') return { ...current };
    if (endpoint === 'actions/workflows/' + workflow) return {
      id: workflow, path: '.github/workflows/ci.yml', name: 'CI',
    };
    if (endpoint.startsWith('actions/workflows/') && endpoint.includes('/runs?')) {
      return { workflow_runs: endpoint.includes('page=2') ? [prior] : unrelated };
    }
    if (endpoint === 'actions/runs/200/jobs?per_page=100' ||
        endpoint === 'actions/runs/198/jobs?per_page=100') return {
      total_count: 2, jobs: current.jobs,
    };
    throw Error('Unexpected GitHub endpoint: ' + endpoint);
  };
  const { collectT04ValidationRuns } = await import('./t04-acceptance-ci-evidence.mjs');
  const result = await collectT04ValidationRuns({
    githubApi, reviewedCommit: SOURCE, executionCommit: SOURCE, currentRunId: 200,
  });
  assert.deepEqual(result.runIds, [198, 200]);
});


test('collector refuses an authenticated workflow ID pointing to a different YAML file', async () => {
  const { collectT04ValidationRuns } = await import('./t04-acceptance-ci-evidence.mjs');
  const githubApi = async endpoint => {
    if (endpoint === 'actions/runs/200') return mkRun(200);
    if (endpoint === 'actions/workflows/' + workflow) return {
      id: workflow, name: 'CI', path: '.github/workflows/other.yml',
    };
    throw Error('Unexpected endpoint: ' + endpoint);
  };
  await assert.rejects(() => collectT04ValidationRuns({
    githubApi, reviewedCommit: SOURCE, executionCommit: SOURCE, currentRunId: 200,
  }), /workflow|reviewed|path/i);
});


test('acceptance resolves the reviewed commit object to its immutable Git tree SHA', () => {
  const gate = fs.readFileSync(fileURLToPath(new URL('./t04-hardening-acceptance-gate.mjs', import.meta.url)), 'utf8');
  assert.match(gate, /githubApi\('git\/commits\/' \+ REVIEWED_SOURCE\)/,
    'Git Trees REST endpoint must receive a tree SHA resolved from reviewed commit');
  assert.match(gate, /githubApi\('git\/trees\/' \+ reviewedCommitObject\.tree\.sha \+ '\\?recursive=1'\)/,
    'Do not use a commit SHA as a Git Trees API tree identifier');
  assert.doesNotMatch(gate, /githubApi\('git\/trees\/' \+ REVIEWED_SOURCE/,
    'Undocumented commit-SHA-as-tree coercion must not authorize reviewed source');
});
