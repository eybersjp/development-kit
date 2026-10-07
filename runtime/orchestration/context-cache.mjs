import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  checkContractStaleness,
  computeFileFingerprint,
  validateDevelopmentContract,
} from './development-contract.mjs';
import { getRequirementsRegistryPath } from './configuration-readiness.mjs';
import { loadWorkspaceTargetRegistry } from './workspace-targets.mjs';

export const CONTEXT_CACHE_ENTRY_SCHEMA_VERSION = '1.0.0';
export const CONTEXT_CACHE_ROOT = '.development-kit/cache/context';

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CACHE_IGNORES = Object.freeze([
  '.git',
  '.development-kit',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  'out',
]);

export class ContextCacheError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ContextCacheError';
    this.details = details;
  }
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function fingerprintObject(value) {
  return sha256(JSON.stringify(stable(value)));
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ContextCacheError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function stringArray(value = [], label = 'array') {
  if (!Array.isArray(value)) throw new ContextCacheError(`${label} must be an array`);
  return [...new Set(value.map((item) => text(item, `${label} entry`)))].sort();
}

function timestamp(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ContextCacheError(`${label} must be a valid timestamp`);
  }
  return value;
}

function normalizeRelativePath(value, label = 'path') {
  const raw = text(value, label).replaceAll('\\', '/');
  if (raw === '.') return '.';
  if (path.posix.isAbsolute(raw) || /^[A-Za-z]:\//.test(raw) || raw.startsWith('//')) {
    throw new ContextCacheError(`${label} must be project-relative: ${value}`);
  }
  const normalized = path.posix.normalize(raw).replace(/^\.\//, '').replace(/\/$/, '');
  if (!normalized || normalized === '.') return '.';
  if (normalized === '..' || normalized.startsWith('../') || normalized.split('/').includes('..')) {
    throw new ContextCacheError(`${label} may not escape the project root: ${value}`);
  }
  return normalized;
}

function resolveProjectPath(rootDir, relativePath, label = 'path') {
  const root = path.resolve(rootDir);
  const normalized = normalizeRelativePath(relativePath, label);
  const resolved = path.resolve(root, normalized === '.' ? '' : normalized);
  const relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ContextCacheError(`${label} escapes the project root: ${relativePath}`);
  }
  return { normalized, resolved };
}

function normalizeFileList(paths = [], label = 'files') {
  if (!Array.isArray(paths)) throw new ContextCacheError(`${label} must be an array`);
  return [...new Set(paths.map((item) => normalizeRelativePath(item, `${label} entry`)))].sort();
}

function normalizeRevision(value, label) {
  if (value === undefined || value === null) return null;
  return text(value, label);
}

function configurationFingerprint(rootDir) {
  const registryPath = getRequirementsRegistryPath(rootDir);
  if (!fs.existsSync(registryPath)) return null;
  if (!fs.statSync(registryPath).isFile()) {
    throw new ContextCacheError('Configuration readiness registry path is not a file');
  }
  return sha256(fs.readFileSync(registryPath));
}

function isPathInsideTarget(filePath, targetPath) {
  if (targetPath === '.') return true;
  return filePath === targetPath || filePath.startsWith(`${targetPath}/`);
}

function selectedTargetDefinitions(contract, rootDir, targetIds = null) {
  validateDevelopmentContract(contract);

  if (!contract.workspaceTargets) {
    const requested = targetIds === null ? [] : stringArray(targetIds, 'targetIds');
    if (requested.length > 0 && !(requested.length === 1 && requested[0] === '__project_root__')) {
      throw new ContextCacheError('Legacy contracts without workspace target binding may not select named targets');
    }
    return {
      registryFingerprint: null,
      targetIds: ['__project_root__'],
      targets: {
        __project_root__: {
          path: '.',
          dependencies: [],
          kind: null,
        },
      },
    };
  }

  const registry = loadWorkspaceTargetRegistry(rootDir);
  const allowed = [...new Set([
    contract.workspaceTargets.primary,
    ...contract.workspaceTargets.affected,
    ...contract.workspaceTargets.verification,
  ])].sort();
  const selected = targetIds === null
    ? allowed
    : stringArray(targetIds, 'targetIds');

  if (selected.length === 0) throw new ContextCacheError('At least one target must be selected');
  for (const id of selected) {
    if (!allowed.includes(id)) {
      throw new ContextCacheError(`Target ${id} is outside the Development Contract target binding`);
    }
    if (!registry.targets[id]) throw new ContextCacheError(`Workspace target is unavailable: ${id}`);
  }

  return {
    registryFingerprint: contract.workspaceTargets.registryFingerprint,
    targetIds: selected,
    targets: Object.fromEntries(selected.map((id) => [id, registry.targets[id]])),
  };
}

function assertFilesCovered(files, targetDefinitions, label) {
  const targetPaths = Object.values(targetDefinitions.targets).map((target) => target.path);
  for (const file of files) {
    if (!targetPaths.some((targetPath) => isPathInsideTarget(file, targetPath))) {
      throw new ContextCacheError(`${label} entry is outside selected targets: ${file}`);
    }
  }
}

function collectTargetStructure(rootDir, targetId, target, {
  ignoredDirectories = CACHE_IGNORES,
} = {}) {
  const ignored = new Set(stringArray(ignoredDirectories, 'ignoredDirectories'));
  const { resolved: targetRoot } = resolveProjectPath(rootDir, target.path, `target ${targetId} path`);
  if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
    throw new ContextCacheError(`Target path is not an existing directory: ${target.path}`);
  }

  const files = [];
  const directories = [];

  function walk(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isDirectory() && ignored.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      const projectRelative = path.relative(path.resolve(rootDir), absolute).replaceAll('\\', '/');
      if (entry.isDirectory()) {
        directories.push(projectRelative);
        walk(absolute);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(projectRelative);
      }
    }
  }

  walk(targetRoot);
  const structurePayload = {
    targetId,
    root: target.path,
    directories,
    files,
  };

  return Object.freeze({
    targetId,
    root: target.path,
    kind: target.kind ?? null,
    dependencies: [...(target.dependencies ?? [])].sort(),
    structureFingerprint: fingerprintObject(structurePayload),
    fileCount: files.length,
    directoryCount: directories.length,
    files,
    directories,
  });
}

function fingerprintFiles(rootDir, files, label) {
  return files.map((file) => {
    const { resolved } = resolveProjectPath(rootDir, file, label);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new ContextCacheError(`${label} is unavailable: ${file}`);
    }
    return Object.freeze({
      path: file,
      fingerprint: computeFileFingerprint(rootDir, file),
    });
  });
}

function buildSelector({
  contract,
  targetIds,
  relevantFiles,
  relevantTests,
  gateProfileRevision,
}) {
  return Object.freeze({
    contractId: contract.contractId,
    taskId: contract.taskId,
    targetIds: [...targetIds].sort(),
    relevantFiles: [...relevantFiles].sort(),
    relevantTests: [...relevantTests].sort(),
    gateProfileRevision,
  });
}

function cachePathFromSelector(rootDir, selector) {
  const selectorFingerprint = fingerprintObject(selector);
  const safeContract = selector.contractId.replace(/[^A-Za-z0-9._-]/g, '_');
  const filename = `${selectorFingerprint.slice('sha256:'.length, 'sha256:'.length + 32)}.json`;
  return {
    selectorFingerprint,
    cachePath: path.join(rootDir, CONTEXT_CACHE_ROOT, safeContract, filename),
  };
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function captureRepositoryContextInputs({
  contract,
  rootDir = process.cwd(),
  targetIds = null,
  relevantFiles = [],
  relevantTests = [],
  gateProfileRevision = null,
} = {}) {
  validateDevelopmentContract(contract);

  const staleness = checkContractStaleness(contract, rootDir);
  if (staleness.stale) {
    throw new ContextCacheError('Cannot capture repository context from a stale Development Contract', staleness.changes);
  }

  const targetDefinitions = selectedTargetDefinitions(contract, rootDir, targetIds);
  const files = normalizeFileList(relevantFiles, 'relevantFiles');
  const tests = normalizeFileList(relevantTests, 'relevantTests');
  assertFilesCovered(files, targetDefinitions, 'relevantFiles');
  assertFilesCovered(tests, targetDefinitions, 'relevantTests');

  const targetFacts = targetDefinitions.targetIds.map((id) => collectTargetStructure(
    rootDir,
    id,
    targetDefinitions.targets[id],
  ));
  const fileRefs = fingerprintFiles(rootDir, files, 'relevant file');
  const testRefs = fingerprintFiles(rootDir, tests, 'relevant test');

  const inputs = {
    contractId: contract.contractId,
    taskId: contract.taskId,
    sourceFingerprint: contract.sourceFingerprint,
    developmentModeFingerprint: contract.developmentMode?.fingerprint ?? null,
    workspaceRegistryFingerprint: targetDefinitions.registryFingerprint,
    configurationFingerprint: configurationFingerprint(rootDir),
    gateProfileRevision: normalizeRevision(gateProfileRevision, 'gateProfileRevision'),
    targetFacts: targetFacts.map((fact) => ({
      targetId: fact.targetId,
      root: fact.root,
      dependencies: fact.dependencies,
      structureFingerprint: fact.structureFingerprint,
    })),
    relevantFiles: fileRefs,
    relevantTests: testRefs,
  };

  return Object.freeze({
    inputFingerprint: fingerprintObject(inputs),
    inputs: Object.freeze(inputs),
    targetFacts,
    metrics: Object.freeze({
      repositoryReads: fileRefs.length + testRefs.length,
      repositoryScans: targetFacts.length,
    }),
  });
}

function entryFingerprintPayload(entry) {
  const {
    entryFingerprint,
    createdAt,
    ...payload
  } = entry;
  return payload;
}

export function validateContextCacheEntry(entry) {
  if (!plainObject(entry)) throw new ContextCacheError('Context cache entry must be an object');
  if (entry.schemaVersion !== CONTEXT_CACHE_ENTRY_SCHEMA_VERSION) {
    throw new ContextCacheError(`Unsupported context cache entry schemaVersion: ${entry.schemaVersion}`);
  }
  for (const field of ['cacheId', 'selectorFingerprint', 'inputFingerprint', 'entryFingerprint']) {
    if (typeof entry[field] !== 'string' || !FINGERPRINT_PATTERN.test(entry[field])) {
      throw new ContextCacheError(`${field} must be a sha256 fingerprint`);
    }
  }
  timestamp(entry.createdAt, 'createdAt');
  if (!plainObject(entry.selector)) throw new ContextCacheError('selector must be an object');
  if (!plainObject(entry.inputs)) throw new ContextCacheError('inputs must be an object');
  if (!Array.isArray(entry.targetFacts)) throw new ContextCacheError('targetFacts must be an array');
  if (entry.entryFingerprint !== fingerprintObject(entryFingerprintPayload(entry))) {
    throw new ContextCacheError('Context cache entry fingerprint does not match content');
  }
  return true;
}

export function createContextCacheEntry({
  selector,
  selectorFingerprint,
  snapshot,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!plainObject(selector)) throw new ContextCacheError('selector is required');
  if (!FINGERPRINT_PATTERN.test(selectorFingerprint ?? '')) {
    throw new ContextCacheError('selectorFingerprint is invalid');
  }
  if (!plainObject(snapshot) || !FINGERPRINT_PATTERN.test(snapshot.inputFingerprint ?? '')) {
    throw new ContextCacheError('snapshot is invalid');
  }
  timestamp(createdAt, 'createdAt');

  const payload = {
    schemaVersion: CONTEXT_CACHE_ENTRY_SCHEMA_VERSION,
    cacheId: fingerprintObject({
      selectorFingerprint,
      inputFingerprint: snapshot.inputFingerprint,
    }),
    selectorFingerprint,
    inputFingerprint: snapshot.inputFingerprint,
    createdAt,
    selector: structuredClone(selector),
    inputs: structuredClone(snapshot.inputs),
    targetFacts: structuredClone(snapshot.targetFacts),
  };

  const entry = {
    ...payload,
    entryFingerprint: fingerprintObject(entryFingerprintPayload(payload)),
  };
  validateContextCacheEntry(entry);
  return Object.freeze(entry);
}

export function getContextCachePath(rootDir, selector) {
  if (!plainObject(selector)) throw new ContextCacheError('selector is required');
  return cachePathFromSelector(rootDir, selector).cachePath;
}

export function loadContextCacheEntry(cachePath) {
  if (!fs.existsSync(cachePath)) return null;
  let entry;
  try {
    entry = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (error) {
    throw new ContextCacheError(`Context cache entry is not valid JSON: ${error.message}`);
  }
  validateContextCacheEntry(entry);
  return entry;
}

export function persistContextCacheEntry(entry, cachePath) {
  validateContextCacheEntry(entry);
  atomicWrite(cachePath, `${JSON.stringify(stable(entry), null, 2)}\n`);
  return { cachePath };
}

export function checkContextCacheEntryStaleness({
  entry,
  contract,
  rootDir = process.cwd(),
} = {}) {
  validateContextCacheEntry(entry);
  validateDevelopmentContract(contract);

  const snapshot = captureRepositoryContextInputs({
    contract,
    rootDir,
    targetIds: entry.selector.targetIds,
    relevantFiles: entry.selector.relevantFiles,
    relevantTests: entry.selector.relevantTests,
    gateProfileRevision: entry.selector.gateProfileRevision,
  });

  const changes = [];
  if (entry.selector.contractId !== contract.contractId || entry.selector.taskId !== contract.taskId) {
    changes.push({ code: 'CONTRACT_IDENTITY_CHANGED' });
  }
  if (entry.inputFingerprint !== snapshot.inputFingerprint) {
    changes.push({
      code: 'CONTEXT_CACHE_INPUT_CHANGED',
      expected: entry.inputFingerprint,
      actual: snapshot.inputFingerprint,
    });
  }

  return Object.freeze({
    stale: changes.length > 0,
    expectedInputFingerprint: entry.inputFingerprint,
    currentInputFingerprint: snapshot.inputFingerprint,
    changes,
    metrics: snapshot.metrics,
  });
}

export function resolveRepositoryContextCache({
  contract,
  rootDir = process.cwd(),
  targetIds = null,
  relevantFiles = [],
  relevantTests = [],
  gateProfileRevision = null,
  createdAt = new Date().toISOString(),
} = {}) {
  validateDevelopmentContract(contract);
  timestamp(createdAt, 'createdAt');

  const targetDefinitions = selectedTargetDefinitions(contract, rootDir, targetIds);
  const files = normalizeFileList(relevantFiles, 'relevantFiles');
  const tests = normalizeFileList(relevantTests, 'relevantTests');
  const gateRevision = normalizeRevision(gateProfileRevision, 'gateProfileRevision');
  const selector = buildSelector({
    contract,
    targetIds: targetDefinitions.targetIds,
    relevantFiles: files,
    relevantTests: tests,
    gateProfileRevision: gateRevision,
  });
  const { selectorFingerprint, cachePath } = cachePathFromSelector(rootDir, selector);

  const snapshot = captureRepositoryContextInputs({
    contract,
    rootDir,
    targetIds: targetDefinitions.targetIds,
    relevantFiles: files,
    relevantTests: tests,
    gateProfileRevision: gateRevision,
  });

  let existing = null;
  let invalidationReason = null;
  if (fs.existsSync(cachePath)) {
    try {
      existing = loadContextCacheEntry(cachePath);
      if (existing.selectorFingerprint !== selectorFingerprint) {
        invalidationReason = 'SELECTOR_FINGERPRINT_CHANGED';
        existing = null;
      } else if (existing.inputFingerprint !== snapshot.inputFingerprint) {
        invalidationReason = 'INPUT_FINGERPRINT_CHANGED';
        existing = null;
      }
    } catch (error) {
      invalidationReason = 'CACHE_ENTRY_INVALID';
      existing = null;
    }
  }

  if (existing) {
    return Object.freeze({
      status: 'HIT',
      cachePath,
      selectorFingerprint,
      entry: existing,
      invalidationReason: null,
      metrics: Object.freeze({
        ...snapshot.metrics,
        cacheHits: 1,
        cacheMisses: 0,
        orientationRebuilds: 0,
      }),
    });
  }

  const entry = createContextCacheEntry({
    selector,
    selectorFingerprint,
    snapshot,
    createdAt,
  });
  persistContextCacheEntry(entry, cachePath);

  return Object.freeze({
    status: 'MISS',
    cachePath,
    selectorFingerprint,
    entry,
    invalidationReason,
    metrics: Object.freeze({
      ...snapshot.metrics,
      cacheHits: 0,
      cacheMisses: 1,
      orientationRebuilds: 1,
    }),
  });
}

export function clearContextCache(rootDir = process.cwd()) {
  const cacheRoot = path.join(rootDir, CONTEXT_CACHE_ROOT);
  fs.rmSync(cacheRoot, { recursive: true, force: true });
}

export { CACHE_IGNORES };
