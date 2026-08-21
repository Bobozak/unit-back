import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AnomalyCode, AssessmentFeatureId } from '@/common';

import { RebaselineCaseEntity } from './rebaseline-case.entity';

@Entity({ name: 'rebaseline_claims' })
@Index('IDX_rebaseline_claims_caseId_filedAt', ['rebaselineCase', 'filedAt'])
export class RebaselineClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => RebaselineCaseEntity,
    (rebaselineCase) => rebaselineCase.claims,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'caseId' })
  rebaselineCase: RebaselineCaseEntity;

  @Column({
    type: 'enum',
    enum: AnomalyCode,
    enumName: 'anomaly_code',
  })
  anomalyCode: AnomalyCode;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  targetFeature: AssessmentFeatureId | null;

  @Column({ type: 'jsonb' })
  evidenceRefs: string[];

  @Column({ type: 'boolean' })
  accepted: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  filedAt: Date;
}
