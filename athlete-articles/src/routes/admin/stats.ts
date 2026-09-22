import { withAuth, type AuthedRequestContext } from "../../router";
import { jsonResponse } from "../../lib/response";
import { listRecentFailures } from "../../db/pipelineRuns";

interface CountRow {
  readonly count: number;
}

/**
 * §8 Usage statistics + the "most recent failures on the landing view"
 * requirement, in one call so the Admin App's dashboard is a single request.
 */
export const statsHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const db = ctx.env.DB;

  const [totalUsers, paidUsers, totalRecords, processedRecords, pendingReview, stuckRecords, recentFailures] =
    await Promise.all([
      db.prepare(`SELECT COUNT(*) as count FROM users`).first<CountRow>(),
      db.prepare(`SELECT COUNT(*) as count FROM users WHERE billing_status = 'paid' OR superuser = 1`).first<CountRow>(),
      db.prepare(`SELECT COUNT(*) as count FROM source_records`).first<CountRow>(),
      db.prepare(`SELECT COUNT(*) as count FROM source_records WHERE processed = 1`).first<CountRow>(),
      db.prepare(`SELECT COUNT(*) as count FROM source_records WHERE review_status = 'pending'`).first<CountRow>(),
      db.prepare(`SELECT COUNT(*) as count FROM source_records WHERE stuck = 1`).first<CountRow>(),
      listRecentFailures(db, 10),
    ]);

  return jsonResponse({
    users: {
      total: totalUsers?.count ?? 0,
      paidOrSuperuser: paidUsers?.count ?? 0,
    },
    sourceRecords: {
      total: totalRecords?.count ?? 0,
      processed: processedRecords?.count ?? 0,
      pendingReview: pendingReview?.count ?? 0,
      stuck: stuckRecords?.count ?? 0,
    },
    recentFailures,
  });
});
