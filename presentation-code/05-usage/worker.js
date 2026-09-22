// Phase 5 -- staying inside the free tier. Queries Cloudflare's own GraphQL
// Analytics API for real Workers AI usage on this account, converts tokens
// into Neurons, and breaks it down by day against the 10,000/day free cap.

const FREE_NEURONS_PER_DAY = 10_000;
const USD_PER_1000_NEURONS = 0.011;

// Trimmed to just the models used elsewhere in this talk. The full ~45-model
// table lives in base-code/cloudflare-usage-worker/src/pricing.ts.
const PRICING = {
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": { input: 26_668, output: 204_805 },
  "@cf/meta/llama-3.2-3b-instruct": { input: 4_625, output: 30_475 },
  "@cf/meta/llama-3.2-1b-instruct": { input: 2_457, output: 18_252 },
  "@cf/mistralai/mistral-small-3.1-24b-instruct": { input: 31_876, output: 50_488 },
};

function calculateNeurons(model, inputTokens, outputTokens) {
  const pricing = PRICING[model];
  if (!pricing) return null;
  const neurons = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  return Math.round(neurons * 10_000) / 10_000;
}

const AI_USAGE_QUERY = `
  query AiUsage($accountTag: string!, $start: Time!, $end: Time!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        aiInferenceAdaptiveGroups(
          filter: { datetime_gt: $start, datetime_lt: $end }
          limit: 1000
          orderBy: [datetimeHour_ASC]
        ) {
          count
          sum { totalInputTokens totalOutputTokens }
          dimensions { modelId datetimeHour }
        }
      }
    }
  }
`;

async function fetchUsage(env, since, until) {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: AI_USAGE_QUERY,
      variables: { accountTag: env.CF_ACCOUNT_ID, start: since, end: until },
    }),
  });

  if (!response.ok) throw new Error(`Cloudflare GraphQL API returned HTTP ${response.status}`);

  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data?.viewer?.accounts?.[0]?.aiInferenceAdaptiveGroups ?? [];
}

function groupByDay(groups) {
  const byDay = new Map();

  for (const g of groups) {
    const date = g.dimensions.datetimeHour.slice(0, 10); // "2026-09-22T14:00:00Z" -> "2026-09-22"
    const model = g.dimensions.modelId;
    if (!byDay.has(date)) byDay.set(date, new Map());
    const models = byDay.get(date);
    const existing = models.get(model) ?? { requests: 0, inputTokens: 0, outputTokens: 0 };
    existing.requests += g.count;
    existing.inputTokens += g.sum.totalInputTokens;
    existing.outputTokens += g.sum.totalOutputTokens;
    models.set(model, existing);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, models]) => {
      const modelEntries = [...models.entries()].map(([model, m]) => ({
        model,
        ...m,
        neurons: calculateNeurons(model, m.inputTokens, m.outputTokens),
      }));
      const neurons = modelEntries.reduce((sum, m) => sum + (m.neurons ?? 0), 0);
      return { date, models: modelEntries, neurons: Math.round(neurons * 10_000) / 10_000 };
    });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/usage") {
      return new Response("GET /usage?since=<ISO8601>&until=<ISO8601>", { status: 404 });
    }
    if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
      return new Response("Worker misconfigured: set CF_API_TOKEN and CF_ACCOUNT_ID.", { status: 500 });
    }

    const now = new Date();
    const since = url.searchParams.get("since") ?? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const until = url.searchParams.get("until") ?? now.toISOString();

    let groups;
    try {
      groups = await fetchUsage(env, since, until);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    const days = groupByDay(groups);
    const totalNeurons = Math.round(days.reduce((sum, d) => sum + d.neurons, 0) * 10_000) / 10_000;

    return Response.json({
      range: { since, until },
      days,
      totalNeurons,
      freeNeuronsPerDay: FREE_NEURONS_PER_DAY,
      estimatedCostUsd: Math.round((totalNeurons / 1_000) * USD_PER_1000_NEURONS * 1e6) / 1e6,
      usageSource: "Cloudflare GraphQL Analytics API (aiInferenceAdaptiveGroups)",
    });
  },
};
