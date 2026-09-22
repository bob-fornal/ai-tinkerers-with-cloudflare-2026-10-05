# SESSION-LOG — how this repo got built

A chronological record of the AI-assisted session that produced everything
in this repo except the pre-existing `base-code/` and the
`claude/humanize-writing` skill folder. Not a transcript — a decision log:
what was asked, what got built, and why a given call was made, in the order
it actually happened. Useful if you're picking this repo back up later and
want the reasoning behind a decision without re-deriving it, or handing it
to someone else who wasn't in the room.

Session date: 2026-09-22.

## Starting point

The repo began essentially empty: a `.gitattributes` file and a
`claude/humanize-writing/` folder (the `humanize-writing` skill — its
`SKILL.md`, the Python `check_ai_tells.py` checker, its eval fixtures, and
its reference doc on AI-writing tells). Nothing else existed yet.

## 1. Initial PRD and README

**Asked:** build out PRD and README markdown files documenting a live-code
presentation journey through Cloudflare Workers AI, based on a narrated
history: hitting a deprecated model in the get-started docs, building an
article summarizer, discovering models deprecate and needing a
primary/fallback pattern, building a model-eval harness, tracking neuron
cost against the free tier, comparing JS/TS/Python, and image generation's
rough edges (parameter inconsistency, an NSFW false positive, a
never-working reference-image flow). Also asked for a full code inventory
and a phased-implementation outline (steps, not code).

**Delivered:** `PRD.md` and `README.md` at the repo root, structured around
seven phases (0 through 6 at this point) mapped directly to the narrated
journey, each with a code inventory entry and a phase-by-phase demo plan.
Used the `humanize-writing` skill (already loaded) to keep the writing from
reading as generic AI output.

## 2. Adding the humanizer phase

**Asked:** the journey narrative was missing a step — implementing the
`humanize-writing` skill as a live check, first as a failed two-sentence
"micro-humanizer" prototype, then as a working approach: deterministic JS
gates with a smaller model call only for text that fails a gate. This
belonged between the eval-harness phase and the cost-tracking phase.

**Delivered:** inserted as a new phase in that exact slot, since the gated
approach's cost-consciousness motivates the next phase (staying inside the
free tier) — a real narrative link, not just an insertion. Updated the
journey narrative, goals, success criteria, code inventory, and phased plan
to match; renumbered the phases that followed.

## 3. Surveying the real source code

**Asked:** check whether `athlete-articles`, `claude`, and
`cloudflare-usage-worker` (three directories that had appeared at the repo
root, untracked) already contained usable code for the planned phases.

**Found:** `athlete-articles` was a much larger production app (Firebase
auth, D1, Turnstile, rate limiting) with the Phase 1–4 logic buried inside
it — real implementations of summarization, primary/fallback model
selection, an eval-adjacent endpoint, and a faithful TS port of
`check_ai_tells.py` complete with a `needsTargetedRevision()` gate function.
`cloudflare-usage-worker` was an essentially complete implementation of the
cost-tracking phase. `claude/humanize-writing` was the known skill folder.
None of the three had `package.json`/`tsconfig`/wrangler config. Asked two
scoping questions (how much of `athlete-articles` to carry over; whether
`package.json`/`tsconfig` were wanted despite no `wrangler.toml`) — the user
deferred both, then redirected with the next message instead.

## 4. `base-code/` and `presentation-code/` established

**User action (between turns):** moved `athlete-articles`, `claude`, and
`cloudflare-usage-worker` into a new `base-code/` folder, and added a fourth
folder, `base-code/image-generation/` (two files: a naive broken attempt and
a hardened bundled/compiled version). Instructed that all presentation code
should live in a separate `presentation-code/` folder.

**Delivered:** documented the convention in `PRD.md` and `README.md` —
`base-code/` as reference/mining material, never demoed directly;
`presentation-code/` as the lean, phase-by-phase code that actually gets
shown. Read the new `image-generation/` files and folded their content into
the image-generation phase's code inventory.

## 5. Answering the deferred questions

**Asked:** "Ask the questions." — the two scoping questions from step 3,
re-asked.

**Answered:** extract lean, presentation-scoped code from `athlete-articles`
rather than reusing it wholesale; no local tooling — every phase (other than
the one that structurally needs it) is plain JavaScript meant to be pasted
directly into the Cloudflare dashboard's Quick Edit editor, no
`package.json`/`tsconfig.json`/`wrangler.toml`. Both decisions got written
into `PRD.md` as standing conventions, including rewriting file extensions
from `.ts` to `.js` throughout the code inventory.

## 6. Building out all seven phases

**Asked:** document the 15-minute timebox, build out `presentation-code/`
phase by phase (one folder each), strip the auth found in `base-code` out of
the presentation code, document the infrastructure each phase actually needs
(env vars, KV, database), and ask any questions that would help present the
code live, quickly, and efficiently.

**Verified live:** fetched the current Workers AI model catalog rather than
trusting the IDs already sitting in `base-code` — this turned up a real
naming drift (`base-code`'s secondary model ID doesn't exist in today's
catalog) and, separately, that the image-generation base code's img2img
model ID (`stable-diffusion-v1-5-img2img`) isn't in the catalog either —
only a similarly-named inpainting model is. Both became load-bearing facts
in the final talk, not just trivia.

**Delivered:** all seven phases built under `presentation-code/`, each a
single paste-ready `worker.js` with its own `README.md` (infra table,
dashboard deploy steps, live-demo script). Confirmed no phase needs a
database, only one optional KV namespace (the eval phase), and only two
secrets total (the usage-API phase's Cloudflare API credentials). Asked two
questions: whether Phases 5–6's setup overhead should be pre-staged rather
than done live, and how to play the img2img/inpainting discovery on stage.

**Answered:** pre-stage everything — every phase deploys ahead of time, the
show is operating already-deployed Workers, not typing code (Phase 2's
"flip a variable and redeploy" being the one live exception). The
img2img/inpainting moment stays genuinely live and unscripted. Rewrote every
phase's "live demo script" and the top-level timing tables to match.

## 7. Splitting Phase 1 over a second real bug

**Asked:** Phase 1 needed to be split in two — a bug where the model's
output silently got cut off because token limits were never set, fixed by
setting `max_tokens`.

**Verified live:** fetched Cloudflare's docs to confirm the exact parameter
(`max_tokens`) and its default (256) rather than guessing at "or something
like that."

**Delivered:** split into `01a-summarize/` (the bug, reliably reproducible
since a multi-paragraph summary blows past 256 tokens) and
`01b-summarize-tokens/` (the one-line fix). Propagated `max_tokens: 1024`
into every later phase that generates prose (fallback, eval, humanizer), so
the fix doesn't silently regress. Flagged that `base-code`'s own
`generate.ts` likely carries the same unnoticed bug today. Updated the
journey narrative, goals, success criteria, code inventory, phased plan, and
every cross-referencing doc to the new phase numbering (eight phases total
from here on).

## 8. Three operational docs

**Asked:** a `DEPLOYMENT` checklist of what needs implementing, a
`PRE-PRESENTATION` checklist of what to verify the day before, and a
`SCRIPT` document highlighting priorities so decisions about what to cut can
be made quickly.

**Delivered:** `DEPLOYMENT.md` (per-phase setup checklist plus a table to
record deployed URLs), `PRE-PRESENTATION.md` (day-before and morning-of
verification, including generating real traffic so the usage phase has
something to show, and an explicit instruction *not* to pre-test the
img2img/inpainting moment), and `SCRIPT.md` (a ranked cut order, pacing
checkpoints against the clock, and a condensed per-phase script). The cut
order protects Phases 0, 1a/1b, 2, and 7 and names Phase 6 as the first
thing to drop if running behind — consistent with the pre-staging decision
from step 6.

## 9. Correcting the Phase 5 framing

**Corrected:** the docs overstated Cloudflare's usage visibility, implying
it gives none. In fact a real dashboard usage page exists
(`dash.cloudflare.com/<account_id>/ai/workers-ai/usage`) — it's just thin on
detail.

**Delivered:** rewrote the "flying blind" framing everywhere it appeared
(`PRD.md`, `05-usage/README.md`, `SCRIPT.md`) to "Cloudflare gives you some
visibility, just not much detail," and added a demo beat showing the real
dashboard page side by side with the custom API as a comparison, which is a
stronger demo than what was there before.

## 10. Video-generation Q&A prep

**Asked:** Phase 7 will likely draw audience questions about video
generation; there's no intent to test video on Workers AI until image
generation itself stabilizes.

**Delivered:** a non-goal in `PRD.md` explaining the scoping, a dedicated
"If asked about video generation" section in `07-image/README.md` with a
ready spoken answer (and an explicit instruction not to improvise past it),
and the same prepared line folded into `SCRIPT.md`'s Phase 7 script.

## 11. `TAKEAWAYS.md` for the Closing

**Asked:** build a markdown file for the Closing showing a clear summary.

**Delivered:** `TAKEAWAYS.md` — the eight lessons the talk actually earned,
each with a headline, the specific demo moment that proved it, and the
practical advice, plus a ninth "meta-lesson" (re-check old "broken" findings
instead of repeating them — the thread connecting the Python-status finding
and the img2img/inpainting discovery) and a closing note on the one
deliberately open problem.

## 12. `SUMMARY.md` for Phase 0

**Asked:** build a markdown file for "Phase 0" showing what's intended to be
covered in the presentation.

**Delivered:** `SUMMARY.md` — the opening-agenda content for the first
30–45 seconds of Phase 0, said before the get-started-guide walkthrough:
the talk's premise, a one-line-per-phase outline, an explicit "what this
isn't" section (including the video-generation scoping from step 10), and a
suggested transition line. Cross-linked into `SCRIPT.md`'s and `PRD.md`'s
Phase 0 sections as the first beat, inside the existing time budget.

## 13. Tables for presentation

**Asked:** summarize `TAKEAWAYS.md` in a table at the top, under 20 lines;
turn `SUMMARY.md`'s "What I'll walk through today" list into a two-column
title/detail table.

**Delivered:** both conversions made in place — a 10-line `# | Phase |
Takeaway` table added to the top of `TAKEAWAYS.md`, and the bulleted agenda
list in `SUMMARY.md` replaced with a `Title | Detail` table, same content.

## 14. Two-slide PPTX

**Asked:** generate a two-slide PPTX of the two tables just built.

**Delivered:** `talk-summary-tables.pptx` via the `pptxgenjs`-based pptx
skill — slide 1 is the takeaways table, slide 2 is the agenda table, styled
with a Cloudflare-flavored palette (navy/orange/light-gray) rather than a
generic template. This machine had neither LibreOffice nor Python 3.10+, so
the skill's usual visual-render and schema-validator steps weren't
available; substituted a python-pptx round-trip read (content matched
exactly), a raw zip-integrity check, and XML well-formedness checks on every
internal part, all clean — flagged the missing final visual check honestly
rather than claiming full QA passed.

## 15. Moved into `docs/`, cross-references repaired

**User action (between turns):** relocated `PRD.md`, `DEPLOYMENT.md`,
`PRE-PRESENTATION.md`, `SCRIPT.md`, `SUMMARY.md`, and `TAKEAWAYS.md` from
the repo root into a new `docs/` folder.

**Asked:** move the PPTX out of the scratchpad into `docs/` too.

**Delivered:** moved the file. While in there, found the `docs/` relocation
had broken relative links in both directions — the root `README.md`'s links
into the moved files, and the moved files' own links out to
`presentation-code/`/`base-code/` and to each other. Swept the whole repo
and fixed every one: root `README.md` now points at `docs/...`, and every
`docs/*.md` file's links to `presentation-code/`/`base-code/` now carry the
`../` prefix. Confirmed clean with a final repo-wide grep.

## 16. This document

**Asked:** document this entire conversation within `docs/`.

**Delivered:** this file.

## Standing decisions, for quick reference

These apply across the whole repo and were each decided once, not
re-litigated per phase:

- **Lean extraction, not wholesale reuse.** `base-code/athlete-articles`'s
  D1, Firebase auth, Turnstile, and rate limiting never made it into
  `presentation-code/` — only the relevant logic, rewritten.
- **No local tooling, except Phase 6.** Every other phase is a single
  paste-ready `worker.js`, no `package.json`/`tsconfig.json`/wrangler
  config. Phase 6 needs Wrangler because Python Workers can't be created
  through the dashboard.
- **No database anywhere; one optional KV namespace total.** Only the eval
  phase touches KV, and only for two of its three routes.
- **Everything is pre-staged.** No phase is typed live on stage; Phase 2's
  variable-flip-and-redeploy is the sole live *operation*.
- **Verify, don't trust.** Model IDs and platform claims got checked against
  live sources during this session at least three separate times (the
  catalog itself, the `max_tokens` default, the img2img model ID) — each
  check changed what got presented as fact.
- **Failures stay in.** The NSFW false positive and the img2img/inpainting
  unknown are deliberately not smoothed over or pre-solved.

## File inventory produced this session

```
README.md                          (root, updated repeatedly)
docs/
  PRD.md
  DEPLOYMENT.md
  PRE-PRESENTATION.md
  SUMMARY.md
  SCRIPT.md
  TAKEAWAYS.md
  talk-summary-tables.pptx
  SESSION-LOG.md                   (this file)
presentation-code/
  README.md
  01a-summarize/  01b-summarize-tokens/  02-fallback/  03-eval/
  04-humanizer/   05-usage/  06-languages/  07-image/
  (each with worker.js + README.md; see presentation-code/README.md)
```
