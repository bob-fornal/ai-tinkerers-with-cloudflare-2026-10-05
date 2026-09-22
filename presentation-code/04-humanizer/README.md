# Phase 4 — Gating the humanizer

**Budget: ~2.5 min.** The phase that sets up why cost (Phase 5) matters.
Deploy this ahead of the talk — the built-in bad-sample fallback means you
don't even need to type a request body on stage.

## What it does

- `micro-humanizer-attempt.js` — the discarded first attempt: collapse text
  to a two-sentence summary via a model call. Deploy it separately (or just
  show the file) for the 20-second "here's what didn't work" beat.
- `worker.js` — the shipped approach: deterministic JS gates (banned
  vocabulary, boilerplate phrases, sentence-burstiness — a direct port of
  `claude/humanize-writing/scripts/check_ai_tells.py`) run first, for free.
  Only if a gate fails does it call a *smaller* model with a prompt scoped to
  just the flagged issues.
- `POST /` with no body (or `{}`) uses a built-in, deliberately bad sample
  text — guarantees a failing gate live with zero typing risk. Pass `{ text }`
  to check your own.

## Infrastructure

| Needed | Required? |
|---|---|
| `AI` binding | Yes |
| Environment variables | No (optional `FIX_MODEL` override — defaults to `@cf/meta/llama-3.2-1b-instruct` if unset) |
| KV namespace | No — stateless, nothing persists |
| Database | No |

## Deploy (dashboard, no local tooling)

1. Create a Worker, paste in `worker.js`.
2. Settings → Bindings → add an `AI` binding (`AI`).
3. (Optional) create a second Worker for `micro-humanizer-attempt.js` if you
   want to demo it live rather than just showing the file.
4. Save and deploy.

## Live demo script

1. **~20 sec:** show `micro-humanizer-attempt.js`, explain why it failed —
   summarizing away the tells summarizes away the content.
2. **~20 sec:** point at `BANNED_WORDS`/`BANNED_PHRASES`/`analyzeAiTells` in
   `worker.js` — same lists as the Python skill checker, right down to the
   burstiness-ratio math.
3. POST to the already-deployed Worker with no body — the built-in
   `SAMPLE_BAD_TEXT` fails the gate instantly, `fixed` response shows
   `gateReportBefore` flagging the hits.
4. Show the response's `revised` text and `gateReportAfter` — passes now,
   `stillFlagged: false`.
5. Land it: "Nearly the same quality as a full-model rewrite, for a fraction
   of the cost — because most of the time the gate alone is enough, and the
   model only gets called on the part that actually needs it. That's exactly
   the mindset that makes the next problem worth solving properly."

```bash
curl -X POST https://<your-worker>.workers.dev
```

## Gap vs. the base code

`base-code/athlete-articles/src/pipeline/aiTellCheck.ts` is the TS original
this ports — the gate logic (`analyzeAiTells`, `needsTargetedRevision`) is
copied faithfully. One deliberate change: the base code re-runs the fix
through the *same* model already generating the draft. This phase calls a
smaller, separate model (`FIX_MODEL`) instead, to match the actual story —
"a smaller model call is used to fix the flagged portion."
