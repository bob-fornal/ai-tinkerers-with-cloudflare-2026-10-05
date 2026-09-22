import type { Env } from "../lib/env";
import { isoDateString, isoWeekNumber } from "../lib/weekNumber";
import {
  claimRandomUnprocessedRecord,
  getSourceRecordById,
  markProcessedSuccess,
  recordPipelineFailure,
} from "../db/sourceRecords";
import { listLinksForRecord } from "../db/sourceLinks";
import { writePipelineRun } from "../db/pipelineRuns";
import { getModelsConfig, updateLastProcessedDate } from "../kv/models";
import { articleKeyForDate, putArticleAtKey } from "../kv/articles";
import { crawlSourceLinks } from "./crawler";
import { generateArticle } from "./generate";
import { validateGeneratedArticle } from "./validate";
import { selectUsableModels } from "./modelSelection";
import type { SourceRecord } from "../db/types";

export type PipelineOutcome =
  | { readonly status: "success"; readonly record: SourceRecord; readonly modelUsed: string }
  | { readonly status: "failed"; readonly record: SourceRecord; readonly reason: string }
  | { readonly status: "skipped_empty_backlog" };

/**
 * Runs §10's numbered pipeline sequence (steps 2-14) against one already-
 * identified source record. Shared by the daily cron run (which claims a
 * random record first) and the admin manual generate/regenerate route
 * (which targets one specific record directly).
 */
export async function runPipelineForRecord(env: Env, record: SourceRecord): Promise<PipelineOutcome> {
  const now = new Date();
  const today = isoDateString(now);

  const links = await listLinksForRecord(env.DB, record.id);
  if (links.length === 0) {
    return finalizeFailure(env, record, today, "Record has no source links to crawl.");
  }

  const { pages, failures } = await crawlSourceLinks(
    links.map((link) => link.url),
    env,
  );

  if (pages.length === 0) {
    const reason = `All source links failed to fetch: ${failures.map((f) => `${f.url} (${f.reason})`).join("; ")}`;
    return finalizeFailure(env, record, today, reason);
  }

  const modelsConfig = await getModelsConfig(env.APP_KV);
  // Early check (model-validator-worker): decide whether primary is
  // actually usable before spending a full draft/checklist/title
  // generation attempt on it, falling back through secondary/backup ahead
  // of time rather than only after an expensive failure.
  const modelsToTry = await selectUsableModels(env, [modelsConfig.primary, modelsConfig.secondary, modelsConfig.backup]);

  let lastFailureReason = "Unknown generation failure.";

  for (const model of modelsToTry) {
    try {
      const generated = await generateArticle(env.AI, model, record.roughTitle, pages);
      const validation = validateGeneratedArticle({ title: generated.title, body: generated.body });

      if (!validation.valid) {
        lastFailureReason = `Validation failed for model ${model}: ${validation.reasons.join("; ")}`;
        continue;
      }

      // Regeneration reuses the record's existing key in place, overwriting
      // the prior title/body under it (§8 manual generate/regenerate); a
      // brand-new record gets today's date-based key.
      const kvArticleKey = record.kvArticleKey ?? articleKeyForDate(today);
      await putArticleAtKey(env.APP_KV, kvArticleKey, {
        title: generated.title,
        body: generated.body,
        sourceRecordId: record.id,
        aiTellReport: generated.aiTellReport,
      });

      await markProcessedSuccess(env.DB, record.id, {
        generatedTitle: generated.title,
        kvArticleKey,
        modelUsed: model,
        processedDate: today,
        processedWeek: isoWeekNumber(now),
      });
      await updateLastProcessedDate(env.APP_KV, today);

      const updated = await getSourceRecordById(env.DB, record.id);
      await writePipelineRun(env.DB, {
        runDate: today,
        sourceRecordId: record.id,
        status: "success",
        modelUsed: model,
      });

      return { status: "success", record: updated ?? record, modelUsed: model };
    } catch (error) {
      lastFailureReason = `Model ${model} errored: ${String(error)}`;
    }
  }

  return finalizeFailure(env, record, today, lastFailureReason);
}

async function finalizeFailure(
  env: Env,
  record: SourceRecord,
  today: string,
  reason: string,
): Promise<PipelineOutcome> {
  await recordPipelineFailure(env.DB, record.id);
  await writePipelineRun(env.DB, {
    runDate: today,
    sourceRecordId: record.id,
    status: "failed",
    failureReason: reason,
  });
  const updated = await getSourceRecordById(env.DB, record.id);
  return { status: "failed", record: updated ?? record, reason };
}

/** The daily cron entrypoint (§10 step 1): claims a random record, or no-ops on an empty backlog. */
export async function runDailyPipeline(env: Env): Promise<PipelineOutcome> {
  const claimed = await claimRandomUnprocessedRecord(env.DB);
  if (!claimed) {
    await writePipelineRun(env.DB, {
      runDate: isoDateString(new Date()),
      sourceRecordId: null,
      status: "skipped_empty_backlog",
    });
    return { status: "skipped_empty_backlog" };
  }
  return runPipelineForRecord(env, claimed);
}
