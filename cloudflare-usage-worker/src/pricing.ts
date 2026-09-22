import type { ModelPricing, PricingTable } from "./types";

/**
 * USD price per 1,000 Neurons, billed beyond the free daily allocation.
 * Source: https://developers.cloudflare.com/workers-ai/platform/pricing/
 */
export const USD_PER_1000_NEURONS = 0.011;

export const FREE_NEURONS_PER_DAY = 10_000;

/**
 * Built-in seed for the pricing table, transcribed from Cloudflare's Workers AI
 * pricing page (fetched 2026-08-28, corrected 2026-08-31, updated 2026-08-31 with
 * scripts/fetch-pricing.mjs against the real page markup — see docs/CHANGELOG.md).
 * This is what /api/pricing falls back to when PRICING_KV has no stored table yet,
 * and what POST /api/pricing/reset restores. The live copy in KV is the source of
 * truth once seeded — update via the /api/pricing endpoints (or
 * scripts/fetch-pricing.mjs) rather than editing this table in place.
 */
export const DEFAULT_MODEL_PRICING: PricingTable = {
  // ---- LLMs (unit: tokens) ----
  "@cf/meta/llama-3.2-1b-instruct": tokens(2_457, 18_252),
  "@cf/meta/llama-3.2-3b-instruct": tokens(4_625, 30_475),
  "@cf/meta/llama-3.1-8b-instruct-fp8-fast": tokens(4_119, 34_868),
  "@cf/meta/llama-3.2-11b-vision-instruct": tokens(4_410, 61_493),
  "@cf/meta/llama-3.1-70b-instruct-fp8-fast": tokens(26_668, 204_805),
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": tokens(26_668, 204_805),
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": tokens(45_170, 443_756),
  "@cf/deepseek-ai/deepseek-v4-flash-0731": tokens(40_000, 120_000, 1_273),
  "@cf/deepseek-ai/deepseek-v4-pro-0813": tokens(120_000, 360_000, 4_000),
  "@cf/mistral/mistral-7b-instruct-v0.1": tokens(10_000, 17_300),
  "@cf/mistralai/mistral-small-3.1-24b-instruct": tokens(31_876, 50_488),
  "@cf/meta/llama-3.1-8b-instruct": tokens(25_608, 75_147),
  "@cf/meta/llama-3.1-8b-instruct-fp8": tokens(13_778, 26_128),
  "@cf/meta/llama-3.1-8b-instruct-awq": tokens(11_161, 24_215),
  "@cf/meta/llama-3-8b-instruct": tokens(25_608, 75_147),
  "@cf/meta/llama-3-8b-instruct-awq": tokens(11_161, 24_215),
  "@cf/meta/llama-2-7b-chat-fp16": tokens(50_505, 606_061),
  "@cf/meta/llama-guard-3-8b": tokens(44_003, 2_730),
  "@cf/meta/llama-4-scout-17b-16e-instruct": tokens(24_545, 77_273),
  "@cf/google/gemma-3-12b-it": tokens(31_371, 50_560),
  "@cf/qwen/qwq-32b": tokens(60_000, 90_909),
  "@cf/qwen/qwen2.5-coder-32b-instruct": tokens(60_000, 90_909),
  "@cf/qwen/qwen3-30b-a3b-fp8": tokens(4_625, 30_475),
  "@cf/qwen/qwen3.8-27b": tokens(40_909, 290_909),
  "@cf/openai/gpt-oss-120b": tokens(31_818, 68_182),
  "@cf/openai/gpt-oss-20b": tokens(18_182, 27_273),
  "@cf/aisingapore/gemma-sea-lion-v4-27b-it": tokens(31_876, 50_488),
  "@cf/ibm-granite/granite-4.0-h-micro": tokens(1_542, 10_158),
  "@cf/zai-org/glm-4.7-flash": tokens(5_500, 36_400),
  "@cf/zai-org/glm-5.2": tokens(127_273, 400_000, 23_636),
  "@cf/zai-org/glm-5.3": tokens(127_273, 400_000, 23_636),
  "@cf/zai-org/glm-5.3-flash": tokens(13_636, 45_455, 2_727),
  "@cf/nvidia/nemotron-3-120b-a12b": tokens(45_455, 136_364),
  "@cf/moonshotai/kimi-k2.5": tokens(54_545, 272_727, 9_091),
  "@cf/moonshotai/kimi-k2.6": tokens(86_364, 363_636, 14_545),
  "@cf/moonshotai/kimi-k2.7-code": tokens(86_364, 363_636, 17_273),
  "@cf/google/gemma-4-26b-a4b-it": tokens(9_091, 27_273),
  "@cf/moondream/moondream3.1-9B-A2B": tokens(27_273, 90_909),

  // ---- Embeddings (unit: tokens, input-only) ----
  "@cf/baai/bge-small-en-v1.5": tokens(1_841, 0),
  "@cf/baai/bge-base-en-v1.5": tokens(6_058, 0),
  "@cf/baai/bge-large-en-v1.5": tokens(18_582, 0),
  "@cf/baai/bge-m3": tokens(1_075, 0),
  "@cf/pfnet/plamo-embedding-1b": tokens(1_689, 0),
  "@cf/qwen/qwen3-embedding-0.6b": tokens(1_075, 0),

  // ---- Image models (unit: other — not measurable via token analytics) ----
  "@cf/black-forest-labs/flux-1-schnell": other("Per 512x512 tile or per step", {
    perTile512: 4.80,
    perStep: 9.60,
  }),
  "@cf/leonardo/lucid-origin": other("Per 512x512 tile or per step", {
    perTile512: 636,
    perStep: 12,
  }),
  "@cf/leonardo/phoenix-1.0": other("Per 512x512 tile or per step", {
    perTile512: 530,
    perStep: 10,
  }),
  "@cf/black-forest-labs/flux-2-dev": other("Per input/output tile or step", {
    perInputTileOrStep: 18.75,
    perOutputTileOrStep: 37.50,
  }),
  "@cf/black-forest-labs/flux-2-klein-4b": other("Per input/output tile", {
    perInputTile: 5.37,
    perOutputTile: 26.05,
  }),
  "@cf/black-forest-labs/flux-2-klein-9b": other("Per megapixel, tiered", {
    perFirstMegapixel: 1_363.64,
    perSubsequentMegapixel: 181.82,
    perInputImageMegapixel: 181.82,
  }),

  // ---- Audio models (unit: other) ----
  "@cf/openai/whisper": other("Per audio minute", { perAudioMinute: 41.14 }),
  "@cf/openai/whisper-large-v3-turbo": other("Per audio minute", { perAudioMinute: 46.63 }),
  "@cf/myshell-ai/melotts": other("Per audio minute", { perAudioMinute: 18.63 }),
  "@cf/deepgram/aura-1": other("Per 1k characters", { per1kCharacters: 1_363.64 }),
  "@cf/deepgram/nova-3": other("Per audio minute (HTTP or WebSocket)", {
    perAudioMinute: 472.73,
    perAudioMinuteWebsocket: 836.36,
  }),
  "@cf/pipecat-ai/smart-turn-v2": other("Per audio minute", { perAudioMinute: 0.51 }),
  "@cf/deepgram/aura-2-en": other("Per 1k characters", { per1kCharacters: 2_727.27 }),
  "@cf/deepgram/aura-2-es": other("Per 1k characters", { per1kCharacters: 2_727.27 }),
  "@cf/deepgram/flux": other("Per audio minute (WebSocket)", { perAudioMinuteWebsocket: 700 }),

  // ---- Other (unit: tokens — the page lists plain per-M-input/output-token rates for these) ----
  "@cf/huggingface/distilbert-sst-2-int8": tokens(2_394, 0),
  "@cf/baai/bge-reranker-base": tokens(283, 0),
  "@cf/meta/m2m100-1.2b": tokens(31_050, 31_050),
  "@cf/ai4bharat/indictrans2-en-indic-1B": tokens(31_050, 31_050),

  // ---- Other (unit: other — genuinely not token-metered) ----
  "@cf/microsoft/resnet-50": other("Per M images", { perMillionImages: 228_055 }),
};

function tokens(input: number, output: number, cachedInput?: number): ModelPricing {
  return {
    unit: "tokens",
    neuronsPerMillionInputTokens: input,
    neuronsPerMillionOutputTokens: output,
    ...(cachedInput !== undefined ? { neuronsPerMillionCachedInputTokens: cachedInput } : {}),
  };
}

function other(description: string, rates: Record<string, number>): ModelPricing {
  return { unit: "other", description, rates };
}

export interface UsageCalculation {
  neurons: number;
  costUsd: number;
  pricing: ModelPricing;
  note?: string;
}

/**
 * Converts observed usage (from the GraphQL Analytics API, which reports tokens —
 * not neurons) into an estimated neuron count and USD cost, using the given pricing table.
 */
export function calculateUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  pricingTable: PricingTable
): UsageCalculation | null {
  const pricing = pricingTable[model];
  if (!pricing) return null;

  if (pricing.unit !== "tokens") {
    return {
      neurons: 0,
      costUsd: 0,
      pricing,
      note: `"${pricing.unit}"-priced model (${pricing.description}); token-based analytics can't measure its usage here.`,
    };
  }

  const neurons =
    (inputTokens / 1_000_000) * pricing.neuronsPerMillionInputTokens +
    (outputTokens / 1_000_000) * pricing.neuronsPerMillionOutputTokens;
  const costUsd = (neurons / 1_000) * USD_PER_1000_NEURONS;

  return {
    neurons: roundTo(neurons, 4),
    costUsd: roundTo(costUsd, 6),
    pricing,
  };
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
