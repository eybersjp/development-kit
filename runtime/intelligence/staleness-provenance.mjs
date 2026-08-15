/**
 * Development Kit Intelligence — Provenance & Staleness Engine
 *
 * Implements source fingerprinting, staleness detection, expiry evaluation,
 * active truth selection, and provenance formatting for DK Memory records.
 */

import path from 'node:path';
import { MemoryStatus } from './memory-enums.mjs';
import { computeFileFingerprint } from '../autopilot/staleness-engine.mjs';

/**
 * Attaches or computes a fingerprint for an artifact-backed memory record.
 */
export function computeRecordSourceFingerprint(source, rootDir = process.cwd()) {
  if (!source || typeof source !== 'object') return null;

  if (source.type === 'artifact' && source.ref) {
    const fullPath = path.isAbsolute(source.ref)
      ? source.ref
      : path.resolve(rootDir, source.ref);
    return computeFileFingerprint(fullPath);
  }

  return null;
}

/**
 * Checks whether a single memory record is stale.
 * A record is stale if:
 * 1. It has reached its expiresAt timestamp.
 * 2. Its status is explicitly 'stale'.
 * 3. It is backed by a source artifact whose current hash differs from source.fingerprint.
 */
export function isRecordStale(record, rootDir = process.cwd()) {
  if (!record || typeof record !== 'object') return false;

  // Explicit status check
  if (record.status === MemoryStatus.STALE) {
    return true;
  }

  // Expiration timestamp check
  if (record.expiresAt) {
    const expiryTime = Date.parse(record.expiresAt);
    if (!Number.isNaN(expiryTime) && Date.now() > expiryTime) {
      return true;
    }
  }

  // Source fingerprint staleness check
  if (record.source && record.source.type === 'artifact' && record.source.ref && record.source.fingerprint) {
    const currentHash = computeRecordSourceFingerprint(record.source, rootDir);
    if (currentHash && currentHash !== record.source.fingerprint) {
      return true;
    }
  }

  return false;
}

/**
 * Updates memory records with staleness evaluation.
 * Returns updated records if any became stale.
 */
export async function evaluateAndRefreshStaleness(provider, rootDir = process.cwd()) {
  const records = await provider.listAllRecords();
  const updatedRecords = [];

  for (const record of records) {
    if (record.status === MemoryStatus.ACTIVE) {
      if (isRecordStale(record, rootDir)) {
        const staleRecord = {
          ...record,
          status: MemoryStatus.STALE,
          updatedAt: new Date().toISOString(),
        };
        await provider.update(staleRecord, { userConfirmed: true });
        updatedRecords.push(staleRecord);
      }
    }
  }

  return updatedRecords;
}

/**
 * Formats provenance information for human inspection and UI display.
 */
export function formatRecordProvenance(record) {
  if (!record || !record.source) {
    return 'Unknown provenance';
  }

  const { type, ref, fingerprint, details } = record.source;
  const parts = [`Source: ${type}`];

  if (ref) parts.push(`Reference: ${ref}`);
  if (fingerprint) parts.push(`Fingerprint: ${fingerprint.slice(0, 8)}...`);
  if (details) parts.push(`Details: ${details}`);

  return parts.join(' | ');
}
