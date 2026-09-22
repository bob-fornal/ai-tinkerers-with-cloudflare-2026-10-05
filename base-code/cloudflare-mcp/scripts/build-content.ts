// Merges content/cloudflare_worker.agent.md (intro) and content/cloudflare/NN-*.md
// (sections, in numeric-prefix order) into a single Markdown document, rewriting
// same-collection cross-links into in-document anchors. Fails the build if any
// such link can't be resolved.
//
// Runs on Node at build time (`npm run build:content`, wired as predev/predeploy)
// — this script never ships to the Worker runtime, so Node built-ins are fine here.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const SECTIONS_DIR = path.join(CONTENT_DIR, "cloudflare");
const INTRO_FILE = path.join(CONTENT_DIR, "cloudflare_worker.agent.md");
const HTML_FILE = path.join(CONTENT_DIR, "index.html");
const OUT_DIR = path.join(CONTENT_DIR, "generated");
const OUT_MARKDOWN = path.join(OUT_DIR, "cloudflare-learnings.md");
const VERSION_OUT_DIR = path.join(ROOT, "src", "generated");
const VERSION_OUT_FILE = path.join(VERSION_OUT_DIR, "content-version.ts");

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const SECTION_FILE_RE = /^(\d+)-.*\.md$/;

interface FileIndexEntry {
  slug: string;
  headingSlugs: Set<string>;
}

interface SectionFile {
  filename: string;
  title: string;
  slug: string;
  headingSlugs: Set<string>;
  raw: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function collectHeadingSlugs(markdown: string): Set<string> {
  const slugs = new Set<string>();
  const seen = new Map<string, number>();
  for (const line of markdown.split("\n")) {
    const match = HEADING_RE.exec(line);
    if (!match) continue;
    let slug = slugify(match[2]);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    slugs.add(slug);
  }
  return slugs;
}

function extractTitle(markdown: string, label: string): string {
  for (const line of markdown.split("\n")) {
    const match = HEADING_RE.exec(line);
    if (match && match[1] === "#") {
      return match[2].trim();
    }
  }
  throw new Error(`${label}: no top-level "# Heading" found`);
}

function removeFirstH1(markdown: string): string {
  const lines = markdown.split("\n");
  const index = lines.findIndex((line) => /^#\s+/.test(line));
  if (index === -1) return markdown;
  lines.splice(index, 1);
  return lines.join("\n");
}

function demoteHeadings(markdown: string): string {
  // Adds one "#" to every heading (1-5 levels deep) so a file's own H2s
  // nest correctly under the H2 section heading it becomes in the merged doc.
  return markdown.replace(/^(#{1,5})(\s+)/gm, "#$1$2");
}

function loadSections(): SectionFile[] {
  const filenames = readdirSync(SECTIONS_DIR)
    .filter((name) => SECTION_FILE_RE.test(name))
    .sort((a, b) => {
      const numA = Number(SECTION_FILE_RE.exec(a)![1]);
      const numB = Number(SECTION_FILE_RE.exec(b)![1]);
      return numA - numB;
    });

  if (filenames.length === 0) {
    throw new Error(`No section files matching NN-*.md found in ${SECTIONS_DIR}`);
  }

  return filenames.map((filename) => {
    const filePath = path.join(SECTIONS_DIR, filename);
    const raw = readFileSync(filePath, "utf8");
    const title = extractTitle(raw, filename);
    return {
      filename,
      title,
      slug: slugify(title),
      headingSlugs: collectHeadingSlugs(raw),
      raw,
    };
  });
}

function buildFileIndex(sections: SectionFile[], introTitle: string): Map<string, FileIndexEntry> {
  const index = new Map<string, FileIndexEntry>();
  index.set(path.basename(INTRO_FILE), {
    slug: slugify(introTitle),
    headingSlugs: collectHeadingSlugs(readFileSync(INTRO_FILE, "utf8")),
  });
  for (const section of sections) {
    index.set(section.filename, {
      slug: section.slug,
      headingSlugs: section.headingSlugs,
    });
  }
  return index;
}

function rewriteLinks(
  markdown: string,
  sourceLabel: string,
  currentHeadingSlugs: Set<string>,
  fileIndex: Map<string, FileIndexEntry>,
  errors: string[],
): string {
  return markdown.replace(LINK_RE, (full, text, target) => {
    const trimmedTarget = (target as string).trim();

    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedTarget)) {
      // Absolute URL (http:, https:, mailto:, etc.) — leave untouched.
      return full;
    }

    const hashIndex = trimmedTarget.indexOf("#");
    const filePart = hashIndex === -1 ? trimmedTarget : trimmedTarget.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? undefined : trimmedTarget.slice(hashIndex + 1);

    if (filePart === "") {
      // Same-file fragment link, e.g. (#some-heading) — validate against the current file.
      if (fragment && !currentHeadingSlugs.has(fragment)) {
        errors.push(
          `${sourceLabel}: link "${full}" references fragment "#${fragment}", which does not match any heading in this file.`,
        );
      }
      return full;
    }

    if (!filePart.endsWith(".md")) {
      // Not a markdown cross-link (image, other asset, etc.) — leave untouched.
      return full;
    }

    const normalizedFilePart = path.basename(filePart);
    const targetEntry = fileIndex.get(normalizedFilePart);

    if (!targetEntry) {
      errors.push(
        `${sourceLabel}: link "${full}" points at "${filePart}", which is not a known file in this collection.`,
      );
      return full;
    }

    if (fragment) {
      if (!targetEntry.headingSlugs.has(fragment)) {
        errors.push(
          `${sourceLabel}: link "${full}" references "${filePart}#${fragment}", but "${filePart}" has no matching heading.`,
        );
        return full;
      }
      return `[${text}](#${fragment})`;
    }

    return `[${text}](#${targetEntry.slug})`;
  });
}

function main(): void {
  const introRaw = readFileSync(INTRO_FILE, "utf8");
  const introTitle = extractTitle(introRaw, "cloudflare_worker.agent.md");
  const introHeadingSlugs = collectHeadingSlugs(introRaw);

  const sections = loadSections();
  const fileIndex = buildFileIndex(sections, introTitle);

  const errors: string[] = [];

  const introBody = rewriteLinks(
    removeFirstH1(introRaw).trim(),
    "cloudflare_worker.agent.md",
    introHeadingSlugs,
    fileIndex,
    errors,
  );

  const renderedSections = sections.map((section) => {
    const body = demoteHeadings(removeFirstH1(section.raw)).trim();
    const rewrittenBody = rewriteLinks(body, section.filename, section.headingSlugs, fileIndex, errors);
    return { ...section, rewrittenBody };
  });

  if (errors.length > 0) {
    console.error("Content build failed — broken cross-links found:\n");
    for (const error of errors) console.error(`  - ${error}`);
    console.error(`\n${errors.length} error(s). Fix the link(s) above and rerun the build.`);
    process.exit(1);
  }

  const toc = renderedSections.map((section) => `- [${section.title}](#${section.slug})`).join("\n");

  const mergedSections = renderedSections
    .map((section) => `## ${section.title}\n\n${section.rewrittenBody}`)
    .join("\n\n");

  const merged = [
    `# ${introTitle}`,
    "",
    introBody,
    "",
    "## Table of Contents",
    "",
    toc,
    "",
    mergedSections,
    "",
  ].join("\n");

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_MARKDOWN, merged, "utf8");

  const htmlRaw = readFileSync(HTML_FILE, "utf8");
  const version = createHash("sha256").update(merged).update(htmlRaw).digest("hex").slice(0, 12);

  mkdirSync(VERSION_OUT_DIR, { recursive: true });
  writeFileSync(
    VERSION_OUT_FILE,
    `// Generated by scripts/build-content.ts — do not edit by hand.\nexport const CONTENT_VERSION = ${JSON.stringify(version)};\n`,
    "utf8",
  );

  console.log(`Merged ${sections.length} section file(s) into ${path.relative(ROOT, OUT_MARKDOWN)}`);
  console.log(`Content version: ${version}`);
}

main();
