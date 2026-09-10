# Spotify Quiz

Users sign in with Spotify, then answer a quiz generated from their own profile, top artists, top tracks, and recent listening.

## Local development

1. Create a Spotify app at <https://developer.spotify.com/dashboard>.
2. Add `http://127.0.0.1:3001/api/auth/callback` as a Redirect URI.
3. Copy `backend/.env.example` to `backend/.env` and fill in Spotify credentials. The app works with memory-only storage locally; add Supabase and Upstash values for durable sessions.
4. Copy `frontend/.env.example` to `frontend/.env`.
5. Run `npm install` in the repository root, then run `npm --prefix backend run dev` and `npm --prefix frontend run dev`.
6. Open <http://127.0.0.1:5173>.

## Production architecture

- Vercel serves the Vite build and the `/api` function.
- Supabase Postgres stores users, encrypted Spotify refresh tokens, and quiz attempts.
- Upstash Redis stores sessions, short-lived access tokens, quiz-data cache, and rate-limit counters.
- Spotify OAuth and all Spotify API calls stay server-side.

Run `supabase/migrations/001_initial.sql` in the Supabase SQL editor before deploying.

## Vercel deployment

1. Import this repository into Vercel. The included `vercel.json` uses `frontend/dist` as the output and maps `/api/*` to the function.
2. Add every variable from `backend/.env.example` in Vercel Project Settings -> Environment Variables.
3. Set `FRONTEND_URL` to the deployed Vercel URL and `SPOTIFY_REDIRECT_URI` to `<vercel-url>/api/auth/callback`.
4. Add that exact callback URL in the Spotify Developer Dashboard.
5. Redeploy after saving variables.

For Vercel, leave `VITE_API_URL` empty so the browser uses same-origin `/api` routes.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify app credentials; secret is backend-only. |
| `SPOTIFY_REDIRECT_URI` | Exact OAuth callback URL. |
| `FRONTEND_URL` | Allowed browser origin. |
| `SESSION_SECRET` | Session secret. |
| `TOKEN_ENCRYPTION_KEY` | Dedicated AES-256-GCM refresh-token encryption secret. |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | Server-only Supabase connection. Legacy `SUPABASE_SERVICE_ROLE_KEY` is also supported. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Server-only Redis connection. |
| `VITE_API_URL` | Optional local API origin; empty on Vercel. |

## Checks

```text
npm run typecheck
npm run build
npm test
```

Never commit `.env` files or production secrets.
