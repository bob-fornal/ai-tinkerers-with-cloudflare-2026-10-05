import { withAuth, type AuthedRequestContext } from "../../router";
import { Errors, jsonResponse } from "../../lib/response";
import { createSelection, getSelection, listSelectionsForUserYear } from "../../db/weeklySelections";
import { getSourceRecordById } from "../../db/sourceRecords";
import { isoWeekNumber, isoWeekYear } from "../../lib/weekNumber";

export const listSelectionsHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const yearParam = ctx.url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : isoWeekYear(new Date());
  if (!Number.isInteger(year)) {
    return Errors.badRequest("year must be an integer.");
  }
  const selections = await listSelectionsForUserYear(ctx.env.DB, ctx.user.uid, year);
  return jsonResponse({ items: selections });
});

/** True when (year, weekNumber) is strictly after the currently-live ISO week — the only window a pick may target (§9). */
function isFutureNotYetLiveWeek(year: number, weekNumber: number, now: Date): boolean {
  const currentYear = isoWeekYear(now);
  const currentWeek = isoWeekNumber(now);
  if (year > currentYear) return true;
  if (year === currentYear) return weekNumber > currentWeek;
  return false;
}

export const setSelectionHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const year = Number(ctx.params.year);
  const weekNumber = Number(ctx.params.week);
  if (!Number.isInteger(year) || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    return Errors.badRequest("Invalid year/week in path.");
  }

  const body = (await ctx.request.json().catch(() => null)) as { articleId?: unknown } | null;
  const articleId = Number(body?.articleId);
  if (!Number.isInteger(articleId)) {
    return Errors.badRequest("articleId is required.");
  }

  const now = new Date();
  if (!isFutureNotYetLiveWeek(year, weekNumber, now)) {
    return Errors.conflict("Selections can only be made for a week that hasn't gone live yet.");
  }

  const existing = await getSelection(ctx.env.DB, ctx.user.uid, year, weekNumber);
  if (existing) {
    return Errors.conflict("A selection has already been locked in for this week.");
  }

  const article = await getSourceRecordById(ctx.env.DB, articleId);
  if (!article || article.reviewStatus !== "approved" || !article.processed) {
    return Errors.badRequest("articleId must reference a currently approved, processed article.");
  }

  const selection = await createSelection(ctx.env.DB, { userId: ctx.user.uid, year, weekNumber, articleId });
  if (!selection) {
    return Errors.conflict("A selection has already been locked in for this week.");
  }
  return jsonResponse(selection, { status: 201 });
});
