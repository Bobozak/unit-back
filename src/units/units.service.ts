import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { addMinutes } from 'date-fns';
import {
  DeepPartial,
  EntityManager,
  FindOneOptions,
  IsNull,
  Not,
  Raw,
  Repository,
} from 'typeorm';

import { ChangePassphraseDto } from '@/auth/dto/change-passphrase.dto';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { buildResetRound1ExpectedSequence } from '@/common/helpers/build-reset-digit-sequence';
import { generatePassphraseChangeCode } from '@/common/helpers/generate-passphrase-change-code';
import { generatePassphraseResetCode } from '@/common/helpers/generate-passphrase-reset-code';
import { generateVerificationCode } from '@/common/helpers/generate-verification-code';
import { normalizeSecurityAnswer } from '@/common/helpers/normalize-security-answer';
import { publicIdExtract } from '@/common/helpers/pudlic-id.extraction';
import { SessionService } from '@/session/session.service';

import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitEntity } from './entities/unit.entity';

const RESET_PASSPHRASE_SELECT = [
  'id',
  'unitname',
  'isVerified',
  'passphrase',
  'securityQuestion',
  'securityAnswerHash',
  'securityAnswerFailedAttempts',
  'securityAnswerLockedUntil',
  'passphraseResetRound1Code',
  'passphraseResetRound1ExpiresAt',
  'passphraseResetRound1VerifiedAt',
  'passphraseResetRound2Code',
  'passphraseResetRound2ExpiresAt',
] as const;

const PASSPHRASE_CHANGE_CHALLENGE_LIMIT = 3;
const PASSPHRASE_CHANGE_CHALLENGE_WINDOW_MS = 60 * 60 * 1000;
const SECURITY_ANSWER_MAX_ATTEMPTS = 5;
const SECURITY_ANSWER_LOCK_MS = 15 * 60 * 1000;

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(UnitEntity)
    private unitsRepository: Repository<UnitEntity>,
    private cloudinaryService: CloudinaryService,
    readonly sessionService: SessionService,
  ) {}

  async saveUnit(unit: UnitEntity, manager: EntityManager) {
    const savedUnit = await manager.save(unit);
    return savedUnit.id;
  }

  async findOneByParams(
    params: Record<string, string | number | boolean>,
    relations?: string[],
  ): Promise<UnitEntity> {
    const queryOptions: FindOneOptions<UnitEntity> = {
      where: params,
      relations: relations,
    };
    const unit = await this.unitsRepository.findOneOrFail(queryOptions);

    return unit;
  }

  async findOneForRefreshToken(unitname: string) {
    const exists = await this.unitsRepository.exists({
      where: { unitname, deletedAt: IsNull(), isVerified: true },
    });

    if (!exists) {
      throw new UnauthorizedException('invalid token');
    }
  }

  async me(unitId: string): Promise<DeepPartial<UnitEntity>> {
    const me = await this.findOneByParams({ id: unitId });
    return me;
  }

  async getBlockStatus(unitId: string): Promise<{
    isBlocked: boolean;
    blockedAt: Date | null;
    blockingAssessmentId: string | null;
    finalInvestigationAt: Date | null;
    replicantStrikeCount: number;
  }> {
    const unit = await this.unitsRepository.findOne({
      where: { id: unitId },
      select: [
        'id',
        'isBlocked',
        'blockedAt',
        'blockingAssessmentId',
        'finalInvestigationAt',
        'replicantStrikeCount',
      ],
    });

    if (!unit) {
      throw new UnauthorizedException('Unit not found');
    }

    return {
      isBlocked: unit.isBlocked,
      blockedAt: unit.blockedAt,
      blockingAssessmentId: unit.blockingAssessmentId,
      finalInvestigationAt: unit.finalInvestigationAt ?? null,
      replicantStrikeCount: unit.replicantStrikeCount ?? 0,
    };
  }

  async checkUnitnameAvailable(unitname: string) {
    return { available: !(await this.isUnitnameTaken(unitname)) };
  }

  async create(createUnitDto: CreateUnitDto) {
    const { passphrase, unitname, securityQuestion, securityAnswer } =
      createUnitDto;

    if (await this.isUnitnameTaken(unitname)) {
      throw new HttpException('Unitname already exists', HttpStatus.CONFLICT);
    }

    const normalizedAnswer = normalizeSecurityAnswer(securityAnswer);
    const [passphraseHash, securityAnswerHash] = await Promise.all([
      bcrypt.hash(passphrase, 10),
      bcrypt.hash(normalizedAnswer, 10),
    ]);

    const unit = this.unitsRepository.create({
      unitname,
      passphrase: passphraseHash,
      securityQuestion: securityQuestion.trim().toLowerCase(),
      securityAnswerHash,
      verificationCode: generateVerificationCode(),
      isVerified: false,
      verifiedAt: null,
    });

    const savedUnit = await this.unitsRepository.save(unit);

    return {
      id: savedUnit.id,
      unitname: savedUnit.unitname,
      verificationCode: savedUnit.verificationCode,
      isVerified: savedUnit.isVerified,
      createdAt: savedUnit.createdAt,
      updatedAt: savedUnit.updatedAt,
      image: savedUnit.image,
      isLoggedIn: savedUnit.isLoggedIn,
    };
  }

  async verifyProfile(unitname: string, code: string) {
    const MAX_VERIFICATION_ATTEMPTS = 3;

    const unit = await this.unitsRepository.findOne({
      where: { unitname },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    if (unit.isVerified) {
      throw new ConflictException('Profile already verified');
    }

    if (unit.verificationCode === code) {
      unit.isVerified = true;
      unit.verifiedAt = new Date().toISOString();
      unit.verificationCode = null;
      await this.unitsRepository.save(unit);

      return {
        status: 'verified' as const,
        message: 'Profile verified successfully',
        unit: {
          id: unit.id,
          unitname: unit.unitname,
        },
      };
    }

    unit.verificationAttempts += 1;

    if (unit.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      await this.unitsRepository.delete({ id: unit.id });
      return { status: 'destroyed' as const };
    }

    unit.verificationCode = generateVerificationCode();
    await this.unitsRepository.save(unit);

    return {
      status: 'retry' as const,
      code: unit.verificationCode,
      attemptsRemaining: MAX_VERIFICATION_ATTEMPTS - unit.verificationAttempts,
    };
  }

  async findOpenedSessionAndDelete(id: string, unitId: string) {
    const unit = await this.unitsRepository.exists({ where: { id: unitId } });
    if (!unit) {
      throw new UnauthorizedException('Unit not found');
    }
    return await this.sessionService.deleteAndCreateNew(id, unitId);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async createSession(unitId: string, manager: EntityManager) {
    const session = await this.sessionService.create(unitId);

    return session;
  }

  async update(id: string, updateUnitDto: UpdateUnitDto) {
    if (
      updateUnitDto.unitname &&
      (await this.isUnitnameTaken(updateUnitDto.unitname, id))
    ) {
      throw new HttpException('Unitname already exists', HttpStatus.CONFLICT);
    }

    const unit = await this.unitsRepository.preload({
      id,
      ...updateUnitDto,
    });

    if (!unit) {
      throw new NotFoundException(`Unit with id ${id} not found`);
    }

    return await this.unitsRepository.save(unit);
  }

  async logout(id: string) {
    await Promise.all([
      this.unitsRepository.update(id, { isLoggedIn: false }),
      this.sessionService.closeSession(id),
    ]);

    return { message: 'Logout successful' };
  }

  async getSecurityQuestion(unitId: string) {
    const unit = await this.unitsRepository.findOneOrFail({
      where: { id: unitId },
      select: ['id', 'securityQuestion'],
    });

    return { question: unit.securityQuestion };
  }

  async getSecurityQuestionForReset(unitname: string) {
    const unit = await this.findVerifiedUnitForReset(unitname);
    return { question: unit.securityQuestion };
  }

  async issuePassphraseChangeChallenge(unitId: string, securityAnswer: string) {
    const unit = await this.unitsRepository.findOneOrFail({
      where: { id: unitId },
      select: [
        'id',
        'securityAnswerHash',
        'securityAnswerFailedAttempts',
        'securityAnswerLockedUntil',
        'passphraseChangeCode',
        'passphraseChangeCodeExpiresAt',
        'passphraseChangeChallengeCount',
        'passphraseChangeChallengeWindowStartedAt',
      ],
    });

    await this.assertSecurityAnswer(unit, securityAnswer);

    const now = new Date();
    const windowStartedAt = unit.passphraseChangeChallengeWindowStartedAt;
    const windowExpired =
      !windowStartedAt ||
      now.getTime() - windowStartedAt.getTime() >=
        PASSPHRASE_CHANGE_CHALLENGE_WINDOW_MS;

    if (windowExpired) {
      unit.passphraseChangeChallengeCount = 0;
      unit.passphraseChangeChallengeWindowStartedAt = now;
    } else {
      unit.passphraseChangeChallengeCount =
        unit.passphraseChangeChallengeCount ?? 0;
    }

    if (
      unit.passphraseChangeChallengeCount >= PASSPHRASE_CHANGE_CHALLENGE_LIMIT
    ) {
      throw new BadRequestException(
        'Digit challenge limit reached. Try again later.',
      );
    }

    const code = generatePassphraseChangeCode();
    const expiresAt = addMinutes(now, 10);

    unit.passphraseChangeCode = code;
    unit.passphraseChangeCodeExpiresAt = expiresAt;
    unit.passphraseChangeChallengeCount += 1;

    await this.unitsRepository.save(unit);

    return { digits: code, expiresAt };
  }

  async changePassphrase(unitId: string, dto: ChangePassphraseDto) {
    const unit = await this.unitsRepository.findOne({
      where: { id: unitId },
      select: [
        'id',
        'unitname',
        'passphrase',
        'passphraseChangeCode',
        'passphraseChangeCodeExpiresAt',
      ],
    });

    if (!unit) {
      throw new NotFoundException(`Unit with id ${unitId} not found`);
    }

    const isCurrentPassphraseValid = await bcrypt.compare(
      dto.currentPassphrase,
      unit.passphrase,
    );

    if (!isCurrentPassphraseValid) {
      throw new UnauthorizedException('Invalid current passphrase');
    }

    if (
      !unit.passphraseChangeCode ||
      !unit.passphraseChangeCodeExpiresAt ||
      unit.passphraseChangeCodeExpiresAt <= new Date()
    ) {
      throw new BadRequestException('Challenge expired or missing');
    }

    if (dto.digitSequence !== unit.passphraseChangeCode) {
      throw new BadRequestException('Invalid digit sequence');
    }

    if (dto.currentPassphrase === dto.newPassphrase) {
      throw new BadRequestException(
        'New passphrase must differ from current passphrase',
      );
    }

    unit.passphrase = await bcrypt.hash(dto.newPassphrase, 10);
    unit.passphraseChangeCode = null;
    unit.passphraseChangeCodeExpiresAt = null;

    await this.unitsRepository.save(unit);

    return { id: unit.id, unitname: unit.unitname };
  }

  async markLoggedIn(unitId: string) {
    await this.unitsRepository.update(unitId, { isLoggedIn: true });
  }

  async issueResetRound1Challenge(unitname: string, securityAnswer: string) {
    const unit = await this.findVerifiedUnitForReset(unitname);
    await this.assertSecurityAnswer(unit, securityAnswer);
    const code = generatePassphraseResetCode();
    const expiresAt = addMinutes(new Date(), 10);

    unit.passphraseResetRound1Code = code;
    unit.passphraseResetRound1ExpiresAt = expiresAt;
    unit.passphraseResetRound1VerifiedAt = null;
    unit.passphraseResetRound2Code = null;
    unit.passphraseResetRound2ExpiresAt = null;

    await this.unitsRepository.save(unit);

    return { digits: code, expiresAt };
  }

  async verifyResetRound1(unitname: string, digitSequence: string) {
    const unit = await this.findVerifiedUnitForReset(unitname);

    if (
      !unit.passphraseResetRound1Code ||
      !unit.passphraseResetRound1ExpiresAt ||
      unit.passphraseResetRound1ExpiresAt <= new Date()
    ) {
      throw new BadRequestException('Challenge expired or missing');
    }

    const expectedSequence = buildResetRound1ExpectedSequence(
      unit.passphraseResetRound1Code,
    );

    if (digitSequence !== expectedSequence) {
      throw new BadRequestException('Invalid digit sequence');
    }

    const round2Code = generatePassphraseResetCode();
    const expiresAt = addMinutes(new Date(), 10);

    unit.passphraseResetRound1VerifiedAt = new Date();
    unit.passphraseResetRound2Code = round2Code;
    unit.passphraseResetRound2ExpiresAt = expiresAt;

    await this.unitsRepository.save(unit);

    return { digits: round2Code, expiresAt };
  }

  async resetPassphrase(unitname: string, newPassphrase: string) {
    const unit = await this.unitsRepository.findOne({
      where: { unitname },
      select: [...RESET_PASSPHRASE_SELECT],
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    if (!unit.isVerified) {
      throw new ForbiddenException('Profile not verified');
    }

    if (
      !unit.passphraseResetRound1VerifiedAt ||
      !unit.passphraseResetRound1ExpiresAt ||
      unit.passphraseResetRound1ExpiresAt <= new Date()
    ) {
      throw new BadRequestException('Reset session expired or incomplete');
    }

    if (
      !unit.passphraseResetRound2Code ||
      !unit.passphraseResetRound2ExpiresAt ||
      unit.passphraseResetRound2ExpiresAt <= new Date()
    ) {
      throw new BadRequestException('Challenge expired or missing');
    }

    unit.passphrase = await bcrypt.hash(newPassphrase, 10);
    unit.passphraseResetRound1Code = null;
    unit.passphraseResetRound1ExpiresAt = null;
    unit.passphraseResetRound1VerifiedAt = null;
    unit.passphraseResetRound2Code = null;
    unit.passphraseResetRound2ExpiresAt = null;

    await this.unitsRepository.save(unit);

    return { id: unit.id, unitname: unit.unitname };
  }

  private async assertSecurityAnswer(unit: UnitEntity, answer: string) {
    const now = new Date();

    if (
      unit.securityAnswerLockedUntil &&
      unit.securityAnswerLockedUntil > now
    ) {
      throw new HttpException(
        `Too many failed attempts. Try again after ${unit.securityAnswerLockedUntil.toISOString()}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      unit.securityAnswerLockedUntil &&
      unit.securityAnswerLockedUntil <= now
    ) {
      unit.securityAnswerFailedAttempts = 0;
      unit.securityAnswerLockedUntil = null;
    }

    const normalized = normalizeSecurityAnswer(answer);
    const matches = await bcrypt.compare(normalized, unit.securityAnswerHash);

    if (matches) {
      unit.securityAnswerFailedAttempts = 0;
      unit.securityAnswerLockedUntil = null;
      await this.unitsRepository.save(unit);
      return;
    }

    unit.securityAnswerFailedAttempts =
      (unit.securityAnswerFailedAttempts ?? 0) + 1;

    if (unit.securityAnswerFailedAttempts >= SECURITY_ANSWER_MAX_ATTEMPTS) {
      unit.securityAnswerLockedUntil = new Date(
        now.getTime() + SECURITY_ANSWER_LOCK_MS,
      );
    }

    await this.unitsRepository.save(unit);

    throw new ForbiddenException('Invalid security answer');
  }

  private async findVerifiedUnitForReset(unitname: string) {
    const unit = await this.unitsRepository.findOne({
      where: { unitname },
      select: [...RESET_PASSPHRASE_SELECT],
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    if (!unit.isVerified) {
      throw new ForbiddenException('Profile not verified');
    }

    return unit;
  }

  private async isUnitnameTaken(unitname: string, excludeId?: string) {
    return this.unitsRepository.exists({
      where: {
        unitname: Raw((alias) => `LOWER(${alias}) = LOWER(:unitname)`, {
          unitname,
        }),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
      withDeleted: true,
    });
  }

  async deleteMe(id: string, securityAnswer: string): Promise<any> {
    const unit = await this.unitsRepository.findOneOrFail({
      where: { id },
      select: [
        'id',
        'securityAnswerHash',
        'securityAnswerFailedAttempts',
        'securityAnswerLockedUntil',
      ],
    });

    await this.assertSecurityAnswer(unit, securityAnswer);

    return this.unitsRepository.delete(id);
  }

  async uploadImage(
    file: Express.Multer.File,
    unitId: string,
  ): Promise<object> {
    const unit = await this.unitsRepository.findOneOrFail({
      where: { id: unitId },
      select: ['id', 'image'],
    });

    const uploadPromise = this.cloudinaryService.uploadFile(file);

    let deletePromise: Promise<any> | null = null;

    if (unit.image) {
      const publicId = publicIdExtract(unit.image);
      deletePromise = this.cloudinaryService.deleteFile(publicId);
    }

    const [uploadResult] = await Promise.all([uploadPromise, deletePromise]);

    const { secure_url } = uploadResult;

    if (!secure_url) {
      throw new HttpException(
        'Error uploading image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    unit.image = secure_url;
    await this.unitsRepository.save(unit);

    return { secure_url };
  }
}
