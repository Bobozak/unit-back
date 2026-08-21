import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { NoteResponseDto } from '../dto/response';

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

export const CreateNoteDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'create a note for a task' }),
    ApiCreatedResponse({ type: NoteResponseDto }),
    unauthorizedDecorator,
  );

export const GetNotesByTaskDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'get all notes for a task' }),
    ApiOkResponse({ type: NoteResponseDto, isArray: true }),
    unauthorizedDecorator,
  );

export const GetNoteByIdDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'get one note by id' }),
    ApiOkResponse({ type: NoteResponseDto }),
    unauthorizedDecorator,
  );

export const UpdateNoteDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'update a note' }),
    ApiOkResponse({ type: NoteResponseDto }),
    unauthorizedDecorator,
  );

export const DeleteNoteDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'delete a note' }),
    ApiOkResponse({ type: NoteResponseDto }),
    unauthorizedDecorator,
  );
