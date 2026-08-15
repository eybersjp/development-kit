/**
 * Development Kit Intelligence — Agent Loadouts & Skill Governance Engine
 *
 * Implements effective loadout resolution and skill governance:
 * 1. Scope permissions (e.g. USER, PROJECT, WORKSPACE)
 * 2. Assigned skills and tool bindings
 * 3. Knowledge bindings
 * 4. Code intelligence capabilities
 * 5. Governance of learned/provider skills (must be approved before execution)
 */

import { MemoryScope } from './memory-enums.mjs';

export const AGENT_ROLE_LOADOUTS = Object.freeze({
  'development-conductor': {
    allowedScopes: [MemoryScope.PROJECT, MemoryScope.WORKSPACE, MemoryScope.USER],
    knowledgeBindings: ['docs'],
    codeIntelligence: true,
    exclusions: ['secrets', 'credentials'],
  },
  'solution-architect-agent': {
    allowedScopes: [MemoryScope.PROJECT, MemoryScope.WORKSPACE],
    knowledgeBindings: ['docs/04-architecture', 'docs/03-reference'],
    codeIntelligence: true,
    exclusions: ['unverified-external-code'],
  },
  'implementation-agent': {
    allowedScopes: [MemoryScope.PROJECT, MemoryScope.WORKSPACE],
    knowledgeBindings: ['docs/04-architecture'],
    codeIntelligence: true,
    exclusions: ['out-of-scope-tasks'],
  },
  'security-reviewer': {
    allowedScopes: [MemoryScope.PROJECT, MemoryScope.WORKSPACE, MemoryScope.USER],
    knowledgeBindings: ['docs/07-testing-quality-security'],
    codeIntelligence: true,
    exclusions: [],
  },
});

/**
 * Resolves effective loadout for a specific DK specialist agent.
 */
export function resolveAgentLoadout(roleName, options = {}) {
  const base = AGENT_ROLE_LOADOUTS[roleName] || {
    allowedScopes: [MemoryScope.PROJECT, MemoryScope.WORKSPACE],
    knowledgeBindings: ['docs'],
    codeIntelligence: false,
    exclusions: [],
  };

  return {
    role: roleName,
    allowedScopes: base.allowedScopes,
    knowledgeBindings: base.knowledgeBindings,
    codeIntelligence: Boolean(base.codeIntelligence),
    exclusions: base.exclusions,
    customSkills: options.customSkills || [],
  };
}

/**
 * Validates whether a skill candidate is governed and trusted.
 */
export function validateSkillGovernance(skill) {
  if (!skill || typeof skill !== 'object') {
    throw new Error('Skill must be an object');
  }

  // Untrusted provider skills or auto-extracted skills require explicit user confirmation
  if (skill.source === 'provider_untrusted' || skill.source === 'extracted_candidate') {
    if (!skill.userApproved) {
      return {
        trusted: false,
        executable: false,
        reason: 'Learned or provider skill requires explicit user approval before execution',
      };
    }
  }

  return {
    trusted: true,
    executable: true,
  };
}
