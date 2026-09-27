import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const LOGIN_LIFETIME_MS = 5 * 60_000;
export const SESSION_IDLE_MS = 30 * 60_000;
export const SESSION_ABSOLUTE_MS = 14 * 60 * 60_000;

export function opaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function protect(value: string, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

export function reveal(payload: Buffer, key: Buffer): string {
  if (payload.length < 28) throw new Error('Protected auth value is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  try {
    return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Protected auth value is invalid.');
  }
}

export function equalSecret(expected: string, submitted: string): boolean {
  const left = createHash('sha256').update(expected).digest();
  const right = createHash('sha256').update(submitted).digest();
  return timingSafeEqual(left, right);
}
