/**
 * Development Kit Intelligence — Memory Import, Export, Migration & Recovery
 *
 * Implements:
 * 1. Portable memory bundle export
 * 2. Safe memory bundle import with untrusted classification guards
 * 3. Corrupt record diagnostics & recovery
 * 4. Index rebuild & integrity reconciliation
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  MEMORY_SCHEMA_VERSION,
  MemoryAuthority,
  MemoryStatus,
} from './memory-enums.mjs';
import { validateMemoryRecord } from './memory-schema.mjs';

/**
 * Exports all active memory records for the project into a portable JSON bundle.
 */
export async function exportMemoryBundle(provider) {
  const records = await provider.listAllRecords();
  return {
    exportVersion: '1.0.0',
    schemaVersion: MEMORY_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

/**
 * Safely imports a memory bundle.
 * Invariant: Imported records default to IMPORTED_UNTRUSTED authority unless userConfirmed = true.
 */
export async function importMemoryBundle(provider, bundle, options = {}) {
  const { userConfirmed = false, targetProjectId = null } = options;

  if (!bundle || typeof bundle !== 'object' || !Array.isArray(bundle.records)) {
    throw new Error('Invalid memory bundle format');
  }

  const results = {
    imported: 0,
    skipped: 0,
    errors: [],
  };

  for (const rawRecord of bundle.records) {
    try {
      // Force imported records to IMPORTED_UNTRUSTED unless explicitly confirmed by user
      const authority = userConfirmed ? rawRecord.authority : MemoryAuthority.IMPORTED_UNTRUSTED;

      const recordToStore = {
        ...rawRecord,
        projectId: targetProjectId || rawRecord.projectId,
        authority,
        schemaVersion: MEMORY_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      };

      validateMemoryRecord(recordToStore);
      await provider.store(recordToStore);
      results.imported++;
    } catch (err) {
      results.skipped++;
      results.errors.push({ id: rawRecord?.id, error: err.message });
    }
  }

  await provider.rebuildIndex();
  return results;
}

/**
 * Diagnoses and isolates corrupt record files in the memory directory.
 */
export async function diagnoseAndRecoverCorruptRecords(provider) {
  const recordsDir = provider.getRecordsDir();
  if (!fs.existsSync(recordsDir)) return { healthy: true, recovered: 0, isolated: [] };

  const files = fs.readdirSync(recordsDir).filter((f) => f.endsWith('.json'));
  const isolated = [];

  for (const file of files) {
    const fullPath = path.join(recordsDir, file);
    try {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(raw);
      validateMemoryRecord(parsed);
    } catch (err) {
      // Isolate corrupt file
      const corruptPath = path.join(recordsDir, `${file}.corrupt`);
      fs.renameSync(fullPath, corruptPath);
      isolated.push({ file, reason: err.message });
    }
  }

  if (isolated.length > 0) {
    await provider.rebuildIndex();
  }

  return {
    healthy: isolated.length === 0,
    recoveredCount: isolated.length,
    isolated,
  };
}
