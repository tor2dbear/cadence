/* Back to the intro: the tool's wordmark is a home affordance. Entering the
 * tool is one-way through "Start designing"; this verifies the return trip —
 * clicking the wordmark drops back to the landing, clears the state hash, and
 * "Start designing" still re-enters. reducedMotion keeps the View Transition
 * off the critical path so the assertions are deterministic. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 820 }, reducedMotion: 'reduce' });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const bootIs = mode => page.evaluate(m => document.documentElement.classList.contains('boot-' + m), mode);
const shown = sel => page.locator(sel).evaluate(el => getComputedStyle(el).display !== 'none');

// boot straight into the tool (a shared/#tool link skips the landing)
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
assert('boots into the tool from a hash', await bootIs('tool'));
assert('tool visible, landing hidden', await shown('#toolview') && !(await shown('#landing')));

// the wordmark is now an actual home link, not inert text
assert('wordmark is a home link', await page.locator('#brandHome').count() === 1);

// …and the wordmark shares a true text baseline with the tagline beside it
// (the header baseline-aligns them; the mark rides inline, optically centred on
// the wordmark, so it must NOT be a bounding-box-centre check — measure the
// actual baseline by dropping a vertical-align:baseline marker into each).
const baselineY = sel => page.locator(sel).evaluate(el => {
  const m = document.createElement('span');
  m.style.cssText = 'display:inline-block;width:1px;height:1px;vertical-align:baseline';
  el.appendChild(m);
  const y = m.getBoundingClientRect().bottom;   // empty inline-block: bottom == baseline
  m.remove();
  return y;
});
const wc = await baselineY('#brandHome'), tc = await baselineY('header.top .tag');
assert('wordmark shares a baseline with the tagline beside it', Math.abs(wc - tc) < 1.5);

// on a compact viewport the tagline is dropped (redundant with the landing, and
// it only crowds an already-cramped header) — hidden, not just wrapped onto its
// own line
await page.setViewportSize({ width: 390, height: 820 });
assert('tagline is hidden on a compact viewport', !(await shown('header.top .tag')));
await page.setViewportSize({ width: 1100, height: 820 });
assert('home link has an accessible label',
  !!(await page.locator('#brandHome').getAttribute('aria-label')));

// click it → back to the landing
await page.locator('#brandHome').click();
await page.waitForTimeout(120);
assert('clicking the wordmark returns to the landing', await bootIs('landing'));
assert('landing visible, tool hidden', await shown('#landing') && !(await shown('#toolview')));
assert('the state hash is cleared on return', await page.evaluate(() => location.hash === ''));

// and the round-trip completes: "Start designing" re-enters the tool
await page.locator('#startTool').click();
await page.waitForTimeout(120);
assert('Start designing re-enters the tool', await bootIs('tool'));

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
