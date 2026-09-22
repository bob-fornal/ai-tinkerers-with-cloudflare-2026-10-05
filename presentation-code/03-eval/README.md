# Phase 3 — Model evaluation harness

**Budget: ~2 min.** The "model selection stopped being a hunch" phase.
Deploy this ahead of the talk — on stage you show the code and invoke it.

## What it does

- `GET /eval?model=<id>` — runs a fixed set of reference articles through
  whatever model ID you pass, and returns the generated summary next to a
  hand-written reference summary, plus a rough word-overlap score.
- `POST /select {model, notes?}` — records the chosen model in KV.
- `GET /selected` — reads it back.

The reference articles and reference summary are inlined at the top of
`worker.js` (not a separate file) so the whole phase stays one paste-able
file — see the repo-wide note on that in `presentation-code/README.md`.

## Infrastructure

| Needed | Required? |
|---|---|
| `AI` binding | Yes |
| Environment variables | No |
| KV namespace | Yes — bind as `MODEL_KV` (only needed for `/select` and `/selected`; `/eval` alone doesn't need it) |
| Database | No |

## Deploy (dashboard, no local tooling)

1. Create a Worker, paste in `worker.js`.
2. Settings → Bindings → add an `AI` binding (`AI`).
3. Create a KV namespace (dashboard → KV → Create) and bind it as `MODEL_KV`.
4. Save and deploy.

## Live demo script

1. Show `worker.js` — point at `REFERENCE_ARTICLES` and `REFERENCE_SUMMARY`,
   the fixed yardstick every candidate gets measured against, written ahead
   of time.
2. Hit `/eval` on the already-deployed Worker with three different models
   back to back, reading the generated text and the overlap score each time:
   - `?model=@cf/meta/llama-3.3-70b-instruct-fp8-fast`
   - `?model=@cf/meta/llama-3.2-3b-instruct`
   - `?model=@cf/mistralai/mistral-small-3.1-24b-instruct`
3. Pick one live, `POST /select` with that model + a one-line reason.
4. `GET /selected` to show it's now data, not a comment in the code.
5. Land it: "Model selection stopped being a hunch and became a repeatable
   check."

```bash
curl "https://<your-worker>.workers.dev/eval?model=@cf/meta/llama-3.2-3b-instruct"

curl -X POST https://<your-worker>.workers.dev/select \
  -H "content-type: application/json" \
  -d '{"model": "@cf/meta/llama-3.2-3b-instruct", "notes": "closest to reference, fastest"}'

curl https://<your-worker>.workers.dev/selected
```

## Honest gap vs. the base code

`base-code/athlete-articles`'s real eval endpoint (`POST /admin/models/eval`)
archives one model's raw output to KV for manual review — it never diffs
against a reference summary. The reference-diff behavior here (`overlapScore`)
is new for this phase, not lifted from the base code; it's intentionally
crude (word overlap, not a real similarity metric) so it stays a one-line
function you can explain in five seconds on stage.
