import { Test, TestingModule } from '@nestjs/testing';

import { Priority, TaskCategories, TaskSearchIn } from '@/common';

import { TEST_TASK_ID, TEST_UNIT_ID } from '../../test/helpers/uuid-fixtures';

import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

describe('TasksController', () => {
  let controller: TasksController;

  const tasksService = {
    create: jest.fn(),
    searchTasks: jest.fn(),
    findAll: jest.fn(),
    toggleTaskStatus: jest.fn(),
    startTask: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    deleteAll: jest.fn(),
  };

  const unit = { id: TEST_UNIT_ID, unitname: 'Kira' };
  const payload = {
    title: 'write tests',
    category: TaskCategories.Work,
    priority: Priority.Medium,
    complexity: 5,
    deadline: '2024-05-29T18:00:00.000Z',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: tasksService }],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createOne delegates to tasksService.create', async () => {
    const created = { task: { id: TEST_TASK_ID } };
    tasksService.create.mockResolvedValue(created);

    const result = await controller.createOne({ unit }, payload);

    expect(tasksService.create).toHaveBeenCalledWith(unit, payload);
    expect(result).toEqual(created);
  });

  it('searchTasks delegates to tasksService.searchTasks', async () => {
    const searchResult = { data: [], total: 0, page: 1, limit: 5 };
    tasksService.searchTasks.mockResolvedValue(searchResult);

    const result = await controller.searchTasks(
      TEST_UNIT_ID,
      'write',
      TaskSearchIn.Title,
      5,
      1,
    );

    expect(tasksService.searchTasks).toHaveBeenCalledWith(
      'write',
      TEST_UNIT_ID,
      5,
      1,
      TaskSearchIn.Title,
    );
    expect(result).toEqual(searchResult);
  });

  it('findAll delegates to tasksService.findAll', async () => {
    const tasks = [{ id: TEST_TASK_ID }];
    tasksService.findAll.mockResolvedValue(tasks);

    const result = await controller.findAll(
      '2024-05-01',
      '2024-05-31',
      TEST_UNIT_ID,
    );

    expect(tasksService.findAll).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      '2024-05-01',
      '2024-05-31',
    );
    expect(result).toEqual(tasks);
  });

  it('toggleTaskStatus delegates to tasksService.toggleTaskStatus', async () => {
    const task = { id: TEST_TASK_ID };
    const body = { overdueReason: 'meetings' };
    tasksService.toggleTaskStatus.mockResolvedValue(task);

    const result = await controller.toggleTaskStatus(
      TEST_UNIT_ID,
      TEST_TASK_ID,
      body,
    );

    expect(tasksService.toggleTaskStatus).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_TASK_ID,
      body,
    );
    expect(result).toEqual(task);
  });

  it('startTask delegates to tasksService.startTask', async () => {
    const task = { id: TEST_TASK_ID };
    const body = { startDate: '2024-05-29T10:00:00.000Z' };
    tasksService.startTask.mockResolvedValue(task);

    const result = await controller.startTask(TEST_UNIT_ID, TEST_TASK_ID, body);

    expect(tasksService.startTask).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_TASK_ID,
      body,
    );
    expect(result).toEqual(task);
  });

  it('getById delegates to tasksService.findOne', async () => {
    const task = { id: TEST_TASK_ID };
    tasksService.findOne.mockResolvedValue(task);

    const result = await controller.getById(TEST_UNIT_ID, TEST_TASK_ID);

    expect(tasksService.findOne).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_TASK_ID,
    );
    expect(result).toEqual(task);
  });

  it('update delegates to tasksService.update', async () => {
    const updated = { id: TEST_TASK_ID, title: 'updated' };
    const body = { title: 'updated' };
    tasksService.update.mockResolvedValue(updated);

    const result = await controller.update(TEST_UNIT_ID, TEST_TASK_ID, body);

    expect(tasksService.update).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_TASK_ID,
      body,
    );
    expect(result).toEqual(updated);
  });

  it('remove delegates to tasksService.remove', async () => {
    const removed = { id: TEST_TASK_ID };
    tasksService.remove.mockResolvedValue(removed);

    const result = await controller.remove(TEST_UNIT_ID, TEST_TASK_ID);

    expect(tasksService.remove).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_TASK_ID,
    );
    expect(result).toEqual(removed);
  });

  it('delete delegates to tasksService.deleteAll', async () => {
    tasksService.deleteAll.mockResolvedValue(undefined);

    await controller.delete(TEST_UNIT_ID);

    expect(tasksService.deleteAll).toHaveBeenCalledWith(TEST_UNIT_ID);
  });
});
