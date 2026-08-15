/**
 * Development Kit Intelligence — Memory Record & Settings Schema Validation
 *
 * Provides zero-dependency runtime schema validation and domain invariant validation
 * for memory records, memory candidates, scopes, provenance, and settings.
 */

import {
  MEMORY_SCHEMA_VERSION,
  KNOWN_MEMORY_TYPES,
  KNOWN_MEMORY_SCOPES,
  KNOWN_MEMORY_AUTHORITIES,
  KNOWN_MEMORY_STATUSES,
  KNOWN_CANDIDATE_STATUSES,
  KNOWN_LIFECYCLE_STAGES,
  MemoryAuthority,
  MemoryStatus,
} from './memory-enums.mjs';

export class MemoryValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'MemoryValidationError';
    this.details = details;
  }
}

/**
 * Validates a MemoryRecord object against v0.7 invariants.
 */
export function validateMemoryRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new MemoryValidationError('Memory record must be a non-null object');
  }

  if (typeof record.id !== 'string' || !record.id.trim()) {
    throw new MemoryValidationError('Memory record must have a non-empty string id');
  }

  if (record.schemaVersion !== MEMORY_SCHEMA_VERSION) {
    throw new MemoryValidationError(
      `Unsupported schemaVersion ${record.schemaVersion}; expected ${MEMORY_SCHEMA_VERSION}`,
    );
  }

  if (!KNOWN_MEMORY_TYPES.has(record.type)) {
    throw new MemoryValidationError(`Invalid or unknown memory type: ${record.type}`);
  }

  if (!KNOWN_MEMORY_SCOPES.has(record.scope)) {
    throw new MemoryValidationError(`Invalid or unknown memory scope: ${record.scope}`);
  }

  if (typeof record.projectId !== 'string' || !record.projectId.trim()) {
    throw new MemoryValidationError('Memory record must specify a non-empty projectId');
  }

  if (typeof record.subject !== 'string' || !record.subject.trim()) {
    throw new MemoryValidationError('Memory record must have a non-empty string subject');
  }

  if (typeof record.content !== 'string' || !record.content.trim()) {
    throw new MemoryValidationError('Memory record must have non-empty string content');
  }

  if (!KNOWN_MEMORY_AUTHORITIES.has(record.authority)) {
    throw new MemoryValidationError(`Invalid memory authority: ${record.authority}`);
  }

  if (
    typeof record.confidence !== 'number' ||
    Number.isNaN(record.confidence) ||
    record.confidence < 0 ||
    record.confidence > 1
  ) {
    throw new MemoryValidationError('Memory record confidence must be a number between 0.0 and 1.0');
  }

  if (!KNOWN_MEMORY_STATUSES.has(record.status)) {
    throw new MemoryValidationError(`Invalid memory status: ${record.status}`);
  }

  if (record.lifecycleStages !== undefined && record.lifecycleStages !== null) {
    if (!Array.isArray(record.lifecycleStages)) {
      throw new MemoryValidationError('lifecycleStages must be an array of known lifecycle stages if provided');
    }
    for (const stage of record.lifecycleStages) {
      if (!KNOWN_LIFECYCLE_STAGES.has(stage)) {
        throw new MemoryValidationError(`Invalid lifecycleStage in lifecycleStages: ${stage}`);
      }
    }
  }

  if (!record.source || typeof record.source !== 'object' || Array.isArray(record.source)) {
    throw new MemoryValidationError('Memory record must include a source object');
  }

  if (typeof record.source.type !== 'string' || !record.source.type.trim()) {
    throw new MemoryValidationError('Memory source must specify a non-empty string type');
  }

  if (typeof record.createdAt !== 'string' || Number.isNaN(Date.parse(record.createdAt))) {
    throw new MemoryValidationError('Memory record must have a valid ISO createdAt timestamp string');
  }

  if (typeof record.updatedAt !== 'string' || Number.isNaN(Date.parse(record.updatedAt))) {
    throw new MemoryValidationError('Memory record must have a valid ISO updatedAt timestamp string');
  }

  if (record.expiresAt !== null && record.expiresAt !== undefined) {
    if (typeof record.expiresAt !== 'string' || Number.isNaN(Date.parse(record.expiresAt))) {
      throw new MemoryValidationError('Memory record expiresAt must be null or a valid ISO timestamp string');
    }
  }

  if (record.supersedes !== null && record.supersedes !== undefined) {
    if (typeof record.supersedes !== 'string' || !record.supersedes.trim()) {
      throw new MemoryValidationError('supersedes must be null or a non-empty string id');
    }
    if (record.supersedes === record.id) {
      throw new MemoryValidationError('A memory record cannot supersede itself');
    }
  }

  if (record.supersededBy !== null && record.supersededBy !== undefined) {
    if (typeof record.supersededBy !== 'string' || !record.supersededBy.trim()) {
      throw new MemoryValidationError('supersededBy must be null or a non-empty string id');
    }
    if (record.supersededBy === record.id) {
      throw new MemoryValidationError('A memory record cannot be superseded by itself');
    }
  }

  if (record.tags !== undefined && record.tags !== null) {
    if (!Array.isArray(record.tags) || !record.tags.every((t) => typeof t === 'string')) {
      throw new MemoryValidationError('tags must be an array of strings');
    }
  }

  return true;
}

/**
 * Validates a MemoryCandidate object against v0.7 invariants.
 */
export function validateMemoryCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new MemoryValidationError('Memory candidate must be a non-null object');
  }

  if (typeof candidate.candidateId !== 'string' || !candidate.candidateId.trim()) {
    throw new MemoryValidationError('Memory candidate must have a non-empty candidateId');
  }

  if (candidate.schemaVersion !== MEMORY_SCHEMA_VERSION) {
    throw new MemoryValidationError(
      `Unsupported candidate schemaVersion ${candidate.schemaVersion}; expected ${MEMORY_SCHEMA_VERSION}`,
    );
  }

  if (!KNOWN_MEMORY_TYPES.has(candidate.proposedType)) {
    throw new MemoryValidationError(`Invalid proposedType: ${candidate.proposedType}`);
  }

  if (!KNOWN_MEMORY_SCOPES.has(candidate.proposedScope)) {
    throw new MemoryValidationError(`Invalid proposedScope: ${candidate.proposedScope}`);
  }

  if (typeof candidate.projectId !== 'string' || !candidate.projectId.trim()) {
    throw new MemoryValidationError('candidate must specify a non-empty projectId');
  }

  if (typeof candidate.subject !== 'string' || !candidate.subject.trim()) {
    throw new MemoryValidationError('candidate must have a non-empty subject');
  }

  if (typeof candidate.proposedContent !== 'string' || !candidate.proposedContent.trim()) {
    throw new MemoryValidationError('candidate must have non-empty proposedContent');
  }

  if (!KNOWN_MEMORY_AUTHORITIES.has(candidate.proposedAuthority)) {
    throw new MemoryValidationError(`Invalid proposedAuthority: ${candidate.proposedAuthority}`);
  }

  // INVARIANT: Inferred or automated candidate extractions cannot assign themselves user-approved authority
  if (
    candidate.extractionSource === 'agent_inference' &&
    candidate.proposedAuthority === MemoryAuthority.USER_APPROVED
  ) {
    throw new MemoryValidationError('Inferred candidate cannot claim user-approved authority directly');
  }

  if (
    typeof candidate.confidence !== 'number' ||
    Number.isNaN(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1
  ) {
    throw new MemoryValidationError('Candidate confidence must be a number between 0.0 and 1.0');
  }

  if (!KNOWN_CANDIDATE_STATUSES.has(candidate.status)) {
    throw new MemoryValidationError(`Invalid candidate status: ${candidate.status}`);
  }

  if (!candidate.source || typeof candidate.source !== 'object' || Array.isArray(candidate.source)) {
    throw new MemoryValidationError('Candidate must include a source object');
  }

  if (typeof candidate.source.type !== 'string' || !candidate.source.type.trim()) {
    throw new MemoryValidationError('Candidate source must specify a non-empty string type');
  }

  return true;
}

/**
 * Validates authority transitions (e.g. preventing unverified promotion to user-approved).
 */
export function validateAuthorityTransition(existingRecord, updatedRecord, userConfirmed = false) {
  validateMemoryRecord(existingRecord);
  validateMemoryRecord(updatedRecord);

  if (
    existingRecord.authority !== MemoryAuthority.USER_APPROVED &&
    updatedRecord.authority === MemoryAuthority.USER_APPROVED
  ) {
    if (!userConfirmed) {
      throw new MemoryValidationError(
        `Cannot promote record ${existingRecord.id} from ${existingRecord.authority} to user-approved without explicit user confirmation`,
      );
    }
  }

  if (
    existingRecord.authority === MemoryAuthority.IMPORTED_UNTRUSTED &&
    updatedRecord.authority !== MemoryAuthority.IMPORTED_UNTRUSTED &&
    !userConfirmed
  ) {
    throw new MemoryValidationError(
      `Cannot promote imported-untrusted record ${existingRecord.id} without explicit user confirmation`,
    );
  }

  return true;
}

/**
 * Validates and links supersession between an older record and a newer record.
 */
export function linkSupersession(oldRecord, newRecord) {
  validateMemoryRecord(oldRecord);
  validateMemoryRecord(newRecord);

  if (oldRecord.id === newRecord.id) {
    throw new MemoryValidationError('Cannot supersede record with itself');
  }

  const updatedOld = {
    ...oldRecord,
    status: MemoryStatus.SUPERSEDED,
    supersededBy: newRecord.id,
    updatedAt: new Date().toISOString(),
  };

  const updatedNew = {
    ...newRecord,
    supersedes: oldRecord.id,
    updatedAt: new Date().toISOString(),
  };

  validateMemoryRecord(updatedOld);
  validateMemoryRecord(updatedNew);

  return { supersededRecord: updatedOld, activeRecord: updatedNew };
}
