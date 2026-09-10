import { describe, expect, it } from 'vitest';
import { buildSpotifyAuthorizeUrl } from './app.js';

describe('Spotify authorization request', () => {
  it('forces Spotify to show the account chooser for repeat or shared-browser logins', () => {
    const url = new URL(buildSpotifyAuthorizeUrl({ clientId: 'client', redirectUri: 'https://example.com/callback', state: 'state', scope: 'user-read-private' }));

    expect(url.searchParams.get('show_dialog')).toBe('true');
    expect(url.searchParams.get('state')).toBe('state');
  });
});
