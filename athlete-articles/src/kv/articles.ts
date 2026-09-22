import type { AiTellReport } from "../pipeline/aiTellCheck";

export interface StoredArticle {
  readonly title: string;
  readonly body: string; // raw Markdown — both apps render through a sanitizing pipeline, never as raw HTML
  readonly sourceRecordId: number;
  readonly aiTellReport: AiTellReport;
}

export function articleKeyForDate(date: string): string {
  return `article:${date}`;
}

/** Writes an article under its exact KV key — used for both a fresh `article:{date}` key and a reused regenerate key. */
export async function putArticleAtKey(kv: KVNamespace, key: string, article: StoredArticle): Promise<void> {
  await kv.put(key, JSON.stringify(article));
}

export async function putArticle(kv: KVNamespace, date: string, article: StoredArticle): Promise<string> {
  const key = articleKeyForDate(date);
  await putArticleAtKey(kv, key, article);
  return key;
}

export async function getArticle(kv: KVNamespace, key: string): Promise<StoredArticle | null> {
  return kv.get<StoredArticle>(key, "json");
}

export interface EvalResult {
  readonly roughTitle: string;
  readonly links: readonly string[];
  readonly generatedTitle: string;
  readonly body: string;
  readonly modelUsed: string;
  readonly aiTellReport: AiTellReport;
  readonly createdAt: string;
}

export function evalKey(id: string): string {
  return `eval:${id}`;
}

export async function putEvalResult(kv: KVNamespace, id: string, result: EvalResult): Promise<void> {
  await kv.put(evalKey(id), JSON.stringify(result), { expirationTtl: 60 * 60 * 24 * 30 });
}

export async function getEvalResult(kv: KVNamespace, id: string): Promise<EvalResult | null> {
  return kv.get<EvalResult>(evalKey(id), "json");
}
