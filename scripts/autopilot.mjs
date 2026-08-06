#!/usr/bin/env node
/**
 * Development Kit Autopilot — Executable CLI Adapter
 *
 * Usage:
 *   node scripts/autopilot.mjs --init [--autonomy=guided-autopilot|high-autonomy|review-every-stage]
 *   node scripts/autopilot.mjs --status
 *   node scripts/autopilot.mjs --next
 *   node scripts/autopilot.mjs --begin-action --action=<actionId>
 *   node scripts/autopilot.mjs --record-result [--input-file=<path> | --input-json=<json>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { getCurrentState, saveStateRevision } from '../runtime/autopilot/state-store.mjs';
import { createInitialState, calculateNextAction, beginActionState, recordResultState } from '../runtime/autopilot/transition-model.mjs';
import { validateActionResult } from '../runtime/autopilot/validators.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      const key = parts[0];
      const value = parts.length > 1 ? parts.slice(1).join('=') : true;
      options[key] = value;
    }
  }
  return options;
}

function respond(success, data, exitCode = 0) {
  console.log(JSON.stringify({ success, ...data }, null, 2));
  process.exit(exitCode);
}

function main() {
  const options = parseArgs();
  const rootDir = process.cwd();

  if (options.init) {
    const autonomy = typeof options.autonomy === 'string' ? options.autonomy : 'guided-autopilot';
    const state = createInitialState({ autonomy }, rootDir);
    saveStateRevision(state, rootDir);
    return respond(true, { message: 'Autopilot workflow initialized', state });
  }

  const currentState = getCurrentState(rootDir);

  if (options.status) {
    if (!currentState) {
      return respond(false, { error: 'No active autopilot workflow found', code: 'ERROR_NO_WORKFLOW' }, 1);
    }
    return respond(true, { state: currentState });
  }

  if (options.next) {
    if (!currentState) {
      return respond(false, { error: 'No active autopilot workflow found', code: 'ERROR_NO_WORKFLOW' }, 1);
    }
    const action = calculateNextAction(currentState);
    if (!currentState.activeAction && action.actionId) {
      currentState.activeAction = action;
      saveStateRevision(currentState, rootDir);
    }
    return respond(true, { action, stateRevision: currentState.stateRevision });
  }

  if (options['begin-action']) {
    if (!currentState) {
      return respond(false, { error: 'No active autopilot workflow found', code: 'ERROR_NO_WORKFLOW' }, 1);
    }
    const actionId = options.action;
    if (!actionId) {
      return respond(false, { error: 'Missing --action parameter', code: 'ERROR_INVALID_ARGS' }, 1);
    }
    try {
      const updatedState = beginActionState(currentState, actionId);
      saveStateRevision(updatedState, rootDir);
      return respond(true, { message: `Action ${actionId} marked in_progress`, state: updatedState });
    } catch (err) {
      return respond(false, { error: err.message, code: 'ERROR_ACTION_FAILED' }, 1);
    }
  }

  if (options['record-result']) {
    if (!currentState) {
      return respond(false, { error: 'No active autopilot workflow found', code: 'ERROR_NO_WORKFLOW' }, 1);
    }

    let rawResultData = null;
    if (options['input-file']) {
      const filePath = path.resolve(rootDir, options['input-file']);
      if (!filePath.startsWith(rootDir) || filePath.includes('..')) {
        return respond(false, { error: 'Security violation: invalid input file path', code: 'ERROR_SECURITY_VIOLATION' }, 1);
      }
      rawResultData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else if (options['input-json']) {
      rawResultData = JSON.parse(options['input-json']);
    } else {
      return respond(false, { error: 'Missing --input-file or --input-json parameter', code: 'ERROR_INVALID_ARGS' }, 1);
    }

    try {
      validateActionResult(rawResultData);
      const updatedState = recordResultState(currentState, rawResultData);
      saveStateRevision(updatedState, rootDir);
      return respond(true, { message: 'Action result recorded successfully', state: updatedState });
    } catch (err) {
      return respond(false, { error: err.message, code: 'ERROR_RECORD_RESULT_FAILED' }, 1);
    }
  }

  return respond(false, { error: 'Unknown CLI operation. Supported: --init, --status, --next, --begin-action, --record-result', code: 'ERROR_UNKNOWN_OPERATION' }, 1);
}

main();
