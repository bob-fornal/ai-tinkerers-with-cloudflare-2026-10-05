// Phase 6 -- same AI call, three languages. This is the JS variant.

const MODEL = "@cf/meta/llama-3.2-1b-instruct";
const PROMPT = "In one sentence, what is Cloudflare Workers AI?";

export default {
  async fetch(request, env) {
    const start = Date.now();
    const result = await env.AI.run(MODEL, { prompt: PROMPT });
    const elapsedMs = Date.now() - start;

    return Response.json({ language: "javascript", model: MODEL, elapsedMs, response: result.response });
  },
};
