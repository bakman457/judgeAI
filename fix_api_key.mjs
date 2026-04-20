import { createCipheriv, createHash, pbkdf2Sync, randomBytes } from 'crypto';
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
    const newSalt = randomBytes(ENCRYPTION_SALT_LENGTH).toString('hex');
    fs.writeFileSync(ENCRYPTION_SALT_FILE, newSalt, { encoding: 'utf8' });
    return newSalt;
  } catch (error) {
    console.error('[Encryption] Failed to manage salt file:', error);
    return createHash('sha256').update(`fallback-${process.pid}-${Date.now()}`).digest('hex').slice(0, ENCRYPTION_SALT_LENGTH * 2);
  }
}

function encryptionKey() {
  const secret = process.env.JWT_SECRET || 'desktop-local-secret-min-32-chars-long!!';
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  const salt = getOrCreateEncryptionSalt();
  return pbkdf2Sync(secret, Buffer.from(salt, 'hex'), 100_000, 32, 'sha256');
}

function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    content: encrypted.toString('base64'),
  });
}

const API_KEY = 'sk-e1d320343fac4883a60841aceeb76e9b';
const encryptedKey = encryptSecret(API_KEY);

console.log('Encrypted API key with current salt:', encryptedKey.slice(0, 60) + '...');

const db = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'judge_ai',
});

await db.execute(
  'UPDATE ai_provider_settings SET apiKeyEncrypted = ? WHERE isActive = 1',
  [encryptedKey]
);

const [rows] = await db.execute('SELECT id, name, apiKeyEncrypted FROM ai_provider_settings WHERE isActive = 1');
console.log('Updated provider:', rows[0].name, 'ID:', rows[0].id);

await db.end();
console.log('Done! The API key has been re-encrypted with the current salt.');
