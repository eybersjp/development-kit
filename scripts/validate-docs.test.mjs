import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateDocs, containsUnresolvedPlaceholders } from './validate-docs.mjs';

function createFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'dk-doc-val-test-'));

  // Create standard directories
  mkdirSync(join(root, 'commands'), { recursive: true });
  mkdirSync(join(root, 'agents'), { recursive: true });
  mkdirSync(join(root, 'skills', 'test-skill'), { recursive: true });
  mkdirSync(join(root, 'hooks'), { recursive: true });
  mkdirSync(join(root, 'templates'), { recursive: true });
  mkdirSync(join(root, 'evals', 'test-eval'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });

  mkdirSync(join(root, 'docs', '03-reference', 'commands'), { recursive: true });
  mkdirSync(join(root, 'docs', '03-reference', 'agents'), { recursive: true });
  mkdirSync(join(root, 'docs', '03-reference', 'skills'), { recursive: true });
  mkdirSync(join(root, 'docs', '03-reference', 'hooks'), { recursive: true });
  mkdirSync(join(root, 'docs', '03-reference', 'templates'), { recursive: true });
  mkdirSync(join(root, 'docs', '03-reference', 'evaluations'), { recursive: true });
  mkdirSync(join(root, 'docs', '03-reference', 'scripts'), { recursive: true });

  // Source files
  writeFileSync(join(root, 'commands', 'dk-test-cmd.md'), '# test-cmd');
  writeFileSync(join(root, 'agents', 'test-agent.md'), '# test-agent');
  writeFileSync(join(root, 'skills', 'test-skill', 'SKILL.md'), '# test-skill');
  writeFileSync(join(root, 'hooks', 'test-hook.js'), '// test-hook');
  writeFileSync(join(root, 'templates', 'test-template.md'), '# test-template');
  writeFileSync(join(root, 'evals', 'test-eval', 'eval.json'), '{}');
  writeFileSync(join(root, 'scripts', 'test-script.mjs'), '// test-script');

  // Reference pages
  writeFileSync(join(root, 'docs', '03-reference', 'commands', 'dk-test-cmd.md'), '# Cmd Ref');
  writeFileSync(join(root, 'docs', '03-reference', 'agents', 'test-agent.md'), '# Agent Ref');
  writeFileSync(join(root, 'docs', '03-reference', 'skills', 'test-skill.md'), '# Skill Ref');
  writeFileSync(join(root, 'docs', '03-reference', 'hooks', 'test-hook.md'), '# Hook Ref');
  writeFileSync(join(root, 'docs', '03-reference', 'templates', 'test-template.md'), '# Template Ref');
  writeFileSync(join(root, 'docs', '03-reference', 'evaluations', 'test-eval.md'), '# Eval Ref');
  writeFileSync(join(root, 'docs', '03-reference', 'scripts', 'test-script.md'), '# Script Ref');

  // SUMMARY.md
  const summaryContent = `# Summary

- [Cmd Ref](03-reference/commands/dk-test-cmd.md)
- [Agent Ref](03-reference/agents/test-agent.md)
- [Skill Ref](03-reference/skills/test-skill.md)
- [Hook Ref](03-reference/hooks/test-hook.md)
- [Template Ref](03-reference/templates/test-template.md)
- [Eval Ref](03-reference/evaluations/test-eval.md)
- [Script Ref](03-reference/scripts/test-script.md)
`;
  writeFileSync(join(root, 'docs', 'SUMMARY.md'), summaryContent);

  return root;
}

function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

test('1. Valid fixture passes cleanly', () => {
  const fixture = createFixtureRoot();
  try {
    const res = validateDocs(fixture, { silent: true });
    assert.equal(res.errors.length, 0, `Expected 0 errors, got: ${res.errors.join(', ')}`);
    assert.ok(res.passCount > 0, 'Expected positive pass count');
  } finally {
    cleanup(fixture);
  }
});

test('2. Broken relative Markdown link fails', () => {
  const fixture = createFixtureRoot();
  try {
    writeFileSync(join(fixture, 'docs', '03-reference', 'commands', 'dk-test-cmd.md'), '# Cmd Ref\n[broken link](missing_file.md)');
    const res = validateDocs(fixture, { silent: true });
    assert.ok(res.errors.length > 0, 'Expected validation error for broken link');
    assert.ok(res.errors.some(e => e.includes("Broken link to 'missing_file.md'")));
  } finally {
    cleanup(fixture);
  }
});

test('3. Placeholder marker fails', () => {
  const fixture = createFixtureRoot();
  try {
    writeFileSync(join(fixture, 'docs', '03-reference', 'commands', 'dk-test-cmd.md'), '# Cmd Ref\nTODO: fix this page');
    const res = validateDocs(fixture, { silent: true });
    assert.ok(res.errors.length > 0, 'Expected validation error for placeholder text');
    assert.ok(res.errors.some(e => e.includes('Contains placeholder text')));
  } finally {
    cleanup(fixture);
  }
});

test('4. Missing required command reference page fails', () => {
  const fixture = createFixtureRoot();
  try {
    rmSync(join(fixture, 'docs', '03-reference', 'commands', 'dk-test-cmd.md'));
    const res = validateDocs(fixture, { silent: true });
    assert.ok(res.errors.length > 0, 'Expected validation error for missing command reference page');
    assert.ok(res.errors.some(e => e.includes('Missing command reference page for: dk-test-cmd')));
  } finally {
    cleanup(fixture);
  }
});

test('5. Markdown page absent from docs/SUMMARY.md fails', () => {
  const fixture = createFixtureRoot();
  try {
    writeFileSync(join(fixture, 'docs', '03-reference', 'unindexed-page.md'), '# Unindexed Page');
    const res = validateDocs(fixture, { silent: true });
    assert.ok(res.errors.length > 0, 'Expected validation error for unindexed page');
    assert.ok(res.errors.some(e => e.includes('Not linked in docs/SUMMARY.md')));
  } finally {
    cleanup(fixture);
  }
});

test('6. Prohibited file:/// URL fails', () => {
  const fixture = createFixtureRoot();
  try {
    writeFileSync(join(fixture, 'docs', '03-reference', 'commands', 'dk-test-cmd.md'), '# Cmd Ref\n[local link](file:///C:/Users/test.md)');
    const res = validateDocs(fixture, { silent: true });
    assert.ok(res.errors.length > 0, 'Expected validation error for file:/// URL');
    assert.ok(res.errors.some(e => e.includes('Contains local file:/// URL')));
  } finally {
    cleanup(fixture);
  }
});

test('7. Broken link registered in docs/SUMMARY.md fails', () => {
  const fixture = createFixtureRoot();
  try {
    const summaryPath = join(fixture, 'docs', 'SUMMARY.md');
    const currentSummary = writeFileSync(summaryPath, '# Summary\n- [Non Existent](03-reference/non-existent-page.md)\n');
    const res = validateDocs(fixture, { silent: true });
    assert.ok(res.errors.length > 0, 'Expected validation error for broken SUMMARY.md link');
    assert.ok(res.errors.some(e => e.includes("Broken link to '03-reference/non-existent-page.md'")));
  } finally {
    cleanup(fixture);
  }
});

test('8. Inconsistent active version declaration fails while preserving historical references', () => {
  const fixture = createFixtureRoot();
  try {
    // Write package.json with version 9.9.9
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'development-kit', version: '9.9.9' }, null, 2));

    // Create active doc page with stale version 0.5.2
    mkdirSync(join(fixture, 'docs', '01-overview'), { recursive: true });
    writeFileSync(join(fixture, 'docs', '01-overview', 'framework-at-a-glance.md'), '# Framework\n| Framework Version | 0.5.2 |');

    const res = validateDocs(fixture, { silent: true });
    assert.ok(res.errors.length > 0, 'Expected validation error for stale active version');
    assert.ok(res.errors.some(e => e.includes('Does not declare current active package version 9.9.9')));
  } finally {
    cleanup(fixture);
  }
});

test('9. Explanatory prose discussing TODO or TBD passes validation', () => {
  const fixture = createFixtureRoot();
  try {
    const prose = `# Design Spec Rules
Do not use TBD placeholders in generated specifications.
Specifications must contain no TODO or TBD markers.
The validator rejects unresolved "TBD" values.
Avoid placeholder content such as TODO, TBD, or Lorem ipsum.
No required token/value may be left as \`TBD\`.
Generated design.md contains reasoned implementation values rather than unresolved TBD design decisions.
`;
    writeFileSync(join(fixture, 'docs', '03-reference', 'commands', 'dk-test-cmd.md'), prose);
    const res = validateDocs(fixture, { silent: true });
    assert.equal(res.errors.length, 0, `Expected 0 errors, got: ${res.errors.join(', ')}`);
  } finally {
    cleanup(fixture);
  }
});

test('10. Unresolved placeholder patterns correctly fail validation', () => {
  // Unit tests on containsUnresolvedPlaceholders
  const failingCases = [
    'TBD',
    'TODO',
    '`TBD`',
    '- TBD',
    '* TODO',
    '1. TBD',
    'Owner: TBD',
    'Status: [TBD]',
    'Due Date: `TODO`',
    '| Component | TBD |',
    '## TBD',
    '### TODO',
    '# [TBD]',
    'TODO: complete this section',
    'TBD: define data schema',
    '[TBD]',
    '<TBD>',
    '{{TBD}}',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
  ];

  for (const snippet of failingCases) {
    assert.equal(
      containsUnresolvedPlaceholders(snippet),
      true,
      `Expected snippet to be detected as unresolved placeholder: "${snippet}"`
    );
  }

  const passingCases = [
    'Do not use TBD placeholders.',
    'Specifications must contain no TODO or TBD markers.',
    'The validator rejects unresolved "TBD" values.',
    'Avoid placeholder content such as TODO, TBD, or Lorem ipsum.',
    'No required token/value may be left as `TBD`.',
    'Generated design.md contains reasoned implementation values rather than unresolved TBD design decisions.'
  ];

  for (const snippet of passingCases) {
    assert.equal(
      containsUnresolvedPlaceholders(snippet),
      false,
      `Expected explanatory snippet to pass: "${snippet}"`
    );
  }
});
