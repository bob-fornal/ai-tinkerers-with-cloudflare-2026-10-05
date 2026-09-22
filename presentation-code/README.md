# presentation-code

Lean, phase-by-phase demo code for the 15-minute live-code talk. Full story
in [`docs/PRD.md`](../docs/PRD.md); this folder is what actually gets
shown on screen.

## The 15-minute reality

Eight phases plus an intro (plus one bonus ninth) in 15 minutes is tight —
well under two minutes a phase after context-setting. **Every phase is
deployed ahead of time.** None of this gets typed from scratch on stage —
the show is walking through already-written code and then operating the
already-deployed Worker (hitting endpoints, flipping a variable and
redeploying, reading the response), not watching someone type. That's both
faster and safer for a hard 15-minute clock than live-typing eight-plus
phases would ever be.

| Phase | Budget | On stage |
|---|---|---|
| 0. Docs / the moving catalog | ~1.5 min | Talk only, no code |
| 1a. First summarizer (truncated) | ~1 min | Show `worker.js`, invoke it, read the cut-off output |
| 1b. Fixing the cut-off output | ~1 min | Show the one-line diff (`max_tokens`), invoke it, read the complete output |
| 2. Primary/fallback | ~1.5 min | Show the diff off Phase 1b, invoke it, then flip `PRIMARY_MODEL` to garbage and redeploy live to trigger the fallback — that's a variable edit, seconds, not code-typing |
| 3. Eval harness | ~2 min | Show `worker.js`, invoke `/eval` against 3 models, `/select`, `/selected` |
| 4. Humanizer gate | ~2.5 min | Show the gate logic, invoke with no body (built-in bad sample) to show the catch + fix |
| 5. Usage/cost API | ~2 min | Show `worker.js`, invoke `/usage` |
| 6. JS/TS/Python | ~2 min | Show all three, invoke all three, compare `elapsedMs` |
| 7. Image generation | ~2.5 min | Show both workers, invoke live, including the unscripted img2img/inpainting try |
| 9. MCP server (bonus) | ~3 min | Show the code, connect a live MCP client, ask it something |
| Closing | ~0.5 min | Talk only |
| **Total** | **~19.5 min** | — |

That's well over 15 minutes even at the low end of each estimate.
Phase 9 is the newest, most tooling-heavy, and least essential to the
original journey — it's the **first thing to cut** if you're running long,
ahead of even Phase 6. See [`docs/SCRIPT.md`](../docs/SCRIPT.md) for the
full ranked cut order and pacing checkpoints.

## Bindings, env vars, KV, Durable Objects & DB — at a glance

No phase needs a database. Only one phase needs a KV namespace, and it's
optional even there. Two secrets total, both in Phase 5. Exactly one phase
needs a Durable Object.

| Phase | `AI` binding | Env vars / secrets | KV namespace | Durable Object | Database |
|---|---|---|---|---|---|
| 1a. Summarize (truncated) | Yes | — | — | — | — |
| 1b. Summarize (fixed) | Yes | — | — | — | — |
| 2. Fallback | Yes | `PRIMARY_MODEL`, `FALLBACK_MODEL` (plain text) | — | — | — |
| 3. Eval | Yes | — | `MODEL_KV` (only for `/select`, `/selected`) | — | — |
| 4. Humanizer | Yes | `FIX_MODEL` (optional, has a default) | — | — | — |
| 5. Usage | No | `CF_API_TOKEN` (secret), `CF_ACCOUNT_ID` (plain text) | — | — | — |
| 6. Languages | Yes ×3 | — | — | — | — |
| 7. Image | Yes | — | — | — | — |
| 9. MCP (bonus) | No | — | — | `LEARNINGS_HUB` | — |

## Repo-wide conventions

- **Deploy every phase before you go on stage.** Nothing here gets built or
  pasted in live — see each phase's `README.md` for its dashboard/CLI setup
  steps, done ahead of time. Phase 2's "flip the variable and redeploy" beat
  is the one exception: that's a deliberate live *operation* on an
  already-deployed Worker, not code-typing, and it's quick enough (a
  dashboard variable edit) to do safely on the clock.
- **No local tooling anywhere except Phases 6 and 9.** Every other phase is
  a single `worker.js` meant to be pasted directly into the Cloudflare
  dashboard's Quick Edit editor — no `package.json`, no `tsconfig.json`, no
  `wrangler.toml`/`wrangler.jsonc`. Phase 6 needs it because Python Workers
  can't be created via Quick Edit; Phase 9 needs it because an MCP server
  has real npm dependencies (`agents`, `@modelcontextprotocol/server`,
  `zod`) and a Durable Object binding — neither is paste-into-a-box work.
- **No auth anywhere.** `base-code/athlete-articles` has Firebase auth,
  Turnstile, rate limiting, and CORS allowlisting — none of it made it into
  `presentation-code/`. This is demo code meant to be hit directly. (Phase 9
  is public/read-only by its own source project's design, for the same
  reason.)
- **No D1/database anywhere.** The only persistence in the whole talk is one
  optional KV namespace in Phase 3 and Phase 9's Durable Object.
- Each phase folder has its own `README.md` with the exact infra it needs,
  dashboard setup steps, a live-demo script, and — where relevant — what
  changed versus its `base-code/` source.

## Phases

- **1a.** [`01a-summarize/`](01a-summarize/) — first working summarizer, no `max_tokens` set — output gets cut off.
- **1b.** [`01b-summarize-tokens/`](01b-summarize-tokens/) — same Worker, `max_tokens: 1024` added — output complete.
- **2.** [`02-fallback/`](02-fallback/) — primary/fallback via env vars.
- **3.** [`03-eval/`](03-eval/) — model evaluation harness against a reference summary.
- **4.** [`04-humanizer/`](04-humanizer/) — gated humanizer, JS checks + targeted small-model fix.
- **5.** [`05-usage/`](05-usage/) — neuron usage/cost API, daily breakdown.
- **6.** [`06-languages/`](06-languages/) — JS vs. TS vs. Python, same AI call.
- **7.** [`07-image/`](07-image/) — image generation, per-model parameter handling.
- **9 (bonus).** [`09-mcp/`](09-mcp/) — an MCP server on Workers, adopted near-verbatim from real, separate Cloudflare work.
