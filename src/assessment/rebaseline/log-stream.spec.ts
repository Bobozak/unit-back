import { CATALOG_BASELINE_VERSIONS } from './config';
import { buildLogStream, sortLogStream } from './log-stream';
import type { StreamTask } from './types';

function task(
  overrides: Partial<StreamTask> & { id: string; startDate: Date },
): StreamTask {
  const createDate =
    overrides.createDate ?? new Date(overrides.startDate.getTime() - 3_600_000);
  return {
    category: 'work',
    complexity: 5,
    createDate,
    deadline: overrides.deadline ?? new Date('2026-08-04T18:00:00.000Z'),
    completeDate:
      overrides.completeDate ?? new Date('2026-08-04T17:00:00.000Z'),
    overdueReason: null,
    ...overrides,
  };
}

const versions = CATALOG_BASELINE_VERSIONS.map((row) => ({
  version: row.version,
  replicantThreshold: row.replicantThreshold,
  recordedAt: new Date(row.recordedAt),
  source: 'catalog',
}));

describe('sortLogStream', () => {
  const older = task({
    id: 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
    startDate: new Date('2026-08-01T09:00:00.000Z'),
  });
  const newer = task({
    id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    startDate: new Date('2026-08-03T09:00:00.000Z'),
  });
  const computedAt = new Date('2026-08-15T03:00:00.000Z');
  const { logs } = buildLogStream([older, newer], computedAt, versions);

  it('orders task groups by startDate desc and keeps events together', () => {
    const sorted = sortLogStream(logs, [older, newer], 'startDate', 'desc');
    const system = sorted.filter((entry) => entry.kind === 'system');

    expect(system[0].taskId).toBe(newer.id);
    expect(system[0].event).toBe('TASK ACCEPTED');
    expect(system[1].taskId).toBe(newer.id);
    expect(system[system.length - 1].taskId).toBe(older.id);

    const firstProc = sorted.findIndex((entry) => entry.kind === 'proc');
    const lastSystem = sorted.map((entry) => entry.kind).lastIndexOf('system');
    expect(firstProc).toBeGreaterThan(lastSystem);
  });

  it('orders task groups by startDate asc', () => {
    const sorted = sortLogStream(logs, [older, newer], 'startDate', 'asc');
    const system = sorted.filter((entry) => entry.kind === 'system');
    expect(system[0].taskId).toBe(older.id);
  });

  it('orders task groups by ref asc and desc', () => {
    const asc = sortLogStream(logs, [older, newer], 'ref', 'asc');
    const desc = sortLogStream(logs, [older, newer], 'ref', 'desc');
    const ascSystem = asc.filter((entry) => entry.kind === 'system');
    const descSystem = desc.filter((entry) => entry.kind === 'system');

    expect(ascSystem[0].taskId).toBe(newer.id);
    expect(descSystem[0].taskId).toBe(older.id);
  });
});
