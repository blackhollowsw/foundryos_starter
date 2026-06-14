// FILE: src/lib/credentialCrypto.js
// Purpose: AES-256-GCM encryption for sensitive credentials stored in the DB.
// Decryption failures return null (logged as warnings) rather than crashing.
//
// Key management:
//   - Generate key: node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('base64'))"
//   - Store in Norton password manager
//   - Set as CREDENTIAL_ENCRYPTION_KEY env var
//   - WARNING: rotating the key makes existing encrypted values unreadable

import crypto from "crypto";

const ALGORITHM       = "aes-256-gcm";
const IV_LENGTH       = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) throw new Error("Missing CREDENTIAL_ENCRYPTION_KEY environment variable.");

  const decoded = Buffer.from(key, "base64");
  if (decoded.length !== 32) throw new Error("CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");

  return decoded;
}

/**
 * Encrypt a plaintext string. Returns a "iv.authTag.ciphertext" string.
 */
export function encryptCredential(value) {
  if (!value) return null;
  const key = getEncryptionKey();
  const iv  = crypto.randomBytes(IV_LENGTH);

  const cipher    = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

/**
 * Decrypt a credential string produced by encryptCredential().
 * Throws on invalid format or tampered data.
 */
export function decryptCredential(encryptedValue) {
  if (!encryptedValue) return null;
  const key = getEncryptionKey();

  const [ivB64, authTagB64, encryptedB64] = encryptedValue.split(".");
  if (!ivB64 || !authTagB64 || !encryptedB64) throw new Error("Invalid encrypted credential format.");

  const iv        = Buffer.from(ivB64,        "base64");
  const authTag   = Buffer.from(authTagB64,   "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  if (authTag.length !== AUTH_TAG_LENGTH) throw new Error("Invalid encrypted credential auth tag.");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Safe wrapper for use in cron/background jobs.
 * Returns null and logs a warning on failure instead of throwing.
 */
export function safeDecryptCredential(encryptedValue, keyName = "unknown", resourceId = "unknown") {
  if (!encryptedValue) return null;
  try {
    return decryptCredential(encryptedValue);
  } catch (err) {
    console.warn(`[credentialCrypto] Decryption failed for key "${keyName}" on resource ${resourceId}: ${err.message}`);
    return null;
  }
}
