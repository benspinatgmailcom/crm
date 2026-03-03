/**
 * Time helpers for follow-up due dates (server local time for v1).
 */

export function getTomorrowAt9am(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function getTodayAt5pm(now: Date): Date {
  const d = new Date(now);
  d.setHours(17, 0, 0, 0);
  return d;
}

/** Next business day 9am if now is after 5pm, else today 5pm */
export function getOverdueDueDate(now: Date): Date {
  const fivePm = getTodayAt5pm(now);
  if (now >= fivePm) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  }
  return fivePm;
}

/** Within 2 days at 9am */
export function getWithinTwoDays9am(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 2);
  d.setHours(9, 0, 0, 0);
  return d;
}
