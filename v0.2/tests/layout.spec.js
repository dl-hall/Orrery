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
