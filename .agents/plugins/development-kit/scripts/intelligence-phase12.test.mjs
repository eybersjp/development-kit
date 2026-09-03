/**
 * Development Kit Intelligence — Phase 12 Test Suite (Agent Loadouts & Skill Governance)
 *
 * Tests:
 * 1. Agent loadouts resolve permitted memory scopes and bindings
 * 2. Unallowed scopes remain excluded from loadouts
 * 3. Provider skills remain provider-classified and untrusted by default
 * 4. Extracted/learned skill cannot execute automatically without user approval
 * 5. Explicit user approval permits learned skill execution
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveAgentLoadout,
  validateSkillGovernance,
} from '../runtime/intelligence/agent-loadouts.mjs';
import { MemoryScope } from '../runtime/intelligence/memory-enums.mjs';

test('1. Agent loadouts resolve permitted memory scopes and bindings', () => {
  const conductorLoadout = resolveAgentLoadout('development-conductor');
  assert.equal(conductorLoadout.role, 'development-conductor');
  assert.ok(conductorLoadout.allowedScopes.includes(MemoryScope.PROJECT));
  assert.ok(conductorLoadout.allowedScopes.includes(MemoryScope.USER));
  assert.equal(conductorLoadout.codeIntelligence, true);
});

test('2. Unallowed scopes remain excluded from loadouts', () => {
  const implLoadout = resolveAgentLoadout('implementation-agent');
  assert.ok(!implLoadout.allowedScopes.includes(MemoryScope.USER));
});

test('3. Provider skills remain provider-classified and untrusted by default', () => {
  const providerSkill = {
    name: 'custom-scraper',
    source: 'provider_untrusted',
    userApproved: false,
  };

  const governance = validateSkillGovernance(providerSkill);
  assert.equal(governance.trusted, false);
  assert.equal(governance.executable, false);
  assert.match(governance.reason, /requires explicit user approval/);
});

test('4. Extracted/learned skill cannot execute automatically without user approval', () => {
  const learnedSkill = {
    name: 'auto-extracted-workflow',
    source: 'extracted_candidate',
    userApproved: false,
  };

  const governance = validateSkillGovernance(learnedSkill);
  assert.equal(governance.trusted, false);
  assert.equal(governance.executable, false);
});

test('5. Explicit user approval permits learned skill execution', () => {
  const approvedSkill = {
    name: 'approved-workflow',
    source: 'extracted_candidate',
    userApproved: true,
  };

  const governance = validateSkillGovernance(approvedSkill);
  assert.equal(governance.trusted, true);
  assert.equal(governance.executable, true);
});
