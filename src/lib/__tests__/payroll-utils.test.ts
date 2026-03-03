import { calculatePayroll } from '../payroll-utils';
import type { Employee, Bonus } from '../types';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp1',
  name: 'Juan López',
  employeeNumber: '001',
  companyId: 'co1',
  active: true,
  salaryPerQuincena: 5000,
  ...overrides,
});

const makeBonus = (overrides: Partial<Bonus> = {}): Bonus => ({
  id: 'b1',
  employeeId: 'emp1',
  companyId: 'co1',
  description: 'Bono puntualidad',
  amount: 500,
  isRecurring: true,
  active: true,
  createdBy: 'admin',
  ...overrides,
});

describe('calculatePayroll', () => {
  it('calculates salary only when no bonuses', () => {
    const result = calculatePayroll([makeEmployee()], {}, '2026-03-15');
    expect(result.totalAmount).toBe(5000);
    expect(result.breakdown[0].salary).toBe(5000);
    expect(result.breakdown[0].bonuses).toHaveLength(0);
    expect(result.breakdown[0].subtotal).toBe(5000);
  });

  it('includes recurring bonus in total', () => {
    const result = calculatePayroll(
      [makeEmployee()],
      { emp1: [makeBonus()] },
      '2026-03-15'
    );
    expect(result.totalAmount).toBe(5500);
    expect(result.breakdown[0].bonuses).toHaveLength(1);
    expect(result.breakdown[0].subtotal).toBe(5500);
  });

  it('includes one-time bonus when appliesTo matches quincenaDate', () => {
    const oneTime = makeBonus({ isRecurring: false, appliesTo: '2026-03-15' });
    const result = calculatePayroll([makeEmployee()], { emp1: [oneTime] }, '2026-03-15');
    expect(result.totalAmount).toBe(5500);
  });

  it('excludes one-time bonus when appliesTo does not match quincenaDate', () => {
    const oneTime = makeBonus({ isRecurring: false, appliesTo: '2026-03-15' });
    const result = calculatePayroll([makeEmployee()], { emp1: [oneTime] }, '2026-03-30');
    expect(result.totalAmount).toBe(5000);
  });

  it('skips inactive employees', () => {
    const result = calculatePayroll([makeEmployee({ active: false })], {}, '2026-03-15');
    expect(result.breakdown).toHaveLength(0);
    expect(result.totalAmount).toBe(0);
  });

  it('skips deactivated recurring bonus', () => {
    const inactive = makeBonus({ active: false });
    const result = calculatePayroll([makeEmployee()], { emp1: [inactive] }, '2026-03-15');
    expect(result.totalAmount).toBe(5000);
    expect(result.breakdown[0].bonuses).toHaveLength(0);
  });

  it('handles multiple employees', () => {
    const emp2 = makeEmployee({ id: 'emp2', name: 'Ana García', salaryPerQuincena: 6000 });
    const result = calculatePayroll([makeEmployee(), emp2], {}, '2026-03-15');
    expect(result.totalAmount).toBe(11000);
    expect(result.breakdown).toHaveLength(2);
  });

  it('treats missing salaryPerQuincena as 0', () => {
    const result = calculatePayroll([makeEmployee({ salaryPerQuincena: undefined })], {}, '2026-03-15');
    expect(result.breakdown[0].salary).toBe(0);
    expect(result.totalAmount).toBe(0);
  });
});
