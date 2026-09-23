import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

import { AppLoggerMiddleware } from './logger.middleware';

describe('AppLoggerMiddleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs one structured line and echoes a valid request id', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const middleware = new AppLoggerMiddleware();
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: jest.Mock;
      get: jest.Mock;
    };
    response.statusCode = 401;
    response.setHeader = jest.fn();
    response.get = jest.fn().mockReturnValue('12');

    middleware.use(
      {
        method: 'POST',
        originalUrl: '/v1/auth/login?token=secret',
        url: '/v1/auth/login?token=secret',
        ip: '203.0.113.9',
        unit: { id: 'unit-9' },
        get: (header: string) =>
          header === 'x-request-id' ? 'req-12345678' : 'jest-agent',
      } as never,
      response as never,
      () => undefined,
    );
    response.emit('finish');

    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'req-12345678',
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'http',
        requestId: 'req-12345678',
        method: 'POST',
        statusCode: 401,
        unitId: 'unit-9',
        path: '/v1/auth/login?token=%5Bredacted%5D',
      }),
    );
  });

  it('does not log swagger traffic', () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const middleware = new AppLoggerMiddleware();
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: jest.Mock;
      get: jest.Mock;
    };
    response.statusCode = 200;
    response.setHeader = jest.fn();
    response.get = jest.fn();

    middleware.use(
      {
        method: 'GET',
        originalUrl: '/docs',
        url: '/docs',
        get: () => undefined,
      } as never,
      response as never,
      () => undefined,
    );
    response.emit('finish');

    expect(log).not.toHaveBeenCalled();
  });
});
