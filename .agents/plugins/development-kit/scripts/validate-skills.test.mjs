import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYamlFrontmatter, normalizeLineEndings } from './validate-skills.mjs';

test('normalizeLineEndings converts CRLF to LF and preserves LF', () => {
  assert.equal(normalizeLineEndings('line1\r\nline2\r\n'), 'line1\nline2\n');
  assert.equal(normalizeLineEndings('line1\nline2\n'), 'line1\nline2\n');
  assert.equal(normalizeLineEndings('line1\r\nline2\n'), 'line1\nline2\n');
  assert.equal(normalizeLineEndings(''), '');
  assert.equal(normalizeLineEndings(null), null);
});

test('parseYamlFrontmatter parses LF frontmatter correctly', () => {
  const content = '---\nname: test-skill\ndescription: Test skill description\n---\n# Overview\nSome content';
  const result = parseYamlFrontmatter(content);
  assert.deepEqual(result, {
    name: 'test-skill',
    description: 'Test skill description',
  });
});

test('parseYamlFrontmatter parses CRLF frontmatter correctly', () => {
  const content = '---\r\nname: test-skill\r\ndescription: Test skill description\r\n---\r\n# Overview\r\nSome content';
  const result = parseYamlFrontmatter(content);
  assert.deepEqual(result, {
    name: 'test-skill',
    description: 'Test skill description',
  });
});

test('parseYamlFrontmatter parses mixed CRLF/LF frontmatter correctly', () => {
  const content = '---\r\nname: test-skill\ndescription: Test skill description\r\n---\n# Overview\nSome content';
  const result = parseYamlFrontmatter(content);
  assert.deepEqual(result, {
    name: 'test-skill',
    description: 'Test skill description',
  });
});

test('parseYamlFrontmatter produces identical structured output for LF and CRLF inputs', () => {
  const lf = '---\nname: my-skill\ndescription: A great skill\n---\n# Overview\nContent\n';
  const crlf = '---\r\nname: my-skill\r\ndescription: A great skill\r\n---\r\n# Overview\r\nContent\r\n';

  const resLF = parseYamlFrontmatter(lf);
  const resCRLF = parseYamlFrontmatter(crlf);

  assert.notEqual(resLF, null);
  assert.notEqual(resCRLF, null);
  assert.deepEqual(resLF, resCRLF);
});

test('parseYamlFrontmatter returns null for missing or invalid frontmatter', () => {
  assert.equal(parseYamlFrontmatter(''), null);
  assert.equal(parseYamlFrontmatter('# No Frontmatter'), null);
  assert.equal(parseYamlFrontmatter('---\nname: unclosed\n# Missing end marker'), null);
  assert.equal(parseYamlFrontmatter(null), null);
});
