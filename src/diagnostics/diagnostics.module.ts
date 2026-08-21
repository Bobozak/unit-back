import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UnitAssessmentEntity } from '@/assessment/entities/unit-assessment.entity';
import { TaskEntity } from '@/tasks/entities/task.entity';
import { UnitEntity } from '@/units/entities/unit.entity';

import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { BaselineVersionEntity } from './entities/baseline-version.entity';
import { RebaselineCaseEntity } from './entities/rebaseline-case.entity';
import { RebaselineClaimEntity } from './entities/rebaseline-claim.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RebaselineCaseEntity,
      RebaselineClaimEntity,
      BaselineVersionEntity,
      UnitAssessmentEntity,
      UnitEntity,
      TaskEntity,
    ]),
  ],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
