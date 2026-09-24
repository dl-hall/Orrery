// Captures the key screens for visual review: node screenshots.js [outDir]
const { chromium } = require('@playwright/test');
const path = require('path');
const { openApp } = require('./helpers');

(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'screenshots'));
  const browser = await chromium.launch({ channel: 'msedge' });
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    await openApp(page);
    await page.evaluate(() => window.orrery.fit({ animate: false }));
    const shot = (n) => page.screenshot({ path: path.join(out, `${scheme}-${n}.png`) });
    await shot('01-graph');
    await page.evaluate(() => window.orrery.select('rol-system-engineer'));
    await shot('02-role-panel');
    await page.hover('#stage g.card[data-id="pro-early-product-design"]');
    await shot('03-hover');
    await page.mouse.move(800, 10); await page.waitForTimeout(250);
    await page.fill('#search-input', 'design');
    await shot('04-search');
    await page.fill('#search-input', ''); await page.mouse.move(800, 500);
    await page.evaluate(() => window.orrery.select('pro-early-product-design'));
    await shot('05-process-panel');
    await page.evaluate(() => window.orrery.select('mtg-quarterly-design-review'));
    await shot('06-meeting-panel');
    await page.evaluate(() => window.orrery.select('doc-product-announcement'));
    await shot('07-document-panel');
    await page.evaluate(() => { window.orrery.select('pro-early-product-design'); window.orrery.edit(true); });
    await shot('08-edit-process');
    await page.evaluate(() => window.orrery.edit(false));
    // Process flows
    await page.evaluate(() => window.orrery.select('pro-product-roadmap'));
    await shot('12-flows-panel');
    await page.evaluate(() => window.orrery.edit(true));
    await shot('13-flows-edit');
    await page.evaluate(() => window.orrery.edit(false));
    await page.hover('#stage g.flow[data-from="pro-product-roadmap"][data-to="pro-early-product-design"] .head', { force: true });
    await shot('14-flow-hover');
    await page.mouse.move(800, 880);
    await page.evaluate(() => window.orrery.focus('pro-early-product-design'));
    await page.evaluate(() => window.orrery.fit({ animate: false }));
    await shot('15-focus-flows');
    await page.evaluate(() => window.orrery.focus('pro-product-roadmap'));
    await page.evaluate(() => window.orrery.fit({ animate: false }));
    await shot('16-focus-two-way');
    await page.evaluate(() => window.orrery.focus(null));
    await page.click('#legend li.flows-row .eye');
    await shot('17-flows-hidden');
    await page.click('#legend li.flows-row .eye');
    for (const v of ['process', 'role', 'meeting']) {
      await page.evaluate((v) => window.orrery.setView(v), v);
      await page.waitForTimeout(100);
      await shot(`09-table-${v}`);
    }
    await page.evaluate(() => window.orrery.setView('graph'));
    await page.click('#sub-toggle');
    await page.mouse.move(800, 880); await page.waitForTimeout(250);
    await shot('10-subpanel-zoom');
    await page.evaluate(() => window.orrery.load({}));
    await shot('11-empty');
    await page.close();
  }
  await browser.close();
  console.log('Screenshots in', out);
})();
