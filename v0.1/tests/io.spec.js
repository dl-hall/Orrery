const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { openApp, card, state, data, center } = require('./helpers');

test('save downloads the model; reopening it reproduces the same model', async ({ page }, testInfo) => {
  await openApp(page);
  // Start from the example plus an unknown field, then edit.
  await page.evaluate(() => window.orrery.load({ ...window.orrery.example(), extra: { source: 'workshop' } }, 'org.json'));
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('rol-scientist'); });
  const name = page.locator('#detail input.name');
  await name.fill('Lead scientist');
  await name.press('Enter');
  // Pin a node by dragging it.
  const from = await center(card(page, 'rol-market-analyst'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 80, from.y + 30, { steps: 6 });
  await page.mouse.up();
  expect((await state(page)).dirty).toBe(true);
  await expect(page.locator('#btn-save .dot')).toHaveCount(1);
  expect(await page.title()).toMatch(/^• /);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-save')]);
  expect(download.suggestedFilename()).toBe('org.json');
  const file = testInfo.outputPath('saved.json');
  await download.saveAs(file);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  const model = await data(page);
  expect(saved).toEqual(model);
  expect(saved.roles.find(r => r.id === 'rol-scientist').name).toBe('Lead scientist');
  expect(saved.layout['rol-market-analyst']).toBeTruthy();
  expect(saved.extra).toEqual({ source: 'workshop' });
  expect(Object.keys(saved).slice(0, 8)).toEqual(['orrery', 'title', 'departments', 'roles', 'processes', 'meetings', 'documents', 'layout']);
  expect((await state(page)).dirty).toBe(false);
  await expect(page.locator('#btn-save .dot')).toHaveCount(0);

  // Reopen in a fresh page.
  const page2 = await page.context().newPage();
  await openApp(page2, { example: false });
  await page2.setInputFiles('#file-input', file);
  expect(await data(page2)).toEqual(saved);
  await expect(card(page2, 'rol-market-analyst').locator('.pin')).toHaveCount(1);
  expect((await state(page2)).fileName).toBe('saved.json');
});

test('Ctrl+S saves', async ({ page }) => {
  await openApp(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  expect(download.suggestedFilename()).toBe('product-organisation.json');
});

test('opening a file with unsaved changes asks first', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('rol-scientist'); });
  await page.locator('#detail textarea.desc').fill('Changed');
  await page.locator('#detail textarea.desc').blur();
  let asked = null;
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.click('#btn-open');
  expect(asked).toContain('unsaved changes');
  expect((await data(page)).roles.find(r => r.id === 'rol-scientist').description).toBe('Changed');
});

test('saving writes back to the opened file when the browser allows it', async ({ page }) => {
  await openApp(page, { pickers: true });
  // Stand-in for the File System Access API: record what gets written.
  await page.evaluate(() => {
    window.__written = null;
    const handle = { name: 'live.json', getFile: async () => new File([JSON.stringify(window.orrery.example())], 'live.json'),
      createWritable: async () => { let buf = ''; return { write: async (t) => { buf += t; }, close: async () => { window.__written = buf; } }; } };
    window.showOpenFilePicker = async () => [handle];
  });
  await page.click('#btn-open');
  await expect.poll(async () => (await state(page)).fileName).toBe('live.json');
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('rol-scientist'); });
  await page.locator('#detail textarea.desc').fill('Written in place');
  await page.locator('#detail textarea.desc').blur();
  await page.click('#btn-save');
  await expect.poll(() => page.evaluate(() => window.__written && JSON.parse(window.__written).roles.find(r => r.id === 'rol-scientist').description)).toBe('Written in place');
  await expect(page.locator('#toast')).toContainText('Saved live.json');
});
