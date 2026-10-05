// Embeds d3 from node_modules into orrery.html, between the d3 start/end markers (or in place of the CDN tag).
// Run after `npm install` whenever d3's version changes: node embed-d3.js
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', 'orrery.html');
const D3 = path.resolve(__dirname, 'node_modules', 'd3', 'dist', 'd3.min.js');
const version = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'node_modules', 'd3', 'package.json'), 'utf8')).version;

const LICENCE = `<!-- d3 v${version}, embedded so Orrery works offline. https://d3js.org
Copyright 2010-2023 Mike Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE. Regenerate with tests/embed-d3.js. -->`;

// The embedded d3 source sits between these markers. Git may check the page out with CRLF endings, so allow either.
const BLOCK = /<!-- d3 start -->\r?\n<script>\r?\n([\s\S]*?)\r?\n<\/script>\r?\n<!-- d3 end -->/;
const LICENCE_RE = /<!-- d3 v[\d.]+, embedded[\s\S]*?-->\r?\n/;
const CDN = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/d3@[^"]+"><\/script>/;
/** Line endings ignored, so a CRLF checkout still compares equal. */
const sameText = (a, b) => a.replace(/\r\n/g, '\n').replace(/\n$/, '') === b.replace(/\r\n/g, '\n').replace(/\n$/, '');

function embed() {
  const html = fs.readFileSync(APP, 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const d3 = fs.readFileSync(D3, 'utf8').replace(/\r?\n$/, '').replace(/\r?\n/g, eol);
  if (/<\/script|<!--/i.test(d3)) throw new Error('d3.min.js contains text that would end the inline script early.');
  const block = ['<!-- d3 start -->', '<script>', d3, '</script>', '<!-- d3 end -->'].join(eol);
  const licence = LICENCE.replace(/\n/g, eol);
  let out;
  if (BLOCK.test(html)) out = html.replace(LICENCE_RE, () => licence + eol).replace(BLOCK, () => block);
  else if (CDN.test(html)) out = html.replace(CDN, () => licence + eol + block);
  else throw new Error('Found neither the d3 markers nor the CDN script tag in orrery.html.');
  fs.writeFileSync(APP, out);
  console.log(`Embedded d3 ${version} (${d3.length} bytes) in ${path.relative(process.cwd(), APP)}.`);
}

if (require.main === module) embed();
module.exports = { APP, D3, BLOCK, sameText, version };
