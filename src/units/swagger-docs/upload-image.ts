import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { UploadImageResponseDto } from '../dto/response';

export const UploadImageDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'update avatar' }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      description: 'Image file to upload',
      schema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    }),
    ApiCreatedResponse({
      type: UploadImageResponseDto,
      description: 'Link to image',
    }),
    ApiBadRequestResponse({ description: 'Invalid file' }),
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
