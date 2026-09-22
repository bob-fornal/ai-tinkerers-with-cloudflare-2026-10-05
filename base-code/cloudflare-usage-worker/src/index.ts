import { fetchAiInferenceUsage } from "./graphql";
import { FREE_NEURONS_PER_DAY } from "./pricing";
import { loadPricingTable, mergePricingEntries, resetPricingTable, savePricingTable, validatePricingTable } from "./pricingStore";
import type { Env, ModelPricing } from "./types";
import { groupUsageByDay, summarizeModelsAcrossDays, sumTotals } from "./usageAggregation";

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 10_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseTimeRange(url: URL): { since: string; until: string } | { error: string } {
  const now = new Date();
  const defaultSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const sinceParam = url.searchParams.get("since");
  const untilParam = url.searchParams.get("until");

  const since = sinceParam ?? defaultSince.toISOString();
  const until = untilParam ?? now.toISOString();

  if (Number.isNaN(Date.parse(since))) return { error: `Invalid 'since' timestamp: ${since}` };
  if (Number.isNaN(Date.parse(until))) return { error: `Invalid 'until' timestamp: ${until}` };

  return { since, until };
}

function parseLimit(url: URL): number | { error: string } {
  const param = url.searchParams.get("limit");
  if (!param) return DEFAULT_LIMIT;

  const limit = Number(param);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `'limit' must be an integer between 1 and ${MAX_LIMIT}` };
  }
  return limit;
}

function requireApiKey(request: Request, env: Env): Response | null {
  if (!env.API_KEY) {
    return json({ error: "API_KEY is not configured on this Worker." }, 500);
  }
  const key = request.headers.get("x-api-key");
  if (key !== env.API_KEY) {
    return json({ error: "Unauthorized. Pass a valid 'x-api-key' header." }, 401);
  }
  return null;
}

function requireAdmin(request: Request, env: Env): Response | null {
  if (!env.PRICING_ADMIN_TOKEN) {
    return json({ error: "PRICING_ADMIN_TOKEN is not configured on this Worker." }, 500);
  }
  const auth = request.headers.get("authorization") ?? "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || token !== env.PRICING_ADMIN_TOKEN) {
    return json({ error: "Unauthorized. Pass 'Authorization: Bearer <PRICING_ADMIN_TOKEN>'." }, 401);
  }
  return null;
}

async function handleUsage(url: URL, env: Env): Promise<Response> {
  const range = parseTimeRange(url);
  if ("error" in range) return json({ error: range.error }, 400);

  const limit = parseLimit(url);
  if (typeof limit !== "number") return json({ error: limit.error }, 400);

  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return json(
      { error: "Worker is missing CF_API_TOKEN and/or CF_ACCOUNT_ID configuration." },
      500
    );
  }

  let usage;
  try {
    usage = await fetchAiInferenceUsage(env, range.since, range.until, limit);
  } catch (err) {
    return json({ error: "Failed to query Cloudflare GraphQL Analytics API", detail: String(err) }, 502);
  }

  const { table: pricingTable, source: pricingSource } = await loadPricingTable(env);
  const groups = usage.viewer.accounts[0]?.aiInferenceAdaptiveGroups ?? [];

  const days = groupUsageByDay(groups, pricingTable);
  const modelsSummary = summarizeModelsAcrossDays(days, pricingTable);
  const totals = sumTotals(modelsSummary);

  return json({
    range,
    days,
    modelsSummary,
    totals: { ...totals, freeNeuronsPerDay: FREE_NEURONS_PER_DAY },
    pricingSource,
    usageSource: "Cloudflare GraphQL Analytics API (aiInferenceAdaptiveGroups)",
    note:
      groups.length >= limit
        ? `Row limit (${limit}) reached — some (modelId, hour) combinations in this range may be missing. Narrow the range or raise 'limit'.`
        : undefined,
  });
}

async function handleGetPricing(env: Env): Promise<Response> {
  const { table, source, updatedAt } = await loadPricingTable(env);
  return json({ pricing: table, source, updatedAt });
}

async function handlePutPricing(request: Request, env: Env): Promise<Response> {
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  try {
    validatePricingTable(body);
  } catch (err) {
    return json({ error: String((err as Error).message) }, 400);
  }

  const updatedAt = new Date().toISOString();
  await savePricingTable(env, body, updatedAt);
  return json({ ok: true, modelsStored: Object.keys(body).length, updatedAt });
}

async function handlePatchPricing(request: Request, env: Env): Promise<Response> {
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  try {
    validatePricingTable(body);
  } catch (err) {
    return json({ error: String((err as Error).message) }, 400);
  }

  const updatedAt = new Date().toISOString();
  const merged = await mergePricingEntries(env, body as Record<string, ModelPricing>, updatedAt);
  return json({ ok: true, modelsUpdated: Object.keys(body).length, modelsStored: Object.keys(merged).length, updatedAt });
}

async function handleResetPricing(request: Request, env: Env): Promise<Response> {
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const updatedAt = new Date().toISOString();
  const table = await resetPricingTable(env, updatedAt);
  return json({ ok: true, modelsStored: Object.keys(table).length, updatedAt });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const deniedKey = requireApiKey(request, env);
    if (deniedKey) return deniedKey;

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/usage") {
      return handleUsage(url, env);
    }
    if (request.method === "GET" && url.pathname === "/api/pricing") {
      return handleGetPricing(env);
    }
    if (request.method === "PUT" && url.pathname === "/api/pricing") {
      return handlePutPricing(request, env);
    }
    if (request.method === "PATCH" && url.pathname === "/api/pricing") {
      return handlePatchPricing(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/pricing/reset") {
      return handleResetPricing(request, env);
    }

    return json(
      {
        error: "Not found",
        note: "Every route requires an 'x-api-key' header. Routes marked (admin) additionally require 'Authorization: Bearer <PRICING_ADMIN_TOKEN>'.",
        routes: [
          "GET /api/usage?since=<ISO8601>&until=<ISO8601>&limit=<1-10000> — daily subtotals + range totals",
          "GET /api/pricing",
          "PUT /api/pricing (admin) — replace the whole table",
          "PATCH /api/pricing (admin) — upsert specific models",
          "POST /api/pricing/reset (admin) — restore the built-in seed table",
        ],
      },
      404
    );
  },
};
