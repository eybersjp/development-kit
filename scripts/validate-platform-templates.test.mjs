import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accessSync,
  constants,
  existsSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PLATFORM_ADAPTERS,
  installPlatformAdapters,
  resolvePlatformSelection,
} from './install-platform-adapters.mjs';

const LIFECYCLE = [
  'UNDERSTAND',
  'DEFINE',
  'DESIGN',
  'PLAN',
  'IMPLEMENT',
  'VERIFY',
  'REVIEW',
  'SIMPLIFY',
  'COMPLETE',
];

const COMMANDS = [
  '/dk-autopilot',
  '/dk-idea',
  '/dk-research',
  '/dk-spec',
  '/dk-design',
  '/dk-tasks',
  '/dk-build',
  '/dk-build-auto',
  '/dk-test',
  '/dk-review',
  '/dk-simplify',
  '/dk-debug',
  '/dk-ship',
  '/dk-status',
];

const EXPECTED_TARGETS = {
  claude: 'CLAUDE.md',
  cursor: join('.cursor', 'rules', 'dkf.mdc'),
  vscode: join('.github', 'copilot-instructions.md'),
  cline: join('.clinerules', 'dkf.md'),
  windsurf: join('.windsurf', 'rules', 'dkf.md'),
};

const REPOSITORY_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function makeTempProject(t) {
  const project = mkdtempSync(join(tmpdir(), 'dk-platform-adapters-'));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  return project;
}

function targetPath(project, platform) {
  return join(project, EXPECTED_TARGETS[platform]);
}

function createSymlinkOrSkip(t, target, path, type) {
  try {
    symlinkSync(target, path, type);
    return true;
  } catch (error) {
    if (['EACCES', 'EPERM', 'ENOSYS', 'UNKNOWN'].includes(error?.code)) {
      t.skip(`filesystem links are unavailable in this environment: ${error.code}`);
      return false;
    }
    throw error;
  }
}

test('adapter metadata maps every supported platform to its native project target', () => {
  assert.deepEqual(Object.keys(PLATFORM_ADAPTERS).sort(), Object.keys(EXPECTED_TARGETS).sort());

  for (const [platform, expectedTarget] of Object.entries(EXPECTED_TARGETS)) {
    assert.equal(PLATFORM_ADAPTERS[platform].targetPath, expectedTarget);
    assert.equal(typeof PLATFORM_ADAPTERS[platform].templatePath, 'string');
    assert.ok(PLATFORM_ADAPTERS[platform].templatePath.length > 0);
  }

  assert.equal(typeof PLATFORM_ADAPTERS.claude.skillSource, 'string');
  assert.ok(PLATFORM_ADAPTERS.claude.skillSource.length > 0);
  assert.equal(PLATFORM_ADAPTERS.claude.skillTarget, join('.claude', 'skills'));
});

test('each platform template stays synchronized with the canonical lifecycle and all DK commands', () => {
  for (const [platform, adapter] of Object.entries(PLATFORM_ADAPTERS)) {
    assert.ok(existsSync(adapter.templatePath), `${platform} template is missing: ${adapter.templatePath}`);
    const content = readFileSync(adapter.templatePath, 'utf8');

    let previousStage = -1;
    for (const stage of LIFECYCLE) {
      const stageIndex = content.indexOf(stage);
      assert.ok(stageIndex >= 0, `${platform} template is missing lifecycle stage ${stage}`);
      assert.ok(stageIndex > previousStage, `${platform} template has lifecycle stage ${stage} out of order`);
      previousStage = stageIndex;
    }

    for (const command of COMMANDS) {
      assert.ok(content.includes(command), `${platform} template is missing command ${command}`);
    }
  }
});

test('all adapter and Claude command sources are regular readable files with required platform policy', () => {
  const requiredPolicy = [
    [/Ponytail/i, 'Ponytail simplicity policy'],
    [/untrusted data/i, 'untrusted-data boundary'],
    [/approval/i, 'approval policy'],
    [/test/i, 'testing policy'],
    [/security/i, 'security policy'],
  ];

  for (const [platform, adapter] of Object.entries(PLATFORM_ADAPTERS)) {
    const sourceStat = lstatSync(adapter.templatePath);
    assert.ok(sourceStat.isFile(), `${platform} template source must be a regular file`);
    assert.equal(sourceStat.isSymbolicLink(), false, `${platform} template source must not be a symbolic link`);
    assert.doesNotThrow(
      () => accessSync(adapter.templatePath, constants.R_OK),
      `${platform} template source must be readable`,
    );

    const content = readFileSync(adapter.templatePath, 'utf8');
    for (const [pattern, policy] of requiredPolicy) {
      assert.match(content, pattern, `${platform} template is missing its ${policy}`);
    }
  }

  const cursor = readFileSync(PLATFORM_ADAPTERS.cursor.templatePath, 'utf8');
  const cursorFrontmatter = cursor.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(cursorFrontmatter, 'Cursor rules must begin with valid YAML frontmatter');
  assert.match(cursorFrontmatter[1], /^description:\s*\S.+$/m, 'Cursor frontmatter needs a description');
  assert.match(cursorFrontmatter[1], /^alwaysApply:\s*true\s*$/m, 'Cursor rules must always apply');

  for (const command of COMMANDS) {
    const commandSource = join(PLATFORM_ADAPTERS.claude.skillSource, `${command.slice(1)}.md`);
    const sourceStat = lstatSync(commandSource);
    assert.ok(sourceStat.isFile(), `Claude command source must be a regular file: ${command}`);
    assert.equal(sourceStat.isSymbolicLink(), false, `Claude command source must not be a symbolic link: ${command}`);
    assert.doesNotThrow(
      () => accessSync(commandSource, constants.R_OK),
      `Claude command source must be readable: ${command}`,
    );
  }
});

test('installPlatformAdapters generates selected adapters in a temporary project', (t) => {
  const project = makeTempProject(t);
  const selected = Object.keys(EXPECTED_TARGETS);

  installPlatformAdapters({ targetDir: project, platforms: selected });

  for (const platform of selected) {
    const generated = targetPath(project, platform);
    assert.ok(existsSync(generated), `${platform} target was not generated`);
    assert.equal(
      readFileSync(generated, 'utf8'),
      readFileSync(PLATFORM_ADAPTERS[platform].templatePath, 'utf8'),
      `${platform} target differs from its canonical template`,
    );
  }

  for (const command of COMMANDS) {
    const skillName = command.slice(1);
    const skillFile = join(project, PLATFORM_ADAPTERS.claude.skillTarget, skillName, 'SKILL.md');
    const canonicalCommand = join(REPOSITORY_ROOT, 'commands', `${skillName}.md`);
    assert.ok(existsSync(skillFile), `Claude native skill was not generated for ${command}`);
    assert.equal(
      readFileSync(skillFile, 'utf8'),
      readFileSync(canonicalCommand, 'utf8'),
      `Claude skill differs from canonical root command ${command}`,
    );
  }
});

test('dry run reports intent without creating files or directories', (t) => {
  const project = makeTempProject(t);

  installPlatformAdapters({
    targetDir: project,
    platforms: Object.keys(EXPECTED_TARGETS),
    dryRun: true,
  });

  for (const platform of Object.keys(EXPECTED_TARGETS)) {
    assert.equal(existsSync(targetPath(project, platform)), false, `${platform} was written during dry run`);
  }
  assert.equal(existsSync(join(project, '.cursor')), false, 'dry run created a parent directory');
  assert.equal(existsSync(join(project, '.github')), false, 'dry run created a parent directory');
  assert.equal(existsSync(join(project, '.claude')), false, 'dry run created Claude skills directories');
  assert.equal(existsSync(join(project, '.clinerules')), false, 'dry run created a Cline rules directory');
  assert.equal(existsSync(join(project, '.windsurf')), false, 'dry run created a Windsurf rules directory');
});

test('existing target files are preserved by default and replaced only with force', (t) => {
  const project = makeTempProject(t);
  const existing = targetPath(project, 'cursor');
  mkdirSync(dirname(existing), { recursive: true });
  writeFileSync(existing, 'user-owned cursor rules\n', 'utf8');

  installPlatformAdapters({ targetDir: project, platforms: ['cursor'] });
  assert.equal(readFileSync(existing, 'utf8'), 'user-owned cursor rules\n');

  installPlatformAdapters({ targetDir: project, platforms: ['cursor'], force: true });
  assert.equal(readFileSync(existing, 'utf8'), readFileSync(PLATFORM_ADAPTERS.cursor.templatePath, 'utf8'));
});

test('force rejects adapter destinations that escape through a file symlink', (t) => {
  const project = makeTempProject(t);
  const external = makeTempProject(t);
  const sentinel = join(external, 'sentinel.md');
  const destination = targetPath(project, 'cursor');
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(sentinel, 'external sentinel\n', 'utf8');
  if (!createSymlinkOrSkip(t, sentinel, destination, 'file')) return;

  assert.throws(
    () => installPlatformAdapters({ targetDir: project, platforms: ['cursor'], force: true }),
    /symbolic link|symlink|outside|escape|contain/i,
  );
  assert.equal(readFileSync(sentinel, 'utf8'), 'external sentinel\n');
});

test('force rejects adapter destinations that escape through a symlinked parent', (t) => {
  const project = makeTempProject(t);
  const external = makeTempProject(t);
  const linkedParent = join(project, '.windsurf');
  const sentinel = join(external, 'sentinel.md');
  writeFileSync(sentinel, 'external sentinel\n', 'utf8');
  if (!createSymlinkOrSkip(t, external, linkedParent, process.platform === 'win32' ? 'junction' : 'dir')) return;

  assert.throws(
    () => installPlatformAdapters({ targetDir: project, platforms: ['windsurf'], force: true }),
    /symbolic link|symlink|outside|escape|contain/i,
  );
  assert.equal(readFileSync(sentinel, 'utf8'), 'external sentinel\n');
  assert.equal(existsSync(join(external, 'rules', 'dkf.md')), false, 'installer wrote through a linked parent');
});

test('force replaces a hard-linked adapter destination without modifying the external inode', (t) => {
  const project = makeTempProject(t);
  const external = makeTempProject(t);
  const sentinel = join(external, 'sentinel.md');
  const destination = targetPath(project, 'cursor');
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(sentinel, 'external sentinel\n', 'utf8');

  try {
    linkSync(sentinel, destination);
  } catch (error) {
    if (['EACCES', 'EPERM', 'ENOSYS', 'ENOTSUP', 'EXDEV', 'UNKNOWN'].includes(error?.code)) {
      t.skip(`hard links are unavailable in this environment: ${error.code}`);
      return;
    }
    throw error;
  }

  const linkedSentinel = statSync(sentinel);
  const linkedDestination = statSync(destination);
  assert.equal(linkedDestination.dev, linkedSentinel.dev, 'test setup did not create a shared hard-link inode');
  assert.equal(linkedDestination.ino, linkedSentinel.ino, 'test setup did not create a shared hard-link inode');
  assert.ok(linkedSentinel.nlink >= 2, 'test setup did not increase the external inode link count');

  installPlatformAdapters({ targetDir: project, platforms: ['cursor'], force: true });

  assert.equal(readFileSync(sentinel, 'utf8'), 'external sentinel\n');
  assert.equal(readFileSync(destination, 'utf8'), readFileSync(PLATFORM_ADAPTERS.cursor.templatePath, 'utf8'));

  const replacedSentinel = statSync(sentinel);
  const replacedDestination = statSync(destination);
  assert.ok(
    replacedDestination.dev !== replacedSentinel.dev || replacedDestination.ino !== replacedSentinel.ino,
    'force updated the shared hard-link inode in place instead of replacing the destination entry',
  );
  assert.equal(replacedSentinel.nlink, linkedSentinel.nlink - 1, 'replacement did not detach the destination hard link');
});

test('full install preflights every destination before performing any writes', (t) => {
  const project = makeTempProject(t);
  writeFileSync(join(project, '.windsurf'), 'not a directory\n', 'utf8');

  assert.throws(
    () => installPlatformAdapters({
      targetDir: project,
      platforms: Object.keys(EXPECTED_TARGETS),
      force: true,
    }),
    /directory|destination|parent|ENOTDIR|EEXIST/i,
  );

  assert.equal(existsSync(join(project, 'CLAUDE.md')), false, 'CLAUDE.md was written before preflight completed');
  assert.equal(existsSync(join(project, '.claude')), false, 'Claude skills were written before preflight completed');
  assert.equal(existsSync(join(project, '.cursor')), false, 'Cursor adapter was written before preflight completed');
  assert.equal(existsSync(join(project, '.github')), false, 'VS Code adapter was written before preflight completed');
  assert.equal(existsSync(join(project, '.clinerules')), false, 'Cline adapter was written before preflight completed');
  assert.equal(readFileSync(join(project, '.windsurf'), 'utf8'), 'not a directory\n');
});

test('adapter path metadata cannot be manipulated to escape targetDir', () => {
  assert.ok(Object.isFrozen(PLATFORM_ADAPTERS), 'adapter registry must be immutable');
  for (const [platform, adapter] of Object.entries(PLATFORM_ADAPTERS)) {
    assert.ok(Object.isFrozen(adapter), `${platform} adapter metadata must be immutable`);
    assert.throws(
      () => { adapter.targetPath = join('..', `${platform}-escape.md`); },
      TypeError,
      `${platform} target path was mutable`,
    );
    assert.equal(adapter.targetPath, EXPECTED_TARGETS[platform]);
  }
});

test('platform flags map individually and --all-platforms selects every adapter', () => {
  assert.deepEqual(resolvePlatformSelection(['--claude']), ['claude']);
  assert.deepEqual(resolvePlatformSelection(['--cursor']), ['cursor']);
  assert.deepEqual(resolvePlatformSelection(['--vscode']), ['vscode']);
  assert.deepEqual(resolvePlatformSelection(['--cline']), ['cline']);
  assert.deepEqual(resolvePlatformSelection(['--windsurf']), ['windsurf']);
  assert.deepEqual(
    [...resolvePlatformSelection(['--all-platforms'])].sort(),
    Object.keys(EXPECTED_TARGETS).sort(),
  );
});
