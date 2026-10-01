/**
 * DKF IDEA Authority — canonical Idea Brief persistence and approval binding.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadDiscoveryState, evaluateDiscoveryReadiness } from './idea-discovery.mjs';
import { loadIdeaDesignState } from './idea-design.mjs';
import { createPODecision, persistPODecision } from './po-decisions.mjs';

export const IDEA_ARTIFACT_SCHEMA_VERSION = '1.0.0';
export const CANONICAL_IDEA_BRIEF_PATH = 'docs/01-concept/idea-brief.md';

export class IdeaArtifactError extends Error {
  constructor(message, code = 'DK_IDEA_ARTIFACT_ERROR', details = null) {
    super(message);
    this.name = 'IdeaArtifactError';
    this.code = code;
    this.details = details;
  }
}

function fail(message, code = 'DK_IDEA_ARTIFACT_INVALID', details = null) {
  throw new IdeaArtifactError(message, code, details);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function shaText(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha(value) {
  return shaText(JSON.stringify(canonical(value)));
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try {
    const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, filePath);
}

export function getIdeaArtifactStatePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea', 'artifact.json');
}

export function getCanonicalIdeaBriefPath(rootDir = process.cwd()) {
  return path.join(rootDir, CANONICAL_IDEA_BRIEF_PATH);
}

function emptyArtifactState() {
  return {
    schemaVersion: IDEA_ARTIFACT_SCHEMA_VERSION,
    revision: 0,
    record: null,
    approvals: [],
  };
}

function approvalFingerprint(record) {
  const payload = { ...record };
  delete payload.fingerprint;
  return sha(payload);
}

function validateArtifactState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)
    || state.schemaVersion !== IDEA_ARTIFACT_SCHEMA_VERSION
    || !Number.isSafeInteger(state.revision) || state.revision < 0
    || !Array.isArray(state.approvals)) {
    fail('Idea artifact state is malformed', 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
  }
  if (state.record) {
    if (state.record.canonicalPath !== CANONICAL_IDEA_BRIEF_PATH) fail('Idea Brief canonical path is invalid', 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
    if (!Number.isSafeInteger(state.record.revision) || state.record.revision < 1) fail('Idea Brief revision is invalid', 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
    for (const field of ['artifactFingerprint', 'discoveryFingerprint', 'designFingerprint', 'sourceFingerprint']) {
      if (!/^sha256:[a-f0-9]{64}$/.test(state.record[field] || '')) fail(`Invalid ${field}`, 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
    }
    if (!Number.isSafeInteger(state.record.discoveryRevision) || state.record.discoveryRevision < 0) fail('Invalid discoveryRevision', 'DK_IDEA_ARTIFACT_STATE_CORRUPT');\n    if (!Number.isSafeInteger(state.record.designRevision) || state.record.designRevision < 0) fail('Invalid designRevision', 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
  }
  for (const approval of state.approvals) {
    if (approval.authority !== 'PRODUCT_OWNER') fail('Idea Brief approval lacks Product Owner authority', 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
    if (!/^POD-[A-Za-z0-9._-]+$/i.test(approval.decisionId || '')) fail('Idea Brief approval decision ID is invalid', 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
    if (!/^sha256:[a-f0-9]{64}$/.test(approval.sourceFingerprint || '')) fail('Idea Brief approval source fingerprint is invalid', 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
    if (approval.fingerprint !== approvalFingerprint(approval)) fail('Idea Brief approval fingerprint mismatch', 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
  }
  return true;
}

export function loadIdeaArtifactState(rootDir = process.cwd()) {
  const filePath = getIdeaArtifactStatePath(rootDir);
  if (!fs.existsSync(filePath)) return emptyArtifactState();
  try {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validateArtifactState(state);
    return state;
  } catch (error) {
    if (error instanceof IdeaArtifactError) throw error;
    fail(`Unable to load Idea Brief artifact state: ${error.message}`, 'DK_IDEA_ARTIFACT_STATE_CORRUPT');
  }
}

function parseSections(content) {
  const sections = new Map();
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let current = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      current = line.trim();
      sections.set(current, []);
    } else if (current) {
      sections.get(current).push(line);
    }
  }
  return sections;
}

export function validateIdeaBriefContent(content, discovery = null) {
  if (typeof content !== 'string' || !content.trim()) fail('Idea Brief content is required');
  const required = [
    '## Problem',
    '## Intended Users',
    '## Success Criteria',
    '## Requirements (Must)',
    '## Preferences (Should)',
    '## Assumptions',
    '## Constraints',
    '## Risks',
    '## Open Questions',
    '## Future Ideas (Explicitly Deferred)',
  ];
  const sections = parseSections(content);
  const issues = [];
  for (const header of required) {
    if (!sections.has(header)) issues.push({ code: 'MISSING_SECTION', header });
  }
  if (!/^# Idea Brief:\s*\S+/m.test(content)) issues.push({ code: 'MISSING_TITLE' });
  if (/\[(What problem|Who will use|How will we know|Requirement \d|Preference \d|Assumption \d|Constraint \d|Risk \d|Question \d|Future idea \d)/i.test(content)) {
    issues.push({ code: 'PLACEHOLDER_CONTENT' });
  }

  if (discovery && sections.has('## Requirements (Must)')) {
    const mustLines = sections.get('## Requirements (Must)').map((line) => line.trim()).filter((line) => line.startsWith('- '));
    const parsed = new Map();
    for (const line of mustLines) {
      const match = line.match(/^- \[(IDEA-REQ-\d{3,})\]\s+(.+)$/);
      if (!match) {
        if (!/^- (None|None\.)$/i.test(line)) issues.push({ code: 'INVALID_MUST_GRAMMAR', line });
        continue;
      }
      if (parsed.has(match[1])) issues.push({ code: 'DUPLICATE_REQUIREMENT_REFERENCE', id: match[1] });
      parsed.set(match[1], match[2].trim());
    }

    const expected = discovery.requirements.filter((req) =>
      ['CONFIRMED', 'ADOPTED'].includes(req.resolutionState) && req.scopeDisposition === 'MUST'
    );
    for (const req of expected) {
      if (!parsed.has(req.id)) issues.push({ code: 'MISSING_MUST_REQUIREMENT', id: req.id });
      else if (parsed.get(req.id).replace(/\s+/g, ' ').trim() !== req.statement.replace(/\s+/g, ' ').trim()) {
        issues.push({ code: 'REQUIREMENT_CONTENT_MISMATCH', id: req.id });
      }
    }
    for (const id of parsed.keys()) {
      if (!expected.some((req) => req.id === id)) issues.push({ code: 'UNAUTHORIZED_MUST_REQUIREMENT', id });
    }
  }

  return { valid: issues.length === 0, issues };
}

function currentBinding(rootDir) {
  const discovery = loadDiscoveryState(rootDir);
  const design = loadIdeaDesignState(rootDir);
  return {
    discovery,
    design,
    sourceFingerprint: sha({
      discoveryRevision: discovery.revision,
      discoveryFingerprint: discovery.fingerprint,
      designRevision: design.revision,
      designFingerprint: design.fingerprint,
    }),
  };
}

export function persistCanonicalIdeaBrief(rootDir = process.cwd(), { content } = {}) {
  const readiness = evaluateDiscoveryReadiness(rootDir);
  if (!readiness.ready) fail('Discovery is not ready for Idea Brief persistence', 'DK_IDEA_DISCOVERY_NOT_READY', readiness.blockers);
  const binding = currentBinding(rootDir);
  if (binding.design.applicable === null || binding.design.disposition === null) {
    fail('Design applicability/disposition is unresolved', 'DK_IDEA_DESIGN_UNRESOLVED');
  }
  const validation = validateIdeaBriefContent(content, binding.discovery);
  if (!validation.valid) fail('Idea Brief structure/content is invalid', 'DK_IDEA_BRIEF_INVALID', validation.issues);

  const current = loadIdeaArtifactState(rootDir);
  const finalContent = content.endsWith('\n') ? content : `${content}\n`;
  const artifactFingerprint = shaText(finalContent);
  const revision = current.record ? current.record.revision + 1 : 1;
  const record = {
    canonicalPath: CANONICAL_IDEA_BRIEF_PATH,
    revision,
    artifactFingerprint,
    discoveryRevision: binding.discovery.revision,
    discoveryFingerprint: binding.discovery.fingerprint,
    designRevision: binding.design.revision,
    designFingerprint: binding.design.fingerprint,
    sourceFingerprint: binding.sourceFingerprint,
    persistedAt: new Date().toISOString(),
  };

  // File first, then metadata. Missing metadata never grants approval; it only forces re-persistence.
  atomicWrite(getCanonicalIdeaBriefPath(rootDir), finalContent);
  const state = {
    schemaVersion: IDEA_ARTIFACT_SCHEMA_VERSION,
    revision: current.revision + 1,
    record,
    approvals: current.approvals,
  };
  atomicWrite(getIdeaArtifactStatePath(rootDir), state);
  return structuredClone(record);
}

export function inspectIdeaBrief(rootDir = process.cwd()) {
  const state = loadIdeaArtifactState(rootDir);
  const filePath = getCanonicalIdeaBriefPath(rootDir);
  if (!state.record) return { status: 'ABSENT', current: false, record: null, approvalStatus: 'NONE' };
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return { status: 'MISSING', current: false, record: state.record, approvalStatus: 'STALE' };

  const actualFingerprint = shaText(fs.readFileSync(filePath, 'utf8'));
  if (actualFingerprint !== state.record.artifactFingerprint) {
    return { status: 'TAMPERED', current: false, record: state.record, actualFingerprint, approvalStatus: 'STALE' };
  }

  const binding = currentBinding(rootDir);
  const current = state.record.discoveryRevision === binding.discovery.revision
    && state.record.discoveryFingerprint === binding.discovery.fingerprint
    && state.record.designRevision === binding.design.revision
    && state.record.designFingerprint === binding.design.fingerprint
    && state.record.sourceFingerprint === binding.sourceFingerprint;
  const latest = state.approvals.at(-1) ?? null;
  const approvalStatus = latest && latest.sourceFingerprint === state.record.sourceFingerprint
    && latest.artifactFingerprint === state.record.artifactFingerprint && current
    ? 'CURRENT'
    : latest ? 'STALE' : 'NONE';
  return {
    status: current ? 'CURRENT' : 'STALE',
    current,
    record: structuredClone(state.record),
    actualFingerprint,
    approvalStatus,
    latestApproval: latest ? structuredClone(latest) : null,
  };
}

export function approveCurrentIdeaBrief(rootDir = process.cwd(), {
  authority,
} = {}) {
  if (authority !== 'PRODUCT_OWNER') fail("Explicit authority='PRODUCT_OWNER' is required", 'DK_IDEA_UNAUTHORIZED');
  const readiness = evaluateDiscoveryReadiness(rootDir);
  if (!readiness.ready) fail('Discovery is not approval-ready', 'DK_IDEA_DISCOVERY_NOT_READY', readiness.blockers);
  const inspection = inspectIdeaBrief(rootDir);
  if (!inspection.current || inspection.status !== 'CURRENT') fail(`Idea Brief is not current: ${inspection.status}`, 'DK_IDEA_BRIEF_STALE');
  if (inspection.approvalStatus === 'CURRENT') fail('Idea Brief is already approved for the current source binding', 'DK_IDEA_BRIEF_ALREADY_APPROVED');

  const state = loadIdeaArtifactState(rootDir);
  const decision = createPODecision({
    id: `POD-IDEA-BRIEF-${String(state.approvals.length + 1).padStart(3, '0')}`,
    statement: `Product Owner approved Idea Brief revision ${inspection.record.revision} bound to current discovery/design sources`,
    status: 'APPROVED',
    provenance: 'product-owner',
    affectedRequirements: loadDiscoveryState(rootDir).requirements
      .filter((req) => ['CONFIRMED', 'ADOPTED'].includes(req.resolutionState))
      .map((req) => req.id),
  });
  persistPODecision(decision, rootDir);

  const approval = {
    id: `IDEA-APPROVAL-${String(state.approvals.length + 1).padStart(3, '0')}`,
    decisionId: decision.id,
    authority: 'PRODUCT_OWNER',
    artifactRevision: inspection.record.revision,
    artifactFingerprint: inspection.record.artifactFingerprint,
    discoveryRevision: inspection.record.discoveryRevision,
    discoveryFingerprint: inspection.record.discoveryFingerprint,
    designRevision: inspection.record.designRevision,
    designFingerprint: inspection.record.designFingerprint,
    sourceFingerprint: inspection.record.sourceFingerprint,
    approvedAt: new Date().toISOString(),
  };
  approval.fingerprint = approvalFingerprint(approval);
  const updated = { ...state, revision: state.revision + 1, approvals: [...state.approvals, approval] };
  atomicWrite(getIdeaArtifactStatePath(rootDir), updated);
  return structuredClone(approval);
}
