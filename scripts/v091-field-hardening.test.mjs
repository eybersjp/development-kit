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
  resolveCanonicalIdeaArtifact,
  persistCanonicalIdeaBrief,
  reconcileCanonicalIdeaBrief,
  computeSha256,
  loadArtifactRegistry,
  persistArtifactRegistry,
  registerArtifact,
} from '../runtime/artifacts/artifact-registry.mjs';
import {
  recordRequirementCandidate,
  supersedeRequirementCandidate,
  recordOpenQuestion,
  supersedeOpenQuestion,
  evaluateDiscoveryReadiness,
  loadDiscoveryState,
  persistDiscoveryState,
} from '../runtime/orchestration/idea-discovery.mjs';
import {
  computeIdeaStageState,
  persistApprovalRecord,
  computeEffectiveApprovalStatus,
  loadApprovalsHistory,
  approveCurrentIdeaBrief,
} from '../runtime/orchestration/idea-state.mjs';
import { NextStepResolver } from '../runtime/next-step/resolver.mjs';
import { validateIdeaBriefStructure } from '../runtime/orchestration/idea-schema.mjs';

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

    // Parse command arguments
    const parts = literalCmd.split(/\s+/);
    assert.equal(parts[0], 'node');
    const scriptRelative = parts[1];
    const scriptArgs = parts.slice(2);

    // Execute literal command exactly as installed command Markdown specifies from consumer project root
    const execRes = spawnSync(process.execPath, [
      path.join(consumerDir, scriptRelative),
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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
      origin: 'USER_CONFIRMED',
      resolutionState: 'REJECTED',
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
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'What tablet OS versions must be supported?',
      materiality: 'MATERIAL',
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

    // RESEARCH_DERIVED + ADOPTED without explicit confirmedBy = PRODUCT_OWNER throws
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Sample',
        origin: 'RESEARCH_DERIVED',
        resolutionState: 'ADOPTED',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_ADOPTION');

    // AI_PROPOSED + CONFIRMED without explicit confirmedBy = PRODUCT_OWNER throws
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Sample',
        origin: 'AI_PROPOSED',
        resolutionState: 'CONFIRMED',
      });
    }, (err) => err.code === 'DK_UNAUTHORIZED_CONFIRMATION');

    // Invalid question resolution throws
    assert.throws(() => {
      recordOpenQuestion(tempDir, { id: 'IDEA-Q-001', question: 'Q?', resolution: 'INVALID_RESOLUTION' });
    }, (err) => err.code === 'DK_INVALID_QUESTION_RESOLUTION');

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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Third requirement',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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

    // Record candidate 1 via CLI
    const candExec1 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-001',
        statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
        origin: 'USER_CONFIRMED',
        resolutionState: 'CONFIRMED',
        confirmedBy: 'PRODUCT_OWNER',
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(candExec1.status, 0);

    // Record candidate 2 via CLI
    const candExec2 = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-002',
        statement: 'Support offline checklist completion.',
        origin: 'USER_CONFIRMED',
        resolutionState: 'CONFIRMED',
        confirmedBy: 'PRODUCT_OWNER',
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(candExec2.status, 0);

    // Persist Idea Brief via CLI
    const persistExec = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-persist',
      '--input-json=' + JSON.stringify({ content: VALID_BRIEF })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(persistExec.status, 0);

    // Approve Idea Brief via CLI
    const approveExec = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-approve',
      '--input-json=' + JSON.stringify({ approvingAuthority: 'PRODUCT_OWNER' })
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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

    // Attempting to overwrite origin with USER_CONFIRMED throws DK_PROVENANCE_IMMUTABLE
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Original statement',
        origin: 'USER_CONFIRMED',
        resolutionState: 'CONFIRMED',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_PROVENANCE_IMMUTABLE');

    // Valid adoption retains original RESEARCH_DERIVED origin
    const adopted = recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Original statement',
      origin: 'RESEARCH_DERIVED',
      resolutionState: 'ADOPTED',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Original statement text',
      materiality: 'MATERIAL',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });

    // Attempting to mutate statement text under same ID fails
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Mutated statement text',
        materiality: 'MATERIAL',
        origin: 'USER_CONFIRMED',
        resolutionState: 'CONFIRMED',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_STATEMENT_IMMUTABLE');

    // Attempting to mutate materiality under same ID fails
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Original statement text',
        materiality: 'NON_MATERIAL',
        origin: 'USER_CONFIRMED',
        resolutionState: 'CONFIRMED',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_MATERIALITY_IMMUTABLE');

    // Explicit supersession succeeds
    const superRes = supersedeRequirementCandidate(tempDir, 'IDEA-REQ-001', {
      id: 'IDEA-REQ-002',
      statement: 'Refined statement text',
      materiality: 'MATERIAL',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Non-material operational query?',
      materiality: 'NON_MATERIAL',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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
    recordOpenQuestion(tempDir, {
      id: 'IDEA-Q-001',
      question: 'Non-material query?',
      materiality: 'NON_MATERIAL',
      resolution: 'ANSWERED',
      resolvedBy: 'PRODUCT_OWNER',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Statement 1',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
    });

    // Supersede 001 -> 002
    supersedeRequirementCandidate(tempDir, 'IDEA-REQ-001', {
      id: 'IDEA-REQ-002',
      statement: 'Statement 2',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
    });

    // Attempting to transition 001 from SUPERSEDED -> CONFIRMED fails
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-001',
        statement: 'Statement 1',
        origin: 'USER_CONFIRMED',
        resolutionState: 'CONFIRMED',
        confirmedBy: 'PRODUCT_OWNER',
      });
    }, (err) => err.code === 'DK_ILLEGAL_STATE_TRANSITION');

    // Create a candidate and reject it
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Statement 3',
      origin: 'USER_CONFIRMED',
      resolutionState: 'REJECTED',
      confirmedBy: 'PRODUCT_OWNER',
    });

    // Attempting to transition 003 from REJECTED -> CONFIRMED fails
    assert.throws(() => {
      recordRequirementCandidate(tempDir, {
        id: 'IDEA-REQ-003',
        statement: 'Statement 3',
        origin: 'USER_CONFIRMED',
        resolutionState: 'CONFIRMED',
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
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Statement 1',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
    });

    supersedeRequirementCandidate(tempDir, 'IDEA-REQ-001', {
      id: 'IDEA-REQ-002',
      statement: 'Statement 2',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
    });

    const disc = loadDiscoveryState(tempDir);
    // Break reciprocal pointer: change supersededBy to point to nonexistent REQ-999
    disc.requirements[0].supersededBy = 'IDEA-REQ-999';

    assert.throws(() => {
      persistDiscoveryState(disc, tempDir);
    }, (err) => err.code === 'DK_LINEAGE_ERROR');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Candidate 7: Bidirectional Must ↔ Discovery requirement coverage', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages and insulation resistance measurements.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
      scopeDisposition: 'MUST',
    });
    // Record third active MUST candidate in discovery
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Continuous cellular health ping.',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
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

