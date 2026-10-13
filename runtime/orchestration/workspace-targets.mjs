import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const WORKSPACE_TARGET_REGISTRY_SCHEMA_VERSION = 1;
export const WORKSPACE_TARGET_REGISTRY_PATH = '.development-kit/workspace.json';

const TARGET_ID_PATTERN = /^[A-Za-z0-9@][A-Za-z0-9._:@/-]{0,127}$/;
const COMMAND_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DISCOVERY_MARKERS = Object.freeze([
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
]);
const DISCOVERY_IGNORES = Object.freeze([
  '.git',
  '.development-kit',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'coverage',
]);

export class WorkspaceTargetError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'WorkspaceTargetError';
    this.details = details;
  }
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function stableContent(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function targetId(value, label = 'targetId') {
  if (typeof value !== 'string' || !TARGET_ID_PATTERN.test(value)) {
    throw new WorkspaceTargetError(`${label} must match ${TARGET_ID_PATTERN}`);
  }
  return value;
}

function commandId(value, label = 'command name') {
  if (typeof value !== 'string' || !COMMAND_ID_PATTERN.test(value)) {
    throw new WorkspaceTargetError(`${label} must match ${COMMAND_ID_PATTERN}`);
  }
  return value;
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new WorkspaceTargetError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function stringArray(value = [], label = 'array') {
  if (!Array.isArray(value)) throw new WorkspaceTargetError(`${label} must be an array`);
  return [...new Set(value.map((item) => text(item, `${label} entry`)))].sort();
}

function targetIdArray(value = [], label = 'target IDs') {
  if (!Array.isArray(value)) throw new WorkspaceTargetError(`${label} must be an array`);
  return [...new Set(value.map((item) => targetId(item, `${label} entry`)))].sort();
}

function normalizeRelativePath(value) {
  const raw = text(value, 'target.path').replaceAll('\\', '/');
  if (raw === '.') return '.';
  if (path.posix.isAbsolute(raw) || /^[A-Za-z]:\//.test(raw) || raw.startsWith('//')) {
    throw new WorkspaceTargetError(`target.path must be project-relative: ${value}`);
  }
  const normalized = path.posix.normalize(raw).replace(/^\.\//, '').replace(/\/$/, '');
  if (!normalized || normalized === '.') return '.';
  if (normalized === '..' || normalized.startsWith('../') || normalized.split('/').includes('..')) {
    throw new WorkspaceTargetError(`target.path may not escape the project root: ${value}`);
  }
  return normalized;
}

function resolveTargetPath(rootDir, targetPath) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, targetPath === '.' ? '' : targetPath);
  const relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new WorkspaceTargetError(`target.path escapes the project root: ${targetPath}`);
  }
  return resolved;
}

function normalizeCommands(value = {}) {
  if (!plainObject(value)) throw new WorkspaceTargetError('target.commands must be an object');
  return Object.fromEntries(Object.entries(value)
    .map(([name, command]) => [commandId(name), text(command, `command ${name}`)])
    .sort(([a], [b]) => a.localeCompare(b)));
}

function normalizeAdapter(value) {
  if (value === undefined || value === null) return null;
  if (!plainObject(value)) throw new WorkspaceTargetError('target.adapter must be an object or null');
  return structuredClone(value);
}

function normalizeTarget(value, id) {
  if (!plainObject(value)) throw new WorkspaceTargetError(`Target ${id} must be an object`);
  const supported = new Set(['path', 'kind', 'dependencies', 'commands', 'capabilities', 'verification', 'adapter']);
  for (const key of Object.keys(value)) {
    if (!supported.has(key)) throw new WorkspaceTargetError(`Target ${id} contains unsupported property: ${key}`);
  }

  const commands = normalizeCommands(value.commands ?? {});
  const verification = stringArray(value.verification ?? [], `${id}.verification`).map((name) => commandId(name, `${id}.verification entry`));
  for (const name of verification) {
    if (!(name in commands)) {
      throw new WorkspaceTargetError(`Target ${id} verification entry references missing command: ${name}`);
    }
  }

  const kind = value.kind === undefined || value.kind === null ? null : text(value.kind, `${id}.kind`);

  return {
    path: normalizeRelativePath(value.path ?? '.'),
    kind,
    dependencies: targetIdArray(value.dependencies ?? [], `${id}.dependencies`),
    commands,
    capabilities: stringArray(value.capabilities ?? [], `${id}.capabilities`),
    verification,
    adapter: normalizeAdapter(value.adapter),
  };
}

function assertDependencyGraph(targets) {
  const ids = new Set(Object.keys(targets));
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(id) {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];
      throw new WorkspaceTargetError(`Workspace target dependency cycle: ${cycle.join(' -> ')}`, { cycle });
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const dependency of targets[id].dependencies) {
      if (!ids.has(dependency)) {
        throw new WorkspaceTargetError(`Target ${id} depends on unknown target: ${dependency}`);
      }
      if (dependency === id) {
        throw new WorkspaceTargetError(`Target ${id} may not depend on itself`);
      }
      visit(dependency);
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of ids) visit(id);
}

export function normalizeWorkspaceTargetRegistry(registry, { rootDir = null } = {}) {
  if (!plainObject(registry)) throw new WorkspaceTargetError('Workspace target registry must be an object');
  const supported = new Set(['schemaVersion', 'targets']);
  for (const key of Object.keys(registry)) {
    if (!supported.has(key)) throw new WorkspaceTargetError(`Workspace target registry contains unsupported property: ${key}`);
  }
  if (registry.schemaVersion !== WORKSPACE_TARGET_REGISTRY_SCHEMA_VERSION) {
    throw new WorkspaceTargetError(`Unsupported workspace target registry schemaVersion: ${registry.schemaVersion}`);
  }
  if (!plainObject(registry.targets) || Object.keys(registry.targets).length === 0) {
    throw new WorkspaceTargetError('Workspace target registry must contain at least one target');
  }

  const targets = {};
  for (const [id, value] of Object.entries(registry.targets).sort(([a], [b]) => a.localeCompare(b))) {
    targetId(id);
    targets[id] = normalizeTarget(value, id);
  }
  assertDependencyGraph(targets);

  if (rootDir !== null) {
    for (const [id, target] of Object.entries(targets)) {
      const resolved = resolveTargetPath(rootDir, target.path);
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        throw new WorkspaceTargetError(`Target ${id} path is not an existing directory: ${target.path}`);
      }
    }
  }

  return {
    schemaVersion: WORKSPACE_TARGET_REGISTRY_SCHEMA_VERSION,
    targets,
  };
}

export function fingerprintWorkspaceTargetRegistry(registry) {
  const normalized = normalizeWorkspaceTargetRegistry(registry);
  return `sha256:${hash(JSON.stringify(stable(normalized)))}`;
}

export function getWorkspaceTargetRegistryPath(rootDir = process.cwd()) {
  return path.join(rootDir, WORKSPACE_TARGET_REGISTRY_PATH);
}

export function loadWorkspaceTargetRegistry(rootDir = process.cwd(), { required = true } = {}) {
  const registryPath = getWorkspaceTargetRegistryPath(rootDir);
  if (!fs.existsSync(registryPath)) {
    if (!required) return null;
    throw new WorkspaceTargetError(`Workspace target registry is missing: ${WORKSPACE_TARGET_REGISTRY_PATH}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    throw new WorkspaceTargetError(`Workspace target registry is not valid JSON: ${error.message}`);
  }
  return normalizeWorkspaceTargetRegistry(parsed, { rootDir });
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function persistWorkspaceTargetRegistry(registry, rootDir = process.cwd(), { expectedFingerprint = null } = {}) {
  const normalized = normalizeWorkspaceTargetRegistry(registry, { rootDir });
  const filePath = getWorkspaceTargetRegistryPath(rootDir);

  if (fs.existsSync(filePath) && expectedFingerprint !== null) {
    const current = loadWorkspaceTargetRegistry(rootDir);
    const currentFingerprint = fingerprintWorkspaceTargetRegistry(current);
    if (currentFingerprint !== expectedFingerprint) {
      throw new WorkspaceTargetError('Workspace target registry changed since it was read', {
        expectedFingerprint,
        currentFingerprint,
      });
    }
  }

  atomicWrite(filePath, stableContent(normalized));
  return {
    filePath,
    fingerprint: fingerprintWorkspaceTargetRegistry(normalized),
    registry: normalized,
  };
}

export function registerWorkspaceTarget(registry, id, target) {
  const normalized = normalizeWorkspaceTargetRegistry(registry);
  const nextId = targetId(id);
  if (normalized.targets[nextId]) {
    throw new WorkspaceTargetError(`Target already exists: ${nextId}`);
  }
  return normalizeWorkspaceTargetRegistry({
    schemaVersion: normalized.schemaVersion,
    targets: {
      ...normalized.targets,
      [nextId]: target,
    },
  });
}

function ensureTarget(registry, id) {
  const normalized = normalizeWorkspaceTargetRegistry(registry);
  const resolvedId = targetId(id);
  const value = normalized.targets[resolvedId];
  if (!value) throw new WorkspaceTargetError(`Unknown workspace target: ${resolvedId}`);
  return { registry: normalized, id: resolvedId, target: value };
}

export function getDirectTargetDependencies(registry, id) {
  const resolved = ensureTarget(registry, id);
  return [...resolved.target.dependencies];
}

export function getReverseTargetDependants(registry, id) {
  const resolved = ensureTarget(registry, id);
  return Object.entries(resolved.registry.targets)
    .filter(([, target]) => target.dependencies.includes(resolved.id))
    .map(([candidate]) => candidate)
    .sort();
}

function closure(seedIds, next) {
  const queue = [...seedIds];
  const seen = new Set();
  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const candidate of next(id)) {
      if (!seen.has(candidate)) queue.push(candidate);
    }
  }
  return [...seen].sort();
}

export function getTargetDependencyClosure(registry, targetIds) {
  const normalized = normalizeWorkspaceTargetRegistry(registry);
  const seeds = targetIdArray(targetIds, 'targetIds');
  for (const id of seeds) ensureTarget(normalized, id);
  return closure(seeds, (id) => normalized.targets[id].dependencies);
}

export function getAffectedTargetClosure(registry, targetIds) {
  const normalized = normalizeWorkspaceTargetRegistry(registry);
  const seeds = targetIdArray(targetIds, 'targetIds');
  for (const id of seeds) ensureTarget(normalized, id);
  return closure(seeds, (id) => getReverseTargetDependants(normalized, id));
}

export function getVerificationTargetClosure(registry, targetIds) {
  const affected = getAffectedTargetClosure(registry, targetIds);
  return getTargetDependencyClosure(registry, affected);
}

export function resolveTargetCommand(registry, targetIdValue, commandName, { rootDir = null } = {}) {
  const resolved = ensureTarget(registry, targetIdValue);
  const name = commandId(commandName);
  const command = resolved.target.commands[name];
  if (!command) {
    throw new WorkspaceTargetError(`Target ${resolved.id} does not declare command: ${name}`);
  }
  return Object.freeze({
    targetId: resolved.id,
    commandName: name,
    command,
    cwd: rootDir === null ? resolved.target.path : resolveTargetPath(rootDir, resolved.target.path),
    capabilities: [...resolved.target.capabilities],
    adapter: resolved.target.adapter === null ? null : structuredClone(resolved.target.adapter),
  });
}

export function resolveTargetsByCapability(registry, capability, { commandName = null } = {}) {
  const normalized = normalizeWorkspaceTargetRegistry(registry);
  const wanted = text(capability, 'capability');
  const requiredCommand = commandName === null ? null : commandId(commandName);
  return Object.entries(normalized.targets)
    .filter(([, target]) => target.capabilities.includes(wanted))
    .filter(([, target]) => requiredCommand === null || Boolean(target.commands[requiredCommand]))
    .map(([id]) => id)
    .sort();
}

export function resolveCapabilityRoute(registry, {
  capability,
  commandName,
  preferredTargets = [],
  rootDir = null,
} = {}) {
  const candidates = resolveTargetsByCapability(registry, capability, { commandName });
  if (candidates.length === 0) {
    throw new WorkspaceTargetError(`No workspace target declares capability ${capability} with command ${commandName}`);
  }
  const preferred = targetIdArray(preferredTargets, 'preferredTargets');
  const selectedId = preferred.find((id) => candidates.includes(id)) ?? candidates[0];
  return resolveTargetCommand(registry, selectedId, commandName, { rootDir });
}

export function createWorkspaceTargetBinding(registry, {
  primary,
  affected = null,
  verification = null,
} = {}) {
  const normalized = normalizeWorkspaceTargetRegistry(registry);
  const primaryId = targetId(primary, 'primary target');
  ensureTarget(normalized, primaryId);

  const affectedIds = affected === null
    ? getAffectedTargetClosure(normalized, [primaryId])
    : targetIdArray(affected, 'affected targets');
  const affectedWithPrimary = [...new Set([primaryId, ...affectedIds])].sort();
  for (const id of affectedWithPrimary) ensureTarget(normalized, id);

  const verificationIds = verification === null
    ? getVerificationTargetClosure(normalized, affectedWithPrimary)
    : targetIdArray(verification, 'verification targets');
  for (const id of verificationIds) ensureTarget(normalized, id);

  return Object.freeze({
    primary: primaryId,
    affected: affectedWithPrimary,
    verification: verificationIds,
  });
}

export function resolveWorkspaceTargetBinding(rootDir, binding) {
  if (!plainObject(binding)) throw new WorkspaceTargetError('workspace target binding must be an object');
  const registry = loadWorkspaceTargetRegistry(rootDir);
  const normalizedBinding = createWorkspaceTargetBinding(registry, binding);
  return Object.freeze({
    registryPath: WORKSPACE_TARGET_REGISTRY_PATH,
    registryFingerprint: fingerprintWorkspaceTargetRegistry(registry),
    ...normalizedBinding,
  });
}

export function validatePersistedWorkspaceTargetBinding(binding) {
  if (!plainObject(binding)) throw new WorkspaceTargetError('workspace target binding must be an object');
  const supported = new Set(['registryPath', 'registryFingerprint', 'primary', 'affected', 'verification']);
  for (const key of Object.keys(binding)) {
    if (!supported.has(key)) throw new WorkspaceTargetError(`workspace target binding contains unsupported property: ${key}`);
  }
  if (binding.registryPath !== WORKSPACE_TARGET_REGISTRY_PATH) {
    throw new WorkspaceTargetError(`workspace target registry path must be ${WORKSPACE_TARGET_REGISTRY_PATH}`);
  }
  if (typeof binding.registryFingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(binding.registryFingerprint)) {
    throw new WorkspaceTargetError('workspace target registry fingerprint is invalid');
  }
  targetId(binding.primary, 'primary target');
  const affected = targetIdArray(binding.affected, 'affected targets');
  const verification = targetIdArray(binding.verification, 'verification targets');
  if (!affected.includes(binding.primary)) {
    throw new WorkspaceTargetError('affected targets must include the primary target');
  }
  return true;
}

export function checkWorkspaceTargetBindingStaleness(binding, rootDir = process.cwd()) {
  validatePersistedWorkspaceTargetBinding(binding);
  let registry;
  try {
    registry = loadWorkspaceTargetRegistry(rootDir);
  } catch (error) {
    return {
      stale: true,
      expectedRegistryFingerprint: binding.registryFingerprint,
      currentRegistryFingerprint: null,
      changes: [{ code: 'WORKSPACE_REGISTRY_UNAVAILABLE', message: error.message }],
    };
  }

  const currentRegistryFingerprint = fingerprintWorkspaceTargetRegistry(registry);
  const changes = [];
  if (currentRegistryFingerprint !== binding.registryFingerprint) {
    changes.push({
      code: 'WORKSPACE_REGISTRY_CHANGED',
      expected: binding.registryFingerprint,
      actual: currentRegistryFingerprint,
    });
  }

  for (const [role, ids] of [
    ['primary', [binding.primary]],
    ['affected', binding.affected],
    ['verification', binding.verification],
  ]) {
    for (const id of ids) {
      if (!registry.targets[id]) changes.push({ code: 'WORKSPACE_TARGET_MISSING', role, targetId: id });
    }
  }

  return {
    stale: changes.length > 0,
    expectedRegistryFingerprint: binding.registryFingerprint,
    currentRegistryFingerprint,
    changes,
  };
}

function discoveryId(relativePath, used) {
  const base = relativePath === '.'
    ? 'root'
    : relativePath.replaceAll('\\', '/').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'target';
  let candidate = base;
  let suffix = 1;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

export function discoverWorkspaceTargetRegistry(rootDir = process.cwd(), {
  maxDepth = 6,
  markers = DISCOVERY_MARKERS,
  ignoredDirectories = DISCOVERY_IGNORES,
} = {}) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0) throw new WorkspaceTargetError('maxDepth must be a non-negative integer');
  const root = path.resolve(rootDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new WorkspaceTargetError('Workspace discovery root must be an existing directory');
  }

  const markerSet = new Set(stringArray(markers, 'markers'));
  const ignored = new Set(stringArray(ignoredDirectories, 'ignoredDirectories'));
  const found = [];

  function walk(directory, depth) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const markerNames = entries.filter((entry) => entry.isFile() && markerSet.has(entry.name)).map((entry) => entry.name).sort();
    if (markerNames.length > 0) {
      const relative = path.relative(root, directory).replaceAll('\\', '/') || '.';
      found.push({ relative, markers: markerNames });
    }
    if (depth >= maxDepth) return;
    for (const entry of entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignored.has(entry.name)) continue;
      walk(path.join(directory, entry.name), depth + 1);
    }
  }

  walk(root, 0);
  if (found.length === 0) found.push({ relative: '.', markers: [] });

  const used = new Set();
  const targets = {};
  for (const boundary of found.sort((a, b) => a.relative.localeCompare(b.relative))) {
    const id = discoveryId(boundary.relative, used);
    targets[id] = {
      path: boundary.relative,
      kind: 'discovered-boundary',
      dependencies: [],
      commands: {},
      capabilities: [],
      verification: [],
      adapter: {
        discovery: {
          markers: boundary.markers,
        },
      },
    };
  }

  return normalizeWorkspaceTargetRegistry({
    schemaVersion: WORKSPACE_TARGET_REGISTRY_SCHEMA_VERSION,
    targets,
  }, { rootDir });
}

export { DISCOVERY_MARKERS, DISCOVERY_IGNORES, TARGET_ID_PATTERN };
