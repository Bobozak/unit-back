import { AnomalyCode, AssessmentFeatureId } from '@/common';

import { NULL_INPUT_MAX_MS, NULL_INPUT_MIN_COMPLEXITY } from './config';
import type { RebaselineAnomaly, StreamTask } from './types';

function systemRef(seq: number): string {
  return `S${seq}`;
}

export type TaskLogIndex = {
  accepted: Map<string, string>;
  started: Map<string, string>;
  completed: Map<string, string>;
  attested: Map<string, string>;
};

export function detectDataAnomalies(
  tasks: StreamTask[],
  logIndex: TaskLogIndex,
): RebaselineAnomaly[] {
  const anomalies: RebaselineAnomaly[] = [];
  const reasons = new Map<string, StreamTask[]>();

  for (const task of tasks) {
    const accepted = logIndex.accepted.get(task.id);
    const started = logIndex.started.get(task.id);
    const completed = logIndex.completed.get(task.id);
    const attested = logIndex.attested.get(task.id);

    if (
      task.completeDate &&
      task.startDate &&
      task.completeDate.getTime() < task.startDate.getTime() &&
      started &&
      completed
    ) {
      anomalies.push({
        code: AnomalyCode.TemporalInversion,
        targetFeature: AssessmentFeatureId.Regularity,
        kind: 'data',
        evidenceRefs: [started, completed],
      });
    }

    if (
      task.startDate &&
      task.startDate.getTime() < task.createDate.getTime() &&
      accepted &&
      started
    ) {
      anomalies.push({
        code: AnomalyCode.PrecognitiveStart,
        targetFeature: AssessmentFeatureId.Procrastination,
        kind: 'data',
        evidenceRefs: [accepted, started],
      });
    }

    if (task.deadline.getTime() <= task.createDate.getTime() && accepted) {
      anomalies.push({
        code: AnomalyCode.RetroactiveCreation,
        targetFeature: AssessmentFeatureId.Perfection,
        kind: 'data',
        evidenceRefs: [accepted],
      });
    }

    if (
      task.completeDate &&
      task.startDate &&
      task.complexity >= NULL_INPUT_MIN_COMPLEXITY &&
      task.completeDate.getTime() - task.startDate.getTime() <
        NULL_INPUT_MAX_MS &&
      completed
    ) {
      anomalies.push({
        code: AnomalyCode.NullInputCompletion,
        targetFeature: AssessmentFeatureId.Perfection,
        kind: 'data',
        evidenceRefs: [completed],
      });
    }

    if (
      task.startDate &&
      task.deadline.getTime() === task.startDate.getTime() &&
      started
    ) {
      anomalies.push({
        code: AnomalyCode.ZeroSpan,
        targetFeature: AssessmentFeatureId.Regularity,
        kind: 'data',
        evidenceRefs: [started],
      });
    }

    const reason = task.overdueReason?.trim();
    if (reason) {
      const list = reasons.get(reason) ?? [];
      list.push(task);
      reasons.set(reason, list);
    }

    void attested;
  }

  for (const group of reasons.values()) {
    if (group.length < 2) continue;
    const refs = group
      .map((task) => logIndex.attested.get(task.id))
      .filter((ref): ref is string => Boolean(ref));
    if (refs.length < 2) continue;
    anomalies.push({
      code: AnomalyCode.DuplicateAttestation,
      targetFeature: AssessmentFeatureId.Excuses,
      kind: 'data',
      evidenceRefs: refs,
    });
  }

  return anomalies;
}
