import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuntimeApiService } from '../runtime/api/runtime-api-service.mjs';

test('AC-030: Control Center Runtime API exposes v0.12 control plane state and capabilities without authoritative mutation', async (t) => {
  const service = new RuntimeApiService();
  const startInfo = await service.start();
  t.after(async () => {
    if (service.server) {
      await new Promise((resolve) => service.server.close(resolve));
    }
  });

  const response = await fetch(`http://${startInfo.host}:${startInfo.port}/v1/scale-context`);
  assert.equal(response.status, 200);

  const data = await response.json();
  assert.equal(data.schemaVersion, '1.0.0');
  assert.equal(data.stateHealth, 'healthy');
  assert.equal(data.capabilities.workspaceTargets, true);
  assert.equal(data.capabilities.executionCapsules, true);
  assert.equal(data.capabilities.stateEngineV2, true);
  assert.equal(data.capabilities.lifecycleInstances, true);
  assert.equal(data.capabilities.discoveryReentry, true);
  assert.equal(data.capabilities.gateProfiles, true);
  assert.equal(data.capabilities.verificationExtensionSdk, true);
  assert.equal(data.capabilities.complexityDeltaGuard, true);
});

test('AC-031: Existing public routes remain functional and compatible', async (t) => {
  const service = new RuntimeApiService();
  const startInfo = await service.start();
  t.after(async () => {
    if (service.server) {
      await new Promise((resolve) => service.server.close(resolve));
    }
  });

  const statusRes = await fetch(`http://${startInfo.host}:${startInfo.port}/v1/status`);
  assert.equal(statusRes.status, 200);

  const settingsRes = await fetch(`http://${startInfo.host}:${startInfo.port}/v1/settings`);
  assert.equal(settingsRes.status, 200);
});
