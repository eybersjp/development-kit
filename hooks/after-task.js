/**
 * After-Task Hook
 *
 * Runs after each implementation task completes.
 *
 * Responsibilities:
 * - Verify that all task gates passed
 * - Record task completion status
 * - Identify any carry-over issues for the next task
 * - Report task summary
 *
 * This is an Antigravity lifecycle hook. It runs once per task.
 */

/**
 * Verify that all task gates passed.
 *
 * @param {object} gates - Gate results
 * @returns {object} - Overall gate status
 */
function verifyTaskGates(gates) {
  const gatesList = [
    { name: 'functional-verification', passed: gates.functionalVerification },
    { name: 'specification-compliance', passed: gates.specificationCompliance },
    { name: 'code-quality', passed: gates.codeQuality },
    { name: 'security-review', passed: gates.securityReview ?? true },
    { name: 'simplicity-review', passed: gates.simplicityReview },
  ];

  const failedGates = gatesList.filter((g) => !g.passed);

  return {
    allPassed: failedGates.length === 0,
    gates: gatesList,
    failedGates,
  };
}

/**
 * Record task completion for status tracking.
 *
 * @param {object} task - The completed task
 * @param {object} gates - Gate results
 * @param {object} implementation - Implementation results
 */
function recordTaskCompletion(task, gates, implementation) {
  return {
    taskId: task.id ?? 'unknown',
    taskName: task.objective ?? 'Unknown task',
    completedAt: new Date().toISOString(),
    gatesPassed: gates.allPassed,
    filesChanged: implementation.filesChanged ?? [],
    testsAdded: implementation.testsAdded ?? [],
    dependenciesAdded: implementation.dependenciesAdded ?? [],
    issues: implementation.openIssues ?? [],
  };
}

module.exports = {
  verifyTaskGates,
  recordTaskCompletion,
};
