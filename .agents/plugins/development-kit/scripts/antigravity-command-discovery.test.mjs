import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COMMANDS_DIR = join(ROOT, 'commands');
const SKILLS_DIR = join(ROOT, 'skills');
const INSTALLER = join(ROOT, 'scripts', 'install-antigravity.mjs');

function publicCommands() {
  return readdirSync(COMMANDS_DIR)
    .filter((name) => /^dk-[a-z0-9-]+\.md$/.test(name))
    .map((name) => name.replace(/\.md$/, ''))
    .sort();
}

function publicWorkflowSkills() {
  return readdirSync(SKILLS_DIR)
    .filter((name) => name.startsWith('dk-'))
    .filter((name) => statSync(join(SKILLS_DIR, name)).isDirectory())
    .filter((name) => existsSync(join(SKILLS_DIR, name, 'SKILL.md')))
    .sort();
}

test('every public DK command has a native Antigravity skill adapter', () => {
  const commands = publicCommands();
  assert.equal(commands.length, 16, 'Development Kit must expose exactly 16 public DK workflows');

  for (const command of commands) {
    const skillPath = join(SKILLS_DIR, command, 'SKILL.md');
    assert.ok(existsSync(skillPath), `Missing Antigravity adapter: skills/${command}/SKILL.md`);

    const content = readFileSync(skillPath, 'utf8');
    assert.match(content, new RegExp(`^name: ${command}$`, 'm'), `${command} adapter name must match its slash command`);
    assert.match(content, /^description:\s+\S.+$/m, `${command} adapter must have a discoverable description`);
    assert.ok(
      content.includes(`../../commands/${command}.md`),
      `${command} adapter must route to its authoritative command document`,
    );
    assert.ok(
      content.includes('single authoritative workflow specification') || content.includes('authoritative workflow specification'),
      `${command} adapter must preserve commands/*.md as workflow authority`,
    );
  }
});

test('Antigravity public workflow skills exactly mirror DK command definitions', () => {
  assert.deepEqual(publicWorkflowSkills(), publicCommands());
});

test('project upgrade preserves existing AGENTS.md while installing all DK slash workflow skills', (t) => {
  const target = mkdtempSync(join(tmpdir(), 'dk-antigravity-upgrade-'));
  t.after(() => rmSync(target, { recursive: true, force: true }));

  const agentsDir = join(target, '.agents');
  mkdirSync(agentsDir, { recursive: true });
  const existingAgents = '# Existing project instructions\n\nKeep this file unchanged.\n';
  writeFileSync(join(agentsDir, 'AGENTS.md'), existingAgents, 'utf8');

  const result = spawnSync(process.execPath, [INSTALLER, '--project'], {
    cwd: target,
    encoding: 'utf8',
  });

  assert.equal(
    result.status,
    0,
    `Project installer failed: ${result.stderr || result.stdout}`,
  );
  assert.equal(
    readFileSync(join(agentsDir, 'AGENTS.md'), 'utf8'),
    existingAgents,
    'Existing project AGENTS.md must remain preserved during a normal upgrade',
  );

  const installedPlugin = join(agentsDir, 'plugins', 'development-kit');
  for (const command of publicCommands()) {
    assert.ok(
      existsSync(join(installedPlugin, 'skills', command, 'SKILL.md')),
      `Installed Antigravity plugin must expose ${command} as a native skill`,
    );
    assert.ok(
      existsSync(join(installedPlugin, 'commands', `${command}.md`)),
      `Installed plugin must include authoritative commands/${command}.md`,
    );
  }
});
