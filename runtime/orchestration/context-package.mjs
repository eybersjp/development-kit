import fs from 'node:fs';
import path from 'node:path';

import {
  checkContractStaleness,
  computeFileFingerprint,
  validateDevelopmentContract,
} from './development-contract.mjs';

const ROLE_PURPOSE = Object.freeze({
  implementer: 'implementation',
  'implementation-agent': 'implementation',
  'spec-verifier': 'verification',
  'spec-reviewer': 'verification',
  'test-engineer': 'verification',
  'code-reviewer': 'technical-review',
  'security-reviewer': 'technical-review',
  'accessibility-reviewer': 'technical-review',
  'design-reviewer': 'design-review',
  'simplicity-reviewer': 'technical-review',
  'architecture-reviewer': 'architecture-review',
});

export class ContextPackageError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ContextPackageError';
    this.details = details;
  }
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneObject(value, label) {
  if (value === undefined || value === null) return {};
  if (!plainObject(value)) throw new ContextPackageError(`${label} must be an object`);
  return structuredClone(value);
}

function resolveSource(rootDir, source) {
  const absolute = path.resolve(rootDir, source.path);
  const root = path.resolve(rootDir);
  const relative = path.relative(root, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ContextPackageError(`Authoritative source escapes project root: ${source.path}`);
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new ContextPackageError(`Authoritative source is unavailable: ${source.path}`);
  }
  const fingerprint = computeFileFingerprint(rootDir, source.path);
  if (fingerprint !== source.fingerprint) {
    throw new ContextPackageError(`Authoritative source fingerprint changed: ${source.path}`);
  }
  const stat = fs.statSync(absolute);
  if (stat.size > 2 * 1024 * 1024) {
    throw new ContextPackageError(`Authoritative source exceeds 2 MiB context safety limit: ${source.path}`);
  }
  return {
    ...structuredClone(source),
    currentFingerprint: fingerprint,
    content: fs.readFileSync(absolute, 'utf8'),
  };
}

export function contractNeedsDesignAuthority(contract) {
  validateDevelopmentContract(contract);
  return (Array.isArray(contract.designConstraints) && contract.designConstraints.length > 0)
    || contract.authoritativeSources.some((source) => source.kind === 'design-authority' || /(^|\/)design\.md$/i.test(source.path));
}

export function buildContextPackage({
  contract,
  role,
  rootDir = process.cwd(),
  contextIsolation,
  repositoryState = {},
  implementationReport = null,
  capabilities = {},
  createdAt = new Date().toISOString(),
} = {}) {
  validateDevelopmentContract(contract);
  if (typeof role !== 'string' || !ROLE_PURPOSE[role]) {
    throw new ContextPackageError(`Unsupported orchestration role: ${role}`);
  }
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new ContextPackageError('createdAt must be a valid timestamp');
  }

  const purpose = ROLE_PURPOSE[role];
  const isolation = contextIsolation ?? (purpose === 'implementation' ? 'fresh' : 'rehydrated');
  if (!['fresh', 'rehydrated'].includes(isolation)) {
    throw new ContextPackageError('Context isolation must be fresh or rehydrated');
  }

  const staleness = checkContractStaleness(contract, rootDir);
  if (staleness.stale) {
    throw new ContextPackageError('Cannot build context from a stale Development Contract', staleness.changes);
  }

  const sources = contract.authoritativeSources.map((source) => resolveSource(rootDir, source));
  const needsDesign = contractNeedsDesignAuthority(contract);
  const designSource = sources.find((source) => source.kind === 'design-authority' || /(^|\/)design\.md$/i.test(source.path));
  if (needsDesign && !designSource) {
    throw new ContextPackageError('Design-governed work requires authoritative design.md binding');
  }

  const pkg = {
    schemaVersion: '1.0.0',
    contractId: contract.contractId,
    taskId: contract.taskId,
    role,
    purpose,
    contextIsolation: isolation,
    sourceFingerprint: contract.sourceFingerprint,
    createdAt,
    contract: structuredClone(contract),
    authoritativeSources: sources,
    repositoryState: cloneObject(repositoryState, 'repositoryState'),
    capabilities: cloneObject(capabilities, 'capabilities'),
    designAuthority: designSource ? {
      path: designSource.path,
      fingerprint: designSource.fingerprint,
      bound: true,
    } : { bound: false },
    upstreamImplementationReport: implementationReport === null ? null : {
      authority: 'non-authoritative',
      value: structuredClone(implementationReport),
    },
  };

  return Object.freeze(pkg);
}

export function assertIndependentVerificationContext(contextPackage) {
  if (!plainObject(contextPackage)) throw new ContextPackageError('Context package is required');
  if (contextPackage.purpose !== 'verification') throw new ContextPackageError('Verification requires a verification context package');
  if (!['fresh', 'rehydrated'].includes(contextPackage.contextIsolation)) {
    throw new ContextPackageError('Verification context is not independently isolated');
  }
  if (!Array.isArray(contextPackage.authoritativeSources) || contextPackage.authoritativeSources.length === 0) {
    throw new ContextPackageError('Verification context lacks independently resolved authoritative sources');
  }
  if (contextPackage.upstreamImplementationReport?.authority && contextPackage.upstreamImplementationReport.authority !== 'non-authoritative') {
    throw new ContextPackageError('Upstream implementation report may not become authoritative');
  }
  return true;
}
