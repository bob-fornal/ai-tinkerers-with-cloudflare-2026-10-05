# Phase 1b — Fixing the cut-off output

**Budget: ~1 min.** The "one field" fix, and a callback planted for Phase 2.
Deploy this ahead of the talk — on stage you show the diff and invoke it.

## What it does

Identical to Phase 1a, with one addition: `max_tokens: 1024` passed alongside
`prompt`. Same request, same model, complete output this time.

## Infrastructure

| Needed | Required? |
|---|---|
| `AI` binding | Yes |
| Environment variables | No |
| KV namespace | No |
| Database | No |

## Deploy (dashboard, no local tooling)

1. Create a Worker, paste in `worker.js`.
2. Settings → Bindings → add an `AI` binding (`AI`).
3. Save and deploy.

## Live demo script

1. Diff against 1a on screen: one line — `max_tokens: MAX_TOKENS` added to
   the `env.AI.run()` call.
2. Invoke the already-deployed Worker with the same `sample-request.json`
   used in 1a.
3. Read the response — complete this time, ends on a real sentence.
4. Land it: "One field. That's the whole fix — the hard part was noticing it
   in the first place, since Workers AI doesn't error when it truncates, it
   just stops." Then plant the callback: "Notice `MODEL` on line 5 is still
   a hard-coded string, though. That's the other landmine from Phase 1 — and
   it's about to go off."

```bash
curl -X POST https://<your-worker>.workers.dev \
  -H "content-type: application/json" \
  -d @sample-request.json
```

## Carried forward

Every phase after this one that generates prose (`02-fallback`, `03-eval`,
`04-humanizer`) includes `max_tokens: 1024` in its `env.AI.run()` calls,
inheriting this fix rather than reintroducing the Phase 1a bug. Look for the
same field if you're reading those files.
