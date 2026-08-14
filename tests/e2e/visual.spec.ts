import { expect, test } from "@playwright/test";

const siteUrl = "http://127.0.0.1:4321";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(overflow.page, `page width ${overflow.page} exceeded viewport ${overflow.viewport}`).toBeLessThanOrEqual(overflow.viewport + 1);
}

test("personal site supports locale, theme, long content, and dense data", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === "mobile";
  await page.goto(`${siteUrl}/about`);
  await page.evaluate(() => {
    localStorage.setItem("cavwic-locale", "zh");
    localStorage.setItem("cavwic-theme", "light");
  });
  await page.goto(`${siteUrl}/`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("陈文聪");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("site-home-zh-light.png"), fullPage: true });

  await page.evaluate(() => {
    localStorage.setItem("cavwic-locale", "en");
    localStorage.setItem("cavwic-theme", "dark");
  });
  await page.goto(`${siteUrl}/en`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Chen Wencong");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("site-home-en-dark.png"), fullPage: true });

  await page.goto(`${siteUrl}/library/enterprise-ai-presales-poc`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("企业 AI 售前与 POC");
  await expect(page.locator(".source-list li")).toHaveCount(17);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("site-whitepaper.png"), fullPage: !mobile });

  if (!mobile) {
    await page.goto(`${siteUrl}/matrices/dexterous-hand-selection`);
    await expect(page.locator(".matrix-table tbody tr")).toHaveCount(5);
    await page.screenshot({ path: testInfo.outputPath("site-matrix.png"), fullPage: true });
    await page.goto(`${siteUrl}/glossary`);
    await page.locator("#term-search").fill("触觉");
    await expect(page.locator(".term-row:visible")).not.toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }
});

test("solutions lab has stable responsive workbench dimensions", async ({ page }, testInfo) => {
  for (const slug of ["ai-poc", "robot-poc", "dexterous-hand"]) {
    await page.goto(slug);
    await expect(page.locator(".workbench")).toHaveAttribute("data-ready", "true");
    await expect(page.locator(".score-dial strong")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("dexterous-hand");
  await page.screenshot({ path: testInfo.outputPath("lab-dexterous-hand.png"), fullPage: true });
});
