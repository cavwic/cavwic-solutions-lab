import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildProjectArchive, presentationMarkdown, projectToCsv, projectToMarkdown } from "./exporters";
import { createSampleProject } from "./workflow";

describe("project exporters", () => {
  it("exports source-aware Markdown and Excel-compatible CSV", () => {
    const project = createSampleProject();
    expect(projectToMarkdown(project)).toContain("招标要求响应表");
    expect(projectToMarkdown(project)).toContain("第 18 页");
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
