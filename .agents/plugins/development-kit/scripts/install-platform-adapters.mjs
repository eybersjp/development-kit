import {
  accessSync,
  closeSync,
  constants,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const templateRoot = join(repositoryRoot, 'templates', 'platform-adapters');
const commandRoot = join(repositoryRoot, 'commands');
const commandNames = Object.freeze([
  'dk-autopilot',
  'dk-idea',
  'dk-research',
  'dk-spec',
  'dk-design',
  'dk-design-system',
  'dk-tasks',
  'dk-build',
  'dk-build-auto',
  'dk-test',
  'dk-review',
  'dk-simplify',
  'dk-debug',
  'dk-ship',
  'dk-control',
  'dk-status',
]);

export const PLATFORM_ADAPTERS = Object.freeze({
  claude: Object.freeze({
    targetPath: 'CLAUDE.md',
    templatePath: join(templateRoot, 'claude.md'),
    skillSource: commandRoot,
    skillTarget: join('.claude', 'skills'),
  }),
  cursor: Object.freeze({
    targetPath: join('.cursor', 'rules', 'dkf.mdc'),
    templatePath: join(templateRoot, 'cursor.mdc'),
  }),
  vscode: Object.freeze({
    targetPath: join('.github', 'copilot-instructions.md'),
    templatePath: join(templateRoot, 'vscode.md'),
  }),
  cline: Object.freeze({
    targetPath: join('.clinerules', 'dkf.md'),
    templatePath: join(templateRoot, 'cline.md'),
  }),
  windsurf: Object.freeze({
    targetPath: join('.windsurf', 'rules', 'dkf.md'),
    templatePath: join(templateRoot, 'windsurf.md'),
  }),
});

const platformFlags = new Map(
  Object.keys(PLATFORM_ADAPTERS).map((platform) => [`--${platform}`, platform]),
);

export function resolvePlatformSelection(args) {
  if (!Array.isArray(args)) {
    throw new TypeError('args must be an array');
  }

  if (args.includes('--all-platforms')) {
    return Object.keys(PLATFORM_ADAPTERS);
  }

  return [...new Set(args.map((arg) => platformFlags.get(arg)).filter(Boolean))];
}

function plannedFile(sourcePath, targetPath) {
  return { sourcePath, targetPath };
}

function isContained(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === '' || (
    pathFromRoot !== '..'
    && !pathFromRoot.startsWith(`..${sep}`)
    && !isAbsolute(pathFromRoot)
  );
}

function pathExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function validateSource(sourcePath) {
  const sourceStat = lstatSync(sourcePath);
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
    throw new Error(`Adapter source must be a regular non-symlink file: ${sourcePath}`);
  }
  accessSync(sourcePath, constants.R_OK);
  return readFileSync(sourcePath, 'utf8');
}

function validateDestination(targetRoot, targetPath) {
  if (!isContained(targetRoot, targetPath)) {
    throw new Error(`Adapter destination is outside targetDir: ${targetPath}`);
  }

  const rootExists = pathExists(targetRoot);
  let realRoot;
  if (rootExists) {
    const rootStat = lstatSync(targetRoot);
    if (rootStat.isSymbolicLink()) {
      throw new Error(`targetDir must not be a symbolic link or junction: ${targetRoot}`);
    }
    if (!rootStat.isDirectory()) {
      throw new Error(`targetDir must be a directory: ${targetRoot}`);
    }
    realRoot = realpathSync(targetRoot);
  }

  const pathFromRoot = relative(targetRoot, targetPath);
  const components = pathFromRoot.split(sep).filter(Boolean);
  let current = targetRoot;
  for (let index = 0; index < components.length; index += 1) {
    current = join(current, components[index]);
    if (!pathExists(current)) continue;

    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`Adapter destination contains a symbolic link or junction: ${current}`);
    }

    const isDestination = index === components.length - 1;
    if (!isDestination && !stat.isDirectory()) {
      throw new Error(`Adapter destination parent must be a directory: ${current}`);
    }
    if (isDestination && !stat.isFile()) {
      throw new Error(`Adapter destination must be a regular file: ${current}`);
    }

    // On Windows, realpath also catches directory junctions/reparse points that
    // may not be reported as symbolic links by lstat.
    if (realRoot && !isContained(realRoot, realpathSync(current))) {
      throw new Error(`Adapter destination escapes targetDir through a linked path: ${current}`);
    }
  }
}

function writePlannedFile(file, { dryRun, force, targetRoot }) {
  if (file.status === 'preserved') return 'preserved';
  if (dryRun) {
    return 'planned';
  }

  const targetParent = dirname(file.targetPath);
  mkdirSync(targetParent, { recursive: true });
  validateDestination(targetRoot, file.targetPath);
  if (pathExists(file.targetPath) && !force) return 'preserved';

  const temporaryPath = join(targetParent, `.dkf-install-${randomUUID()}.tmp`);
  let temporaryHandle;
  try {
    temporaryHandle = openSync(temporaryPath, 'wx');
    writeFileSync(temporaryHandle, file.content, 'utf8');
    const completedHandle = temporaryHandle;
    temporaryHandle = undefined;
    closeSync(completedHandle);

    // Recheck immediately before changing the destination entry. The rename
    // replaces the entry rather than writing through a possible hard link.
    validateDestination(targetRoot, file.targetPath);
    const destinationExists = pathExists(file.targetPath);
    if (destinationExists && !force) return 'preserved';
    if (destinationExists && process.platform === 'win32') {
      unlinkSync(file.targetPath);
    }
    renameSync(temporaryPath, file.targetPath);
    return 'written';
  } finally {
    if (temporaryHandle !== undefined) closeSync(temporaryHandle);
    if (pathExists(temporaryPath)) unlinkSync(temporaryPath);
  }
}

export function installPlatformAdapters({
  targetDir,
  platforms,
  dryRun = false,
  force = false,
} = {}) {
  if (typeof targetDir !== 'string' || targetDir.length === 0) {
    throw new TypeError('targetDir must be a non-empty string');
  }
  if (!Array.isArray(platforms)) {
    throw new TypeError('platforms must be an array');
  }

  const resolvedTargetDir = resolve(targetDir);
  const selected = [...new Set(platforms)];
  for (const platform of selected) {
    if (!PLATFORM_ADAPTERS[platform]) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  const files = selected.map((platform) => {
    const adapter = PLATFORM_ADAPTERS[platform];
    return plannedFile(adapter.templatePath, resolve(resolvedTargetDir, adapter.targetPath));
  });

  if (selected.includes('claude')) {
    for (const command of commandNames) {
      files.push(plannedFile(
        join(PLATFORM_ADAPTERS.claude.skillSource, `${command}.md`),
        resolve(resolvedTargetDir, PLATFORM_ADAPTERS.claude.skillTarget, command, 'SKILL.md'),
      ));
    }
  }

  const preflightedFiles = files.map((file) => {
    const content = validateSource(file.sourcePath);
    validateDestination(resolvedTargetDir, file.targetPath);
    const status = pathExists(file.targetPath) && !force ? 'preserved' : 'planned';
    return { ...file, content, status };
  });

  return preflightedFiles.map((file) => {
    const status = writePlannedFile(file, { dryRun, force, targetRoot: resolvedTargetDir });
    const { content, ...result } = file;
    return { ...result, status };
  });
}
