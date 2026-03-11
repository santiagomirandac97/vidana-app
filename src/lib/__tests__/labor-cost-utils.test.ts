import { computeMonthlyLaborCost } from '../labor-cost-utils';
import { Employee, Bonus } from '../types';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp1',
  employeeNumber: '001',
  name: 'Test Employee',
  companyId: 'comp1',
  active: true,
  salaryPerQuincena: 5000,
  startDate: '2026-01-01',
  ...overrides,
});

const makeBonus = (overrides: Partial<Bonus> = {}): Bonus => ({
  id: 'b1',
  employeeId: 'emp1',
  companyId: 'comp1',
  description: 'Test Bonus',
  amount: 500,
  isRecurring: true,
  active: true,
  createdBy: 'admin1',
  ...overrides,
});

describe('computeMonthlyLaborCost', () => {
  it('returns salary x 2 for an active employee', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()], [], '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('includes recurring bonus x 2', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()],
      [makeBonus({ amount: 500, isRecurring: true })],
      '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(11000);
  });

  it('includes one-time bonus when appliesTo falls within month', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()],
      [makeBonus({ amount: 300, isRecurring: false, appliesTo: '2026-03-15' })],
      '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(10300);
  });

  it('excludes one-time bonus when appliesTo is outside month', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()],
      [makeBonus({ amount: 300, isRecurring: false, appliesTo: '2026-04-15' })],
      '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('excludes employee whose startDate is after month end', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ startDate: '2026-04-01' })], [], '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(0);
  });

  it('excludes employee whose endDate is before month start', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ endDate: '2026-02-28' })], [], '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(0);
  });

  it('includes employee whose endDate is within the month', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ endDate: '2026-03-15' })], [], '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('excludes inactive bonuses', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee()],
      [makeBonus({ active: false })],
      '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('excludes voided employees', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ voided: true })], [], '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(0);
  });

  it('handles employees with no startDate (legacy data)', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ startDate: undefined })], [], '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(10000);
  });

  it('sums multiple employees and bonuses correctly', () => {
    const employees = [
      makeEmployee({ id: 'e1', salaryPerQuincena: 5000, startDate: '2026-01-01' }),
      makeEmployee({ id: 'e2', salaryPerQuincena: 7000, startDate: '2026-02-01' }),
    ];
    const bonuses = [
      makeBonus({ employeeId: 'e1', amount: 500, isRecurring: true }),
      makeBonus({ employeeId: 'e2', amount: 200, isRecurring: false, appliesTo: '2026-03-15' }),
    ];
    const result = computeMonthlyLaborCost(employees, bonuses, '2026-03-01', '2026-03-31');
    expect(result).toBe(25200); // e1: 10000+1000, e2: 14000+200
  });

  it('treats missing salaryPerQuincena as 0', () => {
    const result = computeMonthlyLaborCost(
      [makeEmployee({ salaryPerQuincena: undefined })], [], '2026-03-01', '2026-03-31'
    );
    expect(result).toBe(0);
  });
});
