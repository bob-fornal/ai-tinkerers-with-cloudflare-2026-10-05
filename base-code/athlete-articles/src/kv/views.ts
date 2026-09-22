export interface ViewCounter {
  readonly count: number;
  readonly max: number;
}

const UNPAID_WEEKLY_MAX = 10;
const PAID_WEEKLY_MAX = 100;

export function weeklyViewMax(isPaidTier: boolean): number {
  return isPaidTier ? PAID_WEEKLY_MAX : UNPAID_WEEKLY_MAX;
}

function viewsKey(thunk: string, year: number, weekNumber: number): string {
  return `views:${thunk}:${year}:${weekNumber}`;
}

export async function getViewCounter(
  kv: KVNamespace,
  thunk: string,
  year: number,
  weekNumber: number,
): Promise<ViewCounter | null> {
  return kv.get<ViewCounter>(viewsKey(thunk, year, weekNumber), "json");
}

/**
 * Increments the view counter, creating it (with `max` fixed at the caller's
 * current billing tier, §7) on first read of the week. Returns null if the
 * cap was already reached — caller should not serve the article in that
 * case.
 */
export async function incrementViewCounter(
  kv: KVNamespace,
  thunk: string,
  year: number,
  weekNumber: number,
  isPaidTier: boolean,
): Promise<ViewCounter | null> {
  const key = viewsKey(thunk, year, weekNumber);
  const existing = await kv.get<ViewCounter>(key, "json");
  const max = existing?.max ?? weeklyViewMax(isPaidTier);
  const count = existing?.count ?? 0;

  if (count >= max) {
    return null;
  }

  const next: ViewCounter = { count: count + 1, max };
  await kv.put(key, JSON.stringify(next));
  return next;
}
