import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto.js';

describe('token encryption', () => {
  it('round trips refresh tokens', async () => {
    const ciphertext = await encryptSecret('spotify-refresh-token');
    expect(ciphertext).not.toContain('spotify-refresh-token');
    expect(await decryptSecret(ciphertext)).toBe('spotify-refresh-token');
  });
});
