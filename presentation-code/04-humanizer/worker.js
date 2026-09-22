// Phase 4 -- gating the humanizer. Deterministic JS checks (ported from
// claude/humanize-writing/scripts/check_ai_tells.py) run first, for free.
// Only text that actually fails a gate gets sent to a model at all, and
// only a small one, with a prompt scoped to just the flagged issues.

const BANNED_WORDS = [
  "delve", "tapestry", "pivotal", "underscore", "underscores", "foster",
  "fostering", "testament", "enhance", "intricate", "intricacies",
  "landscape", "boast", "boasts", "bolstered", "garner", "showcase",
  "meticulous", "meticulously", "robust", "vibrant", "realm", "beacon",
  "multifaceted", "noteworthy", "kaleidoscope", "nuanced", "comprehend",
  "commendable", "resonate", "illuminate", "compelling", "seamless",
  "transformative", "ever-evolving", "synergistic", "thought-provoking",
  "exemplary", "leverage", "synergy", "elevate", "unleash",
  "game-changing", "groundbreaking", "revolutionize", "revolutionary",
  "utilize", "commence", "facilitate", "endeavor", "ascertain", "nestled",
];

const BANNED_PHRASES = [
  "it's important to note", "it is important to note",
  "it's worth noting", "it is worth noting",
  "a testament to",
  "in today's fast-paced", "in today's digital",
  "imagine a world", "picture this",
  "let's dive deeper", "let's delve",
  "i hope this email finds you well",
  "not an exhaustive list",
  "as an ai language model",
  "in conclusion", "in summary",
  "rich cultural heritage", "in the heart of",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHits(textLower, terms) {
  const hits = {};
  for (const term of terms) {
    const matches = textLower.match(new RegExp(`\\b${escapeRegExp(term)}\\b`, "g"));
    if (matches && matches.length > 0) hits[term] = matches.length;
  }
  return hits;
}

function sentenceLengths(text) {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0)
    .map((s) => s.split(/\s+/).length);
}

function mean(values) {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function pstdev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function analyzeAiTells(text) {
  const textLower = text.toLowerCase();
  const wordCount = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  const emDashCount = (text.match(/—/g)?.length ?? 0) + (text.match(/--/g)?.length ?? 0);
  const lengths = sentenceLengths(text);

  const avgSentenceLen = lengths.length > 0 ? round(mean(lengths), 1) : 0;
  const stdevSentenceLen = lengths.length > 1 ? round(pstdev(lengths), 1) : 0;

  return {
    wordCount,
    bannedWordHits: findHits(textLower, BANNED_WORDS),
    bannedPhraseHits: findHits(textLower, BANNED_PHRASES),
    emDashCount,
    sentenceCount: lengths.length,
    avgSentenceLengthWords: avgSentenceLen,
    burstinessRatio: avgSentenceLen > 0 ? round(stdevSentenceLen / avgSentenceLen, 2) : 0,
  };
}

const BANNED_WORD_HIT_THRESHOLD = 3;
const BURSTINESS_THRESHOLD = 0.3;

function needsTargetedRevision(report) {
  const totalBannedWordHits = Object.values(report.bannedWordHits).reduce((sum, c) => sum + c, 0);
  const hasPhraseHits = Object.keys(report.bannedPhraseHits).length > 0;
  return totalBannedWordHits >= BANNED_WORD_HIT_THRESHOLD || hasPhraseHits || report.burstinessRatio < BURSTINESS_THRESHOLD;
}

function targetedRevisionPrompt(report) {
  const flaggedWords = Object.keys(report.bannedWordHits);
  const flaggedPhrases = Object.keys(report.bannedPhraseHits);
  const notes = [];
  if (flaggedWords.length > 0) notes.push(`flagged words: ${flaggedWords.join(", ")}`);
  if (flaggedPhrases.length > 0) notes.push(`flagged phrases: ${flaggedPhrases.join(", ")}`);
  if (report.burstinessRatio < BURSTINESS_THRESHOLD) {
    notes.push(`flat sentence rhythm (burstiness ratio ${report.burstinessRatio})`);
  }
  return (
    `Here's a style-checker report on this draft: ${notes.join("; ")}. ` +
    "Revise only where a flagged word or phrase is actually generic filler -- if it's the right word in " +
    "context, leave it alone. Fix flat sentence rhythm by combining or breaking up a few sentences, not by " +
    "rewriting the whole piece."
  );
}

const FIX_MODEL_DEFAULT = "@cf/meta/llama-3.2-1b-instruct";
const MAX_TOKENS = 1024; // carried forward from Phase 1b -- a revised draft is prose-length output, same truncation risk applies.

// Deliberately loaded with banned words/phrases and flat, same-length
// sentences -- guarantees a failing gate on demand with zero live typing.
const SAMPLE_BAD_TEXT =
  "In today's fast-paced digital landscape, it's important to note that Cloudflare Workers AI offers a " +
  "robust, comprehensive solution. This groundbreaking platform showcases seamless integration. It delivers " +
  "transformative results for every team. In conclusion, this cutting-edge toolkit is truly a testament to " +
  "the power of edge computing.";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("POST { text? } -- omit text to use the built-in bad-sample demo", { status: 405 });
    }

    let text = SAMPLE_BAD_TEXT;
    try {
      const body = await request.json();
      if (body && typeof body.text === "string" && body.text.trim()) text = body.text;
    } catch {
      // No body, or not JSON -- fall through to the built-in sample.
    }

    const before = analyzeAiTells(text);

    if (!needsTargetedRevision(before)) {
      return Response.json({ text, gateReport: before, fixed: false });
    }

    const fixModel = env.FIX_MODEL || FIX_MODEL_DEFAULT;
    const prompt = `${targetedRevisionPrompt(before)}\n\nDraft:\n${text}`;

    let result;
    try {
      result = await env.AI.run(fixModel, { prompt, max_tokens: MAX_TOKENS });
    } catch (err) {
      return Response.json({ text, gateReportBefore: before, fixModel, error: err.message }, { status: 502 });
    }

    const revised = result.response;
    const after = analyzeAiTells(revised);

    return Response.json({
      original: text,
      gateReportBefore: before,
      fixModel,
      revised,
      gateReportAfter: after,
      stillFlagged: needsTargetedRevision(after),
    });
  },
};
