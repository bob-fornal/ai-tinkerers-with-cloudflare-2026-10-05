import { withAuth, type AuthedRequestContext } from "../../router";
import { buildPage, jsonResponse, parsePagination } from "../../lib/response";
import { listAuditLog } from "../../db/auditLog";

export const listAuditLogHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const pagination = parsePagination(ctx.url);
  const filter = {
    actorId: ctx.url.searchParams.get("actorId") ?? undefined,
    action: ctx.url.searchParams.get("action") ?? undefined,
    targetType: ctx.url.searchParams.get("targetType") ?? undefined,
  };
  const entries = await listAuditLog(ctx.env.DB, { filter, limit: pagination.limit, offset: pagination.offset });
  return jsonResponse(buildPage(entries, pagination));
});
