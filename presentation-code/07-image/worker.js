// Phase 7 -- the hardened version. Per-model parameter handling for
// width/height, plus the reference-image (img2img) attempt kept in as a
// documented, still-unresolved failure -- see the README for what this
// rebuild actually turned up about why it never worked.

const DEFAULT_MODEL = "@cf/black-forest-labs/flux-1-schnell";

// The model ID the original code called for reference-image generation.
// It does not appear anywhere in today's Workers AI model catalog.
const IMG2IMG_MODEL_ATTEMPTED = "@cf/runwayml/stable-diffusion-v1-5-img2img";

// What the catalog actually lists today under runwayml/stable-diffusion-v1-5 --
// "inpainting", not "img2img". Close enough in name that it's an easy mix-up,
// and different enough in behavior (inpainting expects a mask) that swapping
// the ID alone isn't guaranteed to just work -- try it live and see.
const INPAINTING_MODEL_CURRENT = "@cf/runwayml/stable-diffusion-v1-5-inpainting";

const MIN_DIMENSION = 256;
const MAX_DIMENSION = 2048;
const DIMENSION_STEP = 8;

function clampDimension(value) {
  const clamped = Math.min(Math.max(value, MIN_DIMENSION), MAX_DIMENSION);
  return Math.round(clamped / DIMENSION_STEP) * DIMENSION_STEP;
}

function clampDimensions(width, height) {
  let w = width;
  let h = height;

  const largest = Math.max(w, h);
  if (largest > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / largest;
    w *= scale;
    h *= scale;
  }
  const smallest = Math.min(w, h);
  if (smallest < MIN_DIMENSION) {
    const scale = MIN_DIMENSION / smallest;
    w *= scale;
    h *= scale;
  }

  return { width: clampDimension(w), height: clampDimension(h) };
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response(
        "POST { prompt, model?, width?, height?, seed?, images? } -- images: [base64Image]",
        { status: 405 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { prompt } = body;
    if (!prompt || typeof prompt !== "string") {
      return new Response("Missing required field: prompt", { status: 400 });
    }

    const model = body.model || DEFAULT_MODEL;
    const params = { prompt };

    // Not every model accepts width/height the same way -- flux-1-schnell is
    // forgiving, SDXL needs them clamped to a valid range and step.
    if (Number.isFinite(body.width) && Number.isFinite(body.height)) {
      Object.assign(params, clampDimensions(body.width, body.height));
    } else if (Number.isFinite(body.width)) {
      params.width = clampDimension(body.width);
    } else if (Number.isFinite(body.height)) {
      params.height = clampDimension(body.height);
    }

    if (Number.isFinite(body.seed)) params.seed = body.seed;

    // Reference-image path -- accepts either attempted or current model ID so
    // both can be tried live without redeploying.
    if (Array.isArray(body.images) && typeof body.images[0] === "string") {
      if (model === IMG2IMG_MODEL_ATTEMPTED || model === INPAINTING_MODEL_CURRENT) {
        const binary = Uint8Array.from(atob(body.images[0]), (c) => c.charCodeAt(0));
        params.image = Array.from(binary);
      }
    }

    let result;
    try {
      result = await env.AI.run(model, params);
    } catch (err) {
      return Response.json({ model, error: err.message }, { status: 502 });
    }

    if (result && typeof result === "object" && typeof result.image === "string") {
      const binary = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0));
      return new Response(binary, { headers: { "content-type": "image/jpeg" } });
    }

    return new Response(result, { headers: { "content-type": "image/png" } });
  },
};
