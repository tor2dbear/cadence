/* Icons are the inline SVG set, not platform unicode glyphs.
 *
 * The severity marks, the hero arrow, and the external-link mark are hand-drawn
 * SVGs referenced from a symbol sprite, so they render identically across
 * platforms and inherit their colour via currentColor. This guards that the
 * sprite exists, that the system read renders each finding's severity as a <use>
 * of the matching symbol (a regression back to a text glyph would fail), and that
 * the standalone affordances point at the sprite. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

await page.goto(BASE, { waitUntil: 'networkidle' });

// the sprite defines every icon in the set
const SYMS = ['ic-ok', 'ic-nit', 'ic-warn', 'ic-defect', 'ic-reload', 'ic-external', 'ic-arrow', 'ic-close', 'ic-play', 'ic-chevron'];
const haveSyms = await page.evaluate(ids => ids.every(id => !!document.getElementById(id)), SYMS);
assert('the icon sprite defines the whole set', haveSyms);

// landing affordances use the sprite, not glyphs
assert('the hero CTA uses the arrow icon', await page.locator('#startTool .gi use[href="#ic-arrow"]').count() === 1);
assert('the Source link uses the external icon', await page.locator('.lnav__link .gi use[href="#ic-external"]').count() === 1);
assert('the secondary CTA has no icon (single arrow rule)', await page.locator('.lcta a.lbtn .gi').count() === 0);

// play affordances and the distance chevron are drawn icons, not unicode glyphs
assert('the Live demo link uses the play icon', await page.locator('#demoLink .gi use[href="#ic-play"]').count() === 1);
assert('the distance toggle uses the chevron icon', await page.locator('#distToggle .chev-ic use[href="#ic-chevron"]').count() === 1);

// the system read renders each finding's severity as a <use> of the sprite, and
// the referenced symbol resolves (non-zero box)
// fresh load at #tool (a hash-only nav from the landing wouldn't re-run the boot
// gate, so the tool view would stay hidden)
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const svgCount = await page.locator('#hints .rd .ic svg use').count();
const rdCount = await page.locator('#hints .rd').count();
assert('every read finding renders an SVG severity mark', rdCount >= 3 && svgCount === rdCount);
assert('the ok findings reference the ok symbol', await page.locator('#hints .rd.ok .ic use[href="#ic-ok"]').count() >= 1);
const sizes = await page.$$eval('#hints .rd .ic svg', els => els.map(e => { const b = e.getBoundingClientRect(); return Math.min(b.width, b.height); }));
assert('every severity icon has a real rendered size', sizes.length >= 3 && sizes.every(s => s >= 10));

// a warning system maps to the warn/defect symbols (feed a redundant easing)
await page.evaluate(() => document.getElementById('addEasing').click());
await page.waitForTimeout(250);
assert('a warning finding references the warn or defect symbol',
  (await page.locator('#hints .rd.warn .ic use[href="#ic-warn"], #hints .rd.warn .ic use[href="#ic-defect"]').count()) >= 1);

// the tool view's disclosure + play + remove affordances are all drawn icons
assert('the Play all button uses the play icon', await page.locator('#playAll .gi use[href="#ic-play"]').count() === 1);
assert('every intent more/less toggle uses the chevron icon',
  (await page.locator('.intent__more .chev-ic use[href="#ic-chevron"]').count()) >= 1);
assert('inline remove buttons use the drawn close cross', await page.locator('.ecard__rm .gi use[href="#ic-close"]').count() >= 1);
// the distance chevron rotates via its open state, not a swapped glyph
await page.click('#distToggle');
await page.waitForTimeout(250);
const rotated = await page.$eval('#distToggle .chev-ic', el => getComputedStyle(el).transform);
assert('the distance chevron rotates when the section opens', rotated && rotated !== 'none');
// no icon-shaped unicode glyph survives anywhere in the live tool view
const glyphFree = await page.evaluate(() => !/[▶▸▾▴›]/.test(document.body.innerText));
assert('no leftover play/chevron unicode glyphs in the tool', glyphFree);

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
