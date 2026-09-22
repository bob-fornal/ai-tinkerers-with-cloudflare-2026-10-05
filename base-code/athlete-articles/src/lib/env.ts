/**
 * Deliberately narrower than `@cloudflare/workers-types`' generated `Ai`
 * interface: that type is generated from Workers AI's full model catalog
 * and expects a literal model-name type per call, which doesn't fit this
 * app's KV-configurable primary/secondary/backup model selection. `inputs`
 * and the return value are intentionally `unknown` — see
 * `lib/aiResponse.ts` for the defensive extraction this requires.
 */
export interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

/**
 * Mirrors model-validator-worker/src/validate.ts's `ModelValidationResult`
 * — keep the two in sync. Deliberately just a live run/no-run verdict, not
 * an interpretation of Cloudflare's model-catalog metadata: the validator
 * fires one minimal real inference call and reports whether it succeeded.
 */
export interface ModelValidationResult {
  readonly model: string;
  readonly valid: boolean;
  readonly checkedAt: string;
  readonly error?: string;
}

/**
 * The RPC surface exposed by the model-validator-worker's `WorkerEntrypoint`
 * (model-validator-worker/src/index.ts), reached via the `[[services]]`
 * binding in wrangler.toml — no HTTP round trip, just a plain async call.
 */
export interface ModelValidatorBinding {
  validateModel(modelId: string): Promise<ModelValidationResult>;
  validateModels(modelIds: readonly string[]): Promise<readonly ModelValidationResult[]>;
}

export interface Env {
  readonly DB: D1Database;
  readonly APP_KV: KVNamespace;
  readonly AI: AiBinding;
  readonly MODEL_VALIDATOR: ModelValidatorBinding;

  readonly ADMIN_FIREBASE_PROJECT_ID: string;
  readonly COACH_FIREBASE_PROJECT_ID: string;
  readonly ADMIN_APP_ORIGIN: string;
  readonly COACH_APP_ORIGIN: string;
  readonly CF_ACCOUNT_ID: string;

  // Secrets — set via `wrangler secret put`, never [vars]. See
  // docs/deployment/09-secrets-and-key-vault.md.
  readonly TURNSTILE_SECRET_KEY: string;
  readonly BROWSER_RENDERING_API_TOKEN: string;
}
