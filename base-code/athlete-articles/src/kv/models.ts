const MODELS_KEY = "config:models";

export interface ModelsConfig {
  readonly primary: string;
  readonly secondary: string;
  readonly backup: string;
  readonly lastProcessedDate: string | null;
}

const DEFAULT_MODELS_CONFIG: ModelsConfig = {
  primary: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  secondary: "@cf/meta/llama-3.1-8b-instruct-fast",
  backup: "@cf/mistral/mistral-7b-instruct-v0.2",
  lastProcessedDate: null,
};

export async function getModelsConfig(kv: KVNamespace): Promise<ModelsConfig> {
  const value = await kv.get<ModelsConfig>(MODELS_KEY, "json");
  return value ?? DEFAULT_MODELS_CONFIG;
}

export async function putModelsConfig(kv: KVNamespace, config: ModelsConfig): Promise<void> {
  await kv.put(MODELS_KEY, JSON.stringify(config));
}

export async function updateLastProcessedDate(kv: KVNamespace, date: string): Promise<void> {
  const config = await getModelsConfig(kv);
  await putModelsConfig(kv, { ...config, lastProcessedDate: date });
}
