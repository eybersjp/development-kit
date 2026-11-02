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
  objective: 'Make bounded and nested development lifecycles first-class without changing the familiar nine-stage user workflow, ensuring lifecycle-scoped completion and domain state isolation.',
  scope: {
    in: [
      'runtime/orchestration/lifecycle-instance.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/lifecycle-instance.schema.json',
      'scripts/lifecycle-instances.test.mjs',
      'scripts/phase07-lifecycle-instances-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md'
    ],
    out: [
      'Discovery and controlled re-entry',
      'Generic Gate Profiles',
      'Verification Extension SDK',
      'Complexity Delta Guard',
      'Control Center v0.12 integration',
      'Changing user-facing 9-stage sequence',
      'Global project restart when child completes',
      'Application domain state altering DKF acceptance'
    ],
  },
  requirements: [
    'Lifecycle instances support optional parent/child relationships with independent IDs and isolation.',
    'Each lifecycle instance retains the canonical nine-stage lifecycle sequence.',
    'COMPLETE semantics are strictly scoped to the active lifecycle instance without completing parent lifecycles.',
    'Parent acceptance and progression are evaluated independently based on parent criteria and verification.',
    'Application/domain/business state cannot implicitly change DKF lifecycle acceptance or completion state.',
    'Existing simple projects behave identically as a single default lifecycle without configuration changes.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-016',
      statement: 'Lifecycle Instances support optional parent/child relationships.',
      source: 'DKF-120-AC-016',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Lifecycle instances support optional parent/child relationships with independent IDs and isolation.',
        'Each lifecycle instance retains the canonical nine-stage lifecycle sequence.'
      ],
    },
    {
      id: 'DKF-120-AC-017',
      statement: 'COMPLETE applies only to the active Lifecycle Instance.',
      source: 'DKF-120-AC-017',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'COMPLETE semantics are strictly scoped to the active lifecycle instance without completing parent lifecycles.',
        'Parent acceptance and progression are evaluated independently based on parent criteria and verification.'
      ],
    },
    {
      id: 'DKF-120-AC-018',
      statement: 'Domain/application state cannot implicitly change DKF lifecycle acceptance/completion state.',
      source: 'DKF-120-AC-018',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Application/domain/business state cannot implicitly change DKF lifecycle acceptance or completion state.',
        'Existing simple projects behave identically as a single default lifecycle without configuration changes.'
      ],
    },
  ],
  architectureConstraints: [
    'DKF core remains general-purpose and host/provider independent.',
    'Lifecycle Instances retain the canonical nine-stage lifecycle: UNDERSTAND -> DEFINE -> DESIGN -> PLAN -> IMPLEMENT -> VERIFY -> REVIEW -> SIMPLIFY -> COMPLETE.',
    'No application-specific lifecycle types or business logic in DKF core.',
    'Domain state is decoupled from development lifecycle governance.',
    'Single-lifecycle projects remain fully backward compatible.',
  ],
  designConstraints: [
    'Child lifecycle complete does not advance parent stage or status.',
    'Parent lifecycle acceptance requires satisfaction of parent-scoped acceptance criteria.',
    'State namespaces isolate child lifecycle events and state.',
  ],
  securityConstraints: [
    'Arbitrary external domain state cannot spoof or force DKF acceptance state.',
    'Lifecycle instances validate IDs, stages, and parent references fail-closed.',
  ],
  risk: {
    level: 3,
    reasons: [
      'Lifecycle completion semantics affect orchestration authority and acceptance boundaries.',
      'Improper lifecycle scoping could cause false-COMPLETE or premature parent release.',
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
    sections: ['4.5 Lifecycle Instances', 'Lifecycle Instances', '7. Migration requirements'],
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
const gates = selectRequiredGates(result.contract);

process.stdout.write(`${JSON.stringify({
  contractId: result.contract.contractId,
  taskId: result.contract.taskId,
  schemaVersion: result.contract.schemaVersion,
  created: result.created,
  sourceFingerprint: result.contract.sourceFingerprint,
  acceptanceCriteria: result.contract.acceptanceCriteria.map((c) => c.id),
  requiredVerification: result.contract.requiredVerification,
  requiredReviewers: result.contract.requiredReviewers,
  derivedGates: gates,
  riskLevel: result.contract.risk.level,
  targetBinding: result.contract.targetBinding,
}, null, 2)}\n`);
