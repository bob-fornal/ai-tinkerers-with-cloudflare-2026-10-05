# Phase 6 — JS vs. TS vs. Python performance

**Budget: ~2 min, and pre-deploy this one before you go on stage.** See the
open question about this phase's format in the repo-root `README.md` /
`PRD.md` — the recommended plan below assumes it's pre-staged, not typed live.

## What it does

Three near-identical Workers, one per language, each running the same
`env.AI.run()` call against the same model and timing it with `Date.now()`
(`time.time()` in Python). Each returns `{ language, model, elapsedMs, response }`.

## Infrastructure

| Needed | Required? | Per variant |
|---|---|---|
| `AI` binding | Yes | js/, ts/, py/ |
| Environment variables | No | — |
| KV namespace | No | — |
| Database | No | — |
| **Config file** | **Yes — the one exception in this repo** | `wrangler.jsonc` per variant |

This is the **only phase in the whole talk that needs Wrangler and a config
file.** Python Workers can't be created or edited through the dashboard's
Quick Edit — they require `wrangler deploy` with `compatibility_flags:
["python_workers"]` set. Rather than break the "one phase does it
differently" pattern further, all three variants (js/ts/py) use the same
minimal `wrangler.jsonc` shape here, deployed via CLI.

## Deploy (the one phase that needs local tooling)

```bash
cd presentation-code/06-languages/js && npx wrangler deploy
cd ../ts && npx wrangler deploy
cd ../py && npx wrangler deploy
```

No `npm install` needed — these have no dependencies beyond Wrangler itself
(`npx wrangler` pulls it on demand).

## Live demo script (recommended: pre-deployed, hit live)

1. Deploy all three ahead of time (see above) — don't burn stage time on
   `wrangler deploy` three times in front of an audience.
2. On stage, hit all three URLs back to back (or a split-screen terminal) and
   read off `elapsedMs`.
3. **Expected result, worth saying out loud:** JS and TS come back nearly
   identical — Wrangler transpiles TS to the same JS before it ever reaches
   the Workers runtime, so there's no TS-specific runtime cost to find.
   Python is the one that's actually a different story, since it runs through
   Pyodide (WASM), a genuinely different execution model, not just different
   syntax.
4. Land it: "Language choice on this platform isn't purely stylistic — but
   the interesting axis is 'compiles to V8 JS' vs. 'runs through a WASM
   interpreter,' not 'JS vs. TS.'"

```bash
curl https://phase6-lang-js.<your-subdomain>.workers.dev
curl https://phase6-lang-ts.<your-subdomain>.workers.dev
curl https://phase6-lang-py.<your-subdomain>.workers.dev
```

## Gap vs. the base code

Nothing to extract here — no prior art for this phase exists in `base-code/`.
The PRD's original note ("Python support was broken at the time I tested it")
is a dated, point-in-time finding; Python Workers support has been actively
evolving, so re-verify current behavior before presenting rather than
assuming it's still broken.
