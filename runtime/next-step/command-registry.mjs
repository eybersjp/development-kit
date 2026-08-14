/**
 * Development Kit Next-Step Guidance — Canonical Command Registry
 *
 * Provides the single source of truth for all registered `/dk-*` commands,
 * their lifecycle stages, safety flags, and metadata.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Static canonical command metadata table.
 */
export const CANONICAL_COMMAND_METADATA = Object.freeze({
  '/dk-autopilot': {
    name: '/dk-autopilot',
    command: '/dk-autopilot',
    stage: 'LIFECYCLE_WIDE',
    description: 'Run the complete Development Kit software-development lifecycle in Automated Guided Workflow mode.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'autopilot',
    category: 'lifecycle'
  },
  '/dk-idea': {
    name: '/dk-idea',
    command: '/dk-idea',
    stage: 'UNDERSTAND',
    description: 'Refine a rough idea into a concrete concept with requirements interview, idea challenge, and scope definition.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'discovery',
    category: 'lifecycle'
  },
  '/dk-research': {
    name: '/dk-research',
    command: '/dk-research',
    stage: 'ANY',
    description: 'Gather source-backed external evidence through approved providers while preserving trust boundaries.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'read_only',
    workflow: 'research',
    category: 'utility'
  },
  '/dk-spec': {
    name: '/dk-spec',
    command: '/dk-spec',
    stage: 'DEFINE',
    description: 'Create the minimum required specification artifacts for the approved concept.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'definition',
    category: 'lifecycle'
  },
  '/dk-design': {
    name: '/dk-design',
    command: '/dk-design',
    stage: 'DESIGN',
    description: 'Produce technical and visual design including data models, API contracts, and user flows.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'design',
    category: 'lifecycle'
  },
  '/dk-tasks': {
    name: '/dk-tasks',
    command: '/dk-tasks',
    stage: 'PLAN',
    description: 'Break approved work into small, verifiable tasks with subtask decomposition and dependency ordering.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'planning',
    category: 'lifecycle'
  },
  '/dk-build': {
    name: '/dk-build',
    command: '/dk-build',
    stage: 'IMPLEMENT',
    description: 'Implement the next task through every verification gate using fresh sub-agents and TDD.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'implementation',
    category: 'lifecycle'
  },
  '/dk-build-auto': {
    name: '/dk-build-auto',
    command: '/dk-build-auto',
    stage: 'IMPLEMENT',
    description: 'Process the entire approved task plan automatically, pausing on failures.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'implementation',
    category: 'lifecycle'
  },
  '/dk-test': {
    name: '/dk-test',
    command: '/dk-test',
    stage: 'VERIFY',
    description: 'Run task-specific verification with browser runtime checks, regression testing, and edge case testing.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'verification',
    category: 'lifecycle'
  },
  '/dk-review': {
    name: '/dk-review',
    command: '/dk-review',
    stage: 'REVIEW',
    description: 'Run the full review cycle: specification compliance, code quality, security, and accessibility.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'review',
    category: 'lifecycle'
  },
  '/dk-simplify': {
    name: '/dk-simplify',
    command: '/dk-simplify',
    stage: 'SIMPLIFY',
    description: 'Apply the Ponytail simplicity ladder to remove unnecessary code, abstractions, and dependencies.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'simplification',
    category: 'lifecycle'
  },
  '/dk-debug': {
    name: '/dk-debug',
    command: '/dk-debug',
    stage: 'RECOVERY',
    description: 'Systematic root-cause analysis: reproduce, localise, identify root cause, fix, and protect.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'safe',
    workflow: 'debugging',
    category: 'remediation'
  },
  '/dk-ship': {
    name: '/dk-ship',
    command: '/dk-ship',
    stage: 'COMPLETE',
    description: 'Perform final verification and release preparation: task completion gate, branch completion, and release readiness.',
    isConsequential: true,
    requiresApproval: true,
    safetyLevel: 'consequential',
    workflow: 'completion',
    category: 'lifecycle'
  },
  '/dk-status': {
    name: '/dk-status',
    command: '/dk-status',
    stage: 'INFORMATIONAL',
    description: 'Show the current workflow state: active lifecycle stage, current task, completed tasks, and blocked items.',
    isConsequential: false,
    requiresApproval: false,
    safetyLevel: 'read_only',
    workflow: 'informational',
    category: 'utility'
  }
});

/**
 * CommandRegistry manages known /dk-* commands and their metadata.
 */
export class CommandRegistry {
  /**
   * @param {object} [customMetadata={}] Optional custom command overrides or additions
   * @param {string} [rootDir] Optional repository root to scan for command files
   */
  constructor(customMetadata = {}, rootDir = null) {
    this._registry = new Map();

    // Load canonical metadata
    for (const [cmd, meta] of Object.entries(CANONICAL_COMMAND_METADATA)) {
      this._registry.set(cmd, { ...meta });
    }

    // Discover commands from filesystem if root directory is provided
    if (rootDir && typeof rootDir === 'string') {
      this._discoverFromDirectory(rootDir);
    }

    // Apply custom overrides
    for (const [cmd, meta] of Object.entries(customMetadata)) {
      const normalizedCmd = cmd.startsWith('/dk-') ? cmd : `/dk-${cmd}`;
      const existing = this._registry.get(normalizedCmd) || {
        name: normalizedCmd,
        command: normalizedCmd,
        isConsequential: false,
        requiresApproval: false,
        safetyLevel: 'safe'
      };
      this._registry.set(normalizedCmd, { ...existing, ...meta, command: normalizedCmd });
    }
  }

  _discoverFromDirectory(rootDir) {
    try {
      const commandsDir = path.join(rootDir, 'commands');
      if (fs.existsSync(commandsDir)) {
        const files = fs.readdirSync(commandsDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            const cmdName = `/${file.replace(/\.md$/, '')}`;
            if (!this._registry.has(cmdName)) {
              this._registry.set(cmdName, {
                name: cmdName,
                command: cmdName,
                stage: 'UNKNOWN',
                description: `Command defined in commands/${file}`,
                isConsequential: false,
                requiresApproval: false,
                safetyLevel: 'safe'
              });
            }
          }
        }
      }
    } catch {
      // Ignore filesystem discovery errors and rely on canonical metadata
    }
  }

  /**
   * Check if a command is valid and registered.
   * @param {string} command - Command to check (e.g. '/dk-test' or 'dk-test')
   * @returns {boolean}
   */
  has(command) {
    if (!command || typeof command !== 'string') return false;
    const trimmed = command.trim();
    const normalized = trimmed.startsWith('/')
      ? (trimmed.startsWith('/dk-') ? trimmed : `/dk-${trimmed.slice(1)}`)
      : (trimmed.startsWith('dk-') ? `/${trimmed}` : `/dk-${trimmed}`);
    return this._registry.has(normalized);
  }

  /**
   * Get metadata for a registered command.
   * @param {string} command
   * @returns {object|null}
   */
  get(command) {
    if (!command || typeof command !== 'string') return null;
    const trimmed = command.trim();
    const normalized = trimmed.startsWith('/')
      ? (trimmed.startsWith('/dk-') ? trimmed : `/dk-${trimmed.slice(1)}`)
      : (trimmed.startsWith('dk-') ? `/${trimmed}` : `/dk-${trimmed}`);
    return this._registry.get(normalized) || null;
  }

  /**
   * Get all registered command names.
   * @returns {string[]}
   */
  getAllCommands() {
    return Array.from(this._registry.keys());
  }

  /**
   * Get all registered command objects.
   * @returns {object[]}
   */
  getAllMetadata() {
    return Array.from(this._registry.values());
  }

  /**
   * Get commands mapped to a specific lifecycle stage.
   * @param {string} stage
   * @returns {object[]}
   */
  getCommandsForStage(stage) {
    if (!stage || typeof stage !== 'string') return [];
    const normalizedStage = stage.toUpperCase();
    return this.getAllMetadata().filter(meta => meta.stage === normalizedStage);
  }
}

/**
 * Singleton default registry instance.
 */
export const defaultCommandRegistry = new CommandRegistry();

/**
 * Convenience check for command validity against the default registry.
 * @param {string} command
 * @returns {boolean}
 */
export function isValidCommand(command) {
  return defaultCommandRegistry.has(command);
}

/**
 * Convenience getter for command metadata.
 * @param {string} command
 * @returns {object|null}
 */
export function getCommandMetadata(command) {
  return defaultCommandRegistry.get(command);
}
