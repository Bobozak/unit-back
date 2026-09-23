import { AppLogger } from './app-logger';
import { requestContext } from './request-context';

describe('AppLogger', () => {
  const logger = new AppLogger('Test', {
    json: true,
    colors: false,
    forceConsole: true,
    logLevels: ['log', 'error', 'warn'],
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('flattens fields and attaches the request context', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    requestContext.run({ requestId: 'req-12345678', unitId: 'unit-1' }, () => {
      logger.log({
        message: 'http',
        method: 'GET',
        statusCode: 200,
        passphrase: 'night-city',
      });
    });

    const entry = JSON.parse(String(log.mock.calls[0][0]));
    expect(entry).toEqual(
      expect.objectContaining({
        level: 'log',
        context: 'Test',
        message: 'http',
        method: 'GET',
        statusCode: 200,
        requestId: 'req-12345678',
        unitId: 'unit-1',
        passphrase: '[redacted]',
      }),
    );
    expect(entry.pid).toBe(process.pid);
  });

  it('logs an error message and stack without secrets', () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failure = new Error('passphrase=night-city');
    failure.stack = 'Error: passphrase=night-city\n    at login.ts:1:1';

    logger.error(failure);

    const entry = JSON.parse(String(error.mock.calls[0][0]));
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('passphrase=[redacted]');
    expect(entry.stack).toContain('passphrase=[redacted]');
    expect(entry.stack).not.toContain('night-city');
    expect(entry.error).toBe('Error');
  });
});
