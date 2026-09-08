# Spotify Quiz Vercel Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Spotify Quiz into a Vercel-ready TypeScript application with durable Supabase persistence, Upstash session/cache/rate-limit storage, reliable Spotify token refresh, album artwork, and optimized quiz delivery.

**Architecture:** Keep the Vite React frontend and expose same-origin `/api/*` TypeScript handlers from one Vercel project. Store users, encrypted Spotify refresh tokens, and quiz scores in Supabase Postgres; store opaque sessions, short-lived access tokens, quiz-data cache entries, and rate-limit counters in Upstash Redis. Never expose Spotify tokens to the browser or persist raw listening-history payloads permanently.

**Tech Stack:** React 19, Vite, TypeScript strict mode, Vercel Node functions, Supabase Postgres via `@supabase/supabase-js`, Upstash Redis via `@upstash/redis`, Web Crypto AES-256-GCM, Spotify Web API, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-08-spotify-quiz-vercel-architecture-design.md`

## Global Constraints

- Use one Vercel project for the Vite frontend and TypeScript API functions.
- Keep only encrypted refresh tokens in Postgres; keep short-lived access tokens in Redis; never send either token to React.
- Do not permanently store raw Spotify top-item or recently-played payloads.
- Use Spotify Authorization Code flow with validated OAuth `state` and HTTPS production callback URI.
- Cache quiz-ready Spotify data for five minutes per user and use stale-on-error fallback.
- Authenticated responses must never be marked `public`.
- Keep `.env.example`, lockfiles, migrations, and `.superdesign` context tracked; ignore secrets and generated output.

---

### Task 1: Repository hygiene and TypeScript/Vercel foundation

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js` -> `frontend/vite.config.ts`
- Create: `vercel.json`
- Create: `api/index.ts`
- Test: `scripts/check-gitignore.mjs`

**Interfaces:**
- Produces strict TypeScript compiler configuration and a Vercel routing/build contract consumed by later API and frontend tasks.
- `vercel.json` routes `/api/*` to the serverless API entry and all other paths to the Vite SPA output.

- [ ] **Step 1: Extend Git ignore coverage**

Add these groups while preserving `!.env.example` and existing source/config files:

```gitignore
# Vercel, Vite, and TypeScript output
.vercel/
.vite/
*.tsbuildinfo

# Test and tooling output
playwright-report/
test-results/
.eslintcache

# Package-manager logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Local database files and journals
*.db
*.db-shm
*.db-wal
*.sqlite
*.sqlite3

# Superdesign temporary uploads/templates
.superdesign/tmp/
```

Remove redundant `backend/.env` and `frontend/.env` lines because `.env` and `.env.*` already cover them. Keep `.superdesign/init/`, `.superdesign/design-system.md`, and `.superdesign/resume.json` tracked.

- [ ] **Step 2: Add strict TypeScript dependencies and configs**

Add `typescript`, `tsx`, `vitest`, `@types/node`, `@types/react`, and `@types/react-dom` to the appropriate package manifests. Configure `frontend/tsconfig.json` with `strict: true`, `noEmit: true`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, and `allowImportingTsExtensions: false`. Configure `backend/tsconfig.json` with `strict: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2022"`, and `noEmit: true`.

- [ ] **Step 3: Add Vercel routing**

Create:

```json
{
  "buildCommand": "npm --prefix frontend run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The API entry will dispatch `/api/*` requests by method/path after later tasks move the backend logic into importable modules.

- [ ] **Step 4: Add Gitignore regression assertions**

Create a Node script that runs `git check-ignore` for `.env`, `backend/.env`, `frontend/.env.local`, `node_modules/`, `frontend/dist/`, `.vercel/`, `*.tsbuildinfo`, `*.db`, and `.superdesign/tmp/example.html`, and asserts that `.env.example`, `package-lock.json`, `supabase/migrations/001_initial.sql`, and `.superdesign/resume.json` are not ignored.

- [ ] **Step 5: Run the foundation checks**

Run: `npm --prefix frontend run build`, `npx tsc -p frontend/tsconfig.json --noEmit`, and `node scripts/check-gitignore.mjs`.

- [ ] **Step 6: Commit**

```bash
git add .gitignore README.md backend/package.json backend/tsconfig.json frontend/package.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts vercel.json api/index.ts scripts/check-gitignore.mjs
git commit -m "chore: prepare TypeScript Vercel foundation"
```

### Task 2: Shared types, database schema, encryption, and Redis adapters

**Files:**
- Create: `shared/types/spotify.ts`
- Create: `shared/types/quiz.ts`
- Create: `backend/src/config.ts`
- Create: `backend/src/crypto.ts`
- Create: `backend/src/db.ts`
- Create: `backend/src/redis.ts`
- Create: `supabase/migrations/001_initial.sql`
- Modify: `backend/.env.example`
- Modify: `frontend/.env.example`
- Test: `backend/src/crypto.test.ts`
- Test: `backend/src/redis.test.ts`

**Interfaces:**
- `SpotifyProfile`, `SpotifyArtist`, `SpotifyTrack`, `RecentlyPlayedItem`, and `QuizData` are shared response models.
- `encryptSecret(value: string, key: Uint8Array): Promise<string>` and `decryptSecret(payload: string, key: Uint8Array): Promise<string>` use AES-256-GCM and include nonce/auth tag in the encoded payload.
- `getSupabase()` returns a singleton server-only Supabase client.
- `getRedis()` returns a singleton Upstash Redis client.

- [ ] **Step 1: Write crypto tests first**

Test that encrypt/decrypt round-trips a refresh token, two encryptions produce different ciphertexts, and tampering rejects with an error. Test the invalid key length path with a clear configuration error.

- [ ] **Step 2: Implement crypto and config**

Require `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SESSION_SECRET`, and `TOKEN_ENCRYPTION_KEY` in production. Permit explicit local-development defaults only for `PORT`, `FRONTEND_URL`, and callback URL.

- [ ] **Step 3: Add the database migration**

Create `users` and `quiz_attempts` tables from the spec, add unique index `users_spotify_user_id_idx`, add `quiz_attempts_user_created_idx` on `(user_id, created_at desc)`, enable row-level security, and create no browser-facing policies because the service-role key is server-only.

- [ ] **Step 4: Add Supabase and Redis adapters**

Use one module-level client per Vercel warm instance. Wrap Redis JSON reads/writes with typed helpers and explicit TTLs. Add helpers for session, access-token, quiz-data, rate-limit, and backoff keys so route handlers never construct raw keys inconsistently.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm --prefix backend test -- --run src/crypto.test.ts src/redis.test.ts` and `npx tsc -p backend/tsconfig.json --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add shared backend/src/config.ts backend/src/crypto.ts backend/src/db.ts backend/src/redis.ts supabase/migrations/001_initial.sql backend/.env.example frontend/.env.example
git commit -m "feat: add durable storage adapters and shared types"
```

### Task 3: Spotify client, OAuth, sessions, cache, and Vercel API routes

**Files:**
- Create: `backend/src/spotify.ts`
- Create: `backend/src/auth.ts`
- Create: `backend/src/cache.ts`
- Create: `backend/src/rate-limit.ts`
- Create: `backend/src/routes.ts`
- Modify: `api/index.ts`
- Test: `backend/src/auth.test.ts`
- Test: `backend/src/cache.test.ts`
- Test: `backend/src/routes.test.ts`

**Interfaces:**
- `spotifyRequest<T>(path: string, accessToken: string): Promise<T>` handles timeout, JSON errors, 401/403/429/5xx classification, and one bounded retry for 429/5xx.
- `getUserAccessToken(sessionId: string): Promise<{ userId: string; accessToken: string }>` loads the Redis session, checks cached token expiry, and refreshes from the encrypted database token when needed.
- `getQuizData(userId: string): Promise<QuizData>` performs cache-aside retrieval with a five-minute TTL and stale fallback.
- `handleApiRequest(req: Request): Promise<Response>` dispatches the documented `/api/*` endpoints.

- [ ] **Step 1: Write OAuth/session tests first**

Cover state mismatch rejection, denied authorization, successful code exchange, session cookie attributes (`HttpOnly`, `Secure` in production, `SameSite=Lax`, bounded `Max-Age`), refresh-token preservation when no replacement is returned, and invalid refresh-token cleanup.

- [ ] **Step 2: Implement Spotify request client**

Use `AbortSignal.timeout(8000)`. Parse `Retry-After`, retry at most twice with bounded delays for 429/5xx, and return typed error classes without logging authorization headers or payloads.

- [ ] **Step 3: Implement OAuth routes**

`/api/auth/login` creates a random state stored with a short TTL and redirects to Spotify. `/api/auth/callback` validates state, exchanges the code server-side, fetches `/me`, encrypts/upserts the refresh token, creates the opaque Redis session, and redirects to `/` with a generic success marker. `/api/auth/logout` deletes Redis state and clears the cookie.

- [ ] **Step 4: Implement cache and rate limiting**

Cache quiz data under `spotify:quiz-data:v1:<spotify-user-id>` for 300 seconds. On a Spotify 429/5xx, return a cache entry no older than 15 minutes with `X-Cache: STALE`; otherwise return a safe dependency error. Add fixed-window Redis counters for login, callback, quiz-data, and score submission.

- [ ] **Step 5: Implement API handlers**

Add `/api/me`, `/api/quiz-data`, `/api/quiz-attempts`, and `/api/health`. Validate score payloads (`0 <= score <= total`, integer values, known quiz version), derive user ID from the session, and set `Cache-Control: private, max-age=60` plus an ETag on quiz data. Return `304` when `If-None-Match` matches. Never use `Access-Control-Allow-Origin: *` with credentials.

- [ ] **Step 6: Run API tests**

Run: `npm --prefix backend test -- --run src/auth.test.ts src/cache.test.ts src/routes.test.ts` and `npx tsc -p backend/tsconfig.json --noEmit`.

- [ ] **Step 7: Commit**

```bash
git add api/index.ts backend/src/spotify.ts backend/src/auth.ts backend/src/cache.ts backend/src/rate-limit.ts backend/src/routes.ts backend/src/*.test.ts
git commit -m "feat: add Vercel Spotify auth and cached API"
```

### Task 4: TypeScript frontend migration, artwork, and equalizer

**Files:**
- Rename: `frontend/src/App.jsx` -> `frontend/src/App.tsx`
- Rename: `frontend/src/main.jsx` -> `frontend/src/main.tsx`
- Rename: `frontend/src/api.js` -> `frontend/src/api.ts`
- Rename: `frontend/src/quiz.js` -> `frontend/src/quiz.ts`
- Create: `frontend/src/types/spotify.ts`
- Create: `frontend/src/types/quiz.ts`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/index.html`
- Test: `frontend/src/quiz.test.ts`
- Test: `frontend/src/api.test.ts`

**Interfaces:**
- `getQuizData(): Promise<QuizData>` returns typed API data and maps 401/429/dependency errors to typed UI errors.
- `buildQuestions(data: QuizData): QuizQuestion[]` remains pure and deterministic when given a seeded shuffle helper in tests.
- `SpotifyImage` is `{ url: string; height?: number; width?: number }` and components use the first available image with a gradient fallback.

- [ ] **Step 1: Write quiz/type tests first**

Test question generation with complete data, sparse data, duplicate tracks/artists, missing artwork, and score boundaries. Test the API client sends credentials and converts error payloads safely.

- [ ] **Step 2: Add shared frontend models and rename files**

Use explicit `unknown` narrowing for API JSON. Remove implicit `any`; type React event handlers and component props. Keep the current UI behavior and API paths.

- [ ] **Step 3: Add album artwork**

Render Spotify image URLs from top tracks/artists in the listening visual, question context, and result state. Use `loading="lazy"`, `decoding="async"`, safe `alt` text, and the existing abstract gradient when an image URL is absent or fails.

- [ ] **Step 4: Add equalizer motion**

Use CSS-only bars driven by a small `@keyframes equalize` animation. Add `aria-hidden="true"` for decoration and stop animation under `prefers-reduced-motion: reduce`; no audio playback is introduced.

- [ ] **Step 5: Run frontend checks**

Run: `npm --prefix frontend test -- --run`, `npx tsc -p frontend/tsconfig.json --noEmit`, and `npm --prefix frontend run build`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src frontend/index.html frontend/package.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts
git commit -m "feat: migrate quiz UI to typed React and artwork"
```

### Task 5: Environment, deployment, docs, and end-to-end verification

**Files:**
- Modify: `backend/.env.example`
- Modify: `frontend/.env.example`
- Modify: `README.md`
- Create: `docs/deployment/vercel.md`
- Create: `scripts/smoke-api.mjs`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Deployment documentation names every Vercel, Supabase, Upstash, Spotify, and encryption environment variable without including secret values.
- `scripts/smoke-api.mjs` checks `/api/health`, unauthenticated `/api/me`, and validates the configured base URL without attempting to fake Spotify credentials.

- [ ] **Step 1: Document environment variables**

Document `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `VITE_API_URL` with local and production callback examples.

- [ ] **Step 2: Add Vercel deployment guide**

Describe project root/build settings, Supabase migration execution, Upstash Marketplace provisioning, Vercel environment scopes, Spotify redirect URI registration, cookie domain expectations, and log redaction.

- [ ] **Step 3: Add smoke checks**

Create a no-secret smoke script that fails clearly when the deployment is unreachable, health is unhealthy, unauthenticated requests do not return 401, or the API returns wildcard credential CORS headers.

- [ ] **Step 4: Run the complete verification suite**

Run:

```bash
npm --prefix backend test -- --run
npm --prefix frontend test -- --run
npx tsc -p backend/tsconfig.json --noEmit
npx tsc -p frontend/tsconfig.json --noEmit
npm --prefix frontend run build
node scripts/check-gitignore.mjs
node scripts/smoke-api.mjs
```

Then run the real-credential smoke test from the spec: sign in, retrieve `/api/me` and `/api/quiz-data`, repeat to verify a cache hit, test expired-token refresh, and submit a score.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example frontend/.env.example README.md docs/deployment/vercel.md scripts/smoke-api.mjs CHANGELOG.md
git commit -m "docs: add Vercel deployment and verification guide"
```

## Self-review checklist

- Every approved spec section maps to a task: Vercel shape (1, 3), Supabase schema (2), Redis sessions/cache/rate limiting (2, 3), OAuth/token refresh (3), TSX/artwork/equalizer (4), Git hygiene (1), error/privacy (3), and verification/deployment (5).
- No task stores raw listening history permanently.
- No task sends tokens to the frontend.
- The exact symbols and interfaces used by later tasks are defined in earlier task interface blocks.
- No placeholder markers or unspecified "add appropriate handling" steps remain.
