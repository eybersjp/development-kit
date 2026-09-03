import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

test('DKF Design Authority Contract & Integration Tests', async (t) => {
  await t.test('1. commands/dk-design-system.md exists and documents all 6 sub-modes', () => {
    const cmdPath = join(ROOT, 'commands', 'dk-design-system.md');
    assert.ok(existsSync(cmdPath), 'dk-design-system.md must exist');
    const content = readFileSync(cmdPath, 'utf-8');
    assert.match(content, /create/i);
    assert.match(content, /reference/i);
    assert.match(content, /existing/i);
    assert.match(content, /inspect/i);
    assert.match(content, /verify/i);
    assert.match(content, /amend/i);
    assert.match(content, /design\.md/i);
  });

  await t.test('2. skills/design-authority/SKILL.md defines governance, 7-level conflict priority, and amendment flow', () => {
    const skillPath = join(ROOT, 'skills', 'design-authority', 'SKILL.md');
    assert.ok(existsSync(skillPath), 'skills/design-authority/SKILL.md must exist');
    const content = readFileSync(skillPath, 'utf-8');
    assert.match(content, /Explicit current user instruction/i);
    assert.match(content, /Approved Design System Amendment/i);
    assert.match(content, /Current approved `?design\.md`?/i);
    assert.match(content, /DESIGN SYSTEM AMENDMENT PROPOSAL/);
    assert.match(content, /Same Design Team Test/);
  });

  await t.test('3. templates/design-system-reference-analysis.md contains all 31 numbered sections and evidence classification', () => {
    const tplPath = join(ROOT, 'templates', 'design-system-reference-analysis.md');
    assert.ok(existsSync(tplPath), 'templates/design-system-reference-analysis.md must exist');
    const content = readFileSync(tplPath, 'utf-8');
    for (let i = 1; i <= 31; i++) {
      assert.ok(content.includes(`## ${i}. `), `Must contain section ## ${i}.`);
    }
    assert.match(content, /Observed/);
    assert.match(content, /Inferred/);
    assert.match(content, /Recommended/);
    assert.match(content, /Same Design Team Test/);
  });

  await t.test('4. commands/dk-idea.md includes early visual reference discovery', () => {
    const ideaPath = join(ROOT, 'commands', 'dk-idea.md');
    const content = readFileSync(ideaPath, 'utf-8');
    assert.match(content, /visual references/i);
    assert.match(content, /design\.md/i);
    assert.match(content, /defer/i);
  });

  await t.test('5. commands/dk-design.md integrates with Design Authority', () => {
    const designPath = join(ROOT, 'commands', 'dk-design.md');
    const content = readFileSync(designPath, 'utf-8');
    assert.match(content, /design-authority|design\.md|\/dk-design-system/i);
  });

  await t.test('6. commands/dk-build.md and build-auto contain Design System Preflight', () => {
    const buildPath = join(ROOT, 'commands', 'dk-build.md');
    const content = readFileSync(buildPath, 'utf-8');
    assert.match(content, /DESIGN SYSTEM PRE-FLIGHT/i);
    assert.match(content, /design\.md/i);
  });

  await t.test('7. commands/dk-test.md includes Design System Compliance checks', () => {
    const testPath = join(ROOT, 'commands', 'dk-test.md');
    const content = readFileSync(testPath, 'utf-8');
    assert.match(content, /Design System Compliance/i);
  });

  await t.test('8. commands/dk-review.md and agents/design-reviewer.md enforce Same Design Team Test and DS issue IDs', () => {
    const reviewPath = join(ROOT, 'commands', 'dk-review.md');
    const reviewContent = readFileSync(reviewPath, 'utf-8');
    assert.match(reviewContent, /Same Design Team Test/i);
    assert.match(reviewContent, /DS-\d+/i);

    const agentPath = join(ROOT, 'agents', 'design-reviewer.md');
    const agentContent = readFileSync(agentPath, 'utf-8');
    assert.match(agentContent, /Same Design Team Test/i);
  });

  await t.test('9. agents/frontend-implementer.md enforces Frontend Design Authority and reading design.md first', () => {
    const agentPath = join(ROOT, 'agents', 'frontend-implementer.md');
    const content = readFileSync(agentPath, 'utf-8');
    assert.match(content, /FRONTEND DESIGN AUTHORITY/i);
    assert.match(content, /design\.md/i);
    assert.match(content, /Same Design Team Test/i);
  });

  await t.test('10. commands/dk-ship.md enforces Design Authority release gate while exempting non-visual scope', () => {
    const shipPath = join(ROOT, 'commands', 'dk-ship.md');
    const content = readFileSync(shipPath, 'utf-8');
    assert.match(content, /Design Authority/i);
    assert.match(content, /Same Design Team/i);
  });

  await t.test('11. commands/dk-status.md displays Design Authority status when applicable', () => {
    const statusPath = join(ROOT, 'commands', 'dk-status.md');
    const content = readFileSync(statusPath, 'utf-8');
    assert.match(content, /Design Authority/i);
  });

  await t.test('12. scripts/install-antigravity.mjs includes /dk-design-system in user-facing command list', () => {
    const installerPath = join(ROOT, 'scripts', 'install-antigravity.mjs');
    const content = readFileSync(installerPath, 'utf-8');
    assert.match(content, /\/dk-design-system/);
  });
});
