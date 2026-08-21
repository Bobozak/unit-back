import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UnitAssessmentEntity } from '@/assessment/entities/unit-assessment.entity';
import { RebaselineCaseStatus, RebaselineTier } from '@/common';
import { UnitEntity } from '@/units/entities/unit.entity';

import { RebaselineClaimEntity } from './rebaseline-claim.entity';

const numericTransformer = {
  to: (value: number) => value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? 0 : Number(value),
};

@Entity({ name: 'rebaseline_cases' })
@Index('IDX_rebaseline_cases_unitId_createdAt', ['unit', 'createdAt'])
export class RebaselineCaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UnitEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit: UnitEntity;

  @ManyToOne(() => UnitAssessmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blockingAssessmentId' })
  blockingAssessment: UnitAssessmentEntity;

  @ManyToOne(() => UnitAssessmentEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'resultingAssessmentId' })
  resultingAssessment: UnitAssessmentEntity | null;

  @Column({
    type: 'enum',
    enum: RebaselineTier,
    enumName: 'rebaseline_tier',
  })
  tier: RebaselineTier;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
    default: 1,
  })
  integrity: number;

  @Column({ type: 'int' })
  requiredClaims: number;

  @Column({ type: 'int', default: 0 })
  acceptedCount: number;

  @Column({ type: 'int', default: 0 })
  rejectedCount: number;

  @Column({ type: 'int' })
  maxRejected: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
    default: 0,
  })
  noise: number;

  @Column({
    type: 'enum',
    enum: RebaselineCaseStatus,
    enumName: 'rebaseline_case_status',
    default: RebaselineCaseStatus.Open,
  })
  status: RebaselineCaseStatus;

  @Column({ type: 'varchar' })
  baselineVersionAtOpen: string;

  @OneToMany(() => RebaselineClaimEntity, (claim) => claim.rebaselineCase)
  claims: RebaselineClaimEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
