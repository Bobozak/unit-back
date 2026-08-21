import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { DeleteMeDto } from '../dto/delete-me.dto';

export const DeleteMeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'delete your own profile',
      description: `Requires the unit's security answer. Wrong answers share the same lockout as passphrase change and forgot-reset: **5** failures lock further attempts for **15 minutes** (429).

Fetch the question first with \`GET /auth/security-question\`.`,
    }),
    ApiBody({ type: DeleteMeDto }),
    ApiOkResponse({ description: 'Unit deleted successfully' }),
    ApiBadRequestResponse({ description: 'Invalid input data' }),
    ApiTooManyRequestsResponse({
      description: 'Security answer lockout after 5 failed attempts',
    }),
    ApiForbiddenResponse({ description: 'Invalid security answer' }),
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
