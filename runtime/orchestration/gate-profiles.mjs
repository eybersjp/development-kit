import { selectRequiredGates, GateSelectionError } from './gate-selector.mjs';
import { validateDevelopmentContract } from './development-contract.mjs';

export const GATE_PROFILE_SCHEMA_VERSION = '1.0.0';

export class GateProfileError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'GateProfileError';
    this.details = details;
  }
}

function unique(values) {
  return [...new Set(values)].sort();
}

export function validateGateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new GateProfileError('Gate profile must be an object');
  }

  if (profile.schemaVersion !== GATE_PROFILE_SCHEMA_VERSION) {
    throw new GateProfileError(`Unsupported gate profile schema version: ${profile.schemaVersion}`);
  }

  if (typeof profile.profileId !== 'string' || !/^gp-[a-zA-Z0-9_-]{3,64}$/.test(profile.profileId)) {
    throw new GateProfileError(`Invalid profileId: ${profile.profileId}`);
  }

  if (typeof profile.name !== 'string' || !profile.name.trim()) {
    throw new GateProfileError('profile name must be a non-empty string');
  }

  for (const field of ['verificationClasses', 'requiredReviewers', 'requiredControlDomains', 'requiredHumanApprovals']) {
    if (!Array.isArray(profile[field])) {
      throw new GateProfileError(`${field} must be an array`);
    }
  }

  return true;
}

export const BUILTIN_GATE_PROFILES = Object.freeze({
  'gp-standard': {
    schemaVersion: GATE_PROFILE_SCHEMA_VERSION,
    profileId: 'gp-standard',
    name: 'Standard Engineering Gate',
    description: 'Standard baseline gate requiring specification and tests',
    verificationClasses: ['specification', 'tests'],
    requiredReviewers: ['code-reviewer'],
    requiredControlDomains: [],
    requiredHumanApprovals: [],
  },
  'gp-high-assurance': {
    schemaVersion: GATE_PROFILE_SCHEMA_VERSION,
    profileId: 'gp-high-assurance',
    name: 'High Assurance Gate',
    description: 'High assurance gate requiring architecture and security reviewers',
    verificationClasses: ['specification', 'tests', 'architecture-verification', 'security-audit'],
    requiredReviewers: ['architecture-reviewer', 'code-reviewer', 'security-reviewer'],
    requiredControlDomains: ['security'],
    requiredHumanApprovals: [],
  },
  'gp-ui-design': {
    schemaVersion: GATE_PROFILE_SCHEMA_VERSION,
    profileId: 'gp-ui-design',
    name: 'UI and Design System Gate',
    description: 'UI gate requiring design review and browser runtime verification',
    verificationClasses: ['specification', 'tests', 'browser-runtime-verification'],
    requiredReviewers: ['code-reviewer', 'design-reviewer'],
    requiredControlDomains: ['design'],
    requiredHumanApprovals: [],
  },
  'gp-consequential': {
    schemaVersion: GATE_PROFILE_SCHEMA_VERSION,
    profileId: 'gp-consequential',
    name: 'Consequential Action Gate',
    description: 'Consequential gate requiring human approval',
    verificationClasses: ['specification', 'tests'],
    requiredReviewers: ['code-reviewer'],
    requiredControlDomains: [],
    requiredHumanApprovals: ['consequential-action'],
  },
});

/**
 * Resolves effective gates for a contract against composable gate profiles.
 * Preserves the invariant: Gate Profiles may ADD or COMPOSE verification classes,
 * but can NEVER downgrade or suppress existing mandatory gates.
 */
export function resolveGateProfiles({
  contract,
  profileIds = [],
  customProfiles = {},
  targetCapabilities = [],
  options = {},
} = {}) {
  validateDevelopmentContract(contract);

  // 1. Compute mandatory baseline gates from contract and context
  const baseline = selectRequiredGates(contract, options);

  // 2. Resolve requested profiles; project profiles may add gates but may not
  // impersonate a built-in profile ID to suppress its required controls.
  if (!Array.isArray(profileIds) || !Array.isArray(targetCapabilities) ||
      !customProfiles || typeof customProfiles !== 'object' || Array.isArray(customProfiles)) {
    throw new GateProfileError('Gate profile resolution inputs are malformed');
  }
  for (const id of Object.keys(customProfiles)) {
    if (Object.hasOwn(BUILTIN_GATE_PROFILES, id)) {
      throw new GateProfileError(`Built-in gate profile cannot be overridden: ${id}`);
    }
  }
  const profiles = [];
  for (const id of profileIds) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new GateProfileError('Profile IDs must be nonempty strings');
    }
    const profile = customProfiles[id] || BUILTIN_GATE_PROFILES[id];
    if (!profile) {
      // Fail closed on unknown required profile (AC-023)
      throw new GateProfileError(`Unknown required gate profile: ${id}`);
    }
    validateGateProfile(profile);
    if (profile.profileId !== id) {
      throw new GateProfileError('Custom gate profile ID does not match requested ID');
    }
    profiles.push(profile);
  }

  // Auto-resolve profiles from target capabilities if specified
  if (targetCapabilities.includes('ui') && !profileIds.includes('gp-ui-design')) {
    profiles.push(BUILTIN_GATE_PROFILES['gp-ui-design']);
  }
  if (contract.risk.level >= 3 && !profileIds.includes('gp-high-assurance')) {
    profiles.push(BUILTIN_GATE_PROFILES['gp-high-assurance']);
  }

  // 3. Compose verification classes, reviewers, control domains, and human approvals
  const verification = new Set(baseline.verification);
  const reviewers = new Set(baseline.reviewers);
  const controlDomains = new Set(baseline.controlDomains);
  const humanApprovals = new Set(baseline.humanApprovals);

  for (const p of profiles) {
    for (const v of p.verificationClasses) verification.add(v);
    for (const r of p.requiredReviewers) reviewers.add(r);
    for (const c of p.requiredControlDomains) controlDomains.add(c);
    for (const h of p.requiredHumanApprovals) humanApprovals.add(h);
  }

  // 4. Invariant: verify that no baseline mandatory gate was reduced!
  for (const bReviewer of baseline.reviewers) {
    if (!reviewers.has(bReviewer)) {
      throw new GateProfileError(`Attempted mandatory-gate downgrade: reviewer ${bReviewer} missing`);
    }
  }
  for (const bDomain of baseline.controlDomains) {
    if (!controlDomains.has(bDomain)) {
      throw new GateProfileError(`Attempted mandatory-gate downgrade: control domain ${bDomain} missing`);
    }
  }
  for (const bApproval of baseline.humanApprovals) {
    if (!humanApprovals.has(bApproval)) {
      throw new GateProfileError(`Attempted mandatory-gate downgrade: human approval ${bApproval} missing`);
    }
  }

  return Object.freeze({
    appliedProfiles: profiles.map((p) => p.profileId),
    verification: unique([...verification]),
    reviewers: unique([...reviewers]),
    controlDomains: unique([...controlDomains]),
    humanApprovals: unique([...humanApprovals]),
    configurationReadiness: baseline.configurationReadiness,
  });
}

/**
 * The persisted, approved Development Contract is the sole authority for gate
 * profile selection at BOTH run creation and acceptance. A context capsule can
 * describe the selected profiles but cannot weaken this authoritative policy.
 */
export function resolveContractGateProfiles(contract, options = {}) {
  validateDevelopmentContract(contract);
  const policy = contract.approvalPolicy ?? {};
  const profileIds = policy.requiredGateProfileIds ?? [];
  const customProfiles = policy.customGateProfiles ?? {};
  const targetCapabilities = policy.targetCapabilities ?? [];
  if (!Array.isArray(profileIds) || !Array.isArray(targetCapabilities) ||
      !customProfiles || typeof customProfiles !== 'object' || Array.isArray(customProfiles)) {
    throw new GateProfileError('Invalid persisted contract gate-profile policy');
  }
  if (profileIds.length === 0 && Object.keys(customProfiles).length === 0 &&
      targetCapabilities.length === 0 && (contract.risk?.level ?? 0) < 3) {
    return selectRequiredGates(contract, options);
  }
  return resolveGateProfiles({
    contract, profileIds, customProfiles, targetCapabilities, options,
  });
}
