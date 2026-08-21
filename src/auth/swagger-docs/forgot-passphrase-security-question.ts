import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';

import { SecurityQuestionResponseDto } from '../dto/response';

export const ForgotPassphraseSecurityQuestionDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'get security question for passphrase reset',
      description: `**Step 1 of 4** in the public forgot/reset passphrase flow (no JWT).

Send \`unitname\` of a **verified** unit. Returns the stored security question. The unit must then submit the matching answer with \`POST /auth/forgot-passphrase/round-1/challenge\` before digits are issued.

Only **verified** units; 404 / 403 otherwise.`,
    }),
    ApiOkResponse({ type: SecurityQuestionResponseDto }),
    ApiBadRequestResponse({ description: 'Invalid input data' }),
    ApiNotFoundResponse({ description: 'Unit not found' }),
    ApiForbiddenResponse({ description: 'Profile not verified' }),
  );
