import { redactObject, redactText } from './redact';

describe('redactText', () => {
  it('strips bearer tokens, jwts, and bcrypt hashes', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature12';
    const hash = `$2b$10$${'a'.repeat(53)}`;

    expect(redactText(`Authorization: Bearer ${jwt}`)).toBe(
      'Authorization: [redacted]',
    );
    expect(redactText(`token ${jwt}`)).toBe('token [redacted]');
    expect(redactText(`hash ${hash}`)).toBe('hash [redacted]');
  });

  it('redacts assigned secrets and drops control characters', () => {
    expect(redactText('passphrase=night-city\nnext')).toBe(
      'passphrase=[redacted] next',
    );
    expect(redactText('{"securityAnswer":"night city"}')).toBe(
      '{"securityAnswer":"[redacted]"}',
    );
  });
});

describe('redactObject', () => {
  it('redacts sensitive keys and nested values', () => {
    expect(
      redactObject({
        title: 'file report',
        passphrase: 'night-city-12',
        nested: { accessToken: 'abc' },
      }),
    ).toEqual({
      title: 'file report',
      passphrase: '[redacted]',
      nested: { accessToken: '[redacted]' },
    });
  });
});
