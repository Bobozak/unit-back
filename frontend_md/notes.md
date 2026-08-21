# Tasker — фронтенд заметок к задачам (спецификация для агента)

Документ описывает **API заметок** для реализации фронтенда Tasker. Источник правды — бэкенд NestJS (`/v1/notes`). Swagger: `{API_URL}/docs`.

> Auth: см. [auth.md](./auth.md). Задачи: см. [schedule.md](./schedule.md).  
> Все роуты ниже требуют `Authorization: Bearer <accessToken>`.

---

## 1. Базовые настройки

| Параметр | Значение |
|----------|----------|
| Base URL API | Dev: Vite proxy `/v1` → `:3001`; prod: `VITE_API_URL` |
| Префикс | **`/v1/notes`** |
| Content-Type | `application/json` |

**Важно для UI:**

- Заметки **не приходят** в ответах `/v1/schedule` — загружать отдельно.
- Unit видит только заметки **своих** задач (ownership через task).
- У заметки одно поле контента: `text` (max **1500** символов).
- Charset: `noteTextRegex` — латиница, цифры, пунктуация, whitespace; **кириллица запрещена** (бэкенд + фронт `NOTE_TEXT_REGEX`).
- UI-маршрут: `/notes/:taskId`.

---

## 2. Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/notes/task/:taskId` | Создать заметку для задачи |
| GET | `/notes/task/:taskId` | Все заметки задачи |
| GET | `/notes/:id` | Одна заметка |
| PATCH | `/notes/:id` | Обновить текст |
| DELETE | `/notes/:id` | Удалить заметку |

---

## 3. Модель Note (ответ API)

```typescript
type Note = {
  id: string; // UUID
  text: string; // max 1500
  taskId: string; // UUID задачи
  createdAt: string; // ISO UTC
  updatedAt: string; // ISO UTC
};
```

---

## 4. POST `/notes/task/:taskId` — создание

### Body

| Поле | Обязательно | Правила |
|------|-------------|---------|
| `text` | **да** | string, не пустой, max 1500; `noteTextRegex` (латиница, цифры, пунктуация, whitespace/`\n\r\t`; кириллица запрещена) |

```json
{
  "text": "Remember to review the design before deadline"
}
```

### Response `201`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "text": "Remember to review the design before deadline",
  "taskId": "550e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2026-07-24T10:00:00.000Z",
  "updatedAt": "2026-07-24T10:00:00.000Z"
}
```

**Ошибки:**

| Код | Когда |
|-----|-------|
| `400` | Пустой/слишком длинный `text` |
| `401` | Unauthorized |
| `404` | Задача не найдена или не принадлежит unit |

---

## 5. GET `/notes/task/:taskId` — список

### Response `200`

```json
[
  {
    "id": "...",
    "text": "...",
    "taskId": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

Сортировка: **новые сверху** (`createdAt DESC`).

Пустой массив `[]` — если заметок нет (не ошибка).

---

## 6. GET `/notes/:id`

### Response `200`

Объект `Note`.

**Ошибки:** `404` — заметка не найдена или task не принадлежит unit.

**Факт UI:** `notesApi.getNote` есть в клиенте, страница **не** вызывает — список грузится через `GET /notes/task/:taskId`.

---

## 7. PATCH `/notes/:id` — обновление

### Body

| Поле | Обязательно | Правила |
|------|-------------|---------|
| `text` | **да** | string, не пустой, max 1500; тот же `noteTextRegex`. Omit `text` **не** no-op: сервис пишет `note.text = payload.text!` |

```json
{
  "text": "Updated note text"
}
```

### Response `200`

Обновлённый объект `Note`.

---

## 8. DELETE `/notes/:id`

### Response `200`

Удалённая заметка (объект `Note` до удаления).

---

## 9. TypeScript types (копировать в фронт)

```typescript
export type Note = {
  id: string;
  text: string;
  taskId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteBody = {
  text: string;
};

export type UpdateNoteBody = {
  text: string;
};
```

---

## 10. Пример API wrapper

```typescript
export async function getTaskNotes(taskId: string) {
  const res = await api(`/notes/task/${taskId}`);
  if (!res.ok) throw await res.json();
  return res.json() as Promise<Note[]>;
}

export async function createTaskNote(taskId: string, text: string) {
  const res = await api(`/notes/task/${taskId}`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw await res.json();
  return res.json() as Promise<Note>;
}
```

---

## 11. Чеклист UI

- [x] Экран `/notes/:taskId`: загрузка через `GET /notes/task/:taskId`
- [x] Textarea/input с лимитом 1500 + клиентский `NOTE_TEXT_REGEX`
- [x] Создание → POST, редактирование → PATCH, удаление → DELETE
- [x] Не ожидать notes в ответе `GET /schedule/:id`
- [x] При удалении задачи заметки удаляются на бэке (CASCADE)
- [ ] `GET /notes/:id` — wrapper есть, UI не использует