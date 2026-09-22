import { withAuth, type AuthedRequestContext } from "../../router";
import { Errors, jsonResponse } from "../../lib/response";
import { getOrProvisionUser } from "../../db/users";

/**
 * The coach/parent app builds the shareable link and client-side QR code
 * from this thunk value — no server-side QR generation needed (§9 Share
 * tools, §11 client-side QR generation).
 */
export const getThunkHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const user = await getOrProvisionUser(ctx.env.DB, ctx.user.uid);
  const origin = ctx.env.COACH_APP_ORIGIN;
  if (!origin) return Errors.internal("Coach app origin is not configured.");
  return jsonResponse({ thunk: user.thunk, url: `${origin}/#/${user.thunk}` });
});
