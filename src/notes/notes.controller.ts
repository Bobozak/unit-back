import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Unit } from 'src/common';

import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NotesService } from './notes.service';
import {
  CreateNoteDocs,
  DeleteNoteDocs,
  GetNoteByIdDocs,
  GetNotesByTaskDocs,
  UpdateNoteDocs,
} from './swagger-docs';

@Controller('notes')
@ApiTags('Notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post('task/:taskId')
  @CreateNoteDocs()
  create(
    @Unit('id') unitId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() payload: CreateNoteDto,
  ) {
    return this.notesService.create(unitId, taskId, payload);
  }

  @Get('task/:taskId')
  @GetNotesByTaskDocs()
  findAllByTask(
    @Unit('id') unitId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.notesService.findAllByTask(unitId, taskId);
  }

  @Get(':id')
  @GetNoteByIdDocs()
  findOne(
    @Unit('id') unitId: string,
    @Param('id', ParseUUIDPipe) noteId: string,
  ) {
    return this.notesService.findOne(unitId, noteId);
  }

  @Patch(':id')
  @UpdateNoteDocs()
  update(
    @Unit('id') unitId: string,
    @Param('id', ParseUUIDPipe) noteId: string,
    @Body() payload: UpdateNoteDto,
  ) {
    return this.notesService.update(unitId, noteId, payload);
  }

  @Delete(':id')
  @DeleteNoteDocs()
  remove(
    @Unit('id') unitId: string,
    @Param('id', ParseUUIDPipe) noteId: string,
  ) {
    return this.notesService.remove(unitId, noteId);
  }
}
