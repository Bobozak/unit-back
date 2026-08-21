import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityNotFoundError } from 'typeorm';

import { AuthService } from '../auth.service';

import { LocalStrategy } from './local.strategy';
import { TEST_UNIT_ID } from '../../../test/helpers/uuid-fixtures';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;

  const authService = {
    validateUnit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
  });

  it('returns unit and sets req.unit on valid credentials', async () => {
    const unit = { id: TEST_UNIT_ID, unitname: 'Kira' };
    const req = {};
    authService.validateUnit.mockResolvedValue(unit);

    const result = await strategy.validate(req, 'Kira', 'valid passphrase12');

    expect(result).toEqual(unit);
    expect(req).toEqual({ unit });
  });

  it('throws UnauthorizedException when validateUnit returns null', async () => {
    authService.validateUnit.mockResolvedValue(null);

    await expect(
      strategy.validate({}, 'Kira', 'wrong passphrase1'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when unit is not found', async () => {
    authService.validateUnit.mockRejectedValue(
      new EntityNotFoundError('UnitEntity', { unitname: 'Missing' }),
    );

    await expect(
      strategy.validate({}, 'Missing', 'valid passphrase12'),
    ).rejects.toThrow(new UnauthorizedException('Unit not found'));
  });

  it('rethrows ForbiddenException from validateUnit', async () => {
    authService.validateUnit.mockRejectedValue(
      new ForbiddenException('Profile not verified'),
    );

    await expect(
      strategy.validate({}, 'Kira', 'valid passphrase12'),
    ).rejects.toThrow(ForbiddenException);
  });
});
