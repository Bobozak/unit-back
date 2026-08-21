import { AssessmentFeatureId } from '@/common';

import {
  FEATURE_WEIGHTS,
  MIN_CATEGORIES_FOR_UNIFORMITY,
  MIN_CATEGORY_TASKS,
  MIN_PROCRASTINATION_SAMPLES,
  MIN_REGULARITY_SAMPLES,
  NIGHT_HOUR_END,
  WINDOW_DAYS,
} from './config';
import { clamp01, mean, stdev } from './stats';
import type { FeatureResult, ScoringTask } from './types';

const skipped = (id: AssessmentFeatureId): FeatureResult => ({
  value: null,
  weight: FEATURE_WEIGHTS[id],
  skipped: true,
});

const scored = (id: AssessmentFeatureId, value: number): FeatureResult => ({
  value: clamp01(value),
  weight: FEATURE_WEIGHTS[id],
  skipped: false,
});

export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isOnTime(task: ScoringTask): boolean {
  return Boolean(task.completeDate && task.completeDate <= task.deadline);
}

export function computePerfection(tasks: ScoringTask[]): {
  feature: FeatureResult;
  onTimeRate: number;
} {
  const onTimeRate = tasks.filter(isOnTime).length / tasks.length;
  return {
    feature: scored(AssessmentFeatureId.Perfection, (onTimeRate - 0.75) / 0.25),
    onTimeRate,
  };
}

export function computeRegularity(tasks: ScoringTask[]): {
  feature: FeatureResult;
  slackStdev: number | null;
} {
  const ratios: number[] = [];

  for (const task of tasks) {
    if (!task.completeDate || !task.startDate) continue;
    const span = task.deadline.getTime() - task.startDate.getTime();
    if (span <= 0) continue;
    ratios.push((task.deadline.getTime() - task.completeDate.getTime()) / span);
  }

  if (ratios.length < MIN_REGULARITY_SAMPLES) {
    return {
      feature: skipped(AssessmentFeatureId.Regularity),
      slackStdev: stdev(ratios),
    };
  }

  const slackStdev = stdev(ratios) ?? 0;
  return {
    feature: scored(AssessmentFeatureId.Regularity, 1 - slackStdev / 0.2),
    slackStdev,
  };
}

export function computeCircadian(
  tasks: ScoringTask[],
  windowDays = WINDOW_DAYS,
): {
  feature: FeatureResult;
  nightRate: number | null;
  activeDayRatio: number | null;
} {
  const completions = tasks.filter((task) => task.completeDate);

  if (!completions.length) {
    return {
      feature: skipped(AssessmentFeatureId.Circadian),
      nightRate: null,
      activeDayRatio: null,
    };
  }

  const nightCount = completions.filter((task) => {
    const hour = task.completeDate!.getUTCHours();
    return hour < NIGHT_HOUR_END;
  }).length;

  const nightRate = nightCount / completions.length;
  const activeDays = new Set(
    completions.map((task) => utcDayKey(task.completeDate!)),
  );
  const activeDayRatio = activeDays.size / windowDays;

  return {
    feature: scored(
      AssessmentFeatureId.Circadian,
      0.5 * clamp01(nightRate / 0.3) +
        0.5 * clamp01((activeDayRatio - 0.6) / 0.4),
    ),
    nightRate,
    activeDayRatio,
  };
}

export function computeLoadResilience(
  tasks: ScoringTask[],
  onTimeRate: number,
  windowDays = WINDOW_DAYS,
): {
  feature: FeatureResult;
  avgDailyComplexity: number;
} {
  const totalComplexity = tasks.reduce((sum, task) => sum + task.complexity, 0);
  const avgDailyComplexity = totalComplexity / windowDays;

  return {
    feature: scored(
      AssessmentFeatureId.LoadResilience,
      clamp01((avgDailyComplexity - 15) / 45) * onTimeRate,
    ),
    avgDailyComplexity,
  };
}

export function computeExcuses(tasks: ScoringTask[]): {
  feature: FeatureResult;
  uniqueExcuseRatio: number | null;
  avgExcuseLength: number | null;
} {
  const reasons = tasks
    .map((task) => task.overdueReason?.trim())
    .filter((reason): reason is string => Boolean(reason));

  if (!reasons.length) {
    return {
      feature: skipped(AssessmentFeatureId.Excuses),
      uniqueExcuseRatio: null,
      avgExcuseLength: null,
    };
  }

  const uniqueExcuseRatio = new Set(reasons).size / reasons.length;
  const avgExcuseLength =
    reasons.reduce((sum, reason) => sum + reason.length, 0) / reasons.length;

  return {
    feature: scored(
      AssessmentFeatureId.Excuses,
      0.6 * (1 - uniqueExcuseRatio) +
        0.4 * clamp01((20 - avgExcuseLength) / 20),
    ),
    uniqueExcuseRatio,
    avgExcuseLength,
  };
}

export function computeUniformity(tasks: ScoringTask[]): {
  feature: FeatureResult;
  categorySpread: number | null;
} {
  const byCategory = new Map<string, ScoringTask[]>();
  for (const task of tasks) {
    const list = byCategory.get(task.category) ?? [];
    list.push(task);
    byCategory.set(task.category, list);
  }

  const rates: number[] = [];
  for (const list of byCategory.values()) {
    if (list.length < MIN_CATEGORY_TASKS) continue;
    rates.push(list.filter(isOnTime).length / list.length);
  }

  if (rates.length < MIN_CATEGORIES_FOR_UNIFORMITY) {
    return {
      feature: skipped(AssessmentFeatureId.Uniformity),
      categorySpread: null,
    };
  }

  const categorySpread = Math.max(...rates) - Math.min(...rates);
  return {
    feature: scored(AssessmentFeatureId.Uniformity, 1 - categorySpread / 0.35),
    categorySpread,
  };
}

export function computeProcrastination(tasks: ScoringTask[]): {
  feature: FeatureResult;
  meanProcrastination: number | null;
} {
  const delays: number[] = [];

  for (const task of tasks) {
    if (!task.startDate) continue;
    const available = task.deadline.getTime() - task.createDate.getTime();
    if (available <= 0) continue;
    delays.push(
      (task.startDate.getTime() - task.createDate.getTime()) / available,
    );
  }

  if (delays.length < MIN_PROCRASTINATION_SAMPLES) {
    return {
      feature: skipped(AssessmentFeatureId.Procrastination),
      meanProcrastination: mean(delays),
    };
  }

  const meanProcrastination = mean(delays) ?? 0;
  return {
    feature: scored(
      AssessmentFeatureId.Procrastination,
      1 - meanProcrastination / 0.35,
    ),
    meanProcrastination,
  };
}
