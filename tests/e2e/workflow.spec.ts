import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator(".solution-app")).toHaveAttribute("data-ready", "true");
});

test("runs the presales-to-handover project flow and persists edits", async ({ page }) => {
  await page.getByRole("button", { name: /载入示例 \/ AI|Load sample \/ AI/ }).click();
  const projectName = page.locator(".field-grid input").first();
  await expect(projectName).toHaveValue("企业知识助手售前与技术投标");
  await projectName.fill("端到端解决方案项目");

  await page.getByRole("button", { name: /招标要求|Tender requirements/ }).click();
  await expect(page.locator(".source-tabs button")).toHaveCount(2);
  await expect(page.locator(".requirement-index button")).toHaveCount(2);
  await expect(page.locator(".diff-list > div")).toHaveCount(1);

  await page.getByRole("button", { name: /技术标组包|Technical bid pack/ }).click();
  await expect(page.locator(".response-row")).toHaveCount(1);
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
  await page.getByRole("button", { name: /载入示例 \/ AI|Load sample \/ AI/ }).click();
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
    await expect(page.getByText("LEGACY TOOL / RETIRED")).toBeVisible();
    await expect(page.getByRole("link", { name: /解决方案项目工作台/ })).toBeVisible();
  }
});
