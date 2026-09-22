# Phase 5 — Usage & cost analysis API

**Budget: ~2 min.** The "the built-in dashboard page exists, but it's thin"
phase. Deploy ahead of the talk — token setup alone isn't worth burning stage
time on.

## What it does

`GET /usage?since=<ISO8601>&until=<ISO8601>` queries Cloudflare's own GraphQL
Analytics API for real Workers AI usage on this account, buckets it by day,
and converts tokens into Neurons against the 10,000/day free-tier cap.
Defaults to the trailing 24 hours if `since`/`until` are omitted.

This isn't the only way to see Workers AI usage — Cloudflare's dashboard has
its own page at `dash.cloudflare.com/<account_id>/ai/workers-ai/usage`. The
point of this phase isn't "Cloudflare gives you nothing," it's that the
dashboard page's detail is thin — no daily breakdown, no per-model neuron/cost
math, no queryable range — and this API fills that specific gap.

This Worker never calls Workers AI itself — it only reads Cloudflare's
Analytics API about usage from *other* Workers on the account (including the
ones from Phases 1–4, if you've been calling them while prepping this talk).

## Infrastructure

| Needed | Required? |
|---|---|
| `AI` binding | No |
| Environment variables / secrets | Yes — `CF_API_TOKEN`, `CF_ACCOUNT_ID` |
| KV namespace | No (pricing table is an inline JS constant for this demo, not KV-backed — see below) |
| Database | No |

`CF_API_TOKEN` needs the **Account Analytics: Read** permission. Create it at
My Profile → API Tokens → Create Token (custom token) in the dashboard.
`CF_ACCOUNT_ID` is visible on the right sidebar of any zone/account overview
page in the dashboard.

## Deploy (dashboard, no local tooling)

1. Create a Worker, paste in `worker.js`.
2. Settings → Variables → add `CF_ACCOUNT_ID` as a plain text var, and
   `CF_API_TOKEN` as an **encrypted** var (secret).
3. Save and deploy.

## Live demo script

1. State the constraint: 10,000 Neurons/day, free tier.
2. Show Cloudflare's own dashboard usage page
   (`dash.cloudflare.com/<account_id>/ai/workers-ai/usage`) first — it's
   real, it's not nothing, but there's not much on it.
3. Hit `/usage` on the already-deployed Worker with no query params —
   trailing 24h of whatever's been called during rehearsal/setup. Rehearsing
   Phases 1–4 in the day or so before the talk is what gives this phase real
   numbers to show instead of an empty response.
4. Point at the `days[]` array — this is the daily, per-model breakdown the
   dashboard page doesn't give you.
5. Point at `freeNeuronsPerDay` next to `totalNeurons` — the actual "are we
   inside budget" check, in one field.
6. Land it: "Cloudflare gives you a usage page. It just doesn't give you
   this level of detail — that part's on you to build."

```bash
curl "https://<your-worker>.workers.dev/usage"
```

## Simplification made for this demo (flagging it, not hiding it)

`base-code/cloudflare-usage-worker` is essentially complete already and uses
a KV-backed, admin-editable pricing table with PUT/PATCH/reset routes and a
~45-model seed. For a 2-minute slot, that's the wrong shape: this phase
inlines a 4-model pricing table (just the models used elsewhere in the talk)
as a plain JS constant, and drops the admin pricing routes entirely. If you
want the editable-pricing story back in, `base-code/cloudflare-usage-worker/src/pricing.ts`
and `pricingStore.ts` are the source to restore from.
