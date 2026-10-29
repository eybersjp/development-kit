import assert from 'node:assert/strict';

const REPO = 'eybersjp/development-kit';
const CI_WORKFLOW_PATH = '.github/workflows/ci.yml';
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
  runs, reviewedCommit, executionCommit, currentRunId, expectedWorkflowId,
}) {
  assert.match(reviewedCommit || '', /^[a-f0-9]{40}$/, 'Reviewed source commit is required');
  assert.match(executionCommit || '', /^[a-f0-9]{40}$/, 'Exact PR execution commit is required');
  assert.ok(Number.isSafeInteger(currentRunId) && currentRunId > 0, 'Current run ID is required');
  assert.ok(Number.isSafeInteger(expectedWorkflowId) && expectedWorkflowId > 0,
    'Trusted workflow identity is required');
  assert.ok(Array.isArray(runs), 'Authenticated GitHub CI run evidence must be an array');
  assert.ok(runs.length >= 2, 'At least two distinct Ubuntu/Windows CI runs are required');

  const ids = new Set();
  let commonHeadSha = null;
  let commonBaseSha = null;
  for (const run of runs) {
    assert.ok(Number.isSafeInteger(run?.id) && run.id > 0, 'Invalid GitHub CI run ID');
    assert.ok(!ids.has(run.id), 'Duplicate run ID cannot prove two distinct executions');
    ids.add(run.id);
    assert.equal(run.workflow_id, expectedWorkflowId, 'Unexpected CI workflow identity');
    assert.equal(run.name, 'CI', 'Unexpected workflow name');
    assert.equal(run.path, CI_WORKFLOW_PATH,
      'Authenticated CI run came from a different workflow path');
    assert.equal(run.event, 'pull_request', 'Only authenticated pull_request CI runs qualify');
    assert.equal(run.head_repository?.full_name, REPO, 'CI run from another repository');
    assert.match(run.head_sha || '', /^[a-f0-9]{40}$/, 'Missing source/merge commit SHA');
    if (commonHeadSha === null) commonHeadSha = run.head_sha;
    assert.equal(run.head_sha, commonHeadSha,
      'The two CI runs did not validate the same immutable source/merge commit');
    // PR #70 runs deliberately check out the immutable head, not the moving
    // pull/70/merge ref. Bind BOTH executions to the receipt-bearing checkout
    // commit C. The gate separately proves that C differs from reviewed R only
    // by the authenticated receipts file. Do not require C === R here.
    const matching = run.pull_requests?.filter(pr => pr.number === 70 &&
      pr.head?.sha === executionCommit) || [];
    assert.equal(matching.length, 1,
      'CI run does not bind PR #70 to the exact execution source head');
    const baseSha = matching[0].base?.sha;
    assert.match(baseSha || '', /^[a-f0-9]{40}$/,
      'Authenticated PR merge base SHA is required');
    if (commonBaseSha === null) commonBaseSha = baseSha;
    assert.equal(baseSha, commonBaseSha,
      'PR base changed between validations; repeat both full matrices');
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
    executionCommit,
    commonBaseSha,
    runIds: Object.freeze([...ids].sort((a, b) => a - b)),
    workflowId: expectedWorkflowId,
    commonHeadSha,
  });
}

/** Read GitHub-hosted CI records, never a self-authored PASS assertion. */
export async function collectT04ValidationRuns({ githubApi, reviewedCommit, executionCommit, currentRunId }) {
  const current = await githubApi('actions/runs/' + currentRunId);
  assert.ok(Number.isSafeInteger(current.workflow_id), 'Current workflow ID is unavailable');
  assert.equal(current.path, CI_WORKFLOW_PATH,
    'Current acceptance run used an unreviewed workflow path');
  const workflow = await githubApi('actions/workflows/' + current.workflow_id);
  assert.equal(workflow?.id, current.workflow_id,
    'GitHub workflow ID does not match authenticated workflow metadata');
  assert.equal(workflow?.path, CI_WORKFLOW_PATH,
    'GitHub workflow ID does not resolve to the reviewed CI workflow file');
  assert.equal(workflow?.name, 'CI', 'Unexpected authenticated workflow name');

  const readJobs = async run => {
    const data = await githubApi('actions/runs/' + run.id + '/jobs?per_page=100');
    assert.ok(Array.isArray(data.jobs) && Number.isSafeInteger(data.total_count) &&
      data.total_count <= data.jobs.length,
      'Complete authenticated GitHub job evidence is required');
    return { ...run, jobs: data.jobs };
  };
  const currentWithJobs = await readJobs(current);
  const hasFullMatrix = run => JOB_NAMES.every(name => {
    const jobs = run.jobs.filter(job => job.name === name);
    return jobs.length === 1 && jobs[0].status === 'completed' &&
      jobs[0].conclusion === 'success';
  });
  assert.ok(hasFullMatrix(currentWithJobs),
    'Current acceptance execution has no successful complete Ubuntu/Windows matrix');
  const baseSha = current.pull_requests?.find(pr => pr.number === 70 &&
    pr.head?.sha === executionCommit)?.base?.sha;
  assert.match(baseSha || '', /^[a-f0-9]{40}$/,
    'Authenticated current PR base SHA is required');

  // Search all authenticated pages for the same immutable source. A cancelled
  // prior run does not qualify, but cannot hide an older successful run.
  // Fail closed on malformed pages, incomplete job lists, duplicate run IDs,
  // or excessive pagination; do not invent a repeat from the current run.
  const seenIds = new Set();
  for (let page = 1; page <= 20; page++) {
    const response = await githubApi('actions/workflows/' + current.workflow_id +
      '/runs?event=pull_request&head_sha=' + encodeURIComponent(current.head_sha) +
      '&per_page=100&page=' + page);
    assert.ok(Array.isArray(response?.workflow_runs) && response.workflow_runs.length <= 100,
      'Authenticated workflow-run page is malformed');
    for (const run of response.workflow_runs) {
      assert.ok(Number.isSafeInteger(run?.id) && run.id > 0 && !seenIds.has(run.id),
        'Invalid or duplicate paginated workflow run ID');
      seenIds.add(run.id);
      if (run.id === currentRunId ||
          run.workflow_id !== current.workflow_id ||
          run.head_sha !== current.head_sha ||
          run.event !== 'pull_request' ||
          run.name !== 'CI' ||
          run.path !== CI_WORKFLOW_PATH ||
          run.head_repository?.full_name !== REPO ||
          !run.pull_requests?.some(pr => pr.number === 70 &&
            pr.head?.sha === executionCommit && pr.base?.sha === baseSha)) continue;
      const prior = await readJobs(run);
      if (!hasFullMatrix(prior)) continue;
      return verifyT04ValidationRuns({
        runs: [prior, currentWithJobs], reviewedCommit, executionCommit,
        currentRunId, expectedWorkflowId: current.workflow_id,
      });
    }
    if (response.workflow_runs.length < 100) break;
    assert.ok(page < 20, 'Authenticated workflow-run pagination exceeded safe bound');
  }
  assert.fail('No second successful complete Ubuntu/Windows CI matrix exists');
}

/**
 * Authenticate the workflow GitHub executed for PR #70, not merely the YAML
 * in the explicitly checked-out head. pull_request workflows are selected
 * from the merge ref; the merge commit must have the same exact parents as
 * both validated executions, and its CI workflow blob must match reviewed R.
 * A changed merge-ref or missing tree is a fail-closed source mismatch.
 */
export async function assertT04ExecutedWorkflowMatchesReviewed({
  githubApi, executionCommit, baseCommit, runHeadSha, reviewedWorkflowBlob,
}) {
  for (const [label, sha] of Object.entries({
    executionCommit, baseCommit, runHeadSha, reviewedWorkflowBlob,
  })) assert.match(sha || '', /^[a-f0-9]{40}$/, label + ' must be an immutable SHA');
  const ref = await githubApi('git/ref/pull/70/merge');
  assert.equal(ref?.ref, 'refs/pull/70/merge', 'Unexpected PR merge ref');
  const mergeSha = ref.object?.sha;
  assert.match(mergeSha || '', /^[a-f0-9]{40}$/, 'PR merge SHA unavailable');
  assert.ok(runHeadSha === executionCommit || runHeadSha === mergeSha,
    'CI run head does not match the authenticated execution or merge commit');
  const commit = await githubApi('git/commits/' + mergeSha);
  assert.deepEqual(commit?.parents?.map(p => p.sha), [baseCommit, executionCommit],
    'PR merge ref parents differ from validated CI source and base');
  assert.match(commit?.tree?.sha || '', /^[a-f0-9]{40}$/, 'PR merge tree missing');
  const tree = await githubApi('git/trees/' + commit.tree.sha + '?recursive=1');
  assert.ok(!tree?.truncated && Array.isArray(tree?.tree),
    'Authenticated PR merge workflow tree missing or truncated');
  const blobs = tree.tree.filter(item => item.path === '.github/workflows/ci.yml' &&
    item.type === 'blob');
  assert.equal(blobs.length, 1, 'CI workflow missing from authenticated PR merge tree');
  assert.equal(blobs[0].sha, reviewedWorkflowBlob,
    'Executed PR merge workflow differs from independently reviewed workflow source');
  return Object.freeze({
    mergeCommit: mergeSha,
    executionCommit,
    baseCommit,
    workflowBlob: reviewedWorkflowBlob,
  });
}

/**
 * Necessary, not sufficient: no risk-3 ACCEPTED verdict while the original
 * source/concurrency blocker or Windows crash-durability P1 is still open.
 * A not_planned closure is a waiver and cannot satisfy this gate.
 */
export async function assertT04BlockerIssuesClosed({ githubApi }) {
  const closed = [];
  for (const number of [71, 73]) {
    const issue = await githubApi('issues/' + number);
    assert.equal(issue?.state, 'closed',
      'Mandatory T04 blocker issue #' + number + ' is still open');
    assert.equal(issue?.state_reason, 'completed',
      'Mandatory T04 blocker issue #' + number + ' must be resolved, not waived');
    closed.push(number);
  }
  return Object.freeze(closed);
}
