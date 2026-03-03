// src/lib/revenue-utils.ts
import { eachDayOfInterval, getDay, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { type Consumption, type Company } from './types';
import { APP_TIMEZONE } from './constants';

/**
 * Computes revenue for a company over an interval [from, to] (both inclusive),
 * applying the dailyTarget minimum charge logic on chargeable days.
 *
 * @param consumptions - Non-voided consumptions for this company already filtered to the interval.
 * @param company      - Company record (for mealPrice, dailyTarget, targetDays).
 * @param from         - Start of interval (typically startOfMonth).
 * @param to           - End of interval (typically today for current month, endOfMonth for past months).
 */
export function computeRevenue(
  consumptions: Consumption[],
  company: Company,
  from: Date,
  to: Date,
): number {
  // Caller must pass consumptions already filtered to !voided and within [from, to].
  const mealPrice = company.mealPrice ?? 0;
  const dailyTarget = company.dailyTarget ?? 0;
  const chargeable = company.targetDays ?? [1, 2, 3, 4]; // Mon–Thu by default

  if (dailyTarget > 0) {
    const days = eachDayOfInterval({ start: from, end: to });
    const countByDay: Record<string, number> = {};
    consumptions.forEach(c => {
      const d = formatInTimeZone(new Date(c.timestamp), APP_TIMEZONE, 'yyyy-MM-dd');
      countByDay[d] = (countByDay[d] || 0) + 1;
    });
    return days.reduce((total, date) => {
      const dayStr = format(date, 'yyyy-MM-dd');
      const dow = getDay(date);
      const isChargeable = chargeable.includes(dow);
      const count = countByDay[dayStr] || 0;
      return total + (isChargeable ? Math.max(count, dailyTarget) : count) * mealPrice;
    }, 0);
  }

  return consumptions.length * mealPrice;
}
