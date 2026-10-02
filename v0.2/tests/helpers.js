const path = require('path');
const { pathToFileURL } = require('url');

const APP = pathToFileURL(path.resolve(__dirname, '..', 'orrery.html')).href;
const D3 = path.resolve(__dirname, 'node_modules', 'd3', 'dist', 'd3.min.js');
const FIXTURES = path.resolve(__dirname, 'fixtures');
const EXAMPLE_FILE = path.resolve(__dirname, '..', 'examples', 'product-org.json');

/** Open the app with d3 served locally and the File System Access pickers removed (so the fallbacks run). */
async function openApp(page, { example = true, pickers = false } = {}) {
  await page.route('**/d3@7*/**', r => r.fulfill({ path: D3, contentType: 'application/javascript' }));
  if (!pickers) await page.addInitScript(() => { window.showOpenFilePicker = undefined; window.showSaveFilePicker = undefined; });
  await page.goto(APP + (example ? '?example' : ''));
  await page.waitForFunction(() => window.orrery && document.fonts.status === 'loaded');
  await page.evaluate(() => window.orrery.settle());
}

const card = (page, id, kind) => page.locator(`#stage g.card[data-id="${id}"]${kind ? `[data-kind="${kind}"]` : ''}`).first();
const state = (page) => page.evaluate(() => window.orrery.state());
const data = (page) => page.evaluate(() => window.orrery.data());

async function center(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function rightDrag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up({ button: 'right' });
}
async function rightClick(page, at) {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
}
/** Left-drag from a card's connector handle (shown on hover in edit mode) to a point. */
async function handleDrag(page, cardLocator, to) {
  const c = await center(cardLocator);
  await page.mouse.move(c.x, c.y);   // hovering the card reveals its handle
  const from = await center(cardLocator.locator('.link-handle .knob'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}
/** Pairs of drawn cards whose boxes overlap on screen (a meeting card's box includes its person icons). */
async function overlaps(page) {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll('#stage g.card')].map(g => {
      const rs = [...g.querySelectorAll('.shape, .ppl')].map(e => e.getBoundingClientRect());
      return { id: g.dataset.id, x0: Math.min(...rs.map(r => r.left)), y0: Math.min(...rs.map(r => r.top)), x1: Math.max(...rs.map(r => r.right)), y1: Math.max(...rs.map(r => r.bottom)) };
    });
    const out = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) out.push([a.id, b.id]);
    }
    return out;
  });
}
/** An empty spot on the canvas (far from any card or panel). */
async function emptySpot(page) {
  return page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    for (let y = 120; y < H - 120; y += 23) for (let x = 360; x < W - 440; x += 29) {
      const el = document.elementFromPoint(x, y);
      if (el && (el.id === 'stage' || el.closest('.orbits'))) return { x, y };
    }
    return null;
  });
}

module.exports = { APP, FIXTURES, EXAMPLE_FILE, openApp, card, state, data, center, rightDrag, rightClick, handleDrag, overlaps, emptySpot };
