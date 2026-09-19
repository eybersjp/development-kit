import { spawn } from 'node:child_process';

export function normalizeRoute(route = '/') {
  if (!route || route === '/') return '/';
  const value = String(route).trim();
  if (!value) return '/';
  return value.startsWith('/') ? value : `/${value}`;
}

export function withRoute(baseUrl, route = '/') {
  const url = new URL(baseUrl);
  const normalized = normalizeRoute(route);
  if (normalized !== '/') url.pathname = normalized;
  return url.toString().replace(/\/$/, normalized === '/' ? '' : '/').replace(/\/$/, '');
}

export function resolveSystemBrowserCommand(url, platform = process.platform) {
  if (platform === 'win32') return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'start', '', url] };
  if (platform === 'darwin') return { command: 'open', args: [url] };
  return { command: 'xdg-open', args: [url] };
}

function spawnDetached(command, args) {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

export function createBrowserProvider(id = 'host-browser', options = {}) {
  if (id === 'none') {
    return {
      id,
      async isAvailable() { return true; },
      async display({ url }) { return { displayed: false, reused: false, mode: 'none', url }; },
    };
  }

  if (id === 'system-browser') {
    return {
      id,
      async isAvailable() { return true; },
      async display({ url }) {
        const resolved = resolveSystemBrowserCommand(url, options.platform ?? process.platform);
        (options.spawn ?? spawnDetached)(resolved.command, resolved.args);
        return { displayed: true, reused: false, mode: 'system-browser', url, command: resolved };
      },
    };
  }

  if (id === 'host-browser') {
    return {
      id,
      async isAvailable() { return true; },
      async display({ url, reuseKey, route }) {
        return {
          displayed: false,
          reused: false,
          mode: 'host-browser',
          url,
          browserAction: { type: 'OPEN_OR_REUSE', url, reuseKey, route: normalizeRoute(route) },
          instructions: 'The active host agent must immediately open or reuse its browser surface for this URL.',
        };
      },
    };
  }

  throw new Error(`Unknown browser provider: ${id}`);
}
