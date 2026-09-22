import type { PipelineRun, PipelineRunStatus } from "./types";

interface RawPipelineRunRow {
  readonly id: number;
  readonly run_date: string;
  readonly source_record_id: number | null;
  readonly status: PipelineRunStatus;
  readonly model_used: string | null;
  readonly failure_reason: string | null;
  readonly created_at: string;
}

function mapRow(row: RawPipelineRunRow): PipelineRun {
  return {
    id: row.id,
    runDate: row.run_date,
    sourceRecordId: row.source_record_id,
    status: row.status,
    modelUsed: row.model_used,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  };
}

export interface PipelineRunWrite {
  readonly runDate: string;
  readonly sourceRecordId: number | null;
  readonly status: PipelineRunStatus;
  readonly modelUsed?: string | null;
  readonly failureReason?: string | null;
}

export async function writePipelineRun(db: D1Database, entry: PipelineRunWrite): Promise<PipelineRun> {
  const row = await db
    .prepare(
      `INSERT INTO pipeline_runs (run_date, source_record_id, status, model_used, failure_reason)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(
      entry.runDate,
      entry.sourceRecordId,
      entry.status,
      entry.modelUsed ?? null,
      entry.failureReason ?? null,
    )
    .first<RawPipelineRunRow>();
  if (!row) {
    throw new Error("Failed to write pipeline run.");
  }
  return mapRow(row);
}

export async function listPipelineRuns(
  db: D1Database,
  options: { readonly limit: number; readonly offset: number },
): Promise<readonly PipelineRun[]> {
  const result = await db
    .prepare(`SELECT * FROM pipeline_runs ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(options.limit, options.offset)
    .all<RawPipelineRunRow>();
  return result.results.map(mapRow);
}

export async function listRecentFailuresForRecord(
  db: D1Database,
  sourceRecordId: number,
  limit = 10,
): Promise<readonly PipelineRun[]> {
  const result = await db
    .prepare(
      `SELECT * FROM pipeline_runs WHERE source_record_id = ? AND status = 'failed'
       ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(sourceRecordId, limit)
    .all<RawPipelineRunRow>();
  return result.results.map(mapRow);
}

export async function listRecentFailures(db: D1Database, limit = 10): Promise<readonly PipelineRun[]> {
  const result = await db
    .prepare(`SELECT * FROM pipeline_runs WHERE status = 'failed' ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all<RawPipelineRunRow>();
  return result.results.map(mapRow);
}
