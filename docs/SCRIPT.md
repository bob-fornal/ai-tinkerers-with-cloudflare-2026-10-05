# SCRIPT — run-of-show and cut priorities

The at-a-glance version of the talk: what to say, what to do on stage, and —
because the planned total already runs over the clock — exactly what to cut
first if you're behind. Full detail per phase (exact requests, full demo
steps) lives in each `presentation-code/<phase>/README.md`; this doc is the
condensed version to have open on stage.

**Hard limit: 15 minutes. Planned total: ~19.5 minutes.** That gap is by
design, not an oversight — see "If you're running behind" below. Every phase
is already deployed (see `DEPLOYMENT.md`); nothing here is typed live except
one variable edit in Phase 2. Phase 9 is a bonus, tacked on after the
original eight-phase journey — it's the reason the gap is this wide, and the
first thing to give up.

## If you're running behind — cut in this order

Check your pace against the checkpoint table below. If you're behind, apply
these in order — each one is a bigger cut than the last, so stop as soon as
you're back on pace. Don't apply them out of order: Phases 0, 1a/1b, 2, and 7
are the spine of the talk (Phase 7 especially — it's the finale and the
"here's an honest unsolved problem" moment, worth protecting even under time
pressure) and shouldn't be cut before Phase 9, then Phase 6, or trimmed
before 3/4/5.

1. **Cut Phase 9 entirely (saves ~3 min).** It's a bonus phase, not part of
   the original journey — the least costly thing in the whole talk to drop.
   This decision can be made at any point, not just near the end: as soon as
   you know you're behind, mentally cross Phase 9 off and stop worrying
   about the last 3 minutes of budget. One line if it comes up: "There's a
   bonus phase on this in the repo — an MCP server, if you want to see what
   building something genuinely new on this platform surfaces."
2. **Cut Phase 6 entirely (saves ~2 min).** Replace with one sentence: "I
   also compared JS, TS, and Python — JS and TS were identical, because TS
   just compiles to the same JS before it ever runs; Python was the real
   outlier, since it runs through a completely different WASM runtime. Full
   numbers are in the repo." Move straight to Phase 7.
3. **Trim Phase 5 (saves ~1 min).** Skip the dashboard-usage-page comparison,
   go straight to `/usage`, point at `days[]` and `freeNeuronsPerDay` once.
   One line: "Cloudflare's own usage page exists — it's just thin. This
   fills in the detail."
4. **Trim Phase 3 (saves ~30-45 sec).** Run `/eval` against two models
   instead of three.
5. **Trim Phase 4 (saves ~20-30 sec).** Skip live-demoing
   `micro-humanizer-attempt.js` — mention it in one sentence instead of
   showing the file.
6. **Tighten 1a/1b (saves ~20-30 sec, last resort).** Show the truncated
   output and the one-line fix back to back without a separate pause between
   them — don't cut either one, they're quick and they're the freshest,
   least-expected finding in the talk.

## Pacing checkpoints

| By this elapsed time... | ...you should be starting | If you're not there yet |
|---|---|---|
| 0:00 | Phase 0 | — |
| 1:30 | Phase 1a | Tighten Phase 0's catalog-page walkthrough |
| 3:30 | Phase 2 | Apply cut #6 |
| 5:00 | Phase 3 | Apply cut #6 if not already |
| 7:00 | Phase 4 | Apply cut #4 |
| 9:30 | Phase 5 | Apply cuts #4-5 |
| 11:30 | Phase 6 (or skip straight to 7) | **Apply cut #2 — skip Phase 6 outright** (cut #1 should already be a settled decision by now, not something to newly apply here) |
| 13:30 | Phase 7 | Apply cuts #2 and #3 |
| 16:00 | Phase 9 (bonus) or Closing | **Apply cut #1 if you haven't already** — go straight to Closing |
| 19:00 | Closing | You're at the wire either way — wrap in 30 seconds |

## Phase-by-phase

### Phase 0 — Docs and the moving catalog
**~1.5 min · Priority: protect**
- Open with the agenda in [`SUMMARY.md`](SUMMARY.md) — ~30-45 sec, sets up
  what's coming before the get-started-guide walkthrough below.
- Say: "I started at Cloudflare's own get-started guide. The model it
  referenced was deprecated — dead on arrival. That's fixed now, but it set
  the tone: this catalog moves, and code written against it has a shelf
  life."
- Show: the get-started guide, then the model catalog page — how to read a
  model ID, spot beta/deprecated status.
- Land: "The catalog is the real source of truth. Not a guide, not a blog
  post, not this repo."

### Phase 1a — First summarizer, and the cut-off output
**~1 min · Priority: protect**
- Show `worker.js` — hard-coded model, no `max_tokens`.
- Invoke it live with the sample request.
- Say, reading the response: "Watch — it just... stops." Let the silence
  land before explaining.
- Land: "Workers AI defaults to 256 output tokens if you don't say
  otherwise. No error. It just quietly gives you less than you asked for."

### Phase 1b — Fixing the cut-off output
**~1 min · Priority: protect**
- Diff on screen: one line, `max_tokens: 1024`.
- Invoke the same request — complete output this time.
- Land: "One field. The hard part was noticing it, not fixing it." Plant the
  next beat: "Notice the model ID on that same line is still hard-coded,
  though."

### Phase 2 — The break, and the fix
**~1.5 min · Priority: protect — this is the spine of the talk**
- Show the diff off 1b: `env.PRIMARY_MODEL`, a `generateWithFallback` step.
- Invoke it — works identically.
- **Live action:** flip `PRIMARY_MODEL` to a garbage value in the dashboard,
  redeploy. (Seconds — a variable edit, not typing code.)
- Re-invoke — same request, now `usedFallback: true`.
- Land: "Config beats hard-coding. It doesn't tell you which model is
  actually *good*, though — that's next." **Reset `PRIMARY_MODEL`** before
  moving on.

### Phase 3 — Turning model choice into data
**~2 min · Priority: trim under pressure, don't cut**
- Show the fixed reference articles + hand-written reference summary.
- Invoke `/eval` against 2-3 candidate models, reading the generated text and
  `overlapScore` each time.
- `POST /select` on whichever one you'd actually pick, then `GET /selected`.
- Land: "Model selection stopped being a hunch and became a repeatable
  check."

### Phase 4 — Gating the humanizer
**~2.5 min · Priority: trim under pressure, don't cut**
- ~20 sec: show (or just describe) `micro-humanizer-attempt.js` — the
  two-sentence-summary approach that quietly deleted the content along with
  the AI tells.
- Point at `BANNED_WORDS`/`analyzeAiTells` in `worker.js` — same lists as the
  `humanize-writing` skill's own Python checker.
- Invoke with no body — the built-in bad sample fails the gate, then comes
  back fixed via a smaller model call.
- Land: "Nearly the same quality as a full rewrite, for a fraction of the
  cost — because the model only gets called on the part that actually needs
  it. That's the mindset that makes the next problem worth solving properly."

### Phase 5 — Staying inside the free tier
**~2 min · Priority: trim under pressure, don't cut**
- State the constraint: 10,000 neurons/day, free tier.
- Show Cloudflare's own dashboard usage page
  (`dash.cloudflare.com/<account_id>/ai/workers-ai/usage`) — it exists, it's
  real, but there's not much on it.
- Invoke `/usage` — real numbers from rehearsal traffic (see
  `PRE-PRESENTATION.md`).
- Point at `days[]` and `freeNeuronsPerDay` — the daily, per-model detail the
  dashboard page doesn't surface.
- Land: "Cloudflare gives you a usage page. It's just thin — no daily
  breakdown, no per-model detail. That part you build yourself."

### Phase 6 — JS vs. TS vs. Python
**~2 min · Priority: cut first if short on time**
- Invoke all three deployed variants, compare `elapsedMs`.
- Land: "JS and TS come back nearly identical — TS compiles to the same JS
  before it ever runs. Python's the real outlier, a genuinely different
  execution model, not just different syntax."
- **This is the designated cut.** If you skip it, use the one-liner from the
  "cut order" section above and move straight to Phase 7.

### Phase 7 — Image generation, warts and all
**~2.5 min · Priority: protect — the finale, don't rush or cut**
- Invoke `worker.js` with a plain prompt — works.
- Invoke `broken-example.js` — fails on its bad hard-coded dimensions.
- Trigger the NSFW false positive live (verified working the day before —
  see `PRE-PRESENTATION.md`).
- **The unscripted moment:** try the reference-image flow with the
  originally-attempted model ID (fails, as it always did), then try the
  catalog's current inpainting model ID live — genuinely unknown outcome,
  found out with the audience. Either result lands the point.
- Land: "Image generation is the least uniform part of this catalog. And
  maybe — don't take my word for 'it never worked' without checking again
  yourself."
- **If asked about video generation** (likely, given everything above):
  "I haven't touched video on this platform, on purpose. Image generation
  alone has the rough edges you just watched — video's a harder problem, not
  an easier one, so I'm not testing it until image generation itself is in
  better shape." Don't improvise past that line — there's no video-generation
  research behind this talk to draw on.

### Phase 9 (bonus) — An MCP server on Workers
**~3 min · Priority: cut first if short on time — see cut order above**
- Frame it up front, honestly: "This last one isn't from the original
  journey. It's separate, real Cloudflare work — but it's too good a 'here's
  what breaks when you try something genuinely new' source to leave out."
- Show `src/index.ts` and `learnings-hub.ts` — a stateless MCP handler (not
  the deprecated `McpAgent`), reading from a Durable Object that has zero
  MCP awareness, just seed-once storage.
- Open `/` in a browser — the landing page, quick proof it's live.
- Connect it: `claude mcp add --transport http bobs-cloudflare-mcp
  https://phase9-mcp.<your-subdomain>.workers.dev/mcp`.
- Ask the connected client something the tool/resource can answer — ideally
  something that surfaces the Phase 7 img2img/account-gating discrepancy
  live, tying this bonus phase back into the talk's own open thread.
- Land: "The same 'read the actual output, verify before trusting' habits
  from every phase tonight apply just as much here — and this one has
  nothing to do with Workers AI at all."

### Closing
**~0.5 min**
- Walk back through the eight takeaways as a single list, plus the Phase 9
  bonus lesson if you got to it — see [`TAKEAWAYS.md`](TAKEAWAYS.md) for the
  full write-up of each one, this is just the recap: token limits,
  hard-coded models, eval harnesses, gated humanizing, cost visibility,
  language choice, per-model image handling, re-verifying old findings, and
  (bonus) the same habits applying to non-AI Worker code.
- Point at the repo as the reusable starting point.
- Name the one open problem — reference-image generation — as an invitation,
  not a loose end.
