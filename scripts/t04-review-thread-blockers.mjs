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
  const hashes = body.match(/\b[a-f0-9]{40}\b/g) ?? [];
  if (fields.length !== 1 || fields[0][1] !== reviewedCommit ||
      hashes.length !== 1 || hashes[0] !== reviewedCommit) {
    throw new Error('Reviewer scope request must identify exactly one canonical reviewed commit');
  }
  return reviewedCommit;
}

export function parseReviewThreadPage(page) {
  if (!page || !Array.isArray(page.nodes) || !page.pageInfo ||
      typeof page.pageInfo.hasNextPage !== 'boolean' ||
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
  const fields = [...body.matchAll(/^(?:Review verdict|Verdict):[ \t]*([A-Za-z_-]+)[ \t]*$/gmi)];
  if (fields.length !== 1 || fields[0][1] !== 'PASS') {
    throw new Error('Independent GitHub review requires exactly one canonical PASS verdict');
  }
  if (/\b(?:FAIL(?:ED|URE)?|BLOCK(?:ED|ER|ING)?|REJECT(?:ED|ION)?|REQUEST[_ -]?CHANGES|P[012]|unresolved|cannot[ \t]+PASS|can['’]t[ \t]+PASS|not[ \t]+PASS|no[ \t]+PASS)\b/i.test(body)) {
    throw new Error('Conflicting failure or finding marker in GitHub review');
  }
  return 'PASS';
}
