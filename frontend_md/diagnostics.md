# Tasker — фронтенд diagnostics / rebaseline (спецификация для агента)

Документ описывает **API диагностики после UNIT RETIRED**. Источник правды — бэкенд NestJS (`/v1/diagnostics`). Swagger: `{API_URL}/docs`.

> Assessment: [assessment.md](./assessment.md). Профиль: [units.md](./units.md).  
> Внутренние роуты (`/v1/internal/assessment`) — не для UI, кроме debug `POST /internal/assessment/units/:unitname/tier`.

---

## 1. Базовые настройки

| Параметр | Значение |
|----------|----------|
| Base URL API | Dev: Vite proxy `/v1` → `:3001`; prod: `VITE_API_URL` |
| Префикс | **`/v1/diagnostics`** |
| Auth | JWT Bearer |
| Content-Type | `application/json` |

Весь контроллер помечен `@AllowWhenBlocked()`. Это **не** маршрут приложения: `BlockGate` короткозамыкает роутер и рендерит `RetiredTerminal`.

---

## 2. Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/diagnostics/status` | Активный кейс. 404 если блока/кейса нет |
| GET | `/diagnostics/logs?cursor=&limit=&sort=&order=` | Поток логов. Сервер: default `limit=100`, max 200. Клиент `diagnosticsApi.getLogs` шлёт **200** по умолчанию. `sort` = `startDate` \| `ref`, `order` = `asc` \| `desc`. Default: startDate desc. Ответ: `{ items, nextCursor }` |
| GET | `/diagnostics/baseline/versions` | История порогов baseline |
| GET | `/diagnostics/claims` | Поданные заявки |
| POST | `/diagnostics/claims` | Подать противоречие `{ anomalyCode, logRefs[] }` |
| POST | `/diagnostics/rebaseline` | Пересчёт вероятности |
| POST | `/diagnostics/override` | MANUAL OVERRIDE (только TERMINAL) |

---

## 3. Модели

```typescript
type RebaselineTier = 'quarantined' | 'restricted' | 'terminal';
type RebaselineCaseStatus =
  | 'open'
  | 'ready'
  | 'resolved'
  | 'escalated'
  | 'overridden';

type AnomalyCode =
  | 'TEMPORAL_INVERSION'
  | 'PRECOGNITIVE_START'
  | 'RETROACTIVE_CREATION'
  | 'NULL_INPUT_COMPLETION'
  | 'DUPLICATE_ATTESTATION'
  | 'ZERO_SPAN'
  | 'FRAME_DRIFT'
  | 'RECURSIVE_EVIDENCE'
  | 'SAMPLE_FLOOR'
  | 'THRESHOLD_MUTATION';

type DiagnosticsStatus = {
  caseId: string;
  tier: RebaselineTier;
  status: RebaselineCaseStatus;
  integrity: number; // 0..1
  integrityThreshold: number;
  requiredClaims: number;
  acceptedCount: number;
  rejectedCount: number;
  maxRejected: number;
  remainingAttempts: number;
  noise: number;
  canRebaseline: boolean;
  canOverride: boolean;
  reclassificationCount: number;
  baselineVersion: string;
  hasReclassificationHistory: boolean;
  disqualifiedFeatures: string[];
  acceptedFeatures: string[];
  blockingAssessmentId: string;
};

type DiagnosticsLogEntry = {
  id: string; // S4821 | P1 | B1
  seq: number;
  kind: 'system' | 'proc' | 'baseline';
  at: string; // ISO UTC
  event: string;
  body: string;
  line: string; // готовая строка для терминала
  taskId?: string;
  featureId?: string;
  operand?: string;
};

type DiagnosticsLogsResponse = {
  items: DiagnosticsLogEntry[];
  nextCursor: string | null;
};

type BaselineVersionSource = 'catalog' | 'reclassification' | 'override';

type BaselineVersion = {
  version: string;
  replicantThreshold: number;
  source: BaselineVersionSource;
  recordedAt: string;
  isCatalog: boolean;
};

type FileClaimResponse = {
  accepted: boolean;
  targetFeature: string | null;
  status: DiagnosticsStatus;
};
```

`logRefs` в заявке — **точный** набор `id` улики. Лишние или недостающие строки → заявка отклонена.

---

## 4. Уровни

Назначаются в момент блока по `replicantProbability`:

| Tier | p | Улики | Integrity | Ошибки |
|------|---|-------|-----------|--------|
| QUARANTINED | `p < 0.75` (после порога блока 0.65) | 1 любая | < 90% | 5 |
| RESTRICTED | `p >= 0.75` и `p < 0.9` | 2, минимум одна методологическая | < 75% | 3 |
| TERMINAL | `p >= 0.9` | обычный rebaseline недоступен | — | 2 reject + override через `THRESHOLD_MUTATION` |

Методологические коды: `FRAME_DRIFT`, `RECURSIVE_EVIDENCE`, `SAMPLE_FLOOR`, `THRESHOLD_MUTATION`.

Отклонённая заявка: `noise += 0.005` (добавка к p при пересчёте), попытка сгорает. HTTP 200 `{ accepted: false, targetFeature, status }` — в том числе **повтор того же кода после reject**. HTTP 409 `CLAIM_ALREADY_ACCEPTED` — только если этот `anomalyCode` уже **принят**. Исчерпание попыток (`maxRejected`: 5 / 3 / **2** для TERMINAL) → 409 `ATTEMPTS_EXHAUSTED`.

| HTTP | `message` / код | Когда |
|------|-----------------|-------|
| 404 | `Diagnostics case not found` | Нет активного кейса |
| 409 | `FINAL_INVESTIGATION_LOCK` | Задан `units.finalInvestigationAt` (кроме `GET /baseline/versions`) |
| 409 | `CASE_CLOSED` | Кейс `resolved` / `overridden` |
| 409 | `CLAIM_ALREADY_ACCEPTED` | Этот `anomalyCode` уже принят |
| 409 | `ATTEMPTS_EXHAUSTED` | Нет оставшихся reject-попыток |
| 409 | `RECLASSIFICATION_NOT_AVAILABLE` | `POST /rebaseline` при `canRebaseline === false` |

---

## 5. Поток UI

1. `BlockGate` → `RetiredTerminal`, экран VERDICT (`Unit retired` + tier). Через ~2.4s появляется `> DIAGNOSTICS`.
2. Если `hasReclassificationHistory` — заголовок `Unit retired — reclassification history detected`.
3. DIAGNOSTICS: поток логов за окно assessment (7 UTC-дней), тулбар Sort (Start date / Ref) × Order (ASC / DESC, default Start date DESC), выбор строк, композер заявки, `IntegrityMeter`.
4. BASELINE: таблица версий (каталог 72% → 68% → 65% и ревизии юнита).
5. Когда `canRebaseline` — кнопка `RECLASSIFICATION AVAILABLE` → `POST /diagnostics/rebaseline`.
6. Успех (`unblocked: true`): анимация пересчёта → `GET /units/me` → `setUnit` сбрасывает `blocked` → `/schedule` через PixelCurtain.
7. Провал при всё ещё `replicant`: `escalated: true`, новый tier, кейс открыт.
8. TERMINAL + принятый `THRESHOLD_MUTATION` → `canOverride` → `POST /diagnostics/override`.

Детектор улик **никогда не отдаётся клиенту**. Клиент видит сырые логи, сервер валидирует заявку.

---

## 6. Пересчёт

Принятые улики помечают фичи `skipped`. Тот же `computeAssessment` / `scoreFromFeatures` пересчитывает p. Если `availableWeight < 0.6` — вердикт `inconclusive` независимо от p.

Дисквалифицированные фичи пишутся в `units.disqualifiedFeatures` навсегда и применяются к следующим weekly run.

---

## 7. Debug

`ASSESSMENT_DEBUG_ROUTES_ENABLED=true`:

```
POST /internal/assessment/units/:unitname/block
POST /internal/assessment/units/:unitname/tier
Body: { "tier": "quarantined" | "restricted" | "terminal" }
Header: x-internal-key
```

Debug `POST /internal/assessment/units/:unitname/block` инкрементирует `replicantStrikeCount` на 1. На 1–3 поимке открывает diagnostics-кейс (если отчёта нет — debug-отчёт `p >= 0.65`, verdict `replicant`). На 4-й ставит `finalInvestigationAt` и кейс не открывает. Реальный weekly run с `verdict=replicant` считает тот же счётчик. Методологические улики (`FRAME_DRIFT`, `RECURSIVE_EVIDENCE`, `SAMPLE_FLOOR`, `THRESHOLD_MUTATION`) доступны в открытом кейсе. Уже заблокированный юнит без кейса получит его лениво на `GET /diagnostics/status`, если это не финальный lock.

Если задан `units.finalInvestigationAt`, большинство diagnostics-роутов отвечает `409 FINAL_INVESTIGATION_LOCK`. **Исключение:** `GET /diagnostics/baseline/versions` lock не проверяет (каталог + версии юнита всё равно читаются).
