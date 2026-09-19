import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { classifyUiContext } from '../runtime/ui-preview/ui-context-classifier.mjs';
import {
  candidatePorts,
  detectFramework,
  detectFrontendProject,
  detectPackageManager,
  devCommandFor,
  extractDeclaredPorts,
} from '../runtime/ui-preview/frontend-project-detector.mjs';
import { createBrowserProvider, normalizeRoute, resolveSystemBrowserCommand, withRoute } from '../runtime/ui-preview/browser-providers.mjs';
import { ensurePreview, openPreview, ownsPreviewProcess, stopPreview } from '../runtime/ui-preview/preview-manager.mjs';
import { readPreviewState, writePreviewState } from '../runtime/ui-preview/state-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tempDir(prefix = 'dkf-preview-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('UI classifier detects UI/design context and ignores backend-only context', () => {
  const positive = classifyUiContext('Update the dashboard layout and design system for mobile');
  assert.equal(positive.previewRequired, true);
  assert.ok(positive.signals.includes('design-system'));
  assert.ok(positive.signals.includes('layout'));
  assert.ok(positive.signals.includes('responsive'));

  const negative = classifyUiContext('Add a database migration and background queue retry policy');
  assert.equal(negative.previewRequired, false);
  assert.deepEqual(negative.signals, []);
});

test('package manager detection follows lockfile precedence', () => {
  const root = tempDir();
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
  assert.equal(detectPackageManager(root), 'npm');
  fs.writeFileSync(path.join(root, 'yarn.lock'), '');
  assert.equal(detectPackageManager(root), 'yarn');
  fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
  assert.equal(detectPackageManager(root), 'pnpm');
  fs.rmSync(root, { recursive: true, force: true });
});

test('framework and candidate port detection is deterministic', () => {
  assert.equal(detectFramework({ dependencies: { next: '16.0.0' } }), 'next');
  assert.equal(detectFramework({ devDependencies: { vite: '7.0.0' } }), 'vite');
  assert.deepEqual(extractDeclaredPorts('vite --port 4567'), [4567]);
  const ports = candidatePorts({ framework: 'vite', devScript: 'vite --port 4567', env: {} });
  assert.equal(ports[0], 4567);
  assert.ok(ports.includes(5173));
});

test('dev command uses platform-safe package manager executable', () => {
  assert.deepEqual(devCommandFor('npm', 'linux'), { command: 'npm', args: ['run', 'dev'] });
  assert.deepEqual(devCommandFor('pnpm', 'win32'), { command: 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm run dev'] });
  assert.deepEqual(devCommandFor('yarn', 'linux'), { command: 'yarn', args: ['dev'] });
});

test('missing frontend produces waiting state without inventing commands', async () => {
  const root = tempDir();
  const result = await ensurePreview({ rootDir: root, context: 'Design the new dashboard UI', providerId: 'none', startupTimeoutMs: 500 });
  assert.equal(result.success, true);
  assert.equal(result.state, 'WAITING_FOR_RUNNABLE_UI');
  assert.match(result.reason, /No package\.json/);
  const state = readPreviewState(root);
  assert.equal(state.status, 'WAITING_FOR_RUNNABLE_UI');
  fs.rmSync(root, { recursive: true, force: true });
});

test('frontend detector refuses package.json without scripts.dev', () => {
  const root = tempDir();
  writeJson(path.join(root, 'package.json'), { scripts: { build: 'echo build' } });
  const project = detectFrontendProject(root);
  assert.equal(project.runnable, false);
  assert.match(project.reason, /will not invent a dev command/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('preview state store round-trips project-local state', () => {
  const root = tempDir();
  writePreviewState({ status: 'ARMED', previewRequired: true }, root);
  const state = readPreviewState(root);
  assert.equal(state.status, 'ARMED');
  assert.equal(fs.existsSync(path.join(root, '.development-kit', 'runtime', 'ui-preview.json')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('browser providers expose host action, none mode, and system command resolution', async () => {
  const host = createBrowserProvider('host-browser');
  const h = await host.display({ url: 'http://127.0.0.1:3000', reuseKey: 'x', route: '/dashboard' });
  assert.equal(h.displayed, false);
  assert.equal(h.browserAction.type, 'OPEN_OR_REUSE');
  assert.equal(h.browserAction.route, '/dashboard');

  const none = createBrowserProvider('none');
  const n = await none.display({ url: 'http://127.0.0.1:3000' });
  assert.equal(n.mode, 'none');

  assert.equal(resolveSystemBrowserCommand('http://127.0.0.1:3000', 'linux').command, 'xdg-open');
  assert.equal(resolveSystemBrowserCommand('http://127.0.0.1:3000', 'darwin').command, 'open');
  assert.equal(resolveSystemBrowserCommand('http://127.0.0.1:3000', 'win32').command, 'cmd.exe');
});

test('route normalization produces stable preview URLs', () => {
  assert.equal(normalizeRoute('dashboard'), '/dashboard');
  assert.equal(normalizeRoute('/dashboard'), '/dashboard');
  assert.equal(withRoute('http://127.0.0.1:3000', '/dashboard'), 'http://127.0.0.1:3000/dashboard');
});

test('real fixture dev server starts, is reused, and DKF-owned process stops safely', { timeout: 15000 }, async (t) => {
  const root = tempDir('dkf-preview-fixture-');
  const port = 34671 + Math.floor(Math.random() * 300);
  writeJson(path.join(root, 'package.json'), {
    scripts: { dev: `node server.mjs --port ${port}` },
    devDependencies: { vite: '7.0.0' },
  });
  fs.writeFileSync(path.join(root, 'server.mjs'), `
import http from 'node:http';
const i=process.argv.indexOf('--port');
const port=Number(process.argv[i+1]);
const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<h1>DKF Preview Fixture</h1>');});
server.listen(port,'127.0.0.1');
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
`, 'utf8');

  t.after(() => {
    try { stopPreview({ rootDir: root }); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  });

  const first = await ensurePreview({ rootDir: root, context: 'Build the dashboard UI', providerId: 'none', startupTimeoutMs: 7000 });
  assert.equal(first.success, true, JSON.stringify(first));
  assert.equal(first.reusedServer, false);
  assert.equal(first.startedByDkf, true);
  assert.equal(first.url, `http://127.0.0.1:${port}`);

  const persisted = readPreviewState(root);
  assert.equal(ownsPreviewProcess(persisted), true);

  const second = await ensurePreview({ rootDir: root, context: 'Update dashboard layout', providerId: 'none', startupTimeoutMs: 1000 });
  assert.equal(second.success, true);
  assert.equal(second.reusedServer, true);
  assert.equal(second.startedByDkf, true);
  assert.equal(readPreviewState(root).pid, persisted.pid);

  const opened = await openPreview({ rootDir: root, route: '/dashboard', providerId: 'host-browser' });
  assert.equal(opened.success, true);
  assert.equal(opened.browserAction.type, 'OPEN_OR_REUSE');
  assert.match(opened.url, /\/dashboard$/);

  const stopped = stopPreview({ rootDir: root });
  assert.equal(stopped.success, true, JSON.stringify(stopped));
  assert.equal(stopped.stopped, true);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const afterStop = await fetch(`http://127.0.0.1:${port}`).then(() => true).catch(() => false);
  assert.equal(afterStop, false, 'owned preview process tree must stop with the wrapper');
});

test('stop never kills a reused external server', () => {
  const root = tempDir();
  writePreviewState({ status: 'HEALTHY', startedByDkf: false, pid: process.pid, url: 'http://127.0.0.1:65534' }, root);
  const result = stopPreview({ rootDir: root });
  assert.equal(result.success, true);
  assert.equal(result.stopped, false);
  assert.match(result.reason, /reused/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('CLI classify and status contracts are JSON and deterministic', () => {
  const cli = path.join(ROOT, 'scripts', 'ui-preview.mjs');
  const classify = spawnSync(process.execPath, [cli, '--classify', '--context=Update the dashboard UI'], { encoding: 'utf8' });
  assert.equal(classify.status, 0, classify.stderr);
  const c = JSON.parse(classify.stdout);
  assert.equal(c.previewRequired, true);

  const root = tempDir();
  const status = spawnSync(process.execPath, [cli, '--status', `--root=${root}`], { encoding: 'utf8' });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).state.status, 'INACTIVE');
  fs.rmSync(root, { recursive: true, force: true });
});


test('explicit localhost external server is adopted without ownership', { timeout: 5000 }, async (t) => {
  const http = await import('node:http');
  const root = tempDir('dkf-preview-external-');
  writeJson(path.join(root, 'package.json'), {
    scripts: { dev: 'node unused-server.mjs' },
    dependencies: { next: '16.0.0' },
  });

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<h1>External Next Preview</h1>');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });

  const result = await ensurePreview({
    rootDir: root,
    context: 'Update the Next.js dashboard UI',
    providerId: 'none',
    existingUrl: url,
    startupTimeoutMs: 500,
  });

  assert.equal(result.success, true);
  assert.equal(result.reusedServer, true);
  assert.equal(result.startedByDkf, false);
  assert.equal(readPreviewState(root).startedByDkf, false);

  const stopped = stopPreview({ rootDir: root });
  assert.equal(stopped.success, true);
  assert.equal(stopped.stopped, false);
  const stillHealthy = await fetch(url).then((response) => response.ok).catch(() => false);
  assert.equal(stillHealthy, true, 'DKF must leave explicitly adopted external server running');
});

test('priority DKF workflows integrate live preview before formal browser verification', () => {
  const files = [
    'commands/dk-autopilot.md',
    'commands/dk-design.md',
    'commands/dk-build.md',
    'commands/dk-build-auto.md',
    'agents/development-conductor.md',
    'agents/frontend-implementer.md',
  ];

  for (const relative of files) {
    const content = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    assert.match(content, /scripts\/ui-preview\.mjs --ensure/, `${relative} must ensure Live UI Preview`);
  }

  const browserVerification = fs.readFileSync(path.join(ROOT, 'skills', 'browser-runtime-verification', 'SKILL.md'), 'utf8');
  assert.match(browserVerification, /ui-preview\.mjs --status/);
  assert.match(browserVerification, /not a verification verdict|not evidence that the required browser behaviours pass/i);

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['release:validate'], /ui-preview:test/);
});
