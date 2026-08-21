import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';
import { TaskSearchIn } from '@/common';

import { ToggleTaskStatusDto } from '../dto/toggle-task-status.dto';

import {
  CreateTaskResponseDto,
  SearchTasksResponseDto,
  TaskResponseDto,
} from '../dto/response';

const unauthorizedDecorator = ApiUnauthorizedResponse({
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
});

export const CreateTaskDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'create new task' }),
    ApiCreatedResponse({ type: CreateTaskResponseDto }),
    unauthorizedDecorator,
  );

export const SearchTasksDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'searching tasks',
      description:
        'Search by title (default) or description via searchIn query parameter',
    }),
    ApiQuery({ name: 'query', required: true, type: String }),
    ApiQuery({
      name: 'searchIn',
      required: false,
      enum: TaskSearchIn,
      example: TaskSearchIn.Title,
      description: 'Field to search in: title (default) or description',
    }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 5 }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiOkResponse({ type: SearchTasksResponseDto }),
    unauthorizedDecorator,
  );

export const GetTasksDocs = () =>
  applyDecorators(
    ApiOperation({ description: 'get tasks: all / by day / per week' }),
    ApiQuery({
      name: 'startDate',
      required: false,
      type: String,
      example: '2024-05-29T00:00:00.000Z',
    }),
    ApiQuery({
      name: 'endDate',
      required: false,
      type: String,
      example: '2024-05-29T23:59:59.999Z',
    }),
    ApiOkResponse({ type: TaskResponseDto, isArray: true }),
    unauthorizedDecorator,
  );

export const GetTaskByIdDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'get one task by id' }),
    ApiOkResponse({ type: TaskResponseDto }),
    unauthorizedDecorator,
  );

export const UpdateTaskDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'update one task by id',
      description:
        'Updates title, description, category, priority, or complexity. `deadline` and `startDate` are immutable: sending either field returns 400.',
    }),
    ApiOkResponse({ type: TaskResponseDto }),
    ApiBadRequestResponse({
      description: 'Unknown field (deadline/startDate) or invalid payload',
      content: {
        'application/json': {
          examples: {
            forbiddenField: {
              summary: 'deadline cannot be changed after create',
              value: {
                statusCode: 400,
                message: ['deadline cannot be changed after create'],
                error: 'Bad Request',
              },
            },
          },
        },
      },
    }),
    unauthorizedDecorator,
  );

export const DeleteTaskDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'delete one task by id' }),
    ApiOkResponse({ type: TaskResponseDto }),
    ApiNotFoundResponse({ description: 'TaskEntity not found' }),
    unauthorizedDecorator,
  );

export const ToggleTaskStatusDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'mark a task as completed/uncompleted',
      description:
        'When completing an overdue task, overdueReason is required in the request body',
    }),
    ApiBody({ type: ToggleTaskStatusDto }),
    ApiOkResponse({ type: TaskResponseDto }),
    unauthorizedDecorator,
  );

export const DeleteAllTasksDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'delete all tasks (only for testing)' }),
    ApiOkResponse({ description: 'All tasks deleted' }),
    unauthorizedDecorator,
  );
