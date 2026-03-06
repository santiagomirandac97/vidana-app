import type { Consumption } from './types';

/**
 * Returns the next sequential order number for today.
 * Counts non-voided consumptions already saved and adds 1.
 */
export function calculateNextOrderNumber(todaysConsumptions: Consumption[]): number {
  const nonVoided = todaysConsumptions.filter(c => !c.voided);
  return nonVoided.length + 1;
}
