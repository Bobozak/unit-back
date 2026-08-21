import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { SessionService } from '@/session/session.service';

import {
  TEST_SESSION_ID,
  TEST_UNIT_ID,
} from '../../../test/helpers/uuid-fixtures';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const sessionService = {
    findOneForJwt: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('returns payload with id and sets req.unit when session is valid', async () => {
    const req = {};
    const payload = {
      sub: TEST_UNIT_ID,
      unitname: 'Kira',
      sessionId: TEST_SESSION_ID,
    };

    sessionService.findOneForJwt.mockResolvedValue(undefined);

    const result = await strategy.validate(req, payload as any);

    expect(sessionService.findOneForJwt).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      TEST_SESSION_ID,
    );
    expect(result).toEqual({ ...payload, id: TEST_UNIT_ID });
    expect(req).toEqual({ unit: { ...payload, id: TEST_UNIT_ID } });
  });

  it('propagates UnauthorizedException when session is closed', async () => {
    sessionService.findOneForJwt.mockRejectedValue(
      new UnauthorizedException('Session is closed!'),
    );

    await expect(
      strategy.validate({}, {
        sub: TEST_UNIT_ID,
        sessionId: TEST_SESSION_ID,
      } as any),
    ).rejects.toThrow(UnauthorizedException);
  });
});
