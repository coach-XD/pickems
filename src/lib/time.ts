export const LOCK_LEAD_MS = 60 * 60 * 1000;

export function lockInstant(start: Date): Date {
  return new Date(start.getTime() - LOCK_LEAD_MS);
}

/** True once `now` is at or past one hour before `start`. */
export function isLocked(start: Date, now: Date): boolean {
  return now.getTime() >= start.getTime() - LOCK_LEAD_MS;
}

export function earliest(dates: Date[], fallback: Date): Date {
  if (dates.length === 0) return fallback;
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

export function placementLock(matchStarts: Date[], stageStart: Date): Date {
  return lockInstant(earliest(matchStarts, stageStart));
}

export function parseIso(value: string): Date | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function staggerFrom(start: Date, index: number): Date {
  const slot = Math.floor(index / 2);
  return new Date(start.getTime() + slot * 60 * 60 * 1000);
}
