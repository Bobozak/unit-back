import { applyDecorators } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import { VerifyProfileResponseDto } from '../dto/response';

export const VerifyProfileDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'verify tasker profile by code',
      description: `**Step 2 of 2** in the registration flow (public, no JWT).

**Prerequisite:** \`POST /auth/register\` — use the \`verificationCode\` from the response.

**When / how to enter \`code\`:** enter the 16 \`verificationCode\` digits in **ascending order** (non-decreasing sequence).

**Attempts:** up to **3** tries. Each wrong submit returns \`status: retry\` with a **new** \`verificationCode\` and \`attemptsRemaining\`. On the 3rd wrong submit the unit is **hard-deleted** and the response is \`status: destroyed\`.

On success (\`status: verified\`): \`isVerified\` becomes true, \`verificationCode\` is cleared; response includes \`accessToken\` and sets the \`refresh_token\` cookie (auto-login).`,
    }),
    ApiOkResponse({ type: VerifyProfileResponseDto }),
    ApiNotFoundResponse({ description: 'Unit not found' }),
    ApiConflictResponse({ description: 'Profile already verified' }),
  );
