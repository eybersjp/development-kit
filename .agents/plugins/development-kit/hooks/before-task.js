/**
 * Before-Task Hook
 *
 * Runs before each implementation task begins.
 *
 * Responsibilities:
 * - Validate that the previous task completed all gates (if applicable)
 * - Verify that the task is clearly defined with acceptance criteria
 * - Check that verification is specified
 * - Load relevant skills for the task type
 * - Spawn the repository-scout for task context
 *
 * This is an Antigravity lifecycle hook. It runs once per task.
 */

/**
 * Validate that a task is ready for implementation.
 *
 * @param {object} task - The task object
 * @returns {{ ready: boolean, issues: string[] }}
 */
function validateTaskReadiness(task) {
  const issues = [];

  if (!task.objective) {
    issues.push('Task is missing an objective');
  }

  if (!task.requirements || task.requirements.length === 0) {
    issues.push('Task has no requirements defined');
  }

  if (!task.acceptanceCriteria || task.acceptanceCriteria.length === 0) {
    issues.push('Task has no acceptance criteria');
  }

  if (!task.verification || task.verification.length === 0) {
    issues.push('Task has no verification specified');
  }

  if (!task.exclusions) {
    issues.push('Task has no exclusions defined (use empty list if none)');
  }

  return {
    ready: issues.length === 0,
    issues,
  };
}

/**
 * Determine which skills are relevant for the given task.
 *
 * @param {object} task - The task object
 * @returns {string[]} - List of skill names
 */
function selectSkillsForTask(task) {
  const skills = ['subagent-driven-implementation'];

  if (task.verification?.includes('unit') || task.verification?.includes('test')) {
    skills.push('test-driven-development');
  }

  return skills;
}

module.exports = {
  validateTaskReadiness,
  selectSkillsForTask,
};
