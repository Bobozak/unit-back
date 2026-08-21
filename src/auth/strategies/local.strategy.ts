import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { EntityNotFoundError } from 'typeorm';

import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'unitname',
      passwordField: 'passphrase',
      passReqToCallback: true,
    });
  }

  async validate(req: any, unitname: string, passphrase: string): Promise<any> {
    try {
      const unit = await this.authService.validateUnit(unitname, passphrase);
      if (!unit) {
        throw new UnauthorizedException();
      }
      req.unit = unit;
      return unit;
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw new UnauthorizedException('Unit not found');
      }
      throw error;
    }
  }
}
