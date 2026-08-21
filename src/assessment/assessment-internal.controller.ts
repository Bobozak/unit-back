import {
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '@/common';
import { InternalApiGuard } from '@/common/guards/internal-api.guard';
import { DiagnosticsService } from '@/diagnostics/diagnostics.service';
import { SetTierDto } from '@/diagnostics/dto/diagnostics.dto';

import { AssessmentService } from './assessment.service';
import { SimulateAssessmentDto } from './dto/simulate-assessment.dto';
import { UnblockQueryDto } from './dto/unblock-query.dto';
import {
  BlockUnitDocs,
  RunAllAssessmentsDocs,
  RunOneAssessmentDocs,
  SetUnitTierDocs,
  SimulateAssessmentDocs,
  UnblockUnitDocs,
} from './swagger-docs';

@Controller('internal/assessment')
@ApiTags('Internal Assessment')
@Public()
@UseGuards(InternalApiGuard)
export class AssessmentInternalController {
  constructor(
    private readonly assessmentService: AssessmentService,
    private readonly diagnosticsService: DiagnosticsService,
  ) {}

  @Post('run')
  @RunAllAssessmentsDocs()
  runAll() {
    return this.assessmentService.runAll();
  }

  @Post('run/:unitId')
  @RunOneAssessmentDocs()
  runOne(@Param('unitId', ParseUUIDPipe) unitId: string) {
    return this.assessmentService.runOne(unitId);
  }

  @Post('simulate')
  @SimulateAssessmentDocs()
  simulate(@Body() dto: SimulateAssessmentDto) {
    this.assertDebugEnabled();
    return this.assessmentService.simulate(dto);
  }

  @Post('units/:unitname/block')
  @BlockUnitDocs()
  block(@Param('unitname') unitname: string) {
    this.assertDebugEnabled();
    return this.assessmentService.blockByUnitname(unitname);
  }

  @Post('units/:unitname/unblock')
  @UnblockUnitDocs()
  unblock(
    @Param('unitname') unitname: string,
    @Query() query: UnblockQueryDto,
  ) {
    this.assertDebugEnabled();
    return this.assessmentService.unblockByUnitname(
      unitname,
      query.purgeHistory === 'true',
    );
  }

  @Post('units/:unitname/tier')
  @SetUnitTierDocs()
  setTier(@Param('unitname') unitname: string, @Body() dto: SetTierDto) {
    this.assertDebugEnabled();
    return this.diagnosticsService.setTierByUnitname(unitname, dto.tier);
  }

  private assertDebugEnabled() {
    if (!this.assessmentService.isDebugRoutesEnabled()) {
      throw new NotFoundException();
    }
  }
}
