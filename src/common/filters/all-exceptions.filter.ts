import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

import { sanitizePath } from '../logger/http-log';
import { redactText } from '../logger/redact';

type HttpRequestLog = {
  method?: string;
  originalUrl?: string;
};

@Catch()
export class AllExceptionsFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http' && exception instanceof HttpException) {
      this.logHttpException(exception, host);
    }

    super.catch(exception, host);
  }

  private logHttpException(
    exception: HttpException,
    host: ArgumentsHost,
  ): void {
    const statusCode = exception.getStatus();
    const payload = {
      message: httpExceptionMessage(exception),
      statusCode,
      error: exception.name,
      ...requestFields(host),
    };

    if (statusCode >= 500) {
      this.logger.error(payload, exception.stack);
      return;
    }

    this.logger.warn(payload);
  }
}

function httpExceptionMessage(exception: HttpException): string {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return redactText(response);
  }

  if (response && typeof response === 'object' && 'message' in response) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string') {
      return redactText(message);
    }

    if (Array.isArray(message)) {
      return redactText(message.map((item) => String(item)).join('; '));
    }
  }

  return redactText(exception.message);
}

function requestFields(host: ArgumentsHost): {
  method?: string;
  path?: string;
} {
  const request = host.switchToHttp().getRequest<HttpRequestLog>();
  const path = request?.originalUrl
    ? sanitizePath(request.originalUrl)
    : undefined;

  return {
    method: request?.method,
    path,
  };
}
