/**
 * DKF IDEA Authority — discovery state, provenance, transitions and crash-safe journal.
 *
 * Journal-first persistence guarantees that an interrupted state-file write can be
 * recovered from the final valid journal entry on restart.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createPODecision, persistPODecision } from './po-decisions.mjs';

export const IDEA_DISCOVERY_SCHEMA_VERSION = '1.0.0';
export const IDEA_DISCOVERY_JOURNAL_SCHEMA_VERSION = '1.0.0';

export const REQUIREMENT_ORIGINS = Object.freeze([
  'USER_STATED',
  'USER_CONFIRMED',
  'AI_PROPOSED',
  'RESEARCH_DERIVED',
  'ASSUMED',
]);

export const REQUIREMENT_RESOLUTIONS = Object.freeze([
  'UNRESOLVED',
  'CONFIRMED',
  'ADOPTED',
  'DEFERRED',
  'REJECTED',
  'SUPERSEDED',
]);

export const SCOPE_DISPOSITIONS = Object.freeze([
  'UNCLASSIFIED',
  'MUST',
  'SHOULD',
  'FUTURE',
  'EXCLUDED',
]);

export const QUESTION_RESOLUTIONS = Object.freeze([
  'UNRESOLVED',
  'ANSWERED',
  'DEFERRED',
  'REJECTED',
  'SUPERSEDED',
]);

export class IdeaDiscoveryError extends Error {
  constructor(message, code = 'DK_IDEA_DISCOVERY_ERROR', details = null) {
    super(message);
    this.name = 'IdeaDiscoveryError';
    this.code = code;
    this.details = details;
  }
}

function fail(message, code = 'DK_IDEA_DISCOVERY_INVALID', details = null) {
  throw new IdeaDiscoveryError(message, code, details);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, filePath);
}

export function getIdeaDirectory(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea');
}

export function getDiscoveryPath(rootDir = process.cwd()) {
  return path.join(getIdeaDirectory(rootDir), 'discovery.json');
}

export function getDiscoveryJournalPath(rootDir = process.cwd()) {
  return path.join(getIdeaDirectory(rootDir), 'discovery-journal.json');
}

function normalizedStatePayload(state) {
  return {
    schemaVersion: state.schemaVersion,
    revision: state.revision,
    requirements: state.requirements,
    openQuestions: state.openQuestions,
  };
}

export function computeDiscoveryFingerprint(state) {
  return sha(normalizedStatePayload(state));
}

function emptyState() {
  const state = {
    schemaVersion: IDEA_DISCOVERY_SCHEMA_VERSION,
    revision: 0,
    requirements: [],
    openQuestions: [],
    fingerprint: null,
    updatedAt: null,
  };
  state.fingerprint = computeDiscoveryFingerprint(state);
  return state;
}

function validateTimestamp(value, label) {
  if (value !== null && value !== undefined && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) {
    fail(`${label} must be an ISO-compatible timestamp`, 'DK_IDEA_DISCOVERY_CORRUPT');
  }
}

export function validateDiscoveryState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    fail('Discovery state must be an object', 'DK_IDEA_DISCOVERY_CORRUPT');
  }
  const allowed = new Set(['schemaVersion', 'revision', 'requirements', 'openQuestions', 'fingerprint', 'updatedAt']);
  for (const key of Object.keys(state)) if (!allowed.has(key)) fail(`Unknown discovery property: ${key}`, 'DK_IDEA_DISCOVERY_CORRUPT');
  if (state.schemaVersion !== IDEA_DISCOVERY_SCHEMA_VERSION) fail('Unsupported discovery schemaVersion', 'DK_IDEA_DISCOVERY_CORRUPT');
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) fail('Invalid discovery revision', 'DK_IDEA_DISCOVERY_CORRUPT');
  if (!Array.isArray(state.requirements) || !Array.isArray(state.openQuestions)) fail('Discovery collections must be arrays', 'DK_IDEA_DISCOVERY_CORRUPT');

  const requirementIds = new Set();
  for (const req of state.requirements) {
    if (!req || typeof req !== 'object' || Array.isArray(req)) fail('Requirement must be an object', 'DK_IDEA_DISCOVERY_CORRUPT');
    if (typeof req.id !== 'string' || !/^IDEA-REQ-\d{3,}$/.test(req.id)) fail(`Invalid requirement id: ${req.id}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (requirementIds.has(req.id)) fail(`Duplicate requirement id: ${req.id}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    requirementIds.add(req.id);
    if (typeof req.statement !== 'string' || !req.statement.trim()) fail(`Requirement ${req.id} needs a statement`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (!REQUIREMENT_ORIGINS.includes(req.origin)) fail(`Invalid requirement origin: ${req.origin}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (!['MATERIAL', 'NON_MATERIAL'].includes(req.materiality)) fail(`Invalid requirement materiality: ${req.materiality}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (!REQUIREMENT_RESOLUTIONS.includes(req.resolutionState)) fail(`Invalid requirement resolution: ${req.resolutionState}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (!SCOPE_DISPOSITIONS.includes(req.scopeDisposition)) fail(`Invalid requirement scope: ${req.scopeDisposition}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (['CONFIRMED', 'ADOPTED', 'DEFERRED', 'REJECTED', 'SUPERSEDED'].includes(req.resolutionState) && req.resolvedBy !== 'PRODUCT_OWNER') {
      fail(`Requirement ${req.id} authoritative transition requires PRODUCT_OWNER`, 'DK_IDEA_DISCOVERY_CORRUPT');
    }
    if (req.scopeDisposition !== 'UNCLASSIFIED' && req.scopeConfirmedBy !== 'PRODUCT_OWNER') {
      fail(`Requirement ${req.id} scope requires PRODUCT_OWNER authority`, 'DK_IDEA_DISCOVERY_CORRUPT');
    }
    if (req.resolutionState === 'REJECTED' && req.scopeDisposition === 'MUST') {
      fail(`Rejected requirement ${req.id} cannot be MUST`, 'DK_IDEA_DISCOVERY_CORRUPT');
    }
    if (req.supersededBy && (!/^IDEA-REQ-\d{3,}$/.test(req.supersededBy) || req.resolutionState !== 'SUPERSEDED')) {
      fail(`Invalid supersession on ${req.id}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    }
    validateTimestamp(req.createdAt, `${req.id}.createdAt`);
    validateTimestamp(req.updatedAt, `${req.id}.updatedAt`);
  }
  for (const req of state.requirements) {
    if (req.supersededBy && !requirementIds.has(req.supersededBy)) fail(`Dangling supersededBy on ${req.id}`, 'DK_IDEA_DISCOVERY_CORRUPT');
  }

  const questionIds = new Set();
  for (const question of state.openQuestions) {
    if (!question || typeof question !== 'object' || Array.isArray(question)) fail('Open question must be an object', 'DK_IDEA_DISCOVERY_CORRUPT');
    if (typeof question.id !== 'string' || !/^IDEA-Q-\d{3,}$/.test(question.id)) fail(`Invalid question id: ${question.id}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (questionIds.has(question.id)) fail(`Duplicate question id: ${question.id}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    questionIds.add(question.id);
    if (typeof question.question !== 'string' || !question.question.trim()) fail(`Question ${question.id} needs text`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (!['MATERIAL', 'NON_MATERIAL'].includes(question.materiality)) fail(`Invalid question materiality: ${question.materiality}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (!QUESTION_RESOLUTIONS.includes(question.resolution)) fail(`Invalid question resolution: ${question.resolution}`, 'DK_IDEA_DISCOVERY_CORRUPT');
    if (question.resolution !== 'UNRESOLVED' && question.resolvedBy !== 'PRODUCT_OWNER') {
      fail(`Question ${question.id} authoritative transition requires PRODUCT_OWNER`, 'DK_IDEA_DISCOVERY_CORRUPT');
    }
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.some((item) => typeof item !== 'string' || !item.trim())) {
      fail(`Question ${question.id} requires at least two numbered options`, 'DK_IDEA_DISCOVERY_CORRUPT');
    }
    validateTimestamp(question.createdAt, `${question.id}.createdAt`);
    validateTimestamp(question.updatedAt, `${question.id}.updatedAt`);
  }

  const expected = computeDiscoveryFingerprint(state);
  if (state.fingerprint !== expected) fail('Discovery fingerprint does not match content', 'DK_IDEA_DISCOVERY_FINGERPRINT_MISMATCH', { expected, actual: state.fingerprint });
  validateTimestamp(state.updatedAt, 'discovery.updatedAt');
  return true;
}

function journalDigest(entry) {
  const payload = { ...entry };
  delete payload.entryFingerprint;
  return sha(payload);
}

function validateJournal(journal) {
  if (!journal || typeof journal !== 'object' || Array.isArray(journal)
    || journal.schemaVersion !== IDEA_DISCOVERY_JOURNAL_SCHEMA_VERSION
    || !Array.isArray(journal.entries)) {
    fail('Discovery journal is malformed', 'DK_IDEA_JOURNAL_CORRUPT');
  }
  let previous = null;
  for (let i = 0; i < journal.entries.length; i += 1) {
    const entry = journal.entries[i];
    if (!entry || typeof entry !== 'object' || entry.sequence !== i + 1) fail('Discovery journal sequence is broken', 'DK_IDEA_JOURNAL_CORRUPT');
    if (entry.previousEntryFingerprint !== previous) fail('Discovery journal hash chain is broken', 'DK_IDEA_JOURNAL_CHAIN_BROKEN');
    if (entry.entryFingerprint !== journalDigest(entry)) fail('Discovery journal entry fingerprint mismatch', 'DK_IDEA_JOURNAL_CHAIN_BROKEN');
    validateDiscoveryState(entry.state);
    if (entry.state.revision !== entry.sequence) fail('Discovery journal revision/sequence mismatch', 'DK_IDEA_JOURNAL_CORRUPT');
    previous = entry.entryFingerprint;
  }
  return true;
}

function loadJournal(rootDir) {
  const filePath = getDiscoveryJournalPath(rootDir);
  if (!fs.existsSync(filePath)) return { schemaVersion: IDEA_DISCOVERY_JOURNAL_SCHEMA_VERSION, entries: [] };
  try {
    const journal = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validateJournal(journal);
    return journal;
  } catch (error) {
    if (error instanceof IdeaDiscoveryError) throw error;
    fail(`Unable to load discovery journal: ${error.message}`, 'DK_IDEA_JOURNAL_CORRUPT');
  }
}

function writeState(rootDir, state) {
  validateDiscoveryState(state);
  atomicWrite(getDiscoveryPath(rootDir), state);
}

export function loadDiscoveryState(rootDir = process.cwd()) {
  const journal = loadJournal(rootDir);
  const statePath = getDiscoveryPath(rootDir);

  if (!fs.existsSync(statePath)) {
    if (journal.entries.length === 0) return emptyState();
    const recovered = structuredClone(journal.entries.at(-1).state);
    writeState(rootDir, recovered);
    return recovered;
  }

  let state;
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    validateDiscoveryState(state);
  } catch (error) {
    if (journal.entries.length > 0) {
      const recovered = structuredClone(journal.entries.at(-1).state);
      writeState(rootDir, recovered);
      return recovered;
    }
    if (error instanceof IdeaDiscoveryError) throw error;
    fail(`Unable to load discovery state: ${error.message}`, 'DK_IDEA_DISCOVERY_CORRUPT');
  }

  if (journal.entries.length === 0) {
    if (state.revision === 0) return state;
    fail('Discovery state has revisions but no journal', 'DK_IDEA_JOURNAL_MISSING');
  }

  const journalState = journal.entries.at(-1).state;
  if (state.revision > journalState.revision) fail('Discovery state is ahead of its journal', 'DK_IDEA_JOURNAL_DIVERGENCE');
  if (state.revision < journalState.revision) {
    const recovered = structuredClone(journalState);
    writeState(rootDir, recovered);
    return recovered;
  }
  if (state.fingerprint !== journalState.fingerprint) fail('Discovery state and journal disagree at same revision', 'DK_IDEA_JOURNAL_DIVERGENCE');
  return state;
}

function nextId(items, prefix) {
  const max = items.reduce((value, item) => {
    const n = Number(item.id.split('-').at(-1));
    return Number.isFinite(n) ? Math.max(value, n) : value;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

function commitState(rootDir, previous, next, eventType, eventId, authority = null) {
  next.schemaVersion = IDEA_DISCOVERY_SCHEMA_VERSION;
  next.revision = previous.revision + 1;
  next.updatedAt = new Date().toISOString();
  next.fingerprint = computeDiscoveryFingerprint(next);
  validateDiscoveryState(next);

  const journal = loadJournal(rootDir);
  if (journal.entries.length !== previous.revision) fail('Journal revision changed before commit', 'DK_IDEA_JOURNAL_REVISION_CONFLICT');
  const priorEntry = journal.entries.at(-1) ?? null;
  const entry = {
    sequence: next.revision,
    previousEntryFingerprint: priorEntry?.entryFingerprint ?? null,
    eventType,
    eventId,
    authority,
    timestamp: next.updatedAt,
    state: structuredClone(next),
  };
  entry.entryFingerprint = journalDigest(entry);
  const updatedJournal = { schemaVersion: IDEA_DISCOVERY_JOURNAL_SCHEMA_VERSION, entries: [...journal.entries, entry] };

  // Journal first. If state write is interrupted, loadDiscoveryState repairs from journal.
  atomicWrite(getDiscoveryJournalPath(rootDir), updatedJournal);
  writeState(rootDir, next);
  return structuredClone(next);
}

function assertAuthority(authority) {
  if (authority !== 'PRODUCT_OWNER') fail("Explicit authority='PRODUCT_OWNER' is required", 'DK_IDEA_UNAUTHORIZED');
}

function persistAuthorityDecision(rootDir, { id, statement, affectedRequirements = [] }) {
  const decision = createPODecision({
    id,
    statement,
    status: 'APPROVED',
    provenance: 'product-owner',
    affectedRequirements,
  });
  persistPODecision(decision, rootDir);
  return decision;
}

export function recordRequirementCandidate(rootDir = process.cwd(), {
  id = null,
  statement,
  origin,
  materiality = 'MATERIAL',
  sourceRef = null,
} = {}) {
  const state = loadDiscoveryState(rootDir);
  if (typeof statement !== 'string' || !statement.trim()) fail('Requirement statement is required');
  if (!REQUIREMENT_ORIGINS.includes(origin)) fail('Explicit valid requirement origin is required');
  if (!['MATERIAL', 'NON_MATERIAL'].includes(materiality)) fail('Invalid materiality');
  const reqId = id ?? nextId(state.requirements, 'IDEA-REQ');
  if (!/^IDEA-REQ-\d{3,}$/.test(reqId) || state.requirements.some((r) => r.id === reqId)) fail(`Invalid or duplicate requirement id: ${reqId}`);

  const now = new Date().toISOString();
  const candidate = {
    id: reqId,
    statement: statement.trim(),
    origin,
    materiality,
    sourceRef: typeof sourceRef === 'string' && sourceRef.trim() ? sourceRef.trim() : null,
    resolutionState: 'UNRESOLVED',
    resolvedBy: null,
    resolutionDecisionId: null,
    scopeDisposition: 'UNCLASSIFIED',
    scopeConfirmedBy: null,
    scopeDecisionId: null,
    supersededBy: null,
    createdAt: now,
    updatedAt: now,
  };
  const next = structuredClone(state);
  next.requirements.push(candidate);
  const committed = commitState(rootDir, state, next, 'REQUIREMENT_RECORDED', reqId);
  return committed.requirements.find((r) => r.id === reqId);
}

export function recordOpenQuestion(rootDir = process.cwd(), {
  id = null,
  question,
  options,
  materiality = 'MATERIAL',
} = {}) {
  const state = loadDiscoveryState(rootDir);
  if (typeof question !== 'string' || !question.trim()) fail('Question text is required');
  if (!Array.isArray(options) || options.length < 2 || options.some((item) => typeof item !== 'string' || !item.trim())) {
    fail('At least two non-empty question options are required');
  }
  if (!['MATERIAL', 'NON_MATERIAL'].includes(materiality)) fail('Invalid materiality');
  const questionId = id ?? nextId(state.openQuestions, 'IDEA-Q');
  if (!/^IDEA-Q-\d{3,}$/.test(questionId) || state.openQuestions.some((q) => q.id === questionId)) fail(`Invalid or duplicate question id: ${questionId}`);
  const now = new Date().toISOString();
  const entry = {
    id: questionId,
    question: question.trim(),
    options: options.map((item) => item.trim()),
    materiality,
    resolution: 'UNRESOLVED',
    answer: null,
    resolvedBy: null,
    decisionId: null,
    createdAt: now,
    updatedAt: now,
  };
  const next = structuredClone(state);
  next.openQuestions.push(entry);
  const committed = commitState(rootDir, state, next, 'QUESTION_RECORDED', questionId);
  return committed.openQuestions.find((q) => q.id === questionId);
}

export function resolveRequirementCandidate(rootDir = process.cwd(), {
  id,
  action,
  authority,
  reason = null,
  supersededBy = null,
} = {}) {
  assertAuthority(authority);
  const state = loadDiscoveryState(rootDir);
  const index = state.requirements.findIndex((r) => r.id === id);
  if (index < 0) fail(`Requirement not found: ${id}`);
  const current = state.requirements[index];
  if (current.resolutionState !== 'UNRESOLVED') fail(`Requirement ${id} is already ${current.resolutionState}`, 'DK_IDEA_ILLEGAL_TRANSITION');

  const normalized = String(action || '').toUpperCase();
  let target;
  if (normalized === 'CONFIRM') {
    if (!['USER_STATED', 'USER_CONFIRMED'].includes(current.origin)) {
      fail(`Origin ${current.origin} must be ADOPTED rather than CONFIRMED`, 'DK_IDEA_AUTHORITY_TRANSITION');
    }
    target = 'CONFIRMED';
  } else if (normalized === 'ADOPT') {
    if (!['AI_PROPOSED', 'RESEARCH_DERIVED', 'ASSUMED'].includes(current.origin)) {
      fail(`Origin ${current.origin} must be CONFIRMED rather than ADOPTED`, 'DK_IDEA_AUTHORITY_TRANSITION');
    }
    target = 'ADOPTED';
  } else if (normalized === 'DEFER') {
    target = 'DEFERRED';
  } else if (normalized === 'REJECT') {
    target = 'REJECTED';
  } else if (normalized === 'SUPERSEDE') {
    if (!supersededBy || !state.requirements.some((r) => r.id === supersededBy && r.id !== id)) fail('SUPERSEDE requires an existing replacement requirement');
    target = 'SUPERSEDED';
  } else {
    fail(`Unsupported requirement action: ${action}`);
  }

  const decision = persistAuthorityDecision(rootDir, {
    id: `POD-IDEA-REQ-${String(state.revision + 1).padStart(4, '0')}`,
    statement: `Product Owner ${target.toLowerCase()} requirement ${id}${reason ? `: ${reason}` : ''}`,
    affectedRequirements: [id, ...(supersededBy ? [supersededBy] : [])],
  });

  const next = structuredClone(state);
  const req = next.requirements[index];
  req.resolutionState = target;
  req.resolvedBy = 'PRODUCT_OWNER';
  req.resolutionDecisionId = decision.id;
  req.supersededBy = target === 'SUPERSEDED' ? supersededBy : null;
  req.updatedAt = new Date().toISOString();
  const committed = commitState(rootDir, state, next, `REQUIREMENT_${target}`, id, 'PRODUCT_OWNER');
  return committed.requirements[index];
}

export function classifyRequirementScope(rootDir = process.cwd(), {
  id,
  disposition,
  authority,
  reason = null,
} = {}) {
  assertAuthority(authority);
  const state = loadDiscoveryState(rootDir);
  const index = state.requirements.findIndex((r) => r.id === id);
  if (index < 0) fail(`Requirement not found: ${id}`);
  const current = state.requirements[index];
  if (!['CONFIRMED', 'ADOPTED'].includes(current.resolutionState)) {
    fail(`Requirement ${id} must be CONFIRMED or ADOPTED before scope classification`, 'DK_IDEA_ILLEGAL_TRANSITION');
  }
  const normalized = String(disposition || '').toUpperCase();
  if (!['MUST', 'SHOULD', 'FUTURE', 'EXCLUDED'].includes(normalized)) fail('Invalid scope disposition');

  const decision = persistAuthorityDecision(rootDir, {
    id: `POD-IDEA-SCOPE-${String(state.revision + 1).padStart(4, '0')}`,
    statement: `Product Owner classified ${id} as ${normalized}${reason ? `: ${reason}` : ''}`,
    affectedRequirements: [id],
  });

  const next = structuredClone(state);
  next.requirements[index].scopeDisposition = normalized;
  next.requirements[index].scopeConfirmedBy = 'PRODUCT_OWNER';
  next.requirements[index].scopeDecisionId = decision.id;
  next.requirements[index].updatedAt = new Date().toISOString();
  const committed = commitState(rootDir, state, next, 'REQUIREMENT_SCOPE_CLASSIFIED', id, 'PRODUCT_OWNER');
  return committed.requirements[index];
}

export function resolveOpenQuestion(rootDir = process.cwd(), {
  id,
  resolution = 'ANSWERED',
  answer = null,
  authority,
} = {}) {
  assertAuthority(authority);
  const state = loadDiscoveryState(rootDir);
  const index = state.openQuestions.findIndex((q) => q.id === id);
  if (index < 0) fail(`Question not found: ${id}`);
  const current = state.openQuestions[index];
  if (current.resolution !== 'UNRESOLVED') fail(`Question ${id} is already ${current.resolution}`, 'DK_IDEA_ILLEGAL_TRANSITION');
  const target = String(resolution || '').toUpperCase();
  if (!['ANSWERED', 'DEFERRED', 'REJECTED'].includes(target)) fail('Invalid question resolution');
  if (target === 'ANSWERED' && (typeof answer !== 'string' || !answer.trim())) fail('ANSWERED question requires an answer');

  const decision = persistAuthorityDecision(rootDir, {
    id: `POD-IDEA-Q-${String(state.revision + 1).padStart(4, '0')}`,
    statement: `Product Owner resolved question ${id} as ${target}`,
  });

  const next = structuredClone(state);
  next.openQuestions[index].resolution = target;
  next.openQuestions[index].answer = target === 'ANSWERED' ? answer.trim() : null;
  next.openQuestions[index].resolvedBy = 'PRODUCT_OWNER';
  next.openQuestions[index].decisionId = decision.id;
  next.openQuestions[index].updatedAt = new Date().toISOString();
  const committed = commitState(rootDir, state, next, `QUESTION_${target}`, id, 'PRODUCT_OWNER');
  return committed.openQuestions[index];
}

export function evaluateDiscoveryReadiness(rootDir = process.cwd()) {
  const state = loadDiscoveryState(rootDir);
  const blockers = [];
  for (const req of state.requirements) {
    if (req.materiality === 'MATERIAL' && req.resolutionState === 'UNRESOLVED') blockers.push({ code: 'UNRESOLVED_REQUIREMENT', id: req.id });
    if (['CONFIRMED', 'ADOPTED'].includes(req.resolutionState) && req.scopeDisposition === 'UNCLASSIFIED') blockers.push({ code: 'UNCLASSIFIED_SCOPE', id: req.id });
  }
  for (const question of state.openQuestions) {
    if (question.materiality === 'MATERIAL' && question.resolution === 'UNRESOLVED') blockers.push({ code: 'UNRESOLVED_QUESTION', id: question.id });
  }
  return { ready: blockers.length === 0, blockers, revision: state.revision, fingerprint: state.fingerprint };
}
