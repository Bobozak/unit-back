import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable } from 'rxjs';

@Injectable()
export class DatesErrorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const match = error.message.match(
          /invalid input syntax for type timestamp/,
        );
        if (error.name === 'QueryFailedError' && match) {
          throw new HttpException(
            'Incorrect Date format',
            HttpStatus.BAD_REQUEST,
          );
        }

        throw error;
      }),
    );
  }
}
