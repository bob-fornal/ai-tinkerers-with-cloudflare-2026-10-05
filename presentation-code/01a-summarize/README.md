# Phase 1a — First working summarizer (and the cut-off output)

**Budget: ~1 min.** The "it works, but read the actual response" phase.
Deploy this ahead of the talk — on stage you show the code and invoke it.

## What it does

`POST /` with `{ title, articles: string[] }` → calls Workers AI once with a
hard-coded model and no token limit, returns a summary that's reliably
truncated mid-sentence.

## Infrastructure

| Needed | Required? |
|---|---|
| `AI` binding | Yes |
| Environment variables | No |
| KV namespace | No |
| Database | No |

## Deploy (dashboard, no local tooling)

1. Create a Worker in the Cloudflare dashboard.
2. Open Quick Edit, paste in `worker.js`.
3. Settings → Bindings → add an `AI` binding (variable name `AI`).
4. Save and deploy.

## Live demo script

1. Show `worker.js` — the call to `env.AI.run(MODEL, { prompt })` has no
   `max_tokens`. Don't call this out as a bug yet — let the output do it.
2. Invoke the already-deployed Worker with `sample-request.json`.
3. Read the response out loud. It stops mid-sentence — not a crash, not an
   error, just silently incomplete. This is the actual bug that happened:
   nobody told the model how much it was allowed to say, so Workers AI used
   its own default.
4. Land it: "Workers AI defaults `max_tokens` to 256 if you don't set it.
   256 tokens is nowhere near a 3-4 paragraph summary. That's on us, not the
   model." Move to Phase 1b.

```bash
curl -X POST https://<your-worker>.workers.dev \
  -H "content-type: application/json" \
  -d @sample-request.json
```
