function reviewedKey(userId: string): string {
  return `makhzan.dayReviewed.${userId}`;
}

export type DayReviewed = {
  date: string;
  at: string;
};

export function readDayReviewed(userId: string): DayReviewed | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(reviewedKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DayReviewed;
    if (!parsed?.date || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function markDayReviewed(userId: string, date: string): DayReviewed {
  const row: DayReviewed = { date, at: new Date().toISOString() };
  try {
    localStorage.setItem(reviewedKey(userId), JSON.stringify(row));
  } catch {
    /* ignore quota */
  }
  return row;
}
