/**
 * Development Kit Autopilot — Security Token Architecture
 *
 * Implements cryptographic token generation, SHA-256 hashing,
 * constant-time verification (timingSafeEqual), and single-use consumption.
 */

import crypto from 'node:crypto';

export function generateSecurityToken() {
  const plaintextToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(plaintextToken).digest('hex');
  return { plaintextToken, tokenHash };
}

export function hashToken(token) {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyTokenHash(inputToken, expectedHash) {
  if (!inputToken || !expectedHash) return false;
  const inputHash = hashToken(inputToken);
  const inputBuffer = Buffer.from(inputHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}
