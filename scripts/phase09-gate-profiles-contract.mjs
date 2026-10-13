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
  id: 'DKF120-T07',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Extend current gate selection into composable, project-neutral verification profiles that resolve from contract, risk, and target capabilities while preserving mandatory control coverage fail-closed.',
  scope: {
    in: [
      'runtime/orchestration/gate-profiles.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/gate-profile.schema.json',
      'scripts/gate-profiles.test.mjs',
      'scripts/phase09-gate-profiles-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md'
    ],
    out: [
      'Verification Extension SDK',
      'Complexity Delta Guard',
      'Control Center v0.12 integration',
      'Application-specific gate names in DKF core',
      'Suppression of mandatory security, design, or human gates'
    ],
  },
  requirements: [
    'Extend existing gate selection behavior with composable gate profiles.',
    'Resolve profiles generically from contract, risk, target capabilities, and project configuration.',
    'Permit project extensions to add verification classes.',
    'Preserve mandatory security, design, configuration, and human-approval gates.',
    'Fail closed on unresolved or unknown required profiles.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-022',
      statement: 'Gate profiles resolve generically from contract/risk/target capabilities/project configuration.',
      source: 'DKF-120-AC-022',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Extend existing gate selection behavior with composable gate profiles.',
        'Resolve profiles generically from contract, risk, target capabilities, and project configuration.'
      ],
    },
    {
      id: 'DKF-120-AC-023',
      statement: 'Profiles cannot downgrade existing mandatory verification, control, or human-approval gates.',
      source: 'DKF-120-AC-023',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Preserve mandatory security, design, configuration, and human-approval gates.',
        'Fail closed on unresolved or unknown required profiles.'
      ],
    },
  ],
  architectureConstraints: [
    'DKF core remains general-purpose and host/provider independent.',
    'Gate resolution must never reduce mandatory control coverage.',
    'No application-specific gate names or business rules in DKF core.',
  ],
  designConstraints: [
    'Gate profiles compose verification classes, reviewers, control domains, and human approvals.',
    'Attempted downgrades of baseline gates throw GateProfileError.',
  ],
  securityConstraints: [
    'Unknown required profiles fail closed immediately.',
    'Mandatory security control domains cannot be stripped by any profile.',
  ],
  risk: {
    level: 3,
    reasons: [
      'Gate resolution governs orchestration review and verification authority.',
      'A defect could allow unreviewed code or bypass mandatory controls.',
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
    sections: ['4.7 Generic Gate Profiles', 'Gate profiles'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['10. Gate Profiles'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['9. Task DKF120-T07 — Generic Gate Profiles'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T07',
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
