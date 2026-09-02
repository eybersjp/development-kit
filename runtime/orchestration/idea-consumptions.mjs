/**
 * Development Kit — Durable Interaction Consumption Receipts & Crash Recovery
 *
 * Implements canonical, immutable, append-only records of Product Owner
 * interaction consumption events for crash recovery and auditability.
 * Location: .development-kit/idea/consumptions.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const CONSUMPTIONS_SCHEMA_VERSION = '1.0.0';

export class ConsumptionReceiptError extends Error {
  constructor(message, code = 'DK_CONSUMPTION_RECEIPT_ERROR', details = null) {
    super(message);
    this.name = 'ConsumptionReceiptError';
    this.code = code;
    this.details = details;
  }
}

export function getConsumptionsFilePath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea', 'consumptions.json');
}

export function computeReceiptDigest(receiptWithoutId) {
  const norm = {
    schemaVersion: receiptWithoutId.schemaVersion,
    sequenceNumber: receiptWithoutId.sequenceNumber,
    previousReceiptFingerprint: receiptWithoutId.previousReceiptFingerprint || null,
    interactionType: receiptWithoutId.interactionType,
    interactionId: receiptWithoutId.interactionId || null,
    interactionFingerprint: receiptWithoutId.interactionFingerprint,
    workflowRevisionBefore: receiptWithoutId.workflowRevisionBefore,
    preDiscoveryRevision: receiptWithoutId.preDiscoveryRevision,
    preDiscoveryFingerprint: receiptWithoutId.preDiscoveryFingerprint,
    postDiscoveryRevision: receiptWithoutId.postDiscoveryRevision,
    postDiscoveryFingerprint: receiptWithoutId.postDiscoveryFingerprint,
    authority: receiptWithoutId.authority,
    resultingPodIds: Array.isArray(receiptWithoutId.resultingPodIds) ? [...receiptWithoutId.resultingPodIds].sort() : [],
    resultingArtifactApprovalId: receiptWithoutId.resultingArtifactApprovalId || null,
    timestamp: receiptWithoutId.timestamp,
  };
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(norm), 'utf8').digest('hex')}`;
}

export function validateConsumptionReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') {
    throw new ConsumptionReceiptError('Receipt must be an object', 'DK_RECEIPT_CORRUPT');
  }
  if (receipt.schemaVersion !== CONSUMPTIONS_SCHEMA_VERSION) {
    throw new ConsumptionReceiptError(`Invalid receipt schemaVersion: ${receipt.schemaVersion}`, 'DK_RECEIPT_CORRUPT');
  }
  if (typeof receipt.sequenceNumber !== 'number' || !Number.isInteger(receipt.sequenceNumber) || receipt.sequenceNumber < 1) {
    throw new ConsumptionReceiptError(`Invalid sequenceNumber: ${receipt.sequenceNumber}`, 'DK_RECEIPT_CORRUPT');
  }
  if (!receipt.interactionType || typeof receipt.interactionType !== 'string') {
    throw new ConsumptionReceiptError('Missing interactionType in receipt', 'DK_RECEIPT_CORRUPT');
  }
  if (!receipt.interactionFingerprint || !/^sha256:[a-f0-9]{64}$/i.test(receipt.interactionFingerprint)) {
    throw new ConsumptionReceiptError(`Invalid interactionFingerprint in receipt: ${receipt.interactionFingerprint}`, 'DK_RECEIPT_CORRUPT');
  }
  if (typeof receipt.workflowRevisionBefore !== 'number' || receipt.workflowRevisionBefore < 0) {
    throw new ConsumptionReceiptError(`Invalid workflowRevisionBefore: ${receipt.workflowRevisionBefore}`, 'DK_RECEIPT_CORRUPT');
  }
  if (typeof receipt.preDiscoveryRevision !== 'number' || receipt.preDiscoveryRevision < 0) {
    throw new ConsumptionReceiptError(`Invalid preDiscoveryRevision: ${receipt.preDiscoveryRevision}`, 'DK_RECEIPT_CORRUPT');
  }
  if (!receipt.preDiscoveryFingerprint || !/^sha256:[a-f0-9]{64}$/i.test(receipt.preDiscoveryFingerprint)) {
    throw new ConsumptionReceiptError(`Invalid preDiscoveryFingerprint: ${receipt.preDiscoveryFingerprint}`, 'DK_RECEIPT_CORRUPT');
  }
  if (typeof receipt.postDiscoveryRevision !== 'number' || receipt.postDiscoveryRevision < 0) {
    throw new ConsumptionReceiptError(`Invalid postDiscoveryRevision: ${receipt.postDiscoveryRevision}`, 'DK_RECEIPT_CORRUPT');
  }
  if (!receipt.postDiscoveryFingerprint || !/^sha256:[a-f0-9]{64}$/i.test(receipt.postDiscoveryFingerprint)) {
    throw new ConsumptionReceiptError(`Invalid postDiscoveryFingerprint: ${receipt.postDiscoveryFingerprint}`, 'DK_RECEIPT_CORRUPT');
  }
  if (receipt.authority !== 'PRODUCT_OWNER') {
    throw new ConsumptionReceiptError(`Invalid authority in receipt: ${receipt.authority} (must be PRODUCT_OWNER)`, 'DK_RECEIPT_CORRUPT');
  }
  if (!Array.isArray(receipt.resultingPodIds)) {
    throw new ConsumptionReceiptError('resultingPodIds must be an array in receipt', 'DK_RECEIPT_CORRUPT');
  }
  if (!receipt.timestamp || isNaN(Date.parse(receipt.timestamp))) {
    throw new ConsumptionReceiptError(`Invalid timestamp in receipt: ${receipt.timestamp}`, 'DK_RECEIPT_CORRUPT');
  }

  const expectedId = computeReceiptDigest(receipt);
  if (receipt.consumptionId !== expectedId) {
    throw new ConsumptionReceiptError(
      `Receipt consumptionId integrity mismatch: found ${receipt.consumptionId}, computed ${expectedId}`,
      'DK_RECEIPT_INTEGRITY_MISMATCH'
    );
  }
  return true;
}

export function loadConsumptions(rootDir = process.cwd()) {
  const filePath = getConsumptionsFilePath(rootDir);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      throw new ConsumptionReceiptError('Consumptions file must contain a JSON array', 'DK_RECEIPT_CORRUPT');
    }

    let prevHash = null;
    let prevSeq = 0;
    for (const receipt of list) {
      validateConsumptionReceipt(receipt);
      if (receipt.sequenceNumber !== prevSeq + 1) {
        throw new ConsumptionReceiptError(
          `Sequence discontinuity in receipt chain: expected ${prevSeq + 1}, got ${receipt.sequenceNumber}`,
          'DK_RECEIPT_CHAIN_BROKEN'
        );
      }
      if (prevHash !== null && receipt.previousReceiptFingerprint !== prevHash) {
        throw new ConsumptionReceiptError(
          `Receipt chain hash mismatch at sequence ${receipt.sequenceNumber}: expected ${prevHash}, got ${receipt.previousReceiptFingerprint}`,
          'DK_RECEIPT_CHAIN_BROKEN'
        );
      }
      prevHash = receipt.consumptionId;
      prevSeq = receipt.sequenceNumber;
    }
    return list;
  } catch (err) {
    if (err instanceof ConsumptionReceiptError) throw err;
    throw new ConsumptionReceiptError(`Failed to load consumptions: ${err.message}`, 'DK_RECEIPT_CORRUPT');
  }
}

export const loadConsumptionReceipts = loadConsumptions;

export function appendConsumptionReceipt(rootDir = process.cwd(), receiptData = {}) {
  const dir = path.join(rootDir, '.development-kit', 'idea');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const existing = loadConsumptions(rootDir);
  const sequenceNumber = existing.length + 1;
  const previousReceiptFingerprint = existing.length > 0 ? existing[existing.length - 1].consumptionId : null;

  const receipt = {
    schemaVersion: CONSUMPTIONS_SCHEMA_VERSION,
    sequenceNumber,
    previousReceiptFingerprint,
    interactionType: receiptData.interactionType,
    interactionId: receiptData.interactionId || null,
    interactionFingerprint: receiptData.interactionFingerprint,
    workflowRevisionBefore: receiptData.workflowRevisionBefore,
    preDiscoveryRevision: receiptData.preDiscoveryRevision,
    preDiscoveryFingerprint: receiptData.preDiscoveryFingerprint,
    postDiscoveryRevision: receiptData.postDiscoveryRevision,
    postDiscoveryFingerprint: receiptData.postDiscoveryFingerprint,
    authority: receiptData.authority,
    resultingPodIds: Array.isArray(receiptData.resultingPodIds) ? [...receiptData.resultingPodIds] : [],
    resultingArtifactApprovalId: receiptData.resultingArtifactApprovalId || null,
    timestamp: receiptData.timestamp || new Date().toISOString(),
  };

  receipt.consumptionId = computeReceiptDigest(receipt);
  validateConsumptionReceipt(receipt);

  const updated = [...existing, receipt];
  const filePath = getConsumptionsFilePath(rootDir);
  const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);

  return receipt;
}

export function findMatchingReceipt(rootDir = process.cwd(), {
  interactionFingerprint,
  workflowRevisionBefore,
  preDiscoveryRevision,
  preDiscoveryFingerprint,
} = {}) {
  const receipts = loadConsumptions(rootDir);
  const matches = receipts.filter((r) => {
    if (interactionFingerprint && r.interactionFingerprint !== interactionFingerprint) return false;
    if (workflowRevisionBefore !== undefined && workflowRevisionBefore !== null && r.workflowRevisionBefore !== workflowRevisionBefore) return false;
    if (preDiscoveryRevision !== undefined && preDiscoveryRevision !== null && r.preDiscoveryRevision !== preDiscoveryRevision) return false;
    if (preDiscoveryFingerprint && r.preDiscoveryFingerprint !== preDiscoveryFingerprint) return false;
    return true;
  });

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new ConsumptionReceiptError(
      `Multiple matching consumption receipts found (${matches.length}) for fingerprint ${interactionFingerprint}`,
      'DK_RECEIPT_AMBIGUOUS'
    );
  }
  return matches[0];
}