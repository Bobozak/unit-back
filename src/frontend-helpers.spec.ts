import { isFinalInvestigationLock } from '../../front/src/helpers/blocked-screen';
import {
  formatIsoTextForUserTimezone,
  formatUserDateTime,
} from '../../front/src/helpers/date-display';

describe('isFinalInvestigationLock', () => {
  it('is true only when finalInvestigationAt is set', () => {
    expect(isFinalInvestigationLock(null)).toBe(false);
    expect(isFinalInvestigationLock({ finalInvestigationAt: null })).toBe(
      false,
    );
    expect(
      isFinalInvestigationLock({
        finalInvestigationAt: '2026-08-17T12:00:00.000Z',
      }),
    ).toBe(true);
  });
});

describe('formatUserDateTime', () => {
  const iso = '2026-08-15T06:00:00.000Z';
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  };

  it('formats an ISO instant in the local timezone', () => {
    expect(formatUserDateTime(iso)).toBe(
      new Intl.DateTimeFormat(undefined, options).format(new Date(iso)),
    );
  });

  it('returns the original string when the value is not a valid date', () => {
    expect(formatUserDateTime('not-a-date')).toBe('not-a-date');
  });
});

describe('formatIsoTextForUserTimezone', () => {
  it('replaces embedded ISO timestamps and keeps surrounding log text', () => {
    const iso = '2026-08-15T06:00:00.000Z';
    const line = `SYSTEM LOG #4801  ${iso}  TASK ACCEPTED`;
    expect(formatIsoTextForUserTimezone(line)).toBe(
      `SYSTEM LOG #4801  ${formatUserDateTime(iso)}  TASK ACCEPTED`,
    );
  });
});
