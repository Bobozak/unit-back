import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { AccessTokenResponseDto } from '../dto/response';

export const RefreshTokenDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({ summary: 'generate new tokens' }),
    ApiCreatedResponse({ type: AccessTokenResponseDto }),
    ApiBadRequestResponse({
      description: 'Cookie or refresh token is required',
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
