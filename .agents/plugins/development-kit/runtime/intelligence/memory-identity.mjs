/**
 * Development Kit Intelligence — Partition Keys & Scope Scoping
 *
 * Implements deterministic partition key generation and scope isolation
 * across Project, Workspace, and User levels.
 */

import path from 'node:path';
import { MemoryScope } from './memory-enums.mjs';
import { getProjectIdentity } from '../autopilot/project-identity.mjs';

/**
 * Computes deterministic partition keys for DK Memory records and storage directories.
 */
export function getPartitionKey(scope, identity) {
  if (!scope || !identity) {
    throw new Error('scope and identity are required to compute partition key');
  }

  const { projectId, workspaceId, userId } = identity;

  switch (scope) {
    case MemoryScope.PROJECT:
      if (!projectId) {
        throw new Error('projectId is required for project-scoped partition key');
      }
      return `project:${projectId}`;

    case MemoryScope.WORKSPACE:
      if (!workspaceId) {
        throw new Error('workspaceId is required for workspace-scoped partition key');
      }
      return `workspace:${workspaceId}`;

    case MemoryScope.USER:
      if (!userId && !process.env.USER && !process.env.USERNAME) {
        return 'user:default';
      }
      return `user:${userId || process.env.USER || process.env.USERNAME || 'default'}`;

    default:
      throw new Error(`Invalid memory scope: ${scope}`);
  }
}

/**
 * Resolves the full effective project identity for memory scoping.
 */
export function resolveMemoryIdentity(rootDir = process.cwd(), overrideUserId = null) {
  const autopilotIdentity = getProjectIdentity(rootDir);
  const userId =
    overrideUserId ||
    process.env.DK_USER_ID ||
    process.env.USER ||
    process.env.USERNAME ||
    'default_user';

  return {
    projectId: autopilotIdentity.projectId,
    workspaceId: autopilotIdentity.workspaceId,
    userId,
  };
}

/**
 * Returns whether a query scope allows access to a record given their identities.
 * Enforces strict project isolation before ranking/retrieval.
 */
export function isRecordAccessible(record, identity, allowedScopes = [MemoryScope.PROJECT, MemoryScope.WORKSPACE, MemoryScope.USER]) {
  if (!record || !identity) return false;
  if (!allowedScopes.includes(record.scope)) return false;

  switch (record.scope) {
    case MemoryScope.PROJECT:
      return record.projectId === identity.projectId;

    case MemoryScope.WORKSPACE:
      return record.workspaceId ? record.workspaceId === identity.workspaceId : true;

    case MemoryScope.USER:
      return record.userId ? record.userId === identity.userId : true;

    default:
      return false;
  }
}
