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
  id: 'DKF120-T06',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Turn technical discovery into a controlled, evidence-backed feedback loop that determines minimum safe re-entry stage, invalidates only downstream dependencies, and preserves unrelated accepted work.',
  scope: {
    in: [
      'runtime/orchestration/discovery-reentry.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/discovery-event.schema.json',
      'scripts/discovery-reentry.test.mjs',
      'scripts/phase08-discovery-reentry-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md'
    ],
    out: [
      'Generic Gate Profiles',
      'Verification Extension SDK',
      'Complexity Delta Guard',
      'Control Center v0.12 integration',
      'Silent specification rewrite from IMPLEMENT',
      'Automatic global lifecycle restart without dependency evidence'
    ],
  },
  requirements: [
    'Persist discovery evidence and affected authority references.',
    'Classify the type/scope of invalidation accurately.',
    'Determine minimum safe re-entry stage according to authority hierarchy.',
    'Calculate dependent affected work through dependency graph traversal.',
    'Preserve unrelated accepted work during selective invalidation.',
    'Invoke existing human approval when upstream authority changes require it.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-019',
      statement: 'Discovery events persist evidence and affected-authority references.',
      source: 'DKF-120-AC-019',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Persist discovery evidence and affected authority references.',
        'Classify the type/scope of invalidation accurately.'
      ],
    },
    {
      id: 'DKF-120-AC-020',
      statement: 'The runtime computes the minimum safe re-entry stage from affected authority.',
      source: 'DKF-120-AC-020',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Determine minimum safe re-entry stage according to authority hierarchy.',
        'Invoke existing human approval when upstream authority changes require it.'
      ],
    },
    {
      id: 'DKF-120-AC-021',
      statement: 'Selective invalidation preserves unrelated accepted work.',
      source: 'DKF-120-AC-021',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Calculate dependent affected work through dependency graph traversal.',
        'Preserve unrelated accepted work during selective invalidation.'
      ],
    },
  ],
  architectureConstraints: [
    'DKF core remains general-purpose and host/provider independent.',
    'No silent upstream authority rewrites from implementation agents.',
    'Re-entry preserves accepted upstream artifacts unless directly invalidated.',
  ],
  designConstraints: [
    'Minimum safe re-entry maps: defect -> IMPLEMENT, plan -> PLAN, arch -> DESIGN, spec -> DEFINE.',
    'Upstream spec/arch changes require human approval gates.',
  ],
  securityConstraints: [
    'Discovery events fail-closed on corrupt or missing evidence.',
    'Human approval cannot be bypassed by automated discovery triggers.',
  ],
  risk: {
    level: 3,
    reasons: [
      'Re-entry changes previously accepted planning/authority state.',
      'Improper invalidation can corrupt dependency chains or erase valid work.',
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
    sections: ['4.6 Discovery and controlled re-entry', 'Discovery and re-entry'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['9. Discovery and controlled re-entry'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['8. Task DKF120-T06 — Discovery & Controlled Re-entry'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T06',
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
