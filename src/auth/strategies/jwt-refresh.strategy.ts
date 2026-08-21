import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtPayload } from '@/common';
import { SessionService } from '@/session/session.service';
import { UnitsService } from '@/units/units.service';

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly unitService: UnitsService,
    private readonly sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: process.env.JWT_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: JwtPayload) {
    if (!payload) throw new UnauthorizedException();

    const nowInSeconds = Date.now() / 1000;
    const payloadExpInSeconds = payload.exp;

    if (nowInSeconds - payloadExpInSeconds >= 2 * 3600) {
      await this.unitService.logout(payload.sub);
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    await this.sessionService.findOneForJwt(payload.sub, payload.sessionId);

    req.unit = payload;
    return payload;
  }
}
