import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto.js';
import { getUser, upsertUser } from './storage.js';

describe('token encryption', () => {
  it('round trips refresh tokens', async () => {
    const ciphertext = await encryptSecret('spotify-refresh-token');
    expect(ciphertext).not.toContain('spotify-refresh-token');
    expect(await decryptSecret(ciphertext)).toBe('spotify-refresh-token');
  });

  it('keeps an existing refresh token when Spotify omits it on reauthorization', async () => {
    const first = await upsertUser({ spotifyUserId: 'spotify-repeat-user', displayName: 'First', avatarUrl: null, refreshToken: 'first-refresh-token' });
    const second = await upsertUser({ spotifyUserId: 'spotify-repeat-user', displayName: 'Updated', avatarUrl: null });

    expect(second.refresh_token_ciphertext).toBe(first.refresh_token_ciphertext);
    expect(await decryptSecret((await getUser(first.id)).refresh_token_ciphertext)).toBe('first-refresh-token');
  });
});
