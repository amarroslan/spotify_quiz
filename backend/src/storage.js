import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto.js';

const memory = new Map();
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const hasRedis = Boolean(redisUrl && redisToken);
const redis = hasRedis ? new Redis({ url: redisUrl, token: redisToken }) : null;
const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, '');
const supabaseKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
const hasDatabase = Boolean(supabaseUrl && supabaseKey);
const supabase = hasDatabase ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }) : null;

const getMemory = (key) => {
  const record = memory.get(key);
  if (!record || (record.expiresAt && record.expiresAt < Date.now())) { memory.delete(key); return null; }
  return record.value;
};

export async function getJson(key) {
  if (redis) return redis.get(key);
  return getMemory(key);
}

export async function setJson(key, value, ttlSeconds) {
  if (redis) { await redis.set(key, value, { ex: ttlSeconds }); return; }
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function deleteKey(key) {
  if (redis) { await redis.del(key); return; }
  memory.delete(key);
}

export async function incrementRateLimit(key, ttlSeconds) {
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttlSeconds);
    return count;
  }
  const current = getMemory(key) || 0;
  await setJson(key, current + 1, ttlSeconds);
  return current + 1;
}

export async function getSession(sessionId) { return getJson(`session:${sessionId}`); }
export async function saveSession(sessionId, session) { return setJson(`session:${sessionId}`, session, 60 * 60 * 24 * 7); }
export async function deleteSession(sessionId) { return deleteKey(`session:${sessionId}`); }

export async function getAccessToken(userId) { return getJson(`spotify:access-token:${userId}`); }
export async function saveAccessToken(userId, value, ttlSeconds) { return setJson(`spotify:access-token:${userId}`, value, ttlSeconds); }

export async function getQuizCache(spotifyUserId) { return getJson(`spotify:quiz-data:v1:${spotifyUserId}`); }
export async function saveQuizCache(spotifyUserId, value, ttlSeconds = 300) { return setJson(`spotify:quiz-data:v1:${spotifyUserId}`, value, ttlSeconds); }

export async function upsertUser({ spotifyUserId, displayName, avatarUrl, refreshToken }) {
  const refreshTokenCiphertext = await encryptSecret(refreshToken);
  if (!supabase) {
    const id = memory.get(`user-id:${spotifyUserId}`)?.value || randomUUID();
    memory.set(`user-id:${spotifyUserId}`, { value: id });
    memory.set(`user:${id}`, { value: { id, spotify_user_id: spotifyUserId, display_name: displayName, avatar_url: avatarUrl, refresh_token_ciphertext: refreshTokenCiphertext } });
    return { id, spotify_user_id: spotifyUserId, display_name: displayName, avatar_url: avatarUrl, refresh_token_ciphertext: refreshTokenCiphertext };
  }
  const { data, error } = await supabase.from('users').upsert({ spotify_user_id: spotifyUserId, display_name: displayName, avatar_url: avatarUrl, refresh_token_ciphertext: refreshTokenCiphertext, token_expires_at: new Date(Date.now() + 3600_000).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'spotify_user_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function getUser(userId) {
  if (!supabase) return getMemory(`user:${userId}`);
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveAttempt({ userId, score, total, quizVersion }) {
  if (!supabase) return { id: randomUUID(), user_id: userId, score, total, quiz_version: quizVersion };
  const { data, error } = await supabase.from('quiz_attempts').insert({ user_id: userId, score, total, quiz_version: quizVersion }).select().single();
  if (error) throw error;
  return data;
}

export async function decryptRefreshToken(user) { return decryptSecret(user.refresh_token_ciphertext); }
export const storageMode = { redis: hasRedis, database: hasDatabase };
