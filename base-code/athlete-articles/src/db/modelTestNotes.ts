import type { ModelTestNote } from "./types";

interface RawModelTestNoteRow {
  readonly id: number;
  readonly entry_markdown: string;
  readonly created_at: string;
}

function mapRow(row: RawModelTestNoteRow): ModelTestNote {
  return { id: row.id, entryMarkdown: row.entry_markdown, createdAt: row.created_at };
}

export async function listModelTestNotes(db: D1Database): Promise<readonly ModelTestNote[]> {
  const result = await db
    .prepare(`SELECT * FROM model_test_notes ORDER BY created_at ASC`)
    .all<RawModelTestNoteRow>();
  return result.results.map(mapRow);
}

export async function appendModelTestNote(db: D1Database, entryMarkdown: string): Promise<ModelTestNote> {
  const row = await db
    .prepare(`INSERT INTO model_test_notes (entry_markdown) VALUES (?) RETURNING *`)
    .bind(entryMarkdown)
    .first<RawModelTestNoteRow>();
  if (!row) {
    throw new Error("Failed to append model test note.");
  }
  return mapRow(row);
}
