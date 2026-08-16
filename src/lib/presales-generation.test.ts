import { describe, expect, it, vi } from "vitest";
import { buildCodexPresalesTask, buildPresalesPrompt, createGeneratedFile, DEFAULT_MODEL_SETTINGS, getActionResponseTarget, requestPresalesDraft, safeGeneratedFileName } from "./presales-generation";
import { createEmptyProject } from "./workspace-schema";

describe("presales generation", () => {
  it("builds a source-bounded prompt with project, round, and prior history", () => {
    const project = createEmptyProject("zh");
    project.customerAlias = "某客户";
    project.presalesRounds[0].customerNeeds = "需要响应需求 A";
    project.presalesRounds.push({ ...project.presalesRounds[0], id: "round-2", title: "第二次沟通", customerNeeds: "补充需求 B", generatedFiles: [] });
    const prompt = buildPresalesPrompt(project, project.presalesRounds[1]);
    expect(prompt).toContain("某客户");
    expect(prompt).toContain("补充需求 B");
    expect(prompt).toContain("需要响应需求 A");
    expect(prompt).toContain("不得虚构");
  });

  it("calls an OpenAI-compatible chat completions endpoint", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ choices: [{ message: { content: "# 响应文件" } }] }), { status: 200 });
    });
    const result = await requestPresalesDraft({ ...DEFAULT_MODEL_SETTINGS, provider: "local", localEndpoint: "http://127.0.0.1:9000/v1/chat/completions", localModel: "local-model" }, "", "prompt", fetchMock as typeof fetch);
    expect(result.content).toBe("# 响应文件");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(capturedInit?.body)).model).toBe("local-model");
  });

  it("sanitizes generated file names", () => {
    expect(safeGeneratedFileName("客户/响应:第一版", "docx")).toBe("客户-响应-第一版.docx");
  });

  it("builds a Codex task that writes output and metadata back to the project", () => {
    const project = createEmptyProject("zh");
    const round = project.presalesRounds[0];
    round.customerNeeds = "生成客户响应文件";
    const action = { id: "action-1", title: "", owner: "方案负责人", dueDate: "2026-09-01", status: "open" as const, responseFileName: "第一轮响应", responseFileFormat: "docx" as const, fileRequirements: "说明接口范围和待确认边界" };
    round.actions = [action];
    const task = buildCodexPresalesTask(project, round, action);
    expect(task.name).toMatch(/^presales-.+\.md$/);
    expect(task.outputName).toBe("第一轮响应.docx");
    expect(task.content).toContain(`projects/${project.id}/outputs/第一轮响应.docx`);
    expect(task.content).toContain("provider 为 codex");
    expect(task.content).toContain("actionId 为 action-1");
    expect(task.content).toContain("生成客户响应文件");
    expect(task.content).toContain("说明接口范围和待确认边界");
  });

  it("keeps new response items blank instead of inheriting the legacy round defaults", () => {
    const project = createEmptyProject("zh");
    const round = project.presalesRounds[0];
    const action = { id: "action-new", title: "", owner: "", dueDate: "", status: "open" as const, responseFileName: "", fileRequirements: "" };
    round.actions = [action];
    expect(getActionResponseTarget(round, action)).toEqual({ name: "", format: "" });
  });

  it("creates a downloadable Markdown file", async () => {
    const generated = await createGeneratedFile("# 响应", "客户响应", "md");
    expect(generated.name).toBe("客户响应.md");
    expect(await generated.blob.text()).toBe("# 响应");
  });
});
