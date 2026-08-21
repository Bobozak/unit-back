import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request as req, Response } from 'express';
import {
  AllowWhenBlocked,
  Public,
  setRefreshTokenCookie,
  Unit,
} from 'src/common';
import { CreateUnitDto } from 'src/units/dto/create-unit.dto';
import { UnitsService } from 'src/units/units.service';

import { SessionService } from '@/session/session.service';

import { AuthService } from './auth.service';
import {
  ChangePassphraseDto,
  ForgotPassphraseRound1ChallengeDto,
  ForgotPassphraseUnitnameDto,
  PassphraseChallengeDto,
  ResetPassphraseDto,
  UnitnameQueryDto,
  VerifyProfileDto,
  VerifyResetRound1Dto,
} from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshJwtAuthGuard } from './guards/jwt-refresh-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import {
  ChangePassphraseDocs,
  ForgotPassphraseResetDocs,
  ForgotPassphraseRound1ChallengeDocs,
  ForgotPassphraseRound1VerifyDocs,
  ForgotPassphraseSecurityQuestionDocs,
  LoginDocs,
  LogoutDocs,
  PassphraseChallengeDocs,
  RefreshTokenDocs,
  RegisterDocs,
  SecurityQuestionDocs,
  UnitnameAvailableDocs,
  VerifyProfileDocs,
} from './swagger-docs';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private unitsService: UnitsService,
    private sessionService: SessionService,
  ) {}

  @UseGuards(LocalAuthGuard)
  @Public()
  @LoginDocs()
  @Post('login')
  async login(
    @Unit() unit: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(unit);

    setRefreshTokenCookie(response, refreshToken);

    return { accessToken };
  }

  @Public()
  @UnitnameAvailableDocs()
  @Get('unitname-available')
  checkUnitnameAvailable(@Query() query: UnitnameQueryDto) {
    return this.unitsService.checkUnitnameAvailable(query.unitname);
  }

  @Public()
  @RegisterDocs()
  @Post('register')
  async register(@Body() createUnitDto: CreateUnitDto) {
    return await this.unitsService.create(createUnitDto);
  }

  @Public()
  @VerifyProfileDocs()
  @Post('verify')
  async verify(
    @Body() verifyProfileDto: VerifyProfileDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.unitsService.verifyProfile(
      verifyProfileDto.unitname,
      verifyProfileDto.code,
    );

    if (result.status !== 'verified') {
      return result;
    }

    const session = await this.sessionService.create(result.unit.id);

    const { accessToken, refreshToken } =
      await this.authService.issueSessionTokens(
        result.unit.unitname,
        result.unit.id,
        session.id,
      );

    await this.unitsService.markLoggedIn(result.unit.id);

    setRefreshTokenCookie(response, refreshToken);

    return {
      status: result.status,
      message: result.message,
      accessToken,
    };
  }

  @Public()
  @ForgotPassphraseSecurityQuestionDocs()
  @Post('forgot-passphrase/security-question')
  getForgotSecurityQuestion(@Body() dto: ForgotPassphraseUnitnameDto) {
    return this.unitsService.getSecurityQuestionForReset(dto.unitname);
  }

  @Public()
  @ForgotPassphraseRound1ChallengeDocs()
  @Post('forgot-passphrase/round-1/challenge')
  issueResetRound1Challenge(@Body() dto: ForgotPassphraseRound1ChallengeDto) {
    return this.unitsService.issueResetRound1Challenge(
      dto.unitname,
      dto.securityAnswer,
    );
  }

  @Public()
  @ForgotPassphraseRound1VerifyDocs()
  @Post('forgot-passphrase/round-1/verify')
  verifyResetRound1(@Body() dto: VerifyResetRound1Dto) {
    return this.unitsService.verifyResetRound1(dto.unitname, dto.digitSequence);
  }

  @Public()
  @ForgotPassphraseResetDocs()
  @Post('forgot-passphrase/reset')
  async resetPassphrase(
    @Body() dto: ResetPassphraseDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const unit = await this.unitsService.resetPassphrase(
      dto.unitname,
      dto.newPassphrase,
    );

    await this.sessionService.closeSession(unit.id);

    const session = await this.sessionService.create(unit.id);

    const { accessToken, refreshToken } =
      await this.authService.issueSessionTokens(
        unit.unitname,
        unit.id,
        session.id,
      );

    await this.unitsService.markLoggedIn(unit.id);

    setRefreshTokenCookie(response, refreshToken);

    return { accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @SecurityQuestionDocs()
  @Get('security-question')
  getSecurityQuestion(@Unit('id') unitId: string) {
    return this.unitsService.getSecurityQuestion(unitId);
  }

  @UseGuards(JwtAuthGuard)
  @PassphraseChallengeDocs()
  @Post('passphrase-challenge')
  issuePassphraseChallenge(
    @Unit('id') unitId: string,
    @Body() dto: PassphraseChallengeDto,
  ) {
    return this.unitsService.issuePassphraseChangeChallenge(
      unitId,
      dto.securityAnswer,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ChangePassphraseDocs()
  @Post('change-passphrase')
  async changePassphrase(
    @Unit('id') unitId: string,
    @Body() changePassphraseDto: ChangePassphraseDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const unit = await this.unitsService.changePassphrase(
      unitId,
      changePassphraseDto,
    );

    await this.sessionService.closeSession(unitId);

    const session = await this.sessionService.create(unitId);

    const { accessToken, refreshToken } =
      await this.authService.issueSessionTokens(
        unit.unitname,
        unit.id,
        session.id,
      );

    await this.unitsService.markLoggedIn(unitId);

    setRefreshTokenCookie(response, refreshToken);

    return { accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @LogoutDocs()
  @Post('logout')
  async logout(
    @Unit('id') unitId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie('refresh_token');
    return this.unitsService.logout(unitId);
  }

  @Public()
  @AllowWhenBlocked()
  @UseGuards(RefreshJwtAuthGuard)
  @RefreshTokenDocs()
  @Post('refresh-token')
  async refreshToken(
    @Request() request: req,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!request.headers.cookie)
      throw new BadRequestException('Cookie is required!');

    const existingRefreshToken = request.headers.cookie
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('refresh_token='))
      ?.split('=')[1];

    if (!existingRefreshToken) {
      throw new BadRequestException('Refresh token cookie is required!');
    }

    const { accessToken, refreshToken } = await this.authService.refreshToken(
      (request as any).unit,
      existingRefreshToken,
    );

    setRefreshTokenCookie(response, refreshToken);

    return { accessToken };
  }
}
