/**
 * Development Kit — Structured Requirements Discovery & Provenance Model
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  createPODecision,
  persistPODecision,
  loadPODecisionById,
  validatePODecision,
} from './po-decisions.mjs';

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

export const LEGAL_REQUIREMENT_TRANSITIONS = Object.freeze({
  UNRESOLVED: Object.freeze(['CONFIRMED', 'ADOPTED', 'DEFERRED', 'REJECTED', 'SUPERSEDED']),
  CONFIRMED: Object.freeze(['REJECTED', 'SUPERSEDED']),
  ADOPTED: Object.freeze(['REJECTED', 'SUPERSEDED']),
  DEFERRED: Object.freeze(['REJECTED', 'SUPERSEDED']),
  REJECTED: Object.freeze([]),
  SUPERSEDED: Object.freeze([]),
});

export function isValidRequirementTransition(fromState, toState) {
  if (fromState === toState) return true;
  const allowed = LEGAL_REQUIREMENT_TRANSITIONS[fromState];
  return Array.isArray(allowed) && allowed.includes(toState);
}

export const QUESTION_RESOLUTIONS = Object.freeze([
  'UNRESOLVED',
  'ANSWERED',
  'DEFERRED',
  'REJECTED',
  'SUPERSEDED',
]);

export const LEGAL_QUESTION_TRANSITIONS = Object.freeze({
  UNRESOLVED: Object.freeze(['ANSWERED', 'DEFERRED', 'REJECTED', 'SUPERSEDED']),
  ANSWERED: Object.freeze(['REJECTED', 'SUPERSEDED']),
  DEFERRED: Object.freeze(['ANSWERED', 'REJECTED', 'SUPERSEDED']),
  REJECTED: Object.freeze([]),
  SUPERSEDED: Object.freeze([]),
});

export function isValidQuestionTransition(fromState, toState) {
  if (fromState === toState) return true;
  const allowed = LEGAL_QUESTION_TRANSITIONS[fromState];
  return Array.isArray(allowed) && allowed.includes(toState);
}

export const MATERIALITY_LEVELS = Object.freeze([
  'MATERIAL',
  'NON_MATERIAL',
]);

export const SCOPE_DISPOSITIONS = Object.freeze([
  'UNCLASSIFIED',
  'MUST',
  'SHOULD',
  'FUTURE',
  'EXCLUDED',
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
      scopeDisposition: r.scopeDisposition || 'UNCLASSIFIED',
      resolutionState: r.resolutionState,
      confirmedBy: r.confirmedBy,
      linkedPodId: r.linkedPodId || null,
      scopeDecision: r.scopeDecision ? {
        previousDisposition: r.scopeDecision.previousDisposition || null,
        disposition: r.scopeDecision.disposition,
        confirmedBy: r.scopeDecision.confirmedBy,
        decisionId: r.scopeDecision.decisionId || null,
        decidedAt: r.scopeDecision.decidedAt || null,
      } : null,
      deactivationDecision: r.deactivationDecision ? {
        resolutionState: r.deactivationDecision.resolutionState,
        confirmedBy: r.deactivationDecision.confirmedBy,
        decisionId: r.deactivationDecision.decisionId || null,
        decidedAt: r.deactivationDecision.decidedAt || null,
      } : null,
      supersessionDecision: r.supersessionDecision ? {
        supersededBy: r.supersessionDecision.supersededBy,
        confirmedBy: r.supersessionDecision.confirmedBy,
        decisionId: r.supersessionDecision.decisionId || null,
        decidedAt: r.supersessionDecision.decidedAt || null,
      } : null,
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
      supersessionDecision: q.supersessionDecision ? {
        supersededBy: q.supersessionDecision.supersededBy,
        resolvedBy: q.supersessionDecision.resolvedBy,
        decisionId: q.supersessionDecision.decisionId || null,
        decidedAt: q.supersessionDecision.decidedAt || null,
      } : null,
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

  const reqMap = new Map();
  const reqKeySet = new Set();
  for (const r of data.requirements) {
    if (!r || typeof r !== 'object') {
      throw new DiscoveryStateError('Requirement entry must be an object', 'DK_DISCOVERY_CORRUPT');
    }
    if (!r.id || !/^IDEA-REQ-\d+$/i.test(r.id)) {
      throw new DiscoveryStateError(`Requirement ID invalid: ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    const normReqId = r.id.toUpperCase();
    if (reqKeySet.has(normReqId)) {
      throw new DiscoveryStateError(`Duplicate requirement ID (case-insensitive): ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    reqKeySet.add(normReqId);
    reqMap.set(r.id, r);

    if (!r.statement || typeof r.statement !== 'string') {
      throw new DiscoveryStateError(`Requirement statement invalid for ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (!REQUIREMENT_ORIGINS.includes(r.origin)) {
      throw new DiscoveryStateError(`Invalid requirement origin ${r.origin} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (!MATERIALITY_LEVELS.includes(r.materiality)) {
      throw new DiscoveryStateError(`Invalid requirement materiality ${r.materiality} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (r.scopeDisposition && !SCOPE_DISPOSITIONS.includes(r.scopeDisposition)) {
      throw new DiscoveryStateError(`Invalid requirement scopeDisposition ${r.scopeDisposition} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if (!RESOLUTION_STATES.includes(r.resolutionState)) {
      throw new DiscoveryStateError(`Invalid resolutionState ${r.resolutionState} in ${r.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    if ((r.resolutionState === 'CONFIRMED' || r.resolutionState === 'ADOPTED') && r.confirmedBy !== 'PRODUCT_OWNER') {
      throw new DiscoveryStateError(`Confirmed/Adopted requirement ${r.id} must be confirmedBy PRODUCT_OWNER (got ${r.confirmedBy})`, 'DK_DISCOVERY_CORRUPT');
    }
    // Active record cannot have supersededBy set
    if (r.resolutionState !== 'SUPERSEDED' && r.supersededBy) {
      throw new DiscoveryStateError(`Active requirement ${r.id} cannot have supersededBy set (resolutionState: ${r.resolutionState})`, 'DK_LINEAGE_ERROR');
    }
    // REJECTED cannot carry MUST scope disposition
    if (r.resolutionState === 'REJECTED' && r.scopeDisposition === 'MUST') {
      throw new DiscoveryStateError(`REJECTED requirement ${r.id} cannot have MUST scope disposition`, 'DK_DISCOVERY_CORRUPT');
    }

    // Persisted scope authority validation for material candidates
    if (r.materiality === 'MATERIAL' && r.scopeDisposition && r.scopeDisposition !== 'UNCLASSIFIED') {
      if (!r.scopeDecision || typeof r.scopeDecision !== 'object') {
        throw new DiscoveryStateError(`Material requirement ${r.id} with scope ${r.scopeDisposition} lacks scopeDecision authority metadata`, 'DK_DISCOVERY_CORRUPT');
      }
      if (r.scopeDecision.confirmedBy !== 'PRODUCT_OWNER') {
        throw new DiscoveryStateError(`Material requirement ${r.id} scopeDecision must be confirmedBy PRODUCT_OWNER (got ${r.scopeDecision.confirmedBy})`, 'DK_DISCOVERY_CORRUPT');
      }
      if (r.scopeDecision.disposition !== r.scopeDisposition) {
        throw new DiscoveryStateError(`Material requirement ${r.id} scopeDecision disposition (${r.scopeDecision.disposition}) does not match scopeDisposition (${r.scopeDisposition})`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!r.scopeDecision.decisionId || !/^POD-[A-Za-z0-9._-]+$/i.test(r.scopeDecision.decisionId)) {
        throw new DiscoveryStateError(`Material requirement ${r.id} scopeDecision has invalid decisionId ${r.scopeDecision.decisionId}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!r.scopeDecision.decidedAt || isNaN(Date.parse(r.scopeDecision.decidedAt))) {
        throw new DiscoveryStateError(`Material requirement ${r.id} scopeDecision has invalid decidedAt timestamp`, 'DK_DISCOVERY_CORRUPT');
      }
    }

    // Persisted rejection authority validation for material candidates
    if (r.materiality === 'MATERIAL' && r.resolutionState === 'REJECTED') {
      if (r.confirmedBy !== 'PRODUCT_OWNER') {
        throw new DiscoveryStateError(`Material rejected requirement ${r.id} must be confirmedBy PRODUCT_OWNER`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!r.deactivationDecision || r.deactivationDecision.confirmedBy !== 'PRODUCT_OWNER') {
        throw new DiscoveryStateError(`Material rejected requirement ${r.id} lacks valid deactivationDecision authority metadata`, 'DK_DISCOVERY_CORRUPT');
      }
      if (r.deactivationDecision.resolutionState !== 'REJECTED') {
        throw new DiscoveryStateError(`Material rejected requirement ${r.id} deactivationDecision resolutionState mismatch`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!r.deactivationDecision.decisionId || !/^POD-[A-Za-z0-9._-]+$/i.test(r.deactivationDecision.decisionId)) {
        throw new DiscoveryStateError(`Material rejected requirement ${r.id} has invalid deactivationDecision decisionId`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!r.deactivationDecision.decidedAt || isNaN(Date.parse(r.deactivationDecision.decidedAt))) {
        throw new DiscoveryStateError(`Material rejected requirement ${r.id} has invalid deactivationDecision decidedAt timestamp`, 'DK_DISCOVERY_CORRUPT');
      }
    }

    // Persisted supersession authority validation for ANY material candidate
    if (r.materiality === 'MATERIAL' && r.resolutionState === 'SUPERSEDED') {
      if (!r.supersessionDecision || r.supersessionDecision.confirmedBy !== 'PRODUCT_OWNER') {
        throw new DiscoveryStateError(`Material superseded requirement ${r.id} lacks valid supersessionDecision authority metadata`, 'DK_DISCOVERY_CORRUPT');
      }
      if (r.supersessionDecision.supersededBy !== r.supersededBy) {
        throw new DiscoveryStateError(`Material superseded requirement ${r.id} supersessionDecision supersededBy mismatch`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!r.supersessionDecision.decisionId || !/^POD-[A-Za-z0-9._-]+$/i.test(r.supersessionDecision.decisionId)) {
        throw new DiscoveryStateError(`Material superseded requirement ${r.id} has invalid supersessionDecision decisionId`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!r.supersessionDecision.decidedAt || isNaN(Date.parse(r.supersessionDecision.decidedAt))) {
        throw new DiscoveryStateError(`Material superseded requirement ${r.id} has invalid supersessionDecision decidedAt timestamp`, 'DK_DISCOVERY_CORRUPT');
      }
    }

    if (r.linkedPodId !== null && r.linkedPodId !== undefined) {
      if (!/^POD-[A-Za-z0-9._-]+$/i.test(r.linkedPodId)) {
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

  // Reciprocal lineage verification for requirements
  for (const r of data.requirements) {
    if (r.supersedes) {
      const oldReq = reqMap.get(r.supersedes);
      if (!oldReq) {
        throw new DiscoveryStateError(`Dangling supersedes reference in ${r.id} -> ${r.supersedes}`, 'DK_LINEAGE_ERROR');
      }
      if (oldReq.supersededBy !== r.id) {
        throw new DiscoveryStateError(`Broken reciprocal supersedes link in ${r.id} -> ${r.supersedes} (old points to ${oldReq.supersededBy})`, 'DK_LINEAGE_ERROR');
      }
      if (oldReq.resolutionState !== 'SUPERSEDED') {
        throw new DiscoveryStateError(`Superseded requirement ${oldReq.id} must have resolutionState SUPERSEDED`, 'DK_LINEAGE_ERROR');
      }
    }
    if (r.supersededBy) {
      const newReq = reqMap.get(r.supersededBy);
      if (!newReq) {
        throw new DiscoveryStateError(`Dangling supersededBy reference in ${r.id} -> ${r.supersededBy}`, 'DK_LINEAGE_ERROR');
      }
      if (newReq.supersedes !== r.id) {
        throw new DiscoveryStateError(`Broken reciprocal supersededBy link in ${r.id} -> ${r.supersededBy} (new points to ${newReq.supersedes})`, 'DK_LINEAGE_ERROR');
      }
      if (r.resolutionState !== 'SUPERSEDED') {
        throw new DiscoveryStateError(`Requirement ${r.id} with supersededBy must have resolutionState SUPERSEDED`, 'DK_LINEAGE_ERROR');
      }
    }
  }

  const qMap = new Map();
  const qKeySet = new Set();
  for (const q of data.openQuestions) {
    if (!q || typeof q !== 'object') {
      throw new DiscoveryStateError('Question entry must be an object', 'DK_DISCOVERY_CORRUPT');
    }
    if (!q.id || !/^IDEA-Q-\d+$/i.test(q.id)) {
      throw new DiscoveryStateError(`Question ID invalid: ${q.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    const normQId = q.id.toUpperCase();
    if (qKeySet.has(normQId)) {
      throw new DiscoveryStateError(`Duplicate question ID (case-insensitive): ${q.id}`, 'DK_DISCOVERY_CORRUPT');
    }
    qKeySet.add(normQId);
    qMap.set(q.id, q);

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
    if (q.materiality === 'MATERIAL' && q.resolution === 'SUPERSEDED') {
      if (!q.supersessionDecision || q.supersessionDecision.resolvedBy !== 'PRODUCT_OWNER') {
        throw new DiscoveryStateError(`Material superseded question ${q.id} lacks valid supersessionDecision authority metadata`, 'DK_DISCOVERY_CORRUPT');
      }
      if (q.supersessionDecision.supersededBy !== q.supersededBy) {
        throw new DiscoveryStateError(`Material superseded question ${q.id} supersessionDecision supersededBy mismatch`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!q.supersessionDecision.decisionId || !/^POD-[A-Za-z0-9._-]+$/i.test(q.supersessionDecision.decisionId)) {
        throw new DiscoveryStateError(`Material superseded question ${q.id} has invalid supersessionDecision decisionId`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!q.supersessionDecision.decidedAt || isNaN(Date.parse(q.supersessionDecision.decidedAt))) {
        throw new DiscoveryStateError(`Material superseded question ${q.id} has invalid supersessionDecision decidedAt timestamp`, 'DK_DISCOVERY_CORRUPT');
      }
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

  // Reciprocal lineage verification for questions
  for (const q of data.openQuestions) {
    if (q.supersedes) {
      const oldQ = qMap.get(q.supersedes);
      if (!oldQ) {
        throw new DiscoveryStateError(`Dangling supersedes reference in ${q.id} -> ${q.supersedes}`, 'DK_LINEAGE_ERROR');
      }
      if (oldQ.supersededBy !== q.id) {
        throw new DiscoveryStateError(`Broken reciprocal supersedes link in ${q.id} -> ${q.supersedes} (old points to ${oldQ.supersededBy})`, 'DK_LINEAGE_ERROR');
      }
      if (oldQ.resolution !== 'SUPERSEDED') {
        throw new DiscoveryStateError(`Superseded question ${oldQ.id} must have resolution SUPERSEDED`, 'DK_LINEAGE_ERROR');
      }
    }
    if (q.supersededBy) {
      const newQ = qMap.get(q.supersededBy);
      if (!newQ) {
        throw new DiscoveryStateError(`Dangling supersededBy reference in ${q.id} -> ${q.supersededBy}`, 'DK_LINEAGE_ERROR');
      }
      if (newQ.supersedes !== q.id) {
        throw new DiscoveryStateError(`Broken reciprocal supersededBy link in ${q.id} -> ${q.supersededBy} (new points to ${newQ.supersedes})`, 'DK_LINEAGE_ERROR');
      }
      if (q.resolution !== 'SUPERSEDED') {
        throw new DiscoveryStateError(`Question ${q.id} with supersededBy must have resolution SUPERSEDED`, 'DK_LINEAGE_ERROR');
      }
    }
  }

  return true;
}

export function validateDiscoveryAuthority(rootDir, state) {
  if (!state || typeof state !== 'object') return true;

  for (const r of state.requirements || []) {
    if (r.scopeDecision && r.scopeDecision.decisionId) {
      let pod;
      try {
        pod = loadPODecisionById(rootDir, r.scopeDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material requirement ${r.id} references missing or invalid POD ${r.scopeDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.provenance !== 'product-owner') {
        throw new DiscoveryStateError(`POD ${pod.id} provenance is ${pod.provenance}; expected 'product-owner'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.status !== 'APPROVED') {
        throw new DiscoveryStateError(`POD ${pod.id} status is ${pod.status}; expected 'APPROVED' for scope classification`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!pod.affectedRequirements || !pod.affectedRequirements.includes(r.id)) {
        throw new DiscoveryStateError(`POD ${pod.id} does not affect requirement ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionType === 'REQUIREMENT_SCOPE') {
        if (!pod.decisionData || pod.decisionData.requirementId !== r.id || pod.decisionData.newScope !== r.scopeDecision.disposition) {
          throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match scope decision on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
        }
      }
    }

    if (r.deactivationDecision && r.deactivationDecision.decisionId) {
      let pod;
      try {
        pod = loadPODecisionById(rootDir, r.deactivationDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material requirement ${r.id} references missing or invalid rejection POD ${r.deactivationDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.provenance !== 'product-owner') {
        throw new DiscoveryStateError(`POD ${pod.id} provenance is ${pod.provenance}; expected 'product-owner'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.status !== 'REJECTED') {
        throw new DiscoveryStateError(`POD ${pod.id} status is ${pod.status}; expected 'REJECTED' for requirement deactivation`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!pod.affectedRequirements || !pod.affectedRequirements.includes(r.id)) {
        throw new DiscoveryStateError(`POD ${pod.id} does not affect requirement ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionType === 'REQUIREMENT_REJECTION') {
        if (!pod.decisionData || pod.decisionData.requirementId !== r.id) {
          throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match requirement rejection on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
        }
      }
    }

    if (r.supersessionDecision && r.supersessionDecision.decisionId) {
      let pod;
      try {
        pod = loadPODecisionById(rootDir, r.supersessionDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material requirement ${r.id} references missing or invalid supersession POD ${r.supersessionDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.provenance !== 'product-owner') {
        throw new DiscoveryStateError(`POD ${pod.id} provenance is ${pod.provenance}; expected 'product-owner'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.status !== 'APPROVED') {
        throw new DiscoveryStateError(`POD ${pod.id} status is ${pod.status}; expected 'APPROVED' for requirement supersession`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!pod.affectedRequirements || !pod.affectedRequirements.includes(r.id)) {
        throw new DiscoveryStateError(`POD ${pod.id} does not affect requirement ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionType === 'REQUIREMENT_SUPERSESSION') {
        if (!pod.decisionData || pod.decisionData.requirementId !== r.id || pod.decisionData.supersededBy !== r.supersededBy) {
          throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match requirement supersession on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
        }
      }
    }
  }

  for (const q of state.openQuestions || []) {
    if (q.supersessionDecision && q.supersessionDecision.decisionId) {
      let pod;
      try {
        pod = loadPODecisionById(rootDir, q.supersessionDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material question ${q.id} references missing or invalid supersession POD ${q.supersessionDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.provenance !== 'product-owner') {
        throw new DiscoveryStateError(`POD ${pod.id} provenance is ${pod.provenance}; expected 'product-owner'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.status !== 'APPROVED') {
        throw new DiscoveryStateError(`POD ${pod.id} status is ${pod.status}; expected 'APPROVED' for question supersession`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionType === 'QUESTION_SUPERSESSION') {
        if (!pod.decisionData || pod.decisionData.questionId !== q.id || pod.decisionData.supersededBy !== q.supersededBy) {
          throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match question supersession on ${q.id}`, 'DK_DISCOVERY_CORRUPT');
        }
      }
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
    validateDiscoveryAuthority(rootDir, data);
    data.fingerprint = computeDiscoveryFingerprint(data);
    return data;
  } catch (err) {
    if (err instanceof DiscoveryStateError) throw err;
    throw new DiscoveryStateError(`Corrupt discovery state: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
  }
}

export function persistDiscoveryState(state, rootDir = process.cwd()) {
  // Always validate complete state before writing to disk
  validateDiscoveryStateStructure(state);

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
  scopeDisposition,
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
  if (!MATERIALITY_LEVELS.includes(materiality)) {
    throw new DiscoveryStateError(`Invalid materiality level: ${materiality}`, 'DK_INVALID_MATERIALITY');
  }
  if (scopeDisposition !== undefined && scopeDisposition !== null && !SCOPE_DISPOSITIONS.includes(scopeDisposition)) {
    throw new DiscoveryStateError(`Invalid scope disposition: ${scopeDisposition}`, 'DK_INVALID_SCOPE_DISPOSITION');
  }
  if (!RESOLUTION_STATES.includes(resolutionState)) {
    throw new DiscoveryStateError(`Invalid resolutionState: ${resolutionState}`, 'DK_INVALID_RESOLUTION_STATE');
  }

  // Normal requirement recording cannot write SUPERSEDED
  if (resolutionState === 'SUPERSEDED') {
    throw new DiscoveryStateError(
      `Cannot set resolutionState = 'SUPERSEDED' via recordRequirementCandidate for ${id}. Use supersedeRequirementCandidate to establish replacement lineage.`,
      'DK_SUPERSEDED_MUTATION_PROHIBITED'
    );
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
  const existingIdx = state.requirements.findIndex((r) => r.id.toUpperCase() === id.toUpperCase());

  let finalScope;
  let scopeDecision = null;
  let deactivationDecision = null;
  let createdPod = null;

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

    // scopeDisposition cannot be silently changed through normal record update
    const existingScope = existing.scopeDisposition || 'UNCLASSIFIED';
    if (scopeDisposition !== undefined && scopeDisposition !== null && existingScope !== scopeDisposition) {
      throw new DiscoveryStateError(
        `Requirement scope disposition is immutable via recordRequirementCandidate for ${id} (existing: ${existingScope}, attempted: ${scopeDisposition}). Use classifyRequirementScope.`,
        'DK_SCOPE_IMMUTABLE'
      );
    }
    finalScope = existingScope;
    scopeDecision = existing.scopeDecision || null;
    deactivationDecision = existing.deactivationDecision || null;

    // Table-driven legal state-transition validation
    if (!isValidRequirementTransition(existing.resolutionState, resolutionState)) {
      throw new DiscoveryStateError(`Candidate ${id} resolution transition from ${existing.resolutionState} to ${resolutionState} is illegal`, 'DK_ILLEGAL_STATE_TRANSITION');
    }

    // Material deactivation / rejection requires PRODUCT_OWNER authority & POD evidence
    if (existing.materiality === 'MATERIAL' && resolutionState === 'REJECTED') {
      if (confirmedBy !== 'PRODUCT_OWNER') {
        throw new DiscoveryStateError(`Deactivating/Rejecting material requirement ${id} requires explicit confirmedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_DEACTIVATION');
      }
      const podId = `POD-${id}-DEACT-${String((state.revision || 0) + 1).padStart(3, '0')}`;
      createdPod = createPODecision({
        id: podId,
        statement: podStatement || `Deactivated/Rejected material requirement ${id}`,
        status: 'REJECTED',
        provenance: 'product-owner',
        decisionType: 'REQUIREMENT_REJECTION',
        decisionData: { requirementId: id, resolutionState: 'REJECTED' },
        affectedRequirements: [id],
      });
      deactivationDecision = {
        resolutionState: 'REJECTED',
        confirmedBy: 'PRODUCT_OWNER',
        decisionId: podId,
        decidedAt: new Date().toISOString(),
      };
    } else if (existing.materiality === 'MATERIAL' && resolutionState === 'DEFERRED' && confirmedBy !== 'PRODUCT_OWNER') {
      throw new DiscoveryStateError(`Deferring material requirement ${id} requires explicit confirmedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_DEACTIVATION');
    }
  } else {
    // New candidate creation
    if (resolutionState === 'REJECTED') {
      throw new DiscoveryStateError(`New candidate ${id} cannot be directly created as REJECTED. Record as UNRESOLVED first, then use an explicit rejection operation.`, 'DK_ILLEGAL_STATE_TRANSITION');
    }

    // New MATERIAL candidates must have UNCLASSIFIED scope upon initial recording
    if (materiality === 'MATERIAL') {
      if (scopeDisposition !== undefined && scopeDisposition !== null && scopeDisposition !== 'UNCLASSIFIED') {
        throw new DiscoveryStateError(`Initial material candidate ${id} must be UNCLASSIFIED on creation (got ${scopeDisposition}). Use classifyRequirementScope to set scope.`, 'DK_MATERIAL_SCOPE_REQUIRES_CLASSIFICATION');
      }
      finalScope = 'UNCLASSIFIED';
    } else {
      finalScope = scopeDisposition || 'UNCLASSIFIED';
    }
  }

  let linkedPodId = null;
  if (createPod && (resolutionState === 'CONFIRMED' || resolutionState === 'ADOPTED') && confirmedBy === 'PRODUCT_OWNER') {
    const podId = `POD-${id}`;
    createdPod = createPODecision({
      id: podId,
      statement: podStatement || statement,
      status: 'APPROVED',
      provenance: 'product-owner',
      affectedRequirements: [id],
    });
    linkedPodId = podId;
  }

  const reqObj = {
    id,
    statement: statement.trim(),
    materiality,
    scopeDisposition: finalScope,
    origin,
    resolutionState,
    confirmedBy: (resolutionState === 'CONFIRMED' || resolutionState === 'ADOPTED' || resolutionState === 'REJECTED') ? confirmedBy : null,
    linkedPodId: linkedPodId || (createdPod ? createdPod.id : (existingIdx >= 0 ? state.requirements[existingIdx].linkedPodId : null)),
    scopeDecision,
    deactivationDecision,
    supersessionDecision: existingIdx >= 0 ? state.requirements[existingIdx].supersessionDecision : null,
    supersedes: existingIdx >= 0 ? state.requirements[existingIdx].supersedes : null,
    supersededBy: existingIdx >= 0 ? state.requirements[existingIdx].supersededBy : null,
    createdAt: existingIdx >= 0 ? state.requirements[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const nextRequirements = [...state.requirements];
  if (existingIdx >= 0) {
    nextRequirements[existingIdx] = reqObj;
  } else {
    nextRequirements.push(reqObj);
  }

  const proposedState = {
    ...state,
    requirements: nextRequirements,
    revision: (state.revision || 0) + 1,
  };

  // Atomic complete validation BEFORE writing POD or state to disk
  validateDiscoveryStateStructure(proposedState);

  if (createdPod) {
    persistPODecision(createdPod, rootDir);
  }

  persistDiscoveryState(proposedState, rootDir);
  return reqObj;
}

export function supersedeRequirementCandidate(rootDir = process.cwd(), oldId, newCandidateData = {}) {
  const state = loadDiscoveryState(rootDir);
  const oldIdx = state.requirements.findIndex((r) => r.id.toUpperCase() === oldId.toUpperCase());
  if (oldIdx < 0) {
    throw new DiscoveryStateError(`Cannot supersede: candidate ${oldId} does not exist`, 'DK_CANDIDATE_NOT_FOUND');
  }

  const oldReq = state.requirements[oldIdx];
  if (oldReq.resolutionState === 'SUPERSEDED') {
    throw new DiscoveryStateError(`Candidate ${oldId} is already superseded`, 'DK_ALREADY_SUPERSEDED');
  }

  if (!isValidRequirementTransition(oldReq.resolutionState, 'SUPERSEDED')) {
    throw new DiscoveryStateError(`Candidate ${oldId} resolution state ${oldReq.resolutionState} cannot transition to SUPERSEDED`, 'DK_ILLEGAL_STATE_TRANSITION');
  }

  // Material requirement supersession requires explicit PRODUCT_OWNER authorization
  if (oldReq.materiality === 'MATERIAL' && newCandidateData.confirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(`Superseding material requirement ${oldId} requires explicit confirmedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_SUPERSEDING');
  }

  const newId = newCandidateData.id;
  if (!newId || !/^IDEA-REQ-\d+$/i.test(newId)) {
    throw new DiscoveryStateError(`Invalid new candidate ID: ${newId}`, 'DK_INVALID_REQ_ID');
  }
  if (newId.toUpperCase() === oldId.toUpperCase()) {
    throw new DiscoveryStateError('New candidate ID must differ from old candidate ID for supersession', 'DK_INVALID_SUPERSEDED_ID');
  }
  if (state.requirements.some((r) => r.id.toUpperCase() === newId.toUpperCase())) {
    throw new DiscoveryStateError(`Candidate with ID ${newId} already exists`, 'DK_CANDIDATE_EXISTS');
  }

  const newStatement = newCandidateData.statement || oldReq.statement;
  const newOrigin = newCandidateData.origin || oldReq.origin;
  const newMateriality = newCandidateData.materiality || oldReq.materiality;
  const newScope = newMateriality === 'MATERIAL'
    ? 'UNCLASSIFIED'
    : (newCandidateData.scopeDisposition || oldReq.scopeDisposition || 'UNCLASSIFIED');
  const newResolution = newCandidateData.resolutionState || 'UNRESOLVED';
  const newConfirmedBy = newCandidateData.confirmedBy || null;

  if (newResolution === 'SUPERSEDED') {
    throw new DiscoveryStateError('New candidate in supersession cannot be initialized as SUPERSEDED', 'DK_ILLEGAL_STATE_TRANSITION');
  }
  if (newResolution === 'REJECTED') {
    throw new DiscoveryStateError('New candidate in supersession cannot be initialized as REJECTED. Create as UNRESOLVED first.', 'DK_ILLEGAL_STATE_TRANSITION');
  }
  if ((newResolution === 'CONFIRMED' || newResolution === 'ADOPTED') && newConfirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError('Confirmed or Adopted superseding requirement requires confirmedBy = "PRODUCT_OWNER"', 'DK_UNAUTHORIZED_CONFIRMATION');
  }

  const now = new Date().toISOString();
  let createdSupersedePod = null;
  let supersessionDecision = null;

  if (oldReq.materiality === 'MATERIAL') {
    const podId = `POD-${oldId}-SUPERSEDE-${String((state.revision || 0) + 1).padStart(3, '0')}`;
    createdSupersedePod = createPODecision({
      id: podId,
      statement: newCandidateData.podStatement || `Requirement ${oldId} superseded by ${newId}`,
      status: 'APPROVED',
      provenance: 'product-owner',
      decisionType: 'REQUIREMENT_SUPERSESSION',
      decisionData: { requirementId: oldId, supersededBy: newId },
      affectedRequirements: [oldId, newId],
    });
    supersessionDecision = {
      supersededBy: newId,
      confirmedBy: newConfirmedBy,
      decisionId: podId,
      decidedAt: now,
    };
  }

  // Phase 1: Construct proposed state WITHOUT disk side effects
  const updatedOld = {
    ...oldReq,
    resolutionState: 'SUPERSEDED',
    supersededBy: newId,
    supersessionDecision,
    linkedPodId: createdSupersedePod ? createdSupersedePod.id : oldReq.linkedPodId,
    updatedAt: now,
  };

  let createdNewPod = null;
  let newLinkedPodId = null;
  if (newCandidateData.createPod && (newResolution === 'CONFIRMED' || newResolution === 'ADOPTED') && newConfirmedBy === 'PRODUCT_OWNER') {
    const podId = `POD-${newId}`;
    createdNewPod = createPODecision({
      id: podId,
      statement: newCandidateData.podStatement || newStatement,
      status: 'APPROVED',
      provenance: 'product-owner',
      affectedRequirements: [newId],
    });
    newLinkedPodId = podId;
  }

  const newReq = {
    id: newId,
    statement: newStatement.trim(),
    materiality: newMateriality,
    scopeDisposition: newScope,
    origin: newOrigin,
    resolutionState: newResolution,
    confirmedBy: (newResolution === 'CONFIRMED' || newResolution === 'ADOPTED') ? newConfirmedBy : null,
    linkedPodId: newLinkedPodId,
    scopeDecision: null,
    deactivationDecision: null,
    supersessionDecision: null,
    supersedes: oldId,
    supersededBy: null,
    createdAt: now,
    updatedAt: now,
  };

  const nextRequirementsCheck = [...state.requirements];
  nextRequirementsCheck[oldIdx] = updatedOld;
  nextRequirementsCheck.push(newReq);

  const proposedStateCheck = {
    ...state,
    requirements: nextRequirementsCheck,
    revision: (state.revision || 0) + 1,
  };

  // Phase 2: Validate entire proposed state structure BEFORE any POD side effects
  validateDiscoveryStateStructure(proposedStateCheck);

  // Phase 3: Persist PODs only after successful validation
  if (createdSupersedePod) {
    persistPODecision(createdSupersedePod, rootDir);
  }
  if (createdNewPod) {
    persistPODecision(createdNewPod, rootDir);
  }

  // Phase 4: Persist final state
  persistDiscoveryState(proposedStateCheck, rootDir);

  return {
    superseded: updatedOld,
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

  // Normal question recording cannot write SUPERSEDED
  if (resolution === 'SUPERSEDED') {
    throw new DiscoveryStateError(
      `Cannot set resolution = 'SUPERSEDED' via recordOpenQuestion for ${id}. Use supersedeOpenQuestion to establish replacement lineage.`,
      'DK_SUPERSEDED_MUTATION_PROHIBITED'
    );
  }

  if (materiality === 'MATERIAL' && resolution !== 'UNRESOLVED' && resolvedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(`Material question ${resolution} resolution requires explicit resolvedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_RESOLUTION');
  }

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.openQuestions.findIndex((q) => q.id.toUpperCase() === id.toUpperCase());

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
    // Table-driven legal transition check for questions
    if (!isValidQuestionTransition(existing.resolution, resolution)) {
      throw new DiscoveryStateError(`Question ${id} transition from ${existing.resolution} to ${resolution} is illegal`, 'DK_ILLEGAL_STATE_TRANSITION');
    }
  } else {
    if (resolution === 'REJECTED') {
      throw new DiscoveryStateError(`New question ${id} cannot be directly created as REJECTED. Record as UNRESOLVED first.`, 'DK_ILLEGAL_STATE_TRANSITION');
    }
  }

  const qObj = {
    id,
    question: question.trim(),
    materiality,
    resolution,
    deferredTarget: resolution === 'DEFERRED' ? (deferredTarget || 'Future Ideas (Explicitly Deferred)') : null,
    resolvedBy: resolution !== 'UNRESOLVED' ? resolvedBy : null,
    notes,
    supersessionDecision: existingIdx >= 0 ? state.openQuestions[existingIdx].supersessionDecision : null,
    supersedes: existingIdx >= 0 ? state.openQuestions[existingIdx].supersedes : null,
    supersededBy: existingIdx >= 0 ? state.openQuestions[existingIdx].supersededBy : null,
    createdAt: existingIdx >= 0 ? state.openQuestions[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const nextQuestions = [...state.openQuestions];
  if (existingIdx >= 0) {
    nextQuestions[existingIdx] = qObj;
  } else {
    nextQuestions.push(qObj);
  }

  const proposedState = {
    ...state,
    openQuestions: nextQuestions,
    revision: (state.revision || 0) + 1,
  };

  persistDiscoveryState(proposedState, rootDir);
  return qObj;
}

export function supersedeOpenQuestion(rootDir = process.cwd(), oldId, newQuestionData = {}) {
  const state = loadDiscoveryState(rootDir);
  const oldIdx = state.openQuestions.findIndex((q) => q.id.toUpperCase() === oldId.toUpperCase());
  if (oldIdx < 0) {
    throw new DiscoveryStateError(`Cannot supersede: question ${oldId} does not exist`, 'DK_QUESTION_NOT_FOUND');
  }

  const oldQ = state.openQuestions[oldIdx];
  if (oldQ.resolution === 'SUPERSEDED') {
    throw new DiscoveryStateError(`Question ${oldId} is already superseded`, 'DK_ALREADY_SUPERSEDED');
  }
  if (!isValidQuestionTransition(oldQ.resolution, 'SUPERSEDED')) {
    throw new DiscoveryStateError(`Question ${oldId} resolution ${oldQ.resolution} cannot transition to SUPERSEDED`, 'DK_ILLEGAL_STATE_TRANSITION');
  }

  // Superseding ANY material question requires explicit resolvedBy = 'PRODUCT_OWNER'
  if (oldQ.materiality === 'MATERIAL' && newQuestionData.resolvedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(`Superseding material question ${oldId} requires explicit resolvedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_SUPERSEDING');
  }

  const newId = newQuestionData.id;
  if (!newId || !/^IDEA-Q-\d+$/i.test(newId)) {
    throw new DiscoveryStateError(`Invalid new question ID: ${newId}`, 'DK_INVALID_QUESTION_ID');
  }
  if (newId.toUpperCase() === oldId.toUpperCase()) {
    throw new DiscoveryStateError('New question ID must differ from old question ID for supersession', 'DK_INVALID_SUPERSEDED_ID');
  }
  if (state.openQuestions.some((q) => q.id.toUpperCase() === newId.toUpperCase())) {
    throw new DiscoveryStateError(`Question with ID ${newId} already exists`, 'DK_QUESTION_EXISTS');
  }

  const newQuestion = newQuestionData.question || oldQ.question;
  const newMateriality = newQuestionData.materiality || oldQ.materiality;
  const newResolution = newQuestionData.resolution || 'UNRESOLVED';
  const newResolvedBy = newQuestionData.resolvedBy || null;

  if (newResolution === 'SUPERSEDED') {
    throw new DiscoveryStateError('New question in supersession cannot be initialized as SUPERSEDED', 'DK_ILLEGAL_STATE_TRANSITION');
  }
  if (newResolution === 'REJECTED') {
    throw new DiscoveryStateError('New question in supersession cannot be initialized as REJECTED. Record as UNRESOLVED first.', 'DK_ILLEGAL_STATE_TRANSITION');
  }
  if (newMateriality === 'MATERIAL' && newResolution !== 'UNRESOLVED' && newResolvedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError('Material question resolution requires resolvedBy = "PRODUCT_OWNER"', 'DK_UNAUTHORIZED_RESOLUTION');
  }

  const now = new Date().toISOString();
  let createdSupersedePod = null;
  let supersessionDecision = null;

  if (oldQ.materiality === 'MATERIAL') {
    const podId = `POD-${oldId}-SUPERSEDE-${String((state.revision || 0) + 1).padStart(3, '0')}`;
    createdSupersedePod = createPODecision({
      id: podId,
      statement: newQuestionData.podStatement || `Question ${oldId} superseded by ${newId}`,
      status: 'APPROVED',
      provenance: 'product-owner',
      decisionType: 'QUESTION_SUPERSESSION',
      decisionData: { questionId: oldId, supersededBy: newId },
      affectedRequirements: [],
    });
    supersessionDecision = {
      supersededBy: newId,
      resolvedBy: newResolvedBy,
      decisionId: podId,
      decidedAt: now,
    };
  }

  const updatedOld = {
    ...oldQ,
    resolution: 'SUPERSEDED',
    supersededBy: newId,
    supersessionDecision,
    updatedAt: now,
  };

  const newQ = {
    id: newId,
    question: newQuestion.trim(),
    materiality: newMateriality,
    resolution: newResolution,
    deferredTarget: newResolution === 'DEFERRED' ? (newQuestionData.deferredTarget || 'Future Ideas (Explicitly Deferred)') : null,
    resolvedBy: newResolution !== 'UNRESOLVED' ? newResolvedBy : null,
    notes: newQuestionData.notes || null,
    supersessionDecision: null,
    supersedes: oldId,
    supersededBy: null,
    createdAt: now,
    updatedAt: now,
  };

  const nextQuestionsCheck = [...state.openQuestions];
  nextQuestionsCheck[oldIdx] = updatedOld;
  nextQuestionsCheck.push(newQ);

  const proposedStateCheck = {
    ...state,
    openQuestions: nextQuestionsCheck,
    revision: (state.revision || 0) + 1,
  };

  // Validate proposed state before writing POD
  validateDiscoveryStateStructure(proposedStateCheck);

  if (createdSupersedePod) {
    persistPODecision(createdSupersedePod, rootDir);
  }

  persistDiscoveryState(proposedStateCheck, rootDir);

  return {
    superseded: updatedOld,
    created: newQ,
  };
}

export function evaluateDiscoveryReadiness(rootDir = process.cwd()) {
  const state = loadDiscoveryState(rootDir);
  const blockers = [];

  for (const req of state.requirements) {
    // Inactive requirements (SUPERSEDED, REJECTED) do not block discovery readiness
    if (req.resolutionState === 'SUPERSEDED' || req.resolutionState === 'REJECTED') {
      continue;
    }

    // UNCLASSIFIED material requirements block readiness — must be classified first
    if (req.scopeDisposition === 'UNCLASSIFIED' || !req.scopeDisposition) {
      if (req.materiality === 'MATERIAL') {
        blockers.push({
          code: 'UNCLASSIFIED_MATERIAL_REQUIREMENT',
          id: req.id,
          statement: req.statement,
          message: `Material requirement ${req.id} has no scope disposition. Use classifyRequirementScope to classify it as MUST/SHOULD/FUTURE/EXCLUDED.`,
        });
      }
      // Skip further checks for unclassified requirements
      continue;
    }

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
    // Inactive questions (SUPERSEDED, REJECTED) do not block discovery readiness
    if (q.resolution === 'SUPERSEDED' || q.resolution === 'REJECTED') {
      continue;
    }

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

/**
 * Authoritative scope classification operation.
 * Material scope changes require explicit PRODUCT_OWNER authority and automatically record a POD.
 * This is the ONLY way to change scopeDisposition on a material candidate.
 */
export function classifyRequirementScope(rootDir = process.cwd(), {
  id,
  scopeDisposition,
  confirmedBy,
  podStatement = null,
} = {}) {
  if (!id || !/^IDEA-REQ-\d+$/i.test(id)) {
    throw new DiscoveryStateError(`Invalid candidate requirement ID: ${id}`, 'DK_INVALID_REQ_ID');
  }
  if (!SCOPE_DISPOSITIONS.includes(scopeDisposition)) {
    throw new DiscoveryStateError(`Invalid scope disposition: ${scopeDisposition}`, 'DK_INVALID_SCOPE_DISPOSITION');
  }

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.requirements.findIndex((r) => r.id.toUpperCase() === id.toUpperCase());
  if (existingIdx < 0) {
    throw new DiscoveryStateError(`Candidate ${id} does not exist`, 'DK_CANDIDATE_NOT_FOUND');
  }

  const existing = state.requirements[existingIdx];

  // Material scope classification requires explicit PRODUCT_OWNER authority
  if (existing.materiality === 'MATERIAL' && confirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(
      `Classifying scope disposition of material requirement ${id} requires explicit confirmedBy = 'PRODUCT_OWNER'`,
      'DK_UNAUTHORIZED_SCOPE_CLASSIFICATION'
    );
  }
  if (existing.resolutionState === 'SUPERSEDED' || existing.resolutionState === 'REJECTED') {
    throw new DiscoveryStateError(
      `Cannot classify scope for ${existing.resolutionState} candidate ${id}`,
      'DK_ILLEGAL_STATE_TRANSITION'
    );
  }

  const oldScope = existing.scopeDisposition || 'UNCLASSIFIED';
  const now = new Date().toISOString();

  let createdPod = null;
  let scopeDecision = null;

  if (existing.materiality === 'MATERIAL' || confirmedBy === 'PRODUCT_OWNER') {
    const podId = `POD-${id}-SCOPE-${String((state.revision || 0) + 1).padStart(3, '0')}`;
    createdPod = createPODecision({
      id: podId,
      statement: podStatement || `Scope classified as ${scopeDisposition} for ${id}`,
      status: 'APPROVED',
      provenance: 'product-owner',
      decisionType: 'REQUIREMENT_SCOPE',
      decisionData: {
        requirementId: id,
        previousScope: oldScope,
        newScope: scopeDisposition,
      },
      affectedRequirements: [id],
    });
    scopeDecision = {
      previousDisposition: oldScope,
      disposition: scopeDisposition,
      confirmedBy: confirmedBy,
      decisionId: podId,
      decidedAt: now,
    };
  } else {
    scopeDecision = {
      previousDisposition: oldScope,
      disposition: scopeDisposition,
      confirmedBy: confirmedBy || 'UNSPECIFIED',
      decisionId: null,
      decidedAt: now,
    };
  }

  const updated = {
    ...existing,
    scopeDisposition,
    scopeDecision,
    linkedPodId: createdPod ? createdPod.id : existing.linkedPodId,
    updatedAt: now,
  };

  const nextRequirements = [...state.requirements];
  nextRequirements[existingIdx] = updated;

  const proposedState = {
    ...state,
    requirements: nextRequirements,
    revision: (state.revision || 0) + 1,
  };

  // Phase 1: Validate entire proposed state structure BEFORE writing POD or file to disk
  validateDiscoveryStateStructure(proposedState);

  // Phase 2: Persist POD after validation
  if (createdPod) {
    persistPODecision(createdPod, rootDir);
  }

  // Phase 3: Persist discovery state
  persistDiscoveryState(proposedState, rootDir);

  return {
    id,
    oldScope,
    newScope: scopeDisposition,
    confirmedBy,
    decisionId: createdPod ? createdPod.id : null,
    timestamp: now,
  };
}
