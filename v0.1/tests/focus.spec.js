const { test, expect } = require('@playwright/test');
const { openApp, card, state, center } = require('./helpers');

const cards = (page) => page.locator('#stage g.card');
const edges = (page) => page.locator('#stage .edges line');
const at = (page, id) => card(page, id).getAttribute('transform');

async function focusSE(page) {
  await card(page, 'rol-system-engineer').dblclick();
  await expect(cards(page)).toHaveCount(3);
}
async function expectFull(page) {
  await expect(cards(page)).toHaveCount(10);
  await expect(edges(page)).toHaveCount(10);
  await expect(page.locator('#focusbar')).toBeHidden();
  expect((await state(page)).focus).toBe(null);
}

test('double-click focuses a node: it sits at the centre with only its connections', async ({ page }) => {
  await openApp(page);
  await focusSE(page);
  const st = await state(page);
  expect(st.focus).toBe('rol-system-engineer');
  expect(st.sel).toBe('rol-system-engineer');
  await expect(card(page, 'pro-early-product-design')).toBeVisible();
  await expect(card(page, 'pro-product-marketing-announcement')).toBeVisible();
  await expect(edges(page)).toHaveCount(2);
  expect(await at(page, 'rol-system-engineer')).toMatch(/^translate\(0,\s?0\)$/);
  await expect(page.locator('#focusbar')).toBeVisible();
  await expect(page.locator('#focusbar .fname')).toHaveText('System Engineer');

  // Double-clicking a neighbour re-focuses there.
  await card(page, 'pro-product-marketing-announcement').dblclick();
  await expect(cards(page)).toHaveCount(5);
  expect((await state(page)).focus).toBe('pro-product-marketing-announcement');
  expect(await at(page, 'pro-product-marketing-announcement')).toMatch(/^translate\(0,\s?0\)$/);
});

test('nodes can’t be dragged while focused', async ({ page }) => {
  await openApp(page);
  await focusSE(page);
  const from = await center(card(page, 'pro-early-product-design'));
  const before = await at(page, 'pro-early-product-design');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y + 80, { steps: 6 });
  await page.mouse.up();
  expect(await at(page, 'pro-early-product-design')).toBe(before);
  expect((await page.evaluate(() => window.orrery.data())).layout).toEqual({});
});

test('the focus bar button leaves focus', async ({ page }) => {
  await openApp(page);
  await focusSE(page);
  await page.click('#btn-unfocus');
  await expectFull(page);
});

test('key 1 leaves focus', async ({ page }) => {
  await openApp(page);
  await focusSE(page);
  await page.keyboard.press('1');
  await expectFull(page);
});

test('Graph in the view menu leaves focus', async ({ page }) => {
  await openApp(page);
  await focusSE(page);
  await page.click('#btn-view');
  await page.getByRole('menuitemradio', { name: /Graph/ }).click();
  await expectFull(page);
});

test('Esc leaves focus before it clears the selection', async ({ page }) => {
  await openApp(page);
  await focusSE(page);
  await page.keyboard.press('Escape');
  await expectFull(page);
  expect((await state(page)).sel).toBe('rol-system-engineer');
});

test('Back leaves focus, Forward returns to it', async ({ page }) => {
  await openApp(page);
  await focusSE(page);
  await page.keyboard.press('Alt+ArrowLeft');
  await expectFull(page);
  await page.keyboard.press('Alt+ArrowRight');
  await expect(cards(page)).toHaveCount(3);
  expect((await state(page)).focus).toBe('rol-system-engineer');
});

test('switching to a table clears focus', async ({ page }) => {
  await openApp(page);
  await focusSE(page);
  await page.keyboard.press('2');
  expect((await state(page)).focus).toBe(null);
  await page.keyboard.press('1');
  await expectFull(page);
});
