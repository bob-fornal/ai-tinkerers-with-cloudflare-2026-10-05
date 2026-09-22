# ai-cf-usage-worker

A Cloudflare Worker API for tracking **Workers AI** neuron usage and estimating its
USD cost — broken down by model and by day.

It queries Cloudflare's own GraphQL Analytics API for real token usage per model,
then converts that into neurons and cost using a pricing table stored in Workers KV
(so the table can be corrected/updated without a redeploy).

## How it works

1. **Usage** comes from Cloudflare's GraphQL Analytics API (`aiInferenceAdaptiveGroups`
   dataset), which reports actual `totalInputTokens` / `totalOutputTokens` per model
   per hour for your account. This is real, billed usage — not a guess.
2. **Neurons and cost** aren't included in that dataset, so this Worker converts
   tokens → neurons → USD itself, using a per-model pricing table (neurons per
   million input/output tokens) seeded from Cloudflare's
   [Workers AI pricing page](https://developers.cloudflare.com/workers-ai/platform/pricing/).
3. That pricing table lives in a Workers KV namespace, not hardcoded, so it can be
   corrected or extended via API as Cloudflare changes rates or ships new models —
   without redeploying the Worker.

## Setup

```bash
npm install
```

Configure bindings in [`wrangler.jsonc`](wrangler.jsonc):

- `vars.CF_ACCOUNT_ID` — the Cloudflare account ID that owns the Workers AI usage.
- `kv_namespaces` — a KV namespace bound as `PRICING_KV` (create one with
  `wrangler kv namespace create PRICING_KV` if you don't have one yet).

Set secrets:

```bash
wrangler secret put CF_API_TOKEN
```
API token needs the **Account Analytics: Read** permission (create one at
`dash.cloudflare.com > Account API Tokens`).

```bash
wrangler secret put PRICING_ADMIN_TOKEN
```
Any strong random value — required as a bearer token to write to `/api/pricing`.
Generate one with e.g. `openssl rand -hex 32`.

```bash
wrangler secret put API_KEY
```
Any strong random value — required as the `x-api-key` header on **every** request
to this Worker. This is a static, non-rotating key (see [Authentication](#authentication)).
Generate one with e.g. `openssl rand -hex 32`.

Seed the pricing table into KV (first run only — see [`/api/pricing/reset`](#post-apipricingreset)):

```bash
curl -X POST https://<your-worker>/api/pricing/reset \
  -H "x-api-key: <API_KEY>" \
  -H "Authorization: Bearer <PRICING_ADMIN_TOKEN>"
```

Run locally against real Cloudflare resources, or deploy:

```bash
npm run dev      # wrangler dev --remote-style bindings, see wrangler docs
npm run deploy
```

## Authentication

Every request to every route — reads included — must carry a static API key:

```
x-api-key: <API_KEY>
```

Missing or wrong key → `401 Unauthorized`, before the request is routed at all (an
unknown path with a bad/missing key also returns 401, not 404 — the router never
sees it). If `API_KEY` isn't configured on the Worker, requests fail with `500`
rather than silently allowing them through.

This key is a single static secret with no built-in rotation or expiry — it's meant
to identify a trusted caller (e.g. a dashboard or scheduled job), not individual
users. Rotate it manually if it ever leaks: `wrangler secret put API_KEY` with a
new value immediately invalidates the old one everywhere.

Writes to `/api/pricing` need a **second**, separate credential on top of the API
key — `Authorization: Bearer <PRICING_ADMIN_TOKEN>` — so that holding the general
API key alone isn't enough to change the numbers every `/api/usage` caller sees.

## API

All responses are JSON. Errors are `{ "error": string, "detail"?: string }` with a
4xx/5xx status. Every example below includes the required `x-api-key` header.

### `GET /api/usage`

Returns neuron usage and estimated cost for a time range, broken down by day and by
model within each day, plus range-wide totals.

**Query parameters** (all optional):

| Param   | Default             | Description                                            |
|---------|----------------------|---------------------------------------------------------|
| `since` | 24 hours ago         | ISO 8601 UTC timestamp, e.g. `2026-08-27T00:00:00Z`      |
| `until` | now                  | ISO 8601 UTC timestamp                                   |
| `limit` | `1000` (max `10000`) | Max (model, hour) rows pulled from the Analytics API     |

**Example**

```bash
curl "https://<your-worker>/api/usage?since=2026-08-25T00:00:00Z&until=2026-08-28T00:00:00Z" \
  -H "x-api-key: <API_KEY>"
```

```json
{
  "range": { "since": "2026-08-25T00:00:00Z", "until": "2026-08-28T00:00:00Z" },
  "days": [
    {
      "date": "2026-08-27",
      "models": [
        {
          "model": "@cf/meta/llama-3.1-8b-instruct",
          "requests": 15,
          "inputTokens": 1200000,
          "outputTokens": 600000,
          "neurons": 75817.8,
          "costUsd": 0.833996
        }
      ],
      "subtotal": {
        "requests": 15,
        "inputTokens": 1200000,
        "outputTokens": 600000,
        "neurons": 75817.8,
        "costUsd": 0.833996
      }
    }
  ],
  "modelsSummary": [ /* same shape as a day's "models", aggregated across the whole range */ ],
  "totals": {
    "requests": 15,
    "inputTokens": 1200000,
    "outputTokens": 600000,
    "neurons": 75817.8,
    "costUsd": 0.833996,
    "freeNeuronsPerDay": 10000
  },
  "pricingSource": "kv",
  "usageSource": "Cloudflare GraphQL Analytics API (aiInferenceAdaptiveGroups)"
}
```

Notes:
- `pricingSource` is `"kv"` once you've seeded the table, or `"seed-fallback"` if
  KV is empty (the Worker falls back to its built-in table so it never hard-fails).
- A model not in the pricing table still appears with `neurons: null, costUsd: null`
  and a `note` explaining why — it isn't silently dropped.
- Models priced per image/step/audio-minute/character (anything other than tokens)
  can't be measured from this dataset (it only reports tokens), so they also come
  back with `neurons: 0` and an explanatory `note`.
- If the `limit` is hit, the response includes a top-level `note` warning that some
  rows may be missing — narrow the range or raise `limit` instead of trusting the total.
- Data comes from an `AdaptiveGroups` dataset, which uses statistical sampling —
  treat figures as accurate estimates, not exact-to-the-token counts.

### `GET /api/pricing`

Returns the current pricing table.

```bash
curl https://<your-worker>/api/pricing -H "x-api-key: <API_KEY>"
```

```json
{ "pricing": { "@cf/meta/llama-3.1-8b-instruct": { "unit": "tokens", "neuronsPerMillionInputTokens": 25608, "neuronsPerMillionOutputTokens": 75147 }, "...": "..." },
  "source": "kv",
  "updatedAt": "2026-08-28T16:35:35.099Z" }
```

Pricing entries are one of two shapes:

```jsonc
// Token-metered (LLMs, embeddings) — the only kind /api/usage can compute from
{ "unit": "tokens", "neuronsPerMillionInputTokens": 25608, "neuronsPerMillionOutputTokens": 75147 }

// Everything else (image/audio/etc.) — reference only
{ "unit": "other", "description": "Per audio minute", "rates": { "perAudioMinute": 41.14 } }
```

### `PUT /api/pricing` (api key + admin token required)

Replaces the entire pricing table. Body is a JSON object mapping model ID → pricing
entry (same shape as above). Rejects the request (400) if any entry is malformed.

```bash
curl -X PUT https://<your-worker>/api/pricing \
  -H "x-api-key: <API_KEY>" \
  -H "Authorization: Bearer <PRICING_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "@cf/meta/llama-3.1-8b-instruct": { "unit": "tokens", "neuronsPerMillionInputTokens": 25608, "neuronsPerMillionOutputTokens": 75147 } }'
```

### `PATCH /api/pricing` (api key + admin token required)

Upserts specific models into the existing table (merge, not replace). Use this to
add a newly released model or correct one or two rates without resending everything.

```bash
curl -X PATCH https://<your-worker>/api/pricing \
  -H "x-api-key: <API_KEY>" \
  -H "Authorization: Bearer <PRICING_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "@cf/new/model-x": { "unit": "tokens", "neuronsPerMillionInputTokens": 1000, "neuronsPerMillionOutputTokens": 5000 } }'
```

### `POST /api/pricing/reset` (api key + admin token required)

Overwrites the KV-stored table with the Worker's built-in seed table (see
[`src/pricing.ts`](src/pricing.ts)). Use this for first-time setup, or to roll back
after a bad manual edit.

```bash
curl -X POST https://<your-worker>/api/pricing/reset \
  -H "x-api-key: <API_KEY>" \
  -H "Authorization: Bearer <PRICING_ADMIN_TOKEN>"
```

## Keeping pricing current

Cloudflare updates Workers AI pricing and adds new models over time. The seed table
in [`src/pricing.ts`](src/pricing.ts) is a snapshot, not a live feed, and the KV
copy doesn't refresh itself. `scripts/fetch-pricing.mjs` automates checking for
changes and applying them.

```bash
# 1. Just look at what's on the page right now (no network calls to your Worker)
node scripts/fetch-pricing.mjs
```

```bash
# 2. Diff the live page against what's actually stored in KV right now
node scripts/fetch-pricing.mjs \
  --worker-url https://<your-worker> \
  --api-key <API_KEY>
```
Prints a summary to stderr: how many models are new, changed, unchanged, or present
in KV but no longer listed on the page (kept as-is — the script never deletes).

```bash
# 3. Apply just the new/changed models to KV (via PATCH — existing untouched
#    entries are left alone)
node scripts/fetch-pricing.mjs \
  --worker-url https://<your-worker> \
  --api-key <API_KEY> \
  --admin-token <PRICING_ADMIN_TOKEN> \
  --push
```

Other flags:
- `--source <url|path>` — parse a local HTML file instead of fetching, for testing
  or offline use.
- `--out <path>` — write the parsed table to a file instead of stdout (useful with
  the no-`--worker-url` form, to hand-review or manually `curl -d @file.json` it
  into `PUT`/`PATCH /api/pricing` yourself instead of using `--push`).

**Review before pushing.** Token-priced models (LLMs, embeddings) are parsed
precisely — model ID and neuron rates come straight off the page. "Other"-unit
models (image/audio/etc.) get an auto-generated `description` and `rates` key
names (e.g. `perAudioMinuteInput`) that are a best-effort readable label, not
guaranteed to match any existing convention — check those before relying on them,
though (as always) they don't affect any computed cost since `/api/usage` can't
measure non-token usage anyway.

## Project layout

```
src/
  index.ts             Routing and request handlers
  graphql.ts            Cloudflare GraphQL Analytics API client
  pricing.ts             Seed pricing table + token→neuron→cost math
  pricingStore.ts       KV read/write/merge/validate for the live pricing table
  usageAggregation.ts   Buckets usage rows into per-day / per-model / range totals
  types.ts               Shared types (Env, pricing, GraphQL response shapes)
scripts/
  fetch-pricing.mjs     Parses the live pricing page into a PricingTable JSON,
                        optionally diffs/pushes it against a deployed Worker
docs/
  CHANGELOG.md          Chronological log of what was built and why
```
