import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('warns on a client error and lets Nest write the response', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const reply = jest.fn();
    const filter = new AllExceptionsFilter({
      httpAdapter: {
        isHeadersSent: () => false,
        reply,
        end: jest.fn(),
      },
    } as unknown as HttpAdapterHost);
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/v1/schedule?passphrase=secret',
        }),
        getResponse: () => ({}),
      }),
      getArgByIndex: () => ({}),
    } as unknown as ArgumentsHost;

    filter.catch(new BadRequestException('passphrase=secret is invalid'), host);

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'BadRequestException',
        method: 'POST',
        path: '/v1/schedule?passphrase=%5Bredacted%5D',
        message: 'passphrase=[redacted] is invalid',
      }),
    );
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ statusCode: 400 }),
      400,
    );
  });
});
