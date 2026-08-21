import { Test, TestingModule } from '@nestjs/testing';

import { TEST_TASK_ID, TEST_UNIT_ID } from '../../test/helpers/uuid-fixtures';

import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

const TEST_NOTE_ID = '550e8400-e29b-41d4-a716-446655440010';

describe('NotesController', () => {
  let controller: NotesController;

  const notesService = {
    create: jest.fn(),
    findAllByTask: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotesController],
      providers: [{ provide: NotesService, useValue: notesService }],
    }).compile();

    controller = module.get<NotesController>(NotesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create delegates to notesService.create', async () => {
    const response = { id: TEST_NOTE_ID, text: 'note' };
    notesService.create.mockResolvedValue(response);

    const result = await controller.create(TEST_UNIT_ID, TEST_TASK_ID, {
      text: 'note',
    });

    expect(notesService.create).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_TASK_ID,
      { text: 'note' },
    );
    expect(result).toEqual(response);
  });

  it('findAllByTask delegates to notesService.findAllByTask', async () => {
    const response = [{ id: TEST_NOTE_ID }];
    notesService.findAllByTask.mockResolvedValue(response);

    const result = await controller.findAllByTask(TEST_UNIT_ID, TEST_TASK_ID);

    expect(notesService.findAllByTask).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_TASK_ID,
    );
    expect(result).toEqual(response);
  });

  it('findOne delegates to notesService.findOne', async () => {
    const response = { id: TEST_NOTE_ID };
    notesService.findOne.mockResolvedValue(response);

    const result = await controller.findOne(TEST_UNIT_ID, TEST_NOTE_ID);

    expect(notesService.findOne).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_NOTE_ID,
    );
    expect(result).toEqual(response);
  });

  it('update delegates to notesService.update', async () => {
    const response = { id: TEST_NOTE_ID, text: 'updated' };
    notesService.update.mockResolvedValue(response);

    const result = await controller.update(TEST_UNIT_ID, TEST_NOTE_ID, {
      text: 'updated',
    });

    expect(notesService.update).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_NOTE_ID,
      { text: 'updated' },
    );
    expect(result).toEqual(response);
  });

  it('remove delegates to notesService.remove', async () => {
    const response = { id: TEST_NOTE_ID };
    notesService.remove.mockResolvedValue(response);

    const result = await controller.remove(TEST_UNIT_ID, TEST_NOTE_ID);

    expect(notesService.remove).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_NOTE_ID,
    );
    expect(result).toEqual(response);
  });
});
