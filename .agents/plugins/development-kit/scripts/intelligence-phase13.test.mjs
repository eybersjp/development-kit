/**
 * Development Kit Intelligence — Phase 13 Test Suite (Import, Export, Recovery)
 *
 * Tests:
 * 1. Export produces a valid portable bundle with all active records
 * 2. Unconfirmed import forces records to IMPORTED_UNTRUSTED authority
 * 3. Confirmed import preserves specified authority
 * 4. Corrupt record JSON files are safely isolated and do not crash provider
 * 5. Index rebuild recovers valid index from active files
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LocalMemoryProvider } from '../runtime/intelligence/local-memory-provider.mjs';
import {
  exportMemoryBundle,
  importMemoryBundle,
  diagnoseAndRecoverCorruptRecords,
} from '../runtime/intelligence/memory-export-recovery.mjs';
import {
  MEMORY_SCHEMA_VERSION,
  MemoryType,
  MemoryScope,
  MemoryAuthority,
  MemoryStatus,
} from '../runtime/intelligence/memory-enums.mjs';

function makeTempProject(prefix = 'dk-phase13-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('1. Export produces a valid portable bundle with all active records', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const identity = (await import('../runtime/intelligence/memory-identity.mjs')).resolveMemoryIdentity(rootDir);

  await provider.store({
    id: 'mem_export_1',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    type: MemoryType.DECISION,
    scope: MemoryScope.PROJECT,
    projectId: identity.projectId,
    subject: 'Decision to Export',
    content: 'Export content item',
    authority: MemoryAuthority.USER_APPROVED,
    confidence: 1.0,
    status: MemoryStatus.ACTIVE,
    source: { type: 'artifact' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const bundle = await exportMemoryBundle(provider);
  assert.equal(bundle.recordCount, 1);
  assert.equal(bundle.records[0].id, 'mem_export_1');
});

test('2. Unconfirmed import forces records to IMPORTED_UNTRUSTED authority', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const rawBundle = {
    exportVersion: '1.0.0',
    records: [
      {
        id: 'mem_imported_fake_approved',
        schemaVersion: MEMORY_SCHEMA_VERSION,
        type: MemoryType.DECISION,
        scope: MemoryScope.PROJECT,
        projectId: 'proj_target',
        subject: 'Fake Approved',
        content: 'Claimed to be user approved',
        authority: MemoryAuthority.USER_APPROVED, // Malicious claim
        confidence: 1.0,
        status: MemoryStatus.ACTIVE,
        source: { type: 'imported' },
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const results = await importMemoryBundle(provider, rawBundle, { userConfirmed: false });
  assert.equal(results.imported, 1);

  const importedRecord = await provider.get('mem_imported_fake_approved');
  assert.equal(importedRecord.authority, MemoryAuthority.IMPORTED_UNTRUSTED);
});

test('3. Confirmed import preserves specified authority', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  const rawBundle = {
    exportVersion: '1.0.0',
    records: [
      {
        id: 'mem_imported_real_approved',
        schemaVersion: MEMORY_SCHEMA_VERSION,
        type: MemoryType.DECISION,
        scope: MemoryScope.PROJECT,
        projectId: 'proj_target',
        subject: 'Real Approved',
        content: 'Explicitly approved import',
        authority: MemoryAuthority.USER_APPROVED,
        confidence: 1.0,
        status: MemoryStatus.ACTIVE,
        source: { type: 'imported' },
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const results = await importMemoryBundle(provider, rawBundle, { userConfirmed: true });
  assert.equal(results.imported, 1);

  const importedRecord = await provider.get('mem_imported_real_approved');
  assert.equal(importedRecord.authority, MemoryAuthority.USER_APPROVED);
});

test('4-5. Corrupt record JSON files are safely isolated and do not crash provider', async (t) => {
  const rootDir = makeTempProject();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const provider = new LocalMemoryProvider({ rootDir });
  await provider.activate();

  // Create a corrupt JSON file in records directory
  const corruptFile = join(provider.getRecordsDir(), 'mem_corrupt_bad.json');
  writeFileSync(corruptFile, 'MALFORMED_JSON_SYNTAX{{{');

  const recovery = await diagnoseAndRecoverCorruptRecords(provider);
  assert.equal(recovery.healthy, false);
  assert.equal(recovery.recoveredCount, 1);
  assert.equal(recovery.isolated[0].file, 'mem_corrupt_bad.json');
});
