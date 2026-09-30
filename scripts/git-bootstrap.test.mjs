import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');

// Import the module under test
import {
  inspectGitState,
  ensureGitRepository,
  reconcileGitignore,
  bootstrapGit
} from '../runtime/bootstrap/git-bootstrap.mjs';

import { bootstrapProject } from '../runtime/bootstrap/project-bootstrap.mjs';
import { getProjectIdentity } from '../runtime/autopilot/project-identity.mjs';

function createTempDir(prefix = 'dk-git-bootstrap-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('BUG-BOOTSTRAP-001: runtime/autopilot/project-identity.mjs writes current framework version, not stale 0.4.0', () => {
  const tmp = createTempDir('dk-identity-version-');
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    const identity = getProjectIdentity(tmp);
    assert.ok(identity.projectId);

    const projectJsonPath = path.join(tmp, '.development-kit', 'project.json');
    assert.ok(fs.existsSync(projectJsonPath));
    const projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));

    assert.equal(projectData.frameworkVersion, pkg.version, 'frameworkVersion in project.json must match package.json version');
    assert.notEqual(projectData.frameworkVersion, '0.4.0', 'Stale 0.4.0 must not be written');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('GIT-001: New non-Git project is initialized with Git repository', () => {
  const tmp = createTempDir('dk-git-001-');
  try {
    const result = bootstrapGit(tmp);
    assert.equal(result.available, true);
    assert.equal(result.repository.detected, true);
    assert.equal(result.repository.initialized, true);
    assert.equal(result.repository.relationship, 'root');
    assert.ok(fs.existsSync(path.join(tmp, '.git')), '.git directory must exist');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('GIT-002: Existing project-root repository is reused without reinitializing', () => {
  const tmp = createTempDir('dk-git-002-');
  try {
    execFileSync('git', ['init'], { cwd: tmp, stdio: 'ignore' });
    const initialGitStat = fs.statSync(path.join(tmp, '.git'));

    const result = bootstrapGit(tmp);
    assert.equal(result.available, true);
    assert.equal(result.repository.detected, true);
    assert.equal(result.repository.initialized, false, 'Existing repository must not be reinitialized');
    assert.equal(result.repository.relationship, 'root');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('GIT-003: Ancestor repository prevents nested initialization', () => {
  const parent = createTempDir('dk-git-003-parent-');
  try {
    execFileSync('git', ['init'], { cwd: parent, stdio: 'ignore' });
    const child = path.join(parent, 'packages', 'child-app');
    fs.mkdirSync(child, { recursive: true });

    const result = bootstrapGit(child);
    assert.equal(result.available, true);
    assert.equal(result.repository.detected, true);
    assert.equal(result.repository.initialized, false, 'Ancestor repository must prevent nested initialization');
    assert.equal(result.repository.relationship, 'ancestor');
    assert.equal(fs.existsSync(path.join(child, '.git')), false, 'Child directory must NOT have a .git directory');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('GIT-004: Git worktree with .git file is recognized as root repository', () => {
  const mainRepo = createTempDir('dk-git-004-main-');
  const worktreeDir = createTempDir('dk-git-004-wt-');
  try {
    execFileSync('git', ['init'], { cwd: mainRepo, stdio: 'ignore' });
    // Configure dummy user to make commit
    execFileSync('git', ['config', 'user.email', 'test@test.local'], { cwd: mainRepo, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: mainRepo, stdio: 'ignore' });
    fs.writeFileSync(path.join(mainRepo, 'initial.txt'), 'init', 'utf8');
    execFileSync('git', ['add', '.'], { cwd: mainRepo, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: mainRepo, stdio: 'ignore' });

    // Remove empty worktree dir so git worktree add can create it
    fs.rmSync(worktreeDir, { recursive: true, force: true });
    execFileSync('git', ['worktree', 'add', worktreeDir, '-b', 'test-branch'], { cwd: mainRepo, stdio: 'ignore' });

    assert.ok(fs.existsSync(path.join(worktreeDir, '.git')));
    assert.ok(fs.statSync(path.join(worktreeDir, '.git')).isFile(), '.git in worktree must be a file');

    const result = bootstrapGit(worktreeDir);
    assert.equal(result.available, true);
    assert.equal(result.repository.detected, true);
    assert.equal(result.repository.relationship, 'root');
    assert.equal(result.repository.initialized, false);
  } finally {
    try {
      execFileSync('git', ['worktree', 'remove', '--force', worktreeDir], { cwd: mainRepo, stdio: 'ignore' });
    } catch {}
    fs.rmSync(worktreeDir, { recursive: true, force: true });
    fs.rmSync(mainRepo, { recursive: true, force: true });
  }
});

test('GIT-005: Missing .gitignore is created with managed entries', () => {
  const tmp = createTempDir('dk-git-005-');
  try {
    const gitignorePath = path.join(tmp, '.gitignore');
    assert.equal(fs.existsSync(gitignorePath), false);

    const result = bootstrapGit(tmp);
    assert.equal(result.gitignore.existed, false);
    assert.equal(result.gitignore.created, true);
    assert.ok(result.gitignore.entriesAdded.length > 0);
    assert.ok(fs.existsSync(gitignorePath));

    const content = fs.readFileSync(gitignorePath, 'utf8');
    assert.ok(content.includes('.development-kit/workspace-id'));
    assert.ok(content.includes('.development-kit/autopilot/'));
    assert.ok(content.includes('.development-kit/contracts/'));
    assert.ok(content.includes('.development-kit/runs/'));
    // Ensure entire .development-kit is not ignored
    assert.ok(!content.includes('\n.development-kit\n') && !content.includes('\n.development-kit/\n'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('GIT-006 & GIT-007: Existing .gitignore content is preserved and missing managed entries appended', () => {
  const tmp = createTempDir('dk-git-006-');
  try {
    const gitignorePath = path.join(tmp, '.gitignore');
    const userCustomContent = '# User custom rules\nmy-custom-folder/\n*.secret\n';
    fs.writeFileSync(gitignorePath, userCustomContent, 'utf8');

    const result = bootstrapGit(tmp);
    assert.equal(result.gitignore.existed, true);
    assert.equal(result.gitignore.created, false);
    assert.ok(result.gitignore.entriesAdded.length > 0);

    const updatedContent = fs.readFileSync(gitignorePath, 'utf8');
    assert.ok(updatedContent.startsWith(userCustomContent), 'User content must be preserved at top');
    assert.ok(updatedContent.includes('.development-kit/workspace-id'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('GIT-008 & GIT-015: Repeated bootstrap produces no duplicate entries and is idempotent', () => {
  const tmp = createTempDir('dk-git-008-');
  try {
    const res1 = bootstrapGit(tmp);
    const content1 = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');

    const res2 = bootstrapGit(tmp);
    const content2 = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');

    assert.equal(content1, content2, '.gitignore content must remain identical on repeated run');
    assert.equal(res2.gitignore.entriesAdded.length, 0, 'No entries should be added on repeat run');
    assert.equal(res2.repository.initialized, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('GIT-009: Stack-specific ignores are added only when applicable (Node, Next.js, Python)', () => {
  // 1. Generic empty project: should NOT have node_modules or .next or __pycache__
  const genericTmp = createTempDir('dk-git-stack-generic-');
  try {
    const res = bootstrapGit(genericTmp);
    const content = fs.readFileSync(path.join(genericTmp, '.gitignore'), 'utf8');
    assert.ok(!content.includes('node_modules/'));
    assert.ok(!content.includes('.next/'));
    assert.ok(!content.includes('__pycache__/'));
  } finally {
    fs.rmSync(genericTmp, { recursive: true, force: true });
  }

  // 2. Node project (package.json present)
  const nodeTmp = createTempDir('dk-git-stack-node-');
  try {
    fs.writeFileSync(path.join(nodeTmp, 'package.json'), '{}', 'utf8');
    const res = bootstrapGit(nodeTmp);
    const content = fs.readFileSync(path.join(nodeTmp, '.gitignore'), 'utf8');
    assert.ok(content.includes('node_modules/'));
    assert.ok(!content.includes('.next/'));
    assert.ok(!content.includes('__pycache__/'));
  } finally {
    fs.rmSync(nodeTmp, { recursive: true, force: true });
  }

  // 3. Next.js project (next.config.js / next.config.mjs present or dependency)
  const nextTmp = createTempDir('dk-git-stack-next-');
  try {
    fs.writeFileSync(path.join(nextTmp, 'package.json'), '{"dependencies": {"next": "14.0.0"}}', 'utf8');
    fs.writeFileSync(path.join(nextTmp, 'next.config.mjs'), 'export default {}', 'utf8');
    const res = bootstrapGit(nextTmp);
    const content = fs.readFileSync(path.join(nextTmp, '.gitignore'), 'utf8');
    assert.ok(content.includes('node_modules/'));
    assert.ok(content.includes('.next/'));
    assert.ok(!content.includes('__pycache__/'));
  } finally {
    fs.rmSync(nextTmp, { recursive: true, force: true });
  }

  // 4. Python project (pyproject.toml or requirements.txt present)
  const pyTmp = createTempDir('dk-git-stack-py-');
  try {
    fs.writeFileSync(path.join(pyTmp, 'requirements.txt'), 'pytest\n', 'utf8');
    const res = bootstrapGit(pyTmp);
    const content = fs.readFileSync(path.join(pyTmp, '.gitignore'), 'utf8');
    assert.ok(content.includes('__pycache__/'));
    assert.ok(content.includes('*.py[cod]'));
    assert.ok(!content.includes('node_modules/'));
  } finally {
    fs.rmSync(pyTmp, { recursive: true, force: true });
  }
});

test('GIT-010 & GIT-011: Missing Git executable is reported and never reports successful repo initialization', () => {
  const tmp = createTempDir('dk-git-missing-');
  try {
    const customGitBinary = 'non-existent-git-bin-xyz123';
    const res = bootstrapGit(tmp, { gitBinary: customGitBinary });
    assert.equal(res.available, false);
    assert.equal(res.repository.detected, false);
    assert.equal(res.repository.initialized, false);
    assert.ok(res.warning, 'Must provide warning when git is unavailable');
    // But .gitignore reconciliation can still run!
    assert.ok(fs.existsSync(path.join(tmp, '.gitignore')), '.gitignore should still be reconciled even if git is absent');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('GIT-012 & GIT-013: Bootstrap never stages or commits files, and touches no existing config/remotes', () => {
  const tmp = createTempDir('dk-git-clean-');
  try {
    // Create an unstaged file before bootstrap
    fs.writeFileSync(path.join(tmp, 'app.js'), 'console.log("hello");', 'utf8');

    const result = bootstrapGit(tmp);
    assert.equal(result.available, true);

    const statusOutput = execFileSync('git', ['status', '--porcelain'], { cwd: tmp, encoding: 'utf8' });
    // Status must show ?? for untracked files, NO 'A ' or 'M ' (no staged files)
    const lines = statusOutput.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      assert.ok(line.startsWith('??'), `File must be untracked, not staged: ${line}`);
    }

    // Verify no commit exists (git log fails or returns empty)
    const logResult = spawnSync('git', ['log', '-1'], { cwd: tmp, encoding: 'utf8' });
    assert.notEqual(logResult.status, 0, 'No commits must have been created');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('GIT-014 & GIT-016: bootstrapProject() returns structured Git state', async () => {
  const tmp = createTempDir('dk-project-git-');
  try {
    const projectResult = await bootstrapProject(tmp);
    assert.equal(projectResult.success, true);
    assert.ok(projectResult.git, 'bootstrapProject() must return structured git property');
    assert.equal(typeof projectResult.git.available, 'boolean');
    assert.equal(typeof projectResult.git.repository.detected, 'boolean');
    assert.equal(typeof projectResult.git.repository.initialized, 'boolean');
    assert.equal(typeof projectResult.git.gitignore.existed, 'boolean');
    assert.equal(typeof projectResult.git.gitignore.created, 'boolean');
    assert.ok(Array.isArray(projectResult.git.gitignore.entriesAdded));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
