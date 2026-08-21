import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { ForgotPassphraseChallengeResponseDto } from '../dto/response';

export const ForgotPassphraseRound1ChallengeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'issue forgot passphrase round 1 challenge',
      description: `**Step 2 of 4** in the public forgot/reset passphrase flow (no JWT).

1. Send \`unitname\` of a **verified** unit and \`securityAnswer\`.
2. Digits are issued only if the answer matches. Show returned \`digits\` (16 random digits, any order).
3. User will re-enter them using the round-1 value rule in the next step (not left-to-right).
4. TTL: 10 minutes. Each call **replaces** any previous reset state and requires the security answer again.
5. Wrong answers: **5** failures lock further attempts for **15 minutes** (429).

**Round 1 input rule (for step 3):** from shown digits, enter all non-zero even digits ascending, then all non-zero odd digits descending, then all zeros.

Next: \`POST /auth/forgot-passphrase/round-1/verify\`.`,
    }),
    ApiOkResponse({ type: ForgotPassphraseChallengeResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid input data' }),
    ApiForbiddenResponse({
      description: 'Invalid security answer or profile not verified',
    }),
    ApiTooManyRequestsResponse({
      description: 'Security answer lockout after 5 failed attempts',
    }),
    ApiNotFoundResponse({ description: 'Unit not found' }),
  );
