import {
  buildHttpAccessLog,
  httpLogLevel,
  sanitizePath,
  shouldSkipHttpLog,
} from './http-log';

describe('httpLogLevel', () => {
  it('uses error for 5xx, warn for 4xx and slow calls, log otherwise', () => {
    expect(httpLogLevel(500, 10)).toBe('error');
    expect(httpLogLevel(404, 10)).toBe('warn');
    expect(httpLogLevel(200, 1000)).toBe('warn');
    expect(httpLogLevel(201, 40)).toBe('log');
  });
});

describe('sanitizePath', () => {
  it('redacts secret query keys and keeps the route', () => {
    expect(
      sanitizePath('/v1/auth/login?passphrase=night-city&unitname=deckard'),
    ).toBe('/v1/auth/login?passphrase=%5Bredacted%5D&unitname=deckard');
  });

  it('drops control characters from the url', () => {
    expect(sanitizePath('/v1/schedule\n/injected')).toBe(
      '/v1/schedule/injected',
    );
    expect(sanitizePath('/v1/schedule\n/injected')).not.toContain('\n');
  });
});

describe('shouldSkipHttpLog', () => {
  it('skips swagger and static assets', () => {
    expect(shouldSkipHttpLog('/docs')).toBe(true);
    expect(shouldSkipHttpLog('/docs/swagger-ui.css')).toBe(true);
    expect(shouldSkipHttpLog('/favicon.ico')).toBe(true);
    expect(shouldSkipHttpLog('/v1/schedule')).toBe(false);
  });
});

describe('buildHttpAccessLog', () => {
  it('marks slow requests and omits an empty user agent', () => {
    expect(
      buildHttpAccessLog({
        requestId: 'req-12345678',
        method: 'GET',
        originalUrl: '/v1/schedule',
        statusCode: 200,
        durationMs: 1500.4,
        ip: '203.0.113.8',
      }),
    ).toEqual({
      message: 'http',
      requestId: 'req-12345678',
      method: 'GET',
      path: '/v1/schedule',
      statusCode: 200,
      durationMs: 1500,
      ip: '203.0.113.8',
      slow: true,
    });
  });
});
