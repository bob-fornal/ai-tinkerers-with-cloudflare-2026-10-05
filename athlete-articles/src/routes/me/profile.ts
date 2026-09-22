import { withAuth, type AuthedRequestContext } from "../../router";
import { Errors, jsonResponse, readJsonBody } from "../../lib/response";
import { getOrProvisionUser, updateOwnRole } from "../../db/users";
import type { UserRole } from "../../db/types";

/** Auto-provisions the `users` row and assigns a thunk on first call for a new Firebase UID (§9 sign-up). */
export const getOwnProfileHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const user = await getOrProvisionUser(ctx.env.DB, ctx.user.uid);
  return jsonResponse(user);
});

interface PatchOwnProfileBody {
  readonly role?: unknown;
  readonly billingStatus?: unknown;
  readonly superuser?: unknown;
}

const VALID_ROLES: readonly UserRole[] = ["coach", "parent"];

/** billingStatus/superuser are rejected here regardless of value sent (§6) — never writable by the account owner. */
export const patchOwnProfileHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const body = await readJsonBody<PatchOwnProfileBody>(ctx.request);
  if (!body) return Errors.badRequest("Invalid JSON body.");
  if (body.billingStatus !== undefined || body.superuser !== undefined) {
    return Errors.forbidden("billingStatus and superuser are not editable through this route.");
  }
  if (body.role === undefined) {
    return Errors.badRequest("role is required.");
  }
  if (!VALID_ROLES.includes(body.role as UserRole)) {
    return Errors.badRequest("role must be 'coach' or 'parent'.");
  }

  await getOrProvisionUser(ctx.env.DB, ctx.user.uid); // ensures the row exists before updating
  const updated = await updateOwnRole(ctx.env.DB, ctx.user.uid, body.role as UserRole);
  if (!updated) return Errors.internal("Failed to update profile.");
  return jsonResponse(updated);
});
