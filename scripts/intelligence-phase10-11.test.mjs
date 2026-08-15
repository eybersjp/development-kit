/**
 * Development Kit Intelligence — Phase 10 & 11 Test Suite
 *
 * Tests:
 * 1. NativeKnowledgeProvider lists markdown documents from docs/ directory
 * 2. NativeKnowledgeProvider queries documents by keyword
 * 3. NativeCodeIntelligenceProvider indexes and searches symbols
 * 4. TencentMemoryAdapter detects optional status and reports unconfigured when credentials absent
 * 5. TencentMemoryAdapter degrades gracefully on queries without throwing or breaking DK
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  NativeKnowledgeProvider,
  NativeCodeIntelligenceProvider,
} from '../runtime/intelligence/knowledge-code-intelligence.mjs';
import { TencentMemoryAdapter } from '../runtime/providers/tencent-memory-adapter.mjs';

function makeTempProject(prefix = 'dk-phase10-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('1. NativeKnowledgeProvider lists markdown documents from docs/ directory', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  mkdirSync(join(rootDir, 'docs'), { recursive: true });
  writeFileSync(join(rootDir, 'docs', 'guide.md'), '# Guide\nProject usage details.');

  const provider = new NativeKnowledgeProvider({ rootDir });
  const list = await provider.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].ref, 'docs/guide.md');

  const content = await provider.read('docs/guide.md');
  assert.match(content.content, /Project usage details/);
});

test('2. NativeKnowledgeProvider queries documents by keyword', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  mkdirSync(join(rootDir, 'docs'), { recursive: true });
  writeFileSync(join(rootDir, 'docs', 'architecture.md'), '# Architecture');
  writeFileSync(join(rootDir, 'docs', 'deployment.md'), '# Deployment');

  const provider = new NativeKnowledgeProvider({ rootDir });
  const results = await provider.query({ text: 'architecture' });
  assert.equal(results.length, 1);
  assert.equal(results[0].resource.ref, 'docs/architecture.md');
});

test('3. NativeCodeIntelligenceProvider indexes and searches symbols', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  mkdirSync(join(rootDir, 'runtime'), { recursive: true });
  writeFileSync(join(rootDir, 'runtime', 'state-store.mjs'), '// state store');

  const provider = new NativeCodeIntelligenceProvider({ rootDir });
  const symbols = await provider.searchSymbols('state');
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0].symbol, 'state-store');
});

test('4. TencentMemoryAdapter detects optional status and reports unconfigured when credentials absent', async () => {
  const adapter = new TencentMemoryAdapter();
  const detection = await adapter.detect();
  assert.equal(detection.installed, true);
  assert.equal(detection.configured, false);

  const health = await adapter.health();
  assert.equal(health.status, 'unconfigured');
});

test('5. TencentMemoryAdapter degrades gracefully on queries without throwing or breaking DK', async () => {
  const adapter = new TencentMemoryAdapter();
  const results = await adapter.query({ text: 'sample query' });
  assert.deepEqual(results, []);
});
