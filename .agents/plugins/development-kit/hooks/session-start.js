/**
 * Session Start Hook
 *
 * Loaded at the beginning of every Antigravity session in a Development Kit
 * project.
 *
 * Responsibilities:
 * - Load the using-development-kit skill (teaches the methodology)
 * - Load AGENTS.md always-on rules
 * - Display the Development Kit banner
 * - Make session-start data available to other hooks
 *
 * This is an Antigravity lifecycle hook. It runs once per session.
 */

// Session metadata
const session = {
  startedAt: new Date().toISOString(),
  methodology: 'development-kit',
  version: '0.1.0',
  rules: [
    'inspect-before-edit',
    'clarify-before-assuming',
    'specify-before-implementing',
    'reuse-before-creating',
    'native-before-dependencies',
    'break-into-tasks',
    'fresh-subagents',
    'verification-before-implementation',
    'spec-review-before-code-review',
    'test-before-completion',
    'simplify-after-correctness',
    'sequential-tasks',
  ],
};

module.exports = { session };
