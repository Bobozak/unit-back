import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Session } from './entities/session.entity';
import { SessionService } from './session.service';
import { SessionCleanupService } from './session-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session]), ScheduleModule.forRoot()],
  providers: [SessionService, SessionCleanupService],
  exports: [SessionService],
})
export class SessionModule {}
