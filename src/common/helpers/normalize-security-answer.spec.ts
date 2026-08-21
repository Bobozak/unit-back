import { normalizeSecurityAnswer } from './normalize-security-answer';

describe('normalizeSecurityAnswer', () => {
  it('lowercases latin text', () => {
    expect(normalizeSecurityAnswer('Night City')).toBe('night city');
  });

  it('strips punctuation and symbols', () => {
    expect(normalizeSecurityAnswer("What's your city?")).toBe(
      'whats your city',
    );
    expect(normalizeSecurityAnswer('a - b')).toBe('a b');
  });

  it('collapses whitespace after stripping punctuation', () => {
    expect(normalizeSecurityAnswer('  night   city  ')).toBe('night city');
  });

  it('lowercases cyrillic', () => {
    expect(normalizeSecurityAnswer('Ночной Город')).toBe('ночной город');
  });

  it('applies NFKC before lowercasing', () => {
    expect(normalizeSecurityAnswer('ＡＢＣ')).toBe('abc');
  });
});
