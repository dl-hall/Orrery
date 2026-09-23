const { test, expect } = require('@playwright/test');
const { openApp, card, state, emptySpot } = require('./helpers');

const inCol = (page, col, extra = '') => page.locator(`#stage g.card[data-col="${col}"]${extra}`);

test('view menu switches between the four views', async ({ page }) => {
  await openApp(page);
  await page.click('#btn-view');
  await expect(page.getByRole('menuitemradio')).toHaveCount(4);
  await expect(page.getByRole('menuitemradio', { name: /Graph/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio', { name: /Role table/ }).click();
  expect((await state(page)).view).toBe('role');
  await page.keyboard.press('1');
  expect((await state(page)).view).toBe('graph');
  await expect(page.locator('#stage .edges line')).toHaveCount(10);
});

test('process table: one column per process with its roles, meetings and documents', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.setView('process'));
  await expect(page.locator('#stage .edges line')).toHaveCount(0);
  await expect(page.locator('#stage g.card[data-kind="header"]')).toHaveCount(2);
  await expect(page.locator('#stage g.card[data-kind="header"][data-type="process"]')).toHaveCount(2);
  const epd = 'pro-early-product-design';
  await expect(inCol(page, epd, '[data-kind="row"][data-type="role"]')).toHaveCount(6);
  await expect(inCol(page, epd, '[data-kind="row"][data-type="meeting"]')).toHaveCount(1);
  await expect(inCol(page, epd, '[data-kind="row"][data-type="document"]')).toHaveCount(2);
  await expect(inCol(page, 'pro-product-marketing-announcement', '[data-kind="row"]')).toHaveCount(5);
  // Roles appear under every process they belong to.
  await expect(page.locator('#stage g.card[data-id="rol-system-engineer"]')).toHaveCount(2);
  // Order in a column: roles, then meetings, then documents.
  const types = await inCol(page, epd, '[data-kind="row"]').evaluateAll(els =>
    els.map(e => ({ t: e.dataset.type, y: e.getBoundingClientRect().y })).sort((a, b) => a.y - b.y).map(x => x.t));
  expect(types).toEqual(['role', 'role', 'role', 'role', 'role', 'role', 'meeting', 'document', 'document']);
});

test('role table: department super-headers, and no roles under roles', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.setView('role'));
  await expect(page.locator('#stage g.card[data-kind="header"][data-type="role"]')).toHaveCount(8);
  await expect(page.locator('#stage .headers g.hdr')).toHaveCount(3);
  await expect(page.locator('#stage .headers g.hdr text')).toHaveText(['Research', 'Design', 'Marketing']);
  await expect(page.locator('#stage g.card[data-kind="row"][data-type="role"]')).toHaveCount(0);
  const se = 'rol-system-engineer';
  await expect(inCol(page, se, '[data-kind="row"][data-type="process"]')).toHaveCount(2);
  await expect(inCol(page, se, '[data-kind="row"][data-type="meeting"]')).toContainText('CHAIR');
  await expect(inCol(page, se, '[data-kind="row"][data-type="document"]')).toHaveCount(3);
  // Research's band spans exactly its three role columns.
  const band = await page.locator('#stage .headers g.hdr').first().locator('rect').boundingBox();
  const heads = await page.locator('#stage g.card[data-kind="header"]').evaluateAll(els => els.map(e => ({ id: e.dataset.id, ...e.querySelector('.shape').getBoundingClientRect().toJSON() })));
  const research = heads.filter(h => ['rol-research-manager', 'rol-scientist', 'rol-project-lead'].includes(h.id));
  expect(Math.min(...research.map(h => h.x))).toBeCloseTo(band.x, 0);
  expect(Math.max(...research.map(h => h.x + h.width))).toBeCloseTo(band.x + band.width, 0);
});

test('meeting table: only roles under each meeting', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.setView('meeting'));
  await expect(page.locator('#stage g.card[data-kind="header"][data-type="meeting"]')).toHaveCount(1);
  await expect(page.locator('#stage g.card[data-kind="row"]')).toHaveCount(6);
  await expect(page.locator('#stage g.card[data-kind="row"]:not([data-type="role"])')).toHaveCount(0);
  await expect(card(page, 'mtg-quarterly-design-review', 'header')).toContainText('QUARTERLY');
});

test('an empty table says so', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.load({ roles: [{ id: 'r', name: 'Solo' }] }); window.orrery.setView('meeting'); });
  await expect(page.locator('#stage .headers text.note')).toHaveText('No meetings yet');
});

test('selection works in table views', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.setView('process'));
  await page.locator('#stage g.card[data-col="pro-early-product-design"][data-id="doc-product-initiation"]').click();
  expect((await state(page)).sel).toBe('doc-product-initiation');
  await expect(page.locator('#detail .head .name')).toHaveText('Product initiation document');
  await expect(page.locator('#detail [data-section="owners"] .row')).toHaveCount(1);
  // Every copy of the selected item is marked.
  await page.locator('#stage g.card[data-id="rol-system-engineer"]').first().click();
  await expect(page.locator('#stage g.card.selected')).toHaveCount(2);
});

test('a hover on a card that disappears in a view switch does not dim the next view', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.setView('meeting'));
  await card(page, 'mtg-quarterly-design-review', 'header').hover();
  await page.keyboard.press('1');
  await expect(page.locator('#stage g.card[data-kind="header"]')).toHaveCount(0);
  const spot = await emptySpot(page);
  await page.mouse.move(spot.x, spot.y);
  await expect(page.locator('#stage .body.dim')).toHaveCount(0);
});

test('back and forward step through views and selections', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.select('rol-scientist'));
  await page.evaluate(() => window.orrery.setView('process'));
  await page.evaluate(() => window.orrery.select('pro-product-marketing-announcement'));
  await expect(page.locator('#btn-forward')).toBeDisabled();
  await page.click('#btn-back');
  expect(await state(page)).toMatchObject({ view: 'process', sel: 'rol-scientist' });
  await page.click('#btn-back');
  expect(await state(page)).toMatchObject({ view: 'graph', sel: 'rol-scientist' });
  await page.keyboard.press('Alt+ArrowRight');
  expect(await state(page)).toMatchObject({ view: 'process', sel: 'rol-scientist' });
  await page.click('#btn-forward');
  expect(await state(page)).toMatchObject({ view: 'process', sel: 'pro-product-marketing-announcement' });
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('cards glide from graph to table and back', async ({ page }) => {
    await openApp(page);
    const graphPos = await card(page, 'rol-scientist').boundingBox();
    await page.evaluate(() => window.orrery.setView('process'));
    expect((await state(page)).morphing).toBe(true);
    await page.waitForTimeout(120);
    const mid = await card(page, 'rol-scientist').boundingBox();
    await expect.poll(async () => (await state(page)).morphing, { timeout: 3000 }).toBe(false);
    const tablePos = await card(page, 'rol-scientist').boundingBox();
    // Mid-flight it's somewhere between where it started and where it ends.
    const d0 = Math.hypot(mid.x - graphPos.x, mid.y - graphPos.y), d1 = Math.hypot(mid.x - tablePos.x, mid.y - tablePos.y);
    expect(d0).toBeGreaterThan(1);
    expect(d1).toBeGreaterThan(1);
    await page.evaluate(() => window.orrery.setView('graph'));
    await expect.poll(async () => (await state(page)).morphing, { timeout: 3000 }).toBe(false);
    await page.waitForTimeout(600);
    await expect(page.locator('#stage .edges line')).toHaveCount(10);
    const edgeOpacity = await page.locator('#stage .edges line').first().evaluate(e => getComputedStyle(e).opacity);
    expect(+edgeOpacity).toBeGreaterThan(0.9);
    await expect(page.locator('#stage g.card[data-kind="row"]')).toHaveCount(0);
  });
});
