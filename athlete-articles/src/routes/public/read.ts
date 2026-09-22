import type { Handler } from "../../router";
import { Errors, jsonResponse } from "../../lib/response";
import { checkRateLimit, clientIp, RateLimitRules } from "../../middleware/rateLimit";
import { getUserByThunk } from "../../db/users";
import { getFallbackApprovedRecord, getSourceRecordById } from "../../db/sourceRecords";
import { getSelection } from "../../db/weeklySelections";
import { getArticle } from "../../kv/articles";
import { incrementViewCounter } from "../../kv/views";
import { isoWeekNumber, isoWeekYear } from "../../lib/weekNumber";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyTurnstile(token: string | null, secretKey: string, remoteIp: string): Promise<boolean> {
  if (!token) return false;
  const form = new URLSearchParams({ secret: secretKey, response: token, remoteip: remoteIp });
  const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return false;
  }
  const body = (await res.json()) as { success: boolean };
  return body.success === true;
}

/**
 * The athlete-facing thunk read (§9, §13 `GET /read/:thunk`). Public by
 * design — no Firebase token — gated instead by a Turnstile bot check and
 * per-IP/per-thunk rate limiting.
 */
export const readThunkHandler: Handler = async (ctx) => {
  const thunk = ctx.params.thunk ?? "";
  const ip = clientIp(ctx.request);

  const ipLimit = await checkRateLimit(ctx.env, RateLimitRules.thunkReadByIp(ip));
  if (!ipLimit.allowed) {
    return Errors.rateLimited();
  }

  const turnstileToken = ctx.request.headers.get("X-Turnstile-Token") ?? ctx.url.searchParams.get("turnstileToken");
  const humanVerified = await verifyTurnstile(turnstileToken, ctx.env.TURNSTILE_SECRET_KEY, ip);
  if (!humanVerified) {
    return Errors.forbidden("Bot verification failed.");
  }

  const user = await getUserByThunk(ctx.env.DB, thunk);
  if (!user) {
    return jsonResponse({ status: "invalid_thunk" });
  }

  const thunkLimit = await checkRateLimit(ctx.env, RateLimitRules.thunkReadByThunk(thunk));
  if (!thunkLimit.allowed) {
    return Errors.rateLimited();
  }

  const now = new Date();
  const year = isoWeekYear(now);
  const weekNumber = isoWeekNumber(now);

  // Re-checks the selected article's review_status at serve time — if it's
  // no longer approved, falls back exactly as if nothing had been selected.
  let record = null;
  const selection = await getSelection(ctx.env.DB, user.id, year, weekNumber);
  if (selection) {
    const selected = await getSourceRecordById(ctx.env.DB, selection.articleId);
    if (selected && selected.reviewStatus === "approved" && selected.processed) {
      record = selected;
    }
  }
  if (!record) {
    record = await getFallbackApprovedRecord(ctx.env.DB);
  }

  if (!record || !record.kvArticleKey) {
    return jsonResponse({ status: "no_content" });
  }

  const isPaidTier = user.billingStatus === "paid" || user.superuser;
  const counter = await incrementViewCounter(ctx.env.APP_KV, thunk, year, weekNumber, isPaidTier);
  if (!counter) {
    return jsonResponse({ status: "cap_reached" });
  }

  const article = await getArticle(ctx.env.APP_KV, record.kvArticleKey);
  if (!article) {
    return jsonResponse({ status: "no_content" });
  }

  return jsonResponse({
    status: "ok",
    article: { title: article.title, body: article.body },
    viewsRemaining: counter.max - counter.count,
  });
};
