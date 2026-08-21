import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AllowWhenBlocked, Unit } from '@/common';

import { DiagnosticsService } from './diagnostics.service';
import {
  DiagnosticsLogOrder,
  DiagnosticsLogSort,
  FileClaimDto,
} from './dto/diagnostics.dto';
import {
  FileDiagnosticsClaimDocs,
  GetBaselineVersionsDocs,
  GetDiagnosticsClaimsDocs,
  GetDiagnosticsLogsDocs,
  GetDiagnosticsStatusDocs,
  RunOverrideDocs,
  RunRebaselineDocs,
} from './swagger-docs';

@Controller('diagnostics')
@ApiTags('Diagnostics')
@UseGuards(JwtAuthGuard)
@AllowWhenBlocked()
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Get('status')
  @GetDiagnosticsStatusDocs()
  getStatus(@Unit('id') unitId: string) {
    return this.diagnosticsService.getStatus(unitId);
  }

  @Get('logs')
  @GetDiagnosticsLogsDocs()
  getLogs(
    @Unit('id') unitId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query(
      'sort',
      new DefaultValuePipe(DiagnosticsLogSort.StartDate),
      new ParseEnumPipe(DiagnosticsLogSort),
    )
    sort: DiagnosticsLogSort,
    @Query(
      'order',
      new DefaultValuePipe(DiagnosticsLogOrder.Desc),
      new ParseEnumPipe(DiagnosticsLogOrder),
    )
    order: DiagnosticsLogOrder,
  ) {
    return this.diagnosticsService.getLogs(unitId, cursor, limit, sort, order);
  }

  @Get('baseline/versions')
  @GetBaselineVersionsDocs()
  getVersions(@Unit('id') unitId: string) {
    return this.diagnosticsService.getVersions(unitId);
  }

  @Get('claims')
  @GetDiagnosticsClaimsDocs()
  getClaims(@Unit('id') unitId: string) {
    return this.diagnosticsService.getClaims(unitId);
  }

  @Post('claims')
  @FileDiagnosticsClaimDocs()
  fileClaim(@Unit('id') unitId: string, @Body() dto: FileClaimDto) {
    return this.diagnosticsService.fileClaim(unitId, dto);
  }

  @Post('rebaseline')
  @RunRebaselineDocs()
  rebaseline(@Unit('id') unitId: string) {
    return this.diagnosticsService.rebaseline(unitId);
  }

  @Post('override')
  @RunOverrideDocs()
  override(@Unit('id') unitId: string) {
    return this.diagnosticsService.override(unitId);
  }
}
