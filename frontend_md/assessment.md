# Tasker — фронтенд assessment (спецификация для агента)

Документ описывает **API еженедельной оценки unit** для фронтенда. Источник правды — бэкенд NestJS (`/v1/assessment`). Swagger: `{API_URL}/docs`.

> Auth: [auth.md](./auth.md). Профиль: [units.md](./units.md). Diagnostics: [diagnostics.md](./diagnostics.md).  
> Внутренние роуты (`/v1/internal/assessment`) — только для крон-сервиса / отладки, фронт их не вызывает.

---

## 1. Базовые настройки

| Параметр | Значение |
|----------|----------|
| Base URL API | Dev: Vite proxy `/v1` → `:3001`; prod: `VITE_API_URL` |
| Префикс | **`/v1/assessment`** |
| Auth | JWT Bearer |
| Content-Type | `application/json` |

UI: отдельного маршрута `/assessment` **нет** (`App.tsx` его не регистрирует). Компонент `AssessmentPage` есть, но не смонтирован. На защищённых страницах `Layout` рендерит `AssessmentNotice` — модалку `AssessmentReportModal` для неподтверждённых `inconclusive` / `replicant`. Отчёты `human` сами не всплывают и отдельной страницы не имеют.

При `unit.isBlocked === true` — `BlockGate` рендерит `RetiredTerminal` (диагностика / rebaseline). Если задан `finalInvestigationAt` — `FinalInvestigationLock` без diagnostics. Навигация по обычным роутам недоступна.

---

## 2. Эндпоинты (фронт)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/assessment/me` | Последний отчёт. **Разрешён при блоке** (`@AllowWhenBlocked`). 404 если отчёта ещё нет |
| GET | `/assessment/me/history?limit=` | Снапшоты **урезанной** формы (см. ниже). Default 12, max 50. Невалидный `limit` → **400**. **Не** в allowlist: при блоке → `403 UNIT_BLOCKED` |
| POST | `/assessment/me/acknowledge` | Пометить последний отчёт прочитанным. **Не** в allowlist: при блоке → `403 UNIT_BLOCKED` |

---

## 3. Модель отчёта

```typescript
type AssessmentVerdict = 'human' | 'inconclusive' | 'replicant';

type FeatureBreakdown = {
  value: number | null; // 0..1, 1 = машинное поведение
  weight: number;
  skipped: boolean;
};

type AssessmentReport = {
  id: string;
  periodStart: string; // ISO UTC
  periodEnd: string;
  computedAt: string;
  sampleSize: number;
  features: Record<
    | 'perfection'
    | 'regularity'
    | 'circadian'
    | 'loadResilience'
    | 'excuses'
    | 'uniformity'
    | 'procrastination',
    FeatureBreakdown
  >;
  metrics: Record<string, number | null>;
  score: number; // 0..1
  replicantProbability: number; // 0..1
  verdict: AssessmentVerdict;
  acknowledgedAt: string | null;
  revision: number;
  origin: 'scheduled' | 'rebaseline';
  disqualifiedFeatures: string[];
  supersedesAssessmentId: string | null;
};
```

`GET /assessment/me` возвращает полный `AssessmentReport` (`revision` / `origin` / `disqualifiedFeatures` всегда есть).

`GET /assessment/me/history` — **не** полный отчёт, только:

```typescript
type AssessmentHistorySnapshot = {
  id: string;
  computedAt: string;
  periodEnd: string;
  sampleSize: number;
  score: number;
  replicantProbability: number;
  verdict: AssessmentVerdict;
};
```

---

## 4. Блокировка

`GET /units/me` возвращает `isBlocked`, `blockedAt`, `blockingAssessmentId`, `replicantStrikeCount`, `finalInvestigationAt`.

Источник правды — колонка `units.isBlocked`. Проверка **только на HTTP к API**, не на любой клик и не на клиентский переход по роуту.

Если unit заблокирован, любой JWT-запрос вне allowlist даёт:

```json
{
  "statusCode": 403,
  "error": "UNIT_BLOCKED",
  "blockedAt": "2026-08-15T03:00:00.000Z",
  "assessmentId": "550e8400-e29b-41d4-a716-446655440020",
  "finalInvestigationAt": null,
  "replicantStrikeCount": 1
}
```

Allowlist: login/register/forgot (`@Public()`), `GET /units/me`, `GET /assessment/me`, `POST /auth/refresh-token`, весь `/diagnostics/*`.

Фронт:

1. Persist `blocked` вместе с `accessToken` (zustand `tasker-auth`).
2. `apiWithAuth` при 403 + `error === 'UNIT_BLOCKED'` вызывает `setBlocked` (`res.clone().json()`).
3. `BlockGate` рендерит `RetiredTerminal` вместо роутера, либо `FinalInvestigationLock` если `finalInvestigationAt` задан. Экран VERDICT, затем DIAGNOSTICS — см. [diagnostics.md](./diagnostics.md). На 4-й `verdict=replicant` diagnostics недоступен. Logout на обычных роутах недоступен, пока блок держится.
4. После `GET /units/me` с `isBlocked: false` стор очищает `blocked` (через `setUnit`).
5. **Не** поллить `GET /units/me` на клик/навигацию. **Не** использовать сокеты/SSE. Простаивающая вкладка без API-запроса блок не покажет — только следующее действие, которое бьёт API, reload или новый login.

---

## 5. Еженедельная модалка

Pull-модель: при монтировании Layout (`GET /assessment/me`). Нет push.

Показывать модалку, если `acknowledgedAt === null` и `verdict !== 'human'`.

Подтверждение: `POST /assessment/me/acknowledge`. Для `replicant` модалка не нужна — экран блокировки уже показывает приговор.

Отчёты `human` **не** показываются отдельной страницей (маршрута `/assessment` нет). Модалка их тоже не поднимает.

---

## 6. Внутренние роуты (не для UI)

Заголовок `x-internal-key: <INTERNAL_API_KEY>`.

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/internal/assessment/run` | Прогон всех verified units |
| POST | `/internal/assessment/run/:unitId` | Один unit |
| POST | `/internal/assessment/simulate` | Расчёт без записи (debug) |
| POST | `/internal/assessment/units/:unitname/block` | Форс-блок (debug): `replicantStrikeCount += 1`. На 1–3 открывает diagnostics, на 4-й ставит `finalInvestigationAt` |
| POST | `/internal/assessment/units/:unitname/unblock?purgeHistory=` | Снять блок; `purgeHistory=true` удаляет историю. Допустимы только `"true"`/`"false"`; иначе **400** |
| POST | `/internal/assessment/units/:unitname/tier` | Сменить уровень кейса (debug) |

Debug-роуты (`simulate` / `block` / `unblock` / `tier`) отдают 404, если `ASSESSMENT_DEBUG_ROUTES_ENABLED` не `true`.
