import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COMMANDS_DIR = join(ROOT, 'commands');
const SKILLS_DIR = join(ROOT, 'skills');

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
