/**
 * Development Kit Next-Step Guidance — Types & Context Definitions
 */

export const CANONICAL_LIFECYCLE_STAGES = Object.freeze([
  'UNDERSTAND',
  'DEFINE',
  'DESIGN',
  'PLAN',
  'IMPLEMENT',
  'VERIFY',
  'REVIEW',
  'SIMPLIFY',
  'COMPLETE'
]);

export const RECOMMENDATION_PRIORITIES = Object.freeze({
  PRIMARY: 'primary',
  SECONDARY: 'secondary'
});

export const SAFETY_LEVELS = Object.freeze({
  SAFE: 'safe',
  READ_ONLY: 'read_only',
  CONSEQUENTIAL: 'consequential',
  DESTRUCTIVE: 'destructive'
});

export const VERIFICATION_STATUSES = Object.freeze([
  'passed',
  'failed',
  'unverified'
]);

export const TESTS_STATUSES = Object.freeze([
  'passed',
  'failed'
]);

export const REVIEW_STATUSES = Object.freeze([
  'passed',
  'failed',
  'pending'
]);

export const APPROVAL_STATUSES = Object.freeze([
  'approved',
  'pending',
  'rejected',
  'not_required'
]);

export const POST_SIMPLIFICATION_STATUSES = Object.freeze([
  'passed',
  'failed',
  'unverified',
  'pending'
]);

export const DOCUMENTATION_STATUSES = Object.freeze([
  'current',
  'stale',
  'missing'
]);

export const REPOSITORY_STATUSES = Object.freeze([
  'clean',
  'dirty',
  'failed'
]);

export function validateContextSchema(rawContext, registry = null) {
  if (rawContext === null || typeof rawContext !== 'object' || Array.isArray(rawContext)) {
    return { valid: false, error: 'Context must be a non-null object' };
  }

  if (rawContext.completedCommand !== undefined) {
    if (typeof rawContext.completedCommand !== 'string' || !rawContext.completedCommand.trim()) {
      return { valid: false, error: 'Invalid completedCommand: must be a non-empty string' };
    }
    if (registry && typeof registry.has === 'function') {
      const cmdStr = rawContext.completedCommand.trim();
      const normCmd = cmdStr.startsWith('/dk-') ? cmdStr : (cmdStr.startsWith('/') ? cmdStr : `/dk-${cmdStr}`);
      if (!registry.has(normCmd)) {
        return { valid: false, error: `Unknown command: ${rawContext.completedCommand}` };
      }
    }
  }

  if (rawContext.previousCommand !== undefined) {
    if (typeof rawContext.previousCommand !== 'string' || !rawContext.previousCommand.trim()) {
      return { valid: false, error: 'Invalid previousCommand: must be a non-empty string' };
    }
    if (registry && typeof registry.has === 'function') {
      const prevStr = rawContext.previousCommand.trim();
      const normPrev = prevStr.startsWith('/dk-') ? prevStr : (prevStr.startsWith('/') ? prevStr : `/dk-${prevStr}`);
      if (!registry.has(normPrev)) {
        return { valid: false, error: `Unknown previousCommand: ${rawContext.previousCommand}` };
      }
    }
  }

  if (rawContext.lifecycleStage !== undefined) {
    if (typeof rawContext.lifecycleStage !== 'string' || !CANONICAL_LIFECYCLE_STAGES.includes(rawContext.lifecycleStage.trim().toUpperCase())) {
      return { valid: false, error: `Invalid lifecycle stage: ${rawContext.lifecycleStage}` };
    }
  }

  if (rawContext.verificationStatus !== undefined) {
    if (typeof rawContext.verificationStatus !== 'string' || !VERIFICATION_STATUSES.includes(rawContext.verificationStatus.trim().toLowerCase())) {
      return { valid: false, error: `Invalid verification status: ${rawContext.verificationStatus}` };
    }
  }

  if (rawContext.testsStatus !== undefined) {
    if (typeof rawContext.testsStatus !== 'string' || !TESTS_STATUSES.includes(rawContext.testsStatus.trim().toLowerCase())) {
      return { valid: false, error: `Invalid tests status: ${rawContext.testsStatus}` };
    }
  }

  if (rawContext.reviewStatus !== undefined) {
    if (typeof rawContext.reviewStatus !== 'string' || !REVIEW_STATUSES.includes(rawContext.reviewStatus.trim().toLowerCase())) {
      return { valid: false, error: `Invalid review status: ${rawContext.reviewStatus}` };
    }
  }

  if (rawContext.approvalStatus !== undefined) {
    if (typeof rawContext.approvalStatus !== 'string' || !APPROVAL_STATUSES.includes(rawContext.approvalStatus.trim().toLowerCase())) {
      return { valid: false, error: `Invalid approval status: ${rawContext.approvalStatus}` };
    }
  }

  if (rawContext.postSimplificationVerificationStatus !== undefined) {
    if (typeof rawContext.postSimplificationVerificationStatus !== 'string' || !POST_SIMPLIFICATION_STATUSES.includes(rawContext.postSimplificationVerificationStatus.trim().toLowerCase())) {
      return { valid: false, error: `Invalid post-simplification verification status: ${rawContext.postSimplificationVerificationStatus}` };
    }
  }

  if (rawContext.success !== undefined && typeof rawContext.success !== 'boolean') {
    return { valid: false, error: `Invalid success value: ${rawContext.success} (must be boolean)` };
  }

  if (rawContext.isAutomated !== undefined && typeof rawContext.isAutomated !== 'boolean') {
    return { valid: false, error: `Invalid isAutomated value: ${rawContext.isAutomated} (must be boolean)` };
  }

  if (rawContext.isPaused !== undefined && typeof rawContext.isPaused !== 'boolean') {
    return { valid: false, error: `Invalid isPaused value: ${rawContext.isPaused} (must be boolean)` };
  }

  if (rawContext.isWorkflowComplete !== undefined && typeof rawContext.isWorkflowComplete !== 'boolean') {
    return { valid: false, error: `Invalid isWorkflowComplete value: ${rawContext.isWorkflowComplete} (must be boolean)` };
  }

  if (rawContext.maxRecommendations !== undefined) {
    const num = Number(rawContext.maxRecommendations);
    if (!Number.isInteger(num) || num <= 0) {
      return { valid: false, error: `Invalid maxRecommendations value: ${rawContext.maxRecommendations} (must be positive integer)` };
    }
  }

  if (rawContext.remainingTasks !== undefined) {
    const num = Number(rawContext.remainingTasks);
    if (!Number.isInteger(num) || num < 0) {
      return { valid: false, error: `Invalid remainingTasks value: ${rawContext.remainingTasks} (must be non-negative integer)` };
    }
  }

  if (rawContext.blockers !== undefined) {
    if (!Array.isArray(rawContext.blockers) || !rawContext.blockers.every(b => typeof b === 'string')) {
      return { valid: false, error: 'Invalid blockers value: must be an array of strings' };
    }
  }

  if (rawContext.outstandingApprovals !== undefined) {
    if (!Array.isArray(rawContext.outstandingApprovals) || !rawContext.outstandingApprovals.every(a => typeof a === 'string')) {
      return { valid: false, error: 'Invalid outstandingApprovals value: must be an array of strings' };
    }
  }

  if (rawContext.documentationStatus !== undefined) {
    if (typeof rawContext.documentationStatus !== 'string' || !DOCUMENTATION_STATUSES.includes(rawContext.documentationStatus.trim().toLowerCase())) {
      return { valid: false, error: `Invalid documentation status: ${rawContext.documentationStatus}` };
    }
  }

  if (rawContext.repositoryStatus !== undefined) {
    if (typeof rawContext.repositoryStatus !== 'string' || !REPOSITORY_STATUSES.includes(rawContext.repositoryStatus.trim().toLowerCase())) {
      return { valid: false, error: `Invalid repository status: ${rawContext.repositoryStatus}` };
    }
  }

  return { valid: true };
}

export function normalizeContext(rawContext = {}) {
  const completedCommand = typeof rawContext.completedCommand === 'string'
    ? rawContext.completedCommand.trim()
    : undefined;

  const lifecycleStage = typeof rawContext.lifecycleStage === 'string'
    ? rawContext.lifecycleStage.trim().toUpperCase()
    : undefined;

  let success = true;
  if (rawContext.success !== undefined) {
    if (typeof rawContext.success === 'boolean') {
      success = rawContext.success;
    } else if (rawContext.success === 'true') {
      success = true;
    } else if (rawContext.success === 'false') {
      success = false;
    } else {
      success = Boolean(rawContext.success);
    }
  }

  const verificationStatus = typeof rawContext.verificationStatus === 'string'
    ? rawContext.verificationStatus.trim().toLowerCase()
    : undefined;

  const testsStatus = typeof rawContext.testsStatus === 'string'
    ? rawContext.testsStatus.trim().toLowerCase()
    : undefined;

  const reviewStatus = typeof rawContext.reviewStatus === 'string'
    ? rawContext.reviewStatus.trim().toLowerCase()
    : undefined;

  const approvalStatus = typeof rawContext.approvalStatus === 'string'
    ? rawContext.approvalStatus.trim().toLowerCase()
    : undefined;

  const postSimplificationVerificationStatus = typeof rawContext.postSimplificationVerificationStatus === 'string'
    ? rawContext.postSimplificationVerificationStatus.trim().toLowerCase()
    : undefined;

  const documentationStatus = typeof rawContext.documentationStatus === 'string'
    ? rawContext.documentationStatus.trim().toLowerCase()
    : undefined;

  const repositoryStatus = typeof rawContext.repositoryStatus === 'string'
    ? rawContext.repositoryStatus.trim().toLowerCase()
    : undefined;

  const blockers = Array.isArray(rawContext.blockers)
    ? rawContext.blockers.map(b => String(b).trim()).filter(Boolean)
    : [];

  const outstandingApprovals = Array.isArray(rawContext.outstandingApprovals)
    ? rawContext.outstandingApprovals.map(a => String(a).trim()).filter(Boolean)
    : [];

  const remainingTasks = rawContext.remainingTasks !== undefined
    ? Number(rawContext.remainingTasks)
    : undefined;

  const maxRecommendations = rawContext.maxRecommendations !== undefined
    ? Number(rawContext.maxRecommendations)
    : 3;

  const isAutomated = typeof rawContext.isAutomated === 'boolean'
    ? rawContext.isAutomated
    : (rawContext.isAutomated === 'true' ? true : (rawContext.isAutomated === 'false' ? false : false));

  const isPaused = typeof rawContext.isPaused === 'boolean'
    ? rawContext.isPaused
    : (rawContext.isPaused === 'true' ? true : (rawContext.isPaused === 'false' ? false : false));

  const isWorkflowComplete = typeof rawContext.isWorkflowComplete === 'boolean'
    ? rawContext.isWorkflowComplete
    : (rawContext.isWorkflowComplete === 'true' ? true : (rawContext.isWorkflowComplete === 'false' ? false : false));

  const previousCommand = typeof rawContext.previousCommand === 'string'
    ? rawContext.previousCommand.trim()
    : undefined;

  return {
    completedCommand,
    lifecycleStage,
    success,
    verificationStatus,
    testsStatus,
    reviewStatus,
    approvalStatus,
    postSimplificationVerificationStatus,
    documentationStatus,
    repositoryStatus,
    blockers,
    outstandingApprovals,
    remainingTasks,
    maxRecommendations,
    isAutomated,
    isPaused,
    isWorkflowComplete,
    previousCommand,
    rootDir: rawContext.rootDir || process.cwd(),
    blockerType: rawContext.blockerType || (rawContext.metadata && rawContext.metadata.blockerType) || null,
    metadata: typeof rawContext.metadata === 'object' && rawContext.metadata !== null ? rawContext.metadata : {}
  };
}
