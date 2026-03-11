import { Employee, Bonus } from './types';

/**
 * Compute total monthly labor cost from employee salaries and bonuses.
 * Employees are included if they were active during the month
 * (startDate <= monthEnd AND (endDate undefined OR endDate >= monthStart)).
 * Recurring bonuses contribute amount x 2 (once per quincena).
 * One-time bonuses contribute amount if appliesTo falls within [monthStart, monthEnd].
 */
export function computeMonthlyLaborCost(
  employees: Employee[],
  bonuses: Bonus[],
  monthStart: string, // yyyy-MM-dd
  monthEnd: string,   // yyyy-MM-dd
): number {
  let total = 0;

  for (const emp of employees) {
    if (emp.voided) continue;

    // Check date range: employee must have been active during this month
    if (emp.startDate && emp.startDate > monthEnd) continue;
    if (emp.endDate && emp.endDate < monthStart) continue;

    // Base salary: quincena x 2
    total += (emp.salaryPerQuincena ?? 0) * 2;

    // Bonuses for this employee
    const empBonuses = bonuses.filter(b => b.employeeId === emp.id && b.active);
    for (const bonus of empBonuses) {
      if (bonus.isRecurring) {
        total += bonus.amount * 2;
      } else if (bonus.appliesTo && bonus.appliesTo >= monthStart && bonus.appliesTo <= monthEnd) {
        total += bonus.amount;
      }
    }
  }

  return total;
}
