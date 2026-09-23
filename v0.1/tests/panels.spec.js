const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

for (const which of ['toolbar', 'legend', 'detail']) {
  test(`${which} panel collapses and expands`, async ({ page }) => {
    await openApp(page);
    await page.click(`#${which}-collapse`);
    await expect(page.locator(`#${which}`)).toHaveClass(/collapsed/);
    await expect(page.locator(`#${which}`)).toBeHidden();
    await expect(page.locator(`#${which}-open`)).toBeVisible();
    await page.click(`#${which}-open`);
    await expect(page.locator(`#${which}`)).not.toHaveClass(/collapsed/);
    await expect(page.locator(`#${which}-open`)).toBeHidden();
  });
}

test('collapsed panels stay collapsed after reload', async ({ page }) => {
  await openApp(page);
  await page.click('#legend-collapse');
  await page.click('#detail-collapse');
  await page.reload();
  await page.waitForFunction(() => window.orrery);
  await expect(page.locator('#legend')).toHaveClass(/collapsed/);
  await expect(page.locator('#detail')).toHaveClass(/collapsed/);
  await expect(page.locator('#toolbar')).not.toHaveClass(/collapsed/);
});

test('sub-panel opens under the toolbar', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#subpanel')).toBeHidden();
  await page.click('#sub-toggle');
  await expect(page.locator('#subpanel')).toBeVisible();
  await expect(page.locator('#subpanel')).toContainText('Reset view');
  await expect(page.locator('#doc-title')).toHaveValue('Product organisation');
  await expect(page.locator('#doc-title')).toBeDisabled();
  await page.keyboard.press('e');
  await expect(page.locator('#doc-title')).toBeEnabled();
});

test('light/dark toggle applies and persists', async ({ page }) => {
  await openApp(page);
  await page.click('#sub-toggle');
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#btn-theme');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(after).not.toBe(before);
  expect(after).toBe('rgb(18, 22, 28)');
  await page.reload();
  await page.waitForFunction(() => window.orrery);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.click('#btn-theme');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('empty state offers open, example and blank', async ({ page }) => {
  await openApp(page, { example: false });
  await expect(page.locator('#empty')).toBeVisible();
  await page.getByRole('button', { name: 'Load example' }).click();
  await expect(page.locator('#empty')).toBeHidden();
  await expect(page.locator('#stage g.card')).toHaveCount(10);
});
