# Deploying SkillNav

SkillNav is a standalone TanStack Start (React 19 + Vite) app. No
platform-specific packages: `npm run build` emits `dist/client` (static assets)
and `dist/server` (the SSR handler), and `npm start` runs a plain Node server
that serves both.

## 1. Prepare the database

Run `db/schema.sql` once against your Supabase project (SQL editor or
`psql "$DATABASE_URL" -f db/schema.sql`). It creates every table, index, RLS
policy and the signup trigger.

Then, in Supabase → Authentication → URL Configuration:

- Site URL: `https://<your-domain>`
- Redirect URLs: `https://<your-domain>/dashboard`

Enable the Google provider there if you want Google sign-in (email/password
works without it).

## 2. Environment variables

| Variable | Needed at | Required | Notes |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | build + runtime | yes | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | build + runtime | yes | publishable/anon key (public, safe in the browser) |
| `GEMINI_API_KEY` | runtime | yes | server-only, https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | runtime | no | defaults to `gemini-2.5-flash` |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | no | privileged jobs only, never expose to the browser |
| `PORT` / `HOST` | runtime | no | default `8080` / `0.0.0.0` |

`VITE_*` values are inlined into the browser bundle at build time, so set them
**before** `npm run build`. The server derives `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PROJECT_ID` from them automatically.

## 3. Build and run

```sh
npm ci
npm run build
npm start        # listens on $PORT (default 8080)
```

Works as-is on any VPS, Render, Railway, Fly.io, Heroku or a container host:

- Build command: `npm run build`
- Start command: `npm start`
- Health check path: `/api/public/health`

## Docker

```sh
docker build \
  --build-arg VITE_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=sb_publishable_... \
  -t skillnav .

docker run -p 8080:8080 \
  -e VITE_SUPABASE_URL=https://xxxx.supabase.co \
  -e VITE_SUPABASE_ANON_KEY=sb_publishable_... \
  -e GEMINI_API_KEY=... \
  skillnav
```

## 4. Verify the deployment

```sh
curl https://<your-domain>/api/public/health
{"status":"ok","database":"ok","ai":"configured","time":"..."}
```

A `503` response tells you what is missing:

- `"database": "unconfigured"` — Supabase URL/key not set on the server
- `"database": "unreachable"` — wrong URL/key, or the project is paused
- `"ai": "missing_api_key"` — `GEMINI_API_KEY` is not set

## Deployment checklist

- [ ] `db/schema.sql` applied to the production Supabase project
- [ ] Auth Site URL + redirect URLs point at the production domain
- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set at build time
- [ ] `GEMINI_API_KEY` set at runtime (never as a `VITE_` variable)
- [ ] `/api/public/health` returns `status: ok`
