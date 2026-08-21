import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { UnitsService } from '@/units/units.service';

import { ALLOW_WHEN_BLOCKED_KEY } from '../decorators/allow-when-blocked.decorator';

@Injectable()
export class BlockedUnitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly unitsService: UnitsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowWhenBlocked = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WHEN_BLOCKED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowWhenBlocked) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const unitId = request.unit?.id ?? request.unit?.sub;
    if (!unitId) {
      return true;
    }

    const status = await this.unitsService.getBlockStatus(unitId);
    if (!status.isBlocked) {
      return true;
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'UNIT_BLOCKED',
        blockedAt: status.blockedAt,
        assessmentId: status.blockingAssessmentId,
        finalInvestigationAt: status.finalInvestigationAt,
        replicantStrikeCount: status.replicantStrikeCount,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
