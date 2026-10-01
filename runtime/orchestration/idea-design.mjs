/**
 * DKF IDEA Authority — Product Owner-bound Design Authority disposition state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createPODecision, persistPODecision } from './po-decisions.mjs';

export const IDEA_DESIGN_SCHEMA_VERSION = '1.0.0';
export const DESIGN_DISPOSITIONS = Object.freeze([
  'ATTACH_REFERENCES',
  'USE_EXISTING_DESIGN_MD',
  'DERIVE_EXISTING_APPLICATION',
  'CREATE_NEW_DIRECTION',
  'DEFERRED',
  'NOT_REQUIRED',
]);

export class IdeaDesignStateError extends Error {
  constructor(message, code = 'DK_IDEA_DESIGN_ERROR') {
    super(message);
    this.name = 'IdeaDesignStateError';
    this.code = code;
  }
}

function fail(message, code = 'DK_IDEA_DESIGN_INVALID') {
  throw new IdeaDesignStateError(message, code);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function fingerprint(state) {
  const payload = {
    schemaVersion: state.schemaVersion,
    revision: state.revision,
    applicable: state.applicable,
    applicabilityDecisionId: state.applicabilityDecisionId,
    disposition: state.disposition,
    dispositionDecisionId: state.dispositionDecisionId,
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex')}`;
}

export function getIdeaDesignStatePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea', 'design-state.json');
}

function emptyState() {
  const state = {
    schemaVersion: IDEA_DESIGN_SCHEMA_VERSION,
    revision: 0,
    applicable: null,
    applicabilityDecisionId: null,
    disposition: null,
    dispositionDecisionId: null,
    fingerprint: null,
    updatedAt: null,
  };
  state.fingerprint = fingerprint(state);
  return state;
}

export function validateIdeaDesignState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) fail('Design state must be an object', 'DK_IDEA_DESIGN_CORRUPT');
  if (state.schemaVersion !== IDEA_DESIGN_SCHEMA_VERSION) fail('Unsupported design state schemaVersion', 'DK_IDEA_DESIGN_CORRUPT');
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) fail('Invalid design state revision', 'DK_IDEA_DESIGN_CORRUPT');
  if (![null, true, false].includes(state.applicable)) fail('Design applicability must be true, false, or unresolved', 'DK_IDEA_DESIGN_CORRUPT');
  if (state.disposition !== null && !DESIGN_DISPOSITIONS.includes(state.disposition)) fail('Invalid design disposition', 'DK_IDEA_DESIGN_CORRUPT');
  if (state.applicable === false && state.disposition !== 'NOT_REQUIRED') fail('Non-visual projects must use NOT_REQUIRED design disposition', 'DK_IDEA_DESIGN_CORRUPT');
  if (state.applicable === true && state.disposition === 'NOT_REQUIRED') fail('Visual projects cannot use NOT_REQUIRED design disposition', 'DK_IDEA_DESIGN_CORRUPT');
  if (state.applicable !== null && !/^POD-[A-Za-z0-9._-]+$/i.test(state.applicabilityDecisionId || '')) fail('Resolved applicability needs Product Owner decision evidence', 'DK_IDEA_DESIGN_CORRUPT');
  if (state.disposition !== null && !/^POD-[A-Za-z0-9._-]+$/i.test(state.dispositionDecisionId || '')) fail('Resolved design disposition needs Product Owner decision evidence', 'DK_IDEA_DESIGN_CORRUPT');
  const expected = fingerprint(state);
  if (state.fingerprint !== expected) fail('Design state fingerprint mismatch', 'DK_IDEA_DESIGN_FINGERPRINT_MISMATCH');
  return true;
}

function writeState(rootDir, state) {
  validateIdeaDesignState(state);
  const filePath = getIdeaDesignStatePath(rootDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, filePath);
}

export function loadIdeaDesignState(rootDir = process.cwd()) {
  const filePath = getIdeaDesignStatePath(rootDir);
  if (!fs.existsSync(filePath)) return emptyState();
  try {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validateIdeaDesignState(state);
    return state;
  } catch (error) {
    if (error instanceof IdeaDesignStateError) throw error;
    fail(`Unable to load IDEA design state: ${error.message}`, 'DK_IDEA_DESIGN_CORRUPT');
  }
}

function decision(rootDir, id, statement) {
  const item = createPODecision({
    id,
    statement,
    status: 'APPROVED',
    provenance: 'product-owner',
    affectedDesignDecisions: ['IDEA_DESIGN_AUTHORITY'],
  });
  persistPODecision(item, rootDir);
  return item;
}

export function setIdeaDesignApplicability(rootDir = process.cwd(), {
  applicable,
  authority,
} = {}) {
  if (authority !== 'PRODUCT_OWNER') fail("Explicit authority='PRODUCT_OWNER' is required", 'DK_IDEA_UNAUTHORIZED');
  if (typeof applicable !== 'boolean') fail('Design applicability must be boolean');
  const current = loadIdeaDesignState(rootDir);
  if (current.applicable !== null) fail('Design applicability is already resolved', 'DK_IDEA_DESIGN_ALREADY_RESOLVED');

  const nextRevision = current.revision + 1;
  const pod = decision(
    rootDir,
    `POD-IDEA-DESIGN-APPLICABILITY-${String(nextRevision).padStart(3, '0')}`,
    `Product Owner classified the IDEA as ${applicable ? 'visual UI applicable' : 'non-visual / Design Authority not applicable'}`,
  );
  const next = {
    ...current,
    revision: nextRevision,
    applicable,
    applicabilityDecisionId: pod.id,
    disposition: applicable ? null : 'NOT_REQUIRED',
    dispositionDecisionId: applicable ? null : pod.id,
    updatedAt: new Date().toISOString(),
  };
  next.fingerprint = fingerprint(next);
  writeState(rootDir, next);
  return next;
}

export function setIdeaDesignDisposition(rootDir = process.cwd(), {
  disposition,
  authority,
} = {}) {
  if (authority !== 'PRODUCT_OWNER') fail("Explicit authority='PRODUCT_OWNER' is required", 'DK_IDEA_UNAUTHORIZED');
  const current = loadIdeaDesignState(rootDir);
  if (current.applicable !== true) fail('Design disposition is only valid after visual applicability is confirmed', 'DK_IDEA_DESIGN_NOT_APPLICABLE');
  if (current.disposition !== null) fail('Design disposition is already resolved', 'DK_IDEA_DESIGN_ALREADY_RESOLVED');
  if (!DESIGN_DISPOSITIONS.includes(disposition) || disposition === 'NOT_REQUIRED') fail('Invalid visual design disposition');

  const nextRevision = current.revision + 1;
  const pod = decision(
    rootDir,
    `POD-IDEA-DESIGN-DISPOSITION-${String(nextRevision).padStart(3, '0')}`,
    `Product Owner selected IDEA design disposition ${disposition}`,
  );
  const next = {
    ...current,
    revision: nextRevision,
    disposition,
    dispositionDecisionId: pod.id,
    updatedAt: new Date().toISOString(),
  };
  next.fingerprint = fingerprint(next);
  writeState(rootDir, next);
  return next;
}
