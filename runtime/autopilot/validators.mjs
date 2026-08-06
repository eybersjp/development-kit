/**
 * Development Kit Autopilot — Explicit Domain Validators
 *
 * Provides zero-dependency runtime schema and domain invariant validation for
 * workflow states, actions, results, approvals, evaluation scenarios, and menu contexts.
 */

export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export function validateWorkflowState(state) {
  if (!state || typeof state !== 'object') {
    throw new ValidationError('State must be a non-null object');
  }

  const requiredStringFields = ['schemaVersion', 'workflowId', 'projectId', 'workflowMode', 'autonomyLevel', 'workflowStatus', 'currentStage', 'createdAt', 'updatedAt', 'frameworkVersion'];
  for (const field of requiredStringFields) {
    if (!state[field] || typeof state[field] !== 'string') {
      throw new ValidationError(`Missing or invalid required string field: ${field}`);
    }
  }

  if (typeof state.stateRevision !== 'number' || state.stateRevision < 1) {
    throw new ValidationError('stateRevision must be a positive integer');
  }

  if (!Array.isArray(state.completedStages) || !Array.isArray(state.skippedStages) || !Array.isArray(state.blockedStages)) {
    throw new ValidationError('completedStages, skippedStages, and blockedStages must be arrays');
  }

  return true;
}

export function validateAction(action) {
  if (!action || typeof action !== 'object') {
    throw new ValidationError('Action must be a non-null object');
  }

  const requiredFields = ['workflowId', 'stateRevision', 'actionId', 'actionType', 'stage'];
  for (const field of requiredFields) {
    if (!action[field] && action[field] !== 0) {
      throw new ValidationError(`Action missing required field: ${field}`);
    }
  }

  const allowedTypes = [
    'invoke_command',
    'invoke_agent',
    'run_validation',
    'request_approval',
    'display_status',
    'repair_failure',
    'complete_stage',
    'complete_workflow'
  ];

  if (!allowedTypes.includes(action.actionType)) {
    throw new ValidationError(`Invalid actionType: ${action.actionType}`);
  }

  return true;
}

export function validateActionResult(result) {
  if (!result || typeof result !== 'object') {
    throw new ValidationError('Action result must be a non-null object');
  }

  const requiredFields = ['workflowId', 'stateRevision', 'actionId', 'status'];
  for (const field of requiredFields) {
    if (!result[field] && result[field] !== 0) {
      throw new ValidationError(`Action result missing required field: ${field}`);
    }
  }

  if (!['completed', 'failed', 'cancelled', 'manual_review'].includes(result.status)) {
    throw new ValidationError(`Invalid action result status: ${result.status}`);
  }

  return true;
}

export function validatePendingApproval(approval) {
  if (!approval || typeof approval !== 'object') {
    throw new ValidationError('Pending approval must be a non-null object');
  }

  const requiredFields = ['approvalId', 'gateId', 'actionId', 'workflowId', 'stateRevision', 'tokenHash', 'requestedAt', 'expiresAt'];
  for (const field of requiredFields) {
    if (!approval[field] && approval[field] !== 0) {
      throw new ValidationError(`Pending approval missing required field: ${field}`);
    }
  }

  return true;
}

export function validateEvaluationScenario(scenario) {
  if (!scenario || typeof scenario !== 'object') {
    throw new ValidationError('Evaluation scenario must be a non-null object');
  }

  if (!scenario.scenarioId || !scenario.title || !Array.isArray(scenario.steps)) {
    throw new ValidationError('Evaluation scenario missing scenarioId, title, or steps array');
  }

  return true;
}

export function validateMenuContext(context) {
  if (!context || typeof context !== 'object') {
    throw new ValidationError('Menu context must be a non-null object');
  }

  if (!context.menuId || !Array.isArray(context.validOptions) || !context.status) {
    throw new ValidationError('Menu context missing menuId, validOptions, or status');
  }

  return true;
}
