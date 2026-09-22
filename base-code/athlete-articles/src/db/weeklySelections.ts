import type { WeeklySelection } from "./types";

interface RawWeeklySelectionRow {
  readonly id: number;
  readonly user_id: string;
  readonly year: number;
  readonly week_number: number;
  readonly article_id: number;
  readonly created_at: string;
}

function mapRow(row: RawWeeklySelectionRow): WeeklySelection {
  return {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    weekNumber: row.week_number,
    articleId: row.article_id,
    createdAt: row.created_at,
  };
}

export async function listSelectionsForUserYear(
  db: D1Database,
  userId: string,
  year: number,
): Promise<readonly WeeklySelection[]> {
  const result = await db
    .prepare(`SELECT * FROM weekly_selections WHERE user_id = ? AND year = ? ORDER BY week_number ASC`)
    .bind(userId, year)
    .all<RawWeeklySelectionRow>();
  return result.results.map(mapRow);
}

export async function getSelection(
  db: D1Database,
  userId: string,
  year: number,
  weekNumber: number,
): Promise<WeeklySelection | null> {
  const row = await db
    .prepare(`SELECT * FROM weekly_selections WHERE user_id = ? AND year = ? AND week_number = ?`)
    .bind(userId, year, weekNumber)
    .first<RawWeeklySelectionRow>();
  return row ? mapRow(row) : null;
}

/**
 * One-time-only insert: the UNIQUE(user_id, year, week_number) index means a
 * second attempt for the same week fails at the DB layer even under a race,
 * matching §9's "locked in, can't be changed" rule.
 */
export async function createSelection(
  db: D1Database,
  input: { readonly userId: string; readonly year: number; readonly weekNumber: number; readonly articleId: number },
): Promise<WeeklySelection | null> {
  try {
    const row = await db
      .prepare(
        `INSERT INTO weekly_selections (user_id, year, week_number, article_id) VALUES (?, ?, ?, ?) RETURNING *`,
      )
      .bind(input.userId, input.year, input.weekNumber, input.articleId)
      .first<RawWeeklySelectionRow>();
    return row ? mapRow(row) : null;
  } catch (error) {
    // Only swallow the specific race we're guarding against (the UNIQUE
    // constraint on user_id/year/week_number) — any other DB error should
    // surface as a real failure, not silently read back as "already picked".
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      return null;
    }
    throw error;
  }
}
