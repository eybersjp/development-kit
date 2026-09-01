/**
 * Development Kit — Structured Requirements Discovery & Provenance Model
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createPODecision, persistPODecision } from './po-decisions.mjs';

export const DISCOVERY_SCHEMA_VERSION = '1.0.0';

export const REQUIREMENT_ORIGINS = Object.freeze([
  'USER_STATED',
  'USER_CONFIRMED',
  'AI_PROPOSED',
  'RESEARCH_DERIVED',
  'ASSUMED',
]);

export const RESOLUTION_STATES = Object.freeze([
  'UNRESOLVED',
  'CONFIRMED',
  'ADOPTED',
  'DEFERRED',
  'REJECTED',
  'SUPERSEDED',
]);

export const QUESTION_RESOLUTIONS = Object.freeze([
  'UNRESOLVED',
  'ANSWERED',
  'DEFERRED',
  'REJECTED',
  'SUPERSEDED',
]);

export const MATERIALITY_LEVELS = Object.freeze([
  'MATERIAL',
  'NON_MATERIAL',
]);

export class DiscoveryStateError extends Error {
  constructor(message, code = 'DK_DISCOVERY_ERROR', details = null) {
    super(message);
    this.name = 'DiscoveryStateError';
    this.code = code;
    this.details = details;
  }
}

export function computeDiscoveryFingerprint(state) {
  const normalized = {
    requirements: (state.requirements || []).map((r) => ({
      id: r.id,
      statement: r.statement,
      origin: r.origin,
      materiality: r.materiality,
      resolutionState: r.resolutionState,
      confirmedBy: r.confirmedBy,
      linkedPodId: r.linkedPodId || null,
      supersedes: r.supersedes || null,
      supersededBy: r.supersededBy || null,
    })),
    openQuestions: (state.openQuestions || []).map((q) => ({
      id: q.id,
      question: q.question,
      materiality: q.materiality,
      resolution: q.resolution,
      resolvedBy: q.resolvedBy,
      deferredTarget: q.deferredTarget || null,
      supersedes: q.supersedes || null,
      supersededBy: q.supersededBy || null,
    })),
  };
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(normalized), 'utf8').digest('hex')}`;
}

export function getDiscoveryDir(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea');
}

export function getDiscoveryFilePath(rootDir = process.cwd()) {
  return path.join(getDiscoveryDir(rootDir), 'discovery.json');
}

export function validateDiscoveryStateStructure(data) {
  if (!data || typeof data !== 'object') {
    throw new DiscoveryStateError('Discovery state must be an object', 'DK_DISCOVERY_CORRUPT');
  }
  if (data.schemaVersion !== DISCOVERY_SCHEMA_VERSION) {
    throw new DiscoveryStateError(`Invalid discovery schemaVersion: ${data.schemaVersion}`, 'DK_DISCOVERY_CORRUPT');
  }
  if (typeof data.revision !== 'number' || data.revision < 0) {
    throw new DiscoveryStateError('Discovery revision must be a non-negative number', 'DK_DISCOVERY_CORRUPT');
  }
  if (!Array.isArray(data.requirements) || !Array.isArray(data.openQuestions)) {
    throw new DiscoveryStateError('Discovery requirements and openQuestions must be arrays', 'DK_DISCOVERY_CORRUPT');
  }

  const reqIdSet = new Set();
  for (const r of data.requirements) {
    if (!r || typeof r !== 'object') {
      throw new DiscoveryStateError('Requirement entry must be an object', 'DK_DISCOVERY_CORRUPT');
    }
    if (!r.id || !/^IDEA-REQ-\d+$/i.test(r.id)) {
      throw new DiscoveryStateError(`Requirement ID invalid: ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (reqIdSet.has(r.id)) {
      throw new DiscoveryStateError(`Duplicate requirement ID: ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    reqIdSet.add(r.id);

    if (!r.statement || typeof r.statement !== 'string') {
      throw new DiscoveryStateError(`Requirement statement invalid for ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (!REQUIREMENT_ORIGINS.includes(r.origin)) {
      throw new DiscoveryStateError(`Invalid requirement origin ${r.origin} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (!MATERIALITY_LEVELS.includes(r.materiality)) {
      throw new DiscoveryStateError(`Invalid requirement materiality ${r.materiality} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (!RESOLUTION_STATES.includes(r.resolutionState)) {
      throw new DiscoveryStateError(`Invalid resolutionState ${r.resolutionState} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if ((r.resolutionState === 'CONFIRMED' || r.resolutionState === 'ADOPTED') && r.confirmedBy !== 'PRODUCT_OWNER') {
      throw new DiscoveryStateError(`Confirmed/Adopted requirement ${r.id} must be confirmedBy PRODUCT_OWNER (got ${r.confirmedBy})`, 'DK_DISCOVERY_CORRUPT');
    }
    if (r.linkedPodId !== null && r.linkedPodId !== undefined) {
      if (!/^POD-IDEA-REQ-\d+$/i.test(r.linkedPodId)) {
        throw new DiscoveryStateError(`Invalid linkedPodId ${r.linkedPodId} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
    }
    if (r.supersedes !== null && r.supersedes !== undefined) {
      if (!/^IDEA-REQ-\d+$/i.test(r.supersedes) || r.supersedes === r.id) {
        throw new DiscoveryStateError(`Invalid supersedes reference ${r.supersedes} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
    }
    if (r.supersededBy !== null && r.supersededBy !== undefined) {
      if (!/^IDEA-REQ-\d+$/i.test(r.supersededBy) || r.supersededBy === r.id) {
        throw new DiscoveryStateError(`Invalid supersededBy reference ${r.supersededBy} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
    }
    if (r.createdAt && isNaN(Date.parse(r.createdAt))) {
      throw new DiscoveryStateError(`Invalid createdAt timestamp in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (r.updatedAt && isNaN(Date.parse(r.updatedAt))) {
      throw new DiscoveryStateError(`Invalid updatedAt timestamp in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
  }

  const qIdSet = new Set();
  for (const q of data.openQuestions) {
    if (!q || typeof q !== 'object') {
      throw new DiscoveryStateError('Question entry must be an object', 'DK_DISCOVERY_CORRUPT');
    }
    if (!q.id || !/^IDEA-Q-\d+$/i.test(q.id)) {
      throw new DiscoveryStateError(`Question ID invalid: ${q.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (qIdSet.has(q.id)) {
      throw new DiscoveryStateError(`Duplicate question ID: ${q.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    qIdSet.add(q.id);

    if (!q.question || typeof q.question !== 'string') {
      throw new DiscoveryStateError(`Question text invalid for ${q.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (!MATERIALITY_LEVELS.includes(q.materiality)) {
      throw new DiscoveryStateError(`Invalid question materiality ${q.materiality} in ${q.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (!QUESTION_RESOLUTIONS.includes(q.resolution)) {
      throw new DiscoveryStateError(`Invalid question resolution ${q.resolution} in ${q.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (q.materiality === 'MATERIAL' && q.resolution !== 'UNRESOLVED' && q.resolution !== 'SUPERSEDED' && q.resolvedBy !== 'PRODUCT_OWNER') {
      throw new DiscoveryStateError(`Material question ${q.id} disposition ${q.resolution} requires explicit resolvedBy = 'PRODUCT_OWNER'`, 'DK_DISCOVERY_CORRUPT');
    }
    if (q.resolution === 'DEFERRED' && (!q.deferredTarget || typeof q.deferredTarget !== 'string')) {
      throw new DiscoveryStateError(`DEFERRED question ${q.id} requires valid deferredTarget`, 'DK_DISCOVERY_CORRUPT');
    }
    if (q.supersedes !== null && q.supersedes !== undefined) {
      if (!/^IDEA-Q-\d+$/i.test(q.supersedes) || q.supersedes === q.id) {
        throw new DiscoveryStateError(`Invalid supersedes reference ${q.supersedes} in ${q.id}`, 'DK_DISCOVERY_CORRUPT');
      }
    }
    if (q.supersededBy !== null && q.supersededBy !== undefined) {
      if (!/^IDEA-Q-\d+$/i.test(q.supersededBy) || q.supersededBy === q.id) {
        throw new DiscoveryStateError(`Invalid supersededBy reference ${q.supersededBy} in ${q.id}`, 'DK_DISCOVERY_CORRUPT');
      }
    }
    if (q.createdAt && isNaN(Date.parse(q.createdAt))) {
      throw new DiscoveryStateError(`Invalid createdAt timestamp in ${q.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (q.updatedAt && isNaN(Date.parse(q.updatedAt))) {
      throw new DiscoveryStateError(`Invalid updatedAt timestamp in ${q.id}`, 'DK_DISCOVERY_CORRUPT');
    }
  }
  return true;
}

export function loadDiscoveryState(rootDir = process.cwd()) {
  const filePath = getDiscoveryFilePath(rootDir);
  if (!fs.existsSync(filePath)) {
    return {
      schemaVersion: DISCOVERY_SCHEMA_VERSION,
      revision: 0,
      fingerprint: computeDiscoveryFingerprint({ requirements: [], openQuestions: [] }),
      updatedAt: new Date().toISOString(),
      requirements: [],
      openQuestions: [],
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validateDiscoveryStateStructure(data);
    data.fingerprint = computeDiscoveryFingerprint(data);
    return data;
  } catch (err) {
    if (err instanceof DiscoveryStateError) throw err;
    throw new DiscoveryStateError(`Corrupt discovery state: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
  }
}

export function persistDiscoveryState(state, rootDir = process.cwd()) {
  const dir = getDiscoveryDir(rootDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = getDiscoveryFilePath(rootDir);
  const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;
  state.fingerprint = computeDiscoveryFingerprint(state);
  const payload = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
  return payload;
}

export function recordRequirementCandidate(rootDir = process.cwd(), {
  id,
  statement,
  materiality = 'MATERIAL',
  origin,
  resolutionState = 'UNRESOLVED',
  confirmedBy = null,
  supersedes = null,
  supersededBy = null,
  createPod = false,
  podStatement = null,
} = {}) {
  if (!id || !/^IDEA-REQ-\d+$/i.test(id)) {
    throw new DiscoveryStateError(`Invalid candidate requirement ID: ${id}. Must match IDEA-REQ-xxx`, 'DK_INVALID_REQ_ID');
  }
  if (!statement || typeof statement !== 'string' || !statement.trim()) {
    throw new DiscoveryStateError('Requirement statement is required', 'DK_INVALID_STATEMENT');
  }
  if (!origin || !REQUIREMENT_ORIGINS.includes(origin)) {
    throw new DiscoveryStateError(`Explicit valid requirement origin required: ${origin}`, 'DK_INVALID_ORIGIN');
  }
  if (!MATERIALITY_LEVELS.includes(materiality)) {
    throw new DiscoveryStateError(`Invalid materiality level: ${materiality}`, 'DK_INVALID_MATERIALITY');
  }
  if (!RESOLUTION_STATES.includes(resolutionState)) {
    throw new DiscoveryStateError(`Invalid resolutionState: ${resolutionState}`, 'DK_INVALID_RESOLUTION_STATE');
  }

  if (origin === 'RESEARCH_DERIVED' && resolutionState === 'ADOPTED' && confirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError('Research-derived requirement adoption requires explicit confirmedBy = PRODUCT_OWNER', 'DK_UNAUTHORIZED_ADOPTION');
  }

  if (origin === 'AI_PROPOSED' && resolutionState === 'CONFIRMED' && confirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError('AI-proposed requirement confirmation requires explicit confirmedBy = PRODUCT_OWNER', 'DK_UNAUTHORIZED_CONFIRMATION');
  }

  if (origin === 'ASSUMED' && resolutionState === 'CONFIRMED' && confirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError('Assumed requirement confirmation requires explicit confirmedBy = PRODUCT_OWNER', 'DK_UNAUTHORIZED_CONFIRMATION');
  }

  if ((resolutionState === 'CONFIRMED' || resolutionState === 'ADOPTED') && confirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(`Confirmed/Adopted requirement requires explicit confirmedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_CONFIRMATION');
  }

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.requirements.findIndex((r) => r.id === id);

  if (existingIdx >= 0) {
    const existing = state.requirements[existingIdx];
    // Enforce full identity immutability on existing candidates
    if (existing.origin !== origin) {
      throw new DiscoveryStateError(
        `Requirement provenance origin is immutable for ${id} (existing: ${existing.origin}, attempted: ${origin})`,
        'DK_PROVENANCE_IMMUTABLE'
      );
    }
    if (existing.statement.trim() !== statement.trim()) {
      throw new DiscoveryStateError(
        `Requirement statement is immutable for ${id}. Use supersedeRequirementCandidate to alter statement.`,
        'DK_STATEMENT_IMMUTABLE'
      );
    }
    if (existing.materiality !== materiality) {
      throw new DiscoveryStateError(
        `Requirement materiality is immutable for ${id}. Use supersedeRequirementCandidate to reclassify.`,
        'DK_MATERIALITY_IMMUTABLE'
      );
    }
  }

  let linkedPodId = null;

  if (createPod && (resolutionState === 'CONFIRMED' || resolutionState === 'ADOPTED') && confirmedBy === 'PRODUCT_OWNER') {
    const podId = `POD-${id}`;
    const pod = createPODecision({
      id: podId,
      statement: podStatement || statement,
      status: 'APPROVED',
      provenance: 'product-owner',
      affectedRequirements: [id],
    });
    persistPODecision(pod, rootDir);
    linkedPodId = podId;
  }

  const reqObj = {
    id,
    statement: statement.trim(),
    materiality,
    origin,
    resolutionState,
    confirmedBy: (resolutionState === 'CONFIRMED' || resolutionState === 'ADOPTED') ? confirmedBy : null,
    linkedPodId: linkedPodId || (existingIdx >= 0 ? state.requirements[existingIdx].linkedPodId : null),
    supersedes: supersedes || (existingIdx >= 0 ? state.requirements[existingIdx].supersedes : null),
    supersededBy: supersededBy || (existingIdx >= 0 ? state.requirements[existingIdx].supersededBy : null),
    createdAt: existingIdx >= 0 ? state.requirements[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    state.requirements[existingIdx] = reqObj;
  } else {
    state.requirements.push(reqObj);
  }

  state.revision = (state.revision || 0) + 1;
  persistDiscoveryState(state, rootDir);
  return reqObj;
}

export function supersedeRequirementCandidate(rootDir = process.cwd(), oldId, newCandidateData = {}) {
  const state = loadDiscoveryState(rootDir);
  const oldIdx = state.requirements.findIndex((r) => r.id === oldId);
  if (oldIdx < 0) {
    throw new DiscoveryStateError(`Cannot supersede: candidate ${oldId} does not exist`, 'DK_CANDIDATE_NOT_FOUND');
  }

  const oldReq = state.requirements[oldIdx];
  if (oldReq.resolutionState === 'SUPERSEDED') {
    throw new DiscoveryStateError(`Candidate ${oldId} is already superseded`, 'DK_ALREADY_SUPERSEDED');
  }

  const newId = newCandidateData.id;
  if (!newId || !/^IDEA-REQ-\d+$/i.test(newId)) {
    throw new DiscoveryStateError(`Invalid new candidate ID: ${newId}`, 'DK_INVALID_REQ_ID');
  }
  if (newId === oldId) {
    throw new DiscoveryStateError('New candidate ID must differ from old candidate ID for supersession', 'DK_INVALID_SUPERSEDED_ID');
  }
  if (state.requirements.some((r) => r.id === newId)) {
    throw new DiscoveryStateError(`Candidate with ID ${newId} already exists`, 'DK_CANDIDATE_EXISTS');
  }

  // Atomically update old candidate
  oldReq.resolutionState = 'SUPERSEDED';
  oldReq.supersededBy = newId;
  oldReq.updatedAt = new Date().toISOString();

  // Create new candidate with supersedes link
  const newStatement = newCandidateData.statement || oldReq.statement;
  const newOrigin = newCandidateData.origin || oldReq.origin;
  const newMateriality = newCandidateData.materiality || oldReq.materiality;
  const newResolution = newCandidateData.resolutionState || 'UNRESOLVED';
  const newConfirmedBy = newCandidateData.confirmedBy || null;

  const newReq = {
    id: newId,
    statement: newStatement.trim(),
    materiality: newMateriality,
    origin: newOrigin,
    resolutionState: newResolution,
    confirmedBy: (newResolution === 'CONFIRMED' || newResolution === 'ADOPTED') ? newConfirmedBy : null,
    linkedPodId: null,
    supersedes: oldId,
    supersededBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.requirements.push(newReq);
  state.revision = (state.revision || 0) + 1;
  persistDiscoveryState(state, rootDir);

  return {
    superseded: oldReq,
    created: newReq,
  };
}

export function recordOpenQuestion(rootDir = process.cwd(), {
  id,
  question,
  materiality = 'MATERIAL',
  resolution = 'UNRESOLVED',
  deferredTarget = null,
  resolvedBy = null,
  notes = null,
  supersedes = null,
  supersededBy = null,
} = {}) {
  if (!id || !/^IDEA-Q-\d+$/i.test(id)) {
    throw new DiscoveryStateError(`Invalid question ID: ${id}. Must match IDEA-Q-xxx`, 'DK_INVALID_QUESTION_ID');
  }
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new DiscoveryStateError('Question text is required', 'DK_INVALID_QUESTION');
  }
  if (!MATERIALITY_LEVELS.includes(materiality)) {
    throw new DiscoveryStateError(`Invalid materiality level: ${materiality}`, 'DK_INVALID_MATERIALITY');
  }
  if (!QUESTION_RESOLUTIONS.includes(resolution)) {
    throw new DiscoveryStateError(`Invalid question resolution: ${resolution}`, 'DK_INVALID_QUESTION_RESOLUTION');
  }

  if (materiality === 'MATERIAL' && resolution !== 'UNRESOLVED' && resolution !== 'SUPERSEDED' && resolvedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(`Material question ${resolution} resolution requires explicit resolvedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_RESOLUTION');
  }

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.openQuestions.findIndex((q) => q.id === id);

  if (existingIdx >= 0) {
    const existing = state.openQuestions[existingIdx];
    if (existing.question.trim() !== question.trim()) {
      throw new DiscoveryStateError(
        `Question text is immutable for ${id}. Use supersedeOpenQuestion to alter question text.`,
        'DK_QUESTION_IMMUTABLE'
      );
    }
    if (existing.materiality !== materiality) {
      throw new DiscoveryStateError(
        `Question materiality is immutable for ${id}. Use supersedeOpenQuestion to reclassify.`,
        'DK_MATERIALITY_IMMUTABLE'
      );
    }
  }

  const qObj = {
    id,
    question: question.trim(),
    materiality,
    resolution,
    deferredTarget: resolution === 'DEFERRED' ? (deferredTarget || 'Future Ideas (Explicitly Deferred)') : null,
    resolvedBy: resolution !== 'UNRESOLVED' && resolution !== 'SUPERSEDED' ? resolvedBy : null,
    notes,
    supersedes: supersedes || (existingIdx >= 0 ? state.openQuestions[existingIdx].supersedes : null),
    supersededBy: supersededBy || (existingIdx >= 0 ? state.openQuestions[existingIdx].supersededBy : null),
    createdAt: existingIdx >= 0 ? state.openQuestions[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    state.openQuestions[existingIdx] = qObj;
  } else {
    state.openQuestions.push(qObj);
  }

  state.revision = (state.revision || 0) + 1;
  persistDiscoveryState(state, rootDir);
  return qObj;
}

export function supersedeOpenQuestion(rootDir = process.cwd(), oldId, newQuestionData = {}) {
  const state = loadDiscoveryState(rootDir);
  const oldIdx = state.openQuestions.findIndex((q) => q.id === oldId);
  if (oldIdx < 0) {
    throw new DiscoveryStateError(`Cannot supersede: question ${oldId} does not exist`, 'DK_QUESTION_NOT_FOUND');
  }

  const oldQ = state.openQuestions[oldIdx];
  if (oldQ.resolution === 'SUPERSEDED') {
    throw new DiscoveryStateError(`Question ${oldId} is already superseded`, 'DK_ALREADY_SUPERSEDED');
  }

  const newId = newQuestionData.id;
  if (!newId || !/^IDEA-Q-\d+$/i.test(newId)) {
    throw new DiscoveryStateError(`Invalid new question ID: ${newId}`, 'DK_INVALID_QUESTION_ID');
  }
  if (newId === oldId) {
    throw new DiscoveryStateError('New question ID must differ from old question ID for supersession', 'DK_INVALID_SUPERSEDED_ID');
  }
  if (state.openQuestions.some((q) => q.id === newId)) {
    throw new DiscoveryStateError(`Question with ID ${newId} already exists`, 'DK_QUESTION_EXISTS');
  }

  oldQ.resolution = 'SUPERSEDED';
  oldQ.supersededBy = newId;
  oldQ.updatedAt = new Date().toISOString();

  const newQuestion = newQuestionData.question || oldQ.question;
  const newMateriality = newQuestionData.materiality || oldQ.materiality;
  const newResolution = newQuestionData.resolution || 'UNRESOLVED';
  const newResolvedBy = newQuestionData.resolvedBy || null;

  const newQ = {
    id: newId,
    question: newQuestion.trim(),
    materiality: newMateriality,
    resolution: newResolution,
    deferredTarget: newResolution === 'DEFERRED' ? (newQuestionData.deferredTarget || 'Future Ideas (Explicitly Deferred)') : null,
    resolvedBy: newResolution !== 'UNRESOLVED' && newResolution !== 'SUPERSEDED' ? newResolvedBy : null,
    notes: newQuestionData.notes || null,
    supersedes: oldId,
    supersededBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.openQuestions.push(newQ);
  state.revision = (state.revision || 0) + 1;
  persistDiscoveryState(state, rootDir);

  return {
    superseded: oldQ,
    created: newQ,
  };
}

export function evaluateDiscoveryReadiness(rootDir = process.cwd()) {
  const state = loadDiscoveryState(rootDir);
  const blockers = [];

  for (const req of state.requirements) {
    if (req.materiality === 'MATERIAL') {
      if (req.origin === 'USER_STATED' || req.origin === 'USER_CONFIRMED') {
        if (req.resolutionState !== 'CONFIRMED' && req.resolutionState !== 'ADOPTED') {
          blockers.push({
            code: 'UNCONFIRMED_USER_REQUIREMENT',
            id: req.id,
            statement: req.statement,
            message: `User requirement ${req.id} requires confirmation`,
          });
        }
      }
      if (req.origin === 'AI_PROPOSED' && (req.resolutionState !== 'CONFIRMED' || req.confirmedBy !== 'PRODUCT_OWNER')) {
        blockers.push({
          code: 'UNCONFIRMED_AI_PROPOSAL',
          id: req.id,
          statement: req.statement,
          message: `AI-proposed requirement ${req.id} requires explicit PO confirmation before approval`,
        });
      }
      if (req.origin === 'ASSUMED' && (req.resolutionState !== 'CONFIRMED' || req.confirmedBy !== 'PRODUCT_OWNER')) {
        blockers.push({
          code: 'UNCONFIRMED_ASSUMPTION',
          id: req.id,
          statement: req.statement,
          message: `Assumed requirement ${req.id} requires explicit PO confirmation before approval`,
        });
      }
      if (req.origin === 'RESEARCH_DERIVED' && (req.resolutionState !== 'ADOPTED' || req.confirmedBy !== 'PRODUCT_OWNER')) {
        blockers.push({
          code: 'UNADOPTED_RESEARCH_REQUIREMENT',
          id: req.id,
          statement: req.statement,
          message: `Research-derived requirement ${req.id} requires explicit Product Owner adoption before approval`,
        });
      }
    }
  }

  for (const q of state.openQuestions) {
    if (q.materiality === 'MATERIAL') {
      if (q.resolution === 'UNRESOLVED' || !q.resolution) {
        blockers.push({
          code: 'UNRESOLVED_MATERIAL_QUESTION',
          id: q.id,
          question: q.question,
          message: `Material open question ${q.id} must be answered or explicitly deferred before approval`,
        });
      }
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    requirementCount: state.requirements.length,
    questionCount: state.openQuestions.length,
    revision: state.revision || 0,
    fingerprint: state.fingerprint || computeDiscoveryFingerprint(state),
  };
}
