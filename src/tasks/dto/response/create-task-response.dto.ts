import { ApiProperty } from '@nestjs/swagger';

import { TaskResponseDto } from './task-response.dto';

export class CreateTaskResponseDto {
  @ApiProperty({ type: TaskResponseDto })
  task: TaskResponseDto;
}
