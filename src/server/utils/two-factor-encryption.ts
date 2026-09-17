import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const encodedKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY is not configured",
    );
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY must decode to exactly 32 bytes",
    );
  }

  return key;
}

export function encryptTwoFactorSecret(secret: string): string {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptTwoFactorSecret(
  encryptedSecret: string,
): string {
  const key = getEncryptionKey();

  const parts = encryptedSecret.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted two-factor secret");
  }

  const [ivBase64, authTagBase64, encryptedBase64] = parts;

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid encryption IV");
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encryption auth tag");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv,
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}