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
  'REJECTED',
  'SUPERSEDED',
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
  'REJECTED'
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
    })),
    openQuestions: (state.openQuestions || []).map((q) => ({
      id: q.id,
      question: q.question,
      materiality: q.materiality,
      resolution: q.resolution,
      resolvedBy: q.resolvedBy,
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
    if (!Array.isArray(data.requirements) || !Array.isArray(data.openQuestions)) {
      throw new Error('Discovery state structure invalid');
    }
    data.fingerprint = computeDiscoveryFingerprint(data);
    return data;
  } catch (err) {
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
  if (!RESOLUTION_STATES.includes(resolutionState)) {
    throw new DiscoveryStateError(`Invalid resolutionState: ${resolutionState}`, 'DK_INVALID_RESOLUTION_STATE');
  }

  if (origin === 'RESEARCH_DERIVED') {
    if (resolutionState === 'ADOPTED' && confirmedBy !== 'PRODUCT_OWNER') {
      throw new DiscoveryStateError('RESEARCH_DERIVED cannot be ADOPTED without explicit confirmedBy = PRODUCT_OWNER', 'DK_UNAUTHORIZED_ADOPTION');
    }
  }
  if (origin === 'AI_PROPOSED' || origin === 'ASSUMED') {
    if (resolutionState === 'CONFIRMED' && confirmedBy !== 'PRODUCT_OWNER') {
      throw new DiscoveryStateError(`${origin} requirement cannot be CONFIRMED without explicit confirmedBy = PRODUCT_OWNER`, 'DK_UNAUTHORIZED_CONFIRMATION');
    }
  }

  const state = loadDiscoveryState(rootDir);
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

  const existingIdx = state.requirements.findIndex((r) => r.id === id);
  const reqObj = {
    id,
    statement: statement.trim(),
    materiality,
    origin,
    resolutionState,
    confirmedBy: (resolutionState === 'CONFIRMED' || resolutionState === 'ADOPTED') ? confirmedBy : null,
    linkedPodId,
    supersedes: null,
    supersededBy: null,
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

export function recordOpenQuestion(rootDir = process.cwd(), {
  id,
  question,
  materiality = 'MATERIAL',
  resolution = 'UNRESOLVED',
  deferredTarget = null,
  resolvedBy = null,
  notes = null,
} = {}) {
  if (!id || !/^IDEA-Q-\d+$/i.test(id)) {
    throw new DiscoveryStateError(`Invalid question ID: ${id}. Must match IDEA-Q-xxx`, 'DK_INVALID_QUESTION_ID');
  }
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new DiscoveryStateError('Question text is required', 'DK_INVALID_QUESTION');
  }
  if (!QUESTION_RESOLUTIONS.includes(resolution)) {
    throw new DiscoveryStateError(`Invalid question resolution: ${resolution}`, 'DK_INVALID_QUESTION_RESOLUTION');
  }

  if (resolution === 'ANSWERED' && !resolvedBy) {
    throw new DiscoveryStateError('ANSWERED question requires explicit resolvedBy authority', 'DK_UNAUTHORIZED_RESOLUTION');
  }

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.openQuestions.findIndex((q) => q.id === id);
  const qObj = {
    id,
    question: question.trim(),
    materiality,
    resolution,
    deferredTarget: resolution === 'DEFERRED' ? (deferredTarget || 'Future Ideas (Explicitly Deferred)') : null,
    resolvedBy: resolution !== 'UNRESOLVED' ? (resolvedBy || 'PRODUCT_OWNER') : null,
    notes,
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
