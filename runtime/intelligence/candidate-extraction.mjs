/**
 * Development Kit Intelligence — Memory Candidate Extraction Engine
 *
 * Implements governed candidate generation from high-signal DK workflows:
 * /dk-design, /dk-debug, /dk-review, /dk-ship.
 *
 * Enforces:
 * 1. Secrets/credential filtering
 * 2. Authority assignment rules (never infer user-approved)
 * 3. Deterministic promotion vs governed queue
 */

import crypto from 'node:crypto';
import {
  MEMORY_SCHEMA_VERSION,
  MemoryType,
  MemoryScope,
  MemoryAuthority,
  CandidateStatus,
} from './memory-enums.mjs';
import { validateMemoryCandidate, MemoryValidationError } from './memory-schema.mjs';
import { resolveMemoryIdentity } from './memory-identity.mjs';

const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|secret|token|password|auth|bearer)\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{8,}['"]/i,
  /ghp_[a-zA-Z0-9]{36}/,
  /xox[baprs]-[0-9a-zA-Z]{10,48}/,
  /-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----/,
];

/**
 * Checks whether text contains potential secrets or credentials.
 */
export function containsSensitiveData(text) {
  if (!text || typeof text !== 'string') return false;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Extracts memory candidates from workflow artifacts or operation results.
 */
export function extractMemoryCandidates(workflowResult, options = {}) {
  const { rootDir = process.cwd(), extractionSource = 'workflow_execution' } = options;
  const identity = resolveMemoryIdentity(rootDir);

  const candidates = [];

  if (!workflowResult || typeof workflowResult !== 'object') {
    return candidates;
  }

  const { command, items = [] } = workflowResult;

  for (const item of items) {
    // 1. Secret / Sensitivity Filter
    if (containsSensitiveData(item.content) || containsSensitiveData(item.subject)) {
      continue; // Refuse to generate candidates containing sensitive credentials
    }

    let proposedType = item.type || MemoryType.LESSON;
    let proposedAuthority = MemoryAuthority.INFERRED;

    if (command === '/dk-design' && item.isArchitectureDecision) {
      proposedType = MemoryType.DECISION;
      // Decisions extracted from design artifact require user promotion/approval
      proposedAuthority = item.userConfirmed ? MemoryAuthority.USER_APPROVED : MemoryAuthority.INFERRED;
    } else if (command === '/dk-debug' && item.isVerifiedRootCause) {
      proposedType = MemoryType.LESSON;
      proposedAuthority = MemoryAuthority.REPOSITORY_VERIFIED;
    } else if (command === '/dk-review' && item.isReviewFinding) {
      proposedType = MemoryType.INCIDENT;
      proposedAuthority = MemoryAuthority.SYSTEM_VERIFIED;
    } else if (command === '/dk-ship' && item.isReleaseLesson) {
      proposedType = MemoryType.LESSON;
      proposedAuthority = MemoryAuthority.SYSTEM_VERIFIED;
    }

    const candidate = {
      candidateId: `cand_${crypto.randomUUID()}`,
      schemaVersion: MEMORY_SCHEMA_VERSION,
      proposedType,
      proposedScope: item.scope || MemoryScope.PROJECT,
      projectId: identity.projectId,
      subject: item.subject || 'Extracted Memory',
      proposedContent: item.content,
      proposedAuthority,
      extractionSource,
      confidence: item.confidence !== undefined ? item.confidence : 0.85,
      status: CandidateStatus.PENDING,
      source: {
        type: 'workflow_result',
        command: command || 'unknown',
        ref: item.sourceRef || undefined,
      },
    };

    try {
      validateMemoryCandidate(candidate);
      candidates.push(candidate);
    } catch {
      // Skip invalid candidates
    }
  }

  return candidates;
}

/**
 * Promotes a memory candidate into an authoritative memory record upon approval.
 */
export function promoteCandidateToRecord(candidate, overrides = {}) {
  validateMemoryCandidate(candidate);

  const record = {
    id: `mem_${crypto.randomUUID()}`,
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: overrides.type || candidate.proposedType,
    scope: overrides.scope || candidate.proposedScope,
    projectId: candidate.projectId,
    subject: overrides.subject || candidate.subject,
    content: overrides.content || candidate.proposedContent,
    authority: overrides.authority || candidate.proposedAuthority,
    confidence: overrides.confidence !== undefined ? overrides.confidence : candidate.confidence,
    status: 'active',
    lifecycleStages: overrides.lifecycleStages || undefined,
    source: candidate.source,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: null,
    supersedes: null,
    supersededBy: null,
    tags: overrides.tags || [],
  };

  return record;
}
