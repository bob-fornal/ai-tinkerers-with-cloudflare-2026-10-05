import { withAuth, type AuthedRequestContext } from "../../router";
import { Errors, jsonResponse, readJsonBody } from "../../lib/response";
import { appendModelTestNote, listModelTestNotes } from "../../db/modelTestNotes";

export const listModelTestNotesHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const notes = await listModelTestNotes(ctx.env.DB);
  return jsonResponse({ items: notes });
});

interface AppendModelTestNoteBody {
  readonly entryMarkdown?: unknown;
}

export const appendModelTestNoteHandler = withAuth(async (ctx: AuthedRequestContext) => {
  const body = await readJsonBody<AppendModelTestNoteBody>(ctx.request);
  if (!body || typeof body.entryMarkdown !== "string" || body.entryMarkdown.trim().length === 0) {
    return Errors.badRequest("entryMarkdown is required.");
  }
  const note = await appendModelTestNote(ctx.env.DB, body.entryMarkdown);
  return jsonResponse(note, { status: 201 });
});
