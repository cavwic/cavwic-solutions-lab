import { describe, expect, it } from "vitest";
import { compareBaselines, createRequirement, createSampleProject, validateProject } from "./workflow";

describe("solution workflow rules", () => {
  it("keeps discovery and tender baselines separate", () => {
    const project = createSampleProject();
    const diff = compareBaselines(project.requirements);
    expect(diff).toHaveLength(1);
    expect(diff[0].relation).toBe("changed");
  });

  it("rejects approved requirements without evidence", () => {
    const project = createSampleProject();
    project.requirements[1] = {
      ...project.requirements[1],
      responseStatus: "confirmed",
      reviewState: "approved",
      evidenceRefs: [],
    };
    const messages = validateProject(project).map((item) => item.message);
    expect(messages.some((message) => message.includes("没有绑定证据"))).toBe(true);
  });

  it("forces unsupported requirements into negative deviation", () => {
    const project = createSampleProject();
    project.requirements.push(createRequirement("tender", {
      title: "不支持的接口协议",
      sourceRef: { documentId: "tender-v1", segmentId: "tender-v1-page-18", locator: "第 18 页", excerpt: "要求协议 X。" },
      responseStatus: "unsupported",
      deviationType: "pending",
    }));
    expect(validateProject(project).some((item) => item.message.includes("必须记录为负偏离"))).toBe(true);
  });
});
