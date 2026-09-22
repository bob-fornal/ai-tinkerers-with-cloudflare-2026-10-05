# PRD — Cloudflare Workers AI: A Live-Code Journey

## 1. What this is

A live-code presentation repo. The format isn't "here are slides about Workers AI" — it's a rebuild, in front of an audience, of the actual path I took while learning Cloudflare Workers AI: the parts that worked, the parts that quietly broke a week later, and the workarounds that showed up in between.

Every phase below happened in roughly this order during real development. The presentation reconstructs each one as its own step, including the failures, because the failures are most of the lesson.

## 2. Background: how this project actually unfolded

**Started with the docs, hit a wall immediately.** I began at the [Workers AI get-started guide](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/). At the time, the model referenced in the guide was deprecated — copy-pasted example, dead model ID. That's since been fixed on Cloudflare's side, but it set the tone for everything that followed: this is a fast-moving catalog, and code written against it has a shelf life. The current, authoritative list lives at [developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/), and I ended up treating that page as a dependency, not a reference.

**First real build: article summarization.** The actual goal — take a rough title plus a list of source articles and generate a shorter summary article using a model. This worked, and worked well enough to demo, for a while.

**Then the model deprecated, and the hard-coded approach broke.** Losing a hard-coded model ID in production is what pushed the redesign: a **primary model with a fallback model**, both pulled from environment variables instead of baked into the code. Reasonable fix, but it created a second problem — the models themselves change often enough that "just update the env var" still meant regularly re-researching which model was good again. Config flexibility doesn't remove the maintenance burden; it just relocates it.

**So I built a way to evaluate models against each other.** A fixed set of example articles, paired with a hand-defined "reference" summary I was willing to call correct. Any candidate model from the catalog could be run against that same input and diffed against the reference, so swapping models became a comparison instead of a guess. Results and notes from those comparisons got written down and the chosen values stored in a key/value store, so model selection became data that lived outside the code instead of another hard-coded constant.

**Then I turned the same scrutiny on my own writing tooling.** I wanted to implement the "humanizer" behind the `humanize-writing` skill documentation as something a Worker could run automatically, not just a checklist I ran by hand before publishing. First attempt: a micro-humanizer — collapse the generated text down to a two-sentence summary and let the compression itself knock out the AI-sounding artifacts. I tested it and it didn't hold up; summarizing away the tells also summarized away the content. What actually worked: JavaScript gates — the same banned-word, boilerplate-phrase, and sentence-burstiness checks the skill already uses — run directly against the generated text, cheap and deterministic. Only the specific portion that fails a gate gets sent to a smaller model for a targeted fix, instead of re-running the whole piece through a heavier model. It lands almost as effective as a full-pass model rewrite, for a fraction of the neuron spend — which is exactly the mindset that made the next problem worth solving properly instead of just watching the counter.

**Cost became the next constraint.** Cloudflare's free tier caps out at 10,000 neurons — Workers AI's own compute-usage unit — and staying inside that budget while still running comparisons meant I needed to actually see where neurons were going. That turned into a small usage-and-cost analysis API, which I later extended to give a **daily breakdown** rather than just a running total.

**Language performance came up next: JavaScript vs. TypeScript vs. Python.** I wanted to know whether the language a Worker is written in matters for AI-call performance. Python support was broken at the time I tested it — worth noting as a dated, point-in-time finding rather than a permanent verdict, since Python Workers support has been actively evolving.

**Last stop: image generation, and it was the roughest edge of the whole journey.** Parameter handling was inconsistent across models — `height`/`width` values that worked for one model broke another outright. Content filtering produced false positives (a prompt containing "wild beard" tripped the NSFW filter). And I never got image-to-image generation working with a reference image, despite multiple attempts — that one's an open failure, not a solved problem, and the presentation should say so honestly rather than papering over it.

## 3. Audience & format

- **Audience:** developers with general JS/TS familiarity, little to no Workers AI experience. Assume they know what a Cloudflare Worker is; don't assume they know the AI binding, `env.AI.run()`, or the model catalog conventions.
- **Format:** live-coded, phase by phase, in the order above. Each phase should visibly build on the last — the fallback-model logic only makes sense once the audience has watched a model deprecate mid-demo (or seen it staged).
- **Tone:** this is a "here's what actually happened" talk, not a polished how-to. Failures stay in. The NSFW false-positive and the broken reference-image attempt are the two moments worth lingering on, not cutting.

## 4. Goals

1. Give the audience a working mental model of the Workers AI binding, the model catalog, and its churn rate.
2. Show a realistic hardening path: hard-coded model → env-var-configured primary/fallback → data-driven model selection via an eval harness.
3. Demonstrate a cost-aware verification pattern — deterministic JS gates plus a targeted small-model fix — using the humanizer as the running example, and show why it beats a full-pass model rewrite.
4. Demonstrate real cost-awareness tooling (neuron usage/cost API with daily breakdown) that others can adapt.
5. Give an honest, dated comparison of JS vs. TS vs. Python Workers for AI workloads.
6. Show the current rough edges of image generation on the platform — inconsistent params, filter false positives, no working reference-image flow — as a documented, reproducible finding.

## 5. Non-goals

- This is not a production-hardened SDK or library for Workers AI — it's demo code meant to be read and rebuilt live.
- Not attempting full coverage of the Workers AI model catalog — only the models actually touched during the journey (summarization-capable text models, and the image-generation models tried).
- Not solving the reference-image problem — the PRD documents it as an open failure, and the presentation should too.
- Not building a general-purpose cost dashboard — the usage/cost API only needs to answer "am I inside the free tier, broken down by day."

## 6. Success criteria

- Every phase in the code inventory (Section 7) has a runnable, minimal implementation.
- At least one deliberate failure is reproducible live: the deprecated hard-coded model, or an image model rejecting a working set of parameters from another model.
- The eval harness can take a new model ID and produce a pass/fail-style comparison against the reference summary without code changes — env var or KV update only.
- The humanizer gate correctly flags at least one deliberately AI-sounding sample, routes only the failing portion to a model fix, and passes on re-check.
- The usage/cost API returns a same-day-accurate neuron count and a daily historical breakdown.
- The audience leaves able to explain, unprompted, why hard-coding a model ID is a bad idea on this platform specifically.

## 7. Code inventory (final solutions needed)

This is what needs to exist in finished form before the phased implementation (Section 8) can be staged against it. Not code yet — the list of artifacts.

**Project setup**
- `wrangler.toml` / `wrangler.jsonc` — Worker config with the `AI` binding declared, plus a KV namespace binding for model-selection storage.
- `.dev.vars` (local) and documented `wrangler secret` list (deployed) for `PRIMARY_MODEL`, `FALLBACK_MODEL`, and any other model-ID env vars.

**Phase 1 — Summarization Worker**
- `src/index.ts` — HTTP entry point / router.
- `src/summarize.ts` — takes a title + array of source articles, calls `env.AI.run()` against a model, returns the generated summary.
- Sample request payloads (title + articles) for the live demo.

**Phase 2 — Primary/fallback + env-var config**
- Update to `src/summarize.ts` (or a new `src/models.ts`) implementing try-primary-then-fallback logic, both model IDs sourced from `env`.
- A staged/simulated failure path to demonstrate the fallback firing live (e.g., an intentionally-bad `PRIMARY_MODEL` value).

**Phase 3 — Model evaluation harness**
- `data/reference-articles.json` (or similar) — the fixed example article set.
- `data/reference-summary.md` — the hand-authored "correct" summary used as the comparison baseline.
- `src/evaluate.ts` — runs a given model ID against the reference articles, returns the generated summary alongside the reference for comparison.
- KV read/write helpers for storing model notes and the currently-selected model(s).

**Phase 4 — Humanizer gate**
- `src/humanizer/gates.ts` — deterministic JS checks ported from `claude/humanize-writing/scripts/check_ai_tells.py` (banned vocabulary, boilerplate phrases, em-dash rate, sentence-length burstiness).
- `src/humanizer/index.ts` — runs the gates against a piece of generated text and, for any section that fails, calls a smaller model with a narrow fix-just-this-part prompt rather than rewriting the whole piece.
- The retired two-sentence micro-humanizer prototype, kept in the repo (or documented) as the discarded first attempt, for the live before/after comparison.
- A before/after sample pair for the demo — one draft that fails a gate, the same draft passing after the targeted fix.

**Phase 5 — Usage & cost analysis API**
- `src/usage.ts` — endpoint(s) returning neuron usage against the 10,000/day free-tier budget.
- Daily-breakdown endpoint/query (usage grouped by day, not just a running total).
- Notes on data source (Cloudflare's AI Gateway logs / analytics, if used) and any caching to avoid the analysis calls themselves eating into cost.

**Phase 6 — Language performance comparison**
- `workers/js/` — a JS implementation of a representative AI call.
- `workers/ts/` — the same, in TypeScript.
- `workers/py/` — the same, in a Python Worker, plus notes on what was broken at time of testing.
- A small benchmark script/harness that calls all three and records timing.

**Phase 7 — Image generation**
- `src/image.ts` — endpoint wrapping image-generation model calls.
- A per-model parameter map documenting which models accept/reject `height`/`width` and other options, since this isn't uniform across the catalog.
- Documented reproduction of the NSFW false-positive (prompt text + model ID) for the live demo.
- The attempted (non-working) image-to-image / reference-image implementation, kept in the repo as a documented failure rather than deleted.

**Supporting**
- This `PRD.md` and `README.md`.
- A short demo script / run-of-show mapping each phase to what gets typed live vs. what's pre-staged.

## 8. Phased implementation plan (steps, not code)

Each phase below is a live-demo unit: a starting state, what gets built or triggered on stage, and what the audience should walk away understanding. Code comes later — this is the shape of the walkthrough.

### Phase 0 — Docs and the moving catalog
1. Open the Workers AI get-started guide live.
2. Point out (or recreate, if staged) the deprecated-model problem as it originally happened.
3. Pivot to the models catalog page and show how to read it — task type, model ID format, beta/deprecated status.
4. Land the takeaway: the catalog is the real source of truth, not any one guide or blog post.

### Phase 1 — First working summarizer
1. Scaffold a minimal Worker with the `AI` binding.
2. Hard-code a single model ID directly in the call.
3. Feed it a title and a short list of articles; get back a generated summary.
4. Land the takeaway: this works, and it's also a landmine — nothing here survives a model deprecation.

### Phase 2 — The break, and the fix
1. Simulate the deprecation: swap in an invalid/retired model ID and show the call fail live.
2. Refactor to pull the model ID from an environment variable instead of a literal.
3. Add a second env var for a fallback model, and add the retry-on-failure logic.
4. Re-run the broken case from step 1 and show it now recovers via the fallback.
5. Land the takeaway: config beats hard-coding, but config alone doesn't solve "which model is actually good" — that's Phase 3.

### Phase 3 — Turning model choice into data
1. Introduce the fixed reference article set and the hand-written reference summary.
2. Run two or three candidate models from the catalog against the same input.
3. Compare each output to the reference side by side, live, and talk through what "good enough" looks like.
4. Persist the chosen model and comparison notes into KV.
5. Land the takeaway: model selection stopped being a hunch and became a repeatable check.

### Phase 4 — Gating the humanizer
1. Show the micro-humanizer prototype live — collapse a generated piece to a two-sentence summary — and demonstrate why it fails: the content goes away along with the AI tells.
2. Port the deterministic checks from `check_ai_tells.py` into JS gates: banned vocabulary, boilerplate phrases, em-dash rate, sentence-burstiness.
3. Run the gates against a sample of generated text and show a failing section flagged.
4. Call a smaller model with a prompt scoped to only the failing section, then re-run the gates and show it now passes.
5. Land the takeaway: a deterministic check plus a targeted small-model fix gets you nearly the same quality as a full rewrite, for a fraction of the cost — which is exactly why the next phase's budget matters.

### Phase 5 — Staying inside the free tier
1. State the constraint plainly: 10,000 neurons/day on the free tier.
2. Build and call the usage endpoint, showing current consumption.
3. Extend it to a daily breakdown and show a few days of (real or seeded) history.
4. Land the takeaway: cost visibility has to be built deliberately — Cloudflare doesn't hand you a per-call running total by default.

### Phase 6 — JS vs. TS vs. Python
1. Run the same representative AI call through the JS, TS, and Python implementations.
2. Show the Python path failing (or behaving unexpectedly) as it did at the time of testing, with a note on current Python Workers status since this is a moving target.
3. Compare timing/output between JS and TS.
4. Land the takeaway: language choice on this platform is not purely stylistic, and "broken today" doesn't mean "broken forever" — recheck before trusting old findings.

### Phase 7 — Image generation, warts and all
1. Call an image-generation model with a working parameter set.
2. Reuse the same parameters (notably `height`/`width`) against a different model and show it fail.
3. Trigger the NSFW false positive live with the "wild beard" (or equivalent) prompt.
4. Attempt the image-to-image/reference-image flow, show the failure as it currently stands, and be explicit that this remains unsolved.
5. Land the takeaway: image generation on Workers AI is the least uniform part of the catalog right now — plan for per-model handling, not a shared code path.

### Closing
1. Walk back through the seven takeaways as a single list.
2. Point at the repo as the reusable starting point — eval harness, humanizer gates, usage API, and per-model image handling are all things worth lifting directly.
3. Name the one open problem explicitly (reference-image generation) as an invitation for the audience, not a loose end to hide.
