import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import { ForgotPassphraseChallengeResponseDto } from '../dto/response';

export const ForgotPassphraseRound1VerifyDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'verify forgot passphrase round 1 and issue round 2 challenge',
      description: `**Step 2 of 3** in the forgot/reset flow.

**Prerequisite:** \`POST /auth/forgot-passphrase/round-1/challenge\` — round-1 challenge must not be expired.

**When / how to enter \`digitSequence\`:** from the round-1 \`digits\` string shown on screen:
1. All **non-zero even** digits, **ascending**.
2. All **non-zero odd** digits, **descending**.
3. All **zeros** last.

Example: displayed \`9817654321000000\` → send \`2468975311000000\`.

**Response:** round-2 window \`expiresAt\` (and unused \`digits\` for the session). Round 2 does not ask the user to enter digits.

Next: \`POST /auth/forgot-passphrase/reset\` with \`unitname\` and \`newPassphrase\` only.`,
    }),
    ApiOkResponse({ type: ForgotPassphraseChallengeResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid input data' }),
    ApiNotFoundResponse({ description: 'Unit not found' }),
    ApiForbiddenResponse({ description: 'Profile not verified' }),
  );
