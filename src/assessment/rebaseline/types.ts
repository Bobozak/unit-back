import { AnomalyCode, AssessmentFeatureId } from '@/common';

import type { ScoringTask } from '../scoring/types';

export type StreamTask = ScoringTask & { id: string };

export type AnomalyKind = 'data' | 'methodology';

export type RebaselineAnomaly = {
  code: AnomalyCode;
  targetFeature: AssessmentFeatureId | null;
  kind: AnomalyKind;
  evidenceRefs: string[];
};

export type BaselineVersionRecord = {
  version: string;
  replicantThreshold: number;
  recordedAt: Date;
  source: string;
};

export type LogKind = 'system' | 'proc' | 'baseline';

export type LogSortField = 'startDate' | 'ref';

export type LogSortOrder = 'asc' | 'desc';

export type LogEntry = {
  id: string;
  seq: number;
  kind: LogKind;
  at: string;
  event: string;
  body: string;
  taskId?: string;
  featureId?: AssessmentFeatureId;
  operand?: string;
};
