# AI Tinkerers with Cloudflare

Live-code presentation repo for a walkthrough of Cloudflare Workers AI — built by reconstructing, on stage, the actual path from "read the getting-started guide" to "found the parts of the platform that are still rough." That includes the parts that broke.

Full background, the phase-by-phase story, the code inventory, and the demo run-of-show live in [`docs/PRD.md`](docs/PRD.md). Start there if you want the why. This file covers the what and how.

![Bob and AI presenting at the AI Tinkerers Columbus Event (anime style)](./README.webp)

**This is a 15-minute talk.** Every phase is deployed ahead of time — none of
it gets typed from scratch on stage. The show is walking through
already-written code and operating the already-deployed Workers. See
[`presentation-code/README.md`](presentation-code/README.md) for the
per-phase time budget and exactly what happens on stage for each one.

**Five operational docs, in `docs/`, in the order you'll actually use them:**
1. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — setup checklist, done once ahead of the talk (or re-run whenever a phase's code changes).
2. [`docs/PRE-PRESENTATION.md`](docs/PRE-PRESENTATION.md) — what to re-check the day before and the morning of.
3. [`docs/SUMMARY.md`](docs/SUMMARY.md) — the Phase 0 opening agenda: what the talk covers, said before the get-started-guide walkthrough.
4. [`docs/SCRIPT.md`](docs/SCRIPT.md) — the run-of-show, with pacing checkpoints and a ranked cut order for when you're running behind.
5. [`docs/TAKEAWAYS.md`](docs/TAKEAWAYS.md) — the eight closing takeaways, written out in full, for the Closing and as a stand-alone leave-behind.

Also in `docs/`: [`talk-summary-tables.pptx`](docs/talk-summary-tables.pptx) — a two-slide deck of `TAKEAWAYS.md`'s and `SUMMARY.md`'s summary tables — and [`docs/SESSION-LOG.md`](docs/SESSION-LOG.md), a chronological record of the AI-assisted session that built this repo: what was asked, what got built, and why.

## Status

Planning docs and all eight phases of `presentation-code/` are built, plus a
bonus Phase 9. `base-code/` holds the real source this journey grew out of —
a larger production app, the usage/cost worker, two image-generation
attempts, a GitHub Copilot custom agent of live-verified Cloudflare
findings, and a real working MCP server built from that same agent's
content — kept as reference and mining material, not demoed directly. See
[`docs/PRD.md`](docs/PRD.md#21-a-second-independent-source-the-copilot-agent-and-a-working-mcp-server)
for what the Copilot agent adds, including a correction worth resolving
before presenting Phase 7.
`presentation-code/` is the lean, phase-by-phase demo code actually shown on
stage, extracted and simplified from `base-code/` per the mapping in
[`docs/PRD.md`](docs/PRD.md#7-code-inventory-final-solutions-needed).

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
10. **(Bonus, Phase 9) An MCP server on Workers** — separate, real Cloudflare work, folded in because it's too good a "here's what breaks when you try something new" source to skip. First thing cut if the talk runs long.

See [`docs/PRD.md`](docs/PRD.md#8-phased-implementation-plan-steps-not-code) for the full step-by-step for each phase.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with Workers AI enabled. That's it for Phases 1–5 and 7.
- **Phases 6 and 9 are the exceptions.** Python Workers aren't deployable through the dashboard's Quick Edit (Phase 6), and an MCP server has real npm dependencies plus a Durable Object binding (Phase 9, bonus) — both need [Node.js](https://nodejs.org/) (LTS) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/) locally (`npm install -g wrangler`, then `wrangler login`).

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

## Deploying Phase 9 (bonus) ahead of the talk

```bash
cd presentation-code/09-mcp
npm install
npx wrangler login   # if not already done for Phase 6
npm run deploy       # merges content/ into a single doc, then wrangler deploy
```

This is a bonus phase — separate, real Cloudflare work (see
[`docs/PRD.md`](docs/PRD.md#21-a-second-independent-source-the-copilot-agent-and-a-working-mcp-server)),
not part of the original journey, and the first thing to cut per
[`docs/SCRIPT.md`](docs/SCRIPT.md) if you're short on time. It's the one
phase in the whole talk that needs a Durable Object binding — see
[`presentation-code/09-mcp/README.md`](presentation-code/09-mcp/README.md)
for the full setup, live-demo script, and an honest caveat: unlike every
other phase, this one hasn't been independently re-verified in this
session, since no live Cloudflare account was available to test-deploy it.

## Repo layout

```
base-code/                    # reference source this journey grew out of -- not demoed directly
  athlete-articles/            # production app: summarize/fallback/eval/humanizer logic lives here
  claude/humanize-writing/      # the humanize-writing skill + its Python checker
  cloudflare-usage-worker/      # complete usage/cost API (Phase 5 source)
  image-generation/             # two image-generation attempts (Phase 7 source)
  copilot/                      # GitHub Copilot custom agent -- live-verified Cloudflare findings, not app code
  cloudflare-mcp/                # real, working MCP server -- Phase 9 (bonus) source, adopted near-verbatim
presentation-code/            # lean, phase-by-phase demo code (built)
  01a-summarize/                worker.js, sample-request.json, README.md -- no max_tokens, output truncates
  01b-summarize-tokens/         worker.js, sample-request.json, README.md -- max_tokens fix
  02-fallback/                  worker.js, README.md
  03-eval/                      worker.js, README.md
  04-humanizer/                 worker.js, micro-humanizer-attempt.js, README.md
  05-usage/                     worker.js, README.md
  06-languages/                 js/, ts/, py/ (each with a worker + wrangler.jsonc), README.md
  07-image/                     worker.js, broken-example.js, README.md
  09-mcp/                        (bonus) Worker + Durable Object + MCP resource/tool, npm project, README.md
  README.md                     phase index, timing budget, bindings table
docs/                          # PRD, run-of-show, and other operational docs
  PRD.md
  DEPLOYMENT.md
  PRE-PRESENTATION.md
  SUMMARY.md
  SCRIPT.md
  TAKEAWAYS.md
  talk-summary-tables.pptx
  SESSION-LOG.md                record of the session that built this repo
README.md
```

No `wrangler.toml`/`wrangler.jsonc`/`package.json` anywhere except `presentation-code/06-languages/` and `presentation-code/09-mcp/` — those are the two flagged exceptions, since Python Workers (Phase 6) and a Durable-Object-backed MCP server with real npm dependencies (Phase 9, bonus) both require Wrangler and can't be created through the dashboard. Everywhere else, deploys are manual and bindings/secrets get configured by hand via the dashboard.

## Reference links

- [Workers AI: get started with Wrangler](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/)
- [Workers AI model catalog](https://developers.cloudflare.com/workers-ai/models/)
