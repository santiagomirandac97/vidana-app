import { calculateNextOrderNumber } from '../pos-utils';
import type { Consumption } from '../types';

const base: Consumption = {
  employeeId: 'x',
  employeeNumber: '1',
  name: 'Test',
  companyId: 'c1',
  timestamp: new Date().toISOString(),
  voided: false,
};

describe('calculateNextOrderNumber', () => {
  it('returns 1 when no consumptions exist today', () => {
    expect(calculateNextOrderNumber([])).toBe(1);
  });

  it('returns count + 1 for non-voided consumptions', () => {
    const consumptions = [
      { ...base },
      { ...base },
      { ...base },
    ];
    expect(calculateNextOrderNumber(consumptions)).toBe(4);
  });

  it('excludes voided consumptions from the count', () => {
    const consumptions = [
      { ...base },
      { ...base, voided: true },
      { ...base },
    ];
    expect(calculateNextOrderNumber(consumptions)).toBe(3);
  });
});
