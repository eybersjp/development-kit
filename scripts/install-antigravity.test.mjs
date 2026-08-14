import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');
const INSTALLER_SCRIPT = join(REPO_ROOT, 'scripts', 'install-antigravity.mjs');

function createTempDir(prefix = 'dk install test ') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('standalone installation (--all) includes runtime and executes without repository fallback', (t) => {
  const tempTarget = createTempDir('dk standalone test ');
  t.after(() => {
    rmSync(tempTarget, { recursive: true, force: true });
    assert.ok(!existsSync(tempTarget), 'Temporary directory must be cleaned up');
  });

  // 1. Run installer with --all inside the temp target directory
  const installResult = spawnSync(process.execPath, [INSTALLER_SCRIPT, '--all'], {
    cwd: tempTarget,
    encoding: 'utf8',
  });

  assert.equal(
    installResult.status,
    0,
    `Installer failed with exit status ${installResult.status}: ${installResult.stderr || installResult.stdout}`,
  );

  // 2. Verify all key directories and runtime exist in target
  const expectedDirs = [
    'agents',
    'skills',
    'commands',
    'hooks',
    'templates',
    'evals',
    'runtime',
    'scripts',
  ];

  for (const dir of expectedDirs) {
    const dirPath = join(tempTarget, dir);
    assert.ok(
      existsSync(dirPath),
      `Expected installed directory "${dir}" does not exist at ${dirPath}`,
    );
  }

  // 3. Verify runtime submodules exist specifically
  assert.ok(
    existsSync(join(tempTarget, 'runtime', 'autopilot', 'state-store.mjs')),
    'runtime/autopilot/state-store.mjs must exist in installed target',
  );
  assert.ok(
    existsSync(join(tempTarget, 'runtime', 'next-step', 'index.mjs')),
    'runtime/next-step/index.mjs must exist in installed target',
  );

  // 4. Execute Next-Step Guidance directly from the isolated installation
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
  assert.match(
    nextStepResult.stdout,
    /## Suggested Next Step/,
    'Installed next-step.mjs must output markdown guidance',
  );
  assert.match(
    nextStepResult.stdout,
    /\/dk-test/,
    'Installed next-step.mjs must recommend /dk-test after unverified build',
  );

  // 5. Execute Autopilot from the isolated installation
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
  assert.equal(autopilotJson.success, true, 'Installed autopilot init must succeed');
  assert.equal(
    autopilotJson.state.currentStage,
    'UNDERSTAND',
    'Installed autopilot must initialize to UNDERSTAND stage',
  );

  // 6. Verify repeated installation is safe and idempotent
  const repeatInstall = spawnSync(process.execPath, [INSTALLER_SCRIPT, '--all', '--force'], {
    cwd: tempTarget,
    encoding: 'utf8',
  });
  assert.equal(repeatInstall.status, 0, 'Repeated installation with --force must succeed');
});

test('distribution package (npm pack) includes all runtime, skills, scripts, and plugins', (t) => {
  const packTempDir = createTempDir('dk npm pack out ');
  const extractTempDir = createTempDir('dk npm extract target with spaces ');
  t.after(() => {
    rmSync(packTempDir, { recursive: true, force: true });
    rmSync(extractTempDir, { recursive: true, force: true });
    assert.ok(!existsSync(packTempDir), 'Pack temp directory cleaned up');
    assert.ok(!existsSync(extractTempDir), 'Extract temp directory cleaned up');
  });

  // 1. Run npm pack to create distribution tarball
  const packOutput = execSync(`npm pack --pack-destination "${packTempDir}" --json`, {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  const packInfo = JSON.parse(packOutput);
  assert.ok(Array.isArray(packInfo) && packInfo.length > 0, 'npm pack must return package info array');
  const tarballFilename = packInfo[0].filename;
  assert.ok(tarballFilename, 'Tarball filename must exist in pack info');
  const tarballPath = join(packTempDir, tarballFilename);
  assert.ok(existsSync(tarballPath), `Tarball file must exist at ${tarballPath}`);

  // 2. Inspect package files in tarball info
  const packedFiles = packInfo[0].files.map(f => f.path);
  const requiredPatterns = [
    'runtime/autopilot/state-store.mjs',
    'runtime/autopilot/transition-model.mjs',
    'runtime/next-step/index.mjs',
    'runtime/next-step/resolver.mjs',
    'runtime/next-step/formatter.mjs',
    'scripts/autopilot.mjs',
    'scripts/next-step.mjs',
    '.agents/plugins/development-kit/plugin.json'
  ];

  for (const pattern of requiredPatterns) {
    const found = packedFiles.some(f => f.includes(pattern) || f === pattern);
    assert.ok(found, `Tarball must contain required file pattern: ${pattern}`);
  }

  // 3. Extract tarball into extract directory with spaces
  execSync(`tar -xzf "${tarballPath}" -C "${extractTempDir}"`, {
    encoding: 'utf8'
  });

  const extractedRoot = join(extractTempDir, 'package');
  assert.ok(existsSync(extractedRoot), 'Extracted package directory must exist');

  // 4. Execute next-step and autopilot directly from extracted package
  const extractedNextStepScript = join(extractedRoot, 'scripts', 'next-step.mjs');
  const extractedAutopilotScript = join(extractedRoot, 'scripts', 'autopilot.mjs');

  const nextStepExec = spawnSync(
    process.execPath,
    [extractedNextStepScript, '--command=/dk-idea'],
    {
      cwd: extractedRoot,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' }
    }
  );
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
    assert.ok(!existsSync(tempTarget), 'Temporary directory must be cleaned up');
  });

  // Install --all
  spawnSync(process.execPath, [INSTALLER_SCRIPT, '--all'], {
    cwd: tempTarget,
    encoding: 'utf8',
  });

  // Deliberately delete runtime/ from installed target
  rmSync(join(tempTarget, 'runtime'), { recursive: true, force: true });

  // Running next-step from target must fail because runtime is missing
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

  assert.notEqual(
    negativeResult.status,
    0,
    'Script execution without runtime must fail rather than silently falling back to repo source',
  );
  assert.ok(
    negativeResult.stderr.includes('ERR_MODULE_NOT_FOUND') || negativeResult.stderr.includes('Cannot find module'),
    `Stderr must indicate module not found error: ${negativeResult.stderr}`
  );
  assert.ok(
    !negativeResult.stdout.includes('## Suggested Next Step'),
    'Stdout must NOT print Suggested Next Step when runtime failed'
  );
});
