/**
 * Development Kit Autopilot — Immutable Snapshot State Store
 *
 * Implements crash-consistent versioned snapshot persistence:
 * .development-kit/autopilot/state/revision-XXXXXX.json & current.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { validateWorkflowState } from './validators.mjs';
import { acquireTransactionLock, releaseTransactionLock } from './lock-manager.mjs';

export class StateStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateStoreError';
  }
}

export function getStateDir(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'autopilot', 'state');
}

export function getCurrentState(rootDir = process.cwd()) {
  const stateDir = getStateDir(rootDir);
  const currentFile = path.join(stateDir, 'current.json');

  if (!fs.existsSync(currentFile)) {
    return null;
  }

  try {
    const pointer = JSON.parse(fs.readFileSync(currentFile, 'utf8'));
    const revFile = path.join(stateDir, pointer.currentRevisionFile);
    if (fs.existsSync(revFile)) {
      const state = JSON.parse(fs.readFileSync(revFile, 'utf8'));
      validateWorkflowState(state);
      return state;
    }
  } catch {
    // Pointer or state file corrupt — attempt recovery
  }

  return recoverLatestValidState(rootDir);
}

export function saveStateRevision(state, rootDir = process.cwd()) {
  validateWorkflowState(state);
  const stateDir = getStateDir(rootDir);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

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
      updatedAt: new Date().toISOString()
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

export function recoverLatestValidState(rootDir = process.cwd()) {
  const stateDir = getStateDir(rootDir);
  if (!fs.existsSync(stateDir)) return null;

  const files = fs.readdirSync(stateDir)
    .filter(f => /^revision-\d{6}\.json$/.test(f))
    .sort()
    .reverse();

  for (const file of files) {
    try {
      const filePath = path.join(stateDir, file);
      const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      validateWorkflowState(state);

      // Repair pointer
      const pointerContent = JSON.stringify({
        currentRevision: state.stateRevision,
        currentRevisionFile: file,
        workflowId: state.workflowId,
        updatedAt: new Date().toISOString(),
        recoveredAt: new Date().toISOString()
      }, null, 2);

      fs.writeFileSync(path.join(stateDir, 'current.json'), pointerContent, 'utf8');
      return state;
    } catch {
      // Try previous revision
    }
  }

  return null;
}
