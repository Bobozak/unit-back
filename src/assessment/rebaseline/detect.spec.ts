import { AnomalyCode, AssessmentFeatureId } from '@/common';

import { CATALOG_BASELINE_VERSIONS } from './config';
import { detectAnomalies, matchClaim } from './detect';
import type { StreamTask } from './types';

function task(overrides: Partial<StreamTask> & { id: string }): StreamTask {
  const createDate =
    overrides.createDate ?? new Date('2026-08-01T08:00:00.000Z');
  const startDate =
    overrides.startDate === undefined
      ? new Date('2026-08-01T09:00:00.000Z')
      : overrides.startDate;
  const deadline = overrides.deadline ?? new Date('2026-08-01T18:00:00.000Z');
  return {
    category: 'work',
    complexity: 5,
    createDate,
    startDate,
    deadline,
    completeDate:
      overrides.completeDate ?? new Date('2026-08-01T17:00:00.000Z'),
    overdueReason: null,
    ...overrides,
  };
}

const catalogVersions = CATALOG_BASELINE_VERSIONS.map((row) => ({
  version: row.version,
  replicantThreshold: row.replicantThreshold,
  recordedAt: new Date(row.recordedAt),
  source: 'catalog',
}));

describe('detectAnomalies', () => {
  const computedAt = new Date('2026-08-15T03:00:00.000Z');

  it('detects temporal inversion from completeDate before startDate', () => {
    const tasks = [
      task({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        startDate: new Date('2026-08-01T12:00:00.000Z'),
        completeDate: new Date('2026-08-01T11:00:00.000Z'),
      }),
    ];

    const { anomalies } = detectAnomalies(tasks, computedAt, catalogVersions);
    const hit = anomalies.find(
      (anomaly) => anomaly.code === AnomalyCode.TemporalInversion,
    );

    expect(hit).toBeDefined();
    expect(hit?.targetFeature).toBe(AssessmentFeatureId.Regularity);
    expect(hit?.evidenceRefs).toHaveLength(2);
  });

  it('detects null-input completion on a heavy task closed in under a minute', () => {
    const startDate = new Date('2026-08-01T09:00:00.000Z');
    const tasks = [
      task({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        complexity: 12,
        startDate,
        completeDate: new Date(startDate.getTime() + 12_000),
      }),
    ];

    const { anomalies, logs } = detectAnomalies(
      tasks,
      computedAt,
      catalogVersions,
    );
    const hit = anomalies.find(
      (anomaly) => anomaly.code === AnomalyCode.NullInputCompletion,
    );
    const completed = logs.find((entry) => entry.event === 'TASK COMPLETED');

    expect(hit).toBeDefined();
    expect(hit?.targetFeature).toBe(AssessmentFeatureId.Perfection);
    expect(completed?.body).toContain('input NONE');
  });

  it('detects duplicate attestation across two tasks', () => {
    const reason = 'missed the last train after a long review';
    const tasks = [
      task({
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        overdueReason: reason,
      }),
      task({
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        overdueReason: reason,
      }),
    ];

    const { anomalies } = detectAnomalies(tasks, computedAt, catalogVersions);
    const hit = anomalies.find(
      (anomaly) => anomaly.code === AnomalyCode.DuplicateAttestation,
    );

    expect(hit).toBeDefined();
    expect(hit?.evidenceRefs).toHaveLength(2);
  });

  it('always exposes frame drift and recursive evidence', () => {
    const tasks = [task({ id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' })];

    const { anomalies } = detectAnomalies(tasks, computedAt, catalogVersions);
    const codes = anomalies.map((anomaly) => anomaly.code);

    expect(codes).toContain(AnomalyCode.FrameDrift);
    expect(codes).toContain(AnomalyCode.RecursiveEvidence);
    expect(codes).toContain(AnomalyCode.ThresholdMutation);
  });

  it('matches a claim only when log refs are exact', () => {
    const tasks = [task({ id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' })];
    const { anomalies } = detectAnomalies(tasks, computedAt, catalogVersions);
    const recursive = anomalies.find(
      (anomaly) => anomaly.code === AnomalyCode.RecursiveEvidence,
    );

    expect(recursive).toBeDefined();
    expect(
      matchClaim(
        anomalies,
        AnomalyCode.RecursiveEvidence,
        recursive!.evidenceRefs,
      ),
    ).toEqual(recursive);
    expect(
      matchClaim(anomalies, AnomalyCode.RecursiveEvidence, [
        recursive!.evidenceRefs[0],
      ]),
    ).toBeNull();
  });
});
