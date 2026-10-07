/**
 * Development Kit Autopilot — State Store
 *
 * State Engine V2 is canonical for:
 * - fresh projects with no legacy Autopilot state chain;
 * - legacy projects after their workflow has been migrated into V2.
 *
 * Unmigrated legacy projects continue to use the legacy immutable-snapshot store
 * until explicit migration succeeds. This prevents silent history loss.
 */

import fs from 'node:fs';
import path from 'node:path';

import { validateWorkflowState } from './validators.mjs';
import { acquireTransactionLock, releaseTransactionLock } from './lock-manager.mjs';
import {
  appendEntityState,
  hasCompletedStateMigration,
  isStateEngineV2Active,
  loadLatestEntityState,
  rebuildStateSnapshot,
} from '../orchestration/state-engine-v2.mjs';

export class StateStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateStoreError';
  }
}

export function getStateDir(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'autopilot', 'state');
}

function legacyStateExists(rootDir) {
  const stateDir = getStateDir(rootDir);
  if (!fs.existsSync(stateDir)) return false;
  return fs.readdirSync(stateDir).some((name) => /^revision-\d{6}\.json$/.test(name));
}

function migratedWorkflowState(rootDir) {
  if (!isStateEngineV2Active(rootDir)) return null;
  return loadLatestEntityState('autopilot-workflow', rootDir);
}

function shouldUseV2(rootDir) {
  if (!legacyStateExists(rootDir)) return true;
  return hasCompletedStateMigration(rootDir) && migratedWorkflowState(rootDir) !== null;
}

function getLegacyCurrentState(rootDir) {
  const stateDir = getStateDir(rootDir);
  const currentFile = path.join(stateDir, 'current.json');

  if (!fs.existsSync(currentFile)) return null;

  try {
    const pointer = JSON.parse(fs.readFileSync(currentFile, 'utf8'));
    const revFile = path.join(stateDir, pointer.currentRevisionFile);
    if (fs.existsSync(revFile)) {
      const state = JSON.parse(fs.readFileSync(revFile, 'utf8'));
      validateWorkflowState(state);
      return state;
    }
  } catch {
    // Pointer or state file corrupt — attempt legacy recovery.
  }

  return recoverLatestLegacyState(rootDir);
}

export function getCurrentState(rootDir = process.cwd()) {
  if (shouldUseV2(rootDir)) {
    const state = migratedWorkflowState(rootDir);
    if (state) {
      validateWorkflowState(state);
      return state;
    }
    if (!legacyStateExists(rootDir)) return null;
  }
  return getLegacyCurrentState(rootDir);
}

function saveLegacyStateRevision(state, rootDir) {
  const stateDir = getStateDir(rootDir);
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

  const lock = acquireTransactionLock(rootDir);
  try {
    const revNum = String(state.stateRevision).padStart(6, '0');
    const revFileName = `revision-${revNum}.json`;
    const revFilePath = path.join(stateDir, revFileName);
    const tmpFilePath = path.join(stateDir, `tmp-${Date.now()}-${revFileName}`);

    const content = JSON.stringify(state, null, 2);
    const fd = fs.openSync(tmpFilePath, 'w');
    fs.writeSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmpFilePath, revFilePath);

    const currentPointerPath = path.join(stateDir, 'current.json');
    const tmpPointerPath = path.join(stateDir, `tmp-current-${Date.now()}.json`);
    const pointerContent = JSON.stringify({
      currentRevision: state.stateRevision,
      currentRevisionFile: revFileName,
      workflowId: state.workflowId,
      updatedAt: new Date().toISOString(),
    }, null, 2);

    const pFd = fs.openSync(tmpPointerPath, 'w');
    fs.writeSync(pFd, pointerContent, 'utf8');
    fs.fsyncSync(pFd);
    fs.closeSync(pFd);
    fs.renameSync(tmpPointerPath, currentPointerPath);
    return state;
  } finally {
    releaseTransactionLock(lock);
  }
}

export function saveStateRevision(state, rootDir = process.cwd()) {
  validateWorkflowState(state);

  if (!shouldUseV2(rootDir)) {
    return saveLegacyStateRevision(state, rootDir);
  }

  appendEntityState({
    rootDir,
    entityType: 'autopilot-workflow',
    entityId: state.workflowId,
    state,
    actorClass: 'autopilot',
    timestamp: state.updatedAt,
  });
  return state;
}

function recoverLatestLegacyState(rootDir) {
  const stateDir = getStateDir(rootDir);
  if (!fs.existsSync(stateDir)) return null;

  const files = fs.readdirSync(stateDir)
    .filter((file) => /^revision-\d{6}\.json$/.test(file))
    .sort()
    .reverse();

  for (const file of files) {
    try {
      const filePath = path.join(stateDir, file);
      const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      validateWorkflowState(state);

      const pointerContent = JSON.stringify({
        currentRevision: state.stateRevision,
        currentRevisionFile: file,
        workflowId: state.workflowId,
        updatedAt: new Date().toISOString(),
        recoveredAt: new Date().toISOString(),
      }, null, 2);

      fs.writeFileSync(path.join(stateDir, 'current.json'), pointerContent, 'utf8');
      return state;
    } catch {
      // Try previous revision.
    }
  }

  return null;
}

export function recoverLatestValidState(rootDir = process.cwd()) {
  if (isStateEngineV2Active(rootDir)) {
    const current = migratedWorkflowState(rootDir);
    if (current) {
      rebuildStateSnapshot(rootDir);
      const rebuilt = loadLatestEntityState('autopilot-workflow', rootDir);
      validateWorkflowState(rebuilt);
      return rebuilt;
    }
  }
  return recoverLatestLegacyState(rootDir);
}
