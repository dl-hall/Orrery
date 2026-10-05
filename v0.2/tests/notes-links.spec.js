const { test, expect } = require('./helpers');
const { openApp, card, state, data } = require('./helpers');

const panel = (page) => page.locator('#detail');
const section = (page, key) => page.locator(`#detail [data-section="${key}"]`);
const linkRows = (page) => section(page, 'links').locator('.link-row');
const form = (page) => page.locator('#menu form.menu-form');
const EARLY = 'pro-early-product-design';
const PLAYBOOK = 'https://contoso.sharepoint.com/sites/product/Shared%20Documents/Early%20design%20playbook.pptx';

const proc = async (page, id = EARLY) => (await data(page)).processes.find(p => p.id === id);

test('notes and links load with defaults; bare URLs, empty URLs and unknown fields', async ({ page }) => {
  await openApp(page);
  const { data: d, dropped } = await page.evaluate(() => window.orrery.normalise({
    roles: [
      { id: 'rol-1', name: 'Old role' },   // a v0.1-style item: no notes, no links
      { id: 'rol-2', name: 'Linked', notes: 'Ask Sam first.', links: [
        'https://example.com/a.pptx',
        { url: '  https://example.com/b  ', label: '  B  ', pinned: true },
        { url: '   ', label: 'Nothing here' },
        { label: 'No URL at all' },
        'C:\\Shared\\Org support.pptx',
      ] },
    ],
    processes: [{ id: 'pro-1', name: 'P' }], meetings: [{ id: 'mtg-1', name: 'M', notes: 42 }], documents: [{ id: 'doc-1', name: 'D', links: 'not a list' }],
  }));
  expect(dropped).toBe(2);
  expect(d.roles[0]).toMatchObject({ notes: '', links: [] });
  expect(d.roles[1].notes).toBe('Ask Sam first.');
  expect(d.roles[1].links).toEqual([
    { label: '', url: 'https://example.com/a.pptx' },
    { label: 'B', url: 'https://example.com/b', pinned: true },
    { label: '', url: 'C:\\Shared\\Org support.pptx' },   // kept, shown as text
  ]);
  expect(d.processes[0]).toMatchObject({ notes: '', links: [] });
  expect(d.meetings[0].notes).toBe('42');
  expect(d.documents[0].links).toEqual([]);
});

test('new items start with empty notes and links', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('rol-scientist'); });
  const f = section(page, 'meetings').locator('.finder input');
  await f.fill('Weekly sync');
  await f.press('Enter');
  const m = (await data(page)).meetings.find(x => x.name === 'Weekly sync');
  expect(m).toMatchObject({ notes: '', links: [] });
});

test('link helpers: tidy typed URLs, only web links get an href, and names fall back sensibly', async ({ page }) => {
  await openApp(page);
  const got = await page.evaluate(() => {
    const o = window.orrery;
    return {
      clean: ['contoso.sharepoint.com/x.pptx', 'www.example.com', '//example.com/a', 'https://a.b/c', 'sam@example.com', 'javascript:alert(1)', 'C:\\x\\y.pptx', '\\\\server\\share', 'notaurl', ''].map(o.cleanUrl),
      href: ['https://a.b/c', 'http://a.b', 'mailto:sam@example.com', 'javascript:alert(1)', 'file:///C:/x.pptx', 'C:\\x.pptx', 'nonsense'].map(o.linkHref),
      name: [
        { label: 'Org support file', url: 'https://contoso.sharepoint.com/Shared%20Documents/Org%20support.pptx' },
        { label: '', url: 'https://contoso.sharepoint.com/Shared%20Documents/Org%20support.pptx' },
        { label: '', url: 'https://contoso.sharepoint.com/:p:/s/product/EaBcD123' },
        { label: '', url: 'mailto:sam@example.com' },
        { label: '', url: 'C:\\Shared\\Org support.pptx' },
      ].map(o.linkName),
    };
  });
  expect(got.clean).toEqual(['https://contoso.sharepoint.com/x.pptx', 'https://www.example.com', 'https://example.com/a', 'https://a.b/c', 'mailto:sam@example.com', 'javascript:alert(1)', 'C:\\x\\y.pptx', '\\\\server\\share', 'notaurl', '']);
  expect(got.href).toEqual(['https://a.b/c', 'http://a.b/', 'mailto:sam@example.com', null, null, null, null]);
  expect(got.name).toEqual(['Org support file', 'Org support.pptx', 'contoso.sharepoint.com', 'sam@example.com', 'C:\\Shared\\Org support.pptx']);
});

test('Notes and Links sit at the bottom of the panel, Notes first, above Delete', async ({ page }) => {
  await openApp(page);
  await page.evaluate((id) => window.orrery.select(id), EARLY);
  const keys = () => page.locator('#detail .body > section').evaluateAll(els => els.map(e => e.dataset.section));
  expect((await keys()).slice(-2)).toEqual(['notes', 'links']);
  await page.evaluate(() => window.orrery.edit(true));
  expect((await keys()).slice(-2)).toEqual(['notes', 'links']);
  await expect(page.locator('#detail .body > section[data-section="links"] + .foot .delete')).toBeVisible();
});

test('notes can be edited outside edit mode, mark the file unsaved and undo', async ({ page }) => {
  await openApp(page);
  await page.evaluate((id) => window.orrery.select(id), EARLY);
  expect((await state(page)).edit).toBe(false);
  const ta = section(page, 'notes').locator('textarea.notes');
  await expect(ta).toHaveValue('More information can be found in the Early design playbook.');
  await ta.fill('Check with the design leads.\nSecond line.');
  await ta.blur();
  expect((await proc(page)).notes).toBe('Check with the design leads.\nSecond line.');
  expect((await state(page)).dirty).toBe(true);
  await expect(page.locator('#btn-save .dot')).toHaveCount(1);
  // Keys typed in the notes don't trigger shortcuts.
  await ta.click();
  await page.keyboard.type(' e 2 w');
  expect((await state(page))).toMatchObject({ edit: false, view: 'graph' });
  await page.keyboard.press('Escape');   // blurs, which commits
  expect((await proc(page)).notes).toBe('Check with the design leads.\nSecond line. e 2 w');
  await page.keyboard.press('Control+z');
  expect((await proc(page)).notes).toBe('Check with the design leads.\nSecond line.');
  await page.keyboard.press('Control+z');
  expect((await proc(page)).notes).toBe('More information can be found in the Early design playbook.');
  await expect(ta).toHaveValue('More information can be found in the Early design playbook.');
});

test('a note typed just before turning on edit mode is kept', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.select('rol-scientist'));
  await section(page, 'notes').locator('textarea').fill('Half-written');
  await page.evaluate(() => window.orrery.edit(true));
  expect((await data(page)).roles.find(r => r.id === 'rol-scientist').notes).toBe('Half-written');
});

test('outside edit mode, links open in a new tab and can’t be changed', async ({ page }) => {
  await openApp(page);
  await page.evaluate((id) => window.orrery.select(id), EARLY);
  await expect(linkRows(page)).toHaveCount(1);
  const a = linkRows(page).locator('a.link');
  await expect(a).toHaveAttribute('href', PLAYBOOK);
  await expect(a).toHaveAttribute('target', '_blank');
  await expect(a).toHaveAttribute('rel', /noopener/);
  await expect(a.locator('.nm')).toHaveText('Early design playbook');
  await expect(a.locator('.host')).toHaveText('contoso.sharepoint.com');
  await expect(section(page, 'links').locator('button')).toHaveCount(0);
  // With no label, the file name shows.
  await page.evaluate(() => window.orrery.select('doc-product-roadmap'));
  await expect(linkRows(page).locator('.nm')).toHaveText('Product roadmap 2027.xlsx');
  // No links at all.
  await page.evaluate(() => window.orrery.select('rol-scientist'));
  await expect(section(page, 'links').locator('.none')).toHaveText('No links yet.');
});

test('a link that isn’t a web address shows as text, never as an href', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const ex = window.orrery.example();
    ex.roles[0].links = [{ label: 'Bad', url: 'javascript:alert(1)' }, { label: '', url: 'C:\\Shared\\Org support.pptx' }];
    window.orrery.load(ex);
    window.orrery.select(ex.roles[0].id);
  });
  await expect(linkRows(page)).toHaveCount(2);
  await expect(section(page, 'links').locator('a')).toHaveCount(0);
  await expect(section(page, 'links').locator('.link.dead').first()).toContainText('Not a web link');
});

test('in edit mode, links can be added, edited and removed, with undo', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('rol-scientist'); });
  await expect(section(page, 'links').locator('.none')).toHaveCount(0);

  // Add: Tab moves between the fields without closing the form; https:// is added.
  await section(page, 'links').locator('.link-add').click();
  await expect(form(page)).toBeVisible();
  await expect(form(page).locator('input[name="url"]')).toBeFocused();
  await page.keyboard.type('contoso.sharepoint.com/sites/org/Org%20support.pptx');
  await page.keyboard.press('Tab');
  await expect(form(page)).toBeVisible();
  await expect(form(page).locator('input[name="label"]')).toBeFocused();
  await page.keyboard.type('Org support file');
  await page.keyboard.press('Enter');
  await expect(form(page)).toBeHidden();
  const links = async () => (await data(page)).roles.find(r => r.id === 'rol-scientist').links;
  expect(await links()).toEqual([{ label: 'Org support file', url: 'https://contoso.sharepoint.com/sites/org/Org%20support.pptx' }]);
  await expect(linkRows(page).locator('.nm')).toHaveText('Org support file');

  // A sharing link with no file name suggests a label; a script URL is refused.
  await section(page, 'links').locator('.link-add').click();
  await form(page).locator('input[name="url"]').fill('https://contoso.sharepoint.com/:p:/s/org/EaBcD123');
  await expect(form(page).locator('.msg')).toContainText('doesn’t name a file');
  await form(page).locator('input[name="url"]').fill('javascript:alert(1)');
  await form(page).locator('button[type="submit"]').click();
  await expect(form(page).locator('.msg.bad')).toContainText('Enter a web address');
  await expect(form(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(form(page)).toBeHidden();
  expect(await links()).toHaveLength(1);

  // Edit.
  await linkRows(page).first().locator('button.edit').click();
  await expect(form(page).locator('input[name="url"]')).toHaveValue('https://contoso.sharepoint.com/sites/org/Org%20support.pptx');
  await form(page).locator('input[name="label"]').fill('Org support deck');
  await form(page).locator('button[type="submit"]').click();
  expect((await links())[0].label).toBe('Org support deck');

  // Remove, then undo and redo.
  await linkRows(page).first().locator('button[aria-label^="Remove link"]').click();
  expect(await links()).toEqual([]);
  await page.keyboard.press('Control+z');
  expect((await links())[0].label).toBe('Org support deck');
  await page.keyboard.press('Control+z');
  expect((await links())[0].label).toBe('Org support file');
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+y');
  expect(await links()).toEqual([]);
});

test('search finds notes and link labels', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const ex = window.orrery.example();
    ex.roles.find(r => r.id === 'rol-scientist').notes = 'Runs the zebrafish lab.';
    ex.roles.find(r => r.id === 'rol-project-lead').links = [{ label: 'Gantt wombat', url: 'https://example.com/plan' }];
    window.orrery.load(ex);
  });
  await page.keyboard.press('/');
  await page.keyboard.type('zebrafish');
  await expect(card(page, 'rol-scientist').locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, 'rol-project-lead').locator('.body')).toHaveClass(/dim/);
  await page.locator('#search-input').fill('wombat');
  await expect(card(page, 'rol-project-lead').locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, 'rol-scientist').locator('.body')).toHaveClass(/dim/);
});

test('notes and links survive a save and reopen', async ({ page }) => {
  await openApp(page);
  const text = await page.evaluate(() => window.orrery.serialise());
  const saved = JSON.parse(text);
  expect(saved.processes.find(p => p.id === 'pro-early-product-design').links[0].url).toBe('https://contoso.sharepoint.com/sites/product/Shared%20Documents/Early%20design%20playbook.pptx');
  await page.evaluate((t) => window.orrery.loadText(t), text);
  expect(await data(page)).toEqual(saved);
});
