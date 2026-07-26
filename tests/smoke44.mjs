/* Scroll-driven and view-transition are mutually exclusive on an intent.
 *
 * One binds motion to scroll position/entry, the other animates a DOM state swap
 * — an intent can't be both (like reveal/scrub already exclude each other).
 * Enabling one clears the other in the UI, and a legacy/shared link that carries
 * both loads with the view-transition dropped, so the exports never double-emit. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// open the first intent's advanced panel (where the scroll-driven / VT toggles live)
await page.evaluate(() => document.querySelector('.intent__more')?.click());
await page.waitForTimeout(200);
const toggle = async s => { await page.evaluate(sel => { const el = document.querySelector(`input[data-scope="${sel}"]`); el.checked = !el.checked; el.dispatchEvent(new Event('change', { bubbles: true })); }, s); await page.waitForTimeout(200); };
const state = () => page.evaluate(() => ({ scroll: document.querySelector('input[data-scope="ireveal"]').checked, vt: document.querySelector('input[data-scope="ivt"]').checked }));

await toggle('ireveal');
let s = await state();
assert('scroll-driven can be enabled alone', s.scroll && !s.vt);
await toggle('ivt');
s = await state();
assert('enabling view-transition clears scroll-driven', s.vt && !s.scroll);
await toggle('ireveal');
s = await state();
assert('enabling scroll-driven clears view-transition', s.scroll && !s.vt);

// a legacy/shared link whose bind carries BOTH reveal and vt loads with vt dropped
const legacy = await page.evaluate(() => {
  const st = { d: [['base', 200]], e: [['standard', 0.2, 0, 0.2, 1]], i: [['enter', '', [['base', 'standard', 0, 'all', 0, 0, 20, 0, ['root']]]]] };
  applyState(st);
  const bb = intents[0].binds[0];
  return { reveal: bb.reveal != null, vt: !!bb.vt };
});
assert('a bind carrying both loads scroll-driven, not view-transition', legacy.reveal && !legacy.vt);

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
