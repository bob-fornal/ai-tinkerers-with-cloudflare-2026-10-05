# DEPLOYMENT — setup checklist

What needs to actually exist in the Cloudflare dashboard before this talk can
be presented. Work through this top to bottom, once, ahead of the talk — see
[`PRE-PRESENTATION.md`](PRE-PRESENTATION.md) for what to re-verify the day
before you actually present. Full context for every decision here is in
[`PRD.md`](PRD.md); per-phase detail (exact code, full demo script) is in
each `presentation-code/<phase>/README.md`.

Every phase is a separate Worker. Record each one's URL in the table at the
bottom as you go — [`PRE-PRESENTATION.md`](PRE-PRESENTATION.md) and
[`SCRIPT.md`](SCRIPT.md) both assume you have them.

## 0. Prerequisites

- [ ] Cloudflare account with Workers AI enabled.
- [ ] Dashboard access confirmed (can create a Worker, add bindings).
- [ ] Node.js (LTS) and Wrangler installed locally — **only needed for
      Phase 6**: `npm install -g wrangler`, then `wrangler login`.
- [ ] Model IDs re-verified against
      [developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/)
      — don't trust the IDs baked into this repo without a fresh check; the
      catalog moving is half the point of this talk. See each phase's
      `worker.js` for the exact IDs currently in use.

## 1a. `presentation-code/01a-summarize/`

- [ ] Create a Worker (suggested name: `phase1a-summarize`).
- [ ] Quick Edit → paste `worker.js`.
- [ ] Settings → Bindings → add `AI` binding (variable name `AI`).
- [ ] Save and deploy.
- [ ] Sanity check: POST `sample-request.json` to it, confirm the response
      comes back **truncated** mid-sentence (that's correct — this Worker is
      supposed to be broken).

## 1b. `presentation-code/01b-summarize-tokens/`

- [ ] Create a Worker (suggested name: `phase1b-summarize-tokens`).
- [ ] Quick Edit → paste `worker.js`.
- [ ] Settings → Bindings → add `AI` binding (`AI`).
- [ ] Save and deploy.
- [ ] Sanity check: POST the same `sample-request.json`, confirm the
      response now ends on a complete sentence.

## 2. `presentation-code/02-fallback/`

- [ ] Create a Worker (suggested name: `phase2-fallback`).
- [ ] Quick Edit → paste `worker.js`.
- [ ] Settings → Bindings → add `AI` binding (`AI`).
- [ ] Settings → Variables → add:
  - [ ] `PRIMARY_MODEL` = (current primary model ID — plain text var)
  - [ ] `FALLBACK_MODEL` = (current fallback model ID — plain text var)
- [ ] Save and deploy.
- [ ] Sanity check: POST the same sample request, confirm
      `usedFallback: false` with real values set.
- [ ] Sanity check the break/fix path once (see the "Live demo script" in
      `02-fallback/README.md`), then **reset `PRIMARY_MODEL` back to its real
      value** before moving on — don't leave this Worker broken.

## 3. `presentation-code/03-eval/`

- [ ] Create a KV namespace (dashboard → Storage & Databases → KV → Create).
- [ ] Create a Worker (suggested name: `phase3-eval`).
- [ ] Quick Edit → paste `worker.js`.
- [ ] Settings → Bindings → add `AI` binding (`AI`).
- [ ] Settings → Bindings → add KV binding, variable name `MODEL_KV`,
      pointing at the namespace created above.
- [ ] Save and deploy.
- [ ] Sanity check: `GET /eval?model=<a-real-model-id>` returns a generated
      summary, a reference summary, and an `overlapScore`.
- [ ] Sanity check: `POST /select` then `GET /selected` round-trips
      correctly through KV.

## 4. `presentation-code/04-humanizer/`

- [ ] Create a Worker (suggested name: `phase4-humanizer`).
- [ ] Quick Edit → paste `worker.js`.
- [ ] Settings → Bindings → add `AI` binding (`AI`).
- [ ] (Optional `FIX_MODEL` var — only needed if you want a different fix
      model than the built-in default; skip unless you have a reason to.)
- [ ] Save and deploy.
- [ ] Sanity check: `POST /` with no body — confirm the built-in bad sample
      fails the gate (`fixed`/`gateReportBefore` shows hits) and the
      response includes a `revised` text that passes (`stillFlagged: false`).
- [ ] Optional: create a second Worker for `micro-humanizer-attempt.js` if
      you want to demo the discarded first attempt live rather than just
      showing the file on screen.

## 5. `presentation-code/05-usage/`

- [ ] Create a Cloudflare API token: My Profile → API Tokens → Create Token
      (custom) → **Account Analytics: Read** permission, scoped to your
      account.
- [ ] Find your Account ID (right sidebar of any zone/account overview page
      in the dashboard).
- [ ] Create a Worker (suggested name: `phase5-usage`).
- [ ] Quick Edit → paste `worker.js`.
- [ ] Settings → Variables → add:
  - [ ] `CF_API_TOKEN` — **encrypted** variable (secret), the token from above.
  - [ ] `CF_ACCOUNT_ID` — plain text variable.
- [ ] Save and deploy.
- [ ] Sanity check: `GET /usage` returns a 200 with a `days[]` array (may be
      empty if no other phases have generated traffic yet — that's expected
      this early; see `PRE-PRESENTATION.md` for generating real numbers).

## 6. `presentation-code/06-languages/`

The one phase needing the CLI, since Python Workers can't be created through
the dashboard.

- [ ] `cd presentation-code/06-languages/js && npx wrangler deploy`
- [ ] `cd ../ts && npx wrangler deploy`
- [ ] `cd ../py && npx wrangler deploy`
- [ ] Confirm all three deploys succeeded (Wrangler prints the URL on
      success) — the `AI` binding is already declared in each `wrangler.jsonc`,
      nothing to configure by hand in the dashboard.
- [ ] Sanity check: `curl` all three URLs, confirm each returns
      `{ language, model, elapsedMs, response }`.

## 7. `presentation-code/07-image/`

- [ ] Create a Worker for `worker.js` (suggested name: `phase7-image`).
- [ ] Quick Edit → paste `worker.js`.
- [ ] Settings → Bindings → add `AI` binding (`AI`).
- [ ] Save and deploy.
- [ ] Create a second Worker for `broken-example.js` (suggested name:
      `phase7-image-broken`) — or reuse one Worker and swap the pasted file
      mid-demo if you'd rather manage one URL.
- [ ] Same `AI` binding on the second Worker. Save and deploy.
- [ ] Sanity check: `worker.js` with just a `prompt` returns an image.
- [ ] Sanity check: `broken-example.js` fails on its hard-coded bad
      dimensions (expected — this one's supposed to be broken).
- [ ] **Do not** pre-test the img2img/inpainting comparison in `worker.js`
      (the `IMG2IMG_MODEL_ATTEMPTED` vs. `INPAINTING_MODEL_CURRENT` moment)
      — that's intentionally left live and unscripted. See
      `07-image/README.md` and `SCRIPT.md` before deciding otherwise.

## Record your URLs here

| Phase | Worker name | URL |
|---|---|---|
| 1a | | |
| 1b | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 4 (micro-humanizer, optional) | | |
| 5 | | |
| 6 — js | | |
| 6 — ts | | |
| 6 — py | | |
| 7 — worker | | |
| 7 — broken-example | | |
