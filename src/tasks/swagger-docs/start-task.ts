import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { StartTaskDto } from '../dto/start-task.dto';
import { TaskResponseDto } from '../dto/response';

export const StartTaskDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'start a task',
      description:
        'Sets startDate once for an existing task. Cannot be changed after it is set.',
    }),
    ApiBody({ type: StartTaskDto }),
    ApiOkResponse({ type: TaskResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid startDate' }),
    ApiConflictResponse({
      description: 'Task already started or date range invalid',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
      content: {
        'application/json': {
          examples: {
            unauthorized: {
              summary: unauthorizedResponse.message,
              value: unauthorizedResponse,
            },
          },
        },
      },
    }),
  );
