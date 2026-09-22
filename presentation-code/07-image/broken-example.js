// Phase 7 -- the naive first attempt, left broken on purpose. 300x600 is not
// a valid width/height pair for this model: dimensions need to fall within a
// fixed min/max range and land on a fixed step, and 300 doesn't. This is the
// reproducible break behind "height/width broke models" in the PRD.

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const payload = {
        prompt: "A futuristic city skyline at sunset, cyberpunk aesthetic, highly detailed",
        seed: 42,
        num_steps: 20,
        guidance: 7.5,
        width: 300,
        height: 600,
      };

      const response = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", payload);

      return new Response(response, { headers: { "content-type": "image/png" } });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  },
};
