# Tasker — фронтенд профиля unit (спецификация для агента)

Документ описывает **API профиля unit** для реализации фронтенда Tasker. Источник правды — бэкенд NestJS (`/v1/units`). Swagger: `{API_URL}/docs`.

> Регистрация, login, logout, смена/сброс passphrase — в [auth.md](./auth.md) (`/v1/auth`).  
> Все роуты ниже требуют `Authorization: Bearer <accessToken>`.

---

## 1. Базовые настройки

| Параметр | Значение |
|----------|----------|
| Base URL API | Dev: Vite proxy same-origin `/v1` → `:3001`; prod: `VITE_API_URL` (empty in dev = proxy) |
| Префикс | **`/v1/units`** |
| Auth | JWT Bearer (после login) |
| Content-Type | `application/json` (кроме upload avatar) |

После login / **verify (auto-login)** / change-passphrase / forgot-reset → сохранить `accessToken`, затем **`GET /v1/units/me`** для профиля в state.

---

## 2. Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/units/me` | Текущий профиль |
| PATCH | `/units/me` | Обновить профиль (сейчас — только `unitname`) |
| DELETE | `/units/me` | Удалить аккаунт (`securityAnswer`) |
| POST | `/units/image` | Загрузить/заменить аватар |

**Не в `/units` (см. auth.md):** register, verify, login, logout, refresh-token, passphrase-challenge, change-passphrase, forgot-passphrase.

---

## 3. Модель Unit (профиль)

Поля, которые **не возвращаются** ( `@Exclude` на бэке): `passphrase`, challenge-коды, `verificationCode`, `deletedAt`.

```typescript
type UnitProfile = {
  id: string; // UUID
  unitname: string;
  isVerified: boolean;
  verifiedAt: string | null; // ISO UTC, после verify
  image: string | null; // Cloudinary URL
  isLoggedIn: boolean;
  isBlocked: boolean;
  blockedAt: string | null; // ISO UTC
  blockingAssessmentId: string | null;
  lastAssessmentAt: string | null;
  reclassificationCount?: number;
  baselineVersion?: string;
  disqualifiedFeatures?: string[];
  manualOverrideAt?: string | null;
  replicantStrikeCount?: number;
  finalInvestigationAt?: string | null;
  createdAt: string; // ISO UTC
  updatedAt: string; // ISO UTC
  sessions?: Session[]; // может прийти из eager-relation — для UI не использовать
};

type Session = {
  id: string;
  createdAt: string;
  deletedAt: string | null;
};
```

Используй в state только поля профиля; массив `sessions` игнорируй (технический артефакт ORM).

---

## 4. GET `/units/me`

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**

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
  "createdAt": "2024-06-09T14:16:55.148Z",
  "updatedAt": "2024-06-09T14:16:55.148Z"
}
```

**Ошибки:**

| Код | Когда |
|-----|-------|
| `401` | Нет/невалидный token, сессия закрыта |

**Когда вызывать:**

- после login / verify auto-login / change-passphrase / forgot-reset;
- при загрузке приложения (bootstrap), если в persist есть accessToken;
- после PATCH `/units/me` или POST `/units/image` — обновить локальный state из ответа или повторить GET.

---

## 5. PATCH `/units/me`

Обновление своего профиля. Сейчас поддерживается только смена **`unitname`**.

### Body

| Поле | Обязательно | Правила |
|------|-------------|---------|
| `unitname` | нет (patch) | regex `^[a-zA-Z0-9]{3,}$` — мин. 3 символа, только латиница/цифры |

```json
{
  "unitname": "NewName"
}
```

**Response 200** — обновлённый объект unit (как GET `/me`).

**Ошибки:**

| Код | Когда |
|-----|-------|
| `400` | Невалидный формат: `Incorrect format of unit name (Latin letters and digits only)` |
| `401` | Unauthorized |
| `404` | Unit not found |
| `409` | `Unitname already exists` — занят без учёта регистра, включая soft-deleted (`isUnitnameTaken` / `LOWER(unitname)`). Не unique interceptor. |

> Уникальность `unitname` при PATCH: **409** `Unitname already exists` — тот же путь, что при register. Хранимый регистр не меняется. Login по-прежнему **exact case**.

---

## 6. DELETE `/units/me`

Удаление аккаунта текущего unit. Требует верный ответ на секретный вопрос (тот же lockout, что у смены/восстановления passphrase: 5 ошибок → 15 минут, `429`).

**Headers:** Bearer

**Body:**

```json
{ "securityAnswer": "night city" }
```

Перед вызовом фронт берёт вопрос через `GET /auth/security-question` (`{ "question": "…" }`) и показывает его в confirm-модалке.

**Response 200** — результат TypeORM delete (например `{ "raw": [], "affected": 1 }`).

**После успеха на фронте (`UnitProfilePage`):**

- открыть confirm: `GET /auth/security-question` → вопрос + поле ответа;
- вызвать `DELETE /units/me` с `{ securityAnswer }`, затем `clearAuth()` (logout **до** delete клиент **не** вызывает);
- redirect на `/login`;
- cookie `refresh_token` может остаться до протухания — при необходимости вызвать `POST /auth/logout` до delete.

**Ошибки:**

- `400` — невалидный `securityAnswer`;
- `401` — unauthorized;
- `403` — `Invalid security answer`;
- `429` — lockout после 5 неверных ответов.

---

## 7. POST `/units/image` — аватар

Загрузка или замена аватара. Старый файл в Cloudinary удаляется, если `image` уже был.

### Request

- **Content-Type:** `multipart/form-data`
- **Field name:** `image` (обязательно)
- **Auth:** Bearer

### Ограничения файла

| Правило | Значение |
|---------|----------|
| Max size | **2 MB** |
| MIME | `image/*` (любой image) |

### Пример (fetch)

```typescript
const form = new FormData();
form.append('image', file); // File из <input type="file" accept="image/*">

const res = await fetch(`${API_BASE}/v1/units/image`, {
  method: 'POST',
  credentials: 'include',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: form, // без Content-Type — браузер сам выставит boundary
});
```

### Response 201

```json
{
  "secure_url": "https://res.cloudinary.com/.../avatar.png"
}
```

URL также сохраняется в `unit.image` — обнови профиль в state (`secure_url` или повторный GET `/me`).

**Ошибки:**

| Код | Когда |
|-----|-------|
| `400` | Нет файла / неверный тип / > 2MB |
| `401` | Unauthorized |
| `500` | Ошибка Cloudinary |

---

## 8. Валидация unitname (общая)

Те же regex-правила, что при register ([auth.md](./auth.md)), но **тексты 400 разные**:

- Regex: `^[a-zA-Z0-9]{3,}$` (латиница + цифры; кириллица запрещена)
- Примеры: `Kira`, `user123` (невалидно: `Иван`)
- PATCH `/units/me`: `Incorrect format of unit name (Latin letters and digits only)`
- Register: `Unitname must be at least 3 characters and contain only Latin letters and digits`
- Уникальность: case-insensitive (`LOWER`); lookup login/verify/forgot — exact case

---

## 9. Связь с auth

```
register + verify (auth, auto-login) → GET /units/me → /unit_profile
login (auth) → GET /units/me → /schedule
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
              PATCH /me                  POST /image              DELETE /me
           (unitname)                   (avatar)                 (удаление)
```

| Действие | Роут |
|----------|------|
| Страница профиля UI | **`/unit_profile`** (не `/settings`) |
| Logout | `POST /v1/auth/logout` |
| Refresh | `POST /v1/auth/refresh-token` |
| Смена passphrase | `/v1/auth/passphrase-challenge` + `/change-passphrase` (UI на `/unit_profile`) |
| Forgot passphrase | `/v1/auth/forgot-passphrase/...` |

---

## 10. TypeScript types (копировать в фронт)

```typescript
export type UnitProfile = {
  id: string;
  unitname: string;
  isVerified: boolean;
  verifiedAt: string | null;
  image: string | null;
  isLoggedIn: boolean;
  isBlocked: boolean;
  blockedAt: string | null;
  blockingAssessmentId: string | null;
  lastAssessmentAt: string | null;
  reclassificationCount?: number;
  baselineVersion?: string;
  disqualifiedFeatures?: string[];
  manualOverrideAt?: string | null;
  replicantStrikeCount?: number;
  finalInvestigationAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateUnitBody = {
  unitname?: string;
};

export type DeleteAccountBody = {
  securityAnswer: string;
};

export type UploadImageResponse = {
  secure_url: string;
};
```

---

## 11. Чеклист UI

- [x] После login / verify — `GET /units/me` в profile state
- [x] Страница профиля — маршрут **`/unit_profile`**
- [x] Показывать `image` или placeholder; upload через FormData field `image`
- [x] Редактирование unitname — только PATCH `/units/me` (409 при конфликте)
- [x] Logout / passphrase — на `/unit_profile`, API из auth.md
- [x] Delete account — security question → DELETE `/me` `{ securityAnswer }` → `clearAuth()` → `/login`
- [x] Не хранить и не отображать `sessions` из ответа `/me`
