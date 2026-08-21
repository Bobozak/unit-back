import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { SecurityQuestionResponseDto } from '../dto/response';

export const SecurityQuestionDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'get own security question',
      description:
        'Returns the stored security question for the authenticated unit. Used as step 1 of logged-in passphrase change before the digit challenge.',
    }),
    ApiOkResponse({ type: SecurityQuestionResponseDto }),
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
