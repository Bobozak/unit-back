import { AssessmentFeatureId } from '@/common';

export const WINDOW_DAYS = 7;
export const MIN_SAMPLE_SIZE = 8;
export const MIN_AVAILABLE_WEIGHT = 0.6;
export const MIN_REGULARITY_SAMPLES = 5;
export const MIN_PROCRASTINATION_SAMPLES = 5;
export const MIN_CATEGORY_TASKS = 3;
export const MIN_CATEGORIES_FOR_UNIFORMITY = 2;
export const CONFIDENCE_FULL_SAMPLE = 16;
export const LOGISTIC_K = 8;
export const LOGISTIC_MID = 0.55;
export const VERDICT_REPLICANT_THRESHOLD = 0.65;
export const VERDICT_HUMAN_THRESHOLD = 0.35;
export const NIGHT_HOUR_END = 5;
export const BATCH_SIZE = 50;
export const FINAL_INVESTIGATION_STRIKES = 4;

export const FEATURE_WEIGHTS: Record<AssessmentFeatureId, number> = {
  [AssessmentFeatureId.Perfection]: 0.22,
  [AssessmentFeatureId.Regularity]: 0.2,
  [AssessmentFeatureId.Circadian]: 0.15,
  [AssessmentFeatureId.LoadResilience]: 0.13,
  [AssessmentFeatureId.Excuses]: 0.1,
  [AssessmentFeatureId.Uniformity]: 0.1,
  [AssessmentFeatureId.Procrastination]: 0.1,
};
