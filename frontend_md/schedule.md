# Tasker — фронтенд расписания (спецификация для агента)

Документ описывает **API задач** для реализации фронтенда Tasker. Источник правды — бэкенд NestJS (`/v1/schedule`). Swagger: `{API_URL}/docs`.

> Auth: см. [auth.md](./auth.md). Все роуты ниже требуют `Authorization: Bearer <accessToken>`.

---

## 1. Базовые настройки

| Параметр | Значение |
|----------|----------|
| Base URL API | Dev: Vite proxy `/v1` → `:3001`; prod: `VITE_API_URL` |
| Префикс | **`/v1/schedule`** |
| Даты в body | Строгий ISO UTC: `YYYY-MM-DDTHH:mm:ss.sssZ` (например `2024-05-29T17:27:11.797Z`) |
| Даты в query | Сырые строки, **без** `IsValidDate`. Фильтр BETWEEN только если заданы **оба** `startDate` и `endDate`; один параметр → полный список |

**Важно для UI:**

- `startDate` при создании **необязателен** — если пользователь не указал, поле **не шлём** (в ответе будет `null`).
- `startDate` устанавливается **один раз** через `PATCH /schedule/start/:taskId` или при create; после этого **нельзя менять**.
- `deadline` при создании **обязателен**.
- `deadline` **нельзя менять** после создания — не показывать редактирование дедлайна на форме update.
- Задача ограничена **одним UTC calendar day**: часы обнуляются, затем `differenceInDays >= 1` → бэкенд `409 The task should be limited to one day!` (другая UTC-дата, даже на 1с после полуночи). Спан ~23ч в тот же UTC-день — ок. Это **не** wall-clock 24h. `deadline <= startDate` → **400** `Deadline must be after start date.` Фронт (`validateStartDeadline`) блокирует submit раньше.

---

## 2. Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/schedule` | Создать задачу |
| GET | `/schedule` | Список задач (опционально по диапазону дат) |
| GET | `/schedule/search` | Поиск по title/description (пагинация) |
| GET | `/schedule/:id` | Одна задача |
| PATCH | `/schedule/:id` | Обновить задачу (без `deadline`, без `startDate`) |
| PATCH | `/schedule/start/:taskId` | Старт задачи — один раз установить `startDate` |
| PATCH | `/schedule/toggle-status/:taskId` | Completed / uncompleted |
| DELETE | `/schedule/:id` | Удалить задачу |
| DELETE | `/schedule` | Удалить **все** задачи unit (swagger: only for testing) |

---

## 3. Модель Task (ответ API)

```typescript
type Task = {
  id: string; // UUID
  title: string;
  description: string | null;
  category: 'work' | 'life' | 'learning';
  priority: 'high' | 'medium' | 'low';
  complexity: number; // 1–20
  createDate: string; // ISO UTC
  startDate: string | null; // ISO UTC или null
  deadline: string; // ISO UTC, immutable после create
  completeDate: string | null;
  overdueReason: string | null;
};
```

---

## 4. POST `/schedule` — создание

### Body

| Поле | Обязательно | Примечание |
|------|-------------|------------|
| `title` | да | 2–200 символов, lowercase на бэке; charset `taskTitleRegex` (латиница, цифры, пунктуация; **без кириллицы**) |
| `category` | да | `work` \| `life` \| `learning` |
| `priority` | да | `high` \| `medium` \| `low` |
| `complexity` | да | 1–20 |
| `deadline` | **да** | строгий ISO UTC, не в прошлом |
| `startDate` | нет | строгий ISO UTC, не в прошлом; если нет — сохранится `null` |
| `description` | нет | 2–2000 символов; тот же charset что title |

### Пример (без startDate)

```json
{
  "title": "Review PR",
  "category": "work",
  "priority": "medium",
  "complexity": 5,
  "deadline": "2026-07-24T21:00:00.000Z"
}
```

### Пример (с startDate)

```json
{
  "title": "Morning standup prep",
  "category": "work",
  "priority": "low",
  "complexity": 3,
  "startDate": "2026-07-24T09:00:00.000Z",
  "deadline": "2026-07-24T10:00:00.000Z",
  "description": "Prepare agenda"
}
```

### Валидация (если передан startDate)

- `deadline` должен быть **после** `startDate` (иначе **400** `Deadline must be after start date.`).
- Разница start/deadline — **один UTC calendar day** (`differenceDays >= 1` → 409), не wall-clock 24h.

### Ответ `201`

```json
{
  "task": { /* Task */ }
}
```

---

## 5. PATCH `/schedule/:id` — обновление

### Body (все поля опциональны)

| Поле | Можно менять |
|------|--------------|
| `title` | да |
| `description` | да |
| `category` | да |
| `priority` | да |
| `complexity` | да |
| `startDate` | **нет** — immutable; поле в body → **400**, `message`: `["startDate cannot be changed after create"]` |
| `deadline` | **нет** — immutable; поле в body → **400**, `message`: `["deadline cannot be changed after create"]` |

```json
{
  "priority": "high",
  "title": "updated title"
}
```

---

## 6. PATCH `/schedule/start/:taskId` — старт задачи

Один раз устанавливает `startDate` для задачи, у которой оно ещё `null`.

### Body

| Поле | Обязательно | Примечание |
|------|-------------|------------|
| `startDate` | **да** | ISO UTC, не в прошлом |

```json
{
  "startDate": "2026-07-24T14:00:00.000Z"
}
```

### Валидация

- `deadline` задачи должен быть **после** `startDate` (иначе **400**).
- Разница start/deadline — **один UTC calendar day** (`differenceDays >= 1` → 409).
- Если `startDate` уже установлен (при create или ранее через start) → **409** `Task already started`.
- Параллельные `PATCH start` на одну задачу: бэкенд берёт row lock; один запрос 200, второй **409**.

### Response `200`

Обновлённый объект `Task`.

---

## 7. GET `/schedule` — список

### Query (опционально)

| Параметр | Описание |
|----------|----------|
| `startDate` | Начало диапазона (ISO UTC) |
| `endDate` | Конец диапазона (ISO UTC) |

Оба query нужны для фильтра по `task.startDate` (**BETWEEN**). Без них **или если задан только один** — все задачи unit. Query **не** прогоняется через `IsValidDate` (в отличие от дат в body).

**Важно:** задачи с `startDate: null` **не попадают** в отфильтрованный результат (фильтр только по заполненному `startDate`).

### Ответ `200`

```json
[ { /* Task */ }, ... ]
```

---

## 8. PATCH `/schedule/toggle-status/:taskId`

Переключает completed ↔ uncompleted.

### Body

```json
{
  "overdueReason": "Was stuck in meetings all day"
}
```

| Situation | `overdueReason` |
|-----------|-----------------|
| Завершение **не** просроченной задачи | опционально |
| Завершение **просроченной** задачи (`now > deadline`, ещё не completed) | **обязателен** (иначе 400); charset = `taskTitleRegex` (без кириллицы), ≤200 |
| Снятие completed | не нужен |

---

## 9. GET `/schedule/search`

| Query | Обязательно | Default в swagger | Факт `ParseIntPipe` |
|-------|-------------|-------------------|---------------------|
| `query` | да | — | — |
| `searchIn` | нет | `title` (`title` \| `description`) | — |
| `limit` | **да на практике** | 5 | без значения → **400** (pipe не optional) |
| `page` | **да на практике** | 1 | без значения → **400** |

### Ответ `200` (найдено)

```json
{
  "data": [ { /* Task */ } ],
  "total": 10,
  "page": 1,
  "limit": 5
}
```

### Ответ `200` (пусто)

```json
{ "message": "tasks not found" }
```

**Не** массив `Task[]`.

**UI (front):** `scheduleApi.searchTasks` всегда шлёт `limit=5` и `page=1` (swagger defaults). `SchedulePage` парсит ответ: при `message` → пустой список, иначе `payload.data`.

---

## 9.1 DELETE `/schedule` — удалить все

Удаляет все задачи текущего unit. В swagger помечен как **only for testing**. Фронт UI **не** вызывает.

---

## 10. Breaking changes (для миграции фронта)

| Было | Стало |
|------|-------|
| `startDate` обязателен при create | **Опционален**; без поля → `null` |
| `startDate` можно было PATCH `/schedule/:id` | **Immutable** — только create или `PATCH /schedule/start/:taskId` (один раз); extra field на PATCH `/:id` → **400** |
| `deadline` можно было PATCH | **Immutable** — только при create; extra field на PATCH `/:id` → **400** |

---

## 11. Чеклист UI

- [x] Маршрут списка: `/schedule`; заметки задачи: `/notes/:taskId`
- [x] Форма create: `deadline` required, `startDate` optional
- [x] Старт задачи: `PATCH /schedule/start/:taskId` (если `startDate === null`)
- [x] Форма edit: **нет** полей `deadline` и `startDate`
- [x] Toggle complete: modal с `overdueReason` если задача просрочена
- [x] Все даты — строгий UTC ISO, без `offset` query
- [x] Search: парсит `{ data, total, page, limit }` / `{ message }`; всегда шлёт `limit`+`page` (defaults 5/1)
- [x] Create/start: клиент `validateStartDeadline` (один UTC calendar day); бэкенд `differenceDays >= 1` → 409; порядок дат → 400
- [ ] `GET /schedule/:id` — есть в `scheduleApi`, страница **не** вызывает
- [ ] `DELETE /schedule` (все) — не показывать в прод-UI |