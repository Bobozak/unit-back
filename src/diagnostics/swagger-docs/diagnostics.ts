import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';

import { FileClaimDto } from '../dto/diagnostics.dto';
import {
  BaselineVersionDto,
  DiagnosticsClaimDto,
  DiagnosticsLogsDto,
  DiagnosticsStatusDto,
  FileClaimResponseDto,
  OverrideResponseDto,
  RebaselineResponseDto,
} from '../dto/response';

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

const caseNotFound = ApiNotFoundResponse({
  description: 'No active diagnostics case for this unit',
});

export const GetDiagnosticsStatusDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'get the active rebaseline diagnostics case',
      description:
        'Allowed while blocked. Opens a case lazily if the unit is blocked and none exists yet.',
    }),
    ApiOkResponse({ type: DiagnosticsStatusDto }),
    caseNotFound,
    unauthorizedDecorator,
  );

export const GetDiagnosticsLogsDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'get the numbered diagnostics log stream',
      description:
        'System task logs for the blocking assessment window, classifier trace, and baseline version history. Task groups default to newest startDate first. `sort=ref` orders by the 8-char task ref. Proc/baseline lines stay after system logs. Log ids are stable across sorts.',
    }),
    ApiQuery({ name: 'cursor', required: false, example: 'S4821' }),
    ApiQuery({ name: 'limit', required: false, example: 100 }),
    ApiQuery({
      name: 'sort',
      required: false,
      enum: ['startDate', 'ref'],
      example: 'startDate',
    }),
    ApiQuery({
      name: 'order',
      required: false,
      enum: ['asc', 'desc'],
      example: 'desc',
    }),
    ApiOkResponse({ type: DiagnosticsLogsDto }),
    caseNotFound,
    unauthorizedDecorator,
  );

export const GetBaselineVersionsDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({ summary: 'get baseline version history and thresholds' }),
    ApiOkResponse({ type: BaselineVersionDto, isArray: true }),
    unauthorizedDecorator,
  );

export const GetDiagnosticsClaimsDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({ summary: 'list claims filed against the active case' }),
    ApiOkResponse({ type: DiagnosticsClaimDto, isArray: true }),
    caseNotFound,
    unauthorizedDecorator,
  );

export const FileDiagnosticsClaimDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'file a contradiction claim against selected log lines',
      description:
        'Accepted claims disqualify a feature. Rejected claims add noise and consume an attempt.',
    }),
    ApiBody({ type: FileClaimDto }),
    ApiOkResponse({ type: FileClaimResponseDto }),
    ApiConflictResponse({
      description: 'CASE_CLOSED | CLAIM_ALREADY_ACCEPTED | ATTEMPTS_EXHAUSTED',
    }),
    caseNotFound,
    unauthorizedDecorator,
  );

export const RunRebaselineDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'recompute replicant probability from remaining evidence',
      description:
        'Requires integrity below the tier threshold and enough accepted claims. May unblock or escalate.',
    }),
    ApiOkResponse({ type: RebaselineResponseDto }),
    ApiConflictResponse({ description: 'RECLASSIFICATION_NOT_AVAILABLE' }),
    caseNotFound,
    unauthorizedDecorator,
  );

export const RunOverrideDocs = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'manual override for TERMINAL cases',
      description:
        'Requires an accepted THRESHOLD_MUTATION claim. Permanently stamps the unit baseline.',
    }),
    ApiOkResponse({ type: OverrideResponseDto }),
    ApiConflictResponse({ description: 'OVERRIDE_NOT_AVAILABLE' }),
    caseNotFound,
    unauthorizedDecorator,
  );
