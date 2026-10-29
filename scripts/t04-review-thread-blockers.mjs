// Deterministic review-thread blocker selection for T04 risk-3 acceptance.
// A requested clean review requires zero unresolved comments of any priority.
export function unresolvedReviewThreads(threads) {
  if (!Array.isArray(threads)) throw new TypeError('Review thread evidence must be an array');
  return threads.filter(thread => !thread || thread.isResolved !== true);
}

export function requireCanonicalReviewRequestCommit(body, reviewedCommit) {
  if (typeof body !== 'string' || !/^[a-f0-9]{40}$/.test(reviewedCommit)) {
    throw new Error('Review request commit evidence is malformed');
  }
  // Exactly one unambiguous source-binding field is permitted. An authenticated
  // reaction alone has no Git object provenance; ambiguous requests fail closed.
  const fields = [...body.matchAll(/^(?:Commit|Immutable source commit):[ \t]*([a-f0-9]{40})[ \t]*$/gm)];
  // Conservatively reject every other plausible Git abbreviation, including
  // uppercase identifiers. Hex-only prose may therefore need rewording.
  const hashes = body.match(/\b[a-f0-9]{7,40}\b/gi) ?? [];
  if (fields.length !== 1 || fields[0][1] !== reviewedCommit ||
      hashes.length !== 1 || hashes[0] !== reviewedCommit) {
    throw new Error('Reviewer scope request must identify exactly one canonical reviewed commit');
  }
  return reviewedCommit;
}

export function parseReviewThreadPage(page) {
  if (!page || !Array.isArray(page.nodes) || !page.pageInfo ||
      typeof page.pageInfo.hasNextPage !== 'boolean' ||
      (page.pageInfo.endCursor != null && typeof page.pageInfo.endCursor !== 'string') ||
      (page.pageInfo.hasNextPage &&
        (typeof page.pageInfo.endCursor !== 'string' || !page.pageInfo.endCursor)) ||
      page.nodes.some(node => !node || typeof node.isResolved !== 'boolean')) {
    throw new Error('Authenticated GitHub review thread page is malformed');
  }
  return {
    nodes: page.nodes,
    hasNextPage: page.pageInfo.hasNextPage,
    endCursor: page.pageInfo.endCursor ?? null,
  };
}

/**
 * A COMMENTED review is not a clean attestation just because negative prose
 * contains the word PASS. Require an explicit verdict without contradictions.
 */
export function requireCanonicalGithubReviewVerdict(body) {
  if (typeof body !== 'string') throw new Error('GitHub reviewer verdict evidence is malformed');
  // Closed schema: no trailers, markdown prose, second findings field or
  // unstructured text capable of contradicting a declared clean review.
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  if (lines.length === 1) {
    throw new Error('Independent GitHub review requires exactly one canonical PASS verdict');
  }
  if (lines.length !== 2 && lines.length !== 4) {
    throw new Error('Conflicting failure or finding marker in GitHub review: unexpected response fields');
  }
  const [verdict, findings] = lines.slice(-2);
  if (!/^(?:Review verdict|Verdict): PASS$/.test(verdict)) {
    throw new Error('Independent GitHub review requires exactly one canonical PASS verdict');
  }
  if (findings !== 'Findings: none') {
    throw new Error('Conflicting failure or finding marker in GitHub review: findings not clean');
  }
  if (lines.length === 4 &&
      (!/^Reviewed commit: [a-f0-9]{40}$/.test(lines[0]) ||
       !/^Review role: (?:architecture-reviewer|code-reviewer|security-reviewer)$/.test(lines[1]))) {
    throw new Error('Conflicting failure or finding marker in GitHub review: noncanonical source or role');
  }
  return 'PASS';
}

/**
 * Construct a single-role immutable review request with exactly one SHA.
 * The result must still be independently authored and evaluated externally.
 */
export function formatCanonicalT04ReviewRequest(role, reviewedCommit, scope) {
  if (!['architecture-reviewer', 'code-reviewer', 'security-reviewer'].includes(role) ||
      typeof scope !== 'string' || !scope.trim() || /[\r\n]/.test(scope)) {
    throw new Error('T04 reviewer request role/scope is invalid');
  }
  const body = [
    '@codex review',
    'Independent role: ' + role,
    'Commit: ' + reviewedCommit,
    'Review scope: ' + scope,
    'Report findings with priority; use the exact closed four-field response schema on a clean result. A finding must not be concealed by a PASS.',
  ].join('\n');
  requireCanonicalReviewRequestCommit(body, reviewedCommit);
  return body;
}

function requireCanonicalRole(body, label, expectedRole) {
  const roles = ['architecture-reviewer', 'code-reviewer', 'security-reviewer'];
  const fields = [...body.matchAll(new RegExp('^' + label + ':[ \\t]*(.*)$', 'gmi'))];
  if (!roles.includes(expectedRole) || fields.length !== 1 ||
      fields[0][0] !== label + ': ' + expectedRole) {
    throw new Error('Reviewer evidence requires exactly one canonical ' + label);
  }
}

export function requireCanonicalGithubReviewRequest(request, expectedRole, reviewedCommit) {
  if (!request || request.issue_url !== 'https://api.github.com/repos/eybersjp/development-kit/issues/70' ||
      typeof request.body !== 'string' || !request.body.includes('@codex')) {
    throw new Error('Authenticated reviewer scope request must bind PR #70');
  }
  requireCanonicalRole(request.body, 'Independent role', expectedRole);
  requireCanonicalReviewRequestCommit(request.body, reviewedCommit);
  return reviewedCommit;
}

export function requireCanonicalGithubReviewResponse(review, expectedRole, reviewedCommit) {
  if (!review || review.commit_id !== reviewedCommit || typeof review.body !== 'string') {
    throw new Error('Authenticated review metadata must bind the immutable reviewed source');
  }
  requireCanonicalRole(review.body, 'Review role', expectedRole);
  // Reuse the same conservative source-token policy with a response-only label.
  if (/^(?:Commit|Immutable source commit):/mi.test(review.body)) {
    throw new Error('Review response contains an alternative source-binding field');
  }
  requireCanonicalReviewRequestCommit(review.body.replace(/^Reviewed commit:/gm, 'Commit:'), reviewedCommit);
  return requireCanonicalGithubReviewVerdict(review.body);
}
