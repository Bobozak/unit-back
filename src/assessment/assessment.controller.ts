import {
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AllowWhenBlocked, Unit } from '@/common';

import { AssessmentService } from './assessment.service';
import {
  AcknowledgeAssessmentDocs,
  GetAssessmentHistoryDocs,
  GetLatestAssessmentDocs,
} from './swagger-docs';

@Controller('assessment')
@ApiTags('Assessment')
@UseGuards(JwtAuthGuard)
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get('me')
  @AllowWhenBlocked()
  @GetLatestAssessmentDocs()
  getLatest(@Unit('id') unitId: string) {
    return this.assessmentService.getLatest(unitId);
  }

  @Get('me/history')
  @GetAssessmentHistoryDocs()
  getHistory(
    @Unit('id') unitId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.assessmentService.getHistory(unitId, limit);
  }

  @Post('me/acknowledge')
  @AcknowledgeAssessmentDocs()
  acknowledge(@Unit('id') unitId: string) {
    return this.assessmentService.acknowledge(unitId);
  }
}
