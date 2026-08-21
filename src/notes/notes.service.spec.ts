import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityNotFoundError } from 'typeorm';

import { TaskEntity } from '@/tasks/entities/task.entity';

import { TEST_TASK_ID, TEST_UNIT_ID } from '../../test/helpers/uuid-fixtures';
import { NoteEntity } from './entities/note.entity';
import { NotesService } from './notes.service';

const TEST_NOTE_ID = '550e8400-e29b-41d4-a716-446655440010';

describe('NotesService', () => {
  let service: NotesService;

  const noteRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneOrFail: jest.fn(),
    remove: jest.fn(),
  };

  const taskRepository = {
    findOneOrFail: jest.fn(),
  };

  const createdAt = new Date('2024-05-29T12:00:00.000Z');
  const updatedAt = new Date('2024-05-29T13:00:00.000Z');

  const baseNote = (overrides?: Partial<NoteEntity>): NoteEntity =>
    ({
      id: TEST_NOTE_ID,
      text: 'note text',
      createdAt,
      updatedAt,
      task: { id: TEST_TASK_ID } as TaskEntity,
      ...overrides,
    }) as NoteEntity;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: getRepositoryToken(NoteEntity), useValue: noteRepository },
        { provide: getRepositoryToken(TaskEntity), useValue: taskRepository },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a note for a task owned by the unit', async () => {
      const task = { id: TEST_TASK_ID } as TaskEntity;
      const note = baseNote();
      taskRepository.findOneOrFail.mockResolvedValue(task);
      noteRepository.create.mockReturnValue(note);
      noteRepository.save.mockResolvedValue(note);

      const result = await service.create(TEST_UNIT_ID, TEST_TASK_ID, {
        text: 'note text',
      });

      expect(taskRepository.findOneOrFail).toHaveBeenCalledWith({
        where: { id: TEST_TASK_ID, unit: { id: TEST_UNIT_ID } },
      });
      expect(noteRepository.create).toHaveBeenCalledWith({
        text: 'note text',
        task,
      });
      expect(result).toEqual({
        id: TEST_NOTE_ID,
        text: 'note text',
        taskId: TEST_TASK_ID,
        createdAt,
        updatedAt,
      });
    });

    it('propagates when task is not found', async () => {
      taskRepository.findOneOrFail.mockRejectedValue(
        new EntityNotFoundError(TaskEntity, { id: TEST_TASK_ID }),
      );

      await expect(
        service.create(TEST_UNIT_ID, TEST_TASK_ID, { text: 'note text' }),
      ).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('findAllByTask', () => {
    it('returns mapped notes for a task', async () => {
      const notes = [baseNote(), baseNote({ id: 'other-note-id', text: 'b' })];
      taskRepository.findOneOrFail.mockResolvedValue({ id: TEST_TASK_ID });
      noteRepository.find.mockResolvedValue(notes);

      const result = await service.findAllByTask(TEST_UNIT_ID, TEST_TASK_ID);

      expect(noteRepository.find).toHaveBeenCalledWith({
        where: { task: { id: TEST_TASK_ID } },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([
        {
          id: TEST_NOTE_ID,
          text: 'note text',
          taskId: TEST_TASK_ID,
          createdAt,
          updatedAt,
        },
        {
          id: 'other-note-id',
          text: 'b',
          taskId: TEST_TASK_ID,
          createdAt,
          updatedAt,
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('returns a mapped note', async () => {
      noteRepository.findOneOrFail.mockResolvedValue(baseNote());

      const result = await service.findOne(TEST_UNIT_ID, TEST_NOTE_ID);

      expect(noteRepository.findOneOrFail).toHaveBeenCalledWith({
        where: { id: TEST_NOTE_ID, task: { unit: { id: TEST_UNIT_ID } } },
        relations: { task: true },
      });
      expect(result).toEqual({
        id: TEST_NOTE_ID,
        text: 'note text',
        taskId: TEST_TASK_ID,
        createdAt,
        updatedAt,
      });
    });
  });

  describe('update', () => {
    it('updates note text and returns mapped response', async () => {
      const note = baseNote();
      noteRepository.findOneOrFail.mockResolvedValue(note);
      noteRepository.save.mockImplementation(async (value) => value);

      const result = await service.update(TEST_UNIT_ID, TEST_NOTE_ID, {
        text: 'updated text',
      });

      expect(note.text).toBe('updated text');
      expect(result).toEqual({
        id: TEST_NOTE_ID,
        text: 'updated text',
        taskId: TEST_TASK_ID,
        createdAt,
        updatedAt,
      });
    });
  });

  describe('remove', () => {
    it('removes note and returns mapped response', async () => {
      const note = baseNote();
      noteRepository.findOneOrFail.mockResolvedValue(note);
      noteRepository.remove.mockResolvedValue(note);

      const result = await service.remove(TEST_UNIT_ID, TEST_NOTE_ID);

      expect(noteRepository.remove).toHaveBeenCalledWith(note);
      expect(result).toEqual({
        id: TEST_NOTE_ID,
        text: 'note text',
        taskId: TEST_TASK_ID,
        createdAt,
        updatedAt,
      });
    });
  });
});
