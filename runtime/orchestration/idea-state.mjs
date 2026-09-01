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

export function validateApprovalsHistoryStructure(data) {
  if (!data || typeof data !== 'object') {
    throw new IdeaStateError('Approvals history must be an object', 'DK_APPROVALS_CORRUPT');
  }
  if (!Array.isArray(data.approvals)) {
    throw new IdeaStateError('Approvals data is malformed: approvals must be an array', 'DK_APPROVALS_CORRUPT');
  }

  for (const app of data.approvals) {
    if (!app || typeof app !== 'object') {
      throw new IdeaStateError('Approval record must be an object', 'DK_APPROVALS_CORRUPT');
    }
    if (!app.id || !/^APPR-IDEA-\d+-\d+$/i.test(app.id)) {
      throw new IdeaStateError(`Invalid approval ID: ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
    if (!app.artifactFingerprint || !app.artifactFingerprint.startsWith('sha256:')) {
      throw new IdeaStateError(`Invalid approval artifactFingerprint in ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
    if (typeof app.artifactRevision !== 'number' || app.artifactRevision <= 0) {
      throw new IdeaStateError(`Invalid approval artifactRevision in ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
    if (app.approvingAuthority !== 'PRODUCT_OWNER') {
      throw new IdeaStateError(`Unauthorized approvingAuthority ${app.approvingAuthority} in ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
    if (!app.approvedAt || isNaN(Date.parse(app.approvedAt))) {
      throw new IdeaStateError(`Invalid approvedAt timestamp in ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
  }
  return true;
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
    validateApprovalsHistoryStructure(data);
    return data;
  } catch (err) {
    if (err instanceof IdeaStateError) throw err;
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
  
  const reqIssues = [];
  const consumedReqIds = new Set();

  for (const line of mustLines) {
    const cleanLine = line.replace(/^[-*]\s*/, '').trim();
    if (!cleanLine || isCanonicalNone(cleanLine)) continue;

    // Look for explicit candidate tag e.g. [IDEA-REQ-001]
    const tagMatch = cleanLine.match(/\[(IDEA-REQ-\d+)\]/i);
    if (!tagMatch) {
      reqIssues.push({
        code: 'UNBOUND_MUST_REQUIREMENT',
        message: `Must requirement is missing explicit [IDEA-REQ-xxx] tag: "${cleanLine}"`,
      });
      continue;
    }

    const candId = tagMatch[1].toUpperCase();
    if (consumedReqIds.has(candId)) {
      reqIssues.push({
        code: 'DUPLICATE_REQUIREMENT_REFERENCE',
        message: `Candidate ${candId} is bound to multiple Must requirements`,
      });
      continue;
    }
    consumedReqIds.add(candId);

    const matchedCand = discoveryState.requirements.find(r => r.id.toUpperCase() === candId);
    if (!matchedCand) {
      reqIssues.push({
        code: 'UNKNOWN_REQUIREMENT_REFERENCE',
        message: `Must item references unknown candidate ${candId}`,
      });
      continue;
    }

    if (matchedCand.resolutionState === 'REJECTED' || matchedCand.resolutionState === 'SUPERSEDED') {
      reqIssues.push({
        code: 'INVALID_REQUIREMENT_AUTHORITY',
        message: `Must item is bound to rejected/superseded candidate ${matchedCand.id}`,
      });
      continue;
    }

    if (matchedCand.origin === 'RESEARCH_DERIVED' && (matchedCand.resolutionState !== 'ADOPTED' || matchedCand.confirmedBy !== 'PRODUCT_OWNER')) {
      reqIssues.push({
        code: 'UNADOPTED_RESEARCH_REQUIREMENT',
        message: `Research-derived requirement ${matchedCand.id} must be explicitly ADOPTED by PRODUCT_OWNER before entering Must`,
      });
      continue;
    }

    if ((matchedCand.resolutionState !== 'CONFIRMED' && matchedCand.resolutionState !== 'ADOPTED') || matchedCand.confirmedBy !== 'PRODUCT_OWNER') {
      reqIssues.push({
        code: 'UNCONFIRMED_MUST_REQUIREMENT',
        message: `Must item candidate ${matchedCand.id} is not CONFIRMED/ADOPTED by PRODUCT_OWNER`,
      });
      continue;
    }
  }

  // 1-to-1 Open Questions ↔ IDEA-Q Binding Verification
  const qSection = structValidation.sections.openQuestions || '';
  const qLines = qSection.split('\n').map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('*'));
  const consumedQIds = new Set();

  for (const line of qLines) {
    const cleanQ = line.replace(/^[-*]\s*/, '').trim();
    if (!cleanQ || isCanonicalNone(cleanQ)) continue;

    const tagMatch = cleanQ.match(/\[(IDEA-Q-\d+)\]/i);
    if (!tagMatch) {
      reqIssues.push({
        code: 'UNBOUND_OPEN_QUESTION',
        message: `Open question is missing explicit [IDEA-Q-xxx] tag: "${cleanQ}"`,
      });
      continue;
    }

    const qId = tagMatch[1].toUpperCase();
    if (consumedQIds.has(qId)) {
      reqIssues.push({
        code: 'DUPLICATE_QUESTION_REFERENCE',
        message: `Question candidate ${qId} is bound multiple times`,
      });
      continue;
    }
    consumedQIds.add(qId);

    const matchedQ = discoveryState.openQuestions.find(q => q.id.toUpperCase() === qId);
    if (!matchedQ) {
      reqIssues.push({
        code: 'UNKNOWN_QUESTION_REFERENCE',
        message: `Open question references unknown candidate ${qId}`,
      });
      continue;
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
