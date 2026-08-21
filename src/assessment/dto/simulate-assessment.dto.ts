import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { Priority, TaskCategories } from '@/common';

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export class SimulateTaskDto {
  @ApiProperty({ enum: TaskCategories, example: TaskCategories.Work })
  @IsEnum(TaskCategories)
  category: TaskCategories;

  @ApiPropertyOptional({ enum: Priority, example: Priority.Medium })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({ example: 5, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  complexity: number;

  @ApiProperty({ example: '2026-08-01T08:00:00.000Z' })
  @IsString()
  @Matches(ISO_UTC)
  createDate: string;

  @ApiPropertyOptional({ example: '2026-08-01T09:00:00.000Z', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(ISO_UTC)
  startDate?: string | null;

  @ApiProperty({ example: '2026-08-01T18:00:00.000Z' })
  @IsString()
  @Matches(ISO_UTC)
  deadline: string;

  @ApiPropertyOptional({ example: '2026-08-01T16:00:00.000Z', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(ISO_UTC)
  completeDate?: string | null;

  @ApiPropertyOptional({
    example: 'missed the last train after a long review',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  overdueReason?: string | null;
}

export class SimulateAssessmentDto {
  @ApiProperty({ type: [SimulateTaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimulateTaskDto)
  tasks: SimulateTaskDto[];

  @ApiPropertyOptional({
    example: '2026-08-15T10:15:00.000Z',
    description:
      'Optional UTC now. Window is the 7 UTC days ending on this date. Defaults to server now.',
  })
  @IsOptional()
  @IsString()
  @Matches(ISO_UTC)
  now?: string;
}
