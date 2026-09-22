var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var DEFAULT_MODEL = "@cf/black-forest-labs/flux-1-schnell";
var IMG2IMG_MODEL = "@cf/runwayml/stable-diffusion-v1-5-img2img";
var SDXL_MIN_DIMENSION = 256;
var SDXL_MAX_DIMENSION = 2048;
var SDXL_DIMENSION_STEP = 8;
function clampDimensions(width, height) {
  let w = width;
  let h = height;
  const largest = Math.max(w, h);
  if (largest > SDXL_MAX_DIMENSION) {
    const scale = SDXL_MAX_DIMENSION / largest;
    w = w * scale;
    h = h * scale;
  }
  const smallest = Math.min(w, h);
  if (smallest < SDXL_MIN_DIMENSION) {
    const scale = SDXL_MIN_DIMENSION / smallest;
    w = w * scale;
    h = h * scale;
  }
  w = Math.round(w / SDXL_DIMENSION_STEP) * SDXL_DIMENSION_STEP;
  h = Math.round(h / SDXL_DIMENSION_STEP) * SDXL_DIMENSION_STEP;
  w = Math.min(Math.max(w, SDXL_MIN_DIMENSION), SDXL_MAX_DIMENSION);
  h = Math.min(Math.max(h, SDXL_MIN_DIMENSION), SDXL_MAX_DIMENSION);
  return { width: w, height: h };
}
__name(clampDimensions, "clampDimensions");
function clampSingleDimension(value) {
  const clamped = Math.min(Math.max(value, SDXL_MIN_DIMENSION), SDXL_MAX_DIMENSION);
  return Math.round(clamped / SDXL_DIMENSION_STEP) * SDXL_DIMENSION_STEP;
}
__name(clampSingleDimension, "clampSingleDimension");
var worker_default = {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response(
        "Method Not Allowed. POST a JSON body: { prompt, model?, width?, height?, seed?, images? }",
        { status: 405 }
      );
    }
    if (!env.CLOUDFLARE_API_TOKEN) {
      return new Response("Worker misconfigured: CLOUDFLARE_API_TOKEN secret is not set.", {
        status: 500
      });
    }
    const authHeader = request.headers.get("Authorization") || "";
    if (authHeader !== `Bearer ${env.CLOUDFLARE_API_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response("Invalid JSON body", { status: 400 });
    }
    const prompt = body.prompt;
    if (!prompt || typeof prompt !== "string") {
      return new Response("Missing required field: prompt", { status: 400 });
    }
    const model = body.model || DEFAULT_MODEL;
    const params = { prompt };
    if (Number.isFinite(body.width) && Number.isFinite(body.height)) {
      const { width, height } = clampDimensions(body.width, body.height);
      params.width = width;
      params.height = height;
    } else if (Number.isFinite(body.width)) {
      params.width = clampSingleDimension(body.width);
    } else if (Number.isFinite(body.height)) {
      params.height = clampSingleDimension(body.height);
    }
    if (Number.isFinite(body.seed)) {
      params.seed = body.seed;
    }
    if (Array.isArray(body.images) && typeof body.images[0] === "string" && model === IMG2IMG_MODEL) {
      const binary = Uint8Array.from(atob(body.images[0]), (c) => c.charCodeAt(0));
      params.image = Array.from(binary);
    }
    if (Array.isArray(body.images) && typeof body.images[0] === "string" && typeof body.imageField === "string") {
      if (body.imageField === "image_b64") {
        params.image_b64 = body.images[0];
      } else if (body.imageField === "image") {
        const binary = Uint8Array.from(atob(body.images[0]), (c) => c.charCodeAt(0));
        params.image = Array.from(binary);
      } else {
        return new Response(`Unsupported imageField: ${body.imageField} (expected "image" or "image_b64")`, { status: 400 });
      }
    }
    let result;
    try {
      result = await env.AI.run(model, params);
    } catch (err) {
      return new Response(`AI generation failed: ${err.message}`, { status: 502 });
    }
    if (result && typeof result === "object" && typeof result.image === "string") {
      const binary = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0));
      return new Response(binary, { headers: { "Content-Type": "image/jpeg" } });
    }
    return new Response(result, { headers: { "Content-Type": "image/png" } });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
