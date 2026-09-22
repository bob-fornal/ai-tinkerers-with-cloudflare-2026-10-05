// Attempt #1: collapse the AI-sounding parts away with a two-sentence
// summary. It "worked" in the sense that the output passed every AI-tell
// check -- there was nothing left long enough to fail them. Most of the
// actual content went with it. Kept here as the discarded first draft;
// see worker.js for what actually shipped.

const MODEL = "@cf/meta/llama-3.2-3b-instruct";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("POST { text }", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    if (!body.text || typeof body.text !== "string") {
      return new Response("Body must include 'text'", { status: 400 });
    }

    const prompt = `Summarize the following text in exactly two sentences:\n\n${body.text}`;
    const result = await env.AI.run(MODEL, { prompt });

    return Response.json({ original: body.text, microHumanized: result.response });
  },
};
