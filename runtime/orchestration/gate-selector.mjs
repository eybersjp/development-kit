import { validateDevelopmentContract } from './development-contract.mjs';

export class GateSelectionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GateSelectionError';
  }
}

function unique(values) {
  return [...new Set(values)].sort();
}

export function selectRequiredGates(contract, { touchesUi = false, securitySensitive = false, architectureSensitive = false } = {}) {
  validateDevelopmentContract(contract);
  const risk = contract.risk.level;
  const verification = unique(['specification', ...contract.requiredVerification]);
  const reviewers = new Set(contract.requiredReviewers);
  const humanApprovals = new Set(contract.approvalPolicy?.requiredApprovals ?? []);

  if (risk >= 1) reviewers.add('code-reviewer');
  if (risk >= 3 || architectureSensitive) reviewers.add('architecture-reviewer');
  if (risk >= 3 || securitySensitive || contract.securityConstraints.length > 0) reviewers.add('security-reviewer');
  if (touchesUi || contract.designConstraints.length > 0) reviewers.add('design-reviewer');
  if (risk >= 4) humanApprovals.add('consequential-action');

  const controlDomains = new Set(contract.approvalPolicy?.requiredControlDomains ?? []);
  if (securitySensitive || contract.securityConstraints.length > 0 || risk >= 3) controlDomains.add('security');

  return Object.freeze({
    verification,
    reviewers: unique([...reviewers]),
    controlDomains: unique([...controlDomains]),
    humanApprovals: unique([...humanApprovals]),
  });
}
