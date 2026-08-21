import { ApiProperty } from '@nestjs/swagger';

import { TaskResponseDto } from './task-response.dto';

export class SearchTasksResponseDto {
  @ApiProperty({ type: TaskResponseDto, isArray: true })
  data: TaskResponseDto[];

  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 5 })
  limit: number;
}

export class SearchTasksNotFoundResponseDto {
  @ApiProperty({ example: 'tasks not found' })
  message: string;
}
