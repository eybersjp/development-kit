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
  id: 'DKF120-T09',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Add inexpensive deterministic complexity signals from repository/diff facts to avoid unnecessary heavy review while retaining full Ponytail simplicity governance.',
  scope: {
    in: [
      'runtime/orchestration/complexity-delta.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/complexity-delta.schema.json',
      'scripts/complexity-delta.test.mjs',
      'scripts/phase11-complexity-delta-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md'
    ],
    out: [
      'Control Center v0.12 integration',
      'LLM-only complexity scores represented as deterministic fact',
      'Replacing the simplicity reviewer',
      'Removing currently mandatory simplicity review'
    ],
  },
  requirements: [
    'Derive deterministic complexity facts from repository/diff information.',
    'Define policy thresholds and conditions.',
    'Trigger existing simplicity review where required by policy or risk.',
    'Never remove a currently mandatory simplicity review.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-028',
      statement: 'Complexity Delta is deterministic from repository/diff facts used by the implementation.',
      source: 'DKF-120-AC-028',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Derive deterministic complexity facts from repository/diff information.'
      ],
    },
    {
      id: 'DKF-120-AC-029',
      statement: 'Complexity policy may trigger, but may not remove, the full simplicity review where existing policy requires it.',
      source: 'DKF-120-AC-029',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Define policy thresholds and conditions.',
        'Trigger existing simplicity review where required by policy or risk.',
        'Never remove a currently mandatory simplicity review.'
      ],
    },
  ],
  architectureConstraints: [
    'DKF core remains general-purpose and host/provider independent.',
    'Complexity Delta is an observational signal, not a bypass mechanism.',
    'Ponytail Exclusions (security, validation, error handling, a11y, data integrity, tests) are strictly preserved.',
  ],
  designConstraints: [
    'Identical diff inputs produce identical hash and deltaId.',
  ],
  securityConstraints: [
    'High-risk changes (risk level >= 3) unconditionally require simplicity review.',
  ],
  risk: {
    level: 2,
    reasons: [
      'Governance of simplicity reviews across increments.',
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
    sections: ['4.9 Complexity Delta Guard', 'Complexity'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['12. Complexity Delta Guard'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['11. Task DKF120-T09 — Complexity Delta Guard'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T09',
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
