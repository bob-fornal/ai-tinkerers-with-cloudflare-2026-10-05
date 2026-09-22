/**
 * §10 step 10 — validates the model's output before it is ever stored or
 * published. A failure here is treated as a generation failure (retry once
 * against the secondary/backup model, per the pipeline orchestrator).
 */

const MIN_WORD_COUNT = 450; // tolerance below the 500-600 target range
const MAX_WORD_COUNT = 650; // tolerance above

const META_COMMENTARY_PATTERNS: readonly RegExp[] = [
  /\bas an ai\b/i,
  /\bas a language model\b/i,
  /\bi cannot\b.{0,40}\brequest\b/i,
  /\bi'm sorry, but\b/i,
  /\[?system prompt\]?/i,
  /\bignore (all|any|the) (previous|prior|above) instructions\b/i,
  /\byou are (now |)an? (ai|assistant|chatbot)\b/i,
  /<\|.*?\|>/,
];

const MARKUP_PATTERNS: readonly RegExp[] = [/<script\b/i, /<iframe\b/i, /<style\b/i, /javascript:/i, /on\w+\s*=\s*"/i];

export interface ValidationResult {
  readonly valid: boolean;
  readonly reasons: readonly string[];
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function titleWords(title: string): readonly string[] {
  return title
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);
}

/**
 * Coarse on-topic heuristic: at least one substantive word from the
 * generated title should actually appear in the body. Not a substitute for
 * human review — the review queue is where real judgment happens — just a
 * cheap guard against a wildly off-topic generation slipping through.
 */
function isOnTopic(title: string, body: string): boolean {
  const words = titleWords(title);
  if (words.length === 0) {
    return true;
  }
  const bodyLower = body.toLowerCase();
  return words.some((word) => bodyLower.includes(word));
}

export function validateGeneratedArticle(input: { readonly title: string; readonly body: string }): ValidationResult {
  const reasons: string[] = [];
  const count = wordCount(input.body);

  if (count < MIN_WORD_COUNT || count > MAX_WORD_COUNT) {
    reasons.push(`Word count ${count} outside the acceptable ${MIN_WORD_COUNT}-${MAX_WORD_COUNT} range.`);
  }

  for (const pattern of META_COMMENTARY_PATTERNS) {
    if (pattern.test(input.body) || pattern.test(input.title)) {
      reasons.push(`Body or title matched a meta-commentary/injection pattern: ${pattern.source}`);
    }
  }

  for (const pattern of MARKUP_PATTERNS) {
    if (pattern.test(input.body) || pattern.test(input.title)) {
      reasons.push(`Body or title contained disallowed markup/script content: ${pattern.source}`);
    }
  }

  if (input.title.trim().length === 0) {
    reasons.push("Title is empty.");
  }

  if (!isOnTopic(input.title, input.body)) {
    reasons.push("Body does not appear related to the generated title.");
  }

  return { valid: reasons.length === 0, reasons };
}
