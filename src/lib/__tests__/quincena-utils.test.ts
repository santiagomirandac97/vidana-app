import { getQuincenaDateIfDue, formatQuincenaLabel } from '../quincena-utils';

describe('getQuincenaDateIfDue', () => {
  it('returns quincena date when today is the 15th (weekday)', () => {
    // March 15 2026 is a Sunday — so Friday the 13th should trigger it
    const sunday15 = new Date(2026, 2, 15);  // Sun
    expect(getQuincenaDateIfDue(sunday15)).toBeNull();

    const friday13 = new Date(2026, 2, 13);  // Fri before Sun 15th
    expect(getQuincenaDateIfDue(friday13)).toBe('2026-03-15');
  });

  it('returns quincena date when today is the 30th (weekday)', () => {
    const monday30 = new Date(2026, 2, 30); // March 30 2026 — Monday
    expect(getQuincenaDateIfDue(monday30)).toBe('2026-03-30');
  });

  it('returns null for a regular weekday', () => {
    const wednesday = new Date(2026, 2, 4);
    expect(getQuincenaDateIfDue(wednesday)).toBeNull();
  });

  it('returns null when 30th falls on Saturday (uses Friday 29th)', () => {
    // November 30 2024 is Saturday
    const sat30Nov = new Date(2024, 10, 30);
    expect(getQuincenaDateIfDue(sat30Nov)).toBeNull();

    const fri29Nov = new Date(2024, 10, 29);
    expect(getQuincenaDateIfDue(fri29Nov)).toBe('2024-11-30');
  });
});

describe('formatQuincenaLabel', () => {
  it('formats a quincena date as readable label', () => {
    expect(formatQuincenaLabel('2026-03-15')).toBe('15 de marzo 2026');
    expect(formatQuincenaLabel('2026-03-30')).toBe('30 de marzo 2026');
  });
});
