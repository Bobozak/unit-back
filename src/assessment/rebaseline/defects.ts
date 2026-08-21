import { AnomalyCode, AssessmentFeatureId } from '@/common';

import {
  MIN_CATEGORIES_FOR_UNIFORMITY,
  MIN_CATEGORY_TASKS,
  MIN_PROCRASTINATION_SAMPLES,
  MIN_REGULARITY_SAMPLES,
} from '../scoring/config';
import { isOnTime } from '../scoring/features';
import type { ScoringTask } from '../scoring/types';
import type {
  BaselineVersionRecord,
  LogEntry,
  RebaselineAnomaly,
} from './types';

function regularitySampleCount(tasks: ScoringTask[]): number {
  let count = 0;
  for (const task of tasks) {
    if (!task.completeDate || !task.startDate) continue;
    const span = task.deadline.getTime() - task.startDate.getTime();
    if (span <= 0) continue;
    count += 1;
  }
  return count;
}

function procrastinationSampleCount(tasks: ScoringTask[]): number {
  let count = 0;
  for (const task of tasks) {
    if (!task.startDate) continue;
    const available = task.deadline.getTime() - task.createDate.getTime();
    if (available <= 0) continue;
    count += 1;
  }
  return count;
}

function uniformityCategoryCount(tasks: ScoringTask[]): number {
  const byCategory = new Map<string, ScoringTask[]>();
  for (const task of tasks) {
    const list = byCategory.get(task.category) ?? [];
    list.push(task);
    byCategory.set(task.category, list);
  }
  let count = 0;
  for (const list of byCategory.values()) {
    if (list.length >= MIN_CATEGORY_TASKS && list.some(isOnTime)) {
      count += 1;
    } else if (list.length >= MIN_CATEGORY_TASKS) {
      count += 1;
    }
  }
  return count;
}

export function detectMethodologyDefects(
  tasks: ScoringTask[],
  procLogs: LogEntry[],
  baselineLogs: LogEntry[],
  versions: BaselineVersionRecord[],
): RebaselineAnomaly[] {
  const anomalies: RebaselineAnomaly[] = [];
  const byFeature = (id: AssessmentFeatureId) =>
    procLogs.find((entry) => entry.featureId === id)?.id;

  const circadianRef = byFeature(AssessmentFeatureId.Circadian);
  if (circadianRef) {
    anomalies.push({
      code: AnomalyCode.FrameDrift,
      targetFeature: AssessmentFeatureId.Circadian,
      kind: 'methodology',
      evidenceRefs: [circadianRef],
    });
  }

  const perfectionRef = byFeature(AssessmentFeatureId.Perfection);
  const loadRef = byFeature(AssessmentFeatureId.LoadResilience);
  if (perfectionRef && loadRef) {
    anomalies.push({
      code: AnomalyCode.RecursiveEvidence,
      targetFeature: AssessmentFeatureId.LoadResilience,
      kind: 'methodology',
      evidenceRefs: [perfectionRef, loadRef],
    });
  }

  const regularityCount = regularitySampleCount(tasks);
  if (regularityCount === MIN_REGULARITY_SAMPLES) {
    const ref = byFeature(AssessmentFeatureId.Regularity);
    if (ref) {
      anomalies.push({
        code: AnomalyCode.SampleFloor,
        targetFeature: AssessmentFeatureId.Regularity,
        kind: 'methodology',
        evidenceRefs: [ref],
      });
    }
  }

  const procrastinationCount = procrastinationSampleCount(tasks);
  if (procrastinationCount === MIN_PROCRASTINATION_SAMPLES) {
    const ref = byFeature(AssessmentFeatureId.Procrastination);
    if (ref) {
      anomalies.push({
        code: AnomalyCode.SampleFloor,
        targetFeature: AssessmentFeatureId.Procrastination,
        kind: 'methodology',
        evidenceRefs: [ref],
      });
    }
  }

  const categoryCount = uniformityCategoryCount(tasks);
  if (categoryCount === MIN_CATEGORIES_FOR_UNIFORMITY) {
    const ref = byFeature(AssessmentFeatureId.Uniformity);
    if (ref) {
      anomalies.push({
        code: AnomalyCode.SampleFloor,
        targetFeature: AssessmentFeatureId.Uniformity,
        kind: 'methodology',
        evidenceRefs: [ref],
      });
    }
  }

  const thresholds = new Set(
    versions.map((version) => version.replicantThreshold),
  );
  if (thresholds.size >= 2 && baselineLogs.length >= 2) {
    anomalies.push({
      code: AnomalyCode.ThresholdMutation,
      targetFeature: null,
      kind: 'methodology',
      evidenceRefs: baselineLogs.map((entry) => entry.id),
    });
  }

  return anomalies;
}
