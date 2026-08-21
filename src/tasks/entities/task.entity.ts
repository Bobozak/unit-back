import { ApiHideProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { NoteEntity } from 'src/notes/entities/note.entity';
import { UnitEntity } from 'src/units/entities/unit.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Priority, TaskCategories } from '@/common';

import { CreateTaskDto } from '../dto/create-task.dto';

@Entity({ name: 'tasks' })
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ default: null, nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TaskCategories,
    default: TaskCategories.Work,
  })
  category: TaskCategories;

  @Column({ type: 'enum', enum: Priority, default: Priority.Medium })
  priority: Priority;

  @Column({ type: 'smallint' })
  complexity: number;

  @Column({ type: 'timestamptz' })
  createDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ type: 'timestamptz' })
  deadline: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completeDate: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  overdueReason: string | null;

  @ManyToOne(() => UnitEntity, (unit) => unit.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unitId' })
  unit: UnitEntity;

  @OneToMany(() => NoteEntity, (note) => note.task)
  @ApiHideProperty()
  notes: NoteEntity[];

  constructor(payload?: CreateTaskDto) {
    if (!payload) return;
    this.title = payload.title;
    this.category = payload.category;
    this.priority = payload.priority;
    this.complexity = payload.complexity;
    if (payload.description) {
      this.description = payload.description;
    }
    this.startDate = payload.startDate ? new Date(payload.startDate) : null;
    this.deadline = new Date(payload.deadline);
    this.createDate = new Date();
  }
}
