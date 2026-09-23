const SENSITIVE_KEY =
  /passphrase|password|secret|token|authorization|cookie|securityanswer|digitsequence|api[-_]?key/i;

const SECRET_KEY =
  'passphrase|password|secret|token|authorization|cookie|securityanswer|digitsequence|api[-_]?key';
const AUTH_HEADER = new RegExp(
  `((?:authorization)\\s*:\\s*)bearer\\s+\\S+`,
  'gi',
);
const BEARER = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const BCRYPT = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g;
const ASSIGNED_SECRET = new RegExp(
  `((?:${SECRET_KEY})["']?\\s*[:=]\\s*)("[^"]*"|'[^']*'|[^\\s,}&]+)`,
  'gi',
);
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

const MAX_TEXT = 2000;
const MAX_DEPTH = 8;

export function redactText(value: string): string {
  const cleaned = value
    .replace(CONTROL_CHARS, ' ')
    .replace(AUTH_HEADER, '$1[redacted]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(JWT, '[redacted]')
    .replace(BCRYPT, '[redacted]')
    .replace(ASSIGNED_SECRET, (_match, prefix: string, secret: string) => {
      if (secret.startsWith('"')) {
        return `${prefix}"[redacted]"`;
      }
      if (secret.startsWith("'")) {
        return `${prefix}'[redacted]'`;
      }
      return `${prefix}[redacted]`;
    });

  if (cleaned.length <= MAX_TEXT) {
    return cleaned;
  }

  return `${cleaned.slice(0, MAX_TEXT)}...`;
}

export function redactValue(key: string, value: unknown, depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) {
    return '[redacted]';
  }

  if (typeof value === 'string') {
    return redactText(value);
  }

  if (depth >= MAX_DEPTH) {
    return '[truncated]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item, depth + 1));
  }

  if (isPlainObject(value)) {
    return redactObject(value, depth + 1);
  }

  return value;
}

export function redactObject(
  value: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    redacted[key] = redactValue(key, nested, depth);
  }

  return redacted;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}
