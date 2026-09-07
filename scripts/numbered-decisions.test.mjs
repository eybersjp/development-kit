import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  createIdeaSuggestion,
  validateIdeaSuggestion,
  promoteSuggestion,
  persistIdeaSuggestion,
  loadIdeaSuggestions,
  computeSuggestionFingerprint,
  SUGGESTION_STATES,
  SCOPE_CLASSIFICATIONS,
} from '../runtime/orchestration/idea-suggestions.mjs';

import {
  createDecisionMenu,
  validateDecisionMenu,
  generateSuggestionDecisionMenu,
  formatDecisionMenu,
  persistActiveDecisionMenu,
  loadActiveDecisionMenu,
  resolveDecisionInput,
  DECISION_MENU_STATUSES,
} from '../runtime/orchestration/decision-menu.mjs';

import {
  promoteSuggestionToArtifact,
  routeAcceptedSuggestion,
} from '../runtime/orchestration/suggestion-promotion.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dk-numbered-decisions-test-'));
}

test('Suggestion generation and state lifecycle', () => {
  const s = createIdeaSuggestion({
    id: 'IDEA-SUG-001',
    title: 'Offline-first support',
    description: 'Site users may operate with unreliable connectivity.',
    rationale: 'Essential for field workers.',
    impact: 'HIGH',
    effort: 'HIGH',
    recommendedScope: SCOPE_CLASSIFICATIONS.MUST_HAVE,
  });

  assert.equal(validateIdeaSuggestion(s), true);
  assert.equal(s.state, SUGGESTION_STATES.PENDING);
  assert.equal(s.promotedScope, null);

  // ACCEPT
  const accepted = promoteSuggestion({
    suggestion: s,
    action: 'ACCEPT',
    decisionId: 'DEC-001',
  });
  assert.equal(accepted.state, SUGGESTION_STATES.ACCEPTED);
  assert.equal(accepted.promotedScope, SCOPE_CLASSIFICATIONS.MUST_HAVE);
  assert.equal(accepted.decisionProvenance.decisionAuthority, 'Product Owner');

  // DEFER
  const deferred = promoteSuggestion({
    suggestion: s,
    action: 'DEFER',
    decisionId: 'DEC-002',
  });
  assert.equal(deferred.state, SUGGESTION_STATES.DEFERRED);
  assert.equal(deferred.promotedScope, null);

  // REJECT
  const rejected = promoteSuggestion({
    suggestion: s,
    action: 'REJECT',
    decisionId: 'DEC-003',
    reason: 'Not aligned with strategic focus.',
  });
  assert.equal(rejected.state, SUGGESTION_STATES.REJECTED);
  assert.equal(rejected.decisionProvenance.reason, 'Not aligned with strategic focus.');

  // Fingerprint changes when state changes
  assert.notEqual(computeSuggestionFingerprint(s), computeSuggestionFingerprint(accepted));
});

test('Suggestion persistence and duplicate ID detection', () => {
  const tmp = makeTempDir();
  try {
    const s1 = createIdeaSuggestion({
      id: 'IDEA-SUG-001',
      title: 'Audit logging',
      description: 'Audit system actions',
      rationale: 'Compliance',
    });
    persistIdeaSuggestion(s1, tmp);

    const loaded = loadIdeaSuggestions(tmp);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, 'IDEA-SUG-001');

    // Reject malformed / duplicate
    assert.throws(() => {
      createIdeaSuggestion({ id: 'INVALID-ID' });
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Menu generation with 1, 2, 3, and 5 suggestions', () => {
  const s1 = createIdeaSuggestion({ id: 'IDEA-SUG-001', title: 'Feature 1', description: 'Desc 1', rationale: 'R1' });
  const s2 = createIdeaSuggestion({ id: 'IDEA-SUG-002', title: 'Feature 2', description: 'Desc 2', rationale: 'R2' });
  const s3 = createIdeaSuggestion({ id: 'IDEA-SUG-003', title: 'Feature 3', description: 'Desc 3', rationale: 'R3', recommendedScope: SCOPE_CLASSIFICATIONS.COULD_HAVE });
  const s4 = createIdeaSuggestion({ id: 'IDEA-SUG-004', title: 'Feature 4', description: 'Desc 4', rationale: 'R4' });
  const s5 = createIdeaSuggestion({ id: 'IDEA-SUG-005', title: 'Feature 5', description: 'Desc 5', rationale: 'R5' });

  // 1 suggestion
  const menu1 = generateSuggestionDecisionMenu({ suggestions: [s1] });
  assert.equal(menu1.options.length, 4);
  assert.equal(menu1.recommendedOption, 1);
  assert.equal(menu1.options[3].isCustom, true);

  // 2 suggestions
  const menu2 = generateSuggestionDecisionMenu({ suggestions: [s1, s2] });
  assert.equal(menu2.options.length, 4);
  assert.equal(menu2.recommendedOption, 1);

  // 3 suggestions
  const menu3 = generateSuggestionDecisionMenu({ suggestions: [s1, s2, s3] });
  assert.equal(menu3.options.length, 4);
  assert.equal(menu3.recommendedOption, 1);
  assert.match(menu3.options[0].label, /Accept/);

  // 5 suggestions
  const menu5 = generateSuggestionDecisionMenu({ suggestions: [s1, s2, s3, s4, s5] });
  assert.equal(menu5.options.length, 4);
  assert.equal(menu5.recommendedOption, 1);

  const formatted = formatDecisionMenu(menu3);
  assert.match(formatted, /## Decision Required/);
  assert.match(formatted, /\u2190 Recommended/);
  assert.match(formatted, /Reply with 1, 2, 3, 4\./);
});

test('Deterministic numeric resolution and fail-closed security guards', () => {
  const tmp = makeTempDir();
  try {
    const s1 = createIdeaSuggestion({ id: 'IDEA-SUG-001', title: 'Feature 1', description: 'D1', rationale: 'R1' });
    const menu = generateSuggestionDecisionMenu({ suggestions: [s1] });
    persistActiveDecisionMenu(menu, tmp);

    // Resolution without active menu fails closed
    const noMenuRes = resolveDecisionInput({ input: 1, rootDir: fs.mkdtempSync(path.join(os.tmpdir(), 'empty-')) });
    assert.equal(noMenuRes.success, false);
    assert.equal(noMenuRes.reason, 'NO_ACTIVE_MENU');

    // Non-numeric input fails closed
    const badInput = resolveDecisionInput({ input: 'maybe option 2', rootDir: tmp });
    assert.equal(badInput.success, false);
    assert.equal(badInput.reason, 'NON_NUMERIC_INPUT');

    // Out of bounds fails closed
    const outOfBounds = resolveDecisionInput({ input: 99, rootDir: tmp });
    assert.equal(outOfBounds.success, false);
    assert.equal(outOfBounds.reason, 'OPTION_OUT_OF_BOUNDS');

    // Stage mismatch fails closed
    const stageMismatch = resolveDecisionInput({ input: 1, rootDir: tmp, expectedStage: 'PLAN' });
    assert.equal(stageMismatch.success, false);
    assert.equal(stageMismatch.reason, 'STAGE_MISMATCH');

    // Valid option 2 resolves deterministically
    const validRes = resolveDecisionInput({ input: ' 2 ', rootDir: tmp });
    assert.equal(validRes.success, true);
    assert.equal(validRes.selectedOption.number, 2);
    assert.equal(validRes.actionType, 'APPLY_SUGGESTION_DECISIONS');
    assert.equal(validRes.payload.decisions['IDEA-SUG-001'].action, 'DEFER');

    // Resolving again fails closed (already resolved)
    const resolveAgain = resolveDecisionInput({ input: 2, rootDir: tmp });
    assert.equal(resolveAgain.success, false);
    assert.equal(resolveAgain.reason, 'MENU_NOT_PENDING');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Canonical reconciliation on accepted and deferred suggestions', () => {
  const tmp = makeTempDir();
  try {
    const briefPath = 'idea-brief.md';
    const briefContent = '# Idea Brief\n\n## Requirements (Must)\n\n- Existing item\n\n## Future Ideas (Explicitly Deferred)\n\n- Existing future\n';
    fs.writeFileSync(path.join(tmp, briefPath), briefContent, 'utf8');

    const s = createIdeaSuggestion({
      id: 'IDEA-SUG-001',
      title: 'Offline synchronization',
      description: 'Sync when reconnected',
      rationale: 'Reliability',
      recommendedScope: SCOPE_CLASSIFICATIONS.MUST_HAVE,
    });

    promoteSuggestionToArtifact({
      suggestion: s,
      action: 'ACCEPT',
      decisionId: 'DEC-001',
      artifactPath: briefPath,
      rootDir: tmp,
    });

    const updated = fs.readFileSync(path.join(tmp, briefPath), 'utf8');
    assert.match(updated, /Offline synchronization \[IDEA-SUG-001\]/);

    // Existing project routing does NOT restart project
    const routeExisting = routeAcceptedSuggestion({ suggestion: s, isExistingProject: true });
    assert.equal(routeExisting.route, 'EXISTING_PROJECT_DELTA');
    assert.equal(routeExisting.restartRequired, false);

    // New project routing moves forward to /dk-spec
    const routeNew = routeAcceptedSuggestion({ suggestion: s, isExistingProject: false });
    assert.equal(routeNew.route, 'NEW_PROJECT_FORWARD');
    assert.equal(routeNew.command, '/dk-spec');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
