import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TaskSearchIn, Unit } from 'src/common';

import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

import { CreateTaskDto } from './dto/create-task.dto';
import { StartTaskDto } from './dto/start-task.dto';
import { ToggleTaskStatusDto } from './dto/toggle-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskEntity } from './entities/task.entity';
import {
  CreateTaskDocs,
  DeleteAllTasksDocs,
  DeleteTaskDocs,
  GetTaskByIdDocs,
  GetTasksDocs,
  SearchTasksDocs,
  StartTaskDocs,
  ToggleTaskStatusDocs,
  UpdateTaskDocs,
} from './swagger-docs';
import { TasksService } from './tasks.service';

@Controller('schedule')
@ApiTags('Tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @CreateTaskDocs()
  async createOne(@Request() req: any, @Body() payload: CreateTaskDto) {
    return await this.tasksService.create(req.unit, payload);
  }

  @Get('search')
  @SearchTasksDocs()
  searchTasks(
    @Unit('id') unitId: string,
    @Query('query') query: string,
    @Query(
      'searchIn',
      new DefaultValuePipe(TaskSearchIn.Title),
      new ParseEnumPipe(TaskSearchIn),
    )
    searchIn: TaskSearchIn,
    @Query('limit', new ParseIntPipe()) limit = 5,
    @Query('page', new ParseIntPipe()) page = 1,
  ): Promise<
    | {
        data: TaskEntity[];
        total: number;
        page: number;
        limit: number;
      }
    | { message: string }
  > {
    return this.tasksService.searchTasks(query, unitId, limit, page, searchIn);
  }

  @Get()
  @GetTasksDocs()
  async findAll(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Unit('id') unitId: string,
  ) {
    return this.tasksService.findAll(unitId, startDate, endDate);
  }

  @Patch('toggle-status/:taskId')
  @ToggleTaskStatusDocs()
  async toggleTaskStatus(
    @Unit('id') unitId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() payload: ToggleTaskStatusDto,
  ): Promise<TaskEntity> {
    return this.tasksService.toggleTaskStatus(unitId, taskId, payload);
  }

  @Patch('start/:taskId')
  @StartTaskDocs()
  async startTask(
    @Unit('id') unitId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() payload: StartTaskDto,
  ): Promise<TaskEntity> {
    return this.tasksService.startTask(unitId, taskId, payload);
  }

  @Get(':id')
  @GetTaskByIdDocs()
  async getById(
    @Unit('id') unitId: string,
    @Param('id', ParseUUIDPipe) taskId: string,
  ): Promise<TaskEntity> {
    return await this.tasksService.findOne(unitId, taskId);
  }

  @Patch(':id')
  @UpdateTaskDocs()
  async update(
    @Unit('id') unitId: string,
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    payload: UpdateTaskDto,
  ) {
    return await this.tasksService.update(unitId, taskId, payload);
  }

  @Delete(':id')
  @DeleteTaskDocs()
  async remove(
    @Unit('id') unitId: string,
    @Param('id', ParseUUIDPipe) taskId: string,
  ) {
    return await this.tasksService.remove(unitId, taskId);
  }

  @Delete()
  @DeleteAllTasksDocs()
  async delete(@Unit('id') unitId: string) {
    return await this.tasksService.deleteAll(unitId);
  }
}
