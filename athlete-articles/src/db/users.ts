import { generateThunk } from "../lib/thunk";
import type { AppUser, BillingStatus, UserRole } from "./types";

interface RawUserRow {
  readonly id: string;
  readonly role: UserRole;
  readonly thunk: string;
  readonly billing_status: BillingStatus;
  readonly superuser: number;
  readonly created_at: string;
  readonly updated_at: string;
}

function mapRow(row: RawUserRow): AppUser {
  return {
    id: row.id,
    role: row.role,
    thunk: row.thunk,
    billingStatus: row.billing_status,
    superuser: row.superuser === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserById(db: D1Database, id: string): Promise<AppUser | null> {
  const row = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<RawUserRow>();
  return row ? mapRow(row) : null;
}

export async function getUserByThunk(db: D1Database, thunk: string): Promise<AppUser | null> {
  const row = await db.prepare(`SELECT * FROM users WHERE thunk = ?`).bind(thunk).first<RawUserRow>();
  return row ? mapRow(row) : null;
}

const MAX_THUNK_COLLISION_RETRIES = 5;

/** Auto-provisions a `users` row the first time a Firebase UID calls `GET /me` (§9 sign-up). */
export async function getOrProvisionUser(db: D1Database, uid: string): Promise<AppUser> {
  const existing = await getUserById(db, uid);
  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < MAX_THUNK_COLLISION_RETRIES; attempt += 1) {
    const thunk = generateThunk();
    try {
      const row = await db
        .prepare(`INSERT INTO users (id, thunk) VALUES (?, ?) RETURNING *`)
        .bind(uid, thunk)
        .first<RawUserRow>();
      if (row) {
        return mapRow(row);
      }
    } catch (error) {
      if (!(error instanceof Error) || !/UNIQUE constraint failed/i.test(error.message)) {
        throw error;
      }
      if (error.message.includes("users.id")) {
        // A concurrent request for this same brand-new UID won the race and
        // already inserted the row — fetch and return it instead of
        // burning retries on a collision that isn't about the thunk at all.
        const winner = await getUserById(db, uid);
        if (winner) {
          return winner;
        }
      }
      // Otherwise assume a `thunk` collision — vanishingly rare given the
      // keyspace, but retry with a fresh one rather than fail the request.
      if (attempt === MAX_THUNK_COLLISION_RETRIES - 1) {
        throw error;
      }
    }
  }
  throw new Error("Failed to provision user after retrying thunk generation.");
}

export async function updateOwnRole(db: D1Database, id: string, role: UserRole): Promise<AppUser | null> {
  const row = await db
    .prepare(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`)
    .bind(role, id)
    .first<RawUserRow>();
  return row ? mapRow(row) : null;
}

export interface UserAdminEdit {
  readonly role?: UserRole;
  readonly thunk?: string;
}

export async function adminUpdateUserMetadata(
  db: D1Database,
  id: string,
  edit: UserAdminEdit,
): Promise<AppUser | null> {
  const existing = await getUserById(db, id);
  if (!existing) {
    return null;
  }
  const role = edit.role ?? existing.role;
  const thunk = edit.thunk ?? existing.thunk;
  const row = await db
    .prepare(`UPDATE users SET role = ?, thunk = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`)
    .bind(role, thunk, id)
    .first<RawUserRow>();
  return row ? mapRow(row) : null;
}

export async function setBillingStatus(
  db: D1Database,
  id: string,
  billingStatus: BillingStatus,
): Promise<AppUser | null> {
  const row = await db
    .prepare(`UPDATE users SET billing_status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`)
    .bind(billingStatus, id)
    .first<RawUserRow>();
  return row ? mapRow(row) : null;
}

export async function setSuperuser(db: D1Database, id: string, superuser: boolean): Promise<AppUser | null> {
  const row = await db
    .prepare(`UPDATE users SET superuser = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`)
    .bind(superuser ? 1 : 0, id)
    .first<RawUserRow>();
  return row ? mapRow(row) : null;
}

export interface UserFilter {
  readonly role?: UserRole;
  readonly billingStatus?: BillingStatus;
  readonly superuser?: boolean;
}

const USER_SORTABLE_COLUMNS: Readonly<Record<string, string>> = {
  role: "role",
  thunk: "thunk",
  billingStatus: "billing_status",
  superuser: "superuser",
  createdAt: "created_at",
};

export async function listUsers(
  db: D1Database,
  options: {
    readonly filter?: UserFilter;
    readonly sort?: string;
    readonly direction?: "asc" | "desc";
    readonly limit: number;
    readonly offset: number;
  },
): Promise<readonly AppUser[]> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (options.filter?.role !== undefined) {
    conditions.push("role = ?");
    bindings.push(options.filter.role);
  }
  if (options.filter?.billingStatus !== undefined) {
    conditions.push("billing_status = ?");
    bindings.push(options.filter.billingStatus);
  }
  if (options.filter?.superuser !== undefined) {
    conditions.push("superuser = ?");
    bindings.push(options.filter.superuser ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortColumn = USER_SORTABLE_COLUMNS[options.sort ?? ""] ?? "created_at";
  const direction = options.direction === "asc" ? "ASC" : "DESC";

  bindings.push(options.limit, options.offset);

  const result = await db
    .prepare(`SELECT * FROM users ${where} ORDER BY ${sortColumn} ${direction} LIMIT ? OFFSET ?`)
    .bind(...bindings)
    .all<RawUserRow>();
  return result.results.map(mapRow);
}
