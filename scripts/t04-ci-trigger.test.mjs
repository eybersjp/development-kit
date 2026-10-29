import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const workflow = fs.readFileSync(fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url)), 'utf8');

test('T04 acceptance is restricted to pull requests and depends on both platform validations', () => {
  assert.match(workflow, /t04_acceptance:\s*\n/);
  assert.match(workflow, /needs:\s*validate/);
  assert.match(workflow, /github\.event_name\s*==\s*'pull_request'/);
});

test('T04 acceptance can execute for the stacked PR #70 even when its base is not main', () => {
  // Regression: the current workflow only triggers pull_request events targeting main.
  // The T04 hardening branch is stacked, so the acceptance job cannot be reached
  // on its own PR, regardless of its job-level head_ref predicate.
  assert.match(workflow, /^  pull_request:\s*$/m);
  assert.doesNotMatch(workflow, /^  pull_request:\s*\n\s*branches:/m);
});

test('Acceptance still invokes the independent risk-3 evidence gate', () => {
  assert.match(workflow, /node scripts\/t04-hardening-acceptance-gate\.mjs/);
  assert.match(workflow, /name:\s*t04-hardening-acceptance/);
});
