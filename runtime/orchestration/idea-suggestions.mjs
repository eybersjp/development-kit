import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const IDEA_SUGGESTION_SCHEMA_VERSION = '1.0.0';

export const SUGGESTION_STATES = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DEFERRED: 'DEFERRED',
  REJECTED: 'REJECTED',
});

export const SCOPE_CLASSIFICATIONS = Object.freeze({
  MUST_HAVE: 'MUST_HAVE',
  SHOULD_HAVE: 'SHOULD_HAVE',
  COULD_HAVE: 'COULD_HAVE',
  EXPLICITLY_EXCLUDED: 'EXPLICITLY_EXCLUDED',
});

export class SuggestionError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'SuggestionError';
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

export function computeSuggestionFingerprint(suggestion) {
  const norm = {
    id: suggestion.id,
    title: suggestion.title,
    description: suggestion.description,
    rationale: suggestion.rationale,
    impact: suggestion.impact,
    effort: suggestion.effort,
    recommendedScope: suggestion.recommendedScope,
    state: suggestion.state,
    promotedScope: suggestion.promotedScope ?? null,
  };
  return `sha256:${sha256(canonicalJson(norm))}`;
}

export function validateIdeaSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== 'object' || Array.isArray(suggestion)) {
    throw new SuggestionError('Idea suggestion must be an object');
  }

  if (typeof suggestion.id !== 'string' || !/^IDEA-SUG-[0-9]{3,}$/.test(suggestion.id)) {
    throw new SuggestionError(`Invalid suggestion ID: ${suggestion.id}`);
  }

  if (typeof suggestion.title !== 'string' || !suggestion.title.trim()) {
    throw new SuggestionError('Suggestion title is required');
  }

  if (typeof suggestion.description !== 'string' || !suggestion.description.trim()) {
    throw new SuggestionError('Suggestion description is required');
  }

  if (typeof suggestion.rationale !== 'string' || !suggestion.rationale.trim()) {
    throw new SuggestionError('Suggestion rationale is required');
  }

  if (!['LOW', 'MEDIUM', 'HIGH'].includes(suggestion.impact)) {
    throw new SuggestionError(`Invalid impact: ${suggestion.impact}`);
  }

  if (!['LOW', 'MEDIUM', 'HIGH'].includes(suggestion.effort)) {
    throw new SuggestionError(`Invalid effort: ${suggestion.effort}`);
  }

  if (!Object.values(SCOPE_CLASSIFICATIONS).includes(suggestion.recommendedScope)) {
    throw new SuggestionError(`Invalid recommendedScope: ${suggestion.recommendedScope}`);
  }

  if (!Object.values(SUGGESTION_STATES).includes(suggestion.state)) {
    throw new SuggestionError(`Invalid state: ${suggestion.state}`);
  }

  if (suggestion.state === SUGGESTION_STATES.ACCEPTED && !suggestion.promotedScope) {
    throw new SuggestionError('ACCEPTED suggestion must have a promotedScope');
  }

  return true;
}

export function createIdeaSuggestion({
  id,
  title,
  description,
  rationale,
  impact = 'MEDIUM',
  effort = 'MEDIUM',
  recommendedScope = SCOPE_CLASSIFICATIONS.SHOULD_HAVE,
  state = SUGGESTION_STATES.PENDING,
  promotedScope = null,
  provenance = 'product-discovery-agent',
  lifecycleContext = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const suggestion = {
    schemaVersion: IDEA_SUGGESTION_SCHEMA_VERSION,
    id: id ? id.trim() : '',
    title: title ? title.trim() : '',
    description: description ? description.trim() : '',
    rationale: rationale ? rationale.trim() : '',
    impact,
    effort,
    recommendedScope,
    state,
    promotedScope,
    decisionProvenance: null,
    provenance,
    lifecycleContext,
    createdAt,
    updatedAt: createdAt,
  };

  validateIdeaSuggestion(suggestion);
  return suggestion;
}

export function promoteSuggestion({
  suggestion,
  action,
  targetScope = null,
  decisionId,
  decisionAuthority = 'Product Owner',
  reason = null,
  selectedOption = null,
}) {
  validateIdeaSuggestion(suggestion);
  const now = new Date().toISOString();

  let nextState;
  let nextPromotedScope = null;

  if (action === 'ACCEPT') {
    nextState = SUGGESTION_STATES.ACCEPTED;
    nextPromotedScope = targetScope || suggestion.recommendedScope || SCOPE_CLASSIFICATIONS.MUST_HAVE;
  } else if (action === 'DEFER') {
    nextState = SUGGESTION_STATES.DEFERRED;
    nextPromotedScope = null;
  } else if (action === 'REJECT') {
    nextState = SUGGESTION_STATES.REJECTED;
    nextPromotedScope = null;
  } else {
    throw new SuggestionError(`Unsupported promotion action: ${action}`);
  }

  const updated = {
    ...suggestion,
    state: nextState,
    promotedScope: nextPromotedScope,
    decisionProvenance: {
      decisionId,
      decisionAuthority,
      resolvedAt: now,
      selectedOption,
      reason,
    },
    updatedAt: now,
  };

  validateIdeaSuggestion(updated);
  return updated;
}

export function getSuggestionStorePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'suggestions');
}

export function persistIdeaSuggestion(suggestion, rootDir = process.cwd()) {
  validateIdeaSuggestion(suggestion);
  const storeDir = getSuggestionStorePath(rootDir);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }
  const filePath = path.join(storeDir, `${suggestion.id}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(suggestion, null, 2)}\n`, 'utf8');
  return filePath;
}

export function loadIdeaSuggestions(rootDir = process.cwd()) {
  const storeDir = getSuggestionStorePath(rootDir);
  if (!fs.existsSync(storeDir)) {
    return [];
  }
  const files = fs.readdirSync(storeDir).filter((f) => f.endsWith('.json')).sort();
  const suggestions = [];
  const seenIds = new Set();
  for (const file of files) {
    const fullPath = path.join(storeDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      validateIdeaSuggestion(data);
      if (seenIds.has(data.id)) {
        throw new SuggestionError(`Duplicate suggestion ID found: ${data.id}`);
      }
      seenIds.add(data.id);
      suggestions.push(data);
    } catch (err) {
      throw new SuggestionError(`Failed to load suggestion from ${file}: ${err.message}`);
    }
  }
  return suggestions;
}
