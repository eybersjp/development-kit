#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ensureDevelopmentContract,
  validateDevelopmentContract,
} from '../runtime/orchestration/development-contract.mjs';
import { selectRequiredGates } from '../runtime/orchestration/gate-selector.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const task = {
  id: 'DKF120-T10',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Expose the new control-plane state in Control Center, replay the Phase 1 workloads, and prepare comprehensive evidence for the v0.12.0 release gate.',
  scope: {
    in: [
      'runtime/api/runtime-api-service.mjs',
      'runtime/control-center/control-center-service.mjs',
      'scripts/control-center-v012.test.mjs',
      'scripts/phase12-control-center-validation-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md'
    ],
    out: [
      'New competing Control Center framework',
      'Releasing or publishing without explicit PO approval'
    ],
  },
  requirements: [
    'Extend existing Control Center/runtime API to expose v0.12 state.',
    'Keep UI non-authoritative.',
    'All existing supported public commands remain discoverable and functional.',
    'Full release validation regression suites remain green.',
    'No new false-ACCEPTED regression scenarios are introduced.',
    'Document migration, compatibility, limitations, and measured outcomes.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-030',
      statement: 'Control Center exposes the new state without becoming canonical authority.',
      source: 'DKF-120-AC-030',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Extend existing Control Center/runtime API to expose v0.12 state.',
        'Keep UI non-authoritative.'
      ],
    },
    {
      id: 'DKF-120-AC-031',
      statement: 'Existing supported public commands remain compatible.',
      source: 'DKF-120-AC-031',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'All existing supported public commands remain discoverable and functional.'
      ],
    },
    {
      id: 'DKF-120-AC-032',
      statement: 'Existing control-plane and release-validation regression suites remain green.',
      source: 'DKF-120-AC-032',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Full release validation regression suites remain green.'
      ],
    },
    {
      id: 'DKF-120-AC-036',
      statement: 'No new false-ACCEPTED regression scenario is introduced.',
      source: 'DKF-120-AC-036',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'No new false-ACCEPTED regression scenarios are introduced.'
      ],
    },
    {
      id: 'DKF-120-AC-040',
      statement: 'Release documentation includes migration, compatibility, measurement results, and known limitations.',
      source: 'DKF-120-AC-040',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Document migration, compatibility, limitations, and measured outcomes.'
      ],
    },
  ],
  architectureConstraints: [
    'DKF core remains general-purpose and host/provider independent.',
    'Control Center UI remains non-authoritative.',
    'No release action without explicit human authorization.',
  ],
  designConstraints: [
    'Runtime API serves read and governed writes over loopback with token authentication.',
  ],
  securityConstraints: [
    'No credentials or secrets exposed via endpoints.',
  ],
  risk: {
    level: 3,
    reasons: [
      'Closes the release and compatibility loop for v0.12.0.',
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
    sections: ['4.10 Control Center integration', 'Integration and release'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['13. Control Center and Release Integration'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['12. Task DKF120-T10 — Control Center + Comparative Release Validation'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T10',
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
}, null, 2)}\n`);
