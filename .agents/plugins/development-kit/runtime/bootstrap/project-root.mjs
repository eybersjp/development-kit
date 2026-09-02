/**
 * Development Kit — Canonical Project Root Resolver
 *
 * Deterministically resolves the canonical project root for a DKF installation
 * across all Antigravity execution modes and current working directories.
 *
 * Invariants:
 * 1. Project root is NEVER `<project>/.agents` or `<project>/.agents/plugins/development-kit`.
 * 2. When executed inside `<project>/.agents/plugins/development-kit/...`, the root is `<project>`.
 * 3. Fails closed with DK_PROJECT_ROOT_CONFLICT if conflicting project identities or
 *    authoritative state locations are detected.
 * 4. Fails closed with DK_MISLOCATED_STATE if mislocated state exists at `<project>/.agents/.development-kit`.
 * 5. Windows-safe, uses native path APIs.
 */

import fs from 'node:fs';
import path from 'node:path';

export class ProjectRootError extends Error {
  constructor(message, code = 'DK_PROJECT_ROOT_ERROR', details = null) {
    super(message);
    this.name = 'ProjectRootError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Normalizes a path to absolute and resolves symlinks/case consistency where practical.
 */
function normalizePath(p) {
  if (!p || typeof p !== 'string') return '';
  return path.resolve(p);
}

/**
 * Inspects a candidate directory for mislocated state at `<candidate>/.agents/.development-kit`.
 * Fails closed if detected.
 */
export function checkMislocatedState(candidateRoot) {
  const norm = normalizePath(candidateRoot);
  const mislocatedDkDir = path.join(norm, '.agents', '.development-kit');
  if (fs.existsSync(mislocatedDkDir)) {
    throw new ProjectRootError(
      `Mislocated authoritative state detected at: ${mislocatedDkDir}. Authoritative DKF state must reside at project root: ${path.join(norm, '.development-kit')}. Do not treat .agents as project root.`,
      'DK_MISLOCATED_STATE',
      { mislocatedPath: mislocatedDkDir, canonicalProjectRoot: norm }
    );
  }
}

/**
 * Attempts to derive project root from executable / module path.
 * If executablePath is under `.../.agents/plugins/development-kit/...`,
 * returns the enclosing `<project>` root.
 */
export function deriveProjectRootFromScript(executablePath) {
  if (!executablePath || typeof executablePath !== 'string') return null;
  const norm = normalizePath(executablePath);

  const agentsPluginsIndex = norm.toLowerCase().lastIndexOf(`${path.sep}.agents${path.sep}plugins${path.sep}development-kit`);
  if (agentsPluginsIndex !== -1) {
    const projectRoot = norm.slice(0, agentsPluginsIndex);
    return projectRoot || path.parse(norm).root;
  }

  return null;
}

/**
 * Attempts to derive project root by walking up from cwd.
 * If cwd is `<project>/.agents` or `<project>/.agents/...`, project root is `<project>`.
 */
export function deriveProjectRootFromCwd(cwd = process.cwd()) {
  const norm = normalizePath(cwd);

  const parsed = path.parse(norm);

  // If cwd is directly inside .agents or descendant of .agents
  const agentsIndex = norm.toLowerCase().lastIndexOf(`${path.sep}.agents`);
  if (agentsIndex !== -1) {
    const rest = norm.slice(agentsIndex + 8);
    if (rest === '' || rest.startsWith(path.sep)) {
      const projectRoot = norm.slice(0, agentsIndex);
      return projectRoot || parsed.root;
    }
  }

  return norm;
}

/**
 * Resolves the canonical project root for the execution context.
 *
 * @param {Object} options
 * @param {string} [options.cwd=process.cwd()] - Current working directory
 * @param {string} [options.executablePath] - Path to the executing script/module
 * @param {string} [options.explicitRoot] - Explicitly provided root option (e.g. --root-dir)
 * @param {boolean} [options.checkMislocated=true] - Whether to assert mislocated state check
 * @returns {string} Canonical project root absolute path
 */
export function resolveProjectRoot({
  cwd = process.cwd(),
  executablePath = null,
  explicitRoot = null,
  checkMislocated = true,
} = {}) {
  let resolvedRoot = null;

  if (explicitRoot) {
    const normExplicit = normalizePath(explicitRoot);
    const fromExplicitScript = deriveProjectRootFromScript(normExplicit);
    const fromExplicitCwd = deriveProjectRootFromCwd(normExplicit);
    resolvedRoot = fromExplicitScript || fromExplicitCwd || normExplicit;
  } else {
    // 1. Script path is strong root evidence for project-local plugin
    const fromScript = executablePath ? deriveProjectRootFromScript(executablePath) : null;

    // 2. CWD-based derivation
    const fromCwd = deriveProjectRootFromCwd(cwd);

    if (fromScript && fromCwd) {
      const normScriptRoot = normalizePath(fromScript);
      const normCwdRoot = normalizePath(fromCwd);

      if (normScriptRoot !== normCwdRoot) {
        const scriptDk = path.join(normScriptRoot, '.development-kit', 'project.json');
        const cwdDk = path.join(normCwdRoot, '.development-kit', 'project.json');

        if (fs.existsSync(scriptDk) && fs.existsSync(cwdDk)) {
          try {
            const scriptId = JSON.parse(fs.readFileSync(scriptDk, 'utf8')).projectId;
            const cwdId = JSON.parse(fs.readFileSync(cwdDk, 'utf8')).projectId;
            if (scriptId && cwdId && scriptId !== cwdId) {
              throw new ProjectRootError(
                `Conflicting project identities detected between script installation root (${normScriptRoot} [${scriptId}]) and working directory root (${normCwdRoot} [${cwdId}]).`,
                'DK_PROJECT_ROOT_CONFLICT',
                { scriptRoot: normScriptRoot, cwdRoot: normCwdRoot, scriptProjectId: scriptId, cwdProjectId: cwdId }
              );
            }
          } catch (err) {
            if (err instanceof ProjectRootError) throw err;
          }
        }
        resolvedRoot = normScriptRoot;
      } else {
        resolvedRoot = normScriptRoot;
      }
    } else {
      resolvedRoot = fromScript || fromCwd || normalizePath(cwd);
    }
  }

  // Ensure root is never named '.agents' directly
  if (path.basename(resolvedRoot) === '.agents') {
    resolvedRoot = path.dirname(resolvedRoot);
  }

  // Final validation & mislocated state check
  if (checkMislocated) {
    checkMislocatedState(resolvedRoot);
  }

  return resolvedRoot;
}
