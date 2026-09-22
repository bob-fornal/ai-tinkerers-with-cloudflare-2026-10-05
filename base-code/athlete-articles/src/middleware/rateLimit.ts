import type { Env } from "../lib/env";

/**
 * Fixed-window rate limiting backed by KV counters. Not exact (a request at
 * the edge of a window boundary can slip through twice as fast as the
 * nominal rate) but cheap, dependency-free, and enough to blunt scripted
 * abuse — see docs/deployment/10-bot-check-and-rate-limiting.md for how this
 * complements Cloudflare's own dashboard-level Rate Limiting Rules.
 */
export interface RateLimitRule {
  readonly surface: string;
  readonly key: string;
  readonly windowSeconds: number;
  readonly max: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
}

export async function checkRateLimit(env: Env, rule: RateLimitRule): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / 1000 / rule.windowSeconds) * rule.windowSeconds;
  const kvKey = `ratelimit:${rule.surface}:${rule.key}:${windowStart}`;

  const current = Number((await env.APP_KV.get(kvKey)) ?? "0");
  if (current >= rule.max) {
    return { allowed: false, remaining: 0 };
  }

  const next = current + 1;
  await env.APP_KV.put(kvKey, String(next), { expirationTtl: rule.windowSeconds + 5 });
  return { allowed: true, remaining: rule.max - next };
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

export const RateLimitRules = {
  thunkReadByIp: (ip: string): RateLimitRule => ({
    surface: "thunk-read-ip",
    key: ip,
    windowSeconds: 60,
    max: 30,
  }),
  thunkReadByThunk: (thunk: string): RateLimitRule => ({
    surface: "thunk-read-thunk",
    key: thunk,
    windowSeconds: 60,
    max: 60,
  }),
  authenticatedUser: (uid: string): RateLimitRule => ({
    surface: "authenticated-user",
    key: uid,
    windowSeconds: 60,
    max: 120,
  }),
};
