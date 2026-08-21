import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOneOptions, Repository } from 'typeorm';

import {
  getDifferenceInDays,
  isDeadlineAfterStartDate,
  TaskSearchIn,
} from '@/common';
import { TaskEntity } from '@/tasks/entities/task.entity';
import { UnitEntity } from '@/units/entities/unit.entity';

import { CreateTaskDto } from './dto/create-task.dto';
import { StartTaskDto } from './dto/start-task.dto';
import { ToggleTaskStatusDto } from './dto/toggle-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(UnitEntity)
    private unitRepository: Repository<UnitEntity>,
    private datasource: DataSource,
  ) {}

  async searchTasks(
    query: string,
    unitId: string,
    limit: number,
    page: number,
    searchIn: TaskSearchIn = TaskSearchIn.Title,
  ): Promise<
    | {
        data: TaskEntity[];
        total: number;
        page: number;
        limit: number;
      }
    | { message: string }
  > {
    const searchColumn =
      searchIn === TaskSearchIn.Description ? 'task.description' : 'task.title';

    const [tasks, total] = await this.taskRepository
      .createQueryBuilder('task')
      .where('task.unitId = :unitId', { unitId })
      .andWhere(`${searchColumn} LIKE :query`, { query: `%${query}%` })
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (!total) {
      return { message: 'tasks not found' };
    }

    return {
      data: tasks,
      total,
      page: +page,
      limit: +limit,
    };
  }

  async findOneByParams(
    params: Record<string, any>,
    relations?: string[],
  ): Promise<TaskEntity> {
    const queryOptions: FindOneOptions<TaskEntity> = {
      where: params,
      relations: relations,
    };

    return await this.taskRepository.findOneOrFail(queryOptions);
  }

  async findAll(unitId: string, startDate?: string, endDate?: string) {
    const queryBuilder = this.taskRepository
      .createQueryBuilder('task')
      .where('task.unitId = :unitId', { unitId });

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'task."startDate" BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    }

    return await queryBuilder.getMany();
  }

  async create(unit: UnitEntity, payload: CreateTaskDto) {
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { startDate, deadline } = payload;

      if (startDate) {
        const differenceDays = getDifferenceInDays(deadline, startDate);
        if (differenceDays >= 1) {
          throw new ConflictException('The task should be limited to one day!');
        }

        isDeadlineAfterStartDate(startDate, deadline);
      }

      const existUnit = await this.unitRepository.findOneOrFail({
        where: {
          id: unit.id,
        },
      });

      const newTask = new TaskEntity(payload);
      newTask.unit = existUnit;

      const createdTask = await queryRunner.manager.save(newTask);

      const { unit: taskUnit, ...task } = createdTask;

      await queryRunner.commitTransaction();
      return { task };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(unitId: string, taskId: string, payload: UpdateTaskDto) {
    const task = await this.taskRepository.findOneOrFail({
      where: { unit: { id: unitId }, id: taskId },
    });

    if (Object.keys(payload).length === 0) {
      return await this.findOne(unitId, taskId);
    }

    await this.taskRepository.update(task.id, payload);
    return await this.findOne(unitId, taskId);
  }

  async startTask(unitId: string, taskId: string, payload: StartTaskDto) {
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const task = await queryRunner.manager
        .createQueryBuilder(TaskEntity, 'task')
        .setLock('pessimistic_write')
        .where('task.id = :taskId', { taskId })
        .andWhere('task.unitId = :unitId', { unitId })
        .getOne();

      if (!task) {
        throw new NotFoundException('TaskEntity not found');
      }

      if (task.startDate) {
        throw new ConflictException('Task already started');
      }

      const { startDate } = payload;
      const deadline = task.deadline.toISOString();

      const differenceDays = getDifferenceInDays(deadline, startDate);
      if (differenceDays >= 1) {
        throw new ConflictException('The task should be limited to one day!');
      }

      isDeadlineAfterStartDate(startDate, deadline);

      task.startDate = new Date(startDate);
      await queryRunner.manager.save(task);
      await queryRunner.commitTransaction();
      return task;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(unitId: string, taskId: string) {
    const result = await this.taskRepository.delete({
      id: taskId,
      unit: { id: unitId },
    });

    if (!result.affected) {
      throw new NotFoundException('TaskEntity not found');
    }

    return { id: taskId };
  }

  async deleteAll(unitId: string) {
    const tasks = await this.taskRepository.find({
      where: { unit: { id: unitId } },
      select: ['id'],
    });
    await this.taskRepository.remove(tasks);
  }

  async findOne(unitId: string, taskId: string): Promise<TaskEntity> {
    return await this.findOneByParams({ id: taskId, unit: { id: unitId } });
  }

  async toggleTaskStatus(
    unitId: string,
    taskId: string,
    payload: ToggleTaskStatusDto,
  ): Promise<TaskEntity> {
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const manager = queryRunner.manager;
    try {
      const task = await manager.findOneOrFail(TaskEntity, {
        where: {
          id: taskId,
          unit: { id: unitId },
        },
      });

      const now = new Date();
      const willComplete = !task.completeDate;
      const isOverdue = willComplete && now > task.deadline;

      if (isOverdue && !payload.overdueReason?.trim()) {
        throw new BadRequestException(
          'overdueReason is required for overdue tasks',
        );
      }

      if (willComplete) {
        if (payload.overdueReason?.trim()) {
          task.overdueReason = payload.overdueReason.trim();
        }
        task.completeDate = now;
      } else {
        task.completeDate = null;
        task.overdueReason = null;
      }

      await manager.save(task);
      await queryRunner.commitTransaction();
      return await this.findOne(unitId, taskId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
