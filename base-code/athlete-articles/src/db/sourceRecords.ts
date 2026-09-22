import type { ReviewStatus, SourceRecord } from "./types";

interface RawSourceRecordRow {
  readonly id: number;
  readonly rough_title: string;
  readonly suggested_by: string | null;
  readonly processed: number;
  readonly processed_date: string | null;
  readonly processed_week: number | null;
  readonly review_status: ReviewStatus;
  readonly generated_title: string | null;
  readonly kv_article_key: string | null;
  readonly model_used: string | null;
  readonly failure_count: number;
  readonly stuck: number;
  readonly created_at: string;
  readonly updated_at: string;
}

function mapRow(row: RawSourceRecordRow): SourceRecord {
  return {
    id: row.id,
    roughTitle: row.rough_title,
    suggestedBy: row.suggested_by,
    processed: row.processed === 1,
    processedDate: row.processed_date,
    processedWeek: row.processed_week,
    reviewStatus: row.review_status,
    generatedTitle: row.generated_title,
    kvArticleKey: row.kv_article_key,
    modelUsed: row.model_used,
    failureCount: row.failure_count,
    stuck: row.stuck === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createSourceRecord(
  db: D1Database,
  input: { readonly roughTitle: string; readonly links: readonly string[] },
): Promise<SourceRecord> {
  const insertRecord = db
    .prepare(`INSERT INTO source_records (rough_title) VALUES (?) RETURNING *`)
    .bind(input.roughTitle);
  const row = await insertRecord.first<RawSourceRecordRow>();
  if (!row) {
    throw new Error("Failed to insert source record.");
  }

  if (input.links.length > 0) {
    const linkStatements = input.links.map((url) =>
      db.prepare(`INSERT INTO source_links (source_record_id, url) VALUES (?, ?)`).bind(row.id, url),
    );
    await db.batch(linkStatements);
  }

  return mapRow(row);
}

export async function getSourceRecordById(db: D1Database, id: number): Promise<SourceRecord | null> {
  const row = await db
    .prepare(`SELECT * FROM source_records WHERE id = ?`)
    .bind(id)
    .first<RawSourceRecordRow>();
  return row ? mapRow(row) : null;
}

export interface SourceRecordFilter {
  readonly processed?: boolean;
  readonly reviewStatus?: ReviewStatus;
  readonly stuck?: boolean;
}

const SORTABLE_COLUMNS: Readonly<Record<string, string>> = {
  roughTitle: "rough_title",
  processed: "processed",
  reviewStatus: "review_status",
  failureCount: "failure_count",
  stuck: "stuck",
  processedDate: "processed_date",
  createdAt: "created_at",
};

export async function listSourceRecords(
  db: D1Database,
  options: {
    readonly filter?: SourceRecordFilter;
    readonly sort?: string;
    readonly direction?: "asc" | "desc";
    readonly limit: number;
    readonly offset: number;
  },
): Promise<readonly SourceRecord[]> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (options.filter?.processed !== undefined) {
    conditions.push("processed = ?");
    bindings.push(options.filter.processed ? 1 : 0);
  }
  if (options.filter?.reviewStatus !== undefined) {
    conditions.push("review_status = ?");
    bindings.push(options.filter.reviewStatus);
  }
  if (options.filter?.stuck !== undefined) {
    conditions.push("stuck = ?");
    bindings.push(options.filter.stuck ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortColumn = SORTABLE_COLUMNS[options.sort ?? ""] ?? "created_at";
  const direction = options.direction === "asc" ? "ASC" : "DESC";

  const query = `
    SELECT * FROM source_records
    ${where}
    ORDER BY ${sortColumn} ${direction}
    LIMIT ? OFFSET ?
  `;
  bindings.push(options.limit, options.offset);

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<RawSourceRecordRow>();
  return result.results.map(mapRow);
}

export async function listStuckSourceRecords(db: D1Database): Promise<readonly SourceRecord[]> {
  const result = await db
    .prepare(`SELECT * FROM source_records WHERE stuck = 1 ORDER BY updated_at DESC`)
    .all<RawSourceRecordRow>();
  return result.results.map(mapRow);
}

export async function listApprovedCatalog(
  db: D1Database,
  options: { readonly limit: number; readonly offset: number },
): Promise<readonly SourceRecord[]> {
  const result = await db
    .prepare(
      `SELECT * FROM source_records WHERE processed = 1 AND review_status = 'approved'
       ORDER BY processed_date ASC LIMIT ? OFFSET ?`,
    )
    .bind(options.limit, options.offset)
    .all<RawSourceRecordRow>();
  return result.results.map(mapRow);
}

/** The oldest-processed-first fallback article used when a thunk has no live selection. */
export async function getFallbackApprovedRecord(db: D1Database): Promise<SourceRecord | null> {
  const row = await db
    .prepare(
      `SELECT * FROM source_records WHERE processed = 1 AND review_status = 'approved'
       ORDER BY processed_date ASC LIMIT 1`,
    )
    .first<RawSourceRecordRow>();
  return row ? mapRow(row) : null;
}

export async function updateSourceRecordLinksAndTitle(
  db: D1Database,
  id: number,
  input: { readonly roughTitle?: string },
): Promise<SourceRecord | null> {
  if (input.roughTitle === undefined) {
    return getSourceRecordById(db, id);
  }
  const row = await db
    .prepare(
      `UPDATE source_records SET rough_title = ?, updated_at = datetime('now')
       WHERE id = ? AND processed = 0 RETURNING *`,
    )
    .bind(input.roughTitle, id)
    .first<RawSourceRecordRow>();
  return row ? mapRow(row) : null;
}

export async function setReviewStatus(
  db: D1Database,
  id: number,
  reviewStatus: ReviewStatus,
): Promise<SourceRecord | null> {
  const row = await db
    .prepare(`UPDATE source_records SET review_status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`)
    .bind(reviewStatus, id)
    .first<RawSourceRecordRow>();
  return row ? mapRow(row) : null;
}

export async function setReviewStatusFromApproved(
  db: D1Database,
  id: number,
  reviewStatus: ReviewStatus,
): Promise<SourceRecord | null> {
  const row = await db
    .prepare(
      `UPDATE source_records SET review_status = ?, updated_at = datetime('now')
       WHERE id = ? AND review_status = 'approved' RETURNING *`,
    )
    .bind(reviewStatus, id)
    .first<RawSourceRecordRow>();
  return row ? mapRow(row) : null;
}

export async function resetForRequeue(db: D1Database, id: number): Promise<SourceRecord | null> {
  const row = await db
    .prepare(
      `UPDATE source_records SET processed = 0, review_status = 'pending', updated_at = datetime('now')
       WHERE id = ? RETURNING *`,
    )
    .bind(id)
    .first<RawSourceRecordRow>();
  return row ? mapRow(row) : null;
}

/**
 * Atomically claims one random unprocessed, non-stuck record for the daily
 * pipeline run. A single guarded UPDATE, never a separate read-then-write,
 * so an overlapping run can't double-claim it (§10 step 1).
 */
export async function claimRandomUnprocessedRecord(db: D1Database): Promise<SourceRecord | null> {
  const candidate = await db
    .prepare(
      `SELECT id FROM source_records WHERE processed = 0 AND stuck = 0
       ORDER BY RANDOM() LIMIT 1`,
    )
    .first<{ id: number }>();
  if (!candidate) {
    return null;
  }

  const row = await db
    .prepare(
      `UPDATE source_records SET updated_at = datetime('now')
       WHERE id = ? AND processed = 0 RETURNING *`,
    )
    .bind(candidate.id)
    .first<RawSourceRecordRow>();
  return row ? mapRow(row) : null;
}

export interface PipelineSuccessUpdate {
  readonly generatedTitle: string;
  readonly kvArticleKey: string;
  readonly modelUsed: string;
  readonly processedDate: string;
  readonly processedWeek: number;
}

export async function markProcessedSuccess(
  db: D1Database,
  id: number,
  update: PipelineSuccessUpdate,
): Promise<void> {
  await db
    .prepare(
      `UPDATE source_records SET
         processed = 1,
         processed_date = ?,
         processed_week = ?,
         review_status = 'pending',
         generated_title = ?,
         kv_article_key = ?,
         model_used = ?,
         failure_count = 0,
         stuck = 0,
         updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(
      update.processedDate,
      update.processedWeek,
      update.generatedTitle,
      update.kvArticleKey,
      update.modelUsed,
      id,
    )
    .run();
}

const DEFAULT_STUCK_THRESHOLD = 3;

export async function recordPipelineFailure(
  db: D1Database,
  id: number,
  stuckThreshold: number = DEFAULT_STUCK_THRESHOLD,
): Promise<void> {
  await db
    .prepare(
      `UPDATE source_records SET
         failure_count = failure_count + 1,
         stuck = CASE WHEN failure_count + 1 >= ? THEN 1 ELSE stuck END,
         updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(stuckThreshold, id)
    .run();
}
