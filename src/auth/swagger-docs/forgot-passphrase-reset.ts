import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import { AccessTokenResponseDto } from '../dto/response';

export const ForgotPassphraseResetDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'reset passphrase after forgot flow',
      description: `**Step 3 of 3** in the forgot/reset flow.

**Prerequisites:**
- Round 1 verified via \`POST /auth/forgot-passphrase/round-1/verify\`
- Round-1 session not expired (\`passphraseResetRound1VerifiedAt\` set, round-1 TTL valid)
- Round-2 window not expired

Digit verification happens only in round 1. This step sends \`newPassphrase\` (min 12 non-space characters).

On success: passphrase updated, all old sessions closed, new session + \`accessToken\` + \`refresh_token\` cookie (auto-login).`,
    }),
    ApiOkResponse({ type: AccessTokenResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid input data' }),
    ApiNotFoundResponse({ description: 'Unit not found' }),
    ApiForbiddenResponse({ description: 'Profile not verified' }),
  );
