const { test, expect } = require('./helpers');
const { openApp, card, state } = require('./helpers');

// Focus mode: a process's or role's meetings and documents appear as cards on the inner ring.
const EPD = 'pro-early-product-design', QDR = 'mtg-quarterly-design-review';
const refs = (page) => page.locator('#stage g.card[data-kind="ref"]');
const refEdges = (page) => page.locator('#stage .edges line.ref');
const people = (page, id) => card(page, id).locator('.ppl > g').evaluateAll(gs => gs.map(g => g.classList.contains('more') ? '+' : g.style.getPropertyValue('--dept')));

test('person icons are shared out between departments', async ({ page }) => {
  await openApp(page);
  const icons = (counts) => page.evaluate(c => window.orrery.allocateIcons(c), counts);
  const c = (...pairs) => pairs.map(([dept, n]) => ({ dept, n }));
  expect(await icons(c(['E', 5], ['M', 2]))).toEqual(['E', 'E', 'M']);
  expect(await icons(c(['E', 5], ['M', 2], ['S', 1]))).toEqual(['E', 'M', 'S']);
  expect(await icons(c(['E', 5], ['M', 2], ['S', 1], ['H', 1]))).toEqual(['E', 'M', 'S', 'H']);
  expect(await icons(c(['E', 4]))).toEqual(['E', 'E', 'E']);
  expect(await icons(c(['E', 1], ['M', 1]))).toEqual(['E', 'M']);
  expect(await icons(c(['E', 3], ['M', 2], ['S', 1], ['H', 1], ['O', 1], ['L', 1], ['F', 1]))).toEqual(['E', 'M', 'S', 'H', 'O', '+']);
  // Edge cases: nobody, one person, six departments exactly, a tie goes to the earlier department.
  expect(await icons([])).toEqual([]);
  expect(await icons(c(['E', 1]))).toEqual(['E']);
  expect(await icons(c(['A', 1], ['B', 1], ['C', 1], ['D', 1], ['E', 1], ['F', 1]))).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  expect(await icons(c(['A', 3], ['B', 3]))).toEqual(['A', 'A', 'B']);
  expect(await icons(c(['A', 1], [null, 9]))).toEqual([null, null, 'A']);
});

test('focusing a process springs out its meetings and documents as cards', async ({ page }) => {
  await openApp(page);
  await page.evaluate(id => window.orrery.focus(id), EPD);
  await expect(refs(page)).toHaveCount(3);
  await expect(card(page, QDR)).toHaveClass(/t-meeting k-ref/);
  await expect(card(page, 'doc-product-initiation')).toHaveClass(/t-document k-ref/);
  await expect(refEdges(page)).toHaveCount(3);
  await expect(refEdges(page).first()).toHaveCSS('stroke-dasharray', '4px, 3px');
  // The centre card loses its badges: the cards replace them.
  await expect(card(page, EPD).locator('.badge')).toHaveCount(0);
  // Shapes: the meeting is a long table with attendees along the top; the document a page with a folded corner.
  const shape = await card(page, QDR).locator('.shape').evaluate(r => ({ rx: +r.getAttribute('rx'), h: +r.getAttribute('height') }));
  expect(shape.rx).toBeCloseTo(shape.h / 2);
  expect(await people(page, QDR)).toEqual(['#86397A', '#86397A', '#2F5D8A']);   // three Research, three Design attendees
  await expect(card(page, QDR).locator('.sub')).toHaveText('QUARTERLY');
  await expect(card(page, 'doc-product-initiation').locator('path.shape')).toHaveCount(1);
  await expect(card(page, 'doc-product-initiation').locator('path.fold')).toHaveCount(1);
  // Clicking one selects it; it can't be focused itself.
  await card(page, QDR).click();
  expect((await state(page)).sel).toBe(QDR);
  await card(page, QDR).dblclick();
  expect((await state(page)).focus).toBe(EPD);
  // Leaving focus takes them away, and the badges come back.
  await page.click('#btn-unfocus');
  await expect(refs(page)).toHaveCount(0);
  await expect(refEdges(page)).toHaveCount(0);
  await expect(card(page, EPD).locator('.badge')).toHaveCount(2);
});

test('focusing a role shows the meetings it attends and the documents it owns or reviews', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.focus('rol-system-engineer'));
  const ids = await refs(page).evaluateAll(gs => gs.map(g => g.dataset.id));
  expect(ids.sort()).toEqual([QDR, 'doc-design-roadmap', 'doc-product-announcement', 'doc-product-initiation', 'doc-technical-feasibility'].sort());
  // Hovering a meeting lights its attendees and processes, not the rest of the ring.
  await card(page, QDR).hover();
  const dim = id => card(page, id).locator('.body').evaluate(b => b.classList.contains('dim'));
  expect(await dim('rol-system-engineer')).toBe(false);
  expect(await dim(EPD)).toBe(false);
  expect(await dim('doc-design-roadmap')).toBe(true);
});

test('meeting icons follow attendee changes, and the card widens for six', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const d = window.orrery.example();
    const extra = ['A', 'B', 'C', 'D', 'E'].map((x, i) => ({ id: `dep-${x}`, name: `Dept ${x}`, colour: ['#A0482A', '#4E4596', '#1F6F6C', '#8C2F45', '#5E6B1F'][i] }));
    d.departments.push(...extra);
    for (const dep of extra) {
      d.roles.push({ id: `rol-${dep.id}`, name: `Role ${dep.name}`, department: dep.id });
      d.meetings[0].roles.push({ role: `rol-${dep.id}` });
    }
    window.orrery.load(d);
    window.orrery.focus('pro-early-product-design');
  });
  const icons = await people(page, QDR);
  expect(icons).toHaveLength(6);
  expect(icons[5]).toBe('+');   // eight departments: the five biggest, then a plus
  const { w, h } = await card(page, QDR).locator('.shape').evaluate(r => ({ w: +r.getAttribute('width'), h: +r.getAttribute('height') }));
  expect(w - h).toBeGreaterThanOrEqual(5 * 15);   // the straight part holds all six without crowding
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('meeting and document cards grow out of the focused card and shrink back into it', async ({ page }) => {
    await openApp(page);
    const centre = await page.evaluate(id => {
      const t = document.querySelector(`#stage g.card[data-id="${id}"]`).getAttribute('transform');
      return t.match(/translate\(([-\d.e]+),\s?([-\d.e]+)\)/).slice(1).map(Number);
    }, EPD);
    // Read the start state in the same task as the focus call, before the transition's first frame.
    const start = await page.evaluate(id => { window.orrery.focus(id); return document.querySelector('#stage g.card[data-id="mtg-quarterly-design-review"]').getAttribute('transform'); }, EPD);
    const [sx, sy, sc] = start.match(/translate\(([-\d.e]+),\s?([-\d.e]+)\)\s*scale\(([-\d.e]+)\)/).slice(1).map(Number);
    expect(Math.hypot(sx - centre[0], sy - centre[1])).toBeLessThan(1);
    expect(sc).toBeCloseTo(0.3);
    await expect.poll(async () => (await state(page)).morphing, { timeout: 3000 }).toBe(false);
    expect(await card(page, QDR).getAttribute('transform')).toMatch(/^translate\([^)]*\)(\s*scale\(1(,\s?1)?\))?$/);   // full size (d3 may leave an identity scale)
    // Leaving: mid-way it's smaller and closer to the process; then it's gone.
    const ring = await card(page, QDR).getAttribute('transform');
    await page.evaluate(() => window.orrery.focus(null));
    await page.waitForTimeout(270);
    const mid = await card(page, QDR).getAttribute('transform');
    expect(mid).not.toBe(ring);
    expect(+mid.match(/scale\(([-\d.e]+)/)[1]).toBeLessThan(0.95);
    await expect(refs(page)).toHaveCount(0);
  });
});
