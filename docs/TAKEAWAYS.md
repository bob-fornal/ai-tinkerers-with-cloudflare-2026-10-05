# TAKEAWAYS — the closing recap

The eight lessons this talk actually earned, in the order they came up.
This is the crib sheet for the ~30-second Closing (see
[`SCRIPT.md`](SCRIPT.md)'s Closing section) — each one is short enough to say
out loud in a breath, backed by the specific moment in the talk that proved
it, not just asserted. It also stands on its own afterward, if anyone wants
the summary without sitting through the demo again.

| # | Phase | Takeaway |
|---|---|---|
| 1 | 0 | The catalog moves — verify it, don't remember it |
| 2 | 1a/1b | `max_tokens` has a silent default, and it's small |
| 3 | 2 | Hard-coded model IDs are a landmine — config plus fallback fixes it |
| 4 | 3 | Model selection should be a repeatable check, not a hunch |
| 5 | 4 | A deterministic gate + targeted small-model fix beats a full rewrite |
| 6 | 5 | Cloudflare gives *some* usage visibility — not much |
| 7 | 6 | Language choice matters less than the execution model behind it |
| 8 | 7 | Image generation has no shared code path across models |

## 1. The model catalog moves — verify it, don't remember it

Cloudflare's own get-started guide referenced a deprecated model at one
point. The catalog page ([developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/))
is the only source of truth, and it's worth re-checking close to whenever
you actually deploy — not trusted from memory, an old blog post, or code
you wrote six months ago. This applied to every model ID in this repo, not
just the get-started guide's.

## 2. `max_tokens` has a silent default — and it's small

Workers AI defaults to 256 output tokens if you don't set `max_tokens`
yourself, and it doesn't error when it hits that limit — the response just
stops. Phase 1a's summary was genuinely, visibly cut off mid-sentence; one
added field (`max_tokens: 1024`) in Phase 1b fixed it outright. The bug is
easy to miss because "a response came back" isn't the same as "the response
is complete."

## 3. Hard-coded model IDs are a landmine — config plus fallback is the fix

A hard-coded model ID works right up until Cloudflare deprecates it, and
that's not hypothetical — it's what happened. Phase 2 moved the model ID
into environment variables and added a primary/fallback retry, demonstrated
live by breaking `PRIMARY_MODEL` on purpose and watching the fallback catch
it. Config alone doesn't answer "which model is actually good," though —
that's the next lesson.

## 4. Model selection should be a repeatable check, not a hunch

Phase 3's eval harness runs any candidate model against the same fixed
reference articles and a hand-written reference summary, side by side, with
a rough overlap score. Swapping models stopped being "try it and see" and
became a comparison with a paper trail — notes and the chosen model stored
in KV instead of just another hard-coded constant.

## 5. A deterministic gate plus a targeted small-model fix beats a full rewrite

The first attempt at automatically cleaning up AI-sounding text — a
two-sentence micro-summary — failed by deleting the content along with the
tells. What worked instead: cheap, deterministic JS checks (banned
vocabulary, boilerplate phrases, sentence burstiness) that run for free, and
only call a model — a small one — on the specific text that actually fails a
check. Nearly the same quality as a full-model rewrite, for a fraction of
the cost. That mindset is exactly why cost (next) turned out to matter.

## 6. Cloudflare gives you *some* usage visibility — not much

There's a real dashboard page for Workers AI usage
(`dash.cloudflare.com/<account_id>/ai/workers-ai/usage`). It's just thin —
no daily breakdown, no per-model neuron/cost math, no queryable range. Phase
5's usage API isn't solving a problem Cloudflare ignored outright; it's
filling in detail the built-in page doesn't surface, against a hard
10,000-neuron/day free-tier budget.

## 7. Language choice matters less than the execution model behind it

JS and TS came back nearly identical in Phase 6, because TS compiles to the
same JS before it ever runs on Workers — there's no separate "TypeScript
runtime cost" to find. Python was the real outlier, since it runs through
Pyodide, a genuinely different (WASM) execution model, not just different
syntax. The interesting axis was never "which language reads nicer."

## 8. Image generation has no shared code path across models — plan for that

`height`/`width` handling, content filtering, and reference-image support
all behaved differently model to model in Phase 7. A parameter set that
worked for one model broke another outright, and a real prompt ("a wild
beard") tripped the NSFW filter as a false positive. Per-model handling
isn't a nice-to-have here — it's the only thing that actually works.

## The meta-lesson underneath all eight: re-check "broken," don't just repeat it

Two separate findings in this talk were stated once, a while ago, and never
re-verified until this rebuild: "Python support is broken" (Phase 6) and
"reference-image generation never worked" (Phase 7). Re-checking the second
one turned up a real candidate explanation — the original code's model ID
doesn't exist in today's catalog at all, only a similarly-named one does.
"Broken today" is a snapshot, not a verdict. Recheck before repeating an old
finding as current fact — including your own.

## The one open problem, left open on purpose

Reference-image (img2img) generation is still not a settled success as of
this talk — see [`presentation-code/07-image/README.md`](../presentation-code/07-image/README.md)
for exactly where it stands and what's still unverified. That's presented as
an invitation for whoever wants to pick it up next, not a loose end being
quietly hidden.
