import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import {
  buildHttpAccessLog,
  httpLogLevel,
  shouldSkipHttpLog,
} from '../logger/http-log';
import {
  requestContext,
  RequestLogContext,
  resolveRequestId,
} from '../logger/request-context';

type RequestWithUnit = Request & {
  unit?: { id?: string; sub?: string };
};

@Injectable()
export class AppLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: RequestWithUnit, response: Response, next: NextFunction): void {
    const requestId = resolveRequestId(request.get('x-request-id'));
    const store: RequestLogContext = { requestId };
    response.setHeader('X-Request-Id', requestId);

    requestContext.run(store, () => {
      const startedAt = process.hrtime.bigint();

      response.on('finish', () => {
        const originalUrl = request.originalUrl || request.url;
        if (shouldSkipHttpLog(originalUrl)) {
          return;
        }

        const unitId = store.unitId ?? request.unit?.id ?? request.unit?.sub;
        if (unitId) {
          store.unitId = unitId;
        }

        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const contentLength = response.get('content-length');
        const payload = buildHttpAccessLog({
          requestId,
          method: request.method,
          originalUrl,
          statusCode: response.statusCode,
          durationMs,
          contentLength: contentLength ? Number(contentLength) : undefined,
          ip: request.ip,
          userAgent: request.get('user-agent'),
          unitId,
        });
        const level = httpLogLevel(payload.statusCode, payload.durationMs);
        if (level === 'error') {
          this.logger.error(payload);
        } else if (level === 'warn') {
          this.logger.warn(payload);
        } else {
          this.logger.log(payload);
        }
      });

      next();
    });
  }
}
