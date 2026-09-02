import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dk-pkg-consumer-'));
}

test('Package Consumer: npm pack produces valid tarball with all runtime assets and schemas', () => {
  const tempDir = createTempDir();
  const packOutput = execSync('npm pack --dry-run --json', { encoding: 'utf8' });
  const [packInfo] = JSON.parse(packOutput);

  assert.equal(packInfo.name, 'development-kit');
  assert.equal(packInfo.version, '0.9.0');

  const filenames = packInfo.files.map((f) => f.path);
  assert.ok(filenames.some((f) => f.includes('runtime/orchestration/execution-broker.mjs')), 'Must include execution-broker.mjs');
  assert.ok(filenames.some((f) => f.includes('schemas/development-contract.schema.json')), 'Must include development-contract schema');
  assert.ok(filenames.some((f) => f.includes('scripts/install-antigravity.mjs')), 'Must include installer script');
});

test('Package Consumer: install-antigravity installs cleanly and idempotently', () => {
  const tempTarget = createTempDir();
  try {
    const installResult = spawnSync(process.execPath, [path.resolve('scripts/install-antigravity.mjs'), '--project'], {
      cwd: tempTarget,
      encoding: 'utf8',
    });

    assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);
    assert.ok(fs.existsSync(path.join(tempTarget, '.agents', 'plugins', 'development-kit', 'plugin.json')), 'Installs project plugin');
    assert.ok(fs.existsSync(path.join(tempTarget, '.agents', 'AGENTS.md')), 'Installs .agents/AGENTS.md');
  } finally {
    try { fs.rmSync(tempTarget, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Package Consumer: Real distribution npm pack tarball extracts, installs --project, and executes literal commands', () => {
  const packDir = createTempDir();
  const consumerDir = createTempDir();
  try {
    // 1. Run actual npm pack pointing to repository root to create a physical tarball in packDir
    const rootPath = path.resolve('.');
    const packRes = execSync(`npm pack "${rootPath}"`, { cwd: packDir, encoding: 'utf8' }).trim();
    const tarballName = packRes.split('\n').pop().trim();
    const tarballPath = path.join(packDir, tarballName);
    assert.ok(fs.existsSync(tarballPath), `Tarball must exist at ${tarballPath}`);

    // 2. Extract tarball in packDir
    execSync(`tar -xzf "${tarballPath}"`, { cwd: packDir });
    const extractedPkgDir = path.join(packDir, 'package');
    const installerInPkg = path.join(extractedPkgDir, 'scripts', 'install-antigravity.mjs');
    assert.ok(fs.existsSync(installerInPkg), 'Installer script must exist in packaged tarball');

    // 3. Run packaged installer with --project into consumerDir
    const installRun = spawnSync(process.execPath, [installerInPkg, '--project'], {
      cwd: consumerDir,
      encoding: 'utf8',
    });
    assert.equal(installRun.status, 0, installRun.stderr || installRun.stdout);

    // 4. Read installed dk-idea.md from consumer project
    const installedCmd = path.join(consumerDir, '.agents', 'plugins', 'development-kit', 'commands', 'dk-idea.md');
    assert.ok(fs.existsSync(installedCmd), 'installed dk-idea.md must exist in consumer project');
    const cmdContent = fs.readFileSync(installedCmd, 'utf8');

    // 5. Extract literal lifecycle command
    const match = cmdContent.match(/```bash\r?\n(node\s+[^\r\n]+)\r?\n```/);
    assert.ok(match, 'Must find literal node execution in dk-idea.md');
    const literalCmd = match[1].trim();
    const parts = literalCmd.split(/\s+/);
    assert.equal(parts[0], 'node');
    const scriptRelative = parts[1];
    const scriptArgs = parts.slice(2);

    // 6. Execute literal lifecycle command from consumer root
    const execLife = spawnSync(process.execPath, [
      path.join(consumerDir, scriptRelative),
      ...scriptArgs,
    ], {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(execLife.status, 0, execLife.stderr || execLife.stdout);
    const lifeParsed = JSON.parse(execLife.stdout);
    assert.equal(lifeParsed.success, true);
    assert.equal(lifeParsed.bootstrapped, true);

    // 7. Execute literal orchestration command via installed runner
    const execOrch = spawnSync(process.execPath, [
      path.join(consumerDir, scriptRelative),
      'orchestration.mjs',
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-001',
        statement: 'Test packaged distribution requirement candidate',
        origin: 'USER_STATED',
      }),
    ], {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(execOrch.status, 0, execOrch.stderr || execOrch.stdout);
    const orchParsed = JSON.parse(execOrch.stdout);
    assert.equal(orchParsed.success, true);
    assert.equal(orchParsed.result.id, 'IDEA-REQ-001');

    // 8. Prove project state persists
    const discPath = path.join(consumerDir, '.development-kit', 'idea', 'discovery.json');
    assert.ok(fs.existsSync(discPath), 'discovery.json must persist in consumer project');
    const discData = JSON.parse(fs.readFileSync(discPath, 'utf8'));
    assert.equal(discData.requirements.length, 1);
    assert.equal(discData.requirements[0].id, 'IDEA-REQ-001');
  } finally {
    try { fs.rmSync(packDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(consumerDir, { recursive: true, force: true }); } catch (_) {}
  }
});
