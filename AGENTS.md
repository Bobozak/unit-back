# Tasker app — руководство для AI-агента

Документ описывает стек, архитектуру, соглашения и правила работы с этим репозиторием.  
Перед любой задачей **прочитай этот файл** и следуй ему, если в промпте не указано иное.

---

## 1. О проекте

**Tasker app** — REST API на NestJS для приложения планирования задач (Swagger: *Tasker API*).

- Базовый URL: `/v1/...` (URI versioning)
- Swagger: `/docs`
- Доменная модель: **Unit** (профиль пользователя), **Task** (расписание), **Note** (заметки к задаче), **Session** (JWT-сессии), **UnitAssessment** (еженедельная оценка / блокировка), **RebaselineCase** (диагностика после блока)
- Фронт: `CLIENT_URL` (по умолчанию `http://localhost:8000`)

### Активные модули (`app.module.ts`)

| Модуль | Путь API | Назначение |
|--------|----------|------------|
| `AuthModule` | `/v1/auth` | login, register, verify (auto-login), refresh-token, logout, unitname-available, security-question, passphrase-challenge, change-passphrase, forgot-passphrase |
| `UnitsModule` | `/v1/units` | профиль unit (`GET/PATCH/DELETE /me`), avatar (`POST /image`) |
| `TasksModule` | `/v1/schedule` | CRUD задач, поиск, toggle-status, start, `DELETE /` (все задачи) |
| `NotesModule` | `/v1/notes` | заметки к задачам (CRUD) |
| `AssessmentModule` | `/v1/assessment`, `/v1/internal/assessment` | еженедельный скоринг, отчёты, блокировка |
| `DiagnosticsModule` | `/v1/diagnostics` | rebaseline после блока: логи, заявки, пересчёт, override |
| `SessionModule` | — | сессии и cleanup |
| `CloudinaryModule` | — | загрузка изображений |

> Фронтенд-спеки: `frontend_md/auth.md`, `frontend_md/units.md`, `frontend_md/schedule.md`, `frontend_md/notes.md`, `frontend_md/assessment.md`, `frontend_md/diagnostics.md`

> Фронт: CORS origin читается из `CLIENT_URL` (comma-separated). Dev: `http://localhost:8000`. Prod: Vercel origin.

---

## 2. Стек

| Слой | Технология |
|------|------------|
| Runtime | Node.js 20+ |
| Framework | **NestJS 11** |
| Language | **TypeScript 5** |
| ORM | **TypeORM 0.3** + PostgreSQL |
| Validation | `class-validator`, `class-transformer`, global `ValidationPipe` |
| Auth | JWT (access) + httpOnly cookie (refresh), Passport |
| API docs | `@nestjs/swagger` + `swagger-ui-dist` |
| Dates | `date-fns`, UTC-only |
| Logging | **Native NestJS** (`ConsoleLogger`, `Logger`) — без Pino/OTEL |
| Lint | ESLint, Prettier, ls-lint, tsc, husky pre-commit |
| Deploy | Render (stdout JSON logs в production) |

### Запрещено добавлять без явного запроса

- Pino, nestjs-pino, OpenTelemetry, Loki
- Query-параметр `offset` для timezone (фронт шлёт UTC)
- Сторонние logging/tracing стеки

---

## 3. Структура репозитория

```
src/
├── app.module.ts          # корневой модуль, guards, interceptors, TypeORM
├── main.ts                # bootstrap, CORS, Swagger, ConsoleLogger
├── auth/                  # аутентификация
├── units/                 # профиль unit
├── tasks/                 # расписание (controller: schedule)
├── notes/                 # заметки к задачам
├── assessment/            # еженедельный скоринг и блокировка
├── diagnostics/           # rebaseline после блока
├── session/               # JWT-сессии
├── common/                # shared: decorators, guards, interceptors, helpers, enum
├── database/              # data-source, SQL-миграции
└── cloudinary/            # медиа
```

### Паттерн feature-модуля

```
feature/
├── feature.module.ts
├── feature.controller.ts
├── feature.service.ts
├── entities/
├── dto/
│   ├── create-*.dto.ts
│   ├── update-*.dto.ts
│   └── response/
└── swagger-docs/          # декораторы Api* через applyDecorators
    └── index.ts
```

### Path alias

```typescript
import { Priority } from '@/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
```

Alias: `@/*` → `src/*` (см. `tsconfig.json`).

---

## 4. Архитектурные правила

### 4.1 Controller

- Тонкий слой: валидация через DTO, бизнес-логика в service
- Swagger: `@ApiTags`, `@ApiBearerAuth('JWT-auth')` для защищённых роутов (на `assessment` / `diagnostics` декоратор пока не повешен — JWT всё равно через `JwtAuthGuard`; при правках контроллера добавить)
- Документация эндпоинта — в `swagger-docs/`, не inline в controller
- Публичные роуты: декоратор `@Public()` из `@/common`
- Текущий unit: `@Unit()` или `@Unit('id')` из `@/common`

### 4.2 Service

- `@Injectable()`, инъекция репозиториев через `@InjectRepository`
- Сложные операции — `QueryRunner` + transaction
- `findOneOrFail` для «должен существовать» (глобальный `NotFoundInterceptor`)

### 4.3 Entity

- TypeORM decorators, camelCase имён колонок (как в коде)
- Даты задач: **`timestamptz`** + тип `Date` в TypeScript
- Enum-колонки через `type: 'enum', enum: SomeEnum`
- Связи: `@ManyToOne`, `@OneToMany`, `onDelete: 'CASCADE'` где уместно

### 4.4 DTO

- `class-validator` на все входные поля
- `@IsNotEmpty()` + `@IsOptional()` для опциональных patch-полей
- Swagger: `@ApiProperty` / `@ApiPropertyOptional`
- Response DTO — отдельные классы в `dto/response/`

### 4.5 Shared-код

Выноси в `src/common/` только то, что реально переиспользуется:

- `common/decorators/` — `@Public`, `@Unit`, `@AllowWhenBlocked`
- `common/guards/` — `BlockedUnitGuard`, `InternalApiGuard`
- `common/interceptors/` — глобальные interceptors
- `common/helpers/` — утилиты (cookie, task-utils, …)
- `common/enum/` — enum домена (Priority, TaskCategories)
- `common/middlewares/` — `AppLoggerMiddleware`

---

## 5. Аутентификация

```
Client → POST /v1/auth/login → accessToken (body) + refresh_token (httpOnly cookie)
Client → POST /v1/auth/verify (успех) → accessToken + refresh_token cookie (auto-login)
Client → Authorization: Bearer <accessToken> → защищённые роуты
Client → POST /v1/auth/refresh-token → новая пара токенов
```

- Глобальный `JwtAuthGuard` — все роуты защищены, кроме `@Public()`
- Глобальный `BlockedUnitGuard` (после JWT) — заблокированный unit получает `403 UNIT_BLOCKED`, кроме `@Public()` и `@AllowWhenBlocked()`
- В `request.unit` после JWT — **payload** `{ sub, sessionId, id: sub, unitname, iat, exp }`, не `UnitEntity`. `@Unit('id')` читает `id`.
- Refresh token — только из cookie
- **unitname:** `taskerUnitnameRegex` = `/^[a-zA-Z0-9]{3,}$/` (без кириллицы)
- **Уникальность unitname:** case-insensitive (`LOWER(unitname)`, индекс `units_unitname_lower_unique`, `withDeleted: true`). Хранимый регистр не нормализуется.
- **Lookup** login / verify / forgot: **exact case**
- **passphrase:** min 12 non-space + `noCyrillicRegex`
- **security question:** required at register (8–200 chars, at least one letter/digit). Stored trimmed + lowercased.
- **security answer:** normalized (`NFKC`, lowercase, punctuation/symbols stripped, whitespace collapsed) then bcrypt cost 10. Compare uses the same normalization. 5 wrong answers → lock 15 min (`429`).

### Verify (register step 3 after unitname/passphrase + security question)

```
Client → GET /v1/auth/unitname-available?unitname=… → { available }
Client → POST /v1/auth/register { unitname, passphrase, securityQuestion, securityAnswer } → 201 + verificationCode
Client → POST /v1/auth/verify { unitname, code } → 201
  verified → { status, message, accessToken } + refresh cookie (session created)
  retry    → { status: 'retry', code, attemptsRemaining }  (тот же HTTP 201)
  destroyed → { status: 'destroyed' }  (hard delete unit после 3 ошибок)
```

- Неверный код **не** даёт HTTP 400 — discriminated body `retry` / `destroyed`

### Смена passphrase

```
Client → GET /v1/auth/security-question (JWT) → { question }
Client → POST /v1/auth/passphrase-challenge (JWT) { securityAnswer } → { digits, expiresAt }
Client → POST /v1/auth/change-passphrase (JWT) → accessToken + refresh_token cookie
Client → POST /v1/auth/logout (JWT) → clears refresh_token cookie
```

- Challenge выдаётся **только** после верного security answer (до лимита digit-challenge)
- Challenge: 16 цифр в порядке **убывания** (`generatePassphraseChangeCode`), TTL 10 мин
- Каждый вызов challenge **перезаписывает** предыдущий код, пока не исчерпан лимит: 3 / 60 мин → `400 Digit challenge limit reached. Try again later.`
- `passphraseChangeCode` / `passphraseChangeCodeExpiresAt` — **отдельно** от `verificationCode` (register/verify)
- После смены: все старые сессии удаляются, создаётся новая, выдаются новые токены (как login)
- MinPassphraseLength(12) для current и new

### Forgot/reset passphrase

```
Client → POST /v1/auth/forgot-passphrase/security-question { unitname } → { question }
Client → POST /v1/auth/forgot-passphrase/round-1/challenge { unitname, securityAnswer } → { digits, expiresAt }
Client → POST /v1/auth/forgot-passphrase/round-1/verify { unitname, digitSequence } → round 2 { digits, expiresAt }
Client → POST /v1/auth/forgot-passphrase/reset { unitname, newPassphrase } → accessToken + refresh_token cookie
```

- Публичные роуты (`@Public()`), только **verified** units; 404 / 403 при ошибках
- Цифры round-1 выдаются **только** после верного security answer
- **Раунд 1**: 16 random digits; ввод — сначала все ненулевые **чётные** цифры по возрастанию, затем все ненулевые **нечётные** по убыванию, затем все нули (`buildResetRound1ExpectedSequence`)
- **Раунд 2**: только новый passphrase; цифры больше не вводятся и не проверяются. TTL round-2 окна остаётся.
- TTL каждого challenge: 10 мин; новый round-1 challenge сбрасывает все reset-поля
- После reset: автологин (новая сессия + токены), как change-passphrase
- `passphraseReset*` — **отдельно** от `verificationCode` и `passphraseChangeCode*`

### Delete account

```
Client → GET /v1/auth/security-question (JWT) → { question }
Client → DELETE /v1/units/me (JWT) { securityAnswer } → 200
```

- Верный ответ обязателен; неверный — `403 Invalid security answer`
- Тот же lockout, что у change/forgot: 5 ошибок → 15 мин (`429`)

### Unit — поля auth/challenge

| Поле | Назначение |
|------|------------|
| `passphrase` | bcrypt hash, @Exclude |
| `securityQuestion` | открытый текст, lowercased, @Exclude |
| `securityAnswerHash` | bcrypt hash нормализованного ответа, @Exclude |
| `securityAnswerFailedAttempts` | счётчик неверных ответов |
| `securityAnswerLockedUntil` | lockout до этого UTC, timestamptz |
| `verificationCode` | register → POST /auth/verify |
| `passphraseChangeCode` | challenge для смены passphrase, @Exclude |
| `passphraseChangeCodeExpiresAt` | TTL change challenge, timestamptz |
| `passphraseResetRound1Code` | forgot/reset round 1, @Exclude |
| `passphraseResetRound1ExpiresAt` | TTL round 1, timestamptz |
| `passphraseResetRound1VerifiedAt` | успех verify round 1, timestamptz |
| `passphraseResetRound2Code` | forgot/reset round 2, @Exclude |
| `passphraseResetRound2ExpiresAt` | TTL round 2, timestamptz |

---

## 6. Даты и время

**Только UTC. Без offset.**

| Контекст | Формат |
|----------|--------|
| API body (create/update) | Строгий ISO 8601 UTC: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$` |
| Query filter (`GET /schedule`) | `startDate` + `endDate` — тот же формат; задачи с `startDate: null` **не** попадают в фильтр |
| БД | `timestamptz` |
| Валидация | `@IsValidDate()` — regex выше, не в прошлом, `toISOString() === value` |

Не используй:

- query `offset`
- конвертацию UTC → local на бэке
- хранение дат в `varchar`

---

## 7. Модель Task (актуальная)

Эндпоинт: **`/v1/schedule`**

| Поле | Тип | Примечание |
|------|-----|------------|
| `title`, `description` | string | title → lowercase; charset `taskTitleRegex` (латиница/цифры/пунктуация) |
| `category` | enum | work / life / learning |
| `priority` | enum | high / medium / low |
| `complexity` | 1–20 | обязательно при create |
| `startDate` | timestamptz, nullable | **опционально** при create → `null` если не передан; **immutable** после установки (create или `PATCH /start/:taskId`) |
| `deadline` | timestamptz | **обязателен** при create; **immutable** — после создания не меняется |
| `createDate` | timestamptz | server-side |
| `completeDate` | timestamptz | nullable |
| `overdueReason` | string ≤200 | обязателен при **toggle-status** просроченной задачи; charset как title |

Удалённые поля (не возвращать): `type`, `pinned`, `geolocation`, `duration`.

### Create / update

```
POST /v1/schedule
Body: { title, category, priority, complexity, deadline, startDate?, description? }
  startDate — опционально; без поля → null в БД
  deadline — обязателен; ISO 8601 UTC, не в прошлом

PATCH /v1/schedule/:id
Body: { title?, description?, category?, priority?, complexity? }
  deadline / startDate — immutable; extra fields → 400 (`forbidNonWhitelisted`)
  empty allowed payload → 200 with the unchanged task (no TypeORM UPDATE)

PATCH /v1/schedule/start/:taskId
Body: { startDate }
  startDate — обязателен; ISO 8601 UTC, не в прошлом
  только если startDate ещё null; иначе 409
  параллельный start: транзакция + `SELECT … FOR UPDATE` → один 200, второй 409
```

Если `startDate` передан при create или start — задача ≤ 1 UTC-дня и `deadline` > `startDate`.

```
DELETE /v1/schedule
  удаляет все задачи текущего unit (swagger: only for testing)

GET /v1/schedule/search?query=&limit=&page=&searchIn=
  → { data, total, page, limit } или { message: 'tasks not found' }
  limit/page обязательны на практике (ParseIntPipe без optional)
```

### Toggle-status

```
PATCH /v1/schedule/toggle-status/:taskId
Body: { "overdueReason"?: string }
```

Если deadline прошёл и задача ещё не completed → `overdueReason` **обязателен**.

---

## 7.1 Модель Note

Эндпоинт: **`/v1/notes`**

| Поле | Тип | Примечание |
|------|-----|------------|
| `id` | UUID | PK |
| `text` | varchar(1500) | единственное бизнес-поле; `noteTextRegex` (латиница, цифры, пунктуация, `\n\r\t`; кириллица запрещена) |
| `taskId` | UUID FK | `ManyToOne` → Task, `onDelete: CASCADE` |
| `createdAt`, `updatedAt` | timestamptz | server-side |

Ownership через `task.unit` — отдельной связи note ↔ unit нет.

```
POST   /v1/notes/task/:taskId     Body: { text }
GET    /v1/notes/task/:taskId     → Note[]
GET    /v1/notes/:id
PATCH  /v1/notes/:id              Body: { text? }
DELETE /v1/notes/:id
```

Ответы `/v1/schedule` **не включают** notes автоматически.

Миграция production: `npm run migrate:notes` → `20260724100000-notes.sql`

---

## 7.2 Assessment (еженедельная оценка)

Эндпоинты: **`/v1/assessment`** (JWT) и **`/v1/internal/assessment`** (`x-internal-key`).

Скоринг — чистый модуль `src/assessment/scoring/` (без Nest/TypeORM). Окно: скользящие 7 UTC-дней. Семь фич в `[0,1]` (1 = машинное поведение), логистика, сжатие по `conf = min(1, n/16)`.

| Вердикт | Условие |
|---------|---------|
| `inconclusive` | `n < 8` или доступный вес фич `< 0.60`, либо `0.35 < p < 0.65` |
| `replicant` | `p >= 0.65` → `units.isBlocked = true`; `replicantStrikeCount += 1`. На 4-й поимке ставится `finalInvestigationAt`, diagnostics не открывается. |
| `human` | `p <= 0.35` |

Константы только в `scoring/config.ts`.

Публичные (JWT):

```
GET  /v1/assessment/me
GET  /v1/assessment/me/history?limit=   # default 12, max 50; non-numeric limit → 400
POST /v1/assessment/me/acknowledge
```

`GET /me` помечен `@AllowWhenBlocked()` — экран блокировки читает отчёт. `GET /me/history` и `POST /me/acknowledge` **не** в allowlist: при `isBlocked` → `403 UNIT_BLOCKED`.

Rebaseline (JWT, весь контроллер `@AllowWhenBlocked()`):

```
GET  /v1/diagnostics/status
GET  /v1/diagnostics/logs?cursor=&limit=&sort=&order=   → { items, nextCursor }
GET  /v1/diagnostics/baseline/versions                  # не проверяет final lock
GET  /v1/diagnostics/claims
POST /v1/diagnostics/claims
POST /v1/diagnostics/rebaseline
POST /v1/diagnostics/override
```

Чистый модуль `src/assessment/rebaseline/` детектит реальные аномалии в задачах и методологические дефекты классификатора. Клиент получает только сырые логи. Принятая улика помечает фичу `skipped`; `scoreFromFeatures` пересчитывает p. `units.disqualifiedFeatures` переживают следующие weekly run.

Уровни по p: quarantined 0.65–0.75, restricted 0.75–0.90, terminal 0.90+. Отклонённая заявка: `noise += 0.005`.

Внутренние (`@Public()` + `InternalApiGuard`; Swagger tag **Internal Assessment**, схема `internal-key`):

```
POST /v1/internal/assessment/run
POST /v1/internal/assessment/run/:unitId
POST /v1/internal/assessment/simulate          # debug flag
POST /v1/internal/assessment/units/:unitname/block
POST /v1/internal/assessment/units/:unitname/unblock?purgeHistory=true  # only "true"/"false"; garbage → 400
POST /v1/internal/assessment/units/:unitname/tier   # debug flag
```

`simulate` / `block` / `unblock` / `tier` требуют `ASSESSMENT_DEBUG_ROUTES_ENABLED=true`, иначе 404.

Заблокированный unit: 403 `{ statusCode: 403, error: "UNIT_BLOCKED", blockedAt, assessmentId, finalInvestigationAt, replicantStrikeCount }`.
Allowlist: `@Public()`, `GET /units/me`, `GET /assessment/me`, `POST /auth/refresh-token`, `/v1/diagnostics/*`.

При `units.finalInvestigationAt` diagnostics (кроме `GET /baseline/versions`) отвечает `409 FINAL_INVESTIGATION_LOCK`. Другие 409: `CASE_CLOSED`, `CLAIM_ALREADY_ACCEPTED`, `ATTEMPTS_EXHAUSTED`, `RECLASSIFICATION_NOT_AVAILABLE`.

**Когда проверяется блок (зафиксировано):** только на HTTP к API. `BlockedUnitGuard` смотрит `isBlocked` на каждом JWT-запросе вне allowlist. Фронт ставит `RetiredTerminal` из `403 UNIT_BLOCKED` или из `GET /units/me` при bootstrap/login; при `finalInvestigationAt` — `FinalInvestigationLock`. Клиентский клик или переход по роуту **без** запроса к API блок не проверяет. Сокетов, SSE и поллинга нет. Простаивающая вкладка увидит блок на следующем API-вызове, перезагрузке или новом логине.

Миграция: `npm run migrate:assessment` → `20260815100000-assessment.sql`; `npm run migrate:rebaseline` → `20260817120000-rebaseline.sql`; `npm run migrate:final-investigation` → `20260817160000-final-investigation.sql`; `npm run migrate:passphrase-challenge-rate-limit` → `20260818100000-passphrase-change-challenge-rate-limit.sql`; `npm run migrate:case-insensitive-unitname` → `20260820100000-case-insensitive-unitname.sql`; `npm run migrate:security-question` → `20260821100000-security-question.sql`

---

## 8. Логирование

- `ConsoleLogger` в `main.ts`: JSON в production, цветной вывод в dev
- HTTP-логи: `AppLoggerMiddleware` на все роуты (`{*splat}` — Express v5)
- В сервисах: `new Logger(ClassName.name)` из `@nestjs/common`
- **Не добавлять** Pino, OpenTelemetry, `tracing.ts`

---

## 9. База данных

- PostgreSQL через `DATABASE_URL`
- PK/FK: **UUID v4** (`@PrimaryGeneratedColumn('uuid')`, колонки `uuid` в PostgreSQL)
- `synchronize: true` **всегда** (в `app.module.ts` нет NODE_ENV-guard)
- Для production-изменений — SQL в `src/database/migrations/*.sql` + runner `run-*-migration.ts`
- Имена колонок в SQL — **camelCase в кавычках**: `"startDate"`, `"unitId"`

---

## 10. Стиль кода

### Обязательно

1. **Минимальный scope** — меняй только то, что нужно для задачи
2. **Следуй существующим паттернам** — naming, imports, структура модулей
3. **Не over-engineer** — без лишних абстракций и хелперов на 1 строку
4. **Комментарии** — только для неочевидной бизнес-логики
5. **Тесты** — добавляй только если просят или покрывают реальное поведение

### Не делать без запроса

- Удалять `console.log`
- Удалять «unused» imports
- Создавать git commit / push / PR
- Редактировать plan-файлы в `.cursor/plans/`
- Отвечать на украинском (русский или английский — по контексту задачи)

### Корпоративный code style

Дополнительно см. [BalancyTeam corporate code style](https://github.com/BalancyTeam/corporate-code-style):

- [TypeScript](https://github.com/BalancyTeam/corporate-code-style/blob/main/docs/typescript.md)
- [NestJS](https://github.com/BalancyTeam/corporate-code-style/blob/main/docs/nestjs.md)
- [Git](https://github.com/BalancyTeam/corporate-code-style/blob/main/docs/git.md)

### Imports

- `simple-import-sort` (eslint) — группы: external → `@/` → relative
- Prefer `@/` для cross-module imports

---

## 11. Swagger

- Декораторы документации — функции `*Docs()` в `swagger-docs/`
- Используй `applyDecorators(ApiOperation, ApiQuery, ApiBody, ApiOkResponse, …)`
- Общие 401-ответы: `unauthorizedResponse` из `@/common/swagger/common-responses`
- Bearer auth: `'JWT-auth'` (как в `main.ts`)

---

## 12. Проверка перед завершением задачи

```bash
npm run lint:type    # обязательно
npm run build        # обязательно
npm run lint         # при существенных изменениях
```

Для поиска регрессий:

```bash
rg '<pattern>' src/
```

---

## 13. Env-переменные

См. [`.env.example`](.env.example):

| Variable | Назначение |
|----------|------------|
| `PORT` | порт сервера (`.env.example` = `3001`; fallback в `main.ts` = `3000` если unset) |
| `NODE_ENV` | development / production |
| `DATABASE_URL` | PostgreSQL connection string (единственный runtime-источник БД) |
| `DATABASE_HOST` / `PORT` / `USERNAME` / `PASSWORD` / `NAME` | есть в `.env.example`, **код не читает** |
| `JWT_SECRET`, `REFRESH_JWT_SECRET` | JWT |
| `CLIENT_URL` | CORS allowlist (comma-separated origins). Dev: `http://localhost:8000`. Prod: Vercel URL |
| `APP_URL` | в production — URL в логе bootstrap (`main.ts`); **не** Swagger base. В `.env.example` (`:3000`) может отличаться от `PORT` (`3001`) |
| `CLOUDINARY_*` | загрузка изображений |
| `INTERNAL_API_KEY` | ключ для `/v1/internal/*` (заголовок `x-internal-key`) |
| `ASSESSMENT_DEBUG_ROUTES_ENABLED` | `true` включает simulate / block / unblock / **tier**; иначе эти роуты → 404 |

Не коммить `.env` с секретами.

---

## 14. Чеклист для нового эндпоинта

- [ ] DTO + validation
- [ ] Service method
- [ ] Controller route (версия `/v1`)
- [ ] Swagger docs в `swagger-docs/`
- [ ] Response DTO
- [ ] `@Public()` или JWT guard
- [ ] `@Unit('id')` если нужен текущий unit
- [ ] `lint:type` + `build`

---

## 15. История решений (не откатывать без запроса)

- NestJS **11** (не откатывать на 10)
- Logging: **native ConsoleLogger** (не Pino)
- Tasks: **UTC dates**, без `offset`; строгий ISO с миллисекундами + `Z`
- Tasks entity: без `type`/`pinned`/`geolocation`/`duration`; есть `complexity`, `overdueReason`
- Passphrase change: security question then digit challenge; `POST /auth/passphrase-challenge` requires `securityAnswer`
- Delete account: `DELETE /units/me` requires `securityAnswer` (same lockout as change/forgot)

- После change-passphrase — автологин (новая сессия + токены), не logout без токенов
- `AuthService.issueSessionTokens` — публичный метод для переиспользования
- Forgot/reset passphrase: security question gates round-1 digits; round 1 — even-asc / odd-desc / zeros (`buildResetRound1ExpectedSequence`); round 2 — только `newPassphrase` (цифры не проверяются)
- После forgot/reset — автологин (новая сессия + токены)
- **Verify success — auto-login** (session + accessToken + refresh cookie); retry/destroyed — HTTP 201 body
- unitname: **латиница + цифры only** (`taskerUnitnameRegex`); уникальность **case-insensitive** (`LOWER`); login/verify/forgot lookup **exact case**; passphrase: `noCyrillicRegex`
- Security question required at register; answer normalized then bcrypt; 5 wrong answers lock 15 min (429)
- Docs 21.08.2026: security question layer on register / change / forgot / delete; `GET /auth/unitname-available`
- IDs = UUID v4 (`units.id`, `tasks.id`, `session.id`, FK `unitId`); integer serial удалён; миграция `migrate:ids-to-uuid` — destructive (clean slate)
- Tasks: `startDate` опционален при create (nullable); устанавливается один раз (create или `PATCH /schedule/start/:taskId`) и **не меняется**; `deadline` обязателен при create и **не редактируется** после создания; PATCH `/schedule/:id` с `deadline`/`startDate` → **400**
- `PATCH /schedule/start/:taskId` — транзакция + row lock; гонка → 409. `DELETE /schedule/:id` — атомарный DELETE, повтор → 404
- `GET /assessment/me/history?limit=` — невалидный limit → 400; omitted → default 12
- `POST /internal/assessment/units/:unitname/unblock?purgeHistory=` — только `"true"`/`"false"`; мусор → 400
- Notes: отдельный `NotesModule` (`/v1/notes`), many notes per task, ownership через `task.unit`
- `DELETE /v1/schedule` — bulk delete all tasks (testing)
- Assessment: weekly scoring in `AssessmentModule`; `isBlocked` on unit; internal cron routes; debug block/unblock/simulate/**tier**
- Rebaseline: `DiagnosticsModule` after UNIT RETIRED; real log contradictions; `scoreFromFeatures` recompute; persistent `disqualifiedFeatures`; debug `POST /internal/assessment/units/:unitname/tier`
- Docs 17.08.2026: `frontend_md/` + READMEs + DESIGN_SYSTEM synced to code (no `/assessment` route; assessment is Layout modal; diagnostics logs `{ items, nextCursor }`)
- Docs 20.08.2026: case-insensitive unitname; forgot round-1 value-rule; round-2 passphrase-only; frontend_md/AGENTS/CHANGELOG synced to code
