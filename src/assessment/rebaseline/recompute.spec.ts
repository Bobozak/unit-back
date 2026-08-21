import { AssessmentFeatureId, AssessmentVerdict } from '@/common';

import { emptyFeatures } from '../scoring/compute-assessment';
import { FEATURE_WEIGHTS } from '../scoring/config';
import type { AssessmentFeatureMap } from '../scoring/types';
import { availableWeightOf, recomputeAssessment } from './recompute';

function scored(
  id: AssessmentFeatureId,
  value: number,
): AssessmentFeatureMap[AssessmentFeatureId] {
  return {
    value,
    weight: FEATURE_WEIGHTS[id],
    skipped: false,
  };
}

function blockedProfile(): AssessmentFeatureMap {
  const features = emptyFeatures();
  features[AssessmentFeatureId.Perfection] = scored(
    AssessmentFeatureId.Perfection,
    0.95,
  );
  features[AssessmentFeatureId.Regularity] = scored(
    AssessmentFeatureId.Regularity,
    0.8,
  );
  features[AssessmentFeatureId.Circadian] = scored(
    AssessmentFeatureId.Circadian,
    0.6,
  );
  features[AssessmentFeatureId.LoadResilience] = scored(
    AssessmentFeatureId.LoadResilience,
    0.5,
  );
  features[AssessmentFeatureId.Excuses] = scored(
    AssessmentFeatureId.Excuses,
    0.4,
  );
  features[AssessmentFeatureId.Uniformity] = scored(
    AssessmentFeatureId.Uniformity,
    0.7,
  );
  features[AssessmentFeatureId.Procrastination] = scored(
    AssessmentFeatureId.Procrastination,
    0.6,
  );
  return features;
}

describe('recomputeAssessment', () => {
  const metrics = {
    onTimeRate: 1,
    slackStdev: 0.01,
    nightRate: 0.2,
    activeDayRatio: 0.8,
    avgDailyComplexity: 20,
    uniqueExcuseRatio: 1,
    avgExcuseLength: 40,
    categorySpread: 0.05,
    meanProcrastination: 0.1,
  };

  it('drops a blocked profile below the replicant threshold after disqualifying perfection', () => {
    const source = {
      sampleSize: 24,
      features: blockedProfile(),
      metrics,
    };

    const baseline = recomputeAssessment(source, [], 0);
    expect(baseline.verdict).toBe(AssessmentVerdict.Replicant);
    expect(baseline.replicantProbability).toBeGreaterThanOrEqual(0.65);

    const next = recomputeAssessment(
      source,
      [AssessmentFeatureId.Perfection],
      0,
    );

    expect(next.features[AssessmentFeatureId.Perfection].skipped).toBe(true);
    expect(next.replicantProbability).toBeLessThan(0.65);
    expect(next.verdict).not.toBe(AssessmentVerdict.Replicant);
  });

  it('returns inconclusive when remaining weight falls below MIN_AVAILABLE_WEIGHT', () => {
    const source = {
      sampleSize: 24,
      features: blockedProfile(),
      metrics,
    };

    const next = recomputeAssessment(
      source,
      [AssessmentFeatureId.Perfection, AssessmentFeatureId.Regularity],
      0,
    );

    expect(availableWeightOf(next.features)).toBeLessThan(0.6);
    expect(next.verdict).toBe(AssessmentVerdict.Inconclusive);
  });

  it('adds rejection noise to probability', () => {
    const source = {
      sampleSize: 24,
      features: blockedProfile(),
      metrics,
    };
    const clean = recomputeAssessment(
      source,
      [AssessmentFeatureId.Perfection],
      0,
    );
    const noisy = recomputeAssessment(
      source,
      [AssessmentFeatureId.Perfection],
      0.02,
    );

    expect(noisy.replicantProbability).toBeGreaterThan(
      clean.replicantProbability,
    );
  });
});
