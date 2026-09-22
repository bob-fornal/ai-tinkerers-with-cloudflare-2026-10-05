import { withAuth, type AuthedRequestContext } from "../../router";
import { Errors, buildPage, jsonResponse, parsePagination, readJsonBody } from "../../lib/response";
import { writeAuditLog } from "../../db/auditLog";
import {
  createSourceRecord,
  getSourceRecordById,
  listSourceRecords,
  listStuckSourceRecords,
  resetForRequeue,
  setReviewStatus,
  setReviewStatusFromApproved,
  updateSourceRecordLinksAndTitle,
  type SourceRecordFilter,
} from "../../db/sourceRecords";
import { listLinksForRecord, replaceLinksForRecord } from "../../db/sourceLinks";
import { listRecentFailuresForRecord } from "../../db/pipelineRuns";
import { runPipelineForRecord } from "../../pipeline/run";
import { getArticle } from "../../kv/articles";
import type { ReviewStatus, SourceRecord } from "../../db/types";

/**
 * A processed record's generated title/body/aiTellReport live in KV, not
 * D1 (§7) — the review queue and detail views need the actual article
 * content to do their job, not just the D1 row's metadata, so every read
 * path that shows a record to an admin attaches it here.
 */
async function withArticle(kv: KVNamespace, record: SourceRecord) {
  if (!record.kvArticleKey) {
    return { ...record, article: null };
  }
  const article = await getArticle(kv, record.kvArticleKey);
  return { ...record, article };
}

interface CreateSourceRecordBody {
  readonly roughTitle?: unknown;
  readonly links?: unknown;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export const createSourceRecordHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const body = await readJsonBody<CreateSourceRecordBody>(ctx.request);
  if (!body || typeof body.roughTitle !== "string" || body.roughTitle.trim().length === 0) {
    return Errors.badRequest("roughTitle is required.");
  }
  if (!isStringArray(body.links) || body.links.length === 0) {
    return Errors.badRequest("links must be a non-empty array of URLs.");
  }

  const record = await createSourceRecord(ctx.env.DB, { roughTitle: body.roughTitle, links: body.links });
  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: "source_record.create",
    targetType: "source_record",
    targetId: String(record.id),
    detail: { roughTitle: record.roughTitle, links: body.links },
  });
  return jsonResponse(record, { status: 201 });
});

export const listSourceRecordsHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const pagination = parsePagination(ctx.url);
  const processedParam = ctx.url.searchParams.get("processed");
  const reviewStatusParam = ctx.url.searchParams.get("reviewStatus");
  const stuckParam = ctx.url.searchParams.get("stuck");
  const filter: SourceRecordFilter = {
    ...(processedParam !== null ? { processed: processedParam === "true" } : {}),
    ...(reviewStatusParam !== null ? { reviewStatus: reviewStatusParam as ReviewStatus } : {}),
    ...(stuckParam !== null ? { stuck: stuckParam === "true" } : {}),
  };

  const sort = ctx.url.searchParams.get("sort") ?? undefined;
  const direction = ctx.url.searchParams.get("direction") === "asc" ? "asc" : "desc";

  const records = await listSourceRecords(ctx.env.DB, {
    filter,
    sort,
    direction,
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return jsonResponse(buildPage(records, pagination));
});

export const getSourceRecordDetailHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = Number(ctx.params.id);
  const record = await getSourceRecordById(ctx.env.DB, id);
  if (!record) return Errors.notFound("Source record not found.");
  const [links, withArticleData] = await Promise.all([
    listLinksForRecord(ctx.env.DB, id),
    withArticle(ctx.env.APP_KV, record),
  ]);
  return jsonResponse({ ...withArticleData, links });
});

interface PatchSourceRecordBody {
  readonly roughTitle?: unknown;
  readonly links?: unknown;
}

export const patchSourceRecordHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = Number(ctx.params.id);
  const existing = await getSourceRecordById(ctx.env.DB, id);
  if (!existing) return Errors.notFound("Source record not found.");
  if (existing.processed) return Errors.conflict("Cannot edit a record that has already been processed.");

  const body = await readJsonBody<PatchSourceRecordBody>(ctx.request);
  if (!body) return Errors.badRequest("Invalid JSON body.");

  const before = { roughTitle: existing.roughTitle };
  let updated = existing;

  if (typeof body.roughTitle === "string") {
    const result = await updateSourceRecordLinksAndTitle(ctx.env.DB, id, { roughTitle: body.roughTitle });
    if (result) updated = result;
  }
  if (body.links !== undefined) {
    if (!isStringArray(body.links) || body.links.length === 0) {
      return Errors.badRequest("links must be a non-empty array of URLs.");
    }
    await replaceLinksForRecord(ctx.env.DB, id, body.links);
  }

  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: "source_record.edit",
    targetType: "source_record",
    targetId: String(id),
    detail: { before, after: { roughTitle: updated.roughTitle, links: body.links } },
  });

  const links = await listLinksForRecord(ctx.env.DB, id);
  return jsonResponse({ ...updated, links });
});

export const reviewQueueHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const pagination = parsePagination(ctx.url);
  const records = await listSourceRecords(ctx.env.DB, {
    filter: { reviewStatus: "pending" },
    sort: "createdAt",
    direction: "asc",
    limit: pagination.limit,
    offset: pagination.offset,
  });
  const withArticles = await Promise.all(records.map((record) => withArticle(ctx.env.APP_KV, record)));
  return jsonResponse(buildPage(withArticles, pagination));
});

export const approveSourceRecordHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = Number(ctx.params.id);
  const updated = await setReviewStatus(ctx.env.DB, id, "approved");
  if (!updated) return Errors.notFound("Source record not found.");
  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: "source_record.approve",
    targetType: "source_record",
    targetId: String(id),
    detail: { reviewStatus: "approved" },
  });
  return jsonResponse(updated);
});

interface RejectBody {
  readonly requeue?: unknown;
}

export const rejectSourceRecordHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = Number(ctx.params.id);
  const body = await readJsonBody<RejectBody>(ctx.request);
  const requeue = body?.requeue === true;

  const updated = requeue ? await resetForRequeue(ctx.env.DB, id) : await setReviewStatus(ctx.env.DB, id, "rejected");
  if (!updated) return Errors.notFound("Source record not found.");

  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: "source_record.reject",
    targetType: "source_record",
    targetId: String(id),
    detail: { requeue },
  });
  return jsonResponse(updated);
});

export const deprecateSourceRecordHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = Number(ctx.params.id);
  const updated = await setReviewStatusFromApproved(ctx.env.DB, id, "deprecated");
  if (!updated) return Errors.conflict("Only an approved record can be deprecated.");
  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: "source_record.deprecate",
    targetType: "source_record",
    targetId: String(id),
    detail: { reviewStatus: "deprecated" },
  });
  return jsonResponse(updated);
});

export const generateSourceRecordHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = Number(ctx.params.id);
  const record = await getSourceRecordById(ctx.env.DB, id);
  if (!record) return Errors.notFound("Source record not found.");

  const outcome = await runPipelineForRecord(ctx.env, record);

  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: "source_record.generate",
    targetType: "source_record",
    targetId: String(id),
    detail: { outcome: outcome.status },
  });

  if (outcome.status === "skipped_empty_backlog") {
    return Errors.internal("Unexpected pipeline outcome for a targeted generate.");
  }
  return jsonResponse(outcome);
});

export const stuckSourceRecordsHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const records = await listStuckSourceRecords(ctx.env.DB);
  const withFailures = await Promise.all(
    records.map(async (record) => ({
      ...record,
      recentFailures: await listRecentFailuresForRecord(ctx.env.DB, record.id),
    })),
  );
  return jsonResponse({ items: withFailures });
});
