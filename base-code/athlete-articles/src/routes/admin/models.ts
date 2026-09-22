import { withAuth, type AuthedRequestContext } from "../../router";
import { Errors, jsonResponse, readJsonBody } from "../../lib/response";
import { writeAuditLog } from "../../db/auditLog";
import { getModelsConfig, putModelsConfig, type ModelsConfig } from "../../kv/models";
import { getEvalResult, putEvalResult } from "../../kv/articles";
import { crawlSourceLinks } from "../../pipeline/crawler";
import { generateArticle } from "../../pipeline/generate";

export const getModelsHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const config = await getModelsConfig(ctx.env.APP_KV);
  return jsonResponse(config);
});

interface UpdateModelsBody {
  readonly primary?: unknown;
  readonly secondary?: unknown;
  readonly backup?: unknown;
}

/**
 * Best-effort check against the model-validator-worker binding — never
 * blocks the update on it. An admin deliberately setting an experimental or
 * momentarily-unreachable-validator model shouldn't be hard-stopped; the
 * `warnings` field in the response is the signal, not a rejection. Use
 * `POST /admin/models/validate` for a check the admin can act on *before*
 * committing to a choice.
 */
async function collectValidationWarnings(
  ctx: AuthedRequestContext,
  models: ModelsConfig,
): Promise<readonly string[]> {
  try {
    const results = await ctx.env.MODEL_VALIDATOR.validateModels([models.primary, models.secondary, models.backup]);
    return results
      .filter((result) => !result.valid)
      .map((result) => `${result.model}: failed a live run check${result.error ? ` (${result.error})` : ""}`);
  } catch (error) {
    console.warn("Model validator unavailable during PUT /admin/models — proceeding without warnings:", error);
    return [];
  }
}

export const updateModelsHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const body = await readJsonBody<UpdateModelsBody>(ctx.request);
  if (!body || typeof body.primary !== "string" || typeof body.secondary !== "string" || typeof body.backup !== "string") {
    return Errors.badRequest("primary, secondary, and backup model names are all required.");
  }

  const before = await getModelsConfig(ctx.env.APP_KV);
  const after: ModelsConfig = {
    primary: body.primary,
    secondary: body.secondary,
    backup: body.backup,
    lastProcessedDate: before.lastProcessedDate,
  };
  await putModelsConfig(ctx.env.APP_KV, after);

  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: "model.update",
    targetType: "config",
    targetId: "config:models",
    detail: { before, after },
  });

  const warnings = await collectValidationWarnings(ctx, after);
  return jsonResponse({ ...after, warnings });
});

interface EvalBody {
  readonly roughTitle?: unknown;
  readonly links?: unknown;
  readonly model?: unknown;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * §8/§13 model eval tool: runs generation for an admin-supplied test topic
 * and links against one chosen model, writing only to a scratch `eval:{id}`
 * KV key — never touches source_records/source_links, so testing never
 * competes with the live backlog.
 */
export const modelEvalHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const body = await readJsonBody<EvalBody>(ctx.request);
  if (!body || typeof body.roughTitle !== "string" || !isStringArray(body.links) || typeof body.model !== "string") {
    return Errors.badRequest("roughTitle, links, and model are required.");
  }
  if (body.links.length === 0) {
    return Errors.badRequest("At least one link is required.");
  }

  const { pages, failures } = await crawlSourceLinks(body.links, ctx.env);
  if (pages.length === 0) {
    return Errors.badRequest(`Failed to fetch any of the supplied links: ${failures.map((f) => f.reason).join("; ")}`);
  }

  const generated = await generateArticle(ctx.env.AI, body.model, body.roughTitle, pages);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await putEvalResult(ctx.env.APP_KV, id, {
    roughTitle: body.roughTitle,
    links: body.links,
    generatedTitle: generated.title,
    body: generated.body,
    modelUsed: body.model,
    aiTellReport: generated.aiTellReport,
    createdAt,
  });

  return jsonResponse({ id, roughTitle: body.roughTitle, generatedTitle: generated.title, body: generated.body, modelUsed: body.model, aiTellReport: generated.aiTellReport, createdAt }, { status: 201 });
});

export const getModelEvalHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = ctx.params.id ?? "";
  const result = await getEvalResult(ctx.env.APP_KV, id);
  if (!result) return Errors.notFound("Eval result not found.");
  return jsonResponse(result);
});
