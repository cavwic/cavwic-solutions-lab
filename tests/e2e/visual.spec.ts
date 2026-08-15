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
  await page.getByRole("button", { name: /招标要求/ }).click();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "切换到深色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "技术标组包" }).click();
  await expect(page.getByText("文件包登记")).toBeVisible();
  await expect(page.getByText("技术方案", { exact: true }).last()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("bid-package-dark-zh.png"), fullPage: true });
  await page.getByRole("button", { name: "招标要求" }).click();
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Solution Project Workbench");
  await expect(page.getByText("SOURCE / TRACEABILITY")).toBeVisible();
  await expect(page.getByRole("link", { name: "招标要求 / Tender requirements" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("requirements-dark-en.png"), fullPage: true });
});

test("presales communication workspace remains readable", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("cavwic-lab-locale", "zh");
    localStorage.setItem("cavwic-lab-theme", "light");
  });
  await page.reload();
  await page.locator(".model-settings summary").click();
  await expect(page.getByRole("heading", { name: "客户沟通与文件响应" })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成本轮文件" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("presales-rounds-zh.png"), fullPage: true });
});
