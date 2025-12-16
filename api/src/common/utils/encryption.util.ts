/**
 * Encryption Utilities
 *
 * Provides AES-256-GCM encryption/decryption for sensitive configuration values.
 * Uses a key derived from ENCRYPTION_SECRET environment variable.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SALT = 'danny-tasks-encryption-salt';

/**
 * Get encryption key from environment or use default
 * WARNING: In production, always set ENCRYPTION_SECRET to a strong random value
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || 'danny-tasks-default-secret-change-me';
  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypt a string value using AES-256-GCM
 * @param text Plain text to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedText
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string value encrypted with AES-256-GCM
 * @param encrypted Encrypted string in format: iv:authTag:encryptedText
 * @returns Decrypted plain text
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');

  if (!ivHex || !authTagHex || !encryptedText) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a value appears to be encrypted
 * @param value Value to check
 * @returns True if value looks like encrypted format (iv:authTag:encrypted)
 */
export function isEncrypted(value: string): boolean {
  return value.includes(':') && value.split(':').length === 3;
}
