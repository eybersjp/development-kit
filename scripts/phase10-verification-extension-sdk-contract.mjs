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
  id: 'DKF120-T08',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Provide generic verification primitives (numeric tolerances, invariant checks, reference dataset freshness) through which projects add verification extensions without modifying DKF core.',
  scope: {
    in: [
      'runtime/orchestration/verification-extension-sdk.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/verification-extension.schema.json',
      'scripts/verification-extension-sdk.test.mjs',
      'scripts/phase10-verification-extension-sdk-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md'
    ],
    out: [
      'Complexity Delta Guard',
      'Control Center v0.12 integration',
      'Domain formulas (solar, finance, CAD, healthcare) hardcoded in DKF core',
      'Adversarial extension self-certification bypassing mandatory gates'
    ],
  },
  requirements: [
    'Project-owned verification extension registration contract.',
    'Generic absolute and relative numeric tolerance primitives.',
    'Generic invariant evaluation and custom deterministic verifier support.',
    'Reference/golden dataset fingerprinting and freshness verification.',
    'Results flow through existing evidence, trust, and gate semantics.',
    'Support at least two materially different example extensions proving core generality.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-024',
      statement: 'Project-owned verification extensions can be added without modifying DKF core.',
      source: 'DKF-120-AC-024',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Project-owned verification extension registration contract.',
        'Results flow through existing evidence, trust, and gate semantics.'
      ],
    },
    {
      id: 'DKF-120-AC-025',
      statement: 'Generic numeric checks support absolute and relative tolerances.',
      source: 'DKF-120-AC-025',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Generic absolute and relative numeric tolerance primitives.'
      ],
    },
    {
      id: 'DKF-120-AC-026',
      statement: 'Project-supplied invariants/custom validators can block acceptance through normal evidence/gate semantics.',
      source: 'DKF-120-AC-026',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Generic invariant evaluation and custom deterministic verifier support.'
      ],
    },
    {
      id: 'DKF-120-AC-027',
      statement: 'Reference/golden dataset fingerprints participate in evidence freshness.',
      source: 'DKF-120-AC-027',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Reference/golden dataset fingerprinting and freshness verification.'
      ],
    },
    {
      id: 'DKF-120-AC-037',
      statement: 'DKF core contains no application-specific domain verification rules.',
      source: 'DKF-120-AC-037',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Project-owned verification extension registration contract.',
        'Support at least two materially different example extensions proving core generality.'
      ],
    },
    {
      id: 'DKF-120-AC-038',
      statement: 'At least two materially different example verification extensions can use the same SDK without core changes.',
      source: 'DKF-120-AC-038',
      verificationType: ['test'],
      requiredEvidence: true,
      requirementIds: [
        'Support at least two materially different example extensions proving core generality.'
      ],
    },
  ],
  architectureConstraints: [
    'DKF core remains general-purpose and host/provider independent.',
    'No application-specific formulas or domain rules in core.',
    'Extensions cannot self-certify or suppress required gates.',
  ],
  designConstraints: [
    'Primitves operate strictly on standard JavaScript types (numbers, functions, datasets).',
    'Evidence integrity follows canonical SHA-256 fingerprinting.',
  ],
  securityConstraints: [
    'Malformed extension registration fails closed.',
    'Missing or modified reference datasets invalidate verification evidence.',
  ],
  risk: {
    level: 3,
    reasons: [
      'Extensions participate in verification and acceptance evaluation.',
      'Unsound primitives could cause false-positive acceptance of invalid outputs.',
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
    sections: ['4.8 Verification Extension SDK', 'Verification Extension SDK'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['11. Domain Verification Extension SDK'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['10. Task DKF120-T08 — Verification Extension SDK'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T08',
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
