import type { ToolState } from "./model";

export type ScoreResult = {
  score: number;
  completeness: number;
  unknownCount: number;
  sensitivity: { low: number; high: number };
};

function weightedScore(state: ToolState, overrides: Record<string, number> = {}) {
  const weights = state.criteria.map((item) => Math.max(0, overrides[item.id] ?? item.weight));
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  return state.criteria.reduce((sum, item, index) => sum + item.score * weights[index] / total, 0);
}

export function calculateScore(state: ToolState): ScoreResult {
  const unknownCount = state.criteria.filter((item) => item.unknown).length;
  const base = weightedScore(state);
  const score = Math.max(0, Math.min(100, base - unknownCount * 4));
  const variants = state.criteria.flatMap((item) => [
    weightedScore(state, { [item.id]: item.weight * 0.8 }),
    weightedScore(state, { [item.id]: item.weight * 1.2 }),
  ]).map((value) => Math.max(0, Math.min(100, value - unknownCount * 4)));
  return {
    score: Math.round(score),
    completeness: Math.round((1 - unknownCount / Math.max(1, state.criteria.length)) * 100),
    unknownCount,
    sensitivity: { low: Math.round(Math.min(score, ...variants)), high: Math.round(Math.max(score, ...variants)) },
  };
}

export function scoreBand(score: number, locale: "zh" | "en") {
  if (score >= 80) return locale === "zh" ? "可进入受控 POC" : "Ready for a controlled POC";
  if (score >= 60) return locale === "zh" ? "补齐关键证据后再推进" : "Proceed after closing evidence gaps";
  return locale === "zh" ? "暂不建议进入 POC" : "Do not enter POC yet";
}

export function toMarkdown(state: ToolState, locale: "zh" | "en") {
  const score = calculateScore(state);
  const t = locale === "zh"
    ? { summary: "决策摘要", criteria: "评分明细", risk: "风险", acceptance: "验收矩阵", notes: "备注", unknown: "未知" }
    : { summary: "Decision summary", criteria: "Scoring detail", risk: "Risks", acceptance: "Acceptance matrix", notes: "Notes", unknown: "Unknown" };
  return [
    `# ${state.project || "Untitled"}`,
    "",
    `## ${t.summary}`,
    `- Score: ${score.score}/100`,
    `- Evidence completeness: ${score.completeness}%`,
    `- Decision: ${scoreBand(score.score, locale)}`,
    `- Objective: ${state.objective || "-"}`,
    `- Constraints: ${state.constraints || "-"}`,
    "",
    `## ${t.criteria}`,
    ...state.criteria.map((item) => `- ${item.id}: ${item.score}/100 · weight ${item.weight}%${item.unknown ? ` · ${t.unknown}` : ""}${item.note ? ` · ${item.note}` : ""}`),
    "",
    `## ${t.risk}`,
    ...(state.risks.length ? state.risks.map((item) => `- ${item}`) : ["- -"]),
    "",
    `## ${t.acceptance}`,
    "| Metric | Target | Evidence |",
    "| --- | --- | --- |",
    ...state.acceptance.map((item) => `| ${item.metric || "-"} | ${item.target || "-"} | ${item.evidence || "-"} |`),
    "",
    `## ${t.notes}`,
    state.notes || "-",
    "",
    "> Decision aid only. This scoring model is not an industry standard.",
  ].join("\n");
}
