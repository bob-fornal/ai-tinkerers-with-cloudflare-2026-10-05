#!/usr/bin/env node
/**
 * Fetches Cloudflare's Workers AI pricing page, parses every model pricing table,
 * and prints a PricingTable JSON object shaped exactly like src/pricing.ts's
 * ModelPricing entries — ready to hand to PATCH/PUT /api/pricing.
 *
 * Usage:
 *   node scripts/fetch-pricing.mjs                        Fetch live page, print table JSON to stdout
 *   node scripts/fetch-pricing.mjs --out pricing.json      Write the table JSON to a file instead
 *   node scripts/fetch-pricing.mjs --source ./page.html    Parse a local HTML file instead of fetching
 *   node scripts/fetch-pricing.mjs --worker-url https://x  Diff the parsed table against the live
 *                                  --api-key <key>          Worker's current KV-stored table
 *   node scripts/fetch-pricing.mjs --worker-url https://x --api-key <key> \
 *                                  --admin-token <token> --push
 *                                                            Same, then PATCH only the changed/new
 *                                                            models into the live Worker
 *
 * Env vars API_KEY / PRICING_ADMIN_TOKEN are used if the matching --api-key /
 * --admin-token flags aren't passed.
 *
 * This is a maintenance tool, not part of the deployed Worker (nothing outside
 * src/ is bundled by wrangler). Review the diff before using --push — "other"-unit
 * entries in particular use best-effort auto-generated rate keys; the model ID and
 * numeric values are read directly from the page, but a key name is a guess.
 */

const PRICING_URL = "https://developers.cloudflare.com/workers-ai/platform/pricing/";

const SECTIONS = [
  { id: "llm-model-pricing", label: "LLM" },
  { id: "embeddings-model-pricing", label: "Embeddings" },
  { id: "image-model-pricing", label: "Image" },
  { id: "audio-model-pricing", label: "Audio" },
  { id: "other-model-pricing", label: "Other" },
];

function parseArgs(argv) {
  const args = { push: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--push") args.push = true;
    else if (a === "--source") args.source = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--worker-url") args.workerUrl = argv[++i];
    else if (a === "--api-key") args.apiKey = argv[++i];
    else if (a === "--admin-token") args.adminToken = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

async function loadHtml(source) {
  if (!source) {
    const res = await fetch(PRICING_URL, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`Failed to fetch ${PRICING_URL}: HTTP ${res.status}`);
    return res.text();
  }
  const fs = await import("node:fs/promises");
  return fs.readFile(source, "utf8");
}

function sliceSection(html, id, nextId) {
  const start = html.indexOf(`id="${id}"`);
  if (start === -1) throw new Error(`Could not find section heading id="${id}" — page structure may have changed.`);
  const end = nextId ? html.indexOf(`id="${nextId}"`) : html.length;
  return html.slice(start, end === -1 ? html.length : end);
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseNeuronLines(cellHtml) {
  return cellHtml
    .split(/<br\s*\/?>/i)
    .map(stripTags)
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([\d,.]+)\s+neurons?\s+per\s+(.+?)\.?$/i);
      if (!m) return null;
      return { neurons: Number(m[1].replace(/,/g, "")), phrase: m[2].trim() };
    })
    .filter(Boolean);
}

function slugifyRateKey(phrase) {
  const cleaned = phrase.replace(/\([^)]*\)/g, "").trim();
  const words = cleaned.split(/[^a-z0-9]+/i).filter(Boolean);
  if (words.length === 0) return "perUnit";
  const camel = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
  return "per" + camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** Strips a trailing " (WebSocket)"-style qualifier, returning [baseModelId, tag|null]. */
function splitModelVariant(rawModel) {
  const m = rawModel.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return [rawModel, null];
  return [m[1].trim(), m[2].trim()];
}

function parseSectionRows(html, sectionLabel) {
  const rowMatches = html.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
  const rows = [];
  for (const row of rowMatches) {
    const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 3) continue;
    const rawModel = stripTags(cells[0]);
    if (!rawModel.startsWith("@cf/")) continue;
    const [model, variantTag] = splitModelVariant(rawModel);
    const lines = parseNeuronLines(cells[2]);
    rows.push({ model, variantTag, lines, sectionLabel });
  }
  return rows;
}

/** Merges same-model rows (e.g. a base row + a "(WebSocket)" variant row) into one entry. */
function buildPricingTable(allRows) {
  const byModel = new Map();

  for (const row of allRows) {
    if (!byModel.has(row.model)) {
      byModel.set(row.model, { sectionLabel: row.sectionLabel, inputTokens: undefined, outputTokens: undefined, cachedInputTokens: undefined, otherRates: {}, rawLines: [] });
    }
    const entry = byModel.get(row.model);

    for (const { neurons, phrase } of row.lines) {
      entry.rawLines.push(phrase);
      const p = phrase.toLowerCase();
      if (p === "m input tokens") entry.inputTokens = neurons;
      else if (p === "m output tokens") entry.outputTokens = neurons;
      else if (p === "m cached input tokens") entry.cachedInputTokens = neurons;
      else {
        let key = slugifyRateKey(phrase);
        if (row.variantTag) key += row.variantTag.replace(/[^a-z0-9]/gi, "");
        entry.otherRates[key] = neurons;
      }
    }
  }

  const table = {};
  for (const [model, e] of byModel) {
    if (e.inputTokens !== undefined || e.outputTokens !== undefined) {
      table[model] = {
        unit: "tokens",
        neuronsPerMillionInputTokens: e.inputTokens ?? 0,
        neuronsPerMillionOutputTokens: e.outputTokens ?? 0,
        ...(e.cachedInputTokens !== undefined ? { neuronsPerMillionCachedInputTokens: e.cachedInputTokens } : {}),
      };
    } else {
      table[model] = {
        unit: "other",
        description: `${e.sectionLabel}: ${e.rawLines.join("; ")}`,
        rates: e.otherRates,
      };
    }
  }
  return table;
}

function diffTables(current, next) {
  const added = [];
  const changed = [];
  const unchanged = [];
  const removedFromPage = [];

  for (const model of Object.keys(next)) {
    if (!(model in current)) {
      added.push(model);
    } else if (JSON.stringify(current[model]) !== JSON.stringify(next[model])) {
      changed.push(model);
    } else {
      unchanged.push(model);
    }
  }
  for (const model of Object.keys(current)) {
    if (!(model in next)) removedFromPage.push(model);
  }
  return { added, changed, unchanged, removedFromPage };
}

function printHelp() {
  console.log(`Usage: node scripts/fetch-pricing.mjs [options]

  --source <url|path>    Parse this HTML instead of fetching the live pricing page
  --out <path>           Write the parsed PricingTable JSON here (default: stdout)
  --worker-url <url>     Deployed Worker base URL — enables diffing against its live
                         GET /api/pricing table
  --api-key <key>        x-api-key for --worker-url calls (or set API_KEY env var)
  --admin-token <token>  PRICING_ADMIN_TOKEN for --push (or set PRICING_ADMIN_TOKEN env var)
  --push                 PATCH the added/changed models into --worker-url (requires
                         --worker-url, --api-key, --admin-token)
  --help                 Show this help
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const apiKey = args.apiKey ?? process.env.API_KEY;
  const adminToken = args.adminToken ?? process.env.PRICING_ADMIN_TOKEN;

  const html = await loadHtml(args.source);

  const allRows = [];
  for (let i = 0; i < SECTIONS.length; i++) {
    const { id, label } = SECTIONS[i];
    const nextId = SECTIONS[i + 1]?.id;
    const section = sliceSection(html, id, nextId);
    allRows.push(...parseSectionRows(section, label));
  }

  const table = buildPricingTable(allRows);
  const modelCount = Object.keys(table).length;
  console.error(`Parsed ${modelCount} models from ${allRows.length} row(s) across ${SECTIONS.length} sections.`);

  let diff = null;
  if (args.workerUrl) {
    if (!apiKey) throw new Error("--worker-url given but no --api-key (or API_KEY env var) provided.");
    const res = await fetch(new URL("/api/pricing", args.workerUrl), {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) throw new Error(`GET /api/pricing failed: HTTP ${res.status}: ${await res.text()}`);
    const current = (await res.json()).pricing;
    diff = diffTables(current, table);
    console.error(
      `Diff vs live table: ${diff.added.length} new, ${diff.changed.length} changed, ${diff.unchanged.length} unchanged, ${diff.removedFromPage.length} on record but no longer on the page.`
    );
    if (diff.added.length) console.error("  New:     " + diff.added.join(", "));
    if (diff.changed.length) console.error("  Changed: " + diff.changed.join(", "));
    if (diff.removedFromPage.length) console.error("  Stale?:  " + diff.removedFromPage.join(", ") + " (kept as-is; page no longer lists them)");
  }

  if (args.push) {
    if (!args.workerUrl || !apiKey || !adminToken) {
      throw new Error("--push requires --worker-url, --api-key (or API_KEY), and --admin-token (or PRICING_ADMIN_TOKEN).");
    }
    const toPush = diff ? [...diff.added, ...diff.changed] : Object.keys(table);
    if (toPush.length === 0) {
      console.error("Nothing to push — live table already matches the page.");
    } else {
      const body = Object.fromEntries(toPush.map((m) => [m, table[m]]));
      const res = await fetch(new URL("/api/pricing", args.workerUrl), {
        method: "PATCH",
        headers: { "x-api-key": apiKey, authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`PATCH /api/pricing failed: HTTP ${res.status}: ${await res.text()}`);
      console.error(`Pushed ${toPush.length} model(s): ${toPush.join(", ")}`);
    }
  }

  const json = JSON.stringify(table, null, 2);
  if (args.out) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(args.out, json + "\n", "utf8");
    console.error(`Wrote table to ${args.out}`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
