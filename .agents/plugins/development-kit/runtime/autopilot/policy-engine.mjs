/**
 * Development Kit Autopilot — Policy Engine
 *
 * Implements 3 autonomy levels (guided-autopilot, high-autonomy, review-every-stage),
 * Table 1 (14 mandatory non-bypassable gates), Table 2 (mode-dependent gates),
 * Table 3 (pre-authorized staging targets), and Table 4 (informational checkpoints).
 */

import fs from 'node:fs';
import path from 'node:path';

export const MANDATORY_GATES = [
  'gate_scope_acceptance',
  'gate_destructive_file_ops',
  'gate_irreversible_db_drops',
  'gate_auth_changes',
  'gate_secret_handling',
  'gate_security_risk_acceptance',
  'gate_package_publishing',
  'gate_production_release_tag',
  'gate_production_deployment',
  'gate_git_push',
  'gate_pull_request_creation',
  'gate_pull_request_merge',
  'gate_branch_deletion',
  'gate_requirement_ambiguity'
];

export function isGateMandatory(gateId) {
  return MANDATORY_GATES.includes(gateId);
}

export function requiresApproval(gateId, autonomyLevel = 'guided-autopilot', targetConfig = null) {
  // Mandatory gates ALWAYS require approval in ALL autonomy levels
  if (isGateMandatory(gateId)) {
    // Special exception for staging deployment under high-autonomy with valid pre-authorization
    if (gateId === 'gate_staging_deployment' && autonomyLevel === 'high-autonomy' && targetConfig) {
      if (isTargetPreAuthorized(targetConfig)) {
        return false;
      }
    }
    return true;
  }

  if (autonomyLevel === 'review-every-stage') {
    return true;
  }

  if (autonomyLevel === 'guided-autopilot') {
    const guidedGates = ['gate_architecture_design', 'gate_task_risk_ordering', 'gate_stage_boundary'];
    return guidedGates.includes(gateId);
  }

  // high-autonomy automatically executes non-mandatory reversible gates
  return false;
}

export function isTargetPreAuthorized(targetConfig, rootDir = process.cwd()) {
  if (!targetConfig || !targetConfig.targetId) return false;

  const policyFile = path.join(rootDir, '.development-kit', 'autopilot', 'preauthorized-targets.json');
  if (!fs.existsSync(policyFile)) return false;

  try {
    const data = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
    const target = data.targets?.find(t => t.targetId === targetConfig.targetId);

    if (!target) return false;

    // Check expiry
    if (target.expiresAt && Date.now() > Date.parse(target.expiresAt)) {
      return false;
    }

    // Exclude production deployments, DB drops, credentials, risk acceptances, branch deletions, PR merges
    const prohibitedOps = [
      'deploy_production',
      'drop_database',
      'manage_credentials',
      'accept_security_risk',
      'delete_branch',
      'merge_pull_request'
    ];

    const hasProhibited = target.approvedOperations?.some(op => prohibitedOps.includes(op));
    if (hasProhibited) return false;

    return target.approvedOperations?.includes(targetConfig.operation);
  } catch {
    return false;
  }
}
