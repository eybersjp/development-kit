/**
 * Development Kit — Git Bootstrap & .gitignore Reconciliation
 *
 * Implements automatic Git repository bootstrap and idempotent .gitignore reconciliation
 * for projects managed by Development Kit.
 *
 * Requirements:
 * - Detect if project root is a Git repository, inside an ancestor repo, or standalone.
 * - Initialize Git repository only when project root is not contained in any Git repo.
 * - Support Git worktrees (.git as file).
 * - Never stage, commit, create remotes, or alter git config/history.
 * - Additive and idempotent .gitignore management preserving user rules.
 * - Managed DKF runtime ignore paths, universal ignores, and detected stack ignores.
 * - Graceful degradation if git executable is unavailable.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Universal ignores: conservative environment/secrets, logs, and OS artifacts
 */
const UNIVERSAL_ENV_IGNORES = [
  '.env',
  '.env.local',
  '.env.*.local',
  '*.pem',
  '*.key'
];

const UNIVERSAL_LOG_IGNORES = [
  '*.log',
  'npm-debug.log*',
  'yarn-debug.log*',
  'yarn-error.log*',
  'pnpm-debug.log*'
];

const UNIVERSAL_OS_IGNORES = [
  '.DS_Store',
  'Thumbs.db'
];

/**
 * DKF runtime ignore paths that should not be tracked in git
 */
const DKF_MANAGED_IGNORES = [
  '.development-kit/workspace-id',
  '.development-kit/autopilot/',
  '.development-kit/contracts/',
  '.development-kit/runs/',
  '.development-kit/secrets/'
];

/**
 * Executes git command safely using spawnSync without a shell.
 */
function runGit(args, cwd, gitBinary = 'git') {
  try {
    const res = spawnSync(gitBinary, args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true
    });
    return {
      success: res.status === 0,
      status: res.status,
      stdout: res.stdout ? res.stdout.trim() : '',
      stderr: res.stderr ? res.stderr.trim() : '',
      error: res.error
    };
  } catch (err) {
    return {
      success: false,
      status: -1,
      stdout: '',
      stderr: err.message,
      error: err
    };
  }
}

/**
 * Inspects Git availability and relationship to the project root.
 *
 * @param {string} rootDir
 * @param {object} [options]
 * @returns {object}
 */
export function inspectGitState(rootDir, options = {}) {
  const gitBinary = options.gitBinary || 'git';
  const resolvedRoot = path.resolve(rootDir);

  // Check git binary availability
  const versionRes = runGit(['--version'], resolvedRoot, gitBinary);
  if (!versionRes.success) {
    return {
      available: false,
      warning: `Git executable '${gitBinary}' is not available or failed: ${versionRes.stderr || versionRes.error?.message || 'not found'}`,
      repository: {
        detected: false,
        initialized: false,
        root: null,
        relationship: 'none'
      }
    };
  }

  // Check if rootDir or an ancestor is a git repository
  const revParseRes = runGit(['rev-parse', '--show-toplevel'], resolvedRoot, gitBinary);
  if (!revParseRes.success) {
    // Check if it's inside a .git directory or non-repo
    const insideGitDir = runGit(['rev-parse', '--is-inside-git-dir'], resolvedRoot, gitBinary);
    if (insideGitDir.success && insideGitDir.stdout === 'true') {
      return {
        available: true,
        repository: {
          detected: true,
          initialized: false,
          root: resolvedRoot,
          relationship: 'root'
        }
      };
    }

    return {
      available: true,
      repository: {
        detected: false,
        initialized: false,
        root: null,
        relationship: 'none'
      }
    };
  }

  const gitRootRaw = revParseRes.stdout;
  const gitRoot = path.resolve(gitRootRaw);

  // Compare git root with resolvedRoot
  // Note: On Windows, paths might differ in casing
  const isSamePath = (p1, p2) => {
    if (process.platform === 'win32') {
      return p1.toLowerCase() === p2.toLowerCase();
    }
    return p1 === p2;
  };

  let relationship = 'ancestor';
  if (isSamePath(gitRoot, resolvedRoot)) {
    relationship = 'root';
  } else if (resolvedRoot.startsWith(gitRoot)) {
    relationship = 'ancestor';
  } else {
    relationship = 'external';
  }

  return {
    available: true,
    repository: {
      detected: true,
      initialized: false,
      root: gitRoot,
      relationship
    }
  };
}

/**
 * Ensures a Git repository exists for the project root without nesting inside ancestor repos.
 *
 * @param {string} rootDir
 * @param {object} [options]
 * @returns {object}
 */
export function ensureGitRepository(rootDir, options = {}) {
  const gitBinary = options.gitBinary || 'git';
  const resolvedRoot = path.resolve(rootDir);
  const state = inspectGitState(resolvedRoot, { gitBinary });

  if (!state.available) {
    return {
      available: false,
      warning: state.warning,
      repository: {
        detected: false,
        initialized: false,
        root: null,
        relationship: 'none'
      }
    };
  }

  // If already in a repo: root or ancestor
  if (state.repository.detected) {
    return {
      available: true,
      repository: {
        detected: true,
        initialized: false,
        root: state.repository.root,
        relationship: state.repository.relationship
      }
    };
  }

  // Not in any git repository -> initialize native git repository at project root
  const initRes = runGit(['init'], resolvedRoot, gitBinary);
  if (!initRes.success) {
    return {
      available: true,
      warning: `git init failed: ${initRes.stderr || initRes.error?.message}`,
      repository: {
        detected: false,
        initialized: false,
        root: null,
        relationship: 'none'
      }
    };
  }

  return {
    available: true,
    repository: {
      detected: true,
      initialized: true,
      root: resolvedRoot,
      relationship: 'root'
    }
  };
}

/**
 * Detects project stacks and returns relevant sections.
 */
function detectStackSections(rootDir) {
  const sections = [];

  // Check Node / JS / TS
  const hasPackageJson = fs.existsSync(path.join(rootDir, 'package.json'));
  let hasNext = false;

  if (hasPackageJson) {
    sections.push({
      header: '# Node.js / JavaScript / TypeScript',
      entries: ['node_modules/', 'npm-debug.log*']
    });

    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      if (
        (pkg.dependencies && pkg.dependencies.next) ||
        (pkg.devDependencies && pkg.devDependencies.next)
      ) {
        hasNext = true;
      }
    } catch {}
  }

  if (
    fs.existsSync(path.join(rootDir, 'next.config.js')) ||
    fs.existsSync(path.join(rootDir, 'next.config.mjs')) ||
    fs.existsSync(path.join(rootDir, 'next.config.ts'))
  ) {
    hasNext = true;
  }

  if (hasNext) {
    sections.push({
      header: '# Next.js',
      entries: ['.next/', 'out/']
    });
  }

  // Check Python
  const hasPython =
    fs.existsSync(path.join(rootDir, 'requirements.txt')) ||
    fs.existsSync(path.join(rootDir, 'pyproject.toml')) ||
    fs.existsSync(path.join(rootDir, 'setup.py')) ||
    fs.existsSync(path.join(rootDir, 'Pipfile'));

  if (hasPython) {
    sections.push({
      header: '# Python',
      entries: [
        '__pycache__/',
        '*.py[cod]',
        '*$py.class',
        '.venv/',
        'venv/',
        'env/',
        '.pytest_cache/'
      ]
    });
  }

  return sections;
}

/**
 * Reconciles .gitignore idempotently and additively.
 *
 * @param {string} rootDir
 * @returns {object}
 */
export function reconcileGitignore(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const gitignorePath = path.join(resolvedRoot, '.gitignore');
  const existed = fs.existsSync(gitignorePath);

  let existingContent = '';
  if (existed) {
    existingContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  // Normalize existing lines for checking duplicates
  const existingLines = existingContent
    .split(/\r?\n/)
    .map((l) => l.trim());

  const hasLine = (line) => {
    if (!line) return true;
    return existingLines.includes(line);
  };

  const sectionsToAdd = [];
  const entriesAdded = [];

  const addSectionIfMissing = (header, entries) => {
    const missing = entries.filter((e) => !hasLine(e));
    if (missing.length > 0) {
      const section = [header];
      for (const entry of missing) {
        section.push(entry);
        entriesAdded.push(entry);
      }
      sectionsToAdd.push(section.join('\n'));
    }
  };

  // 1. DKF Managed Ignores
  addSectionIfMissing('# Development Kit Local & Ephemeral State', DKF_MANAGED_IGNORES);

  // 2. Universal Ignores
  addSectionIfMissing('# Environment & Secrets', UNIVERSAL_ENV_IGNORES);
  addSectionIfMissing('# Logs', UNIVERSAL_LOG_IGNORES);
  addSectionIfMissing('# OS Artifacts', UNIVERSAL_OS_IGNORES);

  // 3. Stack-specific Ignores
  const stackSections = detectStackSections(resolvedRoot);
  for (const stackSection of stackSections) {
    addSectionIfMissing(stackSection.header, stackSection.entries);
  }

  if (sectionsToAdd.length > 0) {
    let newContent = existingContent;
    if (newContent.length > 0 && !newContent.endsWith('\n')) {
      newContent += '\n';
    }
    if (newContent.length > 0) {
      newContent += '\n';
    }
    newContent += sectionsToAdd.join('\n\n') + '\n';

    fs.writeFileSync(gitignorePath, newContent, 'utf8');
  }

  return {
    existed,
    created: !existed && (sectionsToAdd.length > 0 || fs.existsSync(gitignorePath)),
    entriesAdded
  };
}

/**
 * Orchestrates Git repository inspection/initialization and .gitignore reconciliation.
 *
 * @param {string} rootDir
 * @param {object} [options]
 * @returns {object}
 */
export function bootstrapGit(rootDir = process.cwd(), options = {}) {
  const resolvedRoot = path.resolve(rootDir);

  // 1. Ensure repository
  const repoState = ensureGitRepository(resolvedRoot, options);

  // 2. Reconcile .gitignore (even if git CLI is absent or failed)
  const gitignoreState = reconcileGitignore(resolvedRoot);

  return {
    available: repoState.available,
    warning: repoState.warning,
    repository: repoState.repository,
    gitignore: gitignoreState
  };
}
