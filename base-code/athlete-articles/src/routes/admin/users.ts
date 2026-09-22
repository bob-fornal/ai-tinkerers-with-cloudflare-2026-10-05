import { withAuth, type AuthedRequestContext } from "../../router";
import { Errors, buildPage, jsonResponse, parsePagination, readJsonBody } from "../../lib/response";
import { writeAuditLog } from "../../db/auditLog";
import {
  adminUpdateUserMetadata,
  getUserById,
  listUsers,
  setBillingStatus,
  setSuperuser,
  type UserFilter,
} from "../../db/users";
import type { BillingStatus, UserRole } from "../../db/types";

export const listUsersHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const pagination = parsePagination(ctx.url);
  const roleParam = ctx.url.searchParams.get("role");
  const billingStatusParam = ctx.url.searchParams.get("billingStatus");
  const superuserParam = ctx.url.searchParams.get("superuser");
  const filter: UserFilter = {
    ...(roleParam !== null ? { role: roleParam as UserRole } : {}),
    ...(billingStatusParam !== null ? { billingStatus: billingStatusParam as BillingStatus } : {}),
    ...(superuserParam !== null ? { superuser: superuserParam === "true" } : {}),
  };
  const sort = ctx.url.searchParams.get("sort") ?? undefined;
  const direction = ctx.url.searchParams.get("direction") === "asc" ? "asc" : "desc";

  const users = await listUsers(ctx.env.DB, {
    filter,
    sort,
    direction,
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return jsonResponse(buildPage(users, pagination));
});

export const getUserDetailHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = ctx.params.id ?? "";
  const user = await getUserById(ctx.env.DB, id);
  if (!user) return Errors.notFound("User not found.");
  return jsonResponse(user);
});

interface PatchUserBody {
  readonly role?: unknown;
  readonly thunk?: unknown;
  readonly billingStatus?: unknown;
  readonly superuser?: unknown;
}

const VALID_ROLES: readonly UserRole[] = ["coach", "parent"];

/** Never accepts billingStatus or superuser — those go through their own dedicated routes below (§6). */
export const patchUserHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = ctx.params.id ?? "";
  const body = await readJsonBody<PatchUserBody>(ctx.request);
  if (!body) return Errors.badRequest("Invalid JSON body.");
  if (body.billingStatus !== undefined || body.superuser !== undefined) {
    return Errors.badRequest("billingStatus and superuser must be set through their own dedicated routes.");
  }
  if (body.role !== undefined && !VALID_ROLES.includes(body.role as UserRole)) {
    return Errors.badRequest("role must be 'coach' or 'parent'.");
  }

  const before = await getUserById(ctx.env.DB, id);
  if (!before) return Errors.notFound("User not found.");

  const updated = await adminUpdateUserMetadata(ctx.env.DB, id, {
    role: body.role as UserRole | undefined,
    thunk: typeof body.thunk === "string" ? body.thunk : undefined,
  });
  if (!updated) return Errors.notFound("User not found.");

  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: "user.metadata.edit",
    targetType: "user",
    targetId: id,
    detail: { before: { role: before.role, thunk: before.thunk }, after: { role: updated.role, thunk: updated.thunk } },
  });

  return jsonResponse(updated);
});

interface BillingStatusBody {
  readonly billingStatus?: unknown;
}

const VALID_BILLING_STATUSES: readonly BillingStatus[] = ["unpaid", "paid"];

export const setBillingStatusHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = ctx.params.id ?? "";
  const body = await readJsonBody<BillingStatusBody>(ctx.request);
  if (!body || !VALID_BILLING_STATUSES.includes(body.billingStatus as BillingStatus)) {
    return Errors.badRequest("billingStatus must be 'unpaid' or 'paid'.");
  }

  const before = await getUserById(ctx.env.DB, id);
  if (!before) return Errors.notFound("User not found.");

  const updated = await setBillingStatus(ctx.env.DB, id, body.billingStatus as BillingStatus);
  if (!updated) return Errors.notFound("User not found.");

  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: "user.billing_status.update",
    targetType: "user",
    targetId: id,
    detail: { before: before.billingStatus, after: updated.billingStatus },
  });

  return jsonResponse(updated);
});

interface SuperuserBody {
  readonly superuser?: unknown;
}

export const setSuperuserHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const id = ctx.params.id ?? "";
  const body = await readJsonBody<SuperuserBody>(ctx.request);
  if (!body || typeof body.superuser !== "boolean") {
    return Errors.badRequest("superuser must be a boolean.");
  }

  const before = await getUserById(ctx.env.DB, id);
  if (!before) return Errors.notFound("User not found.");

  const updated = await setSuperuser(ctx.env.DB, id, body.superuser);
  if (!updated) return Errors.notFound("User not found.");

  await writeAuditLog(ctx.env.DB, {
    actorId: ctx.user.uid,
    action: body.superuser ? "user.superuser.grant" : "user.superuser.revoke",
    targetType: "user",
    targetId: id,
    detail: { before: before.superuser, after: updated.superuser },
  });

  return jsonResponse(updated);
});
