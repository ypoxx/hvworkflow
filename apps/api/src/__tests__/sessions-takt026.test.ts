import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { protect, reveal } from '../auth/sessions.ts';

// takt-026: AES-256-GCM must only accept the full 16-byte authentication tag (Semgrep
// gcm-no-tag-length). A shortened or altered tag, IV or ciphertext is rejected with one fixed error.
describe('takt-026 protected auth values', () => {
  const key = randomBytes(32);

  it('round-trips a value', () => {
    expect(reveal(protect('csrf-value', key), key)).toBe('csrf-value');
  });

  it('rejects a payload whose tag is cut short', () => {
    const sealed = protect('csrf-value', key);
    const shortTag = Buffer.concat([sealed.subarray(0, 12), sealed.subarray(12, 16)]);
    expect(() => reveal(shortTag, key)).toThrow('Protected auth value is invalid.');
  });

  it('rejects an altered tag, IV or ciphertext and a foreign key', () => {
    const sealed = protect('csrf-value', key);
    for (const index of [0, 12, 27, sealed.length - 1]) {
      const tampered = Buffer.from(sealed);
      tampered[index] = tampered[index]! ^ 0x01;
      expect(() => reveal(tampered, key)).toThrow('Protected auth value is invalid.');
    }
    expect(() => reveal(sealed, randomBytes(32))).toThrow('Protected auth value is invalid.');
  });
});
