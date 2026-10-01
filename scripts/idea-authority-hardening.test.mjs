import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { bootstrapProject } from '../runtime/bootstrap/project-bootstrap.mjs';
import {
  recordRequirementCandidate,
  recordOpenQuestion,
  resolveRequirementCandidate,
  loadDiscoveryState,
  getDiscoveryPath,
  ensurePendingIdeaInteraction,
  consumePendingIdeaInteraction,
  refreshStaleIdeaInteraction,
  loadIdeaWorkflow,
  loadIdeaDesignState,
  setIdeaDesignApplicability,
  persistCanonicalIdeaBrief,
  inspectIdeaBrief,
  loadIdeaConsumptions,
  appendIdeaConsumption,
  loadActiveDecisionMenu,
} from '../runtime/orchestration/index.mjs';

const script = fileURLToPath(new URL('./orchestration.mjs', import.meta.url));

function tempProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-idea-authority-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function briefFor(statement = 'Capture site survey measurements offline.') {
  return `# Idea Brief: Field Survey Tool

## Problem

Field teams need a reliable way to capture survey measurements.

## Intended Users

Solar field engineers.

## Success Criteria

Approved survey data is captured consistently.

## Requirements (Must)

- [IDEA-REQ-001] ${statement}

## Preferences (Should)

- None

## Assumptions

- None

## Constraints

- None

## Risks

- None

## Open Questions

- None

## Future Ideas (Explicitly Deferred)

- None
`;
}

async function bootstrap(root) {
  const result = await bootstrapProject(root);
  assert.equal(result.success, true, result.error);
}

function consume(root, workflow, selectedNumber, extra = {}) {
  return consumePendingIdeaInteraction(root, {
    selectedNumber,
    authority: 'PRODUCT_OWNER',
    expectedInteractionFingerprint: workflow.pendingInteraction.fingerprint,
    ...extra,
  });
}

async function progressToBrief(root, origin = 'USER_STATED') {
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-001',
    statement: 'Capture site survey measurements offline.',
    origin,
  });
  let workflow = ensurePendingIdeaInteraction(root);
  assert.equal(workflow.pendingInteraction.type, 'REQUIREMENT_CONFIRMATION');
  workflow = consume(root, workflow, 1);
  assert.equal(workflow.pendingInteraction.type, 'DESIGN_APPLICABILITY');
  workflow = consume(root, workflow, 2);
  assert.equal(loadIdeaDesignState(root).disposition, 'NOT_REQUIRED');
  assert.equal(workflow.pendingInteraction.type, 'SCOPE_CONFIRMATION');
  workflow = consume(root, workflow, 1);
  assert.equal(workflow.currentPhase, 'BRIEF_DRAFT');
  assert.equal(workflow.status, 'ACTION_REQUIRED');
  return workflow;
}

test('IDEA-AUTH-001 explicit provenance controls legal requirement transitions', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);

  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-001',
    statement: 'User requirement',
    origin: 'USER_STATED',
  });
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-002',
    statement: 'AI proposal',
    origin: 'AI_PROPOSED',
  });
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-003',
    statement: 'Research proposal',
    origin: 'RESEARCH_DERIVED',
  });

  assert.throws(
    () => resolveRequirementCandidate(root, { id: 'IDEA-REQ-001', action: 'CONFIRM' }),
    (error) => error.code === 'DK_IDEA_UNAUTHORIZED',
  );
  assert.throws(
    () => resolveRequirementCandidate(root, { id: 'IDEA-REQ-002', action: 'CONFIRM', authority: 'PRODUCT_OWNER' }),
    (error) => error.code === 'DK_IDEA_AUTHORITY_TRANSITION',
  );
  assert.throws(
    () => resolveRequirementCandidate(root, { id: 'IDEA-REQ-001', action: 'ADOPT', authority: 'PRODUCT_OWNER' }),
    (error) => error.code === 'DK_IDEA_AUTHORITY_TRANSITION',
  );

  assert.equal(resolveRequirementCandidate(root, {
    id: 'IDEA-REQ-001', action: 'CONFIRM', authority: 'PRODUCT_OWNER',
  }).resolutionState, 'CONFIRMED');
  assert.equal(resolveRequirementCandidate(root, {
    id: 'IDEA-REQ-002', action: 'ADOPT', authority: 'PRODUCT_OWNER',
  }).resolutionState, 'ADOPTED');
  assert.equal(resolveRequirementCandidate(root, {
    id: 'IDEA-REQ-003', action: 'ADOPT', authority: 'PRODUCT_OWNER',
  }).resolutionState, 'ADOPTED');
});

test('IDEA-AUTH-002 one exact interaction is persisted before presentation and survives restart', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  recordOpenQuestion(root, {
    id: 'IDEA-Q-001',
    question: 'Who is the primary user?',
    options: ['Field engineer', 'Sales engineer'],
  });

  const first = ensurePendingIdeaInteraction(root);
  const second = loadIdeaWorkflow(root);
  const third = ensurePendingIdeaInteraction(root);

  assert.equal(first.status, 'PENDING');
  assert.equal(first.pendingInteraction.type, 'DISCOVERY_QUESTION');
  assert.equal(first.pendingInteraction.id, 'IDEA-Q-001');
  assert.equal(first.pendingInteraction.fingerprint, second.pendingInteraction.fingerprint);
  assert.equal(first.pendingInteraction.fingerprint, third.pendingInteraction.fingerprint);
  assert.equal(first.workflowRevision, third.workflowRevision, 'Repeated next must not silently create a new question');

  const menu = loadActiveDecisionMenu(root);
  assert.equal(menu.decisionId, first.pendingInteraction.decisionId);
  assert.equal(menu.lifecycleContext.stage, 'UNDERSTAND');
});

test('IDEA-AUTH-003 exact interaction fingerprint is mandatory and stale-source consumption fails closed', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-001',
    statement: 'First requirement',
    origin: 'USER_STATED',
  });
  const pending = ensurePendingIdeaInteraction(root);

  assert.throws(
    () => consumePendingIdeaInteraction(root, {
      selectedNumber: 1,
      authority: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: 'sha256:' + '0'.repeat(64),
    }),
    (error) => error.code === 'DK_INTERACTION_FINGERPRINT_MISMATCH',
  );
  assert.equal(loadIdeaConsumptions(root).length, 0);

  // Direct runtime mutation simulates another process changing discovery after presentation.
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-002',
    statement: 'Second requirement',
    origin: 'USER_STATED',
  });
  assert.throws(
    () => consume(root, pending, 1),
    (error) => error.code === 'DK_INTERACTION_SOURCE_STALE',
  );

  const refreshed = refreshStaleIdeaInteraction(root, { authority: 'PRODUCT_OWNER' });
  assert.notEqual(refreshed.pendingInteraction.fingerprint, pending.pendingInteraction.fingerprint);
});

test('IDEA-AUTH-004 hash-chained receipts reject replay of the same persisted interaction', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-001',
    statement: 'Capture site survey measurements offline.',
    origin: 'USER_STATED',
  });

  const pending = ensurePendingIdeaInteraction(root);
  consume(root, pending, 1);
  const receipts = loadIdeaConsumptions(root);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].interactionFingerprint, pending.pendingInteraction.fingerprint);
  assert.match(receipts[0].receiptFingerprint, /^sha256:[a-f0-9]{64}$/);

  assert.throws(
    () => appendIdeaConsumption(root, {
      interactionType: receipts[0].interactionType,
      interactionId: receipts[0].interactionId,
      interactionFingerprint: receipts[0].interactionFingerprint,
      workflowRevisionBefore: receipts[0].workflowRevisionBefore,
      preDiscoveryRevision: receipts[0].preDiscoveryRevision,
      preDiscoveryFingerprint: receipts[0].preDiscoveryFingerprint,
      postDiscoveryRevision: receipts[0].postDiscoveryRevision,
      postDiscoveryFingerprint: receipts[0].postDiscoveryFingerprint,
      authority: 'PRODUCT_OWNER',
      action: receipts[0].action,
    }),
    (error) => error.code === 'DK_INTERACTION_ALREADY_CONSUMED',
  );
});

test('IDEA-AUTH-005 discovery state recovers from journal after interrupted/missing state write', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-001',
    statement: 'Recoverable requirement',
    origin: 'USER_STATED',
  });
  const before = loadDiscoveryState(root);
  fs.unlinkSync(getDiscoveryPath(root));

  const recovered = loadDiscoveryState(root);
  assert.equal(recovered.revision, before.revision);
  assert.equal(recovered.fingerprint, before.fingerprint);
  assert.equal(recovered.requirements[0].statement, 'Recoverable requirement');

  fs.writeFileSync(getDiscoveryPath(root), '{corrupt');
  assert.throws(
    () => loadDiscoveryState(root),
    (error) => error.code === 'DK_IDEA_DISCOVERY_CORRUPT',
  );
});

test('IDEA-AUTH-006 design disposition can only be created through explicit Product Owner authority', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  assert.throws(
    () => setIdeaDesignApplicability(root, { applicable: true }),
    (error) => error.code === 'DK_IDEA_UNAUTHORIZED',
  );

  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-001',
    statement: 'Capture site survey measurements offline.',
    origin: 'USER_STATED',
  });
  let workflow = ensurePendingIdeaInteraction(root);
  workflow = consume(root, workflow, 1);
  assert.equal(workflow.pendingInteraction.type, 'DESIGN_APPLICABILITY');
  workflow = consume(root, workflow, 1);
  assert.equal(workflow.pendingInteraction.type, 'DESIGN_SYSTEM_SETUP');
  workflow = consume(root, workflow, 2);

  const design = loadIdeaDesignState(root);
  assert.equal(design.applicable, true);
  assert.equal(design.disposition, 'USE_EXISTING_DESIGN_MD');
  assert.match(design.applicabilityDecisionId, /^POD-/);
  assert.match(design.dispositionDecisionId, /^POD-/);
});

test('IDEA-AUTH-007 Idea Brief approval is bound to exact discovery/design source fingerprints', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  await progressToBrief(root);

  const record = persistCanonicalIdeaBrief(root, { content: briefFor() });
  assert.match(record.sourceFingerprint, /^sha256:[a-f0-9]{64}$/);
  let workflow = ensurePendingIdeaInteraction(root);
  assert.equal(workflow.pendingInteraction.type, 'BRIEF_APPROVAL');
  workflow = consume(root, workflow, 1);
  assert.equal(workflow.currentPhase, 'COMPLETE');
  assert.equal(inspectIdeaBrief(root).approvalStatus, 'CURRENT');

  // New discovery evidence makes the prior approval stale without deleting history.
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-002',
    statement: 'New material requirement',
    origin: 'USER_STATED',
  });
  const stale = inspectIdeaBrief(root);
  assert.equal(stale.current, false);
  assert.equal(stale.approvalStatus, 'STALE');
});

test('IDEA-AUTH-008 direct physical edit invalidates Idea Brief authority', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  await progressToBrief(root);
  persistCanonicalIdeaBrief(root, { content: briefFor() });

  const filePath = path.join(root, 'docs', '01-concept', 'idea-brief.md');
  fs.appendFileSync(filePath, '\nUnauthorized direct edit\n');
  const inspection = inspectIdeaBrief(root);
  assert.equal(inspection.status, 'TAMPERED');
  assert.equal(inspection.approvalStatus, 'STALE');
});

test('IDEA-AUTH-009 custom option without custom text does not consume the numbered decision', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-001',
    statement: 'Custom handling requirement',
    origin: 'USER_STATED',
  });
  const pending = ensurePendingIdeaInteraction(root);
  assert.equal(pending.pendingInteraction.options.at(-1).actionType, 'CUSTOM');

  assert.throws(
    () => consume(root, pending, pending.pendingInteraction.options.length),
    (error) => error.code === 'DK_IDEA_CUSTOM_TEXT_REQUIRED',
  );
  assert.equal(loadIdeaConsumptions(root).length, 0);
  assert.equal(loadActiveDecisionMenu(root).status, 'PENDING');
});

test('IDEA-AUTH-010 CLI persists and rehydrates exact IDEA interaction across fresh processes', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);

  const candidate = spawnSync(process.execPath, [
    script,
    '--operation=idea-record-candidate',
    '--input-json=' + JSON.stringify({
      id: 'IDEA-REQ-001',
      statement: 'CLI requirement',
      origin: 'USER_STATED',
    }),
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);

  const first = spawnSync(process.execPath, [script, '--operation=idea-next'], { cwd: root, encoding: 'utf8' });
  const second = spawnSync(process.execPath, [script, '--operation=idea-next'], { cwd: root, encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(second.status, 0, second.stderr || second.stdout);

  const one = JSON.parse(first.stdout).result;
  const two = JSON.parse(second.stdout).result;
  assert.equal(one.pendingInteraction.fingerprint, two.pendingInteraction.fingerprint);

  const consumed = spawnSync(process.execPath, [
    script,
    '--operation=idea-consume',
    '--input-json=' + JSON.stringify({
      selectedNumber: 1,
      authority: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: one.pendingInteraction.fingerprint,
    }),
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(consumed.status, 0, consumed.stderr || consumed.stdout);
  const result = JSON.parse(consumed.stdout).result;
  assert.equal(result.pendingInteraction.type, 'DESIGN_APPLICABILITY');
});

test('IDEA-AUTH-011 custom answer is persisted as a consumed Product Owner interaction requiring review', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  recordOpenQuestion(root, {
    id: 'IDEA-Q-001',
    question: 'Where will this be used?',
    options: ['On site', 'In the office'],
  });
  const pending = ensurePendingIdeaInteraction(root);
  const customNumber = pending.pendingInteraction.options.length;
  const after = consume(root, pending, customNumber, { customText: 'Mostly on remote solar sites.' });
  assert.equal(after.status, 'CUSTOM_INPUT_REVIEW');
  assert.equal(after.customInstruction, 'Mostly on remote solar sites.');
  assert.equal(loadIdeaConsumptions(root).length, 1);
});


test('IDEA-AUTH-012 corrupt workflow, receipt and discovery journal chains fail closed', async (t) => {
  const root = tempProject(t);
  await bootstrap(root);
  recordRequirementCandidate(root, {
    id: 'IDEA-REQ-001',
    statement: 'Integrity-protected requirement',
    origin: 'USER_STATED',
  });
  const pending = ensurePendingIdeaInteraction(root);
  consume(root, pending, 1);

  const receiptPath = path.join(root, '.development-kit', 'idea', 'consumptions.json');
  const receipts = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  receipts[0].action = 'TAMPERED';
  fs.writeFileSync(receiptPath, JSON.stringify(receipts, null, 2));
  assert.throws(
    () => loadIdeaConsumptions(root),
    (error) => error.code === 'DK_IDEA_RECEIPT_INTEGRITY_MISMATCH',
  );

  // Restore the receipt so remaining corruption checks isolate their own state.
  receipts[0].action = 'CONFIRM_REQUIREMENT';
  // Rebuild by using the untouched receipt from a fresh project state is safer than forging its hash.
  fs.rmSync(receiptPath);
  const root2 = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-idea-corrupt-'));
  t.after(() => fs.rmSync(root2, { recursive: true, force: true }));
  await bootstrap(root2);
  recordRequirementCandidate(root2, {
    id: 'IDEA-REQ-001',
    statement: 'Integrity-protected requirement',
    origin: 'USER_STATED',
  });
  const pending2 = ensurePendingIdeaInteraction(root2);

  const workflowPath = path.join(root2, '.development-kit', 'idea', 'workflow.json');
  const workflowRaw = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  workflowRaw.pendingInteraction.prompt = 'Tampered prompt';
  fs.writeFileSync(workflowPath, JSON.stringify(workflowRaw, null, 2));
  assert.throws(
    () => loadIdeaWorkflow(root2),
    (error) => error.code === 'DK_INTERACTION_FINGERPRINT_MISMATCH',
  );

  // Journal chain tampering fails even if discovery.json itself is otherwise valid.
  const journalPath = path.join(root2, '.development-kit', 'idea', 'discovery-journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  journal.entries[0].eventType = 'TAMPERED';
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
  assert.throws(
    () => loadDiscoveryState(root2),
    (error) => ['DK_IDEA_JOURNAL_CHAIN_BROKEN', 'DK_IDEA_JOURNAL_CORRUPT'].includes(error.code),
  );

  assert.ok(pending2.pendingInteraction.fingerprint);
});
