import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AssessmentReportDto } from '@/assessment/dto/response';
import {
  AnomalyCode,
  AssessmentFeatureId,
  AssessmentOrigin,
  AssessmentVerdict,
  RebaselineCaseStatus,
  RebaselineTier,
} from '@/common';

export class DiagnosticsStatusDto {
  @ApiProperty()
  caseId: string;

  @ApiProperty({ enum: RebaselineTier })
  tier: RebaselineTier;

  @ApiProperty({ enum: RebaselineCaseStatus })
  status: RebaselineCaseStatus;

  @ApiProperty({ example: 0.89 })
  integrity: number;

  @ApiProperty({ example: 0.9 })
  integrityThreshold: number;

  @ApiProperty({ example: 1 })
  requiredClaims: number;

  @ApiProperty({ example: 1 })
  acceptedCount: number;

  @ApiProperty({ example: 0 })
  rejectedCount: number;

  @ApiProperty({ example: 5 })
  maxRejected: number;

  @ApiProperty({ example: 5 })
  remainingAttempts: number;

  @ApiProperty({ example: 0 })
  noise: number;

  @ApiProperty()
  canRebaseline: boolean;

  @ApiProperty()
  canOverride: boolean;

  @ApiProperty({ example: 0 })
  reclassificationCount: number;

  @ApiProperty({ example: 'v3.7.14' })
  baselineVersion: string;

  @ApiProperty()
  hasReclassificationHistory: boolean;

  @ApiProperty({ enum: AssessmentFeatureId, isArray: true })
  disqualifiedFeatures: AssessmentFeatureId[];

  @ApiProperty({ enum: AssessmentFeatureId, isArray: true })
  acceptedFeatures: AssessmentFeatureId[];

  @ApiProperty()
  blockingAssessmentId: string;
}

export class DiagnosticsLogEntryDto {
  @ApiProperty({ example: 'S4821' })
  id: string;

  @ApiProperty({ example: 4821 })
  seq: number;

  @ApiProperty({ enum: ['system', 'proc', 'baseline'] })
  kind: 'system' | 'proc' | 'baseline';

  @ApiProperty({ example: '2026-07-12T08:42:11.000Z' })
  at: string;

  @ApiProperty({ example: 'TASK ACCEPTED' })
  event: string;

  @ApiProperty({ example: 'ref a3f2c1b0' })
  body: string;

  @ApiProperty({
    example:
      'SYSTEM LOG #4821  2026-07-12T08:42:11.000Z  TASK ACCEPTED    ref a3f2c1b0',
  })
  line: string;

  @ApiPropertyOptional()
  taskId?: string;

  @ApiPropertyOptional({ enum: AssessmentFeatureId })
  featureId?: AssessmentFeatureId;

  @ApiPropertyOptional()
  operand?: string;
}

export class DiagnosticsLogsDto {
  @ApiProperty({ type: [DiagnosticsLogEntryDto] })
  items: DiagnosticsLogEntryDto[];

  @ApiPropertyOptional({ example: 'S4840', nullable: true })
  nextCursor: string | null;
}

export class BaselineVersionDto {
  @ApiProperty({ example: 'v3.7.14' })
  version: string;

  @ApiProperty({ example: 0.65 })
  replicantThreshold: number;

  @ApiProperty({ example: 'catalog' })
  source: string;

  @ApiProperty({ example: '2026-06-02T00:00:00.000Z' })
  recordedAt: Date;

  @ApiProperty()
  isCatalog: boolean;
}

export class DiagnosticsClaimDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AnomalyCode })
  anomalyCode: AnomalyCode;

  @ApiPropertyOptional({ enum: AssessmentFeatureId, nullable: true })
  targetFeature: AssessmentFeatureId | null;

  @ApiProperty({ type: [String] })
  evidenceRefs: string[];

  @ApiProperty()
  accepted: boolean;

  @ApiProperty()
  filedAt: Date;
}

export class FileClaimResponseDto {
  @ApiProperty()
  accepted: boolean;

  @ApiProperty({ type: DiagnosticsStatusDto })
  status: DiagnosticsStatusDto;

  @ApiPropertyOptional({ enum: AssessmentFeatureId, nullable: true })
  targetFeature: AssessmentFeatureId | null;
}

export class RebaselineResponseDto {
  @ApiProperty()
  unblocked: boolean;

  @ApiProperty()
  escalated: boolean;

  @ApiProperty({ example: 0.76 })
  previousProbability: number;

  @ApiProperty({ enum: AssessmentVerdict })
  verdict: AssessmentVerdict;

  @ApiProperty({ enum: AssessmentOrigin })
  origin: AssessmentOrigin;

  @ApiProperty({ type: AssessmentReportDto })
  report: AssessmentReportDto;

  @ApiProperty({ type: DiagnosticsStatusDto })
  status: DiagnosticsStatusDto;
}

export class OverrideResponseDto {
  @ApiProperty()
  unblocked: boolean;

  @ApiProperty({ type: DiagnosticsStatusDto })
  status: DiagnosticsStatusDto;
}
