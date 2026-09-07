import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  createIdeaSuggestion,
  SUGGESTION_STATES,
  SCOPE_CLASSIFICATIONS,
} from '../runtime/orchestration/idea-suggestions.mjs';

import {
  createDecisionMenu,
  persistActiveDecisionMenu,
  loadActiveDecisionMenu,
  resolveDecisionInput,
  DECISION_MENU_STATUSES,
} from '../runtime/orchestration/decision-menu.mjs';

import {
  routeAcceptedSuggestion,
} from '../runtime/orchestration/suggestion-promotion.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dk-adversarial-test-'));
}

test('Case A: User selects option 2 on active menu', () => {
  const tmp = makeTempDir();
  try {
    const s1 = createIdeaSuggestion({ id: 'IDEA-SUG-001', title: 'F1', description: 'D1', rationale: 'R1' });
    const s2 = createIdeaSuggestion({ id: 'IDEA-SUG-002', title: 'F2', description: 'D2', rationale: 'R2' });
    const s3 = createIdeaSuggestion({ id: 'IDEA-SUG-003', title: 'F3', description: 'D3', rationale: 'R3' });

    const menu = createDecisionMenu({
      decisionId: 'DEC-CASE-A',
      decisionType: 'IDEA_SUGGESTIONS',
      title: 'Idea Discovery Suggestions',
      prompt: 'Select decision option:',
      recommendedOption: 2,
      options: [
        { number: 1, label: 'Accept all', actionType: 'ACCEPT_ALL', payload: { all: true } },
        {
          number: 2,
          label: 'Accept 1 & 2; defer 3',
          actionType: 'APPLY_SUGGESTION_DECISIONS',
          payload: {
            decisions: {
              'IDEA-SUG-001': { action: 'ACCEPT' },
              'IDEA-SUG-002': { action: 'ACCEPT' },
              'IDEA-SUG-003': { action: 'DEFER' },
            },
          },
        },
        { number: 3, label: 'Accept 2 only; reject 1 & 3', actionType: 'APPLY_SUGGESTION_DECISIONS', payload: { custom: true } },
        { number: 4, label: 'Custom response', actionType: 'CUSTOM', isCustom: true },
      ],
      lifecycleContext: { stage: 'UNDERSTAND' },
    });
    persistActiveDecisionMenu(menu, tmp);

    const res = resolveDecisionInput({ input: '2', rootDir: tmp });
    assert.equal(res.success, true);
    assert.equal(res.selectedOption.number, 2);
    assert.equal(res.actionType, 'APPLY_SUGGESTION_DECISIONS');
    assert.equal(res.payload.decisions['IDEA-SUG-001'].action, 'ACCEPT');
    assert.equal(res.payload.decisions['IDEA-SUG-002'].action, 'ACCEPT');
    assert.equal(res.payload.decisions['IDEA-SUG-003'].action, 'DEFER');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Case B: No active menu - user sends numeric 2', () => {
  const tmp = makeTempDir();
  try {
    const res = resolveDecisionInput({ input: 2, rootDir: tmp });
    assert.equal(res.success, false);
    assert.equal(res.reason, 'NO_ACTIVE_MENU');
    assert.match(res.message, /No active decision menu found/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Case C: Old menu replaced by new menu - resolves against authoritative current only', () => {
  const tmp = makeTempDir();
  try {
    const menu1 = createDecisionMenu({
      decisionId: 'DEC-OLD',
      decisionType: 'IDEA_SUGGESTIONS',
      title: 'Old Menu',
      prompt: 'Old Prompt',
      recommendedOption: 1,
      options: [{ number: 1, label: 'Old Option 1', actionType: 'OLD_ACTION' }],
      lifecycleContext: { stage: 'UNDERSTAND' },
    });
    persistActiveDecisionMenu(menu1, tmp);

    const menu2 = createDecisionMenu({
      decisionId: 'DEC-NEW',
      decisionType: 'IDEA_SUGGESTIONS',
      title: 'New Menu',
      prompt: 'New Prompt',
      recommendedOption: 1,
      options: [{ number: 1, label: 'New Option 1', actionType: 'NEW_ACTION' }],
      lifecycleContext: { stage: 'UNDERSTAND' },
    });
    persistActiveDecisionMenu(menu2, tmp);

    const res = resolveDecisionInput({ input: 1, rootDir: tmp });
    assert.equal(res.success, true);
    assert.equal(res.menu.decisionId, 'DEC-NEW');
    assert.equal(res.actionType, 'NEW_ACTION');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Case D: User accepts suggestion in existing project - delta routing', () => {
  const s = createIdeaSuggestion({ id: 'IDEA-SUG-001', title: 'Enhancement', description: 'Desc', rationale: 'Rat' });
  const routing = routeAcceptedSuggestion({ suggestion: s, isExistingProject: true, affectedArtifacts: ['docs/spec.md'] });
  assert.equal(routing.route, 'EXISTING_PROJECT_DELTA');
  assert.equal(routing.restartRequired, false);
  assert.equal(routing.requiresImpactAnalysis, true);
});

test('Case E: User selects Custom response (Option 4)', () => {
  const tmp = makeTempDir();
  try {
    const menu = createDecisionMenu({
      decisionId: 'DEC-CUSTOM',
      decisionType: 'IDEA_SUGGESTIONS',
      title: 'Menu with Custom',
      prompt: 'Select:',
      recommendedOption: 1,
      options: [
        { number: 1, label: 'Accept All', actionType: 'ACCEPT_ALL' },
        { number: 4, label: 'Custom response', actionType: 'CUSTOM', isCustom: true },
      ],
      lifecycleContext: { stage: 'UNDERSTAND' },
    });
    persistActiveDecisionMenu(menu, tmp);

    const res = resolveDecisionInput({ input: 4, rootDir: tmp });
    assert.equal(res.success, true);
    assert.equal(res.actionType, 'CUSTOM');
    assert.equal(res.selectedOption.isCustom, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Case F: Rehydration after restart preserves active decision and resolves correctly', () => {
  const tmp = makeTempDir();
  try {
    const menu = createDecisionMenu({
      decisionId: 'DEC-REHYDRATE',
      decisionType: 'IDEA_SUGGESTIONS',
      title: 'Rehydration Test',
      prompt: 'Choose:',
      recommendedOption: 1,
      options: [
        { number: 1, label: 'Accept', actionType: 'ACCEPT' },
        { number: 2, label: 'Defer', actionType: 'DEFER' },
      ],
      lifecycleContext: { stage: 'UNDERSTAND' },
    });
    persistActiveDecisionMenu(menu, tmp);

    // Simulate process exit / re-reading from disk
    const rehydrated = loadActiveDecisionMenu(tmp);
    assert.equal(rehydrated.decisionId, 'DEC-REHYDRATE');
    assert.equal(rehydrated.status, DECISION_MENU_STATUSES.PENDING);

    const res = resolveDecisionInput({ input: 1, rootDir: tmp });
    assert.equal(res.success, true);
    assert.equal(res.actionType, 'ACCEPT');

    const afterRes = loadActiveDecisionMenu(tmp);
    assert.equal(afterRes.status, DECISION_MENU_STATUSES.RESOLVED);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
