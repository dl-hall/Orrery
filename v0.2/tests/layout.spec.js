const { test, expect } = require('@playwright/test');
const path = require('path');
const { openApp, FIXTURES, overlaps } = require('./helpers');

// Focus mode spacing: however many partners, and however big their cards, no card overlaps another.
// (Lines may pass under cards; cards may not cover cards.) Regenerate the fixtures with: node fixtures/make-focus-stress.js
const fixture = (name) => require(path.join(FIXTURES, name));

async function focusOn(page, json, id) {
  await page.evaluate(j => window.orrery.load(j), json);
  await page.evaluate(() => window.orrery.settle());
  await page.evaluate(id => window.orrery.focus(id), id);
  await expect.poll(() => page.evaluate(() => window.orrery.state().morphing)).toBe(false);
}
async function expectNoOverlaps(page, cardCount) {
  await expect(page.locator('#stage g.card')).toHaveCount(cardCount);
  expect(await page.evaluate(() => window.orrery.focusOverlaps())).toEqual([]);   // the layout's own boxes
  expect(await overlaps(page)).toEqual([]);                                        // what's actually drawn
  // Fit keeps everything below the focus bar.
  const barBottom = (await page.locator('#focusbar').boundingBox()).y + (await page.locator('#focusbar').boundingBox()).height;
  const top = await page.locator('#stage g.card .shape').evaluateAll(els => Math.min(...els.map(e => e.getBoundingClientRect().top)));
  expect(top).toBeGreaterThan(barBottom);
}

for (const scheme of ['light', 'dark']) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('5 feeders, 5 fed, 10 two-way and 6 roles, all with long names and descriptions', async ({ page }) => {
      await openApp(page);
      await focusOn(page, fixture('focus-stress.json'), 'pro-centre');
      await expectNoOverlaps(page, 1 + 20 + 6);
    });

    test('the same, with 2 meetings and 2 documents on the inner ring too', async ({ page }) => {
      await openApp(page);
      await focusOn(page, fixture('focus-stress-refs.json'), 'pro-centre');
      await expectNoOverlaps(page, 1 + 20 + 6 + 4);
    });
  });
}

test('three described feeders stack on the left without touching', async ({ page }) => {
  await openApp(page);
  await focusOn(page, fixture('focus-fed-by-three.json'), 'pro-centre');
  await expectNoOverlaps(page, 1 + 3 + 6);
  const xs = await page.evaluate(() => ['pro-0', 'pro-1', 'pro-2'].map(id =>
    +document.querySelector(`#stage g.card[data-id="${id}"]`).getAttribute('transform').match(/translate\(([-\d.e]+)/)[1]));
  for (const x of xs) expect(x).toBeLessThan(0);   // still on the left: they feed the centre
});

test('a role in twenty described processes gets an inner ring wide enough for them all', async ({ page }) => {
  await openApp(page);
  const d = fixture('focus-stress.json');
  const many = structuredClone(d);
  for (const p of many.processes) if (!p.roles.some(l => l.role === 'rol-0')) p.roles.push({ role: 'rol-0', raci: ['C'], note: '' });
  await focusOn(page, many, 'rol-0');
  await expectNoOverlaps(page, 1 + 21);
});

test('the example’s focus layouts are unchanged in spirit and still clear', async ({ page }) => {
  await openApp(page);
  for (const id of ['pro-early-product-design', 'pro-product-roadmap', 'rol-system-engineer']) {
    await page.evaluate(id => window.orrery.focus(id), id);
    expect(await page.evaluate(() => window.orrery.focusOverlaps())).toEqual([]);
    expect(await overlaps(page)).toEqual([]);
  }
});

// Legibility: inner cards fill ring 1 in order (roles, then meetings, then documents) and only spill into the corner rings
// when ring 1 alone would make the names too small to read once fitted, as if the detail panel were open.
const GOAL = 0.6;   // the zoom that shows 14px process names at 8.4px
const PARTNERS = { left: ['pro-0', 'pro-1', 'pro-2'], right: ['pro-3', 'pro-4', 'pro-5'], both: ['pro-6', 'pro-7', 'pro-8', 'pro-9'] };
const plan = page => page.evaluate(() => window.orrery.focusPlan());
const zoom = page => page.evaluate(() => +document.querySelector('#stage g').getAttribute('transform').match(/scale\(([-\d.e]+)/)[1]);
/** Each card's centre and box size in layout units. */
const cardsNow = page => page.evaluate(() => [...document.querySelectorAll('#stage g.card')].map(g => {
  const [, x, y] = g.getAttribute('transform').match(/translate\(([-\d.e]+),\s*([-\d.e]+)/);
  const b = g.querySelector('.shape').getBBox();
  return { id: g.dataset.id, x: +x, y: +y, w: b.width, h: b.height };
}));
const kindOf = id => id.split('-')[0];

test('the target case (10 partners; 10 roles, 6 meetings, 4 documents) is legible at 1280×720 with the detail panel open', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openApp(page);
  await focusOn(page, fixture('focus-target.json'), 'pro-centre');
  await expectNoOverlaps(page, 1 + 10 + 10 + 6 + 4);
  const p = await plan(page);
  expect(p.k).toBeGreaterThanOrEqual(GOAL);
  expect(await zoom(page)).toBeGreaterThanOrEqual(GOAL);
  // Fill order: every role before every meeting before every document, ring 1 first.
  const order = p.rings.flat().map(kindOf);
  expect(order).toEqual([...order].sort((a, b) => ['rol', 'mtg', 'doc'].indexOf(a) - ['rol', 'mtg', 'doc'].indexOf(b)));
  expect(order).toHaveLength(20);
  expect(p.rings[0].length).toBeGreaterThanOrEqual(10);   // all the roles fit on ring 1
});

test('flow partners sit outside every inner card in their direction', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openApp(page);
  await focusOn(page, fixture('focus-target.json'), 'pro-centre');
  const cards = await cardsNow(page);
  const at = new Map(cards.map(c => [c.id, c]));
  for (const id of PARTNERS.left) expect(at.get(id).x).toBeLessThan(0);
  for (const id of PARTNERS.right) expect(at.get(id).x).toBeGreaterThan(0);
  for (const id of PARTNERS.both) expect(Math.abs(at.get(id).y)).toBeGreaterThan(Math.abs(at.get(id).x));
  const inner = cards.filter(c => ['rol', 'mtg', 'doc'].includes(kindOf(c.id)));
  const off = (g, a) => Math.atan2(Math.sin(g - a), Math.cos(g - a));
  for (const id of Object.values(PARTNERS).flat()) {
    const p = at.get(id), a = Math.atan2(p.y, p.x);
    const span = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => off(Math.atan2(p.y + (sy * p.h) / 2, p.x + (sx * p.w) / 2), a));
    const lo = Math.min(...span), hi = Math.max(...span);
    for (const c of inner) {
      const d = off(Math.atan2(c.y, c.x), a);
      if (d > lo && d < hi) expect(Math.hypot(c.x, c.y), `${c.id} is inside ${id}`).toBeLessThan(Math.hypot(p.x, p.y));
    }
  }
});

test('with few roles, meetings and documents join ring 1 before anything goes to the corners', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openApp(page);
  await focusOn(page, fixture('focus-few-roles.json'), 'pro-centre');
  await expectNoOverlaps(page, 1 + 10 + 3 + 6 + 4);
  const p = await plan(page);
  expect(p.k).toBeGreaterThanOrEqual(GOAL);
  const ring1 = p.rings[0].map(kindOf);
  expect(ring1.filter(k => k === 'rol')).toHaveLength(3);
  expect(ring1).toContain('mtg');
});

test('the layout is planned as if the detail panel were open, so hiding the panel doesn’t move anything', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openApp(page);
  await focusOn(page, fixture('focus-target.json'), 'pro-centre');
  const open = await cardsNow(page);
  await page.click('#detail-collapse');
  await focusOn(page, fixture('focus-target.json'), 'pro-centre');   // a fresh load, so the plan is made again
  expect(await cardsNow(page)).toEqual(open);
  expect((await plan(page)).area).toEqual({ w: 840, h: 620 });
});

test('a big window keeps everything on ring 1; a small one still keeps ring 1 and clears every card; resizing re-plans', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openApp(page);
  await focusOn(page, fixture('focus-target.json'), 'pro-centre');
  await expectNoOverlaps(page, 31);
  expect((await plan(page)).rings).toHaveLength(1);
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect.poll(async () => (await plan(page)).area.w).toBe(1024 - 412 - 28);
  await expect.poll(() => page.evaluate(() => window.orrery.state().morphing)).toBe(false);
  await expectNoOverlaps(page, 31);
  expect((await plan(page)).rings[0].length).toBeGreaterThanOrEqual(4);
});
