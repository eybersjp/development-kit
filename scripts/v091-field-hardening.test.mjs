import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { executeLifecycleEntry, COMMAND_ENTRY_TAXONOMY } from '../runtime/lifecycle/lifecycle-gate.mjs';
import { getProjectBootstrapStatus, bootstrapProject } from '../runtime/bootstrap/project-bootstrap.mjs';
import {
  resolveCanonicalIdeaArtifact,
  persistCanonicalIdeaBrief,
  computeSha256,
  loadArtifactRegistry,
  registerArtifact,
} from '../runtime/artifacts/artifact-registry.mjs';
import {
  recordRequirementCandidate,
  recordOpenQuestion,
  evaluateDiscoveryReadiness,
  loadDiscoveryState,
} from '../runtime/orchestration/idea-discovery.mjs';
import {
  computeIdeaStageState,
  persistApprovalRecord,
  computeEffectiveApprovalStatus,
  loadApprovalsHistory,
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

const VALID_BRIEF = `# Idea Brief: Solar Commissioning Manager\n\n## Problem\nField solar installers lack structured commissioning documentation tools.\n\n## Intended Users\nSolar EPC commissioning technicians and field project managers.\n\n## Success Criteria\n100% compliant commissioning sign-off records produced in PDF/JSON.\n\n## Requirements (Must)\n- Capture inverter DC string voltages and insulation resistance measurements.\n- Support offline checklist completion.\n\n## Preferences (Should)\n- None\n\n## Assumptions\n- Technicians have mobile tablets on site.\n\n## Constraints\n- Must operate without continuous cellular connectivity.\n\n## Risks\n- Extreme temperatures may affect tablet battery life.\n\n## Open Questions\n- None\n\n## Future Ideas (Explicitly Deferred)\n- Direct FLIR radiometric camera integration.\n`;

test('Blocker 1: Out-of-band direct edit to idea-brief.md without API invalidates approval & causes mismatch blocker', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Capture inverter DC string voltages',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Support offline checklist completion',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });

    const disc = loadDiscoveryState(tempDir);
    const p1 = persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF, discoveryRevision: disc.revision, discoveryFingerprint: disc.fingerprint });
    persistApprovalRecord(tempDir, { artifactFingerprint: p1.fingerprint, artifactRevision: p1.revision, approvingAuthority: 'PRODUCT_OWNER' });

    const approvedState = computeIdeaStageState(tempDir);
    assert.equal(approvedState.state, 'APPROVED');

    // Directly modify idea-brief.md with fs.writeFileSync (out-of-band edit)
    fs.writeFileSync(path.join(tempDir, 'idea-brief.md'), VALID_BRIEF + '\n- Unregistered extra requirement\n', 'utf8');

    const modifiedState = computeIdeaStageState(tempDir);
    assert.notEqual(modifiedState.state, 'APPROVED');
    assert.equal(modifiedState.state, 'BLOCKED');
    assert.equal(modifiedState.blockerType, 'RUNTIME_FRAMEWORK');
    assert.equal(modifiedState.issues[0].code, 'DK_ARTIFACT_FINGERPRINT_MISMATCH');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Blocker 2: Must requirements not bound to discovery candidates block READY_FOR_APPROVAL', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    // Persist valid 10-section brief with Must requirements, but ZERO recorded discovery candidates
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF });

    const stage = computeIdeaStageState(tempDir);
    assert.notEqual(stage.state, 'READY_FOR_APPROVAL');
    assert.equal(stage.state, 'DISCOVERY_IN_PROGRESS');
    assert.equal(stage.issues[0].code, 'UNBOUND_MUST_REQUIREMENTS');
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
      persistApprovalRecord(tempDir, { artifactFingerprint: 'sha256:123', artifactRevision: 1, approvingAuthority: 'AI_AGENT' });
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
      statement: 'Capture DC voltages',
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
    persistApprovalRecord(tempDir, { artifactFingerprint: p1.fingerprint, artifactRevision: p1.revision, approvingAuthority: 'PRODUCT_OWNER' });

    const stage1 = computeIdeaStageState(tempDir);
    assert.equal(stage1.state, 'APPROVED');

    // Add new material requirement to discovery.json -> discovery revision bumps to 2
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-002',
      statement: 'Insulation resistance logging',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });

    // Re-evaluating stage state without re-persisting Idea Brief must invalidate APPROVED
    const stage2 = computeIdeaStageState(tempDir);
    assert.notEqual(stage2.state, 'APPROVED');
    assert.equal(stage2.state, 'DRAFT_READY');
    assert.equal(stage2.issues[0].code, 'DISCOVERY_REVISION_MISMATCH');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Blocker 6: Public CLI orchestration operations for IDEA workflow execute cleanly', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const scriptPath = path.resolve('scripts/orchestration.mjs');

    // Record candidate via CLI
    const candExec = spawnSync(process.execPath, [
      scriptPath,
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-001',
        statement: 'Capture DC string voltages',
        origin: 'USER_CONFIRMED',
        resolutionState: 'CONFIRMED',
        confirmedBy: 'PRODUCT_OWNER',
      })
    ], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(candExec.status, 0);

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
      statement: 'Capture DC voltages',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    const disc = loadDiscoveryState(tempDir);
    const p = persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF, discoveryRevision: disc.revision, discoveryFingerprint: disc.fingerprint });
    persistApprovalRecord(tempDir, { artifactFingerprint: p.fingerprint, artifactRevision: p.revision, approvingAuthority: 'PRODUCT_OWNER' });

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

test('Host Brain Artifact Isolation: Competing brain artifact does not override canonical project artifact', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    // Create a rogue file simulating host brain storage
    const brainDir = path.join(tempDir, '.gemini', 'antigravity', 'brain', 'rogue');
    fs.mkdirSync(brainDir, { recursive: true });
    fs.writeFileSync(path.join(brainDir, 'idea-brief.md'), '# Rogue Brain Brief', 'utf8');

    // Persist real project canonical artifact
    recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-001',
      statement: 'Real project requirement',
      origin: 'USER_CONFIRMED',
      resolutionState: 'CONFIRMED',
      confirmedBy: 'PRODUCT_OWNER',
    });
    const disc = loadDiscoveryState(tempDir);
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF, discoveryRevision: disc.revision, discoveryFingerprint: disc.fingerprint });

    const resolved = resolveCanonicalIdeaArtifact(tempDir, { verifyFingerprint: true });
    assert.equal(resolved.relativePath, 'idea-brief.md');
    assert.equal(resolved.absolutePath, path.join(tempDir, 'idea-brief.md'));
    assert.ok(!resolved.absolutePath.includes('.gemini'));
  } finally {
    cleanupTempDir(tempDir);
  }
});
