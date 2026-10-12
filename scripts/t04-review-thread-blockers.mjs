// Deterministic review-thread blocker selection for T04 risk-3 acceptance.
// A requested clean review requires zero unresolved comments of any priority.
export function unresolvedReviewThreads(threads) {
  if (!Array.isArray(threads)) throw new TypeError('Review thread evidence must be an array');
  return threads.filter(thread => !thread || thread.isResolved !== true);
}
