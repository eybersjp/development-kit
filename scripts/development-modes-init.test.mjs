import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { bootstrapProject, getProjectBootstrapStatus } from '../runtime/bootstrap/project-bootstrap.mjs';
import {
  changeDevelopmentMode, getDevelopmentModePath,
  initializeDevelopmentMode, inspectDevelopmentMode, readDevelopmentMode,
} from '../runtime/development-modes/config-store.mjs';
import { getDefaultModeConfiguration } from '../runtime/development-modes/policy-contract.mjs';
import { recommendDevelopmentMode } from '../runtime/development-modes/recommendation.mjs';

const script = fileURLToPath(new URL('./bootstrap.mjs', import.meta.url));
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'dk-development-mode-init-')); }
function clean(fn) {
  return async () => {
    const dir = temp();
    try { await fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
}
function cli(dir, ...args) {
  const p = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8', timeout: 20000 });
  assert.equal(p.error, undefined, p.error?.message);
  return { ...p, json: JSON.parse(p.stdout) };
}
const choice = (mode, extra = {}) => ({ schemaVersion: 1, mode, ...extra });

test('INIT-001 fresh bootstrap persists default Balanced with one recorded revision', clean(async dir => {
  const result = await bootstrapProject(dir);
  assert.equal(result.success, true);
  const data = readDevelopmentMode(dir);
  assert.deepEqual(data.selection, getDefaultModeConfiguration());
  assert.equal(data.revision, 1);
  assert.equal(data.history[0].source, 'default');
  assert.equal(result.developmentMode.resolved.mode, 'balanced');
  assert.equal(getProjectBootstrapStatus(dir).modeConfigurationStatus, 'configured');
  assert.ok(fs.statSync(getDevelopmentModePath(dir)).isFile());
}));

test('INIT-002 legacy project receives recorded migration without altering existing metadata', clean(async dir => {
  const dk = path.join(dir, '.development-kit');
  fs.mkdirSync(dk, { recursive: true });
  const project = '{"projectId":"proj_legacy","frameworkVersion":"0.4.0"}';
  fs.writeFileSync(path.join(dk, 'project.json'), project);
  fs.writeFileSync(path.join(dk, 'workspace-id'), 'ws_legacy');
  const prior = fs.readFileSync(path.join(dk, 'project.json'), 'utf8');
  const result = await bootstrapProject(dir);
  assert.equal(result.success, true);
  assert.equal(readDevelopmentMode(dir).history[0].source, 'legacy-migration');
  assert.equal(fs.readFileSync(path.join(dk, 'project.json'), 'utf8'), prior);
  assert.equal(fs.readFileSync(path.join(dk, 'workspace-id'), 'utf8'), 'ws_legacy');
}));

test('INIT-003 repeated bootstrap is byte-idempotent and does not reset an explicit mode', clean(async dir => {
  const initial = await bootstrapProject(dir, { modeConfig: choice('spec-driven') });
  assert.equal(initial.success, true);
  const before = fs.readFileSync(getDevelopmentModePath(dir), 'utf8');
  const repeated = await bootstrapProject(dir);
  assert.equal(repeated.success, true);
  assert.equal(repeated.developmentMode.changed, false);
  assert.equal(fs.readFileSync(getDevelopmentModePath(dir), 'utf8'), before);
  const attempted = await bootstrapProject(dir, { modeConfig: choice('rapid') });
  assert.equal(attempted.success, false);
  assert.equal(fs.readFileSync(getDevelopmentModePath(dir), 'utf8'), before);
}));

test('INIT-004 malformed configuration fails closed and does not self-repair', clean(async dir => {
  await bootstrapProject(dir);
  const file = getDevelopmentModePath(dir);
  fs.writeFileSync(file, '{ bad json');
  assert.equal(getProjectBootstrapStatus(dir).modeConfigurationStatus, 'invalid');
  assert.throws(() => inspectDevelopmentMode(dir), /Unable to read/);
  assert.equal((await bootstrapProject(dir)).success, false);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ bad json');
}));

test('INIT-004 rejects truncated history, inconsistent selection and noncontiguous revision', clean(async dir => {
  await bootstrapProject(dir);
  const file = getDevelopmentModePath(dir);
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const mutation of [
    { ...original, history: [] },
    { ...original, revision: 2 },
    { ...original, selection: choice('rapid') },
    { ...original, history: [{ ...original.history[0], revision: 7 }] },
    { ...original, history: [{ ...original.history[0], reason: '' }] },
  ]) {
    fs.writeFileSync(file, JSON.stringify(mutation));
    assert.throws(() => inspectDevelopmentMode(dir));
    assert.equal(getProjectBootstrapStatus(dir).modeConfigurationStatus, 'invalid');
  }
}));

test('INIT-005 explicit changes append revision, preserve historical evidence and reject stale writers', clean(async dir => {
  await bootstrapProject(dir);
  const previous = readDevelopmentMode(dir).history[0];
  const updated = changeDevelopmentMode(dir, choice('maintenance-evolution', { baseMethodology: 'spec-driven' }), {
    expectedRevision: 1, reason: 'Existing project adopted specification workflow', actor: 'project-owner',
  });
  assert.equal(updated.changed, true);
  assert.equal(updated.revision, 2);
  const record = readDevelopmentMode(dir);
  assert.deepEqual(record.history[0], previous);
  assert.equal(record.history[1].actor, 'project-owner');
  assert.equal(record.history[1].source, 'mode-change');
  assert.equal(record.selection.baseMethodology, 'spec-driven');
  const before = fs.readFileSync(getDevelopmentModePath(dir), 'utf8');
  assert.throws(() => changeDevelopmentMode(dir, choice('rapid'), {
    expectedRevision: 1, reason: 'Stale change',
  }), error => error.code === 'DK_MODE_REVISION_CONFLICT');
  assert.equal(fs.readFileSync(getDevelopmentModePath(dir), 'utf8'), before);
}));

test('INIT-005 same selected mode leaves revision and bytes unchanged', clean(async dir => {
  await bootstrapProject(dir);
  const file = getDevelopmentModePath(dir);
  const before = fs.readFileSync(file, 'utf8');
  assert.equal(changeDevelopmentMode(dir, choice('balanced'), {
    expectedRevision: 1, reason: 'Confirm selection',
  }).changed, false);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
}));

test('INIT-006 invalid selection or missing reason never modifies valid persisted state', clean(async dir => {
  await bootstrapProject(dir);
  const file = getDevelopmentModePath(dir);
  const before = fs.readFileSync(file, 'utf8');
  for (const input of [
    choice('unknown'),
    choice('rapid', { projectOverrides: { testingDepth: 'none' } }),
    choice('rapid', { mandatoryControls: [] }),
  ]) {
    assert.throws(() => changeDevelopmentMode(dir, input, { expectedRevision: 1, reason: 'Attempt' }));
  }
  assert.throws(() => changeDevelopmentMode(dir, choice('rapid'), { expectedRevision: 1, reason: ' ' }));
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const unbootstrapped = temp();
  try {
    const res = await bootstrapProject(unbootstrapped, { modeConfig: choice('unknown') });
    assert.equal(res.success, false);
    assert.equal(fs.existsSync(path.join(unbootstrapped, '.development-kit')), false);
  } finally { fs.rmSync(unbootstrapped, { recursive: true, force: true }); }
}));

test('INIT-007 deterministic recommendations are non-binding and existing-project aware', clean(async dir => {
  const inputs = { projectType: 'existing', delivery: 'production', requirements: 'clear',
    documentation: 'standard', governance: 'strict' };
  const first = recommendDevelopmentMode(inputs);
  assert.deepEqual(first, recommendDevelopmentMode(inputs));
  assert.equal(first.recommendedConfig.mode, 'maintenance-evolution');
  assert.equal(first.recommendedConfig.baseMethodology, 'spec-driven');
  assert.equal(first.advisoryOnly, true);
  assert.equal(recommendDevelopmentMode({ delivery: 'prototype', documentation: 'lean' }).recommendedConfig.mode, 'rapid');
  assert.equal(recommendDevelopmentMode({ documentation: 'comprehensive' }).recommendedConfig.mode, 'doc-driven');
  assert.equal(recommendDevelopmentMode().recommendedConfig.mode, 'balanced');
  assert.throws(() => recommendDevelopmentMode({ governance: 'disable-checks' }), /Invalid/);
  assert.equal(fs.existsSync(path.join(dir, '.development-kit')), false);
}));

test('INIT-008 CLI status, recommendation, explicit mode and history work headlessly', clean(async dir => {
  const recommended = cli(dir, '--recommend', '--project-type=existing', '--documentation=comprehensive');
  assert.equal(recommended.status, 0);
  assert.equal(recommended.json.recommendation.recommendedConfig.baseMethodology, 'doc-driven');
  assert.equal(fs.existsSync(path.join(dir, '.development-kit')), false);
  const init = cli(dir, '--init', '--mode=rapid', '--no-interactive');
  assert.equal(init.status, 0, init.stdout + init.stderr);
  assert.equal(init.json.developmentMode.selection.mode, 'rapid');
  assert.equal(cli(dir, '--mode-status').json.developmentMode.revision, 1);
  const changed = cli(dir, '--set-mode', '--mode=doc-driven', '--expected-revision=1', '--reason=Approved-methodology-change');
  assert.equal(changed.status, 0, changed.stdout + changed.stderr);
  assert.equal(changed.json.developmentMode.revision, 2);
  assert.equal(cli(dir, '--history').json.history.length, 2);
  assert.equal(cli(dir, '--status').json.status.modeRevision, 2);
}));

test('INIT-006 CLI supports project-local JSON file and blocks path escape', clean(async dir => {
  const configPath = path.join(dir, 'mode.json');
  fs.writeFileSync(configPath, JSON.stringify(choice('maintenance-evolution', {
    baseMethodology: 'doc-driven', customPolicies: { contextPacking: 'lean' },
  })));
  const good = cli(dir, '--init', '--config-file=mode.json');
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.equal(good.json.developmentMode.selection.mode, 'maintenance-evolution');
  const external = temp();
  try {
    fs.writeFileSync(path.join(external, 'outside.json'), JSON.stringify(choice('rapid')));
    const escape = cli(dir, '--set-mode', `--config-file=${path.join(external, 'outside.json')}`,
      '--expected-revision=1', '--reason=Attempt');
    assert.equal(escape.status, 1);
    assert.match(escape.json.error, /inside the project directory/);
    assert.equal(readDevelopmentMode(dir).revision, 1);
  } finally { fs.rmSync(external, { recursive: true, force: true }); }
}));

test('INIT-009 writer lock prevents concurrent change and preserves state', clean(async dir => {
  await bootstrapProject(dir);
  const lock = path.join(dir, '.development-kit', 'development-mode.lock');
  fs.writeFileSync(lock, 'occupied');
  const prior = fs.readFileSync(getDevelopmentModePath(dir), 'utf8');
  assert.throws(() => changeDevelopmentMode(dir, choice('rapid'), {
    expectedRevision: 1, reason: 'Try while locked',
  }), error => error.code === 'DK_MODE_STORE_LOCKED');
  assert.equal(fs.readFileSync(getDevelopmentModePath(dir), 'utf8'), prior);
  fs.unlinkSync(lock);
}));

test('INIT-010 existing project identity and prior runtime state are unaffected by mode change', clean(async dir => {
  await bootstrapProject(dir);
  const projectPath = path.join(dir, '.development-kit', 'project.json');
  const before = fs.readFileSync(projectPath, 'utf8');
  changeDevelopmentMode(dir, choice('rapid'), { expectedRevision: 1, reason: 'Selected lean workflow' });
  assert.equal(fs.readFileSync(projectPath, 'utf8'), before);
  assert.equal(getProjectBootstrapStatus(dir).initialized, true);
}));

test('INIT-011 headless default does not request interactive input', clean(async dir => {
  const result = cli(dir, '--init');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.developmentMode.selection.mode, 'balanced');
  assert.equal(result.json.developmentMode.history[0].source, 'default');
  const nonInteractive = cli(dir, '--interactive');
  assert.equal(nonInteractive.status, 0, nonInteractive.stdout + nonInteractive.stderr);
  assert.equal(nonInteractive.json.developmentMode.selection.mode, 'balanced');
}));

test('INIT-011 explicit --interactive fails without TTY only on unconfigured project', clean(async dir => {
  const result = cli(dir, '--init', '--interactive');
  assert.equal(result.status, 1);
  assert.match(result.json.error, /requires a terminal/);
  assert.equal(fs.existsSync(path.join(dir, '.development-kit')), false);
}));

test('INIT-010 canonical and installed Antigravity command mirror share the mode initialization instruction', () => {
  const canonical = fs.readFileSync(new URL('../commands/dk-autopilot.md', import.meta.url), 'utf8');
  const mirror = fs.readFileSync(new URL('../.agents/plugins/development-kit/commands/dk-autopilot.md', import.meta.url), 'utf8');
  assert.equal(mirror, canonical);
  assert.match(canonical, /modeConfigurationStatus/);
  assert.match(canonical, /--set-mode/);
});

test('INIT-004 CLI rejects a corrupt persisted mode without rewriting it', clean(async dir => {
  await bootstrapProject(dir);
  const file = getDevelopmentModePath(dir);
  fs.writeFileSync(file, '{"formatVersion":1,"revision":1,"history":[]}');
  const before = fs.readFileSync(file, 'utf8');
  const status = cli(dir, '--status');
  assert.equal(status.status, 1);
  assert.equal(status.json.status.modeConfigurationStatus, 'invalid');
  const initialized = cli(dir, '--init', '--no-interactive');
  assert.equal(initialized.status, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
}));

test('INIT-009 refuses an existing non-file mode path', clean(async dir => {
  await bootstrapProject(dir);
  const file = getDevelopmentModePath(dir);
  fs.rmSync(file);
  fs.mkdirSync(file);
  assert.throws(() => readDevelopmentMode(dir), /regular file/);
}));
