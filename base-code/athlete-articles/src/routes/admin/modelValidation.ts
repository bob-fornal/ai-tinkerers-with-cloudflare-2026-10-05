import { withAuth, type AuthedRequestContext } from "../../router";
import { Errors, jsonResponse, readJsonBody } from "../../lib/response";

interface ValidateModelsBody {
  readonly models?: unknown;
  readonly model?: unknown;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Calls the model-validator-worker's RPC binding (env.MODEL_VALIDATOR) to
 * check one or more Workers AI model names against the live Cloudflare
 * model catalog — whether each one currently exists and whether it's
 * deprecated. Lets the Admin App's model management UI check a model
 * *before* setting it as primary/secondary/backup (§8), separately from the
 * best-effort check `PUT /admin/models` itself also does.
 */
export const validateModelsHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const body = await readJsonBody<ValidateModelsBody>(ctx.request);
  const models = isStringArray(body?.models)
    ? body.models
    : typeof body?.model === "string"
      ? [body.model]
      : null;

  if (!models || models.length === 0) {
    return Errors.badRequest("Provide either `model` (string) or `models` (non-empty string array).");
  }

  try {
    const results = await ctx.env.MODEL_VALIDATOR.validateModels(models);
    return jsonResponse({ results });
  } catch (error) {
    return Errors.internal(`Model validator is unavailable: ${String(error)}`);
  }
});
