import type { Employee, Bonus, PayrollRecord, PayrollBreakdownItem } from './types';

/**
 * Calculates the payroll for a quincena.
 *
 * @param employees  - All employees for the company; inactive records are skipped internally.
 * @param bonusesByEmployee - Map of employeeId → bonuses (all bonuses for that employee).
 * @param quincenaDate - ISO date string 'yyyy-MM-dd' — the 15th or 30th.
 * @returns A partial PayrollRecord (without id, generatedBy, generatedAt, companyId).
 */
export function calculatePayroll(
  employees: Employee[],
  bonusesByEmployee: Record<string, Bonus[]>,
  quincenaDate: string,
): Pick<PayrollRecord, 'totalAmount' | 'breakdown'> {
  const breakdown: PayrollBreakdownItem[] = employees
    .filter(e => e.active)
    .map(employee => {
      const salary = employee.salaryPerQuincena ?? 0;
      // employee.id is always set for Firestore-fetched documents; '' is a safe fallback
      const allBonuses = bonusesByEmployee[employee.id ?? ''] ?? [];

      const bonusItems = allBonuses
        .filter(b => {
          if (!b.active) return false;
          if (b.isRecurring) return true;
          return b.appliesTo === quincenaDate;
        })
        .map(b => ({ description: b.description, amount: b.amount, isRecurring: b.isRecurring }));

      const subtotal = salary + bonusItems.reduce((sum, b) => sum + b.amount, 0);

      return { employeeId: employee.id ?? '', employeeName: employee.name, salary, bonuses: bonusItems, subtotal };
    });

  const totalAmount = breakdown.reduce((sum, item) => sum + item.subtotal, 0);

  return { totalAmount, breakdown };
}
