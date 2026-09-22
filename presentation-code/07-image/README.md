# Phase 7 — Image generation, warts and all

**Budget: ~2.5 min.** The finale — and, by design, a live unknown. Both
workers deploy ahead of the talk like everything else, but step 4 below is
genuinely not tested beforehand: whether the inpainting model works is found
out live, on stage, same as the audience.

## What it does

- `broken-example.js` — the naive first attempt: a hard-coded, invalid SDXL
  `width`/`height` pair (`300 × 600`), left broken on purpose.
- `worker.js` — the hardened version: per-model `width`/`height` clamping,
  plus the reference-image (img2img) attempt, still included as a documented
  failure rather than deleted.

## Infrastructure

| Needed | Required? |
|---|---|
| `AI` binding | Yes |
| Environment variables | No — model selectable per-request via `model` in the body |
| KV namespace | No |
| Database | No |

## Deploy (dashboard, no local tooling)

1. Create **two** Workers (or reuse one and swap the pasted file mid-demo):
   one for `broken-example.js`, one for `worker.js`.
2. Settings → Bindings → add an `AI` binding (`AI`) on both.
3. Save and deploy both.

## Live demo script

1. Call `broken-example.js` — watch it fail on the bad dimensions live.
2. Switch to `worker.js`, same-ish prompt, no `width`/`height` — works, using
   `flux-1-schnell`.
3. Trigger the NSFW false positive: POST a prompt like *"portrait of a viking
   warrior with a wild beard"* — Workers AI's own content filter rejects it.
   This is the platform's behavior, not something this code implements —
   you're just triggering it.
4. **The reference-image moment — play this live and unscripted, per plan:**
   while rebuilding this phase, I checked `IMG2IMG_MODEL_ATTEMPTED`
   (`@cf/runwayml/stable-diffusion-v1-5-img2img`, the ID the original code
   used) against the live model catalog. **It doesn't exist there.** The
   catalog only lists `@cf/runwayml/stable-diffusion-v1-5-inpainting`
   (`INPAINTING_MODEL_CURRENT` in `worker.js`). That's a real candidate for
   *why* the reference-image flow never worked — not a mysterious platform
   quirk, possibly just a wrong model ID the whole time.

   **Read this before presenting, though:** `base-code/copilot/cloudflare/07-workers-ai-image-generation-guidelines.md`
   is a separate, live-verified source that tells a more specific story —
   `stable-diffusion-v1-5-img2img` *does* exist in the catalog, it's just
   **account-gated** (error `5018`) on typical accounts, a different failure
   mode than "wrong ID." The two notes haven't been reconciled yet; check
   which one actually matches your account's behavior before deciding what
   to say on stage.

   `worker.js` accepts either ID in the `model` field. **Deliberately don't pre-test which one
   works before the talk** — this is the one moment in the whole run-of-show
   that's a genuine live unknown, matching the honest tone of everything
   else in this talk:
   - Try `IMG2IMG_MODEL_ATTEMPTED` first — reproduces the original failure.
   - Then try `INPAINTING_MODEL_CURRENT` live. Inpainting expects a mask
     alongside the reference image, so it's not guaranteed to "just work,"
     but if it does, that's a real find happening in front of the audience.
     If it doesn't, the lesson lands anyway: verify model IDs against the
     current catalog before concluding a *feature* is broken.
5. Land it: "Image generation is the least uniform part of this catalog —
   plan for per-model handling, not a shared code path. And maybe — don't
   take my word on 'never worked' without checking it again yourself."

```bash
curl -X POST https://<broken-worker>.workers.dev

curl -X POST https://<worker>.workers.dev \
  -H "content-type: application/json" \
  -d '{"prompt": "portrait of a viking warrior with a wild beard"}'
```

## If asked about video generation

Image generation on this platform hasn't been demonstrated as stable in this
talk yet — that's the whole point of this phase. Video generation is
deliberately out of scope: **there's no intent to test video on Workers AI
until image generation stabilizes.** This question is likely to come up
given the parameter inconsistencies and open reference-image failure just
demonstrated, so have the line ready rather than fielding it cold:

> "I haven't touched video generation on this platform, on purpose. Image
> generation alone has the rough edges you just watched — inconsistent
> parameters, a live unknown on reference images. Video's a harder problem
> than image, not an easier one, so I'm not testing it until image
> generation itself is in better shape."

Don't improvise a technical answer about Workers AI's video capabilities on
the spot — this repo has no video-generation code, no research into it, and
no basis for claiming it works, half-works, or doesn't exist. The honest
answer is the scoping decision above, not a guess.

## Gap vs. the base code

`base-code/image-generation/image-generator.js` is bundled/compiled output
(esbuild's `__name` helper, a `sourceMappingURL` comment) — not hand-written
source. `worker.js` here is a clean rewrite of the same logic
(`clampDimensions`, the img2img branch), not an edit of that file.
