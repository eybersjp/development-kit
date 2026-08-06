/**
 * Development Kit Autopilot — Project & Workspace Identity Resolver
 *
 * Resolves or creates persistent project identity (.development-kit/project.json, tracked in Git)
 * and local workspace identity (.development-kit/workspace-id, ignored in Git).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function getProjectIdentity(rootDir = process.cwd()) {
  const dkDir = path.join(rootDir, '.development-kit');
  if (!fs.existsSync(dkDir)) {
    fs.mkdirSync(dkDir, { recursive: true });
  }

  const projectFile = path.join(dkDir, 'project.json');
  let projectId;

  if (fs.existsSync(projectFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
      projectId = data.projectId;
    } catch {
      // Corrupt file will be regenerated
    }
  }

  if (!projectId) {
    projectId = `proj_${crypto.randomUUID()}`;
    const payload = {
      projectId,
      createdAt: new Date().toISOString(),
      frameworkVersion: '0.4.0'
    };
    fs.writeFileSync(projectFile, JSON.stringify(payload, null, 2), 'utf8');
  }

  const workspaceFile = path.join(dkDir, 'workspace-id');
  let workspaceId;

  if (fs.existsSync(workspaceFile)) {
    workspaceId = fs.readFileSync(workspaceFile, 'utf8').trim();
  }

  if (!workspaceId) {
    workspaceId = `ws_${crypto.randomUUID()}`;
    fs.writeFileSync(workspaceFile, workspaceId, 'utf8');
  }

  return { projectId, workspaceId };
}
