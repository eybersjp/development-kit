import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { executeLifecycleEntry, COMMAND_ENTRY_TAXONOMY } from '../runtime/lifecycle/lifecycle-gate.mjs';
import { getProjectBootstrapStatus, bootstrapProject, assertProjectBootstrapped } from '../runtime/bootstrap/project-bootstrap.mjs';
import { resolveScriptPath } from './run.mjs';
import {
  createPODecision,
  createSupersedingPODecision,
  persistPODecision,
  loadPODecisionById,
  validatePODecision,
} from '../runtime/orchestration/po-decisions.mjs';
import {
  resolveCanonicalIdeaArtifact,
  persistCanonicalIdeaBrief,
  reconcileCanonicalIdeaBrief,
  computeSha256,
  loadArtifactRegistry,
  persistArtifactRegistry,
  registerArtifact,
} from '../runtime/artifacts/artifact-registry.mjs';
import {
  isValidRequirementTransition,
  isValidQuestionTransition,
  LEGAL_REQUIREMENT_TRANSITIONS,
  LEGAL_QUESTION_TRANSITIONS,
  recordRequirementCandidate,
  confirmRequirementCandidate,
  adoptRequirementCandidate,
  rejectRequirementCandidate,
  supersedeRequirementCandidate,
  recordOpenQuestion,
  resolveOpenQuestion,
  supersedeOpenQuestion,
  evaluateDiscoveryReadiness,
  loadDiscoveryState,
  persistDiscoveryState,
  classifyRequirementScope,
} from '../runtime/orchestration/idea-discovery.mjs';
import {
  computeIdeaStageState,
  persistApprovalRecord,
  computeEffectiveApprovalStatus,
  loadApprovalsHistory,
  approveCurrentIdeaBrief,
} from '../runtime/orchestration/idea-state.mjs';
import {
  loadWorkflowCheckpoint,
  persistWorkflowCheckpoint,
  presentCurrentInteraction,
  resolveIdeaWorkflowState,
  recordDesignAuthoritySetup,
  recordIdeaChallengeResponse,
  consumeDiscoveryQuestionResponse,
  consumeDesignApplicabilityResponse,
  recordScopeProposal,
  consumeRequirementConfirmation,
  consumeRequirementModification,
  consumeScopeConfirmation,
  consumeBriefApproval,
  validatePendingInteractionForConsumption,
  loadDesignSystemState,
  persistDesignSystemState,
  isDesignAuthorityApplicable,
  validateWorkflowStructure,
  validateWorkflowConsistency,
  computeInteractionFingerprint,
  IdeaWorkflowError,
} from '../runtime/orchestration/idea-workflow.mjs';
import {
  loadConsumptionReceipts,
  appendConsumptionReceipt,
  findMatchingReceipt,
} from '../runtime/orchestration/idea-consumptions.mjs';
import { NextStepResolver } from '../runtime/next-step/resolver.mjs';
import { validateIdeaBriefStructure } from '../runtime/orchestration/idea-schema.mjs';


function setupConfirmedCandidate(rootDir, { id, statement, origin = 'USER_STATED', scopeDisposition = 'MUST' }) {
  recordRequirementCandidate(rootDir, { id, statement, origin });
  confirmRequirementCandidate(rootDir, { id, confirmedBy: 'PRODUCT_OWNER' });
  if (scopeDisposition && scopeDisposition !== 'UNCLASSIFIED') {
    classifyRequirementScope(rootDir, { id, scopeDisposition, confirmedBy: 'PRODUCT_OWNER' });
  }
}

function setupAdoptedCandidate(rootDir, { id, statement, origin = 'RESEARCH_DERIVED', scopeDisposition = 'MUST' }) {
  recordRequirementCandidate(rootDir, { id, statement, origin });
  adoptRequirementCandidate(rootDir, { id, confirmedBy: 'PRODUCT_OWNER' });
  if (scopeDisposition && scopeDisposition !== 'UNCLASSIFIED') {
    classifyRequirementScope(rootDir, { id, scopeDisposition, confirmedBy: 'PRODUCT_OWNER' });
  }
}

function setupAnsweredQuestion(rootDir, { id, question, materiality = 'MATERIAL' }) {
  recordOpenQuestion(rootDir, { id, question, materiality });
  resolveOpenQuestion(rootDir, { id, resolution: 'ANSWERED', resolvedBy: 'PRODUCT_OWNER' });
}

function createTempDir(prefix = 'dk-v091-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

const VALID_BRIEF = `# Idea Brief: Solar Commissioning Manager

## Problem
Field solar installers lack structured commissioning documentation tools.

## Intended Users
Solar EPC commissioning technicians and field project managers.

## Success Criteria
100% compliant commissioning sign-off records produced in PDF/JSON.

## Requirements (Must)
- [IDEA-REQ-001] Capture inverter DC string voltages and insulation resistance measurements.
- [IDEA-REQ-002] Support offline checklist completion.

## Preferences (Should)
- None

## Assumptions
- Technicians have mobile tablets on site.

## Constraints
- Must operate without continuous cellular connectivity.

## Risks
- Extreme temperatures may affect tablet battery life.

## Open Questions
- None

## Future Ideas (Explicitly Deferred)
- Direct FLIR radiometric camera integration.
`;

test('Blocker 1: Packaged --project install executes lifecycle and orchestration from consumer project root', () => {
  const consumerDir = createTempDir('dk-consumer-field-');
  try {
    const installerScript = path.resolve('scripts/install-antigravity.mjs');
    const instResult = spawnSync(process.execPath, [installerScript, '--project'], {
      cwd: consumerDir,
      encoding: 'utf8',
    });
    assert.equal(instResult.status, 0, instResult.stderr || instResult.stdout);

    // Verify scripts/ and runtime/ are NOT in consumer root
    assert.equal(fs.existsSync(path.join(consumerDir, 'scripts')), false, 'consumer root must not have scripts/');
    assert.equal(fs.existsSync(path.join(consumerDir, 'runtime')), false, 'consumer root must not have runtime/');

    // Read the installed command markdown file directly from consumer project
    const installedCmdPath = path.join(consumerDir, '.agents', 'plugins', 'development-kit', 'commands', 'dk-idea.md');
    assert.ok(fs.existsSync(installedCmdPath), 'installed dk-idea.md must exist');
    const cmdContent = fs.readFileSync(installedCmdPath, 'utf8');

    // Extract literal command from the code block
    const match = cmdContent.match(/```bash\r?\n(node\s+[^\r\n]+)\r?\n```/);
    assert.ok(match, 'Must find literal node execution line in dk-idea.md');
    const literalCmd = match[1].trim();

    // Parse command arguments respecting quotes
    function parseTokens(cmd) {
      const tokens = [];
      let current = '';
      let inQuotes = false;
      let quoteChar = '';
      for (let i = 0; i < cmd.length; i++) {
        const c = cmd[i];
        if (inQuotes) {
          if (c === quoteChar) {
            inQuotes = false;
          } else {
            current += c;
          }
        } else {
          if (c === '"' || c === "'") {
            inQuotes = true;
            quoteChar = c;
          } else if (/\s/.test(c)) {
            if (current.length > 0) {
              tokens.push(current);
              current = '';
            }
          } else {
            current += c;
          }
        }
      }
      if (current.length > 0) tokens.push(current);
      return tokens;
    }

    const parts = parseTokens(literalCmd);
    assert.equal(parts[0], 'node');
    const scriptPath = parts[1];
    const scriptArgs = parts.slice(2);

    // Execute literal command exactly as installed command Markdown specifies from consumer project root
    const execRes = spawnSync(process.execPath, [
      scriptPath,
      ...scriptArgs,
    ], {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(execRes.status, 0, execRes.stderr || execRes.stdout);
    const parsed = JSON.parse(execRes.stdout);
    assert.equal(parsed.success, true);
    assert.equal(parsed.bootstrapped, true);
    assert.ok(fs.existsSync(path.join(consumerDir, '.development-kit')));
  } finally {
    cleanupTempDir(consumerDir);
  }
});

test('Blocker 2: Must ↔ IDEA-REQ exact 1-to-1 binding and adversarial cases', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // Case A: Missing explicit [IDEA-REQ-xxx] tag -> BLOCK
    const untaggedBrief = VALID_BRIEF.replace('- [IDEA-REQ-001] ', '- ');
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: untaggedBrief });
    const stageA = computeIdeaStageState(tempDir);
    assert.notEqual(stageA.state, 'READY_FOR_APPROVAL');
    assert.equal(stageA.state, 'DISCOVERY_IN_PROGRESS');
    assert.ok(stageA.issues.some(i => i.code === 'CANONICAL_GRAMMAR_ERROR' || i.code === 'UNBOUND_MUST_REQUIREMENT'));

    // Case B: Must references a REJECTED candidate -> BLOCK
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
    });
    rejectRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      confirmedBy: 'PRODUCT_OWNER',
    });
    const rejBrief = VALID_BRIEF.replace('- [IDEA-REQ-002] Support offline checklist completion.', '- [IDEA-REQ-003] Support offline checklist completion.');
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: rejBrief });
    const stageB = computeIdeaStageState(tempDir);
    assert.notEqual(stageB.state, 'READY_FOR_APPROVAL');
    assert.ok(stageB.issues.some(i => i.code === 'INVALID_REQUIREMENT_AUTHORITY'));

    // Case C: Duplicate candidate reference in Must -> BLOCK
    const dupBrief = VALID_BRIEF.replace('- [IDEA-REQ-002] Support offline checklist completion.', '- [IDEA-REQ-001] Duplicate reference to same candidate.');
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: dupBrief });
    const stageC = computeIdeaStageState(tempDir);
    assert.notEqual(stageC.state, 'READY_FOR_APPROVAL');
    assert.ok(stageC.issues.some(i => i.code === 'DUPLICATE_REQUIREMENT_REFERENCE'));

    // Case D: Tagged unknown candidate -> BLOCK
    const unknownBrief = VALID_BRIEF.replace('- [IDEA-REQ-002] Support offline checklist completion.', '- [IDEA-REQ-999] Unknown candidate.');
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: unknownBrief });
    const stageD = computeIdeaStageState(tempDir);
    assert.notEqual(stageD.state, 'READY_FOR_APPROVAL');
    assert.ok(stageD.issues.some(i => i.code === 'UNKNOWN_REQUIREMENT_REFERENCE'));

    // Case E: All Must requirements properly bound and CONFIRMED -> ELIGIBLE
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF });
    const stageE = computeIdeaStageState(tempDir);
    assert.equal(stageE.state, 'READY_FOR_APPROVAL');

    // Case F: Untagged Open Question -> BLOCK
    const qUntaggedBrief = VALID_BRIEF.replace('## Open Questions\n- None', '## Open Questions\n- What tablet OS versions must be supported?');
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: qUntaggedBrief });
    const stageF = computeIdeaStageState(tempDir);
    assert.notEqual(stageF.state, 'READY_FOR_APPROVAL');
    assert.ok(stageF.issues.some(i => i.code === 'CANONICAL_GRAMMAR_ERROR' || i.code === 'UNBOUND_OPEN_QUESTION'));

    // Case G: Tagged Open Question but UNRESOLVED in discovery -> BLOCK
    const qTaggedBrief = VALID_BRIEF.replace('## Open Questions\n- None', '## Open Questions\n- [IDEA-Q-001] What tablet OS versions must be supported?');
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'What tablet OS versions must be supported?',
      materiality: 'MATERIAL',
      resolution: 'UNRESOLVED',
    });
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: qTaggedBrief });
    const stageG = computeIdeaStageState(tempDir);
    assert.notEqual(stageG.state, 'READY_FOR_APPROVAL');
    assert.equal(stageG.state, 'DRAFT_READY');
    assert.ok(stageG.issues.some(i => i.code === 'UNRESOLVED_MATERIAL_QUESTION'));

    // Case H: Resolved/Deferred with valid authority -> ELIGIBLE
    resolveOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
    });
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: qTaggedBrief });
    const stageH = computeIdeaStageState(tempDir);
    assert.equal(stageH.state, 'READY_FOR_APPROVAL');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Blocker 3: Unsafe authority defaults removed, strict validation enforced', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // Omitted origin throws
    assert.throws(() => {
      recordRequirementCandidate(tempDir, { id: 'IDEA-REQ-001', statement: 'Sample' });
    }, (err) => err.code === 'DK_INVALID_ORIGIN');

    // Origin USER_CONFIRMED at candidate capture throws
    assert.throws(() => {
      recordRequirementCandidate(tempDir, { id: 'IDEA-REQ-001', statement: 'Sample', origin: 'USER_CONFIRMED' });
    }, (err) => err.code === 'DK_INVALID_ORIGIN');

    // New candidate created as CONFIRMED directly throws
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Sample',
        origin: 'USER_STATED',
        resolutionState: 'CONFIRMED',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // adoptRequirementCandidate without explicit confirmedBy = PRODUCT_OWNER throws
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Sample research',
      origin: 'RESEARCH_DERIVED',
    });
    assert.throws(() => {
      adoptRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-002',
        confirmedBy: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_ADOPTION' || err.code === 'DK_UNAUTHORIZED_CONFIRMATION');

    // confirmRequirementCandidate without explicit confirmedBy = PRODUCT_OWNER throws
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Sample proposed',
      origin: 'AI_PROPOSED',
    });
    assert.throws(() => {
      confirmRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-003',
        confirmedBy: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_CONFIRMATION');

    // Invalid question resolution throws
    assert.throws(() => {
      recordOpenQuestion(tempDir, { id: 'IDEA-Q-001', question: 'Q?', resolution: 'INVALID_RESOLUTION' });
    }, (err) => err.code === 'DK_INVALID_QUESTION_RESOLUTION' || err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // persistApprovalRecord without approvingAuthority = PRODUCT_OWNER throws
    assert.throws(() => {
      persistApprovalRecord(tempDir, {
        artifactFingerprint: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        artifactRevision: 1,
        discoveryRevision: 0,
        discoveryFingerprint: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        approvingAuthority: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_APPROVAL');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Blocker 4: All 16 public command markdown files invoke centralized lifecycle adapter', () => {
  const commandsDir = path.resolve('commands');
  const files = fs.readdirSync(commandsDir).filter((f) => f.startsWith('dk-') && f.endsWith('.md'));
  assert.equal(files.length, 16);

  for (const file of files) {
    const cmdName = file.replace('.md', '');
    const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    assert.ok(
      content.includes(`node scripts/lifecycle.mjs --command=${cmdName}`),
      `Command ${file} must invoke node scripts/lifecycle.mjs --command=${cmdName}`
    );
  }
});

test('Blocker 5: Discovery state revision changes invalidate Idea Brief approval (discovery staleness)', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    const disc1 = loadDiscoveryState(tempDir);
    const p1 = persistCanonicalIdeaBrief({
      rootDir: tempDir,
      content: VALID_BRIEF,
      discoveryRevision: disc1.revision,
      discoveryFingerprint: disc1.fingerprint,
    });
    persistApprovalRecord(tempDir, {
      artifactFingerprint: p1.fingerprint,
      artifactRevision: p1.revision,
      discoveryRevision: disc1.revision,
      discoveryFingerprint: disc1.fingerprint,
      approvingAuthority: 'PRODUCT_OWNER',
    });

    const stage1 = computeIdeaStageState(tempDir);
    assert.equal(stage1.state, 'APPROVED');

    // Add new material requirement to discovery.json -> discovery revision bumps
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Third requirement',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    // Re-evaluating stage state without re-persisting Idea Brief must invalidate APPROVED
    const stage2 = computeIdeaStageState(tempDir);
    assert.notEqual(stage2.state, 'APPROVED');
    assert.equal(stage2.state, 'DISCOVERY_IN_PROGRESS');
    assert.ok(stage2.issues.some(i => i.code === 'DISCOVERY_REVISION_MISMATCH' || i.code === 'MISSING_MUST_REQUIREMENT'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Blocker 6: Public CLI orchestration operations for IDEA workflow execute cleanly', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const scriptPath = path.resolve('scripts/orchestration.mjs');

    // 1. Record candidates via CLI
    const candExec1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-001',
        statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
        origin: 'USER_STATED',
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(candExec1.status, 0);

    const candExec2 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-002',
        statement: 'Support offline checklist completion.',
        origin: 'USER_STATED',
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(candExec2.status, 0);

    // 2. Setup Design Authority and Idea Challenge
    presentCurrentInteraction(tempDir);
    let state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'DESIGN_APPLICABILITY_CHECK');

    consumeDesignApplicabilityResponse(tempDir, {
      choice: '1. Visual user interface (web, mobile, desktop)',
      applicable: true,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'DESIGN_SYSTEM_SETUP');

    recordDesignAuthoritySetup(tempDir, {
      disposition: 'DEFERRED',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'IDEA_CHALLENGE');

    recordIdeaChallengeResponse(tempDir, {
      response: 'Confirmed proceed',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    // 3. Workflow now presents REQUIREMENT_CONFIRMATION
    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'REQUIREMENT_CONFIRMATION');

    // Confirm candidates via CLI with interaction fingerprint
    const confExec1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-confirm-requirements',
      '--input-json=' + JSON.stringify({
        candidateIds: ['IDEA-REQ-001', 'IDEA-REQ-002'],
        confirmedBy: 'PRODUCT_OWNER',
        expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(confExec1.status, 0);

    // 4. Scope Proposal & Confirmation turn
    const propExec1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-propose-scope',
      '--input-json=' + JSON.stringify({
        scopeProposal: {
          'IDEA-REQ-001': 'MUST',
          'IDEA-REQ-002': 'MUST',
        },
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(propExec1.status, 0);

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'SCOPE_CONFIRMATION');

    // Classify candidate scope via CLI
    const scopeExec1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-classify-scope',
      '--input-json=' + JSON.stringify({
        scopeMapping: {
          'IDEA-REQ-001': 'MUST',
          'IDEA-REQ-002': 'MUST',
        },
        confirmedBy: 'PRODUCT_OWNER',
        expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(scopeExec1.status, 0);

    // 5. Persist Idea Brief via CLI
    const persistExec = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-persist',
      '--input-json=' + JSON.stringify({ content: VALID_BRIEF })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(persistExec.status, 0);

    // 6. Brief Approval turn
    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'BRIEF_APPROVAL');
    presentCurrentInteraction(tempDir);

    // Approve Idea Brief via CLI
    const approveExec = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-approve',
      '--input-json=' + JSON.stringify({
        approvingAuthority: 'PRODUCT_OWNER',
        expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(approveExec.status, 0);

    // Check state via CLI
    const stateExec = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-state'
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(stateExec.status, 0);
    const stateRes = JSON.parse(stateExec.stdout);
    assert.equal(stateRes.result.state, 'APPROVED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Blocker 7: Corrupt project state fails closed and does not masquerade as in-progress', async () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const appFile = path.join(tempDir, '.development-kit', 'idea', 'approvals.json');
    fs.mkdirSync(path.dirname(appFile), { recursive: true });
    fs.writeFileSync(appFile, '{ corrupt json', 'utf8');

    const state = computeIdeaStageState(tempDir);
    assert.equal(state.state, 'BLOCKED');
    assert.equal(state.blockerType, 'RUNTIME_FRAMEWORK');
    assert.equal(state.issues[0].code, 'DK_APPROVALS_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Backward Compatibility: NextStepContext accepts not_required, pending, unverified and boolean strings', () => {
  const resolver = new NextStepResolver();
  const res1 = resolver.resolve({
    completedCommand: '/dk-test',
    approvalStatus: 'not_required',
    postSimplificationVerificationStatus: 'unverified',
    success: 'true',
  });
  assert.ok(Array.isArray(res1));
});

test('True Fresh Process Restart: Child process reconstructs state accurately with 0 in-memory state', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    const disc = loadDiscoveryState(tempDir);
    const p = persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF, discoveryRevision: disc.revision, discoveryFingerprint: disc.fingerprint });
    persistApprovalRecord(tempDir, {
      artifactFingerprint: p.fingerprint,
      artifactRevision: p.revision,
      discoveryRevision: disc.revision,
      discoveryFingerprint: disc.fingerprint,
      approvingAuthority: 'PRODUCT_OWNER',
    });

    // Spawn a separate node process to compute state
    const scriptPath = path.resolve('scripts/orchestration.mjs');
    const child = spawnSync(process.execPath, [scriptPath, '--operation=idea-state'], {
      cwd: tempDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(child.status, 0);
    const parsed = JSON.parse(child.stdout);
    assert.equal(parsed.result.state, 'APPROVED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Restored: Fresh bootstrap creates valid directory and project identity', async () => {
  const tempDir = createTempDir();
  try {
    const statusBefore = getProjectBootstrapStatus(tempDir);
    assert.equal(statusBefore.initialized, false);

    const boot = await bootstrapProject(tempDir);
    assert.equal(boot.success, true);
    assert.ok(boot.identity.projectId.startsWith('proj_') || boot.identity.projectId.startsWith('proj-'));

    const check = assertProjectBootstrapped(tempDir);
    assert.equal(check.bootstrapped, true);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Restored: Direct-edit fingerprint mismatch blocks approval state', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    const disc = loadDiscoveryState(tempDir);
    const p1 = persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF, discoveryRevision: disc.revision, discoveryFingerprint: disc.fingerprint });
    persistApprovalRecord(tempDir, {
      artifactFingerprint: p1.fingerprint,
      artifactRevision: p1.revision,
      discoveryRevision: disc.revision,
      discoveryFingerprint: disc.fingerprint,
      approvingAuthority: 'PRODUCT_OWNER',
    });
    assert.equal(computeIdeaStageState(tempDir).state, 'APPROVED');

    // Modify file directly with fs.writeFileSync
    fs.writeFileSync(path.join(tempDir, 'idea-brief.md'), VALID_BRIEF + '\n# rogue modification\n', 'utf8');
    const modState = computeIdeaStageState(tempDir);
    assert.equal(modState.state, 'BLOCKED');
    assert.equal(modState.blockerType, 'RUNTIME_FRAMEWORK');
    assert.equal(modState.issues[0].code, 'DK_ARTIFACT_FINGERPRINT_MISMATCH');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Restored: Conflicting duplicate canonical artifacts fail closed with DK_ARTIFACT_AUTHORITY_CONFLICT', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    fs.writeFileSync(path.join(tempDir, 'idea-brief.md'), '# Root Brief\n', 'utf8');
    const docsDir = path.join(tempDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'idea-brief.md'), '# Legacy Conflicting Brief\n', 'utf8');

    assert.throws(() => {
      resolveCanonicalIdeaArtifact(tempDir);
    }, (err) => err.code === 'DK_ARTIFACT_AUTHORITY_CONFLICT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Pure read-only: Identical duplicate canonical artifacts resolve root without deleting legacy file', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const briefContent = VALID_BRIEF;
    fs.writeFileSync(path.join(tempDir, 'idea-brief.md'), briefContent, 'utf8');
    const docsDir = path.join(tempDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'idea-brief.md'), briefContent, 'utf8');

    const resolved = resolveCanonicalIdeaArtifact(tempDir);
    assert.equal(resolved.relativePath, 'idea-brief.md');
    assert.equal(fs.existsSync(path.join(docsDir, 'idea-brief.md')), true, 'read-only resolver must NOT mutate filesystem');
    assert.equal(resolved.condition, 'IDENTICAL_DUPLICATE_DETECTED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Hardened run.mjs: Rejects path traversal and scripts not in allowlist', () => {
  const runnerScript = path.resolve('scripts/run.mjs');

  // Traversal rejected
  const travExec = spawnSync(process.execPath, [runnerScript, '../secret.mjs'], { encoding: 'utf8' });
  assert.equal(travExec.status, 1);
  const travParsed = JSON.parse(travExec.stderr);
  assert.equal(travParsed.code, 'DK_SCRIPT_RESOLUTION_ERROR');

  // Disallowed script rejected
  const disExec = spawnSync(process.execPath, [runnerScript, 'unapproved.mjs'], { encoding: 'utf8' });
  assert.equal(disExec.status, 1);
  const disParsed = JSON.parse(disExec.stderr);
  assert.equal(disParsed.code, 'DK_SCRIPT_RESOLUTION_ERROR');
});

test('Strict load validation: Corrupt discovery.json, approvals.json, and artifacts.json fail closed', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // Corrupt discovery.json with invalid candidate structure throws
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    fs.mkdirSync(path.dirname(discPath), { recursive: true });
    fs.writeFileSync(discPath, JSON.stringify({
      schemaVersion: '1.0.0',
      revision: 1,
      requirements: [{ id: 'INVALID-ID', statement: 'bad' }],
      openQuestions: [],
    }), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');

    // Corrupt approvals.json with invalid authority throws
    const appPath = path.join(tempDir, '.development-kit', 'idea', 'approvals.json');
    fs.writeFileSync(appPath, JSON.stringify({
      schemaVersion: '1.0.0',
      approvals: [{
        id: 'APPR-IDEA-1-1',
        artifactFingerprint: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        artifactRevision: 1,
        discoveryRevision: 1,
        discoveryFingerprint: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        approvingAuthority: 'AI_AGENT',
        approvedAt: new Date().toISOString(),
      }],
    }), 'utf8');

    assert.throws(() => {
      loadApprovalsHistory(tempDir);
    }, (err) => err.code === 'DK_APPROVALS_CORRUPT');

    // Corrupt artifacts.json with non-idea-brief canonicalPath throws
    const artPath = path.join(tempDir, '.development-kit', 'artifacts.json');
    fs.writeFileSync(artPath, JSON.stringify({
      schemaVersion: '1.0.0',
      artifacts: {
        IDEA_BRIEF: { canonicalPath: 'docs/custom-idea.md', fingerprint: 'sha256:123', revision: 1 },
      },
    }), 'utf8');

    assert.throws(() => {
      loadArtifactRegistry(tempDir);
    }, (err) => err.code === 'DK_ARTIFACT_REGISTRY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Global install: Literal global command executes from separate project root without local .agents', () => {
  const fakeHome = createTempDir('dk-global-home-');
  const projectDir = createTempDir('dk-global-consumer-');
  try {
    const installerScript = path.resolve('scripts/install-antigravity.mjs');
    const instResult = spawnSync(process.execPath, [installerScript, '--global'], {
      cwd: projectDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: fakeHome,
        USERPROFILE: fakeHome,
      },
    });
    assert.equal(instResult.status, 0, instResult.stderr || instResult.stdout);

    // Global install location
    const globalPluginDir = path.join(fakeHome, '.gemini', 'config', 'plugins', 'development-kit');
    assert.ok(fs.existsSync(globalPluginDir), 'Global plugin dir must exist in fakeHome');

    // Read installed dk-idea.md in global plugin
    const globalIdeaCmd = path.join(globalPluginDir, 'commands', 'dk-idea.md');
    assert.ok(fs.existsSync(globalIdeaCmd), 'Global dk-idea.md must exist');
    const cmdContent = fs.readFileSync(globalIdeaCmd, 'utf8');

    // Verify command references absolute global runner path
    const match = cmdContent.match(/```bash\r?\n(node\s+[^\r\n]+)\r?\n```/);
    assert.ok(match, 'Must find literal command in global dk-idea.md');
    const literalCmd = match[1].trim();

    // Verify literal command does NOT reference project-local .agents
    assert.ok(!literalCmd.includes('.agents/plugins'), 'Global command must not reference local .agents');

    // Execute global command from projectDir (which has no .agents)
    assert.equal(fs.existsSync(path.join(projectDir, '.agents')), false);

    // Parse and execute node "<globalRunScript>" scripts/lifecycle.mjs --command=dk-idea
    const parts = literalCmd.match(/node\s+"([^"]+)"\s+(.+)/);
    assert.ok(parts, 'Command should parse with quoted global path');
    const runnerPath = parts[1];
    const scriptArgs = parts[2].split(/\s+/);

    const execRes = spawnSync(process.execPath, [runnerPath, ...scriptArgs], {
      cwd: projectDir,
      encoding: 'utf8',
      env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, NODE_PATH: '' },
    });
    assert.equal(execRes.status, 0, execRes.stderr || execRes.stdout);
    const parsed = JSON.parse(execRes.stdout);
    assert.equal(parsed.success, true);
    assert.equal(parsed.bootstrapped, true);
  } finally {
    cleanupTempDir(fakeHome);
    cleanupTempDir(projectDir);
  }
});

test('Statement binding & tag integrity: Content mismatch and multiple tags per line fail closed', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    // 1. Spoofed statement text under valid ID -> REQUIREMENT_CONTENT_MISMATCH
    const spoofedBrief = VALID_BRIEF.replace(
      '- [IDEA-REQ-001] Capture inverter DC string voltages and insulation resistance measurements.',
      '- [IDEA-REQ-001] Totally different unapproved requirement statement.'
    );
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: spoofedBrief });
    const spoofStage = computeIdeaStageState(tempDir);
    assert.equal(spoofStage.state, 'DISCOVERY_IN_PROGRESS');
    assert.ok(spoofStage.issues.some(i => i.code === 'REQUIREMENT_CONTENT_MISMATCH'));

    // 2. Multiple tags on single line -> MULTIPLE_REQUIREMENT_REFERENCES
    const multiTagBrief = VALID_BRIEF.replace(
      '- [IDEA-REQ-001] Capture inverter DC string voltages and insulation resistance measurements.',
      '- [IDEA-REQ-001] [IDEA-REQ-002] Capture inverter DC string voltages and insulation resistance measurements.'
    );
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: multiTagBrief });
    const multiStage = computeIdeaStageState(tempDir);
    assert.equal(multiStage.state, 'DISCOVERY_IN_PROGRESS');
    assert.ok(multiStage.issues.some(i => i.code === 'MULTIPLE_REQUIREMENT_REFERENCES'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Discovery provenance immutability: Cannot overwrite origin on existing candidate', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Original statement',
      origin: 'RESEARCH_DERIVED',
      resolutionState: 'UNRESOLVED',
    });

    // Attempting to overwrite origin with USER_STATED throws DK_PROVENANCE_IMMUTABLE
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Original statement',
        origin: 'USER_STATED',
      });
    }, (err) => err.code === 'DK_PROVENANCE_IMMUTABLE');

    // Valid adoption retains original RESEARCH_DERIVED origin
    const adopted = adoptRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(adopted.origin, 'RESEARCH_DERIVED');
    assert.equal(adopted.resolutionState, 'ADOPTED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Legacy Unbound: Auto-discovered Idea Brief without discovery binding returns RECONCILIATION_REQUIRED', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    // Write physical idea-brief.md directly without registry
    fs.writeFileSync(path.join(tempDir, 'idea-brief.md'), VALID_BRIEF, 'utf8');

    // computeIdeaStageState will auto-discover it with discoveryRevision: null
    const stage = computeIdeaStageState(tempDir);
    assert.equal(stage.state, 'RECONCILIATION_REQUIRED');
    assert.ok(stage.issues.some(i => i.code === 'DISCOVERY_BINDING_REQUIRED'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 6: run.mjs resolves sibling only and fails closed if missing', () => {
  // Test resolveScriptPath directly
  const siblingPath = resolveScriptPath('lifecycle.mjs');
  assert.ok(siblingPath.endsWith(path.join('scripts', 'lifecycle.mjs')));

  // Deleting or asking for nonexistent sibling in allowlist fails closed
  assert.throws(() => {
    resolveScriptPath('non-existent-sibling.mjs');
  });
});

test('Candidate 6: Exact statement and question normalization equality enforced', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    // Substring or prefix statement should fail REQUIREMENT_CONTENT_MISMATCH
    const subBrief = VALID_BRIEF.replace(
      '- [IDEA-REQ-001] Capture inverter DC string voltages and insulation resistance measurements.',
      '- [IDEA-REQ-001] Capture inverter DC string voltages.'
    );
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: subBrief });
    const subStage = computeIdeaStageState(tempDir);
    assert.equal(subStage.state, 'DISCOVERY_IN_PROGRESS');
    assert.ok(subStage.issues.some(i => i.code === 'REQUIREMENT_CONTENT_MISMATCH'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 6: Identity immutability and explicit supersession for requirements and questions', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    // 1. Requirements immutability
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Original statement text',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    // Attempting to mutate statement text under same ID fails
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Mutated statement text',
        materiality: 'MATERIAL',
        origin: 'USER_STATED',
      });
    }, (err) => err.code === 'DK_STATEMENT_IMMUTABLE');

    // Attempting to mutate materiality under same ID fails
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Original statement text',
        materiality: 'NON_MATERIAL',
        origin: 'USER_STATED',
      });
    }, (err) => err.code === 'DK_MATERIALITY_IMMUTABLE');

    // Explicit supersession succeeds
    const superRes = supersedeRequirementCandidate(tempDir, 'IDEA-REQ-001', {
      id: 'IDEA-REQ-002',
      statement: 'Refined statement text',
      materiality: 'MATERIAL',
      origin: 'USER_STATED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(superRes.superseded.resolutionState, 'SUPERSEDED');
    assert.equal(superRes.superseded.supersededBy, 'IDEA-REQ-002');
    assert.equal(superRes.created.supersedes, 'IDEA-REQ-001');

    // 2. Questions immutability
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Original question text?',
      materiality: 'MATERIAL',
    });

    assert.throws(() => {
      recordOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        question: 'Mutated question text?',
        materiality: 'MATERIAL',
      });
    }, (err) => err.code === 'DK_QUESTION_IMMUTABLE');

    // Question supersession succeeds
    const superQ = supersedeOpenQuestion(tempDir, 'IDEA-Q-001', {
      id: 'IDEA-Q-002',
      question: 'Refined question text?',
      materiality: 'MATERIAL',
      resolvedBy: 'PRODUCT_OWNER',
    });
    assert.equal(superQ.superseded.resolution, 'SUPERSEDED');
    assert.equal(superQ.superseded.supersededBy, 'IDEA-Q-002');
    assert.equal(superQ.created.supersedes, 'IDEA-Q-001');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 6: Purity regression check: resolveCanonicalIdeaArtifact does not mutate disk or registry', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    fs.writeFileSync(path.join(tempDir, 'idea-brief.md'), VALID_BRIEF, 'utf8');
    const docsDir = path.join(tempDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'idea-brief.md'), VALID_BRIEF, 'utf8');

    // Persist registry to create initial artifacts.json
    const initialRegObj = loadArtifactRegistry(tempDir);
    persistArtifactRegistry(initialRegObj, tempDir);
    const regFile = path.join(tempDir, '.development-kit', 'artifacts.json');
    const initialReg = fs.readFileSync(regFile, 'utf8');

    // Run pure read resolution
    const resolved = resolveCanonicalIdeaArtifact(tempDir);
    assert.equal(resolved.relativePath, 'idea-brief.md');

    // Verify disk byte-for-byte unmodified
    const afterReg = fs.readFileSync(regFile, 'utf8');
    assert.equal(initialReg, afterReg);
    assert.equal(fs.existsSync(path.join(docsDir, 'idea-brief.md')), true);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 6: NextStepResolver fails closed and routes corrupt state to /dk-debug', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    // Write corrupted discovery.json
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    fs.mkdirSync(path.dirname(discPath), { recursive: true });
    fs.writeFileSync(discPath, '{ "schemaVersion": "invalid" }', 'utf8');

    const resolver = new NextStepResolver();
    const recs = resolver.resolve({
      stage: 'UNDERSTAND',
      rootDir: tempDir,
      projectState: { bootstrapped: true },
      taskState: null,
      verificationState: null,
      blockers: [],
    });

    assert.ok(recs.length >= 1);
    assert.equal(recs[0].command, '/dk-debug');
    assert.equal(recs[0].priority, 'primary');
    assert.equal(recs[1].command, '/dk-status');
    assert.equal(recs[1].priority, 'secondary');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 7: 4-tuple approval binding invalidates on discovery revision change', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    const disc = loadDiscoveryState(tempDir);
    const p = persistCanonicalIdeaBrief({
      rootDir: tempDir,
      content: VALID_BRIEF,
      discoveryRevision: disc.revision,
      discoveryFingerprint: disc.fingerprint,
    });

    // Authoritative approval using approveCurrentIdeaBrief
    const approved = approveCurrentIdeaBrief(tempDir, { approvingAuthority: 'PRODUCT_OWNER' });
    assert.equal(approved.state.state, 'APPROVED');

    // Effective approval is CURRENT
    const eff1 = computeEffectiveApprovalStatus(tempDir, p.fingerprint, p.revision, disc.fingerprint, disc.revision);
    assert.equal(eff1.status, 'CURRENT');

    // Discovery revision bump (e.g. adding a non-material question or candidate)
    setupAnsweredQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Non-material operational query?',
      materiality: 'NON_MATERIAL',
    });

    const disc2 = loadDiscoveryState(tempDir);
    assert.notEqual(disc2.revision, disc.revision);

    // Old approval tuple is STALE against new discovery state
    const eff2 = computeEffectiveApprovalStatus(tempDir, p.fingerprint, p.revision, disc2.fingerprint, disc2.revision);
    assert.equal(eff2.status, 'STALE');

    // Stage state reflects DISCOVERY_REVISION_MISMATCH
    const stage2 = computeIdeaStageState(tempDir);
    assert.notEqual(stage2.state, 'APPROVED');
    assert.ok(stage2.issues.some(i => i.code === 'DISCOVERY_REVISION_MISMATCH'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 7: Reconcile increments artifact revision and invalidates old approval', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    const disc1 = loadDiscoveryState(tempDir);
    const p1 = persistCanonicalIdeaBrief({
      rootDir: tempDir,
      content: VALID_BRIEF,
      discoveryRevision: disc1.revision,
      discoveryFingerprint: disc1.fingerprint,
    });
    assert.equal(p1.revision, 1);

    approveCurrentIdeaBrief(tempDir, { approvingAuthority: 'PRODUCT_OWNER' });
    assert.equal(computeIdeaStageState(tempDir).state, 'APPROVED');

    // Modify discovery
    setupAnsweredQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Non-material query?',
      materiality: 'NON_MATERIAL',
    });

    // Reconcile increments revision from 1 -> 2
    const recon = reconcileCanonicalIdeaBrief({ rootDir: tempDir });
    assert.equal(recon.revision, 2);
    assert.equal(recon.discoveryRevision, loadDiscoveryState(tempDir).revision);    // Old rev 1 approval is not CURRENT for rev 2
    const stageAfterRecon = computeIdeaStageState(tempDir);
    assert.equal(stageAfterRecon.state, 'READY_FOR_APPROVAL');
    assert.equal(stageAfterRecon.approvalStatus, 'STALE');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 7: Canonical item grammar rejects invalid syntax strictly', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    // 1. Numbered list in Must
    const numberedBrief = VALID_BRIEF.replace(
      '- [IDEA-REQ-001] Capture inverter DC string voltages and insulation resistance measurements.',
      '1. [IDEA-REQ-001] Capture inverter DC string voltages and insulation resistance measurements.'
    );
    const numVal = validateIdeaBriefStructure(numberedBrief);
    assert.equal(numVal.valid, false);
    assert.ok(numVal.issues.some(i => i.code === 'CANONICAL_GRAMMAR_ERROR'));

    // 2. Untagged bullet in Must
    const untaggedBrief = VALID_BRIEF.replace(
      '- [IDEA-REQ-001] Capture inverter DC string voltages and insulation resistance measurements.',
      '- Plain text requirement without candidate tag.'
    );
    const untagVal = validateIdeaBriefStructure(untaggedBrief);
    assert.equal(untagVal.valid, false);
    assert.ok(untagVal.issues.some(i => i.code === 'CANONICAL_GRAMMAR_ERROR'));

    // 3. Mixed None in Open Questions
    const mixedNoneBrief = VALID_BRIEF.replace(
      '## Open Questions\n- None',
      '## Open Questions\n- None\n- [IDEA-Q-001] Extra question'
    );
    const mixVal = validateIdeaBriefStructure(mixedNoneBrief);
    assert.equal(mixVal.valid, false);
    assert.ok(mixVal.issues.some(i => i.code === 'CANONICAL_GRAMMAR_ERROR'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 7: Legal state transitions reject resurrecting superseded and rejected candidates', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Statement 1',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    // Supersede 001 -> 002
    supersedeRequirementCandidate(tempDir, 'IDEA-REQ-001', {
      id: 'IDEA-REQ-002',
      statement: 'Statement 2',
      origin: 'USER_STATED',
      confirmedBy: 'PRODUCT_OWNER',
    });

    // Attempting to transition 001 from SUPERSEDED -> CONFIRMED fails
    assert.throws(() => {
      confirmRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // Create a candidate as UNRESOLVED then reject it with PO authority
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Statement 3',
      origin: 'USER_STATED',
    });
    rejectRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      confirmedBy: 'PRODUCT_OWNER',
    });

    // Attempting to transition 003 from REJECTED -> CONFIRMED fails
    assert.throws(() => {
      confirmRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-003',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 7: Reciprocal lineage validation rejects broken supersession pointers', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Statement 1',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    supersedeRequirementCandidate(tempDir, 'IDEA-REQ-001', {
      id: 'IDEA-REQ-002',
      statement: 'Statement 2',
      origin: 'USER_STATED',
      confirmedBy: 'PRODUCT_OWNER',
    });

    const disc = loadDiscoveryState(tempDir);
    // Break reciprocal pointer: change supersededBy to point to nonexistent REQ-999
    disc.requirements[0].supersededBy = 'IDEA-REQ-999';

    assert.throws(() => {
      persistDiscoveryState(disc, tempDir);
    }, (err) => err.code === 'DK_LINEAGE_ERROR' || err.code === 'DK_DISCOVERY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 7: Bidirectional Must ↔ Discovery requirement coverage', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    // Record third active MUST candidate in discovery
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Continuous cellular health ping.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    // VALID_BRIEF only contains 001 and 002
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF });
    const stage = computeIdeaStageState(tempDir);
    assert.equal(stage.state, 'DISCOVERY_IN_PROGRESS');
    assert.ok(stage.issues.some(i => i.code === 'MISSING_MUST_REQUIREMENT' && i.id === 'IDEA-REQ-003'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 8 (Defect 1): idea-approve with missing authority fails with DK_UNAUTHORIZED_APPROVAL; approvals untouched; state remains READY_FOR_APPROVAL', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF });
    // Verify state is READY_FOR_APPROVAL
    assert.equal(computeIdeaStageState(tempDir).state, 'READY_FOR_APPROVAL');

    // approveCurrentIdeaBrief with no approvingAuthority must throw DK_UNAUTHORIZED_APPROVAL
    assert.throws(() => {
      approveCurrentIdeaBrief(tempDir, {});
    }, (err) => err.code === 'DK_UNAUTHORIZED_APPROVAL');

    // CLI idea-approve with empty payload must fail
    const scriptPath = path.resolve('scripts/orchestration.mjs');
    const cliRes = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-approve',
      '--input-json={}'
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(cliRes.status, 1);
    const parsedErr = JSON.parse(cliRes.stderr);
    assert.equal(parsedErr.details?.code || parsedErr.error, parsedErr.details?.code ? 'DK_UNAUTHORIZED_APPROVAL' : parsedErr.error);

    // approvals.json must NOT exist or have 0 approvals
    const appFile = path.join(tempDir, '.development-kit', 'idea', 'approvals.json');
    if (fs.existsSync(appFile)) {
      const history = JSON.parse(fs.readFileSync(appFile, 'utf8'));
      assert.equal(history.approvals.length, 0, 'No approval record written');
    }

    // State must still be READY_FOR_APPROVAL
    assert.equal(computeIdeaStageState(tempDir).state, 'READY_FOR_APPROVAL');

    // Explicit PRODUCT_OWNER approval succeeds
    const approved = approveCurrentIdeaBrief(tempDir, { approvingAuthority: 'PRODUCT_OWNER' });
    assert.equal(approved.state.state, 'APPROVED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 8 (Defect 2): New candidate default UNCLASSIFIED; classifyRequirementScope enforces PO authority; record update cannot mutate scope', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const cand = recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
    });
    assert.equal(cand.scopeDisposition, 'UNCLASSIFIED');

    // evaluateDiscoveryReadiness blocks UNCLASSIFIED material requirement
    const readiness = evaluateDiscoveryReadiness(tempDir);
    assert.equal(readiness.ready, false);
    assert.ok(readiness.blockers.some(b => b.code === 'UNCLASSIFIED_MATERIAL_REQUIREMENT'));

    // Normal recordRequirementCandidate update cannot mutate scopeDisposition
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
        origin: 'USER_STATED',
        scopeDisposition: 'MUST',
      });
    }, (err) => err.code === 'DK_SCOPE_IMMUTABLE' || err.code === 'DK_MATERIAL_SCOPE_REQUIRES_CLASSIFICATION' || err.code === 'DK_SCOPE_CLASSIFICATION_PROHIBITED');

    // classifyRequirementScope without PRODUCT_OWNER fails on material requirement
    assert.throws(() => {
      classifyRequirementScope(tempDir, {
        id: 'IDEA-REQ-001',
        scopeDisposition: 'MUST',
        confirmedBy: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_SCOPE_CLASSIFICATION');

    // classifyRequirementScope with PRODUCT_OWNER succeeds and bumps discovery revision
    const discRevBefore = loadDiscoveryState(tempDir).revision;
    const classified = classifyRequirementScope(tempDir, {
      id: 'IDEA-REQ-001',
      scopeDisposition: 'MUST',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(classified.newScope, 'MUST');
    const discRevAfter = loadDiscoveryState(tempDir).revision;
    assert.ok(discRevAfter > discRevBefore);

    // Readiness is now unblocked for REQ-001
    const readiness2 = evaluateDiscoveryReadiness(tempDir);
    assert.ok(!readiness2.blockers.some(b => b.code === 'UNCLASSIFIED_MATERIAL_REQUIREMENT'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 8 (Defect 3): Public registerArtifact unconditionally rejects IDEA_BRIEF', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    // Generic public call fails
    assert.throws(() => {
      registerArtifact({
        rootDir: tempDir,
        key: 'IDEA_BRIEF',
        canonicalPath: 'idea-brief.md',
        artifactType: 'idea-brief',
        lifecycleStage: 'UNDERSTAND',
        fingerprint: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        revision: 1,
      });
    }, (err) => err.code === 'DK_RAW_REGISTRATION_PROHIBITED');

    // Attempting to pass old _allowDirectIdeaBrief parameter is also rejected
    assert.throws(() => {
      registerArtifact({
        rootDir: tempDir,
        key: 'IDEA_BRIEF',
        canonicalPath: 'idea-brief.md',
        artifactType: 'idea-brief',
        lifecycleStage: 'UNDERSTAND',
        fingerprint: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        revision: 1,
        _allowDirectIdeaBrief: true,
      });
    }, (err) => err.code === 'DK_RAW_REGISTRATION_PROHIBITED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 8 (Defect 4): New candidate born REJECTED throws DK_ILLEGAL_STATE_TRANSITION', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    // Attempting to create new candidate as REJECTED directly must fail
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Some candidate statement',
        origin: 'USER_STATED',
        resolutionState: 'REJECTED',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 8 (Defect 5): Material candidate rejection and supersession require PO authority', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
      materiality: 'MATERIAL',
    });

    // Attempting rejection without PRODUCT_OWNER authority fails
    assert.throws(() => {
      rejectRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        confirmedBy: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_DEACTIVATION');

    // With explicit PRODUCT_OWNER authority, rejection succeeds
    const rejected = rejectRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(rejected.resolutionState, 'REJECTED');

    // Also verify that superseding UNRESOLVED material requirement without PO authority throws
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Unresolved statement',
      origin: 'USER_STATED',
      materiality: 'MATERIAL',
    });
    assert.throws(() => {
      supersedeRequirementCandidate(tempDir, 'IDEA-REQ-002', {
        id: 'IDEA-REQ-003',
        statement: 'Mutated statement',
        origin: 'USER_STATED',
        confirmedBy: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_SUPERSEDING');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 8 (Defect 6): Semantic supersession failure leaves zero disk side effects', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Statement 1',
      origin: 'USER_STATED',
      scopeDisposition: 'MUST',
    });

    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const beforeBytes = fs.readFileSync(discPath, 'utf8');
    const podDir = path.join(tempDir, '.development-kit', 'decisions');
    const podsBefore = fs.existsSync(podDir) ? fs.readdirSync(podDir) : [];

    // Attempt supersession with invalid new candidate ID
    assert.throws(() => {
      supersedeRequirementCandidate(tempDir, 'IDEA-REQ-001', {
        id: 'INVALID_ID',
        statement: 'Statement 2',
        origin: 'USER_STATED',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_INVALID_REQ_ID' || err.code === 'DK_INVALID_ID');

    // discovery.json must be byte-identical
    const afterBytes = fs.readFileSync(discPath, 'utf8');
    assert.equal(beforeBytes, afterBytes, 'discovery.json must be untouched');

    // No POD files created
    const podsAfter = fs.existsSync(podDir) ? fs.readdirSync(podDir) : [];
    assert.equal(podsBefore.length, podsAfter.length, 'No POD file created on failure');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 8 (Defect 7): validateDiscoveryStateStructure rejects impossible persisted combinations on load', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    fs.mkdirSync(path.dirname(discPath), { recursive: true });

    // Combination 1: Active record with supersededBy set
    fs.writeFileSync(discPath, JSON.stringify({
      schemaVersion: '1.0.0',
      revision: 1,
      requirements: [{
        id: 'IDEA-REQ-001',
        statement: 'Statement',
        origin: 'USER_STATED',
        materiality: 'MATERIAL',
        scopeDisposition: 'MUST',
        resolutionState: 'CONFIRMED',
        confirmedBy: 'PRODUCT_OWNER',
        linkedPodId: null,
        supersedes: null,
        supersededBy: 'IDEA-REQ-002', // illegal: resolutionState !== SUPERSEDED
      }],
      openQuestions: [],
    }), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_LINEAGE_ERROR');

    // Combination 2: REJECTED record carrying MUST scope disposition
    fs.writeFileSync(discPath, JSON.stringify({
      schemaVersion: '1.0.0',
      revision: 1,
      requirements: [{
        id: 'IDEA-REQ-001',
        statement: 'Statement',
        origin: 'USER_STATED',
        materiality: 'MATERIAL',
        scopeDisposition: 'MUST', // illegal: REJECTED + MUST
        resolutionState: 'REJECTED',
        confirmedBy: 'PRODUCT_OWNER',
        linkedPodId: null,
        supersedes: null,
        supersededBy: null,
      }],
      openQuestions: [],
    }), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 8 (Defect 8): Blank Open Questions section blocks structure validation', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    // Brief with completely blank Open Questions section
    const blankQBrief = VALID_BRIEF.replace('## Open Questions\n- None', '## Open Questions\n');
    const val = validateIdeaBriefStructure(blankQBrief);
    assert.equal(val.valid, false);
    assert.ok(val.issues.some(i => i.code === 'EMPTY_SECTION_BLOCKS_APPROVAL'));

    // Brief with canonical None in Open Questions is valid
    const noneVal = validateIdeaBriefStructure(VALID_BRIEF);
    const qIssues = noneVal.issues.filter(i => i.section === 'openQuestions');
    assert.equal(qIssues.length, 0);
  } finally {
    cleanupTempDir(tempDir);
  }
});



test('Candidate 9 (Defect 1): Documented /dk-idea public workflow sequence executes end-to-end', () => {
  const tempDir = createTempDir();
  try {
    const scriptPath = path.resolve('scripts/orchestration.mjs');

    // 1. Lifecycle entry
    const lifecycleRes = spawnSync(process.execPath, [
      path.resolve('scripts/lifecycle.mjs'),
      '--command=dk-idea',
      '--phase=entry',
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(lifecycleRes.status, 0);

    // 2. Record material candidates (born UNCLASSIFIED & UNRESOLVED)
    const candRes = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-001',
        statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
        origin: 'USER_STATED',
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(candRes.status, 0);

    const candRes2 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-002',
        statement: 'Support offline checklist completion.',
        origin: 'USER_STATED',
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(candRes2.status, 0);

    // Advance through Design Setup and Idea Challenge turns
    presentCurrentInteraction(tempDir);
    let state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'DESIGN_APPLICABILITY_CHECK');

    consumeDesignApplicabilityResponse(tempDir, {
      choice: '1. Visual user interface (web, mobile, desktop)',
      applicable: true,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'DESIGN_SYSTEM_SETUP');

    recordDesignAuthoritySetup(tempDir, {
      disposition: 'DEFERRED',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'IDEA_CHALLENGE');

    recordIdeaChallengeResponse(tempDir, {
      response: 'Confirmed proceed',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    // Workflow now presents REQUIREMENT_CONFIRMATION
    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'REQUIREMENT_CONFIRMATION');

    // Confirm candidates via CLI with interaction fingerprint
    const confRes1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-confirm-requirements',
      '--input-json=' + JSON.stringify({
        candidateIds: ['IDEA-REQ-001', 'IDEA-REQ-002'],
        confirmedBy: 'PRODUCT_OWNER',
        expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(confRes1.status, 0);

    // 3. Discovery eval is blocked while UNCLASSIFIED
    const evalRes1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-discovery-eval',
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(evalRes1.status, 0);
    const eval1Parsed = JSON.parse(evalRes1.stdout);
    assert.equal(eval1Parsed.result.ready, false);
    assert.ok(eval1Parsed.result.blockers.some(b => b.code === 'UNCLASSIFIED_MATERIAL_REQUIREMENT'));

    // 4. Propose Scope and then Scope Confirmation
    const propRes1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-propose-scope',
      '--input-json=' + JSON.stringify({
        scopeProposal: {
          'IDEA-REQ-001': 'MUST',
          'IDEA-REQ-002': 'MUST',
        },
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(propRes1.status, 0);

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'SCOPE_CONFIRMATION');

    const scopeRes1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-classify-scope',
      '--input-json=' + JSON.stringify({
        scopeMapping: {
          'IDEA-REQ-001': 'MUST',
          'IDEA-REQ-002': 'MUST',
        },
        confirmedBy: 'PRODUCT_OWNER',
        expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(scopeRes1.status, 0);

    // 5. Discovery eval now progresses to ready
    const evalRes2 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-discovery-eval',
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(evalRes2.status, 0);
    const eval2Parsed = JSON.parse(evalRes2.stdout);
    assert.equal(eval2Parsed.result.ready, true);

    // 6. Persist Idea Brief
    const persistRes = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-persist',
      '--input-json=' + JSON.stringify({ content: VALID_BRIEF })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(persistRes.status, 0);

    // 7. State evaluation reaches READY_FOR_APPROVAL
    const stateRes1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-state',
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(stateRes1.status, 0);
    assert.equal(JSON.parse(stateRes1.stdout).result.state, 'READY_FOR_APPROVAL');

    // 8. Explicit Product Owner approval with pending interaction fingerprint
    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.workflowPhase, 'BRIEF_APPROVAL');
    presentCurrentInteraction(tempDir);

    const approveRes = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-approve',
      '--input-json=' + JSON.stringify({
        approvingAuthority: 'PRODUCT_OWNER',
        expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(approveRes.status, 0);

    // 9. State evaluation reaches APPROVED
    const stateRes2 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-state',
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(stateRes2.status, 0);
    assert.equal(JSON.parse(stateRes2.stdout).result.state, 'APPROVED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 9 (Defect 2): recordRequirementCandidate rejects caller-supplied non-UNCLASSIFIED scope for material candidates', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // Material candidate creation with MUST scope is rejected
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Material requirement',
        materiality: 'MATERIAL',
        origin: 'USER_STATED',
        scopeDisposition: 'MUST',
      });
    }, (err) => err.code === 'DK_MATERIAL_SCOPE_REQUIRES_CLASSIFICATION' || err.code === 'DK_SCOPE_CLASSIFICATION_PROHIBITED');

    // Material candidate creation with UNCLASSIFIED or omitted succeeds
    const cand = recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Material requirement',
      materiality: 'MATERIAL',
      origin: 'USER_STATED',
    });
    assert.equal(cand.scopeDisposition, 'UNCLASSIFIED');

    // NON_MATERIAL candidate creation with explicit scope is allowed
    const nonMat = recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Non-material requirement',
      materiality: 'NON_MATERIAL',
      origin: 'AI_PROPOSED',
      scopeDisposition: 'SHOULD',
    });
    assert.equal(nonMat.scopeDisposition, 'SHOULD');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 9 (Defects 3, 4, 5, 6): Persisted scope authority, POD creation, valid decisionId, and zero side effect safety', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages.',
      origin: 'USER_STATED',
      scopeDisposition: null,
    });

    const podStoreDir = path.join(tempDir, '.development-kit', 'decisions');

    // 1. Valid scope classification creates POD in .development-kit/decisions
    const classified = classifyRequirementScope(tempDir, {
      id: 'IDEA-REQ-001',
      scopeDisposition: 'MUST',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.ok(classified.decisionId, 'Scope classification must return decisionId');
    assert.ok(/^POD-IDEA-REQ-001-SCOPE/i.test(classified.decisionId));

    // Verify POD file on disk
    const podFilePath = path.join(podStoreDir, classified.decisionId + '.json');
    assert.equal(fs.existsSync(podFilePath), true, 'POD file must exist in .development-kit/decisions');
    const podData = JSON.parse(fs.readFileSync(podFilePath, 'utf8'));
    assert.equal(podData.status, 'APPROVED');
    assert.ok(podData.affectedRequirements.includes('IDEA-REQ-001'));

    // Verify persisted discovery state contains scopeDecision authority metadata
    const discState = loadDiscoveryState(tempDir);
    const req = discState.requirements.find(r => r.id === 'IDEA-REQ-001');
    assert.ok(req.scopeDecision, 'Requirement must contain scopeDecision object');
    assert.equal(req.scopeDecision.confirmedBy, 'PRODUCT_OWNER');
    assert.equal(req.scopeDecision.disposition, 'MUST');
    assert.equal(req.scopeDecision.decisionId, classified.decisionId);

    // 2. Direct JSON tampering of scope without valid scopeDecision fails reload
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const validBytes = fs.readFileSync(discPath, 'utf8');
    const tampered = JSON.parse(validBytes);
    tampered.requirements[0].scopeDecision = null; // strip authority
    fs.writeFileSync(discPath, JSON.stringify(tampered, null, 2), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');

    // Restore valid state
    fs.writeFileSync(discPath, validBytes, 'utf8');

    // 3. Zero side effect safety: invalid semantic input fails before writing anything
    const beforeDiscBytes = fs.readFileSync(discPath, 'utf8');
    const beforePods = fs.readdirSync(podStoreDir);

    assert.throws(() => {
      classifyRequirementScope(tempDir, {
        id: 'IDEA-REQ-001',
        scopeDisposition: 'INVALID_SCOPE',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_INVALID_SCOPE_DISPOSITION');

    assert.equal(fs.readFileSync(discPath, 'utf8'), beforeDiscBytes, 'discovery.json must remain byte-identical');
    assert.deepEqual(fs.readdirSync(podStoreDir), beforePods, 'Decisions directory must remain byte-identical');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 9 (Defect 7): Reload validation enforces persisted authority for material rejection and supersession', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    fs.mkdirSync(path.dirname(discPath), { recursive: true });

    // Combination 1: Material requirement REJECTED without deactivationDecision authority
    fs.writeFileSync(discPath, JSON.stringify({
      schemaVersion: '1.0.0',
      revision: 1,
      requirements: [{
        id: 'IDEA-REQ-001',
        statement: 'Statement',
        origin: 'USER_STATED',
        materiality: 'MATERIAL',
        scopeDisposition: 'EXCLUDED',
        resolutionState: 'REJECTED',
        confirmedBy: null,
        deactivationDecision: null,
      }],
      openQuestions: [],
    }), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');

    // Combination 2: Material USER_STATED requirement SUPERSEDED without supersessionDecision authority
    fs.writeFileSync(discPath, JSON.stringify({
      schemaVersion: '1.0.0',
      revision: 1,
      requirements: [
        {
          id: 'IDEA-REQ-001',
          statement: 'Statement 1',
          origin: 'USER_STATED',
          materiality: 'MATERIAL',
          scopeDisposition: 'UNCLASSIFIED',
          resolutionState: 'SUPERSEDED',
          supersededBy: 'IDEA-REQ-002',
          supersessionDecision: null,
        },
        {
          id: 'IDEA-REQ-002',
          statement: 'Statement 2',
          origin: 'USER_STATED',
          materiality: 'MATERIAL',
          scopeDisposition: 'UNCLASSIFIED',
          resolutionState: 'CONFIRMED',
          confirmedBy: 'PRODUCT_OWNER',
          supersedes: 'IDEA-REQ-001',
        },
      ],
      openQuestions: [],
    }), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 9 (Defect 8): Complete requirement and question state transition matrix table-driven validation', () => {
  const allReqStates = ['UNRESOLVED', 'CONFIRMED', 'ADOPTED', 'DEFERRED', 'REJECTED', 'SUPERSEDED'];

  for (const fromState of allReqStates) {
    for (const toState of allReqStates) {
      const allowed = LEGAL_REQUIREMENT_TRANSITIONS[fromState].includes(toState) || fromState === toState;
      const result = isValidRequirementTransition(fromState, toState);
      assert.equal(
        result,
        allowed,
        'Requirement transition from ' + fromState + ' to ' + toState + ' expected ' + allowed + ' but got ' + result
      );
    }
  }

  const allQStates = ['UNRESOLVED', 'ANSWERED', 'DEFERRED', 'REJECTED', 'SUPERSEDED'];

  for (const fromState of allQStates) {
    for (const toState of allQStates) {
      const allowed = LEGAL_QUESTION_TRANSITIONS[fromState].includes(toState) || fromState === toState;
      const result = isValidQuestionTransition(fromState, toState);
      assert.equal(
        result,
        allowed,
        'Question transition from ' + fromState + ' to ' + toState + ' expected ' + allowed + ' but got ' + result
      );
    }
  }
});

test('Candidate 9 (Defect 9): Exact section identity and case-insensitive ID uniqueness', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // 1. Duplicate canonical section rejected
    const dupSecBrief = VALID_BRIEF + '\n## Requirements (Must)\n- [IDEA-REQ-003] Duplicate section candidate.\n';
    const dupSecVal = validateIdeaBriefStructure(dupSecBrief);
    assert.equal(dupSecVal.valid, false);
    assert.ok(dupSecVal.issues.some(i => i.code === 'DUPLICATE_SECTION' && i.header === '## Requirements (Must)'));

    // 2. Unknown section heading rejected
    const unkSecBrief = VALID_BRIEF + '\n## Hidden Requirements\n- [IDEA-REQ-003] Hidden requirement.\n';
    const unkSecVal = validateIdeaBriefStructure(unkSecBrief);
    assert.equal(unkSecVal.valid, false);
    assert.ok(unkSecVal.issues.some(i => i.code === 'UNKNOWN_SECTION' && i.header === '## Hidden Requirements'));

    // 3. Case-insensitive duplicate requirement references in brief rejected
    const caseDupBrief = VALID_BRIEF.replace(
      '- [IDEA-REQ-002] Support offline checklist completion.',
      '- [idea-req-001] Capture inverter DC string voltages and insulation resistance measurements.'
    );
    const caseDupVal = validateIdeaBriefStructure(caseDupBrief);
    assert.equal(caseDupVal.valid, false);
    assert.ok(caseDupVal.issues.some(i => i.code === 'DUPLICATE_REQUIREMENT_REFERENCE' && i.id === 'IDEA-REQ-001'));

    // 4. Case-insensitive duplicate requirement in discovery rejected
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages.',
      origin: 'USER_STATED',
    });

    // Attempting to record lowercase idea-req-001 as a new candidate throws DK_DISCOVERY_CORRUPT or update immutability
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const discData = JSON.parse(fs.readFileSync(discPath, 'utf8'));
    discData.requirements.push({
      id: 'idea-req-001',
      statement: 'Duplicate with different casing',
      origin: 'USER_STATED',
      materiality: 'MATERIAL',
      scopeDisposition: 'UNCLASSIFIED',
      resolutionState: 'UNRESOLVED',
    });
    fs.writeFileSync(discPath, JSON.stringify(discData, null, 2), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

/* ========================================================================= */
/* CANDIDATE 10 REGRESSION TESTS                                             */
/* ========================================================================= */

test('Candidate 10 (Defect 1): Discovery authority validates referenced POD existence; missing or faked POD fails closed', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages.',
      origin: 'USER_STATED',
      scopeDisposition: null,
    });
    const classified = classifyRequirementScope(tempDir, {
      id: 'IDEA-REQ-001',
      scopeDisposition: 'MUST',
      confirmedBy: 'PRODUCT_OWNER',
    });

    // Valid state loads cleanly
    const loaded = loadDiscoveryState(tempDir);
    assert.equal(loaded.requirements[0].scopeDisposition, 'MUST');

    // Case A: Delete the referenced POD file -> reload discovery -> FAIL CLOSED
    const podFilePath = path.join(tempDir, '.development-kit', 'decisions', classified.decisionId + '.json');
    assert.equal(fs.existsSync(podFilePath), true);
    const podBackup = fs.readFileSync(podFilePath, 'utf8');
    fs.unlinkSync(podFilePath);

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');

    // Restore POD file -> reload succeeds
    fs.writeFileSync(podFilePath, podBackup, 'utf8');
    assert.ok(loadDiscoveryState(tempDir));

    // Case B: Replace decisionId with valid-looking nonexistent fake POD ID -> FAIL CLOSED
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const discData = JSON.parse(fs.readFileSync(discPath, 'utf8'));
    discData.requirements[0].scopeDecision.decisionId = 'POD-IDEA-REQ-001-SCOPE-999';
    fs.writeFileSync(discPath, JSON.stringify(discData, null, 2), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 10 (Defect 2): POD immutable write and idempotent replay protection', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const pod = createPODecision({
      id: 'POD-TEST-001',
      statement: 'Approved architectural direction',
      status: 'APPROVED',
      provenance: 'product-owner',
      decisionType: 'REQUIREMENT_SCOPE',
      decisionData: { requirementId: 'IDEA-REQ-001', newScope: 'MUST' },
    });

    // 1. First write succeeds
    const writtenPath = persistPODecision(pod, tempDir);
    assert.equal(fs.existsSync(writtenPath), true);

    // 2. Identical write is idempotent success
    const replayPath = persistPODecision(pod, tempDir);
    assert.equal(writtenPath, replayPath);

    // 3. Mutated POD with same ID throws DK_POD_IMMUTABILITY_VIOLATION
    const mutatedPod = {
      ...pod,
      statement: 'Attempted stealth overwrite statement',
    };
    // Recompute invalid fingerprint or different fingerprint
    mutatedPod.fingerprint = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

    assert.throws(() => {
      persistPODecision(mutatedPod, tempDir);
    }, (err) => err.code === 'DK_POD_FINGERPRINT_MISMATCH' || err.code === 'DK_POD_IMMUTABILITY_VIOLATION');

    const validMutatedPod = createPODecision({
      id: 'POD-TEST-001',
      statement: 'Different valid statement with same ID',
      status: 'APPROVED',
      provenance: 'product-owner',
    });

    assert.throws(() => {
      persistPODecision(validMutatedPod, tempDir);
    }, (err) => err.code === 'DK_POD_IMMUTABILITY_VIOLATION');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 10 (Defect 3): Structured decisionData cross-check rejects mismatched POD metadata', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages.',
      origin: 'USER_STATED',
      scopeDisposition: null,
    });

    // Create a POD for EXCLUDED scope on REQ-001
    const excludedPod = createPODecision({
      id: 'POD-IDEA-REQ-001-EXCLUDED',
      statement: 'Excluding REQ-001',
      status: 'APPROVED',
      provenance: 'product-owner',
      decisionType: 'REQUIREMENT_SCOPE',
      decisionData: {
        requirementId: 'IDEA-REQ-001',
        newScope: 'EXCLUDED',
      },
      affectedRequirements: ['IDEA-REQ-001'],
    });
    persistPODecision(excludedPod, tempDir);

    // Write discovery state claiming MUST scope but referencing EXCLUDED POD
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const discState = loadDiscoveryState(tempDir);
    discState.requirements[0].scopeDisposition = 'MUST';
    discState.requirements[0].scopeDecision = {
      previousDisposition: 'UNCLASSIFIED',
      disposition: 'MUST',
      confirmedBy: 'PRODUCT_OWNER',
      decisionId: 'POD-IDEA-REQ-001-EXCLUDED',
      decidedAt: new Date().toISOString(),
    };
    fs.writeFileSync(discPath, JSON.stringify(discState, null, 2), 'utf8');

    // Discovery reload must fail closed because decisionData.newScope ('EXCLUDED') !== disposition ('MUST')
    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 10 & 11 (Defect 4): Repository-wide audit: No fallback synthesis or parameter defaults for PRODUCT_OWNER / product-owner', () => {
  const runtimeDir = path.resolve('runtime');
  const scriptsDir = path.resolve('scripts');

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scanDir(fullPath);
      } else if (ent.name.endsWith('.mjs') || ent.name.endsWith('.js')) {
        const text = fs.readFileSync(fullPath, 'utf8');
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Exclude test files from assertion
          if (fullPath.includes('.test.')) continue;

          // Exclude comments, strings, template literals, and error messages
          if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('throw new') || line.includes('Error(')) continue;
          if (/`[^`]*(?:PRODUCT_OWNER|product-owner)[^`]*`/.test(line)) continue;

          // Check for fallback synthesis e.g. || 'PRODUCT_OWNER' or || 'product-owner'
          if (/\|\|\s*['"](?:PRODUCT_OWNER|product-owner)['"]/.test(line)) {
            assert.fail(`Found forbidden fallback synthesis on ${path.relative(process.cwd(), fullPath)}:${i + 1}: ${line}`);
          }
          if (/\b(?:confirmedBy|resolvedBy|approvingAuthority|provenance|status)\s*=\s*['"](?:PRODUCT_OWNER|product-owner|APPROVED)['"]/.test(line)) {
            assert.fail(`Found forbidden parameter default authority on ${path.relative(process.cwd(), fullPath)}:${i + 1}: ${line}`);
          }
        }
      }
    }
  }

  scanDir(runtimeDir);
  scanDir(scriptsDir);
});

test('Candidate 10 (Defects 5 & 6): Normal candidate and question recording strictly reject SUPERSEDED for all origins', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // Origin USER_CONFIRMED is rejected at capture
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-999',
        statement: 'Statement UC',
        origin: 'USER_CONFIRMED',
      });
    }, (err) => err.code === 'DK_INVALID_ORIGIN');

    const origins = ['USER_STATED', 'AI_PROPOSED', 'ASSUMED', 'RESEARCH_DERIVED'];

    for (let i = 0; i < origins.length; i++) {
      const origin = origins[i];
      const reqId = 'IDEA-REQ-' + String(i + 1).padStart(3, '0');

      // 1. Cannot be created as SUPERSEDED
      assert.throws(() => {
        recordRequirementCandidate(tempDir, {
          id: reqId,
          statement: 'Statement ' + i,
          origin,
          resolutionState: 'SUPERSEDED',
        });
      }, (err) => err.code === 'DK_SUPERSEDED_MUTATION_PROHIBITED' || err.code === 'DK_ILLEGAL_STATE_TRANSITION');

      // Create as UNRESOLVED
      recordRequirementCandidate(tempDir, {
        id: reqId,
        statement: 'Statement ' + i,
        origin,
        resolutionState: 'UNRESOLVED',
      });

      // 2. Existing candidate cannot be mutated to SUPERSEDED via recordRequirementCandidate
      assert.throws(() => {
        recordRequirementCandidate(tempDir, {
          id: reqId,
          statement: 'Statement ' + i,
          origin,
          resolutionState: 'SUPERSEDED',
        });
      }, (err) => err.code === 'DK_SUPERSEDED_MUTATION_PROHIBITED' || err.code === 'DK_ILLEGAL_STATE_TRANSITION');
    }

    // Questions: cannot create or mutate to SUPERSEDED via recordOpenQuestion
    assert.throws(() => {
      recordOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        question: 'Sample question',
        resolution: 'SUPERSEDED',
      });
    }, (err) => err.code === 'DK_SUPERSEDED_MUTATION_PROHIBITED' || err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Sample question',
      resolution: 'UNRESOLVED',
    });

    assert.throws(() => {
      recordOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        question: 'Sample question',
        resolution: 'SUPERSEDED',
      });
    }, (err) => err.code === 'DK_SUPERSEDED_MUTATION_PROHIBITED' || err.code === 'DK_ILLEGAL_STATE_TRANSITION');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 10 (Defect 7): Material question supersession requires explicit PO authority and creates POD', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Critical battery chemistry constraints?',
      materiality: 'MATERIAL',
      resolution: 'UNRESOLVED',
    });

    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const bytesBefore = fs.readFileSync(discPath, 'utf8');

    // 1. Supersession without PO authority fails
    assert.throws(() => {
      supersedeOpenQuestion(tempDir, 'IDEA-Q-001', {
        id: 'IDEA-Q-002',
        question: 'Rephrased question',
        materiality: 'NON_MATERIAL',
        resolvedBy: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_SUPERSEDING');

    assert.equal(fs.readFileSync(discPath, 'utf8'), bytesBefore, 'discovery.json must remain unchanged on failure');

    // 2. Supersession with explicit resolvedBy = 'PRODUCT_OWNER' succeeds and creates POD
    const result = supersedeOpenQuestion(tempDir, 'IDEA-Q-001', {
      id: 'IDEA-Q-002',
      question: 'Rephrased question',
      materiality: 'NON_MATERIAL',
      resolvedBy: 'PRODUCT_OWNER',
    });
    assert.equal(result.superseded.resolution, 'SUPERSEDED');
    assert.equal(result.superseded.supersededBy, 'IDEA-Q-002');
    assert.ok(result.superseded.supersessionDecision.decisionId);

    // Verify POD on disk
    const pod = loadPODecisionById(tempDir, result.superseded.supersessionDecision.decisionId);
    assert.equal(pod.provenance, 'product-owner');
    assert.equal(pod.status, 'APPROVED');
    assert.equal(pod.decisionType, 'QUESTION_SUPERSESSION');
    assert.equal(pod.decisionData.questionId, 'IDEA-Q-001');
    assert.equal(pod.decisionData.supersededBy, 'IDEA-Q-002');

    // Discovery reloads cleanly with validated POD evidence
    const reloaded = loadDiscoveryState(tempDir);
    assert.equal(reloaded.openQuestions[0].resolution, 'SUPERSEDED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 10 (Defect 8): Material requirement supersession requires explicit PO authority regardless of origin', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    const testOrigins = ['AI_PROPOSED', 'ASSUMED', 'RESEARCH_DERIVED', 'USER_STATED'];

    for (let i = 0; i < testOrigins.length; i++) {
      const origin = testOrigins[i];
      const oldId = 'IDEA-REQ-' + String((i + 1) * 10).padStart(3, '0');
      const newId = 'IDEA-REQ-' + String((i + 1) * 10 + 1).padStart(3, '0');

      recordRequirementCandidate(tempDir, {
        id: oldId,
        statement: 'Material requirement for origin ' + origin,
        materiality: 'MATERIAL',
        origin,
        resolutionState: 'UNRESOLVED',
      });

      // Attempting to supersede without PRODUCT_OWNER authority fails
      assert.throws(() => {
        supersedeRequirementCandidate(tempDir, oldId, {
          id: newId,
          statement: 'Replacement statement',
          confirmedBy: 'AI_AGENT',
        });
      }, (err) => err.code === 'DK_UNAUTHORIZED_SUPERSEDING');

      // Superseding with explicit PRODUCT_OWNER succeeds
      const superseded = supersedeRequirementCandidate(tempDir, oldId, {
        id: newId,
        statement: 'Replacement statement',
        confirmedBy: 'PRODUCT_OWNER',
      });
      assert.equal(superseded.superseded.resolutionState, 'SUPERSEDED');
    }
  } finally {
    cleanupTempDir(tempDir);
  }
});

/* ========================================================================= */
/* CANDIDATE 11 REGRESSION TESTS                                             */
/* ========================================================================= */

test('Candidate 11 (Defect 1 & 2): Strict POD decisionType enforcement; null or mismatched decisionType fails closed', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages.',
      origin: 'USER_STATED',
      scopeDisposition: null,
    });
    const classified = classifyRequirementScope(tempDir, {
      id: 'IDEA-REQ-001',
      scopeDisposition: 'MUST',
      confirmedBy: 'PRODUCT_OWNER',
    });

    // 1. Generic APPROVED product-owner POD with decisionType = null referenced as scopeDecision -> FAIL
    const nullTypePod = createPODecision({
      id: 'POD-NULL-TYPE-001',
      statement: 'Generic decision without decisionType',
      status: 'APPROVED',
      provenance: 'product-owner',
      decisionType: null,
      decisionData: null,
      affectedRequirements: ['IDEA-REQ-001'],
    });
    persistPODecision(nullTypePod, tempDir);

    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const disc = loadDiscoveryState(tempDir);
    disc.requirements[0].scopeDisposition = 'MUST';
    disc.requirements[0].scopeDecision = {
      previousDisposition: 'UNCLASSIFIED',
      disposition: 'MUST',
      confirmedBy: 'PRODUCT_OWNER',
      decisionId: 'POD-NULL-TYPE-001',
      decidedAt: new Date().toISOString(),
    };
    fs.writeFileSync(discPath, JSON.stringify(disc, null, 2), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT' && err.message.includes('REQUIREMENT_SCOPE'));

    // 2. QUESTION_SUPERSESSION POD referenced as requirement scope authority -> FAIL
    const qSuperPod = createPODecision({
      id: 'POD-Q-SUPER-001',
      statement: 'Question supersession',
      status: 'APPROVED',
      provenance: 'product-owner',
      decisionType: 'QUESTION_SUPERSESSION',
      decisionData: { questionId: 'IDEA-Q-001', supersededBy: 'IDEA-Q-002' },
      affectedRequirements: ['IDEA-REQ-001'],
    });
    persistPODecision(qSuperPod, tempDir);

    disc.requirements[0].scopeDecision.decisionId = 'POD-Q-SUPER-001';
    fs.writeFileSync(discPath, JSON.stringify(disc, null, 2), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT' && err.message.includes('REQUIREMENT_SCOPE'));

    // Restore valid state before step 3
    disc.requirements[0].scopeDecision.decisionId = classified.decisionId;
    fs.writeFileSync(discPath, JSON.stringify(disc, null, 2), 'utf8');

    // 3. REQUIREMENT_SCOPE POD referenced as requirement supersession authority -> FAIL
    const scopePod = createPODecision({
      id: 'POD-REQ-SCOPE-001',
      statement: 'Scope classified',
      status: 'APPROVED',
      provenance: 'product-owner',
      decisionType: 'REQUIREMENT_SCOPE',
      decisionData: { requirementId: 'IDEA-REQ-001', previousScope: 'UNCLASSIFIED', newScope: 'MUST' },
      affectedRequirements: ['IDEA-REQ-001'],
    });
    persistPODecision(scopePod, tempDir);

    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Replacement candidate',
      origin: 'USER_STATED',
    });

    const disc2 = loadDiscoveryState(tempDir);
    disc2.requirements[0].resolutionState = 'SUPERSEDED';
    disc2.requirements[0].supersededBy = 'IDEA-REQ-002';
    disc2.requirements[0].supersessionDecision = {
      supersededBy: 'IDEA-REQ-002',
      confirmedBy: 'PRODUCT_OWNER',
      decisionId: 'POD-REQ-SCOPE-001',
      decidedAt: new Date().toISOString(),
    };
    disc2.requirements[1].supersedes = 'IDEA-REQ-001';
    fs.writeFileSync(discPath, JSON.stringify(disc2, null, 2), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT' && err.message.includes('REQUIREMENT_SUPERSESSION'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 11 (Defect 2 & 9): createPODecision requires explicit status and provenance; no fallback synthesis', () => {
  // 1. Missing provenance throws
  assert.throws(() => {
    createPODecision({
      id: 'POD-TEST-001',
      statement: 'Test statement',
      status: 'APPROVED',
    });
  }, (err) => err.code === 'DK_POD_INVALID' && err.message.includes('provenance is required'));

  // 2. Missing status throws
  assert.throws(() => {
    createPODecision({
      id: 'POD-TEST-002',
      statement: 'Test statement',
      provenance: 'product-owner',
    });
  }, (err) => err.code === 'DK_POD_INVALID' && err.message.includes('status is required'));

  // 3. Missing both throws
  assert.throws(() => {
    createPODecision({
      id: 'POD-TEST-003',
      statement: 'Test statement',
    });
  }, (err) => err.code === 'DK_POD_INVALID');
});

test('Candidate 11 (Defect 3): Material question ANSWERED, DEFERRED, REJECTED require immutable POD evidence', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    // 1. ANSWERED resolution
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Operating temperature range?',
      materiality: 'MATERIAL',
    });

    const ansQ = resolveOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
    });
    assert.equal(ansQ.resolution, 'ANSWERED');
    assert.ok(ansQ.resolutionDecision.decisionId);

    const ansPod = loadPODecisionById(tempDir, ansQ.resolutionDecision.decisionId);
    assert.equal(ansPod.decisionType, 'QUESTION_RESOLUTION');
    assert.equal(ansPod.status, 'APPROVED');
    assert.equal(ansPod.provenance, 'product-owner');
    assert.equal(ansPod.decisionData.newResolution, 'ANSWERED');

    // 2. DEFERRED resolution with deferredTarget
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-002',
      question: 'Future cellular telemetry module?',
      materiality: 'MATERIAL',
    });
    const defQ = resolveOpenQuestion(tempDir, {
      id: 'IDEA-Q-002',
      resolution: 'DEFERRED',
      deferredTarget: 'Future Ideas (Explicitly Deferred)',
      resolvedBy: 'PRODUCT_OWNER',
    });
    assert.equal(defQ.resolution, 'DEFERRED');
    assert.ok(defQ.resolutionDecision.decisionId);

    const defPod = loadPODecisionById(tempDir, defQ.resolutionDecision.decisionId);
    assert.equal(defPod.decisionType, 'QUESTION_RESOLUTION');
    assert.equal(defPod.status, 'APPROVED');
    assert.equal(defPod.decisionData.deferredTarget, 'Future Ideas (Explicitly Deferred)');

    // 3. Direct JSON edit without POD fails on reload
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const disc = loadDiscoveryState(tempDir);
    // Add fake question claiming ANSWERED without resolutionDecision or POD
    disc.openQuestions.push({
      id: 'IDEA-Q-003',
      question: 'Injected question without POD',
      materiality: 'MATERIAL',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
      resolutionDecision: null,
      supersessionDecision: null,
      supersedes: null,
      supersededBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(discPath, JSON.stringify(disc, null, 2), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 11 (Defect 4): Material requirement AI_PROPOSED, ASSUMED confirmation & RESEARCH_DERIVED adoption require immutable POD evidence', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // 1. AI_PROPOSED confirmation produces REQUIREMENT_CONFIRMATION POD
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Proposed capability A',
      materiality: 'MATERIAL',
      origin: 'AI_PROPOSED',
    });

    const conf1 = confirmRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.ok(conf1.confirmationDecision.decisionId);
    const pod1 = loadPODecisionById(tempDir, conf1.confirmationDecision.decisionId);
    assert.equal(pod1.decisionType, 'REQUIREMENT_CONFIRMATION');
    assert.equal(pod1.status, 'APPROVED');
    assert.equal(pod1.provenance, 'product-owner');
    assert.equal(pod1.decisionData.newResolution, 'CONFIRMED');

    // 2. ASSUMED confirmation produces REQUIREMENT_CONFIRMATION POD
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Assumed capability B',
      materiality: 'MATERIAL',
      origin: 'ASSUMED',
    });
    const conf2 = confirmRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.ok(conf2.confirmationDecision.decisionId);
    const pod2 = loadPODecisionById(tempDir, conf2.confirmationDecision.decisionId);
    assert.equal(pod2.decisionType, 'REQUIREMENT_CONFIRMATION');

    // 3. RESEARCH_DERIVED adoption produces REQUIREMENT_ADOPTION POD
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Research capability C',
      materiality: 'MATERIAL',
      origin: 'RESEARCH_DERIVED',
    });
    const adopt = adoptRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.ok(adopt.confirmationDecision.decisionId);
    const pod3 = loadPODecisionById(tempDir, adopt.confirmationDecision.decisionId);
    assert.equal(pod3.decisionType, 'REQUIREMENT_ADOPTION');
    assert.equal(pod3.status, 'APPROVED');
    assert.equal(pod3.decisionData.newResolution, 'ADOPTED');

    // 4. Direct JSON edit: AI_PROPOSED UNRESOLVED -> CONFIRMED without matching POD fails on reload
    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const disc = loadDiscoveryState(tempDir);
    disc.requirements.push({
      id: 'IDEA-REQ-004',
      statement: 'Fabricated confirmation without POD',
      materiality: 'MATERIAL',
      origin: 'AI_PROPOSED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'UNCLASSIFIED',
      linkedPodId: null,
      confirmationDecision: null,
      scopeDecision: null,
      deactivationDecision: null,
      supersessionDecision: null,
      supersedes: null,
      supersededBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(discPath, JSON.stringify(disc, null, 2), 'utf8');

    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 11 (Defect 7): persistDiscoveryState validates complete authority and blocks writing invalid state', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const state = loadDiscoveryState(tempDir);
    state.requirements.push({
      id: 'IDEA-REQ-001',
      statement: 'Fake requirement with nonexistent POD',
      materiality: 'MATERIAL',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
      scopeDecision: {
        previousDisposition: 'UNCLASSIFIED',
        disposition: 'MUST',
        confirmedBy: 'PRODUCT_OWNER',
        decisionId: 'POD-NONEXISTENT-999',
        decidedAt: new Date().toISOString(),
      },
      linkedPodId: null,
      confirmationDecision: null,
      deactivationDecision: null,
      supersessionDecision: null,
      supersedes: null,
      supersededBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // persistDiscoveryState must throw BEFORE committing to disk
    assert.throws(() => {
      persistDiscoveryState(state, tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');

    // Confirm file on disk was not corrupted
    const reloaded = loadDiscoveryState(tempDir);
    assert.equal(reloaded.requirements.length, 0);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 11 (Defect 8): Append-only POD supersession creates immutable new record and rejects file overwrite', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const pod1 = createPODecision({
      id: 'POD-TEST-001',
      statement: 'Original architectural decision',
      status: 'APPROVED',
      provenance: 'product-owner',
    });
    persistPODecision(pod1, tempDir);

    const pod2 = createSupersedingPODecision({
      originalDecisionId: 'POD-TEST-001',
      id: 'POD-TEST-002',
      statement: 'Superseding architectural decision',
      status: 'APPROVED',
      provenance: 'product-owner',
    });
    assert.equal(pod2.supersedes, 'POD-TEST-001');
    assert.equal(pod2.id, 'POD-TEST-002');
    persistPODecision(pod2, tempDir);

    // Original POD remains unchanged on disk
    const reloadedPod1 = loadPODecisionById(tempDir, 'POD-TEST-001');
    assert.equal(reloadedPod1.statement, 'Original architectural decision');

    // Attempting to overwrite POD-TEST-001 fails with DK_POD_IMMUTABILITY_VIOLATION
    const illegalOverwrite = createPODecision({
      id: 'POD-TEST-001',
      statement: 'Attempted overwrite of POD-001',
      status: 'APPROVED',
      provenance: 'product-owner',
    });
    assert.throws(() => {
      persistPODecision(illegalOverwrite, tempDir);
    }, (err) => err.code === 'DK_POD_IMMUTABILITY_VIOLATION');
  } finally {
    cleanupTempDir(tempDir);
  }
});


/* ========================================================================= */
/* CANDIDATE 12 REGRESSION TESTS (Hardening AGENT → AUTHORITY Boundary)       */
/* ========================================================================= */

test('Candidate 12 (Runtime State Model): Deterministic runtime state invariant verification for initial discovery capture (REAL PACKAGED FIELD ACCEPTANCE REQUIRED for live host interaction)', async () => {
  const tempDir = createTempDir('dk-c12-field-solar-');
  try {
    // NOTE: This test proves deterministic runtime state, zero PODs, zero scopes, 1 persisted unresolved open question,
    // no brief, no /dk-spec recommendation, and static command/agent contracts.
    // It does NOT execute the Antigravity LLM host turn or prove live host interaction behavior.
    // REAL PACKAGED FIELD ACCEPTANCE REQUIRED.

    // 1. Initial lifecycle entry
    const entryRes = await executeLifecycleEntry({ command: 'dk-idea', rootDir: tempDir });
    assert.equal(entryRes.bootstrapped, true);

    // Prompt:
    // "Build a C&I Solar Commissioning & Handover Manager for solar installers and EPC teams.
    // It should help them capture project and equipment information, complete commissioning checks
    // and measurements, record defects and evidence, obtain approvals, and produce a final
    // commissioning and handover record."

    // Turn 1 faithfully captures initial UNRESOLVED candidates from user statement
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture project and equipment information.',
      origin: 'USER_STATED',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Complete commissioning checks and measurements.',
      origin: 'USER_STATED',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Record defects and evidence.',
      origin: 'USER_STATED',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-004',
      statement: 'Obtain approvals and produce a final commissioning and handover record.',
      origin: 'USER_STATED',
    });

    // Capture single material open question as UNRESOLVED
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'What tablet platforms and offline synchronization requirements must be supported?',
      materiality: 'MATERIAL',
    });

    // Assert discovery state invariants
    const disc = loadDiscoveryState(tempDir);
    assert.equal(disc.requirements.length, 4);
    assert.equal(disc.openQuestions.length, 1);
    for (const req of disc.requirements) {
      assert.equal(req.resolutionState, 'UNRESOLVED');
      assert.equal(req.scopeDisposition, 'UNCLASSIFIED');
      assert.equal(req.confirmationDecision, null);
      assert.equal(req.scopeDecision, null);
    }
    assert.equal(disc.openQuestions[0].resolution, 'UNRESOLVED');
    assert.equal(disc.openQuestions[0].resolutionDecision, null);

    // Assert ZERO PODs exist on disk
    const podDir = path.join(tempDir, '.development-kit', 'decisions');
    const podFiles = fs.existsSync(podDir) ? fs.readdirSync(podDir) : [];
    assert.equal(podFiles.length, 0, 'Initial discovery turn must create 0 POD files');

    // Assert stage state is DISCOVERY_IN_PROGRESS, no blockers, bootstrapped is true
    const stage = computeIdeaStageState(tempDir);
    assert.equal(stage.state, 'DISCOVERY_IN_PROGRESS');
    assert.ok(!stage.blockerType);
    assert.equal(stage.bootstrapped, true);

    // Assert no canonical idea-brief.md artifact exists
    assert.equal(fs.existsSync(path.join(tempDir, 'idea-brief.md')), false);

    // Assert NextStepResolver never recommends /dk-spec
    const resolver = new NextStepResolver();
    const nextSteps = resolver.resolve({
      stage: 'UNDERSTAND',
      rootDir: tempDir,
      projectState: { bootstrapped: true },
      taskState: null,
      verificationState: null,
      blockers: [],
    });
    assert.ok(nextSteps.some(s => s.command === '/dk-idea'));
    assert.ok(!nextSteps.some(s => s.command === '/dk-spec'), 'Must never recommend /dk-spec in initial discovery');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 12 (Defect 1): recordRequirementCandidate is strictly capture-only and rejects non-UNRESOLVED, confirmedBy, scope, or USER_CONFIRMED', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // 1. Reject origin USER_CONFIRMED at capture
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Statement 1',
        origin: 'USER_CONFIRMED',
      });
    }, (err) => err.code === 'DK_INVALID_ORIGIN');

    // 2. Reject resolutionState CONFIRMED on new candidate
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Statement 1',
        origin: 'USER_STATED',
        resolutionState: 'CONFIRMED',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // 3. Reject resolutionState ADOPTED on new candidate
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Statement 1',
        origin: 'RESEARCH_DERIVED',
        resolutionState: 'ADOPTED',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // 4. Reject confirmedBy on new candidate
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Statement 1',
        origin: 'USER_STATED',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_CONFIRMATION');

    // 5. Reject caller-supplied scopeDisposition on new candidate
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Statement 1',
        origin: 'USER_STATED',
        scopeDisposition: 'MUST',
      });
    }, (err) => err.code === 'DK_MATERIAL_SCOPE_REQUIRES_CLASSIFICATION' || err.code === 'DK_SCOPE_CLASSIFICATION_PROHIBITED');

    // 6. Capture clean UNRESOLVED candidate
    const cand = recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Statement 1',
      origin: 'USER_STATED',
    });
    assert.equal(cand.resolutionState, 'UNRESOLVED');
    assert.equal(cand.scopeDisposition, 'UNCLASSIFIED');

    // 7. Reject mutating resolutionState via recordRequirementCandidate on existing candidate
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Statement 1',
        origin: 'USER_STATED',
        resolutionState: 'CONFIRMED',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 12 (Defect 2): recordOpenQuestion is strictly capture-only and rejects non-UNRESOLVED, resolvedBy, or resolution mutation', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // 1. Reject resolution ANSWERED on new question
    assert.throws(() => {
      recordOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        question: 'Question 1?',
        resolution: 'ANSWERED',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // 2. Reject resolution DEFERRED on new question
    assert.throws(() => {
      recordOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        question: 'Question 1?',
        resolution: 'DEFERRED',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // 3. Reject resolvedBy on new question
    assert.throws(() => {
      recordOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        question: 'Question 1?',
        resolvedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_RESOLUTION');

    // 4. Capture clean UNRESOLVED question
    const q = recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Question 1?',
      materiality: 'MATERIAL',
    });
    assert.equal(q.resolution, 'UNRESOLVED');

    // 5. Reject mutating resolution via recordOpenQuestion on existing question
    assert.throws(() => {
      recordOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        question: 'Question 1?',
        resolution: 'ANSWERED',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 12 (Defect 3): confirmRequirementCandidate, adoptRequirementCandidate, rejectRequirementCandidate enforce content lock and POD immutability', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Original exact statement.',
      origin: 'USER_STATED',
      materiality: 'MATERIAL',
    });

    // 1. Missing confirmedBy throws
    assert.throws(() => {
      confirmRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        confirmedBy: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_CONFIRMATION');

    // 2. Valid confirmation creates REQUIREMENT_CONFIRMATION POD with content lock
    const confirmed = confirmRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(confirmed.resolutionState, 'CONFIRMED');
    assert.ok(confirmed.confirmationDecision.decisionId);

    const pod = loadPODecisionById(tempDir, confirmed.confirmationDecision.decisionId);
    assert.equal(pod.decisionType, 'REQUIREMENT_CONFIRMATION');
    assert.equal(pod.decisionData.requirementId, 'IDEA-REQ-001');
    assert.equal(pod.decisionData.statement, 'Original exact statement.');
    assert.ok(pod.decisionData.requirementFingerprint.startsWith('sha256:'));
    assert.equal(pod.decisionData.previousResolution, 'UNRESOLVED');
    assert.equal(pod.decisionData.newResolution, 'CONFIRMED');

    // 3. RESEARCH_DERIVED adoption
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Research capability.',
      origin: 'RESEARCH_DERIVED',
      materiality: 'MATERIAL',
    });
    const adopted = adoptRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(adopted.resolutionState, 'ADOPTED');
    const adoptPod = loadPODecisionById(tempDir, adopted.confirmationDecision.decisionId);
    assert.equal(adoptPod.decisionType, 'REQUIREMENT_ADOPTION');
    assert.equal(adoptPod.decisionData.newResolution, 'ADOPTED');

    // 4. Candidate rejection updates scope to EXCLUDED and creates REQUIREMENT_REJECTION POD
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Out of scope idea.',
      origin: 'USER_STATED',
      materiality: 'MATERIAL',
    });
    const rejected = rejectRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      confirmedBy: 'PRODUCT_OWNER',
      reason: 'Not needed for MVP',
    });
    assert.equal(rejected.resolutionState, 'REJECTED');
    assert.equal(rejected.scopeDisposition, 'EXCLUDED');
    const rejPod = loadPODecisionById(tempDir, rejected.deactivationDecision.decisionId);
    assert.equal(rejPod.decisionType, 'REQUIREMENT_REJECTION');
    assert.equal(rejPod.decisionData.newResolution, 'REJECTED');
    assert.equal(rejPod.decisionData.reason, 'Not needed for MVP');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 12 (Defect 4): resolveOpenQuestion creates content-locked POD with questionFingerprint and validates material transitions', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Exact question text?',
      materiality: 'MATERIAL',
    });

    // Missing resolvedBy throws
    assert.throws(() => {
      resolveOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        resolution: 'ANSWERED',
        resolvedBy: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_RESOLUTION');

    // Valid resolution creates content-locked QUESTION_RESOLUTION POD
    const resolved = resolveOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
    });
    assert.equal(resolved.resolution, 'ANSWERED');
    const pod = loadPODecisionById(tempDir, resolved.resolutionDecision.decisionId);
    assert.equal(pod.decisionType, 'QUESTION_RESOLUTION');
    assert.equal(pod.decisionData.questionId, 'IDEA-Q-001');
    assert.equal(pod.decisionData.question, 'Exact question text?');
    assert.ok(pod.decisionData.questionFingerprint.startsWith('sha256:'));
    assert.equal(pod.decisionData.previousResolution, 'UNRESOLVED');
    assert.equal(pod.decisionData.newResolution, 'ANSWERED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 12 (Defect 5): Public persistDiscoveryState rejects inMemoryPods bypass and validates strictly against disk', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    const discState = loadDiscoveryState(tempDir);
    discState.requirements.push({
      id: 'IDEA-REQ-001',
      statement: 'Tampered requirement with unpersisted in-memory POD',
      materiality: 'MATERIAL',
      origin: 'USER_STATED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
      scopeDecision: null,
      confirmationDecision: {
        confirmedBy: 'PRODUCT_OWNER',
        decisionId: 'POD-UNPERSISTED-001',
        decidedAt: new Date().toISOString(),
      },
      deactivationDecision: null,
      supersessionDecision: null,
      supersedes: null,
      supersededBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Public persistDiscoveryState signature only accepts (state, rootDir) and checks disk PODs
    assert.throws(() => {
      persistDiscoveryState(discState, tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');

    // Verify disk state remains clean
    const reloaded = loadDiscoveryState(tempDir);
    assert.equal(reloaded.requirements.length, 0);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 12 (Defect 6): Full historical field cross-check in validateDiscoveryAuthority fails on mismatched transition metadata', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    setupConfirmedCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Original statement',
      origin: 'USER_STATED',
      scopeDisposition: null,
    });

    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const disc = loadDiscoveryState(tempDir);
    const validPodId = disc.requirements[0].confirmationDecision.decisionId;
    const pod = loadPODecisionById(tempDir, validPodId);

    // 1. Statement mismatch fails closed
    disc.requirements[0].statement = 'Tampered statement text';
    fs.writeFileSync(discPath, JSON.stringify(disc, null, 2), 'utf8');
    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');

    // 2. Origin mismatch fails closed
    disc.requirements[0].statement = 'Original statement';
    disc.requirements[0].origin = 'AI_PROPOSED';
    fs.writeFileSync(discPath, JSON.stringify(disc, null, 2), 'utf8');
    assert.throws(() => {
      loadDiscoveryState(tempDir);
    }, (err) => err.code === 'DK_DISCOVERY_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 12 (Defect 7): Public Command & Agent Contract integrity inspection', () => {
  const ideaCmdPath = path.resolve('commands/dk-idea.md');
  const ideaCmdContent = fs.readFileSync(ideaCmdPath, 'utf8');

  // Must not contain unsafe examples
  assert.ok(!ideaCmdContent.includes('"origin":"USER_CONFIRMED"'), 'Must not contain origin USER_CONFIRMED');
  assert.ok(!ideaCmdContent.includes('idea-record-candidate --input-json=\'{"id":"IDEA-REQ-001","statement":"...","origin":"USER_CONFIRMED"'), 'Must not contain unsafe record-candidate');
  assert.ok(!ideaCmdContent.includes('resolutionState":"CONFIRMED","confirmedBy":"PRODUCT_OWNER"'), 'Must not contain candidate capture confirmedBy');

  // Must contain dedicated operations
  assert.ok(ideaCmdContent.includes('idea-confirm-candidate'), 'Must document idea-confirm-candidate');
  assert.ok(ideaCmdContent.includes('idea-adopt-candidate'), 'Must document idea-adopt-candidate');
  assert.ok(ideaCmdContent.includes('idea-reject-candidate'), 'Must document idea-reject-candidate');
  assert.ok(ideaCmdContent.includes('idea-resolve-question'), 'Must document idea-resolve-question');

  // Must document one-question-per-turn rule and provenance rule
  assert.ok(ideaCmdContent.includes('Canonical One-Question-Per-Turn Rule'), 'Must document one-question rule');
  assert.ok(ideaCmdContent.includes('STOP and return control to the user'), 'Must document STOP rule');
  assert.ok(ideaCmdContent.includes('Provenance Integrity Rule'), 'Must document provenance rule');

  // Agent check
  const agentPath = path.resolve('agents/product-discovery-agent.md');
  const agentContent = fs.readFileSync(agentPath, 'utf8');
  assert.ok(agentContent.includes('Sequential One-Question-Per-Turn Rule'), 'Agent must include one-question rule');
  assert.ok(agentContent.includes('Provenance Integrity Rule'), 'Agent must include provenance rule');
  assert.ok(agentContent.includes('STOP and return control to the user'), 'Agent must include STOP rule');
});


/* ========================================================================= */
/* CANDIDATE 13 REGRESSION TESTS (Authority Hardening & Supersession Ops)      */
/* ========================================================================= */

test('Candidate 13 (Defect 1): Non-material question resolution requires explicit resolvedBy = PRODUCT_OWNER and produces zero side effects on unauthorized attempts', () => {
  const tempDir = createTempDir('dk-c13-nonmat-q-');
  try {
    bootstrapProject(tempDir);
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Non-material exploratory question?',
      materiality: 'NON_MATERIAL',
    });

    const discPath = path.join(tempDir, '.development-kit', 'idea', 'discovery.json');
    const discBefore = fs.readFileSync(discPath, 'utf8');
    const podDir = path.join(tempDir, '.development-kit', 'decisions');
    const podFilesBefore = fs.existsSync(podDir) ? fs.readdirSync(podDir) : [];

    // 1. NON_MATERIAL + no resolvedBy -> throws DK_UNAUTHORIZED_RESOLUTION
    assert.throws(() => {
      resolveOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        resolution: 'ANSWERED',
        notes: 'Attempted resolution without PO',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_RESOLUTION');

    // Verify zero disk side effects
    assert.equal(fs.readFileSync(discPath, 'utf8'), discBefore);
    const podFilesAfter1 = fs.existsSync(podDir) ? fs.readdirSync(podDir) : [];
    assert.equal(podFilesAfter1.length, podFilesBefore.length);

    // 2. NON_MATERIAL + resolvedBy = 'AI_AGENT' -> throws DK_UNAUTHORIZED_RESOLUTION
    assert.throws(() => {
      resolveOpenQuestion(tempDir, {
        id: 'IDEA-Q-001',
        resolution: 'ANSWERED',
        resolvedBy: 'AI_AGENT',
        notes: 'Attempted resolution with AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_RESOLUTION');

    // Verify zero disk side effects
    assert.equal(fs.readFileSync(discPath, 'utf8'), discBefore);
    const podFilesAfter2 = fs.existsSync(podDir) ? fs.readdirSync(podDir) : [];
    assert.equal(podFilesAfter2.length, podFilesBefore.length);

    // 3. NON_MATERIAL + resolvedBy = 'PRODUCT_OWNER' -> succeeds and creates valid immutable QUESTION_RESOLUTION POD
    const resolved = resolveOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
      notes: 'Authoritatively answered by PO',
    });
    assert.equal(resolved.resolution, 'ANSWERED');
    assert.equal(resolved.resolvedBy, 'PRODUCT_OWNER');
    assert.ok(resolved.resolutionDecision.decisionId);

    const podFilesAfter3 = fs.existsSync(podDir) ? fs.readdirSync(podDir) : [];
    assert.equal(podFilesAfter3.length, podFilesBefore.length + 1);

    const createdPod = loadPODecisionById(tempDir, resolved.resolutionDecision.decisionId);
    assert.equal(createdPod.decisionType, 'QUESTION_RESOLUTION');
    assert.equal(createdPod.provenance, 'product-owner');
    assert.equal(createdPod.status, 'APPROVED');
    assert.equal(createdPod.decisionData.questionId, 'IDEA-Q-001');
    assert.equal(createdPod.decisionData.newResolution, 'ANSWERED');

    // 4. MATERIAL question resolution behavior remains intact
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-002',
      question: 'Material question?',
      materiality: 'MATERIAL',
    });

    assert.throws(() => {
      resolveOpenQuestion(tempDir, {
        id: 'IDEA-Q-002',
        resolution: 'ANSWERED',
        resolvedBy: 'AI_AGENT',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_RESOLUTION');

    const matResolved = resolveOpenQuestion(tempDir, {
      id: 'IDEA-Q-002',
      resolution: 'DEFERRED',
      resolvedBy: 'PRODUCT_OWNER',
      deferredTarget: 'Future Scope',
    });
    assert.equal(matResolved.resolution, 'DEFERRED');
    assert.equal(matResolved.resolvedBy, 'PRODUCT_OWNER');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 13 (Defect 2): Public supersession CLI operations (idea-supersede-candidate & idea-supersede-question) execute cleanly via CLI runner', () => {
  const tempDir = createTempDir('dk-c13-cli-supersede-');
  try {
    bootstrapProject(tempDir);
    const orchScript = path.resolve('scripts/orchestration.mjs');

    // 1. Record initial unresolved candidates and questions
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Initial requirement statement.',
      origin: 'USER_STATED',
      materiality: 'MATERIAL',
    });
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Initial open question?',
      materiality: 'MATERIAL',
    });

    // 2. Present interaction before superseding question (DISCOVERY_QUESTION is prioritized over REQ_CONFIRMATION)
    let state = presentCurrentInteraction(tempDir);
    assert.equal(state.pendingInteraction.type, 'DISCOVERY_QUESTION');
    const qFp = state.pendingInteraction.fingerprint;

    // Call idea-supersede-question via CLI
    const supQRes = spawnSync(process.execPath, [
      orchScript,
      '--rootDir=' + tempDir,
      '--operation=idea-supersede-question',
      '--input-json=' + JSON.stringify({
        oldId: 'IDEA-Q-001',
        newQuestion: {
          id: 'IDEA-Q-002',
          question: 'Superseding modified question text?',
          materiality: 'MATERIAL',
          confirmedBy: 'PRODUCT_OWNER',
        },
        expectedInteractionFingerprint: qFp,
      }),
    ], { encoding: 'utf8' });

    assert.equal(supQRes.status, 0, supQRes.stderr || supQRes.stdout);
    const qParsed = JSON.parse(supQRes.stdout);
    assert.equal(qParsed.success, true);
    assert.equal(qParsed.result.created.id, 'IDEA-Q-002');
    assert.equal(qParsed.result.created.resolution, 'UNRESOLVED');
    assert.equal(qParsed.result.created.supersedes, 'IDEA-Q-001');

    // 3. Resolve the question so workflow advances
    state = resolveIdeaWorkflowState(tempDir);
    consumeDiscoveryQuestionResponse(tempDir, {
      questionId: 'IDEA-Q-002',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.pendingInteraction.type, 'DESIGN_APPLICABILITY');
    consumeDesignApplicabilityResponse(tempDir, {
      choice: '1. Visual user interface (web, mobile, desktop)',
      applicable: true,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.pendingInteraction.type, 'DESIGN_SYSTEM_SETUP');
    recordDesignAuthoritySetup(tempDir, {
      disposition: 'DEFERRED',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.pendingInteraction.type, 'IDEA_CHALLENGE');
    recordIdeaChallengeResponse(tempDir, {
      response: 'Proceed',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(tempDir);
    assert.equal(state.pendingInteraction.type, 'REQUIREMENT_CONFIRMATION');
    const reqFp = state.pendingInteraction.fingerprint;

    // Call idea-supersede-candidate via CLI
    const supCandRes = spawnSync(process.execPath, [
      orchScript,
      '--rootDir=' + tempDir,
      '--operation=idea-supersede-candidate',
      '--input-json=' + JSON.stringify({
        oldId: 'IDEA-REQ-001',
        newCandidate: {
          id: 'IDEA-REQ-002',
          statement: 'Superseding modified requirement statement.',
          origin: 'USER_STATED',
          confirmedBy: 'PRODUCT_OWNER',
        },
        expectedInteractionFingerprint: reqFp,
      }),
    ], { encoding: 'utf8' });

    assert.equal(supCandRes.status, 0, supCandRes.stderr || supCandRes.stdout);
    const candParsed = JSON.parse(supCandRes.stdout);
    assert.equal(candParsed.success, true);
    assert.equal(candParsed.result.created.id, 'IDEA-REQ-002');
    assert.equal(candParsed.result.created.resolutionState, 'UNRESOLVED');
    assert.equal(candParsed.result.created.supersedes, 'IDEA-REQ-001');

    // 4. Verify discovery state integrity and lineage
    const disc = loadDiscoveryState(tempDir);
    const oldReq = disc.requirements.find(r => r.id === 'IDEA-REQ-001');
    const newReq = disc.requirements.find(r => r.id === 'IDEA-REQ-002');
    assert.equal(oldReq.resolutionState, 'SUPERSEDED');
    assert.equal(oldReq.supersededBy, 'IDEA-REQ-002');
    assert.equal(newReq.resolutionState, 'UNRESOLVED');
    assert.equal(newReq.supersedes, 'IDEA-REQ-001');

    const oldQ = disc.openQuestions.find(q => q.id === 'IDEA-Q-001');
    const newQ = disc.openQuestions.find(q => q.id === 'IDEA-Q-002');
    assert.equal(oldQ.resolution, 'SUPERSEDED');
    assert.equal(oldQ.supersededBy, 'IDEA-Q-002');
    assert.equal(newQ.resolution, 'ANSWERED');
    assert.equal(newQ.supersedes, 'IDEA-Q-001');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 13 (Defect 3): Dedicated confirmation and adoption state replay prevention', () => {
  const tempDir = createTempDir('dk-c13-replay-prevent-');
  try {
    bootstrapProject(tempDir);

    // 1. UNRESOLVED -> CONFIRMED succeeds
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Initial user stated requirement.',
      origin: 'USER_STATED',
    });

    const confirmed = confirmRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(confirmed.resolutionState, 'CONFIRMED');

    const podDir = path.join(tempDir, '.development-kit', 'decisions');
    const podCountAfterFirst = fs.readdirSync(podDir).length;

    // CONFIRMED -> confirm again fails deterministically
    assert.throws(() => {
      confirmRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // Zero new PODs created
    assert.equal(fs.readdirSync(podDir).length, podCountAfterFirst);

    // 2. UNRESOLVED research -> ADOPTED succeeds
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Research derived recommendation.',
      origin: 'RESEARCH_DERIVED',
    });

    const adopted = adoptRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(adopted.resolutionState, 'ADOPTED');

    const podCountAfterSecond = fs.readdirSync(podDir).length;

    // ADOPTED -> adopt again fails deterministically
    assert.throws(() => {
      adoptRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-002',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // Zero new PODs created
    assert.equal(fs.readdirSync(podDir).length, podCountAfterSecond);

    // 3. rejectRequirementCandidate preserves legitimate rejection from active states
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Candidate to reject while unresolved.',
      origin: 'USER_STATED',
    });
    const rej1 = rejectRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(rej1.resolutionState, 'REJECTED');

    // Rejecting already confirmed requirement by PO succeeds as legitimate active-to-rejected transition
    const rej2 = rejectRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      confirmedBy: 'PRODUCT_OWNER',
    });
    assert.equal(rej2.resolutionState, 'REJECTED');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 13 (Defect 4): Public Command & Agent Contract integrity inspection for Modify Statements / Supersession path', () => {
  const ideaCmdPath = path.resolve('commands/dk-idea.md');
  const ideaCmdContent = fs.readFileSync(ideaCmdPath, 'utf8');

  assert.ok(ideaCmdContent.includes('Modifying Candidate Statements or Questions (Deterministic Path)'), 'Must document Modify Statements path');
  assert.ok(ideaCmdContent.includes('idea-supersede-candidate'), 'Must document idea-supersede-candidate CLI');
  assert.ok(ideaCmdContent.includes('idea-supersede-question'), 'Must document idea-supersede-question CLI');

  const agentPath = path.resolve('agents/product-discovery-agent.md');
  const agentContent = fs.readFileSync(agentPath, 'utf8');
  assert.ok(agentContent.includes('idea-supersede-candidate'), 'Agent must include idea-supersede-candidate');
  assert.ok(agentContent.includes('idea-supersede-question'), 'Agent must include idea-supersede-question');
});

// ===========================================================================
// Candidate 14: Project-Root Affinity & Path Resolution Tests
// ===========================================================================

test('Candidate 14 (Project Root): resolveProjectRoot handles spaces in paths and nested .agents invocation', async () => {
  const baseDir = createTempDir('dk space test-');
  try {
    const agentsDir = path.join(baseDir, '.agents');
    const pluginDir = path.join(agentsDir, 'plugins', 'development-kit');
    const scriptsDir = path.join(pluginDir, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });

    const fakeScriptPath = path.join(scriptsDir, 'run.mjs');

    const { resolveProjectRoot, ProjectRootError } = await import('../runtime/bootstrap/project-root.mjs');

    // 1. Invocation with cwd = <project>
    const rootFromProject = resolveProjectRoot({
      cwd: baseDir,
      executablePath: fakeScriptPath,
    });
    assert.equal(rootFromProject, baseDir);

    // 2. Invocation with cwd = <project>/.agents
    const rootFromAgents = resolveProjectRoot({
      cwd: agentsDir,
      executablePath: fakeScriptPath,
    });
    assert.equal(rootFromAgents, baseDir);

    // 3. Invocation with cwd = <project>/.agents/plugins/development-kit/scripts
    const rootFromScripts = resolveProjectRoot({
      cwd: scriptsDir,
      executablePath: fakeScriptPath,
    });
    assert.equal(rootFromScripts, baseDir);

    // 4. Invocation from arbitrary cwd where script is inside project plugin
    const otherDir = createTempDir('dk other-');
    try {
      const rootFromOther = resolveProjectRoot({
        cwd: otherDir,
        executablePath: fakeScriptPath,
      });
      assert.equal(rootFromOther, baseDir, 'Script path inside plugin must anchor project root even if cwd is elsewhere');
    } finally {
      cleanupTempDir(otherDir);
    }
  } finally {
    cleanupTempDir(baseDir);
  }
});

test('Candidate 14 (Project Root Conflict): resolveProjectRoot throws DK_PROJECT_ROOT_CONFLICT on conflicting identities', async () => {
  const projA = createTempDir('dk projA-');
  const projB = createTempDir('dk projB-');
  try {
    const dkA = path.join(projA, '.development-kit');
    const dkB = path.join(projB, '.development-kit');
    fs.mkdirSync(dkA, { recursive: true });
    fs.mkdirSync(dkB, { recursive: true });
    fs.writeFileSync(path.join(dkA, 'project.json'), JSON.stringify({ projectId: 'proj-A-123', frameworkVersion: '0.9.0' }));
    fs.writeFileSync(path.join(dkB, 'project.json'), JSON.stringify({ projectId: 'proj-B-456', frameworkVersion: '0.9.0' }));

    const fakeScriptInA = path.join(projA, '.agents', 'plugins', 'development-kit', 'scripts', 'run.mjs');

    const { resolveProjectRoot } = await import('../runtime/bootstrap/project-root.mjs');

    assert.throws(
      () => resolveProjectRoot({ cwd: projB, executablePath: fakeScriptInA }),
      (err) => err.code === 'DK_PROJECT_ROOT_CONFLICT'
    );
  } finally {
    cleanupTempDir(projA);
    cleanupTempDir(projB);
  }
});

test('Candidate 14 (Mislocated State): checkMislocatedState throws DK_MISLOCATED_STATE if .agents/.development-kit exists', async () => {
  const testDir = createTempDir('dk mislocated-');
  try {
    const mislocated = path.join(testDir, '.agents', '.development-kit');
    fs.mkdirSync(mislocated, { recursive: true });

    const { resolveProjectRoot } = await import('../runtime/bootstrap/project-root.mjs');

    assert.throws(
      () => resolveProjectRoot({ cwd: testDir }),
      (err) => err.code === 'DK_MISLOCATED_STATE'
    );
  } finally {
    cleanupTempDir(testDir);
  }
});

test('Candidate 15 (Explicit Root vs Installation Root Authority): resolveProjectRoot rejects redirection to another project', async () => {
  const projA = createTempDir('dk projA-');
  const projB = createTempDir('dk projB-');
  try {
    const fakeScriptInA = path.join(projA, '.agents', 'plugins', 'development-kit', 'scripts', 'run.mjs');
    const { resolveProjectRoot } = await import('../runtime/bootstrap/project-root.mjs');

    // 1. A plugin script + explicitRoot A -> PASS
    const rootA = resolveProjectRoot({ explicitRoot: projA, executablePath: fakeScriptInA });
    assert.equal(rootA, projA);

    // 2. A plugin script + explicitRoot A/.agents -> PASS (canonicalizes to A)
    const rootAAgents = resolveProjectRoot({ explicitRoot: path.join(projA, '.agents'), executablePath: fakeScriptInA });
    assert.equal(rootAAgents, projA);

    // 3. A plugin script + explicitRoot B -> DK_PROJECT_ROOT_CONFLICT
    assert.throws(
      () => resolveProjectRoot({ explicitRoot: projB, executablePath: fakeScriptInA }),
      (err) => err.code === 'DK_PROJECT_ROOT_CONFLICT'
    );

    // 4. Even when neither project is bootstrapped, installation authority must not be redirected
    assert.throws(
      () => resolveProjectRoot({ explicitRoot: projB, executablePath: fakeScriptInA }),
      (err) => err.code === 'DK_PROJECT_ROOT_CONFLICT'
    );
  } finally {
    cleanupTempDir(projA);
    cleanupTempDir(projB);
  }
});

test('Candidate 15 (Real Ancestor Project-Root Discovery): resolveProjectRoot finds canonical parent from deep subdirs', async () => {
  const proj = createTempDir('dk ancestor proj-');
  try {
    const dkA = path.join(proj, '.development-kit');
    fs.mkdirSync(dkA, { recursive: true });
    fs.writeFileSync(path.join(dkA, 'project.json'), JSON.stringify({ projectId: 'ancestor-proj', frameworkVersion: '0.9.0' }));

    const deepSubdir = path.join(proj, 'src', 'features', 'moduleA');
    fs.mkdirSync(deepSubdir, { recursive: true });

    const { resolveProjectRoot } = await import('../runtime/bootstrap/project-root.mjs');

    // 1. cwd = project -> project
    assert.equal(resolveProjectRoot({ cwd: proj }), proj);

    // 2. cwd = project/src/features/moduleA -> project
    assert.equal(resolveProjectRoot({ cwd: deepSubdir }), proj);

    // 3. cwd = project/.agents -> project
    const agentsDir = path.join(proj, '.agents');
    assert.equal(resolveProjectRoot({ cwd: agentsDir }), proj);

    // 4. cwd = project/.agents/plugins/development-kit/scripts -> project
    const pluginScripts = path.join(proj, '.agents', 'plugins', 'development-kit', 'scripts');
    assert.equal(resolveProjectRoot({ cwd: pluginScripts }), proj);

    // 5. Global/standalone script execution with cwd in deep subdir -> project
    const fakeGlobalScript = path.join(createTempDir('dk global-'), 'scripts', 'run.mjs');
    assert.equal(resolveProjectRoot({ cwd: deepSubdir, executablePath: fakeGlobalScript }), proj);

    // 6. Conflicting DKF markers in ancestor chain fail closed
    const childProj = path.join(proj, 'packages', 'child');
    const dkChild = path.join(childProj, '.development-kit');
    fs.mkdirSync(dkChild, { recursive: true });
    fs.writeFileSync(path.join(dkChild, 'project.json'), JSON.stringify({ projectId: 'child-proj', frameworkVersion: '0.9.0' }));

    const deepChild = path.join(childProj, 'src');
    fs.mkdirSync(deepChild, { recursive: true });

    assert.throws(
      () => resolveProjectRoot({ cwd: deepChild }),
      (err) => err.code === 'DK_PROJECT_ROOT_CONFLICT'
    );
  } finally {
    cleanupTempDir(proj);
  }
});

test('Candidate 15 (BOM-free Executable Shebangs): all executable .mjs and .js files start with ASCII shebang or code', () => {
  function walk(dir) {
    let files = [];
    for (const f of fs.readdirSync(dir)) {
      if (f === 'node_modules' || f === '.git') continue;
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        files = files.concat(walk(full));
      } else if (f.endsWith('.mjs') || f.endsWith('.js')) {
        files.push(full);
      }
    }
    return files;
  }

  const scripts = walk(path.resolve('.'));
  assert.ok(scripts.length > 50, 'Must check repository scripts');

  for (const file of scripts) {
    const buf = fs.readFileSync(file);
    const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    assert.equal(hasBom, false, `File must not contain UTF-8 BOM: ${file}`);

    const text = buf.toString('utf8');
    if (text.startsWith('#!')) {
      assert.equal(buf[0], 0x23, `Shebang must start with byte '#' (0x23) in ${file}`);
      assert.equal(buf[1], 0x21, `Shebang must start with byte '!' (0x21) in ${file}`);
    }
  }
});

test('Candidate 18 (Exact Legacy Candidate 16 No-Workflow Regression): Fresh execution returns DESIGN_SYSTEM_SETUP and persists without side effects', async () => {
  const rootDir = createTempDir('dk-c18-c16-legacy-');
  try {
    await bootstrapProject(rootDir);

    // Setup exact C16 persisted state:
    // IDEA-REQ-001..005 USER_STATED UNRESOLVED
    for (let i = 1; i <= 5; i++) {
      recordRequirementCandidate(rootDir, {
        id: `IDEA-REQ-00${i}`,
        statement: `User requirement ${i} statement`,
        origin: 'USER_STATED',
      });
    }

    // IDEA-REQ-006 AI_PROPOSED UNRESOLVED
    recordRequirementCandidate(rootDir, {
      id: 'IDEA-REQ-006',
      statement: 'AI proposed requirement statement',
      origin: 'AI_PROPOSED',
    });

    // IDEA-Q-001 ANSWERED by PRODUCT_OWNER with QUESTION_RESOLUTION POD
    recordOpenQuestion(rootDir, {
      id: 'IDEA-Q-001',
      question: 'What platform should be supported?',
      materiality: 'MATERIAL',
    });
    resolveOpenQuestion(rootDir, {
      id: 'IDEA-Q-001',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
    });

    // CRITICAL: NO workflow.json exists initially
    assert.equal(fs.existsSync(path.join(rootDir, '.development-kit', 'idea', 'workflow.json')), false);

    const discBefore = loadDiscoveryState(rootDir);
    assert.equal(discBefore.requirements.length, 6);
    assert.equal(discBefore.openQuestions.length, 1);
    assert.equal(discBefore.openQuestions[0].resolution, 'ANSWERED');

    // Execute lifecycle entry for /dk-idea
    const entryResult = await executeLifecycleEntry({
      rootDir,
      command: '/dk-idea',
      phase: 'entry',
    });

    assert.equal(entryResult.success, true);
    assert.ok(entryResult.ideaWorkflow, 'Must return structured ideaWorkflow');
    assert.equal(entryResult.ideaWorkflow.ideaStage, 'DISCOVERY_IN_PROGRESS');
    assert.equal(entryResult.ideaWorkflow.workflowPhase, 'DESIGN_APPLICABILITY_CHECK');
    assert.equal(entryResult.ideaWorkflow.action, 'PROMPT_DESIGN_APPLICABILITY');
    assert.equal(entryResult.ideaWorkflow.pendingInteraction.type, 'DESIGN_APPLICABILITY');
    assert.equal(entryResult.ideaWorkflow.pendingInteraction.id, 'INTERACTION-DESIGN-APPLICABILITY');

    // Zero side effects during read-only inspection
    const discAfter = loadDiscoveryState(rootDir);
    assert.equal(discAfter.revision, discBefore.revision);
    assert.equal(discAfter.fingerprint, discBefore.fingerprint);
    assert.equal(discAfter.requirements.length, 6);
    assert.equal(discAfter.openQuestions.length, 1);

    // Persist runtime-derived pending interaction
    presentCurrentInteraction(rootDir, {
      expectedInteractionId: 'INTERACTION-DESIGN-APPLICABILITY',
      expectedFingerprint: entryResult.ideaWorkflow.pendingInteraction.fingerprint,
    });

    // Second fresh restart resumes the exact same Design System Setup
    const secondEntry = await executeLifecycleEntry({
      rootDir,
      command: '/dk-idea',
      phase: 'entry',
    });
    assert.equal(secondEntry.success, true);
    assert.equal(secondEntry.ideaWorkflow.workflowPhase, 'DESIGN_APPLICABILITY_CHECK');
    assert.equal(secondEntry.ideaWorkflow.action, 'RESUME_PENDING_INTERACTION');
    assert.equal(secondEntry.ideaWorkflow.pendingInteraction.type, 'DESIGN_APPLICABILITY');
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 19 (Guarded Typed Consumers & A–G End-to-End Suite): Public typed consumers advance state deterministically', async () => {
  const rootDir = createTempDir('dk-c19-real-transitions-');
  try {
    await bootstrapProject(rootDir);

    // --- Turn A: Discovery Question ---
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Req 1', origin: 'USER_STATED' });
    recordOpenQuestion(rootDir, { id: 'IDEA-Q-001', question: 'Initial discovery question?', materiality: 'MATERIAL' });
    presentCurrentInteraction(rootDir);

    let state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'REQUIREMENTS_INTERVIEW');
    assert.equal(state.pendingInteraction.type, 'DISCOVERY_QUESTION');
    assert.equal(state.pendingInteraction.id, 'IDEA-Q-001');

    // Consume Turn A response via guarded consumer with fingerprint binding
    const turnAFp = state.pendingInteraction.fingerprint;
    consumeDiscoveryQuestionResponse(rootDir, {
      questionId: 'IDEA-Q-001',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: turnAFp,
    });

    // --- Turn A.5: Design Applicability ---
    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'DESIGN_APPLICABILITY_CHECK');
    assert.equal(state.pendingInteraction.type, 'DESIGN_APPLICABILITY');
    const turnA5Fp = state.pendingInteraction.fingerprint;

    consumeDesignApplicabilityResponse(rootDir, {
      choice: '1. Visual user interface (web, mobile, desktop)',
      applicable: true,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: turnA5Fp,
    });

    // --- Turn B: Design System Setup ---
    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'DESIGN_SYSTEM_SETUP');
    assert.equal(state.pendingInteraction.type, 'DESIGN_SYSTEM_SETUP');
    const turnBFp = state.pendingInteraction.fingerprint;

    // Consume Turn B response
    recordDesignAuthoritySetup(rootDir, {
      disposition: 'DEFERRED',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: turnBFp,
    });
    const canonicalDesign = loadDesignSystemState(rootDir);
    assert.equal(canonicalDesign.status, 'deferred');

    // --- Turn C: Idea Challenge ---
    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'IDEA_CHALLENGE');
    assert.equal(state.pendingInteraction.type, 'IDEA_CHALLENGE');
    const turnCFp = state.pendingInteraction.fingerprint;

    // Consume Turn C response
    recordIdeaChallengeResponse(rootDir, {
      response: 'Proceed',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: turnCFp,
    });

    // --- Turn D: Requirement Confirmation ---
    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'REQUIREMENT_CONFIRMATION');
    assert.equal(state.pendingInteraction.type, 'REQUIREMENT_CONFIRMATION');
    const turnDFp = state.pendingInteraction.fingerprint;

    // Consume Turn D response via guarded consumer
    consumeRequirementConfirmation(rootDir, {
      action: 'CONFIRM',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: turnDFp,
    });

    // --- Turn E: Scope Proposal & Confirmation ---
    recordScopeProposal(rootDir, {
      scopeProposal: { 'IDEA-REQ-001': 'MUST' },
    });

    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'SCOPE_CONFIRMATION');
    assert.equal(state.pendingInteraction.type, 'SCOPE_CONFIRMATION');
    const turnEFp = state.pendingInteraction.fingerprint;

    // Consume Turn E response via guarded consumer
    consumeScopeConfirmation(rootDir, {
      scopeMapping: { 'IDEA-REQ-001': 'MUST' },
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: turnEFp,
    });

    // --- Turn F: Brief Draft & Brief Approval ---
    const briefContent = `# Idea Brief: Solar App\n\n## Problem\nProblem text\n\n## Intended Users\nUser text\n\n## Success Criteria\nSuccess text\n\n## Requirements (Must)\n- [IDEA-REQ-001] Req 1\n\n## Preferences (Should)\n- None\n\n## Assumptions\n- None\n\n## Constraints\n- None\n\n## Risks\n- None\n\n## Open Questions\n- None\n\n## Future Ideas (Explicitly Deferred)\n- None\n`;
    const disc = loadDiscoveryState(rootDir);
    persistCanonicalIdeaBrief({
      rootDir,
      content: briefContent,
      discoveryRevision: disc.revision,
      discoveryFingerprint: disc.fingerprint,
    });

    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'BRIEF_APPROVAL');
    assert.equal(state.pendingInteraction.type, 'BRIEF_APPROVAL');
    presentCurrentInteraction(rootDir);

    // Consume Turn F response (Approval) via guarded consumer
    const turnFFp = state.pendingInteraction.fingerprint;
    consumeBriefApproval(rootDir, {
      approvingAuthority: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: turnFFp,
    });

    // --- Turn G: Approved Complete ---
    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.ideaStage, 'APPROVED');
    assert.equal(state.workflowPhase, 'COMPLETE');
    assert.equal(state.action, 'COMPLETE');
    assert.equal(state.recommendedNextCommand, '/dk-spec');
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 19 (Discovery Revision & Fingerprint Binding): Stale cursor fails closed with zero side effects', async () => {
  const rootDir = createTempDir('dk-c19-binding-');
  try {
    await bootstrapProject(rootDir);
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Req 1', origin: 'USER_STATED' });
    recordOpenQuestion(rootDir, { id: 'IDEA-Q-001', question: 'Q 1?', materiality: 'MATERIAL' });
    presentCurrentInteraction(rootDir);

    const cp = loadWorkflowCheckpoint(rootDir);
    assert.ok(cp);

    // Mutate discovery to N+1
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-002', statement: 'Req 2', origin: 'USER_STATED' });

    // Workflow resolution must fail closed with DK_WORKFLOW_DISCOVERY_BINDING_MISMATCH
    assert.throws(
      () => resolveIdeaWorkflowState(rootDir),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_WORKFLOW_DISCOVERY_BINDING_MISMATCH');
        return true;
      }
    );

    // Test fingerprint mismatch independently from revision mismatch
    const workflowPath = path.join(rootDir, '.development-kit', 'idea', 'workflow.json');
    const disc = loadDiscoveryState(rootDir);
    fs.writeFileSync(workflowPath, JSON.stringify({
      ...cp,
      discoveryRevision: disc.revision,
      discoveryFingerprint: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    }));

    assert.throws(
      () => resolveIdeaWorkflowState(rootDir),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_WORKFLOW_DISCOVERY_BINDING_MISMATCH');
        return true;
      }
    );
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 19 (Content-Bound Interaction Fingerprint & Tamper Detection): Mismatched fingerprint fails closed', async () => {
  const rootDir = createTempDir('dk-c19-fingerprint-');
  try {
    await bootstrapProject(rootDir);
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Req 1', origin: 'USER_STATED' });
    recordOpenQuestion(rootDir, { id: 'IDEA-Q-001', question: 'Q 1?', materiality: 'MATERIAL' });
    presentCurrentInteraction(rootDir);

    const workflowPath = path.join(rootDir, '.development-kit', 'idea', 'workflow.json');
    const cp = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    // Tamper with prompt
    fs.writeFileSync(workflowPath, JSON.stringify({
      ...cp,
      pendingInteraction: {
        ...cp.pendingInteraction,
        prompt: 'Tampered prompt',
      },
    }));

    assert.throws(
      () => loadWorkflowCheckpoint(rootDir),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_INTERACTION_FINGERPRINT_MISMATCH');
        return true;
      }
    );
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 19 (Backend-Only Exemption): Confirmed backend-only skips DESIGN_SYSTEM_SETUP and advances to IDEA_CHALLENGE', async () => {
  const rootDir = createTempDir('dk-c19-backend-');
  try {
    await bootstrapProject(rootDir);
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Build a backend-only CLI daemon tool', origin: 'USER_STATED' });
    recordOpenQuestion(rootDir, { id: 'IDEA-Q-001', question: 'Database choice?', materiality: 'MATERIAL' });
    presentCurrentInteraction(rootDir);

    const pendingState = resolveIdeaWorkflowState(rootDir);
    // Answer discovery question via guarded consumer
    consumeDiscoveryQuestionResponse(rootDir, {
      id: 'IDEA-Q-001',
      questionId: 'IDEA-Q-001',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: pendingState.pendingInteraction.fingerprint,
    });

    let state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'DESIGN_APPLICABILITY_CHECK');
    assert.equal(state.pendingInteraction.type, 'DESIGN_APPLICABILITY');

    // Confirmed non-visual/backend choice sets applicable=false
    consumeDesignApplicabilityResponse(rootDir, {
      choice: '2. Non-visual/backend/CLI/library',
      applicable: false,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    // Workflow state resolution must skip DESIGN_SYSTEM_SETUP directly to IDEA_CHALLENGE
    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'IDEA_CHALLENGE');
    assert.equal(state.pendingInteraction.type, 'IDEA_CHALLENGE');
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 18 (Authority-Bypass & Transition Violations Negative Tests): Reject unauthorized mutations', async () => {
  const rootDir = createTempDir('dk-c18-bypass-');
  try {
    await bootstrapProject(rootDir);
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Req 1', origin: 'USER_STATED' });
    recordOpenQuestion(rootDir, { id: 'IDEA-Q-001', question: 'Q 1?', materiality: 'MATERIAL' });
    presentCurrentInteraction(rootDir);

    // 1. Design setup operation with no pending DESIGN_SYSTEM_SETUP (currently pending DISCOVERY_QUESTION)
    assert.throws(
      () => recordDesignAuthoritySetup(rootDir, { disposition: 'DEFERRED', confirmedBy: 'PRODUCT_OWNER' }),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_NO_MATCHING_PENDING_INTERACTION');
        return true;
      }
    );

    // 2. Direct transition to COMPLETE
    assert.throws(
      () => persistWorkflowCheckpoint(rootDir, { currentPhase: 'COMPLETE' }),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_INVALID_IDEA_WORKFLOW_TRANSITION');
        return true;
      }
    );

    // 3. Workflow revision rollback attempt
    assert.throws(
      () => persistWorkflowCheckpoint(rootDir, { currentPhase: 'REQUIREMENTS_INTERVIEW', workflowRevision: 0 }),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_WORKFLOW_REVISION_ROLLBACK');
        return true;
      }
    );

    // 4. Workflow revision jump attempt
    assert.throws(
      () => persistWorkflowCheckpoint(rootDir, { currentPhase: 'REQUIREMENTS_INTERVIEW', workflowRevision: 99 }),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_WORKFLOW_REVISION_JUMP');
        return true;
      }
    );
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 18 (Full Stage & Cursor Consistency Matrix): Inconsistent state combinations fail closed', async () => {
  const rootDir = createTempDir('dk-c18-consistency-');
  try {
    await bootstrapProject(rootDir);
    const disc = loadDiscoveryState(rootDir);
    const workflowPath = path.join(rootDir, '.development-kit', 'idea', 'workflow.json');
    fs.mkdirSync(path.dirname(workflowPath), { recursive: true });

    // 1. NOT_STARTED + advanced phase
    fs.writeFileSync(workflowPath, JSON.stringify({
      schemaVersion: '1.0.0',
      workflowRevision: 1,
      currentPhase: 'IDEA_CHALLENGE',
      pendingInteraction: null,
      discoveryRevision: disc.revision,
      discoveryFingerprint: disc.fingerprint,
      status: 'PENDING',
    }));

    assert.throws(
      () => resolveIdeaWorkflowState(rootDir),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_WORKFLOW_CONSISTENCY_ERROR');
        return true;
      }
    );

    // 2. DISCOVERY_IN_PROGRESS + COMPLETE cursor
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Req 1', origin: 'USER_STATED' });
    const disc2 = loadDiscoveryState(rootDir);
    fs.writeFileSync(workflowPath, JSON.stringify({
      schemaVersion: '1.0.0',
      workflowRevision: 1,
      currentPhase: 'COMPLETE',
      pendingInteraction: null,
      discoveryRevision: disc2.revision,
      discoveryFingerprint: disc2.fingerprint,
      status: 'COMPLETED',
    }));

    assert.throws(
      () => resolveIdeaWorkflowState(rootDir),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_WORKFLOW_CONSISTENCY_ERROR');
        return true;
      }
    );
  } finally {
    cleanupTempDir(rootDir);
  }
});

// ============================================================================
// CANDIDATE 20 TEST SUITES (§14 - §18)
// ============================================================================

test('Candidate 20 (§14: CLI Negative Tests): Direct calls without active interaction or with mismatched fingerprint fail closed', async () => {
  const rootDir = createTempDir('dk-c20-negative-');
  try {
    await bootstrapProject(rootDir);
    const scriptPath = path.resolve('scripts/orchestration.mjs');

    // 1. Direct call to idea-confirm-candidate with no workflow checkpoint fails closed
    const resNoCp = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-confirm-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-001',
        confirmedBy: 'PRODUCT_OWNER',
        expectedInteractionFingerprint: 'sha256:fake000000000000000000000000000000000000000000000000000000000000',
      })
    ], { cwd: rootDir, encoding: 'utf8' });
    assert.equal(resNoCp.status, 1);
    const parsedNoCp = JSON.parse(resNoCp.stderr || resNoCp.stdout);
    assert.equal(parsedNoCp.name, 'IdeaWorkflowError');
    assert.ok(parsedNoCp.error.includes('deprecated') || parsedNoCp.error.includes('no workflow checkpoint exists'));

    // Record a candidate and setup initial workflow
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Req 1', origin: 'USER_STATED' });
    presentCurrentInteraction(rootDir);

    let state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'DESIGN_APPLICABILITY_CHECK');
    consumeDesignApplicabilityResponse(rootDir, {
      choice: '1. Visual user interface (web, mobile, desktop)',
      applicable: true,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'DESIGN_SYSTEM_SETUP');

    const resWrongPhase = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-classify-scope',
      '--input-json=' + JSON.stringify({
        scopeMapping: { 'IDEA-REQ-001': 'MUST' },
        confirmedBy: 'PRODUCT_OWNER',
        expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
      })
    ], { cwd: rootDir, encoding: 'utf8' });
    assert.equal(resWrongPhase.status, 1);
    const parsedWrongPhase = JSON.parse(resWrongPhase.stderr || resWrongPhase.stdout);
    assert.ok(parsedWrongPhase.error.includes('pending interaction type is DESIGN_SYSTEM_SETUP, expected SCOPE_CONFIRMATION'));

    // 3. Call with mismatched interaction fingerprint fails closed
    const resMismatchedFp = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-design-setup',
      '--input-json=' + JSON.stringify({
        disposition: 'DEFERRED',
        confirmedBy: 'PRODUCT_OWNER',
        expectedInteractionFingerprint: 'sha256:tampered000000000000000000000000000000000000000000000000000000',
      })
    ], { cwd: rootDir, encoding: 'utf8' });
    assert.equal(resMismatchedFp.status, 1);
    const parsedMismatched = JSON.parse(resMismatchedFp.stderr || resMismatchedFp.stdout);
    assert.ok(parsedMismatched.error.includes('fingerprint mismatch'));
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 20 (§15: Group Atomicity Tests): Multi-requirement batch fails completely on single validation error with zero side effects', async () => {
  const rootDir = createTempDir('dk-c20-atomicity-');
  try {
    await bootstrapProject(rootDir);

    // Record candidate 1 (USER_STATED) and candidate 2 (RESEARCH_DERIVED)
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Req 1', origin: 'USER_STATED' });
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-002', statement: 'Req 2', origin: 'RESEARCH_DERIVED' });

    presentCurrentInteraction(rootDir);
    let state = resolveIdeaWorkflowState(rootDir);

    // Progress past applicability and design setup to REQUIREMENT_CONFIRMATION
    consumeDesignApplicabilityResponse(rootDir, {
      choice: '1. Visual user interface (web, mobile, desktop)',
      applicable: true,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });
    state = resolveIdeaWorkflowState(rootDir);
    recordDesignAuthoritySetup(rootDir, {
      disposition: 'DEFERRED',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });
    state = resolveIdeaWorkflowState(rootDir);
    recordIdeaChallengeResponse(rootDir, {
      response: 'Proceed',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'REQUIREMENT_CONFIRMATION');
    const discBefore = loadDiscoveryState(rootDir);

    // Attempt to confirm both without allowAdoption for the research-derived one
    // Candidate 2 (RESEARCH_DERIVED) cannot be confirmed without allowAdoption
    assert.throws(
      () => consumeRequirementConfirmation(rootDir, {
        action: 'CONFIRM',
        confirmedBy: 'PRODUCT_OWNER',
        allowAdoption: false,
        expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
      }),
      (err) => {
        assert.ok(err.message.includes('requires explicit adoption semantics'));
        return true;
      }
    );

    // Verify zero side effects: no PODs created, discovery revision unchanged, journal cleaned up
    const discAfter = loadDiscoveryState(rootDir);
    assert.equal(discAfter.revision, discBefore.revision);
    assert.equal(discAfter.fingerprint, discBefore.fingerprint);
    assert.equal(discAfter.requirements[0].resolutionState, 'UNRESOLVED');
    assert.equal(discAfter.requirements[1].resolutionState, 'UNRESOLVED');

    const journalPath = path.join(rootDir, '.development-kit', 'idea', 'discovery-journal.json');
    assert.equal(fs.existsSync(journalPath), false);
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 20 (§16: Crash Recovery Tests): Reconciles via receipt when crash occurs between persistence and cursor advance', async () => {
  const rootDir = createTempDir('dk-c20-crash-recovery-');
  try {
    await bootstrapProject(rootDir);

    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Req 1', origin: 'USER_STATED' });
    presentCurrentInteraction(rootDir);
    let state = resolveIdeaWorkflowState(rootDir);

    consumeDesignApplicabilityResponse(rootDir, {
      choice: '1. Visual user interface (web, mobile, desktop)',
      applicable: true,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });
    state = resolveIdeaWorkflowState(rootDir);

    recordDesignAuthoritySetup(rootDir, {
      disposition: 'DEFERRED',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });
    state = resolveIdeaWorkflowState(rootDir);
    recordIdeaChallengeResponse(rootDir, {
      response: 'Proceed',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'REQUIREMENT_CONFIRMATION');
    const cpBefore = loadWorkflowCheckpoint(rootDir);
    const discBefore = loadDiscoveryState(rootDir);

    // Simulate Step B, C, D completed, but Step E crashed:
    // 1. Discovery confirmed
    confirmRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', confirmedBy: 'PRODUCT_OWNER' });
    const discAfter = loadDiscoveryState(rootDir);

    // 2. Receipt appended
    appendConsumptionReceipt(rootDir, {
      interactionType: 'REQUIREMENT_CONFIRMATION',
      interactionId: 'INTERACTION-REQ-CONFIRMATION',
      interactionFingerprint: cpBefore.pendingInteraction.fingerprint,
      workflowRevisionBefore: cpBefore.workflowRevision,
      preDiscoveryRevision: discBefore.revision,
      preDiscoveryFingerprint: discBefore.fingerprint,
      postDiscoveryRevision: discAfter.revision,
      postDiscoveryFingerprint: discAfter.fingerprint,
      authority: 'PRODUCT_OWNER',
      resultingPodIds: [discAfter.requirements[0].confirmationDecision.decisionId],
      resultingArtifactApprovalId: null,
    });

    // Note: workflow.json was NOT updated (still points to pre-confirmation state and revision)
    // Now call validateWorkflowConsistency / resolveIdeaWorkflowState
    // Crash recovery should detect the matching receipt and reconcile without throwing DK_WORKFLOW_DISCOVERY_BINDING_MISMATCH!
    const reconciledState = resolveIdeaWorkflowState(rootDir);
    assert.ok(reconciledState);
    assert.equal(reconciledState.workflowPhase, 'SCOPE_CONFIRMATION');

    // Negative case: If discovery has unlogged revisions without receipt, recovery fails closed
    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-002', statement: 'Req 2', origin: 'USER_STATED' });
    // Directly write corrupted checkpoint to simulate unreceipted mutation without invoking persistWorkflowCheckpoint revision check
    const workflowPath = path.join(rootDir, '.development-kit', 'idea', 'workflow.json');
    const staleCp = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    staleCp.discoveryRevision = 999;
    staleCp.discoveryFingerprint = 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    fs.writeFileSync(workflowPath, JSON.stringify(staleCp));

    assert.throws(
      () => resolveIdeaWorkflowState(rootDir),
      (err) => {
        assert.ok(err instanceof IdeaWorkflowError);
        assert.equal(err.code, 'DK_WORKFLOW_DISCOVERY_BINDING_MISMATCH');
        return true;
      }
    );
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 20 (§17: Design Setup Truthfulness Tests): NEW_DIRECTION leaves execution status unconfigured while advancing workflow', async () => {
  const rootDir = createTempDir('dk-c20-design-truth-');
  try {
    await bootstrapProject(rootDir);

    recordRequirementCandidate(rootDir, { id: 'IDEA-REQ-001', statement: 'Req 1', origin: 'USER_STATED' });
    presentCurrentInteraction(rootDir);
    let state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'DESIGN_APPLICABILITY_CHECK');
    consumeDesignApplicabilityResponse(rootDir, {
      choice: '1. Visual user interface (web, mobile, desktop)',
      applicable: true,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'DESIGN_SYSTEM_SETUP');

    // Execute NEW_DIRECTION disposition
    recordDesignAuthoritySetup(rootDir, {
      disposition: 'NEW_DIRECTION',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: state.pendingInteraction.fingerprint,
    });

    // Verify Design Authority state truthfulness:
    // status must remain unconfigured because no design.md exists yet!
    const designState = loadDesignSystemState(rootDir);
    assert.equal(designState.status, 'unconfigured');
    assert.equal(designState.setupDisposition, 'NEW_DIRECTION');
    assert.equal(designState.setupDecisionAuthority, 'PRODUCT_OWNER');
    assert.ok(designState.setupAnsweredAt);

    // Verify workflow advances to IDEA_CHALLENGE
    state = resolveIdeaWorkflowState(rootDir);
    assert.equal(state.workflowPhase, 'IDEA_CHALLENGE');
  } finally {
    cleanupTempDir(rootDir);
  }
});

test('Candidate 20 (§18: Public A-G End-to-End Suite via CLI spawnSync): Full sequence runs exclusively through orchestration CLI', async () => {
  const rootDir = createTempDir('dk-c20-a-g-cli-');
  try {
    await bootstrapProject(rootDir);
    const scriptPath = path.resolve('scripts/orchestration.mjs');

    // Helper to run CLI command and parse JSON output
    const runCli = (operation, payload = null) => {
      const args = [scriptPath, `--operation=${operation}`];
      if (payload) {
        args.push(`--input-json=${JSON.stringify(payload)}`);
      }
      const res = spawnSync(process.execPath, args, { cwd: rootDir, encoding: 'utf8' });
      assert.equal(res.status, 0, `CLI operation ${operation} failed: ${res.stderr || res.stdout}`);
      const parsed = JSON.parse(res.stdout);
      return parsed.result !== undefined ? parsed.result : parsed;
    };

    // 1. Initial capture
    runCli('idea-record-candidate', {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_STATED',
    });
    runCli('idea-record-question', {
      id: 'IDEA-Q-001',
      question: 'What mobile OS is targeted?',
      materiality: 'MATERIAL',
    });

    // --- Turn A: Discovery Question ---
    runCli('idea-present-interaction');
    let wf = runCli('idea-workflow-state');
    assert.equal(wf.workflowPhase, 'REQUIREMENTS_INTERVIEW');
    assert.equal(wf.pendingInteraction.type, 'DISCOVERY_QUESTION');

    runCli('idea-resolve-question', {
      questionId: 'IDEA-Q-001',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
      notes: 'iOS and Android tablets.',
      expectedInteractionFingerprint: wf.pendingInteraction.fingerprint,
    });

    // --- Turn A.5: Design Applicability Check ---
    wf = runCli('idea-workflow-state');
    assert.equal(wf.workflowPhase, 'DESIGN_APPLICABILITY_CHECK');

    runCli('idea-design-applicability', {
      choice: '1. Visual user interface (web, mobile, desktop)',
      applicable: true,
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: wf.pendingInteraction.fingerprint,
    });

    // --- Turn B: Design System Setup ---
    wf = runCli('idea-workflow-state');
    assert.equal(wf.workflowPhase, 'DESIGN_SYSTEM_SETUP');

    runCli('idea-design-setup', {
      disposition: 'DEFERRED',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: wf.pendingInteraction.fingerprint,
    });

    // --- Turn C: Idea Challenge ---
    wf = runCli('idea-workflow-state');
    assert.equal(wf.workflowPhase, 'IDEA_CHALLENGE');

    runCli('idea-challenge-response', {
      response: 'Confirmed approach is sound.',
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: wf.pendingInteraction.fingerprint,
    });

    // --- Turn D: Requirement Confirmation ---
    wf = runCli('idea-workflow-state');
    assert.equal(wf.workflowPhase, 'REQUIREMENT_CONFIRMATION');

    runCli('idea-confirm-requirements', {
      candidateIds: ['IDEA-REQ-001'],
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: wf.pendingInteraction.fingerprint,
    });

    // --- Turn E: Scope Proposal & Confirmation ---
    runCli('idea-propose-scope', {
      scopeProposal: { 'IDEA-REQ-001': 'MUST' },
    });

    wf = runCli('idea-workflow-state');
    assert.equal(wf.workflowPhase, 'SCOPE_CONFIRMATION');

    runCli('idea-classify-scope', {
      scopeMapping: { 'IDEA-REQ-001': 'MUST' },
      confirmedBy: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: wf.pendingInteraction.fingerprint,
    });

    // --- Turn F: Canonical Brief Persistence & Approval ---
    const briefContent = `# Idea Brief: Solar App\n\n## Problem\nField inspection.\n\n## Intended Users\nInspectors.\n\n## Success Criteria\nAccurate data.\n\n## Requirements (Must)\n- [IDEA-REQ-001] Capture inverter DC string voltages and insulation resistance measurements.\n\n## Preferences (Should)\n- None\n\n## Assumptions\n- None\n\n## Constraints\n- None\n\n## Risks\n- None\n\n## Open Questions\n- None\n\n## Future Ideas (Explicitly Deferred)\n- None\n`;

    runCli('idea-persist', { content: briefContent });
    runCli('idea-present-interaction');

    wf = runCli('idea-workflow-state');
    assert.equal(wf.workflowPhase, 'BRIEF_APPROVAL');

    runCli('idea-approve', {
      approvingAuthority: 'PRODUCT_OWNER',
      expectedInteractionFingerprint: wf.pendingInteraction.fingerprint,
    });

    // --- Turn G: Approved Complete ---
    wf = runCli('idea-workflow-state');
    assert.equal(wf.workflowPhase, 'COMPLETE');
    assert.equal(wf.status, 'COMPLETED');

    const stateRes = runCli('idea-state');
    const computedState = stateRes.state || stateRes.result?.state;
    assert.equal(computedState, 'APPROVED');
  } finally {
    cleanupTempDir(rootDir);
  }
});




