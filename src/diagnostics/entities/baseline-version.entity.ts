import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BaselineVersionSource } from '@/common';
import { UnitEntity } from '@/units/entities/unit.entity';

const numericTransformer = {
  to: (value: number) => value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? 0 : Number(value),
};

@Entity({ name: 'baseline_versions' })
@Index('IDX_baseline_versions_unitId_recordedAt', ['unit', 'recordedAt'])
export class BaselineVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UnitEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit: UnitEntity | null;

  @Column({ type: 'varchar' })
  version: string;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
  })
  replicantThreshold: number;

  @Column({
    type: 'enum',
    enum: BaselineVersionSource,
    enumName: 'baseline_version_source',
  })
  source: BaselineVersionSource;

  @Column({ type: 'timestamptz' })
  recordedAt: Date;
}
