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
// editing normalizes the preset dropdown IN PLACE (custom), so tabbing away never
// tears out the focus destination — a rebuild here would drop focus to <body>
const sel = '.ecard:has(.ecard__plot[data-i="0"]) select[data-scope="ease"]';
assert('an edited curve flips its preset to custom in place', (await page.$eval(sel, s => s.value)) === 'custom');
await page.keyboard.press('Shift+Tab');
await page.waitForTimeout(150);
assert('focus is preserved when leaving an edited curve (not lost to body)',
  (await page.evaluate(() => document.activeElement?.tagName)) !== 'BODY');

// pointer editing also focuses the handle (so click → arrow keys works) and a
// drag doesn't tear focus out of the handle
const h2 = await page.$('.ecard__plot[data-i="0"] .bz-h[data-pt="2"]');
const vtc = await h2.getAttribute('aria-valuetext');
const box = await h2.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(80);
assert('clicking a handle focuses it', await page.evaluate(() => document.activeElement?.classList.contains('bz-h')));
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(120);
assert('arrow keys work after a click (pointer→keyboard hand-off)', (await h2.getAttribute('aria-valuetext')) !== vtc);
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x - 18, box.y - 8, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(150);
assert('a drag keeps focus on the handle', await page.evaluate(() => document.activeElement?.classList.contains('bz-h')));

// the focus ring must contrast with the handle's own fill (a same-colour stroke
// would vanish into the dot)
const ring = await page.evaluate(() => {
  const el = document.querySelector('.ecard__plot[data-i="0"] .bz-h[data-pt="1"]');
  el.focus();
  const cs = getComputedStyle(el);
  return { stroke: cs.stroke, fill: cs.fill };
});
assert('the focus ring is distinct from the handle fill', ring.stroke !== ring.fill);

// the verdict live-region must not re-announce when the grade/count is unchanged
// (critique() runs per drag-frame and per keyboard nudge)
const churn = await page.evaluate(async () => {
  const el = document.getElementById('readStatus');
  let m = 0;
  const obs = new MutationObserver(muts => { m += muts.length; });
  obs.observe(el, { childList: true, characterData: true, subtree: true });
  const h = document.querySelector('.ecard__plot[data-i="0"] .bz-h[data-pt="1"]');
  h.focus();
  const fire = key => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  for (let i = 0; i < 4; i++) { fire('ArrowRight'); fire('ArrowLeft'); }  // net-zero: grade stays put
  await new Promise(r => setTimeout(r, 250));
  obs.disconnect();
  return m;
});
assert('the live region is silent while the verdict is unchanged', churn === 0);

// --- the 404 shares the brand, not a hardcoded off-brand theme ---
const nf = readFileSync(new URL('../404.html', import.meta.url), 'utf8');
assert('404 links the shared stylesheet', /href="\/styles\.css"/.test(nf));
assert('404 heading uses the display serif token', /font-family:var\(--serif\)/.test(nf));
assert('404 drops the old hardcoded dark/teal palette', !/#0b0c0e/i.test(nf) && !/#8ad0c6/i.test(nf));
assert('404 assets are root-absolute (resolve at any 404 depth)', /src="\/favicon\.svg"/.test(nf));

// --- the editor has a main landmark and a skip link jumps past the header ---
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
assert('the editor is a main landmark', (await page.$eval('#editor', el => el.getAttribute('role'))) === 'main');
assert('exactly one main landmark is exposed (the hidden view is display:none)',
  (await page.evaluate(() => [...document.querySelectorAll('main, [role=main]')].filter(m => getComputedStyle(m).display !== 'none').length)) === 1);
// an edit first, so the hash carries serialized state the skip link must not clobber
await page.evaluate(() => document.getElementById('tempoUp').click());
await page.waitForTimeout(150);
const stateHash = await page.evaluate(() => location.hash);
await page.keyboard.press('Tab');  // first tab stop
const skip = await page.evaluate(() => ({ cls: document.activeElement?.className, href: document.activeElement?.getAttribute('href') }));
assert('the first tab stop is the skip link → #editor', skip.cls === 'skip-link' && skip.href === '#editor');
await page.waitForTimeout(250);
assert('the skip link reveals on focus (on-screen)', (await page.$eval('#toolview .skip-link', el => el.getBoundingClientRect().top)) >= 0);
await page.keyboard.press('Enter');
await page.waitForTimeout(120);
assert('activating the skip link moves focus to the editor', (await page.evaluate(() => document.activeElement?.id)) === 'editor');
// the state hash is the app's routing/state channel — the skip link must not touch it
assert('the skip link preserves the state hash (never navigates to #editor)',
  (await page.evaluate(() => location.hash)) === stateHash && stateHash.length > 1);

// --- the landing exposes the proof captions and has its own skip link ---
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.keyboard.press('Tab');
assert('the landing first tab stop is a skip link', (await page.evaluate(() => document.activeElement?.className)) === 'skip-link');
// activating it must not set a hash (any nonempty hash boots the tool on reload)
await page.keyboard.press('Enter');
await page.waitForTimeout(120);
assert('the landing skip link leaves the hash empty', (await page.evaluate(() => location.hash)) === '');
const proof = await page.evaluate(() => {
  const s = document.querySelector('.lproof');
  return {
    labelled: !!s.getAttribute('aria-label') && s.getAttribute('aria-hidden') === null,
    stagesHidden: [...s.querySelectorAll('.ltile__stage')].every(x => x.getAttribute('aria-hidden') === 'true'),
    capsExposed: [...s.querySelectorAll('.ltile__cap')].every(c => c.closest('[aria-hidden="true"]') === null),
  };
});
assert('the proof section is a labelled region, not aria-hidden', proof.labelled);
assert('the decorative proof stages are hidden from AT', proof.stagesHidden);
assert('the proof captions are exposed to AT', proof.capsExposed);

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
