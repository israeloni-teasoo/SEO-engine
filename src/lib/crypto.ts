import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

// AES-256-GCM encryption for secrets stored in the database (WordPress
// application password, LinkedIn access tokens). The key is derived from
// ENCRYPTION_KEY (any string) so ops can set a passphrase; a 32-byte key is
// derived via SHA-256. Ciphertext format: base64(iv).base64(tag).base64(data).

function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY is not set — required to store credentials securely.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed ciphertext.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptionConfigured(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY);
}
