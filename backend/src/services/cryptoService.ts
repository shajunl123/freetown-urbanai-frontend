import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  tag: string;
}

function keyFromEnv(envName: string): Buffer | null {
  const raw = process.env[envName]?.trim();
  if (!raw) return null;
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return createHash('sha256').update(raw).digest();
}

export function encryptWithEnvKey(plainText: string, envName: string): EncryptedValue | null {
  const key = keyFromEnv(envName);
  if (!key) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptWithEnvKey(value: EncryptedValue, envName: string): string | null {
  const key = keyFromEnv(envName);
  if (!key) return null;

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
