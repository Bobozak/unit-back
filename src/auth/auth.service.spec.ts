import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { UnitsService } from '@/units/units.service';

import {
  TEST_NEW_SESSION_ID,
  TEST_SESSION_ID,
  TEST_UNIT_ID,
} from '../../test/helpers/uuid-fixtures';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const unitsService = {
    findOneByParams: jest.fn(),
    saveUnit: jest.fn(),
    createSession: jest.fn(),
    findOneForRefreshToken: jest.fn(),
    logout: jest.fn(),
    findOpenedSessionAndDelete: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) =>
      key === 'REFRESH_JWT_SECRET' ? 'refresh-secret' : 'access-secret',
    ),
  };

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isTransactionActive: true,
    manager: {},
  };

  const datasource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UnitsService, useValue: unitsService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: DataSource, useValue: datasource },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUnit', () => {
    const baseUnit = {
      id: TEST_UNIT_ID,
      unitname: 'Kira',
      passphrase: 'hashed',
      isVerified: true,
    };

    it('returns unit when passphrase matches', async () => {
      unitsService.findOneByParams.mockResolvedValue(baseUnit);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUnit('Kira', 'valid passphrase12');

      expect(result).toEqual(baseUnit);
    });

    it('returns null when passphrase does not match', async () => {
      unitsService.findOneByParams.mockResolvedValue(baseUnit);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUnit('Kira', 'wrong passphrase1');

      expect(result).toBeNull();
    });

    it('throws BadRequestException when passphrase is missing on unit', async () => {
      unitsService.findOneByParams.mockResolvedValue({
        ...baseUnit,
        passphrase: '',
      });

      await expect(
        service.validateUnit('Kira', 'valid passphrase12'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when profile is not verified', async () => {
      unitsService.findOneByParams.mockResolvedValue({
        ...baseUnit,
        isVerified: false,
      });

      await expect(
        service.validateUnit('Kira', 'valid passphrase12'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login', () => {
    const unit = { id: TEST_UNIT_ID, unitname: 'Kira' };

    it('commits transaction and returns tokens on success', async () => {
      unitsService.saveUnit.mockResolvedValue(TEST_UNIT_ID);
      unitsService.createSession.mockResolvedValue({ id: TEST_SESSION_ID });
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login(unit);

      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(unitsService.saveUnit).toHaveBeenCalled();
      expect(unitsService.createSession).toHaveBeenCalledWith(
        TEST_UNIT_ID,
        queryRunner.manager,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('rolls back transaction and rethrows on error', async () => {
      unitsService.saveUnit.mockRejectedValue(new Error('db error'));

      await expect(service.login(unit)).rejects.toThrow('db error');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const pastExp = Math.floor(Date.now() / 1000) - 3600;

    it('returns new tokens for valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        unitname: 'Kira',
        sub: TEST_UNIT_ID,
        sessionId: TEST_SESSION_ID,
        exp: futureExp,
      });
      unitsService.findOpenedSessionAndDelete.mockResolvedValue({
        id: TEST_NEW_SESSION_ID,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');

      const result = await service.refreshToken(
        { sub: TEST_UNIT_ID },
        'old-refresh-token',
      );

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('old-refresh-token', {
        secret: 'refresh-secret',
      });
      expect(unitsService.findOneForRefreshToken).toHaveBeenCalledWith('Kira');
      expect(unitsService.findOpenedSessionAndDelete).toHaveBeenCalledWith(
        TEST_SESSION_ID,
        TEST_UNIT_ID,
      );
      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });

    it('logs out and throws when refresh token is expired', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        unitname: 'Kira',
        sub: TEST_UNIT_ID,
        sessionId: TEST_SESSION_ID,
        exp: pastExp,
      });

      await expect(
        service.refreshToken({ sub: TEST_UNIT_ID }, 'expired-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(unitsService.logout).toHaveBeenCalledWith(TEST_UNIT_ID);
    });

    it('throws when verifyAsync fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new UnauthorizedException());

      await expect(
        service.refreshToken({ sub: TEST_UNIT_ID }, 'invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('issueSessionTokens', () => {
    it('signs access and refresh tokens with expected payload', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.issueSessionTokens(
        'Kira',
        TEST_UNIT_ID,
        TEST_SESSION_ID,
      );

      expect(jwtService.signAsync).toHaveBeenNthCalledWith(1, {
        unitname: 'Kira',
        sub: TEST_UNIT_ID,
        sessionId: TEST_SESSION_ID,
      });
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        {
          unitname: 'Kira',
          sub: TEST_UNIT_ID,
          sessionId: TEST_SESSION_ID,
        },
        { expiresIn: '7d', secret: 'refresh-secret' },
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });
});
