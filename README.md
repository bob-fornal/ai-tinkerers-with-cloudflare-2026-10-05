# AI Tinkerers with Cloudflare

Live-code presentation repo for a walkthrough of Cloudflare Workers AI — built by reconstructing, on stage, the actual path from "read the getting-started guide" to "found the parts of the platform that are still rough." That includes the parts that broke.

Full background, the phase-by-phase story, the code inventory, and the demo run-of-show live in [`PRD.md`](PRD.md). Start there if you want the why. This file covers the what and how.

**This is a 15-minute talk.** Every phase is deployed ahead of time — none of
it gets typed from scratch on stage. The show is walking through
already-written code and operating the already-deployed Workers. See
[`presentation-code/README.md`](presentation-code/README.md) for the
per-phase time budget and exactly what happens on stage for each one.

**Three operational docs, in the order you'll actually use them:**
1. [`DEPLOYMENT.md`](DEPLOYMENT.md) — setup checklist, done once ahead of the talk (or re-run whenever a phase's code changes).
2. [`PRE-PRESENTATION.md`](PRE-PRESENTATION.md) — what to re-check the day before and the morning of.
3. [`SCRIPT.md`](SCRIPT.md) — the run-of-show, with pacing checkpoints and a ranked cut order for when you're running behind.

## Status

Planning docs and all eight phases of `presentation-code/` are built.
`base-code/` holds the real source this journey grew out of — a larger
production app, the usage/cost worker, and two image-generation attempts —
kept as reference and mining material, not demoed directly.
`presentation-code/` is the lean, phase-by-phase demo code actually shown on
stage, extracted and simplified from `base-code/` per the mapping in
[`PRD.md`](PRD.md#7-code-inventory-final-solutions-needed).

## What gets covered

1. **The model catalog problem** — why hard-coding a Workers AI model ID is a bad idea, demonstrated with a real deprecation.
2. **Article summarization Worker** — title + source articles in, generated summary out.
3. **The silent token-limit bug** — `max_tokens` defaults to 256 and Workers AI truncates without an error; one field fixes it.
4. **Primary/fallback models via env vars** — recovering from a dead model ID at request time instead of at deploy time.
5. **A model evaluation harness** — fixed inputs, a reference summary, and a repeatable way to compare candidate models before switching to them.
6. **A gated humanizer** — a first attempt (a two-sentence micro-summary) that didn't hold up, replaced by deterministic JS gates plus a targeted small-model fix for whatever fails a gate.
7. **Usage and cost tracking** — an API for staying inside the 10,000-neuron/day free tier, with a daily breakdown.
8. **JS vs. TS vs. Python performance** — the same AI call, three languages, compared.
9. **Image generation** — inconsistent parameters across models, an NSFW false positive, and an honest look at the reference-image flow that never worked.

See [`PRD.md`](PRD.md#8-phased-implementation-plan-steps-not-code) for the full step-by-step for each phase.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with Workers AI enabled. That's it for Phases 1–5 and 7.
- **Phase 6 is the one exception.** Python Workers aren't deployable through the dashboard's Quick Edit, so that phase alone needs [Node.js](https://nodejs.org/) (LTS) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/) locally (`npm install -g wrangler`, then `wrangler login`).

## Deploying ahead of the talk (Phases 1a–5, 7 — dashboard paste-in, no local tooling)

Each of these phases is a single `worker.js` file with no `package.json`, no `tsconfig.json`, and no `wrangler.toml`/`wrangler.jsonc` — written to be pasted directly into the Cloudflare dashboard's Quick Edit editor, done before you go on stage:

1. Create a Worker in the dashboard.
2. Open Quick Edit and paste in the phase's `worker.js`.
3. Under Settings, add the bindings/secrets that phase needs — see the table in [`presentation-code/README.md`](presentation-code/README.md#bindings-env-vars-kv--db--at-a-glance) (in short: the `AI` binding everywhere, `PRIMARY_MODEL`/`FALLBACK_MODEL` from Phase 2 on, one optional KV namespace in Phase 3 only, and two Cloudflare API secrets in Phase 5 only).
4. Save and deploy from the dashboard.

Model IDs are never hard-coded past Phase 1b — they're read from `env.PRIMARY_MODEL` / `env.FALLBACK_MODEL`, set as dashboard variables. Current model IDs live at [developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/) — treat that page as a dependency, not a one-time reference. It moves.

On stage, none of this deploy sequence happens — you're just hitting the already-deployed URLs. Phase 2 is the one exception: flipping `PRIMARY_MODEL` to a garbage value and redeploying happens live, but that's a variable edit and a click, not code-typing.

## Deploying Phase 6 ahead of the talk

```bash
cd presentation-code/06-languages/js && npx wrangler deploy
cd ../ts && npx wrangler deploy
cd ../py && npx wrangler deploy
```

This is the only phase that needs the CLI, since Python Workers can't be created through the dashboard. Like everything else, it's deployed before the talk — on stage you just hit all three URLs and compare `elapsedMs`.

## Repo layout

```
base-code/                    # reference source this journey grew out of -- not demoed directly
  athlete-articles/            # production app: summarize/fallback/eval/humanizer logic lives here
  claude/humanize-writing/      # the humanize-writing skill + its Python checker
  cloudflare-usage-worker/      # complete usage/cost API (Phase 5 source)
  image-generation/             # two image-generation attempts (Phase 7 source)
presentation-code/            # lean, phase-by-phase demo code (built)
  01a-summarize/                worker.js, sample-request.json, README.md -- no max_tokens, output truncates
  01b-summarize-tokens/         worker.js, sample-request.json, README.md -- max_tokens fix
  02-fallback/                  worker.js, README.md
  03-eval/                      worker.js, README.md
  04-humanizer/                 worker.js, micro-humanizer-attempt.js, README.md
  05-usage/                     worker.js, README.md
  06-languages/                 js/, ts/, py/ (each with a worker + wrangler.jsonc), README.md
  07-image/                     worker.js, broken-example.js, README.md
  README.md                     phase index, timing budget, bindings table
PRD.md
README.md
```

No `wrangler.toml`/`wrangler.jsonc` anywhere except `presentation-code/06-languages/` — that phase is the one flagged exception, since Python Workers require Wrangler and can't be created through the dashboard. Everywhere else, deploys are manual and bindings/secrets get configured by hand via the dashboard.

## Reference links

- [Workers AI: get started with Wrangler](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/)
- [Workers AI model catalog](https://developers.cloudflare.com/workers-ai/models/)
