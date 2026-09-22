import type { Env } from "../lib/env";
import { checkUrlSafety } from "./ssrfGuard";

const FETCH_TIMEOUT_MS = 8_000;
const RENDER_TIMEOUT_MS = 25_000; // rendering a real page is much slower than a plain fetch
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;

export const MAX_CHILD_LINKS_PER_SOURCE = 5;
export const CRAWL_DEPTH = 1; // one level below each admin-supplied link, per §10 step 2

export interface FetchedPage {
  readonly source: "fetch" | "browser-rendering";
  readonly url: string;
  readonly text: string;
  readonly links: readonly string[];
  readonly textLength: number;
}

export interface FetchFailure {
  readonly url: string;
  readonly reason: string;
}

function stripHtml(html: string): string {
  const withoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  return withoutTags.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function extractHtmlLinks(html: string, baseUrl: string): readonly string[] {
  const links = new Set<string>();
  const hrefPattern = /href\s*=\s*["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        links.add(resolved.toString());
      }
    } catch {
      // ignore malformed hrefs
    }
  }
  return Array.from(links);
}

/** `[label](url)` extraction for Browser Rendering's `/markdown` output. */
function extractMarkdownLinks(markdown: string, baseUrl: string): readonly string[] {
  const links = new Set<string>();
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(markdown)) !== null) {
    const href = match[1];
    if (!href) continue;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        links.add(resolved.toString());
      }
    } catch {
      // ignore malformed links
    }
  }
  return Array.from(links);
}

/** Cost/reliability heuristic from docs/skills/cloudflare/SKILL.md: absolute floor + ratio to raw HTML length. */
function looksThin(textLength: number, htmlLength: number): boolean {
  if (textLength < 300) return true;
  return htmlLength > 0 && textLength / htmlLength < 0.05;
}

async function readCapped(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

/**
 * Plain fetch with SSRF guard, manual redirect validation (every hop is
 * re-checked, per §10 step 2), timeout, and a response-size cap. Always
 * drains or cancels the body on every return path to avoid the Workers
 * runtime's stalled-response protection under fan-out.
 */
type GuardedFetchResult = { readonly html: string } | { readonly error: string; readonly nonOkStatus?: number };

async function guardedFetch(startUrl: string): Promise<GuardedFetchResult> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return { error: `Invalid URL: ${currentUrl}` };
    }

    const safety = await checkUrlSafety(parsed);
    if (!safety.safe) {
      return { error: safety.reason ?? "URL failed safety check." };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(parsed.toString(), { redirect: "manual", signal: controller.signal });
    } catch (error) {
      return { error: `Network error fetching ${parsed.toString()}: ${String(error)}` };
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      await response.body?.cancel().catch(() => {});
      if (!location) {
        return { error: "Redirect with no Location header." };
      }
      currentUrl = new URL(location, parsed).toString();
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { error: `Non-2xx status: ${response.status}`, nonOkStatus: response.status };
    }

    const html = await readCapped(response);
    if (html === null) {
      return { error: "Response exceeded size cap." };
    }
    return { html };
  }

  return { error: "Too many redirects." };
}

async function renderViaBrowserRendering(url: string, env: Env): Promise<{ markdown: string } | { error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/markdown`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.BROWSER_RENDERING_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      },
    );
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return { error: `Browser Rendering HTTP ${res.status}: ${bodyText.slice(0, 300)}` };
    }
    const body = (await res.json()) as { success: boolean; result?: string };
    if (!body.success || !body.result) {
      return { error: "Browser Rendering returned no result." };
    }
    return { markdown: body.result };
  } catch (error) {
    return { error: `Browser Rendering network error: ${String(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches one URL, falling back to Browser Rendering only on a network-layer
 * error or a thin-but-2xx plain-fetch result — never on a definitive non-2xx
 * (per the docs/skills/cloudflare/SKILL.md lesson about rendering paths the origin
 * already 404'd).
 */
export async function fetchPage(url: string, env: Env): Promise<FetchedPage | FetchFailure> {
  const plain = await guardedFetch(url);

  if ("html" in plain) {
    const text = stripHtml(plain.html);
    if (!looksThin(text.length, plain.html.length)) {
      return {
        source: "fetch",
        url,
        text,
        links: extractHtmlLinks(plain.html, url),
        textLength: text.length,
      };
    }
    // thin-but-2xx — fall through to Browser Rendering fallback
  } else if (plain.nonOkStatus !== undefined) {
    // definitive non-2xx from the origin — trust it, never render this path
    return { url, reason: plain.error };
  }

  const rendered = await renderViaBrowserRendering(url, env);
  if ("error" in rendered) {
    if ("html" in plain) {
      // thin plain-fetch result is still better than nothing
      const text = stripHtml(plain.html);
      return { source: "fetch", url, text, links: extractHtmlLinks(plain.html, url), textLength: text.length };
    }
    return { url, reason: rendered.error };
  }

  return {
    source: "browser-rendering",
    url,
    text: rendered.markdown,
    links: extractMarkdownLinks(rendered.markdown, url),
    textLength: rendered.markdown.length,
  };
}

export interface CrawlResult {
  readonly pages: readonly FetchedPage[];
  readonly failures: readonly FetchFailure[];
}

/**
 * §10 steps 2-3: fetches each admin-supplied link plus up to
 * `MAX_CHILD_LINKS_PER_SOURCE` of its child links (default crawl depth: one
 * level below it).
 */
export async function crawlSourceLinks(urls: readonly string[], env: Env): Promise<CrawlResult> {
  const pages: FetchedPage[] = [];
  const failures: FetchFailure[] = [];

  const topLevelResults = await Promise.all(urls.map((url) => fetchPage(url, env)));

  const childUrlSets: (readonly string[])[] = [];
  for (const result of topLevelResults) {
    if ("text" in result) {
      pages.push(result);
      childUrlSets.push(result.links.slice(0, MAX_CHILD_LINKS_PER_SOURCE));
    } else {
      failures.push(result);
      childUrlSets.push([]);
    }
  }

  const childUrls = childUrlSets.flat().slice(0, MAX_CHILD_LINKS_PER_SOURCE * urls.length);
  const childResults = await Promise.all(childUrls.map((url) => fetchPage(url, env)));
  for (const result of childResults) {
    if ("text" in result) {
      pages.push(result);
    } else {
      failures.push(result);
    }
  }

  return { pages, failures };
}
