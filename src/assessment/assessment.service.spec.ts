import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AssessmentVerdict } from '@/common';
import { DiagnosticsService } from '@/diagnostics/diagnostics.service';
import { TaskEntity } from '@/tasks/entities/task.entity';
import { UnitEntity } from '@/units/entities/unit.entity';

import { TEST_UNIT_ID } from '../../test/helpers/uuid-fixtures';
import { AssessmentService } from './assessment.service';
import { UnitAssessmentEntity } from './entities/unit-assessment.entity';
import { computeAssessment, emptyFeatures, windowFromNow } from './scoring';

jest.mock('./scoring', () => {
  const actual = jest.requireActual('./scoring');
  return {
    ...actual,
    computeAssessment: jest.fn(),
    windowFromNow: jest.fn(),
  };
});

const computeAssessmentMock = computeAssessment as jest.MockedFunction<
  typeof computeAssessment
>;
const windowFromNowMock = windowFromNow as jest.MockedFunction<
  typeof windowFromNow
>;

const PERIOD_START = new Date('2026-08-11T00:00:00.000Z');
const PERIOD_END = new Date('2026-08-17T23:59:59.999Z');
const COMPUTED_AT = new Date('2026-08-17T12:00:00.000Z');

function replicantComputation() {
  return {
    sampleSize: 20,
    features: emptyFeatures(),
    metrics: {
      onTimeRate: 1,
      slackStdev: 0,
      nightRate: 0.4,
      activeDayRatio: 1,
      avgDailyComplexity: 30,
      uniqueExcuseRatio: 1,
      avgExcuseLength: 4,
      categorySpread: 0,
      meanProcrastination: 0.1,
    },
    score: 0.8,
    replicantProbability: 0.8,
    verdict: AssessmentVerdict.Replicant,
  };
}

describe('AssessmentService final investigation lock', () => {
  let service: AssessmentService;

  const assessmentRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const unitRepository = {
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    save: jest.fn(),
  };

  const taskRepository = {
    createQueryBuilder: jest.fn(),
  };

  const diagnosticsService = {
    openCase: jest.fn(),
    ensureCaseForBlockedUnit: jest.fn(),
    onDebugUnblock: jest.fn(),
  };

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    taskRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    assessmentRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    assessmentRepository.findOne.mockResolvedValue(null);
    assessmentRepository.create.mockImplementation((row) => ({
      ...row,
      id: 'report-1',
      computedAt: COMPUTED_AT,
    }));
    assessmentRepository.save.mockImplementation(async (row) => row);
    unitRepository.save.mockImplementation(async (row) => row);
    windowFromNowMock.mockReturnValue({
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });
    computeAssessmentMock.mockReturnValue(replicantComputation());

    const module = await Test.createTestingModule({
      providers: [
        AssessmentService,
        {
          provide: getRepositoryToken(UnitAssessmentEntity),
          useValue: assessmentRepository,
        },
        {
          provide: getRepositoryToken(UnitEntity),
          useValue: unitRepository,
        },
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: taskRepository,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: DiagnosticsService,
          useValue: diagnosticsService,
        },
      ],
    }).compile();

    service = module.get(AssessmentService);
  });

  function stubUnit(overrides: Partial<UnitEntity> = {}) {
    const unit = {
      id: TEST_UNIT_ID,
      replicantStrikeCount: 0,
      finalInvestigationAt: null,
      disqualifiedFeatures: [],
      isBlocked: false,
      blockedAt: null,
      blockingAssessmentId: null,
      lastAssessmentAt: null,
      ...overrides,
    } as UnitEntity;
    unitRepository.findOne.mockResolvedValue({ id: TEST_UNIT_ID });
    unitRepository.findOneByOrFail.mockResolvedValue(unit);
    return unit;
  }

  it('opens diagnostics on the first three replicant strikes', async () => {
    const unit = stubUnit({ replicantStrikeCount: 2 });

    const result = await service.runOne(TEST_UNIT_ID);

    expect(result).toEqual({
      processed: 1,
      blocked: 1,
      skipped: 0,
      failed: 0,
    });
    expect(unit.replicantStrikeCount).toBe(3);
    expect(unit.finalInvestigationAt).toBeNull();
    expect(diagnosticsService.openCase).toHaveBeenCalledTimes(1);
  });

  it('locks investigation on the fourth replicant strike without opening diagnostics', async () => {
    const unit = stubUnit({ replicantStrikeCount: 3 });

    await service.runOne(TEST_UNIT_ID);

    expect(unit.replicantStrikeCount).toBe(4);
    expect(unit.finalInvestigationAt).toEqual(COMPUTED_AT);
    expect(unit.isBlocked).toBe(true);
    expect(diagnosticsService.openCase).not.toHaveBeenCalled();
  });

  it('does not change a unit that is already under final investigation', async () => {
    const lockedAt = new Date('2026-08-01T00:00:00.000Z');
    const unit = stubUnit({
      replicantStrikeCount: 4,
      finalInvestigationAt: lockedAt,
      isBlocked: true,
    });

    await service.runOne(TEST_UNIT_ID);

    expect(unit.replicantStrikeCount).toBe(4);
    expect(unit.finalInvestigationAt).toBe(lockedAt);
    expect(diagnosticsService.openCase).not.toHaveBeenCalled();
  });

  it('increments one strike on debug block and opens diagnostics', async () => {
    const unit = stubUnit({ replicantStrikeCount: 0 });
    unitRepository.findOne.mockResolvedValue(unit);

    await service.blockByUnitname('bobozak');

    expect(unit.isBlocked).toBe(true);
    expect(unit.replicantStrikeCount).toBe(1);
    expect(unit.finalInvestigationAt).toBeNull();
    expect(diagnosticsService.ensureCaseForBlockedUnit).toHaveBeenCalled();
    expect(diagnosticsService.openCase).not.toHaveBeenCalled();
  });

  it('locks investigation on the fourth debug block without opening diagnostics', async () => {
    const unit = stubUnit({ replicantStrikeCount: 3 });
    unitRepository.findOne.mockResolvedValue(unit);

    await service.blockByUnitname('bobozak');

    expect(unit.replicantStrikeCount).toBe(4);
    expect(unit.finalInvestigationAt).toBeInstanceOf(Date);
    expect(diagnosticsService.ensureCaseForBlockedUnit).not.toHaveBeenCalled();
    expect(diagnosticsService.openCase).not.toHaveBeenCalled();
  });

  it('resets strikes only when debug unblock purges history', async () => {
    const unit = stubUnit({
      replicantStrikeCount: 4,
      finalInvestigationAt: COMPUTED_AT,
      isBlocked: true,
    });
    unitRepository.findOne.mockResolvedValue(unit);

    await service.unblockByUnitname('bobozak', true);

    expect(unit.replicantStrikeCount).toBe(0);
    expect(unit.finalInvestigationAt).toBeNull();
    expect(unit.isBlocked).toBe(false);
  });

  it('keeps strikes on debug unblock without purge', async () => {
    const unit = stubUnit({
      replicantStrikeCount: 4,
      finalInvestigationAt: COMPUTED_AT,
      isBlocked: true,
    });
    unitRepository.findOne.mockResolvedValue(unit);

    await service.unblockByUnitname('bobozak', false);

    expect(unit.replicantStrikeCount).toBe(4);
    expect(unit.finalInvestigationAt).toEqual(COMPUTED_AT);
    expect(unit.isBlocked).toBe(false);
  });
});
