import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { LoginUnitDto, LoginUnitResponseDto } from '../dto';

export const LoginDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'unit login' }),
    ApiBody({ type: LoginUnitDto }),
    ApiResponse({ status: 200, type: LoginUnitResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid credentials' }),
    ApiForbiddenResponse({ description: 'Profile not verified' }),
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
