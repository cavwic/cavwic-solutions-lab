import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(overflow.page, `page width ${overflow.page} exceeded viewport ${overflow.viewport}`).toBeLessThanOrEqual(overflow.viewport + 1);
}

test("workbench remains stable across lifecycle pages", async ({ page }, testInfo) => {
  for (const path of ["/", "/requirements", "/bid-package"]) {
    await page.goto(path);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator(".solution-app")).toHaveAttribute("data-ready", "true");
    await expectNoHorizontalOverflow(page);
  }
  await page.screenshot({ path: testInfo.outputPath("solution-workbench-light.png"), fullPage: true });
});

test("theme and language controls preserve a dense responsive layout", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("cavwic-lab-locale", "zh");
    localStorage.setItem("cavwic-lab-theme", "light");
  });
  await page.reload();
  await page.getByRole("button", { name: /招标/ }).click();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "切换到深色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "技术标组包" }).click();
  await expect(page.getByText("文件包登记")).toBeVisible();
  await expect(page.getByText("技术方案", { exact: true }).last()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("bid-package-dark-zh.png"), fullPage: true });
  await page.getByRole("button", { name: "招标" }).click();
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Solution Project Workbench");
  await expect(page.getByText("TENDER INPUT / PREPROCESSING")).toBeVisible();
  await expect(page.getByRole("link", { name: "模型配置 / Model configuration" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("requirements-dark-en.png"), fullPage: true });
});

test("tender preprocessing and clarification workspace stays readable", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("cavwic-lab-locale", "zh");
    localStorage.setItem("cavwic-lab-theme", "light");
  });
  await page.reload();
  await page.getByRole("button", { name: "招标" }).click();
  await page.locator('#tender-files input[type="file"]').setInputFiles([
    { name: "正式招标文件-技术与验收要求.txt", mimeType: "text/plain", buffer: Buffer.from("投标人应提交技术方案、部署手册、验收方案及完整进度计划。") },
    { name: "扫描版资格证明附件.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) },
  ]);
  await page.locator("#tender-files .tender-file-toolbar").getByRole("button", { name: "预处理" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "否" }).click();
  await page.getByRole("button", { name: "新增澄清节点" }).click();
  const clarification = page.locator(".clarification-row").first();
  await clarification.getByLabel("澄清节点名称").fill("第一次澄清及补遗");
  await clarification.locator("label.file-command", { hasText: "导入澄清文件" }).locator("input[type=file]").setInputFiles({ name: "交付周期澄清.txt", mimeType: "text/plain", buffer: Buffer.from("交付周期最终调整为 60 天，以本澄清文件为准。") });
  await page.getByRole("button", { name: "技术参数", exact: true }).click();
  await page.getByLabel("招标分析要求").fill("提取投标时间、技术参数、评标办法、资质和文件清单，保留来源位置。");
  await page.getByLabel("招标分析文件格式").selectOption("md");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("tender-workspace-zh.png"), fullPage: true });
});

test("presales communication workspace remains readable", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("cavwic-lab-locale", "zh");
    localStorage.setItem("cavwic-lab-theme", "light");
  });
  await page.reload();
  await page.getByRole("button", { name: "新增执行项" }).click();
  const round = page.locator(".presales-round").first();
  const node = round.locator(".round-node");
  await node.getByRole("textbox", { name: "参会人员", exact: true }).fill("客户项目经理");
  await node.getByRole("button", { name: "新增参会人员" }).click();
  await node.getByLabel("参会人员类别").selectOption("internal");
  await node.getByRole("textbox", { name: "参会人员", exact: true }).fill("解决方案负责人");
  await node.getByRole("button", { name: "新增参会人员" }).click();
  await round.locator("label.file-command", { hasText: "导入客户附件" }).locator("input[type=file]").setInputFiles({ name: "客户技术要求.txt", mimeType: "text/plain", buffer: Buffer.from("额定负载 5 kg。") });
  await round.getByRole("button", { name: "技术参数", exact: true }).click();
  await round.getByLabel("分析要求").fill("提取参数并保留来源位置。");
  await round.locator(".round-needs label.file-command", { hasText: "上传模板" }).locator("input[type=file]").setInputFiles({ name: "分析模板.md", mimeType: "text/markdown", buffer: Buffer.from("# 技术参数\n# 来源") });
  await round.locator(".round-needs .template-source-list > div > button:first-child").click();
  await round.getByLabel("分析结果文件格式").selectOption("md");
  const action = round.locator(".round-action-row").first();
  await action.getByLabel("响应文件名称").fill("本轮客户响应");
  await action.getByLabel("响应文件格式").selectOption("md");
  await action.getByLabel("截止时间").fill("2026-09-01");
  await action.locator("label.file-command", { hasText: "上传模板" }).locator("input[type=file]").setInputFiles({ name: "响应模板.md", mimeType: "text/markdown", buffer: Buffer.from("# 需求理解\n# 响应方案\n# 待确认边界") });
  await action.locator(".template-source-list > div > button:first-child").click();
  await expect(page.getByRole("heading", { name: "客户沟通与文件响应" })).toBeVisible();
  await expect(page.getByLabel("响应文件格式")).toBeVisible();
  await expect(page.getByLabel("截止时间")).toBeVisible();
  await expect(action.getByText("响应模板.md", { exact: true })).toBeVisible();
  await expect(page.getByLabel("文件要求")).toBeVisible();
  await expect(page.getByRole("button", { name: "生成任务", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "生成文件", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "批量生成任务" })).toHaveCount(0);
  await page.getByRole("button", { name: "生成文件", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").screenshot({ path: testInfo.outputPath("model-action-choice-zh.png") });
  await page.getByRole("alertdialog").getByRole("button", { name: "否，输出任务" }).click();
  await expectNoHorizontalOverflow(page);
  await node.screenshot({ path: testInfo.outputPath("communication-participants-zh.png") });
  await round.locator(".round-needs").screenshot({ path: testInfo.outputPath("customer-analysis-config-zh.png") });
  await page.locator(".round-action-row").first().screenshot({ path: testInfo.outputPath("presales-action-fields-zh.png") });
  await page.screenshot({ path: testInfo.outputPath("presales-rounds-zh.png"), fullPage: true });
});

test("global model settings remain readable in both viewports", async ({ page }, testInfo) => {
  await page.goto("/model-settings");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("cavwic-lab-locale", "zh");
    localStorage.setItem("cavwic-lab-theme", "light");
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "模型配置" })).toBeVisible();
  await expect(page.getByText("使用当前 Codex 套餐")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("model-settings-codex-zh.png"), fullPage: true });
});
