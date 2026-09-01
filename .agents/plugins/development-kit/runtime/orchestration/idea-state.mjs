/**
 * Development Kit — Deterministic IDEA Stage State Machine & Approval Engine
 */
import fs from 'node:fs';
import path from 'node:path';
import { getProjectBootstrapStatus } from '../bootstrap/project-bootstrap.mjs';
import { resolveCanonicalIdeaArtifact, computeSha256 } from '../artifacts/artifact-registry.mjs';
import { validateIdeaBriefStructure, isCanonicalNone } from './idea-schema.mjs';
import { loadDiscoveryState, evaluateDiscoveryReadiness } from './idea-discovery.mjs';

export const IDEA_STAGE_STATES = Object.freeze([
  'NOT_STARTED',
  'DISCOVERY_IN_PROGRESS',
  'DRAFT_READY',
  'READY_FOR_APPROVAL',
  'APPROVED',
  'BLOCKED',
]);

export class IdeaStateError extends Error {
  constructor(message, code = 'DK_IDEA_STATE_ERROR', details = null) {
    super(message);
    this.name = 'IdeaStateError';
    this.code = code;
    this.details = details;
  }
}

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
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data.approvals)) {
      throw new Error('Approvals data is malformed');
    }
    return data;
  } catch (err) {
    throw new IdeaStateError(`Corrupt approvals history: ${err.message}`, 'DK_APPROVALS_CORRUPT');
  }
}

export function persistApprovalRecord(rootDir = process.cwd(), {
  artifactFingerprint,
  artifactRevision,
  approvingAuthority,
  linkedPodIds = [],
} = {}) {
  if (!artifactFingerprint || !artifactRevision) {
    throw new IdeaStateError('artifactFingerprint and artifactRevision are required for approval', 'DK_INVALID_APPROVAL_PARAMS');
  }
  if (approvingAuthority !== 'PRODUCT_OWNER') {
    throw new IdeaStateError(`Explicit approvingAuthority = 'PRODUCT_OWNER' required. Got: ${approvingAuthority}`, 'DK_UNAUTHORIZED_APPROVAL');
  }

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
    artifact = resolveCanonicalIdeaArtifact(rootDir, { verifyFingerprint: true });
  } catch (err) {
    if (err.code === 'DK_ARTIFACT_AUTHORITY_CONFLICT' || err.code === 'DK_ARTIFACT_FINGERPRINT_MISMATCH' || err.code === 'DK_ARTIFACT_REGISTRY_CORRUPT') {
      return {
        state: 'BLOCKED',
        blockerType: 'RUNTIME_FRAMEWORK',
        bootstrapped: true,
        issues: [{ code: err.code, message: err.message, details: err.details }],
      };
    }
    throw err;
  }

  let discoveryState;
  try {
    discoveryState = loadDiscoveryState(rootDir);
  } catch (err) {
    return {
      state: 'BLOCKED',
      blockerType: 'RUNTIME_FRAMEWORK',
      bootstrapped: true,
      issues: [{ code: err.code, message: err.message }],
    };
  }

  try {
    loadApprovalsHistory(rootDir);
  } catch (err) {
    return {
      state: 'BLOCKED',
      blockerType: 'RUNTIME_FRAMEWORK',
      bootstrapped: true,
      issues: [{ code: err.code, message: err.message }],
    };
  }

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

  // 1-to-1 MUST Requirements ↔ IDEA-REQ Binding Verification
  const mustSection = structValidation.sections.requirementsMust || '';
  const mustLines = mustSection.split('\n').map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('*'));
  
  const activeDiscoveryReqs = discoveryState.requirements.filter(r => r.resolutionState !== 'REJECTED' && r.resolutionState !== 'SUPERSEDED');
  const reqIssues = [];

  for (const line of mustLines) {
    const cleanLine = line.replace(/^[-*]\s*/, '').trim();
    if (!cleanLine || isCanonicalNone(cleanLine)) continue;

    // Look for explicit candidate tag e.g. [IDEA-REQ-001] or search by matching statement/id
    const tagMatch = cleanLine.match(/\[(IDEA-REQ-\d+)\]/i);
    let matchedCand = null;

    if (tagMatch) {
      const candId = tagMatch[1].toUpperCase();
      matchedCand = discoveryState.requirements.find(r => r.id.toUpperCase() === candId);
      if (!matchedCand) {
        reqIssues.push({ code: 'UNKNOWN_REQUIREMENT_REFERENCE', message: `Must item references unknown candidate ${candId}` });
        continue;
      }
    } else {
      matchedCand = activeDiscoveryReqs.find(r => cleanLine.includes(r.statement) || r.statement.includes(cleanLine));
    }

    if (!matchedCand) {
      reqIssues.push({ code: 'UNBOUND_MUST_REQUIREMENT', message: `Must requirement has no active discovery candidate: "${cleanLine}"` });
      continue;
    }

    if (matchedCand.resolutionState === 'REJECTED' || matchedCand.resolutionState === 'SUPERSEDED') {
      reqIssues.push({ code: 'INVALID_REQUIREMENT_AUTHORITY', message: `Must item is bound to rejected/superseded candidate ${matchedCand.id}` });
      continue;
    }
  }

  if (mustLines.length > 0 && activeDiscoveryReqs.length < mustLines.length) {
    reqIssues.push({ code: 'INSUFFICIENT_DISCOVERY_CANDIDATES', message: `Idea Brief has ${mustLines.length} Must requirements but discovery only has ${activeDiscoveryReqs.length} active candidates` });
  }

  // 1-to-1 Open Questions ↔ IDEA-Q Binding Verification
  const qSection = structValidation.sections.openQuestions || '';
  const qLines = qSection.split('\n').map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('*'));
  for (const line of qLines) {
    const cleanQ = line.replace(/^[-*]\s*/, '').trim();
    if (!cleanQ || isCanonicalNone(cleanQ)) continue;

    const tagMatch = cleanQ.match(/\[(IDEA-Q-\d+)\]/i);
    let matchedQ = null;
    if (tagMatch) {
      const qId = tagMatch[1].toUpperCase();
      matchedQ = discoveryState.openQuestions.find(q => q.id.toUpperCase() === qId);
      if (!matchedQ) {
        reqIssues.push({ code: 'UNKNOWN_QUESTION_REFERENCE', message: `Open question references unknown candidate ${qId}` });
        continue;
      }
    } else {
      matchedQ = discoveryState.openQuestions.find(q => cleanQ.includes(q.question) || q.question.includes(cleanQ));
    }

    if (!matchedQ) {
      reqIssues.push({ code: 'UNBOUND_OPEN_QUESTION', message: `Open question has no structured discovery record: "${cleanQ}"` });
    }
  }

  if (reqIssues.length > 0) {
    return {
      state: 'DISCOVERY_IN_PROGRESS',
      bootstrapped: true,
      issues: reqIssues,
      artifact,
    };
  }

  if (artifact.discoveryRevision !== null && artifact.discoveryRevision !== undefined) {
    if (discoveryState.revision !== artifact.discoveryRevision || (artifact.discoveryFingerprint && discoveryState.fingerprint !== artifact.discoveryFingerprint)) {
      return {
        state: 'DRAFT_READY',
        bootstrapped: true,
        issues: [{
          code: 'DISCOVERY_REVISION_MISMATCH',
          message: `Discovery state has changed (rev ${discoveryState.revision}) since Idea Brief was persisted (rev ${artifact.discoveryRevision})`,
        }],
        artifact,
      };
    }
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

  let approval;
  try {
    approval = computeEffectiveApprovalStatus(rootDir, artifact.fingerprint, artifact.revision);
  } catch (err) {
    return {
      state: 'BLOCKED',
      blockerType: 'RUNTIME_FRAMEWORK',
      bootstrapped: true,
      issues: [{ code: err.code, message: err.message }],
    };
  }

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
