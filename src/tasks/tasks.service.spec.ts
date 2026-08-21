import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityNotFoundError } from 'typeorm';

import { Priority, TaskCategories, TaskSearchIn } from '@/common';
import { UnitEntity } from '@/units/entities/unit.entity';

import { TEST_TASK_ID, TEST_UNIT_ID } from '../../test/helpers/uuid-fixtures';

import { TaskEntity } from './entities/task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
  };

  const taskRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOneOrFail: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };

  const unitRepository = {
    findOneOrFail: jest.fn(),
  };

  const lockQueryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const manager = {
    save: jest.fn(),
    findOneOrFail: jest.fn(),
    createQueryBuilder: jest.fn(() => lockQueryBuilder),
  };

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };

  const datasource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };

  const sameDayStart = '2024-05-29T10:00:00.000Z';
  const sameDayDeadline = '2024-05-29T18:00:00.000Z';
  const nextDayDeadline = '2024-05-30T18:00:00.000Z';

  const baseTask = (overrides?: Partial<TaskEntity>): TaskEntity =>
    ({
      id: TEST_TASK_ID,
      title: 'write tests',
      description: 'cover services',
      category: TaskCategories.Work,
      priority: Priority.Medium,
      complexity: 5,
      createDate: new Date('2024-05-28T12:00:00.000Z'),
      startDate: null,
      deadline: new Date(sameDayDeadline),
      completeDate: null,
      overdueReason: null,
      unit: { id: TEST_UNIT_ID } as UnitEntity,
      ...overrides,
    }) as TaskEntity;

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilder.where.mockReturnThis();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.take.mockReturnThis();
    taskRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    lockQueryBuilder.setLock.mockReturnThis();
    lockQueryBuilder.where.mockReturnThis();
    lockQueryBuilder.andWhere.mockReturnThis();
    manager.createQueryBuilder.mockReturnValue(lockQueryBuilder);
    datasource.createQueryRunner.mockReturnValue(queryRunner);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(TaskEntity), useValue: taskRepository },
        { provide: getRepositoryToken(UnitEntity), useValue: unitRepository },
        { provide: DataSource, useValue: datasource },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchTasks', () => {
    it('returns paginated data when tasks match', async () => {
      const tasks = [baseTask()];
      queryBuilder.getManyAndCount.mockResolvedValue([tasks, 1]);

      const result = await service.searchTasks(
        'write',
        TEST_UNIT_ID,
        5,
        1,
        TaskSearchIn.Title,
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'task.title LIKE :query',
        { query: '%write%' },
      );
      expect(result).toEqual({
        data: tasks,
        total: 1,
        page: 1,
        limit: 5,
      });
    });

    it('searches description when searchIn is description', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.searchTasks(
        'cover',
        TEST_UNIT_ID,
        5,
        1,
        TaskSearchIn.Description,
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'task.description LIKE :query',
        { query: '%cover%' },
      );
    });

    it('returns message when no tasks found', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.searchTasks('missing', TEST_UNIT_ID, 5, 1);

      expect(result).toEqual({ message: 'tasks not found' });
    });
  });

  describe('findAll', () => {
    it('returns tasks for unit without date filter', async () => {
      const tasks = [baseTask()];
      queryBuilder.getMany.mockResolvedValue(tasks);

      const result = await service.findAll(TEST_UNIT_ID);

      expect(queryBuilder.where).toHaveBeenCalledWith('task.unitId = :unitId', {
        unitId: TEST_UNIT_ID,
      });
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
      expect(result).toEqual(tasks);
    });

    it('applies startDate and endDate filter when both provided', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.findAll(TEST_UNIT_ID, sameDayStart, sameDayDeadline);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'task."startDate" BETWEEN :startDate AND :endDate',
        { startDate: sameDayStart, endDate: sameDayDeadline },
      );
    });
  });

  describe('create', () => {
    const unit = { id: TEST_UNIT_ID } as UnitEntity;
    const payload = {
      title: 'write tests',
      category: TaskCategories.Work,
      priority: Priority.Medium,
      complexity: 5,
      startDate: sameDayStart,
      deadline: sameDayDeadline,
    };

    it('creates a task and returns it without unit', async () => {
      const saved = {
        ...baseTask({ startDate: new Date(sameDayStart) }),
        unit,
      };
      unitRepository.findOneOrFail.mockResolvedValue(unit);
      manager.save.mockResolvedValue(saved);

      const result = await service.create(unit, payload);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result).toEqual({
        task: expect.objectContaining({
          id: TEST_TASK_ID,
          title: 'write tests',
        }),
      });
      expect((result as { task: TaskEntity }).task).not.toHaveProperty('unit');
    });

    it('throws ConflictException when task spans more than one day', async () => {
      await expect(
        service.create(unit, {
          ...payload,
          deadline: nextDayDeadline,
        }),
      ).rejects.toThrow(ConflictException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('rolls back when unit lookup fails', async () => {
      unitRepository.findOneOrFail.mockRejectedValue(
        new EntityNotFoundError(UnitEntity, { id: TEST_UNIT_ID }),
      );

      await expect(service.create(unit, payload)).rejects.toThrow(
        EntityNotFoundError,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates and returns the task', async () => {
      const task = baseTask();
      const updated = baseTask({ title: 'updated title' });
      taskRepository.findOneOrFail
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(updated);
      taskRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(TEST_UNIT_ID, TEST_TASK_ID, {
        title: 'updated title',
      });

      expect(taskRepository.update).toHaveBeenCalledWith(TEST_TASK_ID, {
        title: 'updated title',
      });
      expect(result).toEqual(updated);
    });

    it('skips repository.update when payload is empty', async () => {
      const task = baseTask();
      taskRepository.findOneOrFail
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(task);

      const result = await service.update(TEST_UNIT_ID, TEST_TASK_ID, {});

      expect(taskRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(task);
    });
  });

  describe('findOne', () => {
    it('returns task by unit and id', async () => {
      const task = baseTask();
      taskRepository.findOneOrFail.mockResolvedValue(task);

      const result = await service.findOne(TEST_UNIT_ID, TEST_TASK_ID);

      expect(taskRepository.findOneOrFail).toHaveBeenCalledWith({
        where: { id: TEST_TASK_ID, unit: { id: TEST_UNIT_ID } },
        relations: undefined,
      });
      expect(result).toEqual(task);
    });
  });

  describe('remove', () => {
    it('deletes by id and unit and returns the id', async () => {
      taskRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(TEST_UNIT_ID, TEST_TASK_ID);

      expect(taskRepository.delete).toHaveBeenCalledWith({
        id: TEST_TASK_ID,
        unit: { id: TEST_UNIT_ID },
      });
      expect(result).toEqual({ id: TEST_TASK_ID });
    });

    it('throws NotFoundException when no row is deleted', async () => {
      taskRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(TEST_UNIT_ID, TEST_TASK_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAll', () => {
    it('removes all tasks for unit', async () => {
      const tasks = [{ id: TEST_TASK_ID } as TaskEntity];
      taskRepository.find.mockResolvedValue(tasks);
      taskRepository.remove.mockResolvedValue(tasks);

      await service.deleteAll(TEST_UNIT_ID);

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { unit: { id: TEST_UNIT_ID } },
        select: ['id'],
      });
      expect(taskRepository.remove).toHaveBeenCalledWith(tasks);
    });
  });

  describe('startTask', () => {
    it('sets startDate when task is not started', async () => {
      const task = baseTask();
      lockQueryBuilder.getOne.mockResolvedValue(task);
      manager.save.mockResolvedValue(task);

      const result = await service.startTask(TEST_UNIT_ID, TEST_TASK_ID, {
        startDate: sameDayStart,
      });

      expect(lockQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
      expect(task.startDate).toEqual(new Date(sameDayStart));
      expect(manager.save).toHaveBeenCalledWith(task);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual(task);
    });

    it('throws ConflictException when task already started', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(
        baseTask({ startDate: new Date(sameDayStart) }),
      );

      await expect(
        service.startTask(TEST_UNIT_ID, TEST_TASK_ID, {
          startDate: sameDayStart,
        }),
      ).rejects.toThrow(ConflictException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws ConflictException when start and deadline span more than one day', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(
        baseTask({ deadline: new Date(nextDayDeadline) }),
      );

      await expect(
        service.startTask(TEST_UNIT_ID, TEST_TASK_ID, {
          startDate: sameDayStart,
        }),
      ).rejects.toThrow(ConflictException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws NotFoundException when the task is missing', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.startTask(TEST_UNIT_ID, TEST_TASK_ID, {
          startDate: sameDayStart,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleTaskStatus', () => {
    it('completes a task that is not overdue', async () => {
      const futureDeadline = new Date(Date.now() + 60 * 60 * 1000);
      const task = baseTask({
        deadline: futureDeadline,
        completeDate: null,
      });
      const completed = baseTask({
        deadline: futureDeadline,
        completeDate: new Date(),
      });
      manager.findOneOrFail.mockResolvedValue(task);
      manager.save.mockResolvedValue(task);
      taskRepository.findOneOrFail.mockResolvedValue(completed);

      const result = await service.toggleTaskStatus(
        TEST_UNIT_ID,
        TEST_TASK_ID,
        {},
      );

      expect(task.completeDate).toBeInstanceOf(Date);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual(completed);
    });

    it('requires overdueReason when completing an overdue task', async () => {
      const pastDeadline = new Date(Date.now() - 60 * 60 * 1000);
      manager.findOneOrFail.mockResolvedValue(
        baseTask({
          deadline: pastDeadline,
          completeDate: null,
        }),
      );

      await expect(
        service.toggleTaskStatus(TEST_UNIT_ID, TEST_TASK_ID, {}),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('uncompletes a completed task and clears overdueReason', async () => {
      const task = baseTask({
        completeDate: new Date('2024-05-29T12:00:00.000Z'),
        overdueReason: 'was late',
      });
      const cleared = baseTask({
        completeDate: null,
        overdueReason: null,
      });
      manager.findOneOrFail.mockResolvedValue(task);
      manager.save.mockResolvedValue(task);
      taskRepository.findOneOrFail.mockResolvedValue(cleared);

      const result = await service.toggleTaskStatus(
        TEST_UNIT_ID,
        TEST_TASK_ID,
        {},
      );

      expect(task.completeDate).toBeNull();
      expect(task.overdueReason).toBeNull();
      expect(result).toEqual(cleared);
    });
  });
});
