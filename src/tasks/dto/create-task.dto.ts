import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { description, Priority, TaskCategories } from '@/common';
import { IsValidDate } from '@/common/helpers/task-utils/decorators/is-valid-date';
import { taskTitleRegex } from '@/common/regex-patterns';
import { lowerCaseTransformer } from '@/common/transformers/lower-case.transformer';

export class CreateTaskDto {
  @IsNotEmpty()
  @Matches(taskTitleRegex, { message: 'incorrect format of title' })
  @MinLength(2)
  @MaxLength(200)
  @Transform(lowerCaseTransformer)
  readonly title: string;

  @IsNotEmpty()
  @IsOptional()
  @Matches(taskTitleRegex, { message: 'incorrect format of description' })
  @MinLength(2)
  @MaxLength(2000)
  readonly description?: string;

  @IsNotEmpty()
  @IsEnum(TaskCategories)
  readonly category: TaskCategories;

  @IsNotEmpty()
  @IsEnum(Priority)
  readonly priority: Priority;

  @ApiProperty({ example: 5, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  @IsNotEmpty()
  readonly complexity: number;

  @ApiPropertyOptional({ example: '2024-05-29T17:27:11.797Z', description })
  @IsOptional()
  @IsValidDate()
  startDate?: string;

  @ApiProperty({ example: '2024-05-29T21:00:00.000Z', description })
  @IsValidDate()
  @IsNotEmpty()
  deadline: string;
}
