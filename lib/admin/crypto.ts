// Symmetric encryption for secrets stored in the database (courier API keys).
// AES-256-GCM, authenticated. The master key is derived from a server-only env
// secret, so a database dump never yields usable credentials.
//
// Key source: SETTINGS_ENCRYPTION_KEY if set, else ADMIN_SESSION_SECRET (always
// present — session.ts throws without it), so this works with zero extra setup.
// Consequence: rotating ADMIN_SESSION_SECRET without SETTINGS_ENCRYPTION_KEY set
// makes existing ciphertexts undecryptable — handled gracefully (treated as
// "not configured"; the operator re-enters the key in the admin UI).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const VERSION = "v1";
const KDF_SALT = "lampino.settings.secret.v1";

let cachedKey: Buffer | null = null;

function derivedKey(): Buffer {
  if (cachedKey) return cachedKey;
  const material = process.env.SETTINGS_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET;
  if (!material) {
    throw new Error(
      "Cannot encrypt secrets: set SETTINGS_ENCRYPTION_KEY or ADMIN_SESSION_SECRET.",
    );
  }
  // The input is already high-entropy, so scrypt here normalizes it to 32 bytes
  // rather than stretching a weak password; a fixed salt is therefore fine.
  cachedKey = scryptSync(material, KDF_SALT, 32);
  return cachedKey;
}

/** Encrypt a plaintext secret. Empty input returns "" (= not configured). */
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

/**
 * Decrypt a token produced by `encryptSecret`. Returns null for empty input,
 * a malformed/unknown-version token, or any auth/decrypt failure (wrong key,
 * tampering) — callers treat null as "no usable key".
 */
export function decryptSecret(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const [, ivB, tagB, dataB] = parts;
    const decipher = createDecipheriv("aes-256-gcm", derivedKey(), Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB, "base64url")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** Whether a stored value looks like a configured (non-empty) secret. */
export function hasSecret(token: string | null | undefined): boolean {
  return Boolean(token && token.length > 0);
}
