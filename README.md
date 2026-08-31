# SkillNav

SkillNav is an AI-powered personalized learning path recommender. Describe a goal in plain
language and SkillNav builds a sequenced roadmap of courses, projects and assessments tailored
to your skill level, interests and available study time — then adapts it as you progress.

## Features

- Learner profiling: experience level, interests, goals and weekly study hours
- Generated roadmaps with explained rationale and skill-gap analysis
- Step tracking across courses, projects and assessments
- AI mentor chat grounded in your active roadmap
- Progress notifications with encouraging, personalized messages

## Tech stack

- TanStack Start v1 (React 19 + TypeScript)
- Vite (standalone config — no platform-specific packages)
- Tailwind CSS v4
- Supabase (Postgres, auth, storage)
- Vercel AI SDK with Google Gemini

## Running locally

The project is fully self-contained: it needs only Node.js 20+, your own Supabase
project and a Google Gemini API key.

1. **Install dependencies**

   ```sh
   npm install
   ```

2. **Prepare the database.** In your Supabase project's SQL editor, run
   `db/schema.sql`. It creates every table, index, row-level security policy and
   the signup trigger the app needs.

3. **Get a Gemini API key** at https://aistudio.google.com/apikey.

4. **Configure environment**

   ```sh
   cp .env.example .env
   ```

   `.env.example` is already filled in with the Supabase project URL and public
   anon key; add your `GEMINI_API_KEY`. Either `VITE_SUPABASE_ANON_KEY` or
   `VITE_SUPABASE_PUBLISHABLE_KEY` works — the server-side `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PROJECT_ID` values are derived from
   them automatically, so there is nothing to duplicate.
   `SUPABASE_SERVICE_ROLE_KEY` is optional and must never be exposed to the browser.


5. **Optional — Google sign-in:** enable the Google provider in your Supabase project's
   Authentication → Providers settings and add `http://localhost:8080/dashboard` as a
   redirect URL. Email/password sign-in works without this.

6. **Run**

   ```sh
   npm run dev
   ```

   The app runs on http://localhost:8080 (override with `PORT`).

## Production build

```sh
npm run build
npm run preview
```


## Deploying

Build once, then run the bundled Node server:

```sh
npm ci
npm run build   # -> dist/client + dist/server
npm start       # serves both on $PORT (default 8080)
```

A `Dockerfile` is included, and `GET /api/public/health` reports database and
AI-key status for uptime checks. Full instructions, environment variable table
and a pre-launch checklist: see [DEPLOYMENT.md](./DEPLOYMENT.md).
