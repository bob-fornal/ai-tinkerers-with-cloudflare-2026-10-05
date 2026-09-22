# Phase 2 — Primary/fallback + env-var config

**Budget: ~1.5 min.** The "config beats hard-coding" phase. Deploy this
ahead of the talk. The one exception to "nothing happens live" in this whole
repo is here — see step 3 below, and it's a variable edit, not code-typing.

## What it does

Same summarizer as Phase 1b (`max_tokens: 1024` carried forward — see its
`MAX_TOKENS` constant), but the model ID comes from `env.PRIMARY_MODEL`, and
a failed primary call falls through to `env.FALLBACK_MODEL` instead of
failing the whole request.

## Infrastructure

| Needed | Required? |
|---|---|
| `AI` binding | Yes |
| Environment variables | Yes — `PRIMARY_MODEL`, `FALLBACK_MODEL` (plain text vars, not secrets — model IDs aren't sensitive) |
| KV namespace | No |
| Database | No |

## Deploy (dashboard, no local tooling)

1. Create a Worker, paste in `worker.js`.
2. Settings → Bindings → add an `AI` binding (variable name `AI`).
3. Settings → Variables → add:
   - `PRIMARY_MODEL` = `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
   - `FALLBACK_MODEL` = `@cf/meta/llama-3.2-3b-instruct`
4. Save and deploy.

## Live demo script

1. Diff against Phase 1b on screen: the model ID moved from a literal to
   `env.PRIMARY_MODEL`, and there's now a `generateWithFallback` step.
2. Invoke the already-deployed Worker with the same request as Phase 1b —
   works identically, `usedFallback: false`.
3. **Break it live:** edit `PRIMARY_MODEL` in the dashboard to a garbage value
   (e.g. `@cf/does-not-exist/whatever`) and redeploy — a few seconds, a
   variable edit and a click, not code-typing. Faster and safer than waiting
   for a real deprecation, and makes the exact same point.
4. Re-run the same request. It still succeeds — `usedFallback: true`, and the
   response's `modelUsed` shows the fallback kicked in.
5. Land it: "Config beats hard-coding. It doesn't answer 'which model is
   actually good,' though — that's next." Set `PRIMARY_MODEL` back before
   moving on, in case you need this Worker again later.

```bash
curl -X POST https://<your-worker>.workers.dev \
  -H "content-type: application/json" \
  -d @../01b-summarize-tokens/sample-request.json
```

## Note on model-ID drift (worth mentioning live)

The model IDs above were confirmed against the live catalog while building
this repo. Cross-checking against `base-code/athlete-articles/src/kv/models.ts`
(the real config this was extracted from) turned up a mismatch: that file's
`secondary` model was `@cf/meta/llama-3.1-8b-instruct-fast`, which isn't in
today's catalog listing at all — it's likely drifted since that code was
written. That's not a hypothetical risk for this talk, it's a live one:
verify model IDs against
[developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/)
shortly before presenting, not from memory or old code.
