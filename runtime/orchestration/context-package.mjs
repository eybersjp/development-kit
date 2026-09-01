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

export const ISOLATION_LEVELS = Object.freeze({
  L1: 'L1_FRESH_CONTEXT',
  L2: 'L2_SEPARATE_ROLE',
  L3: 'L3_SEPARATE_PROCESS',
  L4: 'L4_EXTERNAL_VERIFIER',
});

export function computeIsolationLevel({ role, contextIsolation, separateProcess = false, externalVerifier = false } = {}) {
  if (externalVerifier) return ISOLATION_LEVELS.L4;
  if (separateProcess) return ISOLATION_LEVELS.L3;
  if (role && role !== 'implementation-agent' && role !== 'implementer') return ISOLATION_LEVELS.L2;
  if (contextIsolation === 'fresh') return ISOLATION_LEVELS.L1;
  return 'L0_SAME_CONTEXT';
}

export function buildContextPackage({
  contract,
  role,
  rootDir = process.cwd(),
  contextIsolation,
  repositoryState = {},
  implementationReport = null,
  capabilities = {},
  separateProcess = false,
  externalVerifier = false,
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

  const isolationLevel = computeIsolationLevel({
    role,
    contextIsolation: isolation,
    separateProcess,
    externalVerifier,
  });

  const pkg = {
    schemaVersion: '1.0.0',
    contractId: contract.contractId,
    taskId: contract.taskId,
    role,
    purpose,
    contextIsolation: isolation,
    isolationLevel,
    sourceFingerprint: contract.sourceFingerprint,
    createdAt,
    contract: structuredClone(contract),
    authoritativeSources: sources,
    repositoryState: cloneObject(repositoryState, 'repositoryState'),
    capabilities: cloneObject(capabilities, 'capabilities'),
    isolationMetadata: {
      freshContext: isolation === 'fresh',
      sourceRehydrated: sources.length > 0,
      repositoryReRead: true,
      implementationSummaryInherited: implementationReport !== null,
      separateAgentRole: purpose !== 'implementation',
      sameModelOrUnknown: true,
      separateProcess: Boolean(separateProcess),
      separateHost: false,
      externalVerifier: Boolean(externalVerifier),
    },
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
  if (contextPackage.role === 'implementation-agent' || contextPackage.role === 'implementer') {
    throw new ContextPackageError('Implementation role cannot self-certify verification');
  }
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
