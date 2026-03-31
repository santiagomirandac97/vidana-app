import { formatInTimeZone } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/constants';
import type { OperatingHour } from '@/lib/types';

/**
 * Get today's operating hours entry.
 * Returns null if no entry exists for today or the array is empty/undefined.
 */
export function getTodayHours(operatingHours?: OperatingHour[]): OperatingHour | null {
  if (!operatingHours || operatingHours.length === 0) return null;

  // Get the current day-of-week in Mexico City timezone (0=Sun, 6=Sat)
  const nowInMx = formatInTimeZone(new Date(), APP_TIMEZONE, 'e'); // 1=Mon … 7=Sun (ISO)
  // Convert ISO day-of-week to JS day-of-week: ISO 7 (Sun) → JS 0, ISO 1 (Mon) → JS 1, etc.
  const isoDay = parseInt(nowInMx, 10);
  const jsDay = isoDay === 7 ? 0 : isoDay;

  return operatingHours.find((h) => h.day === jsDay) ?? null;
}

/**
 * Check whether the restaurant is currently open.
 * Returns false if operatingHours is undefined/empty or no entry for today.
 */
export function isRestaurantOpen(operatingHours?: OperatingHour[]): boolean {
  const today = getTodayHours(operatingHours);
  if (!today) return false;

  const nowStr = formatInTimeZone(new Date(), APP_TIMEZONE, 'HH:mm');
  return nowStr >= today.open && nowStr <= today.close;
}
