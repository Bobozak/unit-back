import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEnum, IsString } from 'class-validator';

import { AnomalyCode, RebaselineTier } from '@/common';

export enum DiagnosticsLogSort {
  StartDate = 'startDate',
  Ref = 'ref',
}

export enum DiagnosticsLogOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export class FileClaimDto {
  @ApiProperty({ enum: AnomalyCode, example: AnomalyCode.RecursiveEvidence })
  @IsEnum(AnomalyCode)
  anomalyCode: AnomalyCode;

  @ApiProperty({
    type: [String],
    example: ['P1', 'P4'],
    description: 'Exact log ids that constitute the contradiction',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  logRefs: string[];
}

export class SetTierDto {
  @ApiProperty({ enum: RebaselineTier, example: RebaselineTier.Quarantined })
  @IsEnum(RebaselineTier)
  tier: RebaselineTier;
}
