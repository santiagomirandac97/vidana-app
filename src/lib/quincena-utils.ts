import { format, setDate, getDay, getDate } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Returns the quincena ISO date string ('yyyy-MM-dd') if today requires
 * a payroll confirmation prompt, or null otherwise.
 *
 * Rules:
 *  - 15th on Mon-Fri → return 15th
 *  - 30th on Mon-Fri → return 30th
 *  - If 15th/30th falls on Sat → preceding Friday triggers it (returns 15th/30th)
 *  - If 15th/30th falls on Sun → preceding Friday triggers it (returns 15th/30th)
 */
export function getQuincenaDateIfDue(today: Date): string | null {
  const day = getDate(today);
  const dow = getDay(today); // 0=Sun, 1=Mon, …, 6=Sat

  // Direct hit: today IS the 15th or 30th and it's a weekday
  if ((day === 15 || day === 30) && dow >= 1 && dow <= 5) {
    return format(today, 'yyyy-MM-dd');
  }

  // Friday compensation: check if the upcoming Saturday or Sunday is the 15th/30th
  if (dow === 5) { // today is Friday
    const saturday = day + 1;
    const sunday = day + 2;
    if (saturday === 15 || sunday === 15) {
      return format(setDate(today, 15), 'yyyy-MM-dd');
    }
    if (saturday === 30 || sunday === 30) {
      return format(setDate(today, 30), 'yyyy-MM-dd');
    }
  }

  return null;
}

/**
 * Formats a quincena date string as a human-readable label in Spanish.
 * e.g. '2026-03-15' → '15 de marzo 2026'
 */
export function formatQuincenaLabel(quincenaDate: string): string {
  const date = new Date(quincenaDate + 'T12:00:00'); // noon to avoid TZ shift
  return format(date, "d 'de' MMMM yyyy", { locale: es });
}
