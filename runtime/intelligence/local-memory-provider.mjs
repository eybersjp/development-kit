/**
 * Development Kit Intelligence — Default Local Memory Provider
 *
 * Implements offline, atomic, Node 18 compatible local memory storage in
 * .development-kit/intelligence/memory/
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { DKMemoryProvider } from './memory-provider-contract.mjs';
import {
  MEMORY_SCHEMA_VERSION,
  MemoryStatus,
  MemoryScope,
} from './memory-enums.mjs';
import {
  validateMemoryRecord,
  validateAuthorityTransition,
  linkSupersession,
  MemoryValidationError,
} from './memory-schema.mjs';
import {
  getPartitionKey,
  resolveMemoryIdentity,
  isRecordAccessible,
} from './memory-identity.mjs';
import { acquireTransactionLock, releaseTransactionLock } from '../autopilot/lock-manager.mjs';

export class LocalMemoryProvider extends DKMemoryProvider {
  constructor(options = {}) {
    super();
    this.rootDir = options.rootDir || process.cwd();
    this.providerId = 'local-memory';
    this.displayName = 'DK Local Memory';
    this.version = '0.7.0';
    this.dataLocation = 'local';
  }

  getMemoryDir() {
    return path.join(this.rootDir, '.development-kit', 'intelligence', 'memory');
  }

  getRecordsDir() {
    return path.join(this.getMemoryDir(), 'records');
  }

  getManifestPath() {
    return path.join(this.getMemoryDir(), 'manifest.json');
  }

  getIndexPath() {
    return path.join(this.getMemoryDir(), 'index.json');
  }

  _ensureDirs() {
    const recordsDir = this.getRecordsDir();
    if (!fs.existsSync(recordsDir)) {
      fs.mkdirSync(recordsDir, { recursive: true });
    }
  }

  async detect() {
    return {
      providerId: this.providerId,
      installed: true,
      available: true,
      dataLocation: this.dataLocation,
    };
  }

  async health() {
    return {
      status: 'healthy',
      providerId: this.providerId,
      details: {
        rootDir: this.rootDir,
        storagePath: this.getMemoryDir(),
      },
    };
  }

  async capabilities() {
    return {
      memory: true,
      knowledge: false,
      codeIntelligence: false,
      skills: false,
    };
  }

  async activate() {
    this._ensureDirs();
    await this.rebuildIndex();
    return { activated: true, providerId: this.providerId };
  }

  async deactivate() {
    return;
  }

  _readRecordFile(id) {
    const filePath = path.join(this.getRecordsDir(), `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      validateMemoryRecord(parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  _writeRecordAtomic(record) {
    validateMemoryRecord(record);
    this._ensureDirs();
    const filePath = path.join(this.getRecordsDir(), `${record.id}.json`);
    const tmpPath = path.join(this.getRecordsDir(), `tmp-${Date.now()}-${record.id}.json`);

    fs.writeFileSync(tmpPath, JSON.stringify(record, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  async store(record) {
    validateMemoryRecord(record);
    const lock = acquireTransactionLock(this.rootDir);
    try {
      this._writeRecordAtomic(record);
      await this._updateIndexOnStore(record);
      return record;
    } finally {
      releaseTransactionLock(lock);
    }
  }

  async get(id) {
    if (!id || typeof id !== 'string') return null;
    return this._readRecordFile(id);
  }

  async update(record, options = {}) {
    validateMemoryRecord(record);
    const lock = acquireTransactionLock(this.rootDir);
    try {
      const existing = this._readRecordFile(record.id);
      if (!existing) {
        throw new Error(`Record with id ${record.id} not found`);
      }

      validateAuthorityTransition(existing, record, options.userConfirmed || false);

      const updated = {
        ...record,
        updatedAt: new Date().toISOString(),
      };

      this._writeRecordAtomic(updated);
      await this._updateIndexOnStore(updated);
      return updated;
    } finally {
      releaseTransactionLock(lock);
    }
  }

  async archive(id) {
    const lock = acquireTransactionLock(this.rootDir);
    try {
      const record = this._readRecordFile(id);
      if (!record) {
        throw new Error(`Record with id ${id} not found`);
      }

      const updated = {
        ...record,
        status: MemoryStatus.ARCHIVED,
        updatedAt: new Date().toISOString(),
      };

      this._writeRecordAtomic(updated);
      await this._updateIndexOnStore(updated);
      return updated;
    } finally {
      releaseTransactionLock(lock);
    }
  }

  async forget(id) {
    const lock = acquireTransactionLock(this.rootDir);
    try {
      const filePath = path.join(this.getRecordsDir(), `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await this.rebuildIndex();
    } finally {
      releaseTransactionLock(lock);
    }
  }

  async supersede(oldId, newRecordData) {
    const lock = acquireTransactionLock(this.rootDir);
    try {
      const oldRecord = this._readRecordFile(oldId);
      if (!oldRecord) {
        throw new Error(`Record with id ${oldId} not found`);
      }

      const newRecord = {
        ...newRecordData,
        id: newRecordData.id || `mem_${crypto.randomUUID()}`,
        schemaVersion: MEMORY_SCHEMA_VERSION,
        createdAt: newRecordData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { supersededRecord, activeRecord } = linkSupersession(oldRecord, newRecord);

      this._writeRecordAtomic(supersededRecord);
      this._writeRecordAtomic(activeRecord);

      await this.rebuildIndex();

      return { supersededRecord, activeRecord };
    } finally {
      releaseTransactionLock(lock);
    }
  }

  async query(queryOptions = {}) {
    const identity = resolveMemoryIdentity(this.rootDir);
    const allRecords = await this.listAllRecords();

    // 1. Mandatory Project Isolation / Accessibility Check BEFORE ranking
    const allowedScopes = queryOptions.scopes || [
      MemoryScope.PROJECT,
      MemoryScope.WORKSPACE,
      MemoryScope.USER,
    ];

    const accessibleRecords = allRecords.filter((rec) =>
      isRecordAccessible(rec, identity, allowedScopes),
    );

    // 2. Filter by status (default to active only unless specified)
    const targetStatuses = queryOptions.statuses || [MemoryStatus.ACTIVE];
    let filtered = accessibleRecords.filter((rec) => targetStatuses.includes(rec.status));

    // 3. Filter by type
    if (queryOptions.types && Array.isArray(queryOptions.types)) {
      filtered = filtered.filter((rec) => queryOptions.types.includes(rec.type));
    }

    // 4. Filter by lifecycleStage
    if (queryOptions.lifecycleStage) {
      filtered = filtered.filter(
        (rec) =>
          !rec.lifecycleStages ||
          rec.lifecycleStages.length === 0 ||
          rec.lifecycleStages.includes(queryOptions.lifecycleStage),
      );
    }

    // 5. Filter by tags
    if (queryOptions.tags && Array.isArray(queryOptions.tags)) {
      filtered = filtered.filter(
        (rec) => rec.tags && queryOptions.tags.some((tag) => rec.tags.includes(tag)),
      );
    }

    // 6. Lexical Search & Relevance Scoring
    let results = filtered.map((record) => {
      let score = 1.0;

      // Authority weighting
      if (record.authority === 'user-approved') score += 2.0;
      else if (record.authority === 'repository-verified' || record.authority === 'system-verified') score += 1.5;
      else if (record.authority === 'inferred') score += 0.5;
      else if (record.authority === 'imported-untrusted') score += 0.1;

      // Confidence weighting
      score *= record.confidence || 1.0;

      // Text query match
      if (queryOptions.text && typeof queryOptions.text === 'string') {
        const queryTerms = queryOptions.text.toLowerCase().split(/\s+/).filter(Boolean);
        const matchSubject = record.subject.toLowerCase();
        const matchContent = record.content.toLowerCase();

        let matches = 0;
        for (const term of queryTerms) {
          if (matchSubject.includes(term)) matches += 3;
          if (matchContent.includes(term)) matches += 1;
        }

        if (matches === 0 && queryTerms.length > 0) {
          score = 0;
        } else {
          score += matches;
        }
      }

      return { record, score };
    });

    results = results.filter((r) => r.score > 0);
    results.sort((a, b) => b.score - a.score);

    if (queryOptions.limit && Number.isInteger(queryOptions.limit) && queryOptions.limit > 0) {
      results = results.slice(0, queryOptions.limit);
    }

    return results;
  }

  async listAllRecords() {
    this._ensureDirs();
    const files = fs.readdirSync(this.getRecordsDir()).filter((f) => f.endsWith('.json') && !f.startsWith('tmp-'));
    const records = [];
    for (const file of files) {
      const id = file.replace('.json', '');
      const rec = this._readRecordFile(id);
      if (rec) records.push(rec);
    }
    return records;
  }

  async _updateIndexOnStore(record) {
    await this.rebuildIndex();
  }

  async rebuildIndex() {
    this._ensureDirs();
    const records = await this.listAllRecords();

    const manifest = {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      providerId: this.providerId,
      updatedAt: new Date().toISOString(),
      recordCount: records.length,
    };

    const index = {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      records: records.map((r) => ({
        id: r.id,
        type: r.type,
        scope: r.scope,
        projectId: r.projectId,
        subject: r.subject,
        authority: r.authority,
        status: r.status,
        updatedAt: r.updatedAt,
      })),
    };

    fs.writeFileSync(this.getManifestPath(), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(this.getIndexPath(), JSON.stringify(index, null, 2), 'utf8');

    return { manifest, index };
  }

  async export(options = {}) {
    const records = await this.listAllRecords();
    return {
      format: 'dk-memory-archive-v1',
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      records,
    };
  }

  async import(archive, options = {}) {
    if (!archive || !Array.isArray(archive.records)) {
      throw new Error('Invalid memory archive format');
    }

    const imported = [];
    for (const raw of archive.records) {
      const record = {
        ...raw,
        // Imported records default to imported-untrusted unless explicitly confirmed
        authority: options.trustImported ? raw.authority : 'imported-untrusted',
      };
      await this.store(record);
      imported.push(record);
    }

    return { importedCount: imported.length, records: imported };
  }
}
