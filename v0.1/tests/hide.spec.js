const { test, expect } = require('@playwright/test');
const { openApp, card, state, data } = require('./helpers');

const RESEARCH = ['rol-research-manager', 'rol-scientist', 'rol-project-lead'];
const row = (page, dep) => page.locator(`#legend li[data-dept="${dep}"]`);
const cards = (page) => page.locator('#stage g.card');
const edges = (page) => page.locator('#stage .edges line');
const shape = (page, id, kind) => card(page, id, kind).locator('.shape');

async function expectDot(page, id) {
  await expect(card(page, id)).toHaveClass(/\bcollapsed\b/);
  await expect(shape(page, id)).toHaveAttribute('width', '18');
  await expect(shape(page, id)).toHaveAttribute('height', '18');
  await expect(card(page, id).locator('text')).toHaveCount(0);
}
async function expectFullCard(page, id, kind) {
  await expect(card(page, id, kind)).not.toHaveClass(/\bcollapsed\b/);
  await expect(card(page, id, kind).locator('text.label')).toHaveCount(1);
  expect(Number(await shape(page, id, kind).getAttribute('width'))).toBeGreaterThan(18);
}

test('clicking a department in the legend collapses its roles to coloured dots, keeping their edges', async ({ page }) => {
  await openApp(page);
  await row(page, 'dep-research').click();
  expect((await state(page)).hidden).toEqual(['dep-research']);
  for (const id of RESEARCH) await expectDot(page, id);
  await expect(shape(page, 'rol-scientist')).toHaveAttribute('fill', '#86397A');
  await expectFullCard(page, 'rol-system-engineer');
  await expect(cards(page)).toHaveCount(10);
  await expect(edges(page)).toHaveCount(10);
  await expect(row(page, 'dep-research')).toHaveClass(/hidden-dept/);
  await expect(row(page, 'dep-research').locator('.eye')).toHaveAttribute('aria-pressed', 'true');

  // Clicking again restores the full cards.
  await row(page, 'dep-research').click();
  expect((await state(page)).hidden).toEqual([]);
  for (const id of RESEARCH) await expectFullCard(page, id);
  await expect(row(page, 'dep-research')).not.toHaveClass(/hidden-dept/);
});

test('hiding is a view setting: no undo step, not dirty, nothing added to the data', async ({ page }) => {
  await openApp(page);
  const before = await data(page);
  await row(page, 'dep-design').click();
  const st = await state(page);
  expect(st.dirty).toBe(false);
  expect(st.undo).toBe(0);
  expect(await data(page)).toEqual(before);
});

test('table views are unaffected', async ({ page }) => {
  await openApp(page);
  const sizes = async () => {
    const out = {};
    for (const v of ['process', 'role', 'meeting']) {
      await page.evaluate(v => window.orrery.setView(v), v);
      await page.waitForFunction(() => !window.orrery.state().morphing);   // let exiting cards finish leaving
      out[v] = await page.locator('#stage g.card').evaluateAll(els => els.map(e => {
        const s = e.querySelector('.shape');
        return [e.dataset.key, s.getAttribute('width'), s.getAttribute('height'), e.querySelector('text.label')?.textContent || '', e.classList.contains('collapsed')];
      }).sort());
    }
    await page.evaluate(() => window.orrery.setView('graph'));
    return out;
  };
  const baseline = await sizes();
  await row(page, 'dep-research').click();
  await row(page, 'dep-design').click();
  expect(await sizes()).toEqual(baseline);
});

test('focus mode shows collapsed roles as full cards', async ({ page }) => {
  await openApp(page);
  await row(page, 'dep-research').click();
  await expectDot(page, 'rol-scientist');
  await page.evaluate(() => window.orrery.focus('pro-early-product-design'));
  await expect(cards(page)).toHaveCount(7);
  for (const id of RESEARCH) await expectFullCard(page, id);
  await page.click('#btn-unfocus');
  for (const id of RESEARCH) await expectDot(page, id);
});

test('a dot can still be selected', async ({ page }) => {
  await openApp(page);
  await row(page, 'dep-marketing').click();
  await expectDot(page, 'rol-market-analyst');
  await card(page, 'rol-market-analyst').click();
  expect((await state(page)).sel).toBe('rol-market-analyst');
});

test('edit mode: the eye button toggles; the swatch still opens the palette', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.edit(true));
  await row(page, 'dep-research').locator('.swatch').click();
  await expect(page.locator('#menu .palette')).toBeVisible();
  expect((await state(page)).hidden).toEqual([]);
  await page.keyboard.press('Escape');
  await row(page, 'dep-research').hover();
  await row(page, 'dep-research').locator('.eye').click();
  expect((await state(page)).hidden).toEqual(['dep-research']);
  await expectDot(page, 'rol-scientist');
});

test('loading a file clears hidden departments', async ({ page }) => {
  await openApp(page);
  await row(page, 'dep-research').click();
  await page.evaluate(() => window.orrery.loadExample());
  expect((await state(page)).hidden).toEqual([]);
  await expectFullCard(page, 'rol-scientist');
});
