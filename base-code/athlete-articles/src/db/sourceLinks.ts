import type { SourceLink } from "./types";

interface RawSourceLinkRow {
  readonly id: number;
  readonly source_record_id: number;
  readonly url: string;
  readonly added_at: string;
}

function mapRow(row: RawSourceLinkRow): SourceLink {
  return { id: row.id, sourceRecordId: row.source_record_id, url: row.url, addedAt: row.added_at };
}

export async function listLinksForRecord(db: D1Database, sourceRecordId: number): Promise<readonly SourceLink[]> {
  const result = await db
    .prepare(`SELECT * FROM source_links WHERE source_record_id = ? ORDER BY added_at ASC`)
    .bind(sourceRecordId)
    .all<RawSourceLinkRow>();
  return result.results.map(mapRow);
}

/** Replaces all links on an unprocessed record — used by PATCH /admin/source-records/:id. */
export async function replaceLinksForRecord(
  db: D1Database,
  sourceRecordId: number,
  urls: readonly string[],
): Promise<void> {
  const statements = [
    db.prepare(`DELETE FROM source_links WHERE source_record_id = ?`).bind(sourceRecordId),
    ...urls.map((url) =>
      db.prepare(`INSERT INTO source_links (source_record_id, url) VALUES (?, ?)`).bind(sourceRecordId, url),
    ),
  ];
  await db.batch(statements);
}
