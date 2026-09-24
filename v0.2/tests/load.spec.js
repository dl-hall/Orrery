const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { openApp, card, data, FIXTURES, EXAMPLE_FILE } = require('./helpers');

test('example renders 8 roles, 4 processes, 16 links and 4 flows', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#stage g.card[data-type="role"][data-kind="node"]')).toHaveCount(8);
  await expect(page.locator('#stage g.card[data-type="process"][data-kind="node"]')).toHaveCount(4);
  await expect(page.locator('#stage .edges line')).toHaveCount(16);
  await expect(page.locator('#stage g.flow')).toHaveCount(4);
  await expect(page.locator('#legend li[data-dept]')).toHaveText([/Research\s*3/, /Design\s*3/, /Marketing\s*2/]);
  // Processes with meetings/documents carry badges.
  await expect(card(page, 'pro-early-product-design').locator('.badge')).toHaveCount(2);
  await expect(card(page, 'pro-product-marketing-announcement').locator('.badge')).toHaveCount(1);
});

test('embedded example matches examples/product-org.json', async ({ page }) => {
  await openApp(page);
  const embedded = await page.evaluate(() => window.orrery.example());
  expect(embedded).toEqual(JSON.parse(fs.readFileSync(EXAMPLE_FILE, 'utf8')));
});

test('an empty file opens as an empty organisation', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#file-input', path.join(FIXTURES, 'minimal.json'));
  await expect(page.locator('#stage g.card')).toHaveCount(0);
  await expect(page.locator('#empty')).toBeVisible();
  await expect(page.locator('#empty')).toContainText('Open file');
  await expect(page.locator('#legend')).toContainText('No departments');
  const d = await data(page);
  expect(d).toMatchObject({ orrery: '0.2', roles: [], processes: [], meetings: [], documents: [], flows: [], departments: [], layout: {} });
});

test('malformed JSON shows an error and keeps the current data', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#file-input', path.join(FIXTURES, 'malformed.json'));
  await expect(page.locator('#toast')).toHaveClass(/error/);
  await expect(page.locator('#toast')).toContainText(/isn’t valid JSON \(line \d+\)\. Nothing was changed\./);
  expect((await data(page)).roles).toHaveLength(8);
});

test('dangling references are dropped and reported; unknown fields survive', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#file-input', path.join(FIXTURES, 'dangling-refs.json'));
  await expect(page.locator('#toast')).toContainText('Removed 4 links');
  const d = await data(page);
  expect(d.roles.find(r => r.id === 'rol-2').department).toBeNull();
  expect(d.processes[0].roles).toEqual([{ role: 'rol-1', raci: ['R'], note: '' }]);
  expect(d.processes[0].meetings).toEqual([]);
  expect(d.documents[0].owners).toEqual(['rol-1']);
  expect(d.customField).toEqual({ kept: true });
  await expect(page.locator('#legend li[data-dept="__none"]')).toContainText('Unassigned');
  await expect(card(page, 'rol-2').locator('.shape')).toHaveAttribute('fill', 'url(#hatch)');
});

test('large organisation (150 roles, 40 processes) lays out in under 3 s', async ({ page }) => {
  await openApp(page, { example: false });
  const json = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'large.json'), 'utf8'));
  const ms = await page.evaluate((j) => { const t = performance.now(); window.orrery.load(j); return performance.now() - t; }, json);
  expect(ms).toBeLessThan(3000);
  await expect(page.locator('#stage g.card[data-kind="node"]')).toHaveCount(190);
});
