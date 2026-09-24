const { test, expect } = require('@playwright/test');
const { openApp, card, state, data, center, rightDrag, rightClick } = require('./helpers');

const flow = (page, from, to) => page.locator(`#stage g.flow[data-from="${from}"][data-to="${to}"]`);
const flows = (page) => page.locator('#stage g.flow');
const section = (page, key) => page.locator(`#detail [data-section="${key}"]`);
const flowItem = (page, key, other) => section(page, key).locator(`.flow-item:has(.row[data-id="${other}"])`);
const pos = (page, id) => card(page, id).getAttribute('transform').then(t => t.match(/translate\(([-\d.e]+),\s?([-\d.e]+)\)/).slice(1).map(Number));
/** Line endpoints, arrow position and arrow angle of a flow, in world coordinates. */
const geom = (page, from, to) => flow(page, from, to).evaluate(g => {
  const l = g.querySelector('.strand');
  const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map(a => +l.getAttribute(a));
  const m = g.querySelector('.head').getAttribute('transform').match(/translate\(([-\d.e]+),([-\d.e]+)\) rotate\(([-\d.e]+)\)/);
  return { x1, y1, x2, y2, hx: +m[1], hy: +m[2], angle: +m[3] };
});
const PR = 'pro-product-roadmap', DR = 'pro-design-roadmap', EPD = 'pro-early-product-design', PMA = 'pro-product-marketing-announcement';

test('loading keeps good flows and drops self-links, repeats and dangling ends', async ({ page }) => {
  await openApp(page);
  const { data: d, dropped } = await page.evaluate(() => window.orrery.normalise({
    processes: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    documents: [{ id: 'doc', name: 'Doc' }],
    flows: [
      { from: 'a', to: 'b', description: 'Stuff', documents: ['doc', 'nope'], colour: 'kept' },
      { from: 'a', to: 'b' },          // repeat
      { from: 'a', to: 'a' },          // self
      { from: 'a', to: 'missing' },    // dangling
      { from: 'b', to: 'a' },          // the other direction is fine
    ],
  }));
  expect(d.orrery).toBe('0.2');
  expect(d.flows).toHaveLength(2);
  expect(d.flows[0]).toMatchObject({ from: 'a', to: 'b', description: 'Stuff', documents: ['doc'], colour: 'kept' });
  expect(d.flows[0].id).toMatch(/^flo-/);
  expect(d.flows[1]).toMatchObject({ from: 'b', to: 'a', description: '', documents: [] });
  expect(dropped).toBe(4);
  // A v0.1 file has no flows.
  const old = await page.evaluate(() => { const x = window.orrery.example(); delete x.flows; x.orrery = '0.1'; return window.orrery.normalise(x).data; });
  expect(old.flows).toEqual([]);
  expect(Object.keys(old)).toEqual(['orrery', 'title', 'departments', 'roles', 'processes', 'meetings', 'documents', 'flows', 'layout']);
});

test('the graph draws one flow per link; a two-way pair is two thin strands side by side', async ({ page }) => {
  await openApp(page);
  await expect(flows(page)).toHaveCount(4);
  await expect(page.locator('#stage g.flow.two')).toHaveCount(2);
  await expect(flow(page, PR, DR)).toHaveClass(/\btwo\b/);
  await expect(flow(page, PR, EPD)).not.toHaveClass(/\btwo\b/);
  expect(await flow(page, PR, EPD).locator('.strand').evaluate(e => getComputedStyle(e).strokeWidth)).toBe('2.5px');
  expect(await flow(page, PR, DR).locator('.strand').evaluate(e => getComputedStyle(e).strokeWidth)).toBe('1.5px');

  // The strands are parallel, 5px apart, with their arrows side by side and pointing opposite ways.
  const a = await geom(page, PR, DR), b = await geom(page, DR, PR);
  const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
  const nx = -(a.y2 - a.y1) / len, ny = (a.x2 - a.x1) / len;
  expect(Math.abs((b.x1 - a.x1) * nx + (b.y1 - a.y1) * ny)).toBeCloseTo(5, 1);
  expect(Math.hypot(a.hx - b.hx, a.hy - b.hy)).toBeCloseTo(5, 1);
  expect(Math.abs(((a.angle - b.angle) % 360 + 360) % 360)).toBeCloseTo(180, 1);
});

test('the arrow sits in the middle of the visible stretch, pointing from source to target', async ({ page }) => {
  await openApp(page);
  const g = await geom(page, PR, EPD);
  expect(g.hx).toBeCloseTo((g.x1 + g.x2) / 2, 3);
  expect(g.hy).toBeCloseTo((g.y1 + g.y2) / 2, 3);
  const [px, py] = await pos(page, PR), [ex, ey] = await pos(page, EPD);
  expect(g.angle).toBeCloseTo(Math.atan2(ey - py, ex - px) * 180 / Math.PI, 1);
  // The line starts and ends at the box edges, not the centres.
  expect(Math.hypot(g.x1 - px, g.y1 - py)).toBeGreaterThan(10);
  expect(Math.hypot(g.x2 - ex, g.y2 - ey)).toBeGreaterThan(10);
});

test('hovering a flow shows its description and lights its two processes', async ({ page }) => {
  await openApp(page);
  await flow(page, PR, EPD).locator('.head').hover({ force: true });
  await expect(page.locator('#tooltip')).toHaveClass(/show/);
  await expect(page.locator('#tooltip')).toHaveText(/Product roadmap → Early product design\s+Which research bets to shape into concepts/);
  await expect(flow(page, PR, EPD)).toHaveClass(/hover/);
  await expect(flow(page, EPD, PMA)).toHaveClass(/dim/);
  await expect(card(page, PR).locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, EPD).locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, DR).locator('.body')).toHaveClass(/dim/);
  await page.mouse.move(700, 880);
  await expect(page.locator('#tooltip')).not.toHaveClass(/show/);
  await expect(page.locator('#stage g.flow.dim')).toHaveCount(0);
});

test('hovering a process lights its flows and the processes they link to', async ({ page }) => {
  await openApp(page);
  await card(page, EPD).hover();
  await expect(flow(page, PR, EPD)).not.toHaveClass(/dim/);
  await expect(flow(page, EPD, PMA)).not.toHaveClass(/dim/);
  await expect(flow(page, PR, DR)).toHaveClass(/dim/);
  await expect(card(page, PMA).locator('.body')).not.toHaveClass(/dim/);
  await expect(card(page, DR).locator('.body')).toHaveClass(/dim/);
});

test('the legend hides flows: a view setting, reset when a file loads', async ({ page }) => {
  await openApp(page);
  const row = page.locator('#legend li.flows-row');
  await expect(row).toContainText('Process flows');
  await expect(row.locator('.count')).toHaveText('4');
  await row.locator('.eye').click();
  expect((await state(page)).hideFlows).toBe(true);
  await expect(flows(page)).toHaveCount(0);
  await expect(row).toHaveClass(/hidden-flows/);
  await expect(row.locator('.eye')).toHaveAttribute('aria-pressed', 'true');
  const st = await state(page);
  expect(st.undo).toBe(0);
  expect(st.dirty).toBe(false);
  expect((await data(page)).flows).toHaveLength(4);
  // Hidden flows don't pull processes into focus either.
  await page.evaluate(() => window.orrery.focus('pro-early-product-design'));
  await expect(card(page, PR)).toHaveCount(0);
  await page.click('#btn-unfocus');
  // Clicking the row shows them again.
  await row.click();
  await expect(flows(page)).toHaveCount(4);
  await row.click();
  await page.evaluate(() => window.orrery.loadExample());
  expect((await state(page)).hideFlows).toBe(false);
  await expect(flows(page)).toHaveCount(4);
  // No flows, no row.
  await page.evaluate(() => window.orrery.load({ ...window.orrery.example(), flows: [] }));
  await expect(row).toHaveCount(0);
  await expect(page.locator('#legend li.sep')).toHaveCount(0);
});

test('right-dragging from one process to another adds a flow in that direction', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  await rightDrag(page, await center(card(page, PMA)), await center(card(page, PR)));
  let d = await data(page);
  expect(d.flows).toHaveLength(5);
  const made = d.flows[4];
  expect(made).toMatchObject({ from: PMA, to: PR, description: '', documents: [] });
  expect((await state(page)).sel).toBe(PMA);
  await expect(flow(page, PMA, PR)).toHaveCount(1);
  // The new flow's description box is ready to type in.
  const input = page.locator(`#detail [data-flow="${made.id}"] input.note-input`);
  await expect(input).toBeFocused();
  await page.keyboard.type('Launch results and customer response');
  await page.keyboard.press('Enter');
  expect((await data(page)).flows[4].description).toBe('Launch results and customer response');

  // The same direction again is refused.
  await rightDrag(page, await center(card(page, PMA)), await center(card(page, PR)));
  await expect(page.locator('#toast')).toContainText('That flow already exists.');
  expect((await data(page)).flows).toHaveLength(5);
  // The other direction makes it two-way.
  await rightDrag(page, await center(card(page, PR)), await center(card(page, PMA)));
  await expect(flow(page, PMA, PR)).toHaveClass(/\btwo\b/);
  await expect(flow(page, PR, PMA)).toHaveClass(/\btwo\b/);
  // Undo takes it back. (The new flow's description box has focus, so use the app's undo rather than Ctrl+Z.)
  await page.evaluate(() => window.orrery.undo());
  expect((await data(page)).flows).toHaveLength(5);
});

test('a hidden flow reappears when a new one is drawn', async ({ page }) => {
  await openApp(page);
  await page.locator('#legend li.flows-row .eye').click();
  await page.keyboard.press('e');
  await rightDrag(page, await center(card(page, PMA)), await center(card(page, PR)));
  expect((await state(page)).hideFlows).toBe(false);
  await expect(flows(page)).toHaveCount(5);
});

test('right-clicking a flow in edit mode reverses or deletes it', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('e');
  await rightClick(page, await center(flow(page, PR, EPD).locator('.head')));
  await page.getByRole('menuitem', { name: 'Reverse direction' }).click();
  await expect(flow(page, EPD, PR)).toHaveCount(1);
  await expect(flow(page, PR, EPD)).toHaveCount(0);
  // A two-way flow can't be reversed.
  await rightClick(page, await center(flow(page, PR, DR).locator('.head')));
  await expect(page.getByRole('menuitem', { name: 'Reverse direction' })).toBeDisabled();
  await page.getByRole('menuitem', { name: 'Delete flow' }).click();
  await expect(flow(page, PR, DR)).toHaveCount(0);
  await expect(flow(page, DR, PR)).not.toHaveClass(/\btwo\b/);
  expect((await data(page)).flows).toHaveLength(3);
});

test('the process panel lists what feeds it and what it feeds', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.select('pro-product-roadmap'));
  await expect(section(page, 'fed-by').locator('.sec-head')).toContainText('Fed by');
  await expect(section(page, 'feeds').locator('.sec-head')).toContainText('Feeds into');
  await expect(section(page, 'fed-by').locator('.flow-item')).toHaveCount(1);
  await expect(section(page, 'feeds').locator('.flow-item')).toHaveCount(2);
  // Order: roles, fed by, feeds into, meetings, documents.
  const order = await page.locator('#detail .body > section').evaluateAll(s => s.map(x => x.dataset.section));
  expect(order).toEqual(['description', 'roles', 'fed-by', 'feeds', 'meetings', 'documents']);
  const dr = flowItem(page, 'feeds', DR);
  await expect(dr.locator('.tag')).toHaveText('Two-way');
  await expect(dr.locator('.note')).toHaveText('Priorities and target dates the design function plans against');
  await expect(dr.locator('.carries .tile')).toHaveText('Product roadmap');
  await expect(dr.locator('.warn')).toHaveCount(1);
  await expect(flowItem(page, 'feeds', EPD).locator('.tag')).toHaveCount(0);
  await expect(flowItem(page, 'feeds', EPD).locator('.carries')).toHaveCount(0);
  // Following a carried document or a linked process goes there.
  await dr.locator('.carries .tile').click();
  expect((await state(page)).sel).toBe('doc-product-roadmap');
  await page.evaluate(() => window.orrery.select('pro-product-marketing-announcement'));
  await expect(section(page, 'feeds').locator('.none')).toHaveText('Doesn’t feed any process.');
  await flowItem(page, 'fed-by', EPD).locator('.tile').click();
  expect((await state(page)).sel).toBe(EPD);
});

test('editing flows from the panel: description, reverse, remove and add', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('pro-early-product-design'); });
  const fromPR = flowItem(page, 'fed-by', PR);
  const desc = fromPR.locator('input.note-input');
  await expect(desc).toHaveValue('Which research bets to shape into concepts');
  await desc.fill('Priority research bets');
  await desc.press('Enter');
  expect((await data(page)).flows.find(f => f.from === PR && f.to === EPD).description).toBe('Priority research bets');

  // Reverse moves it from "Fed by" to "Feeds into".
  await fromPR.getByRole('button', { name: 'Reverse direction' }).click();
  await expect(flowItem(page, 'feeds', PR)).toHaveCount(1);
  await expect(flowItem(page, 'fed-by', PR)).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(flowItem(page, 'fed-by', PR)).toHaveCount(1);

  // Add an input from an existing process, and an output to a new one.
  const inFinder = section(page, 'fed-by').locator('.finder input');
  await inFinder.fill('Design road');
  await inFinder.press('Enter');
  expect((await data(page)).flows.some(f => f.from === DR && f.to === EPD)).toBe(true);
  const outFinder = section(page, 'feeds').locator('.finder input');
  await outFinder.fill('Customer pilots');
  await expect(section(page, 'feeds').locator('.results .create')).toHaveText('Create process “Customer pilots”');
  await outFinder.press('Enter');
  let d = await data(page);
  const pilots = d.processes.find(p => p.name === 'Customer pilots');
  expect(d.flows.some(f => f.from === EPD && f.to === pilots.id)).toBe(true);
  // A process already linked in that direction isn't offered again.
  await inFinder.fill('Product road');
  await expect(section(page, 'fed-by').locator('.results .create')).toHaveText('Create process “Product road”');
  await expect(section(page, 'fed-by').locator('.results button:not(.create)')).toHaveCount(0);
  await inFinder.evaluate(e => e.blur());

  // Remove.
  await flowItem(page, 'feeds', pilots.id).getByRole('button', { name: /Remove flow/ }).click();
  d = await data(page);
  expect(d.flows.some(f => f.to === pilots.id)).toBe(false);

  // Reverse is off for a two-way flow.
  await page.evaluate(() => window.orrery.select('pro-product-roadmap'));
  await expect(flowItem(page, 'fed-by', DR).getByRole('button', { name: 'Reverse direction' })).toBeDisabled();
  await expect(flowItem(page, 'fed-by', DR).locator('.tag')).toHaveCount(0);   // the Two-way tag is for reading
});

test('carried documents: the source process’s own come first; new ones join it', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('pro-early-product-design'); });
  const toPMA = flowItem(page, 'feeds', PMA);
  await toPMA.locator('.carry-add').click();
  const results = page.locator('#menu .results button');
  await expect(results.first()).toContainText('Product initiation document');
  await expect(results.first().locator('.sub')).toHaveText('In Early product design');
  await expect(results.nth(1)).toContainText('Technical feasibility document');
  await results.nth(1).click();
  const f = () => data(page).then(d => d.flows.find(x => x.from === EPD && x.to === PMA));
  expect((await f()).documents).toEqual(['doc-technical-feasibility']);
  await expect(toPMA.locator('.carries .tile')).toHaveText('Technical feasibility document');
  await toPMA.getByRole('button', { name: 'Stop carrying Technical feasibility document' }).click();
  expect((await f()).documents).toEqual([]);

  // Creating a document from here also adds it to the source process.
  await toPMA.locator('.carry-add').click();
  await page.locator('#menu .finder input').fill('Launch brief');
  await page.locator('#menu .finder input').press('Enter');
  const d = await data(page);
  const brief = d.documents.find(x => x.name === 'Launch brief');
  expect((await f()).documents).toEqual([brief.id]);
  expect(d.processes.find(p => p.id === EPD).documents).toContain(brief.id);
  expect((await page.evaluate(() => window.orrery.warnings())).filter(w => w.rule === 'flow-doc-outside')).toHaveLength(0);
});

test('deleting a process removes its flows; deleting a document removes it from flows', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.orrery.edit(true); window.orrery.select('pro-product-roadmap'); });
  await page.locator('#detail .delete').click();
  let d = await data(page);
  expect(d.flows.map(f => [f.from, f.to])).toEqual([[EPD, PMA]]);
  await expect(flows(page)).toHaveCount(1);
  await page.keyboard.press('Control+z');
  expect((await data(page)).flows).toHaveLength(4);
  await page.evaluate(() => window.orrery.select('doc-product-roadmap'));
  await page.locator('#detail .delete').click();
  d = await data(page);
  expect(d.flows.find(f => f.from === PR && f.to === DR).documents).toEqual([]);
});

test('focus on a process: roles on the inner ring, flow partners outside — fed by left, feeds right, both ways above or below', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.focus('pro-early-product-design'));
  await expect(flows(page)).toHaveCount(2);
  const [prx, pry] = await pos(page, PR), [pmx, pmy] = await pos(page, PMA);
  expect(prx).toBeLessThan(0);
  expect(Math.abs(pry)).toBeLessThan(1);
  expect(pmx).toBeGreaterThan(0);
  expect(Math.abs(pmy)).toBeLessThan(1);
  const [sx, sy] = await pos(page, 'rol-system-engineer');
  expect(Math.hypot(sx, sy)).toBeLessThan(Math.hypot(prx, pry));
  // The inner ring turns to keep roles off the horizontal, where the flows run.
  for (const id of ['rol-research-manager', 'rol-scientist', 'rol-project-lead', 'rol-engineering-manager', 'rol-system-engineer', 'rol-design-engineer']) {
    const [x, y] = await pos(page, id);
    expect(Math.abs(y)).toBeGreaterThan(10);
  }

  await page.evaluate(() => window.orrery.focus('pro-product-roadmap'));
  const [dx, dy] = await pos(page, DR), [ex, ey] = await pos(page, EPD);
  expect(Math.abs(dx)).toBeLessThan(1);   // both ways: top or bottom
  expect(Math.abs(dy)).toBeGreaterThan(200);
  expect(ex).toBeGreaterThan(200);        // feeds: right
  await expect(flows(page)).toHaveCount(3);
  await expect(page.locator('#stage g.flow.two')).toHaveCount(2);
  // No role sits on a flow's line, whichever side the flow leaves from.
  const flowAngles = [Math.atan2(dy, dx), Math.atan2(ey, ex)];
  for (const id of ['rol-research-manager', 'rol-market-analyst', 'rol-marketing-manager']) {
    const [x, y] = await pos(page, id);
    for (const f of flowAngles) expect(Math.abs(Math.atan2(Math.sin(Math.atan2(y, x) - f), Math.cos(Math.atan2(y, x) - f)))).toBeGreaterThan(0.4);
  }

  // A role's focus has no outer ring.
  await page.evaluate(() => window.orrery.focus('rol-market-analyst'));
  await expect(page.locator('#stage g.card')).toHaveCount(3);
  await expect(flows(page)).toHaveCount(0);
});

test('warnings: no role in common, once per pair, and documents from outside the source', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const d = window.orrery.example();
    d.flows[2].documents.push('doc-product-announcement');   // Product roadmap → Early product design, but PMA's document
    window.orrery.load(d);
  });
  const w = await page.evaluate(() => window.orrery.warnings());
  expect(w.map(x => x.rule).sort()).toEqual(['flow-doc-outside', 'flow-no-shared-role']);
  expect(w.find(x => x.rule === 'flow-no-shared-role').text).toContain('feed each other');
  expect(w.find(x => x.rule === 'flow-doc-outside').text).toContain('Product announcement');

  // Triangles: in both processes' panels, and on table rows.
  await page.evaluate(() => window.orrery.select('pro-design-roadmap'));
  await expect(flowItem(page, 'fed-by', PR).locator('.warn')).toHaveCount(1);
  await expect(flowItem(page, 'feeds', PR).locator('.warn')).toHaveCount(1);
  await page.evaluate(() => window.orrery.select('pro-early-product-design'));
  await expect(flowItem(page, 'fed-by', PR).locator('.warn')).toHaveAttribute('data-tip', /isn’t one of “Product roadmap”’s documents/);
  await page.evaluate(() => window.orrery.setView('process'));
  await expect(page.locator(`#stage g.card[data-col="${PR}"][data-id="${DR}"] .warn`)).toHaveCount(2);
  await expect(page.locator(`#stage g.card[data-col="${EPD}"][data-id="${PR}"] .warn`)).toHaveCount(1);

  // The list shows both ends, and the document.
  await page.keyboard.press('w');
  const dlg = page.locator('#warnings');
  await expect(dlg.locator('[data-rule="flow-no-shared-role"] .w-item')).toHaveCount(1);
  await expect(dlg.locator('[data-rule="flow-no-shared-role"] .joiner')).toHaveText('⇄');
  await expect(dlg.locator('[data-rule="flow-doc-outside"] .joiner')).toHaveText(['→', 'carries']);
  await dlg.locator('[data-rule="flow-doc-outside"] .tile').last().click();
  expect((await state(page)).sel).toBe('doc-product-announcement');

  // Sharing a role clears it.
  await page.evaluate(() => {
    const d = window.orrery.example();
    d.processes[1].roles.push({ role: 'rol-market-analyst', raci: ['I'] });
    window.orrery.load(d);
  });
  expect(await page.evaluate(() => window.orrery.warnings())).toEqual([]);
});

test('process table: flows in under the header, flows out at the end of the column', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.orrery.setView('process'));
  const rows = await page.locator(`#stage g.card[data-col="${PR}"][data-kind="row"]`).evaluateAll(els =>
    els.map(e => ({ id: e.dataset.id, flow: e.classList.contains('flow-row'), icon: e.querySelector('use.kicon')?.getAttribute('href'), y: e.getBoundingClientRect().y }))
      .sort((a, b) => a.y - b.y).map(({ id, flow, icon }) => ({ id, flow, icon })));
  expect(rows[0]).toEqual({ id: DR, flow: true, icon: '#i-flow-in' });
  expect(rows.slice(-2)).toEqual([{ id: DR, flow: true, icon: '#i-flow-out' }, { id: EPD, flow: true, icon: '#i-flow-out' }]);
  expect(rows.filter(r => r.flow)).toHaveLength(3);
  // A flow row's description shows on hover.
  await expect(page.locator(`#stage g.card[data-col="${PR}"][data-id="${EPD}"] .body`)).toHaveAttribute('data-tip', 'Feeds Early product design: Which research bets to shape into concepts');
  // Clicking a flow row selects that process.
  await page.locator(`#stage g.card[data-col="${PR}"][data-id="${EPD}"]`).click();
  expect((await state(page)).sel).toBe(EPD);
});
