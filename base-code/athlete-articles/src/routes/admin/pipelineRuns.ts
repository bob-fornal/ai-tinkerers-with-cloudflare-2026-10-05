import { withAuth, type AuthedRequestContext } from "../../router";
import { buildPage, jsonResponse, parsePagination } from "../../lib/response";
import { listPipelineRuns } from "../../db/pipelineRuns";

export const listPipelineRunsHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const pagination = parsePagination(ctx.url);
  const runs = await listPipelineRuns(ctx.env.DB, { limit: pagination.limit, offset: pagination.offset });
  return jsonResponse(buildPage(runs, pagination));
});
