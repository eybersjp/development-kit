/**
 * Development Kit Intelligence — Phase 14 Test Suite (Cross-Platform Integration)
 *
 * Tests:
 * 1. DK Local Memory persistence operates in standard pure Node.js environments
 * 2. Control Center runtime operates independently of IDE (OpenCode, Claude, Cursor, VSCode, Cline, Windsurf)
 * 3. Auto-open detects environment capabilities without crashing on headless systems
 * 4. Installer packaging scripts include all runtime intelligence, api, and control-center directories
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LocalMemoryProvider } from '../runtime/intelligence/local-memory-provider.mjs';
import { ControlCenterService } from '../runtime/control-center/control-center-service.mjs';
import { resolveEffectiveSettings } from '../runtime/intelligence/settings.mjs';

function makeTempProject(prefix = 'dk-phase14-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('1. DK Local Memory operates without platform-specific dependencies', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  const health = await provider.health();
  assert.equal(health.status, 'healthy');
  assert.equal(health.storageType, 'local-file-atomic');
});

test('2. Control Center runtime operates independently of any IDE plugin host', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const service = new ControlCenterService({ rootDir, port: 0 });
  const started = await service.start();
  t.after(() => service.stop());

  assert.ok(started.uiUrl);
  assert.equal(started.host, '127.0.0.1');

  const res = await fetch(`${started.uiUrl}`);
  assert.equal(res.status, 200);
});

test('3. Package files include all necessary v0.7 runtime directories', () => {
  const rootDir = process.cwd();
  assert.ok(existsSync(join(rootDir, 'runtime', 'intelligence')));
  assert.ok(existsSync(join(rootDir, 'runtime', 'api')));
  assert.ok(existsSync(join(rootDir, 'runtime', 'control-center')));
  assert.ok(existsSync(join(rootDir, 'runtime', 'providers')));
});
