import fs from 'node:fs';
import path from 'node:path';

const FRAMEWORK_PORTS = Object.freeze({
  next: [3000],
  vite: [5173],
  sveltekit: [5173],
  nuxt: [3000],
  angular: [4200],
  astro: [4321],
  remix: [3000],
  expo: [8081, 19006],
  generic: [3000, 5173, 4200, 4321, 8080],
});

function hasAny(record, names) {
  return names.some((name) => Object.prototype.hasOwnProperty.call(record, name));
}

export function detectPackageManager(rootDir) {
  if (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(rootDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(rootDir, 'bun.lock')) || fs.existsSync(path.join(rootDir, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(rootDir, 'package-lock.json'))) return 'npm';
  return 'npm';
}

export function detectFramework(packageJson = {}) {
  const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  if (hasAny(dependencies, ['next'])) return 'next';
  if (hasAny(dependencies, ['@sveltejs/kit'])) return 'sveltekit';
  if (hasAny(dependencies, ['nuxt'])) return 'nuxt';
  if (hasAny(dependencies, ['@angular/core'])) return 'angular';
  if (hasAny(dependencies, ['astro'])) return 'astro';
  if (hasAny(dependencies, ['@remix-run/dev', '@remix-run/react'])) return 'remix';
  if (hasAny(dependencies, ['expo'])) return 'expo';
  if (hasAny(dependencies, ['vite'])) return 'vite';
  return 'generic';
}

export function extractDeclaredPorts(script = '') {
  const values = new Set();
  const patterns = [
    /(?:--port|-p)\s*[= ]\s*(\d{2,5})\b/g,
    /\bPORT\s*=\s*(\d{2,5})\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of script.matchAll(pattern)) values.add(Number(match[1]));
  }
  return [...values].filter((port) => port > 0 && port < 65536);
}

export function candidatePorts({ framework = 'generic', devScript = '', env = process.env } = {}) {
  const ports = new Set();
  for (const port of extractDeclaredPorts(devScript)) ports.add(port);
  const envPort = Number(env.PORT);
  if (Number.isInteger(envPort) && envPort > 0 && envPort < 65536) ports.add(envPort);
  for (const port of FRAMEWORK_PORTS[framework] ?? FRAMEWORK_PORTS.generic) ports.add(port);
  for (const port of FRAMEWORK_PORTS.generic) ports.add(port);
  return [...ports];
}

export function devCommandFor(packageManager, platform = process.platform) {
  const suffix = platform === 'win32' ? '.cmd' : '';
  switch (packageManager) {
    case 'pnpm': return { command: `pnpm${suffix}`, args: ['run', 'dev'] };
    case 'yarn': return { command: `yarn${suffix}`, args: ['dev'] };
    case 'bun': return { command: `bun${suffix}`, args: ['run', 'dev'] };
    case 'npm':
    default: return { command: `npm${suffix}`, args: ['run', 'dev'] };
  }
}

export function detectFrontendProject(rootDir = process.cwd()) {
  const packagePath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return { runnable: false, reason: 'No package.json with a dev script is available yet.', rootDir };
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (error) {
    return { runnable: false, discoveryFailed: true, reason: `Invalid package.json: ${error.message}`, rootDir };
  }

  const devScript = packageJson.scripts?.dev;
  if (typeof devScript !== 'string' || !devScript.trim()) {
    return { runnable: false, reason: 'package.json does not declare scripts.dev; DKF will not invent a dev command.', rootDir, packageJson };
  }

  const packageManager = detectPackageManager(rootDir);
  const framework = detectFramework(packageJson);
  return {
    runnable: true,
    rootDir,
    packageJson,
    devScript,
    packageManager,
    framework,
    command: devCommandFor(packageManager),
    candidatePorts: candidatePorts({ framework, devScript }),
  };
}

export { FRAMEWORK_PORTS };
