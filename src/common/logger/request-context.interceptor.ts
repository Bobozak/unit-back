import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { bindRequestUnit } from './request-context';

type RequestWithUnit = {
  unit?: { id?: string; sub?: string };
};

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUnit>();
    bindRequestUnit(request.unit?.id ?? request.unit?.sub);

    return next.handle();
  }
}
