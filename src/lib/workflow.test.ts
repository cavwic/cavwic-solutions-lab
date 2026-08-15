import { describe, expect, it } from "vitest";
import { compareBaselines, createRequirement, createSampleProject, localizeBuiltInProject, validateProject } from "./workflow";
import { createEmptyProject } from "./workspace-schema";

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

  it("creates English samples and validation messages when English is active", () => {
    const project = createSampleProject("ai", "en");
    project.owner = "";
    expect(project.name).toBe("Enterprise knowledge assistant presales and tender");
    expect(project.requirements[0].title).toBe("Critical business processes require traceable records");
    expect(validateProject(project, "en").some((item) => item.message === "The project owner has not been assigned.")).toBe(true);
  });

  it("localizes untouched built-in content without replacing user text", () => {
    const empty = localizeBuiltInProject(createEmptyProject("en"), "zh");
    expect(empty.name).toBe("新建解决方案项目");
    expect(empty.deliverables.map((item) => item.title)).toContain("产品介绍");

    const edited = createEmptyProject("en");
    edited.name = "Customer archive upgrade";
    expect(localizeBuiltInProject(edited, "zh").name).toBe("Customer archive upgrade");

    const sample = localizeBuiltInProject(createSampleProject("robot", "zh"), "en");
    expect(sample.name).toBe("Indoor material delivery robot solution");
    expect(sample.requirements[0].title).toBe("Critical business processes require traceable records");

    const staleCache = createEmptyProject("zh");
    staleCache.name = "New solution project";
    expect(localizeBuiltInProject(staleCache, "zh").name).toBe("新建解决方案项目");
  });
});
