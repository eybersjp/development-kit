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
  'RECONCILIATION_REQUIRED',
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
  if (data.schemaVersion !== '1.0.0') {
    throw new IdeaStateError(`Invalid approvals schemaVersion: ${data.schemaVersion}`, 'DK_APPROVALS_CORRUPT');
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
    if (!app.artifactFingerprint || !/^sha256:[a-f0-9]{64}$/i.test(app.artifactFingerprint)) {
      throw new IdeaStateError(`Invalid approval artifactFingerprint (must be sha256:<64 hex>) in ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
    if (typeof app.artifactRevision !== 'number' || !Number.isInteger(app.artifactRevision) || app.artifactRevision <= 0) {
      throw new IdeaStateError(`Invalid approval artifactRevision in ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
    if (typeof app.discoveryRevision !== 'number' || !Number.isInteger(app.discoveryRevision) || app.discoveryRevision < 0) {
      throw new IdeaStateError(`Invalid approval discoveryRevision in ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
    if (!app.discoveryFingerprint || !/^sha256:[a-f0-9]{64}$/i.test(app.discoveryFingerprint)) {
      throw new IdeaStateError(`Invalid approval discoveryFingerprint in ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
    if (app.approvingAuthority !== 'PRODUCT_OWNER') {
      throw new IdeaStateError(`Unauthorized approvingAuthority ${app.approvingAuthority} in ${app.id}`, 'DK_APPROVALS_CORRUPT');
    }
    if (!Array.isArray(app.linkedPodIds)) {
      throw new IdeaStateError(`Invalid linkedPodIds in ${app.id}: must be an array`, 'DK_APPROVALS_CORRUPT');
    }
    for (const podId of app.linkedPodIds) {
      if (!podId || !/^POD-IDEA-REQ-\d+$/i.test(podId)) {
        throw new IdeaStateError(`Invalid linked POD ID ${podId} in ${app.id}`, 'DK_APPROVALS_CORRUPT');
      }
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
  discoveryRevision,
  discoveryFingerprint,
  approvingAuthority,
  linkedPodIds = [],
} = {}) {
  if (!artifactFingerprint || !/^sha256:[a-f0-9]{64}$/i.test(artifactFingerprint)) {
    throw new IdeaStateError('artifactFingerprint must be a valid sha256:<64 hex> string', 'DK_INVALID_APPROVAL_PARAMS');
  }
  if (!artifactRevision || typeof artifactRevision !== 'number' || !Number.isInteger(artifactRevision) || artifactRevision <= 0) {
    throw new IdeaStateError('artifactRevision must be a positive integer', 'DK_INVALID_APPROVAL_PARAMS');
  }
  if (typeof discoveryRevision !== 'number' || !Number.isInteger(discoveryRevision) || discoveryRevision < 0) {
    throw new IdeaStateError('discoveryRevision must be a non-negative integer', 'DK_INVALID_APPROVAL_PARAMS');
  }
  if (!discoveryFingerprint || !/^sha256:[a-f0-9]{64}$/i.test(discoveryFingerprint)) {
    throw new IdeaStateError('discoveryFingerprint must be a valid sha256:<64 hex> string', 'DK_INVALID_APPROVAL_PARAMS');
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
    discoveryRevision,
    discoveryFingerprint,
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

export function computeEffectiveApprovalStatus(
  rootDir = process.cwd(),
  currentArtifactFingerprint,
  currentArtifactRevision,
  currentDiscoveryFingerprint,
  currentDiscoveryRevision
) {
  const history = loadApprovalsHistory(rootDir);
  if (!history.approvals || history.approvals.length === 0) {
    return { status: 'NONE', latestApproval: null };
  }

  const latest = history.approvals[history.approvals.length - 1];
  // 4-Tuple approval match required for CURRENT
  if (
    latest.artifactFingerprint === currentArtifactFingerprint &&
    latest.artifactRevision === currentArtifactRevision &&
    latest.discoveryFingerprint === currentDiscoveryFingerprint &&
    latest.discoveryRevision === currentDiscoveryRevision
  ) {
    return { status: 'CURRENT', latestApproval: latest };
  }

  return { status: 'STALE', latestApproval: latest };
}

export function approveCurrentIdeaBrief(rootDir = process.cwd(), options = {}) {
  const {
    approvingAuthority,
    linkedPodIds = [],
  } = (options && typeof options === 'object') ? options : {};

  // Reject missing or non-PRODUCT_OWNER authority before any side effects
  if (approvingAuthority !== 'PRODUCT_OWNER') {
    throw new IdeaStateError(
      `Explicit approvingAuthority = 'PRODUCT_OWNER' is required. Got: ${JSON.stringify(approvingAuthority)}`,
      'DK_UNAUTHORIZED_APPROVAL'
    );
  }

  const preState = computeIdeaStageState(rootDir);
  if (preState.state !== 'READY_FOR_APPROVAL') {
    throw new IdeaStateError(
      `Cannot approve Idea Brief: current state is ${preState.state} (must be READY_FOR_APPROVAL)`,
      'DK_INVALID_APPROVAL_STATE',
      { preState }
    );
  }

  const resolved = resolveCanonicalIdeaArtifact(rootDir, { verifyFingerprint: true });
  const disc = loadDiscoveryState(rootDir);

  const approval = persistApprovalRecord(rootDir, {
    artifactFingerprint: resolved.fingerprint,
    artifactRevision: resolved.revision,
    discoveryFingerprint: disc.fingerprint,
    discoveryRevision: disc.revision,
    approvingAuthority,
    linkedPodIds,
  });

  const postState = computeIdeaStageState(rootDir);
  if (postState.state !== 'APPROVED') {
    throw new IdeaStateError(
      `Approval recorded but stage state failed to transition to APPROVED (got ${postState.state})`,
      'DK_APPROVAL_TRANSITION_FAILED',
      { postState }
    );
  }

  return {
    approval,
    state: postState,
  };
}

export function normalizeStatementText(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/[\r\n\t]/g, ' ').replace(/[.,;:!?]/g, '').replace(/\s+/g, ' ').trim();
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
    if (err.code === 'DK_ARTIFACT_AUTHORITY_CONFLICT' || err.code === 'DK_ARTIFACT_FINGERPRINT_MISMATCH' || err.code === 'DK_ARTIFACT_REGISTRY_CORRUPT' || err.code === 'DK_ARTIFACT_MISSING') {
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
  const artifactExists = fs.existsSync(artifact.absolutePath);

  if (!artifact.registered && !hasDiscovery && !artifactExists) {
    return {
      state: 'NOT_STARTED',
      bootstrapped: true,
      issues: [],
    };
  }

  if (!artifact.registered && hasDiscovery && !artifactExists) {
    return {
      state: 'DISCOVERY_IN_PROGRESS',
      bootstrapped: true,
      issues: [{ code: 'ARTIFACT_UNREGISTERED', message: 'Discovery is underway but canonical idea-brief.md is not yet written' }],
    };
  }

  if (!artifact.registered && artifactExists) {
    return {
      state: 'RECONCILIATION_REQUIRED',
      bootstrapped: true,
      issues: [{
        code: 'DISCOVERY_BINDING_REQUIRED',
        message: 'Unregistered Idea Brief exists on disk. An explicit idea-persist / reconciliation is required to register and bind to discovery.',
      }],
      artifact,
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

  // Unbound / Legacy Artifacts Check: Must have a valid discovery binding
  if (artifact.discoveryRevision === null || artifact.discoveryRevision === undefined || !artifact.discoveryFingerprint) {
    return {
      state: 'RECONCILIATION_REQUIRED',
      bootstrapped: true,
      issues: [{
        code: 'DISCOVERY_BINDING_REQUIRED',
        message: 'Idea Brief is not bound to a discovery revision/fingerprint. An explicit idea-persist / reconciliation is required before approval eligibility.',
      }],
      artifact,
    };
  }

  // 1-to-1 MUST Requirements ↔ IDEA-REQ Binding & Content Verification
  const reqIssues = [];
  const consumedReqIds = new Set();
  const parsedMustItems = structValidation.parsedMustItems || [];

  for (const item of parsedMustItems) {
    const candId = item.id;
    const statementText = item.statement;

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

    // Exact normalized statement equality required
    const normLine = normalizeStatementText(statementText);
    const normCand = normalizeStatementText(matchedCand.statement);
    if (normLine !== normCand) {
      reqIssues.push({
        code: 'REQUIREMENT_CONTENT_MISMATCH',
        message: `Must item ${candId} statement does not match discovery candidate statement. Expected: "${matchedCand.statement}", found: "${statementText}"`,
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

    if (matchedCand.scopeDisposition && matchedCand.scopeDisposition !== 'MUST') {
      reqIssues.push({
        code: 'NON_MUST_SCOPE_IN_MUST_SECTION',
        message: `Requirement ${matchedCand.id} has scopeDisposition ${matchedCand.scopeDisposition} and cannot be listed in Requirements (Must)`,
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

  // Bidirectional Check: Every active candidate with scopeDisposition === 'MUST' must appear in Requirements (Must)
  for (const r of discoveryState.requirements) {
    if (r.resolutionState !== 'SUPERSEDED' && r.resolutionState !== 'REJECTED') {
      const isMust = (r.scopeDisposition === 'MUST' || !r.scopeDisposition);
      if (isMust && !consumedReqIds.has(r.id.toUpperCase())) {
        reqIssues.push({
          code: 'MISSING_MUST_REQUIREMENT',
          message: `Active discovery requirement ${r.id} is classified as MUST but missing from Requirements (Must) in Idea Brief`,
          id: r.id,
        });
      }
    }
  }

  // 1-to-1 Open Questions ↔ IDEA-Q Binding & Content Verification
  const parsedOpenQuestions = structValidation.parsedOpenQuestions || [];
  const consumedQIds = new Set();

  for (const item of parsedOpenQuestions) {
    const qId = item.id;
    const qText = item.question;

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

    // Exact normalized question equality required
    const normQLine = normalizeStatementText(qText);
    const normQCand = normalizeStatementText(matchedQ.question);
    if (normQLine !== normQCand) {
      reqIssues.push({
        code: 'QUESTION_CONTENT_MISMATCH',
        message: `Open question ${qId} text does not match discovery question text. Expected: "${matchedQ.question}", found: "${qText}"`,
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

  // Unbound / Legacy Artifacts Check: Must have a valid discovery binding
  if (artifact.discoveryRevision === null || artifact.discoveryRevision === undefined || !artifact.discoveryFingerprint) {
    return {
      state: 'RECONCILIATION_REQUIRED',
      bootstrapped: true,
      issues: [{
        code: 'DISCOVERY_BINDING_REQUIRED',
        message: 'Idea Brief is not bound to a discovery revision/fingerprint. An explicit idea-persist / reconciliation is required before approval eligibility.',
      }],
      artifact,
    };
  }

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
    approval = computeEffectiveApprovalStatus(
      rootDir,
      artifact.fingerprint,
      artifact.revision,
      discoveryState.fingerprint,
      discoveryState.revision
    );
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
    issues: approval.status === 'STALE' ? [{ code: 'STALE_APPROVAL', message: 'Artifact or discovery changed since last approval' }] : [],
    artifact,
    approvalStatus: approval.status,
  };
}
