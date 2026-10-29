import assert from 'node:assert/strict';

const REPO = 'eybersjp/development-kit';
const JOB_NAMES = Object.freeze([
  'Ubuntu full release validation',
  'Windows full release validation',
]);

/**
 * Verify two independently executed, exact-source, dual-platform validation
 * matrices. Overall workflow conclusion is deliberately not used: the T04
 * acceptance job may be failing while the two prerequisite suites pass.
 *
 * A successful hosted matrix is NOT proof of physical Windows power-loss
 * durability, and this verifier never claims otherwise.
 */
export function verifyT04ValidationRuns({
  runs, reviewedCommit, currentRunId, expectedWorkflowId,
}) {
  assert.match(reviewedCommit || '', /^[a-f0-9]{40}$/, 'Reviewed source commit is required');
  assert.ok(Number.isSafeInteger(currentRunId) && currentRunId > 0, 'Current run ID is required');
  assert.ok(Number.isSafeInteger(expectedWorkflowId) && expectedWorkflowId > 0,
    'Trusted workflow identity is required');
  assert.ok(Array.isArray(runs), 'Authenticated GitHub CI run evidence must be an array');
  assert.ok(runs.length >= 2, 'At least two distinct Ubuntu/Windows CI runs are required');

  const ids = new Set();
  let commonHeadSha = null;
  for (const run of runs) {
    assert.ok(Number.isSafeInteger(run?.id) && run.id > 0, 'Invalid GitHub CI run ID');
    assert.ok(!ids.has(run.id), 'Duplicate run ID cannot prove two distinct executions');
    ids.add(run.id);
    assert.equal(run.workflow_id, expectedWorkflowId, 'Unexpected CI workflow identity');
    assert.equal(run.name, 'CI', 'Unexpected workflow name');
    assert.equal(run.event, 'pull_request', 'Only authenticated pull_request CI runs qualify');
    assert.equal(run.head_repository?.full_name, REPO, 'CI run from another repository');
    assert.match(run.head_sha || '', /^[a-f0-9]{40}$/, 'Missing source/merge commit SHA');
    if (commonHeadSha === null) commonHeadSha = run.head_sha;
    assert.equal(run.head_sha, commonHeadSha,
      'The two CI runs did not validate the same immutable source/merge commit');
    assert.ok(run.pull_requests?.some(pr => pr.number === 70 && pr.head?.sha === reviewedCommit),
      'CI run does not bind PR #70 to the exact reviewed source head');
    assert.ok(Array.isArray(run.jobs), 'Authenticated CI jobs are required');
    for (const name of JOB_NAMES) {
      const jobs = run.jobs.filter(job => job.name === name);
      assert.equal(jobs.length, 1, 'Missing or duplicate ' + name);
      assert.equal(jobs[0].status, 'completed', name + ' has not completed');
      assert.equal(jobs[0].conclusion, 'success', name + ' did not succeed');
    }
  }
  assert.ok(ids.has(currentRunId), 'Current acceptance run is absent from validated matrices');
  return Object.freeze({
    reviewedCommit,
    runIds: Object.freeze([...ids].sort((a, b) => a - b)),
    workflowId: expectedWorkflowId,
    commonHeadSha,
  });
}

/** Read GitHub-hosted CI records, never a self-authored PASS assertion. */
export async function collectT04ValidationRuns({ githubApi, reviewedCommit, currentRunId }) {
  const current = await githubApi('actions/runs/' + currentRunId);
  assert.ok(Number.isSafeInteger(current.workflow_id), 'Current workflow ID is unavailable');
  const response = await githubApi('actions/workflows/' + current.workflow_id +
    '/runs?event=pull_request&per_page=100');
  assert.ok(Array.isArray(response.workflow_runs), 'Authenticated workflow runs unavailable');
  const prior = response.workflow_runs.find(run =>
    run.id !== currentRunId &&
    run.workflow_id === current.workflow_id &&
    run.head_sha === current.head_sha &&
    run.pull_requests?.some(pr => pr.number === 70 && pr.head?.sha === reviewedCommit));
  assert.ok(prior, 'A second exact-source CI run is missing; repeat the full matrix');
  const runs = [prior, current];
  for (const run of runs) {
    const data = await githubApi('actions/runs/' + run.id + '/jobs?per_page=100');
    assert.ok(Array.isArray(data.jobs) && data.total_count <= data.jobs.length,
      'Complete authenticated GitHub job evidence is required');
    run.jobs = data.jobs;
  }
  return verifyT04ValidationRuns({
    runs, reviewedCommit, currentRunId, expectedWorkflowId: current.workflow_id,
  });
}
