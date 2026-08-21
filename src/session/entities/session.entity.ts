import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UnitEntity } from '@/units/entities/unit.entity';

@Entity()
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  createdAt: string;

  @Column({ default: null })
  deletedAt: string;

  @ManyToOne(() => UnitEntity, (unit) => unit.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'unitId' })
  unit: UnitEntity;

  constructor() {
    this.createdAt = new Date().toISOString();
  }
}
