import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AssessmentFeatureId, AssessmentVerdict } from '@/common';

export class FeatureBreakdownDto {
  @ApiProperty({ example: 0.82, nullable: true })
  value: number | null;

  @ApiProperty({ example: 0.22 })
  weight: number;

  @ApiProperty({ example: false })
  skipped: boolean;
}

export class AssessmentMetricsDto {
  @ApiPropertyOptional({ example: 0.91, nullable: true })
  onTimeRate: number | null;

  @ApiPropertyOptional({ example: 0.04, nullable: true })
  slackStdev: number | null;

  @ApiPropertyOptional({ example: 0.12, nullable: true })
  nightRate: number | null;

  @ApiPropertyOptional({ example: 0.71, nullable: true })
  activeDayRatio: number | null;

  @ApiPropertyOptional({ example: 18.4, nullable: true })
  avgDailyComplexity: number | null;

  @ApiPropertyOptional({ example: 0.8, nullable: true })
  uniqueExcuseRatio: number | null;

  @ApiPropertyOptional({ example: 42, nullable: true })
  avgExcuseLength: number | null;

  @ApiPropertyOptional({ example: 0.15, nullable: true })
  categorySpread: number | null;

  @ApiPropertyOptional({ example: 0.22, nullable: true })
  meanProcrastination: number | null;
}

export class AssessmentReportDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440020' })
  id: string;

  @ApiProperty({ example: '2026-07-18T00:00:00.000Z' })
  periodStart: Date;

  @ApiProperty({ example: '2026-08-15T23:59:59.999Z' })
  periodEnd: Date;

  @ApiProperty({ example: '2026-08-15T03:00:00.000Z' })
  computedAt: Date;

  @ApiProperty({ example: 24 })
  sampleSize: number;

  @ApiProperty({
    additionalProperties: { type: 'object' },
    example: {
      [AssessmentFeatureId.Perfection]: {
        value: 0.2,
        weight: 0.22,
        skipped: false,
      },
    },
  })
  features: Record<AssessmentFeatureId, FeatureBreakdownDto>;

  @ApiProperty({ type: AssessmentMetricsDto })
  metrics: AssessmentMetricsDto;

  @ApiProperty({ example: 0.184 })
  score: number;

  @ApiProperty({ example: 0.07 })
  replicantProbability: number;

  @ApiProperty({ enum: AssessmentVerdict, example: AssessmentVerdict.Human })
  verdict: AssessmentVerdict;

  @ApiProperty({ example: 0 })
  revision: number;

  @ApiProperty({ enum: ['scheduled', 'rebaseline'], example: 'scheduled' })
  origin: string;

  @ApiProperty({ enum: AssessmentFeatureId, isArray: true, example: [] })
  disqualifiedFeatures: AssessmentFeatureId[];

  @ApiPropertyOptional({ example: null, nullable: true })
  supersedesAssessmentId: string | null;

  @ApiPropertyOptional({ example: '2026-08-15T10:00:00.000Z', nullable: true })
  acknowledgedAt: Date | null;
}

export class AssessmentHistoryItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440020' })
  id: string;

  @ApiProperty({ example: '2026-08-15T03:00:00.000Z' })
  computedAt: Date;

  @ApiProperty({ example: '2026-08-15T23:59:59.999Z' })
  periodEnd: Date;

  @ApiProperty({ example: 24 })
  sampleSize: number;

  @ApiProperty({ example: 0.184 })
  score: number;

  @ApiProperty({ example: 0.07 })
  replicantProbability: number;

  @ApiProperty({ enum: AssessmentVerdict, example: AssessmentVerdict.Human })
  verdict: AssessmentVerdict;
}

export class AssessmentRunSummaryDto {
  @ApiProperty({ example: 12 })
  processed: number;

  @ApiProperty({ example: 1 })
  blocked: number;

  @ApiProperty({ example: 3 })
  skipped: number;

  @ApiProperty({ example: 0 })
  failed: number;
}

export class UnitBlockStatusDto {
  @ApiProperty({ example: 'Kira' })
  unitname: string;

  @ApiProperty({ example: true })
  isBlocked: boolean;

  @ApiPropertyOptional({
    example: '2026-08-15T03:00:00.000Z',
    nullable: true,
  })
  blockedAt: Date | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440020',
    nullable: true,
  })
  blockingAssessmentId: string | null;

  @ApiProperty({ example: 4 })
  replicantStrikeCount: number;

  @ApiPropertyOptional({
    example: '2026-08-17T12:00:00.000Z',
    nullable: true,
  })
  finalInvestigationAt: Date | null;
}

export class SimulateAssessmentResponseDto {
  @ApiProperty({ example: '2026-07-18T00:00:00.001Z' })
  periodStart: Date;

  @ApiProperty({ example: '2026-08-15T23:59:59.999Z' })
  periodEnd: Date;

  @ApiProperty({ example: 24 })
  sampleSize: number;

  @ApiProperty({
    additionalProperties: { type: 'object' },
    example: {
      [AssessmentFeatureId.Perfection]: {
        value: 0.2,
        weight: 0.22,
        skipped: false,
      },
    },
  })
  features: Record<AssessmentFeatureId, FeatureBreakdownDto>;

  @ApiProperty({ type: AssessmentMetricsDto })
  metrics: AssessmentMetricsDto;

  @ApiProperty({ example: 0.184 })
  score: number;

  @ApiProperty({ example: 0.07 })
  replicantProbability: number;

  @ApiProperty({ enum: AssessmentVerdict, example: AssessmentVerdict.Human })
  verdict: AssessmentVerdict;
}
