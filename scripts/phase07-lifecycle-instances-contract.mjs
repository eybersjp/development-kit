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
  id: 'DKF120-T05',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Make bounded and nested development lifecycles first-class while preserving the canonical nine-stage workflow and preventing project/business state from implicitly completing development work.',
  scope: {
    in: [
      'runtime/orchestration/lifecycle-instances.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/lifecycle-instance.schema.json',
      'schemas/project-state-namespace.schema.json',
      'scripts/lifecycle-instances.test.mjs',
      'scripts/phase07-lifecycle-instances-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md',
    ],
    out: [
      'Discovery and controlled re-entry',
      'Gate Profiles',
      'Verification Extension SDK',
      'Complexity Delta Guard',
      'Control Center v0.12 integration',
      'Application-specific lifecycle types',
      'Automatic business-status-to-lifecycle completion',
      'Release or deployment automation',
    ],
  },
  requirements: [
    'Support optional parent/child Lifecycle Instance relationships.',
    'Retain the canonical nine DKF stages inside every Lifecycle Instance.',
    'Scope COMPLETE to one Lifecycle Instance only.',
    'Require lifecycle-bound deterministic acceptance before a lifecycle can become COMPLETE.',
    'Keep parent lifecycle acceptance and completion independent from child lifecycle completion.',
    'Persist application/domain/release/deployment or other project-owned state in a separate generic state namespace that cannot implicitly mutate lifecycle state.',
    'Support arbitrary lifecycle type labels without application- or industry-specific enums.',
    'Provide backward-compatible single-lifecycle adoption for existing simple DKF workflows.',
    'Build on State Engine V2 rather than creating a parallel persistence mechanism.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-016',
      statement: 'Lifecycle Instances support optional parent/child relationships.',
      source: 'DKF-120-AC-016',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-017',
      statement: 'COMPLETE applies only to the active Lifecycle Instance and parent completion is independently evaluated.',
      source: 'DKF-120-AC-017',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-018',
      statement: 'Domain/application/project state cannot implicitly change DKF lifecycle acceptance or completion state.',
      source: 'DKF-120-AC-018',
      verificationType: ['test'],
      requiredEvidence: true,
    },
  ],
  architectureConstraints: [
    'State Engine V2 remains the persistence authority for lifecycle and project namespace state.',
    'Lifecycle type is descriptive/extensible and may not become an application-specific dispatch enum.',
    'The canonical nine-stage user workflow remains unchanged.',
    'Backward stage movement is not introduced by T05; controlled re-entry belongs to T06.',
    'T05 depends on accepted DKF120-T04.',
  ],
  designConstraints: [],
  securityConstraints: [
    'Lifecycle and namespace identifiers must be validated before persistence.',
    'Lifecycle completion must fail closed unless the lifecycle acceptance state is ACCEPTED.',
  ],
  risk: {
    level: 3,
    reasons: [
      'Lifecycle completion semantics affect orchestration authority.',
      'Incorrect parent/child coupling could incorrectly mark broader work complete.',
    ],
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
    sections: ['4.5 Lifecycle Instances', 'Lifecycle Instances'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['8. Lifecycle Engine'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['7. Task DKF120-T05 — Lifecycle Instances'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-phase06-t04-validation.md',
    kind: 'dependency-acceptance',
    authority: 'required',
    sections: ['12. Acceptance decision', '13. Next increment'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T05',
});

validateDevelopmentContract(result.contract);
if (!result.contract.workspaceTargets || result.contract.workspaceTargets.primary !== 'dkf-framework') {
  throw new Error('T05 must use the dkf-framework target-aware Development Contract');
}

const gates = selectRequiredGates(result.contract);
const expectedReviewers = ['architecture-reviewer', 'code-reviewer', 'security-reviewer'];
if (JSON.stringify(gates.reviewers) !== JSON.stringify(expectedReviewers)) {
  throw new Error(`Unexpected T05 reviewer gates: ${gates.reviewers.join(', ')}`);
}
if (JSON.stringify(gates.controlDomains) !== JSON.stringify(['security'])) {
  throw new Error(`Unexpected T05 control domains: ${gates.controlDomains.join(', ')}`);
}
if (gates.humanApprovals.length > 0) {
  throw new Error('T05 unexpectedly derived a human approval gate');
}

const staleness = checkContractStaleness(result.contract, ROOT);
if (staleness.stale) throw new Error('DKF120-T05 Development Contract is stale immediately after creation');

process.stdout.write(`${JSON.stringify({
  contractId: result.contract.contractId,
  taskId: result.contract.taskId,
  schemaVersion: result.contract.schemaVersion,
  created: result.created,
  sourceFingerprint: result.contract.sourceFingerprint,
  acceptanceCriteria: result.contract.acceptanceCriteria.map((criterion) => criterion.id),
  requiredVerification: result.contract.requiredVerification,
  derivedGates: gates,
  riskLevel: result.contract.risk.level,
  targetBinding: result.contract.workspaceTargets,
  stale: staleness.stale,
}, null, 2)}\n`);
