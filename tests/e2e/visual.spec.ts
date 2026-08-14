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
    await page.getByRole("button", { name: /载入示例 \/ AI|Load sample \/ AI/ }).click();
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
  await page.getByRole("button", { name: /载入示例 \/ AI/ }).click();
  await page.getByRole("button", { name: /招标要求/ }).click();
  await expectNoHorizontalOverflow(page);

  await page.locator('.workspace-toolbar button[title="Dark mode"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Solution Project Workbench");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("requirements-dark-en.png"), fullPage: true });
});
