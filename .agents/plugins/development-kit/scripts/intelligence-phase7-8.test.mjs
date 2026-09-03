/**
 * Development Kit Control Center — Phase 7 & 8 Test Suite
 *
 * Tests:
 * 1. ControlCenterService serves HTML UI at root path '/'
 * 2. Rendered HTML contains navigation for Overview, Workflow, Memory, Decisions, Providers, Settings
 * 3. Settings autoOpen defaults to false and prevents launch
 * 4. Auto-open is suppressed in CI and headless environments
 * 5. Auto-open launches browser when enabled and interactive
 * 6. Duplicate launch suppression prevents opening browser multiple times
 * 7. Browser launch failure degrades gracefully without crashing
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  ControlCenterService,
  isHeadlessOrCiEnvironment,
  maybeAutoOpenControlCenter,
} from '../runtime/control-center/control-center-service.mjs';
import { renderControlCenterHtml } from '../runtime/control-center/control-center-app.mjs';

function makeTempProject(prefix = 'dk-phase7-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('1. ControlCenterService serves HTML UI at root path /', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const service = new ControlCenterService({ rootDir, port: 0 });
  const started = await service.start();
  t.after(() => service.stop());

  const res = await fetch(started.uiUrl);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /Development Kit Control Center/);
});

test('2. Rendered HTML contains navigation for all core screens', () => {
  const html = renderControlCenterHtml({ sessionToken: 'test_token' });
  assert.match(html, /Overview/);
  assert.match(html, /Workflow/);
  assert.match(html, /Memory/);
  assert.match(html, /Decisions/);
  assert.match(html, /Providers/);
  assert.match(html, /Settings/);
});

test('3. Settings autoOpen defaults to false and prevents launch', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  let launchedUrl = null;
  const opener = async (url) => {
    launchedUrl = url;
  };

  const serviceResult = { host: '127.0.0.1', port: 3200, uiUrl: 'http://127.0.0.1:3200/' };
  const autoOpen = await maybeAutoOpenControlCenter(serviceResult, {
    rootDir,
    openerFn: opener,
  });

  assert.equal(autoOpen.opened, false);
  assert.equal(autoOpen.reason, 'setting_disabled');
  assert.equal(launchedUrl, null);
});

test('4. Auto-open is suppressed in CI and headless environments', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  // Enable autoOpen in project settings
  mkdirSync(join(rootDir, '.development-kit'), { recursive: true });
  writeFileSync(
    join(rootDir, '.development-kit', 'settings.json'),
    JSON.stringify({ controlCenter: { autoOpen: true } }),
  );

  const prevCi = process.env.CI;
  process.env.CI = 'true';

  try {
    let launched = false;
    const autoOpen = await maybeAutoOpenControlCenter(
      { uiUrl: 'http://127.0.0.1:3200/' },
      { rootDir, openerFn: async () => { launched = true; } },
    );

    assert.equal(autoOpen.opened, false);
    assert.equal(autoOpen.reason, 'headless_or_ci_suppressed');
    assert.equal(launched, false);
  } finally {
    if (prevCi !== undefined) process.env.CI = prevCi;
    else delete process.env.CI;
  }
});

test('5. Auto-open launches browser when enabled and interactive', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  mkdirSync(join(rootDir, '.development-kit'), { recursive: true });
  writeFileSync(
    join(rootDir, '.development-kit', 'settings.json'),
    JSON.stringify({ controlCenter: { autoOpen: true } }),
  );

  let openedUrl = null;
  const autoOpen = await maybeAutoOpenControlCenter(
    { uiUrl: 'http://127.0.0.1:3200/' },
    {
      rootDir,
      forceInteractive: true,
      openerFn: async (url) => { openedUrl = url; },
    },
  );

  assert.equal(autoOpen.opened, true);
  assert.equal(openedUrl, 'http://127.0.0.1:3200/');
});

test('6. Duplicate launch suppression prevents opening browser multiple times', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  mkdirSync(join(rootDir, '.development-kit'), { recursive: true });
  writeFileSync(
    join(rootDir, '.development-kit', 'settings.json'),
    JSON.stringify({ controlCenter: { autoOpen: true } }),
  );

  const service = new ControlCenterService({ rootDir, port: 0 });
  const started = await service.start();
  t.after(() => service.stop());

  let launchCount = 0;
  const opener = async () => { launchCount++; };

  // First call opens
  const first = await maybeAutoOpenControlCenter(started, {
    rootDir,
    forceInteractive: true,
    openerFn: opener,
  });
  assert.equal(first.opened, true);
  assert.equal(launchCount, 1);

  // Repeated call is suppressed
  const second = await maybeAutoOpenControlCenter(started, {
    rootDir,
    forceInteractive: true,
    openerFn: opener,
  });
  assert.equal(second.opened, false);
  assert.equal(second.reason, 'already_launched_duplicate_suppression');
  assert.equal(launchCount, 1);
});
