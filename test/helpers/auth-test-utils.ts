import { buildResetRound1ExpectedSequence } from '../../src/common/helpers/build-reset-digit-sequence';

export function uniqueUnitname(prefix = 'test'): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export function validPassphrase(): string {
  return 'valid passphrase12';
}

export function validSecurityQuestion(): string {
  return 'what city were you born in';
}

export function validSecurityAnswer(): string {
  return 'night city';
}

export function registerPayload(
  unitname: string,
  passphrase: string,
): {
  unitname: string;
  passphrase: string;
  securityQuestion: string;
  securityAnswer: string;
} {
  return {
    unitname,
    passphrase,
    securityQuestion: validSecurityQuestion(),
    securityAnswer: validSecurityAnswer(),
  };
}

export function buildRound1DigitSequence(code: string): string {
  return buildResetRound1ExpectedSequence(code);
}

export function extractRefreshCookie(
  setCookieHeader: string | string[] | undefined,
): string | undefined {
  if (!setCookieHeader) {
    return undefined;
  }

  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];

  const refreshCookie = cookies.find((cookie) =>
    cookie.startsWith('refresh_token='),
  );

  return refreshCookie?.split(';')[0];
}

export function authPath(path: string): string {
  return `/v1/auth${path}`;
}
