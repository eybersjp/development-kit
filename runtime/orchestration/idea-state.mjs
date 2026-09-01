/**
 * Development Kit — Deterministic IDEA Stage State Machine & Approval Engine
 *
 * Implements 6-state model:
 * NOT_STARTED -> DISCOVERY_IN_PROGRESS -> DRAFT_READY -> READY_FOR_APPROVAL -> APPROVED
 *                                      \-> BLOCKED
 *
 * Enforces immutable approval history in .development-kit/idea/approvals.json
 * with dual fingerprint and revision matching.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getProjectBootstrapStatus } from '../bootstrap/project-bootstrap.mjs';
import { resolveCanonicalIdeaArtifact } from '../artifacts/artifact-registry.mjs';
import { validateIdeaBriefStructure } from './idea-schema.mjs';
import { loadDiscoveryState, evaluateDiscoveryReadiness } from './idea-discovery.mjs';

export const IDEA_STAGE_STATES = Object.freeze([
  'NOT_STARTED',
  'DISCOVERY_IN_PROGRESS',
  'DRAFT_READY',
  'READY_FOR_APPROVAL',
  'APPROVED',
  'BLOCKED',
]);

export function getApprovalsFilePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea', 'approvals.json');
}

export function loadApprovalsHistory(rootDir = process.cwd()) {
  const filePath = getApprovalsFilePath(rootDir);
  if (!fs.existsSync(filePath)) {
    return {
      schemaVersion: '1.0.0',
      approvals: [],
    };
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { schemaVersion: '1.0.0', approvals: [] };
  }
}

export function persistApprovalRecord(rootDir = process.cwd(), {
  artifactFingerprint,
  artifactRevision,
  approvingAuthority = 'PRODUCT_OWNER',
  linkedPodIds = [],
} = {}) {
  const dir = path.join(rootDir, '.development-kit', 'idea');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const history = loadApprovalsHistory(rootDir);
  const approvalId = `APPR-IDEA-${Date.now()}-${history.approvals.length + 1}`;
  const record = {
    id: approvalId,
    artifactFingerprint,
    artifactRevision,
    approvingAuthority,
    linkedPodIds,
    approvedAt: new Date().toISOString(),
  };

  history.approvals.push(record);
  const filePath = getApprovalsFilePath(rootDir);
  const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(history, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
  return record;
}

export function computeEffectiveApprovalStatus(rootDir = process.cwd(), currentFingerprint, currentRevision) {
  const history = loadApprovalsHistory(rootDir);
  if (!history.approvals || history.approvals.length === 0) {
    return { status: 'NONE', latestApproval: null };
  }

  const latest = history.approvals[history.approvals.length - 1];
  if (latest.artifactFingerprint === currentFingerprint && latest.artifactRevision === currentRevision) {
    return { status: 'CURRENT', latestApproval: latest };
  }

  return { status: 'STALE', latestApproval: latest };
}

export function computeIdeaStageState(rootDir = process.cwd()) {
  const bootstrap = getProjectBootstrapStatus(rootDir);
  if (!bootstrap.initialized) {
    return {
      state: 'NOT_STARTED',
      bootstrapped: false,
      issues: [{ code: 'UNBOOTSTRAPPED_PROJECT', message: 'Project lacks .development-kit bootstrap' }],
    };
  }

  let artifact;
  try {
    artifact = resolveCanonicalIdeaArtifact(rootDir);
  } catch (err) {
    if (err.code === 'DK_ARTIFACT_AUTHORITY_CONFLICT') {
      return {
        state: 'BLOCKED',
        blockerType: 'RUNTIME_FRAMEWORK',
        bootstrapped: true,
        issues: [{ code: err.code, message: err.message, details: err.details }],
      };
    }
    throw err;
  }

  const discoveryState = loadDiscoveryState(rootDir);
  const hasDiscovery = discoveryState.requirements.length > 0 || discoveryState.openQuestions.length > 0;

  if (!artifact.registered && !hasDiscovery) {
    return {
      state: 'NOT_STARTED',
      bootstrapped: true,
      issues: [],
    };
  }

  if (!artifact.registered && hasDiscovery) {
    return {
      state: 'DISCOVERY_IN_PROGRESS',
      bootstrapped: true,
      issues: [{ code: 'ARTIFACT_UNREGISTERED', message: 'Discovery is underway but canonical idea-brief.md is not yet written' }],
    };
  }

  const content = fs.readFileSync(artifact.absolutePath, 'utf8');
  const structValidation = validateIdeaBriefStructure(content);

  if (!structValidation.valid) {
    return {
      state: 'DISCOVERY_IN_PROGRESS',
      bootstrapped: true,
      issues: structValidation.issues,
      artifact,
    };
  }

  const discoveryReadiness = evaluateDiscoveryReadiness(rootDir);

  if (!discoveryReadiness.ready) {
    return {
      state: 'DRAFT_READY',
      bootstrapped: true,
      issues: discoveryReadiness.blockers,
      artifact,
      discoveryReadiness,
    };
  }

  const approval = computeEffectiveApprovalStatus(rootDir, artifact.fingerprint, artifact.revision);
  if (approval.status === 'CURRENT') {
    return {
      state: 'APPROVED',
      bootstrapped: true,
      issues: [],
      artifact,
      approval: approval.latestApproval,
    };
  }

  return {
    state: 'READY_FOR_APPROVAL',
    bootstrapped: true,
    issues: approval.status === 'STALE' ? [{ code: 'STALE_APPROVAL', message: 'Artifact changed since last approval' }] : [],
    artifact,
    approvalStatus: approval.status,
  };
}
