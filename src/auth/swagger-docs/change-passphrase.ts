import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { ChangePassphraseDto } from '../dto/change-passphrase.dto';
import { AccessTokenResponseDto } from '../dto/response';

export const ChangePassphraseDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'change unit passphrase',
      description: `**Step 2 of 2** in the logged-in passphrase change flow.

**Prerequisite:** \`POST /auth/passphrase-challenge\` must have been called first; challenge must not be expired.

**Body field order (user input on UI):**
1. \`currentPassphrase\` — existing passphrase (min 12 non-space characters).
2. \`digitSequence\` — re-enter the 16 \`digits\` from the challenge **exactly as shown** (descending / non-increasing, left to right).
3. \`newPassphrase\` — new passphrase (min 12 non-space characters, must differ from current).

On success: all old sessions are closed, a new session is created, \`accessToken\` is returned and \`refresh_token\` cookie is set (auto-login).`,
    }),
    ApiBody({ type: ChangePassphraseDto }),
    ApiOkResponse({ type: AccessTokenResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid input data' }),
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
