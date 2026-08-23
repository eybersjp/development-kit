import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');
const INSTALLER_SCRIPT = join(REPO_ROOT, 'scripts', 'install-antigravity.mjs');
const PACKAGE_VERSION = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).version;

function createTempDir(prefix = 'dk install test ') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('standalone installation (--all) includes runtime and executes without repository fallback', (t) => {
  const tempTarget = createTempDir('dk standalone test ');
  t.after(() => {
    rmSync(tempTarget, { recursive: true, force: true });
    assert.ok(!existsSync(tempTarget), 'Temporary directory must be cleaned up');
  });

  const installResult = spawnSync(process.execPath, [INSTALLER_SCRIPT, '--all'], {
    cwd: tempTarget,
    encoding: 'utf8',
  });

  assert.equal(
    installResult.status,
    0,
    `Installer failed with exit status ${installResult.status}: ${installResult.stderr || installResult.stdout}`,
  );

  const expectedDirs = [
    'agents',
    'skills',
    'commands',
    'hooks',
    'templates',
    'evals',
    'runtime',
    'schemas',
    'scripts',
  ];

  for (const dir of expectedDirs) {
    const dirPath = join(tempTarget, dir);
    assert.ok(existsSync(dirPath), `Expected installed directory "${dir}" does not exist at ${dirPath}`);
  }

  assert.ok(
    existsSync(join(tempTarget, 'runtime', 'autopilot', 'state-store.mjs')),
    'runtime/autopilot/state-store.mjs must exist in installed target',
  );
  assert.ok(
    existsSync(join(tempTarget, 'runtime', 'next-step', 'index.mjs')),
    'runtime/next-step/index.mjs must exist in installed target',
  );
  assert.ok(
    existsSync(join(tempTarget, 'runtime', 'orchestration', 'development-contract.mjs')),
    'runtime/orchestration/development-contract.mjs must exist in installed target',
  );
  assert.ok(
    existsSync(join(tempTarget, 'schemas', 'development-contract.schema.json')),
    'Development Contract schema must exist in installed target',
  );

  const installedNextStepScript = join(tempTarget, 'scripts', 'next-step.mjs');
  const nextStepResult = spawnSync(
    process.execPath,
    [installedNextStepScript, '--command=/dk-build', '--verification=unverified'],
    {
      cwd: tempTarget,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    },
  );

  assert.equal(
    nextStepResult.status,
    0,
    `Installed next-step.mjs failed: ${nextStepResult.stderr || nextStepResult.stdout}`,
  );
  assert.match(nextStepResult.stdout, /## Suggested Next Step/);
  assert.match(nextStepResult.stdout, /\/dk-test/);

  const installedAutopilotScript = join(tempTarget, 'scripts', 'autopilot.mjs');
  const autopilotResult = spawnSync(
    process.execPath,
    [installedAutopilotScript, '--init', '--workspace-id=isolated-test-ws'],
    {
      cwd: tempTarget,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    },
  );

  assert.equal(
    autopilotResult.status,
    0,
    `Installed autopilot.mjs failed: ${autopilotResult.stderr || autopilotResult.stdout}`,
  );
  const autopilotJson = JSON.parse(autopilotResult.stdout);
  assert.equal(autopilotJson.success, true);
  assert.equal(autopilotJson.state.currentStage, 'UNDERSTAND');

  const repeatInstall = spawnSync(process.execPath, [INSTALLER_SCRIPT, '--all', '--force'], {
    cwd: tempTarget,
    encoding: 'utf8',
  });
  assert.equal(repeatInstall.status, 0, 'Repeated installation with --force must succeed');
});

test('project plugin installation is self-contained, version-aligned, and removes stale owned files', (t) => {
  const tempTarget = createTempDir('dk project plugin test ');
  t.after(() => rmSync(tempTarget, { recursive: true, force: true }));

  const first = spawnSync(process.execPath, [INSTALLER_SCRIPT, '--project'], {
    cwd: tempTarget,
    encoding: 'utf8',
  });
  assert.equal(first.status, 0, first.stderr || first.stdout);

  const pluginRoot = join(tempTarget, '.agents', 'plugins', 'development-kit');
  const requiredFiles = [
    'scripts/autopilot.mjs',
    'runtime/autopilot/state-store.mjs',
    'runtime/orchestration/development-contract.mjs',
    'schemas/development-contract.schema.json',
    'commands/dk-autopilot.md',
  ];
  for (const relativePath of requiredFiles) {
    assert.ok(existsSync(join(pluginRoot, relativePath)), `Project plugin missing ${relativePath}`);
  }

  const installedManifest = JSON.parse(readFileSync(join(pluginRoot, 'plugin.json'), 'utf8'));
  assert.equal(installedManifest.version, PACKAGE_VERSION);

  const staleFile = join(pluginRoot, 'commands', 'obsolete-command.md');
  writeFileSync(staleFile, '# obsolete\n', 'utf8');
  assert.ok(existsSync(staleFile));

  const second = spawnSync(process.execPath, [INSTALLER_SCRIPT, '--project', '--force'], {
    cwd: tempTarget,
    encoding: 'utf8',
  });
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(existsSync(staleFile), false, 'DK-owned stale plugin files must not survive reinstall');

  const installedAutopilot = join(pluginRoot, 'scripts', 'autopilot.mjs');
  const autopilotResult = spawnSync(
    process.execPath,
    [installedAutopilot, '--init', '--workspace-id=project-plugin-test-ws'],
    {
      cwd: tempTarget,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    },
  );
  assert.equal(autopilotResult.status, 0, autopilotResult.stderr || autopilotResult.stdout);
  assert.equal(JSON.parse(autopilotResult.stdout).success, true);
});

test('distribution package (npm pack) includes all runtime, schemas, skills, scripts, and plugins', (t) => {
  const packTempDir = createTempDir('dk npm pack out ');
  const extractTempDir = createTempDir('dk npm extract target with spaces ');
  t.after(() => {
    rmSync(packTempDir, { recursive: true, force: true });
    rmSync(extractTempDir, { recursive: true, force: true });
    assert.ok(!existsSync(packTempDir));
    assert.ok(!existsSync(extractTempDir));
  });

  const packOutput = execSync(`npm pack --pack-destination "${packTempDir}" --json`, {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  const packInfo = JSON.parse(packOutput);
  assert.ok(Array.isArray(packInfo) && packInfo.length > 0);
  const tarballFilename = packInfo[0].filename;
  assert.ok(tarballFilename);
  const tarballPath = join(packTempDir, tarballFilename);
  assert.ok(existsSync(tarballPath));

  const packedFiles = packInfo[0].files.map((f) => f.path);
  const requiredPatterns = [
    'runtime/autopilot/state-store.mjs',
    'runtime/autopilot/transition-model.mjs',
    'runtime/next-step/index.mjs',
    'runtime/next-step/resolver.mjs',
    'runtime/next-step/formatter.mjs',
    'runtime/orchestration/development-contract.mjs',
    'schemas/development-contract.schema.json',
    'scripts/autopilot.mjs',
    'scripts/next-step.mjs',
    '.agents/plugins/development-kit/plugin.json'
  ];

  for (const pattern of requiredPatterns) {
    const found = packedFiles.some((f) => f.includes(pattern) || f === pattern);
    assert.ok(found, `Tarball must contain required file pattern: ${pattern}`);
  }

  execSync(`tar -xzf "${tarballPath}" -C "${extractTempDir}"`, { encoding: 'utf8' });

  const extractedRoot = join(extractTempDir, 'package');
  assert.ok(existsSync(extractedRoot));

  const extractedNextStepScript = join(extractedRoot, 'scripts', 'next-step.mjs');
  const extractedAutopilotScript = join(extractedRoot, 'scripts', 'autopilot.mjs');

  const nextStepExec = spawnSync(process.execPath, [extractedNextStepScript, '--command=/dk-idea'], {
    cwd: extractedRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_PATH: '' }
  });
  assert.equal(nextStepExec.status, 0, `Next-step from tarball failed: ${nextStepExec.stderr}`);
  assert.match(nextStepExec.stdout, /## Suggested Next Step/);
  assert.match(nextStepExec.stdout, /\/dk-spec/);

  const autopilotExec = spawnSync(
    process.execPath,
    [extractedAutopilotScript, '--init', '--workspace-id=pack-test-ws'],
    {
      cwd: extractedRoot,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' }
    }
  );
  assert.equal(autopilotExec.status, 0, `Autopilot from tarball failed: ${autopilotExec.stderr}`);
  const autopilotData = JSON.parse(autopilotExec.stdout);
  assert.equal(autopilotData.success, true);
  assert.equal(autopilotData.state.currentStage, 'UNDERSTAND');
});

test('isolated execution fails cleanly when runtime is deliberately removed (no false pass)', (t) => {
  const tempTarget = createTempDir('dk negative test ');
  t.after(() => {
    rmSync(tempTarget, { recursive: true, force: true });
    assert.ok(!existsSync(tempTarget));
  });

  spawnSync(process.execPath, [INSTALLER_SCRIPT, '--all'], {
    cwd: tempTarget,
    encoding: 'utf8',
  });

  rmSync(join(tempTarget, 'runtime'), { recursive: true, force: true });

  const installedNextStepScript = join(tempTarget, 'scripts', 'next-step.mjs');
  const negativeResult = spawnSync(
    process.execPath,
    [installedNextStepScript, '--command=/dk-build'],
    {
      cwd: tempTarget,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    },
  );

  assert.notEqual(negativeResult.status, 0);
  assert.ok(
    negativeResult.stderr.includes('ERR_MODULE_NOT_FOUND') || negativeResult.stderr.includes('Cannot find module'),
    `Stderr must indicate module not found error: ${negativeResult.stderr}`
  );
  assert.ok(!negativeResult.stdout.includes('## Suggested Next Step'));
});
