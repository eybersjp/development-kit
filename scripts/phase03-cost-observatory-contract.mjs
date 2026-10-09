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
  id: 'DKF120-T01',
  projectId: 'proj_cad505c1-901d-46f0-a0d1-297598bdae18',
  status: 'approved',
  objective: 'Add generic, truthful orchestration-cost measurement before optimising later v0.12 components.',
  scope: {
    in: [
      'runtime/orchestration/cost-observatory.mjs',
      'runtime/orchestration/index.mjs',
      'schemas/cost-record.schema.json',
      'scripts/cost-observatory.test.mjs',
      'scripts/phase03-cost-observatory-contract.mjs',
      'package.json',
      '.github/workflows/ci.yml',
      'docs/',
      'memory.md'
    ],
    out: [
      'Workspace Target Engine',
      'Execution Capsules or context caching',
      'State Engine V2',
      'Lifecycle Instances',
      'Discovery/re-entry',
      'Gate Profiles',
      'Verification Extension SDK',
      'Complexity Delta Guard',
      'Provider-specific mandatory SDKs',
      'Application-specific or industry-specific business logic'
    ],
  },
  requirements: [
    'Record DKF-controlled measurable orchestration counts.',
    'Accept optional host/provider token telemetry without requiring it.',
    'Keep unavailable provider/host metrics null rather than inferred.',
    'Provide canonical newline-normalised logical text/context comparison.',
    'Preserve the existing historical static token audit unchanged.',
    'Provide before/after cost-record comparison for later v0.12 replay evidence.',
  ],
  acceptanceCriteria: [
    {
      id: 'DKF-120-AC-001',
      statement: 'Every instrumented orchestration operation can emit a cost record containing only measured or deterministic-estimate fields.',
      source: 'DKF-120-AC-001',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-002',
      statement: 'Provider token fields remain null/unavailable unless supplied by the host/provider.',
      source: 'DKF-120-AC-002',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-003',
      statement: 'New cross-platform logical text/context comparisons normalise newline representation while preserving historical audit compatibility.',
      source: 'DKF-120-AC-003',
      verificationType: ['test'],
      requiredEvidence: true,
    },
    {
      id: 'DKF-120-AC-033',
      statement: 'Release evidence can include baseline-versus-v0.12 cost comparison from validated cost records.',
      source: 'DKF-120-AC-033',
      verificationType: ['test'],
      requiredEvidence: true,
    },
  ],
  architectureConstraints: [
    'DKF core remains general-purpose and host/provider independent.',
    'Cost telemetry is observational and must not change deterministic acceptance semantics.',
    'Existing token/context hardening is extended rather than replaced.',
    'Cost records require numeric usage observations only and do not require provider credentials or secrets.',
    'Unavailable host/provider telemetry must never be fabricated.',
  ],
  designConstraints: [],
  securityConstraints: [],
  risk: {
    level: 2,
    reasons: ['Instrumentation crosses orchestration boundaries but must remain non-authoritative.'],
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
    sections: ['4.1 Cost Observatory', 'DKF-120-AC-001', 'DKF-120-AC-002', 'DKF-120-AC-003', 'DKF-120-AC-033'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-technical-design.md',
    kind: 'technical-design',
    authority: 'required',
    sections: ['6. Cost Observatory'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-v0.12-implementation-plan.md',
    kind: 'implementation-plan',
    authority: 'required',
    sections: ['3. Task DKF120-T01 — Cost Observatory'],
  },
  {
    path: 'docs/04-architecture/dkf-scale-context-iteration-phase01-baseline.md',
    kind: 'baseline-evidence',
    authority: 'supporting',
    sections: ['4. Existing static token baseline', '7. Observability gaps'],
  },
];

const result = ensureDevelopmentContract({
  rootDir: ROOT,
  projectId: task.projectId,
  task,
  authoritativeSources,
  contractId: 'INC-DKF120-T01',
});

validateDevelopmentContract(result.contract);
const gates = selectRequiredGates(result.contract);
if (JSON.stringify(gates.reviewers) !== JSON.stringify(['code-reviewer'])) {
  throw new Error(`Unexpected T01 reviewer gates: ${gates.reviewers.join(', ')}`);
}
if (gates.controlDomains.length > 0 || gates.humanApprovals.length > 0) {
  throw new Error('T01 unexpectedly derived specialist control or human-approval gates');
}
const staleness = checkContractStaleness(result.contract, ROOT);
if (staleness.stale) {
  throw new Error('DKF120-T01 Development Contract is stale immediately after creation');
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
  stale: staleness.stale,
}, null, 2)}\n`);
