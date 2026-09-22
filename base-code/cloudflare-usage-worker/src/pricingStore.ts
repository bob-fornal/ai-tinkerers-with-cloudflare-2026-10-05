import { DEFAULT_MODEL_PRICING } from "./pricing";
import type { Env, ModelPricing, PricingTable } from "./types";

const KV_KEY = "model-pricing";

export interface LoadedPricingTable {
  table: PricingTable;
  source: "kv" | "seed-fallback";
  updatedAt: string | null;
}

interface StoredPricing {
  table: PricingTable;
  updatedAt: string;
}

export async function loadPricingTable(env: Env): Promise<LoadedPricingTable> {
  const stored = await env.PRICING_KV.get<StoredPricing>(KV_KEY, "json");
  if (stored) {
    return { table: stored.table, source: "kv", updatedAt: stored.updatedAt };
  }
  return { table: DEFAULT_MODEL_PRICING, source: "seed-fallback", updatedAt: null };
}

export async function savePricingTable(env: Env, table: PricingTable, updatedAt: string): Promise<void> {
  const stored: StoredPricing = { table, updatedAt };
  await env.PRICING_KV.put(KV_KEY, JSON.stringify(stored));
}

/** Merges the given entries into whatever's currently stored (or the seed, if nothing is stored yet). */
export async function mergePricingEntries(
  env: Env,
  entries: Record<string, ModelPricing>,
  updatedAt: string
): Promise<PricingTable> {
  const current = await loadPricingTable(env);
  const merged = { ...current.table, ...entries };
  await savePricingTable(env, merged, updatedAt);
  return merged;
}

export async function resetPricingTable(env: Env, updatedAt: string): Promise<PricingTable> {
  await savePricingTable(env, DEFAULT_MODEL_PRICING, updatedAt);
  return DEFAULT_MODEL_PRICING;
}

/** Throws with a human-readable message on the first invalid entry found. */
export function validatePricingTable(value: unknown): asserts value is PricingTable {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Body must be a JSON object mapping model IDs to pricing entries.");
  }
  for (const [model, entry] of Object.entries(value as Record<string, unknown>)) {
    validatePricingEntry(model, entry);
  }
}

function validatePricingEntry(model: string, entry: unknown): asserts entry is ModelPricing {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`Entry for "${model}" must be an object.`);
  }
  const e = entry as Record<string, unknown>;

  if (e.unit === "tokens") {
    if (typeof e.neuronsPerMillionInputTokens !== "number" || typeof e.neuronsPerMillionOutputTokens !== "number") {
      throw new Error(
        `Entry for "${model}" has unit "tokens" but is missing numeric neuronsPerMillionInputTokens/neuronsPerMillionOutputTokens.`
      );
    }
    if (e.neuronsPerMillionCachedInputTokens !== undefined && typeof e.neuronsPerMillionCachedInputTokens !== "number") {
      throw new Error(`Entry for "${model}" has a non-numeric neuronsPerMillionCachedInputTokens.`);
    }
    return;
  }

  if (e.unit === "other") {
    if (typeof e.description !== "string") {
      throw new Error(`Entry for "${model}" has unit "other" but is missing a string "description".`);
    }
    if (typeof e.rates !== "object" || e.rates === null || Array.isArray(e.rates)) {
      throw new Error(`Entry for "${model}" has unit "other" but "rates" must be an object of numbers.`);
    }
    for (const [key, rate] of Object.entries(e.rates as Record<string, unknown>)) {
      if (typeof rate !== "number") {
        throw new Error(`Entry for "${model}" has non-numeric rate "${key}".`);
      }
    }
    return;
  }

  throw new Error(`Entry for "${model}" has unknown unit "${String(e.unit)}" (expected "tokens" or "other").`);
}
