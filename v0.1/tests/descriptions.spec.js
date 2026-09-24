const { test, expect } = require('@playwright/test');
const { openApp, card } = require('./helpers');

const EARLY = 'Takes a promising research result and shapes it into a product concept with a first technical feasibility assessment';

// A small organisation where a process shares its name with a document.
const CLASH = {
  title: 'Clash',
  departments: [{ id: 'dep-a', name: 'Alpha' }],
  roles: [{ id: 'rol-1', name: 'Keeper', department: 'dep-a' }, { id: 'rol-2', name: 'Newcomer', department: 'dep-a' }],
  processes: [
    { id: 'pro-spec', name: 'Product Design Specification', description: 'Writes and maintains the spec. Reviewed yearly.', roles: [{ role: 'rol-1', raci: ['R'] }], meetings: [], documents: ['doc-spec'] },
    { id: 'pro-bare', name: 'Bare process', description: '', roles: [{ role: 'rol-1', raci: ['A'] }], meetings: [], documents: [] },
    { id: 'pro-echo', name: 'Echo', description: 'Echo. It only repeats its name.', roles: [{ role: 'rol-1', raci: ['C'] }], meetings: [], documents: [] },
  ],
  meetings: [],
  documents: [{ id: 'doc-spec', name: 'Product Design Specification', description: 'The spec itself.', owners: ['rol-1'], reviewers: [] }],
};
const openClash = async (page) => {
  await openApp(page);
  await page.evaluate((j) => { window.orrery.load(j); window.orrery.settle(); }, CLASH);
};

test('firstSentence stops at the first real sentence end', async ({ page }) => {
  await openApp(page);
  const cases = [
    ['Handles e.g. vendor reviews. Then more.', 'Handles e.g. vendor reviews'],
    ['Handles e.g. Microsoft contracts. Then more.', 'Handles e.g. Microsoft contracts'],
    ['Owned by Dr. Patel and team. Next.', 'Owned by Dr. Patel and team'],
    ['Ships v2.1 of the spec. Next.', 'Ships v2.1 of the spec'],
    ['Covers pricing, packaging, etc. Next thing.', 'Covers pricing, packaging, etc'],
    ['No full stop at all', 'No full stop at all'],
    ['Line one without stop\nLine two.', 'Line one without stop'],
    ['Ends with a stop.', 'Ends with a stop'],
    ['Ready? Go.', 'Ready'],
    ['Wow! Next', 'Wow'],
    ['What?! Next', 'What'],
    ['Is it 3.5? Yes.', 'Is it 3.5'],
    ['', ''],
  ];
  const got = await page.evaluate((cs) => cs.map(([s]) => window.orrery.firstSentence(s)), cases);
  expect(got).toEqual(cases.map(c => c[1]));
});

test('a process node shows its first sentence, cut to three lines with the full text on hover', async ({ page }) => {
  await openApp(page);
  const node = card(page, 'pro-early-product-design');
  const lines = node.locator('text.desc tspan');
  await expect(lines).toHaveCount(3);
  expect(await lines.nth(2).textContent()).toMatch(/…$/);
  await expect(node.locator('.body')).toHaveAttribute('data-tip', EARLY);
  await node.locator('text.desc').hover();
  await expect(page.locator('#tooltip')).toHaveClass(/show/);
  await expect(page.locator('#tooltip')).toHaveText(EARLY);
});

test('processes without a useful description look as they did', async ({ page }) => {
  await openClash(page);
  await expect(card(page, 'pro-spec').locator('text.desc')).toHaveText('Writes and maintains the spec');
  await expect(card(page, 'pro-spec').locator('.body')).not.toHaveAttribute('data-tip');   // not cut short
  await expect(card(page, 'pro-bare').locator('text.desc')).toHaveCount(0);
  await expect(card(page, 'pro-echo').locator('text.desc')).toHaveCount(0);
});

test('focus mode keeps the description', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.focus('pro-early-product-design'));
  await expect(card(page, 'pro-early-product-design').locator('text.desc tspan')).toHaveCount(3);
});

test('process table headers show up to two lines of description', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.setView('process'));
  const head = card(page, 'pro-early-product-design', 'header');
  await expect(head.locator('text.desc tspan')).toHaveCount(2);
  await expect(head.locator('.body')).toHaveAttribute('data-tip', EARLY);
});

test('the process picker shows each process’s first sentence', async ({ page }) => {
  await openClash(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('rol-2'); });
  const f = page.locator('#detail [data-section="processes"] .finder');
  await f.locator('input').fill('pro');
  const opt = f.locator('.results button', { hasText: 'Product Design Specification' });
  await expect(opt.locator('.sub')).toHaveText('Writes and maintains the spec');
  await f.locator('input').fill('bare');
  await expect(f.locator('.results button', { hasText: 'Bare process' }).locator('.sub')).toHaveCount(0);
});

test('detail panel process links carry the first sentence as a tooltip', async ({ page }) => {
  await openClash(page);
  await page.evaluate(() => window.orrery.select('doc-spec'));
  const tile = page.locator('#detail [data-section="processes"] .row[data-id="pro-spec"] .tile');
  await expect(tile).toHaveAttribute('data-tip', 'Writes and maintains the spec');
  await expect(tile).not.toHaveAttribute('title');
  await page.evaluate(() => window.orrery.select('rol-1'));
  const bare = page.locator('#detail [data-section="processes"] .row[data-id="pro-bare"] .tile');
  await expect(bare).toHaveAttribute('title', 'Go to Bare process');
  await expect(bare).not.toHaveAttribute('data-tip');
});
