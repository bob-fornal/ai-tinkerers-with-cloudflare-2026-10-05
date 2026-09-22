import { calculateUsage } from "./pricing";
import type { AiInferenceGroup, PricingTable } from "./types";

export interface ModelUsageEntry {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  neurons: number | null;
  costUsd: number | null;
  note?: string;
}

export interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  neurons: number;
  costUsd: number;
}

export interface DayUsage {
  date: string;
  models: ModelUsageEntry[];
  subtotal: UsageTotals;
}

function buildModelEntry(
  model: string,
  requests: number,
  inputTokens: number,
  outputTokens: number,
  pricingTable: PricingTable
): ModelUsageEntry {
  const calc = calculateUsage(model, inputTokens, outputTokens, pricingTable);
  return {
    model,
    requests,
    inputTokens,
    outputTokens,
    neurons: calc?.neurons ?? null,
    costUsd: calc?.costUsd ?? null,
    note: calc?.note ?? (calc === null ? "Model not in pricing table — add it via PUT/PATCH /api/pricing to estimate cost." : undefined),
  };
}

export function sumTotals(entries: { requests: number; inputTokens: number; outputTokens: number; neurons: number | null; costUsd: number | null }[]): UsageTotals {
  const raw = entries.reduce<UsageTotals>(
    (acc, e) => ({
      requests: acc.requests + e.requests,
      inputTokens: acc.inputTokens + e.inputTokens,
      outputTokens: acc.outputTokens + e.outputTokens,
      neurons: acc.neurons + (e.neurons ?? 0),
      costUsd: acc.costUsd + (e.costUsd ?? 0),
    }),
    { requests: 0, inputTokens: 0, outputTokens: 0, neurons: 0, costUsd: 0 }
  );
  return {
    ...raw,
    neurons: Math.round(raw.neurons * 10_000) / 10_000,
    costUsd: Math.round(raw.costUsd * 1_000_000) / 1_000_000,
  };
}

/** Buckets (modelId, datetimeHour) rows into per-day, per-model totals. */
export function groupUsageByDay(groups: AiInferenceGroup[], pricingTable: PricingTable): DayUsage[] {
  const byDay = new Map<string, Map<string, { requests: number; inputTokens: number; outputTokens: number }>>();

  for (const group of groups) {
    const date = group.dimensions.datetimeHour.slice(0, 10); // "2026-08-28T14:00:00Z" -> "2026-08-28"
    const model = group.dimensions.modelId;

    if (!byDay.has(date)) byDay.set(date, new Map());
    const models = byDay.get(date)!;

    const existing = models.get(model) ?? { requests: 0, inputTokens: 0, outputTokens: 0 };
    existing.requests += group.count;
    existing.inputTokens += group.sum.totalInputTokens;
    existing.outputTokens += group.sum.totalOutputTokens;
    models.set(model, existing);
  }

  const days: DayUsage[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, models]) => {
      const modelEntries = [...models.entries()]
        .map(([model, m]) => buildModelEntry(model, m.requests, m.inputTokens, m.outputTokens, pricingTable))
        .sort((a, b) => b.requests - a.requests);
      return { date, models: modelEntries, subtotal: sumTotals(modelEntries) };
    });

  return days;
}

/** Aggregates per-day model breakdowns back into one row per model across the whole range. */
export function summarizeModelsAcrossDays(days: DayUsage[], pricingTable: PricingTable): ModelUsageEntry[] {
  const byModel = new Map<string, { requests: number; inputTokens: number; outputTokens: number }>();

  for (const day of days) {
    for (const m of day.models) {
      const existing = byModel.get(m.model) ?? { requests: 0, inputTokens: 0, outputTokens: 0 };
      existing.requests += m.requests;
      existing.inputTokens += m.inputTokens;
      existing.outputTokens += m.outputTokens;
      byModel.set(m.model, existing);
    }
  }

  return [...byModel.entries()]
    .map(([model, t]) => buildModelEntry(model, t.requests, t.inputTokens, t.outputTokens, pricingTable))
    .sort((a, b) => b.requests - a.requests);
}
