/* Robustness: the site degrades honestly.
 *
 * Without JavaScript the boot gate never runs, so the landing (static, readable)
 * must show instead of the tool — and its JS-gated reveals must not leave the
 * content at opacity:0. With JS, the clipboard buttons must only claim success
 * when the write actually resolves, not flash "Copied" on a missing API or a
 * rejected write. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const errors = [];

// ---- no JavaScript: the landing is the fallback ----
const njs = await browser.newContext({ javaScriptEnabled: false });
const p1 = await njs.newPage();
await p1.goto(BASE, { waitUntil: 'domcontentloaded' });
assert('no-JS: the tool view is hidden', (await p1.evaluate(() => getComputedStyle(document.getElementById('toolview')).display)) === 'none');
assert('no-JS: the landing is shown', (await p1.evaluate(() => getComputedStyle(document.getElementById('landing')).display)) !== 'none');
assert('no-JS: the hero content is revealed (not stuck at opacity:0)',
  (await p1.evaluate(() => getComputedStyle(document.querySelector('.lhead')).opacity)) === '1');
assert('no-JS: a note explains the tool needs JavaScript',
  await p1.evaluate(() => { const n = document.querySelector('.nojs-note'); return !!n && n.offsetParent !== null; }));
// a deep link (share URL / #tool) with no JS stays on the landing, not a blank tool
const p2 = await njs.newPage();
await p2.goto(BASE + '#tool', { waitUntil: 'domcontentloaded' });
assert('no-JS: a deep link still shows the landing, not a dead tool',
  (await p2.evaluate(() => getComputedStyle(document.getElementById('toolview')).display)) === 'none');
await njs.close();

// ---- with JavaScript: the tool still boots, and clipboard feedback is honest ----
const js = await browser.newContext();
await js.grantPermissions(['clipboard-read', 'clipboard-write']);
const p = await js.newPage();
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', e => errors.push('pageerror: ' + e.message));
await p.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(300);
assert('JS: the tool view boots on #tool', (await p.evaluate(() => getComputedStyle(document.getElementById('toolview')).display)) !== 'none');

const exp = p.locator('#exportToggle');
if (await exp.count()) await exp.click();
// success path: the write resolves → "Copied ✓", then restores
await p.click('#copy');
await p.waitForTimeout(150);
assert('JS: a successful copy says "Copied"', /copied/i.test(await p.$eval('#copy', el => el.textContent)));
await p.waitForTimeout(1300);
assert('JS: the copy label restores', (await p.$eval('#copy', el => el.textContent)) === 'Copy');
// failure path: a rejected write must NOT claim success
await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
await p.click('#copy');
await p.waitForTimeout(200);
const failLabel = await p.$eval('#copy', el => el.textContent);
assert('JS: a failed copy does not lie about success', !/copied/i.test(failLabel) && failLabel !== 'Copy');

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
