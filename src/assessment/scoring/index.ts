export {
  BATCH_SIZE,
  FEATURE_WEIGHTS,
  FINAL_INVESTIGATION_STRIKES,
  MIN_AVAILABLE_WEIGHT,
  MIN_SAMPLE_SIZE,
  VERDICT_REPLICANT_THRESHOLD,
  WINDOW_DAYS,
} from './config';
export {
  applyDisqualifiedFeatures,
  computeAssessment,
  emptyFeatures,
  probabilityFromScore,
  scoreFromFeatures,
  verdictFor,
  windowFromNow,
} from './compute-assessment';
export type {
  AssessmentComputation,
  AssessmentFeatureMap,
  AssessmentMetrics,
  ScoringTask,
} from './types';
