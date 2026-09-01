import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const POD_SCHEMA_VERSION = '1.0.0';

export class PODecisionError extends Error {
  constructor(message, code = 'DK_POD_ERROR', details = null) {
    super(message);
    this.name = 'PODecisionError';
    this.code = code;
    this.details = details;
  }
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function canonicalJson(obj) {
  if (Array.isArray(obj)) return `[${obj.map(canonicalJson).join(',')}]`;
  if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(obj);
}

export function computePODecisionFingerprint(decision) {
  const norm = {
    schemaVersion: decision.schemaVersion ?? POD_SCHEMA_VERSION,
    id: decision.id,
    statement: decision.statement,
    status: decision.status,
    provenance: decision.provenance,
    decisionType: decision.decisionType ?? null,
    decisionData: decision.decisionData ? canonicalJson(decision.decisionData) : null,
    supersedes: decision.supersedes ?? null,
    supersededBy: decision.supersededBy ?? null,
    affectedRequirements: Array.isArray(decision.affectedRequirements) ? [...decision.affectedRequirements].sort() : [],
    affectedAcceptanceCriteria: Array.isArray(decision.affectedAcceptanceCriteria) ? [...decision.affectedAcceptanceCriteria].sort() : [],
    affectedArchitectureDecisions: Array.isArray(decision.affectedArchitectureDecisions) ? [...decision.affectedArchitectureDecisions].sort() : [],
    affectedDesignDecisions: Array.isArray(decision.affectedDesignDecisions) ? [...decision.affectedDesignDecisions].sort() : [],
    createdAt: decision.createdAt ?? null,
  };
  return `sha256:${sha256(canonicalJson(norm))}`;
}

export function validatePODecision(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new PODecisionError('Product Owner Decision must be an object', 'DK_POD_INVALID');
  }

  if (decision.schemaVersion !== POD_SCHEMA_VERSION) {
    throw new PODecisionError(`Invalid POD schemaVersion: ${decision.schemaVersion}`, 'DK_POD_INVALID');
  }

  if (typeof decision.id !== 'string' || !/^POD-[A-Za-z0-9._-]+$/i.test(decision.id)) {
    throw new PODecisionError(`Invalid decision ID: ${decision.id}`, 'DK_POD_INVALID');
  }

  if (typeof decision.statement !== 'string' || !decision.statement.trim()) {
    throw new PODecisionError('Decision statement is required', 'DK_POD_INVALID');
  }

  if (!['APPROVED', 'SUPERSEDED', 'REJECTED', 'PROPOSED'].includes(decision.status)) {
    throw new PODecisionError(`Unsupported decision status: ${decision.status}`, 'DK_POD_INVALID');
  }

  if (decision.provenance !== 'product-owner') {
    throw new PODecisionError(`Invalid decision provenance: ${decision.provenance}. Must be 'product-owner'`, 'DK_POD_INVALID');
  }

  if (decision.createdAt && isNaN(Date.parse(decision.createdAt))) {
    throw new PODecisionError(`Invalid createdAt timestamp: ${decision.createdAt}`, 'DK_POD_INVALID');
  }

  if (decision.decisionType !== undefined && decision.decisionType !== null) {
    const validTypes = [
      'REQUIREMENT_SCOPE',
      'REQUIREMENT_REJECTION',
      'REQUIREMENT_SUPERSESSION',
      'QUESTION_SUPERSESSION',
      'QUESTION_RESOLUTION',
    ];
    if (!validTypes.includes(decision.decisionType)) {
      throw new PODecisionError(`Invalid decisionType: ${decision.decisionType}`, 'DK_POD_INVALID');
    }
    if (decision.decisionData !== null && (typeof decision.decisionData !== 'object' || Array.isArray(decision.decisionData))) {
      throw new PODecisionError('decisionData must be an object when present', 'DK_POD_INVALID');
    }
  }

  const expectedFingerprint = computePODecisionFingerprint(decision);
  if (!decision.fingerprint || decision.fingerprint !== expectedFingerprint) {
    throw new PODecisionError('Decision fingerprint does not match content', 'DK_POD_FINGERPRINT_MISMATCH', {
      expected: expectedFingerprint,
      actual: decision.fingerprint,
    });
  }

  return true;
}

export function createPODecision({
  id,
  statement,
  status = 'APPROVED',
  provenance = 'product-owner',
  decisionType = null,
  decisionData = null,
  supersedes = null,
  affectedRequirements = [],
  affectedAcceptanceCriteria = [],
  affectedArchitectureDecisions = [],
  affectedDesignDecisions = [],
  createdAt = new Date().toISOString(),
} = {}) {
  const decision = {
    schemaVersion: POD_SCHEMA_VERSION,
    id: id.trim(),
    statement: statement.trim(),
    status,
    provenance,
    decisionType,
    decisionData: decisionData ? { ...decisionData } : null,
    supersedes: supersedes ? supersedes.trim() : null,
    supersededBy: null,
    affectedRequirements: Array.isArray(affectedRequirements) ? [...new Set(affectedRequirements)] : [],
    affectedAcceptanceCriteria: Array.isArray(affectedAcceptanceCriteria) ? [...new Set(affectedAcceptanceCriteria)] : [],
    affectedArchitectureDecisions: Array.isArray(affectedArchitectureDecisions) ? [...new Set(affectedArchitectureDecisions)] : [],
    affectedDesignDecisions: Array.isArray(affectedDesignDecisions) ? [...new Set(affectedDesignDecisions)] : [],
    createdAt,
  };

  decision.fingerprint = computePODecisionFingerprint(decision);
  validatePODecision(decision);
  return decision;
}

export function supersedePODecision(originalDecision, newDecisionId) {
  validatePODecision(originalDecision);
  if (originalDecision.status === 'SUPERSEDED') {
    throw new PODecisionError(`Decision ${originalDecision.id} is already superseded by ${originalDecision.supersededBy}`, 'DK_POD_ALREADY_SUPERSEDED');
  }

  const updated = {
    ...originalDecision,
    status: 'SUPERSEDED',
    supersededBy: newDecisionId.trim(),
  };
  updated.fingerprint = computePODecisionFingerprint(updated);
  return updated;
}

export function getPODecisionStorePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'decisions');
}

export function persistPODecision(decision, rootDir = process.cwd()) {
  validatePODecision(decision);
  const storeDir = getPODecisionStorePath(rootDir);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }
  const filePath = path.join(storeDir, `${decision.id}.json`);

  if (fs.existsSync(filePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      validatePODecision(existing);
      if (existing.fingerprint === decision.fingerprint) {
        return filePath; // Idempotent success
      }
    } catch (_) {}
    throw new PODecisionError(`Cannot overwrite existing Product Owner Decision ${decision.id} with different content`, 'DK_POD_IMMUTABILITY_VIOLATION');
  }

  fs.writeFileSync(filePath, `${JSON.stringify(decision, null, 2)}\n`, 'utf8');
  return filePath;
}

export function loadPODecisionById(rootDir = process.cwd(), id) {
  if (!id || typeof id !== 'string' || !/^POD-[A-Za-z0-9._-]+$/i.test(id)) {
    throw new PODecisionError(`Invalid decision ID format: ${id}`, 'DK_POD_INVALID_ID');
  }
  const storeDir = getPODecisionStorePath(rootDir);
  const filePath = path.join(storeDir, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    throw new PODecisionError(`Product Owner Decision ${id} does not exist at ${filePath}`, 'DK_POD_NOT_FOUND');
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validatePODecision(data);
    return data;
  } catch (err) {
    if (err instanceof PODecisionError) throw err;
    throw new PODecisionError(`Failed to load POD ${id}: ${err.message}`, 'DK_POD_CORRUPT');
  }
}

export function loadPODecisions(rootDir = process.cwd()) {
  const storeDir = getPODecisionStorePath(rootDir);
  if (!fs.existsSync(storeDir)) {
    return [];
  }
  const files = fs.readdirSync(storeDir).filter((f) => f.endsWith('.json'));
  const decisions = [];
  for (const file of files) {
    const fullPath = path.join(storeDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      validatePODecision(data);
      decisions.push(data);
    } catch (err) {
      if (err instanceof PODecisionError) throw err;
      throw new PODecisionError(`Failed to load PO decision from ${file}: ${err.message}`, 'DK_POD_CORRUPT');
    }
  }
  return decisions;
}
