import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { LogoutResponseDto } from '../dto/response';

export const LogoutDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({ summary: 'unit logout' }),
    ApiOkResponse({ type: LogoutResponseDto }),
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
