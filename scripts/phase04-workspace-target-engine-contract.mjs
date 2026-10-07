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
  id: 'DKF120-T02',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Introduce generic project-defined workspace target boundaries and capability/configuration-driven routing without privileging any application, industry, repository topology, or target name.',
  scope: {
    in: [
      'runtime/orchestration/workspace-targets.mjs',
      'runtime/orchestration/development-contract.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/workspace-target-registry.schema.json',
      'schemas/development-contract.schema.json',
      'scripts/workspace-targets.test.mjs',
      'scripts/orchestration-contract.test.mjs',
      'scripts/phase04-workspace-target-engine-contract.mjs',
      '.development-kit/workspace.json',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md'
    ],
    out: [
      'Execution Capsules or context caching',
      'State Engine V2',
      'Lifecycle Instances',
      'Discovery/re-entry',
      'Gate Profiles',
      'Verification Extension SDK',
      'Complexity Delta Guard',
      'Control Center v0.12 integration',
      'Application-specific or industry-specific target semantics',
      'Technology-name-driven routing'
    ],
  },
  requirements: [
    'Support arbitrary project-defined target IDs.',
    'Support both single-target and multi-target repositories.',
    'Discover common repository boundaries without privileging target names or business domains in DKF core.',
    'Support target dependency relationships and deterministic dependency/reverse-dependant closures.',
    'Allow Development Contracts to bind primary, affected, and verification targets.',
    'Bind target-aware Development Contracts to the workspace registry fingerprint so registry drift makes the contract stale.',
    'Resolve target commands and target selection from declared capabilities/configuration/adapters rather than target names, kinds, or technologies.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-004',
      statement: 'A project can register arbitrary target IDs without changing DKF core.',
      source: 'DKF-120-AC-004',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-005',
      statement: 'Target discovery/configuration does not assume a specific application domain or fixed repository topology.',
      source: 'DKF-120-AC-005',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-006',
      statement: 'Tasks/contracts can bind primary, affected, and verification targets.',
      source: 'DKF-120-AC-006',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-007',
      statement: 'Target-specific commands/capabilities resolve without hard-coded target names.',
      source: 'DKF-120-AC-007',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-039',
      statement: 'Core routing is capability/configuration-driven rather than technology-name driven.',
      source: 'DKF-120-AC-039',
      verificationType: ['test'],
      requiredEvidence: true,
    },
  ],
  architectureConstraints: [
    'DKF core remains general-purpose and host/provider independent.',
    'Target IDs, kinds, capabilities, commands, and adapter metadata are project configuration rather than built-in business policy.',
    'A single-root repository remains a valid first-class workspace.',
    'T02 extends Development Contracts and existing orchestration rather than creating a competing contract or execution system.',
    'DKF120-T01 is accepted and is the required predecessor for this increment.',
  ],
  designConstraints: [],
  securityConstraints: [],
  risk: {
    level: 2,
    reasons: ['Workspace routing changes execution boundaries and Development Contract authority but does not itself perform remote or destructive actions.'],
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
};

const authoritativeSources = [
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-specification.md',
    kind: 'specification',
    authority: 'required',
    sections: ['4.2 Workspace Target Engine', 'Workspace targets'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['4. Workspace Target Engine'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['4. Task DKF120-T02 — Workspace Target Engine'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-phase03-t01-validation.md',
    kind: 'dependency-acceptance',
    authority: 'supporting',
    sections: ['8. Acceptance decision', '9. Next increment'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-phase01-baseline.md',
    kind: 'baseline-evidence',
    authority: 'supporting',
    sections: ['5.2 Multi-package fixture'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T02',
});

validateDevelopmentContract(result.contract);
const gates = selectRequiredGates(result.contract);
if (JSON.stringify(gates.reviewers) !== JSON.stringify(['code-reviewer'])) {
  throw new Error(`Unexpected T02 reviewer gates: ${gates.reviewers.join(', ')}`);
}
if (gates.controlDomains.length > 0 || gates.humanApprovals.length > 0) {
  throw new Error('T02 unexpectedly derived specialist control or human-approval gates');
}
const staleness = checkContractStaleness(result.contract, ROOT);
if (staleness.stale) {
  throw new Error('DKF120-T02 Development Contract is stale immediately after creation');
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
  targetBinding: result.contract.workspaceTargets ?? null,
  bootstrapNote: 'T02 contract predates Workspace Target Engine availability; future target-aware contracts use the T02 binding contract.',
  stale: staleness.stale,
}, null, 2)}\n`);
