#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkContractStaleness,
  ensureDevelopmentContract,
  validateDevelopmentContract,
} from '../runtime/orchestration/development-contract.mjs';
import { selectRequiredGates } from '../runtime/orchestration/gate-selector.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const task = {
  id: 'DKF120-T04',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Replace transition-proportional canonical snapshot chains with compact event-backed state while preserving auditability, semantic equivalence, recovery, and backward compatibility.',
  scope: {
    in: [
      'runtime/orchestration/state-engine-v2.mjs',
      'runtime/orchestration/orchestration-run.mjs',
      'runtime/orchestration/index.mjs',
      'runtime/autopilot/state-store.mjs',
      'schemas/state-engine-event.schema.json',
      'schemas/state-engine-snapshot.schema.json',
      'schemas/state-engine-index.schema.json',
      'scripts/state-engine-v2.test.mjs',
      'scripts/state-engine-v2-migration.test.mjs',
      'scripts/phase06-state-engine-v2-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      '.gitignore',
      'docs/',
      'memory.md',
    ],
    out: [
      'Lifecycle Instances',
      'Discovery and controlled re-entry',
      'Gate Profiles',
      'Verification Extension SDK',
      'Complexity Delta Guard',
      'Control Center v0.12 integration',
      'Deleting legacy state before verified migration/cutover',
      'Changing acceptance semantics',
      'Making a binary index the source of truth',
      'Application-specific or industry-specific state semantics',
    ],
  },
  requirements: [
    'Persist canonical runtime state history as an inspectable append-only event ledger with monotonic sequence and hash-chain integrity.',
    'Materialise current runtime snapshot state from canonical events and permit deterministic snapshot rebuild.',
    'Maintain a disposable rebuildable index whose deletion cannot destroy canonical state.',
    'Perform canonical state commits atomically so interrupted temporary writes cannot partially advance canonical history.',
    'Migrate supported legacy Autopilot and orchestration run-state revisions with semantic equivalence.',
    'Make supported migration idempotent and fail closed on corrupt or semantically inconsistent legacy input.',
    'Preserve recoverable legacy state and a deterministic backup until verified cutover; do not delete legacy state in T04.',
    'Preserve current acceptance state/meaning during migration.',
    'Keep public simple-project workflows backward compatible and permit legacy fallback where State Engine V2 is not active.',
    'Measure representative transition-generated state micro-file reduction against the Phase 1 baseline and report the result even if the >=80% objective is missed.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-012',
      statement: 'Canonical runtime history is append-only and reconstructable.',
      source: 'DKF-120-AC-012',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-013',
      statement: 'Current snapshot can be rebuilt from canonical history.',
      source: 'DKF-120-AC-013',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-014',
      statement: 'Disposable index deletion/rebuild produces semantically equivalent query state.',
      source: 'DKF-120-AC-014',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-015',
      statement: 'Supported legacy migration is idempotent, fail-closed, and recoverable before cutover acceptance.',
      source: 'DKF-120-AC-015',
      verificationType: ['test', 'migration'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-034',
      statement: 'Representative migrated runtime state achieves the state micro-file reduction objective or reports the miss explicitly.',
      source: 'DKF-120-AC-034',
      verificationType: ['test'],
      requiredEvidence: true,
    },
  ],
  architectureConstraints: [
    'events.jsonl is canonical State Engine V2 runtime history.',
    'snapshot.json is a materialised view derived from canonical history.',
    'index.db is disposable acceleration state and may not become authority.',
    'State Engine V2 remains general-purpose and domain neutral.',
    'Existing contracts, evidence, artifacts, and acceptance records remain in their current authoritative stores unless explicitly migrated by a later approved increment.',
    'T04 depends on accepted DKF120-T03.',
  ],
  designConstraints: [],
  securityConstraints: [
    'State paths must remain project-local and fail closed on path escape or corrupt canonical history.',
    'Hash-chain validation must detect event modification, deletion, insertion, or reordering.',
    'Legacy migration must validate all inputs before canonical cutover state is committed.',
  ],
  risk: {
    level: 3,
    reasons: [
      'Persistent-state migration and recovery are control-plane critical.',
      'Incorrect event replay or migration could silently change orchestration/acceptance state.',
    ],
  },
  requiredVerification: ['tests', 'migration'],
  requiredReviewers: ['code-reviewer'],
  correctionPolicy: { maxAttempts: 3 },
  executionSafety: {
    resourceScope: 'project-only',
    destructiveOperations: 'explicit-approval',
    remoteMutation: 'explicit-contract',
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
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-specification.md',
    kind: 'specification',
    authority: 'required',
    sections: ['4.4 State Engine V2', '7. Migration requirements', '8. Performance objectives', 'State Engine V2'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['7. State Engine V2'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['6. Task DKF120-T04 — State Engine V2'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-phase05-t03-validation.md',
    kind: 'dependency-acceptance',
    authority: 'required',
    sections: ['11. Acceptance decision', '12. Next increment'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-phase01-baseline.md',
    kind: 'baseline-evidence',
    authority: 'supporting',
    sections: ['2.4 Current state persistence confirms the micro-file scaling concern', '6. Legacy state-growth fixture'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T04',
});

validateDevelopmentContract(result.contract);

if (!result.contract.workspaceTargets) {
  throw new Error('T04 must use a target-aware Development Contract');
}
if (result.contract.workspaceTargets.primary !== 'dkf-framework') {
  throw new Error('T04 primary target binding is not dkf-framework');
}

const gates = selectRequiredGates(result.contract);
const expectedReviewers = ['architecture-reviewer', 'code-reviewer', 'security-reviewer'];
if (JSON.stringify(gates.reviewers) !== JSON.stringify(expectedReviewers)) {
  throw new Error(`Unexpected T04 reviewer gates: ${gates.reviewers.join(', ')}`);
}
if (JSON.stringify(gates.controlDomains) !== JSON.stringify(['security'])) {
  throw new Error(`Unexpected T04 control domains: ${gates.controlDomains.join(', ')}`);
}
if (gates.humanApprovals.length > 0) {
  throw new Error('T04 unexpectedly derived a human approval gate');
}

const staleness = checkContractStaleness(result.contract, ROOT);
if (staleness.stale) {
  throw new Error('DKF120-T04 Development Contract is stale immediately after creation');
}

process.stdout.write(`${JSON.stringify({
  contractId: result.contract.contractId,
  taskId: result.contract.taskId,
  schemaVersion: result.contract.schemaVersion,
  created: result.created,
  sourceFingerprint: result.contract.sourceFingerprint,
  acceptanceCriteria: result.contract.acceptanceCriteria.map((criterion) => criterion.id),
  requiredVerification: result.contract.requiredVerification,
  requiredReviewers: result.contract.requiredReviewers,
  derivedGates: gates,
  riskLevel: result.contract.risk.level,
  targetBinding: result.contract.workspaceTargets,
  stale: staleness.stale,
}, null, 2)}\n`);
