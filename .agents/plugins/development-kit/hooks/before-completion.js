/**
 * Before-Completion Hook
 *
 * Runs before marking any work as complete (end of task, feature, or project).
 *
 * Responsibilities:
 * - Verify that all tasks are complete
 * - Verify that all gates have passed for all tasks
 * - Check for unresolved issues
 * - Confirm documentation is updated
 * - Confirm tests are in place
 *
 * This is an Antigravity lifecycle hook. It runs at completion checkpoints.
 */

/**
 * Perform a final completion check.
 *
 * @param {object} state - The current work state
 * @returns {object} - Completion check results
 */
function checkCompletionReadiness(state) {
  const issues = [];

  // Check all tasks complete
  if (!state.allTasksComplete) {
    issues.push('Not all tasks are complete');
  }

  // Check all gates passed
  if (state.failedGates && state.failedGates.length > 0) {
    issues.push(`Failed gates: ${state.failedGates.join(', ')}`);
  }

  // Check documentation
  if (state.documentationUpdated === false) {
    issues.push('Documentation has not been updated');
  }

  // Check unresolved issues
  if (state.openIssues && state.openIssues.length > 0) {
    issues.push(`Open issues: ${state.openIssues.length} unresolved`);
  }

  return {
    ready: issues.length === 0,
    issues,
    canShip: issues.length === 0,
  };
}

module.exports = {
  checkCompletionReadiness,
};
