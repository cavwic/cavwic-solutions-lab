import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("cavwic-lab-locale", "zh");
  });
  await page.reload();
  await expect(page.locator(".solution-app")).toHaveAttribute("data-ready", "true");
});

test("runs the presales-to-handover project flow and persists edits", async ({ page }) => {
  const projectName = page.locator(".field-grid input").first();
  await expect(projectName).toHaveValue("新建解决方案项目");
  await projectName.fill("端到端解决方案项目");

  await page.getByRole("button", { name: /招标要求|Tender requirements/ }).click();
  await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: "tender.txt", mimeType: "text/plain", buffer: Buffer.from("The system shall retain audit logs.") });
  await page.locator(".segment-list article button").first().click();
  await expect(page.locator(".source-tabs button")).toHaveCount(1);
  await expect(page.locator(".requirement-index button")).toHaveCount(1);
  await expect(page.locator(".diff-list > div")).toHaveCount(1);

  await page.getByRole("button", { name: /技术标组包|Technical bid pack/ }).click();
  await expect(page.locator(".response-row")).toHaveCount(1);
  await page.locator("section:has(.evidence-table) .icon-command").click();
  await expect(page.locator(".evidence-table .table-row")).toHaveCount(1);
  await page.locator(".response-row select").first().selectOption("confirmed");
  await page.locator(".evidence-checks input").first().check();

  await page.getByRole("button", { name: /中标交底|Award handover/ }).click();
  await expect(page.getByText(/技术交底与项目协同|Technical handover and project actions/)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /售前准备|Presales/ }).click();
  await expect(page.locator(".field-grid input").first()).toHaveValue("端到端解决方案项目");
});

test("exports project files and exposes versioned Skill downloads", async ({ page }) => {
  await page.getByRole("button", { name: /输出与 Skills|Outputs and Skills/ }).click();
  await expect(page.locator(".format-grid button")).toHaveCount(6);
  await expect(page.locator(".skill-downloads a")).toHaveCount(3);

  const csvDownload = page.waitForEvent("download");
  await page.locator(".format-grid button").filter({ hasText: "CSV" }).click();
  expect((await csvDownload).suggestedFilename()).toContain("requirements.csv");

  const zipDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /导出完整 ZIP|Export complete ZIP/ }).click();
  expect((await zipDownload).suggestedFilename()).toContain("package.zip");
});

test("legacy scoring routes point users to the new workflow", async ({ page }) => {
  for (const path of ["ai-poc", "robot-poc", "dexterous-hand"]) {
    await page.goto(path);
    await expect(page.getByText("旧工具 / 已停用", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "进入解决方案项目工作台" })).toBeVisible();
  }
});

test("uses the system language until the user chooses another language", async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem("cavwic-lab-locale"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-locale", "en");
  await expect(page).toHaveTitle("CAVWIC Solution Project Workbench");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Solution Project Workbench");
  await expect(page.locator(".project-header > div > span")).toHaveText("New solution project");
  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-locale", "zh");
  await expect(page).toHaveTitle("CAVWIC 解决方案项目工作台");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("解决方案项目工作台");
  await expect(page.locator(".project-header > div > span")).toHaveText("新建解决方案项目");
});

test("updates the current stage only when work is recorded", async ({ page }) => {
  const stage = page.locator(".rail-status");
  await expect(stage).toHaveAttribute("data-stage", "presales");
  await expect(stage.locator("strong")).toHaveText("售前");

  await page.getByRole("button", { name: "招标要求" }).click();
  await expect(stage).toHaveAttribute("data-stage", "presales");
  await page.locator(".requirements-pane .pane-title .icon-command").click();
  await expect(stage).toHaveAttribute("data-stage", "tender");
  await expect(stage.locator("strong")).toHaveText("投标");

  await page.getByRole("button", { name: "中标交底" }).click();
  await expect(stage).toHaveAttribute("data-stage", "tender");
  await page.locator("section:has(.handover-grid) .icon-command").click();
  await expect(stage).toHaveAttribute("data-stage", "delivery");
  await expect(stage.locator("strong")).toHaveText("交底");
});

test("manages presales communication rounds and generates a referenced file", async ({ page }) => {
  await expect(page.getByRole("button", { name: "导入企业信息" })).toHaveCount(0);
  await expect(page.getByText("POC 与定制演示")).toHaveCount(0);

  await page.getByRole("link", { name: /模型配置/ }).click();
  await page.getByRole("button", { name: "本机或内网接口" }).click();
  await page.getByLabel("Chat Completions 接口地址").fill("http://127.0.0.1:9000/v1/chat/completions");
  await page.getByLabel("模型名称").fill("test-compatible-model");
  await page.getByRole("button", { name: "保存配置" }).click();
  await page.getByRole("link", { name: "返回工作台" }).click();

  const firstRound = page.locator(".presales-round").first();
  await firstRound.locator(".round-needs textarea").fill("客户本轮需要响应需求 A，并保留待确认边界。");
  await firstRound.locator(".round-reference-box input[type=file]").setInputFiles({ name: "product-introduction.txt", mimeType: "text/plain", buffer: Buffer.from("产品支持审计日志和人工复核。") });
  await firstRound.getByRole("button", { name: "新增执行项" }).click();
  await firstRound.getByLabel("执行项", { exact: true }).fill("确认接口范围");
  await firstRound.getByLabel("项目责任人", { exact: true }).fill("解决方案负责人");
  await firstRound.locator(".reference-checks input").first().check();
  await firstRound.getByLabel("文件生成说明").fill("输出需求、建议响应、边界和后续行动。");
  await firstRound.getByLabel("响应文件名称").fill("第一轮响应");
  await expect(firstRound.getByLabel("响应文件格式").locator("option")).toHaveText(["Word", "PPT", "Markdown"]);
  await firstRound.getByLabel("响应文件格式").selectOption("md");

  await page.route("http://127.0.0.1:9000/v1/chat/completions", async (route) => {
    const request = route.request().postDataJSON() as { messages: Array<{ content: string }> };
    expect(request.messages[1].content).toContain("客户本轮需要响应需求 A");
    expect(request.messages[1].content).toContain("product-introduction.txt");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: "# 第一轮响应\n\n## 客户需求\n需求 A\n\n## 待确认项\n接口范围待确认。" } }] }) });
  });
  await firstRound.getByRole("button", { name: "生成本轮文件" }).click();
  await expect(firstRound.getByRole("button", { name: /第一轮响应\.md/ })).toBeVisible();

  await page.getByRole("button", { name: "新增沟通节点" }).click();
  await expect(page.locator(".presales-round")).toHaveCount(2);
  await expect(page.locator(".presales-round").nth(1).getByText("第一轮响应.md")).toBeVisible();
  await page.locator(".presales-round").nth(1).getByRole("button", { name: /删除: 第 2 次沟通/ }).click();
  await expect(page.locator(".presales-round")).toHaveCount(1);
});

test("uses one global model link in the header and keeps lifecycle navigation in the workbench", async ({ page }) => {
  const navigation = page.locator(".lab-header nav");
  await expect(navigation.locator("a")).toHaveCount(1);
  await expect(navigation.getByRole("link", { name: /模型配置/ })).toHaveAttribute("href", /\/model-settings$/);
  await expect(page.locator(".stage-rail > button")).toHaveCount(5);

  await navigation.getByRole("link", { name: /模型配置/ }).click();
  await expect(page).toHaveURL(/\/model-settings$/);
  await expect(page.locator(".lab-header nav a.active")).toHaveAccessibleName(/模型配置/);
  await expect(page.getByText("Codex 工作流", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("API Key（仅当前浏览器会话）")).toHaveCount(0);
});

test("keeps only the final project actions in the workspace toolbar", async ({ page }) => {
  const toolbar = page.locator(".workspace-toolbar");
  await expect(toolbar.getByRole("button", { name: "新建项目" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "项目路径" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /示例/ })).toHaveCount(0);
  await expect(page.getByText("本地工作区路径提示")).toHaveCount(0);
});

test("stores sources, Codex tasks, and generated files in the selected project folder", async ({ page }) => {
  await page.evaluate(() => {
    const writes: string[] = [];
    class MemoryDirectory {
      name: string;
      path: string;
      directories = new Map<string, MemoryDirectory>();
      constructor(name: string, path = "") { this.name = name; this.path = path || name; }
      async queryPermission() { return "granted" as PermissionState; }
      async requestPermission() { return "granted" as PermissionState; }
      async getDirectoryHandle(name: string) {
        if (!this.directories.has(name)) this.directories.set(name, new MemoryDirectory(name, `${this.path}/${name}`));
        return this.directories.get(name)!;
      }
      async getFileHandle(name: string) {
        const path = `${this.path}/${name}`;
        return {
          async getFile() { return new File([], name); },
          async createWritable() {
            return { async write() { writes.push(path); }, async close() {} };
          },
        };
      }
    }
    (window as typeof window & { __workspaceWrites?: string[] }).__workspaceWrites = writes;
    window.showDirectoryPicker = async () => new MemoryDirectory("客户项目") as never;
  });

  await page.getByRole("button", { name: "项目路径" }).click();
  await expect(page.getByRole("button", { name: "项目路径: 客户项目" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __workspaceWrites?: string[] }).__workspaceWrites || []))
    .toContain("客户项目/workspace.json");

  await page.getByRole("button", { name: "生成 Codex 任务" }).click();
  await expect.poll(() => page.evaluate(() => ((window as typeof window & { __workspaceWrites?: string[] }).__workspaceWrites || [])
    .some((path) => /客户项目\/projects\/solution-\d{4}-\d{2}-\d{2}\/work\/codex-tasks\/presales-.+\.md$/.test(path))))
    .toBe(true);

  await page.getByRole("button", { name: "招标要求" }).click();
  await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: "tender.txt", mimeType: "text/plain", buffer: Buffer.from("The system shall retain audit logs.") });
  await expect.poll(() => page.evaluate(() => ((window as typeof window & { __workspaceWrites?: string[] }).__workspaceWrites || [])
    .some((path) => /客户项目\/projects\/solution-\d{4}-\d{2}-\d{2}\/sources\/tender\.txt$/.test(path))))
    .toBe(true);

  await page.getByRole("button", { name: "输出与 Skills" }).click();
  await page.locator(".format-grid button").filter({ hasText: "Markdown" }).click();
  await expect.poll(() => page.evaluate(() => ((window as typeof window & { __workspaceWrites?: string[] }).__workspaceWrites || [])
    .some((path) => /客户项目\/projects\/solution-\d{4}-\d{2}-\d{2}\/outputs\/[^/]+\.md$/.test(path))))
    .toBe(true);
});
