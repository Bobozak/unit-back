import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { AssessmentHistoryItemDto, AssessmentReportDto } from '../dto/response';

const unauthorizedDecorator = ApiUnauthorizedResponse({
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
});

export const GetLatestAssessmentDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({ summary: 'get the latest assessment report for the unit' }),
    ApiOkResponse({ type: AssessmentReportDto }),
    ApiNotFoundResponse({ description: 'Assessment not found' }),
    unauthorizedDecorator,
  );

export const GetAssessmentHistoryDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({ summary: 'get recent assessment snapshots' }),
    ApiQuery({
      name: 'limit',
      required: false,
      example: 12,
      description:
        'Page size (default 12, max 50). Non-numeric values return 400.',
    }),
    ApiOkResponse({ type: AssessmentHistoryItemDto, isArray: true }),
    ApiBadRequestResponse({ description: 'limit must be a numeric string' }),
    unauthorizedDecorator,
  );

export const AcknowledgeAssessmentDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({ summary: 'mark the latest assessment report as read' }),
    ApiOkResponse({ type: AssessmentReportDto }),
    ApiNotFoundResponse({ description: 'Assessment not found' }),
    unauthorizedDecorator,
  );
