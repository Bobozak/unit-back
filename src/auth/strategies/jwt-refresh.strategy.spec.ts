import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { SessionService } from '@/session/session.service';
import { UnitsService } from '@/units/units.service';

import { RefreshJwtStrategy } from './jwt-refresh.strategy';
import {
  TEST_SESSION_ID,
  TEST_UNIT_ID,
} from '../../../test/helpers/uuid-fixtures';

describe('RefreshJwtStrategy', () => {
  let strategy: RefreshJwtStrategy;

  const unitsService = {
    logout: jest.fn(),
  };

  const sessionService = {
    findOneForJwt: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshJwtStrategy,
        { provide: UnitsService, useValue: unitsService },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    strategy = module.get<RefreshJwtStrategy>(RefreshJwtStrategy);
  });

  it('returns payload when within grace period and session is valid', async () => {
    const req = {};
    const payload = {
      sub: TEST_UNIT_ID,
      unitname: 'Kira',
      sessionId: TEST_SESSION_ID,
      exp: Math.floor(Date.now() / 1000) - 3600,
    };

    sessionService.findOneForJwt.mockResolvedValue(undefined);

    const result = await strategy.validate(req, payload as any);

    expect(sessionService.findOneForJwt).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_SESSION_ID,
    );
    expect(result).toEqual(payload);
    expect(req).toEqual({ unit: payload });
  });

  it('logs out and throws when token is older than 2 hours', async () => {
    const payload = {
      sub: TEST_UNIT_ID,
      unitname: 'Kira',
      sessionId: TEST_SESSION_ID,
      exp: Math.floor(Date.now() / 1000) - 3 * 3600,
    };

    await expect(strategy.validate({}, payload as any)).rejects.toThrow(
      new UnauthorizedException('Session expired. Please log in again.'),
    );

    expect(unitsService.logout).toHaveBeenCalledWith(TEST_UNIT_ID);
  });

  it('propagates UnauthorizedException when session lookup fails', async () => {
    const payload = {
      sub: TEST_UNIT_ID,
      unitname: 'Kira',
      sessionId: TEST_SESSION_ID,
      exp: Math.floor(Date.now() / 1000),
    };

    sessionService.findOneForJwt.mockRejectedValue(
      new UnauthorizedException('Session is closed!'),
    );

    await expect(strategy.validate({}, payload as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
