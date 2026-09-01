import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPOSITORY_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INSTALLER = join(REPOSITORY_ROOT, 'scripts', 'install-antigravity.mjs');

const PLATFORM_TARGETS = Object.freeze({
  claude: 'CLAUDE.md',
  cursor: join('.cursor', 'rules', 'dkf.mdc'),
  vscode: join('.github', 'copilot-instructions.md'),
  cline: join('.clinerules', 'dkf.md'),
  windsurf: join('.windsurf', 'rules', 'dkf.md'),
});

function makeTempProject(t) {
  const project = mkdtempSync(join(tmpdir(), 'dk-platform-cli-'));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  return project;
}

function runInstaller(project, args) {
  const result = spawnSync(process.execPath, [INSTALLER, ...args], {
    cwd: project,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: project,
      USERPROFILE: project,
      NO_COLOR: '1',
    },
  });

  if (result.error) {
    throw result.error;
  }
  return {
    ...result,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  };
}

function assertSuccess(result) {
  assert.equal(result.status, 0, result.output);
}

function assertPlatformInstalled(project, platform) {
  assert.ok(
    existsSync(join(project, PLATFORM_TARGETS[platform])),
    `${platform} adapter was not installed`,
  );
}

test('the optional init positional argument is accepted', (t) => {
  const withoutInit = makeTempProject(t);
  const withInit = makeTempProject(t);

  const direct = runInstaller(withoutInit, ['--cursor']);
  const explicit = runInstaller(withInit, ['init', '--cursor']);

  assertSuccess(direct);
  assertSuccess(explicit);
  assertPlatformInstalled(withoutInit, 'cursor');
  assertPlatformInstalled(withInit, 'cursor');
  assert.equal(
    readFileSync(join(withInit, PLATFORM_TARGETS.cursor), 'utf8'),
    readFileSync(join(withoutInit, PLATFORM_TARGETS.cursor), 'utf8'),
  );
});

for (const platform of Object.keys(PLATFORM_TARGETS)) {
  test(`--${platform} installs only the ${platform} platform adapter`, (t) => {
    const project = makeTempProject(t);
    const result = runInstaller(project, [`--${platform}`]);

    assertSuccess(result);
    assertPlatformInstalled(project, platform);
    for (const [otherPlatform, target] of Object.entries(PLATFORM_TARGETS)) {
      if (otherPlatform !== platform) {
        assert.equal(existsSync(join(project, target)), false, `${otherPlatform} was installed implicitly`);
      }
    }
  });
}

test('platform flags compose in one invocation', (t) => {
  const project = makeTempProject(t);
  const result = runInstaller(project, ['--cursor', '--vscode', '--windsurf']);

  assertSuccess(result);
  assertPlatformInstalled(project, 'cursor');
  assertPlatformInstalled(project, 'vscode');
  assertPlatformInstalled(project, 'windsurf');
  assert.equal(existsSync(join(project, PLATFORM_TARGETS.claude)), false);
  assert.equal(existsSync(join(project, PLATFORM_TARGETS.cline)), false);
});

test('--all-platforms installs all five adapters without selecting legacy installation modes', (t) => {
  const project = makeTempProject(t);
  const result = runInstaller(project, ['--all-platforms']);

  assertSuccess(result);
  for (const platform of Object.keys(PLATFORM_TARGETS)) {
    assertPlatformInstalled(project, platform);
  }

  assert.equal(existsSync(join(project, '.opencode')), false, 'OpenCode was installed implicitly');
  assert.equal(existsSync(join(project, '.agents')), false, 'legacy Antigravity files were installed implicitly');
  assert.equal(existsSync(join(project, 'agents')), false, 'legacy --all content was installed implicitly');
  assert.equal(existsSync(join(project, 'skills')), false, 'legacy --all content was installed implicitly');
});

test('--dry-run is valid for platform modes and writes nothing', (t) => {
  const project = makeTempProject(t);
  const result = runInstaller(project, ['init', '--all-platforms', '--dry-run']);

  assertSuccess(result);
  assert.deepEqual(readdirSync(project), []);
  assert.match(result.output, /dry[ -]run|would install/i);
});

test('existing adapter files are preserved unless --force is supplied', (t) => {
  const project = makeTempProject(t);
  const target = join(project, PLATFORM_TARGETS.cursor);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, 'user-owned cursor rules\n', 'utf8');

  const preserved = runInstaller(project, ['--cursor']);
  assertSuccess(preserved);
  assert.equal(readFileSync(target, 'utf8'), 'user-owned cursor rules\n');

  const forced = runInstaller(project, ['--cursor', '--force']);
  assertSuccess(forced);
  assert.notEqual(readFileSync(target, 'utf8'), 'user-owned cursor rules\n');
});

test('unknown flags fail clearly without writing files', (t) => {
  const project = makeTempProject(t);
  const result = runInstaller(project, ['--not-a-platform']);

  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /unknown|unsupported|unrecognized|invalid/i);
  assert.match(result.output, /--not-a-platform/);
  assert.deepEqual(readdirSync(project), []);
});

test('unsupported positional arguments fail clearly without writing files', (t) => {
  const project = makeTempProject(t);
  const result = runInstaller(project, ['install', '--cursor']);

  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /unknown|unsupported|unrecognized|invalid/i);
  assert.match(result.output, /install/);
  assert.deepEqual(readdirSync(project), []);
});

for (const legacyFlag of ['--opencode', '--all', '--global', '--project']) {
  test(`platform adapters cannot be mixed with legacy target ${legacyFlag}`, (t) => {
    const project = makeTempProject(t);
    const result = runInstaller(project, ['--cursor', legacyFlag]);

    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /incompatible|cannot (?:be )?combine|mix|mutually exclusive/i);
    assert.match(result.output, /--cursor/);
    assert.match(result.output, new RegExp(legacyFlag.replaceAll('-', '\\-')));
    assert.deepEqual(readdirSync(project), []);
  });
}

test('legacy --all and --opencode modes remain selectable', (t) => {
  const allProject = makeTempProject(t);
  const opencodeProject = makeTempProject(t);

  const all = runInstaller(allProject, ['--all', '--dry-run']);
  const opencode = runInstaller(opencodeProject, ['--opencode', '--dry-run']);

  assertSuccess(all);
  assertSuccess(opencode);
  assert.match(all.output, /Development Kit|Would install/i);
  assert.match(opencode.output, /OpenCode/i);
  assert.deepEqual(readdirSync(allProject), []);
  assert.deepEqual(readdirSync(opencodeProject), []);
});
