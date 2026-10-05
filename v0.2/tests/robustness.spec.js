const { test, expect } = require('./helpers');
const fs = require('fs');
const path = require('path');
const { openApp, card, state, data, overlaps, FIXTURES } = require('./helpers');
const { APP: APP_FILE, D3, BLOCK, sameText, version } = require('./embed-d3');

/* ── d3 is embedded ── */

test('the page carries d3 itself, byte for byte the version in node_modules', () => {
  const m = BLOCK.exec(fs.readFileSync(APP_FILE, 'utf8'));
  expect(m).toBeTruthy();
  expect(sameText(m[1], fs.readFileSync(D3, 'utf8'))).toBe(true);
  expect(m[1]).toContain(`d3js.org v${version}`);
});

test('the app works with no access to a CDN', async ({ page }) => {
  const asked = [];
  await page.route('**/cdn.jsdelivr.net/**', r => { asked.push(r.request().url()); return r.abort(); });
  await openApp(page);
  expect(await page.evaluate(() => d3.version)).toBe(version);
  await expect(card(page, 'rol-scientist')).toBeVisible();
  expect(asked).toEqual([]);
});

/* ── Safe save ── */

/**
 * Open a stand-in for a file on disk through a fake File System Access API. window.__disk records what happens:
 * writes in place, Save as calls, and switches to make the next step fail.
 */
async function openFakeFile(page) {
  await openApp(page, { pickers: true });
  await page.evaluate(() => {
    const disk = window.__disk = {
      text: JSON.stringify(window.orrery.example()), modified: 1000, writes: 0, aborts: 0,
      savedAs: 0, copy: null, cancelSaveAs: false, getFileError: null, writeError: null,
    };
    const handle = (name, isCopy) => ({
      name,
      getFile: async () => {
        if (!isCopy && disk.getFileError) throw new DOMException('The file could not be found.', disk.getFileError);
        return new File([isCopy ? disk.copy : disk.text], name, { lastModified: isCopy ? 2000 : disk.modified });
      },
      createWritable: async () => {
        let buf = '';
        return {
          write: async (t) => { if (!isCopy && disk.writeError) throw new DOMException('The file is locked.', disk.writeError); buf += t; },
          close: async () => { if (isCopy) disk.copy = buf; else { disk.text = buf; disk.writes++; disk.modified++; } },
          abort: async () => { disk.aborts++; },
        };
      },
    });
    window.showOpenFilePicker = async () => [handle('live.json', false)];
    window.showSaveFilePicker = async () => {
      disk.savedAs++;
      if (disk.cancelSaveAs) throw new DOMException('The user aborted a request.', 'AbortError');
      return handle('copy.json', true);
    };
  });
  await page.click('#btn-open');
  await expect.poll(async () => (await state(page)).fileName).toBe('live.json');
}
const disk = (page) => page.evaluate(() => ({ ...window.__disk, text: undefined, copy: undefined }));
const editTitle = (page, title) => page.evaluate((t) => window.orrery.commit('rename', d => { d.title = t; }), title);

test('Save writes in place when nothing is wrong', async ({ page }) => {
  await openFakeFile(page);
  await editTitle(page, 'Edited');
  await page.click('#btn-save');
  await expect(page.locator('#toast')).toContainText('Saved live.json');
  expect(await disk(page)).toMatchObject({ writes: 1, savedAs: 0 });
  expect(await page.evaluate(() => JSON.parse(window.__disk.text).title)).toBe('Edited');
});

test('an edit that fails part-way is undone, and Save then asks for a new name', async ({ page }) => {
  await openFakeFile(page);
  const before = await data(page);
  // Thrown from an event, as a real fault would be, so the page's own error handler sees it.
  await page.evaluate(() => setTimeout(() => window.orrery.commit('break', d => { d.title = 'Half done'; d.roles.pop(); throw new Error('boom'); })));
  await expect(page.locator('#toast')).toContainText('Something went wrong');
  expect(await data(page)).toEqual(before);
  expect(await state(page)).toMatchObject({ faulted: true, undo: 0, dirty: false });

  await editTitle(page, 'After the fault');
  await page.click('#btn-save');
  await expect(page.locator('#toast')).toContainText('Saved copy.json');
  expect(await disk(page)).toMatchObject({ writes: 0, savedAs: 1 });
  expect(await page.evaluate(() => JSON.parse(window.__disk.copy).title)).toBe('After the fault');
  // The copy holds this session's work, so later saves go to it without asking again.
  expect((await state(page)).faulted).toBe(false);
  await editTitle(page, 'Again');
  await page.click('#btn-save');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.__disk.copy).title)).toBe('Again');
  expect(await disk(page)).toMatchObject({ writes: 0, savedAs: 1 });
});

test('Save won’t overwrite the file with a model that fails its check', async ({ page }) => {
  test.info().annotations.push({ type: 'invalid-model' });
  await openFakeFile(page);
  // A link with no address can't come back from the file: reopening would drop it.
  await page.evaluate(() => { window.orrery.liveData().roles[0].links.push({ label: 'Nowhere', url: '' }); window.__disk.cancelSaveAs = true; });
  expect((await page.evaluate(() => window.orrery.checkModel())).ok).toBe(false);
  await page.click('#btn-save');
  await expect(page.locator('#toast')).toContainText('found a problem in this organisation, so it didn’t overwrite live.json');
  expect(await disk(page)).toMatchObject({ writes: 0, savedAs: 1 });
});

test('Save asks before overwriting a file that changed on disk since it was opened', async ({ page }) => {
  await openFakeFile(page);
  await editTitle(page, 'Mine');
  await page.evaluate(() => { window.__disk.modified = 5000; });   // someone else saved it meanwhile
  const asked = [];
  page.once('dialog', d => { asked.push(d.message()); d.dismiss(); });
  await page.click('#btn-save');
  await expect(page.locator('#toast')).toHaveText('Not saved.');
  expect(asked[0]).toContain('live.json has changed on disk since you opened it');
  expect(await disk(page)).toMatchObject({ writes: 0, savedAs: 0 });
  expect((await state(page)).dirty).toBe(true);

  page.once('dialog', d => { asked.push(d.message()); d.accept(); });
  await page.click('#btn-save');
  await expect(page.locator('#toast')).toContainText('Saved live.json');
  expect(await disk(page)).toMatchObject({ writes: 1 });
  // Our own write doesn't count as a change made elsewhere.
  await editTitle(page, 'Mine again');
  await page.click('#btn-save');
  await expect.poll(async () => (await disk(page)).writes).toBe(2);
  expect(asked).toHaveLength(2);
});

test('Save explains, and asks for a new name, when the file has gone', async ({ page }) => {
  await openFakeFile(page);
  await editTitle(page, 'Edited');
  await page.evaluate(() => { window.__disk.getFileError = 'NotFoundError'; window.__disk.cancelSaveAs = true; });
  await page.click('#btn-save');
  await expect(page.locator('#toast')).toContainText('Couldn’t find live.json where it was opened');
  expect(await disk(page)).toMatchObject({ writes: 0, savedAs: 1 });
});

test('Save explains, and asks for a new name, when the file can’t be written', async ({ page }) => {
  await openFakeFile(page);
  await editTitle(page, 'Edited');
  await page.evaluate(() => { window.__disk.writeError = 'NoModificationAllowedError'; window.__disk.cancelSaveAs = true; });
  await page.click('#btn-save');
  await expect(page.locator('#toast')).toContainText('Couldn’t write to live.json');
  expect(await disk(page)).toMatchObject({ writes: 0, aborts: 1, savedAs: 1 });
  expect((await state(page)).dirty).toBe(true);
});

/* ── Content-Security-Policy ── */

test('the page can’t contact other servers', async ({ page }) => {
  test.info().annotations.push({ type: 'csp-violation' });
  // If the policy failed, these would succeed: answer them, so a leak shows as "sent" rather than a network error.
  let reached = 0;
  await page.route('https://example.com/**', r => { reached++; return r.fulfill({ status: 200, body: 'ok', headers: { 'Access-Control-Allow-Origin': '*' } }); });
  await openApp(page);
  const fetched = await page.evaluate(() => fetch('https://example.com/x?data=secret').then(() => 'sent', () => 'blocked'));
  expect(fetched).toBe('blocked');
  const img = await page.evaluate(() => new Promise(res => { const i = new Image(); i.onload = () => res('loaded'); i.onerror = () => res('blocked'); i.src = 'https://example.com/pixel.png'; }));
  expect(img).toBe('blocked');
  const script = await page.evaluate(() => new Promise(res => { const s = document.createElement('script'); s.onload = () => res('loaded'); s.onerror = () => res('blocked'); s.src = 'https://example.com/x.js'; document.head.append(s); }));
  expect(script).toBe('blocked');
  expect(reached).toBe(0);
  const violations = await page.evaluate(() => window.__cspViolations);
  expect(violations).toEqual(expect.arrayContaining([expect.stringMatching(/^connect-src/), expect.stringMatching(/^img-src/), expect.stringMatching(/^script-src/)]));
});

test('links on items still open in a new tab', async ({ page }) => {
  await page.context().route('https://contoso.sharepoint.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>ok</title>' }));
  await openApp(page);
  await page.evaluate(() => window.orrery.select('pro-early-product-design'));
  const [tab] = await Promise.all([page.context().waitForEvent('page'), page.locator('#detail a.link').first().click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toContain('contoso.sharepoint.com');
});

/* ── Files from a newer Orrery ── */

test('format versions compare as numbers', async ({ page }) => {
  await openApp(page);
  const newer = await page.evaluate(() => ['0.3', '0.10', '1.0', 0.3, '0.2', '0.1', '', null, 'abc', '0.2.1', undefined].map(v => window.orrery.isNewerFormat(v)));
  expect(newer).toEqual([true, true, true, true, false, false, false, false, false, false, false]);
});

test('a file from a newer Orrery asks first, and Save then won’t overwrite it', async ({ page }) => {
  await openFakeFile(page);
  // The file on disk now says it came from Orrery 0.3.
  await page.evaluate(() => { const j = JSON.parse(window.__disk.text); j.orrery = '0.3'; j.title = 'From the future'; window.__disk.text = JSON.stringify(j); });
  await page.evaluate(() => window.orrery.edit(false));
  const asked = [];
  page.once('dialog', d => { asked.push(d.message()); d.dismiss(); });
  await page.click('#btn-open');
  await expect(page.locator('#toast')).toHaveText('Nothing was changed.');
  expect(asked[0]).toContain('live.json was saved by Orrery 0.3. This is Orrery 0.2');
  expect((await data(page)).title).toBe('Product organisation');

  page.once('dialog', d => { asked.push(d.message()); d.accept(); });
  await page.click('#btn-open');
  await expect(page.locator('#toast')).toContainText('Save will ask for a new name');
  expect((await data(page)).title).toBe('From the future');
  await page.evaluate(() => { window.__disk.cancelSaveAs = true; });
  await page.click('#btn-save');
  await expect.poll(async () => (await disk(page)).savedAs).toBe(1);
  expect((await disk(page)).writes).toBe(0);
});

test('files from this or an older Orrery open without asking', async ({ page }) => {
  await openApp(page, { example: false });
  page.on('dialog', d => { throw new Error('Unexpected dialog: ' + d.message()); });
  for (const v of ['0.2', '0.1', null, 'abc']) {
    const text = JSON.stringify({ ...(v === null ? {} : { orrery: v }), title: `v ${v}` });
    expect(await page.evaluate((t) => window.orrery.loadText(t, 'org.json'), text)).toBe(true);
    expect((await data(page)).title).toBe(`v ${v}`);
  }
});

/* ── Ids and fields named like JavaScript's built-ins ── */

// Never write these ids as object literals in a test: { "__proto__": … } sets a prototype instead of a key.
const saved = async (page) => JSON.parse(await page.evaluate(() => window.orrery.serialise()));

test('ids like "constructor" and "__proto__" lay out, pin and save like any other', async ({ page }) => {
  await openApp(page, { example: false });
  await page.setInputFiles('#file-input', path.join(FIXTURES, 'builtin-ids.json'));
  await expect(page.locator('#toast')).toHaveText('Opened builtin-ids.json.');
  await page.evaluate(() => window.orrery.settle());
  // Only the role the file pinned shows a pin, and it sits where the file put it.
  for (const id of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) await expect(card(page, id).locator('.pin')).toHaveCount(0);
  await expect(card(page, '__proto__').locator('.pin')).toHaveCount(1);
  expect(await card(page, '__proto__').getAttribute('transform')).toBe('translate(300,-200)');
  expect(await overlaps(page)).toEqual([]);

  const check = (f) => {
    expect(Object.keys(f.layout)).toEqual(['__proto__']);
    expect(f.layout['__proto__']).toEqual({ x: 300, y: -200 });
    expect(Object.keys(f)).toEqual(expect.arrayContaining(['__proto__', 'constructor']));
    expect(f['__proto__']).toEqual({ kept: true });
    expect(f.constructor).toBe('kept too');
    expect(f.roles.map(r => r.id)).toEqual(['constructor', 'toString', '__proto__']);
  };
  check(await saved(page));
  // Undo and redo copy the model; the odd keys have to survive that too.
  await page.evaluate(() => window.orrery.commit('rename', d => { d.title = 'Renamed'; }));
  await page.evaluate(() => window.orrery.undo());
  check(await saved(page));
  await page.evaluate(() => window.orrery.redo());
  check(await saved(page));
  expect((await saved(page)).title).toBe('Renamed');
});

/* ── Size limit ── */

const BIG = 21 * 1024 * 1024;
const refused = 'big.json is 21.0 MB, too big to be an Orrery file (limit 20 MB). Nothing was changed.';

test('a file over 20 MB is refused from the file input', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#file-input', { name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(BIG, ' ') });
  await expect(page.locator('#toast')).toHaveText(refused);
  expect((await data(page)).title).toBe('Product organisation');
});

test('a file over 20 MB is refused when dropped, without asking to discard changes first', async ({ page }) => {
  await openApp(page);
  await editTitle(page, 'Unsaved');
  page.on('dialog', d => { throw new Error('Unexpected dialog: ' + d.message()); });
  await page.evaluate((size) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(size)], 'big.json', { type: 'application/json' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, BIG);
  await expect(page.locator('#toast')).toHaveText(refused);
  expect(await state(page)).toMatchObject({ dirty: true });
  expect((await data(page)).title).toBe('Unsaved');
});

test('a file over 20 MB is refused from the open picker', async ({ page }) => {
  await openApp(page, { pickers: true });
  await page.evaluate((size) => {
    window.showOpenFilePicker = async () => [{ name: 'big.json', getFile: async () => new File([new Uint8Array(size)], 'big.json') }];
  }, BIG);
  await page.click('#btn-open');
  await expect(page.locator('#toast')).toHaveText(refused);
  expect((await data(page)).title).toBe('Product organisation');
});

test('a large but reasonable file still opens', async ({ page }) => {
  await openApp(page, { example: false });
  const org = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'large.json'), 'utf8'));
  org.roles[0].notes = 'x'.repeat(1024 * 1024);
  await page.setInputFiles('#file-input', { name: 'roomy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(org)) });
  await expect(page.locator('#toast')).toHaveText('Opened roomy.json.');
  expect((await data(page)).roles).toHaveLength(org.roles.length);
});
