import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test('v0.6 release line exposes research validation', () => {
  const pkg = readJson('package.json');
  assert.match(pkg.version, /^0\.[56]\.\d+$/);
  assert.equal(pkg.scripts['research:validate'], 'node --test scripts/research-contract.test.mjs');
  assert.match(pkg.scripts['release:validate'], /research:validate/);
});

test('/dk-research command and provider-neutral skill exist', () => {
  const command = read('commands/dk-research.md');
  const skill = read('skills/external-research/SKILL.md');
  assert.match(command, /name:\s*dk-research/);
  assert.match(command, /untrusted/i);
  assert.match(skill, /name:\s*external-research/);
  assert.match(skill, /provider/i);
  assert.match(skill, /provenance/i);
  assert.match(skill, /untrusted/i);
});

test('Agent-Reach remains optional and approval-gated', () => {
  const skill = read('skills/agent-reach-integration/SKILL.md');
  assert.match(skill, /optional/i);
  assert.match(skill, /(must not silently install|never auto-install)/i);
  assert.match(skill, /approval/i);
  assert.match(skill, /main\.zip/i);
  assert.match(skill, /cookie/i);
  assert.match(skill, /(pinned tagged release|pinned releases|immutable commit)/i);
  assert.match(skill, /authenticated read/i);
  assert.match(skill, /untrusted data/i);
});

test('global rules and conductor expose research trust boundary', () => {
  const agents = read('AGENTS.md');
  const conductor = read('agents/development-conductor.md');
  const autopilot = read('commands/dk-autopilot.md');
  for (const content of [agents, conductor, autopilot]) {
    assert.match(content, /\/dk-research/);
    assert.match(content, /untrusted/i);
    assert.match(content, /approval/i);
  }
});

test('Antigravity plugin registers both research skills', () => {
  const plugin = readJson('.agents/plugins/development-kit/plugin.json');
  assert.ok(plugin.skills.includes('../../../skills/external-research'));
  assert.ok(plugin.skills.includes('../../../skills/agent-reach-integration'));
});

test('documentation navigation registers new research references', () => {
  const summary = read('docs/SUMMARY.md');
  assert.match(summary, /dk-research/);
  assert.match(summary, /external-research/);
  assert.match(summary, /agent-reach-integration/);
  assert.match(summary, /external-capability-providers/);
});
