/**
 * TypeScript port of docs/skills/humanize-writing/scripts/check_ai_tells.py.
 * Keep the word/phrase lists and formulas in lockstep with that file — this
 * is a deterministic, no-model-call analysis pass (§10 step 7), not a
 * judgment call, so any drift between the two just makes the admin's report
 * inconsistent with the skill it's supposed to mirror.
 */

export const BANNED_WORDS: readonly string[] = [
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

export const BANNED_PHRASES: readonly string[] = [
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHits(textLower: string, terms: readonly string[]): Record<string, number> {
  const hits: Record<string, number> = {};
  for (const term of terms) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "g");
    const matches = textLower.match(pattern);
    if (matches && matches.length > 0) {
      hits[term] = matches.length;
    }
  }
  return hits;
}

function sentenceLengths(text: string): readonly number[] {
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  return sentences.filter((sentence) => sentence.trim().length > 0).map((sentence) => sentence.split(/\s+/).length);
}

function paragraphLengths(text: string): readonly number[] {
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim().length > 0);
  return paragraphs.map((paragraph) => paragraph.split(/\s+/).length);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Population standard deviation, matching Python's `statistics.pstdev`. */
function pstdev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export interface AiTellReport {
  readonly wordCount: number;
  readonly bannedWordHits: Readonly<Record<string, number>>;
  readonly bannedPhraseHits: Readonly<Record<string, number>>;
  readonly emDashCount: number;
  readonly emDashPer100Words: number;
  readonly sentenceCount: number;
  readonly avgSentenceLengthWords: number;
  readonly sentenceLengthStdev: number;
  readonly burstinessRatio: number;
  readonly paragraphCount: number;
  readonly paragraphLengthsWords: readonly number[];
}

export function analyzeAiTells(text: string): AiTellReport {
  const textLower = text.toLowerCase();
  const wordCount = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  const emDashCount = (text.match(/—/g)?.length ?? 0) + (text.match(/--/g)?.length ?? 0);
  const lengths = sentenceLengths(text);
  const paragraphs = paragraphLengths(text);

  const avgSentenceLen = lengths.length > 0 ? round(mean(lengths), 1) : 0;
  const stdevSentenceLen = lengths.length > 1 ? round(pstdev(lengths), 1) : 0;

  return {
    wordCount,
    bannedWordHits: findHits(textLower, BANNED_WORDS),
    bannedPhraseHits: findHits(textLower, BANNED_PHRASES),
    emDashCount,
    emDashPer100Words: wordCount > 0 ? round((emDashCount / wordCount) * 100, 2) : 0,
    sentenceCount: lengths.length,
    avgSentenceLengthWords: avgSentenceLen,
    sentenceLengthStdev: stdevSentenceLen,
    burstinessRatio: avgSentenceLen > 0 ? round(stdevSentenceLen / avgSentenceLen, 2) : 0,
    paragraphCount: paragraphs.length,
    paragraphLengthsWords: paragraphs,
  };
}

const BANNED_WORD_HIT_THRESHOLD = 3;
const BURSTINESS_THRESHOLD = 0.3;

/**
 * Whether the report crosses §10 step 8's threshold for one bounded targeted
 * revision pass: 3+ banned-word hits, any boilerplate-phrase hit, or
 * burstiness under ~0.3.
 */
export function needsTargetedRevision(report: AiTellReport): boolean {
  const totalBannedWordHits = Object.values(report.bannedWordHits).reduce((sum, count) => sum + count, 0);
  const hasPhraseHits = Object.keys(report.bannedPhraseHits).length > 0;
  return totalBannedWordHits >= BANNED_WORD_HIT_THRESHOLD || hasPhraseHits || report.burstinessRatio < BURSTINESS_THRESHOLD;
}
