import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  TEST_NEW_SESSION_ID,
  TEST_SESSION_ID,
  TEST_UNIT_ID,
} from '../../test/helpers/uuid-fixtures';

import { Session } from './entities/session.entity';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;

  const queryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    delete: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const sessionRepository = {
    find: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exists: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilder.leftJoinAndSelect.mockReturnThis();
    queryBuilder.where.mockReturnThis();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.delete.mockReturnThis();
    sessionRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepository,
        },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates and saves a session for the unit', async () => {
      const created = {
        unit: { id: TEST_UNIT_ID },
        createdAt: '2024-05-29T12:00:00.000Z',
      };
      const saved = { id: TEST_SESSION_ID, ...created };
      sessionRepository.create.mockReturnValue(created);
      sessionRepository.save.mockResolvedValue(saved);

      const result = await service.create(TEST_UNIT_ID);

      expect(sessionRepository.create).toHaveBeenCalledWith({
        unit: { id: TEST_UNIT_ID },
        createdAt: expect.any(String),
      });
      expect(sessionRepository.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(saved);
    });
  });

  describe('findOneForJwt', () => {
    it('resolves when session exists and unit is logged in', async () => {
      queryBuilder.getOne.mockResolvedValue({
        id: TEST_SESSION_ID,
        unit: { id: TEST_UNIT_ID, isLoggedIn: true },
      });

      await expect(
        service.findOneForJwt(TEST_UNIT_ID, TEST_SESSION_ID),
      ).resolves.toBeUndefined();
    });

    it('throws UnauthorizedException when session is missing', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.findOneForJwt(TEST_UNIT_ID, TEST_SESSION_ID),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when unit is not logged in', async () => {
      queryBuilder.getOne.mockResolvedValue({
        id: TEST_SESSION_ID,
        unit: { id: TEST_UNIT_ID, isLoggedIn: false },
      });

      await expect(
        service.findOneForJwt(TEST_UNIT_ID, TEST_SESSION_ID),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('closeSession', () => {
    it('does nothing when no open session exists', async () => {
      sessionRepository.exists.mockResolvedValue(false);

      await service.closeSession(TEST_UNIT_ID);

      expect(sessionRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('deletes sessions for the unit when one exists', async () => {
      sessionRepository.exists.mockResolvedValue(true);
      queryBuilder.execute.mockResolvedValue({ affected: 1 });

      await service.closeSession(TEST_UNIT_ID);

      expect(sessionRepository.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.delete).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalledWith('unitId = :unitId', {
        unitId: TEST_UNIT_ID,
      });
      expect(queryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe('deleteAndCreateNew', () => {
    it('creates a new session while closing the old one', async () => {
      const newSession = { id: TEST_NEW_SESSION_ID };
      const createSpy = jest
        .spyOn(service, 'create')
        .mockResolvedValue(newSession as Session);
      const closeSpy = jest
        .spyOn(service, 'closeSession')
        .mockResolvedValue(undefined);

      const result = await service.deleteAndCreateNew(
        TEST_SESSION_ID,
        TEST_UNIT_ID,
      );

      expect(createSpy).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(closeSpy).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(result).toEqual(newSession);
    });
  });
});
