const { test, expect } = require('@playwright/test');
const { openApp, card, state, data, center } = require('./helpers');

const zoomK = (page) => page.evaluate(() => d3.zoomTransform(document.getElementById('stage')).k);

test('clicking a node selects it and fills the panel', async ({ page }) => {
  await openApp(page);
  await card(page, 'rol-system-engineer').click();
  expect((await state(page)).sel).toBe('rol-system-engineer');
  await expect(card(page, 'rol-system-engineer')).toHaveClass(/selected/);
  const panel = page.locator('#detail');
  await expect(panel.locator('.head .name')).toHaveText('System Engineer');
  await expect(panel.locator('.head')).toContainText('Design');
  await expect(panel.locator('[data-section="processes"] .row')).toHaveCount(3);
  await expect(panel.locator('[data-section="meetings"] .row')).toContainText('Chair');
  await expect(panel.locator('[data-section="documents"] .row')).toHaveCount(4);
  // Clicking empty canvas clears the selection.
  await page.mouse.click(700, 860);
  expect((await state(page)).sel).toBeNull();
});

test('panel links navigate to the linked item', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.select('rol-system-engineer'));
  await page.locator('#detail [data-section="processes"] .row[data-id="pro-early-product-design"] .tile').click();
  await expect(page.locator('#detail .head .name')).toHaveText('Early product design');
  await expect(page.locator('#detail [data-section="roles"] .note').first()).toBeVisible();
});

test('RACI notes show as a tooltip in the role panel', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.select('rol-system-engineer'));
  await page.hover('#detail [data-section="processes"] .row[data-id="pro-early-product-design"] .raci');
  await expect(page.locator('#tooltip')).toHaveClass(/show/);
  await expect(page.locator('#tooltip')).toContainText('Responsible for convening Quarterly product design review');
});

test('hovering a node dims everything it is not connected to', async ({ page }) => {
  await openApp(page);
  await card(page, 'pro-product-marketing-announcement').hover();
  await expect(card(page, 'rol-scientist').locator('.body')).toHaveClass(/dim/);
  await expect(card(page, 'rol-market-analyst').locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, 'rol-system-engineer').locator('.body')).not.toHaveClass(/dim/);
  await expect(page.locator('#stage .edges line[data-process="pro-early-product-design"]').first()).toHaveClass(/dim/);
  await expect(page.locator('#stage .edges line.lit')).toHaveCount(4);
  await page.mouse.move(700, 880);
  await expect(page.locator('#stage .body.dim')).toHaveCount(0);
});

test('dragging a role pins it; Reset view releases it', async ({ page }) => {
  await openApp(page);
  const c = card(page, 'rol-scientist');
  const from = await center(c);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 40, { steps: 5 });
  await page.mouse.move(from.x + 140, from.y + 90, { steps: 5 });
  await page.mouse.up();
  const d = await data(page);
  expect(d.layout['rol-scientist']).toBeTruthy();
  expect((await state(page)).dirty).toBe(true);
  await expect(c.locator('.pin')).toHaveCount(1);
  const after = await center(c);
  expect(Math.hypot(after.x - from.x - 140, after.y - from.y - 90)).toBeLessThan(6);
  expect((await state(page)).sel).toBeNull(); // a drag is not a click
  await page.click('#sub-toggle');
  await page.click('#btn-reset');
  expect((await data(page)).layout).toEqual({});
  await expect(page.locator('#stage .pin')).toHaveCount(0);
});

test('zoom buttons appear near the bottom middle and zoom', async ({ page }) => {
  await openApp(page);
  await page.mouse.move(800, 400);
  await expect(page.locator('#zoomctl')).not.toHaveClass(/show/);
  await page.mouse.move(800, 880);
  await expect(page.locator('#zoomctl')).toHaveClass(/show/);
  const k0 = await zoomK(page);
  await page.click('#btn-zoom-in');
  await expect.poll(() => zoomK(page)).toBeGreaterThan(k0 * 1.2);
});

test('mouse wheel zooms and empty-space drag pans', async ({ page }) => {
  await openApp(page);
  const k0 = await zoomK(page);
  await page.mouse.move(700, 850);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => zoomK(page)).toBeGreaterThan(k0);
  const t0 = await page.evaluate(() => d3.zoomTransform(document.getElementById('stage')).x);
  await page.mouse.move(700, 860);
  await page.mouse.down();
  await page.mouse.move(800, 860, { steps: 5 });
  await page.mouse.up();
  const t1 = await page.evaluate(() => d3.zoomTransform(document.getElementById('stage')).x);
  expect(t1 - t0).toBeGreaterThan(80);
});

test('search reveals at the top and highlights matches', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#search')).not.toHaveClass(/show/);
  await page.mouse.move(800, 20);
  await expect(page.locator('#search')).toHaveClass(/show/);
  await page.fill('#search-input', 'market');
  await expect(card(page, 'rol-market-analyst').locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, 'rol-marketing-manager').locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, 'rol-scientist').locator('.body')).toHaveClass(/dim/);
  // Meeting names match too, lighting up the process they belong to.
  await page.fill('#search-input', 'quarterly');
  await expect(card(page, 'pro-early-product-design').locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, 'pro-product-marketing-announcement').locator('.body')).toHaveClass(/dim/);
  await page.press('#search-input', 'Escape');
  await expect(page.locator('#stage .body.dim')).toHaveCount(0);
});

test('Ctrl+F opens search', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Control+f');
  await expect(page.locator('#search-input')).toBeFocused();
  await expect(page.locator('#search')).toHaveClass(/show/);
});

test('selecting a meeting highlights its processes and roles', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.select('mtg-quarterly-design-review'));
  await expect(card(page, 'pro-early-product-design').locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, 'rol-market-analyst').locator('.body')).toHaveClass(/dim/);
  await expect(card(page, 'rol-scientist').locator('.body')).not.toHaveClass(/dim/);
});

test('legend hover highlights a department', async ({ page }) => {
  await openApp(page);
  await page.hover('#legend li[data-dept="dep-marketing"]');
  await expect(card(page, 'rol-market-analyst').locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, 'rol-system-engineer').locator('.body')).toHaveClass(/dim/);
});

test('the "more on hover" dot on RACI tags is not the brass "unsaved" colour', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.select('rol-system-engineer'));
  const c = await page.evaluate(() => {
    const el = document.querySelector('#detail .raci.has-note');
    const probe = (v) => { const s = document.createElement('span'); s.style.color = `var(${v})`; document.body.append(s); const x = getComputedStyle(s).color; s.remove(); return x; };
    return { dot: getComputedStyle(el, '::after').backgroundColor, info: probe('--info'), brass: probe('--brass') };
  });
  expect(c.dot).toBe(c.info);
  expect(c.dot).not.toBe(c.brass);
});
