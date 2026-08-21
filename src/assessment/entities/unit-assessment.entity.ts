import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  AssessmentFeatureId,
  AssessmentOrigin,
  AssessmentVerdict,
} from '@/common';
import { UnitEntity } from '@/units/entities/unit.entity';

import type { AssessmentFeatureMap, AssessmentMetrics } from '../scoring/types';

const numericTransformer = {
  to: (value: number) => value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? 0 : Number(value),
};

@Entity({ name: 'unit_assessments' })
@Index(
  'UQ_unit_assessments_unitId_periodEnd_revision',
  ['unit', 'periodEnd', 'revision'],
  { unique: true },
)
@Index('IDX_unit_assessments_unitId_computedAt', ['unit', 'computedAt'])
export class UnitAssessmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UnitEntity, (unit) => unit.assessments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'unitId' })
  unit: UnitEntity;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'timestamptz' })
  periodEnd: Date;

  @Column({ type: 'timestamptz' })
  computedAt: Date;

  @Column({ type: 'int' })
  sampleSize: number;

  @Column({ type: 'jsonb' })
  features: AssessmentFeatureMap;

  @Column({ type: 'jsonb' })
  metrics: AssessmentMetrics;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
  })
  score: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
  })
  replicantProbability: number;

  @Column({
    type: 'enum',
    enum: AssessmentVerdict,
    enumName: 'assessment_verdict',
  })
  verdict: AssessmentVerdict;

  @Column({ type: 'int', default: 0 })
  revision: number;

  @Column({
    type: 'enum',
    enum: AssessmentOrigin,
    enumName: 'assessment_origin',
    default: AssessmentOrigin.Scheduled,
  })
  origin: AssessmentOrigin;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  disqualifiedFeatures: AssessmentFeatureId[];

  @Column({ type: 'uuid', nullable: true })
  supersedesAssessmentId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;
}
