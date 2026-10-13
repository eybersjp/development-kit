import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RuntimeApiService } from '../runtime/api/runtime-api-service.mjs';

async function serve(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-v012-stable-'));
  const service = new RuntimeApiService({ rootDir });
  const info = await service.start();
  t.after(async () => {
    await service.stop();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });
  const get = async route => {
    const response = await fetch(`http://${info.host}:${info.port}${route}`);
    assert.equal(response.status, 200, route);
    return response.json();
  };
  return { rootDir, get };
}

function putPointer(rootDir, pointer, revision = undefined) {
  const dir = path.join(rootDir, '.development-kit', 'autopilot', 'state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'current.json'), JSON.stringify(pointer));
  if (revision) fs.writeFileSync(path.join(dir, pointer.currentRevisionFile), JSON.stringify(revision));
  return dir;
}

test('v0.12: no canonical legacy state reports unavailable, not healthy', async t => {
  const { get } = await serve(t);
  const result = await get('/v1/scale-context');
  assert.equal(result.canonicalStateStore, 'autopilot-versioned-snapshots');
  assert.equal(result.stateHealth, 'unavailable');
  assert.equal(result.state.active, false);
  assert.equal(result.capabilities.stateEngineV2.installed, false);
  assert.equal(result.capabilities.stateEngineV2.acceptanceStatus, 'deferred-to-v0.13.0');
  assert.equal(result.capabilities.lifecycleInstances.installed, true);
  assert.equal(result.capabilities.lifecycleInstances.accepted, null);
  assert.equal(result.authority, 'read-only-projection');
});

test('v0.12: valid legacy state is read-only and not independently asserted healthy', async t => {
  const { get, rootDir } = await serve(t);
  const pointer = { currentRevision: 1, currentRevisionFile: 'revision-000001.json' };
  const revision = {
    schemaVersion: '1.0.0', workflowId: 'w-test', projectId: 'proj-test',
    workflowMode: 'guided', autonomyLevel: 'manual', workflowStatus: 'executing',
    currentStage: 'IMPLEMENT', createdAt: '2026-10-13T00:00:00.000Z',
    updatedAt: '2026-10-13T00:00:00.000Z', frameworkVersion: '0.12.0',
    stateRevision: 1, completedStages: [], skippedStages: [], blockedStages: [],
  };
  const dir = putPointer(rootDir, pointer, revision);
  const before = fs.readFileSync(path.join(dir, 'current.json'));
  const data = await get('/v1/scale-context');
  assert.equal(data.stateHealth, 'unverified');
  assert.deepEqual(data.state, { active: true, currentStage: 'IMPLEMENT', revision: 1 });
  assert.deepEqual(fs.readFileSync(path.join(dir, 'current.json')), before);
});

test('v0.12: missing revision is recovery-required and a GET does not repair pointer', async t => {
  const { get, rootDir } = await serve(t);
  const dir = putPointer(rootDir, { currentRevision: 4, currentRevisionFile: 'revision-000004.json' });
  const before = fs.readFileSync(path.join(dir, 'current.json'));
  assert.equal((await get('/v1/scale-context')).stateHealth, 'recovery-required');
  assert.deepEqual(fs.readFileSync(path.join(dir, 'current.json')), before);
});

test('v0.12: malformed/path-traversal pointer fails closed and stays unmodified', async t => {
  const { get, rootDir } = await serve(t);
  for (const target of ['../escape.json', 'revision-000003.json']) {
    const dir = putPointer(rootDir, { currentRevision: 2, currentRevisionFile: target });
    const before = fs.readFileSync(path.join(dir, 'current.json'));
    assert.equal((await get('/v1/scale-context')).stateHealth, 'degraded');
    assert.deepEqual(fs.readFileSync(path.join(dir, 'current.json')), before);
  }
});

test('v0.12: existing public API routes remain compatible', async t => {
  const { get } = await serve(t);
  await get('/v1/status');
  await get('/v1/settings');
});
