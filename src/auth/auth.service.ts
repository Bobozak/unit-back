import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UnitsService } from 'src/units/units.service';
import { DataSource } from 'typeorm';

import { UnitEntity } from '@/units/entities/unit.entity';

@Injectable()
export class AuthService {
  constructor(
    private unitsService: UnitsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private datasource: DataSource,
  ) {}

  async validateUnit(unitname: string, passphrase: string): Promise<any> {
    const unit = await this.unitsService.findOneByParams({
      unitname,
    });

    if (!unit.passphrase) {
      throw new BadRequestException('Passphrase is required');
    }

    if (!unit.isVerified) {
      throw new ForbiddenException('Profile not verified');
    }

    if (unit && (await bcrypt.compare(passphrase, unit.passphrase))) {
      return unit;
    }
    return null;
  }

  async login(unit: any) {
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const manager = queryRunner.manager;
      const normUnit: UnitEntity = unit.unit ? unit.unit : unit;

      normUnit.isLoggedIn = true;

      const savedUnitId = await this.unitsService.saveUnit(normUnit, manager);

      const session = await this.unitsService.createSession(
        savedUnitId,
        manager,
      );

      await queryRunner.commitTransaction();

      const { accessToken, refreshToken } = await this.issueSessionTokens(
        unit.unitname,
        unit.id,
        session.id,
      );

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async refreshToken(unit: any, previousRefreshToken: string) {
    const payload = await this.jwtService.verifyAsync(previousRefreshToken, {
      secret: this.configService.get<string>('REFRESH_JWT_SECRET'),
    });

    const now = Math.floor(Date.now() / 1000);

    if (!payload) {
      throw new UnauthorizedException('invalid token');
    }

    await this.unitsService.findOneForRefreshToken(payload.unitname);

    if (payload.exp < now) {
      await this.unitsService.logout(payload.sub);
      throw new UnauthorizedException('invalid token');
    }
    const sessionId = payload.sessionId;

    const newSession = await this.unitsService.findOpenedSessionAndDelete(
      sessionId,
      unit.sub,
    );

    const { accessToken, refreshToken } = await this.issueSessionTokens(
      payload.unitname,
      payload.sub,
      newSession.id,
    );

    return { accessToken, refreshToken };
  }

  async issueSessionTokens(unitname: string, id: string, sessionId: string) {
    const payload = { unitname, sub: id, sessionId };

    const [accessToken, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(payload),

      await this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret: this.configService.get<string>('REFRESH_JWT_SECRET'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
