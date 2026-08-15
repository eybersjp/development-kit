/**
 * Development Kit Control Center — Local Web Service & Auto-Launcher
 *
 * Implements:
 * 1. Serving Control Center single-page app alongside the Runtime API
 * 2. Automated browser launching policy:
 *    - Off by default
 *    - Enabled only when interactive, healthy, and setting is ON
 *    - Suppressed in CI, automated tests, headless environments
 *    - Duplicate launch suppression
 */

import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { RuntimeApiService } from '../api/runtime-api-service.mjs';
import { renderControlCenterHtml } from './control-center-app.mjs';
import { resolveEffectiveSettings } from '../intelligence/settings.mjs';

let activeControlCenterInstance = null;

export class ControlCenterService {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.port = options.port || 0;
    this.host = options.host || '127.0.0.1';
    this.apiService = new RuntimeApiService({
      rootDir: this.rootDir,
      port: this.port,
      host: this.host,
    });
    this.launched = false;
  }

  async start() {
    const apiResult = await this.apiService.start();

    // Patch API server to also serve Control Center UI at '/'
    const existingHandler = this.apiService.server.listeners('request')[0];
    this.apiService.server.removeAllListeners('request');

    this.apiService.server.on('request', async (req, res) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      if (req.method === 'GET' && (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html')) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
        });
        const html = renderControlCenterHtml({
          sessionToken: apiResult.sessionToken,
          apiBaseUrl: '',
          host: apiResult.host,
          port: apiResult.port,
        });
        res.end(html);
        return;
      }

      // Delegate other endpoints to Runtime API
      if (existingHandler) {
        existingHandler(req, res);
      }
    });

    activeControlCenterInstance = this;

    return {
      ...apiResult,
      uiUrl: `http://${apiResult.host}:${apiResult.port}/`,
    };
  }

  async stop() {
    if (activeControlCenterInstance === this) {
      activeControlCenterInstance = null;
    }
    await this.apiService.stop();
  }
}

/**
 * Checks whether the environment is non-interactive / CI / headless / test.
 */
export function isHeadlessOrCiEnvironment() {
  if (process.env.CI || process.env.CONTINUOUS_INTEGRATION || process.env.GITHUB_ACTIONS) {
    return true;
  }

  if (process.env.NODE_ENV === 'test' || process.env.DK_HEADLESS === '1') {
    return true;
  }

  if (!process.stdout.isTTY && !process.env.DK_FORCE_INTERACTIVE) {
    return true;
  }

  return false;
}

/**
 * Evaluates auto-open conditions and launches browser if allowed.
 */
export async function maybeAutoOpenControlCenter(serviceResult, options = {}) {
  const { rootDir = process.cwd(), openerFn = null } = options;

  const settings = resolveEffectiveSettings(rootDir);
  const autoOpenEnabled = Boolean(settings.controlCenter && settings.controlCenter.autoOpen);

  if (!autoOpenEnabled) {
    return { opened: false, reason: 'setting_disabled' };
  }

  if (isHeadlessOrCiEnvironment() && !options.forceInteractive) {
    return { opened: false, reason: 'headless_or_ci_suppressed' };
  }

  if (activeControlCenterInstance && activeControlCenterInstance.launched) {
    return { opened: false, reason: 'already_launched_duplicate_suppression' };
  }

  const targetUrl = serviceResult.uiUrl || `http://${serviceResult.host}:${serviceResult.port}/`;

  if (openerFn) {
    await openerFn(targetUrl);
  } else {
    launchSystemBrowser(targetUrl);
  }

  if (activeControlCenterInstance) {
    activeControlCenterInstance.launched = true;
  }

  return { opened: true, url: targetUrl };
}

/**
 * Safe cross-platform browser launch helper.
 */
export function launchSystemBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // Failure to open browser must never crash or block Development Kit
  }
}
