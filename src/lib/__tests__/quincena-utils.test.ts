import { getQuincenaDateIfDue, formatQuincenaLabel } from '../quincena-utils';

describe('getQuincenaDateIfDue', () => {
  it('returns 15th date when today is the 15th on a weekday', () => {
    const wed15 = new Date(2026, 3, 15); // Wednesday April 15 2026
    expect(getQuincenaDateIfDue(wed15)).toBe('2026-04-15');
  });

  it('returns 30th date when today is the 30th on a weekday', () => {
    const monday30 = new Date(2026, 2, 30); // Monday March 30 2026
    expect(getQuincenaDateIfDue(monday30)).toBe('2026-03-30');
  });

  it('returns null for a regular weekday', () => {
    const wednesday = new Date(2026, 2, 4); // March 4 2026
    expect(getQuincenaDateIfDue(wednesday)).toBeNull();
  });

  it('returns null when 15th falls on Sunday', () => {
    const sunday15 = new Date(2026, 2, 15); // Sunday March 15 2026
    expect(getQuincenaDateIfDue(sunday15)).toBeNull();
  });

  it('returns 15th date when Friday precedes a Sunday 15th', () => {
    const friday13 = new Date(2026, 2, 13); // Friday March 13 2026
    expect(getQuincenaDateIfDue(friday13)).toBe('2026-03-15');
  });

  it('returns 15th date when Friday precedes a Saturday 15th', () => {
    const friday14 = new Date(2022, 0, 14); // Friday January 14 2022 (Jan 15 is Saturday)
    expect(getQuincenaDateIfDue(friday14)).toBe('2022-01-15');
  });

  it('returns null when 30th falls on Saturday', () => {
    const sat30Nov = new Date(2024, 10, 30); // Saturday November 30 2024
    expect(getQuincenaDateIfDue(sat30Nov)).toBeNull();
  });

  it('returns 30th date when Friday precedes a Saturday 30th', () => {
    const fri29Nov = new Date(2024, 10, 29); // Friday November 29 2024
    expect(getQuincenaDateIfDue(fri29Nov)).toBe('2024-11-30');
  });

  it('returns null on last Friday of February when the 30th would overflow to March', () => {
    // Feb 28 2025 is a Friday; day+1=29, day+2=30, but February has only 28 days
    const fri28Feb2025 = new Date(2025, 1, 28);
    expect(getQuincenaDateIfDue(fri28Feb2025)).toBeNull();
  });
});

describe('formatQuincenaLabel', () => {
  it('formats a quincena date as readable Spanish label', () => {
    expect(formatQuincenaLabel('2026-03-15')).toBe('15 de marzo 2026');
    expect(formatQuincenaLabel('2026-03-30')).toBe('30 de marzo 2026');
    expect(formatQuincenaLabel('2024-11-30')).toBe('30 de noviembre 2024');
  });
});
