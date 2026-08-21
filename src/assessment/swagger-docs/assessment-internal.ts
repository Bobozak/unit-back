import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { unauthorizedResponse } from '@/common/swagger/common-responses';
import { SetTierDto } from '@/diagnostics/dto/diagnostics.dto';
import { DiagnosticsStatusDto } from '@/diagnostics/dto/response';

import {
  AssessmentRunSummaryDto,
  SimulateAssessmentResponseDto,
  UnitBlockStatusDto,
} from '../dto/response';
import { SimulateAssessmentDto } from '../dto/simulate-assessment.dto';

const internalKeyUnauthorized = ApiUnauthorizedResponse({
  description: 'Missing or invalid x-internal-key',
  content: {
    'application/json': {
      examples: {
        unauthorized: {
          summary: unauthorizedResponse.message,
          value: {
            statusCode: 401,
            message: 'Invalid internal key',
            error: 'Unauthorized',
          },
        },
      },
    },
  },
});

const internalKeyHeader = ApiHeader({
  name: 'x-internal-key',
  required: true,
  description: 'Must equal INTERNAL_API_KEY',
  example: 'dev-internal-key',
});

const internalSecurity = ApiSecurity('internal-key');

const unitNotFound = ApiNotFoundResponse({
  description: 'Unit not found (or not verified, for run-one)',
  content: {
    'application/json': {
      examples: {
        missing: {
          summary: 'Unit not found',
          value: {
            statusCode: 404,
            message: 'Unit not found',
            error: 'Not Found',
          },
        },
      },
    },
  },
});

const debugDisabledNotFound = ApiNotFoundResponse({
  description:
    'Route disabled when ASSESSMENT_DEBUG_ROUTES_ENABLED is not `true`',
  content: {
    'application/json': {
      examples: {
        disabled: {
          summary: 'Debug routes disabled',
          value: {
            statusCode: 404,
            message: 'Not Found',
            error: 'Not Found',
          },
        },
      },
    },
  },
});

const debugOrUnitNotFound = ApiNotFoundResponse({
  description:
    'Unit not found, or debug routes disabled (ASSESSMENT_DEBUG_ROUTES_ENABLED is not `true`)',
  content: {
    'application/json': {
      examples: {
        missing: {
          summary: 'Unit not found',
          value: {
            statusCode: 404,
            message: 'Unit not found',
            error: 'Not Found',
          },
        },
        disabled: {
          summary: 'Debug routes disabled',
          value: {
            statusCode: 404,
            message: 'Not Found',
            error: 'Not Found',
          },
        },
      },
    },
  },
});

export const RunAllAssessmentsDocs = () =>
  applyDecorators(
    internalSecurity,
    internalKeyHeader,
    ApiOperation({
      summary: 'run weekly assessment for all verified units',
      description: `Called by the external cron service (typically Monday).

Processes verified, non-deleted units in batches of 50. A failure on one unit is logged and does not abort the run.

For each unit:
- window = 7 UTC days ending today 23:59:59.999Z
- tasks whose \`deadline\` falls in the window are scored
- a \`unit_assessments\` row is written
- verdict \`replicant\` (\`p >= 0.65\`) sets \`units.isBlocked\`

A second call for the same UTC day is a no-op for already-scored units (unique \`unitId + periodEnd\`). Those are counted in \`skipped\`.`,
    }),
    ApiOkResponse({
      type: AssessmentRunSummaryDto,
      description: 'Batch summary',
    }),
    internalKeyUnauthorized,
  );

export const RunOneAssessmentDocs = () =>
  applyDecorators(
    internalSecurity,
    internalKeyHeader,
    ApiOperation({
      summary: 'run weekly assessment for one unit',
      description: `Same scoring and persist rules as \`POST /internal/assessment/run\`, limited to a single verified unit.

Use this to debug a specific unit without waiting for the weekly batch.

Returns the same summary shape: \`processed\` is 0 or 1; \`skipped\` is 1 if this UTC day was already computed.`,
    }),
    ApiParam({
      name: 'unitId',
      description: 'Unit UUID',
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOkResponse({
      type: AssessmentRunSummaryDto,
      description: 'Single-unit summary',
    }),
    unitNotFound,
    internalKeyUnauthorized,
  );

export const SimulateAssessmentDocs = () =>
  applyDecorators(
    internalSecurity,
    internalKeyHeader,
    ApiOperation({
      summary: 'score a synthetic task list without writing to the database',
      description: `**Debug route.** Requires \`ASSESSMENT_DEBUG_ROUTES_ENABLED=true\`, otherwise HTTP 404.

Does not create a \`unit_assessments\` row and does not change \`isBlocked\`.

Send an array of tasks (same fields the scorer reads) and optional \`now\` (ISO 8601 UTC with milliseconds). The 7-day window is derived from \`now\`.

Use this to tune weights in \`scoring/config.ts\` before a real weekly run.`,
    }),
    ApiBody({ type: SimulateAssessmentDto }),
    ApiOkResponse({
      type: SimulateAssessmentResponseDto,
      description: 'In-memory score, features, metrics, and verdict',
    }),
    ApiBadRequestResponse({ description: 'Invalid task payload' }),
    debugDisabledNotFound,
    internalKeyUnauthorized,
  );

export const BlockUnitDocs = () =>
  applyDecorators(
    internalSecurity,
    internalKeyHeader,
    ApiOperation({
      summary: 'force-block a unit by unitname',
      description: `**Debug route.** Requires \`ASSESSMENT_DEBUG_ROUTES_ENABLED=true\`, otherwise HTTP 404.

Does not require a prior weekly run. Increments \`replicantStrikeCount\` by 1. On the first three strikes a diagnostics case is opened; on the fourth, \`finalInvestigationAt\` is set and diagnostics is not opened.`,
    }),
    ApiParam({
      name: 'unitname',
      description: 'Login name, not UUID',
      example: 'Kira',
    }),
    ApiOkResponse({
      type: UnitBlockStatusDto,
      description: 'Updated block flags',
    }),
    debugOrUnitNotFound,
    internalKeyUnauthorized,
  );

export const UnblockUnitDocs = () =>
  applyDecorators(
    internalSecurity,
    internalKeyHeader,
    ApiOperation({
      summary: 'remove a unit block by unitname',
      description: `**Debug route.** Requires \`ASSESSMENT_DEBUG_ROUTES_ENABLED=true\`, otherwise HTTP 404.

Clears \`isBlocked\`, \`blockedAt\`, and \`blockingAssessmentId\`.

**\`purgeHistory=true\`:** also deletes all \`unit_assessments\` rows for this unit. Without purge, the next weekly run can re-block on the same 7-day window, and an unacknowledged \`replicant\` report will pop the weekly modal immediately after unblock. Values other than \`true\`/\`false\` return 400.`,
    }),
    ApiParam({
      name: 'unitname',
      description: 'Login name, not UUID',
      example: 'Kira',
    }),
    ApiQuery({
      name: 'purgeHistory',
      required: false,
      enum: ['true', 'false'],
      description:
        'When "true", delete assessment history and reset strike counters. Invalid values return 400.',
    }),
    ApiOkResponse({
      type: UnitBlockStatusDto,
      description: 'Updated block flags',
    }),
    ApiBadRequestResponse({
      description: 'purgeHistory must be the string true or false',
    }),
    debugOrUnitNotFound,
    internalKeyUnauthorized,
  );

export const SetUnitTierDocs = () =>
  applyDecorators(
    internalSecurity,
    internalKeyHeader,
    ApiOperation({
      summary: 'set the active rebaseline tier by unitname',
      description: `**Debug route.** Requires \`ASSESSMENT_DEBUG_ROUTES_ENABLED=true\`, otherwise HTTP 404.

Opens a diagnostics case from the blocking assessment if none exists, then forces QUARANTINED / RESTRICTED / TERMINAL.`,
    }),
    ApiParam({
      name: 'unitname',
      description: 'Login name, not UUID',
      example: 'Kira',
    }),
    ApiBody({ type: SetTierDto }),
    ApiOkResponse({
      type: DiagnosticsStatusDto,
      description: 'Updated diagnostics status',
    }),
    debugOrUnitNotFound,
    internalKeyUnauthorized,
  );
