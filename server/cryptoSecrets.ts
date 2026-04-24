import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSecretKey,
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";

const LOCAL_DATA_DIR = process.env.JUDGE_AI_DATA_DIR ?? process.cwd();
const ENCRYPTION_SALT_FILE = path.join(LOCAL_DATA_DIR, ".encryption-salt");
const ENCRYPTION_SALT_BACKUP_FILE = path.join(LOCAL_DATA_DIR, ".encryption-salt.backup");
const ENCRYPTION_SALT_LENGTH = 32;

function isValidSalt(value: string): boolean {
  return value.length === ENCRYPTION_SALT_LENGTH * 2 && /^[0-9a-fA-F]+$/.test(value);
}

function writeSaltFile(targetPath: string, salt: string): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, salt, { encoding: "utf8", mode: 0o600 });
}

/**
 * Get or create a unique encryption salt for this installation. Keeps a
 * backup copy so an accidental delete of the primary file does not make
 * every saved API key permanently unreadable.
 */
export function getOrCreateEncryptionSalt(): string {
  try {
    const primaryExists = fs.existsSync(ENCRYPTION_SALT_FILE);
    const backupExists = fs.existsSync(ENCRYPTION_SALT_BACKUP_FILE);

    let salt: string | null = null;
    if (primaryExists) {
      const raw = fs.readFileSync(ENCRYPTION_SALT_FILE, "utf8").trim();
      if (isValidSalt(raw)) salt = raw;
    }

    if (!salt && backupExists) {
      const raw = fs.readFileSync(ENCRYPTION_SALT_BACKUP_FILE, "utf8").trim();
      if (isValidSalt(raw)) {
        console.warn("[Encryption] Primary salt missing/invalid — restoring from backup.");
        salt = raw;
        writeSaltFile(ENCRYPTION_SALT_FILE, salt);
      }
    }

    if (!salt) {
      salt = randomBytes(ENCRYPTION_SALT_LENGTH).toString("hex");
      writeSaltFile(ENCRYPTION_SALT_FILE, salt);
    }

    if (!backupExists || !fs.existsSync(ENCRYPTION_SALT_BACKUP_FILE)) {
      writeSaltFile(ENCRYPTION_SALT_BACKUP_FILE, salt);
    } else {
      const backupRaw = fs.readFileSync(ENCRYPTION_SALT_BACKUP_FILE, "utf8").trim();
      if (backupRaw !== salt) {
        writeSaltFile(ENCRYPTION_SALT_BACKUP_FILE, salt);
      }
    }

    return salt;
  } catch (error) {
    console.error("[Encryption] Failed to manage salt file, using deterministic fallback:", error);
    return createHash("sha256")
      .update(`judge-ai-stable-salt-${ENV.providerEncryptionSecret}`)
      .digest("hex");
  }
}

function encryptionKey() {
  const secret = ENV.providerEncryptionSecret;
  if (!secret || secret.length < 32) {
    throw new Error(
      "PROVIDER_ENCRYPTION_SECRET (or JWT_SECRET fallback) must be set and at least 32 characters for encryption",
    );
  }
  const salt = getOrCreateEncryptionSalt();
  const key = pbkdf2Sync(secret, salt, 100_000, 32, "sha256");
  return createSecretKey(key);
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    content: encrypted.toString("base64"),
  });
}

export function decryptSecret(payload?: string | null) {
  if (!payload) return null;
  const parsed = JSON.parse(payload) as { iv: string; authTag: string; content: string };
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(parsed.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(parsed.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.content, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function decryptProviderApiKey(payload?: string | null) {
  try {
    return decryptSecret(payload);
  } catch (error) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "The selected AI provider API key can no longer be decrypted. Please save the provider settings again with the API key.",
      cause: error,
    });
  }
}
