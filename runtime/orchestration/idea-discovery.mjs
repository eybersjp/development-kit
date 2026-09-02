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
      confirmationDecision: r.confirmationDecision ? {
        previousResolution: r.confirmationDecision.previousResolution || 'UNRESOLVED',
        resolutionState: r.confirmationDecision.resolutionState,
        origin: r.confirmationDecision.origin,
        confirmedBy: r.confirmationDecision.confirmedBy,
        decisionId: r.confirmationDecision.decisionId || null,
        decidedAt: r.confirmationDecision.decidedAt || null,
      } : null,
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
      resolutionDecision: q.resolutionDecision ? {
        previousResolution: q.resolutionDecision.previousResolution || 'UNRESOLVED',
        resolution: q.resolutionDecision.resolution,
        resolvedBy: q.resolutionDecision.resolvedBy,
        decisionId: q.resolutionDecision.decisionId || null,
        decidedAt: q.resolutionDecision.decidedAt || null,
        deferredTarget: q.resolutionDecision.deferredTarget || null,
      } : null,
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

    // Persisted confirmation/adoption authority validation for material candidates
    if (r.materiality === 'MATERIAL' && (r.resolutionState === 'CONFIRMED' || r.resolutionState === 'ADOPTED')) {
      if (!r.confirmationDecision || typeof r.confirmationDecision !== 'object') {
        throw new DiscoveryStateError(`Material requirement ${r.id} with state ${r.resolutionState} lacks confirmationDecision authority metadata`, 'DK_DISCOVERY_CORRUPT');
      }
      if (r.confirmationDecision.confirmedBy !== 'PRODUCT_OWNER') {
        throw new DiscoveryStateError(`Material requirement ${r.id} confirmationDecision must be confirmedBy PRODUCT_OWNER`, 'DK_DISCOVERY_CORRUPT');
      }
      if (r.confirmationDecision.resolutionState !== r.resolutionState) {
        throw new DiscoveryStateError(`Material requirement ${r.id} confirmationDecision resolutionState mismatch`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!r.confirmationDecision.decisionId || !/^POD-[A-Za-z0-9._-]+$/i.test(r.confirmationDecision.decisionId)) {
        throw new DiscoveryStateError(`Material requirement ${r.id} confirmationDecision has invalid decisionId`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!r.confirmationDecision.decidedAt || isNaN(Date.parse(r.confirmationDecision.decidedAt))) {
        throw new DiscoveryStateError(`Material requirement ${r.id} confirmationDecision has invalid decidedAt timestamp`, 'DK_DISCOVERY_CORRUPT');
      }
    }

    // Persisted scope authority validation for material candidates
    if (r.materiality === 'MATERIAL' && r.resolutionState !== 'REJECTED' && r.scopeDisposition && r.scopeDisposition !== 'UNCLASSIFIED') {
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
    if (q.materiality === 'MATERIAL' && (q.resolution === 'ANSWERED' || q.resolution === 'DEFERRED' || q.resolution === 'REJECTED')) {
      if (!q.resolutionDecision || q.resolutionDecision.resolvedBy !== 'PRODUCT_OWNER') {
        throw new DiscoveryStateError(`Material question ${q.id} resolution ${q.resolution} lacks resolutionDecision authority metadata`, 'DK_DISCOVERY_CORRUPT');
      }
      if (q.resolutionDecision.resolution !== q.resolution) {
        throw new DiscoveryStateError(`Material question ${q.id} resolutionDecision resolution mismatch`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!q.resolutionDecision.decisionId || !/^POD-[A-Za-z0-9._-]+$/i.test(q.resolutionDecision.decisionId)) {
        throw new DiscoveryStateError(`Material question ${q.id} has invalid resolutionDecision decisionId`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!q.resolutionDecision.decidedAt || isNaN(Date.parse(q.resolutionDecision.decidedAt))) {
        throw new DiscoveryStateError(`Material question ${q.id} has invalid resolutionDecision decidedAt timestamp`, 'DK_DISCOVERY_CORRUPT');
      }
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

export function validateDiscoveryAuthority(rootDir, state, inMemoryPods = []) {
  if (!state || typeof state !== 'object') return true;

  function resolvePod(decisionId) {
    const fromMem = inMemoryPods.find((p) => p.id.toUpperCase() === decisionId.toUpperCase());
    if (fromMem) {
      validatePODecision(fromMem);
      return fromMem;
    }
    return loadPODecisionById(rootDir, decisionId);
  }

  for (const r of state.requirements || []) {
    // Confirmation decision
    if (r.confirmationDecision && r.confirmationDecision.decisionId) {
      let pod;
      try {
        pod = resolvePod(r.confirmationDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material requirement ${r.id} references missing or invalid confirmation POD ${r.confirmationDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      const expectedType = r.confirmationDecision.resolutionState === 'ADOPTED' ? 'REQUIREMENT_ADOPTION' : 'REQUIREMENT_CONFIRMATION';
      if (pod.decisionType !== expectedType) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionType is ${pod.decisionType}; expected '${expectedType}'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.provenance !== 'product-owner') {
        throw new DiscoveryStateError(`POD ${pod.id} provenance is ${pod.provenance}; expected 'product-owner'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.status !== 'APPROVED') {
        throw new DiscoveryStateError(`POD ${pod.id} status is ${pod.status}; expected 'APPROVED'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!pod.affectedRequirements || !pod.affectedRequirements.includes(r.id)) {
        throw new DiscoveryStateError(`POD ${pod.id} does not affect requirement ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!pod.decisionData || pod.decisionData.requirementId !== r.id || pod.decisionData.newResolution !== r.confirmationDecision.resolutionState) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match requirement confirmation on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionData.previousResolution !== undefined && pod.decisionData.previousResolution !== (r.confirmationDecision.previousResolution || 'UNRESOLVED')) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData previousResolution does not match requirement confirmation on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionData.origin !== undefined && pod.decisionData.origin !== r.origin) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData origin does not match requirement origin on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionData.statement !== undefined && pod.decisionData.statement.trim() !== r.statement.trim()) {
        throw new DiscoveryStateError(`POD ${pod.id} authorized statement content does not match current requirement ${r.id} statement`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionData.requirementFingerprint !== undefined) {
        const expectedHash = `sha256:${crypto.createHash('sha256').update(r.statement.trim(), 'utf8').digest('hex')}`;
        if (pod.decisionData.requirementFingerprint !== expectedHash) {
          throw new DiscoveryStateError(`POD ${pod.id} requirementFingerprint does not match current requirement ${r.id} statement hash`, 'DK_DISCOVERY_CORRUPT');
        }
      }
    }

    // Scope decision
    if (r.scopeDecision && r.scopeDecision.decisionId) {
      let pod;
      try {
        pod = resolvePod(r.scopeDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material requirement ${r.id} references missing or invalid POD ${r.scopeDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionType !== 'REQUIREMENT_SCOPE') {
        throw new DiscoveryStateError(`POD ${pod.id} decisionType is ${pod.decisionType}; expected 'REQUIREMENT_SCOPE'`, 'DK_DISCOVERY_CORRUPT');
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
      if (!pod.decisionData || pod.decisionData.requirementId !== r.id || pod.decisionData.newScope !== r.scopeDecision.disposition) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match scope decision on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionData.previousScope !== undefined && pod.decisionData.previousScope !== (r.scopeDecision.previousDisposition || 'UNCLASSIFIED')) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData previousScope does not match scope decision on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
    }

    // Deactivation decision
    if (r.deactivationDecision && r.deactivationDecision.decisionId) {
      let pod;
      try {
        pod = resolvePod(r.deactivationDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material requirement ${r.id} references missing or invalid rejection POD ${r.deactivationDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionType !== 'REQUIREMENT_REJECTION') {
        throw new DiscoveryStateError(`POD ${pod.id} decisionType is ${pod.decisionType}; expected 'REQUIREMENT_REJECTION'`, 'DK_DISCOVERY_CORRUPT');
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
      if (!pod.decisionData || pod.decisionData.requirementId !== r.id) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match requirement rejection on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionData.statement !== undefined && pod.decisionData.statement.trim() !== r.statement.trim()) {
        throw new DiscoveryStateError(`POD ${pod.id} statement does not match current requirement ${r.id} statement`, 'DK_DISCOVERY_CORRUPT');
      }
    }

    // Supersession decision
    if (r.supersessionDecision && r.supersessionDecision.decisionId) {
      let pod;
      try {
        pod = resolvePod(r.supersessionDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material requirement ${r.id} references missing or invalid supersession POD ${r.supersessionDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionType !== 'REQUIREMENT_SUPERSESSION') {
        throw new DiscoveryStateError(`POD ${pod.id} decisionType is ${pod.decisionType}; expected 'REQUIREMENT_SUPERSESSION'`, 'DK_DISCOVERY_CORRUPT');
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
      if (!pod.decisionData || pod.decisionData.requirementId !== r.id || pod.decisionData.supersededBy !== r.supersededBy) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match requirement supersession on ${r.id}`, 'DK_DISCOVERY_CORRUPT');
      }
    }
  }

  for (const q of state.openQuestions || []) {
    // Resolution decision
    if (q.resolutionDecision && q.resolutionDecision.decisionId) {
      let pod;
      try {
        pod = resolvePod(q.resolutionDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material question ${q.id} references missing or invalid resolution POD ${q.resolutionDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionType !== 'QUESTION_RESOLUTION') {
        throw new DiscoveryStateError(`POD ${pod.id} decisionType is ${pod.decisionType}; expected 'QUESTION_RESOLUTION'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.provenance !== 'product-owner') {
        throw new DiscoveryStateError(`POD ${pod.id} provenance is ${pod.provenance}; expected 'product-owner'`, 'DK_DISCOVERY_CORRUPT');
      }
      const expectedStatus = q.resolution === 'REJECTED' ? 'REJECTED' : 'APPROVED';
      if (pod.status !== expectedStatus) {
        throw new DiscoveryStateError(`POD ${pod.id} status is ${pod.status}; expected '${expectedStatus}'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!pod.decisionData || pod.decisionData.questionId !== q.id || pod.decisionData.newResolution !== q.resolution) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match question resolution on ${q.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionData.previousResolution !== undefined && pod.decisionData.previousResolution !== (q.resolutionDecision.previousResolution || 'UNRESOLVED')) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData previousResolution does not match question resolution on ${q.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (q.resolution === 'DEFERRED' && pod.decisionData.deferredTarget !== q.resolutionDecision.deferredTarget) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData deferredTarget does not match question ${q.id}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionData.question !== undefined && pod.decisionData.question.trim() !== q.question.trim()) {
        throw new DiscoveryStateError(`POD ${pod.id} authorized question text does not match current question ${q.id} text`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionData.questionFingerprint !== undefined) {
        const expectedHash = `sha256:${crypto.createHash('sha256').update(q.question.trim(), 'utf8').digest('hex')}`;
        if (pod.decisionData.questionFingerprint !== expectedHash) {
          throw new DiscoveryStateError(`POD ${pod.id} questionFingerprint does not match current question ${q.id} hash`, 'DK_DISCOVERY_CORRUPT');
        }
      }
    }

    // Supersession decision
    if (q.supersessionDecision && q.supersessionDecision.decisionId) {
      let pod;
      try {
        pod = resolvePod(q.supersessionDecision.decisionId);
      } catch (err) {
        throw new DiscoveryStateError(`Material question ${q.id} references missing or invalid supersession POD ${q.supersessionDecision.decisionId}: ${err.message}`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.decisionType !== 'QUESTION_SUPERSESSION') {
        throw new DiscoveryStateError(`POD ${pod.id} decisionType is ${pod.decisionType}; expected 'QUESTION_SUPERSESSION'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.provenance !== 'product-owner') {
        throw new DiscoveryStateError(`POD ${pod.id} provenance is ${pod.provenance}; expected 'product-owner'`, 'DK_DISCOVERY_CORRUPT');
      }
      if (pod.status !== 'APPROVED') {
        throw new DiscoveryStateError(`POD ${pod.id} status is ${pod.status}; expected 'APPROVED' for question supersession`, 'DK_DISCOVERY_CORRUPT');
      }
      if (!pod.decisionData || pod.decisionData.questionId !== q.id || pod.decisionData.supersededBy !== q.supersededBy) {
        throw new DiscoveryStateError(`POD ${pod.id} decisionData does not match question supersession on ${q.id}`, 'DK_DISCOVERY_CORRUPT');
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
  // Always validate complete structural and authority state against durable PODs on disk before writing
  validateDiscoveryStateStructure(state);
  validateDiscoveryAuthority(rootDir, state);

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

/**
 * Capture-only candidate requirement recording.
 * Generic capture MUST NEVER create Product Owner authority or PODs.
 * New candidates are strictly born UNRESOLVED.
 */
export function recordRequirementCandidate(rootDir = process.cwd(), {
  id,
  statement,
  materiality = 'MATERIAL',
  scopeDisposition,
  origin,
  resolutionState = 'UNRESOLVED',
  confirmedBy = null,
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
  if (origin === 'USER_CONFIRMED') {
    throw new DiscoveryStateError(
      `Origin 'USER_CONFIRMED' cannot be set at candidate capture. Record original provenance (e.g. USER_STATED, AI_PROPOSED, RESEARCH_DERIVED, ASSUMED) as UNRESOLVED, then use dedicated authority operations to confirm.`,
      'DK_INVALID_ORIGIN'
    );
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

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.requirements.findIndex((r) => r.id.toUpperCase() === id.toUpperCase());
  const now = new Date().toISOString();

  let finalScope;

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

    // Resolution state cannot be mutated via recordRequirementCandidate
    if (resolutionState !== undefined && resolutionState !== null && resolutionState !== existing.resolutionState) {
      throw new DiscoveryStateError(
        `Cannot mutate resolutionState for ${id} via recordRequirementCandidate (existing: ${existing.resolutionState}, attempted: ${resolutionState}). Use dedicated authority operations (confirmRequirementCandidate, adoptRequirementCandidate, rejectRequirementCandidate, supersedeRequirementCandidate).`,
        'DK_ILLEGAL_STATE_TRANSITION'
      );
    }

    // confirmedBy cannot be mutated via recordRequirementCandidate
    if (confirmedBy !== undefined && confirmedBy !== null && confirmedBy !== existing.confirmedBy) {
      throw new DiscoveryStateError(
        `Cannot mutate confirmedBy for ${id} via recordRequirementCandidate. Use dedicated authority operations.`,
        'DK_UNAUTHORIZED_CONFIRMATION'
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

    const reqObj = {
      ...existing,
      updatedAt: now,
    };

    const nextRequirements = [...state.requirements];
    nextRequirements[existingIdx] = reqObj;

    const proposedState = {
      ...state,
      requirements: nextRequirements,
      revision: (state.revision || 0) + 1,
    };

    persistDiscoveryState(proposedState, rootDir);
    return reqObj;
  } else {
    // New candidate creation must strictly be UNRESOLVED without confirmedBy
    if (resolutionState !== 'UNRESOLVED') {
      throw new DiscoveryStateError(
        `New candidate ${id} cannot be directly created as ${resolutionState}. Initial candidate capture must be UNRESOLVED. Use dedicated authority operations after creation.`,
        'DK_ILLEGAL_STATE_TRANSITION'
      );
    }
    if (confirmedBy) {
      throw new DiscoveryStateError(
        `New candidate ${id} cannot specify confirmedBy on initial capture (got ${confirmedBy}). Initial capture must be UNRESOLVED without Product Owner authority.`,
        'DK_UNAUTHORIZED_CONFIRMATION'
      );
    }

    // New MATERIAL candidates must have UNCLASSIFIED scope upon initial recording
    if (materiality === 'MATERIAL') {
      if (scopeDisposition !== undefined && scopeDisposition !== null && scopeDisposition !== 'UNCLASSIFIED') {
        throw new DiscoveryStateError(
          `Initial material candidate ${id} must be UNCLASSIFIED on creation (got ${scopeDisposition}). Use classifyRequirementScope to set scope.`,
          'DK_MATERIAL_SCOPE_REQUIRES_CLASSIFICATION'
        );
      }
      finalScope = 'UNCLASSIFIED';
    } else {
      finalScope = scopeDisposition || 'UNCLASSIFIED';
    }

    const reqObj = {
      id,
      statement: statement.trim(),
      materiality,
      scopeDisposition: finalScope,
      origin,
      resolutionState: 'UNRESOLVED',
      confirmedBy: null,
      linkedPodId: null,
      confirmationDecision: null,
      scopeDecision: null,
      deactivationDecision: null,
      supersessionDecision: null,
      supersedes: null,
      supersededBy: null,
      createdAt: now,
      updatedAt: now,
    };

    const nextRequirements = [...state.requirements, reqObj];
    const proposedState = {
      ...state,
      requirements: nextRequirements,
      revision: (state.revision || 0) + 1,
    };

    persistDiscoveryState(proposedState, rootDir);
    return reqObj;
  }
}

/**
 * Dedicated authoritative requirement confirmation operation.
 * Acts ONLY on an existing candidate, binds exact statement content, and persists immutable POD.
 */
export function confirmRequirementCandidate(rootDir = process.cwd(), {
  id,
  confirmedBy,
  podStatement = null,
} = {}) {
  if (!id || !/^IDEA-REQ-\d+$/i.test(id)) {
    throw new DiscoveryStateError(`Invalid candidate requirement ID: ${id}. Must match IDEA-REQ-xxx`, 'DK_INVALID_REQ_ID');
  }
  if (confirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(`Confirming requirement ${id} requires explicit confirmedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_CONFIRMATION');
  }

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.requirements.findIndex((r) => r.id.toUpperCase() === id.toUpperCase());
  if (existingIdx < 0) {
    throw new DiscoveryStateError(`Candidate ${id} does not exist. Record as UNRESOLVED candidate first.`, 'DK_CANDIDATE_NOT_FOUND');
  }

  const existing = state.requirements[existingIdx];
  if (existing.origin === 'RESEARCH_DERIVED') {
    throw new DiscoveryStateError(`Research-derived candidate ${id} requires explicit adoption via adoptRequirementCandidate`, 'DK_UNAUTHORIZED_CONFIRMATION');
  }
  if (existing.resolutionState !== 'UNRESOLVED') {
    throw new DiscoveryStateError(`Candidate ${id} resolution transition from ${existing.resolutionState} to CONFIRMED is illegal. Only UNRESOLVED candidates can be confirmed.`, 'DK_ILLEGAL_STATE_TRANSITION');
  }

  const now = new Date().toISOString();
  const statementHash = `sha256:${crypto.createHash('sha256').update(existing.statement.trim(), 'utf8').digest('hex')}`;
  const podId = `POD-${id}-CONFIRMED-${String((state.revision || 0) + 1).padStart(3, '0')}`;

  const createdPod = createPODecision({
    id: podId,
    statement: podStatement || `CONFIRMED requirement ${id}`,
    status: 'APPROVED',
    provenance: 'product-owner',
    decisionType: 'REQUIREMENT_CONFIRMATION',
    decisionData: {
      requirementId: id,
      requirementFingerprint: statementHash,
      statement: existing.statement.trim(),
      origin: existing.origin,
      previousResolution: existing.resolutionState,
      newResolution: 'CONFIRMED',
    },
    affectedRequirements: [id],
  });

  const confirmationDecision = {
    previousResolution: existing.resolutionState,
    resolutionState: 'CONFIRMED',
    origin: existing.origin,
    confirmedBy: 'PRODUCT_OWNER',
    decisionId: podId,
    decidedAt: now,
  };

  const updatedReq = {
    ...existing,
    resolutionState: 'CONFIRMED',
    confirmedBy: 'PRODUCT_OWNER',
    linkedPodId: podId,
    confirmationDecision,
    updatedAt: now,
  };

  const nextRequirements = [...state.requirements];
  nextRequirements[existingIdx] = updatedReq;

  const proposedState = {
    ...state,
    requirements: nextRequirements,
    revision: (state.revision || 0) + 1,
  };

  validateDiscoveryStateStructure(proposedState);
  validateDiscoveryAuthority(rootDir, proposedState, [createdPod]);

  persistPODecision(createdPod, rootDir);
  persistDiscoveryState(proposedState, rootDir);

  return updatedReq;
}

/**
 * Dedicated authoritative requirement adoption operation.
 * Acts ONLY on an existing candidate (e.g. RESEARCH_DERIVED), binds exact statement content, and persists immutable POD.
 */
export function adoptRequirementCandidate(rootDir = process.cwd(), {
  id,
  confirmedBy,
  podStatement = null,
} = {}) {
  if (!id || !/^IDEA-REQ-\d+$/i.test(id)) {
    throw new DiscoveryStateError(`Invalid candidate requirement ID: ${id}. Must match IDEA-REQ-xxx`, 'DK_INVALID_REQ_ID');
  }
  if (confirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(`Adopting requirement ${id} requires explicit confirmedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_CONFIRMATION');
  }

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.requirements.findIndex((r) => r.id.toUpperCase() === id.toUpperCase());
  if (existingIdx < 0) {
    throw new DiscoveryStateError(`Candidate ${id} does not exist. Record as UNRESOLVED candidate first.`, 'DK_CANDIDATE_NOT_FOUND');
  }

  const existing = state.requirements[existingIdx];
  if (existing.resolutionState !== 'UNRESOLVED') {
    throw new DiscoveryStateError(`Candidate ${id} resolution transition from ${existing.resolutionState} to ADOPTED is illegal. Only UNRESOLVED candidates can be adopted.`, 'DK_ILLEGAL_STATE_TRANSITION');
  }

  const now = new Date().toISOString();
  const statementHash = `sha256:${crypto.createHash('sha256').update(existing.statement.trim(), 'utf8').digest('hex')}`;
  const podId = `POD-${id}-ADOPTED-${String((state.revision || 0) + 1).padStart(3, '0')}`;

  const createdPod = createPODecision({
    id: podId,
    statement: podStatement || `ADOPTED requirement ${id}`,
    status: 'APPROVED',
    provenance: 'product-owner',
    decisionType: 'REQUIREMENT_ADOPTION',
    decisionData: {
      requirementId: id,
      requirementFingerprint: statementHash,
      statement: existing.statement.trim(),
      origin: existing.origin,
      previousResolution: existing.resolutionState,
      newResolution: 'ADOPTED',
    },
    affectedRequirements: [id],
  });

  const confirmationDecision = {
    previousResolution: existing.resolutionState,
    resolutionState: 'ADOPTED',
    origin: existing.origin,
    confirmedBy: 'PRODUCT_OWNER',
    decisionId: podId,
    decidedAt: now,
  };

  const updatedReq = {
    ...existing,
    resolutionState: 'ADOPTED',
    confirmedBy: 'PRODUCT_OWNER',
    linkedPodId: podId,
    confirmationDecision,
    updatedAt: now,
  };

  const nextRequirements = [...state.requirements];
  nextRequirements[existingIdx] = updatedReq;

  const proposedState = {
    ...state,
    requirements: nextRequirements,
    revision: (state.revision || 0) + 1,
  };

  validateDiscoveryStateStructure(proposedState);
  validateDiscoveryAuthority(rootDir, proposedState, [createdPod]);

  persistPODecision(createdPod, rootDir);
  persistDiscoveryState(proposedState, rootDir);

  return updatedReq;
}

/**
 * Dedicated authoritative requirement rejection operation.
 * Acts ONLY on an existing candidate, binds exact statement content, and persists immutable POD.
 */
export function rejectRequirementCandidate(rootDir = process.cwd(), {
  id,
  confirmedBy,
  reason = null,
  podStatement = null,
} = {}) {
  if (!id || !/^IDEA-REQ-\d+$/i.test(id)) {
    throw new DiscoveryStateError(`Invalid candidate requirement ID: ${id}. Must match IDEA-REQ-xxx`, 'DK_INVALID_REQ_ID');
  }
  if (confirmedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(`Rejecting requirement ${id} requires explicit confirmedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_DEACTIVATION');
  }

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.requirements.findIndex((r) => r.id.toUpperCase() === id.toUpperCase());
  if (existingIdx < 0) {
    throw new DiscoveryStateError(`Candidate ${id} does not exist. Record as UNRESOLVED candidate first.`, 'DK_CANDIDATE_NOT_FOUND');
  }

  const existing = state.requirements[existingIdx];
  if (!isValidRequirementTransition(existing.resolutionState, 'REJECTED')) {
    throw new DiscoveryStateError(`Candidate ${id} resolution transition from ${existing.resolutionState} to REJECTED is illegal`, 'DK_ILLEGAL_STATE_TRANSITION');
  }

  const now = new Date().toISOString();
  const statementHash = `sha256:${crypto.createHash('sha256').update(existing.statement.trim(), 'utf8').digest('hex')}`;
  const podId = `POD-${id}-DEACT-${String((state.revision || 0) + 1).padStart(3, '0')}`;

  const createdPod = createPODecision({
    id: podId,
    statement: podStatement || `Deactivated/Rejected material requirement ${id}`,
    status: 'REJECTED',
    provenance: 'product-owner',
    decisionType: 'REQUIREMENT_REJECTION',
    decisionData: {
      requirementId: id,
      requirementFingerprint: statementHash,
      statement: existing.statement.trim(),
      origin: existing.origin,
      previousResolution: existing.resolutionState,
      newResolution: 'REJECTED',
      reason: reason || null,
    },
    affectedRequirements: [id],
  });

  const deactivationDecision = {
    resolutionState: 'REJECTED',
    confirmedBy: 'PRODUCT_OWNER',
    decisionId: podId,
    decidedAt: now,
  };

  const updatedReq = {
    ...existing,
    scopeDisposition: 'EXCLUDED',
    resolutionState: 'REJECTED',
    confirmedBy: 'PRODUCT_OWNER',
    linkedPodId: podId,
    deactivationDecision,
    updatedAt: now,
  };

  const nextRequirements = [...state.requirements];
  nextRequirements[existingIdx] = updatedReq;

  const proposedState = {
    ...state,
    requirements: nextRequirements,
    revision: (state.revision || 0) + 1,
  };

  validateDiscoveryStateStructure(proposedState);
  validateDiscoveryAuthority(rootDir, proposedState, [createdPod]);

  persistPODecision(createdPod, rootDir);
  persistDiscoveryState(proposedState, rootDir);

  return updatedReq;
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

  if (newCandidateData.resolutionState && newCandidateData.resolutionState !== 'UNRESOLVED') {
    throw new DiscoveryStateError('New candidate in supersession must be initialized as UNRESOLVED. Use confirmRequirementCandidate or adoptRequirementCandidate after supersession.', 'DK_ILLEGAL_STATE_TRANSITION');
  }

  const now = new Date().toISOString();
  const oldStatementHash = `sha256:${crypto.createHash('sha256').update(oldReq.statement.trim(), 'utf8').digest('hex')}`;
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
      decisionData: {
        requirementId: oldId,
        requirementFingerprint: oldStatementHash,
        statement: oldReq.statement.trim(),
        supersededBy: newId,
      },
      affectedRequirements: [oldId, newId],
    });
    supersessionDecision = {
      supersededBy: newId,
      confirmedBy: newCandidateData.confirmedBy,
      decisionId: podId,
      decidedAt: now,
    };
  }

  const updatedOld = {
    ...oldReq,
    resolutionState: 'SUPERSEDED',
    supersededBy: newId,
    supersessionDecision,
    linkedPodId: createdSupersedePod ? createdSupersedePod.id : oldReq.linkedPodId,
    updatedAt: now,
  };

  const newReq = {
    id: newId,
    statement: newStatement.trim(),
    materiality: newMateriality,
    scopeDisposition: newScope,
    origin: newOrigin,
    resolutionState: 'UNRESOLVED',
    confirmedBy: null,
    linkedPodId: null,
    confirmationDecision: null,
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

  const inMemoryPods = [createdSupersedePod].filter(Boolean);

  // Phase 1: Validate entire proposed state structure and authority BEFORE any POD side effects
  validateDiscoveryStateStructure(proposedStateCheck);
  validateDiscoveryAuthority(rootDir, proposedStateCheck, inMemoryPods);

  // Phase 2: Persist PODs only after successful validation
  if (createdSupersedePod) {
    persistPODecision(createdSupersedePod, rootDir);
  }

  // Phase 3: Persist final state
  persistDiscoveryState(proposedStateCheck, rootDir);

  return {
    superseded: updatedOld,
    created: newReq,
  };
}

/**
 * Capture-only open question recording.
 * Generic capture MUST NEVER create Product Owner authority or PODs.
 * New questions are strictly born UNRESOLVED.
 */
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

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.openQuestions.findIndex((q) => q.id.toUpperCase() === id.toUpperCase());
  const now = new Date().toISOString();

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
    if (resolution !== undefined && resolution !== null && resolution !== existing.resolution) {
      throw new DiscoveryStateError(
        `Cannot mutate resolution for ${id} via recordOpenQuestion (existing: ${existing.resolution}, attempted: ${resolution}). Use resolveOpenQuestion or supersedeOpenQuestion.`,
        'DK_ILLEGAL_STATE_TRANSITION'
      );
    }
    if (resolvedBy !== undefined && resolvedBy !== null && resolvedBy !== existing.resolvedBy) {
      throw new DiscoveryStateError(
        `Cannot mutate resolvedBy for ${id} via recordOpenQuestion. Use resolveOpenQuestion.`,
        'DK_UNAUTHORIZED_RESOLUTION'
      );
    }

    const qObj = {
      ...existing,
      notes: notes !== null && notes !== undefined ? notes : existing.notes,
      updatedAt: now,
    };

    const nextQuestions = [...state.openQuestions];
    nextQuestions[existingIdx] = qObj;

    const proposedState = {
      ...state,
      openQuestions: nextQuestions,
      revision: (state.revision || 0) + 1,
    };

    persistDiscoveryState(proposedState, rootDir);
    return qObj;
  } else {
    // New question creation must be UNRESOLVED without resolvedBy
    if (resolution !== 'UNRESOLVED') {
      throw new DiscoveryStateError(
        `New question ${id} cannot be directly created as ${resolution}. Initial question capture must be UNRESOLVED. Use resolveOpenQuestion after creation.`,
        'DK_ILLEGAL_STATE_TRANSITION'
      );
    }
    if (resolvedBy) {
      throw new DiscoveryStateError(
        `New question ${id} cannot specify resolvedBy on initial capture (got ${resolvedBy}). Initial capture must be UNRESOLVED without Product Owner authority.`,
        'DK_UNAUTHORIZED_RESOLUTION'
      );
    }

    const qObj = {
      id,
      question: question.trim(),
      materiality,
      resolution: 'UNRESOLVED',
      deferredTarget: null,
      resolvedBy: null,
      notes,
      resolutionDecision: null,
      supersessionDecision: null,
      supersedes: null,
      supersededBy: null,
      createdAt: now,
      updatedAt: now,
    };

    const nextQuestions = [...state.openQuestions, qObj];
    const proposedState = {
      ...state,
      openQuestions: nextQuestions,
      revision: (state.revision || 0) + 1,
    };

    persistDiscoveryState(proposedState, rootDir);
    return qObj;
  }
}

/**
 * Dedicated authoritative open question resolution operation.
 * Acts ONLY on an existing question, binds exact question content, and persists immutable POD.
 */
export function resolveOpenQuestion(rootDir = process.cwd(), {
  id,
  resolution,
  resolvedBy,
  deferredTarget = null,
  notes = null,
  podStatement = null,
} = {}) {
  if (!id || !/^IDEA-Q-\d+$/i.test(id)) {
    throw new DiscoveryStateError(`Invalid question ID: ${id}. Must match IDEA-Q-xxx`, 'DK_INVALID_QUESTION_ID');
  }
  if (!['ANSWERED', 'DEFERRED', 'REJECTED'].includes(resolution)) {
    throw new DiscoveryStateError(`Invalid question resolution: ${resolution}. Must be ANSWERED, DEFERRED, or REJECTED`, 'DK_INVALID_QUESTION_RESOLUTION');
  }

  const state = loadDiscoveryState(rootDir);
  const existingIdx = state.openQuestions.findIndex((q) => q.id.toUpperCase() === id.toUpperCase());
  if (existingIdx < 0) {
    throw new DiscoveryStateError(`Question ${id} does not exist. Record as UNRESOLVED question first.`, 'DK_QUESTION_NOT_FOUND');
  }

  const existing = state.openQuestions[existingIdx];
  if (!isValidQuestionTransition(existing.resolution, resolution)) {
    throw new DiscoveryStateError(`Question ${id} transition from ${existing.resolution} to ${resolution} is illegal`, 'DK_ILLEGAL_STATE_TRANSITION');
  }

  if (resolvedBy !== 'PRODUCT_OWNER') {
    throw new DiscoveryStateError(`Resolving question ${id} as ${resolution} requires explicit resolvedBy = 'PRODUCT_OWNER'`, 'DK_UNAUTHORIZED_RESOLUTION');
  }

  const defTarget = resolution === 'DEFERRED' ? (deferredTarget || 'Future Ideas (Explicitly Deferred)') : null;
  const now = new Date().toISOString();
  const qHash = `sha256:${crypto.createHash('sha256').update(existing.question.trim(), 'utf8').digest('hex')}`;
  const podId = `POD-${id}-RES-${String((state.revision || 0) + 1).padStart(3, '0')}`;

  const createdPod = createPODecision({
    id: podId,
    statement: podStatement || `${resolution} question ${id}`,
    status: resolution === 'REJECTED' ? 'REJECTED' : 'APPROVED',
    provenance: 'product-owner',
    decisionType: 'QUESTION_RESOLUTION',
    decisionData: {
      questionId: id,
      questionFingerprint: qHash,
      question: existing.question.trim(),
      previousResolution: existing.resolution,
      newResolution: resolution,
      deferredTarget: defTarget,
    },
    affectedRequirements: [],
  });

  const resolutionDecision = {
    previousResolution: existing.resolution,
    resolution,
    resolvedBy: 'PRODUCT_OWNER',
    decisionId: podId,
    decidedAt: now,
    deferredTarget: defTarget,
  };

  const updatedQ = {
    ...existing,
    resolution,
    deferredTarget: defTarget,
    resolvedBy: 'PRODUCT_OWNER',
    notes: notes !== null && notes !== undefined ? notes : existing.notes,
    resolutionDecision,
    updatedAt: now,
  };

  const nextQuestions = [...state.openQuestions];
  nextQuestions[existingIdx] = updatedQ;

  const proposedState = {
    ...state,
    openQuestions: nextQuestions,
    revision: (state.revision || 0) + 1,
  };

  validateDiscoveryStateStructure(proposedState);
  validateDiscoveryAuthority(rootDir, proposedState, [createdPod]);

  persistPODecision(createdPod, rootDir);
  persistDiscoveryState(proposedState, rootDir);

  return updatedQ;
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

  // Superseding ANY material question requires explicit resolvedBy/confirmedBy = 'PRODUCT_OWNER'
  const authorityBy = newQuestionData.resolvedBy || newQuestionData.confirmedBy;
  if (oldQ.materiality === 'MATERIAL' && authorityBy !== 'PRODUCT_OWNER') {
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

  if (newQuestionData.resolution && newQuestionData.resolution !== 'UNRESOLVED') {
    throw new DiscoveryStateError('New question in supersession must be initialized as UNRESOLVED.', 'DK_ILLEGAL_STATE_TRANSITION');
  }

  const now = new Date().toISOString();
  const oldQuestionHash = `sha256:${crypto.createHash('sha256').update(oldQ.question.trim(), 'utf8').digest('hex')}`;
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
      decisionData: {
        questionId: oldId,
        questionFingerprint: oldQuestionHash,
        question: oldQ.question.trim(),
        supersededBy: newId,
      },
      affectedRequirements: [],
    });
    supersessionDecision = {
      supersededBy: newId,
      resolvedBy: authorityBy,
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
    resolution: 'UNRESOLVED',
    deferredTarget: null,
    resolvedBy: null,
    notes: newQuestionData.notes || null,
    resolutionDecision: null,
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

  const inMemoryPods = [createdSupersedePod].filter(Boolean);

  // Validate proposed state structure and authority before writing POD
  validateDiscoveryStateStructure(proposedStateCheck);
  validateDiscoveryAuthority(rootDir, proposedStateCheck, inMemoryPods);

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
  const statementHash = `sha256:${crypto.createHash('sha256').update(existing.statement.trim(), 'utf8').digest('hex')}`;

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
        requirementFingerprint: statementHash,
        statement: existing.statement.trim(),
        previousScope: oldScope,
        newScope: scopeDisposition,
      },
      affectedRequirements: [id],
    });
    scopeDecision = {
      previousDisposition: oldScope,
      disposition: scopeDisposition,
      confirmedBy,
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

  const inMemoryPods = [createdPod].filter(Boolean);

  // Phase 1: Validate entire proposed state structure and authority BEFORE writing POD or file to disk
  validateDiscoveryStateStructure(proposedState);
  validateDiscoveryAuthority(rootDir, proposedState, inMemoryPods);

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
