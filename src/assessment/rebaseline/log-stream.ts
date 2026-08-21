import { AssessmentFeatureId } from '@/common';

import {
  BASELINE_LOG_START,
  NULL_INPUT_MAX_MS,
  NULL_INPUT_MIN_COMPLEXITY,
  PROC_LOG_START,
  SYSTEM_LOG_START,
} from './config';
import type { TaskLogIndex } from './anomalies';
import type {
  BaselineVersionRecord,
  LogEntry,
  LogSortField,
  LogSortOrder,
  StreamTask,
} from './types';

function iso(date: Date): string {
  return date.toISOString();
}

function pad(seq: number, width: number): string {
  return String(seq).padStart(width, '0');
}

function isNullInput(task: StreamTask): boolean {
  if (!task.completeDate || !task.startDate) return false;
  return (
    task.complexity >= NULL_INPUT_MIN_COMPLEXITY &&
    task.completeDate.getTime() - task.startDate.getTime() < NULL_INPUT_MAX_MS
  );
}

export function buildSystemLogs(tasks: StreamTask[]): {
  logs: LogEntry[];
  index: TaskLogIndex;
} {
  const ordered = [...tasks].sort((a, b) => a.id.localeCompare(b.id));
  const logs: LogEntry[] = [];
  const index: TaskLogIndex = {
    accepted: new Map(),
    started: new Map(),
    completed: new Map(),
    attested: new Map(),
  };

  let seq = SYSTEM_LOG_START;
  for (const task of ordered) {
    const accepted: LogEntry = {
      id: `S${seq}`,
      seq,
      kind: 'system',
      at: iso(task.createDate),
      event: 'TASK ACCEPTED',
      body: `ref ${task.id.slice(0, 8)}`,
      taskId: task.id,
    };
    logs.push(accepted);
    index.accepted.set(task.id, accepted.id);
    seq += 1;

    if (task.startDate) {
      const started: LogEntry = {
        id: `S${seq}`,
        seq,
        kind: 'system',
        at: iso(task.startDate),
        event: 'TASK STARTED',
        body: `ref ${task.id.slice(0, 8)} deadline ${iso(task.deadline)}`,
        taskId: task.id,
      };
      logs.push(started);
      index.started.set(task.id, started.id);
      seq += 1;
    }

    if (task.completeDate) {
      const none = isNullInput(task);
      const completed: LogEntry = {
        id: `S${seq}`,
        seq,
        kind: 'system',
        at: iso(task.completeDate),
        event: 'TASK COMPLETED',
        body: `ref ${task.id.slice(0, 8)} input ${none ? 'NONE' : 'UNIT'}`,
        taskId: task.id,
      };
      logs.push(completed);
      index.completed.set(task.id, completed.id);
      seq += 1;
    }

    const reason = task.overdueReason?.trim();
    if (reason) {
      const attested: LogEntry = {
        id: `S${seq}`,
        seq,
        kind: 'system',
        at: iso(task.completeDate ?? task.deadline),
        event: 'TASK ATTESTED',
        body: `ref ${task.id.slice(0, 8)} reason "${reason}"`,
        taskId: task.id,
      };
      logs.push(attested);
      index.attested.set(task.id, attested.id);
      seq += 1;
    }
  }

  return { logs, index };
}

export function buildProcLogs(computedAt: Date): LogEntry[] {
  const specs: Array<{
    featureId: AssessmentFeatureId;
    event: string;
    body: string;
    operand?: string;
  }> = [
    {
      featureId: AssessmentFeatureId.Perfection,
      event: 'FEATURE SCORE',
      body: 'feature perfection operand onTimeRate',
      operand: 'onTimeRate',
    },
    {
      featureId: AssessmentFeatureId.Regularity,
      event: 'FEATURE SCORE',
      body: 'feature regularity operand slackStdev',
      operand: 'slackStdev',
    },
    {
      featureId: AssessmentFeatureId.Circadian,
      event: 'FEATURE SCORE',
      body: 'feature circadian night_window [00:00,05:00) UTC source static',
      operand: 'nightRate',
    },
    {
      featureId: AssessmentFeatureId.LoadResilience,
      event: 'FEATURE SCORE',
      body: 'feature loadResilience operand onTimeRate',
      operand: 'onTimeRate',
    },
    {
      featureId: AssessmentFeatureId.Excuses,
      event: 'FEATURE SCORE',
      body: 'feature excuses operand uniqueExcuseRatio',
      operand: 'uniqueExcuseRatio',
    },
    {
      featureId: AssessmentFeatureId.Uniformity,
      event: 'FEATURE SCORE',
      body: 'feature uniformity operand categorySpread',
      operand: 'categorySpread',
    },
    {
      featureId: AssessmentFeatureId.Procrastination,
      event: 'FEATURE SCORE',
      body: 'feature procrastination operand meanProcrastination',
      operand: 'meanProcrastination',
    },
  ];

  return specs.map((spec, offset) => {
    const seq = PROC_LOG_START + offset;
    return {
      id: `P${seq}`,
      seq,
      kind: 'proc' as const,
      at: iso(computedAt),
      event: spec.event,
      body: spec.body,
      featureId: spec.featureId,
      operand: spec.operand,
    };
  });
}

export function buildBaselineLogs(
  versions: BaselineVersionRecord[],
): LogEntry[] {
  return versions.map((version, offset) => {
    const seq = BASELINE_LOG_START + offset;
    return {
      id: `B${seq}`,
      seq,
      kind: 'baseline' as const,
      at: iso(version.recordedAt),
      event: 'BASELINE VER',
      body: `${version.version} replicant threshold ${(
        version.replicantThreshold * 100
      ).toFixed(0)}% source ${version.source}`,
    };
  });
}

export function buildLogStream(
  tasks: StreamTask[],
  computedAt: Date,
  versions: BaselineVersionRecord[],
): { logs: LogEntry[]; index: TaskLogIndex } {
  const system = buildSystemLogs(tasks);
  const proc = buildProcLogs(computedAt);
  const baseline = buildBaselineLogs(versions);
  return {
    logs: [...system.logs, ...proc, ...baseline],
    index: system.index,
  };
}

function taskSortKey(
  task: StreamTask | undefined,
  taskId: string,
  sort: LogSortField,
): string | number {
  if (sort === 'ref') {
    return taskId.slice(0, 8);
  }
  return (task?.startDate ?? task?.createDate)?.getTime() ?? 0;
}

export function sortLogStream(
  logs: LogEntry[],
  tasks: StreamTask[],
  sort: LogSortField = 'startDate',
  order: LogSortOrder = 'desc',
): LogEntry[] {
  const system = logs.filter((entry) => entry.kind === 'system');
  const rest = logs.filter((entry) => entry.kind !== 'system');
  const byTask = new Map<string, LogEntry[]>();
  const ungrouped: LogEntry[] = [];

  for (const entry of system) {
    if (!entry.taskId) {
      ungrouped.push(entry);
      continue;
    }
    const group = byTask.get(entry.taskId) ?? [];
    group.push(entry);
    byTask.set(entry.taskId, group);
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const direction = order === 'asc' ? 1 : -1;
  const groups = [...byTask.entries()].sort(([idA], [idB]) => {
    const keyA = taskSortKey(taskById.get(idA), idA, sort);
    const keyB = taskSortKey(taskById.get(idB), idB, sort);
    if (keyA === keyB) {
      return direction * idA.localeCompare(idB);
    }
    if (typeof keyA === 'number' && typeof keyB === 'number') {
      return direction * (keyA - keyB);
    }
    return direction * String(keyA).localeCompare(String(keyB));
  });

  const sortedSystem = groups.flatMap(([, entries]) =>
    [...entries].sort((left, right) => left.seq - right.seq),
  );

  return [...sortedSystem, ...ungrouped, ...rest];
}

export function formatLogLine(entry: LogEntry): string {
  const prefix =
    entry.kind === 'system'
      ? `SYSTEM LOG #${entry.seq}`
      : entry.kind === 'proc'
        ? `BASELINE PROC #${pad(entry.seq, 4)}`
        : `BASELINE VER #${pad(entry.seq, 4)}`;
  return `${prefix}  ${entry.at}  ${entry.event}    ${entry.body}`;
}
