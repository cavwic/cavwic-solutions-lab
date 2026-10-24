import { browserSkillsApi } from "./browser-skills";
import { buildImportedSkillContext, type ImportedSkillDetail, type ImportedSkillsApi } from "./imported-skills";

export function getImportedSkillsApi(): ImportedSkillsApi | null {
  if (typeof window === "undefined") return null;
  if (window.bidDesktop?.skills) return window.bidDesktop.skills;
  return typeof indexedDB === "undefined" ? null : browserSkillsApi;
}

export async function withBrowserSkillContext(prompt: string): Promise<string> {
  const api = getImportedSkillsApi();
  if (!api) return prompt;
  const enabled = (await api.list()).filter((skill) => skill.enabled);
  const details: ImportedSkillDetail[] = [];
  for (const skill of enabled) {
    details.push(await api.read({ id: skill.id }));
    if (buildImportedSkillContext(details).text.length >= 30000) break;
  }
  const context = buildImportedSkillContext(details, typeof document !== "undefined" && document.documentElement.lang.startsWith("en") ? "en" : "zh");
  return context.text ? `${context.text}\n\n# Current task\n${prompt}` : prompt;
}
