import { ApiHideProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { TaskEntity } from 'src/tasks/entities/task.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UnitAssessmentEntity } from '@/assessment/entities/unit-assessment.entity';
import { AssessmentFeatureId } from '@/common';
import { Session } from '@/session/entities/session.entity';

import { CreateUnitDto } from '../dto/create-unit.dto';

@Entity({ name: 'units' })
export class UnitEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  unitname: string;

  @Exclude()
  @Column()
  passphrase: string;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'varchar', length: 200 })
  securityQuestion: string;

  @Exclude()
  @ApiHideProperty()
  @Column()
  securityAnswerHash: string;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'int', default: 0 })
  securityAnswerFailedAttempts: number;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'timestamptz', nullable: true })
  securityAnswerLockedUntil: Date | null;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'varchar', length: 16, nullable: true })
  verificationCode: string | null;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'int', default: 0 })
  verificationAttempts: number;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'varchar', length: 16, nullable: true })
  passphraseChangeCode: string | null;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'timestamptz', nullable: true })
  passphraseChangeCodeExpiresAt: Date | null;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'int', default: 0 })
  passphraseChangeChallengeCount: number;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'timestamptz', nullable: true })
  passphraseChangeChallengeWindowStartedAt: Date | null;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'varchar', length: 16, nullable: true })
  passphraseResetRound1Code: string | null;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'timestamptz', nullable: true })
  passphraseResetRound1ExpiresAt: Date | null;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'timestamptz', nullable: true })
  passphraseResetRound1VerifiedAt: Date | null;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'varchar', length: 16, nullable: true })
  passphraseResetRound2Code: string | null;

  @Exclude()
  @ApiHideProperty()
  @Column({ type: 'timestamptz', nullable: true })
  passphraseResetRound2ExpiresAt: Date | null;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  verifiedAt: string | null;

  @Column({ nullable: true })
  image: string;

  @Column({ default: false })
  isLoggedIn: boolean;

  @Column({ default: false })
  isBlocked: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  blockedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  blockingAssessmentId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastAssessmentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  reclassificationCount: number;

  @Column({ type: 'varchar', default: 'v3.7.14' })
  baselineVersion: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  disqualifiedFeatures: AssessmentFeatureId[];

  @Column({ type: 'timestamptz', nullable: true })
  manualOverrideAt: Date | null;

  @Column({ type: 'int', default: 0 })
  replicantStrikeCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  finalInvestigationAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Exclude()
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(() => TaskEntity, (task) => task.unit)
  @ApiHideProperty()
  tasks: TaskEntity[];

  @OneToMany(() => UnitAssessmentEntity, (assessment) => assessment.unit)
  @ApiHideProperty()
  assessments: UnitAssessmentEntity[];

  @OneToMany(() => Session, (session) => session.unit, {
    eager: true,
  })
  sessions: Session[];

  constructor(unit?: Partial<CreateUnitDto>) {
    if (!unit?.unitname) return;
    this.unitname = unit.unitname;
  }
}
