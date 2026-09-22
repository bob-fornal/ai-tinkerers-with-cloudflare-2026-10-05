# Workers AI (Text-to-Image) Guidelines

These are confirmed live against real Workers AI endpoints, not assumed from
Cloudflare's documentation — see the Verification Discipline section for why
that distinction matters here specifically.

## Verification Discipline
* **Treat documented input schemas as unverified until tested live.** Cloudflare's own docs can list model input fields that don't actually work in production (e.g. `stable-diffusion-xl-base-1.0`'s docs list `image`/`image_b64` for img2img; the live model returns `"input tensor 'image' is not present in the model"` — a confirmed docs/platform gap, [cloudflare-docs#11835](https://github.com/cloudflare/cloudflare-docs/issues/11835)). Never ship a call to a new model/parameter combination without exercising it against the live endpoint first.
* **A `200` response is not proof a parameter did anything.** Some models accept an unsupported field, return `200`, and silently ignore it — one model returned byte-for-byte identical output with and without a reference image at the same seed. Another produced different output with vs. without a reference image, but neither resembled the reference at all — the difference came from an implicitly-triggered `strength` parameter shifting the sampling schedule, not from real image conditioning. Verify any conditioning/reference-image feature with a same-seed, with/without comparison of the actual output, not just the response code.
* **"It's in the code" and "it's live" are different claims.** A parameter or fix committed to the Worker source isn't in effect for real callers until deployed. Test the live endpoint and compare against what the source predicts — don't infer behavior from source alone.

## Model-Specific Constraints (confirmed live, not always documented)
* **`stable-diffusion-xl-base-1.0`:** honors `width`/`height`, range 256–2048px per side, and **each dimension must be a multiple of 8** (undocumented — a violation fails as an opaque upstream `502`, not a clean `400`). When clamping a caller-supplied size: scale to fit within the max, scale up to the min if still too small, round each dimension to the nearest multiple of 8, then re-clamp (rounding can nudge a value just outside the valid range). No image/img2img input despite what the docs claim.
* **`flux-1-schnell`:** ignores `width`, `height`, and `image` entirely — fixed output size, no error, no acknowledgment that the fields were even received. Don't rely on silence as confirmation a field was honored.
* **`@cf/leonardo/lucid-origin`:** out-of-range dimensions are silently clamped instead of erroring — a friendlier failure mode than sdxl; prefer it when graceful degradation matters more than an explicit error on bad input.
* **Named/preset sizes (e.g. "A4") don't mean their colloquial resolution.** A model's own caps (max dimension, multiple-of-8 step) mean the actual output is preset-*shaped*, not preset-*resolution*. Document the real resulting pixel dimensions wherever a named preset is exposed to a caller.
* **Re-check the model catalog periodically.** New models (and new capabilities like multi-reference support) appear in the [Workers AI Text-to-Image catalog](https://developers.cloudflare.com/workers-ai/models/?tasks=Text-to-Image) without any code change on your end triggering it.

## Error Code Triage
Match the exact error code/message before diagnosing — codes that look alike mean very different things and call for different fixes:
* `502` + `"input tensor '<field>' is not present in the model"` → a docs/platform bug (the model doesn't implement a field its docs claim to). Not your code; look for an open Cloudflare GitHub issue before spending time on the calling code.
* `502` + `5018` (`"This account is not allowed to access <model>"`) → account/plan gating. Not a code or docs problem — re-test later if access changes, and don't assume a `200` on retest proves the feature works (re-run the same-seed comparison from Verification Discipline above).
* `502` + `5006` (`"required properties at '/' are 'multipart'"`) → wrong request *shape*: the model expects `multipart/form-data`, not a flat JSON body. This is an implementation gap you can fix, not an external blocker — build the multipart request rather than waiting on Cloudflare or account access.
* A generic-looking auth failure (e.g. `wrangler login` failing with "invalid Authorization header") can be an **environment-variable name collision** rather than a stale credential — `wrangler` reads `CLOUDFLARE_API_TOKEN` from the environment for real account auth, so an app defining its own secret under that exact name will have it silently hijacked. Prefix app-level secrets (e.g. `PROD_CLOUDFLARE_API_TOKEN`) to avoid colliding with any name Wrangler itself reads.
* **Clearing one blocker can reveal a second, unrelated one behind it.** Don't assume a fix "unblocked the feature" just because the original error is gone — re-test the actual end-to-end goal, not just the absence of the first error.

## Reference-Image (img2img) Conditioning — Status as of this writing
None of the currently broadly-accessible Workers AI text-to-image models perform real reference-image conditioning:
* `stable-diffusion-xl-base-1.0` — documented `image`/`image_b64` fields error outright (see Verification Discipline above).
* `stable-diffusion-v1-5-img2img` — the model Cloudflare's catalog names as the img2img specialist, but account-gated (`5018`) on typical accounts.
* `stable-diffusion-xl-lightning` and `dreamshaper-8-lcm` — accept an image field and return `200`, but confirmed (via same-seed comparison) to not actually condition on it.
* `flux-2-dev` / `flux-2-klein-9b` / `flux-2-klein-4b` — advertise multi-reference support and are the most promising path forward, but require a `multipart/form-data` request body (`5006` on a flat JSON call) — a genuine Worker-side implementation task, not a blocked external dependency.
