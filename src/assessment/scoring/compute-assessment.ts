import { AssessmentFeatureId, AssessmentVerdict } from '@/common';

import {
  CONFIDENCE_FULL_SAMPLE,
  FEATURE_WEIGHTS,
  LOGISTIC_K,
  LOGISTIC_MID,
  MIN_AVAILABLE_WEIGHT,
  MIN_SAMPLE_SIZE,
  VERDICT_HUMAN_THRESHOLD,
  VERDICT_REPLICANT_THRESHOLD,
  WINDOW_DAYS,
} from './config';
import {
  computeCircadian,
  computeExcuses,
  computeLoadResilience,
  computePerfection,
  computeProcrastination,
  computeRegularity,
  computeUniformity,
} from './features';
import { clamp01, round4 } from './stats';
import type {
  AssessmentComputation,
  AssessmentFeatureMap,
  ScoringTask,
} from './types';

function skippedFeature(id: AssessmentFeatureId) {
  return {
    value: null,
    weight: FEATURE_WEIGHTS[id],
    skipped: true,
  };
}

export function emptyFeatures(): AssessmentFeatureMap {
  return {
    [AssessmentFeatureId.Perfection]: skippedFeature(
      AssessmentFeatureId.Perfection,
    ),
    [AssessmentFeatureId.Regularity]: skippedFeature(
      AssessmentFeatureId.Regularity,
    ),
    [AssessmentFeatureId.Circadian]: skippedFeature(
      AssessmentFeatureId.Circadian,
    ),
    [AssessmentFeatureId.LoadResilience]: skippedFeature(
      AssessmentFeatureId.LoadResilience,
    ),
    [AssessmentFeatureId.Excuses]: skippedFeature(AssessmentFeatureId.Excuses),
    [AssessmentFeatureId.Uniformity]: skippedFeature(
      AssessmentFeatureId.Uniformity,
    ),
    [AssessmentFeatureId.Procrastination]: skippedFeature(
      AssessmentFeatureId.Procrastination,
    ),
  };
}

function logistic(score: number): number {
  return 1 / (1 + Math.exp(-LOGISTIC_K * (score - LOGISTIC_MID)));
}

export function scoreFromFeatures(features: AssessmentFeatureMap): {
  score: number;
  availableWeight: number;
} {
  const available = Object.values(features).filter(
    (feature) => !feature.skipped,
  );
  const availableWeight = available.reduce(
    (sum, feature) => sum + feature.weight,
    0,
  );

  let score = 0;
  if (availableWeight > 0) {
    score = available.reduce(
      (sum, feature) => sum + feature.weight * (feature.value ?? 0),
      0,
    );
    score /= availableWeight;
  }

  return { score, availableWeight };
}

export function probabilityFromScore(
  score: number,
  sampleSize: number,
  noise = 0,
): number {
  const pRaw = logistic(score);
  const conf = clamp01(sampleSize / CONFIDENCE_FULL_SAMPLE);
  return round4(clamp01(0.5 + (pRaw - 0.5) * conf + noise));
}

export function verdictFor(
  probability: number,
  sampleSize: number,
  availableWeight: number,
): AssessmentVerdict {
  if (sampleSize < MIN_SAMPLE_SIZE || availableWeight < MIN_AVAILABLE_WEIGHT) {
    return AssessmentVerdict.Inconclusive;
  }
  if (probability >= VERDICT_REPLICANT_THRESHOLD) {
    return AssessmentVerdict.Replicant;
  }
  if (probability <= VERDICT_HUMAN_THRESHOLD) {
    return AssessmentVerdict.Human;
  }
  return AssessmentVerdict.Inconclusive;
}

export function applyDisqualifiedFeatures(
  features: AssessmentFeatureMap,
  disqualified: AssessmentFeatureId[],
): AssessmentFeatureMap {
  const next: AssessmentFeatureMap = { ...features };
  for (const id of disqualified) {
    if (!next[id]) continue;
    next[id] = {
      ...next[id],
      skipped: true,
      value: null,
    };
  }
  return next;
}

export function filterTasksInWindow(
  tasks: ScoringTask[],
  periodStart: Date,
  periodEnd: Date,
): ScoringTask[] {
  return tasks.filter(
    (task) => task.deadline >= periodStart && task.deadline <= periodEnd,
  );
}

export function computeAssessment(
  tasks: ScoringTask[],
  periodStart: Date,
  periodEnd: Date,
): AssessmentComputation {
  const sample = filterTasksInWindow(tasks, periodStart, periodEnd);
  const sampleSize = sample.length;
  const windowDays = Math.max(
    1,
    Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000),
  );

  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      features: emptyFeatures(),
      metrics: {
        onTimeRate: null,
        slackStdev: null,
        nightRate: null,
        activeDayRatio: null,
        avgDailyComplexity: null,
        uniqueExcuseRatio: null,
        avgExcuseLength: null,
        categorySpread: null,
        meanProcrastination: null,
      },
      score: 0,
      replicantProbability: 0.5,
      verdict: AssessmentVerdict.Inconclusive,
    };
  }

  const perfection = computePerfection(sample);
  const regularity = computeRegularity(sample);
  const circadian = computeCircadian(sample, windowDays);
  const load = computeLoadResilience(sample, perfection.onTimeRate, windowDays);
  const excuses = computeExcuses(sample);
  const uniformity = computeUniformity(sample);
  const procrastination = computeProcrastination(sample);

  const features: AssessmentFeatureMap = {
    [AssessmentFeatureId.Perfection]: perfection.feature,
    [AssessmentFeatureId.Regularity]: regularity.feature,
    [AssessmentFeatureId.Circadian]: circadian.feature,
    [AssessmentFeatureId.LoadResilience]: load.feature,
    [AssessmentFeatureId.Excuses]: excuses.feature,
    [AssessmentFeatureId.Uniformity]: uniformity.feature,
    [AssessmentFeatureId.Procrastination]: procrastination.feature,
  };

  const { score, availableWeight } = scoreFromFeatures(features);
  const replicantProbability = probabilityFromScore(score, sampleSize);

  return {
    sampleSize,
    features,
    metrics: {
      onTimeRate: perfection.onTimeRate,
      slackStdev: regularity.slackStdev,
      nightRate: circadian.nightRate,
      activeDayRatio: circadian.activeDayRatio,
      avgDailyComplexity: load.avgDailyComplexity,
      uniqueExcuseRatio: excuses.uniqueExcuseRatio,
      avgExcuseLength: excuses.avgExcuseLength,
      categorySpread: uniformity.categorySpread,
      meanProcrastination: procrastination.meanProcrastination,
    },
    score: round4(score),
    replicantProbability,
    verdict: verdictFor(replicantProbability, sampleSize, availableWeight),
  };
}

export function windowFromNow(now = new Date()): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  const periodStart = new Date(
    periodEnd.getTime() - WINDOW_DAYS * 86_400_000 + 1,
  );
  return { periodStart, periodEnd };
}
