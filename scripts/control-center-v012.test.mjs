import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { renderControlCenterHtml } from '../runtime/control-center/control-center-app.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RuntimeApiService } from '../runtime/api/runtime-api-service.mjs';
import { createDiscoveryEvent } from '../runtime/orchestration/discovery-reentry.mjs';
import { createDevelopmentContract } from '../runtime/orchestration/development-contract.mjs';
import { createOrchestrationRun } from '../runtime/orchestration/orchestration-run.mjs';
import { decideAcceptance } from '../runtime/orchestration/acceptance-engine.mjs';
import { VerificationExtensionRegistry, executeVerificationExtensions } from '../runtime/orchestration/verification-extension-sdk.mjs';
import { computeComplexityDelta } from '../runtime/orchestration/complexity-delta.mjs';

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


test('v0.12 security: remote-controlled lookalike origins never receive cross-origin API reads', async t => {
  const { get, rootDir } = await serve(t);
  // The helper exercises the standard loopback host and endpoint; use the
  // same source under a malicious Origin to verify the CORS trust boundary.
  const dummy = await get('/v1/scale-context');
  assert.equal(dummy.authority, 'read-only-projection');
  const service = new RuntimeApiService({ rootDir });
  const info = await service.start();
  t.after(() => service.stop());
  const url = `http://${info.host}:${info.port}/v1/status`;
  for (const origin of [
    'http://localhost.evil.example',
    'http://127.0.0.1.evil.example',
    'http://localhost@evil.example',
    'http://127.0.0.1.evil.example:8443',
    'null',
    'https://localhost',
    'file://localhost',
  ]) {
    const response = await fetch(url, { headers: { Origin: origin } });
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), null, origin);
  }
  for (const origin of ['http://127.0.0.1:5173', 'http://localhost:3000', 'http://[::1]:8080']) {
    const response = await fetch(url, { headers: { Origin: origin } });
    assert.equal(response.status, 200, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
});

test('AC-030: Control Center exposes actual persisted discovery and cost observatory state, never invented acceptance', async t => {
  const { rootDir, get } = await serve(t);
  let data = await get('/v1/scale-context');
  assert.equal(data.operational.discoveryQueue.status, 'unavailable');
  assert.equal(data.operational.costObservatory.status, 'unavailable');
  assert.equal(data.operational.lifecycleInstances.count, 0);
  const event = createDiscoveryEvent({
    rootDir, lifecycleId: 'lc-1234567890ab', classification: 'specification-invalidation',
    description: 'Findings require review', evidence: { type: 'test', reference: 'AC-030' },
    affectedAuthority: [{ kind: 'specification', path: 'docs/spec.md' }],
  });
  assert.equal(event.requiresHumanApproval, true);
  const ledger = path.join(rootDir, '.development-kit', 'telemetry', 'cost-records.jsonl');
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  fs.writeFileSync(ledger, '{bad-json\n', 'utf8');
  data = await get('/v1/scale-context');
  assert.equal(data.operational.discoveryQueue.status, 'available');
  assert.equal(data.operational.discoveryQueue.count, 1);
  assert.equal(data.operational.discoveryQueue.pendingApproval, 1);
  assert.equal(data.operational.costObservatory.status, 'degraded');
  assert.equal(data.capabilities.discoveryReentry.accepted, null);
  assert.equal(data.capabilities.stateEngineV2.acceptanceStatus, 'deferred-to-v0.13.0');
  const file = path.join(rootDir, '.development-kit', 'discovery', 'events', event.discoveryId + '.json');
  const before = fs.readFileSync(file);
  await get('/v1/scale-context');
  assert.deepEqual(fs.readFileSync(file), before);
});

test('v0.12 integrated: project contract enforces gates, extensions, discovery, complexity, and Control Center read-only status', async t => {
  const { rootDir, get } = await serve(t);
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'docs', 'spec.md'), '# Project specification\nREQ-1: Required evidence\n');
  const contract = createDevelopmentContract({
    rootDir,
    task: {
      id: 'TASK-CROSS-001', projectId: 'proj-cross', status: 'approved',
      objective: 'Integrated cross-feature verification',
      scope: { in: ['.'], out: [] },
      requirements: ['REQ-1'],
      acceptanceCriteria: [{
        id: 'AC-EXT', statement: 'Mandatory extension passes',
        source: 'REQ-1', verificationType: ['tests'], requiredEvidence: true,
      }],
      requiredVerification: ['tests'],
      approvalPolicy: {
        requiredGateProfileIds: ['gp-consequential'],
        requiredExtensions: [{ extensionId: 've-safety-check', criterionId: 'AC-EXT' }],
      },
    },
    authoritativeSources: [{ path: 'docs/spec.md', kind: 'specification', authority: 'required' }],
  });
  const run = createOrchestrationRun({
    contract, runId: 'run-v012-integrated',
    capabilities: { fileRead: true, fileWrite: true, freshContext: true, shell: true },
  });
  assert.ok(run.requiredGates.humanApprovals.includes('consequential-action'));
  const state = decideAcceptance({ contract, verification: null, rootDir });
  assert.equal(state.state, 'PENDING');
  assert.ok(state.pending.some(g => g.code === 'MISSING_REQUIRED_APPROVAL' &&
    g.approvalId === 'consequential-action'));
  assert.ok(state.pending.some(g => g.code === 'REQUIRED_EXTENSION_UNVERIFIED'));
  const registry = new VerificationExtensionRegistry();
  registry.register({ extensionId: 've-safety-check', name: 'Project safety',
    verify: ({ safe }) => ({ pass: safe === true }) });
  const extensions = await executeVerificationExtensions({
    registry, contract,
    bindings: [{ extensionId: 've-safety-check', criterionId: 'AC-EXT', input: { safe: false } }],
  });
  assert.equal(extensions[0].status, 'FAIL');
  const event = createDiscoveryEvent({
    rootDir, lifecycleId: 'lc-1234567890ab',
    classification: 'implementation-defect',
    description: 'A specification change must force upstream review',
    evidence: { type: 'test', reference: 'AC-CROSS' },
    affectedAuthority: [{ path: 'docs/spec.md', kind: 'specification' }],
  });
  assert.equal(event.minimumReentryStage, 'DEFINE');
  assert.equal(event.requiresHumanApproval, true);
  assert.equal(computeComplexityDelta({ linesAdded: 5, linesDeleted: 2 }).schemaVersion, '1.0.0');
  const observed = await get('/v1/scale-context');
  assert.equal(observed.operational.discoveryQueue.count, 1);
  assert.equal(observed.operational.discoveryQueue.pendingApproval, 1);
  assert.equal(observed.stateHealth, 'unavailable');
  assert.equal(observed.operational.effectiveGates.status, 'unavailable');
  assert.equal(observed.capabilities.verificationExtensionSdk.accepted, null);
});


test('Control Center displays installed DKF version and does not ship stale labels', async t => {
  const { get } = await serve(t);
  const data = await get('/v1/status');
  const installed = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(data.frameworkVersion, installed.version);
});

test('Control Center live UI includes valid JS, polling, refresh, and v0.12 projection', () => {
  const html = renderControlCenterHtml({ sessionToken: 'test-local-session' });
  assert.match(html, /id="framework-badge"/);
  assert.match(html, /data-view="scale-context"/);
  assert.match(html, /Refresh now/);
  assert.doesNotMatch(html, /<span class="brand-badge">v0\.7\.0<\/span>/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'embedded dashboard JS must exist');
  assert.doesNotThrow(() => new vm.Script(script));
  assert.match(script, /setInterval\(/);
  assert.match(script, /5000/);
  assert.match(script, /'\/v1\/scale-context'/);
  assert.match(script, /cache: 'no-store'/);
  assert.match(script, /visibilitychange/);
});


test('Control Center follows live lifecycle revisions and displays the exact project root', async t => {
  const { get, rootDir } = await serve(t);
  const base = {
    schemaVersion: '1.0.0', workflowId: 'wf-live-test', projectId: 'test-project',
    workflowMode: 'guided', autonomyLevel: 'manual', workflowStatus: 'executing',
    createdAt: '2026-10-13T00:00:00.000Z', updatedAt: '2026-10-13T00:00:00.000Z',
    frameworkVersion: '0.12.0', completedStages: [], skippedStages: [], blockedStages: [],
  };
  putPointer(rootDir, { currentRevision: 1, currentRevisionFile: 'revision-000001.json' }, {
    ...base, currentStage: 'DEFINE', stateRevision: 1,
  });
  let status = await get('/v1/status');
  assert.equal(status.projectRoot, path.resolve(rootDir));
  assert.equal(status.workflow.currentStage, 'DEFINE');
  assert.equal(status.workflow.revision, 1);
  putPointer(rootDir, { currentRevision: 2, currentRevisionFile: 'revision-000002.json' }, {
    ...base, currentStage: 'IMPLEMENT', stateRevision: 2, completedStages: ['DEFINE'],
    updatedAt: '2026-10-13T01:00:00.000Z',
  });
  status = await get('/v1/status');
  assert.equal(status.workflow.currentStage, 'IMPLEMENT');
  assert.equal(status.workflow.revision, 2);
  assert.equal(status.workflow.updatedAt, '2026-10-13T01:00:00.000Z');
  const projection = await get('/v1/scale-context');
  assert.deepEqual(projection.state, { active: true, currentStage: 'IMPLEMENT', revision: 2 });
});

test('Control Center refresh updates visible UI and reports failures without fake success', async t => {
  const html = renderControlCenterHtml({ sessionToken: 'local-session' });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const makeNode = (tag) => ({
    tag, className: '', style: {}, textContent: '', scrollTop: 0, children: [],
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    replaceChildren(...nodes) { this.children = nodes; },
  });
  const ids = new Map([
    'proj-header-title', 'lifecycle-pill', 'framework-badge', 'refresh-indicator', 'main-content'
  ].map(id => [id, makeNode('div')]));
  let stage = 'DEFINE';
  let revision = 1;
  let failure = false;
  let tick = null;
  const responses = {
    '/v1/status': () => ({
      identity: { projectId: 'test-project', workspaceId: 'ws-test' },
      projectRoot: 'C:\\Dev\\EC-QQT', frameworkVersion: '0.12.0',
      settings: { controlCenter: { autoOpen: false } },
      workflow: { currentStage: stage, revision, workflowStatus: 'executing',
        updatedAt: '2026-10-13T00:00:00Z' },
      intelligence: { activeMemoryCount: 0, defaultProvider: 'local' },
    }),
    '/v1/scale-context': () => ({
      stateHealth: 'unverified', state: { currentStage: stage, revision },
      canonicalStateStore: 'autopilot-versioned-snapshots', authority: 'read-only-projection',
      operational: { lifecycleInstances: { status: 'available', count: 1 } },
      capabilities: { stateEngineV2: { installed: false, accepted: false,
        acceptanceStatus: 'deferred-to-v0.13.0' } },
    }),
    '/v1/workflow': () => ({ state: { currentStage: stage, stateRevision: revision,
      workflowId: 'wf-test', workflowStatus: 'executing', completedStages: [],
      blockedStages: [], skippedStages: [] } }),
  };
  const document = {
    hidden: false, getElementById: id => ids.get(id),
    createElement: makeNode, querySelectorAll: () => [],
    addEventListener: () => {},
  };
  const context = { document, console: { error: () => {} },
    fetch: async (url) => ({
      ok: !failure, status: failure ? 503 : 200,
      json: async () => responses[url] ? responses[url]() : {},
    }),
    setInterval: (callback, ms) => { assert.equal(ms, 5000); tick = callback; },
    Date,
  };
  vm.runInNewContext(script + '\n;globalThis.__testHooks = { refreshNow, switchView };', context);
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
  await flush();
  assert.equal(ids.get('lifecycle-pill').textContent, 'STAGE: DEFINE');
  assert.equal(ids.get('framework-badge').textContent, 'v0.12.0');
  assert.equal(ids.get('main-content').children.length, 2);
  stage = 'IMPLEMENT'; revision = 2;
  tick();
  await flush();
  assert.equal(ids.get('lifecycle-pill').textContent, 'STAGE: IMPLEMENT');
  assert.equal(ids.get('main-content').children[0].children[1].children[1].textContent, '2');
  await context.__testHooks.switchView('scale-context');
  assert.equal(ids.get('main-content').children.length, 4);
  failure = true;
  await context.__testHooks.refreshNow();
  assert.equal(ids.get('refresh-indicator').textContent, 'Update failed');
  assert.equal(ids.get('lifecycle-pill').textContent, 'STAGE: UNAVAILABLE');
});
