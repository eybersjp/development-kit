import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');

test('T04-A13 v0.13 integration has a distinct source-bound risk-3 acceptance job', () => {
  assert.match(workflow, /^  t04_acceptance:\s*$/m,
    'v0.13 T04 must not rely on green platform tests as its acceptance verdict');
  const job = workflow.split(/^  t04_acceptance:\s*$/m)[1]?.split(/^  [a-z][\w-]*:\s*$/m)[0] ?? '';
  assert.match(job, /^    needs:\s*validate\s*$/m,
    'independent acceptance must depend on successful Ubuntu AND Windows matrix validation');
  assert.match(job, /github\.head_ref\s*==\s*'feature\/v0\.13-state-engine-v2'/,
    'historical/diagnostic PRs must never receive production T04 acceptance');
  assert.match(job, /scripts\/v013-t04-acceptance-gate\.mjs/,
    'the acceptance job must run a deterministic risk-3 gate, not a placeholder echo');
  assert.match(job, /GITHUB_TOKEN:/,
    'independent reviews and CI provenance must be checked with authenticated GitHub evidence');
});

test('T04-A14 acceptance gate source exists and requires independent immutable evidence', () => {
  const gatePath = path.join(root, 'scripts/v013-t04-acceptance-gate.mjs');
  assert.ok(fs.existsSync(gatePath), 'missing deterministic v0.13 T04 acceptance gate');
  const source = fs.readFileSync(gatePath, 'utf8');
  for (const required of ['decideAcceptance', 'reviewedCommit', 'architecture-reviewer',
    'code-reviewer', 'security-reviewer', 'GITHUB_RUN_ID', 'GITHUB_TOKEN',
    'CLEANUP_SAFE', 'windows']) {
    assert.ok(source.includes(required), 'acceptance gate lacks required evidence check: ' + required);
  }
});

test('T04-A15 risk-3 gate parses, fails closed outside authenticated CI and never uses historical PR #70', () => {
  const gate = path.join(root, 'scripts/v013-t04-acceptance-gate.mjs');
  const syntax = spawnSync(process.execPath, ['--check', gate], { cwd: root, encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const isolated = spawnSync(process.execPath, [gate], {
    cwd: root, encoding: 'utf8', env: {
      ...process.env, GITHUB_ACTIONS: 'false', GITHUB_TOKEN: '',
      GITHUB_REPOSITORY: 'eybersjp/development-kit',
    },
  });
  assert.notEqual(isolated.status, 0, 'Unauthenticated local invocation must never produce ACCEPTED');
  assert.doesNotMatch(isolated.stdout, /DKF130-T04 ACCEPTED/);
  const code = fs.readFileSync(gate, 'utf8');
  assert.match(code, /decideAcceptance\(\{/);
  assert.match(code, /assert\.equal\(decision\.state, 'ACCEPTED'/);
  assert.match(code, /physical\.artifactUrl/);
  assert.match(code, /validationRunIds/);
  assert.match(code, /review\.commit_id, reviewedCommit/);
  assert.match(code, /review\.state, 'APPROVED'/);
  assert.match(code, /securityControls/);
});

test('T04-A16 acceptance workflow reads exact PR head with least privilege', () => {
  const job = workflow.split(/^  t04_acceptance:\s*$/m)[1]?.split(/^  [a-z][\w-]*:\s*$/m)[0] ?? '';
  assert.match(job, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(job, /persist-credentials: false/);
  assert.match(job, /contents: read/);
  assert.match(job, /pull-requests: read/);
  assert.match(job, /issues: read/);
  assert.match(job, /actions: read/);
  assert.doesNotMatch(job, /contents: write|pull-requests: write|issues: write|actions: write/);
});

test('T04-A17 both platform validations execute the immutable PR head, never a synthetic merge', () => {
  const validate = workflow.split(/^  validate:\\s*$/m)[1]?.split(/^  [a-z][\\w-]*:\\s*$/m)[0] ?? '';
  const checkout = validate.split(/      - name: Check out repository\\s*\\n/)[1]?.split(/      - name: /)[0] ?? '';
  assert.match(checkout, /uses: actions\\/checkout@v7/);
  assert.match(checkout, /ref: \\$\\{\\{ github\\.event\\.pull_request\\.head\\.sha \\|\\| github\\.sha \\}\\}/,
    'Both Ubuntu and Windows must validate the exact reviewed head, not refs/pull/N/merge');
  assert.match(checkout, /persist-credentials: false/,
    'Validation must not retain checkout credentials from untrusted PR source');
});
