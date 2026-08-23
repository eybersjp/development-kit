import { createHash } from 'node:crypto';
import path from 'node:path';

const DECISIONS = Object.freeze({
  ALLOW: 'ALLOW',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',
  BLOCK: 'BLOCK',
});

const BLAST_RADIUS = Object.freeze({
  NONE: 'none',
  PROJECT: 'project',
  DECLARED_RESOURCE: 'declared-resource',
  REMOTE_PROJECT: 'remote-project',
  UNKNOWN: 'unknown',
  EXTERNAL_FILESYSTEM: 'external-filesystem',
  HOST_WIDE: 'host-wide',
});

const BLAST_RANK = Object.freeze({
  [BLAST_RADIUS.NONE]: 0,
  [BLAST_RADIUS.DECLARED_RESOURCE]: 1,
  [BLAST_RADIUS.PROJECT]: 2,
  [BLAST_RADIUS.REMOTE_PROJECT]: 3,
  [BLAST_RADIUS.UNKNOWN]: 4,
  [BLAST_RADIUS.EXTERNAL_FILESYSTEM]: 5,
  [BLAST_RADIUS.HOST_WIDE]: 6,
});

const ENVIRONMENT_MODES = new Set([
  'local-isolated',
  'local',
  'remote-development',
  'staging',
  'production',
]);
const REMOTE_ENVIRONMENTS = new Set(['remote-development', 'staging', 'production']);

export class CommandSafetyError extends Error {
  constructor(message, assessment) {
    super(message);
    this.name = 'CommandSafetyError';
    this.assessment = assessment;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeCommand(command) {
  if (typeof command !== 'string' || command.trim() === '') {
    throw new CommandSafetyError('Command must be a non-empty string', null);
  }
  return command.trim().replace(/\s+/g, ' ');
}

export function fingerprintCommand(command) {
  return `sha256:${createHash('sha256').update(normalizeCommand(command)).digest('hex')}`;
}

function normalizeProjectRoot(projectRoot) {
  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') {
    throw new CommandSafetyError('Execution environment requires projectRoot', null);
  }
  return path.resolve(projectRoot);
}

function portablePath(value) {
  return value.replaceAll('\\', '/');
}

function looksAbsolutePortable(value) {
  const normalized = portablePath(value);
  return path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//');
}

function hasUnresolvedShellExpansion(value) {
  return /^(?:~|\$|%[A-Za-z_][A-Za-z0-9_]*%)/.test(value)
    || /\$\{[^}]+\}/.test(value)
    || /\$[A-Za-z_][A-Za-z0-9_]*/.test(value);
}

function isWithinProject(projectRoot, candidate) {
  if (!candidate || typeof candidate !== 'string') return false;
  const root = normalizeProjectRoot(projectRoot);
  const portable = portablePath(candidate.trim().replace(/^['"]|['"]$/g, ''));

  if (hasUnresolvedShellExpansion(portable)) return false;
  if (/^[A-Za-z]:\//.test(portable) && process.platform !== 'win32') return false;

  const resolved = path.resolve(root, portable);
  const relative = path.relative(root, resolved);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function normalizeResourceList(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new CommandSafetyError('Declared resources must be arrays', null);
  return [...new Set(value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) throw new CommandSafetyError('Declared resource names must be non-empty strings', null);
    return item.trim();
  }))];
}

export function createExecutionEnvironment({
  mode = 'local-isolated',
  projectRoot = process.cwd(),
  linkedRemote = false,
  projectId = null,
  declaredResources = {},
} = {}) {
  if (!ENVIRONMENT_MODES.has(mode)) throw new CommandSafetyError(`Unsupported execution environment mode: ${mode}`, null);
  if (typeof linkedRemote !== 'boolean') throw new CommandSafetyError('linkedRemote must be boolean', null);
  if (!isPlainObject(declaredResources)) throw new CommandSafetyError('declaredResources must be an object', null);

  return Object.freeze({
    mode,
    projectRoot: normalizeProjectRoot(projectRoot),
    linkedRemote,
    projectId: projectId === null ? null : String(projectId),
    declaredResources: Object.freeze({
      dockerContainers: normalizeResourceList(declaredResources.dockerContainers),
      dockerProjects: normalizeResourceList(declaredResources.dockerProjects),
      supabaseProjectRefs: normalizeResourceList(declaredResources.supabaseProjectRefs),
      filesystemPaths: normalizeResourceList(declaredResources.filesystemPaths),
    }),
  });
}

function raiseBlastRadius(result, blastRadius, projectOwnershipProvable) {
  if ((BLAST_RANK[blastRadius] ?? BLAST_RANK[BLAST_RADIUS.UNKNOWN]) > (BLAST_RANK[result.blastRadius] ?? 0)) {
    result.blastRadius = blastRadius;
  }
  result.projectOwnershipProvable = result.projectOwnershipProvable && projectOwnershipProvable;
}

function extractDockerRmTargets(command) {
  const match = command.match(/(?:^|[;&|]\s*)docker\s+(?:container\s+)?rm\b([^;&|]*)/i);
  if (!match) return [];
  const rest = match[1];
  if (/\$\s*\(\s*docker\s+ps\b/i.test(rest) || /`\s*docker\s+ps\b/i.test(rest)) return ['*ALL_RUNNING_OR_EXISTING*'];
  return rest
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^-[A-Za-z-]+$/.test(token));
}

function extractFilesystemTargets(command) {
  const targets = [];

  for (const match of command.matchAll(/(?:^|[;&|]\s*)rm\s+(?:-[A-Za-z]*[rRfF][A-Za-z]*\s+)+([^;&|]+)/gi)) {
    targets.push(...match[1].trim().split(/\s+/).filter(Boolean));
  }

  for (const match of command.matchAll(/(?:^|[;&|]\s*)Remove-Item\b([^;&|]*)/gi)) {
    const body = match[1];
    if (!/(?:-Recurse|-Force)/i.test(body)) continue;
    const tokens = body.split(/\s+/).filter(Boolean).filter((token) => !token.startsWith('-'));
    targets.push(...tokens);
  }

  return targets.map((target) => target.replace(/^['"]|['"]$/g, ''));
}

function classifyDocker(command, environment, result) {
  if (!/\bdocker\b/i.test(command)) return;

  if (/\bdocker\s+(?:system|container|image|volume|network)\s+prune\b/i.test(command)) {
    result.destructive = true;
    result.family ??= 'docker';
    raiseBlastRadius(result, BLAST_RADIUS.HOST_WIDE, false);
    result.reasons.push('Docker prune can affect resources outside the active project');
  }

  if (/\bdocker\s+(?:compose|compose\s+-[^;&|]+)\s+down\b/i.test(command)) {
    result.destructive = true;
    result.family ??= 'docker';
    const projectName = command.match(/(?:--project-name|-p)\s+([^\s;&|]+)/i)?.[1] ?? null;
    const declared = projectName && environment.declaredResources.dockerProjects.includes(projectName);
    raiseBlastRadius(result, declared ? BLAST_RADIUS.DECLARED_RESOURCE : BLAST_RADIUS.UNKNOWN, Boolean(declared));
    result.reasons.push(declared
      ? 'Docker Compose teardown targets a declared project'
      : 'Docker Compose teardown project ownership was not explicit');
  }

  const rmTargets = extractDockerRmTargets(command);
  if (rmTargets.length === 0) return;

  result.destructive = true;
  result.family ??= 'docker';
  if (rmTargets.includes('*ALL_RUNNING_OR_EXISTING*')) {
    raiseBlastRadius(result, BLAST_RADIUS.HOST_WIDE, false);
    result.reasons.push('Docker remove command expands to all host containers');
    return;
  }

  const declared = new Set(environment.declaredResources.dockerContainers);
  const allDeclared = rmTargets.every((target) => declared.has(target));
  result.targets.push(...rmTargets.map((target) => ({ type: 'docker-container', value: target })));
  raiseBlastRadius(result, allDeclared ? BLAST_RADIUS.DECLARED_RESOURCE : BLAST_RADIUS.UNKNOWN, allDeclared);
  if (!allDeclared) result.reasons.push('Docker remove targets are not fully declared as project resources');
}

function classifyFilesystem(command, environment, result) {
  const targets = extractFilesystemTargets(command);
  if (targets.length === 0) return;

  result.destructive = true;
  result.family ??= 'filesystem';
  result.targets.push(...targets.map((target) => ({ type: 'filesystem-path', value: target })));

  let external = false;
  let unknown = false;
  for (const target of targets) {
    const normalized = portablePath(target);
    if (['/', '/*', '~', '~/', '..', '../'].includes(normalized) || hasUnresolvedShellExpansion(normalized)) {
      external = true;
      continue;
    }
    if (looksAbsolutePortable(normalized) && !isWithinProject(environment.projectRoot, target)) {
      external = true;
      continue;
    }
    if (!isWithinProject(environment.projectRoot, target)) unknown = true;
  }

  if (external) {
    raiseBlastRadius(result, BLAST_RADIUS.EXTERNAL_FILESYSTEM, false);
    result.reasons.push('Recursive filesystem deletion targets a path outside the active project');
  } else if (unknown) {
    raiseBlastRadius(result, BLAST_RADIUS.UNKNOWN, false);
    result.reasons.push('Filesystem deletion target ownership could not be proven');
  } else {
    raiseBlastRadius(result, BLAST_RADIUS.PROJECT, true);
  }
}

function classifyGit(command, result) {
  if (/\bgit\s+reset\s+--hard\b/i.test(command) || /\bgit\s+clean\b[^\n]*(?:-f|-x|-d)/i.test(command)) {
    result.destructive = true;
    result.family ??= 'git';
    raiseBlastRadius(result, BLAST_RADIUS.PROJECT, true);
    result.reasons.push('Git command can irreversibly discard local work');
  }
}

function classifyDatabase(command, environment, result) {
  const dbReset = /\b(?:npx\s+)?supabase\s+db\s+reset\b/i.test(command);
  const destructiveSql = /\b(?:drop\s+(?:database|schema|table)|truncate\s+table)\b/i.test(command);
  if (!dbReset && !destructiveSql) return;

  result.destructive = true;
  result.family ??= 'database';
  if (environment.linkedRemote || REMOTE_ENVIRONMENTS.has(environment.mode)) {
    result.remoteMutation = true;
    const ownership = environment.declaredResources.supabaseProjectRefs.length > 0;
    raiseBlastRadius(result, BLAST_RADIUS.REMOTE_PROJECT, ownership);
    result.reasons.push('Destructive database operation is associated with a remote environment');
  } else {
    raiseBlastRadius(result, BLAST_RADIUS.PROJECT, true);
    result.reasons.push('Destructive database operation is scoped to the local project environment');
  }
}

function classifyInfrastructure(command, result) {
  if (/\bterraform\s+destroy\b/i.test(command)) {
    result.destructive = true;
    result.remoteMutation = true;
    result.family ??= 'infrastructure';
    raiseBlastRadius(result, BLAST_RADIUS.REMOTE_PROJECT, true);
    result.reasons.push('Terraform destroy removes managed infrastructure');
  }
  if (/\bkubectl\s+delete\b/i.test(command)) {
    result.destructive = true;
    result.remoteMutation = true;
    result.family ??= 'infrastructure';
    raiseBlastRadius(result, BLAST_RADIUS.REMOTE_PROJECT, true);
    result.reasons.push('kubectl delete removes cluster resources');
  }
}

function commandHasRemoteMutation(command) {
  const patterns = [
    /\bgit\s+push\b/i,
    /\bnpm\s+publish\b/i,
    /\bpnpm\s+publish\b/i,
    /\byarn\s+npm\s+publish\b/i,
    /\bvercel\s+(?:deploy\s+)?--prod\b/i,
    /\bnetlify\s+deploy\b[^\n]*--prod\b/i,
    /\bsupabase\s+db\s+push\b/i,
    /\bsupabase\s+migration\s+up\b[^\n]*(?:--linked|--project-ref)\b/i,
    /\bgh\s+release\s+(?:create|delete)\b/i,
    /\bterraform\s+(?:apply|destroy)\b/i,
    /\bkubectl\s+(?:apply|delete|replace|patch|scale)\b/i,
  ];
  return patterns.some((pattern) => pattern.test(command));
}

export function classifyCommand(command, environmentInput = {}) {
  const normalized = normalizeCommand(command);
  const environment = createExecutionEnvironment({
    ...environmentInput,
    projectRoot: environmentInput?.projectRoot ?? process.cwd(),
  });

  const result = {
    command: normalized,
    commandFingerprint: fingerprintCommand(normalized),
    family: null,
    destructive: false,
    remoteMutation: false,
    blastRadius: BLAST_RADIUS.NONE,
    projectOwnershipProvable: true,
    targets: [],
    reasons: [],
    environment,
  };

  classifyDocker(normalized, environment, result);
  classifyFilesystem(normalized, environment, result);
  classifyGit(normalized, result);
  classifyDatabase(normalized, environment, result);
  classifyInfrastructure(normalized, result);

  if (commandHasRemoteMutation(normalized)) {
    result.remoteMutation = true;
    result.family ??= 'remote-mutation';
    raiseBlastRadius(result, BLAST_RADIUS.REMOTE_PROJECT, true);
    result.reasons.push('Command mutates or publishes to a remote system');
  }

  if (result.destructive && result.blastRadius === BLAST_RADIUS.NONE) {
    raiseBlastRadius(result, BLAST_RADIUS.UNKNOWN, false);
  }

  return result;
}

function validApprovalFor(assessment, approval, capability) {
  if (!isPlainObject(approval)) return false;
  if (approval.commandFingerprint !== assessment.commandFingerprint) return false;
  if (capability === 'destructive' && approval.destructiveOperations !== true) return false;
  if (capability === 'remote' && approval.remoteMutation !== true) return false;
  return true;
}

function broadBlastApproval(assessment, approval) {
  return validApprovalFor(assessment, approval, 'destructive')
    && Array.isArray(approval.allowedBlastRadii)
    && approval.allowedBlastRadii.includes(assessment.blastRadius);
}

export function evaluateCommandSafety({ command, contract, environment = {}, approval = null } = {}) {
  if (!isPlainObject(contract) || !isPlainObject(contract.executionSafety)) {
    throw new CommandSafetyError('A Development Contract with executionSafety policy is required', null);
  }

  const assessment = classifyCommand(command, environment);
  const policy = contract.executionSafety;
  const blockers = [];
  const approvalsNeeded = [];

  const broadBlast = [
    BLAST_RADIUS.HOST_WIDE,
    BLAST_RADIUS.EXTERNAL_FILESYSTEM,
    BLAST_RADIUS.UNKNOWN,
  ].includes(assessment.blastRadius);

  if (broadBlast && policy.resourceScope === 'project-only' && !broadBlastApproval(assessment, approval)) {
    blockers.push(`Blast radius ${assessment.blastRadius} exceeds project-only resource scope`);
  }

  if (assessment.destructive) {
    if (policy.destructiveOperations === 'forbidden') {
      blockers.push('Development Contract forbids destructive operations');
    } else if (!validApprovalFor(assessment, approval, 'destructive')) {
      approvalsNeeded.push('Explicit approval is required for this destructive command');
    }
  }

  if (assessment.remoteMutation) {
    if (policy.remoteMutation === 'forbidden') {
      blockers.push('Development Contract forbids remote mutation');
    } else if (policy.remoteMutation === 'explicit-contract' && !validApprovalFor(assessment, approval, 'remote')) {
      approvalsNeeded.push('Explicit approval is required for this remote mutation');
    }
  }

  if (!assessment.projectOwnershipProvable && !broadBlast && policy.resourceScope === 'project-only') {
    blockers.push('Resource ownership could not be proven inside the active project');
  }

  const decision = blockers.length > 0
    ? DECISIONS.BLOCK
    : approvalsNeeded.length > 0
      ? DECISIONS.REQUIRE_APPROVAL
      : DECISIONS.ALLOW;

  return { ...assessment, decision, blockers, approvalsNeeded };
}

export function assertCommandAllowed(options) {
  const assessment = evaluateCommandSafety(options);
  if (assessment.decision !== DECISIONS.ALLOW) {
    throw new CommandSafetyError(`Command safety decision: ${assessment.decision}`, assessment);
  }
  return assessment;
}

export { DECISIONS, BLAST_RADIUS };
