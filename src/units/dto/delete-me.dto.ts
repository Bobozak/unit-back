import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

import { MinNormalizedAnswerLength } from '@/common/validators';

export class DeleteMeDto {
  @ApiProperty({ example: 'night city' })
  @IsString()
  @MinNormalizedAnswerLength(3)
  securityAnswer: string;
}
