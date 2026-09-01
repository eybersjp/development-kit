import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8'));
}

test('package, plugin manifest, and Autopilot framework version stay aligned', () => {
  const pkg = readJson('package.json');
  const plugin = readJson('.agents/plugins/development-kit/plugin.json');
  const transitionModel = readFileSync(join(ROOT, 'runtime', 'autopilot', 'transition-model.mjs'), 'utf8');
  const match = transitionModel.match(/frameworkVersion:\s*'([^']+)'/);

  assert.ok(match, 'Autopilot transition model must declare frameworkVersion');
  assert.equal(plugin.version, pkg.version, 'plugin manifest version must match package.json');
  assert.equal(match[1], pkg.version, 'Autopilot frameworkVersion must match package.json');
});
