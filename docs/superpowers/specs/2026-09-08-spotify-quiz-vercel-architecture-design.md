# Spotify Quiz Vercel Architecture Design

Date: 2026-09-08
Status: Approved for specification review
Target deployment: Vercel

## Goal

Make the Spotify Quiz production-ready for a Vercel deployment while preserving the existing React quiz experience. The system must support Spotify sign-in, reliably retrieve user-specific Spotify data, survive serverless cold starts and multiple function instances, cache expensive API reads, persist useful quiz history, and keep secrets out of the browser and Git.

## Decisions

### Hosting shape

Use one Vercel project for the Vite frontend and TypeScript API functions. Keeping the API under the same deployment makes the browser session cookie same-origin and removes the current frontend/backend host mismatch risk. The frontend remains a React/Vite app rather than moving to Next.js.

### Durable database: Supabase Postgres

Use Supabase Postgres as the system of record. The free tier is sufficient for an early personal project and provides a familiar relational model, SQL console, and managed migrations. The backend uses a server-only Supabase service-role key; the browser never talks to the database directly.

Tables:

```sql
users
  id uuid primary key
  spotify_user_id text unique not null
  display_name text
  avatar_url text
  refresh_token_ciphertext text not null
  token_expires_at timestamptz
  created_at timestamptz not null
  updated_at timestamptz not null

quiz_attempts
  id uuid primary key
  user_id uuid references users(id) on delete cascade
  score integer not null
  total integer not null
  quiz_version text not null
  created_at timestamptz not null
```

Raw Spotify top-item and recently-played payloads are not stored permanently. This minimizes sensitive listening-history retention while still allowing useful score history.

### Short-lived storage: Upstash Redis

Use Upstash Redis for data that is expensive, temporary, or needs to work across Vercel instances:

- `session:<random-id>` -> user ID and session metadata, TTL 7 days
- `spotify:access-token:<spotify-user-id>` -> short-lived access token, TTL aligned to Spotify expiry
- `spotify:quiz-data:v1:<spotify-user-id>` -> quiz-ready Spotify payload, TTL 5 minutes
- `rate:<user-or-ip>:<window>` -> request count, TTL 60 seconds
- `spotify:backoff:<user-id>` -> short retry/backoff marker after a 429

The cookie contains only an opaque, signed session identifier. Access tokens are short-lived and kept in Redis; only encrypted refresh tokens are persisted in Postgres. Neither token is sent to React.

### Spotify authentication

Use Spotify Authorization Code flow in the server-side API. Validate OAuth `state`, exchange the code only on the server, encrypt the refresh token with AES-256-GCM, and rotate the access token before expiry. Preserve an existing refresh token if Spotify omits a replacement during refresh. Use the deployed HTTPS callback URI in production; retain `http://127.0.0.1` only for local development.

### API surface

Implement Vercel-compatible TypeScript handlers:

- `GET /api/auth/login` - creates state and redirects to Spotify.
- `GET /api/auth/callback` - validates state, exchanges the code, upserts the user, and sets the session cookie.
- `POST /api/auth/logout` - deletes the Redis session and clears the cookie.
- `GET /api/me` - returns the minimal public profile from the authenticated session.
- `GET /api/quiz-data` - cache-aside reads quiz-ready data from Redis or Spotify.
- `POST /api/quiz-attempts` - persists a score only; never trusts a client-provided answer key.
- `GET /api/health` - reports application and dependency configuration health without exposing secrets.

`/api/quiz-data` calls Spotify top artists, top tracks, recently played tracks, and profile in parallel. It uses an 8-second timeout, handles 401 by refreshing once, honors `Retry-After` for 429 responses, and serves a still-fresh-enough cached response on temporary Spotify failure.

### Frontend TypeScript migration

Convert the frontend source to strict TypeScript:

- `src/App.tsx`
- `src/main.tsx`
- `src/api.ts`
- `src/quiz.ts`
- `src/types/spotify.ts`
- `src/types/quiz.ts`

Keep the current visual system and behavior. Add album artwork from Spotify's image URLs to the hero and question/result surfaces, with a neutral gradient fallback when an image is unavailable. Add a CSS equalizer animation that pauses under `prefers-reduced-motion: reduce`.

### Caching and optimization

- Cache quiz-ready Spotify data for five minutes per user.
- Set user-specific HTTP caching headers; never mark authenticated payloads as public.
- Add ETags so unchanged quiz payloads can return `304 Not Modified`.
- Use cache-aside reads with stale-on-error fallback.
- Avoid duplicate Spotify calls during one request with `Promise.all` and a single token lookup.
- Add request timeouts and bounded retries only for 429/5xx responses.
- Add Redis-backed rate limiting for auth and quiz-data endpoints.
- Keep Vite's hashed production assets cacheable by the CDN.
- Use a single pooled/serverless-safe database client and avoid per-request connection storms.

### Git hygiene

Keep tracked: source, migrations, lockfiles, `.env.example` files, README, and `.superdesign` design context. Ignore:

- all secret environment variants (`.env`, `.env.*`) except `.env.example`
- `node_modules`, Vite/Vercel output, build and coverage output
- TypeScript caches and local test reports
- npm/yarn/pnpm logs
- local SQLite/database files, exports, and generated data
- `.superdesign/tmp/`

Do not ignore migrations, lockfiles, or `.superdesign/init`, `design-system.md`, and `resume.json`; those are project context and source-of-truth artifacts.

## Error and privacy behavior

- Spotify access denial, state mismatch, missing credentials, refresh failure, 401, 403, 429, and 5xx each map to a safe user-facing message.
- Log server-side error codes and request IDs, never access tokens, refresh tokens, or full listening payloads.
- Delete the Redis session and clear the cookie on logout.
- On refresh-token invalidation, require Spotify sign-in again.
- Store only profile metadata and quiz scores in Postgres by default.

## Verification

Automated checks:

- TypeScript strict typecheck.
- Frontend production build.
- Backend handler/unit tests for state validation, token refresh, encryption/decryption, cache hit/miss, stale fallback, and rate limiting.
- Gitignore assertions for secrets and generated files.

Manual smoke test with real credentials:

1. Configure the exact local or Vercel callback URI in the Spotify Developer Dashboard.
2. Sign in with Spotify.
3. Confirm `/api/me` and `/api/quiz-data` return data.
4. Confirm the quiz renders profile data, top items, recent tracks, and artwork.
5. Repeat the request within five minutes and confirm a cache hit.
6. Expire or revoke the access token and confirm refresh or safe re-authentication.
7. Submit a quiz and confirm only the score is stored.

## Out of scope for this migration

- Spotify playback controls or streaming.
- Permanent storage of raw listening history.
- Social/friends mode.
- A second authentication provider.
- Production paid-tier provisioning.
