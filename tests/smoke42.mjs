/* Trust slice: the opinion panel is announced to screen readers, the bézier
 * handles are keyboard-operable, and the 404 page shares the site's brand.
 *
 * These are accessibility + consistency guards, so they assert the semantics a
 * screen-reader / keyboard user depends on rather than pixels: a polite status
 * region that carries the verdict, slider-role handles that move on arrow keys,
 * and a 404 that pulls the shared tokens instead of a hardcoded off-brand theme. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

// fresh boot into the tool (a hash-only nav wouldn't re-run the boot gate)
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// --- the opinion panel speaks to assistive tech ---
const st = await page.$eval('#readStatus', el => ({ role: el.getAttribute('role'), live: el.getAttribute('aria-live'), atomic: el.getAttribute('aria-atomic'), text: el.textContent }));
assert('the read has a polite status live-region', st.role === 'status' && st.live === 'polite' && st.atomic === 'true');
assert('the status region carries the verdict phrase', /system read: grade [A-E]/i.test(st.text));
const region = await page.$eval('#hints', el => ({ role: el.getAttribute('role'), label: el.getAttribute('aria-label') }));
assert('the findings list is a labelled region', region.role === 'region' && !!region.label);
assert('the visible badge is hidden from AT (no double-read)', (await page.$eval('#hintCount', el => el.getAttribute('aria-hidden'))) === 'true');

// the announcement tracks the verdict: a redundant easing drops the grade
const before = st.text;
await page.evaluate(() => document.getElementById('addEasing').click());
await page.waitForTimeout(300);
const after = await page.$eval('#readStatus', el => el.textContent);
assert('the status updates when the system changes', after !== before && /to review/.test(after));

// --- the bézier handles are keyboard-operable ---
const h = await page.$('.ecard__plot[data-i="0"] .bz-h[data-pt="1"]');
assert('a curve handle is a focusable slider', (await h.getAttribute('role')) === 'slider' && (await h.getAttribute('tabindex')) === '0');
assert('the handle exposes a value to AT', /time \d+%/.test(await h.getAttribute('aria-valuetext') || ''));
const vt0 = await h.getAttribute('aria-valuetext');
await h.focus();
assert('the handle takes keyboard focus', await page.evaluate(() => document.activeElement?.classList.contains('bz-h')));
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(150);
assert('arrow keys move the handle (value changes)', (await h.getAttribute('aria-valuetext')) !== vt0);
assert('focus stays on the handle while editing', await page.evaluate(() => document.activeElement?.classList.contains('bz-h')));

// --- the 404 shares the brand, not a hardcoded off-brand theme ---
const nf = readFileSync(new URL('../404.html', import.meta.url), 'utf8');
assert('404 links the shared stylesheet', /href="\/styles\.css"/.test(nf));
assert('404 heading uses the display serif token', /font-family:var\(--serif\)/.test(nf));
assert('404 drops the old hardcoded dark/teal palette', !/#0b0c0e/i.test(nf) && !/#8ad0c6/i.test(nf));
assert('404 assets are root-absolute (resolve at any 404 depth)', /src="\/favicon\.svg"/.test(nf));

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
