import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
} from '@nestjs/swagger';

import { RegisterResponseDto } from '../dto/response';

export const RegisterDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'unit registration',
      description: `Creates an unverified unit with a security question/answer and returns \`verificationCode\` — 16 digits in **non-increasing (ascending)** order (each digit ≥ the previous one, left to right).

Body: \`unitname\`, \`passphrase\`, \`securityQuestion\`, \`securityAnswer\`. The answer is normalized (lowercase, punctuation stripped) and stored as a bcrypt hash.

Show \`verificationCode\` on screen. User must re-enter it **exactly as displayed** in \`POST /auth/verify\`.`,
    }),
    ApiCreatedResponse({
      type: RegisterResponseDto,
      description: 'Unit registered successfully',
    }),
    ApiBadRequestResponse({ description: 'Invalid input data' }),
    ApiConflictResponse({ description: 'Unitname already exists' }),
  );
