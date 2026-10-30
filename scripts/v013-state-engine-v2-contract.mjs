#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkContractStaleness,
  ensureDevelopmentContract,
  validateDevelopmentContract,
} from '../runtime/orchestration/development-contract.mjs';
import { resolveContractGateProfiles } from '../runtime/orchestration/gate-profiles.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const task = {
  id: 'DKF130-T04',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Complete the deferred State Engine V2 increment on top of released v0.12.1, including canonical event-backed state, verified legacy migration, bounded state-file growth, and full Windows legacy-backup restore/recovery with persistent crash-recovery witnesses.',
  scope: {
    in: [
      'runtime/orchestration/state-engine-v2.mjs',
      'runtime/orchestration/state-engine-migration.mjs',
      'runtime/autopilot/state-store.mjs',
      'runtime/orchestration/orchestration-run.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/state-engine-*.schema.json',
      'scripts/windows-durable-rename.ps1',
      'scripts/state-engine-v2*.test.mjs',
      'scripts/state-engine-v013.test.mjs',
      'scripts/state-engine-v2-benchmark.mjs',
      'scripts/v013-state-engine-v2-contract.mjs',
      '.github/workflows/ci.yml',
      'package.json',
      'docs/',
      'memory.md',
    ],
    out: [
      'Application-specific or industry-specific state semantics',
      'Changing released Lifecycle Instance semantics',
      'Changing Discovery and Controlled Re-entry semantics',
      'Weakening Gate Profiles or Verification Extension acceptance',
      'Distributed cross-host locking',
      'Same-account hostile writer hardening tracked separately from Issue #73',
      'Publishing v0.13.0',
      'Deleting retained legacy state before a later explicit cleanup policy',
    ],
  },
  requirements: [
    'DKF-120-AC-012: canonical development-state history is append-only, deterministically ordered and integrity chained.',
    'DKF-120-AC-013: materialized current state rebuilds deterministically from canonical history.',
    'DKF-120-AC-014: acceleration index deletion or corruption is rebuildable without semantic change.',
    'DKF-120-AC-015: supported legacy state migration is idempotent, fail-closed, recoverable and semantically equivalent before cutover.',
    'DKF-120-AC-034: canonical transition-state file growth is bounded rather than proportional to normal transition count.',
    'Preserve v0.12.1 public command and T01-T03/T05-T10 behavior while replacing persistence authority underneath released interfaces.',
    'A missing Windows pending-commit journal must not make an unambiguous torn trailing canonical append unrecoverable.',
    'Windows restore must retain persistent transaction witnesses and support deterministic recovery on the declared supported storage profile.',
    'Unsupported Windows storage profiles must fail before destructive target-root mutation and preserve recoverable assets.',
    'Independent code, architecture and security review remain required for risk-3 acceptance.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-012',
      statement: 'State history is append-only and canonical, with deterministic ordering and integrity chaining.',
      source: 'DKF-120-AC-012',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-013',
      statement: 'Current state is materialized from canonical history and can be rebuilt deterministically.',
      source: 'DKF-120-AC-013',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-014',
      statement: 'The acceleration index can be deleted or corrupted and rebuilt without changing semantic state.',
      source: 'DKF-120-AC-014',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-015',
      statement: 'Supported legacy state migrates idempotently, fail-closed, recoverably and semantically equivalently before cutover.',
      source: 'DKF-120-AC-015',
      verificationType: ['test', 'security'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-034',
      statement: 'Canonical transition-state file growth is bounded and no longer proportional to normal transition count.',
      source: 'DKF-120-AC-034',
      verificationType: ['test', 'architecture-verification'],
      requiredEvidence: true,
    },
  ],
  architectureConstraints: [
    'events.jsonl is canonical; snapshot.json is materialized/rebuildable; index.db is disposable acceleration only.',
    'SQLite may not become the sole source of truth.',
    'Fresh projects may use V2 directly; legacy projects may cut over only after verified migration-complete evidence.',
    'Historical v0.12 T04 branches are source material only and may not overwrite later v0.12.1 feature semantics.',
    'State Engine V2 remains generic DKF development-state infrastructure.',
    'The canonical ledger may automatically repair only unambiguous final append damage; mid-history or hash-chain ambiguity fails closed.',
  ],
  designConstraints: [],
  securityConstraints: [
    'No symlink, junction, path traversal or hard-link alias may redirect canonical state or restore writes outside approved boundaries.',
    'Recovery may never destroy the last authenticated recoverable copy.',
    'Windows restore requires positive supported-storage identification before destructive root mutation.',
    'Required Windows durability helper failures must propagate and may not silently fall back to plain rename.',
    'Pending journals and restore transaction records are recovery witnesses and must not be treated as advisory summaries.',
  ],
  risk: {
    level: 3,
    reasons: [
      'Persistent-state migration and recovery are control-plane critical.',
      'Incorrect durability or cutover could lose or falsely advance authoritative development state.',
      'Windows restore mutates project-root directory entries and requires fail-closed recovery semantics.',
    ],
  },
  requiredVerification: ['tests'],
  requiredReviewers: ['code-reviewer'],
  correctionPolicy: { maxAttempts: 3 },
  approvalPolicy: {
    requiredGateProfileIds: ['gp-high-assurance'],
  },
  executionSafety: {
    resourceScope: 'project-only',
    destructiveOperations: 'explicit-approval',
    remoteMutation: 'forbidden',
  },
  configurationDependencies: [],
  targetBinding: {
    primary: 'dkf-framework',
    affected: ['dkf-framework'],
    verification: ['dkf-framework'],
  },
};

const authoritativeSources = [
  {
    path: 'docs/04-architecture/dkf-v0.13-state-engine-v2-specification.md',
    kind: 'specification',
    authority: 'required',
    sections: ['3. Required canonical layout', '4. Acceptance criteria restored for v0.13', '6. Runtime commit durability contract', '7. Windows legacy-backup restore/recovery contract', '11. Required independent gates'],
  },
  {
    path: 'docs/04-architecture/dkf-v0.13-t04-release-authority.md',
    kind: 'product-owner-release-authority',
    authority: 'required',
    sections: ['1. Release-line decision', '2. Product Owner authority', '3. Windows blocker', '6. Acceptance boundary'],
  },
  {
    path: 'CHANGELOG.md',
    kind: 'released-baseline',
    authority: 'required',
    sections: ['0.12.1', '0.12.0'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'historical-technical-design',
    authority: 'supporting',
    sections: ['7. State Engine V2'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'historical-plan',
    authority: 'supporting',
    sections: ['6. Task DKF120-T04 — State Engine V2'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF130-T04',
});

validateDevelopmentContract(result.contract);
if (!result.contract.workspaceTargets || result.contract.workspaceTargets.primary !== 'dkf-framework') {
  throw new Error('v0.13 T04 must use the dkf-framework target-aware Development Contract');
}

const gates = resolveContractGateProfiles(result.contract, {
  securitySensitive: true,
  architectureSensitive: true,
});
const expectedVerification = ['architecture-verification', 'security-audit', 'specification', 'tests'];
const expectedReviewers = ['architecture-reviewer', 'code-reviewer', 'security-reviewer'];
if (JSON.stringify(gates.verification) !== JSON.stringify(expectedVerification)) {
  throw new Error('Unexpected v0.13 T04 verification gates: ' + gates.verification.join(', '));
}
if (JSON.stringify(gates.reviewers) !== JSON.stringify(expectedReviewers)) {
  throw new Error('Unexpected v0.13 T04 reviewer gates: ' + gates.reviewers.join(', '));
}
if (JSON.stringify(gates.controlDomains) !== JSON.stringify(['security'])) {
  throw new Error('Unexpected v0.13 T04 control domains: ' + gates.controlDomains.join(', '));
}
if (gates.humanApprovals.length > 0) {
  throw new Error('v0.13 T04 unexpectedly derived a human approval gate');
}

const staleness = checkContractStaleness(result.contract, ROOT);
if (staleness.stale) throw new Error('DKF130-T04 Development Contract is stale immediately after creation');

process.stdout.write(JSON.stringify({
  contractId: result.contract.contractId,
  taskId: result.contract.taskId,
  schemaVersion: result.contract.schemaVersion,
  created: result.created,
  sourceFingerprint: result.contract.sourceFingerprint,
  acceptanceCriteria: result.contract.acceptanceCriteria.map((criterion) => criterion.id),
  gates,
  riskLevel: result.contract.risk.level,
  targetBinding: result.contract.workspaceTargets,
  stale: staleness.stale,
}, null, 2) + '\n');
