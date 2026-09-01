import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve(process.cwd(), 'opencode.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

test('OpenCode project configuration uses the current supported schema', () => {
  assert.equal(typeof config, 'object');
  assert.notEqual(config, null);
  assert.equal(Array.isArray(config), false);
  assert.equal(config.$schema, 'https://opencode.ai/config.json');
  assert.equal(Object.prototype.hasOwnProperty.call(config, 'rules'), false);
});

test('OpenCode instructions, when present, are string paths or URLs', () => {
  if (config.instructions === undefined) return;
  assert.equal(Array.isArray(config.instructions), true);
  assert.equal(config.instructions.every((value) => typeof value === 'string'), true);
});
