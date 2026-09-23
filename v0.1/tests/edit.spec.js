const { test, expect } = require('@playwright/test');
const { openApp, card, state, data, center, rightDrag, rightClick, emptySpot } = require('./helpers');

const panel = (page) => page.locator('#detail');
const section = (page, key) => page.locator(`#detail [data-section="${key}"]`);
const row = (page, key, id) => section(page, key).locator(`.row[data-id="${id}"]`);

test('edits are blocked outside edit mode', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.select('pro-early-product-design'));
  await expect(panel(page).locator('input, textarea, select')).toHaveCount(0);
  await expect(panel(page).locator('.finder')).toHaveCount(0);
  await rightClick(page, await emptySpot(page));
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#edit-banner span')).toBeHidden();
});

test('E toggles edit mode and the banner', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  await expect(page.locator('body')).toHaveClass(/editing/);
  await expect(page.locator('#edit-banner span')).toBeVisible();
  await expect(page.locator('#edit-banner span')).toHaveText(/edit mode/i);
  await expect(page.locator('#btn-edit')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#btn-edit');
  await expect(page.locator('body')).not.toHaveClass(/editing/);
});

test('right-click creates roles and processes; right-drag connects them', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  const spot = await emptySpot(page);
  await rightClick(page, spot);
  await expect(page.locator('#menu')).toBeVisible();
  await page.getByRole('menuitem', { name: 'New role…' }).click();
  let d = await data(page);
  expect(d.roles).toHaveLength(9);
  const newRole = d.roles[8];
  expect((await state(page)).sel).toBe(newRole.id);
  const name = panel(page).locator('input.name');
  await expect(name).toBeFocused();
  await page.keyboard.type('Quality auditor');
  await page.keyboard.press('Enter');
  d = await data(page);
  expect(d.roles[8].name).toBe('Quality auditor');
  await expect(page.locator('#legend li[data-dept="__none"]')).toContainText('Unassigned');
  await expect(card(page, newRole.id)).toContainText('Quality auditor');

  // Connect role → process by right-dragging.
  await rightDrag(page, await center(card(page, newRole.id)), await center(card(page, 'pro-product-marketing-announcement')));
  d = await data(page);
  expect(d.processes[1].roles.map(l => l.role)).toContain(newRole.id);
  await expect(page.locator(`#stage .edges line[data-role="${newRole.id}"]`)).toHaveCount(1);

  // Role → role is refused.
  await rightDrag(page, await center(card(page, newRole.id)), await center(card(page, 'rol-scientist')));
  await expect(page.locator('#toast')).toContainText('can’t connect to another role');
  expect((await data(page)).processes.map(p => p.roles.length)).toEqual([6, 5]);

  // New process too.
  await rightClick(page, await emptySpot(page));
  await page.getByRole('menuitem', { name: 'New process…' }).click();
  d = await data(page);
  expect(d.processes).toHaveLength(3);
  expect(d.processes[2].name).toBe('New process');
});

test('process panel: RACI, notes, meetings and documents', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('pro-early-product-design'); });
  // RACI toggles keep R-A-C-I order.
  await row(page, 'roles', 'rol-scientist').getByRole('button', { name: 'Accountable' }).click();
  let p = (await data(page)).processes[0];
  expect(p.roles.find(l => l.role === 'rol-scientist').raci).toEqual(['A', 'C']);
  await row(page, 'roles', 'rol-scientist').getByRole('button', { name: 'Consulted' }).click();
  p = (await data(page)).processes[0];
  expect(p.roles.find(l => l.role === 'rol-scientist').raci).toEqual(['A']);
  // Note
  const note = section(page, 'roles').locator('.row[data-id="rol-scientist"] + .note-input');
  await note.fill('Runs the key experiments');
  await note.press('Enter');
  p = (await data(page)).processes[0];
  expect(p.roles.find(l => l.role === 'rol-scientist').note).toBe('Runs the key experiments');
  // Create a new meeting from the finder.
  const mFinder = section(page, 'meetings').locator('.finder input');
  await mFinder.fill('Weekly design sync');
  await expect(section(page, 'meetings').locator('.results .create')).toHaveText('Create meeting “Weekly design sync”');
  await mFinder.press('Enter');
  let d = await data(page);
  const made = d.meetings.find(m => m.name === 'Weekly design sync');
  expect(made).toBeTruthy();
  expect(d.processes[0].meetings).toContain(made.id);
  // The finder is ready for the next one.
  await expect(section(page, 'meetings').locator('.finder input')).toBeFocused();
  // Add an existing document by searching.
  const dFinder = section(page, 'documents').locator('.finder input');
  await dFinder.fill('announce');
  await expect(section(page, 'documents').locator('.results button').first()).toHaveText('Product announcement');
  await dFinder.press('Enter');
  d = await data(page);
  expect(d.processes[0].documents).toContain('doc-product-announcement');
  // Unlink a document.
  await row(page, 'documents', 'doc-technical-feasibility').getByRole('button', { name: /Remove document/ }).click();
  expect((await data(page)).processes[0].documents).not.toContain('doc-technical-feasibility');
  // Add a role via search.
  const rFinder = section(page, 'roles').locator('.finder input');
  await rFinder.fill('analyst');
  await rFinder.press('Enter');
  expect((await data(page)).processes[0].roles.map(l => l.role)).toContain('rol-market-analyst');
  await expect(page.locator('#stage .edges line')).toHaveCount(11);
});

test('description and name edits', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('rol-scientist'); });
  const ta = panel(page).locator('textarea.desc');
  await ta.fill('Designs and runs experiments.');
  await ta.blur();
  expect((await data(page)).roles.find(r => r.id === 'rol-scientist').description).toBe('Designs and runs experiments.');
  const name = panel(page).locator('input.name');
  await name.fill('Senior scientist');
  await name.press('Enter');
  await expect(card(page, 'rol-scientist')).toContainText('Senior scientist');
  // Empty names are refused.
  await name.fill('');
  await name.press('Enter');
  await expect(name).toHaveValue('Senior scientist');
});

test('meeting panel: cadence, chair and mandatory', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('mtg-quarterly-design-review'); });
  await section(page, 'cadence').locator('select').selectOption('weekly');
  expect((await data(page)).meetings[0].cadence).toBe('weekly');
  await section(page, 'cadence').locator('select').selectOption('');
  expect((await data(page)).meetings[0].cadence).toBeNull();
  await row(page, 'roles', 'rol-scientist').getByRole('button', { name: 'Chair' }).click();
  await row(page, 'roles', 'rol-scientist').getByRole('button', { name: 'Mandatory' }).click();
  const l = (await data(page)).meetings[0].roles.find(x => x.role === 'rol-scientist');
  expect(l).toMatchObject({ chair: true, mandatory: true });
  await expect(row(page, 'roles', 'rol-scientist').getByRole('button', { name: 'Chair' })).toHaveAttribute('aria-pressed', 'true');
});

test('document panel: owners and reviewers', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('doc-product-announcement'); });
  const f = section(page, 'reviewers').locator('.finder input');
  await f.fill('scien');
  await f.press('Enter');
  let doc = (await data(page)).documents.find(x => x.id === 'doc-product-announcement');
  expect(doc.reviewers).toContain('rol-scientist');
  // Making a reviewer an owner moves them.
  const o = section(page, 'owners').locator('.finder input');
  await o.fill('scien');
  await o.press('Enter');
  doc = (await data(page)).documents.find(x => x.id === 'doc-product-announcement');
  expect(doc.owners).toContain('rol-scientist');
  expect(doc.reviewers).not.toContain('rol-scientist');
  // Own/Review switch from the role's side.
  await page.evaluate(() => window.orrery.select('rol-scientist'));
  await row(page, 'documents', 'doc-product-announcement').getByRole('button', { name: 'Review' }).click();
  doc = (await data(page)).documents.find(x => x.id === 'doc-product-announcement');
  expect(doc.reviewers).toContain('rol-scientist');
  expect(doc.owners).not.toContain('rol-scientist');
});

test('department picker creates and assigns departments; legend edits', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('rol-scientist'); });
  await panel(page).locator('.head button.dept').click();
  const f = page.locator('#menu .finder input');
  await expect(f).toBeFocused();
  await f.fill('Quality');
  await f.press('Enter');
  let d = await data(page);
  const q = d.departments.find(x => x.name === 'Quality');
  expect(q).toBeTruthy();
  expect(q.colour).toMatch(/^#[0-9A-F]{6}$/);
  expect(d.roles.find(r => r.id === 'rol-scientist').department).toBe(q.id);
  await expect(page.locator(`#legend li[data-dept="${q.id}"] input`)).toHaveValue('Quality');
  // Rename in the legend.
  const li = page.locator(`#legend li[data-dept="${q.id}"]`);
  await li.locator('input').fill('Quality & safety');
  await li.locator('input').press('Enter');
  expect((await data(page)).departments.find(x => x.id === q.id).name).toBe('Quality & safety');
  // Recolour.
  await li.locator('button.swatch').click();
  await page.locator('#menu .palette button[aria-label="Teal"]').click();
  expect((await data(page)).departments.find(x => x.id === q.id).colour).toBe('#1F6F6C');
  // Delete: its role becomes unassigned.
  await li.hover();
  await li.locator('button.rm').click();
  d = await data(page);
  expect(d.departments.find(x => x.id === q.id)).toBeUndefined();
  expect(d.roles.find(r => r.id === 'rol-scientist').department).toBeNull();
});

test('delete, undo and redo restore state exactly', async ({ page }) => {
  await openApp(page);
  const before = await data(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('rol-system-engineer'); });
  await panel(page).getByRole('button', { name: 'Delete role' }).click();
  let d = await data(page);
  expect(d.roles.find(r => r.id === 'rol-system-engineer')).toBeUndefined();
  expect(d.meetings[0].roles.find(l => l.role === 'rol-system-engineer')).toBeUndefined();
  expect(d.documents.flatMap(x => [...x.owners, ...x.reviewers])).not.toContain('rol-system-engineer');
  await expect(card(page, 'rol-system-engineer')).toHaveCount(0);
  // A few more edits…
  await page.evaluate(() => window.orrery.select('pro-early-product-design'));
  await row(page, 'roles', 'rol-scientist').getByRole('button', { name: 'Informed' }).click();
  await section(page, 'meetings').locator('.finder input').fill('Standup');
  await section(page, 'meetings').locator('.finder input').press('Enter');
  expect((await state(page)).undo).toBe(3);
  // …then undo them all with the keyboard.
  await page.locator('body').click({ position: { x: 700, y: 870 } });
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+z');
  expect(await data(page)).toEqual(before);
  await expect(card(page, 'rol-system-engineer')).toHaveCount(1);
  await page.keyboard.press('Control+y');
  expect((await data(page)).roles.find(r => r.id === 'rol-system-engineer')).toBeUndefined();
  await page.click('#btn-undo');
  expect(await data(page)).toEqual(before);
});

test('Delete key and node context menu delete in edit mode', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  await card(page, 'rol-scientist').click();
  await page.keyboard.press('Delete');
  expect((await data(page)).roles.find(r => r.id === 'rol-scientist')).toBeUndefined();
  await rightClick(page, await center(card(page, 'rol-project-lead')));
  await page.getByRole('menuitem', { name: /Delete role “Project lead”/ }).click();
  expect((await data(page)).roles.find(r => r.id === 'rol-project-lead')).toBeUndefined();
});
