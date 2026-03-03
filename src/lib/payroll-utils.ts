import type { Employee, Bonus, PayrollRecord, PayrollBreakdownItem } from './types';

/**
 * Calculates the payroll for a quincena.
 *
 * @param employees  - Active employees for the company.
 * @param bonusesByEmployee - Map of employeeId → bonuses (all bonuses for that employee).
 * @param quincenaDate - ISO date string 'yyyy-MM-dd' — the 15th or 30th.
 * @returns A partial PayrollRecord (without id, generatedBy, generatedAt, companyId).
 */
export function calculatePayroll(
  employees: Employee[],
  bonusesByEmployee: Record<string, Bonus[]>,
  quincenaDate: string,
): Pick<PayrollRecord, 'totalAmount' | 'breakdown'> {
  const breakdown: PayrollBreakdownItem[] = [];

  for (const employee of employees) {
    if (!employee.active) continue;

    const salary = employee.salaryPerQuincena ?? 0;
    const allBonuses = bonusesByEmployee[employee.id ?? ''] ?? [];

    const applicableBonuses = allBonuses.filter(b => {
      if (!b.active) return false;
      if (b.isRecurring) return true;
      return b.appliesTo === quincenaDate;
    });

    const bonusItems = applicableBonuses.map(b => ({
      description: b.description,
      amount: b.amount,
      isRecurring: b.isRecurring,
    }));

    const bonusTotal = bonusItems.reduce((sum, b) => sum + b.amount, 0);
    const subtotal = salary + bonusTotal;

    breakdown.push({
      employeeId: employee.id ?? '',
      employeeName: employee.name,
      salary,
      bonuses: bonusItems,
      subtotal,
    });
  }

  const totalAmount = breakdown.reduce((sum, item) => sum + item.subtotal, 0);

  return { totalAmount, breakdown };
}
