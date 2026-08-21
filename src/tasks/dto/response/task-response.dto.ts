import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Priority, TaskCategories } from '@/common';

export class TaskResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id: string;

  @ApiProperty({ example: 'task title' })
  title: string;

  @ApiPropertyOptional({ example: 'task description' })
  description: string | null;

  @ApiProperty({ enum: TaskCategories, example: TaskCategories.Work })
  category: TaskCategories;

  @ApiProperty({ enum: Priority, example: Priority.Medium })
  priority: Priority;

  @ApiProperty({ example: 5, minimum: 1, maximum: 20 })
  complexity: number;

  @ApiProperty({ example: '2025-03-25T15:50:05.696Z' })
  createDate: Date;

  @ApiPropertyOptional({ example: '2025-04-06T17:27:11.797Z' })
  startDate: Date | null;

  @ApiProperty({ example: '2025-04-06T18:27:11.797Z' })
  deadline: Date;

  @ApiPropertyOptional({ example: null })
  completeDate: Date | null;

  @ApiPropertyOptional({ example: 'Was stuck in meetings all day' })
  overdueReason: string | null;
}
