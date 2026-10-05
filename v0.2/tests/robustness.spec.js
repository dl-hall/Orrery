const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { openApp, card, state, data } = require('./helpers');
const { APP: APP_FILE, D3, BLOCK, sameText, version } = require('./embed-d3');

/* ── d3 is embedded ── */

test('the page carries d3 itself, byte for byte the version in node_modules', () => {
  const m = BLOCK.exec(fs.readFileSync(APP_FILE, 'utf8'));
  expect(m).toBeTruthy();
  expect(sameText(m[1], fs.readFileSync(D3, 'utf8'))).toBe(true);
  expect(m[1]).toContain(`d3js.org v${version}`);
});

test('the app works with no access to a CDN', async ({ page }) => {
  const asked = [];
  await page.route('**/cdn.jsdelivr.net/**', r => { asked.push(r.request().url()); return r.abort(); });
  await openApp(page);
  expect(await page.evaluate(() => d3.version)).toBe(version);
  await expect(card(page, 'rol-scientist')).toBeVisible();
  expect(asked).toEqual([]);
});
