import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { PassphraseChallengeDto } from '../dto/passphrase-challenge.dto';
import { PassphraseChallengeResponseDto } from '../dto/response';

export const PassphraseChallengeDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'issue passphrase change challenge',
      description: `**Step 2 of 3** in the logged-in passphrase change flow (after answering the security question).

1. Send \`securityAnswer\` (JWT required). Digits are issued only if the answer matches.
2. Show \`digits\` on screen as returned — 16 characters, already in **descending (non-increasing)** order (each digit ≤ the previous one, left to right).
3. User also prepares current and new passphrase for the next step.
4. Challenge TTL: 10 minutes (\`expiresAt\`). Each call **replaces** the previous challenge and requires the security answer again.
5. Rate limit: **3** challenges per **60 minutes** per unit. Further calls return 400 until the window resets.
6. Wrong answers: **5** failures lock further attempts for **15 minutes** (429).

Next: \`POST /auth/change-passphrase\` — send \`currentPassphrase\`, the same \`digits\` string as \`digitSequence\`, and \`newPassphrase\`.`,
    }),
    ApiBody({ type: PassphraseChallengeDto }),
    ApiOkResponse({ type: PassphraseChallengeResponseDto }),
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
