import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DECISION_MENU_SCHEMA_VERSION = '1.0.0';

export const DECISION_MENU_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
  SUPERSEDED: 'SUPERSEDED',
  EXPIRED: 'EXPIRED',
});

export class DecisionMenuError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'DecisionMenuError';
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

export function computeDecisionMenuFingerprint(menu) {
  const norm = {
    decisionId: menu.decisionId,
    decisionType: menu.decisionType,
    title: menu.title,
    recommendedOption: menu.recommendedOption,
    options: Array.isArray(menu.options)
      ? menu.options.map((opt) => ({
          number: opt.number,
          label: opt.label,
          actionType: opt.actionType,
          payload: opt.payload ?? null,
        }))
      : [],
    lifecycleContext: menu.lifecycleContext ?? {},
  };
  return `sha256:${sha256(canonicalJson(norm))}`;
}

export function validateDecisionMenu(menu) {
  if (!menu || typeof menu !== 'object' || Array.isArray(menu)) {
    throw new DecisionMenuError('Decision menu must be an object');
  }

  if (typeof menu.decisionId !== 'string' || !/^DEC-[A-Za-z0-9._-]+$/.test(menu.decisionId)) {
    throw new DecisionMenuError(`Invalid decision ID: ${menu.decisionId}`);
  }

  if (typeof menu.decisionType !== 'string' || !menu.decisionType.trim()) {
    throw new DecisionMenuError('Decision type is required');
  }

  if (typeof menu.title !== 'string' || !menu.title.trim()) {
    throw new DecisionMenuError('Decision title is required');
  }

  if (typeof menu.prompt !== 'string' || !menu.prompt.trim()) {
    throw new DecisionMenuError('Decision prompt is required');
  }

  if (!Number.isInteger(menu.recommendedOption) || menu.recommendedOption < 1) {
    throw new DecisionMenuError(`Invalid recommendedOption: ${menu.recommendedOption}`);
  }

  if (!Array.isArray(menu.options) || menu.options.length === 0) {
    throw new DecisionMenuError('Decision menu must contain at least one option');
  }

  const seenNumbers = new Set();
  let foundRecommended = false;
  let customOptionFound = false;

  for (let i = 0; i < menu.options.length; i++) {
    const opt = menu.options[i];
    if (!opt || typeof opt !== 'object' || Array.isArray(opt)) {
      throw new DecisionMenuError(`Option at index ${i} must be an object`);
    }
    if (!Number.isInteger(opt.number) || opt.number < 1) {
      throw new DecisionMenuError(`Option at index ${i} has invalid number: ${opt.number}`);
    }
    if (seenNumbers.has(opt.number)) {
      throw new DecisionMenuError(`Duplicate option number: ${opt.number}`);
    }
    seenNumbers.add(opt.number);

    if (typeof opt.label !== 'string' || !opt.label.trim()) {
      throw new DecisionMenuError(`Option ${opt.number} missing label`);
    }
    if (typeof opt.actionType !== 'string' || !opt.actionType.trim()) {
      throw new DecisionMenuError(`Option ${opt.number} missing actionType`);
    }

    if (opt.number === menu.recommendedOption) {
      foundRecommended = true;
    }
    if (opt.isCustom || opt.actionType === 'CUSTOM') {
      customOptionFound = true;
    }
  }

  if (!foundRecommended) {
    throw new DecisionMenuError(`recommendedOption ${menu.recommendedOption} is not in options`);
  }

  if (!Object.values(DECISION_MENU_STATUSES).includes(menu.status)) {
    throw new DecisionMenuError(`Invalid menu status: ${menu.status}`);
  }

  if (!menu.lifecycleContext || typeof menu.lifecycleContext !== 'object') {
    throw new DecisionMenuError('lifecycleContext is required');
  }
  if (typeof menu.lifecycleContext.stage !== 'string' || !menu.lifecycleContext.stage.trim()) {
    throw new DecisionMenuError('lifecycleContext.stage is required');
  }

  if (typeof menu.sourceFingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(menu.sourceFingerprint)) {
    throw new DecisionMenuError('Valid sourceFingerprint is required');
  }

  return true;
}

export function createDecisionMenu({
  decisionId,
  decisionType,
  title,
  prompt,
  recommendedOption = 1,
  options = [],
  status = DECISION_MENU_STATUSES.PENDING,
  lifecycleContext = {},
  sourceFingerprint = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const menu = {
    schemaVersion: DECISION_MENU_SCHEMA_VERSION,
    decisionId: decisionId ? decisionId.trim() : '',
    decisionType: decisionType ? decisionType.trim() : '',
    title: title ? title.trim() : '',
    prompt: prompt ? prompt.trim() : '',
    recommendedOption,
    options,
    status,
    resolution: null,
    supersededBy: null,
    lifecycleContext,
    sourceFingerprint: sourceFingerprint || `sha256:${sha256(canonicalJson({ decisionId, title, options }))}`,
    createdAt,
    resolvedAt: null,
  };

  validateDecisionMenu(menu);
  return menu;
}

export function formatDecisionMenu(menu) {
  validateDecisionMenu(menu);
  const lines = [];
  lines.push(`## Decision Required`);
  if (menu.title) lines.push(menu.title);
  if (menu.prompt && menu.prompt !== menu.title) lines.push(menu.prompt);
  lines.push('');

  for (const opt of menu.options) {
    const recTag = opt.number === menu.recommendedOption ? ' \u2190 Recommended' : '';
    lines.push(`${opt.number}. ${opt.label}${recTag}`);
    if (opt.description) {
      lines.push(`   ${opt.description}`);
    }
  }

  const optionNumbers = menu.options.map((o) => o.number).join(', ');
  lines.push('');
  lines.push(`Reply with ${optionNumbers}.`);
  return lines.join('\n');
}

export function getActiveDecisionMenuPath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'decisions', 'active-menu.json');
}

export function getDecisionMenuHistoryPath(rootDir = process.cwd(), decisionId) {
  return path.join(rootDir, '.development-kit', 'decisions', `${decisionId}.json`);
}

export function persistActiveDecisionMenu(menu, rootDir = process.cwd()) {
  validateDecisionMenu(menu);
  const decisionsDir = path.join(rootDir, '.development-kit', 'decisions');
  if (!fs.existsSync(decisionsDir)) {
    fs.mkdirSync(decisionsDir, { recursive: true });
  }

  // If there was an existing active menu that is different and still pending, supersede it
  const activePath = getActiveDecisionMenuPath(rootDir);
  if (fs.existsSync(activePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(activePath, 'utf8'));
      if (existing.decisionId !== menu.decisionId && existing.status === DECISION_MENU_STATUSES.PENDING) {
        existing.status = DECISION_MENU_STATUSES.SUPERSEDED;
        existing.supersededBy = menu.decisionId;
        const oldHistoryPath = getDecisionMenuHistoryPath(rootDir, existing.decisionId);
        fs.writeFileSync(oldHistoryPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
      }
    } catch {
      // ignore
    }
  }

  // Save active menu
  fs.writeFileSync(activePath, `${JSON.stringify(menu, null, 2)}\n`, 'utf8');
  // Also save to history file
  const historyPath = getDecisionMenuHistoryPath(rootDir, menu.decisionId);
  fs.writeFileSync(historyPath, `${JSON.stringify(menu, null, 2)}\n`, 'utf8');
  return activePath;
}

export function loadActiveDecisionMenu(rootDir = process.cwd()) {
  const activePath = getActiveDecisionMenuPath(rootDir);
  if (!fs.existsSync(activePath)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(activePath, 'utf8'));
    validateDecisionMenu(data);
    return data;
  } catch (err) {
    throw new DecisionMenuError(`Failed to load active decision menu: ${err.message}`);
  }
}

export function resolveDecisionInput({
  input,
  activeMenu = null,
  rootDir = process.cwd(),
  expectedStage = null,
  currentFingerprint = null,
  authority = 'Product Owner',
} = {}) {
  const menu = activeMenu || loadActiveDecisionMenu(rootDir);
  if (!menu) {
    return {
      success: false,
      reason: 'NO_ACTIVE_MENU',
      message: 'No active decision menu found. Reply cannot be resolved without an active menu.',
    };
  }

  if (menu.status !== DECISION_MENU_STATUSES.PENDING) {
    return {
      success: false,
      reason: 'MENU_NOT_PENDING',
      message: `Active menu ${menu.decisionId} is in ${menu.status} status and cannot accept resolutions.`,
    };
  }

  if (expectedStage && menu.lifecycleContext?.stage && menu.lifecycleContext.stage !== expectedStage) {
    return {
      success: false,
      reason: 'STAGE_MISMATCH',
      message: `Active menu stage (${menu.lifecycleContext.stage}) does not match expected lifecycle stage (${expectedStage}).`,
    };
  }

  if (currentFingerprint && menu.sourceFingerprint && menu.sourceFingerprint !== currentFingerprint) {
    return {
      success: false,
      reason: 'STALE_FINGERPRINT',
      message: 'Source fingerprint has changed; the active decision menu is stale.',
    };
  }

  // Normalize input
  if (typeof input !== 'string' && typeof input !== 'number') {
    return {
      success: false,
      reason: 'INVALID_INPUT_TYPE',
      message: 'Decision input must be a number or numeric string.',
    };
  }

  const rawStr = String(input).trim();
  const numMatch = rawStr.match(/^([0-9]+)$/);
  if (!numMatch) {
    return {
      success: false,
      reason: 'NON_NUMERIC_INPUT',
      message: `Input "${rawStr}" is not a valid single numeric choice.`,
    };
  }

  const selectedNum = parseInt(numMatch[1], 10);
  const matchedOption = menu.options.find((opt) => opt.number === selectedNum);
  if (!matchedOption) {
    return {
      success: false,
      reason: 'OPTION_OUT_OF_BOUNDS',
      message: `Option ${selectedNum} is outside the available options (1..${menu.options.length}).`,
    };
  }

  const now = new Date().toISOString();
  const resolution = {
    selectedNumber: selectedNum,
    actionType: matchedOption.actionType,
    payload: matchedOption.payload ? structuredClone(matchedOption.payload) : {},
    customText: null,
    resolvedAt: now,
    authority,
  };

  const resolvedMenu = {
    ...menu,
    status: DECISION_MENU_STATUSES.RESOLVED,
    resolution,
    resolvedAt: now,
  };

  validateDecisionMenu(resolvedMenu);

  // Update storage
  const activePath = getActiveDecisionMenuPath(rootDir);
  fs.writeFileSync(activePath, `${JSON.stringify(resolvedMenu, null, 2)}\n`, 'utf8');
  const historyPath = getDecisionMenuHistoryPath(rootDir, resolvedMenu.decisionId);
  fs.writeFileSync(historyPath, `${JSON.stringify(resolvedMenu, null, 2)}\n`, 'utf8');

  return {
    success: true,
    menu: resolvedMenu,
    selectedOption: matchedOption,
    actionType: matchedOption.actionType,
    payload: resolution.payload,
  };
}

export function generateSuggestionDecisionMenu({
  decisionId,
  suggestions = [],
  lifecycleContext = {},
  sourceFingerprint = null,
} = {}) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new DecisionMenuError('At least one suggestion is required to generate a decision menu');
  }

  for (const s of suggestions) {
    if (!s || typeof s !== 'object' || !s.id) {
      throw new DecisionMenuError('Invalid suggestion item in generateSuggestionDecisionMenu');
    }
  }

  const total = suggestions.length;
  const options = [];

  // Helper map of all ACCEPTED
  const allAcceptedMap = {};
  suggestions.forEach((s) => {
    allAcceptedMap[s.id] = { action: 'ACCEPT', targetScope: s.recommendedScope };
  });

  if (total === 1) {
    const s = suggestions[0];
    options.push({
      number: 1,
      label: `Accept suggestion: ${s.title}`,
      description: `Promote ${s.id} into active scope (${s.recommendedScope || 'MUST_HAVE'}).`,
      actionType: 'APPLY_SUGGESTION_DECISIONS',
      payload: {
        decisions: {
          [s.id]: { action: 'ACCEPT', targetScope: s.recommendedScope || 'MUST_HAVE' },
        },
      },
      isRecommended: true,
    });
    options.push({
      number: 2,
      label: `Defer suggestion: ${s.title}`,
      description: `Exclude ${s.id} from active scope but retain in deferred ideas backlog.`,
      actionType: 'APPLY_SUGGESTION_DECISIONS',
      payload: {
        decisions: {
          [s.id]: { action: 'DEFER' },
        },
      },
    });
    options.push({
      number: 3,
      label: `Reject suggestion: ${s.title}`,
      description: `Explicitly reject ${s.id}. Recorded with decision authority so it is not proposed again.`,
      actionType: 'APPLY_SUGGESTION_DECISIONS',
      payload: {
        decisions: {
          [s.id]: { action: 'REJECT' },
        },
      },
    });
    options.push({
      number: 4,
      label: 'Custom response',
      description: 'Make a granular or custom scope response.',
      actionType: 'CUSTOM',
      payload: { mode: 'granular_suggestion_selection' },
      isCustom: true,
    });
  } else if (total === 2) {
    const s1 = suggestions[0];
    const s2 = suggestions[1];

    // Option 1: Accept 1, defer 2 (Recommended if 1 is higher scope or first)
    options.push({
      number: 1,
      label: `Accept 1 (${s1.title}); defer 2 (${s2.title})`,
      description: `Focus on essential scope first.`,
      actionType: 'APPLY_SUGGESTION_DECISIONS',
      payload: {
        decisions: {
          [s1.id]: { action: 'ACCEPT', targetScope: s1.recommendedScope },
          [s2.id]: { action: 'DEFER' },
        },
      },
      isRecommended: true,
    });
    // Option 2: Accept all
    options.push({
      number: 2,
      label: 'Accept all suggestions',
      description: `Include both suggestions in active scope.`,
      actionType: 'APPLY_SUGGESTION_DECISIONS',
      payload: { decisions: allAcceptedMap },
    });
    // Option 3: Defer all
    options.push({
      number: 3,
      label: 'Defer all suggestions',
      description: 'Retain current scope without adding new suggestions.',
      actionType: 'APPLY_SUGGESTION_DECISIONS',
      payload: {
        decisions: {
          [s1.id]: { action: 'DEFER' },
          [s2.id]: { action: 'DEFER' },
        },
      },
    });
    // Option 4: Custom
    options.push({
      number: 4,
      label: 'Custom response',
      description: 'Make a granular or custom scope response.',
      actionType: 'CUSTOM',
      payload: { mode: 'granular_suggestion_selection' },
      isCustom: true,
    });
  } else {
    // 3 or more suggestions:
    // Option 1: Recommended subset (e.g. Accept Must/Should; Defer Could/Excluded, or accept 1 & 2; defer remaining)
    const highPriority = suggestions.filter((s) => s.recommendedScope === 'MUST_HAVE' || s.recommendedScope === 'SHOULD_HAVE');
    const recommendedToAccept = highPriority.length > 0 && highPriority.length < total
      ? highPriority
      : suggestions.slice(0, 2);

    const recAcceptIds = new Set(recommendedToAccept.map((s) => s.id));
    const recDecisions = {};
    suggestions.forEach((s) => {
      if (recAcceptIds.has(s.id)) {
        recDecisions[s.id] = { action: 'ACCEPT', targetScope: s.recommendedScope };
      } else {
        recDecisions[s.id] = { action: 'DEFER' };
      }
    });

    const recAcceptNums = suggestions
      .map((s, idx) => (recAcceptIds.has(s.id) ? idx + 1 : null))
      .filter(Boolean)
      .join(' & ');
    const recDeferNums = suggestions
      .map((s, idx) => (!recAcceptIds.has(s.id) ? idx + 1 : null))
      .filter(Boolean)
      .join(' & ');

    options.push({
      number: 1,
      label: `Accept ${recAcceptNums}; defer ${recDeferNums}`,
      description: 'Balance essential capabilities against delivery effort.',
      actionType: 'APPLY_SUGGESTION_DECISIONS',
      payload: { decisions: recDecisions },
      isRecommended: true,
    });

    // Option 2: Accept all suggestions
    options.push({
      number: 2,
      label: 'Accept all suggestions',
      description: `Include all ${total} suggestions in active scope.`,
      actionType: 'APPLY_SUGGESTION_DECISIONS',
      payload: { decisions: allAcceptedMap },
    });

    // Option 3: Defer all
    const deferAllMap = {};
    suggestions.forEach((s) => {
      deferAllMap[s.id] = { action: 'DEFER' };
    });
    options.push({
      number: 3,
      label: 'Defer all suggestions',
      description: 'Proceed with core baseline requirements only.',
      actionType: 'APPLY_SUGGESTION_DECISIONS',
      payload: { decisions: deferAllMap },
    });

    // Option 4: Custom response
    options.push({
      number: 4,
      label: 'Custom response',
      description: 'Select specific suggestions to accept, defer, or reject.',
      actionType: 'CUSTOM',
      payload: { mode: 'granular_suggestion_selection' },
      isCustom: true,
    });
  }

  const generatedId = decisionId || `DEC-IDEA-${Date.now()}`;
  return createDecisionMenu({
    decisionId: generatedId,
    decisionType: 'IDEA_SUGGESTIONS',
    title: 'Idea Discovery Suggestions Decision',
    prompt: 'Select how you would like to proceed with the identified suggestions:',
    recommendedOption: 1,
    options,
    status: DECISION_MENU_STATUSES.PENDING,
    lifecycleContext: {
      stage: 'UNDERSTAND',
      command: '/dk-idea',
      ...lifecycleContext,
    },
    sourceFingerprint,
  });
}
