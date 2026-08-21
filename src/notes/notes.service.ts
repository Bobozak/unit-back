import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NoteEntity } from '@/notes/entities/note.entity';
import { TaskEntity } from '@/tasks/entities/task.entity';

import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(NoteEntity)
    private readonly noteRepository: Repository<NoteEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  async create(unitId: string, taskId: string, payload: CreateNoteDto) {
    const task = await this.taskRepository.findOneOrFail({
      where: { id: taskId, unit: { id: unitId } },
    });

    const note = this.noteRepository.create({
      text: payload.text,
      task,
    });

    const savedNote = await this.noteRepository.save(note);
    return this.toResponse(savedNote, taskId);
  }

  async findAllByTask(unitId: string, taskId: string) {
    await this.taskRepository.findOneOrFail({
      where: { id: taskId, unit: { id: unitId } },
    });

    const notes = await this.noteRepository.find({
      where: { task: { id: taskId } },
      order: { createdAt: 'DESC' },
    });

    return notes.map((note) => this.toResponse(note, taskId));
  }

  async findOne(unitId: string, noteId: string) {
    const note = await this.noteRepository.findOneOrFail({
      where: { id: noteId, task: { unit: { id: unitId } } },
      relations: { task: true },
    });

    return this.toResponse(note, note.task.id);
  }

  async update(unitId: string, noteId: string, payload: UpdateNoteDto) {
    const note = await this.noteRepository.findOneOrFail({
      where: { id: noteId, task: { unit: { id: unitId } } },
      relations: { task: true },
    });

    note.text = payload.text!;
    const savedNote = await this.noteRepository.save(note);

    return this.toResponse(savedNote, note.task.id);
  }

  async remove(unitId: string, noteId: string) {
    const note = await this.noteRepository.findOneOrFail({
      where: { id: noteId, task: { unit: { id: unitId } } },
      relations: { task: true },
    });

    const response = this.toResponse(note, note.task.id);
    await this.noteRepository.remove(note);

    return response;
  }

  private toResponse(note: NoteEntity, taskId: string) {
    return {
      id: note.id,
      text: note.text,
      taskId,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}
