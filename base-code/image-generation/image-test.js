export default {
  async fetch(request, env) {
    // 1. Check if the request method is allowed (optional, but good practice)
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      // 2. Define the deterministic payload parameters
      const payload = {
        prompt: "A futuristic city skyline at sunset, cyberpunk aesthetic, highly detailed",
        seed: 42,        // Fixed seed ensures the starting noise is identical
        num_steps: 20,   // Fixed steps ensure identical processing depth
        guidance: 7.5,    // Fixed guidance keeps prompt adherence consistent
        width: 300,
        height: 600,
      };

      // 3. Run the model using the AI binding assigned to your environment
      // (Using Stable Diffusion XL Base as an example)
      const response = await env.AI.run(
        '@cf/stabilityai/stable-diffusion-xl-base-1.0', 
        payload
      );

      // 4. Return the binary image data directly to the browser with the correct header
      return new Response(response, {
        headers: {
          "Content-Type": "image/png",
        },
      });

    } catch (error) {
      // 5. Catch and return any errors (e.g., binding missing, quota limits)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },
};