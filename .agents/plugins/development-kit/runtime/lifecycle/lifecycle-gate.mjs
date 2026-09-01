/**
 * Development Kit — Centralized Lifecycle Entry Gate
 *
 * Implements command classification taxonomy and common lifecycle entry rules:
 * - PROJECT_MUTATING: Requires valid bootstrap; fails closed if missing/corrupt.
 * - PROJECT_STATE_MUTATING (/dk-test, /dk-review): Requires valid bootstrap.
 * - PROJECT_ORCHESTRATOR (/dk-autopilot): Establishes/validates bootstrap.
 * - PROJECT_READ_ONLY (/dk-status, /dk-control): Operates diagnostically if unbootstrapped.
 * - DUAL_MODE (/dk-research, /dk-debug): Binds project identity if present.
 */

import path from 'node:path';
import { bootstrapProject, getProjectBootstrapStatus, assertProjectBootstrapped } from '../bootstrap/project-bootstrap.mjs';
import { computeIdeaStageState } from '../orchestration/idea-state.mjs';

export const COMMAND_ENTRY_TAXONOMY = Object.freeze({
  '/dk-idea': 'PROJECT_MUTATING',
  '/dk-spec': 'PROJECT_MUTATING',
  '/dk-design': 'PROJECT_MUTATING',
  '/dk-design-system': 'PROJECT_MUTATING',
  '/dk-tasks': 'PROJECT_MUTATING',
  '/dk-build': 'PROJECT_MUTATING',
  '/dk-build-auto': 'PROJECT_MUTATING',
  '/dk-simplify': 'PROJECT_MUTATING',
  '/dk-ship': 'PROJECT_MUTATING',
  '/dk-test': 'PROJECT_STATE_MUTATING',
  '/dk-review': 'PROJECT_STATE_MUTATING',
  '/dk-autopilot': 'PROJECT_ORCHESTRATOR',
  '/dk-status': 'PROJECT_READ_ONLY',
  '/dk-control': 'PROJECT_READ_ONLY',
  '/dk-research': 'DUAL_MODE',
  '/dk-debug': 'DUAL_MODE',
});

export function normalizeCommandName(cmd) {
  if (!cmd) return null;
  const str = String(cmd).trim();
  if (str.startsWith('/dk-')) return str;
  if (str.startsWith('dk-')) return `/${str}`;
  if (str.startsWith('/')) return `/dk-${str.slice(1)}`;
  return `/dk-${str}`;
}

export async function executeLifecycleEntry({
  rootDir = process.cwd(),
  command,
  phase = 'entry',
} = {}) {
  const normCmd = normalizeCommandName(command);
  const classification = COMMAND_ENTRY_TAXONOMY[normCmd] || 'PROJECT_MUTATING';
  const bootstrapStatus = getProjectBootstrapStatus(rootDir);

  let initialized = bootstrapStatus.initialized;
  let identity = null;
  let error = null;

  switch (classification) {
    case 'PROJECT_MUTATING':
    case 'PROJECT_STATE_MUTATING':
    case 'PROJECT_ORCHESTRATOR': {
      if (!initialized) {
        const bootResult = await bootstrapProject(rootDir);
        if (!bootResult.success) {
          return {
            success: false,
            command: normCmd,
            classification,
            error: `Lifecycle entry failed: Unable to bootstrap project state: ${bootResult.error}`,
            code: 'DK_LIFECYCLE_BOOTSTRAP_FAILED',
          };
        }
        initialized = true;
        identity = bootResult.identity;
      } else {
        try {
          const check = assertProjectBootstrapped(rootDir, { requireMutatingState: false });
          identity = { projectId: check.projectId, frameworkVersion: check.frameworkVersion };
        } catch (err) {
          return {
            success: false,
            command: normCmd,
            classification,
            error: `Lifecycle entry failed: Corrupt bootstrap state: ${err.message}`,
            code: 'DK_LIFECYCLE_BOOTSTRAP_CORRUPT',
          };
        }
      }
      break;
    }

    case 'PROJECT_READ_ONLY': {
      if (initialized) {
        try {
          const check = assertProjectBootstrapped(rootDir, { requireMutatingState: false });
          identity = { projectId: check.projectId, frameworkVersion: check.frameworkVersion };
        } catch (err) {
          return {
            success: false,
            command: normCmd,
            classification,
            error: `Lifecycle entry failed: Corrupt bootstrap state: ${err.message}`,
            code: 'DK_LIFECYCLE_BOOTSTRAP_CORRUPT',
          };
        }
      }
      break;
    }

    case 'DUAL_MODE': {
      if (initialized) {
        try {
          const check = assertProjectBootstrapped(rootDir, { requireMutatingState: false });
          identity = { projectId: check.projectId, frameworkVersion: check.frameworkVersion };
        } catch (err) {
          return {
            success: false,
            command: normCmd,
            classification,
            error: `Lifecycle entry failed: Corrupt bootstrap state: ${err.message}`,
            code: 'DK_LIFECYCLE_BOOTSTRAP_CORRUPT',
          };
        }
      }
      break;
    }
  }

  let ideaStage = null;
  if (initialized) {
    try {
      ideaStage = computeIdeaStageState(rootDir);
      if (ideaStage.state === 'BLOCKED' && ideaStage.blockerType === 'RUNTIME_FRAMEWORK') {
        const issue = ideaStage.issues?.[0];
        return {
          success: false,
          command: normCmd,
          classification,
          bootstrapped: true,
          identity,
          error: `Lifecycle entry failed: Corrupt lifecycle state: ${issue?.message || 'Unknown framework state corruption'}`,
          code: issue?.code || 'DK_LIFECYCLE_STATE_CORRUPT',
          ideaStage,
        };
      }
    } catch (err) {
      return {
        success: false,
        command: normCmd,
        classification,
        bootstrapped: true,
        identity,
        error: `Lifecycle entry failed: Corrupt lifecycle state: ${err.message}`,
        code: err.code || 'DK_LIFECYCLE_STATE_CORRUPT',
      };
    }
  }

  return {
    success: true,
    command: normCmd,
    classification,
    bootstrapped: initialized,
    identity,
    ideaStage,
    rootDir,
  };
}
