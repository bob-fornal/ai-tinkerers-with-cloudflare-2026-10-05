# PRE-PRESENTATION — day-before checklist

Assumes everything in [`DEPLOYMENT.md`](DEPLOYMENT.md) is already done and
URLs are recorded there. This is what to re-run and re-check the day before
you actually present, plus a same-morning pass. The goal: nothing on stage
should be a surprise except the one thing that's supposed to be (Phase 7's
img2img/inpainting moment — see the note below, don't touch that one).

## Why re-check at all, a day out

Three things in this talk are genuinely time-sensitive, not "set once and
forget": the model catalog moves, a dashboard variable left in a broken
state from the last rehearsal stays broken, and Phase 5's usage numbers are
only interesting if there's real traffic behind them. All three get stale
between deploy day and presentation day if you don't check.

## The day before

### Re-verify the moving parts
- [ ] Re-check every model ID used across `presentation-code/` against
      [developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/)
      one more time. This is the single most likely thing to have silently
      changed since `DEPLOYMENT.md` was last run.
- [ ] Confirm Phase 2's `PRIMARY_MODEL` variable is set to a **real, working**
      model ID, not still set to the intentionally-broken value from a past
      rehearsal of the break/fix demo.
- [ ] Confirm Phase 5's `CF_API_TOKEN` hasn't expired and the account/token
      still has Account Analytics: Read access.

### Generate real traffic for Phase 5
- [ ] Hit Phase 1a, 1b, 2, 3, and 4's endpoints a handful of times each
      (their sample requests, or `03-eval`'s `/eval` against 2-3 models) —
      this is what gives Phase 5's `/usage` real numbers to show instead of
      an empty `days[]` array. Do this the day before, not the morning of, so
      the usage shows up in Cloudflare's Analytics API (it's not always
      instant).
- [ ] Hit Phase 5's `/usage` and confirm `days[]` is non-empty and
      `totalNeurons` is a real, non-zero number.

### Run every phase's happy path once
- [ ] 1a: POST the sample request, confirm the response is visibly cut off.
- [ ] 1b: POST the same sample request, confirm the response is complete.
- [ ] 2: POST the sample request with real `PRIMARY_MODEL`/`FALLBACK_MODEL`
      values, confirm `usedFallback: false`.
- [ ] 3: `GET /eval?model=<id>` for each of the three models named in
      `03-eval/README.md`'s demo script; confirm all three respond and the
      `overlapScore` looks sane (not 0, not erroring).
- [ ] 4: `POST /` with no body, confirm the built-in bad sample fails the
      gate and comes back fixed.
- [ ] 5: `GET /usage`, confirm a real response (see traffic-generation step
      above).
- [ ] 6: hit all three language variants, confirm all three respond and
      `elapsedMs` looks reasonable (not a timeout).
- [ ] 7: confirm `worker.js` generates an image with just a `prompt`, and
      `broken-example.js` fails on its bad dimensions as expected.
- [ ] 9 (bonus): confirm `/` still returns the landing page, and that an MCP
      client can still connect to `/mcp` and get a response. If you're
      already tight on time, it's fine to skip re-verifying this one in
      depth — it's the first thing `SCRIPT.md` says to cut anyway.

### The one thing to deliberately NOT check
- [ ] **Do not run the img2img/inpainting comparison in Phase 7.** The plan
      (see `PRD.md` and `07-image/README.md`) is to find out live, on stage,
      whether `INPAINTING_MODEL_CURRENT` actually works — pre-testing it
      defeats the point. It's fine (expected, even) to verify the Worker
      responds to an ordinary prompt; just don't send the `images` +
      `INPAINTING_MODEL_CURRENT` request ahead of time.
- [ ] Do verify the NSFW-false-positive prompt (`"portrait of a viking
      warrior with a wild beard"`, or your equivalent) still actually trips
      the content filter — this one you do want confirmed ahead of time,
      since unlike the inpainting question it isn't meant to be a live
      unknown, it's a reliable beat.

### Logistics
- [ ] Laptop charged, charger packed.
- [ ] Venue Wi-Fi confirmed reachable from where you'll actually be
      standing — every phase in this talk depends on live network calls
      to Cloudflare, there's no offline fallback built in.
- [ ] Request tool ready and pre-loaded with every URL from `DEPLOYMENT.md`
      (Postman collection, saved curl commands, REST client file — whatever
      you're actually going to click through on stage). Test it fires from
      the same machine/network you'll present from.
- [ ] Font size / terminal size checked for projector visibility if you're
      showing `worker.js` files on screen.
- [ ] Screenshots or a short screen recording of each phase's expected
      response, saved locally, as a fallback if venue Wi-Fi or Cloudflare
      itself has a bad moment on stage. This is real live-demo risk, not
      paranoia — every phase here is a live network call, nothing is
      pre-rendered.
- [ ] Re-read [`SCRIPT.md`](SCRIPT.md)'s cut-order once, so the priority
      calls are already in your head if you end up needing them live.

## The morning of

- [ ] Re-run the "happy path" checks above one more time, fast — just
      confirm every URL still responds. Don't regenerate traffic or
      re-verify model IDs again unless something in the news says Cloudflare
      shipped a catalog change overnight.
- [ ] Confirm Phase 2's `PRIMARY_MODEL` is still set to a real value (easy to
      forget to reset after any last-minute rehearsal).
- [ ] Close unrelated browser tabs / notifications before going on stage —
      several phases involve reading dashboard variables live, and a
      cluttered browser costs time you don't have.
