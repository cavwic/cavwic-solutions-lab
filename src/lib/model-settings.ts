import { z } from "zod";

export const MODEL_SETTINGS_STORAGE_KEY = "cavwic-lab-model-settings";
export const MODEL_API_KEY_STORAGE_KEY = "cavwic-lab-api-key";
export const MODEL_SETTINGS_CHANGED_EVENT = "cavwic-model-settings-change";

export const modelSettingsSchema = z.object({
  schemaVersion: z.literal("2.0.0"),
  provider: z.enum(["codex", "local", "cloud"]),
  localEndpoint: z.string(),
  localModel: z.string(),
  cloudEndpoint: z.string(),
  cloudModel: z.string(),
});

export type ModelSettings = z.infer<typeof modelSettingsSchema>;
export type ModelProvider = ModelSettings["provider"];

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  schemaVersion: "2.0.0",
  provider: "codex",
  localEndpoint: "",
  localModel: "",
  cloudEndpoint: "",
  cloudModel: "",
};

export function readModelSettings(): ModelSettings {
  if (typeof localStorage === "undefined") return DEFAULT_MODEL_SETTINGS;
  const stored = localStorage.getItem(MODEL_SETTINGS_STORAGE_KEY);
  if (!stored) return DEFAULT_MODEL_SETTINGS;
  try {
    const payload = JSON.parse(stored) as Record<string, unknown>;
    const parsed = modelSettingsSchema.safeParse(payload);
    if (parsed.success) return parsed.data;

    // Version 1 defaulted to a specific local endpoint. Migrate it to the
    // explicit Codex workflow without carrying that endpoint forward.
    return {
      ...DEFAULT_MODEL_SETTINGS,
      cloudEndpoint: typeof payload.cloudEndpoint === "string" ? payload.cloudEndpoint : "",
      cloudModel: typeof payload.cloudModel === "string" ? payload.cloudModel : "",
    };
  } catch {
    return DEFAULT_MODEL_SETTINGS;
  }
}

export function readModelApiKey(): string {
  return typeof sessionStorage === "undefined" ? "" : sessionStorage.getItem(MODEL_API_KEY_STORAGE_KEY) || "";
}

export function saveModelSettings(settings: ModelSettings, apiKey: string): void {
  const parsed = modelSettingsSchema.parse(settings);
  localStorage.setItem(MODEL_SETTINGS_STORAGE_KEY, JSON.stringify(parsed));
  if (apiKey.trim()) sessionStorage.setItem(MODEL_API_KEY_STORAGE_KEY, apiKey.trim());
  else sessionStorage.removeItem(MODEL_API_KEY_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(MODEL_SETTINGS_CHANGED_EVENT, { detail: parsed }));
}
