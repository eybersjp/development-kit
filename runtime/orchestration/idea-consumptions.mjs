/**
 * DKF IDEA Authority — append-only, hash-chained interaction consumption receipts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const IDEA_CONSUMPTIONS_SCHEMA_VERSION = '1.0.0';

export class IdeaConsumptionError extends Error {
  constructor(message, code = 'DK_IDEA_CONSUMPTION_ERROR', details = null) {
    super(message);
    this.name = 'IdeaConsumptionError';
    this.code = code;
    this.details = details;
  }
}

function fail(message, code = 'DK_IDEA_CONSUMPTION_INVALID', details = null) {
  throw new IdeaConsumptionError(message, code, details);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
}

export function getIdeaConsumptionsPath(rootDir = process.cwd()) {
  return path.join(rootDir, '.development-kit', 'idea', 'consumptions.json');
}

function receiptFingerprint(receipt) {
  const payload = { ...receipt };
  delete payload.receiptFingerprint;
  return sha(payload);
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, filePath);
}

export function validateIdeaConsumptionReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) fail('Receipt must be an object', 'DK_IDEA_RECEIPT_CORRUPT');
  if (receipt.schemaVersion !== IDEA_CONSUMPTIONS_SCHEMA_VERSION) fail('Unsupported receipt schemaVersion', 'DK_IDEA_RECEIPT_CORRUPT');
  if (!Number.isSafeInteger(receipt.sequence) || receipt.sequence < 1) fail('Invalid receipt sequence', 'DK_IDEA_RECEIPT_CORRUPT');
  if (receipt.previousReceiptFingerprint !== null && !/^sha256:[a-f0-9]{64}$/.test(receipt.previousReceiptFingerprint)) fail('Invalid previous receipt fingerprint', 'DK_IDEA_RECEIPT_CORRUPT');
  if (!/^sha256:[a-f0-9]{64}$/.test(receipt.interactionFingerprint || '')) fail('Invalid interaction fingerprint', 'DK_IDEA_RECEIPT_CORRUPT');
  if (!Number.isSafeInteger(receipt.workflowRevisionBefore) || receipt.workflowRevisionBefore < 0) fail('Invalid workflow revision', 'DK_IDEA_RECEIPT_CORRUPT');
  for (const field of ['preDiscoveryRevision', 'postDiscoveryRevision']) {
    if (!Number.isSafeInteger(receipt[field]) || receipt[field] < 0) fail(`Invalid ${field}`, 'DK_IDEA_RECEIPT_CORRUPT');
  }
  for (const field of ['preDiscoveryFingerprint', 'postDiscoveryFingerprint']) {
    if (!/^sha256:[a-f0-9]{64}$/.test(receipt[field] || '')) fail(`Invalid ${field}`, 'DK_IDEA_RECEIPT_CORRUPT');
  }
  if (receipt.authority !== 'PRODUCT_OWNER') fail('Receipt authority must be PRODUCT_OWNER', 'DK_IDEA_RECEIPT_CORRUPT');
  if (!Array.isArray(receipt.resultingDecisionIds)) fail('resultingDecisionIds must be an array', 'DK_IDEA_RECEIPT_CORRUPT');
  if (typeof receipt.action !== 'string' || !receipt.action.trim()) fail('Receipt action is required', 'DK_IDEA_RECEIPT_CORRUPT');
  if (typeof receipt.timestamp !== 'string' || Number.isNaN(Date.parse(receipt.timestamp))) fail('Invalid receipt timestamp', 'DK_IDEA_RECEIPT_CORRUPT');
  const expected = receiptFingerprint(receipt);
  if (receipt.receiptFingerprint !== expected) fail('Receipt fingerprint mismatch', 'DK_IDEA_RECEIPT_INTEGRITY_MISMATCH', { expected, actual: receipt.receiptFingerprint });
  return true;
}

export function loadIdeaConsumptions(rootDir = process.cwd()) {
  const filePath = getIdeaConsumptionsPath(rootDir);
  if (!fs.existsSync(filePath)) return [];
  let list;
  try {
    list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Unable to parse IDEA consumptions: ${error.message}`, 'DK_IDEA_RECEIPTS_CORRUPT');
  }
  if (!Array.isArray(list)) fail('IDEA consumptions must be an array', 'DK_IDEA_RECEIPTS_CORRUPT');
  let previous = null;
  for (let i = 0; i < list.length; i += 1) {
    const receipt = list[i];
    validateIdeaConsumptionReceipt(receipt);
    if (receipt.sequence !== i + 1) fail('IDEA receipt sequence is broken', 'DK_IDEA_RECEIPT_CHAIN_BROKEN');
    if (receipt.previousReceiptFingerprint !== previous) fail('IDEA receipt hash chain is broken', 'DK_IDEA_RECEIPT_CHAIN_BROKEN');
    previous = receipt.receiptFingerprint;
  }
  return list;
}

export function findConsumedInteraction(rootDir = process.cwd(), {
  interactionFingerprint,
  workflowRevisionBefore,
  preDiscoveryRevision,
  preDiscoveryFingerprint,
} = {}) {
  return loadIdeaConsumptions(rootDir).find((receipt) =>
    receipt.interactionFingerprint === interactionFingerprint
    && receipt.workflowRevisionBefore === workflowRevisionBefore
    && receipt.preDiscoveryRevision === preDiscoveryRevision
    && receipt.preDiscoveryFingerprint === preDiscoveryFingerprint
  ) ?? null;
}

export function appendIdeaConsumption(rootDir = process.cwd(), {
  interactionType,
  interactionId,
  interactionFingerprint,
  workflowRevisionBefore,
  preDiscoveryRevision,
  preDiscoveryFingerprint,
  postDiscoveryRevision,
  postDiscoveryFingerprint,
  authority,
  action,
  resultingDecisionIds = [],
  artifactApprovalId = null,
} = {}) {
  if (authority !== 'PRODUCT_OWNER') fail("Explicit authority='PRODUCT_OWNER' is required", 'DK_IDEA_UNAUTHORIZED');
  const current = loadIdeaConsumptions(rootDir);
  if (findConsumedInteraction(rootDir, {
    interactionFingerprint,
    workflowRevisionBefore,
    preDiscoveryRevision,
    preDiscoveryFingerprint,
  })) {
    fail('The exact persisted IDEA interaction has already been consumed', 'DK_INTERACTION_ALREADY_CONSUMED');
  }

  const receipt = {
    schemaVersion: IDEA_CONSUMPTIONS_SCHEMA_VERSION,
    sequence: current.length + 1,
    previousReceiptFingerprint: current.at(-1)?.receiptFingerprint ?? null,
    interactionType,
    interactionId: interactionId ?? null,
    interactionFingerprint,
    workflowRevisionBefore,
    preDiscoveryRevision,
    preDiscoveryFingerprint,
    postDiscoveryRevision,
    postDiscoveryFingerprint,
    authority,
    action: String(action || '').trim(),
    resultingDecisionIds: [...new Set(resultingDecisionIds)],
    artifactApprovalId: artifactApprovalId ?? null,
    timestamp: new Date().toISOString(),
  };
  receipt.receiptFingerprint = receiptFingerprint(receipt);
  validateIdeaConsumptionReceipt(receipt);
  atomicWrite(getIdeaConsumptionsPath(rootDir), [...current, receipt]);
  return receipt;
}
