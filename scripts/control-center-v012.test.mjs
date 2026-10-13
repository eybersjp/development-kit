import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RuntimeApiService } from '../runtime/api/runtime-api-service.mjs';
import { ensureStateEngineLayout, getStateEnginePaths } from '../runtime/orchestration/state-engine-v2.mjs';

function tempService(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-t10-api-'));
  const service = new RuntimeApiService({ rootDir });
  t.after(async () => {
    await service.stop();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });
  return { rootDir, service };
}

test('AC-030: new project reports unavailable canonical state rather than fabricated healthy status', async t => {
  const { service } = tempService(t);
  const info = await service.start();
  const response = await fetch(`http://${info.host}:${info.port}/v1/scale-context`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.schemaVersion, '1.0.0');
  assert.equal(data.stateHealth, 'unavailable');
  assert.equal(data.stateEngine.active, false);
  assert.equal(data.authority, 'read-only-projection');
  assert.equal(data.acceptanceAuthority, 'canonical-deterministic-gates');
  for (const [key, value] of Object.entries(data.capabilities)) {
    assert.equal(value.installed, true, `${key} module should be bundled`);
    assert.equal(value.accepted, null, `${key} acceptance must not be invented`);
    assert.equal(value.acceptanceStatus, 'not-independently-established');
  }
});

test('AC-030: initialized State Engine remains unverified without independent integrity evidence', async t => {
  const { rootDir, service } = tempService(t);
  ensureStateEngineLayout(rootDir);
  const paths = getStateEnginePaths(rootDir);
  const prior = fs.readFileSync(paths.events);
  const info = await service.start();
  const response = await fetch(`http://${info.host}:${info.port}/v1/scale-context`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.stateHealth, 'unverified');
  assert.equal(data.stateEngine.active, true);
  assert.deepEqual(fs.readFileSync(paths.events), prior);
});

test('AC-030: interrupted journal is reported recovery-required, never silently repaired by a GET', async t => {
  const { rootDir, service } = tempService(t);
  ensureStateEngineLayout(rootDir);
  const paths = getStateEnginePaths(rootDir);
  const marker = '{"incomplete":true}';
  fs.writeFileSync(paths.pending, marker, 'utf8');
  const info = await service.start();
  const response = await fetch(`http://${info.host}:${info.port}/v1/scale-context`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.stateHealth, 'recovery-required');
  assert.equal(fs.readFileSync(paths.pending, 'utf8'), marker);
});

test('AC-030: corrupt/incomplete canonical layout is reported degraded without mutation', async t => {
  const { rootDir, service } = tempService(t);
  const stateRoot = path.join(rootDir, '.development-kit', 'state');
  fs.mkdirSync(stateRoot, { recursive: true });
  const events = path.join(stateRoot, 'events.jsonl');
  fs.writeFileSync(events, 'invalid ledger', 'utf8');
  const info = await service.start();
  const response = await fetch(`http://${info.host}:${info.port}/v1/scale-context`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.stateHealth, 'degraded');
  assert.equal(fs.readFileSync(events, 'utf8'), 'invalid ledger');
  assert.equal(fs.existsSync(path.join(stateRoot, 'schema.json')), false);
});

test('AC-031: existing public routes remain functional and compatible', async t => {
  const { service } = tempService(t);
  const info = await service.start();
  for (const route of ['/v1/status', '/v1/settings']) {
    const response = await fetch(`http://${info.host}:${info.port}${route}`);
    assert.equal(response.status, 200, route);
  }
});
