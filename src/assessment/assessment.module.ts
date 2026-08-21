import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiagnosticsModule } from '@/diagnostics/diagnostics.module';
import { TaskEntity } from '@/tasks/entities/task.entity';
import { UnitEntity } from '@/units/entities/unit.entity';

import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { AssessmentInternalController } from './assessment-internal.controller';
import { UnitAssessmentEntity } from './entities/unit-assessment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UnitAssessmentEntity, UnitEntity, TaskEntity]),
    DiagnosticsModule,
  ],
  controllers: [AssessmentController, AssessmentInternalController],
  providers: [AssessmentService],
})
export class AssessmentModule {}
