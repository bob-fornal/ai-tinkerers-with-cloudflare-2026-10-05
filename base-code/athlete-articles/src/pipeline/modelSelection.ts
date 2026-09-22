import type { Env } from "../lib/env";

/**
 * Early, cheap check — run before the expensive draft/checklist/title
 * generation flow, not instead of the existing retry-on-failure loop in
 * pipeline/run.ts. Calls the model-validator-worker binding (a single real,
 * minimal inference call per candidate model, see
 * model-validator-worker/src/runCheck.ts) to decide whether the configured
 * primary model is actually usable right now, falling back through
 * secondary/backup without first burning a full generation attempt against
 * a dead model.
 *
 * Never blocks generation on the validator itself being unavailable: if the
 * RPC call throws (the validator Worker is down, mis-deployed, or the
 * binding isn't wired up in this environment), that candidate is treated as
 * usable rather than excluded — an unreachable *checker* is not evidence
 * the model itself is bad, and pipeline/run.ts's own retry loop is still
 * the real safety net if it turns out not to be.
 */
export async function selectUsableModels(env: Env, candidates: readonly string[]): Promise<readonly string[]> {
  const uniqueCandidates = Array.from(new Set(candidates));

  const checked = await Promise.all(
    uniqueCandidates.map(async (model) => {
      try {
        const result = await env.MODEL_VALIDATOR.validateModel(model);
        return { model, valid: result.valid };
      } catch (error) {
        console.warn(`Model validator unavailable while checking ${model} — assuming usable:`, error);
        return { model, valid: true };
      }
    }),
  );

  const usable = checked.filter((entry) => entry.valid).map((entry) => entry.model);
  // If every candidate failed the early check, still hand back the original
  // list as a last resort — a bad model list is exactly what the existing
  // per-attempt retry/failure handling in pipeline/run.ts is already built
  // to fail loudly and record, rather than silently generating nothing.
  return usable.length > 0 ? usable : uniqueCandidates;
}
