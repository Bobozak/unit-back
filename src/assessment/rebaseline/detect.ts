import { AnomalyCode } from '@/common';

import { detectDataAnomalies } from './anomalies';
import { detectMethodologyDefects } from './defects';
import { buildLogStream } from './log-stream';
import type {
  BaselineVersionRecord,
  LogEntry,
  RebaselineAnomaly,
  StreamTask,
} from './types';

export type DetectedBaseline = {
  logs: LogEntry[];
  anomalies: RebaselineAnomaly[];
};

export function detectAnomalies(
  tasks: StreamTask[],
  computedAt: Date,
  versions: BaselineVersionRecord[],
): DetectedBaseline {
  const { logs, index } = buildLogStream(tasks, computedAt, versions);
  const procLogs = logs.filter((entry) => entry.kind === 'proc');
  const baselineLogs = logs.filter((entry) => entry.kind === 'baseline');
  const anomalies = [
    ...detectDataAnomalies(tasks, index),
    ...detectMethodologyDefects(tasks, procLogs, baselineLogs, versions),
  ];
  return { logs, anomalies };
}

function sameRefs(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const expected = [...left].sort();
  const actual = [...right].sort();
  return expected.every((value, i) => value === actual[i]);
}

export function matchClaim(
  anomalies: RebaselineAnomaly[],
  code: AnomalyCode,
  logRefs: string[],
): RebaselineAnomaly | null {
  return (
    anomalies.find(
      (anomaly) =>
        anomaly.code === code && sameRefs(anomaly.evidenceRefs, logRefs),
    ) ?? null
  );
}
