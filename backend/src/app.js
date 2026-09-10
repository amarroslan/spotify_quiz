import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { decryptRefreshToken, deleteSession, getAccessToken as readAccessToken, getLyricsCache, getQuizCache, getSession, getUser, incrementRateLimit, saveAccessToken, saveAttempt, saveLyricsCache, saveQuizCache, saveSession, storageMode, upsertUser } from './storage.js';

const app = express();
const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3001/api/auth/callback';
const scopes = ['user-read-private', 'user-top-read', 'user-read-recently-played'].join(' ');
const sessionCookie = 'spotify_session';

app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json({ limit: '32kb' }));

const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key]) => key));
const cookieOptions = () => `Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
const ensureSession = async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  let id = cookies[sessionCookie];
  let session = id ? await getSession(id) : null;
  if (!id || !session) { id = randomBytes(32).toString('base64url'); session = {}; res.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(id)}; ${cookieOptions()}`); }
  req.sessionId = id;
  req.userSession = session;
  return session;
};

app.use(async (req, res, next) => { try { await ensureSession(req, res); next(); } catch (error) { next(error); } });

const requireConfig = () => { if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) throw new Error('Spotify credentials are missing.'); };
const spotifyTokenAuth = () => `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
const jsonError = (status, error, detail) => Object.assign(new Error(error), { status, code: error, detail });

export function buildSpotifyAuthorizeUrl({ clientId, redirectUri: callbackUri, state, scope }) {
  const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: callbackUri, state, scope, show_dialog: 'true' });
  return `https://accounts.spotify.com/authorize?${params}`;
}

async function fetchWithTimeout(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  return response;
}

async function spotifyFetch(path, accessToken, attempt = 0) {
  const response = await fetchWithTimeout(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.ok) return response.json();
  const detail = await response.text();
  if ((response.status === 429 || response.status >= 500) && attempt < 1) {
    const retryAfter = Math.min(Number(response.headers.get('retry-after') || 1), 3);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return spotifyFetch(path, accessToken, attempt + 1);
  }
  throw jsonError(response.status, response.status === 401 ? 'spotify_unauthorized' : response.status === 429 ? 'spotify_rate_limited' : 'spotify_request_failed', detail);
}

async function lyricsForTrack(track) {
  const artist = track.artists?.[0]?.name;
  const title = track.name;
  if (!artist || !title) return null;
  const cacheKey = createHash('sha256').update(`${artist}\u0000${title}`).digest('hex');
  const cached = await getLyricsCache(cacheKey);
  if (cached && Object.prototype.hasOwnProperty.call(cached, 'lyrics')) return cached.lyrics;
  try {
    const endpoint = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const response = await fetchWithTimeout(endpoint);
    if (response.status === 404) { await saveLyricsCache(cacheKey, { lyrics: null }); return null; }
    if (!response.ok) return null;
    const body = await response.json();
    const lyrics = typeof body.lyrics === 'string' ? body.lyrics.trim().slice(0, 6000) : null;
    await saveLyricsCache(cacheKey, { lyrics });
    return lyrics;
  } catch {
    return null;
  }
}

async function refreshToken(userId, user) {
  const refreshToken = await decryptRefreshToken(user);
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  const response = await fetchWithTimeout('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: spotifyTokenAuth() }, body });
  if (!response.ok) throw jsonError(401, 'refresh_required', await response.text());
  const tokens = await response.json();
  const expiresIn = Number(tokens.expires_in || 3600);
  await saveAccessToken(userId, { accessToken: tokens.access_token, expiresAt: Date.now() + expiresIn * 1000 }, Math.max(expiresIn - 60, 60));
  return tokens.access_token;
}

async function accessTokenFor(req) {
  if (!req.userSession?.userId) throw jsonError(401, 'not_authenticated');
  const user = await getUser(req.userSession.userId);
  if (!user) throw jsonError(401, 'not_authenticated');
  const cached = await readAccessToken(user.id);
  if (cached?.accessToken && cached.expiresAt > Date.now() + 60_000) return { token: cached.accessToken, user };
  return { token: await refreshToken(user.id, user), user };
}

async function rateLimit(req, bucket, limit) {
  const identity = req.userSession?.userId || req.headers['x-forwarded-for']?.split(',')[0] || 'anonymous';
  const count = await incrementRateLimit(`rate:${bucket}:${identity}:${Math.floor(Date.now() / 60_000)}`, 60);
  if (count > limit) throw jsonError(429, 'rate_limited');
}

app.get('/api/auth/login', async (req, res, next) => { try { requireConfig(); await rateLimit(req, 'login', 10); req.userSession.oauthState = randomUUID(); await saveSession(req.sessionId, req.userSession); res.redirect(buildSpotifyAuthorizeUrl({ clientId: process.env.SPOTIFY_CLIENT_ID, redirectUri, state: req.userSession.oauthState, scope: scopes })); } catch (error) { next(error); } });

app.get('/api/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(error)}`);
  if (!code || !state || state !== req.userSession.oauthState) return res.redirect(`${frontendUrl}/?auth_error=state_mismatch`);
  try {
    requireConfig();
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    const tokenResponse = await fetchWithTimeout('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: spotifyTokenAuth() }, body });
    if (!tokenResponse.ok) {
      const detail = (await tokenResponse.text()).slice(0, 300);
      throw jsonError(401, 'spotify_token_exchange_failed', detail);
    }
    const tokens = await tokenResponse.json();
    const profile = await spotifyFetch('/me', tokens.access_token);
    const user = await upsertUser({ spotifyUserId: profile.id, displayName: profile.display_name, avatarUrl: profile.images?.[0]?.url || null, refreshToken: tokens.refresh_token });
    const expiresIn = Number(tokens.expires_in || 3600);
    await saveAccessToken(user.id, { accessToken: tokens.access_token, expiresAt: Date.now() + expiresIn * 1000 }, Math.max(expiresIn - 60, 60));
    req.userSession = { userId: user.id, spotifyUserId: profile.id };
    await saveSession(req.sessionId, req.userSession);
    res.redirect(`${frontendUrl}/?auth=success`);
  } catch (callbackError) {
    console.error(callbackError.code || callbackError.message);
    const authError = callbackError.code === 'refresh_token_missing' ? 'refresh_token_missing' : callbackError.code === 'spotify_token_exchange_failed' && /not registered|user not registered/i.test(callbackError.detail || '') ? 'not_registered' : 'token_exchange_failed';
    res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(authError)}`);
  }
});

app.post('/api/auth/logout', async (req, res, next) => { try { await deleteSession(req.sessionId); res.setHeader('Set-Cookie', `${sessionCookie}=; ${cookieOptions()}; Max-Age=0`); res.status(204).end(); } catch (error) { next(error); } });

app.get('/api/me', async (req, res, next) => { try { await rateLimit(req, 'me', 60); const { token } = await accessTokenFor(req); res.json(await spotifyFetch('/me', token)); } catch (error) { next(error); } });

app.get('/api/quiz-data', async (req, res, next) => {
  try {
    await rateLimit(req, 'quiz-data', 30);
    const { token, user } = await accessTokenFor(req);
    const cached = await getQuizCache(user.spotify_user_id);
    if (cached?.payload) return sendWithEtag(req, res, cached.payload, 'HIT');
    const [profile, topArtistsResponse, topTracksResponse, recentlyPlayedResponse] = await Promise.all([
      spotifyFetch('/me', token),
      spotifyFetch('/me/top/artists?time_range=medium_term&limit=50', token),
      spotifyFetch('/me/top/tracks?time_range=medium_term&limit=50', token),
      spotifyFetch('/me/player/recently-played?limit=50', token),
    ]);
    const topArtists = topArtistsResponse.items || [];
    const topTracks = topTracksResponse.items || [];
    const lyricPairs = await Promise.all(topTracks.slice(0, 30).map(async (track) => [track.id, await lyricsForTrack(track)]));
    const lyricsByTrack = Object.fromEntries(lyricPairs.filter(([, lyrics]) => Boolean(lyrics)));
    const payload = { profile, topArtists, topTracks, recentlyPlayed: recentlyPlayedResponse.items || [], lyricsByTrack };
    await saveQuizCache(user.spotify_user_id, { payload, cachedAt: Date.now() }, 300);
    return sendWithEtag(req, res, payload, 'MISS');
  } catch (error) {
    if (error.code === 'spotify_rate_limited' || error.status >= 500) { const { user } = req.userSession?.userId ? await accessTokenFor(req).catch(() => ({ user: null })) : { user: null }; const stale = user ? await getQuizCache(user.spotify_user_id) : null; if (stale?.payload && Date.now() - stale.cachedAt < 15 * 60_000) return sendWithEtag(req, res, stale.payload, 'STALE'); }
    next(error);
  }
});

app.post('/api/quiz-attempts', async (req, res, next) => { try { await rateLimit(req, 'attempts', 20); if (!Number.isInteger(req.body?.score) || !Number.isInteger(req.body?.total) || req.body.score < 0 || req.body.total < 1 || req.body.score > req.body.total) throw jsonError(400, 'invalid_score'); const { user } = await accessTokenFor(req); const attempt = await saveAttempt({ userId: user.id, score: req.body.score, total: req.body.total, quizVersion: String(req.body.quizVersion || 'v1') }); res.status(201).json({ id: attempt.id, score: attempt.score, total: attempt.total }); } catch (error) { next(error); } });

app.get('/api/health', (_req, res) => res.json({ ok: true, storage: storageMode }));

function sendWithEtag(req, res, payload, cacheStatus) { const body = JSON.stringify(payload); const etag = `"${createHash('sha256').update(body).digest('hex')}"`; res.setHeader('ETag', etag); res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300'); res.setHeader('X-Cache', cacheStatus); if (req.headers['if-none-match'] === etag) return res.status(304).end(); return res.type('json').send(body); }

app.use((error, _req, res, _next) => { const status = error.status || 500; res.status(status).json({ error: error.code || 'internal_error', detail: process.env.NODE_ENV === 'production' ? undefined : error.message }); });

export default app;
