import type { AuditLogEntry } from "./types";

interface RawAuditLogRow {
  readonly id: number;
  readonly actor_id: string;
  readonly action: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly detail: string | null;
  readonly created_at: string;
}

function parseDetail(detail: string | null): unknown {
  if (detail === null) return null;
  try {
    return JSON.parse(detail);
  } catch {
    return detail; // stored value wasn't valid JSON — surface it as-is rather than dropping it
  }
}

function mapRow(row: RawAuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    detail: parseDetail(row.detail),
    createdAt: row.created_at,
  };
}

export interface AuditLogWrite {
  readonly actorId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly detail?: unknown;
}

export async function writeAuditLog(db: D1Database, entry: AuditLogWrite): Promise<void> {
  await db
    .prepare(`INSERT INTO audit_log (actor_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)`)
    .bind(entry.actorId, entry.action, entry.targetType, entry.targetId, entry.detail !== undefined ? JSON.stringify(entry.detail) : null)
    .run();
}

export interface AuditLogFilter {
  readonly actorId?: string;
  readonly action?: string;
  readonly targetType?: string;
}

export async function listAuditLog(
  db: D1Database,
  options: { readonly filter?: AuditLogFilter; readonly limit: number; readonly offset: number },
): Promise<readonly AuditLogEntry[]> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (options.filter?.actorId) {
    conditions.push("actor_id = ?");
    bindings.push(options.filter.actorId);
  }
  if (options.filter?.action) {
    conditions.push("action = ?");
    bindings.push(options.filter.action);
  }
  if (options.filter?.targetType) {
    conditions.push("target_type = ?");
    bindings.push(options.filter.targetType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  bindings.push(options.limit, options.offset);

  const result = await db
    .prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...bindings)
    .all<RawAuditLogRow>();
  return result.results.map(mapRow);
}
