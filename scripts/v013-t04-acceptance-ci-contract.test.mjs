import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
