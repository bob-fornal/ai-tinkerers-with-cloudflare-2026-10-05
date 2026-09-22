import { DurableObject } from "cloudflare:workers";
import { CONTENT_VERSION } from "./generated/content-version";
import cloudflareLearningsMarkdown from "../content/generated/cloudflare-learnings.md";
import landingPageHtml from "../content/index.html";

const STORAGE_KEY_MARKDOWN = "content:markdown";
const STORAGE_KEY_HTML = "content:html";
const STORAGE_KEY_VERSION = "content:version";

/**
 * Pure storage for Bob's Cloudflare Learnings content. It holds no MCP
 * protocol logic (see src/index.ts) — just the bundled Markdown/HTML,
 * seeded into Durable Object storage whenever CONTENT_VERSION changes.
 * There is no write path: the only way to change what's served is to
 * edit the content files and redeploy.
 */
export class LearningsHub extends DurableObject {
  private seeding?: Promise<void>;

  private ensureSeeded(): Promise<void> {
    if (!this.seeding) {
      this.seeding = this.seed();
    }
    return this.seeding;
  }

  private async seed(): Promise<void> {
    const storedVersion = await this.ctx.storage.get<string>(STORAGE_KEY_VERSION);
    if (storedVersion === CONTENT_VERSION) return;

    await this.ctx.storage.put({
      [STORAGE_KEY_MARKDOWN]: cloudflareLearningsMarkdown,
      [STORAGE_KEY_HTML]: landingPageHtml,
      [STORAGE_KEY_VERSION]: CONTENT_VERSION,
    });
  }

  async getMarkdown(): Promise<string> {
    await this.ensureSeeded();
    return (await this.ctx.storage.get<string>(STORAGE_KEY_MARKDOWN)) ?? "";
  }

  async getHtml(): Promise<string> {
    await this.ensureSeeded();
    return (await this.ctx.storage.get<string>(STORAGE_KEY_HTML)) ?? "";
  }
}
