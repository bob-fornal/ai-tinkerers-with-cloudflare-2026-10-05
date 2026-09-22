// Phase 6 -- same AI call, three languages. This is the TypeScript variant.
// Note going in: Wrangler transpiles this to the same JS the "js" variant
// already is before it ever reaches the Workers runtime. Expect near-identical
// timing to the JS worker -- that's not a bug in the comparison, it's the result.

export interface Env {
  AI: Ai;
}

const MODEL = "@cf/meta/llama-3.2-1b-instruct";
const PROMPT = "In one sentence, what is Cloudflare Workers AI?";

interface AiTextResult {
  response: string;
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const start = Date.now();
    const result = (await env.AI.run(MODEL, { prompt: PROMPT })) as AiTextResult;
    const elapsedMs = Date.now() - start;

    return Response.json({ language: "typescript", model: MODEL, elapsedMs, response: result.response });
  },
};
