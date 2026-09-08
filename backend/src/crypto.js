import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const encryptionKey = () => createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'local-development-secret').digest();

export async function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export async function decryptSecret(payload) {
  const [ivValue, tagValue, encryptedValue] = payload.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}
