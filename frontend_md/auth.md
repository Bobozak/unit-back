# Tasker — фронтенд авторизации (спецификация для агента)

Документ описывает **весь auth-слой API** для реализации фронтенда Tasker. Источник правды — бэкенд NestJS (`/v1/auth`, `/v1/units/me`). Swagger: `{API_URL}/docs`.

---

## 1. Базовые настройки

| Параметр          | Значение                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| Base URL API      | Dev: Vite proxy same-origin `/v1` → `localhost:3001`; prod: `VITE_API_URL` |
| Префикс версии    | **`/v1`** — все роуты: `/v1/auth/...`, `/v1/units/...`                   |
| CORS origin       | `CLIENT_URL` (dev: `http://localhost:8000`; prod: Vercel origin)         |
| Credentials       | **`credentials: 'include'`** обязателен (refresh cookie)                 |
| Content-Type      | `application/json` для POST/PATCH                                        |
| Swagger           | `GET /docs`                                                              |
| Front port        | `8000` (`vite.config.ts`)                                                |
| API port (dev)    | `3001` (`.env.example` `PORT`)                                           |

### HTTP-клиент (как во фронте)

```typescript
// front/src/api/client.ts — пустой base = same-origin + Vite proxy
const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/v1${path}`, {
    ...options,
    credentials: 'include', // refresh_token cookie
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  return res;
}
```

### Модель сессии

```
┌─────────────┐     POST /login | /verify (verified) | change | reset
│   Client    │ ───────────────────► │ accessToken (JSON body)
│             │ ◄─────────────────── │ refresh_token (httpOnly cookie)
└─────────────┘
       │
       │  Authorization: Bearer <accessToken>  → защищённые роуты
       │
       │  POST /refresh-token
       │    Bearer <accessToken> + Cookie refresh_token
       │  → новый accessToken + обновлённый cookie
       │
       └─ POST /logout → clear cookie + закрытие сессии на сервере
```

| Токен             | Где хранится (текущий фронт)                                      | TTL                    | Назначение              |
| ----------------- | ----------------------------------------------------------------- | ---------------------- | ----------------------- |
| **accessToken**   | Zustand persist key **`tasker-auth`** (localStorage via persist)  | **15 мин**             | `Authorization: Bearer` |
| **refresh_token** | **httpOnly cookie** (не читать из JS)                             | JWT 7d, cookie max 30d | Только refresh          |

**Факт клиента:** `accessToken` и `blocked` **персистятся** в localStorage через Zustand (`partialize: { accessToken, blocked }`). `unit` / `isAuthenticated` не персистятся — восстанавливаются bootstrap’ом через `GET /units/me`. При `403 UNIT_BLOCKED` см. [assessment.md](./assessment.md).

Cookie-параметры бэкенда: `httpOnly`, `secure: true`, `sameSite: 'none'`. Для cross-origin (фронт `:8000`, API `:3001`) нужны HTTPS или **dev-прокси** Vite (`/v1` → `:3001`); иначе cookie может не сохраниться.

---

## 2. Все эндпоинты auth

| Метод | Путь                                        | Auth            | Описание                                          |
| ----- | ------------------------------------------- | --------------- | ------------------------------------------------- |
| GET   | `/auth/unitname-available`                  | —               | Проверка занятости unitname (`?unitname=`)        |
| POST  | `/auth/register`                            | —               | Регистрация (unitname, passphrase, Q&A)           |
| POST  | `/auth/verify`                              | —               | Верификация профиля                               |
| POST  | `/auth/login`                               | —               | Логин                                             |
| POST  | `/auth/refresh-token`                       | Bearer + cookie | Обновление токенов                                |
| POST  | `/auth/logout`                              | Bearer          | Выход                                             |
| GET   | `/auth/security-question`                   | Bearer          | Свой секретный вопрос                             |
| POST  | `/auth/passphrase-challenge`                | Bearer          | Challenge смены passphrase (после ответа)         |
| POST  | `/auth/change-passphrase`                   | Bearer          | Смена passphrase                                  |
| POST  | `/auth/forgot-passphrase/security-question` | —               | Forgot: показать секретный вопрос                 |
| POST  | `/auth/forgot-passphrase/round-1/challenge` | —               | Forgot: round 1 challenge (после ответа)          |
| POST  | `/auth/forgot-passphrase/round-1/verify`    | —               | Forgot: round 1 verify → round 2 window           |
| POST  | `/auth/forgot-passphrase/reset`             | —               | Forgot: reset + auto-login                        |

**Связанный профильный роут** (после логина):

| Метод | Путь        | Auth   | Описание               |
| ----- | ----------- | ------ | ---------------------- |
| GET   | `/units/me` | Bearer | Текущий unit (профиль) |

> Logout и смена/сброс passphrase **перенесены в `/auth`**, не в `/units`.

---

## 3. Валидация полей (общие правила)

### unitname

- Regex бэка и фронта: `^[a-zA-Z0-9]{3,}$` — минимум 3 символа, **только латиница и цифры** (кириллица **запрещена**)
- Примеры: `Kira`, `user123` (невалидно: `Иван`)
- Фронт: `filterUnitnameInput` срезает всё, кроме `[a-zA-Z0-9]`
- **Уникальность** (register / PATCH `/units/me`): case-insensitive — `Bobozak` и `bobozak` это одно имя (`LOWER(unitname)`, `withDeleted: true`). Хранимый регистр **не** нормализуется.
- **Lookup** (login / verify / forgot): **exact case**. `Kira` и `kira` — разные ключи поиска.

### passphrase

- Минимум **12 не-пробельных символов** (пробелы в строке допустимы, но не считаются)
- **Без кириллицы:** бэкенд `noCyrillicRegex`; фронт `hasCyrillic` → ошибка
- Пример: `"my secret phrase here"` (16 значимых символов)

### digitSequence / code

- Ровно **16 цифр**, строка `^\d{16}$`
- Правила порядка **зависят от шага** — см. раздел 5

### security question / answer

- `securityQuestion`: trim, 8–200 символов, хотя бы одна буква или цифра. В БД хранится `trim().toLowerCase()`.
- `securityAnswer`: после нормализации (`NFKC` → lowercase → убрать `\p{P}\p{S}` → схлопнуть пробелы) длина 3–100. Хранится bcrypt-хеш. Сравнение — той же нормализацией.
- Нормализованный ответ не должен совпадать с вопросом и с passphrase.
- 5 неверных ответов → lock 15 минут, HTTP `429`.

### HTTP-статусы

NestJS для POST чаще возвращает **201 Created** (не 200). Обрабатывай `res.ok` / `status >= 200 && status < 300`.

Формат ошибок NestJS (исключения):

```json
{
  "statusCode": 400,
  "message": "Invalid digit sequence",
  "error": "Bad Request"
}
```

> Verify с неверным кодом — **не** exception: HTTP 201 + `{ status: 'retry', ... }` (см. Flow A).
ValidationPipe (400):

```json
{
  "statusCode": 400,
  "message": ["Passphrase must contain at least 12 non-space characters"],
  "error": "Bad Request"
}
```

---

## 4. Потоки (flows)

### Flow A — Регистрация + верификация (auto-login)

```
unitname check → security Q&A → register → verify (успех = session + accessToken + cookie) → provisioning → /unit_profile
```

Отдельный `POST /login` **не нужен** после успешного verify. Login — только для повторного входа.

#### A0. GET `/v1/auth/unitname-available?unitname=Kira`

**Response 200:** `{ "available": true }`

#### A1. POST `/v1/auth/register`

**Body:**

```json
{
  "unitname": "Kira",
  "passphrase": "my secret phrase here",
  "securityQuestion": "what city were you born in",
  "securityAnswer": "Night City!"
}
```

**Response 201:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "unitname": "Kira",
  "verificationCode": "0111123334445566",
  "isVerified": false,
  "image": null,
  "createdAt": "2024-06-09T14:16:55.148Z",
  "updatedAt": "2024-06-09T14:16:55.148Z",
  "isLoggedIn": false
}
```

**Ошибки:** `409` — `Unitname already exists` (занят без учёта регистра, включая soft-deleted); `400` — валидация (`Unitname must be at least 3 characters and contain only Latin letters and digits`).

**UI:** показать `verificationCode` на экране (16 цифр). Код **non-increasing ascending** (каждая следующая ≥ предыдущей).

#### A2. POST `/v1/auth/verify`

**Body:**

```json
{
  "unitname": "Kira",
  "code": "0111123334445566"
}
```

**Response 201** — discriminated union по полю `status` (Nest POST default). Успех и retry — оба HTTP **201**, не exception:

Успех (**auto-login** — создаётся session, выдаются токены):

```json
{
  "status": "verified",
  "message": "Profile verified successfully",
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

+ Set-Cookie `refresh_token=...` (как login).

Неверный код, попытки остались (выдаётся **новый** `verificationCode` в поле `code`):

```json
{
  "status": "retry",
  "code": "0122333444555667",
  "attemptsRemaining": 2
}
```

3-я неудачная попытка — юнит **hard-delete** из БД:

```json
{
  "status": "destroyed"
}
```

**Правила:**

- До **3** попыток на верификацию нового юнита (`verificationAttempts` на сервере).
- Каждая ошибка: `attempts++`, новый код, ответ `retry` (**не** HTTP 400).
- На 3-й ошибке: запись удаляется (`DELETE`), unitname снова доступен для регистрации.
- Ввод `code`: 16 цифр в **ascending / non-decreasing** порядке (как на экране verify).

**UI (front):**

- Цифры кода — scattered по экрану (`FloatingDigits`), не строкой.
- При `verified` — `setToken(accessToken)` → `ProfileProvisioningOverlay` → `GET /units/me` → `setAuth` → redirect **`/unit_profile`**.
- При `retry` — новые цифры с glitch-in, индикатор `attemptsRemaining`.
- При `destroyed` — redirect на `/system-failure` (glitch 500 + сообщение BR2049).

**Ошибки (HTTP errors):**

- `404` — unit не найден
- `409` — уже verified

#### A3. POST `/v1/auth/login` (повторный вход)

**Body:**

```json
{
  "unitname": "Kira",
  "passphrase": "my secret phrase here"
}
```

**Response 201:**

```json
{ "accessToken": "eyJhbGciOiJIUzI1NiIs..." }
```

**Set-Cookie:** `refresh_token=...; HttpOnly; Secure; SameSite=None`

**Ошибки:**

- `401` `Unit not found` — нет unit с **точным** `unitname`
- `401` `Unauthorized` — unit есть, passphrase неверный
- `403` — профиль не verified (`Profile not verified`)

---

### Flow B — Refresh + Logout

#### B1. POST `/v1/auth/refresh-token`

**Headers:**

- `Authorization: Bearer <accessToken>` — **обязателен** (может быть просрочен ≤ ~2 ч — grace period на бэке)
- Cookie: `refresh_token=...` — **обязателен**

**Body:** пустой

**Response 201:**

```json
{ "accessToken": "..." }
```

- новый `refresh_token` в Set-Cookie.

**Ошибки:** `400` — нет cookie; `401` — invalid/expired refresh.

**Стратегия фронта (факт):**

- Перехватчик 401 → один раз вызвать refresh → повторить запрос (`http.ts`)
- **Проактивный refresh не реализован** — только reactive на 401
- При неудачном refresh → clear auth state → `/login`

#### B2. POST `/v1/auth/logout`

**Headers:** `Authorization: Bearer <accessToken>`

**Response 201:**

```json
{ "message": "Logout successful" }
```

Cookie `refresh_token` очищается сервером (`clearCookie`).

---

### Flow C — Смена passphrase (logged-in)

```
GET security-question → passphrase-challenge { securityAnswer } → change-passphrase → (auto-login, новые токены)
```

UI: модалка на `/unit_profile` — сначала вопрос, затем цифры + passphrase.

#### C0. GET `/v1/auth/security-question`

**Headers:** Bearer

**Response 200:** `{ "question": "what city were you born in" }`

#### C1. POST `/v1/auth/passphrase-challenge`

**Headers:** Bearer

**Body:** `{ "securityAnswer": "night city" }`

**Response 201:**

```json
{
  "digits": "9876543210000000",
  "expiresAt": "2024-06-09T14:26:55.148Z"
}
```

- `digits` — 16 цифр, **non-increasing / descending** (каждая ≤ предыдущей)
- TTL challenge: **10 минут**
- Цифры выдаются **только** после верного `securityAnswer`
- Новый вызов **заменяет** предыдущий challenge, пока не исчерпан лимит: **3 вызова за 60 минут** → `400 Digit challenge limit reached. Try again later.`
- Неверный ответ: `403 Invalid security answer`. 5 неудач → `429` на 15 минут.

#### C2. POST `/v1/auth/change-passphrase`

**Headers:** Bearer (старый accessToken)

**Body:**

```json
{
  "currentPassphrase": "my old passphrase",
  "digitSequence": "9876543210000000",
  "newPassphrase": "my new passphrase"
}
```

**Правило `digitSequence`:** те же 16 цифр **как показаны** в challenge (слева направо, descending).

**Response 201:**

```json
{ "accessToken": "..." }
```

- новый refresh cookie. **Все старые сессии закрыты** — сохрани новый accessToken.

**Ошибки:**

- `401` — неверный currentPassphrase
- `400` — challenge expired/missing, invalid digitSequence, new === current

**Порядок полей в UI:** current passphrase → digit challenge → new passphrase.

---

### Flow D — Forgot / Reset passphrase (public)

```
security-question → round-1/challenge { securityAnswer } → round-1/verify → reset (+ auto-login)
```

#### D0. POST `/v1/auth/forgot-passphrase/security-question`

**Body:** `{ "unitname": "Kira" }`

**Response 201:** `{ "question": "what city were you born in" }`

Только **verified** unit; 404 / 403 иначе.

#### D1. POST `/v1/auth/forgot-passphrase/round-1/challenge`

**Body:**

```json
{ "unitname": "Kira", "securityAnswer": "night city" }
```

**Response 201:**

```json
{
  "digits": "9817654321000000",
  "expiresAt": "..."
}
```

- `digits` — 16 **случайных** цифр (без особого порядка)
- Только для **verified** unit, и **только** после верного `securityAnswer`
- TTL round 1: **10 минут**
- Повторный вызов **сбрасывает** весь reset-state
- Неверный ответ: `403 Invalid security answer`. 5 неудач → `429` на 15 минут.

**UI (`ForgotPassphraseRound1Page`):** scattered `FloatingDigits` (как verify), не `.code-block` и не одна строка.

#### D2. POST `/v1/auth/forgot-passphrase/round-1/verify`

**Body:**

```json
{
  "unitname": "Kira",
  "digitSequence": "2468975311000000"
}
```

**Правило API (что уходит в `digitSequence`, по значениям цифр):**

1. Сначала все ненулевые **чётные** цифры по возрастанию
2. Затем все ненулевые **нечётные** цифры по убыванию
3. Затем все **нули**

**Пример (что должен получить сервер):**

```
Показано:  9 8 1 7 6 5 4 3 2 1 0 0 0 0 0 0
Чётные ненулевые: 8,6,4,2 → 2468
Нечётные ненулевые: 9,1,7,5,3,1 → 975311
Нули: 000000
Отправить: 2468975311000000
```

**Факт UI (`ForgotPassphraseRound1Page`):**

- Пользователь вводит **16 цифр по правилу** (чётные по возрастанию, нечётные по убыванию, затем нули).
- Клиент проверяет ввод против `buildForgotRound1Input(shownDigits)` и шлёт ту же последовательность.

**Response 201:**

```json
{
  "digits": "5432109876543210",
  "expiresAt": "..."
}
```

`expiresAt` — окно round 2 (TTL). Поле `digits` в ответе служебное (хранится для session/TTL); UI round 2 **не** показывает и **не** шлёт цифры.

#### D3. POST `/v1/auth/forgot-passphrase/reset`

**Body:**

```json
{
  "unitname": "Kira",
  "newPassphrase": "my new passphrase"
}
```

**Правило round 2:** только новый passphrase. Проверка цифр уже пройдена в round 1.

**Response 201:**

```json
{ "accessToken": "..." }
```

- refresh cookie → пользователь залогинен.

**Ошибки:**

- `400` — reset session expired, validation
- `404` — unit not found
- `403` — not verified

---

## 5. Сводка: правила ввода 16 цифр

| Шаг               | Endpoint                                 | Как показываем              | Что отправляем                                             |
| ----------------- | ---------------------------------------- | --------------------------- | ---------------------------------------------------------- |
| Register verify   | `/auth/verify`                           | `verificationCode` как есть | **Точная копия**, слева направо                            |
| Change passphrase | `/auth/change-passphrase`                | `digits` challenge          | **Точная копия**, descending                               |
| Forgot round 1    | `/auth/forgot-passphrase/round-1/verify` | `digits` random             | even-asc, odd-desc, zeros (`buildForgotRound1Input`) |
| Forgot round 2    | `/auth/forgot-passphrase/reset`          | —                           | только `newPassphrase`                                     |

### TypeScript: helper для round 1 (forgot)

```typescript
/** Non-zero evens asc, then non-zero odds desc, then zeros. */
export function buildForgotRound1Input(digits: string): string {
  if (digits.length !== 16) throw new Error('Expected 16 digits');
  const values = [...digits].map((char) => Number(char));
  const evenAsc = values
    .filter((digit) => digit !== 0 && digit % 2 === 0)
    .sort((a, b) => a - b);
  const oddDesc = values
    .filter((digit) => digit % 2 === 1)
    .sort((a, b) => b - a);
  const zeros = values.filter((digit) => digit === 0);
  return [...evenAsc, ...oddDesc, ...zeros].join('');
}
```

### Проверка non-increasing (для client-side UX на change-passphrase)

```typescript
export function isNonIncreasingDigits(value: string): boolean {
  if (!/^\d{16}$/.test(value)) return false;
  for (let i = 1; i < value.length; i++) {
    if (Number(value[i]) > Number(value[i - 1])) return false;
  }
  return true;
}
```

---

## 6. Таблица ошибок (auth)

| statusCode | message (пример)                                            | Когда                          |
| ---------- | ----------------------------------------------------------- | ------------------------------ |
| 201        | body `{ status: 'retry', code, attemptsRemaining }`         | verify — неверный код (не 400) |
| 201        | body `{ status: 'destroyed' }`                              | verify — 3-я ошибка            |
| 400        | `Challenge expired or missing`                              | change-passphrase / forgot     |
| 400        | `Reset session expired or incomplete`                       | forgot reset (round-1 window)  |
| 400        | `Invalid digit sequence`                                    | change-passphrase / forgot round-1 verify |
| 400        | `Digit challenge limit reached. Try again later.`           | passphrase-challenge (3 / 60 мин) |
| 400        | `New passphrase must differ from current passphrase`        | change-passphrase              |
| 400        | `Cookie is required!` / `Refresh token cookie is required!` | refresh без cookie             |
| 401        | `Unit not found`                                            | login — нет unit (exact case)  |
| 401        | `Unauthorized`                                              | login — неверный passphrase    |
| 401        | `Invalid current passphrase`                                | change-passphrase              |
| 403        | `Invalid security answer`                                   | passphrase-challenge / forgot challenge / DELETE `/units/me` |
| 403        | `Profile not verified`                                      | login / forgot для unverified  |
| 404        | `Unit not found`                                            | verify / forgot                |
| 409        | `Unitname already exists`                                   | register                       |
| 409        | `Profile already verified`                                  | повторный verify               |
| 429        | `Too many failed attempts. Try again after …`               | 5 неверных security answers    |

---

## 7. Структура фронта (факт: `App.tsx`)

### Роуты

```
/login
/register
/register/security-question
/register/verify
/system-failure
/forgot-passphrase
/forgot-passphrase/security-question
/forgot-passphrase/round-1
/forgot-passphrase/round-2

# Protected (Layout + ProtectedRoute):
/schedule
/notes/:taskId
/unit_profile          ← профиль + смена passphrase (НЕ /settings)
/                      → Navigate → /schedule
*                      → Navigate → /login
```

Смена passphrase — на странице **`/unit_profile`**, не `/settings/passphrase`.

### Auth store (Zustand + persist)

```typescript
// front/src/store/auth.store.ts — ключ persist: 'tasker-auth'
type BlockedState = {
  blockedAt: string | null;
  assessmentId: string | null;
  finalInvestigationAt?: string | null;
  replicantStrikeCount?: number;
};

type AuthState = {
  accessToken: string | null;
  unit: UnitProfile | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  blocked: BlockedState | null;
  setAuth: (accessToken: string, unit: UnitProfile) => void;
  setUnit: (unit: UnitProfile) => void;
  setToken: (accessToken: string) => void;
  setBlocked: (blocked: BlockedState | null) => void;
  clearAuth: () => void;
};
// partialize → { accessToken, blocked } в localStorage
```

После login / verify / change-passphrase / forgot-reset → сохранить `accessToken`, вызвать `GET /v1/units/me`, затем `setAuth`.

**Bootstrap:** дождаться hydration persist → если есть token → `GET /units/me` → `setAuth` или `clearAuth`; пока `isBootstrapping` — экран `Loading…`.

### GET `/v1/units/me` (профиль)

**Headers:** Bearer

**Response 200** — объект unit (без passphrase):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "unitname": "Kira",
  "isVerified": true,
  "verifiedAt": "2024-06-09T14:20:00.000Z",
  "image": null,
  "isLoggedIn": true,
  "isBlocked": false,
  "blockedAt": null,
  "blockingAssessmentId": null,
  "lastAssessmentAt": null,
  "reclassificationCount": 0,
  "baselineVersion": "v3.7.14",
  "disqualifiedFeatures": [],
  "manualOverrideAt": null,
  "replicantStrikeCount": 0,
  "finalInvestigationAt": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 8. TypeScript types (копировать в фронт)

```typescript
export type AccessTokenResponse = { accessToken: string };

export type VerifyResponse =
  | {
      status: 'verified';
      message: string;
      accessToken: string;
    }
  | {
      status: 'retry';
      code: string;
      attemptsRemaining: number;
    }
  | { status: 'destroyed' };

export type RegisterResponse = {
  id: string;
  unitname: string;
  verificationCode: string;
  isVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  isLoggedIn: boolean;
};

export type MessageResponse = { message: string };

export type ChallengeResponse = {
  digits: string;
  expiresAt: string;
};

export type LoginBody = { unitname: string; passphrase: string };
export type RegisterBody = LoginBody & {
  securityQuestion: string;
  securityAnswer: string;
};
export type VerifyBody = { unitname: string; code: string };

export type ChangePassphraseBody = {
  currentPassphrase: string;
  digitSequence: string;
  newPassphrase: string;
};
export type PassphraseChallengeBody = { securityAnswer: string };
export type SecurityQuestionResponse = { question: string };
export type ForgotUnitnameBody = { unitname: string };
export type ForgotRound1ChallengeBody = {
  unitname: string;
  securityAnswer: string;
};
export type ForgotRound1VerifyBody = {
  unitname: string;
  digitSequence: string;
};
export type ResetPassphraseBody = {
  unitname: string;
  newPassphrase: string;
};
```

---

## 9. API wrapper (готовые функции)

```typescript
const auth = {
  register: (body: RegisterBody) =>
    api('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  verify: (body: VerifyBody) =>
    api('/auth/verify', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: LoginBody) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  refresh: (accessToken: string) =>
    api('/auth/refresh-token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  logout: (accessToken: string) =>
    api('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  passphraseChallenge: (body: PassphraseChallengeBody) =>
    api('/auth/passphrase-challenge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),

  changePassphrase: (accessToken: string, body: ChangePassphraseBody) =>
    api('/auth/change-passphrase', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),

  forgotSecurityQuestion: (body: ForgotUnitnameBody) =>
    api('/auth/forgot-passphrase/security-question', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  forgotRound1Challenge: (body: ForgotRound1ChallengeBody) =>
    api('/auth/forgot-passphrase/round-1/challenge', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  forgotRound1Verify: (body: ForgotRound1VerifyBody) =>
    api('/auth/forgot-passphrase/round-1/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resetPassphrase: (body: ResetPassphraseBody) =>
    api('/auth/forgot-passphrase/reset', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  me: (accessToken: string) =>
    api('/units/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};
```

---

## 10. UX-чеклист для экранов с цифрами

- [x] **Register verify** — `FloatingDigits` scattered; ввод 16 цифр; auto-submit; auto-login → `/unit_profile`
- [x] **Forgot round 1** — even-asc, odd-desc, zeros; клиент шлёт `buildForgotRound1Input(shownDigits)`
- [x] **Forgot round 2** — только new passphrase → auto-login
- [x] **Change passphrase (`/unit_profile`)** — challenge digits + digit sequence + new passphrase
- [ ] При 400 `Challenge expired` — предложить перезапуск flow

---

## 11. Guard / protected routes

Любой роут кроме `@Public()` на бэке требует Bearer. На фронте (`ProtectedRoute` + `Bootstrap`):

1. `ProtectedRoute` смотрит на **`isAuthenticated`** (не только на наличие token)
2. Bootstrap: hydrate persist → token → `GET /units/me` → `setAuth` или `clearAuth`
3. 401 на запросе → один refresh → retry; fail → clearAuth → `/login`
4. После register → `/register/verify` (state с unitname + code); без verify нельзя попасть в app
5. После успешного verify → **сразу сессия**, не redirect на `/login`

---

## 12. Dev / тестирование

- E2E эталон: `test/auth.e2e-spec.ts`, helpers: `test/helpers/auth-test-utils.ts`
- Swagger: `http://localhost:3001/docs` → tag **Auth**
- Пример валидного passphrase в тестах: `'valid passphrase12'` (≥12 non-space chars)

### Быстрая проверка curl (register → verify auto-login)

```bash
BASE=http://localhost:3001/v1/auth

# register
REG=$(curl -s -X POST $BASE/register -H 'Content-Type: application/json' \
  -d '{"unitname":"TestUser123","passphrase":"valid passphrase12","securityQuestion":"what city were you born in","securityAnswer":"night city"}')

CODE=$(echo $REG | jq -r .verificationCode)
NAME=$(echo $REG | jq -r .unitname)

# verify → 201 + accessToken + Set-Cookie (отдельный login не нужен)
curl -s -c cookies.txt -X POST $BASE/verify -H 'Content-Type: application/json' \
  -d "{\"unitname\":\"$NAME\",\"code\":\"$CODE\"}"

# login — только для повторного входа
curl -s -c cookies.txt -X POST $BASE/login -H 'Content-Type: application/json' \
  -d "{\"unitname\":\"$NAME\",\"passphrase\":\"valid passphrase12\"}"
```

---

## 13. Что НЕ входит в auth (не путать)

| Было (legacy)                | Сейчас                                     |
| ---------------------------- | ------------------------------------------ |
| `/users`, email verification | Удалено — только **unitname + passphrase** |
| Logout в `/units`            | **`POST /v1/auth/logout`**                 |
| Roles / admin seeds          | Нет в Tasker API                           |

---

## 14. Диаграмма всех потоков

```mermaid
flowchart TD
  subgraph public [Public]
    R[POST /register] --> V[POST /verify]
    F0[POST /forgot security-question] --> F1[POST /forgot round-1/challenge]
    F1 --> F2[POST /forgot round-1/verify]
    F2 --> F3[POST /forgot reset]
    L[POST /login]
  end

  subgraph authed [Bearer required]
    ME[GET /units/me]
    SQ[GET /security-question] --> PC[POST /passphrase-challenge]
    PC --> CP[POST /change-passphrase]
    LO[POST /logout]
    RF[POST /refresh-token]
  end

  V -->|verified: accessToken + cookie| ME
  L -->|accessToken + cookie| ME
  CP -->|new tokens| ME
  F3 -->|new tokens| ME
  RF -->|new accessToken| ME
  V --> UP[/unit_profile]
  L --> SCH[/schedule]
  F3 --> SCH
  CP --> UP
```

---

_Документ синхронизирован с бэкендом Tasker (`src/auth/`) и фронтом (`front/src`). При расхождении API vs UI — оба факта указаны явно; приоритет API у Swagger `/docs` и исходников._
