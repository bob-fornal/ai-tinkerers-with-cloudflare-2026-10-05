# PRD — Cloudflare Workers AI: A Live-Code Journey

## 1. What this is

A live-code presentation repo. The format isn't "here are slides about Workers AI" — it's a rebuild, in front of an audience, of the actual path I took while learning Cloudflare Workers AI: the parts that worked, the parts that quietly broke a week later, and the workarounds that showed up in between.

Every phase below happened in roughly this order during real development. The presentation reconstructs each one as its own step, including the failures, because the failures are most of the lesson.

**Repo layout convention:** the messy, real source this journey grew out of lives under [`base-code/`](../base-code/) — `athlete-articles` (the production app the summarization/fallback/eval/humanizer logic was pulled from), `claude/humanize-writing` (the skill and its Python checker), `cloudflare-usage-worker` (the usage/cost API), and `image-generation` (the two image-generation attempts). None of that gets demoed directly — it's reference and mining material. The lean, phase-by-phase code that actually gets live-coded on stage lives under `presentation-code/`, built by extracting and simplifying the relevant pieces out of `base-code/` per phase (Section 7 below maps each phase to its `base-code/` source).

## 2. Background: how this project actually unfolded

**Started with the docs, hit a wall immediately.** I began at the [Workers AI get-started guide](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/). At the time, the model referenced in the guide was deprecated — copy-pasted example, dead model ID. That's since been fixed on Cloudflare's side, but it set the tone for everything that followed: this is a fast-moving catalog, and code written against it has a shelf life. The current, authoritative list lives at [developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/), and I ended up treating that page as a dependency, not a reference.

**First real build: article summarization.** The actual goal — take a rough title plus a list of source articles and generate a shorter summary article using a model. This worked, and worked well enough to demo, for a while.

**Except the output kept stopping mid-sentence.** Not an error, not a crash — just a summary that trailed off partway through a thought. The cause was almost embarrassingly simple: I'd never told the model how many tokens it was allowed to generate, so Workers AI was quietly falling back to its own default (256 tokens), nowhere near enough for a multi-paragraph summary. Setting `max_tokens` explicitly — 1024 was plenty — fixed it outright. Cheap fix, but the kind of bug that's invisible until you actually read the output instead of just checking that a response came back at all.

**Then the model deprecated, and the hard-coded approach broke.** Losing a hard-coded model ID in production is what pushed the redesign: a **primary model with a fallback model**, both pulled from environment variables instead of baked into the code. Reasonable fix, but it created a second problem — the models themselves change often enough that "just update the env var" still meant regularly re-researching which model was good again. Config flexibility doesn't remove the maintenance burden; it just relocates it.

**So I built a way to evaluate models against each other.** A fixed set of example articles, paired with a hand-defined "reference" summary I was willing to call correct. Any candidate model from the catalog could be run against that same input and diffed against the reference, so swapping models became a comparison instead of a guess. Results and notes from those comparisons got written down and the chosen values stored in a key/value store, so model selection became data that lived outside the code instead of another hard-coded constant.

**Then I turned the same scrutiny on my own writing tooling.** I wanted to implement the "humanizer" behind the `humanize-writing` skill documentation as something a Worker could run automatically, not just a checklist I ran by hand before publishing. First attempt: a micro-humanizer — collapse the generated text down to a two-sentence summary and let the compression itself knock out the AI-sounding artifacts. I tested it and it didn't hold up; summarizing away the tells also summarized away the content. What actually worked: JavaScript gates — the same banned-word, boilerplate-phrase, and sentence-burstiness checks the skill already uses — run directly against the generated text, cheap and deterministic. Only the specific portion that fails a gate gets sent to a smaller model for a targeted fix, instead of re-running the whole piece through a heavier model. It lands almost as effective as a full-pass model rewrite, for a fraction of the neuron spend — which is exactly the mindset that made the next problem worth solving properly instead of just watching the counter.

**Cost became the next constraint.** Cloudflare's free tier caps out at 10,000 neurons — Workers AI's own compute-usage unit — and staying inside that budget while still running comparisons meant I needed to actually see where neurons were going. Cloudflare's own dashboard has a usage page for this (`dash.cloudflare.com/<account_id>/ai/workers-ai/usage`), but the detail it surfaces is thin. That gap is what turned into a small usage-and-cost analysis API of my own, which I later extended to give a **daily breakdown** rather than just a running total.

**Language performance came up next: JavaScript vs. TypeScript vs. Python.** I wanted to know whether the language a Worker is written in matters for AI-call performance. Python support was broken at the time I tested it — worth noting as a dated, point-in-time finding rather than a permanent verdict, since Python Workers support has been actively evolving.

**Last stop: image generation, and it was the roughest edge of the whole journey.** Parameter handling was inconsistent across models — `height`/`width` values that worked for one model broke another outright. Content filtering produced false positives (a prompt containing "wild beard" tripped the NSFW filter). And I never got image-to-image generation working with a reference image, despite multiple attempts — that one's an open failure, not a solved problem, and the presentation should say so honestly rather than papering over it.

*Note added while rebuilding this for the talk:* checking the original code's reference-image model ID against today's catalog turned up a likely explanation — that exact ID doesn't exist in the current listing at all, only a similarly-named inpainting model does. Possibly a wrong model ID the whole time, not a deeper platform limitation. See [`presentation-code/07-image/README.md`](../presentation-code/07-image/README.md) for the live-demo angle on this.

## 3. Audience & format

- **Audience:** developers with general JS/TS familiarity, little to no Workers AI experience. Assume they know what a Cloudflare Worker is; don't assume they know the AI binding, `env.AI.run()`, or the model catalog conventions.
- **Format:** live-coded, phase by phase, in the order above. Each phase should visibly build on the last — the fallback-model logic only makes sense once the audience has watched a model deprecate mid-demo (or seen it staged).
- **Timebox: 15 minutes, hard.** The goal is getting through as much of the eight-phase story as possible in that window, not covering all eight in full depth. **Every phase is deployed ahead of time** — nothing gets typed from scratch on stage. The show is walking through already-written code and then operating the already-deployed Worker: hitting endpoints, reading responses, and in Phase 2's case, flipping an environment variable and redeploying live (a few seconds, not code-typing) to trigger the fallback. See [`presentation-code/README.md`](../presentation-code/README.md) for the per-phase time budget and exactly what happens on stage for each one. The setup checklist, the day-before verification pass, and the run-of-show with its cut priorities are their own docs — [`DEPLOYMENT.md`](DEPLOYMENT.md), [`PRE-PRESENTATION.md`](PRE-PRESENTATION.md), [`SCRIPT.md`](SCRIPT.md) — rather than folded into this PRD.
- **Tone:** this is a "here's what actually happened" talk, not a polished how-to. Failures stay in. The NSFW false-positive and the broken reference-image attempt are the two moments worth lingering on, not cutting.

## 4. Goals

1. Give the audience a working mental model of the Workers AI binding, the model catalog, and its churn rate.
2. Surface the token-limit trap early: `max_tokens` defaults to 256 and Workers AI fails silently, not loudly, when output gets cut off — this is a "read your actual output" lesson, not just a config lesson.
4. Show a realistic hardening path: hard-coded model → env-var-configured primary/fallback → data-driven model selection via an eval harness.
5. Demonstrate a cost-aware verification pattern — deterministic JS gates plus a targeted small-model fix — using the humanizer as the running example, and show why it beats a full-pass model rewrite.
6. Demonstrate real cost-awareness tooling (neuron usage/cost API with daily breakdown) that others can adapt.
7. Give an honest, dated comparison of JS vs. TS vs. Python Workers for AI workloads.
8. Show the current rough edges of image generation on the platform — inconsistent params, filter false positives, no working reference-image flow — as a documented, reproducible finding.

## 5. Non-goals

- This is not a production-hardened SDK or library for Workers AI — it's demo code meant to be read and rebuilt live.
- Not attempting full coverage of the Workers AI model catalog — only the models actually touched during the journey (summarization-capable text models, and the image-generation models tried).
- Not solving the reference-image problem — the PRD documents it as an open failure, and the presentation should too.
- Not building a general-purpose cost dashboard — the usage/cost API only needs to answer "am I inside the free tier, broken down by day."
- Not testing or demoing video generation on Workers AI. Image generation itself hasn't stabilized enough yet (Phase 7 is the evidence) — video is deliberately out of scope until that changes. This will come up as an audience question in Phase 7; see `presentation-code/07-image/README.md` for the prepared answer.

## 6. Success criteria

- Every phase in the code inventory (Section 7) has a runnable, minimal implementation.
- At least one deliberate failure is reproducible live: the deprecated hard-coded model, the truncated-output token limit, or an image model rejecting a working set of parameters from another model.
- The eval harness can take a new model ID and produce a pass/fail-style comparison against the reference summary without code changes — env var or KV update only.
- The humanizer gate correctly flags at least one deliberately AI-sounding sample, routes only the failing portion to a model fix, and passes on re-check.
- The usage/cost API returns a same-day-accurate neuron count and a daily historical breakdown.
- The audience leaves able to explain, unprompted, why hard-coding a model ID is a bad idea on this platform specifically.

## 7. Code inventory (final solutions needed)

This is what needs to exist in finished form before the phased implementation (Section 8) can be staged against it. Not code yet — the list of artifacts, each one living under `presentation-code/<phase-name>/` and, where one exists, the `base-code/` source it's extracted and simplified from.

Two decisions lock in how these get written:
- **No local tooling.** No `package.json`, no `tsconfig.json`, no `wrangler.toml`/`wrangler.jsonc`. Every phase (other than the Phase 6 language comparison, which needs TS/Python by definition) is plain JavaScript, written to be pasted directly into the Cloudflare dashboard's Quick Edit editor. Bindings (the `AI` binding, a KV namespace for model-selection/eval storage) and secrets (`PRIMARY_MODEL`, `FALLBACK_MODEL`, etc.) get set up by hand in the dashboard per phase, not checked in as config.
- **`athlete-articles` gets mined, not reused wholesale.** Each phase below pulls only the relevant logic out of the larger app, dropping D1, Firebase auth, Turnstile, rate limiting, view-count tiers, and the `MODEL_VALIDATOR` RPC service-binding dependency (that sibling worker doesn't exist in this repo). Since the source there is TypeScript and presentation-code is plain JS, extraction means a rewrite, not a copy-paste.

**Phase 1a/1b — Summarization Worker, and the token-limit fix**
- `presentation-code/01a-summarize/worker.js` — HTTP entry point + handler; takes a title + array of source articles, calls `env.AI.run()` against a model, returns a summary. No `max_tokens` set — reliably truncates around Workers AI's 256-token default.
- `presentation-code/01b-summarize-tokens/worker.js` — identical, plus `max_tokens: 1024`. Complete output.
- Sample request payloads (title + articles) for the live demo, shared by both.
- *Extracted from:* `base-code/athlete-articles/src/pipeline/generate.ts`, stripped of the D1/Firebase/validation layers around it, rewritten as plain JS. Worth flagging: `generate.ts`'s own `runModel()` doesn't set `max_tokens` either — the base code may carry this exact bug today, unnoticed, since 500-600 word articles are comfortably past the 256-token default too.

**Phase 2 — Primary/fallback + env-var config**
- `presentation-code/02-fallback/worker.js` — try-primary-then-fallback logic, both model IDs sourced from `env`.
- A staged/simulated failure path to demonstrate the fallback firing live (e.g., an intentionally-bad `PRIMARY_MODEL` value).
- *Extracted from:* `base-code/athlete-articles/src/pipeline/modelSelection.ts` and `src/kv/models.ts` — simplified to drop the `MODEL_VALIDATOR` dependency in favor of a plain try/catch fallback, rewritten as plain JS.

**Phase 3 — Model evaluation harness**
- `presentation-code/03-eval/reference-articles.json` — the fixed example article set.
- `presentation-code/03-eval/reference-summary.md` — the hand-authored "correct" summary used as the comparison baseline.
- `presentation-code/03-eval/worker.js` — runs a given model ID against the reference articles, returns the generated summary alongside the reference for comparison.
- KV read/write helpers for storing model notes and the currently-selected model(s).
- *Extracted from:* `base-code/athlete-articles/src/routes/admin/models.ts` (`POST /admin/models/eval`) and `src/kv/articles.ts` (`EvalResult`) — the base code archives one model's output for manual review, it doesn't diff against a reference; the actual reference-diff comparison is new for this phase, not lifted from the base code.

**Phase 4 — Humanizer gate**
- `presentation-code/04-humanizer/gates.js` — deterministic JS checks ported from `claude/humanize-writing/scripts/check_ai_tells.py`.
- `presentation-code/04-humanizer/worker.js` — runs the gates against a piece of generated text and, for any section that fails, calls a smaller model with a narrow fix-just-this-part prompt rather than rewriting the whole piece.
- The retired two-sentence micro-humanizer prototype, kept for the live before/after comparison.
- A before/after sample pair for the demo — one draft that fails a gate, the same draft passing after the targeted fix.
- *Extracted from:* `base-code/athlete-articles/src/pipeline/aiTellCheck.ts` (already a faithful TS port, including a `needsTargetedRevision()` gate function not present in the Python original), rewritten as plain JS. It currently re-runs the fix through the *same* model already selected, not a smaller dedicated one — that changes for this phase to match the story.

**Phase 5 — Usage & cost analysis API**
- `presentation-code/05-usage/worker.js` — endpoint(s) returning neuron usage against the 10,000/day free-tier budget, with a daily breakdown.
- *Extracted from:* `base-code/cloudflare-usage-worker/` — this one is essentially complete already (GraphQL Analytics query, KV-backed pricing table, `FREE_NEURONS_PER_DAY = 10_000`); rewritten as plain JS and trimmed to just the routes this phase demos.

**Phase 6 — Language performance comparison**
- `presentation-code/06-languages/js/` — a JS implementation of a representative AI call.
- `presentation-code/06-languages/ts/` — the same, in TypeScript.
- `presentation-code/06-languages/py/` — the same, in a Python Worker, plus notes on what was broken at time of testing.
- A small benchmark script/harness that calls all three and records timing.
- *Extracted from:* nothing — no prior art exists in `base-code/`; this phase gets built from scratch.

**Phase 7 — Image generation**
- `presentation-code/07-image/worker.js` — endpoint wrapping image-generation model calls, with per-model parameter handling (`height`/`width` clamping, since this isn't uniform across the catalog).
- Documented reproduction of the NSFW false-positive (prompt text + model ID) for the live demo.
- The attempted (non-working) image-to-image / reference-image implementation, kept as a documented failure rather than deleted.
- *Extracted from:* `base-code/image-generation/` — `image-test.js` is the naive first attempt (a hard-coded, invalid SDXL dimension pair is the reproducible break); `image-generator.js` is the hardened version with `clampDimensions()` and the `IMG2IMG_MODEL` reference-image branch. Note `image-generator.js` is bundled/compiled output, not hand-written source — no `src/worker.js` exists alongside it, so this phase's version should be rewritten as clean source rather than edited in place.

**Supporting**
- This `PRD.md` and `README.md`.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — the setup checklist for every phase.
- [`PRE-PRESENTATION.md`](PRE-PRESENTATION.md) — the day-before/morning-of verification pass.
- [`SCRIPT.md`](SCRIPT.md) — the run-of-show, mapping each phase to what happens on stage, with pacing checkpoints and a ranked cut order.
- [`TAKEAWAYS.md`](TAKEAWAYS.md) — the eight closing takeaways, written out in full.

### Infrastructure requirements, at a glance

No phase needs a database. Only Phase 3 touches KV, and it's optional even
there. The only secrets in the whole talk are Phase 5's two Cloudflare API
credentials. Full detail (exact binding names, dashboard setup steps) lives
in [`presentation-code/README.md`](../presentation-code/README.md) and each
phase's own `README.md`; summarized here:

| Phase | `AI` binding | Env vars / secrets | KV | DB |
|---|---|---|---|---|
| 1a. Summarize (truncated) | Yes | — | — | — |
| 1b. Summarize (fixed) | Yes | — | — | — |
| 2. Fallback | Yes | `PRIMARY_MODEL`, `FALLBACK_MODEL` | — | — |
| 3. Eval | Yes | — | `MODEL_KV` (optional) | — |
| 4. Humanizer | Yes | `FIX_MODEL` (optional) | — | — |
| 5. Usage | No | `CF_API_TOKEN`, `CF_ACCOUNT_ID` | — | — |
| 6. Languages | Yes ×3 | — | — | — |
| 7. Image | Yes | — | — | — |

## 8. Phased implementation plan (steps, not code)

Each phase below is a live-demo unit: a starting state, what gets built or triggered on stage, and what the audience should walk away understanding. Code lives in [`presentation-code/`](../presentation-code/), one folder per phase — this is the shape of the walkthrough, with the 15-minute budget and live-type-vs-pre-staged call for each phase noted.

### Phase 0 — Docs and the moving catalog *(~1.5 min, talk only)*
1. Open with the agenda — see [`SUMMARY.md`](SUMMARY.md) — so the audience knows what's coming.
2. Open the Workers AI get-started guide live.
3. Point out (or recreate, if staged) the deprecated-model problem as it originally happened.
4. Pivot to the models catalog page and show how to read it — task type, model ID format, beta/deprecated status.
5. Land the takeaway: the catalog is the real source of truth, not any one guide or blog post.

### Phase 1a — First working summarizer, and the cut-off output *(~1 min, pre-deployed — show + invoke)*
1. Scaffold a minimal Worker with the `AI` binding, a hard-coded model ID, no `max_tokens`.
2. Feed it a title and a short list of articles; the summary comes back cut off mid-sentence.
3. Land the takeaway: Workers AI defaults to 256 output tokens if you don't say otherwise — that's nowhere near enough for a multi-paragraph summary, and it fails silently, not with an error.

### Phase 1b — Fixing the cut-off output *(~1 min, pre-deployed — show + invoke)*
1. Diff against 1a: one line, `max_tokens: 1024` added to the `env.AI.run()` call.
2. Re-run the same request; the summary now ends on a complete sentence.
3. Land the takeaway, and plant the next one: "One field fixed this. The model ID on that same line is still hard-coded, though — that's next."

### Phase 2 — The break, and the fix *(~1.5 min, pre-deployed — one live variable edit)*
1. Simulate the deprecation: swap in an invalid/retired model ID and show the call fail live.
2. Refactor to pull the model ID from an environment variable instead of a literal.
3. Add a second env var for a fallback model, and add the retry-on-failure logic.
4. Re-run the broken case from step 1 and show it now recovers via the fallback.
5. Land the takeaway: config beats hard-coding, but config alone doesn't solve "which model is actually good" — that's Phase 3.

### Phase 3 — Turning model choice into data *(~2 min, pre-deployed — show + invoke)*
1. Introduce the fixed reference article set and the hand-written reference summary.
2. Run two or three candidate models from the catalog against the same input.
3. Compare each output to the reference side by side, live, and talk through what "good enough" looks like.
4. Persist the chosen model and comparison notes into KV.
5. Land the takeaway: model selection stopped being a hunch and became a repeatable check.

### Phase 4 — Gating the humanizer *(~2.5 min, pre-deployed — show + invoke)*
1. Show the micro-humanizer prototype live — collapse a generated piece to a two-sentence summary — and demonstrate why it fails: the content goes away along with the AI tells.
2. Port the deterministic checks from `check_ai_tells.py` into JS gates: banned vocabulary, boilerplate phrases, em-dash rate, sentence-burstiness.
3. Run the gates against a sample of generated text and show a failing section flagged.
4. Call a smaller model with a prompt scoped to only the failing section, then re-run the gates and show it now passes.
5. Land the takeaway: a deterministic check plus a targeted small-model fix gets you nearly the same quality as a full rewrite, for a fraction of the cost — which is exactly why the next phase's budget matters.

### Phase 5 — Staying inside the free tier *(~2 min, pre-staged — deploy ahead, invoke live)*
1. State the constraint plainly: 10,000 neurons/day on the free tier.
2. Show Cloudflare's own dashboard usage page (`dash.cloudflare.com/<account_id>/ai/workers-ai/usage`) — it exists, but the detail on it is thin.
3. Call the custom usage endpoint instead, showing current consumption with a daily, per-model breakdown the dashboard page doesn't surface.
4. Land the takeaway: Cloudflare gives you *some* visibility out of the box — it's not nothing — but anything more detailed than a top-line number is on you to build.

### Phase 6 — JS vs. TS vs. Python *(~2 min, pre-staged — needs Wrangler, see `presentation-code/06-languages/README.md`)*
1. Run the same representative AI call through the JS, TS, and Python implementations.
2. Compare timing/output — JS and TS should land close to identical (TS compiles to the same JS before deploy); Python, running through Pyodide (WASM), is the one with a genuinely different execution model.
3. Note current Python Workers status live rather than assuming last-tested behavior still holds, since this is a moving target.
4. Land the takeaway: language choice on this platform is not purely stylistic, and "broken today" doesn't mean "broken forever" — recheck before trusting old findings.

### Phase 7 — Image generation, warts and all *(~2.5 min, pre-deployed — one step deliberately left unscripted)*
1. Call an image-generation model with a working parameter set.
2. Reuse the same parameters (notably `height`/`width`) against a different model and show it fail.
3. Trigger the NSFW false positive live with the "wild beard" (or equivalent) prompt.
4. Attempt the image-to-image/reference-image flow with the originally-attempted model ID and show it fail, then try the current catalog's differently-named model — see `presentation-code/07-image/README.md` for why this might land as a genuine live fix rather than a repeat of the original failure.
5. Land the takeaway: image generation on Workers AI is the least uniform part of the catalog right now — plan for per-model handling, not a shared code path.

### Closing *(~0.5 min)*
1. Walk back through the eight takeaways as a single list — the full write-up of each lives in [`TAKEAWAYS.md`](TAKEAWAYS.md).
2. Point at the repo as the reusable starting point — eval harness, humanizer gates, usage API, and per-model image handling are all things worth lifting directly.
3. Name the one open problem explicitly (reference-image generation) as an invitation for the audience, not a loose end to hide.
