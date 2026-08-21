import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Session } from './entities/session.entity';

@Injectable()
export class SessionCleanupService {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
  ) {}

  @Cron('0 * * * *', {
    name: 'delete expired sessions',
    timeZone: 'Europe/Kyiv',
  })
  async handleCron(): Promise<void> {
    const now = new Date();
    now.setHours(now.getHours() - 2);

    const twoHoursAgo = now.toISOString();

    const oldSessions = await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.createdAt < :twoHoursAgo', { twoHoursAgo })
      .getMany();

    if (!oldSessions.length) {
      return;
    }

    await this.sessionRepository.remove(oldSessions);
  }
}
