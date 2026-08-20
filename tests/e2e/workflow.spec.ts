import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("cavwic-lab-locale", "zh");
  });
  await page.reload();
  await expect(page.locator(".solution-app")).toHaveAttribute("data-ready", "true");
});

test("runs the presales-to-handover project flow and persists edits", async ({ page }) => {
  const projectName = page.locator(".field-grid input").first();
  await expect(projectName).toHaveValue("新建解决方案项目");
  await projectName.fill("端到端解决方案项目");

  await page.getByRole("button", { name: /招标|Tender/ }).click();
  await page.locator('#tender-files input[type="file"]').setInputFiles({ name: "tender.txt", mimeType: "text/plain", buffer: Buffer.from("The system shall retain audit logs and preserve source references for every response.") });
  await expect(page.getByLabel("选择文件 tender.txt")).toBeChecked();
  await page.getByRole("button", { name: "预处理", exact: true }).first().click();
  await expect(page.getByText("上传并预处理完成", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /投标|Bid/ }).click();
  await expect(page.getByRole("heading", { name: /投标文件输出|Bid file output/ })).toBeVisible();
  await expect(page.locator(".bid-output-list > article")).toHaveCount(0);

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

  await page.getByRole("button", { name: "招标" }).click();
  await expect(stage).toHaveAttribute("data-stage", "presales");
  await page.locator('#tender-files input[type="file"]').setInputFiles({ name: "tender.txt", mimeType: "text/plain", buffer: Buffer.from("The bidder shall submit a deployment plan and acceptance plan.") });
  await expect(stage).toHaveAttribute("data-stage", "tender");
  await expect(stage.locator("strong")).toHaveText("投标");

  await page.getByRole("button", { name: "中标交底" }).click();
  await expect(stage).toHaveAttribute("data-stage", "tender");
  await page.locator("section:has(.handover-grid) .icon-command").click();
  await expect(stage).toHaveAttribute("data-stage", "delivery");
  await expect(stage.locator("strong")).toHaveText("交底");
});

test("preprocesses selected tender files and keeps unrecognized files without OCR", async ({ page }) => {
  await page.getByRole("button", { name: "招标" }).click();
  await page.locator('#tender-files input[type="file"]').setInputFiles([
    { name: "招标书.txt", mimeType: "text/plain", buffer: Buffer.from("投标人应提交技术方案、部署方案、验收方案和完整的项目进度计划。") },
    { name: "扫描附件.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) },
  ]);
  await expect(page.getByLabel("选择文件 招标书.txt")).toBeChecked();
  await expect(page.getByLabel("选择文件 扫描附件.png")).toBeChecked();
  await page.locator("#tender-files .tender-file-toolbar").getByRole("button", { name: "预处理" }).click();
  const ocrChoice = page.getByRole("alertdialog");
  await expect(ocrChoice.getByRole("heading")).toHaveText("导入文件存在无法识别项，是否通过 OCR 重新识别？");
  await ocrChoice.getByRole("button", { name: "否" }).click();
  await expect(page.getByText("上传并预处理完成", { exact: true })).toBeVisible();
  await expect(page.getByText("仅上传，未处理", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /招标书\.txt/ }).click();
  await expect(page.locator(".tender-source-actions").getByRole("button", { name: "预处理" })).toBeDisabled();
  await page.getByRole("button", { name: /扫描附件\.png/ }).click();
  await page.locator(".tender-source-actions").getByRole("button", { name: "删除" }).click();
  await expect(page.getByText("扫描附件.png", { exact: true })).toHaveCount(0);
});

test("restores every tender file after model configuration and completes OCR", async ({ page }) => {
  await page.getByRole("button", { name: "招标" }).click();
  await page.locator('#tender-files input[type="file"]').setInputFiles([
    { name: "可读招标书.txt", mimeType: "text/plain", buffer: Buffer.from("本项目要求响应技术参数、交付计划、验收方案以及投标文件清单。") },
    { name: "扫描补遗.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) },
  ]);
  await page.locator("#tender-files .tender-file-toolbar").getByRole("button", { name: "预处理" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "是" }).click();
  const modelChoice = page.getByRole("alertdialog");
  await expect(modelChoice.getByRole("heading")).toHaveText("模型未配置，请前往配置。");
  await modelChoice.getByRole("button", { name: "是，前往配置" }).click();
  await expect(page).toHaveURL(/\/model-settings\?return=/);

  await page.route("http://127.0.0.1:9020/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON() as { messages: Array<{ content: unknown }> };
    expect(JSON.stringify(body.messages[1].content)).toContain("data:image/png;base64");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: "补遗要求：交付周期调整为 60 天。" } }] }) });
  });
  await page.getByRole("button", { name: "本机或内网接口" }).click();
  await page.getByLabel("Chat Completions 接口地址").fill("http://127.0.0.1:9020/v1/chat/completions");
  await page.getByLabel("模型名称").fill("vision-test-model");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("识别完成");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByText("可读招标书.txt", { exact: true })).toBeVisible();
  await expect(page.getByText("扫描补遗.png", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /扫描补遗\.png 上传并预处理完成/ })).toBeVisible();
  const persistedTenderNames = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("cavwic-solution-workspace") || "{}") as { tenderSourceIds?: string[]; sources?: Array<{ id: string; name: string }> };
    return (stored.tenderSourceIds || []).map((id) => stored.sources?.find((source) => source.id === id)?.name || id);
  });
  expect(persistedTenderNames).toEqual(["可读招标书.txt", "扫描补遗.png"]);

  await page.reload();
  await expect(page.locator(".solution-app")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "招标" }).click();
  await expect(page.getByText("可读招标书.txt", { exact: true })).toBeVisible();
  await expect(page.getByText("扫描补遗.png", { exact: true })).toBeVisible();
});

test("analyzes tender files, compares the full presales set, and builds the bid checklist", async ({ page }) => {
  const presalesRound = page.locator(".presales-round").first();
  await presalesRound.locator("label.file-command", { hasText: "导入客户附件" }).locator("input[type=file]").setInputFiles({ name: "售前需求A.txt", mimeType: "text/plain", buffer: Buffer.from("售前阶段约定交付周期为 90 天，并要求提交部署方案。") });

  await page.getByRole("link", { name: /模型配置/ }).click();
  await page.getByRole("button", { name: "本机或内网接口" }).click();
  await page.getByLabel("Chat Completions 接口地址").fill("http://127.0.0.1:9021/v1/chat/completions");
  await page.getByLabel("模型名称").fill("tender-analysis-model");
  await page.getByRole("button", { name: "保存配置" }).click();
  await page.getByRole("link", { name: "返回工作台" }).click();
  await page.getByRole("button", { name: "招标" }).click();

  await page.locator('#tender-files input[type="file"]').setInputFiles({ name: "正式招标书.txt", mimeType: "text/plain", buffer: Buffer.from("投标截止时间为 2026 年 9 月 30 日，交付周期为 75 天，须提交技术方案和验收方案。") });
  await page.locator("#tender-files .tender-file-toolbar").getByRole("button", { name: "预处理" }).click();
  await page.getByRole("button", { name: "新增澄清节点" }).click();
  const clarification = page.locator(".clarification-row").first();
  await clarification.getByLabel("澄清节点名称").fill("第一次书面澄清");
  await clarification.locator("label.file-command", { hasText: "导入澄清文件" }).locator("input[type=file]").setInputFiles({ name: "澄清回复.txt", mimeType: "text/plain", buffer: Buffer.from("交付周期最终调整为 60 天，以本澄清文件为准。") });
  await expect(clarification.getByLabel("选择文件 澄清回复.txt")).toBeChecked();
  await page.getByRole("button", { name: "技术参数", exact: true }).click();
  await page.getByLabel("招标分析要求").fill("提取时间、参数、版本关系和投标文件清单，并标注来源。");
  await page.getByLabel("招标分析文件格式").selectOption("md");

  await page.route("http://127.0.0.1:9021/v1/chat/completions", async (route) => {
    const request = route.request().postDataJSON() as { messages: Array<{ content: string }> };
    const prompt = request.messages[1].content;
    if (prompt.includes("技术投标文件编制负责人")) {
      expect(prompt).toContain("产品能力参考.txt");
      expect(prompt).toContain("企业技术方案模板.md");
      expect(prompt).toContain("重点说明权限边界、实施步骤和验收方法");
      expect(prompt).toContain("交付周期 60 天");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: "# 技术方案\n\n## 项目理解\n\n交付周期为 60 天。\n\n## 待确认事项\n\n具体产品参数待确认。" } }] }) });
    } else if (prompt.includes("售前与正式招标基线对比")) {
      expect(prompt).toContain("售前需求A.txt");
      expect(prompt).toContain("正式招标书.txt");
      expect(prompt).toContain("澄清回复.txt");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: `# 售前与招标差异\n\n交付周期发生变化。\n\n\`\`\`json\n${JSON.stringify({ schema: "cavwic-tender-analysis-1", requirements: [], bidFileChecklist: [], differences: [{ title: "交付周期", presales: "90 天", tender: "60 天", relation: "changed", notes: "以澄清回复为准" }] })}\n\`\`\`` } }] }) });
    } else {
      expect(prompt).toContain("正式招标书.txt");
      expect(prompt).toContain("澄清回复.txt");
      expect(prompt).not.toContain("售前需求A.txt");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: `# 招标要求分析\n\n- 交付周期：60 天。\n\n\`\`\`json\n${JSON.stringify({ schema: "cavwic-tender-analysis-1", requirements: [{ title: "交付周期", category: "schedule", originalText: "交付周期最终调整为 60 天", normalizedText: "交付周期 60 天", sourceName: "澄清回复.txt", locator: "第 1 行", mandatory: true, scored: false, dueDate: "" }], bidFileChecklist: [{ title: "技术方案", category: "technical", notes: "正式招标书" }, { title: "验收方案", category: "delivery", notes: "正式招标书" }], differences: [] })}\n\`\`\`` } }] }) });
    }
  });

  await page.getByRole("button", { name: "招标要求分析" }).click();
  await expect(page.getByText("技术参数分析结果", { exact: true })).toBeVisible();
  await expect(page.getByLabel("投标文件名称").first()).toHaveValue("技术方案");
  await expect(page.getByLabel("投标文件名称").nth(1)).toHaveValue("验收方案");
  await page.getByLabel("招标分析要求").fill("临时修改的分析要求");
  await page.getByRole("button", { name: "技术参数分析结果", exact: true }).click();
  await expect(page.getByLabel("招标分析要求")).toHaveValue("提取时间、参数、版本关系和投标文件清单，并标注来源。");
  await expect(page.getByRole("button", { name: /打开文件 · 技术参数分析结果\.md/ })).toBeVisible();

  await page.getByLabel("全选售前文件").check();
  await page.getByLabel("对比结果文件格式").selectOption("md");
  await page.getByRole("button", { name: "对比", exact: true }).click();
  await expect(page.getByText("售前与招标对比结果", { exact: true })).toBeVisible();
  const difference = page.locator(".tender-difference-results .diff-list").first();
  await expect(difference).toContainText("90 天");
  await expect(difference).toContainText("60 天");

  await page.getByRole("button", { name: "投标", exact: true }).click();
  await expect(page.getByRole("heading", { name: "投标文件输出" })).toBeVisible();
  await expect(page.locator(".bid-output-list > article")).toHaveCount(2);
  const technicalFile = page.locator(".bid-output-list > article").filter({ hasText: "技术方案" }).first();
  await technicalFile.locator(".bid-output-summary").click();
  await technicalFile.locator("label.file-command", { hasText: "上传模板" }).locator("input[type=file]").setInputFiles({ name: "企业技术方案模板.md", mimeType: "text/markdown", buffer: Buffer.from("# 项目理解\n# 技术方案\n# 实施与验收") });
  await technicalFile.locator("label.file-command", { hasText: "上传参考资料" }).locator("input[type=file]").setInputFiles({ name: "产品能力参考.txt", mimeType: "text/plain", buffer: Buffer.from("系统支持分级权限、操作审计和分阶段验收。") });
  await technicalFile.getByLabel("输出格式 技术方案").selectOption("md");
  await technicalFile.getByLabel("细节要求 技术方案").fill("重点说明权限边界、实施步骤和验收方法。");
  await technicalFile.getByRole("button", { name: "生成文件" }).click();
  await expect(technicalFile.getByText("技术方案.md", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "投标", exact: true }).click();
  const persistedTechnicalFile = page.locator(".bid-output-list > article").filter({ hasText: "技术方案" }).first();
  await persistedTechnicalFile.locator(".bid-output-summary").click();
  await expect(persistedTechnicalFile.getByLabel("细节要求 技术方案")).toHaveValue("重点说明权限边界、实施步骤和验收方法。");
  await expect(persistedTechnicalFile.getByText("技术方案.md", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    localStorage.removeItem("cavwic-lab-model-settings");
    const writes: Array<{ name: string; content: string }> = [];
    class TaskDirectory {
      name = "投标任务";
      async queryPermission() { return "granted" as PermissionState; }
      async requestPermission() { return "granted" as PermissionState; }
      async getFileHandle(name: string) {
        return { async createWritable() { return { async write(content: string) { writes.push({ name, content: String(content) }); }, async close() {} }; } };
      }
    }
    (window as typeof window & { __bidTaskWrites?: Array<{ name: string; content: string }> }).__bidTaskWrites = writes;
    window.showDirectoryPicker = async () => new TaskDirectory() as never;
  });
  const acceptanceFile = page.locator(".bid-output-list > article").filter({ hasText: "验收方案" }).first();
  await acceptanceFile.locator(".bid-output-summary").click();
  await acceptanceFile.getByLabel("输出格式 验收方案").selectOption("docx");
  await acceptanceFile.getByLabel("细节要求 验收方案").fill("覆盖工厂验收、现场验收和遗留项关闭。");
  await acceptanceFile.getByRole("button", { name: "生成文件" }).click();
  await expect(page.getByRole("alertdialog").getByRole("button")).toHaveText(["是，前往配置", "否，输出任务"]);
  await page.getByRole("alertdialog").getByRole("button", { name: "否，输出任务" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __bidTaskWrites?: Array<{ name: string; content: string }> }).__bidTaskWrites || [])).toHaveLength(1);
  const [task] = await page.evaluate(() => (window as typeof window & { __bidTaskWrites?: Array<{ name: string; content: string }> }).__bidTaskWrites || []);
  expect(task.name).toMatch(/^bid-output-.+\.md$/);
  expect(task.content).toContain("验收方案.docx");
  expect(task.content).toContain("覆盖工厂验收、现场验收和遗留项关闭");
  expect(task.content).toContain("generatedFiles");
});

test("records communication participants by organization category", async ({ page }) => {
  const node = page.locator(".presales-round").first().locator(".round-node");
  await node.getByRole("textbox", { name: "参会人员", exact: true }).fill("客户项目经理");
  await node.getByRole("button", { name: "新增参会人员" }).click();
  await node.getByLabel("参会人员类别").selectOption("third-party");
  await node.getByRole("textbox", { name: "参会人员", exact: true }).fill("咨询顾问");
  await node.getByRole("button", { name: "新增参会人员" }).click();
  await node.getByLabel("参会人员类别").selectOption("internal");
  await node.getByRole("textbox", { name: "参会人员", exact: true }).fill("解决方案负责人");
  await node.getByRole("button", { name: "新增参会人员" }).click();

  await expect(node.locator(".participant-groups")).toContainText("客户");
  await expect(node.locator(".participant-groups")).toContainText("第三方");
  await expect(node.locator(".participant-groups")).toContainText("公司内人员");
  await expect(node.getByText("客户项目经理", { exact: true })).toBeVisible();
  await expect(node.getByText("咨询顾问", { exact: true })).toBeVisible();
  await expect(node.getByText("解决方案负责人", { exact: true })).toBeVisible();
  await node.getByRole("button", { name: "删除参会人员 咨询顾问" }).click();
  await expect(node.getByText("咨询顾问", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".round-node").getByText("客户项目经理", { exact: true })).toBeVisible();
  await expect(page.locator(".round-node").getByText("解决方案负责人", { exact: true })).toBeVisible();
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
  await firstRound.locator("label.file-command", { hasText: "导入客户附件" }).locator("input[type=file]").setInputFiles({ name: "customer-brief.txt", mimeType: "text/plain", buffer: Buffer.from("客户本轮需要响应需求 A，并保留待确认边界。") });
  await firstRound.locator(".round-reference-box input[type=file]").setInputFiles({ name: "product-introduction.txt", mimeType: "text/plain", buffer: Buffer.from("产品支持审计日志和人工复核。") });
  await firstRound.getByRole("button", { name: "新增执行项" }).click();
  const firstAction = firstRound.locator(".round-action-row").first();
  await expect(firstAction.getByLabel("响应文件名称")).toHaveValue("");
  await expect(firstAction.getByLabel("响应文件格式")).toHaveValue("");
  await expect(firstAction.getByLabel("执行项", { exact: true })).toHaveCount(0);
  await firstAction.getByLabel("项目责任人", { exact: true }).fill("解决方案负责人");
  await firstAction.getByLabel("截止时间", { exact: true }).fill("2026-09-01");
  await firstRound.locator(".reference-checks input").first().check();
  await firstAction.getByLabel("文件要求").fill("输出需求、建议响应、边界和后续行动。");
  await firstAction.getByLabel("响应文件名称").fill("第一轮响应");
  await expect(firstAction.getByLabel("响应文件格式").locator("option")).toHaveText(["请选择", "Word", "PPT", "Markdown"]);
  await firstAction.locator("label.file-command", { hasText: "上传模板" }).locator("input[type=file]").setInputFiles([
    { name: "响应模板.md", mimeType: "text/markdown", buffer: Buffer.from("# 模板章节\n\n现状、方案、边界") },
    { name: "删除模板.md", mimeType: "text/markdown", buffer: Buffer.from("不应进入模型提示词") },
  ]);
  await expect(firstAction.locator(".template-source-list > div")).toHaveCount(2);
  await firstAction.locator(".template-source-list > div").first().locator("button").first().click();
  await firstAction.getByRole("button", { name: "删除响应文件模板 删除模板.md" }).click();
  await expect(firstAction.locator(".template-source-list > div")).toHaveCount(1);
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("输出格式不匹配");
    await dialog.accept();
  });
  await firstAction.getByLabel("响应文件格式").selectOption("pptx");
  await expect(firstAction.getByLabel("响应文件格式")).toHaveValue("");
  await firstAction.getByLabel("响应文件格式").selectOption("md");

  await page.route("http://127.0.0.1:9000/v1/chat/completions", async (route) => {
    const request = route.request().postDataJSON() as { messages: Array<{ content: string }> };
    expect(request.messages[1].content).toContain("客户本轮需要响应需求 A");
    expect(request.messages[1].content).toContain("product-introduction.txt");
    expect(request.messages[1].content).toContain("第一轮响应");
    expect(request.messages[1].content).toContain("输出需求、建议响应、边界和后续行动");
    expect(request.messages[1].content).toContain("现状、方案、边界");
    expect(request.messages[1].content).not.toContain("不应进入模型提示词");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: "# 第一轮响应\n\n## 客户需求\n需求 A\n\n## 待确认项\n接口范围待确认。" } }] }) });
  });
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("是否使用模型生成该文件？");
    await dialog.accept();
  });
  await firstAction.getByRole("button", { name: "生成文件" }).click();
  await expect(firstRound.getByRole("button", { name: /第一轮响应\.md/ })).toBeVisible();
  await expect(firstRound.getByRole("button", { name: /第一轮响应\.md/ })).toContainText("第一轮响应");

  await firstRound.getByRole("button", { name: "新增执行项" }).click();
  const secondAction = firstRound.locator(".round-action-row").nth(1);
  await expect(secondAction.getByLabel("响应文件名称")).toHaveValue("");
  await expect(secondAction.getByLabel("响应文件格式")).toHaveValue("");
  await secondAction.getByLabel("响应文件名称").fill("第二项演示材料");
  await secondAction.getByLabel("响应文件格式").selectOption("pptx");
  await expect(firstAction.getByLabel("响应文件名称")).toHaveValue("第一轮响应");
  await expect(firstAction.getByLabel("响应文件格式")).toHaveValue("md");
  await expect(secondAction.getByLabel("响应文件格式")).toHaveValue("pptx");

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

test("returns from model configuration to the pending customer analysis", async ({ page }) => {
  const workbenchUrl = page.url();
  const round = page.locator(".presales-round").first();
  await round.locator("label.file-command", { hasText: "导入客户附件" }).locator("input[type=file]").setInputFiles({ name: "客户资料.txt", mimeType: "text/plain", buffer: Buffer.from("项目工期为 90 天。") });
  await round.getByLabel("分析结果文件格式").selectOption("md");
  await round.getByRole("button", { name: "需求分析" }).click();
  const modelChoice = page.getByRole("alertdialog");
  await expect(modelChoice.getByRole("heading")).toHaveText("未配置大模型，请前往配置。");
  await expect(modelChoice.getByRole("button")).toHaveText(["是，前往配置", "否，输出任务"]);
  await modelChoice.getByRole("button", { name: "是，前往配置" }).click();
  await expect(page).toHaveURL(/\/model-settings\?return=/);

  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page).toHaveURL(/\/model-settings\?return=/);
  await expect(page.getByText(/当前执行方式不能由网页直接调用/)).toBeVisible();
  await page.getByRole("button", { name: "本机或内网接口" }).click();
  await page.getByLabel("Chat Completions 接口地址").fill("http://127.0.0.1:9010/v1/chat/completions");
  await page.getByLabel("模型名称").fill("analysis-model");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page).toHaveURL(workbenchUrl);
  await expect(page.getByText("客户资料.txt")).toBeVisible();
  await expect(page.getByLabel("分析结果文件格式")).toHaveValue("md");
});

test("outputs a customer analysis task when the user declines model configuration", async ({ page }) => {
  await page.evaluate(() => {
    const writes: Array<{ name: string; content: string }> = [];
    class TaskDirectory {
      name = "分析任务";
      async queryPermission() { return "granted" as PermissionState; }
      async requestPermission() { return "granted" as PermissionState; }
      async getFileHandle(name: string) {
        return {
          async createWritable() {
            return { async write(content: string) { writes.push({ name, content: String(content) }); }, async close() {} };
          },
        };
      }
    }
    (window as typeof window & { __analysisTaskWrites?: Array<{ name: string; content: string }> }).__analysisTaskWrites = writes;
    window.showDirectoryPicker = async () => new TaskDirectory() as never;
  });

  const workbenchUrl = page.url();
  const round = page.locator(".presales-round").first();
  await round.locator("label.file-command", { hasText: "导入客户附件" }).locator("input[type=file]").setInputFiles({ name: "客户参数.txt", mimeType: "text/plain", buffer: Buffer.from("设备额定负载为 5 kg。") });
  await round.getByRole("button", { name: "技术参数", exact: true }).click();
  await round.getByLabel("分析要求").fill("输出参数、来源位置和待确认项。");
  await round.getByLabel("分析结果文件格式").selectOption("docx");
  await round.getByRole("button", { name: "需求分析" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "否，输出任务" }).click();

  await expect(page).toHaveURL(workbenchUrl);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __analysisTaskWrites?: Array<{ name: string; content: string }> }).__analysisTaskWrites || [])).toHaveLength(1);
  const [task] = await page.evaluate(() => (window as typeof window & { __analysisTaskWrites?: Array<{ name: string; content: string }> }).__analysisTaskWrites || []);
  expect(task.name).toMatch(/^presales-analysis-.+\.md$/);
  expect(task.content).toContain("设备额定负载为 5 kg");
  expect(task.content).toContain("输出参数、来源位置和待确认项");
  expect(task.content).toContain("analysisResults");
});

test("analyzes selected customer attachments with keywords and a matching template", async ({ page }) => {
  await page.getByRole("link", { name: /模型配置/ }).click();
  await page.getByRole("button", { name: "本机或内网接口" }).click();
  await page.getByLabel("Chat Completions 接口地址").fill("http://127.0.0.1:9011/v1/chat/completions");
  await page.getByLabel("模型名称").fill("customer-analysis-model");
  await page.getByRole("button", { name: "保存配置" }).click();
  await page.getByRole("link", { name: "返回工作台" }).click();

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
        return { async getFile() { return new File([], name); }, async createWritable() { return { async write() { writes.push(path); }, async close() {} }; } };
      }
      async removeEntry() {}
    }
    (window as typeof window & { __analysisWrites?: string[] }).__analysisWrites = writes;
    const root = new MemoryDirectory("客户需求项目");
    window.showDirectoryPicker = async () => root as never;
  });
  await page.getByRole("button", { name: "项目路径" }).click();

  const round = page.locator(".presales-round").first();
  await round.locator("label.file-command", { hasText: "导入客户附件" }).locator("input[type=file]").setInputFiles([
    { name: "客户技术要求.txt", mimeType: "text/plain", buffer: Buffer.from("额定负载 5 kg，交付时间待确认。") },
    { name: "删除资料.txt", mimeType: "text/plain", buffer: Buffer.from("这段内容不应出现在分析请求中。") },
  ]);
  await expect(round.locator(".customer-source-list > div")).toHaveCount(2);
  await expect(round.getByLabel("全选客户附件")).toBeChecked();
  await round.getByRole("button", { name: "删除客户附件 删除资料.txt" }).click();
  await expect(round.locator(".customer-source-list > div")).toHaveCount(1);

  await round.getByRole("button", { name: "技术参数", exact: true }).click();
  await round.getByLabel("新增关键词").fill("临时关键词");
  await round.getByRole("button", { name: "添加关键词" }).click();
  await round.getByRole("button", { name: "删除关键词 临时关键词" }).click();
  await round.getByLabel("新增关键词").fill("自定义");
  await round.getByRole("button", { name: "添加关键词" }).click();
  await round.getByLabel("分析要求").fill("只列出技术参数、来源位置和待确认项。");

  await round.locator("label.file-command", { hasText: "上传模板" }).locator("input[type=file]").setInputFiles({ name: "分析模板.md", mimeType: "text/markdown", buffer: Buffer.from("# 技术参数\n\n# 来源\n\n# 待确认项") });
  await round.locator(".template-source-list > div > button:first-child").click();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("输出格式不匹配");
    await dialog.accept();
  });
  await round.getByLabel("分析结果文件格式").selectOption("pptx");
  await expect(round.getByLabel("分析结果文件格式")).toHaveValue("");
  await round.getByLabel("分析结果文件格式").selectOption("md");

  await page.route("http://127.0.0.1:9011/v1/chat/completions", async (route) => {
    const request = route.request().postDataJSON() as { messages: Array<{ content: string }> };
    const prompt = request.messages[1].content;
    expect(prompt).toContain("额定负载 5 kg");
    expect(prompt).not.toContain("这段内容不应出现在分析请求中");
    expect(prompt).toContain("技术参数");
    expect(prompt).toContain("自定义");
    expect(prompt).toContain("只列出技术参数、来源位置和待确认项");
    expect(prompt).toContain("# 待确认项");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: "# 技术参数\n\n- 额定负载：5 kg（客户技术要求.txt，行 1）\n\n# 待确认项\n\n- 交付时间" } }] }) });
  });
  await round.getByRole("button", { name: "需求分析" }).click();
  await expect(round.getByText("技术参数+自定义分析结果", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => ((window as typeof window & { __analysisWrites?: string[] }).__analysisWrites || [])
    .some((path) => /客户需求项目\/projects\/solution-\d{4}-\d{2}-\d{2}\/outputs\/售前阶段-第1次沟通-分析要求\/技术参数\+自定义分析结果\.md$/.test(path))))
    .toBe(true);

  await round.getByLabel("分析要求").fill("新的临时要求");
  await round.locator(".analysis-result-list article > div > button:first-child").click();
  await expect(round.getByLabel("分析要求")).toHaveValue("只列出技术参数、来源位置和待确认项。");
  await expect(round.getByRole("button", { name: /打开文件 · 技术参数\+自定义分析结果\.md/ })).toBeVisible();
  await round.getByRole("button", { name: "删除分析结果 技术参数+自定义分析结果" }).click();
  await expect(round.getByText("技术参数+自定义分析结果", { exact: true })).toHaveCount(0);
});

test("requires a callable model before generating a response file", async ({ page }) => {
  const workbenchUrl = page.url();
  await page.getByRole("button", { name: "新增执行项" }).click();
  let action = page.locator(".round-action-row").first();
  await action.getByLabel("响应文件名称").fill("待生成响应");
  await action.getByLabel("响应文件格式").selectOption("docx");
  await action.locator('input[type="checkbox"]').check();
  await action.getByRole("button", { name: "生成文件" }).click();
  const modelChoice = page.getByRole("alertdialog");
  await expect(modelChoice.getByRole("heading")).toHaveText("未配置大模型，请前往配置。");
  await modelChoice.getByRole("button", { name: "是，前往配置" }).click();
  await expect(page).toHaveURL(/\/model-settings\?return=/);

  await page.getByRole("button", { name: "本机或内网接口" }).click();
  await page.getByLabel("Chat Completions 接口地址").fill("http://127.0.0.1:9012/v1/chat/completions");
  await page.getByLabel("模型名称").fill("response-model");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page).toHaveURL(workbenchUrl);

  action = page.locator(".round-action-row").first();
  await expect(action.getByLabel("响应文件名称")).toHaveValue("待生成响应");
  await expect(action.getByLabel("响应文件格式")).toHaveValue("docx");
  await expect(action.locator('input[type="checkbox"]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("cavwic-lab-model-action-return"))).toBeNull();
});

test("batch-generates separate tasks and files only for checked response items", async ({ page }) => {
  await page.evaluate(() => {
    const writes: string[] = [];
    class TaskDirectory {
      name = "任务输出";
      async queryPermission() { return "granted" as PermissionState; }
      async requestPermission() { return "granted" as PermissionState; }
      async getDirectoryHandle() { return this; }
      async getFileHandle(name: string) {
        return {
          async getFile() { return new File([], name); },
          async createWritable() { return { async write() { writes.push(name); }, async close() {} }; },
        };
      }
    }
    (window as typeof window & { __taskWrites?: string[] }).__taskWrites = writes;
    const directory = new TaskDirectory();
    window.showDirectoryPicker = async () => directory as never;
  });

  const round = page.locator(".presales-round").first();
  for (const [index, name] of ["响应文件一", "响应文件二", "响应文件三"].entries()) {
    await round.getByRole("button", { name: "新增执行项" }).click();
    const action = round.locator(".round-action-row").nth(index);
    await action.getByLabel("响应文件名称").fill(name);
    await action.getByLabel("响应文件格式").selectOption("md");
    await action.getByLabel("文件要求").fill(`生成${name}`);
  }
  await round.getByLabel("选择响应文件 响应文件一").check();
  await round.getByLabel("选择响应文件 响应文件三").check();

  await expect(round.getByRole("button", { name: "生成任务", exact: true })).toHaveCount(0);
  await expect(round.getByRole("button", { name: "批量生成任务" })).toHaveCount(0);
  await round.getByRole("button", { name: "批量生成文件" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "否，输出任务" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __taskWrites?: string[] }).__taskWrites || [])).toHaveLength(2);
  const taskNames = await page.evaluate(() => (window as typeof window & { __taskWrites?: string[] }).__taskWrites || []);
  expect(taskNames.some((name) => name.includes("响应文件一"))).toBe(true);
  expect(taskNames.some((name) => name.includes("响应文件三"))).toBe(true);
  expect(taskNames.some((name) => name.includes("响应文件二"))).toBe(false);

  await page.getByRole("link", { name: /模型配置/ }).click();
  await page.getByRole("button", { name: "本机或内网接口" }).click();
  await page.getByLabel("Chat Completions 接口地址").fill("http://127.0.0.1:9001/v1/chat/completions");
  await page.getByLabel("模型名称").fill("batch-test-model");
  await page.getByRole("button", { name: "保存配置" }).click();
  await page.getByRole("link", { name: "返回工作台" }).click();
  await round.getByLabel("选择响应文件 响应文件一").check();
  await round.getByLabel("选择响应文件 响应文件三").check();

  let requestCount = 0;
  await page.route("http://127.0.0.1:9001/v1/chat/completions", async (route) => {
    requestCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: `# 批量响应 ${requestCount}` } }] }) });
  });
  let confirmations = 0;
  page.once("dialog", async (dialog) => {
    confirmations += 1;
    expect(dialog.message()).toBe("是否使用模型生成该文件？");
    await dialog.accept();
  });
  await round.getByRole("button", { name: "批量生成文件" }).click();
  await expect.poll(() => requestCount).toBe(2);
  expect(confirmations).toBe(1);
  await expect(round.getByRole("button", { name: /响应文件一\.md/ })).toBeVisible();
  await expect(round.getByRole("button", { name: /响应文件三\.md/ })).toBeVisible();
  await expect(round.getByRole("button", { name: /响应文件二\.md/ })).toHaveCount(0);
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

  await page.getByRole("button", { name: "新增执行项" }).click();
  const taskAction = page.locator(".round-action-row").first();
  await taskAction.getByLabel("响应文件名称").fill("项目响应任务");
  await taskAction.getByLabel("响应文件格式").selectOption("md");
  await taskAction.getByRole("button", { name: "生成文件" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "否，输出任务" }).click();
  await expect.poll(() => page.evaluate(() => ((window as typeof window & { __workspaceWrites?: string[] }).__workspaceWrites || [])
    .some((path) => /客户项目\/presales-.+\.md$/.test(path))))
    .toBe(true);

  await page.getByRole("button", { name: "招标" }).click();
  await page.locator('#tender-files input[type="file"]').setInputFiles({ name: "tender.txt", mimeType: "text/plain", buffer: Buffer.from("The system shall retain audit logs and provide an acceptance plan.") });
  await expect.poll(() => page.evaluate(() => ((window as typeof window & { __workspaceWrites?: string[] }).__workspaceWrites || [])
    .some((path) => /客户项目\/projects\/solution-\d{4}-\d{2}-\d{2}\/sources\/tender\.txt$/.test(path))))
    .toBe(true);

  await page.getByRole("button", { name: "输出与 Skills" }).click();
  await page.locator(".format-grid button").filter({ hasText: "Markdown" }).click();
  await expect.poll(() => page.evaluate(() => ((window as typeof window & { __workspaceWrites?: string[] }).__workspaceWrites || [])
    .some((path) => /客户项目\/projects\/solution-\d{4}-\d{2}-\d{2}\/outputs\/[^/]+\.md$/.test(path))))
    .toBe(true);
});
