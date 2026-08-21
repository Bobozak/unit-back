import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { Session } from './entities/session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private datasource: DataSource,
  ) {}

  async create(unitId: string) {
    try {
      const session = this.sessionRepository.create({
        unit: { id: unitId },
        createdAt: new Date().toISOString(),
      });
      return this.sessionRepository.save(session);
    } catch (error) {
      throw error;
    }
  }

  async findOneForJwt(unitId: string, sessionId: string) {
    const data = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.unit', 'unit')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.unitId = :unitId', { unitId })
      .getOne();

    if (!data) {
      throw new UnauthorizedException('Session is closed!');
    }

    if (!data || !data.unit.isLoggedIn) throw new UnauthorizedException();
  }

  async closeSession(unitId: string) {
    const exists = await this.sessionRepository.exists({
      where: { unit: { id: unitId }, deletedAt: IsNull() },
    });

    if (!exists) {
      return;
    }

    await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .where('unitId = :unitId', { unitId })
      .execute();
  }

  async deleteAndCreateNew(id: string, unitId: string) {
    try {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const [newSession, _] = await Promise.all([
        this.create(unitId),
        this.closeSession(unitId),
      ]);

      return newSession;
    } catch (error) {
      throw error;
    }
  }
}
