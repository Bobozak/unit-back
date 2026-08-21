import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional } from 'class-validator';

export class UnblockQueryDto {
  @ApiPropertyOptional({
    description:
      'When "true", delete assessment history and reset strike counters',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  purgeHistory?: string;
}
