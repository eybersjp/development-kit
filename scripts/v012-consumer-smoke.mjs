#!/usr/bin/env node
// Installs the actual npm tarball into a disposable offline consumer project.
// Never modifies live project-local .development-kit data or global npm state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) {
  console.error('npm_execpath is required; run npm run consumer-smoke:v012');
  process.exit(1);
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-v012-consumer-'));
const consumer = path.join(temp, 'consumer');
fs.mkdirSync(consumer);
const npm = (args, cwd) => execFileSync(process.execPath, [npmCli, ...args], {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 120000,
});
try {
  const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', temp], root));
  assert.equal(packed.length, 1);
  assert.equal(packed[0].version, rootPackage.version);
  const tarball = path.join(temp, packed[0].filename);
  assert.equal(fs.existsSync(tarball), true);
  npm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
    '--prefix', consumer, tarball], root);
  const packageDir = path.join(consumer, 'node_modules', 'development-kit');
  const installed = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  assert.equal(installed.version, rootPackage.version);
  const manifest = JSON.parse(fs.readFileSync(path.join(packageDir,
    '.agents', 'plugins', 'development-kit', 'plugin.json'), 'utf8'));
  assert.equal(manifest.version, rootPackage.version);
  // Install the packaged plugin as a real consumer. The npm tarball carries
  // source runtime/ plus the manifest, and the installer materializes its plugin.
  execFileSync(process.execPath, [path.join(packageDir, 'scripts', 'install-antigravity.mjs'), '--project'], {
    cwd: consumer, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  });
  const pluginDir = path.join(consumer, '.agents', 'plugins', 'development-kit');
  const installedPlugin = JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
  assert.equal(installedPlugin.version, rootPackage.version);
  const legacyRoot = path.join(consumer, 'nested-app');
  const staleManifest = path.join(legacyRoot, '.agents', 'plugins', 'development-kit', 'plugin.json');
  fs.mkdirSync(path.dirname(staleManifest), { recursive: true });
  fs.writeFileSync(staleManifest, JSON.stringify({ name: 'development-kit', version: '0.10.0' }));
  const { RuntimeApiService } = await import(pathToFileURL(path.join(pluginDir,
    'runtime', 'api', 'runtime-api-service.mjs')).href);
  const api = new RuntimeApiService({ rootDir: legacyRoot });
  assert.equal(api._resolveFrameworkVersion(), rootPackage.version,
    'running executable plugin version must win over older target-project manifest');
  for (const moduleName of [
    'cost-observatory', 'workspace-targets', 'execution-capsule',
    'lifecycle-instance', 'discovery-reentry', 'gate-profiles',
    'verification-extension-sdk', 'complexity-delta',
  ]) {
    assert.ok(fs.existsSync(path.join(packageDir, 'runtime', 'orchestration',
      moduleName + '.mjs')), moduleName + ' missing from npm package');
  }
  assert.equal(fs.existsSync(path.join(packageDir, 'runtime', 'orchestration',
    'state-engine-v2.mjs')), false, 'Deferred T04 must not ship');
  assert.ok(fs.existsSync(path.join(packageDir, 'scripts',
    'install-antigravity.mjs')), 'Installation entrypoint missing');
  const exports = await import(pathToFileURL(path.join(packageDir, 'runtime',
    'orchestration', 'index.mjs')).href);
  for (const name of [
    'createLifecycleInstance', 'createDiscoveryEvent',
    'resolveContractGateProfiles', 'executeVerificationExtensions',
  ]) {
    assert.equal(typeof exports[name], 'function', 'Missing consumer runtime export: ' + name);
  }
  console.log(JSON.stringify({ verdict: 'PASS', version: installed.version,
    tarball: packed[0].filename, packedFiles: packed[0].entryCount,
    packageBytes: packed[0].size, includedRuntimeModules: 8,
    stateEngineV2Excluded: true }));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
