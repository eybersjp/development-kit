#!/usr/bin/env node
/**
 * Development Kit Autopilot — Executable CLI Adapter
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCurrentState, saveStateRevision } from '../runtime/autopilot/state-store.mjs';
import { getProjectIdentity } from '../runtime/autopilot/project-identity.mjs';
import {
  createInitialState,
  calculateNextAction,
  beginActionState,
  recordResultState,
  pauseWorkflow,
  resumeWorkflow,
  renewActionLease,
  approveState,
  rejectState,
  requestCancelState,
  confirmCancelState,
} from '../runtime/autopilot/transition-model.mjs';
import { validateActionResult } from '../runtime/autopilot/validators.mjs';
import { enforceAutopilotOrchestrationGate } from '../runtime/autopilot/orchestration-result-gate.mjs';
import { resolveProjectRoot } from '../runtime/bootstrap/project-root.mjs';

const __filename = fileURLToPath(import.meta.url);

function parseArgs() {
  const options = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.substring(2).split('=');
    options[key] = rest.length ? rest.join('=') : true;
  }
  return options;
}

function respond(success, data, exitCode = 0) {
  console.log(JSON.stringify({ success, ...data }, null, 2));
  process.exit(exitCode);
}

function resolveInputFile(rootDir, inputFile) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, inputFile);
  const relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Security violation: invalid input file path');
  }
  return resolved;
}

function requireWorkflow(currentState) {
  if (!currentState) respond(false, { error: 'No active autopilot workflow found', code: 'ERROR_NO_WORKFLOW' }, 1);
}

function main() {
  const options = parseArgs();
  const explicitRoot = options['root-dir'] || options.rootDir;
  let rootDir;

  try {
    rootDir = resolveProjectRoot({
      cwd: process.cwd(),
      executablePath: __filename,
      explicitRoot,
    });
  } catch (err) {
    return respond(false, {
      code: err.code || 'DK_PROJECT_ROOT_ERROR',
      error: err.message,
      details: err.details || null,
    }, 1);
  }

  if (options.init) {
    const autonomy = typeof options.autonomy === 'string' ? options.autonomy : 'guided-autopilot';
    const state = createInitialState({ autonomy }, rootDir);
    saveStateRevision(state, rootDir);
    return respond(true, { message: 'Autopilot workflow initialized', state });
  }

  const currentState = getCurrentState(rootDir);
  if (currentState) {
    const identity = getProjectIdentity(rootDir);
    if (currentState.projectId !== identity.projectId) {
      return respond(false, { error: 'Project identity mismatch', code: 'ERROR_PROJECT_MISMATCH' }, 1);
    }
  }

  if (options.status) {
    requireWorkflow(currentState);
    return respond(true, { state: currentState });
  }

  if (options.cancel) {
    requireWorkflow(currentState);
    if (options.confirm) {
      try {
        const updatedState = confirmCancelState(currentState, options.confirm);
        saveStateRevision(updatedState, rootDir);
        return respond(true, { message: 'Autopilot workflow cancelled successfully', state: updatedState });
      } catch (err) {
        return respond(false, { error: err.message, code: 'ERROR_CANCELLATION_FAILED' }, 1);
      }
    }
    const { confirmationToken } = requestCancelState(currentState);
    saveStateRevision(currentState, rootDir);
    return respond(true, {
      status: 'CANCELLATION_CONFIRMATION_REQUIRED',
      message: 'Cancellation requested. Re-run with --cancel --confirm=<confirmationToken> to proceed.',
      confirmationToken,
    });
  }

  if (options.approve) {
    requireWorkflow(currentState);
    const approvalId = typeof options.approval === 'string' ? options.approval : options.approve;
    const token = options.token;
    if (!approvalId || !token) return respond(false, { error: 'Missing --approval or --token parameter', code: 'ERROR_INVALID_ARGS' }, 1);
    try {
      const updatedState = approveState(currentState, approvalId, token);
      saveStateRevision(updatedState, rootDir);
      return respond(true, { message: `Approval ${approvalId} granted`, state: updatedState });
    } catch (err) {
      return respond(false, { error: err.message, code: 'ERROR_APPROVAL_FAILED' }, 1);
    }
  }

  if (options.reject) {
    requireWorkflow(currentState);
    const approvalId = typeof options.approval === 'string' ? options.approval : options.reject;
    const token = options.token;
    if (!approvalId || !token) return respond(false, { error: 'Missing --approval or --token parameter', code: 'ERROR_INVALID_ARGS' }, 1);
    try {
      const updatedState = rejectState(currentState, approvalId, token);
      saveStateRevision(updatedState, rootDir);
      return respond(true, { message: `Approval ${approvalId} rejected`, state: updatedState });
    } catch (err) {
      return respond(false, { error: err.message, code: 'ERROR_REJECTION_FAILED' }, 1);
    }
  }

  if (options.pause) {
    requireWorkflow(currentState);
    try {
      const updatedState = pauseWorkflow(currentState);
      saveStateRevision(updatedState, rootDir);
      return respond(true, { message: 'Autopilot workflow paused', state: updatedState });
    } catch (err) {
      return respond(false, { error: err.message, code: 'ERROR_PAUSE_FAILED' }, 1);
    }
  }

  if (options.resume) {
    requireWorkflow(currentState);
    try {
      const updatedState = resumeWorkflow(currentState);
      saveStateRevision(updatedState, rootDir);
      return respond(true, { message: 'Autopilot workflow resumed', state: updatedState });
    } catch (err) {
      return respond(false, { error: err.message, code: 'ERROR_RESUME_FAILED' }, 1);
    }
  }

  if (options['renew-action']) {
    requireWorkflow(currentState);
    const actionId = options.action;
    if (!actionId) return respond(false, { error: 'Missing --action parameter', code: 'ERROR_INVALID_ARGS' }, 1);
    try {
      const updatedState = renewActionLease(currentState, actionId);
      saveStateRevision(updatedState, rootDir);
      return respond(true, { message: `Lease renewed for action ${actionId}`, state: updatedState });
    } catch (err) {
      return respond(false, { error: err.message, code: 'ERROR_LEASE_RENEWAL_FAILED' }, 1);
    }
  }

  if (options.next) {
    requireWorkflow(currentState);
    if (currentState.workflowStatus === 'paused') return respond(false, { error: 'Workflow is paused', code: 'ERROR_WORKFLOW_PAUSED' }, 1);
    const action = calculateNextAction(currentState);
    if (!currentState.activeAction && action.actionId) {
      currentState.activeAction = action;
      saveStateRevision(currentState, rootDir);
    }
    return respond(true, { action, stateRevision: currentState.stateRevision });
  }

  if (options['begin-action']) {
    requireWorkflow(currentState);
    if (currentState.workflowStatus === 'paused') return respond(false, { error: 'Workflow is paused', code: 'ERROR_WORKFLOW_PAUSED' }, 1);
    const actionId = options.action;
    if (!actionId) return respond(false, { error: 'Missing --action parameter', code: 'ERROR_INVALID_ARGS' }, 1);
    try {
      const updatedState = beginActionState(currentState, actionId);
      saveStateRevision(updatedState, rootDir);
      return respond(true, { message: `Action ${actionId} marked in_progress`, state: updatedState });
    } catch (err) {
      return respond(false, { error: err.message, code: 'ERROR_ACTION_FAILED' }, 1);
    }
  }

  if (options['record-result']) {
    requireWorkflow(currentState);
    if (currentState.workflowStatus === 'paused') return respond(false, { error: 'Workflow is paused', code: 'ERROR_WORKFLOW_PAUSED' }, 1);

    try {
      let rawResultData;
      if (options['input-file']) {
        rawResultData = JSON.parse(fs.readFileSync(resolveInputFile(rootDir, options['input-file']), 'utf8'));
      } else if (options['input-json']) {
        rawResultData = JSON.parse(options['input-json']);
      } else {
        return respond(false, { error: 'Missing --input-file or --input-json parameter', code: 'ERROR_INVALID_ARGS' }, 1);
      }

      validateActionResult(rawResultData);
      enforceAutopilotOrchestrationGate(currentState, rawResultData);
      const updatedState = recordResultState(currentState, rawResultData);
      saveStateRevision(updatedState, rootDir);
      return respond(true, { message: 'Action result recorded successfully', state: updatedState });
    } catch (err) {
      return respond(false, { error: err.message, code: 'ERROR_RECORD_RESULT_FAILED' }, 1);
    }
  }

  return respond(false, {
    error: 'Unknown CLI operation. Supported: --init, --status, --next, --begin-action, --record-result, --renew-action, --approve, --reject, --pause, --resume, --cancel',
    code: 'ERROR_UNKNOWN_OPERATION',
  }, 1);
}

main();
