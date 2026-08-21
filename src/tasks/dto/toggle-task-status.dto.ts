import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { taskTitleRegex } from '@/common/regex-patterns';

export class ToggleTaskStatusDto {
  @ApiPropertyOptional({
    example: 'Was stuck in meetings all day',
    maxLength: 200,
    description:
      'Required when completing an overdue task (deadline has passed and task is not yet completed)',
  })
  @IsOptional()
  @IsString()
  @Matches(taskTitleRegex, {
    message:
      'Overdue reason must contain only Latin letters, digits, and punctuation',
  })
  @MaxLength(200)
  overdueReason?: string;
}
