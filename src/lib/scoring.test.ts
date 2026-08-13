import { describe, expect, it } from "vitest";
import { sampleState, toolStateSchema } from "./model";
import { calculateScore, toMarkdown } from "./scoring";

describe("solution scoring", () => {
  it("penalizes unknown evidence without changing raw inputs", () => {
    const state = sampleState("ai");
    const first = calculateScore(state);
    const complete = structuredClone(state);
    complete.criteria.forEach((criterion) => { criterion.unknown = false; });
    expect(calculateScore(complete).score).toBeGreaterThan(first.score);
    expect(first.completeness).toBe(80);
  });

  it("round-trips exported JSON through the schema", () => {
    const state = sampleState("robot");
    expect(toolStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("exports an auditable markdown summary", () => {
    const markdown = toMarkdown(sampleState("hand"), "zh");
    expect(markdown).toContain("验收矩阵");
    expect(markdown).toContain("Decision aid only");
  });
});
