import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';

import * as common from '@/common';
import { SessionService } from '@/session/session.service';
import { UnitsService } from '@/units/units.service';

import {
  TEST_NEW_SESSION_ID,
  TEST_SESSION_ID,
  TEST_UNIT_ID,
} from '../../test/helpers/uuid-fixtures';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    login: jest.fn(),
    refreshToken: jest.fn(),
    issueSessionTokens: jest.fn(),
  };

  const unitsService = {
    checkUnitnameAvailable: jest.fn(),
    create: jest.fn(),
    verifyProfile: jest.fn(),
    getSecurityQuestion: jest.fn(),
    getSecurityQuestionForReset: jest.fn(),
    issueResetRound1Challenge: jest.fn(),
    verifyResetRound1: jest.fn(),
    resetPassphrase: jest.fn(),
    issuePassphraseChangeChallenge: jest.fn(),
    changePassphrase: jest.fn(),
    markLoggedIn: jest.fn(),
    logout: jest.fn(),
  };

  const sessionService = {
    closeSession: jest.fn(),
    create: jest.fn(),
  };

  const createResponse = (): Response =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    }) as unknown as Response;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest
      .spyOn(common, 'setRefreshTokenCookie')
      .mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UnitsService, useValue: unitsService },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('returns accessToken and sets refresh cookie', async () => {
      const response = createResponse();
      const unit = { id: TEST_UNIT_ID, unitname: 'Kira' };
      authService.login.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await controller.login(unit, response);

      expect(authService.login).toHaveBeenCalledWith(unit);
      expect(common.setRefreshTokenCookie).toHaveBeenCalledWith(
        response,
        'refresh-token',
      );
      expect(result).toEqual({ accessToken: 'access-token' });
    });
  });

  describe('register', () => {
    it('delegates to unitsService.create', async () => {
      const dto = { unitname: 'Kira', passphrase: 'valid passphrase12' };
      unitsService.create.mockResolvedValue({ id: TEST_UNIT_ID });

      const result = await controller.register(dto as any);

      expect(unitsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: TEST_UNIT_ID });
    });
  });

  describe('verify', () => {
    it('returns retry/destroyed without issuing tokens', async () => {
      unitsService.verifyProfile.mockResolvedValue({
        status: 'retry',
        code: '0111123334445566',
        attemptsRemaining: 2,
      });

      const result = await controller.verify(
        {
          unitname: 'Kira',
          code: '0111123334445566',
        },
        createResponse(),
      );

      expect(unitsService.verifyProfile).toHaveBeenCalledWith(
        'Kira',
        '0111123334445566',
      );
      expect(sessionService.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: 'retry',
        code: '0111123334445566',
        attemptsRemaining: 2,
      });
    });

    it('issues session tokens on verified profile', async () => {
      const response = createResponse();
      unitsService.verifyProfile.mockResolvedValue({
        status: 'verified',
        message: 'Profile verified successfully',
        unit: { id: TEST_UNIT_ID, unitname: 'Kira' },
      });
      sessionService.create.mockResolvedValue({ id: TEST_SESSION_ID });
      authService.issueSessionTokens.mockResolvedValue({
        accessToken: 'verified-access',
        refreshToken: 'verified-refresh',
      });

      const result = await controller.verify(
        {
          unitname: 'Kira',
          code: '0111123334445566',
        },
        response,
      );

      expect(sessionService.create).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(authService.issueSessionTokens).toHaveBeenCalledWith(
        'Kira',
        TEST_UNIT_ID,
        TEST_SESSION_ID,
      );
      expect(unitsService.markLoggedIn).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(common.setRefreshTokenCookie).toHaveBeenCalledWith(
        response,
        'verified-refresh',
      );
      expect(result).toEqual({
        status: 'verified',
        message: 'Profile verified successfully',
        accessToken: 'verified-access',
      });
    });
  });

  describe('issueResetRound1Challenge', () => {
    it('delegates to unitsService.issueResetRound1Challenge', async () => {
      unitsService.issueResetRound1Challenge.mockResolvedValue({
        digits: '9817654321000000',
        expiresAt: new Date(),
      });

      const result = await controller.issueResetRound1Challenge({
        unitname: 'Kira',
        securityAnswer: 'night city',
      });

      expect(unitsService.issueResetRound1Challenge).toHaveBeenCalledWith(
        'Kira',
        'night city',
      );
      expect(result.digits).toBe('9817654321000000');
    });
  });

  describe('verifyResetRound1', () => {
    it('delegates to unitsService.verifyResetRound1', async () => {
      unitsService.verifyResetRound1.mockResolvedValue({
        digits: '5432109876543210',
        expiresAt: new Date(),
      });

      const result = await controller.verifyResetRound1({
        unitname: 'Kira',
        digitSequence: '2468975311000000',
      });

      expect(unitsService.verifyResetRound1).toHaveBeenCalledWith(
        'Kira',
        '2468975311000000',
      );
      expect(result.digits).toBe('5432109876543210');
    });
  });

  describe('resetPassphrase', () => {
    it('orchestrates reset flow with auto-login tokens', async () => {
      const response = createResponse();
      unitsService.resetPassphrase.mockResolvedValue({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
      });
      sessionService.create.mockResolvedValue({ id: TEST_SESSION_ID });
      authService.issueSessionTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const result = await controller.resetPassphrase(
        {
          unitname: 'Kira',
          newPassphrase: 'new passphrase12',
        },
        response,
      );

      expect(unitsService.resetPassphrase).toHaveBeenCalledWith(
        'Kira',
        'new passphrase12',
      );
      expect(sessionService.closeSession).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(sessionService.create).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(authService.issueSessionTokens).toHaveBeenCalledWith(
        'Kira',
        TEST_UNIT_ID,
        TEST_SESSION_ID,
      );
      expect(unitsService.markLoggedIn).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(common.setRefreshTokenCookie).toHaveBeenCalledWith(
        response,
        'new-refresh',
      );
      expect(result).toEqual({ accessToken: 'new-access' });
    });
  });

  describe('issuePassphraseChallenge', () => {
    it('delegates to unitsService.issuePassphraseChangeChallenge', async () => {
      unitsService.issuePassphraseChangeChallenge.mockResolvedValue({
        digits: '9876543210000000',
        expiresAt: new Date(),
      });

      const result = await controller.issuePassphraseChallenge(TEST_UNIT_ID, {
        securityAnswer: 'night city',
      });

      expect(unitsService.issuePassphraseChangeChallenge).toHaveBeenCalledWith(
        TEST_UNIT_ID,
        'night city',
      );
      expect(result.digits).toBe('9876543210000000');
    });
  });

  describe('changePassphrase', () => {
    it('orchestrates change passphrase flow with auto-login tokens', async () => {
      const response = createResponse();
      unitsService.changePassphrase.mockResolvedValue({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
      });
      sessionService.create.mockResolvedValue({ id: TEST_NEW_SESSION_ID });
      authService.issueSessionTokens.mockResolvedValue({
        accessToken: 'changed-access',
        refreshToken: 'changed-refresh',
      });

      const result = await controller.changePassphrase(
        TEST_UNIT_ID,
        {
          currentPassphrase: 'old passphrase12',
          digitSequence: '9876543210000000',
          newPassphrase: 'new passphrase12',
        },
        response,
      );

      expect(unitsService.changePassphrase).toHaveBeenCalledWith(TEST_UNIT_ID, {
        currentPassphrase: 'old passphrase12',
        digitSequence: '9876543210000000',
        newPassphrase: 'new passphrase12',
      });
      expect(sessionService.closeSession).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(sessionService.create).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(authService.issueSessionTokens).toHaveBeenCalledWith(
        'Kira',
        TEST_UNIT_ID,
        TEST_NEW_SESSION_ID,
      );
      expect(unitsService.markLoggedIn).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(result).toEqual({ accessToken: 'changed-access' });
    });
  });

  describe('logout', () => {
    it('clears refresh cookie and delegates logout', async () => {
      const response = createResponse();
      unitsService.logout.mockResolvedValue({ message: 'Logout successful' });

      const result = await controller.logout(TEST_UNIT_ID, response);

      expect(response.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(unitsService.logout).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(result).toEqual({ message: 'Logout successful' });
    });
  });

  describe('refreshToken', () => {
    it('throws when cookie header is missing', async () => {
      await expect(
        controller.refreshToken({ headers: {} } as any, createResponse()),
      ).rejects.toThrow(new BadRequestException('Cookie is required!'));
    });

    it('throws when refresh_token cookie is missing', async () => {
      await expect(
        controller.refreshToken(
          { headers: { cookie: 'other=value' } } as any,
          createResponse(),
        ),
      ).rejects.toThrow(
        new BadRequestException('Refresh token cookie is required!'),
      );
    });

    it('returns new access token and sets refresh cookie', async () => {
      const response = createResponse();
      authService.refreshToken.mockResolvedValue({
        accessToken: 'refreshed-access',
        refreshToken: 'refreshed-refresh',
      });

      const result = await controller.refreshToken(
        {
          headers: { cookie: 'refresh_token=old-refresh; Path=/' },
          unit: { sub: TEST_UNIT_ID },
        } as any,
        response,
      );

      expect(authService.refreshToken).toHaveBeenCalledWith(
        { sub: TEST_UNIT_ID },
        'old-refresh',
      );
      expect(common.setRefreshTokenCookie).toHaveBeenCalledWith(
        response,
        'refreshed-refresh',
      );
      expect(result).toEqual({ accessToken: 'refreshed-access' });
    });
  });
});
