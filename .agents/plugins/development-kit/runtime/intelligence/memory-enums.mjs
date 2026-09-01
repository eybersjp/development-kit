/**
 * Development Kit Intelligence — Memory Record & Settings Enums
 *
 * Defines canonical schemas, type enums, and authority hierarchies for DK Memory
 * in accordance with the DK v0.7 Intelligence Architecture.
 */

export const MEMORY_SCHEMA_VERSION = 1;

export const MemoryType = Object.freeze({
  FACT: 'fact',
  DECISION: 'decision',
  CONSTRAINT: 'constraint',
  PREFERENCE: 'preference',
  ARCHITECTURE: 'architecture',
  LESSON: 'lesson',
  INCIDENT: 'incident',
  VERIFICATION: 'verification',
  RESEARCH: 'research',
  ARTIFACT: 'artifact',
  RELATIONSHIP: 'relationship',
  SKILL_REFERENCE: 'skill-reference',
});

export const MemoryScope = Object.freeze({
  PROJECT: 'project',
  WORKSPACE: 'workspace',
  USER: 'user',
});

export const MemoryAuthority = Object.freeze({
  USER_APPROVED: 'user-approved',
  REPOSITORY_VERIFIED: 'repository-verified',
  SYSTEM_VERIFIED: 'system-verified',
  EXTERNAL_VERIFIED: 'external-verified',
  INFERRED: 'inferred',
  IMPORTED_UNTRUSTED: 'imported-untrusted',
});

export const MemoryStatus = Object.freeze({
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
  ARCHIVED: 'archived',
  STALE: 'stale',
});

export const CandidateStatus = Object.freeze({
  PENDING: 'pending',
  PROMOTED: 'promoted',
  REJECTED: 'rejected',
  IGNORED: 'ignored',
});

export const LifecycleStage = Object.freeze({
  UNDERSTAND: 'UNDERSTAND',
  DEFINE: 'DEFINE',
  DESIGN: 'DESIGN',
  PLAN: 'PLAN',
  IMPLEMENT: 'IMPLEMENT',
  VERIFY: 'VERIFY',
  REVIEW: 'REVIEW',
  SIMPLIFY: 'SIMPLIFY',
  COMPLETE: 'COMPLETE',
});

export const KNOWN_MEMORY_TYPES = new Set(Object.values(MemoryType));
export const KNOWN_MEMORY_SCOPES = new Set(Object.values(MemoryScope));
export const KNOWN_MEMORY_AUTHORITIES = new Set(Object.values(MemoryAuthority));
export const KNOWN_MEMORY_STATUSES = new Set(Object.values(MemoryStatus));
export const KNOWN_CANDIDATE_STATUSES = new Set(Object.values(CandidateStatus));
export const KNOWN_LIFECYCLE_STAGES = new Set(Object.values(LifecycleStage));
