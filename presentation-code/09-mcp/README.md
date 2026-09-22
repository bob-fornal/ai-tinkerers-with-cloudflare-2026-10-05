# Phase 9 (bonus) — an MCP server on Workers

**Budget: ~3 min · Priority: cut first if short on time.** This one's not
from the original summarizer journey — it's separate, real Cloudflare work
(a GitHub Copilot custom agent's worth of live-verified findings, served
over MCP) folded in because it's too good a "here's what building something
genuinely new on this platform surfaces" source to leave out. See
[`base-code/cloudflare-mcp/`](../../base-code/cloudflare-mcp/) for the
source this was adopted from — unlike every other phase, this one needed
almost no trimming; it was already exactly this scoped.

## What it does

A Worker backed by a single Durable Object, serving the same Cloudflare
learnings documented in `base-code/copilot/` two ways:

- **To MCP clients** (Claude Code, Claude Desktop, claude.ai, GitHub
  Copilot, ChatGPT) — a `text/markdown` resource and a no-argument tool,
  both named `cloudflare-learnings` / `get_cloudflare_learnings`, over the
  MCP Streamable HTTP transport at `/mcp`.
- **To browsers** — a plain HTML landing page at `/`.

Content is fixed at deploy time — no runtime editing, no admin API, no auth
(the server is public and read-only, matching this whole repo's
no-auth-in-the-demo convention). `scripts/build-content.ts` merges
`content/cloudflare_worker.agent.md` and every `content/cloudflare/NN-*.md`
file (the same eight files documented in `base-code/copilot/`) into one
Markdown document, rewrites cross-links into in-document anchors, and
**fails the build** if any link doesn't resolve.

## Infrastructure

| Needed | Required? |
|---|---|
| `AI` binding | No — this phase doesn't call Workers AI |
| Environment variables | No |
| KV namespace | No |
| Database | No |
| **Durable Object** | **Yes — the one phase in this talk that needs one.** `LEARNINGS_HUB`, class `LearningsHub`, pure storage (no MCP logic in the class itself) |
| **Local tooling** | **Yes — the second exception, alongside Phase 6.** Real npm dependencies (`agents`, `@modelcontextprotocol/server`, `zod`), a Node build step, and `wrangler deploy` |

## Deploy (needs the CLI — not a dashboard paste-in)

```bash
cd presentation-code/09-mcp
npm install
npx wrangler login   # first time only
npm run deploy       # runs build:content first (predeploy hook), then wrangler deploy
```

- **First deploy on a fresh account:** `wrangler deploy` can print `Success!`
  while the URL is still unreachable, if no `*.workers.dev` subdomain is
  registered yet — a warning in the output links to the dashboard page to
  claim one. Redeploying after that is enough; no code change needed. Check
  for this ahead of time, not live on stage.
- Confirm the deploy: `curl https://phase9-mcp.<your-subdomain>.workers.dev/`
  should return the HTML landing page.

## Live demo script

1. **~20 sec:** show `src/index.ts` and `src/learnings-hub.ts` — point at
   `createMcpHandler` (not the deprecated `McpAgent`) and at `LearningsHub`
   holding zero MCP-protocol awareness, just seed-once storage.
2. **~10 sec:** open `/` in a browser — the landing page, proof the Worker's
   live.
3. **~15 sec:** connect it live —
   ```bash
   claude mcp add --transport http bobs-cloudflare-mcp \
     https://phase9-mcp.<your-subdomain>.workers.dev/mcp
   ```
4. **~1 min:** in a Claude Code session (or Claude Desktop/claude.ai — see
   `base-code/cloudflare-mcp/README.md` for those client configs), ask
   something the tool/resource can answer — e.g. *"what does my
   cloudflare-mcp server say about D1 migration rollbacks?"* — and watch it
   pull the exact lesson from `08-mcp-server-guidelines.md` / this talk's
   Phase 7 discrepancy note.
5. Land it: "The exact lessons behind tonight's talk are now available to
   any MCP client, not just this slide deck."

**Fallback if a live client connection doesn't cooperate on stage** — raw
`curl` against the MCP JSON-RPC endpoint, no client setup required:

```bash
curl -s -X POST https://phase9-mcp.<your-subdomain>.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl-test","version":"0.0.1"}}}'
```

## Gap vs. the base code

Almost none — this is the one phase adopted near-verbatim rather than
trimmed down. `base-code/cloudflare-mcp/` is already a complete, minimally
scoped, well-documented project (see its own `PRD.md` for the full
architecture rationale and explicit non-goals: no runtime editing, no auth,
no multi-document support). What changed for this phase folder: added the
missing `package.json`/`wrangler.toml`/`tsconfig*.json` (the base code, like
every other `base-code/` source in this repo, has none), renamed the Worker
from `cloudflare-mcp` to `phase9-mcp` for consistency with this talk's
naming, and added this README.

## Honest caveat

Unlike the other eight phases, this one hasn't been independently
re-verified inside this session — no live Cloudflare account or MCP client
was available to actually run `npm install && npm run deploy` and confirm
it end to end. The source code is real and was adopted, not guessed at, but
per this whole talk's own "verify, don't trust" theme: run through
`base-code/cloudflare-mcp/README.md`'s "Verifying a deploy" checklist
yourself before presenting this phase.
