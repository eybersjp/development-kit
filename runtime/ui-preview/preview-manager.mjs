import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { classifyUiContext } from './ui-context-classifier.mjs';
import { detectFrontendProject } from './frontend-project-detector.mjs';
import { createBrowserProvider, withRoute } from './browser-providers.mjs';
import { getPreviewLogDir, readPreviewState, writePreviewState } from './state-store.mjs';

const PROCESS_HOST = new URL('./process-host.mjs', import.meta.url);

export async function probeUrl(url, timeoutMs = 700) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: controller.signal });
    return response.status > 0 && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function findHealthyCandidate(ports, host = '127.0.0.1', excludedPorts = new Set()) {
  for (const port of ports) {
    if (excludedPorts.has(port)) continue;
    const url = `http://${host}:${port}`;
    if (await probeUrl(url)) return { url, port };
  }
  return null;
}

async function captureHealthyPorts(ports) {
  const healthy = new Set();
  for (const port of ports) {
    if (await probeUrl(`http://127.0.0.1:${port}`)) healthy.add(port);
  }
  return healthy;
}

function urlsFromLog(logPath) {
  if (!logPath || !fs.existsSync(logPath)) return [];
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const matches = content.match(/https?:\/\/(?:127\.0\.0\.1|localhost):\d{2,5}/g) ?? [];
    return [...new Set(matches.map((value) => value.replace('localhost', '127.0.0.1')))];
  } catch {
    return [];
  }
}

function processHostPath() {
  return fileURLToPath(PROCESS_HOST);
}

export function startPreviewProcess(project, rootDir, spawnImpl = spawn) {
  const logDir = getPreviewLogDir(rootDir);
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `server-${Date.now()}.log`);
  const logFd = fs.openSync(logPath, 'a');
  const ownershipToken = crypto.randomUUID();
  const args = [
    processHostPath(),
    '--token', ownershipToken,
    '--root', rootDir,
    '--command', project.command.command,
    '--args-json', JSON.stringify(project.command.args),
  ];
  const child = spawnImpl(process.execPath, args, {
    cwd: rootDir,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
  });
  child.unref?.();
  fs.closeSync(logFd);
  return { pid: child.pid, ownershipToken, logPath };
}

async function waitForHealthy(ports, timeoutMs, { excludedPorts = new Set(), logPath = null } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const url of urlsFromLog(logPath)) {
      if (await probeUrl(url)) return { url, port: Number(new URL(url).port) };
    }
    const found = await findHealthyCandidate(ports, '127.0.0.1', excludedPorts);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

function pidExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function readProcessCommandLine(pid, platform = process.platform) {
  if (!pidExists(pid)) return '';
  try {
    if (platform === 'linux') return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
    if (platform === 'darwin') return spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).stdout.trim();
    if (platform === 'win32') {
      const ps = spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`], { encoding: 'utf8', windowsHide: true });
      return ps.stdout.trim();
    }
  } catch {}
  return '';
}

export function ownsPreviewProcess(state, platform = process.platform) {
  if (!state?.startedByDkf || !state.pid || !state.ownershipToken) return false;
  const line = readProcessCommandLine(state.pid, platform);
  return Boolean(line && (line.includes(`dkf-ui-preview:${state.ownershipToken}`) || (line.includes('process-host.mjs') && line.includes(state.ownershipToken))));
}

export function stopOwnedProcess(state, platform = process.platform) {
  if (!ownsPreviewProcess(state, platform)) return { stopped: false, reason: 'DKF could not prove ownership of the persisted process.' };
  try {
    if (platform === 'win32') {
      const result = spawnSync('taskkill.exe', ['/PID', String(state.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true });
      return { stopped: result.status === 0, reason: result.status === 0 ? null : result.stderr || result.stdout };
    }
    process.kill(state.pid, 'SIGTERM');
    return { stopped: true, reason: null };
  } catch (error) {
    return { stopped: false, reason: error.message };
  }
}

async function displayPreview({ rootDir, state, providerId, route, browserOptions }) {
  const provider = createBrowserProvider(providerId, browserOptions);
  if (!(await provider.isAvailable())) {
    return { state: writePreviewState({ ...state, status: 'BROWSER_UNAVAILABLE', browserProvider: providerId }, rootDir), display: null };
  }
  const displayUrl = withRoute(state.url, route);
  const display = await provider.display({ url: displayUrl, reuseKey: `dkf:${rootDir}`, route });
  const status = display.displayed ? 'DISPLAYED' : 'HEALTHY';
  return {
    state: writePreviewState({
      ...state,
      status,
      browserProvider: providerId,
      browserOpened: Boolean(display.displayed || state.browserOpened),
      browserActionPending: Boolean(display.browserAction),
      lastRoute: route || '/',
      displayUrl,
    }, rootDir),
    display,
  };
}

export async function ensurePreview({
  rootDir = process.cwd(),
  context = '',
  route = '/',
  providerId = 'host-browser',
  startupTimeoutMs = 20000,
  browserOptions = {},
  spawnImpl = spawn,
  existingUrl = null,
} = {}) {
  const existingState = readPreviewState(rootDir);
  const classification = classifyUiContext(context);
  const alreadyArmed = Boolean(existingState && existingState.status && existingState.status !== 'INACTIVE' && existingState.status !== 'STOPPED');

  if (!classification.previewRequired && !alreadyArmed) {
    return { success: true, previewRequired: false, classification, state: 'INACTIVE' };
  }

  let state = writePreviewState({
    ...(existingState ?? {}),
    status: existingState?.status ?? 'ARMED',
    previewRequired: true,
    classification,
    projectRoot: rootDir,
  }, rootDir);

  const project = detectFrontendProject(rootDir);
  if (!project.runnable) {
    const status = project.discoveryFailed ? 'DISCOVERY_FAILED' : 'WAITING_FOR_RUNNABLE_UI';
    state = writePreviewState({ ...state, status, reason: project.reason }, rootDir);
    return { success: !project.discoveryFailed, previewRequired: true, classification, state: status, reason: project.reason };
  }

  if (state.url && await probeUrl(state.url)) {
    state = writePreviewState({ ...state, status: 'HEALTHY', reason: null, packageManager: project.packageManager, framework: project.framework }, rootDir);
    const shown = await displayPreview({ rootDir, state, providerId, route, browserOptions });
    return {
      success: true,
      previewRequired: true,
      classification,
      state: shown.state.status,
      url: state.url,
      reusedServer: true,
      startedByDkf: Boolean(state.startedByDkf),
      browserAction: shown.display?.browserAction ?? null,
      display: shown.display,
    };
  }

  if (existingUrl) {
    let parsed;
    try { parsed = new URL(existingUrl); } catch { parsed = null; }
    if (parsed && ['127.0.0.1', 'localhost'].includes(parsed.hostname) && await probeUrl(parsed.toString())) {
      state = writePreviewState({
        ...state,
        status: 'HEALTHY',
        url: parsed.toString().replace(/\/$/, ''),
        port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
        packageManager: project.packageManager,
        framework: project.framework,
        devCommand: project.devScript,
        startedByDkf: false,
        pid: null,
        ownershipToken: null,
        reason: null,
      }, rootDir);
      const shown = await displayPreview({ rootDir, state, providerId, route, browserOptions });
      return { success: true, previewRequired: true, classification, state: shown.state.status, url: state.url, reusedServer: true, startedByDkf: false, browserAction: shown.display?.browserAction ?? null, display: shown.display };
    }
  }

  state = writePreviewState({ ...state, status: 'STARTING', packageManager: project.packageManager, framework: project.framework, devCommand: project.devScript }, rootDir);
  const preexistingHealthyPorts = await captureHealthyPorts(project.candidatePorts);
  let launch;
  try {
    launch = startPreviewProcess(project, rootDir, spawnImpl);
  } catch (error) {
    state = writePreviewState({ ...state, status: 'START_FAILED', reason: error.message }, rootDir);
    return { success: false, previewRequired: true, state: state.status, reason: error.message };
  }

  state = writePreviewState({ ...state, ...launch, startedByDkf: true }, rootDir);
  const healthy = await waitForHealthy(project.candidatePorts, startupTimeoutMs, { excludedPorts: preexistingHealthyPorts, logPath: launch.logPath });
  if (!healthy) {
    state = writePreviewState({ ...state, status: 'HEALTH_CHECK_FAILED', reason: `Development server did not become healthy within ${startupTimeoutMs}ms.` }, rootDir);
    return { success: false, previewRequired: true, state: state.status, reason: state.reason, logPath: launch.logPath };
  }

  state = writePreviewState({ ...state, status: 'HEALTHY', url: healthy.url, port: healthy.port, reason: null }, rootDir);
  const shown = await displayPreview({ rootDir, state, providerId, route, browserOptions });
  return { success: true, previewRequired: true, classification, state: shown.state.status, url: healthy.url, reusedServer: false, startedByDkf: true, browserAction: shown.display?.browserAction ?? null, display: shown.display, logPath: launch.logPath };
}

export async function openPreview({ rootDir = process.cwd(), route = '/', providerId = 'host-browser', browserOptions = {} } = {}) {
  const state = readPreviewState(rootDir);
  if (!state?.url || !(await probeUrl(state.url))) return { success: false, state: state?.status ?? 'INACTIVE', reason: 'No healthy preview server is available.' };
  const shown = await displayPreview({ rootDir, state: { ...state, status: 'HEALTHY' }, providerId, route, browserOptions });
  return { success: true, state: shown.state.status, url: shown.state.displayUrl, browserAction: shown.display?.browserAction ?? null, display: shown.display };
}

export function stopPreview({ rootDir = process.cwd(), platform = process.platform } = {}) {
  const state = readPreviewState(rootDir);
  if (!state) return { success: true, state: 'STOPPED', stopped: false, reason: 'No preview state exists.' };
  if (!state.startedByDkf) {
    writePreviewState({ ...state, status: 'STOPPED', browserActionPending: false }, rootDir);
    return { success: true, state: 'STOPPED', stopped: false, reason: 'Preview server was reused, not started by DKF; it was left running.' };
  }
  const result = stopOwnedProcess(state, platform);
  if (!result.stopped) return { success: false, state: state.status, stopped: false, reason: result.reason };
  writePreviewState({ ...state, status: 'STOPPED', browserActionPending: false }, rootDir);
  return { success: true, state: 'STOPPED', stopped: true };
}
