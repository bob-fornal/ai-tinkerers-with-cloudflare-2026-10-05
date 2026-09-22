/**
 * `env.AI.run()`'s `response.response` is not guaranteed to be a string
 * across models/runtime versions — extract it defensively rather than
 * assuming a plain string (docs/skills/cloudflare/SKILL.md).
 */
export function aiResponseToText(response: unknown): string {
  if (response && typeof response === "object" && "response" in response) {
    const value = (response as { response: unknown }).response;
    if (typeof value === "string") return value;
    if (value == null) return "";
    return JSON.stringify(value);
  }
  if (typeof response === "string") return response;
  return "";
}
