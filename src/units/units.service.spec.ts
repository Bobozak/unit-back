import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { EntityManager } from 'typeorm';

import { ChangePassphraseDto } from '@/auth/dto/change-passphrase.dto';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import {
  buildResetRound1ExpectedSequence,
  buildResetRound2ExpectedSequence,
} from '@/common/helpers/build-reset-digit-sequence';
import { isNonIncreasingDigitSequence } from '@/common/validators/is-non-increasing-digit-sequence.validator';
import { SessionService } from '@/session/session.service';

import {
  TEST_NEW_SESSION_ID,
  TEST_SESSION_ID,
  TEST_UNIT_ID,
} from '../../test/helpers/uuid-fixtures';
import { UnitEntity } from './entities/unit.entity';
import { UnitsService } from './units.service';

jest.mock('bcrypt');

describe('buildResetDigitSequence helpers', () => {
  it('builds round 1 sequence: even digits asc, odd digits desc, then zeros', () => {
    expect(buildResetRound1ExpectedSequence('9817654321000000')).toBe(
      '2468975311000000',
    );
  });

  it('returns round 2 sequence unchanged', () => {
    expect(buildResetRound2ExpectedSequence('5432109876543210')).toBe(
      '5432109876543210',
    );
  });
});

describe('UnitsService', () => {
  let service: UnitsService;

  const unitsRepository = {
    findOneOrFail: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    preload: jest.fn(),
    delete: jest.fn(),
  };

  const cloudinaryService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const sessionService = {
    create: jest.fn(),
    closeSession: jest.fn(),
    deleteAndCreateNew: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        {
          provide: getRepositoryToken(UnitEntity),
          useValue: unitsRepository,
        },
        {
          provide: CloudinaryService,
          useValue: cloudinaryService,
        },
        {
          provide: SessionService,
          useValue: sessionService,
        },
      ],
    }).compile();

    service = module.get<UnitsService>(UnitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveUnit', () => {
    it('saves unit via manager and returns id', async () => {
      const manager = {
        save: jest.fn().mockResolvedValue({ id: TEST_UNIT_ID }),
      } as unknown as EntityManager;
      const unit = { unitname: 'Kira' } as UnitEntity;

      const result = await service.saveUnit(unit, manager);

      expect(manager.save).toHaveBeenCalledWith(unit);
      expect(result).toBe(TEST_UNIT_ID);
    });
  });

  describe('findOneByParams', () => {
    it('returns unit from repository', async () => {
      const unit = { id: TEST_UNIT_ID, unitname: 'Kira' };
      unitsRepository.findOneOrFail.mockResolvedValue(unit);

      const result = await service.findOneByParams({ unitname: 'Kira' }, [
        'sessions',
      ]);

      expect(unitsRepository.findOneOrFail).toHaveBeenCalledWith({
        where: { unitname: 'Kira' },
        relations: ['sessions'],
      });
      expect(result).toEqual(unit);
    });
  });

  describe('findOneForRefreshToken', () => {
    it('resolves when verified unit exists', async () => {
      unitsRepository.exists.mockResolvedValue(true);

      await expect(
        service.findOneForRefreshToken('Kira'),
      ).resolves.toBeUndefined();
    });

    it('throws UnauthorizedException when unit does not exist', async () => {
      unitsRepository.exists.mockResolvedValue(false);

      await expect(service.findOneForRefreshToken('Kira')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('me', () => {
    it('returns the unit profile', async () => {
      const unit = { id: TEST_UNIT_ID, unitname: 'Kira' };
      unitsRepository.findOneOrFail.mockResolvedValue(unit);

      await expect(service.me(TEST_UNIT_ID)).resolves.toEqual(unit);
    });
  });

  describe('getBlockStatus', () => {
    it('includes final investigation fields', async () => {
      const lockedAt = new Date('2026-08-17T12:00:00.000Z');
      unitsRepository.findOne.mockResolvedValue({
        id: TEST_UNIT_ID,
        isBlocked: true,
        blockedAt: lockedAt,
        blockingAssessmentId: 'report-1',
        finalInvestigationAt: lockedAt,
        replicantStrikeCount: 4,
      });

      await expect(service.getBlockStatus(TEST_UNIT_ID)).resolves.toEqual({
        isBlocked: true,
        blockedAt: lockedAt,
        blockingAssessmentId: 'report-1',
        finalInvestigationAt: lockedAt,
        replicantStrikeCount: 4,
      });
    });
  });

  describe('create', () => {
    it('creates a new unit when unitname is free', async () => {
      unitsRepository.exists.mockResolvedValue(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const created = {
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        verificationCode: '0123456789abcdef',
        isVerified: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        image: null,
        isLoggedIn: false,
      };
      unitsRepository.create.mockReturnValue(created);
      unitsRepository.save.mockResolvedValue(created);

      const result = await service.create({
        unitname: 'Kira',
        passphrase: 'valid passphrase12',
        securityQuestion: 'what city were you born in',
        securityAnswer: 'Night City!',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('valid passphrase12', 10);
      expect(bcrypt.hash).toHaveBeenCalledWith('night city', 10);
      expect(result).toEqual({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        verificationCode: created.verificationCode,
        isVerified: false,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        image: null,
        isLoggedIn: false,
      });
    });

    it('throws Conflict when unitname already exists', async () => {
      unitsRepository.exists.mockResolvedValue(true);

      await expect(
        service.create({
          unitname: 'Kira',
          passphrase: 'valid passphrase12',
          securityQuestion: 'what city were you born in',
          securityAnswer: 'night city',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('throws Conflict when unitname exists with different casing', async () => {
      unitsRepository.exists.mockImplementation(async (options) => {
        const unitname = options?.where?.unitname;
        if (typeof unitname === 'string') {
          return unitname === 'Kira';
        }
        return true;
      });

      await expect(
        service.create({
          unitname: 'kira',
          passphrase: 'valid passphrase12',
          securityQuestion: 'what city were you born in',
          securityAnswer: 'night city',
        }),
      ).rejects.toThrow(HttpException);
      expect(unitsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyProfile', () => {
    it('verifies profile when code matches', async () => {
      const unit = {
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: false,
        verificationCode: 'code-ok',
        verificationAttempts: 0,
      };
      unitsRepository.findOne.mockResolvedValue(unit);
      unitsRepository.save.mockResolvedValue(unit);

      const result = await service.verifyProfile('Kira', 'code-ok');

      expect(result).toEqual({
        status: 'verified',
        message: 'Profile verified successfully',
        unit: { id: TEST_UNIT_ID, unitname: 'Kira' },
      });
      expect(unit.isVerified).toBe(true);
      expect(unit.verificationCode).toBeNull();
    });

    it('throws NotFoundException when unit is missing', async () => {
      unitsRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyProfile('Missing', 'code')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when already verified', async () => {
      unitsRepository.findOne.mockResolvedValue({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: true,
      });

      await expect(service.verifyProfile('Kira', 'code')).rejects.toThrow(
        ConflictException,
      );
    });

    it('returns retry with remaining attempts on wrong code', async () => {
      const unit = {
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: false,
        verificationCode: 'correct',
        verificationAttempts: 0,
      };
      unitsRepository.findOne.mockResolvedValue(unit);
      unitsRepository.save.mockImplementation(async (value) => value);

      const result = await service.verifyProfile('Kira', 'wrong');

      expect(result.status).toBe('retry');
      expect(result).toEqual(
        expect.objectContaining({
          status: 'retry',
          attemptsRemaining: 2,
        }),
      );
      expect(typeof (result as { code: string }).code).toBe('string');
    });

    it('destroys unit after max failed attempts', async () => {
      const unit = {
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: false,
        verificationCode: 'correct',
        verificationAttempts: 2,
      };
      unitsRepository.findOne.mockResolvedValue(unit);
      unitsRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.verifyProfile('Kira', 'wrong');

      expect(result).toEqual({ status: 'destroyed' });
      expect(unitsRepository.delete).toHaveBeenCalledWith({ id: TEST_UNIT_ID });
    });
  });

  describe('findOpenedSessionAndDelete', () => {
    it('delegates to sessionService when unit exists', async () => {
      unitsRepository.exists.mockResolvedValue(true);
      sessionService.deleteAndCreateNew.mockResolvedValue({
        id: TEST_NEW_SESSION_ID,
      });

      const result = await service.findOpenedSessionAndDelete(
        TEST_SESSION_ID,
        TEST_UNIT_ID,
      );

      expect(sessionService.deleteAndCreateNew).toHaveBeenCalledWith(
        TEST_SESSION_ID,
        TEST_UNIT_ID,
      );
      expect(result).toEqual({ id: TEST_NEW_SESSION_ID });
    });

    it('throws UnauthorizedException when unit is missing', async () => {
      unitsRepository.exists.mockResolvedValue(false);

      await expect(
        service.findOpenedSessionAndDelete(TEST_SESSION_ID, TEST_UNIT_ID),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createSession', () => {
    it('creates a session via sessionService', async () => {
      const session = { id: TEST_SESSION_ID };
      sessionService.create.mockResolvedValue(session);

      const result = await service.createSession(
        TEST_UNIT_ID,
        {} as EntityManager,
      );

      expect(sessionService.create).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(result).toEqual(session);
    });
  });

  describe('update', () => {
    it('updates and saves preloaded unit', async () => {
      const unit = { id: TEST_UNIT_ID, unitname: 'Kira' };
      unitsRepository.preload.mockResolvedValue(unit);
      unitsRepository.save.mockResolvedValue(unit);

      const result = await service.update(TEST_UNIT_ID, {
        unitname: 'Kira',
      } as any);

      expect(unitsRepository.preload).toHaveBeenCalledWith({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
      });
      expect(result).toEqual(unit);
    });

    it('throws NotFoundException when preload returns null', async () => {
      unitsRepository.preload.mockResolvedValue(null);

      await expect(
        service.update(TEST_UNIT_ID, { unitname: 'Kira' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws Conflict when renaming to another unitname with different casing', async () => {
      unitsRepository.exists.mockResolvedValue(true);

      await expect(
        service.update(TEST_UNIT_ID, { unitname: 'kira' } as any),
      ).rejects.toThrow(HttpException);
      expect(unitsRepository.preload).not.toHaveBeenCalled();
    });

    it('allows renaming own unitname to a different casing', async () => {
      unitsRepository.exists.mockResolvedValue(false);
      const unit = { id: TEST_UNIT_ID, unitname: 'bobozak' };
      unitsRepository.preload.mockResolvedValue(unit);
      unitsRepository.save.mockResolvedValue(unit);

      const result = await service.update(TEST_UNIT_ID, {
        unitname: 'bobozak',
      } as any);

      expect(unitsRepository.exists).toHaveBeenCalled();
      expect(result).toEqual(unit);
    });
  });

  describe('logout', () => {
    it('marks unit logged out and closes session', async () => {
      unitsRepository.update.mockResolvedValue({ affected: 1 });
      sessionService.closeSession.mockResolvedValue(undefined);

      const result = await service.logout(TEST_UNIT_ID);

      expect(unitsRepository.update).toHaveBeenCalledWith(TEST_UNIT_ID, {
        isLoggedIn: false,
      });
      expect(sessionService.closeSession).toHaveBeenCalledWith(TEST_UNIT_ID);
      expect(result).toEqual({ message: 'Logout successful' });
    });
  });

  describe('markLoggedIn', () => {
    it('sets isLoggedIn true', async () => {
      unitsRepository.update.mockResolvedValue({ affected: 1 });

      await service.markLoggedIn(TEST_UNIT_ID);

      expect(unitsRepository.update).toHaveBeenCalledWith(TEST_UNIT_ID, {
        isLoggedIn: true,
      });
    });
  });

  describe('deleteMe', () => {
    function makeUnit(
      overrides: {
        securityAnswerFailedAttempts?: number;
        securityAnswerLockedUntil?: Date | null;
      } = {},
    ) {
      return {
        id: TEST_UNIT_ID,
        securityAnswerHash: 'answer-hash',
        securityAnswerFailedAttempts: 0,
        securityAnswerLockedUntil: null as Date | null,
        ...overrides,
      };
    }

    it('deletes the unit after a matching security answer', async () => {
      const unit = makeUnit();
      const deleteResult = { affected: 1 };
      unitsRepository.findOneOrFail.mockResolvedValue(unit);
      unitsRepository.save.mockImplementation(async (value) => ({ ...value }));
      unitsRepository.delete.mockResolvedValue(deleteResult);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.deleteMe(TEST_UNIT_ID, 'Night City!'),
      ).resolves.toEqual(deleteResult);
      expect(unitsRepository.delete).toHaveBeenCalledWith(TEST_UNIT_ID);
    });

    it('does not delete when the security answer is wrong', async () => {
      const unit = makeUnit();
      unitsRepository.findOneOrFail.mockResolvedValue(unit);
      unitsRepository.save.mockImplementation(async (value) => ({ ...value }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.deleteMe(TEST_UNIT_ID, 'wrong answer'),
      ).rejects.toThrow(ForbiddenException);
      expect(unit.securityAnswerFailedAttempts).toBe(1);
      expect(unitsRepository.delete).not.toHaveBeenCalled();
    });

    it('does not delete when the security answer is locked', async () => {
      const unit = makeUnit({
        securityAnswerFailedAttempts: 5,
        securityAnswerLockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });
      unitsRepository.findOneOrFail.mockResolvedValue(unit);

      await expect(
        service.deleteMe(TEST_UNIT_ID, 'night city'),
      ).rejects.toThrow(HttpException);
      expect(unitsRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('uploadImage', () => {
    const file = {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      buffer: Buffer.from('img'),
    } as Express.Multer.File;

    it('uploads image and saves secure_url', async () => {
      unitsRepository.findOneOrFail.mockResolvedValue({
        id: TEST_UNIT_ID,
        image: null,
      });
      cloudinaryService.uploadFile.mockResolvedValue({
        secure_url: 'https://cdn.example/new.png',
      });
      unitsRepository.save.mockImplementation(async (value) => value);

      const result = await service.uploadImage(file, TEST_UNIT_ID);

      expect(cloudinaryService.uploadFile).toHaveBeenCalledWith(file);
      expect(cloudinaryService.deleteFile).not.toHaveBeenCalled();
      expect(result).toEqual({ secure_url: 'https://cdn.example/new.png' });
    });

    it('deletes previous image when one exists', async () => {
      unitsRepository.findOneOrFail.mockResolvedValue({
        id: TEST_UNIT_ID,
        image: 'https://cdn.example/folder/old.png',
      });
      cloudinaryService.uploadFile.mockResolvedValue({
        secure_url: 'https://cdn.example/new.png',
      });
      cloudinaryService.deleteFile.mockResolvedValue({});
      unitsRepository.save.mockImplementation(async (value) => value);

      await service.uploadImage(file, TEST_UNIT_ID);

      expect(cloudinaryService.deleteFile).toHaveBeenCalledWith('old');
    });

    it('throws HttpException when upload has no secure_url', async () => {
      unitsRepository.findOneOrFail.mockResolvedValue({
        id: TEST_UNIT_ID,
        image: null,
      });
      cloudinaryService.uploadFile.mockResolvedValue({});

      await expect(service.uploadImage(file, TEST_UNIT_ID)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('issuePassphraseChangeChallenge', () => {
    const securityAnswer = 'night city';

    function makeUnit(
      overrides: {
        passphraseChangeChallengeCount?: number;
        passphraseChangeChallengeWindowStartedAt?: Date | null;
        securityAnswerFailedAttempts?: number;
        securityAnswerLockedUntil?: Date | null;
      } = {},
    ) {
      return {
        id: TEST_UNIT_ID,
        passphraseChangeCode: null as string | null,
        passphraseChangeCodeExpiresAt: null as Date | null,
        passphraseChangeChallengeCount: 0,
        passphraseChangeChallengeWindowStartedAt: null as Date | null,
        securityAnswerHash: 'answer-hash',
        securityAnswerFailedAttempts: 0,
        securityAnswerLockedUntil: null as Date | null,
        ...overrides,
      };
    }

    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('generates a new non-increasing 16-digit code with 10-minute expiry', async () => {
      unitsRepository.findOneOrFail
        .mockResolvedValueOnce(makeUnit())
        .mockResolvedValueOnce(makeUnit());
      unitsRepository.save.mockImplementation(async (value) => ({ ...value }));

      const first = await service.issuePassphraseChangeChallenge(
        TEST_UNIT_ID,
        securityAnswer,
      );
      const second = await service.issuePassphraseChangeChallenge(
        TEST_UNIT_ID,
        securityAnswer,
      );

      expect(first.digits).toHaveLength(16);
      expect(second.digits).toHaveLength(16);
      expect(isNonIncreasingDigitSequence(first.digits)).toBe(true);
      expect(isNonIncreasingDigitSequence(second.digits)).toBe(true);
      expect(new Set(first.digits).size).toBeGreaterThanOrEqual(8);
      expect(new Set(second.digits).size).toBeGreaterThanOrEqual(8);
      expect(first.digits).not.toBe(second.digits);

      const ttlMs = first.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(9 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);

      expect(unitsRepository.save).toHaveBeenCalledTimes(4);
      expect(unitsRepository.save.mock.calls[1][0].passphraseChangeCode).toBe(
        first.digits,
      );
      expect(unitsRepository.save.mock.calls[3][0].passphraseChangeCode).toBe(
        second.digits,
      );
      expect(
        unitsRepository.save.mock.calls[1][0].passphraseChangeChallengeCount,
      ).toBe(1);
      expect(
        unitsRepository.save.mock.calls[3][0].passphraseChangeChallengeCount,
      ).toBe(1);
    });

    it('allows 3 challenges within 60 minutes and rejects the 4th', async () => {
      const unit = makeUnit();
      unitsRepository.findOneOrFail.mockResolvedValue(unit);
      unitsRepository.save.mockImplementation(async (value) => ({ ...value }));

      await service.issuePassphraseChangeChallenge(
        TEST_UNIT_ID,
        securityAnswer,
      );
      await service.issuePassphraseChangeChallenge(
        TEST_UNIT_ID,
        securityAnswer,
      );
      await service.issuePassphraseChangeChallenge(
        TEST_UNIT_ID,
        securityAnswer,
      );

      await expect(
        service.issuePassphraseChangeChallenge(TEST_UNIT_ID, securityAnswer),
      ).rejects.toThrow('Digit challenge limit reached. Try again later.');
      expect(unitsRepository.save).toHaveBeenCalledTimes(7);
      expect(unit.passphraseChangeChallengeCount).toBe(3);
    });

    it('resets the window after 60 minutes and issues a new challenge', async () => {
      const unit = makeUnit({
        passphraseChangeChallengeCount: 3,
        passphraseChangeChallengeWindowStartedAt: new Date(
          Date.now() - 60 * 60 * 1000 - 1,
        ),
      });
      unitsRepository.findOneOrFail.mockResolvedValue(unit);
      unitsRepository.save.mockImplementation(async (value) => ({ ...value }));

      const result = await service.issuePassphraseChangeChallenge(
        TEST_UNIT_ID,
        securityAnswer,
      );

      expect(result.digits).toHaveLength(16);
      expect(isNonIncreasingDigitSequence(result.digits)).toBe(true);
      expect(unit.passphraseChangeChallengeCount).toBe(1);
      expect(
        unit.passphraseChangeChallengeWindowStartedAt?.getTime(),
      ).toBeGreaterThan(Date.now() - 2000);
      expect(unitsRepository.save).toHaveBeenCalledTimes(2);
    });

    it('rejects a wrong security answer without issuing digits', async () => {
      const unit = makeUnit();
      unitsRepository.findOneOrFail.mockResolvedValue(unit);
      unitsRepository.save.mockImplementation(async (value) => ({ ...value }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.issuePassphraseChangeChallenge(TEST_UNIT_ID, 'wrong answer'),
      ).rejects.toThrow(ForbiddenException);
      expect(unit.securityAnswerFailedAttempts).toBe(1);
      expect(unit.passphraseChangeCode).toBeNull();
    });

    it('locks after 5 wrong answers', async () => {
      const unit = makeUnit();
      unitsRepository.findOneOrFail.mockResolvedValue(unit);
      unitsRepository.save.mockImplementation(async (value) => ({ ...value }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.issuePassphraseChangeChallenge(TEST_UNIT_ID, 'wrong answer'),
        ).rejects.toThrow(ForbiddenException);
      }

      await expect(
        service.issuePassphraseChangeChallenge(TEST_UNIT_ID, 'wrong answer'),
      ).rejects.toThrow('Too many failed attempts');
      expect(unit.securityAnswerFailedAttempts).toBe(5);
      expect(unit.securityAnswerLockedUntil).toBeInstanceOf(Date);
    });
  });

  describe('changePassphrase', () => {
    const baseUnit = {
      id: TEST_UNIT_ID,
      unitname: 'Kira',
      passphrase: 'hashed-passphrase',
      passphraseChangeCode: '9876543210000000',
      passphraseChangeCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };

    const validDto: ChangePassphraseDto = {
      currentPassphrase: 'old passphrase12',
      digitSequence: '9876543210000000',
      newPassphrase: 'new passphrase12',
    };

    it('updates passphrase and clears challenge on success', async () => {
      unitsRepository.findOne.mockResolvedValue({ ...baseUnit });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      unitsRepository.save.mockImplementation(async (value) => value);

      const result = await service.changePassphrase(TEST_UNIT_ID, validDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(validDto.newPassphrase, 10);
      expect(result).toEqual({ id: TEST_UNIT_ID, unitname: 'Kira' });

      const savedUnit = unitsRepository.save.mock.calls[0][0];
      expect(savedUnit.passphrase).toBe('new-hash');
      expect(savedUnit.passphraseChangeCode).toBeNull();
      expect(savedUnit.passphraseChangeCodeExpiresAt).toBeNull();
    });

    it('throws UnauthorizedException for invalid current passphrase', async () => {
      unitsRepository.findOne.mockResolvedValue({ ...baseUnit });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassphrase(TEST_UNIT_ID, validDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException when challenge is missing or expired', async () => {
      unitsRepository.findOne.mockResolvedValue({
        ...baseUnit,
        passphraseChangeCode: null,
        passphraseChangeCodeExpiresAt: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassphrase(TEST_UNIT_ID, validDto),
      ).rejects.toThrow(BadRequestException);

      unitsRepository.findOne.mockResolvedValue({
        ...baseUnit,
        passphraseChangeCodeExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.changePassphrase(TEST_UNIT_ID, validDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid digit sequence', async () => {
      unitsRepository.findOne.mockResolvedValue({ ...baseUnit });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassphrase(TEST_UNIT_ID, {
          ...validDto,
          digitSequence: '1111111111111111',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when new passphrase matches current', async () => {
      unitsRepository.findOne.mockResolvedValue({ ...baseUnit });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassphrase(TEST_UNIT_ID, {
          ...validDto,
          newPassphrase: validDto.currentPassphrase,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('issueResetRound1Challenge', () => {
    const securityAnswer = 'night city';

    it('generates a new code and clears previous reset state', async () => {
      const unit = {
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: true,
        securityAnswerHash: 'answer-hash',
        securityAnswerFailedAttempts: 0,
        securityAnswerLockedUntil: null,
        passphraseResetRound1VerifiedAt: new Date(),
        passphraseResetRound2Code: '1111111111111111',
        passphraseResetRound2ExpiresAt: new Date(),
      };

      unitsRepository.findOne.mockResolvedValue({ ...unit });
      unitsRepository.save.mockImplementation(async (value) => ({ ...value }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.issueResetRound1Challenge(
        'Kira',
        securityAnswer,
      );

      expect(result.digits).toHaveLength(16);
      expect(
        unitsRepository.save.mock.calls[1][0].passphraseResetRound1Code,
      ).toBe(result.digits);
      expect(
        unitsRepository.save.mock.calls[1][0].passphraseResetRound1VerifiedAt,
      ).toBeNull();
      expect(
        unitsRepository.save.mock.calls[1][0].passphraseResetRound2Code,
      ).toBeNull();
    });

    it('throws NotFoundException when unit does not exist', async () => {
      unitsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.issueResetRound1Challenge('Missing', 'night city'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when profile is not verified', async () => {
      unitsRepository.findOne.mockResolvedValue({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: false,
      });

      await expect(
        service.issueResetRound1Challenge('Kira', 'night city'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verifyResetRound1', () => {
    const round1Code = '9817654321000000';

    it('returns round 2 digits on success', async () => {
      unitsRepository.findOne.mockResolvedValue({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: true,
        passphraseResetRound1Code: round1Code,
        passphraseResetRound1ExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      unitsRepository.save.mockImplementation(async (value) => ({ ...value }));

      const result = await service.verifyResetRound1(
        'Kira',
        buildResetRound1ExpectedSequence(round1Code),
      );

      expect(result.digits).toHaveLength(16);
      expect(
        unitsRepository.save.mock.calls[0][0].passphraseResetRound1VerifiedAt,
      ).toBeInstanceOf(Date);
      expect(
        unitsRepository.save.mock.calls[0][0].passphraseResetRound2Code,
      ).toBe(result.digits);
    });

    it('throws BadRequestException for invalid digit sequence', async () => {
      unitsRepository.findOne.mockResolvedValue({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: true,
        passphraseResetRound1Code: round1Code,
        passphraseResetRound1ExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(
        service.verifyResetRound1('Kira', '1111111111111111'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects the previous even-then-odd position sequence', async () => {
      unitsRepository.findOne.mockResolvedValue({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: true,
        passphraseResetRound1Code: round1Code,
        passphraseResetRound1ExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(
        service.verifyResetRound1('Kira', '8753100091642000'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassphrase', () => {
    const round2Code = '5432109876543210';

    it('updates passphrase and clears reset fields on success', async () => {
      unitsRepository.findOne.mockResolvedValue({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: true,
        passphraseResetRound1VerifiedAt: new Date(),
        passphraseResetRound1ExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        passphraseResetRound2Code: round2Code,
        passphraseResetRound2ExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      unitsRepository.save.mockImplementation(async (value) => value);

      const result = await service.resetPassphrase('Kira', 'new passphrase12');

      expect(result).toEqual({ id: TEST_UNIT_ID, unitname: 'Kira' });
      const savedUnit = unitsRepository.save.mock.calls[0][0];
      expect(savedUnit.passphrase).toBe('new-hash');
      expect(savedUnit.passphraseResetRound1Code).toBeNull();
      expect(savedUnit.passphraseResetRound2Code).toBeNull();
    });

    it('throws BadRequestException when reset session is incomplete', async () => {
      unitsRepository.findOne.mockResolvedValue({
        id: TEST_UNIT_ID,
        unitname: 'Kira',
        isVerified: true,
        passphraseResetRound1VerifiedAt: null,
        passphraseResetRound1ExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        passphraseResetRound2Code: round2Code,
        passphraseResetRound2ExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(
        service.resetPassphrase('Kira', 'new passphrase12'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
