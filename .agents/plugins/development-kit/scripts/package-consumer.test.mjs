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

    function parseTokens(cmd) {
      const tokens = [];
      let current = '';
      let inQuotes = false;
      let quoteChar = '';
      for (let i = 0; i < cmd.length; i++) {
        const c = cmd[i];
        if (inQuotes) {
          if (c === quoteChar) {
            inQuotes = false;
          } else {
            current += c;
          }
        } else {
          if (c === '"' || c === "'") {
            inQuotes = true;
            quoteChar = c;
          } else if (/\s/.test(c)) {
            if (current.length > 0) {
              tokens.push(current);
              current = '';
            }
          } else {
            current += c;
          }
        }
      }
      if (current.length > 0) tokens.push(current);
      return tokens;
    }

    const parts = parseTokens(literalCmd);
    assert.equal(parts[0], 'node');
    const scriptPath = parts[1];
    const scriptArgs = parts.slice(2);

    // 6. Execute literal lifecycle command from consumer root
    const execLife = spawnSync(process.execPath, [
      scriptPath,
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
      scriptPath,
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

    // 8. Execute supersession for candidate via installed runner
    const execSupReq = spawnSync(process.execPath, [
      scriptPath,
      'orchestration.mjs',
      '--operation=idea-supersede-candidate',
      '--input-json=' + JSON.stringify({
        oldId: 'IDEA-REQ-001',
        newCandidate: {
          id: 'IDEA-REQ-002',
          statement: 'Updated packaged distribution requirement candidate',
          origin: 'USER_STATED',
          confirmedBy: 'PRODUCT_OWNER',
        },
      }),
    ], {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(execSupReq.status, 0, execSupReq.stderr || execSupReq.stdout);
    const supReqParsed = JSON.parse(execSupReq.stdout);
    assert.equal(supReqParsed.success, true);
    assert.equal(supReqParsed.result.created.id, 'IDEA-REQ-002');
    assert.equal(supReqParsed.result.created.resolutionState, 'UNRESOLVED');

    // 9. Execute record and supersede for question via installed runner
    const execQ = spawnSync(process.execPath, [
      scriptPath,
      'orchestration.mjs',
      '--operation=idea-record-question',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-Q-001',
        question: 'Initial packaged test question?',
        materiality: 'MATERIAL',
      }),
    ], {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(execQ.status, 0, execQ.stderr || execQ.stdout);

    const execSupQ = spawnSync(process.execPath, [
      scriptPath,
      'orchestration.mjs',
      '--operation=idea-supersede-question',
      '--input-json=' + JSON.stringify({
        oldId: 'IDEA-Q-001',
        newQuestion: {
          id: 'IDEA-Q-002',
          question: 'Updated packaged test question?',
          materiality: 'MATERIAL',
          confirmedBy: 'PRODUCT_OWNER',
        },
      }),
    ], {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(execSupQ.status, 0, execSupQ.stderr || execSupQ.stdout);
    const supQParsed = JSON.parse(execSupQ.stdout);
    assert.equal(supQParsed.success, true);
    assert.equal(supQParsed.result.created.id, 'IDEA-Q-002');
    assert.equal(supQParsed.result.created.resolution, 'UNRESOLVED');

    // 10. Prove project state persists with correct lineage
    const discPath = path.join(consumerDir, '.development-kit', 'idea', 'discovery.json');
    assert.ok(fs.existsSync(discPath), 'discovery.json must persist in consumer project');
    const discData = JSON.parse(fs.readFileSync(discPath, 'utf8'));
    assert.equal(discData.requirements.length, 2);
    assert.equal(discData.requirements[0].resolutionState, 'SUPERSEDED');
    assert.equal(discData.requirements[0].supersededBy, 'IDEA-REQ-002');
    assert.equal(discData.requirements[1].id, 'IDEA-REQ-002');
    assert.equal(discData.requirements[1].supersedes, 'IDEA-REQ-001');
    assert.equal(discData.openQuestions.length, 2);
    assert.equal(discData.openQuestions[0].resolution, 'SUPERSEDED');
    assert.equal(discData.openQuestions[0].supersededBy, 'IDEA-Q-002');
    assert.equal(discData.openQuestions[1].id, 'IDEA-Q-002');
    assert.equal(discData.openQuestions[1].supersedes, 'IDEA-Q-001');
  } finally {
    try { fs.rmSync(packDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(consumerDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Package Consumer: Candidate 14 Project-Root Affinity (execution from .agents creates .development-kit only at project root)', () => {
  const packDir = createTempDir();
  const consumerDir = createTempDir();
  try {
    // 1. Pack tarball
    const rootPath = path.resolve('.');
    const packRes = execSync(`npm pack "${rootPath}"`, { cwd: packDir, encoding: 'utf8' }).trim();
    const tarballName = packRes.split('\n').pop().trim();
    const tarballPath = path.join(packDir, tarballName);
    execSync(`tar -xzf "${tarballPath}"`, { cwd: packDir });

    const extractedPkgDir = path.join(packDir, 'package');
    const installerInPkg = path.join(extractedPkgDir, 'scripts', 'install-antigravity.mjs');

    // 2. Install --project into consumerDir
    const installRun = spawnSync(process.execPath, [installerInPkg, '--project'], {
      cwd: consumerDir,
      encoding: 'utf8',
    });
    assert.equal(installRun.status, 0, installRun.stderr || installRun.stdout);

    const agentsDir = path.join(consumerDir, '.agents');
    const pluginScriptsDir = path.join(agentsDir, 'plugins', 'development-kit', 'scripts');
    const runScriptPath = path.join(pluginScriptsDir, 'run.mjs');
    const lifecycleScriptPath = path.join(pluginScriptsDir, 'lifecycle.mjs');
    const orchScriptPath = path.join(pluginScriptsDir, 'orchestration.mjs');

    // 3. Execution from cwd = consumerDir/.agents via runner
    const execFromAgents = spawnSync(process.execPath, [
      runScriptPath,
      'lifecycle.mjs',
      '--command=dk-idea',
      '--phase=entry',
    ], {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(execFromAgents.status, 0, execFromAgents.stderr || execFromAgents.stdout);

    // 4. Assert .development-kit ONLY exists at project root, NOT in .agents
    assert.ok(fs.existsSync(path.join(consumerDir, '.development-kit')), 'Canonical project root .development-kit must exist');
    assert.ok(!fs.existsSync(path.join(agentsDir, '.development-kit')), 'Mislocated .agents/.development-kit must NOT exist');

    // 5. Direct invocation bypass of lifecycle.mjs from cwd = .agents
    const directLifecycle = spawnSync(process.execPath, [
      lifecycleScriptPath,
      '--command=dk-idea',
      '--phase=entry',
    ], {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(directLifecycle.status, 0, directLifecycle.stderr || directLifecycle.stdout);
    assert.ok(!fs.existsSync(path.join(agentsDir, '.development-kit')), 'Direct lifecycle must never create .agents/.development-kit');

    // 6. Direct invocation bypass of orchestration.mjs from cwd = .agents
    const directOrch = spawnSync(process.execPath, [
      orchScriptPath,
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-001',
        statement: 'Direct orchestration invoked from .agents directory',
        origin: 'USER_STATED',
      }),
    ], {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(directOrch.status, 0, directOrch.stderr || directOrch.stdout);
    assert.ok(!fs.existsSync(path.join(agentsDir, '.development-kit')), 'Direct orchestration must never create .agents/.development-kit');

    // 7. Verify discovery state is saved to canonical project root
    const discPath = path.join(consumerDir, '.development-kit', 'idea', 'discovery.json');
    assert.ok(fs.existsSync(discPath), 'discovery.json must exist in canonical project root');
    const discData = JSON.parse(fs.readFileSync(discPath, 'utf8'));
    assert.equal(discData.requirements.length, 1);
    assert.equal(discData.requirements[0].id, 'IDEA-REQ-001');

    // 8. Test mislocated state detection (fail closed)
    const mislocatedDkDir = path.join(agentsDir, '.development-kit');
    fs.mkdirSync(mislocatedDkDir, { recursive: true });
    fs.writeFileSync(path.join(mislocatedDkDir, 'project.json'), JSON.stringify({ projectId: 'fake' }));

    const failClosedRun = spawnSync(process.execPath, [
      runScriptPath,
      'lifecycle.mjs',
      '--command=dk-idea',
      '--phase=entry',
    ], {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(failClosedRun.status, 1, 'Must fail closed when mislocated .agents/.development-kit exists');
  } finally {
    try { fs.rmSync(packDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(consumerDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Package Consumer: Candidate 15 Path with Spaces & Root Affinity Proof', () => {
  const packDir = createTempDir();
  const tempBase = createTempDir();
  const consumerDir = path.join(tempBase, 'DK Candidate 15 Space Test');
  fs.mkdirSync(consumerDir, { recursive: true });

  try {
    // 1. Pack tarball
    const rootPath = path.resolve('.');
    const packRes = execSync(`npm pack "${rootPath}"`, { cwd: packDir, encoding: 'utf8' }).trim();
    const tarballName = packRes.split('\n').pop().trim();
    const tarballPath = path.join(packDir, tarballName);
    execSync(`tar -xzf "${tarballPath}"`, { cwd: packDir });

    const extractedPkgDir = path.join(packDir, 'package');
    const installerInPkg = path.join(extractedPkgDir, 'scripts', 'install-antigravity.mjs');

    // 2. Install --project into consumerDir with spaces in path
    const installRun = spawnSync(process.execPath, [installerInPkg, '--project'], {
      cwd: consumerDir,
      encoding: 'utf8',
    });
    assert.equal(installRun.status, 0, installRun.stderr || installRun.stdout);

    const agentsDir = path.join(consumerDir, '.agents');
    const pluginScriptsDir = path.join(agentsDir, 'plugins', 'development-kit', 'scripts');
    const runScriptPath = path.join(pluginScriptsDir, 'run.mjs');
    const lifecycleScriptPath = path.join(pluginScriptsDir, 'lifecycle.mjs');
    const orchScriptPath = path.join(pluginScriptsDir, 'orchestration.mjs');

    // 3. Execute entry from project root
    const rootEntry = spawnSync(process.execPath, [
      runScriptPath,
      'lifecycle.mjs',
      '--command=dk-idea',
      '--phase=entry',
    ], {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(rootEntry.status, 0, rootEntry.stderr || rootEntry.stdout);
    const rootEntryData = JSON.parse(rootEntry.stdout);
    assert.equal(rootEntryData.success, true);
    assert.ok(rootEntryData.identity?.projectId, 'Must have projectId');

    // 4. Record candidate from project root
    const rootRecord = spawnSync(process.execPath, [
      runScriptPath,
      'orchestration.mjs',
      '--operation=idea-record-candidate',
      '--input-json=' + JSON.stringify({
        id: 'IDEA-REQ-001',
        statement: 'Candidate recorded from project root with spaces',
        origin: 'USER_STATED',
      }),
    ], {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(rootRecord.status, 0, rootRecord.stderr || rootRecord.stdout);

    // Read discovery state after root invocation
    const discPath = path.join(consumerDir, '.development-kit', 'idea', 'discovery.json');
    const discAfterRoot = JSON.parse(fs.readFileSync(discPath, 'utf8'));

    // 5. Execute entry from .agents directory
    const agentsEntry = spawnSync(process.execPath, [
      runScriptPath,
      'lifecycle.mjs',
      '--command=dk-idea',
      '--phase=entry',
    ], {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(agentsEntry.status, 0, agentsEntry.stderr || agentsEntry.stdout);
    const agentsEntryData = JSON.parse(agentsEntry.stdout);

    // 6. Direct invocation of lifecycle.mjs from .agents
    const directLife = spawnSync(process.execPath, [
      lifecycleScriptPath,
      '--command=dk-idea',
      '--phase=entry',
    ], {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(directLife.status, 0, directLife.stderr || directLife.stdout);
    const directLifeData = JSON.parse(directLife.stdout);

    // 7. Direct invocation of orchestration.mjs from .agents to query state
    const directState = spawnSync(process.execPath, [
      orchScriptPath,
      '--operation=idea-state',
    ], {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(directState.status, 0, directState.stderr || directState.stdout);

    // 8. Assert root and .agents invocations resolve the exact SAME:
    // - projectId
    // - workspace identity
    // - discovery revision
    // - discovery fingerprint
    assert.equal(agentsEntryData.identity.projectId, rootEntryData.identity.projectId, 'projectId must match between root and .agents');
    assert.equal(directLifeData.identity.projectId, rootEntryData.identity.projectId, 'projectId must match for direct lifecycle');

    const projectFile = path.join(consumerDir, '.development-kit', 'project.json');
    const wsFile = path.join(consumerDir, '.development-kit', 'workspace-id');
    const projectIdentity = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
    const wsIdentity = fs.readFileSync(wsFile, 'utf8').trim();

    assert.equal(rootEntryData.identity.projectId, projectIdentity.projectId);
    assert.ok(wsIdentity.length > 0, 'Workspace identity must be non-empty');

    const discAfterAgents = JSON.parse(fs.readFileSync(discPath, 'utf8'));
    assert.equal(discAfterAgents.revision, discAfterRoot.revision, 'Discovery revision must match');
    assert.equal(discAfterAgents.fingerprint, discAfterRoot.fingerprint, 'Discovery fingerprint must match');

    // 9. Assert exactly ONE .development-kit directory exists at project root, and ZERO nested ones
    assert.ok(fs.existsSync(path.join(consumerDir, '.development-kit')), 'Root .development-kit must exist');
    assert.ok(!fs.existsSync(path.join(consumerDir, '.agents', '.development-kit')), 'Nested .agents/.development-kit must not exist');
    assert.ok(!fs.existsSync(path.join(consumerDir, '.agents', 'plugins', 'development-kit', '.development-kit')), 'Nested plugin .development-kit must not exist');
  } finally {
    try { fs.rmSync(packDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(tempBase, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Package Consumer: Candidate 16 Installed Markdown Command Launcher Execution (Standard & Path with Spaces)', () => {
  function parseCommandLine(cmdStr) {
    const tokens = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < cmdStr.length; i++) {
      const c = cmdStr[i];
      if (inQuotes) {
        if (c === quoteChar) {
          inQuotes = false;
        } else {
          current += c;
        }
      } else {
        if (c === '"' || c === "'") {
          inQuotes = true;
          quoteChar = c;
        } else if (/\s/.test(c)) {
          if (current.length > 0) {
            tokens.push(current);
            current = '';
          }
        } else {
          current += c;
        }
      }
    }
    if (current.length > 0) {
      tokens.push(current);
    }
    return tokens;
  }

  function extractLifecycleCommand(markdownPath) {
    assert.ok(fs.existsSync(markdownPath), `Markdown file must exist at ${markdownPath}`);
    const content = fs.readFileSync(markdownPath, 'utf8');
    const match = content.match(/```(?:bash|sh)?\r?\n(node\s+[^\r\n]+)\r?\n```/);
    assert.ok(match && match[1], `Failed to extract lifecycle command from ${markdownPath}`);
    return match[1].trim();
  }

  const packDir = createTempDir();
  const tempBase = createTempDir();
  const consumerDir = path.join(tempBase, 'DK Candidate 16 Installed Command Test');
  fs.mkdirSync(consumerDir, { recursive: true });

  try {
    // 1. Pack distribution package
    const rootPath = path.resolve('.');
    const packRes = execSync(`npm pack "${rootPath}"`, { cwd: packDir, encoding: 'utf8' }).trim();
    const tarballName = packRes.split('\n').pop().trim();
    const tarballPath = path.join(packDir, tarballName);
    execSync(`tar -xzf "${tarballPath}"`, { cwd: packDir });

    const extractedPkgDir = path.join(packDir, 'package');
    const installerInPkg = path.join(extractedPkgDir, 'scripts', 'install-antigravity.mjs');

    // 2. Install --project into consumerDir containing spaces in path
    const installRun = spawnSync(process.execPath, [installerInPkg, '--project'], {
      cwd: consumerDir,
      encoding: 'utf8',
    });
    assert.equal(installRun.status, 0, installRun.stderr || installRun.stdout);

    const agentsDir = path.join(consumerDir, '.agents');
    const pluginCmdsDir = path.join(agentsDir, 'plugins', 'development-kit', 'commands');

    // 3. Extract commands directly from installed markdown artifacts
    const ideaCmdPath = path.join(pluginCmdsDir, 'dk-idea.md');
    const statusCmdPath = path.join(pluginCmdsDir, 'dk-status.md');
    const specCmdPath = path.join(pluginCmdsDir, 'dk-spec.md');

    const ideaCmdStr = extractLifecycleCommand(ideaCmdPath);
    const statusCmdStr = extractLifecycleCommand(statusCmdPath);
    const specCmdStr = extractLifecycleCommand(specCmdPath);

    // Verify commands do not contain relative run.mjs or relative scripts/
    assert.equal(ideaCmdStr.includes('node .agents/plugins/development-kit/scripts/run.mjs'), false);
    assert.equal(ideaCmdStr.includes('node scripts/lifecycle.mjs'), false);

    const ideaTokens = parseCommandLine(ideaCmdStr);
    const statusTokens = parseCommandLine(statusCmdStr);
    const specTokens = parseCommandLine(specCmdStr);

    assert.equal(ideaTokens[0], 'node');
    assert.equal(statusTokens[0], 'node');
    assert.equal(specTokens[0], 'node');

    // 4. Execute /dk-idea literal installed command from project root
    const rootIdeaRun = spawnSync(ideaTokens[0], ideaTokens.slice(1), {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(rootIdeaRun.status, 0, rootIdeaRun.stderr || rootIdeaRun.stdout);
    const rootIdeaData = JSON.parse(rootIdeaRun.stdout);
    assert.equal(rootIdeaData.success, true);
    assert.ok(rootIdeaData.identity?.projectId);

    // Assert project root has .development-kit and .agents does NOT
    assert.ok(fs.existsSync(path.join(consumerDir, '.development-kit')));
    assert.ok(!fs.existsSync(path.join(consumerDir, '.agents', '.development-kit')));

    // 5. Execute identical /dk-idea literal installed command from .agents
    const agentsIdeaRun = spawnSync(ideaTokens[0], ideaTokens.slice(1), {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(agentsIdeaRun.status, 0, agentsIdeaRun.stderr || agentsIdeaRun.stdout);
    const agentsIdeaData = JSON.parse(agentsIdeaRun.stdout);
    assert.equal(agentsIdeaData.success, true);
    assert.equal(agentsIdeaData.identity.projectId, rootIdeaData.identity.projectId);
    assert.ok(!fs.existsSync(path.join(consumerDir, '.agents', '.development-kit')));

    // 6. Execute /dk-status literal installed command from .agents
    const agentsStatusRun = spawnSync(statusTokens[0], statusTokens.slice(1), {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(agentsStatusRun.status, 0, agentsStatusRun.stderr || agentsStatusRun.stdout);
    const agentsStatusData = JSON.parse(agentsStatusRun.stdout);
    assert.equal(agentsStatusData.success, true);
    assert.equal(agentsStatusData.identity.projectId, rootIdeaData.identity.projectId);

    // 7. Execute /dk-status literal installed command from project root
    const rootStatusRun = spawnSync(statusTokens[0], statusTokens.slice(1), {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(rootStatusRun.status, 0, rootStatusRun.stderr || rootStatusRun.stdout);
    const rootStatusData = JSON.parse(rootStatusRun.stdout);
    assert.equal(rootStatusData.success, true);
    assert.equal(rootStatusData.identity.projectId, rootIdeaData.identity.projectId);

    // 8. Execute /dk-spec literal installed command from .agents
    const agentsSpecRun = spawnSync(specTokens[0], specTokens.slice(1), {
      cwd: agentsDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(agentsSpecRun.status, 0, agentsSpecRun.stderr || agentsSpecRun.stdout);
    const agentsSpecData = JSON.parse(agentsSpecRun.stdout);
    assert.equal(agentsSpecData.success, true);
    assert.equal(agentsSpecData.identity.projectId, rootIdeaData.identity.projectId);

    // 9. Execute /dk-spec literal installed command from project root
    const rootSpecRun = spawnSync(specTokens[0], specTokens.slice(1), {
      cwd: consumerDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(rootSpecRun.status, 0, rootSpecRun.stderr || rootSpecRun.stdout);
    const rootSpecData = JSON.parse(rootSpecRun.stdout);
    assert.equal(rootSpecData.success, true);
    assert.equal(rootSpecData.identity.projectId, rootIdeaData.identity.projectId);

    // 10. Assert state integrity: exactly 1 .development-kit directory exists at root
    assert.ok(fs.existsSync(path.join(consumerDir, '.development-kit')));
    assert.ok(!fs.existsSync(path.join(consumerDir, '.agents', '.development-kit')));
    assert.ok(!fs.existsSync(path.join(consumerDir, '.agents', 'plugins', 'development-kit', '.development-kit')));
  } finally {
    try { fs.rmSync(packDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(tempBase, { recursive: true, force: true }); } catch (_) {}
  }
});


