# Changelog — Units Backend

## 21.08.2026 — Security question layer

### Added

- Register requires `securityQuestion` + `securityAnswer` (normalized, bcrypt).
- `GET /auth/unitname-available`, `GET /auth/security-question`, `POST /auth/forgot-passphrase/security-question`.
- Digit challenges (`passphrase-challenge`, forgot round-1) are gated by the security answer.
- 5 wrong answers lock the unit for 15 minutes (`429`).
- `DELETE /units/me` requires `securityAnswer` (same lockout).
- Wrong security answer returns **403** (not 401) so the client does not treat it as an expired JWT.
- Migration: `npm run migrate:security-question` (truncates `units`).

## 20.08.2026 — Auth uniqueness and forgot round 2

### Changed

- Unitname uniqueness is **case-insensitive** (`isUnitnameTaken` via `LOWER(unitname)`, index `units_unitname_lower_unique`). Stored casing is kept. Login / verify / forgot lookup stays **exact case**.
- Forgot round 1: expected sequence is non-zero evens ascending, then non-zero odds descending, then zeros (`buildResetRound1ExpectedSequence`).
- Forgot round 2 / `POST /auth/forgot-passphrase/reset`: only `unitname` + `newPassphrase`. Digit proof is round 1 only. TTL/reset-session guards remain.

### Docs

- `AGENTS.md`, `frontend_md/*`, this changelog synced to the current API (auth, units uniqueness, schedule calendar-day, notes PATCH, assessment history snapshots, diagnostics tiers).

## 18.08.2026 — QA defect fixes

### Fixed

- `PATCH /v1/schedule/:id` with unknown fields (`deadline`, `startDate`) returns **400** instead of 500; empty allowed payload no longer runs a TypeORM UPDATE.
- Concurrent `PATCH /v1/schedule/start/:taskId` is serialized with a row lock: one 200, the other 409 `Task already started`.
- Concurrent `DELETE /v1/schedule/:id` is atomic: the second request returns 404.
- `GET /v1/assessment/me/history?limit=abc` returns **400** (dropped `DefaultValuePipe` that swallowed `NaN`).
- `POST /v1/internal/assessment/units/:unitname/unblock?purgeHistory=abc` returns **400** (query DTO + `IsBooleanString`).
- Stale backend e2e: `GET /` expects 404; invalid verify code expects 201 `{ status: 'retry' }`.

### Docs

- `AGENTS.md`, `frontend_md/schedule.md`, `frontend_md/assessment.md`, Swagger: immutable dates are 400; invalid `limit` / `purgeHistory` are 400.

## 17.08.2026 — Docs sync

### Docs

- `AGENTS.md`, `README.md`, `frontend_md/*` приведены к коду: `diagnostics.md` в списках, debug `tier`, final-investigation lock (кроме `GET /diagnostics/baseline/versions`), block-поля в `/units/me`, logs `{ items, nextCursor }`, 409-коды diagnostics, notes charset.

## 17.08.2026 — Final investigation lock

### Added

- After 4 real `verdict=replicant` assessment strikes, `units.finalInvestigationAt` is set and diagnostics is closed.
- `units.replicantStrikeCount` counts those strikes. Debug `/block` increments the same counter by 1.
- `unblock?purgeHistory=true` resets both fields.
- Frontend shows `FinalInvestigationLock` instead of `RetiredTerminal`.

## 17.08.2026 — 7-day assessment window and diagnostics log sort

### Changed

- Assessment window is 7 UTC days (`WINDOW_DAYS`), not 28.
- `GET /v1/diagnostics/logs` accepts `sort=startDate|ref` and `order=asc|desc` (default `startDate` + `desc`).

## 15.08.2026 — Weekly assessment and unit block

### Added

- `AssessmentModule`: public `/v1/assessment` (latest report, history, acknowledge) and internal `/v1/internal/assessment` (run / simulate / block / unblock).
- Pure scoring in `src/assessment/scoring/` (then 28-day window; **reduced to 7 UTC days on 17.08**, 7 features, logistic replicant probability).
- `unit_assessments` table + `units.isBlocked` / `blockedAt` / `blockingAssessmentId` / `lastAssessmentAt`.
- Global `BlockedUnitGuard` (`403 UNIT_BLOCKED`); `@AllowWhenBlocked()` allowlist.
- Block is checked **only on HTTP API requests**, not on client clicks/route changes; no sockets/polling.
- `InternalApiGuard` (`x-internal-key`), env `INTERNAL_API_KEY`, `ASSESSMENT_DEBUG_ROUTES_ENABLED`.
- Migration `npm run migrate:assessment`.

## 15.08.2026 — Docs sync with current API

### Docs

- `AGENTS.md`, `README.md`, `frontend_md/*`, `prompt.md` приведены к фактическому коду.
- Зафиксированы: verify auto-login, latin-only unitname, search pagination shape, `DELETE /schedule`, CORS hardcoded `:8000`, `synchronize: true` always.

### Already in code (documented here for agents; not a new release date)

- UUID v4 PKs for units / tasks / notes / sessions.
- `NotesModule` (`/v1/notes`).
- Forgot-passphrase: round-1 digit verify + passphrase-only reset + auto-login.
- Verify success issues session + `accessToken` + refresh cookie.
- Optional `startDate` on create; one-shot `PATCH /schedule/start/:taskId`; immutable `deadline`.
- `DELETE /v1/schedule` (bulk delete, testing).

## 03.08.2026 — Verify: scattered code UX support + 3 attempts + purge

### Added

- `src/common/helpers/generate-verification-code.ts` — генератор 16-значного non-decreasing кода с ≥8 уникальными цифрами (75% набора 0–9).
- `verificationAttempts` column на `UnitEntity` (default 0).

### Changed

- `UnitsService.verifyProfile()` — discriminated response:
  - `verified` — успех, `isVerified=true`, code cleared; controller issues tokens (auto-login).
  - `retry` — неверный код, новый `verificationCode`, `attemptsRemaining`.
  - `destroyed` — 3-я ошибка, hard `DELETE` юнита.
- `VerifyProfileResponseDto` — поля `status`, `code`, `attemptsRemaining`.
- Swagger `verify-profile.ts` — документация 3 попыток.
- `frontend_md/auth.md` — контракт API для фронта.
