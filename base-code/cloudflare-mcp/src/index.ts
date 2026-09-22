import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { LearningsHub } from "./learnings-hub";

export { LearningsHub };

interface Env {
  LEARNINGS_HUB: DurableObjectNamespace<LearningsHub>;
}

function getLearningsHub(env: Env) {
  const id = env.LEARNINGS_HUB.idFromName("singleton");
  return env.LEARNINGS_HUB.get(id);
}

const RESOURCE_URI = "cloudflare-learnings://document";

function createMcpFactory(env: Env) {
  return function createMcp() {
    const mcp = new McpServer({
      name: "bobs-cloudflare-mcp",
      version: "1.0.0",
    });

    mcp.registerResource(
      "cloudflare-learnings",
      RESOURCE_URI,
      {
        title: "Cloudflare Learnings",
        description:
          "Bob's hands-on Cloudflare Workers, Durable Objects, D1, KV, and Workers AI learnings.",
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: await getLearningsHub(env).getMarkdown(),
          },
        ],
      }),
    );

    mcp.registerTool(
      "get_cloudflare_learnings",
      {
        description:
          "Return Bob's Cloudflare Workers, Durable Objects, D1, KV, and Workers AI learnings as Markdown.",
        inputSchema: {},
      },
      async () => ({
        content: [{ type: "text" as const, text: await getLearningsHub(env).getMarkdown() }],
      }),
    );

    return mcp;
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return createMcpHandler(createMcpFactory(env), { route: "/mcp" })(request, env, ctx);
    }

    if (url.pathname === "/") {
      const html = await getLearningsHub(env).getHtml();
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
