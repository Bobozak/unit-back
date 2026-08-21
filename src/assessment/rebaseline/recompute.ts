import { AssessmentFeatureId } from '@/common';

import {
  applyDisqualifiedFeatures,
  probabilityFromScore,
  scoreFromFeatures,
  verdictFor,
} from '../scoring/compute-assessment';
import { round4 } from '../scoring/stats';
import type {
  AssessmentComputation,
  AssessmentFeatureMap,
} from '../scoring/types';

export function recomputeAssessment(
  source: Pick<AssessmentComputation, 'sampleSize' | 'features' | 'metrics'>,
  disqualifiedFeatures: AssessmentFeatureId[],
  noise = 0,
): AssessmentComputation {
  const features: AssessmentFeatureMap = applyDisqualifiedFeatures(
    source.features,
    disqualifiedFeatures,
  );
  const { score, availableWeight } = scoreFromFeatures(features);
  const replicantProbability = probabilityFromScore(
    score,
    source.sampleSize,
    noise,
  );

  return {
    sampleSize: source.sampleSize,
    features,
    metrics: source.metrics,
    score: round4(score),
    replicantProbability,
    verdict: verdictFor(
      replicantProbability,
      source.sampleSize,
      availableWeight,
    ),
  };
}

export function availableWeightOf(features: AssessmentFeatureMap): number {
  return scoreFromFeatures(features).availableWeight;
}
