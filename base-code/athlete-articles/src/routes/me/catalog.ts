import { withAuth, type AuthedRequestContext } from "../../router";
import { buildPage, jsonResponse, parsePagination } from "../../lib/response";
import { listApprovedCatalog } from "../../db/sourceRecords";

export const catalogHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const pagination = parsePagination(ctx.url);
  const records = await listApprovedCatalog(ctx.env.DB, { limit: pagination.limit, offset: pagination.offset });
  const items = records.map((record) => ({
    id: record.id,
    title: record.generatedTitle,
    processedDate: record.processedDate,
  }));
  return jsonResponse(buildPage(items, pagination));
});
