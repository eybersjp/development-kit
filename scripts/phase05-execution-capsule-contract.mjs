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
  id: 'DKF120-T03',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Reduce repeated repository/runtime reorientation with deterministic Execution Capsules and a safely invalidated repository context cache while preserving source authority and fresh-role isolation.',
  scope: {
    in: [
      'runtime/orchestration/execution-capsule.mjs',
      'runtime/orchestration/context-cache.mjs',
      'runtime/orchestration/context-package.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/execution-capsule.schema.json',
      'schemas/context-cache-entry.schema.json',
      'scripts/execution-capsule.test.mjs',
      'scripts/context-cache.test.mjs',
      'scripts/phase05-execution-capsule-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md'
    ],
    out: [
      'State Engine V2',
      'Lifecycle Instances',
      'Discovery/re-entry',
      'Gate Profiles',
      'Verification Extension SDK',
      'Complexity Delta Guard',
      'Control Center v0.12 integration',
      'Replacing buildContextPackage()',
      'Weakening authoritative whole-file fingerprint checks',
      'Treating summaries or cached repository facts as authority'
    ],
  },
  requirements: [
    'Build deterministic Execution Capsules that reference authority and repository evidence by fingerprint instead of copying project history.',
    'Reuse current authoritative-source section materialisation through buildContextPackage().',
    'Persist only acceleration-grade repository structural facts and invalidate them deterministically.',
    'Include target/dependency delta, relevant file/test fingerprints, upstream accepted-task references, verified runtime facts with provenance, and required gate/profile references.',
    'Reject stale Execution Capsules before role context construction.',
    'A relevant file change must invalidate the capsule.',
    'An unrelated target file change must not invalidate an unrelated target-scoped cache when the bound contract and selected target inputs remain unchanged.',
    'A cache miss must still produce correct context and may only reduce performance, never reliability.',
    'Cost Observatory evidence must report measurable cache/context/orientation effects where observable.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-008',
      statement: 'Fresh implementation/review contexts can receive deterministic Execution Capsules.',
      source: 'DKF-120-AC-008',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-009',
      statement: 'Capsule fingerprints invalidate stale capsules when relevant authority/repository state changes.',
      source: 'DKF-120-AC-009',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-010',
      statement: 'Repository/context caching has deterministic invalidation.',
      source: 'DKF-120-AC-010',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-011',
      statement: 'Existing section-aware source materialisation and source-fingerprint protections remain green.',
      source: 'DKF-120-AC-011',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-035',
      statement: 'Comparative evidence reports measured context/orientation improvement where observable.',
      source: 'DKF-120-AC-035',
      verificationType: ['test'],
      requiredEvidence: true,
    },
  ],
  architectureConstraints: [
    'DKF core remains general-purpose, project/domain neutral, host independent, and provider independent.',
    'Execution Capsules are deterministic reference manifests, not a new source of business or specification authority.',
    'Context cache entries are disposable acceleration artifacts and may not become canonical state.',
    'Fresh-role isolation and independent verification remain mandatory.',
    'T03 must build on the accepted Workspace Target Engine and Cost Observatory rather than duplicating either capability.',
    'T03 depends on accepted DKF120-T02.',
  ],
  designConstraints: [],
  securityConstraints: [],
  risk: {
    level: 3,
    reasons: ['A stale or incorrectly validated cache hit could feed obsolete repository context into implementation or independent verification.'],
  },
  requiredVerification: ['tests'],
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
    sections: ['4.3 Execution Capsules and context cache', 'Context economy'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['5. Execution Capsules and Context Engine', '6. Cost Observatory'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['5. Task DKF120-T03 — Execution Capsules & Context Cache'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-phase04-t02-validation.md',
    kind: 'dependency-acceptance',
    authority: 'required',
    sections: ['10. Acceptance decision', '11. Next increment'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-phase03-t01-validation.md',
    kind: 'telemetry-foundation',
    authority: 'supporting',
    sections: ['2. Implemented capability', '3. Acceptance-criterion evidence'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-phase01-baseline.md',
    kind: 'baseline-evidence',
    authority: 'supporting',
    sections: ['2.5 Context rehydration is already safe but remains expensive by design', '5. Representative context fixtures'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T03',
});

validateDevelopmentContract(result.contract);

if (!result.contract.workspaceTargets) {
  throw new Error('T03 must use a target-aware Development Contract');
}
if (result.contract.workspaceTargets.primary !== 'dkf-framework') {
  throw new Error('T03 primary target binding is not dkf-framework');
}

const gates = selectRequiredGates(result.contract);
const expectedReviewers = ['architecture-reviewer', 'code-reviewer', 'security-reviewer'];
if (JSON.stringify(gates.reviewers) !== JSON.stringify(expectedReviewers)) {
  throw new Error(`Unexpected T03 reviewer gates: ${gates.reviewers.join(', ')}`);
}
if (JSON.stringify(gates.controlDomains) !== JSON.stringify(['security'])) {
  throw new Error(`Unexpected T03 control domains: ${gates.controlDomains.join(', ')}`);
}
if (gates.humanApprovals.length > 0) {
  throw new Error('T03 unexpectedly derived a human approval gate');
}

const staleness = checkContractStaleness(result.contract, ROOT);
if (staleness.stale) {
  throw new Error('DKF120-T03 Development Contract is stale immediately after creation');
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
