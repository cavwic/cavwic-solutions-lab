import { expect, test } from "@playwright/test";

const cases = [
  ["ai-poc", "AI-POC"],
  ["robot-poc", "ROBOT-POC"],
  ["dexterous-hand", "HAND-SELECT"],
] as const;

for (const [path, code] of cases) {
  test(`${code} loads a sample and persists edits`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator(".tool-code")).toContainText(code);
    await expect(page.locator('.workbench')).toHaveAttribute('data-ready', 'true');
    await page.getByRole("button", { name: /载入示例|Load sample/ }).click();
    const project = page.locator(".field-grid input").first();
    await expect(project).not.toHaveValue("");
    await project.fill(`${code} QA`);
    await page.waitForTimeout(500);
    await page.reload();
    await expect(project).toHaveValue(`${code} QA`);
    await expect(page.locator(".score-dial strong")).not.toHaveText("0");
  });
}
