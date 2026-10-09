import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  checkContractStaleness,
  validateDevelopmentContract,
} from './development-contract.mjs';
import {
  checkContextCacheEntryStaleness,
  loadContextCacheEntry,
  resolveRepositoryContextCache,
  validateContextCacheEntry,
} from './context-cache.mjs';
import {
  getAffectedTargetClosure,
  getTargetDependencyClosure,
  loadWorkspaceTargetRegistry,
} from './workspace-targets.mjs';

export const EXECUTION_CAPSULE_SCHEMA_VERSION = '1.0.0';

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export class ExecutionCapsuleError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ExecutionCapsuleError';
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

function fingerprintObject(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new ExecutionCapsuleError(`${label} must be a non-empty string`);
  return value.trim();
}

function optionalId(value, label) {
  if (value === undefined || value === null) return null;
  const normalized = text(value, label);
  if (!ID_PATTERN.test(normalized)) throw new ExecutionCapsuleError(`${label} has unsupported characters`);
  return normalized;
}

function stringArray(value = [], label = 'array') {
  if (!Array.isArray(value)) throw new ExecutionCapsuleError(`${label} must be an array`);
  return [...new Set(value.map((item) => text(item, `${label} entry`)))].sort();
}

function timestamp(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ExecutionCapsuleError(`${label} must be a valid timestamp`);
  }
  return value;
}

function sha(value, label) {
  if (typeof value !== 'string' || !FINGERPRINT_PATTERN.test(value)) {
    throw new ExecutionCapsuleError(`${label} must be a sha256 fingerprint`);
  }
  return value;
}

function normalizeRelativePath(value, label = 'path') {
  const raw = text(value, label).replaceAll('\\', '/');
  if (path.posix.isAbsolute(raw) || /^[A-Za-z]:\//.test(raw) || raw.startsWith('//')) {
    throw new ExecutionCapsuleError(`${label} must be project-relative`);
  }
  const normalized = path.posix.normalize(raw).replace(/^\.\//, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized.split('/').includes('..')) {
    throw new ExecutionCapsuleError(`${label} may not escape the project root`);
  }
  return normalized || '.';
}

function fileRefs(value = [], label = 'fileRefs') {
  if (!Array.isArray(value)) throw new ExecutionCapsuleError(`${label} must be an array`);
  return value.map((ref) => {
    if (!plainObject(ref)) throw new ExecutionCapsuleError(`${label} entries must be objects`);
    return Object.freeze({
      path: normalizeRelativePath(ref.path, `${label}.path`),
      fingerprint: sha(ref.fingerprint, `${label}.fingerprint`),
    });
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function normalizeUpstreamTasks(value = []) {
  if (!Array.isArray(value)) throw new ExecutionCapsuleError('upstreamAcceptedTasks must be an array');
  return value.map((item) => {
    if (!plainObject(item)) throw new ExecutionCapsuleError('upstreamAcceptedTasks entries must be objects');
    return Object.freeze({
      taskId: optionalId(item.taskId, 'upstream taskId'),
      contractId: optionalId(item.contractId, 'upstream contractId'),
      sourceFingerprint: sha(item.sourceFingerprint, 'upstream sourceFingerprint'),
      acceptanceFingerprint: sha(item.acceptanceFingerprint, 'upstream acceptanceFingerprint'),
    });
  }).sort((a, b) => `${a.taskId}:${a.contractId}`.localeCompare(`${b.taskId}:${b.contractId}`));
}

function normalizeRuntimeFacts(value = []) {
  if (!Array.isArray(value)) throw new ExecutionCapsuleError('verifiedRuntimeFacts must be an array');
  return value.map((fact) => {
    if (!plainObject(fact)) throw new ExecutionCapsuleError('verifiedRuntimeFacts entries must be objects');
    if (!plainObject(fact.provenance)) throw new ExecutionCapsuleError('Runtime fact provenance is required');
    const factId = optionalId(fact.id, 'runtime fact id');
    if (factId === null) throw new ExecutionCapsuleError('Runtime fact id is required');
    const normalized = {
      id: factId,
      value: structuredClone(fact.value),
      observedAt: timestamp(fact.observedAt, 'runtime fact observedAt'),
      authority: 'non-authoritative-observation',
      provenance: {
        kind: text(fact.provenance.kind, 'runtime fact provenance.kind'),
        id: text(fact.provenance.id, 'runtime fact provenance.id'),
        fingerprint: sha(fact.provenance.fingerprint, 'runtime fact provenance.fingerprint'),
      },
    };
    JSON.stringify(normalized.value);
    return Object.freeze(normalized);
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function pathInside(filePath, targetPath) {
  if (targetPath === '.') return true;
  return filePath === targetPath || filePath.startsWith(`${targetPath}/`);
}

function changedFileRefs(rootDir, changedFiles = []) {
  const normalized = stringArray(changedFiles, 'changedFiles').map((file) => normalizeRelativePath(file, 'changed file'));
  return normalized.map((file) => {
    const absolute = path.resolve(rootDir, file);
    const root = path.resolve(rootDir);
    const relative = path.relative(root, absolute);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new ExecutionCapsuleError(`Changed file escapes project root: ${file}`);
    }
    if (!fs.existsSync(absolute)) {
      return Object.freeze({ path: file, status: 'deleted-or-missing', fingerprint: null });
    }
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      throw new ExecutionCapsuleError(`Changed path may not be a symbolic link: ${file}`);
    }
    if (!stat.isFile()) {
      throw new ExecutionCapsuleError(`Changed path is not a file: ${file}`);
    }
    const rootReal = fs.realpathSync(root);
    const fileReal = fs.realpathSync(absolute);
    const realRelative = path.relative(rootReal, fileReal);
    if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
      throw new ExecutionCapsuleError(`Changed file resolves outside project root: ${file}`);
    }
    const content = fs.readFileSync(absolute);
    return Object.freeze({ path: file, status: 'present', fingerprint: `sha256:${createHash('sha256').update(content).digest('hex')}` });
  });
}

function resolveTargetDelta(contract, rootDir, changedFiles, cacheEntry) {
  const changedRefs = changedFileRefs(rootDir, changedFiles);

  if (!contract.workspaceTargets) {
    return Object.freeze({
      changedFiles: changedRefs,
      changedTargets: changedRefs.length > 0 ? ['__project_root__'] : [],
      affectedTargets: changedRefs.length > 0 ? ['__project_root__'] : [],
      dependencyTargets: ['__project_root__'],
    });
  }

  const registry = loadWorkspaceTargetRegistry(rootDir);
  const bound = [...new Set([
    contract.workspaceTargets.primary,
    ...contract.workspaceTargets.affected,
    ...contract.workspaceTargets.verification,
  ])].sort();

  const changedTargets = new Set();
  for (const file of changedRefs) {
    const candidates = bound
      .filter((id) => registry.targets[id] && pathInside(file.path, registry.targets[id].path))
      .sort((a, b) => {
        const pathA = registry.targets[a].path === '.' ? '' : registry.targets[a].path;
        const pathB = registry.targets[b].path === '.' ? '' : registry.targets[b].path;
        return pathB.length - pathA.length || a.localeCompare(b);
      });
    if (candidates.length === 0) {
      throw new ExecutionCapsuleError(`Changed file is outside the Development Contract target binding: ${file.path}`);
    }
    changedTargets.add(candidates[0]);
  }

  const selectedTargets = cacheEntry.selector.targetIds;
  const dependencyTargets = getTargetDependencyClosure(registry, selectedTargets);
  const affectedTargets = changedTargets.size > 0
    ? getAffectedTargetClosure(registry, [...changedTargets])
    : [];

  return Object.freeze({
    changedFiles: changedRefs,
    changedTargets: [...changedTargets].sort(),
    affectedTargets,
    dependencyTargets,
  });
}

function normalizeAuthoritativeSources(contract) {
  return contract.authoritativeSources.map((source) => Object.freeze({
    path: source.path,
    kind: source.kind,
    authority: source.authority,
    sections: [...source.sections],
    fingerprint: source.fingerprint,
  }));
}

function normalizeTargetFacts(entry) {
  return entry.targetFacts.map((fact) => Object.freeze({
    targetId: fact.targetId,
    root: fact.root,
    kind: fact.kind ?? null,
    dependencies: [...fact.dependencies],
    structureFingerprint: fact.structureFingerprint,
    fileCount: fact.fileCount,
    directoryCount: fact.directoryCount,
  }));
}

function relativeCachePath(rootDir, cachePath) {
  const root = path.resolve(rootDir);
  const absolute = path.resolve(cachePath);
  const relative = path.relative(root, absolute).replaceAll('\\', '/');
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new ExecutionCapsuleError('Context cache path escapes project root');
  }
  return relative;
}

function semanticCapsulePayload(capsule) {
  const {
    capsuleId,
    capsuleFingerprint,
    createdAt,
    ...semantic
  } = capsule;
  return semantic;
}

export function validateExecutionCapsule(capsule) {
  if (!plainObject(capsule)) throw new ExecutionCapsuleError('Execution Capsule must be an object');
  if (capsule.schemaVersion !== EXECUTION_CAPSULE_SCHEMA_VERSION) {
    throw new ExecutionCapsuleError(`Unsupported Execution Capsule schemaVersion: ${capsule.schemaVersion}`);
  }
  if (typeof capsule.capsuleId !== 'string' || !/^CAP-[a-f0-9]{20}$/.test(capsule.capsuleId)) {
    throw new ExecutionCapsuleError('capsuleId is invalid');
  }
  optionalId(capsule.contractId, 'contractId');
  optionalId(capsule.taskId, 'taskId');
  optionalId(capsule.runId, 'runId');
  optionalId(capsule.lifecycleId, 'lifecycleId');
  sha(capsule.sourceFingerprint, 'sourceFingerprint');
  if (capsule.developmentModeFingerprint !== null) sha(capsule.developmentModeFingerprint, 'developmentModeFingerprint');
  timestamp(capsule.createdAt, 'createdAt');

  if (!Array.isArray(capsule.authoritativeSources) || capsule.authoritativeSources.length === 0) {
    throw new ExecutionCapsuleError('authoritativeSources must be a non-empty array');
  }
  for (const source of capsule.authoritativeSources) {
    normalizeRelativePath(source.path, 'authoritative source path');
    sha(source.fingerprint, 'authoritative source fingerprint');
  }

  if (!plainObject(capsule.repositoryContext)) throw new ExecutionCapsuleError('repositoryContext is required');
  for (const field of ['cacheId', 'selectorFingerprint', 'inputFingerprint', 'entryFingerprint']) {
    sha(capsule.repositoryContext[field], `repositoryContext.${field}`);
  }
  normalizeRelativePath(capsule.repositoryContext.cachePath, 'repositoryContext.cachePath');
  fileRefs(capsule.repositoryContext.relevantFiles, 'repositoryContext.relevantFiles');
  fileRefs(capsule.repositoryContext.relevantTests, 'repositoryContext.relevantTests');
  if (!Array.isArray(capsule.repositoryContext.targets)) throw new ExecutionCapsuleError('repositoryContext.targets must be an array');

  if (!plainObject(capsule.targetDelta)) throw new ExecutionCapsuleError('targetDelta is required');
  stringArray(capsule.targetDelta.changedTargets, 'targetDelta.changedTargets');
  stringArray(capsule.targetDelta.affectedTargets, 'targetDelta.affectedTargets');
  stringArray(capsule.targetDelta.dependencyTargets, 'targetDelta.dependencyTargets');
  if (!Array.isArray(capsule.targetDelta.changedFiles)) throw new ExecutionCapsuleError('targetDelta.changedFiles must be an array');

  normalizeUpstreamTasks(capsule.upstreamAcceptedTasks);
  normalizeRuntimeFacts(capsule.verifiedRuntimeFacts);
  stringArray(capsule.requiredGateProfileIds, 'requiredGateProfileIds');

  const expectedFingerprint = fingerprintObject(semanticCapsulePayload(capsule));
  if (capsule.capsuleFingerprint !== expectedFingerprint) {
    throw new ExecutionCapsuleError('Execution Capsule fingerprint does not match content');
  }
  if (capsule.capsuleId !== `CAP-${expectedFingerprint.slice('sha256:'.length, 'sha256:'.length + 20)}`) {
    throw new ExecutionCapsuleError('Execution Capsule ID does not match fingerprint');
  }
  return true;
}

export function createExecutionCapsule({
  contract,
  rootDir = process.cwd(),
  cacheResolution,
  runId = null,
  lifecycleId = null,
  changedFiles = [],
  upstreamAcceptedTasks = [],
  verifiedRuntimeFacts = [],
  requiredGateProfileIds = [],
  createdAt = new Date().toISOString(),
} = {}) {
  validateDevelopmentContract(contract);
  if (!plainObject(cacheResolution) || !plainObject(cacheResolution.entry)) {
    throw new ExecutionCapsuleError('cacheResolution with a validated cache entry is required');
  }
  timestamp(createdAt, 'createdAt');

  const entry = cacheResolution.entry;
  try {
    validateContextCacheEntry(entry);
  } catch (error) {
    throw new ExecutionCapsuleError(`cacheResolution entry is invalid: ${error.message}`);
  }
  const targetDelta = resolveTargetDelta(contract, rootDir, changedFiles, entry);
  const upstream = normalizeUpstreamTasks(upstreamAcceptedTasks);
  const runtimeFacts = normalizeRuntimeFacts(verifiedRuntimeFacts);
  const gateIds = stringArray(requiredGateProfileIds, 'requiredGateProfileIds');

  const capsuleBase = {
    schemaVersion: EXECUTION_CAPSULE_SCHEMA_VERSION,
    contractId: contract.contractId,
    taskId: contract.taskId,
    runId: optionalId(runId, 'runId'),
    lifecycleId: optionalId(lifecycleId, 'lifecycleId'),
    sourceFingerprint: contract.sourceFingerprint,
    developmentModeFingerprint: contract.developmentMode?.fingerprint ?? null,
    workspaceTargets: contract.workspaceTargets ? structuredClone(contract.workspaceTargets) : null,
    authoritativeSources: normalizeAuthoritativeSources(contract),
    repositoryContext: {
      cacheId: entry.cacheId,
      selectorFingerprint: entry.selectorFingerprint,
      inputFingerprint: entry.inputFingerprint,
      entryFingerprint: entry.entryFingerprint,
      cachePath: relativeCachePath(rootDir, cacheResolution.cachePath),
      targets: normalizeTargetFacts(entry),
      relevantFiles: fileRefs(entry.inputs.relevantFiles, 'cache relevantFiles'),
      relevantTests: fileRefs(entry.inputs.relevantTests, 'cache relevantTests'),
    },
    targetDelta,
    upstreamAcceptedTasks: upstream,
    verifiedRuntimeFacts: runtimeFacts,
    requiredGateProfileIds: gateIds,
    createdAt,
  };

  const capsuleFingerprint = fingerprintObject(semanticCapsulePayload(capsuleBase));
  const capsule = {
    ...capsuleBase,
    capsuleId: `CAP-${capsuleFingerprint.slice('sha256:'.length, 'sha256:'.length + 20)}`,
    capsuleFingerprint,
  };

  validateExecutionCapsule(capsule);
  return Object.freeze(capsule);
}

export function prepareExecutionCapsule({
  contract,
  rootDir = process.cwd(),
  targetIds = null,
  relevantFiles = [],
  relevantTests = [],
  gateProfileRevision = null,
  runId = null,
  lifecycleId = null,
  changedFiles = [],
  upstreamAcceptedTasks = [],
  verifiedRuntimeFacts = [],
  requiredGateProfileIds = [],
  createdAt = new Date().toISOString(),
} = {}) {
  const changedRefs = changedFileRefs(rootDir, changedFiles);
  const changedPresent = changedRefs
    .filter((ref) => ref.status === 'present')
    .map((ref) => ref.path);
  const effectiveRelevantFiles = [...new Set([
    ...stringArray(relevantFiles, 'relevantFiles').map((file) => normalizeRelativePath(file, 'relevant file')),
    ...changedPresent,
  ])].sort();

  const cacheResolution = resolveRepositoryContextCache({
    contract,
    rootDir,
    targetIds,
    relevantFiles: effectiveRelevantFiles,
    relevantTests,
    gateProfileRevision,
    createdAt,
  });

  const capsule = createExecutionCapsule({
    contract,
    rootDir,
    cacheResolution,
    runId,
    lifecycleId,
    changedFiles,
    upstreamAcceptedTasks,
    verifiedRuntimeFacts,
    requiredGateProfileIds,
    createdAt,
  });

  return Object.freeze({
    capsule,
    cache: Object.freeze({
      status: cacheResolution.status,
      cachePath: cacheResolution.cachePath,
      invalidationReason: cacheResolution.invalidationReason,
      metrics: cacheResolution.metrics,
    }),
  });
}

export function checkExecutionCapsuleStaleness({
  capsule,
  contract,
  rootDir = process.cwd(),
} = {}) {
  validateExecutionCapsule(capsule);
  validateDevelopmentContract(contract);

  const changes = [];

  if (capsule.contractId !== contract.contractId || capsule.taskId !== contract.taskId) {
    changes.push({ code: 'CAPSULE_CONTRACT_IDENTITY_CHANGED' });
  }
  if (capsule.sourceFingerprint !== contract.sourceFingerprint) {
    changes.push({
      code: 'CAPSULE_SOURCE_FINGERPRINT_CHANGED',
      expected: capsule.sourceFingerprint,
      actual: contract.sourceFingerprint,
    });
  }
  if (capsule.developmentModeFingerprint !== (contract.developmentMode?.fingerprint ?? null)) {
    changes.push({ code: 'CAPSULE_DEVELOPMENT_MODE_CHANGED' });
  }

  const expectedWorkspaceFingerprint = capsule.workspaceTargets?.registryFingerprint ?? null;
  const currentWorkspaceFingerprint = contract.workspaceTargets?.registryFingerprint ?? null;
  if (expectedWorkspaceFingerprint !== currentWorkspaceFingerprint) {
    changes.push({
      code: 'CAPSULE_WORKSPACE_BINDING_CHANGED',
      expected: expectedWorkspaceFingerprint,
      actual: currentWorkspaceFingerprint,
    });
  }

  const contractStaleness = checkContractStaleness(contract, rootDir);
  if (contractStaleness.stale) {
    changes.push({
      code: 'CAPSULE_CONTRACT_STALE',
      detail: contractStaleness.changes,
    });
  }

  const cacheAbsolute = path.resolve(rootDir, capsule.repositoryContext.cachePath);
  const root = path.resolve(rootDir);
  const cacheRelative = path.relative(root, cacheAbsolute);
  if (cacheRelative === '..' || cacheRelative.startsWith(`..${path.sep}`) || path.isAbsolute(cacheRelative)) {
    changes.push({ code: 'CAPSULE_CACHE_PATH_ESCAPE' });
  } else if (!fs.existsSync(cacheAbsolute)) {
    changes.push({ code: 'CAPSULE_CACHE_ENTRY_MISSING' });
  } else {
    try {
      const entry = loadContextCacheEntry(cacheAbsolute, rootDir);
      if (entry.entryFingerprint !== capsule.repositoryContext.entryFingerprint) {
        changes.push({
          code: 'CAPSULE_CACHE_ENTRY_CHANGED',
          expected: capsule.repositoryContext.entryFingerprint,
          actual: entry.entryFingerprint,
        });
      } else {
        const cacheStaleness = checkContextCacheEntryStaleness({
          entry,
          contract,
          rootDir,
        });
        if (cacheStaleness.stale) {
          changes.push({
            code: 'CAPSULE_CACHE_STALE',
            detail: cacheStaleness.changes,
          });
        }
      }
    } catch (error) {
      changes.push({
        code: 'CAPSULE_CACHE_INVALID',
        message: error.message,
      });
    }
  }

  return Object.freeze({
    stale: changes.length > 0,
    capsuleId: capsule.capsuleId,
    capsuleFingerprint: capsule.capsuleFingerprint,
    changes,
  });
}

export function assertExecutionCapsuleFresh({
  capsule,
  contract,
  rootDir = process.cwd(),
} = {}) {
  const report = checkExecutionCapsuleStaleness({ capsule, contract, rootDir });
  if (report.stale) {
    throw new ExecutionCapsuleError('Execution Capsule is stale', report.changes);
  }
  return report;
}
