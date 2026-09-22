# Phase 6 -- same AI call, three languages. This is the Python Workers
# variant, run through Pyodide (a WASM Python runtime), not V8 -- a different
# execution model from the JS/TS variants, not just a different syntax.

import time
from workers import Response

MODEL = "@cf/meta/llama-3.2-1b-instruct"
PROMPT = "In one sentence, what is Cloudflare Workers AI?"


async def on_fetch(request, env):
    start = time.time()
    result = await env.AI.run(MODEL, {"prompt": PROMPT})
    elapsed_ms = round((time.time() - start) * 1000)

    return Response.json({
        "language": "python",
        "model": MODEL,
        "elapsedMs": elapsed_ms,
        "response": result.response,
    })
