import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildProjectArchive, presentationMarkdown, projectToCsv, projectToMarkdown } from "./exporters";
import { createSampleProject } from "./workflow";

describe("project exporters", () => {
  it("exports source-aware Markdown and Excel-compatible CSV", () => {
    const project = createSampleProject();
    project.tenderSourceIds = ["tender-v1"];
    project.selectedTenderSourceIds = ["tender-v1"];
    project.tenderComparison.results = [{ id: "comparison-1", kind: "comparison", name: "售前与招标对比结果", fileName: "comparison.md", format: "md", createdAt: "2026-08-20", provider: "local", model: "test", sourceId: "comparison-source", relativePath: "outputs/comparison.md", prompt: "", keywords: [], sourceIds: ["meeting-notes", "tender-v1"], templateSourceIds: [], differences: [{ title: "交付周期", presales: "90 天", tender: "60 天", relation: "changed", notes: "以澄清为准" }] }];
    project.bidFileChecklist = [{ id: "bid-file-1", title: "技术方案", category: "technical", status: "pending", sourceResultId: "comparison-1", notes: "招标文件要求", templateSourceIds: [], selectedTemplateSourceIds: [], referenceSourceIds: [], selectedReferenceSourceIds: [], detailRequirements: "", generatedFiles: [] }];
    const markdown = projectToMarkdown(project);
    expect(markdown).toContain("招标要求响应表");
    expect(markdown).toContain("第 18 页");
    expect(markdown).toContain("售前与招标差异");
    expect(markdown).toContain("90 天 -> 60 天");
    expect(markdown).toContain("投标文件清单");
    expect(markdown).toContain("技术方案");
    expect(projectToCsv(project).charCodeAt(0)).toBe(0xfeff);
    expect(presentationMarkdown(project)).not.toContain("POC 与验收");
    expect(presentationMarkdown(project)).toContain("后续行动");
  });

  it("round-trips the complete output archive", async () => {
    const project = createSampleProject("robot");
    const { blob, manifest } = await buildProjectArchive(project);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toContain("output-manifest.json");
    expect(Object.keys(zip.files).some((name) => name.endsWith(".docx"))).toBe(true);
    expect(Object.keys(zip.files).some((name) => name.endsWith(".xlsx"))).toBe(true);
    expect(Object.keys(zip.files).some((name) => name.endsWith(".pptx"))).toBe(true);
    expect(manifest.includesSources).toBe(false);
  }, 30_000);
});
