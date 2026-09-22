export interface Env {
  /** Cloudflare API token with "Account Analytics: Read" permission. Set via `wrangler secret put CF_API_TOKEN`. */
  CF_API_TOKEN: string;
  /** Cloudflare account ID that owns the Workers AI usage. */
  CF_ACCOUNT_ID: string;
  /** KV namespace holding the live model pricing table (falls back to the built-in seed if empty). */
  PRICING_KV: KVNamespace;
  /** Bearer token required to write to /api/pricing. Set via `wrangler secret put PRICING_ADMIN_TOKEN`. */
  PRICING_ADMIN_TOKEN: string;
  /** Static API key required (via the 'x-api-key' header) on every request. Set via `wrangler secret put API_KEY`. */
  API_KEY: string;
}

/** Token-metered models (all LLMs and text embedding models) — the only unit the GraphQL usage dataset can measure. */
export interface TokenPricing {
  unit: "tokens";
  neuronsPerMillionInputTokens: number;
  neuronsPerMillionOutputTokens: number;
  /**
   * Rate for cache-hit input tokens, where the model supports prompt caching.
   * Reference only — the GraphQL usage dataset doesn't break out cached vs.
   * uncached tokens, so calculateUsage() can't apply this.
   */
  neuronsPerMillionCachedInputTokens?: number;
}

/**
 * Everything metered some other way (per image tile/step, per audio minute, per 1k
 * characters, per M images, …). `rates` keys are descriptive labels straight off the
 * pricing page (e.g. "perStep", "perAudioMinute") — kept loose because the shapes vary
 * a lot across model families and aren't computable from the token-only usage dataset anyway.
 */
export interface OtherPricing {
  unit: "other";
  description: string;
  /** Neuron cost per the unit named in each key. */
  rates: Record<string, number>;
}

export type ModelPricing = TokenPricing | OtherPricing;

export type PricingTable = Record<string, ModelPricing>;

export interface AiInferenceGroup {
  count: number;
  sum: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalRequestBytesIn: number;
  };
  dimensions: {
    modelId: string;
    datetimeHour: string;
  };
}

export interface GraphQlResponse<T> {
  data: T | null;
  errors?: { message: string }[];
}

export interface AiUsageQueryResult {
  viewer: {
    accounts: {
      aiInferenceAdaptiveGroups: AiInferenceGroup[];
    }[];
  };
}
