import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { UnitAssessmentEntity } from '@/assessment/entities/unit-assessment.entity';
import { TaskEntity } from '@/tasks/entities/task.entity';
import { UnitEntity } from '@/units/entities/unit.entity';

import { TEST_UNIT_ID } from '../../test/helpers/uuid-fixtures';
import { DiagnosticsService } from './diagnostics.service';
import { BaselineVersionEntity } from './entities/baseline-version.entity';
import { RebaselineCaseEntity } from './entities/rebaseline-case.entity';
import { RebaselineClaimEntity } from './entities/rebaseline-claim.entity';

describe('DiagnosticsService final investigation lock', () => {
  it('refuses diagnostics when the unit is under final investigation', async () => {
    const unitRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: TEST_UNIT_ID,
        finalInvestigationAt: new Date('2026-08-17T12:00:00.000Z'),
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DiagnosticsService,
        { provide: getRepositoryToken(RebaselineCaseEntity), useValue: {} },
        { provide: getRepositoryToken(RebaselineClaimEntity), useValue: {} },
        { provide: getRepositoryToken(BaselineVersionEntity), useValue: {} },
        { provide: getRepositoryToken(UnitAssessmentEntity), useValue: {} },
        { provide: getRepositoryToken(UnitEntity), useValue: unitRepository },
        { provide: getRepositoryToken(TaskEntity), useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    const service = module.get(DiagnosticsService);

    await expect(service.getStatus(TEST_UNIT_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.getStatus(TEST_UNIT_ID)).rejects.toThrow(
      'FINAL_INVESTIGATION_LOCK',
    );
  });
});
