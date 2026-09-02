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
 * Checks whether two paths represent the same filesystem location (case-insensitive on Windows).
 */
function pathsEqual(p1, p2) {
  if (!p1 || !p2) return false;
  const n1 = normalizePath(p1);
  const n2 = normalizePath(p2);
  if (process.platform === 'win32') {
    return n1.toLowerCase() === n2.toLowerCase();
  }
  return n1 === n2;
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
 * Attempts to derive project root from a working directory:
 * 1. If cwd is inside `.agents` or descendant of `.agents`, strip the `.agents` segment.
 * 2. If valid DKF project markers exist at cwd, return cwd.
 * 3. Otherwise walk upward through parent directories checking for canonical DKF markers:
 *    - `.development-kit/project.json`
 *    - `.agents/plugins/development-kit/plugin.json`
 * If multiple conflicting DKF project identities are found in ancestor chain, throws DK_PROJECT_ROOT_CONFLICT.
 */
export function deriveProjectRootFromCwd(cwd = process.cwd()) {
  const norm = normalizePath(cwd);
  const parsed = path.parse(norm);

  // 1. If cwd is directly inside .agents or descendant of .agents
  const agentsIndex = norm.toLowerCase().lastIndexOf(`${path.sep}.agents`);
  if (agentsIndex !== -1) {
    const rest = norm.slice(agentsIndex + 8);
    if (rest === '' || rest.startsWith(path.sep)) {
      const projectRoot = norm.slice(0, agentsIndex);
      return projectRoot || parsed.root;
    }
  }

  // Helper to test if a directory has canonical DKF markers
  const hasDkMarker = (dir) => {
    const projectJson = path.join(dir, '.development-kit', 'project.json');
    const pluginJson = path.join(dir, '.agents', 'plugins', 'development-kit', 'plugin.json');
    return fs.existsSync(projectJson) || fs.existsSync(pluginJson);
  };

  // Helper to read project ID if present
  const getProjectId = (dir) => {
    const projectJson = path.join(dir, '.development-kit', 'project.json');
    if (fs.existsSync(projectJson)) {
      try {
        const data = JSON.parse(fs.readFileSync(projectJson, 'utf8'));
        return data.projectId || null;
      } catch (_) {
        return null;
      }
    }
    return null;
  };

  // 2. Check if current directory has markers
  const foundRoots = [];
  if (hasDkMarker(norm)) {
    foundRoots.push(norm);
  }

  // 3. Walk up ancestor tree checking for markers
  let current = path.dirname(norm);
  while (current && current !== parsed.root) {
    if (hasDkMarker(current)) {
      foundRoots.push(current);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (parsed.root && hasDkMarker(parsed.root) && !foundRoots.includes(parsed.root)) {
    foundRoots.push(parsed.root);
  }

  if (foundRoots.length === 1) {
    return foundRoots[0];
  }

  if (foundRoots.length > 1) {
    const ids = foundRoots.map(r => ({ root: r, id: getProjectId(r) })).filter(x => x.id);
    const uniqueIds = new Set(ids.map(x => x.id));
    if (uniqueIds.size > 1) {
      throw new ProjectRootError(
        `Conflicting DKF project identities discovered in ancestor chain: ${ids.map(x => `${x.root} [${x.id}]`).join(' vs ')}`,
        'DK_PROJECT_ROOT_CONFLICT',
        { conflictingAncestors: ids }
      );
    }
    return foundRoots[0];
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
  const normCwd = normalizePath(cwd);
  const fromScript = executablePath ? deriveProjectRootFromScript(executablePath) : null;
  let resolvedRoot = null;

  if (fromScript) {
    const normScriptRoot = normalizePath(fromScript);

    if (explicitRoot) {
      // An explicitRoot must be validated against the project-local script installation
      const normExplicit = normalizePath(explicitRoot);
      const canonicalExplicit = deriveProjectRootFromScript(normExplicit) ||
                                deriveProjectRootFromCwd(normExplicit) ||
                                normExplicit;

      if (!pathsEqual(normScriptRoot, canonicalExplicit)) {
        throw new ProjectRootError(
          `Explicit root (${canonicalExplicit}) conflicts with project-local script installation authority (${normScriptRoot}). Project-local installation cannot be redirected to an external directory.`,
          'DK_PROJECT_ROOT_CONFLICT',
          { scriptRoot: normScriptRoot, explicitRoot: canonicalExplicit }
        );
      }
      resolvedRoot = normScriptRoot;
    } else {
      const fromCwd = deriveProjectRootFromCwd(normCwd);
      const normCwdRoot = normalizePath(fromCwd);

      if (!pathsEqual(normScriptRoot, normCwdRoot)) {
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
    }
  } else {
    // Non-project-local script invocation (e.g. global installation or repository testing)
    if (explicitRoot) {
      const normExplicit = normalizePath(explicitRoot);
      const fromExplicitScript = deriveProjectRootFromScript(normExplicit);
      const fromExplicitCwd = deriveProjectRootFromCwd(normExplicit);
      resolvedRoot = fromExplicitScript || fromExplicitCwd || normExplicit;
    } else {
      const fromCwd = deriveProjectRootFromCwd(normCwd);
      resolvedRoot = fromCwd || normCwd;
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
