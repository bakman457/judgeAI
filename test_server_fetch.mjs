import mysql from 'mysql2/promise';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.JWT_SECRET || 'desktop-local-secret-min-32-chars-long!!';

function getKey() {
  return createHash('sha256').update(ENCRYPTION_KEY).digest();
}

function decryptSecret(encrypted) {
  if (!encrypted) return null;
  try {
    const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return encrypted;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encrypted;
  }
}

const db = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'judge_ai',
});

const [rows] = await db.execute(
  'SELECT * FROM ai_provider_settings WHERE isActive = 1 LIMIT 1'
);
const provider = rows[0];
await db.end();

console.log('Provider:', provider.name, provider.providerType, provider.endpoint, provider.model);

const apiKey = decryptSecret(provider.apiKeyEncrypted);
console.log('API key length:', apiKey?.length);
console.log('API key prefix:', apiKey?.slice(0, 20));

const endpoint = provider.endpoint.trim().replace(/\/$/, '');
const finalEndpoint = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
console.log('Final endpoint:', finalEndpoint);

const systemPrompt = 'You are a legal assistant. Generate a structured judicial draft.';
const userPrompt = 'Case: Medical malpractice during gallbladder surgery. Patient suffered liver damage. Generate a JSON response with sections: introduction, facts, legal_reasoning, decision, costs.';

const isAlibaba = provider.providerType === 'alibaba_cloud';
const systemContent = isAlibaba
  ? `${systemPrompt}\n\nYou must respond with a single valid JSON object matching the requested structure. Do not wrap the JSON in markdown code blocks.`
  : systemPrompt;

const payload = {
  model: provider.model,
  temperature: Number(provider.draftTemperature ?? '0.2'),
  messages: [
    { role: 'system', content: systemContent },
    { role: 'user', content: userPrompt },
  ],
};

if (!isAlibaba) {
  payload.response_format = { type: 'json_schema' };
}

console.log('isAlibaba:', isAlibaba);
console.log('Payload has response_format:', 'response_format' in payload);
console.log('Payload size:', JSON.stringify(payload).length);

console.log('Making fetch call...');
try {
  const response = await fetch(finalEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });
  console.log('Response status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response body:', text.slice(0, 500));
} catch (err) {
  console.error('FETCH FAILED:', err.message);
  console.error('Cause:', err.cause?.message, err.cause?.code);
  console.error(err.stack);
}
