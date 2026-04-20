import 'dotenv/config';
import { createDecipheriv, createSecretKey, pbkdf2Sync } from 'crypto';
import fs from 'fs';
import mysql from 'mysql2/promise';

const ENCRYPTION_SALT_FILE = '.encryption-salt';
const ENCRYPTION_SALT_LENGTH = 32;

function getOrCreateEncryptionSalt() {
  try {
    if (fs.existsSync(ENCRYPTION_SALT_FILE)) {
      const existingSalt = fs.readFileSync(ENCRYPTION_SALT_FILE, 'utf8').trim();
      if (existingSalt.length === ENCRYPTION_SALT_LENGTH * 2) {
        return existingSalt;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  const salt = getOrCreateEncryptionSalt();
  if (!salt) throw new Error('Salt not found');
  return createSecretKey(pbkdf2Sync(secret, salt, 100_000, 32, 'sha256'));
}

function decryptSecret(payload) {
  if (!payload) return null;
  const parsed = JSON.parse(payload);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(parsed.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(parsed.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.content, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

const db = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await db.execute(
  'SELECT id, name, apiKeyEncrypted FROM ai_provider_settings WHERE isActive = 1 LIMIT 1'
);
await db.end();

const provider = rows[0];
console.log('Provider:', provider.name);
console.log('Encrypted:', provider.apiKeyEncrypted?.slice(0, 50));

try {
  const decrypted = decryptSecret(provider.apiKeyEncrypted);
  console.log('Decrypted prefix:', decrypted ? `${decrypted.slice(0, 4)}...` : null);
  console.log('Decrypted length:', decrypted?.length);
} catch (e) {
  console.error('Decryption failed:', e.message);
}
