import { AssessmentVerdict } from '@/common';

import { computeAssessment, windowFromNow } from './compute-assessment';
import { WINDOW_DAYS } from './config';
import type { ScoringTask } from './types';

const PERIOD_END = new Date('2026-08-15T23:59:59.999Z');
const PERIOD_START = new Date(
  PERIOD_END.getTime() - WINDOW_DAYS * 86_400_000 + 1,
);

function daysAgo(days: number, hour = 12): Date {
  const date = new Date(PERIOD_END);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

function makeTask(
  overrides: Partial<ScoringTask> & { deadline: Date },
): ScoringTask {
  const deadline = overrides.deadline;
  const createDate =
    overrides.createDate ?? new Date(deadline.getTime() - 8 * 3_600_000);
  return {
    category: 'work',
    complexity: 5,
    createDate,
    startDate:
      overrides.startDate ?? new Date(createDate.getTime() + 3_600_000),
    deadline,
    completeDate: overrides.completeDate ?? deadline,
    overdueReason: null,
    ...overrides,
  };
}

describe('computeAssessment', () => {
  it('returns inconclusive when there are not enough tasks', () => {
    const tasks = Array.from({ length: 3 }, (_, i) =>
      makeTask({ deadline: daysAgo(i + 1) }),
    );

    const result = computeAssessment(tasks, PERIOD_START, PERIOD_END);

    expect(result.sampleSize).toBe(3);
    expect(result.verdict).toBe(AssessmentVerdict.Inconclusive);
    expect(result.replicantProbability).toBeGreaterThanOrEqual(0);
    expect(result.replicantProbability).toBeLessThanOrEqual(1);
  });

  it('scores an ideal machine as replicant with high probability', () => {
    const categories = ['work', 'life', 'learning'];
    const tasks: ScoringTask[] = [];

    for (let day = 0; day < WINDOW_DAYS; day += 1) {
      for (let slot = 0; slot < 3; slot += 1) {
        const createDate = daysAgo(day, 0);
        createDate.setUTCMinutes(slot * 10);
        const startDate = new Date(createDate.getTime() + 60_000);
        const deadline = new Date(createDate.getTime() + 8 * 3_600_000);
        const completeDate = new Date(createDate);
        completeDate.setUTCHours(2, slot * 5, 0, 0);

        tasks.push(
          makeTask({
            category: categories[slot],
            complexity: 20,
            createDate,
            startDate,
            deadline,
            completeDate,
          }),
        );
      }
    }

    const result = computeAssessment(tasks, PERIOD_START, PERIOD_END);

    expect(result.sampleSize).toBe(WINDOW_DAYS * 3);
    expect(result.metrics.onTimeRate).toBe(1);
    expect(result.score).toBeGreaterThan(0.85);
    expect(result.replicantProbability).toBeGreaterThanOrEqual(0.9);
    expect(result.verdict).toBe(AssessmentVerdict.Replicant);
  });

  it('scores a typical human as human with low probability', () => {
    const tasks: ScoringTask[] = [];
    const excuses = [
      'missed the last train and could not finish the remaining notes',
      'child was sick so the evening vanished into appointments',
      'underestimated how long the review would take after lunch',
      'needed a walk before I could look at the remaining files',
    ];

    for (let i = 0; i < 20; i += 1) {
      const deadline = daysAgo(i % 7, 18);
      const createDate = new Date(deadline.getTime() - 10 * 3_600_000);
      const startDate = new Date(createDate.getTime() + 4 * 3_600_000);
      const onTime = i % 10 < 7;
      const completeDate = new Date(deadline);
      if (onTime) {
        completeDate.setUTCHours(14, i * 3, 0, 0);
      } else {
        completeDate.setUTCDate(completeDate.getUTCDate() + 1);
        completeDate.setUTCHours(14, i * 3, 0, 0);
      }

      tasks.push(
        makeTask({
          category: i < 10 ? 'work' : i < 16 ? 'life' : 'learning',
          complexity: 5,
          createDate,
          startDate,
          deadline,
          completeDate,
          overdueReason: onTime ? null : excuses[i % excuses.length],
        }),
      );
    }

    const result = computeAssessment(tasks, PERIOD_START, PERIOD_END);

    expect(result.sampleSize).toBe(20);
    expect(result.metrics.onTimeRate).toBeCloseTo(0.7, 5);
    expect(result.score).toBeLessThan(0.25);
    expect(result.replicantProbability).toBeLessThanOrEqual(0.15);
    expect(result.verdict).toBe(AssessmentVerdict.Human);
  });

  it('scores a sloppy human as human, not replicant', () => {
    const tasks: ScoringTask[] = [];

    for (let i = 0; i < 16; i += 1) {
      const deadline = daysAgo(i % 7, 17);
      const createDate = new Date(deadline.getTime() - 12 * 3_600_000);
      const startDate = new Date(deadline.getTime() - 2 * 3_600_000);
      const completeDate = new Date(deadline);
      completeDate.setUTCDate(completeDate.getUTCDate() + 1);
      completeDate.setUTCHours(16, 0, 0, 0);

      tasks.push(
        makeTask({
          category: i % 2 === 0 ? 'work' : 'life',
          complexity: 3,
          createDate,
          startDate,
          deadline,
          completeDate,
          overdueReason: `ran out of time after a messy afternoon number ${i}`,
        }),
      );
    }

    const result = computeAssessment(tasks, PERIOD_START, PERIOD_END);

    expect(result.sampleSize).toBe(16);
    expect(result.metrics.onTimeRate).toBe(0);
    expect(result.verdict).toBe(AssessmentVerdict.Human);
    expect(result.replicantProbability).toBeLessThan(0.2);
  });

  it('ignores tasks whose deadline is outside the window', () => {
    const inside = makeTask({ deadline: daysAgo(2) });
    const outside = makeTask({
      deadline: new Date(PERIOD_START.getTime() - 86_400_000),
    });

    const result = computeAssessment(
      [inside, outside],
      PERIOD_START,
      PERIOD_END,
    );

    expect(result.sampleSize).toBe(1);
  });

  it('builds a 7-day UTC window from now', () => {
    const now = new Date('2026-08-15T10:15:00.000Z');
    const { periodStart, periodEnd } = windowFromNow(now);

    expect(periodEnd.toISOString()).toBe('2026-08-15T23:59:59.999Z');
    expect(periodEnd.getTime() - periodStart.getTime() + 1).toBe(
      WINDOW_DAYS * 86_400_000,
    );
  });
});
