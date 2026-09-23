import { redactText } from './redact';

export const SLOW_REQUEST_MS = 1000;

const SENSITIVE_QUERY =
  /passphrase|password|secret|token|authorization|cookie|securityanswer|digitsequence|api[-_]?key|^code$/i;
const STATIC_EXT = /\.(?:js|css|map|png|ico|svg|woff2?)$/i;
const MAX_QUERY_VALUE = 80;
const MAX_PATH = 500;

export type HttpLogLevel = 'error' | 'warn' | 'log';

export type HttpAccessLog = {
  message: 'http';
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  contentLength?: number;
  ip?: string;
  userAgent?: string;
  unitId?: string;
  slow?: true;
};

export function httpLogLevel(
  statusCode: number,
  durationMs: number,
): HttpLogLevel {
  if (statusCode >= 500) {
    return 'error';
  }

  if (statusCode >= 400 || durationMs >= SLOW_REQUEST_MS) {
    return 'warn';
  }

  return 'log';
}

export function shouldSkipHttpLog(originalUrl: string): boolean {
  const pathname = originalUrl.split('?')[0] ?? originalUrl;

  if (pathname === '/docs' || pathname.startsWith('/docs/')) {
    return true;
  }

  if (pathname === '/favicon.ico') {
    return true;
  }

  return STATIC_EXT.test(pathname);
}

export function sanitizePath(originalUrl: string): string {
  const withoutControls = originalUrl.replace(/[\u0000-\u001F\u007F]/g, '');

  try {
    const url = new URL(withoutControls, 'http://localhost');

    for (const key of [...url.searchParams.keys()]) {
      const values = url.searchParams.getAll(key);
      url.searchParams.delete(key);

      if (SENSITIVE_QUERY.test(key)) {
        url.searchParams.set(key, '[redacted]');
        continue;
      }

      for (const value of values) {
        url.searchParams.append(key, value.slice(0, MAX_QUERY_VALUE));
      }
    }

    return `${url.pathname}${url.search}`.slice(0, MAX_PATH);
  } catch {
    return withoutControls.split('?')[0]?.slice(0, MAX_PATH) ?? '';
  }
}

export function sanitizeUserAgent(userAgent?: string): string | undefined {
  if (!userAgent) {
    return undefined;
  }

  const cleaned = redactText(userAgent).slice(0, 180);
  return cleaned || undefined;
}

export function buildHttpAccessLog(input: {
  requestId: string;
  method: string;
  originalUrl: string;
  statusCode: number;
  durationMs: number;
  contentLength?: number;
  ip?: string;
  userAgent?: string;
  unitId?: string;
}): HttpAccessLog {
  const durationMs = Math.max(0, Math.round(input.durationMs));
  const log: HttpAccessLog = {
    message: 'http',
    requestId: input.requestId,
    method: input.method,
    path: sanitizePath(input.originalUrl),
    statusCode: input.statusCode,
    durationMs,
  };

  if (input.contentLength !== undefined && !Number.isNaN(input.contentLength)) {
    log.contentLength = input.contentLength;
  }

  if (input.ip) {
    log.ip = input.ip;
  }

  const userAgent = sanitizeUserAgent(input.userAgent);
  if (userAgent) {
    log.userAgent = userAgent;
  }

  if (input.unitId) {
    log.unitId = input.unitId;
  }

  if (durationMs >= SLOW_REQUEST_MS) {
    log.slow = true;
  }

  return log;
}
