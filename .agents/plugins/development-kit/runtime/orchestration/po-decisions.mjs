import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const POD_SCHEMA_VERSION = '1.0.0';

export class PODecisionError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'PODecisionError';
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
    id: decision.id,
    statement: decision.statement,
    status: decision.status,
    supersedes: decision.supersedes ?? null,
    affectedRequirements: Array.isArray(decision.affectedRequirements) ? [...decision.affectedRequirements].sort() : [],
    affectedAcceptanceCriteria: Array.isArray(decision.affectedAcceptanceCriteria) ? [...decision.affectedAcceptanceCriteria].sort() : [],
    affectedArchitectureDecisions: Array.isArray(decision.affectedArchitectureDecisions) ? [...decision.affectedArchitectureDecisions].sort() : [],
    affectedDesignDecisions: Array.isArray(decision.affectedDesignDecisions) ? [...decision.affectedDesignDecisions].sort() : [],
  };
  return `sha256:${sha256(canonicalJson(norm))}`;
}

export function validatePODecision(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new PODecisionError('Product Owner Decision must be an object');
  }

  if (typeof decision.id !== 'string' || !/^POD-[A-Za-z0-9._-]+$/i.test(decision.id)) {
    throw new PODecisionError(`Invalid decision ID: ${decision.id}`);
  }

  if (typeof decision.statement !== 'string' || !decision.statement.trim()) {
    throw new PODecisionError('Decision statement is required');
  }

  if (!['APPROVED', 'SUPERSEDED', 'REJECTED', 'PROPOSED'].includes(decision.status)) {
    throw new PODecisionError(`Unsupported decision status: ${decision.status}`);
  }

  const expectedFingerprint = computePODecisionFingerprint(decision);
  if (decision.fingerprint && decision.fingerprint !== expectedFingerprint) {
    throw new PODecisionError('Decision fingerprint does not match content', {
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
    throw new PODecisionError(`Decision ${originalDecision.id} is already superseded by ${originalDecision.supersededBy}`);
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
  fs.writeFileSync(filePath, `${JSON.stringify(decision, null, 2)}\n`, 'utf8');
  return filePath;
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
      throw new PODecisionError(`Failed to load PO decision from ${file}: ${err.message}`);
    }
  }
  return decisions;
}
