# Bob's Cloudflare MCP

A Cloudflare Worker, backed by a single Durable Object, that serves Bob's hands-on
Cloudflare Workers / Durable Objects / D1 / KV / Workers AI learnings two ways:

- **To MCP clients** (Claude, GitHub Copilot, ChatGPT, etc.) — as a Markdown resource
  and a callable tool, over the MCP Streamable HTTP transport at `/mcp`.
- **To browsers** — as a rendered HTML landing page at `/`.

The content is fixed at deploy time. There is no editor, no admin API, and no runtime
write path — the only way to change what's served is to edit the source files under
`content/` and redeploy. See [PRD.md](./PRD.md) for the full design rationale.

## How it works

```
content/cloudflare_worker.agent.md   ─┐
content/cloudflare/01-overview.md     │
content/cloudflare/02-...md           ├─► scripts/build-content.ts ─► content/generated/cloudflare-learnings.md
content/cloudflare/...                │                              src/generated/content-version.ts
content/cloudflare/07-...md          ─┘
content/index.html  ──────────────────────────────────────────────► bundled as-is

                                              │
                                              ▼
                              wrangler bundles both as text constants
                                              │
                                              ▼
                         ┌────────────────────────────────────────┐
                         │  Worker (src/index.ts)                  │
                         │    /       → LearningsHub.getHtml()     │
                         │    /mcp    → MCP resource + tool, both  │
                         │              call LearningsHub.getMarkdown()
                         └────────────────────────────────────────┘
                                              │
                                              ▼
                         LearningsHub Durable Object (src/learnings-hub.ts)
                         Seeds its storage from the bundled content whenever
                         CONTENT_VERSION changes. Pure storage — no MCP logic.
```

- **`scripts/build-content.ts`** merges the intro file and every numbered file under
  `content/cloudflare/` (in `NN-` order) into one Markdown document, rewrites
  same-collection cross-links (e.g. `04-durable-objects-guidelines.md`) into
  in-document anchors (`#durable-objects-guidelines`), and **fails the build** if any
  such link can't be resolved. It also computes a content hash (`CONTENT_VERSION`).
- **`src/learnings-hub.ts`** (`LearningsHub`, a Durable Object) holds the bundled
  Markdown and HTML in its storage, re-seeding only when `CONTENT_VERSION` changes.
  It exposes two RPC methods, `getMarkdown()` and `getHtml()` — no MCP awareness.
- **`src/index.ts`** is the Worker entry point: routes `/` to the stored HTML and
  `/mcp` to a stateless MCP handler (`createMcpHandler` from Cloudflare's `agents`
  package) whose resource and tool both read from the same Durable Object.

## Project structure

```
content/
  cloudflare_worker.agent.md        # intro prose for the merged doc
  cloudflare/NN-*.md                # one topic per file, numeric-prefix order
  index.html                        # standalone browser landing page
  generated/cloudflare-learnings.md # build output — gitignored, regenerated on build
scripts/
  build-content.ts                  # the merge/validate/version step (Node, build-time only)
src/
  index.ts                          # Worker entry: routing + MCP resource/tool registration
  learnings-hub.ts                  # Durable Object: storage + seeding, no MCP logic
  generated/content-version.ts      # build output — gitignored, regenerated on build
  types/content-modules.d.ts        # `declare module "*.md"/"*.html"` for text imports
wrangler.toml
package.json
PRD.md
```

## Prerequisites

- Node.js 20+
- A Cloudflare account (`npx wrangler login` before your first deploy)

## Setup

```bash
npm install
npm run dev
```

`npm run dev` runs `build:content` first (via the `predev` hook), then starts
`wrangler dev`. Once it's up:

- Open `http://localhost:8787/` in a browser — you should see the landing page.
- Point an MCP client (see below) at `http://localhost:8787/mcp`.

## Scripts

| Command | What it does |
|---|---|
| `npm run build:content` | Merges `content/cloudflare_worker.agent.md` + `content/cloudflare/*.md` into `content/generated/cloudflare-learnings.md`, validates every cross-link, and writes `src/generated/content-version.ts`. Fails loudly (non-zero exit) on a broken link. |
| `npm run dev` | Builds content, then `wrangler dev` (local). |
| `npm run deploy` | Builds content, then `wrangler deploy`. |
| `npm run typecheck` | Type-checks `src/` (Worker runtime code, against `@cloudflare/workers-types`) and `scripts/` (Node build tooling, against `@types/node`) separately — they run in different environments with different globals. |

## Authoring content

- **Add a topic:** drop a new `content/cloudflare/NN-topic-name.md` file starting with
  a single `# Title` heading. It's picked up automatically, in numeric-prefix order —
  no manifest to edit.
- **Cross-link between topics:** use a plain relative link to the target filename,
  e.g. `[see Durable Objects](04-durable-objects-guidelines.md)`, optionally with a
  heading fragment (`...guidelines.md#some-heading`). The build rewrites these into
  in-document anchors and fails if the target file or heading doesn't exist — run
  `npm run build:content` after adding a link to confirm it resolves.
- **External links** (`https://...`, `mailto:...`) and non-`.md` relative links
  (images, etc.) are left untouched by the build.
- **Edit the intro:** `content/cloudflare_worker.agent.md`'s prose becomes the top of
  the merged document. Its own numbered list was intentionally removed — the table of
  contents is always regenerated from the files on disk, so it can't drift out of sync.
- **Edit the landing page:** `content/index.html` is bundled as-is (no processing) —
  edit it directly.
- Any content edit only takes effect after `npm run build:content` (automatic via
  `predev`/`predeploy`) and a fresh `wrangler dev`/`wrangler deploy`.

## Deploying

```bash
npx wrangler login   # first time only
npm run deploy
```

This deploys to your `*.workers.dev` subdomain — with the Worker named `cloudflare-mcp` in
`wrangler.toml`, that's `https://cloudflare-mcp.<your-subdomain>.workers.dev`. Check the
`wrangler deploy` output for the exact URL, or add a custom `routes`/`route` entry to
`wrangler.toml` if you want a custom domain.

`wrangler.toml` sets `compatibility_flags = ["nodejs_compat"]` — this project's own
code uses no Node built-ins, but the `agents` package (which provides the MCP
Streamable HTTP transport) uses `node:async_hooks` internally, and the Worker fails
to start without the flag.

## Connecting an MCP client

Once deployed (or running locally via `wrangler dev`), point any MCP client at:

```
https://cloudflare-mcp.<your-subdomain>.workers.dev/mcp    # deployed
http://localhost:8787/mcp                           # local dev
```

The server is public and read-only — no authentication is required. It exposes:

| Kind | Name | Description |
|---|---|---|
| Resource | `cloudflare-learnings` | `text/markdown` — the full merged learnings document |
| Tool | `get_cloudflare_learnings` | No arguments — returns the same document as tool output |

### Claude (Desktop or claude.ai)

1. Open **Settings → Connectors** (in claude.ai) or **Settings → Customize → Connectors**
   (in Claude Desktop).
2. Choose **Add custom connector**.
3. Paste the MCP URL (`.../mcp`). Leave authentication blank — the server is public.

### Claude Code (CLI)

```bash
claude mcp add --transport http bobs-cloudflare-mcp https://cloudflare-mcp.<your-subdomain>.workers.dev/mcp
```

Add `--scope user` instead of the default `local` scope to make it available across
all your projects, not just the current one.

### GitHub Copilot (VS Code)

Add an entry to your workspace `.vscode/mcp.json` (or via the Command Palette →
**MCP: Open User Configuration** for a user-wide config):

```json
{
  "servers": {
    "bobs-cloudflare-mcp": {
      "type": "http",
      "url": "https://cloudflare-mcp.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

### ChatGPT

MCP connectors require Developer Mode, which needs a Business/Enterprise/Edu plan
(Pro is limited to read/fetch-only access; Free doesn't support custom connectors).

1. **Settings → Apps → Advanced settings** → enable **Developer mode**.
2. **Settings → Connectors → Create**.
3. Fill in a name and description, paste the MCP URL (`.../mcp`), and set
   **Authentication** to **None**.

### Any other MCP client

Any client that speaks the MCP Streamable HTTP transport can connect directly to the
`.../mcp` URL — there's no proprietary protocol or required client library.

## Verifying a deploy

1. `npm run build:content` — merge succeeds, no broken-link errors.
2. `npm run typecheck` — clean.
3. `npm run dev`, then:
   - `curl http://localhost:8787/` returns the HTML page.
   - An MCP client (or `curl`, see below) completes `initialize`, lists the resource
     and tool, and reading/calling either returns the expected Markdown.
4. `npm run deploy`, then repeat the same checks against the live URL.

Minimal `curl` smoke test for the MCP endpoint:

```bash
curl -s -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl-test","version":"0.0.1"}}}'
```

## Non-goals

- No runtime content editing, no admin UI, no auth — see [PRD.md](./PRD.md) §3 for the
  full list of intentional non-goals.
