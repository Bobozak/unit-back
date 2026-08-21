import { AssessmentFeatureId, AssessmentVerdict } from '@/common';

export type ScoringTask = {
  category: string;
  complexity: number;
  createDate: Date;
  startDate: Date | null;
  deadline: Date;
  completeDate: Date | null;
  overdueReason: string | null;
};

export type FeatureResult = {
  value: number | null;
  weight: number;
  skipped: boolean;
};

export type AssessmentFeatureMap = Record<AssessmentFeatureId, FeatureResult>;

export type AssessmentMetrics = {
  onTimeRate: number | null;
  slackStdev: number | null;
  nightRate: number | null;
  activeDayRatio: number | null;
  avgDailyComplexity: number | null;
  uniqueExcuseRatio: number | null;
  avgExcuseLength: number | null;
  categorySpread: number | null;
  meanProcrastination: number | null;
};

export type AssessmentComputation = {
  sampleSize: number;
  features: AssessmentFeatureMap;
  metrics: AssessmentMetrics;
  score: number;
  replicantProbability: number;
  verdict: AssessmentVerdict;
};
