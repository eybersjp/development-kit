#!/usr/bin/env node
// Deterministic PO amendment gate for v0.12 provisional engineering starts.
// Existing formal dependency acceptance/integration rules remain unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlanModel } from '../runtime/orchestration/plan-validator.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelFile = 'docs/04-architecture/dkf-scale-context-iteration-v0.12-plan-model.json';
const policyFile = 'docs/04-architecture/dkf-v0.12-parallel-execution-amendment.json';
const model = JSON.parse(fs.readFileSync(path.join(ROOT, modelFile), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, policyFile), 'utf8'));
const failures = [];
const check = (condition, code) => { if (!condition) failures.push(code); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const ids = Array.from({ length: 10 }, (_, i) => 'DKF120-T' + String(i + 1).padStart(2, '0'));
const provisional = ids.slice(4);
const exactEdges = ids.slice(1).map((id, i) => ids[i] + '->' + id);
const criteria = Array.from({ length: 40 }, (_, i) => 'DKF-120-AC-' + String(i + 1).padStart(3, '0'));
const graph = validatePlanModel({
  tasks: model.tasks,
  declaredTaskCount: model.declaredTaskCount,
  declaredDependencyEdges: model.declaredDependencyEdges,
  requiredResources: model.requiredResources,
  requiredAcceptanceCriteria: model.requiredAcceptanceCriteria,
  availableConfigurationRequirements: [],
});

check(graph.valid, 'BASELINE_PLAN_INVALID');
check(model.planId === 'DKF-V012-SCALE-CONTEXT-ITERATION', 'PLAN_ID_MISMATCH');
check(equal(model.tasks.map(task => task.id), ids), 'TASK_ID_OR_ORDER_CHANGED');
check(equal(graph.computed.dependencyEdges, [...exactEdges].sort()), 'ACCEPTANCE_DAG_CHANGED');
check(equal([...model.requiredAcceptanceCriteria].sort(), [...criteria].sort()), 'REQUIRED_CRITERIA_CHANGED');
check(model.declaredTaskCount === 10, 'TASK_COUNT_CHANGED');
check(policy.schemaVersion === '1.0.0', 'AMENDMENT_SCHEMA_UNKNOWN');
check(policy.planId === model.planId, 'AMENDMENT_PLAN_MISMATCH');
check(policy.authority === 'https://github.com/eybersjp/development-kit/issues/74', 'PO_AUTHORITY_MISSING');
check(policy.preserveOriginalPlanFingerprint === true, 'CANONICAL_PLAN_FINGERPRINT_MUST_REMAIN');
check(policy.implementationPolicy?.parallelProvisionalStartEnabled === true, 'PARALLEL_START_NOT_AUTHORIZED');
check(equal(policy.implementationPolicy?.taskIds, provisional), 'PROVISIONAL_TASK_SCOPE_CHANGED');
check(policy.implementationPolicy?.requiresIsolatedWork === true, 'ISOLATION_NOT_REQUIRED');
check(policy.implementationPolicy?.requiresProvisionalStatus === true, 'PROVISIONAL_STATUS_NOT_REQUIRED');
check(policy.acceptancePolicy?.requiresAcceptedDependencies === true, 'ACCEPTANCE_DEPENDENCIES_WEAKENED');
check(policy.acceptancePolicy?.requiresIndependentReview === true, 'INDEPENDENT_REVIEW_WEAKENED');
check(policy.acceptancePolicy?.requiresDeterministicGate === true, 'DETERMINISTIC_ACCEPTANCE_WEAKENED');
check(policy.integrationPolicy?.requiresAcceptedDependencies === true, 'INTEGRATION_DEPENDENCIES_WEAKENED');
check(policy.integrationPolicy?.requiresOrderedIntegration === true, 'INTEGRATION_ORDER_WEAKENED');
check(policy.releasePolicy?.requiresAllTenTasksAccepted === true, 'RELEASE_TASK_GATE_WEAKENED');
check(policy.releasePolicy?.requiresExplicitProductOwnerApproval === true, 'PO_RELEASE_APPROVAL_WEAKENED');
check(policy.releasePolicy?.authorizedToPublish === false, 'PREMATURE_PUBLICATION_AUTHORIZED');
check(policy.nonWaivable?.retainFullWindowsLegacyRestore === true, 'WINDOWS_RESTORE_SCOPE_WEAKENED');
check(policy.nonWaivable?.issue73OpenUntilIndependentlyVerified === true, 'ISSUE73_WEAKENED');
check(policy.nonWaivable?.hostileSameUidDeferralOnlyInIssue72 === true, 'ISSUE72_BOUNDARY_WEAKENED');

const result = {
  amendmentId: policy.amendmentId,
  baselinePlan: model.planId,
  valid: failures.length === 0,
  provisionalStartTaskIds: provisional,
  unchangedAcceptanceEdges: exactEdges,
  requiredAcceptanceCriteria: 40,
  issues: failures,
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (!result.valid) process.exitCode = 1;
