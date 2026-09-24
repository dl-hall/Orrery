const { test, expect } = require('@playwright/test');
const { openApp, card, state } = require('./helpers');

/** The example with one of each kind of discrepancy added. */
async function loadFlawed(page) {
  await page.evaluate(() => {
    const d = window.orrery.example();
    d.meetings[0].roles.push({ role: 'rol-market-analyst', chair: false, mandatory: false });   // not in Early product design
    d.documents[0].owners.push('rol-marketing-manager');                                          // owner outside the process
    d.documents[0].reviewers.push('rol-market-analyst');                                          // reviewers are exempt
    d.meetings.push({ id: 'mtg-orphan', name: 'Orphan sync', roles: [{ role: 'rol-scientist' }] });
    d.documents.push({ id: 'doc-orphan', name: 'Stray memo', owners: ['rol-scientist'] });
    d.roles.push({ id: 'rol-lonely', name: 'Lonely role', department: 'dep-design' });
    d.processes.push({ id: 'pro-empty', name: 'Empty process' });
    window.orrery.load(d);
  });
}
const rules = (page) => page.evaluate(() => window.orrery.warnings().map(w => [w.rule, w.target, w.other || null]));

test('the example has no warnings', async ({ page }) => {
  await openApp(page);
  expect(await rules(page)).toEqual([]);
  await expect(page.locator('#btn-warnings .count')).toHaveText('');
});

test('each rule fires, and reviewers are exempt', async ({ page }) => {
  await openApp(page);
  await loadFlawed(page);
  const got = await rules(page);
  expect(got).toEqual(expect.arrayContaining([
    ['meeting-role-outside', 'mtg-quarterly-design-review', 'rol-market-analyst'],
    ['doc-owner-outside', 'doc-product-initiation', 'rol-marketing-manager'],
    ['orphan-meeting', 'mtg-orphan', null],
    ['orphan-document', 'doc-orphan', null],
    ['orphan-role', 'rol-lonely', null],
    ['empty-process', 'pro-empty', null],
  ]));
  expect(got).toHaveLength(6);
  // No pair warnings for a meeting in no process: the orphan warning covers it.
  expect(got.filter(w => w[1] === 'mtg-orphan')).toHaveLength(1);
  await expect(page.locator('#btn-warnings .count')).toHaveText('6');
});

test('triangles show in the panel from both sides, and on table cards', async ({ page }) => {
  await openApp(page);
  await loadFlawed(page);
  await page.evaluate(() => window.orrery.select('mtg-quarterly-design-review'));
  await expect(page.locator('#detail [data-section="roles"] .row .warn')).toHaveCount(1);
  await expect(page.locator('#detail [data-section="roles"] .row[data-id="rol-market-analyst"] .warn')).toHaveCount(1);
  await page.evaluate(() => window.orrery.select('rol-market-analyst'));
  await expect(page.locator('#detail [data-section="meetings"] .row[data-id="mtg-quarterly-design-review"] .warn')).toHaveCount(1);
  // Reviewing isn't flagged.
  await expect(page.locator('#detail [data-section="documents"] .warn')).toHaveCount(0);
  await page.evaluate(() => window.orrery.select('doc-product-initiation'));
  await expect(page.locator('#detail [data-section="owners"] .row[data-id="rol-marketing-manager"] .warn')).toHaveCount(1);
  await expect(page.locator('#detail [data-section="reviewers"] .warn')).toHaveCount(0);
  await page.evaluate(() => window.orrery.select('mtg-orphan'));
  await expect(page.locator('#detail .head .warn')).toHaveAttribute('data-tip', /isn’t part of any process/);

  await page.evaluate(() => window.orrery.setView('meeting'));
  await expect(page.locator('#stage g.card[data-col="mtg-quarterly-design-review"][data-id="rol-market-analyst"] .warn')).toHaveCount(1);
  await expect(page.locator('#stage g.card[data-col="mtg-quarterly-design-review"] .warn')).toHaveCount(1);
  await expect(card(page, 'mtg-orphan', 'header').locator('.warn')).toHaveCount(1);
  await page.evaluate(() => window.orrery.setView('role'));
  await expect(page.locator('#stage g.card[data-col="rol-market-analyst"][data-id="mtg-quarterly-design-review"] .warn')).toHaveCount(1);
  await expect(page.locator('#stage g.card[data-col="rol-marketing-manager"][data-id="doc-product-initiation"] .warn')).toHaveCount(1);
  await expect(page.locator('#stage g.card[data-col="rol-market-analyst"][data-id="doc-product-initiation"] .warn')).toHaveCount(0);
  await expect(card(page, 'rol-lonely', 'header').locator('.warn')).toHaveCount(1);
  // The graph stays unmarked.
  await page.keyboard.press('1');
  await expect(page.locator('#stage g.card .warn')).toHaveCount(0);
});

test('the list opens from the panel and with W, and an entry selects its item', async ({ page }) => {
  await openApp(page);
  await loadFlawed(page);
  await page.click('#sub-toggle');
  await page.click('#btn-warnings');
  const dlg = page.locator('#warnings');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.w-group')).toHaveCount(6);
  await expect(dlg.locator('.w-item')).toHaveCount(6);
  // Keys don't reach the canvas while it's open; Esc closes it.
  await page.keyboard.press('3');
  expect((await state(page)).view).toBe('graph');
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await page.keyboard.press('w');
  await expect(dlg).toBeVisible();
  await dlg.locator('[data-rule="empty-process"] .tile').click();
  await expect(dlg).toBeHidden();
  expect((await state(page)).sel).toBe('pro-empty');
});

test('the list is empty-friendly', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('w');
  await expect(page.locator('#warnings')).toContainText('No warnings');
});

test('warning marks can be turned off, and that is remembered', async ({ page }) => {
  await openApp(page);
  await loadFlawed(page);
  await page.evaluate(() => window.orrery.select('mtg-quarterly-design-review'));
  const mark = page.locator('#detail .row[data-id="rol-market-analyst"] .warn');
  await expect(mark).toBeVisible();
  await page.click('#sub-toggle');
  await expect(page.locator('#btn-warnmarks')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#btn-warnmarks');
  await expect(page.locator('#btn-warnmarks')).toHaveAttribute('aria-pressed', 'false');
  await expect(mark).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => window.orrery);
  await expect(page.locator('body')).toHaveClass(/hide-warn/);
  await expect(page.locator('#btn-warnmarks')).toHaveAttribute('aria-pressed', 'false');
});
