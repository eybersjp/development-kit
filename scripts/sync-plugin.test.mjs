import test from 'node:test';
import assert from 'node:assert/strict';
import { contentsMatchIgnoringLineEndings, normalizeLineEndings } from './sync-plugin.mjs';

test('normalizeLineEndings normalizes CRLF to LF in sync-plugin helper', () => {
  assert.equal(normalizeLineEndings('hello\r\nworld\r\n'), 'hello\nworld\n');
  assert.equal(normalizeLineEndings('hello\nworld\n'), 'hello\nworld\n');
  assert.equal(normalizeLineEndings(''), '');
  assert.equal(normalizeLineEndings(123), 123);
});

test('contentsMatchIgnoringLineEndings evaluates LF and CRLF equivalent content as equal', () => {
  const lf = 'function test() {\n  return "ok";\n}\n';
  const crlf = 'function test() {\r\n  return "ok";\r\n}\r\n';
  assert.equal(contentsMatchIgnoringLineEndings(lf, crlf), true);
  assert.equal(contentsMatchIgnoringLineEndings(crlf, lf), true);
});

test('contentsMatchIgnoringLineEndings evaluates mixed line endings as equal when text content matches', () => {
  const mixed1 = 'line1\r\nline2\nline3\r\n';
  const mixed2 = 'line1\nline2\r\nline3\n';
  assert.equal(contentsMatchIgnoringLineEndings(mixed1, mixed2), true);
});

test('contentsMatchIgnoringLineEndings evaluates materially different content as unequal', () => {
  const file1 = 'function test() {\n  return "ok";\n}\n';
  const file2 = 'function test() {\n  return "different";\n}\n';
  assert.equal(contentsMatchIgnoringLineEndings(file1, file2), false);
});

test('contentsMatchIgnoringLineEndings handles empty strings and non-string values consistently', () => {
  assert.equal(contentsMatchIgnoringLineEndings('', ''), true);
  assert.equal(contentsMatchIgnoringLineEndings('', 'not empty'), false);
  assert.equal(contentsMatchIgnoringLineEndings(null, null), true);
  assert.equal(contentsMatchIgnoringLineEndings(undefined, undefined), true);
});
