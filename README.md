# AI Tinkerers with Cloudflare

Live-code presentation repo for a walkthrough of Cloudflare Workers AI — built by reconstructing, on stage, the actual path from "read the getting-started guide" to "found the parts of the platform that are still rough." That includes the parts that broke.

Full background, the phase-by-phase story, the code inventory, and the demo run-of-show live in [`PRD.md`](PRD.md). Start there if you want the why. This file covers the what and how.

## Status

Early stage — this repo currently holds the planning docs (`PRD.md`, this `README.md`). The Worker code for each phase gets built out next, matching the code inventory in the PRD.

## What gets covered

1. **The model catalog problem** — why hard-coding a Workers AI model ID is a bad idea, demonstrated with a real deprecation.
2. **Article summarization Worker** — title + source articles in, generated summary out.
3. **Primary/fallback models via env vars** — recovering from a dead model ID at request time instead of at deploy time.
4. **A model evaluation harness** — fixed inputs, a reference summary, and a repeatable way to compare candidate models before switching to them.
5. **A gated humanizer** — a first attempt (a two-sentence micro-summary) that didn't hold up, replaced by deterministic JS gates plus a targeted small-model fix for whatever fails a gate.
6. **Usage and cost tracking** — an API for staying inside the 10,000-neuron/day free tier, with a daily breakdown.
7. **JS vs. TS vs. Python performance** — the same AI call, three languages, compared.
8. **Image generation** — inconsistent parameters across models, an NSFW false positive, and an honest look at the reference-image flow that never worked.

See [`PRD.md`](PRD.md#8-phased-implementation-plan-steps-not-code) for the full step-by-step for each phase.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with Workers AI enabled.
- [Node.js](https://nodejs.org/) (LTS).
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`, or run via `npx wrangler`).
- `wrangler login` completed against the account above.

## Running locally (once the Worker code lands)

```bash
npm install
npx wrangler dev
```

Model IDs are read from environment variables, not hard-coded — set these before running:

```bash
PRIMARY_MODEL=<model-id-from-catalog>
FALLBACK_MODEL=<model-id-from-catalog>
```

Current model IDs live at [developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/) — treat that page as a dependency, not a one-time reference. It moves.

## Repo layout (planned)

```
src/
  index.ts        # Worker entry point / router
  summarize.ts     # title + articles -> summary, primary/fallback model logic
  evaluate.ts       # model comparison harness against the reference summary
  humanizer/         # JS gates + targeted small-model fix for flagged text
  usage.ts          # neuron usage/cost API, daily breakdown
  image.ts          # image generation, per-model parameter handling
workers/
  js/, ts/, py/    # matched implementations for the language performance comparison
data/
  reference-articles.json
  reference-summary.md
PRD.md
README.md
```

## Reference links

- [Workers AI: get started with Wrangler](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/)
- [Workers AI model catalog](https://developers.cloudflare.com/workers-ai/models/)
