import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';

import { UnitnameAvailableResponseDto } from '../dto/response';

export const UnitnameAvailableDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'check whether a unitname is available',
      description:
        'Public pre-check for registration step 1. Uniqueness is case-insensitive and includes soft-deleted units.',
    }),
    ApiQuery({
      name: 'unitname',
      required: true,
      example: 'Kira',
    }),
    ApiOkResponse({ type: UnitnameAvailableResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid unitname' }),
  );
