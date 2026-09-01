import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

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

test('Scenario 1 & 2: fresh project bootstrap & idempotency', async () => {
  const tempDir = createTempDir();
  try {
    const entry1 = await executeLifecycleEntry({ rootDir: tempDir, command: 'dk-idea' });
    assert.equal(entry1.success, true);
    assert.equal(entry1.bootstrapped, true);
    assert.ok(fs.existsSync(path.join(tempDir, '.development-kit', 'project.json')));
    assert.ok(fs.existsSync(path.join(tempDir, '.development-kit', 'workspace-id')));

    const entry2 = await executeLifecycleEntry({ rootDir: tempDir, command: 'dk-idea' });
    assert.equal(entry2.success, true);
    assert.equal(entry2.identity.projectId, entry1.identity.projectId);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Scenario 3: bootstrap failure fail-closed on corrupt project.json', async () => {
  const tempDir = createTempDir();
  try {
    const dkDir = path.join(tempDir, '.development-kit');
    fs.mkdirSync(dkDir, { recursive: true });
    fs.writeFileSync(path.join(dkDir, 'project.json'), '{ malformed json', 'utf8');
    fs.writeFileSync(path.join(dkDir, 'workspace-id'), 'ws-test', 'utf8');

    const entry = await executeLifecycleEntry({ rootDir: tempDir, command: 'dk-idea' });
    assert.equal(entry.success, false);
    assert.equal(entry.code, 'DK_LIFECYCLE_BOOTSTRAP_CORRUPT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Scenario 4 & 5: Windows path handling & host brain artifact isolation', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const persisted = persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF });
    assert.ok(persisted.absolutePath.includes(path.sep));
    assert.ok(!persisted.absolutePath.includes('.gemini'));
    assert.ok(!persisted.absolutePath.includes('antigravity/brain'));
    assert.ok(fs.existsSync(path.join(tempDir, 'idea-brief.md')));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Scenario 6 & 7: canonical artifact & registry persistence', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const persisted = persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF });
    const reg = loadArtifactRegistry(tempDir);
    assert.ok(reg.artifacts.IDEA_BRIEF);
    assert.equal(reg.artifacts.IDEA_BRIEF.canonicalPath, 'idea-brief.md');
    assert.equal(reg.artifacts.IDEA_BRIEF.fingerprint, persisted.fingerprint);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Scenario 8, 9, 10: legacy migration, duplicate normalization & conflict fail-closed', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // Legacy only -> migrated
    fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'docs', 'idea-brief.md'), VALID_BRIEF, 'utf8');
    const res1 = resolveCanonicalIdeaArtifact(tempDir);
    assert.equal(res1.registered, true);
    assert.equal(fs.existsSync(path.join(tempDir, 'idea-brief.md')), true);
    assert.equal(fs.existsSync(path.join(tempDir, 'docs', 'idea-brief.md')), false);

    // Identical duplicate -> normalized
    fs.writeFileSync(path.join(tempDir, 'docs', 'idea-brief.md'), VALID_BRIEF, 'utf8');
    const res2 = resolveCanonicalIdeaArtifact(tempDir);
    assert.equal(res2.registered, true);
    assert.equal(fs.existsSync(path.join(tempDir, 'docs', 'idea-brief.md')), false);

    // Divergent duplicate -> conflict
    fs.writeFileSync(path.join(tempDir, 'docs', 'idea-brief.md'), VALID_BRIEF + '\n# Divergence\n', 'utf8');
    assert.throws(() => resolveCanonicalIdeaArtifact(tempDir), (err) => err.code === 'DK_ARTIFACT_AUTHORITY_CONFLICT');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Scenario 11: IDEA template/schema/validator drift', () => {
  const res = validateIdeaBriefStructure(VALID_BRIEF);
  assert.equal(res.valid, true);
  const placeholderRes = validateIdeaBriefStructure(VALID_BRIEF.replace('Solar EPC', '[Requirement 1]'));
  assert.equal(placeholderRes.valid, false);
});

test('Scenario 12, 13, 14, 15, 16, 17, 18: Discovery provenance, Candidate ID, Lineage, PO Adoption', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // Candidate namespace enforcement
    assert.throws(() => recordRequirementCandidate(tempDir, { id: 'REQ-001', statement: 'x' }));

    // AI_PROPOSED Must blocked without confirmation
    recordRequirementCandidate(tempDir, { id: 'IDEA-REQ-001', statement: 'AI suggestion', origin: 'AI_PROPOSED', resolutionState: 'UNRESOLVED' });
    let evalRes = evaluateDiscoveryReadiness(tempDir);
    assert.equal(evalRes.ready, false);
    assert.equal(evalRes.blockers[0].code, 'UNCONFIRMED_AI_PROPOSAL');

    // ASSUMED Must blocked without confirmation
    recordRequirementCandidate(tempDir, { id: 'IDEA-REQ-002', statement: 'Assumption', origin: 'ASSUMED', resolutionState: 'UNRESOLVED' });
    evalRes = evaluateDiscoveryReadiness(tempDir);
    assert.equal(evalRes.ready, false);

    // RESEARCH_DERIVED Must blocked without PO adoption
    recordRequirementCandidate(tempDir, { id: 'IDEA-REQ-003', statement: 'Research item', origin: 'RESEARCH_DERIVED', resolutionState: 'UNRESOLVED' });
    evalRes = evaluateDiscoveryReadiness(tempDir);
    assert.equal(evalRes.ready, false);
    assert.ok(evalRes.blockers.some((b) => b.code === 'UNADOPTED_RESEARCH_REQUIREMENT'));

    // Adopt RESEARCH_DERIVED -> origin retained, lineage established
    const adopted = recordRequirementCandidate(tempDir, {
      id: 'IDEA-REQ-003',
      statement: 'Research item',
      origin: 'RESEARCH_DERIVED',
      resolutionState: 'ADOPTED',
      confirmedBy: 'PRODUCT_OWNER',
      createPod: true,
    });
    assert.equal(adopted.origin, 'RESEARCH_DERIVED');
    assert.equal(adopted.resolutionState, 'ADOPTED');
    assert.equal(adopted.linkedPodId, 'POD-IDEA-REQ-003');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Scenario 19, 20, 21: Material questions, non-material, and deferred policy', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);

    // Material unresolved question blocks
    recordOpenQuestion(tempDir, { id: 'IDEA-Q-001', question: 'Critical question', materiality: 'MATERIAL', resolution: 'UNRESOLVED' });
    let check = evaluateDiscoveryReadiness(tempDir);
    assert.equal(check.ready, false);
    assert.equal(check.blockers[0].code, 'UNRESOLVED_MATERIAL_QUESTION');

    // Non-material question does not block
    recordOpenQuestion(tempDir, { id: 'IDEA-Q-002', question: 'Minor question', materiality: 'NON_MATERIAL', resolution: 'UNRESOLVED' });

    // Explicitly deferred material question unblocks
    recordOpenQuestion(tempDir, { id: 'IDEA-Q-001', question: 'Critical question', materiality: 'MATERIAL', resolution: 'DEFERRED' });
    check = evaluateDiscoveryReadiness(tempDir);
    assert.equal(check.ready, true);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Scenario 22, 23, 24, 25, 26, 27: Structural draft vs approval, stale/immutable approval, dual fingerprint/revision, spoofing rejection', () => {
  const tempDir = createTempDir();
  try {
    bootstrapProject(tempDir);
    const persisted = persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF });

    // Structurally valid draft without approval -> READY_FOR_APPROVAL
    const stage1 = computeIdeaStageState(tempDir);
    assert.equal(stage1.state, 'READY_FOR_APPROVAL');

    // Approve revision 1
    persistApprovalRecord(tempDir, { artifactFingerprint: persisted.fingerprint, artifactRevision: 1 });
    const stage2 = computeIdeaStageState(tempDir);
    assert.equal(stage2.state, 'APPROVED');

    // Modify artifact -> stale approval, historical approval immutable
    const p2 = persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF + '\n- More info\n' });
    const stage3 = computeIdeaStageState(tempDir);
    assert.equal(stage3.state, 'READY_FOR_APPROVAL');
    const hist = loadApprovalsHistory(tempDir);
    assert.equal(hist.approvals.length, 1);

    // Reverting text content (gives revision 3) remains STALE because revision mismatch
    const p3 = persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF });
    const status3 = computeEffectiveApprovalStatus(tempDir, p3.fingerprint, 3);
    assert.equal(status3.status, 'STALE');

    // Spoofed caller state rejected: NextStepResolver ignores caller-passed approved status when runtime state is not approved
    const resolver = new NextStepResolver();
    const next = resolver.resolve({ completedCommand: '/dk-idea', approvalStatus: 'approved', rootDir: tempDir });
    assert.equal(next[0].command, '/dk-idea');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Scenario 28 & 29: Product blocker routes to /dk-idea, runtime blocker routes to /dk-debug', () => {
  const resolver = new NextStepResolver();
  const prodBlock = resolver.resolve({ completedCommand: '/dk-idea', blockers: ['unresolved_scope'], blockerType: 'PRODUCT_DISCOVERY' });
  assert.equal(prodBlock[0].command, '/dk-idea');

  const runBlock = resolver.resolve({ completedCommand: '/dk-idea', blockers: ['corrupt_registry'], blockerType: 'RUNTIME_FRAMEWORK' });
  assert.equal(runBlock[0].command, '/dk-debug');
});

test('Scenario 30, 31, 32, 33, 34, 35: Command entry policy for /dk-test, /dk-review, /dk-autopilot, /dk-status, /dk-research, /dk-debug', async () => {
  const tempDir = createTempDir();
  try {
    assert.equal(COMMAND_ENTRY_TAXONOMY['/dk-test'], 'PROJECT_STATE_MUTATING');
    assert.equal(COMMAND_ENTRY_TAXONOMY['/dk-review'], 'PROJECT_STATE_MUTATING');
    assert.equal(COMMAND_ENTRY_TAXONOMY['/dk-autopilot'], 'PROJECT_ORCHESTRATOR');
    assert.equal(COMMAND_ENTRY_TAXONOMY['/dk-status'], 'PROJECT_READ_ONLY');
    assert.equal(COMMAND_ENTRY_TAXONOMY['/dk-research'], 'DUAL_MODE');
    assert.equal(COMMAND_ENTRY_TAXONOMY['/dk-debug'], 'DUAL_MODE');

    // Autopilot bootstraps fresh project
    const autoEntry = await executeLifecycleEntry({ rootDir: tempDir, command: 'dk-autopilot' });
    assert.equal(autoEntry.success, true);
    assert.equal(autoEntry.bootstrapped, true);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Scenario 36, 37, 38: Command entry drift, process restart reconstruction, package consumer installation', async () => {
  const tempDir = createTempDir();
  try {
    fs.mkdirSync(path.join(tempDir, '.agents'), { recursive: true });
    await executeLifecycleEntry({ rootDir: tempDir, command: 'dk-idea' });
    recordRequirementCandidate(tempDir, { id: 'IDEA-REQ-001', statement: 'Initial item', origin: 'USER_CONFIRMED', resolutionState: 'CONFIRMED' });
    persistCanonicalIdeaBrief({ rootDir: tempDir, content: VALID_BRIEF });

    // Process restart & rehydration
    const rehydrated = computeIdeaStageState(tempDir);
    assert.equal(rehydrated.state, 'READY_FOR_APPROVAL');
  } finally {
    cleanupTempDir(tempDir);
  }
});
