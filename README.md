# Units / Tasker API

NestJS 11 REST API for the Units (Tasker) app — auth, unit profile, schedule, notes, weekly assessment, diagnostics / rebaseline.

- Repo: [github.com/Bobozak/unit-back](https://github.com/Bobozak/unit-back)
- Frontend: [github.com/Bobozak/unit-front](https://github.com/Bobozak/unit-front) (Vercel)
- Base URL: `/v1/...` (URI versioning)
- Health: `GET /health` (unversioned, public)
- Swagger: `/docs`
- Agent guide: **[AGENTS.md](./AGENTS.md)**
- Frontend API specs: **[frontend_md/](./frontend_md/)** (`auth.md`, `units.md`, `schedule.md`, `notes.md`, `assessment.md`, `diagnostics.md`)

Default API port: **3001**. Frontend (Vite) runs on **8000** and proxies `/v1` in dev.

## Installation

```bash
npm install
```

Local Postgres (optional):

```bash
docker compose up -d postgres
cp .env.example .env
```

## Running the app

```bash
npm run start:dev
npm run start:prod
```

## Test

```bash
npm run test
npm run test:e2e
npm run test:cov
```

## Lint

```bash
npm run lint:type
npm run lint
```

## Environment

See [`.env.example`](.env.example). Runtime uses **`DATABASE_URL`**. `CLIENT_URL` is the CORS allowlist (comma-separated origins). Do not commit `.env`.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (Render sets this) |
| `NODE_ENV` | `development` / `production` |
| `APP_URL` | Public API URL (logged on boot in production) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET`, `REFRESH_JWT_SECRET` | Access / refresh JWT |
| `CLIENT_URL` | CORS origins, e.g. `https://unit-front.vercel.app` |
| `CLOUDINARY_*` | Avatar upload |
| `INTERNAL_API_KEY` | Header `x-internal-key` for `/v1/internal/*` |
| `ASSESSMENT_DEBUG_ROUTES_ENABLED` | `true` enables debug assessment routes |

## Deploy (Render)

This repo is set up for a Render **web service** + **Postgres**. Blueprint: [`render.yaml`](./render.yaml).

Set in the Render dashboard (not in git):

- `CLIENT_URL` — Vercel origin, no trailing slash
- `APP_URL` — this service URL
- `JWT_SECRET`, `REFRESH_JWT_SECRET`
- `CLOUDINARY_*`
- `INTERNAL_API_KEY`

[Render free tier](https://render.com/docs/free): web service sleeps after ~15 minutes idle (cold start on next request). Free Postgres expires **30 days** after creation (1 GB, no backups).
