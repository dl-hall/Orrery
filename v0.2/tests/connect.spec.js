const { test, expect } = require('./helpers');
const { openApp, card, state, data, center, rightClick, handleDrag, emptySpot } = require('./helpers');

const PR = 'pro-product-roadmap', PMA = 'pro-product-marketing-announcement';
const SCI = 'rol-scientist';
const handle = (page, id) => card(page, id).locator('.link-handle');
const rubberShown = (page) => page.locator('#stage .rubber').evaluate(el => getComputedStyle(el).display !== 'none');
const inPMA = async (page, roleId) => (await data(page)).processes.find(p => p.id === PMA).roles.some(l => l.role === roleId);

test('the connector handle shows on hover or selection in edit mode only, and never in focus mode', async ({ page }) => {
  await openApp(page);
  const at = await center(card(page, SCI));
  await page.mouse.move(at.x, at.y);
  await expect(handle(page, SCI)).toHaveCSS('opacity', '0');
  await page.keyboard.press('e');
  await page.mouse.move(at.x + 1, at.y);
  await expect(handle(page, SCI)).toHaveCSS('opacity', '1');
  // Selection keeps it showing without a hover (a touchpad tap selects first).
  await card(page, SCI).click();
  await page.mouse.move(5, 450);
  await expect(handle(page, SCI)).toHaveCSS('opacity', '1');
  await expect(handle(page, PMA)).toHaveCSS('opacity', '0');
  await page.evaluate(id => window.orrery.focus(id), SCI);
  await expect(handle(page, SCI)).toHaveCSS('opacity', '0');
  await expect(handle(page, SCI)).toHaveCSS('pointer-events', 'none');
});

test('dragging the handle connects a role to a process without moving the card', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  const before = await card(page, SCI).getAttribute('transform');
  await handleDrag(page, card(page, SCI), await center(card(page, PMA)));
  expect(await inPMA(page, SCI)).toBe(true);
  expect(await rubberShown(page)).toBe(false);
  expect((await data(page)).layout).toEqual({});   // the card wasn't dragged (that would pin it)
  await expect(page.locator(`#stage .edges line[data-role="${SCI}"][data-process="${PMA}"]`)).toHaveCount(1);
  expect(before).toBeTruthy();
});

test('dragging the handle from one process to another adds a flow in that direction', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  await handleDrag(page, card(page, PMA), await center(card(page, PR)));
  const d = await data(page);
  expect(d.flows).toHaveLength(5);
  expect(d.flows[4]).toMatchObject({ from: PMA, to: PR });
  expect((await state(page)).sel).toBe(PMA);
  // Role onto role is refused, and the band goes away.
  await handleDrag(page, card(page, SCI), await center(card(page, 'rol-market-analyst')));
  await expect(page.locator('#toast')).toContainText('Roles can’t connect to roles');
  expect(await rubberShown(page)).toBe(false);
});

test('tapping the handle, then clicking another card, connects them', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  await card(page, SCI).click();
  const knob = await center(handle(page, SCI).locator('.knob'));
  await page.mouse.click(knob.x, knob.y);
  expect(await rubberShown(page)).toBe(true);
  await expect(page.locator('#toast')).toContainText('Click a role or process');
  expect((await state(page)).sel).toBe(SCI);
  await card(page, PMA).click();
  expect(await inPMA(page, SCI)).toBe(true);
  expect(await rubberShown(page)).toBe(false);
  expect((await state(page)).sel).toBe(SCI);   // the picking click doesn't select
});

test('Connect to… from the card menu, then a click, connects', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  await rightClick(page, await center(card(page, SCI)));
  await page.getByRole('menuitem', { name: 'Connect to…' }).click();
  const to = await center(card(page, PMA));
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await expect(card(page, PMA)).toHaveClass(/link-target/);
  await page.mouse.click(to.x, to.y);
  expect(await inPMA(page, SCI)).toBe(true);
  expect(await rubberShown(page)).toBe(false);
});

test('C starts a connection from the selected card; Esc, empty canvas and right-click cancel it', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  await card(page, SCI).click();
  for (const cancel of ['esc', 'empty', 'right']) {
    await page.keyboard.press('c');
    expect(await rubberShown(page)).toBe(true);
    const spot = await emptySpot(page);
    if (cancel === 'esc') await page.keyboard.press('Escape');
    if (cancel === 'empty') await page.mouse.click(spot.x, spot.y);
    if (cancel === 'right') await rightClick(page, spot);
    expect(await rubberShown(page)).toBe(false);
    await expect(page.locator('#menu')).toBeHidden();
    expect(await inPMA(page, SCI)).toBe(false);
    expect((await state(page)).sel).toBe(SCI);   // Esc and the cancelling click leave the selection alone
  }
  await page.keyboard.press('c');
  await card(page, PMA).click();
  expect(await inPMA(page, SCI)).toBe(true);
});

test('C explains itself when it can’t connect', async ({ page }) => {
  await openApp(page);
  await card(page, SCI).click();
  await page.keyboard.press('c');
  await expect(page.locator('#toast')).toContainText('Turn on edit mode');
  await page.keyboard.press('e');
  await page.evaluate(() => window.orrery.select(null));
  await page.keyboard.press('c');
  await expect(page.locator('#toast')).toContainText('Select a role or process first');
  await page.evaluate(id => window.orrery.focus(id), SCI);
  await page.keyboard.press('c');
  await expect(page.locator('#toast')).toContainText('outside focus mode');
  expect(await rubberShown(page)).toBe(false);
});

test('double-clicking empty canvas offers New role and New process in edit mode', async ({ page }) => {
  await openApp(page);
  const spot = await emptySpot(page);
  await page.mouse.dblclick(spot.x, spot.y);
  await expect(page.locator('#menu')).toBeHidden();
  await page.keyboard.press('e');
  await page.mouse.dblclick(spot.x, spot.y);
  await expect(page.locator('#menu')).toBeVisible();
  await page.getByRole('menuitem', { name: 'New process…' }).click();
  const d = await data(page);
  expect(d.processes).toHaveLength(5);
  // It lands where the double-click was.
  const box = await card(page, d.processes[4].id).locator('.shape').boundingBox();
  expect(Math.abs(box.x + box.width / 2 - spot.x)).toBeLessThan(4);
  expect(Math.abs(box.y + box.height / 2 - spot.y)).toBeLessThan(4);
});
