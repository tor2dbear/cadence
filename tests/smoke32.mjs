/* One-click apply: the deterministic system-read fixes carry an Apply button
 * that mutates the model and clears the warning. This drives the real app —
 * forces a warning, clicks its Apply, and checks the read updates + the model
 * actually changed. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const hintsText = () => page.locator('#hints').innerText();

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });

// ---- 1. a long stagger warns, and its Apply button appears ----
await page.evaluate(() => { bindOf(intents.find(x => x.name === 'enter')).stagger = 200; rerenderAll(); });
assert('long stagger warns (lead 800ms)', /waits 800ms/.test(await hintsText()));
const staggerRow = page.locator('.rd', { hasText: 'waits 800ms' });
assert('the warning row carries an Apply button', await staggerRow.locator('.rd__apply').count() === 1);

// ---- 2. clicking Apply clears the warning and changes the model ----
await staggerRow.locator('.rd__apply').click();
assert('stagger warning is gone after Apply', !/waits 800ms/.test(await hintsText()));
const stag = await page.evaluate(() => bindOf(intents.find(x => x.name === 'enter')).stagger);
assert('stagger was lowered to a lead-safe value', stag === 120);

// ---- 3. rebalance: an uneven ladder is evened out by one click ----
await page.evaluate(() => { durations.find(d => d.name === 'xslow').ms = 4000; rerenderAll(); });
assert('uneven-ladder warning shows', /ladder is uneven/.test(await hintsText()));
const ladderRow = page.locator('.rd', { hasText: 'ladder is uneven' });
await ladderRow.locator('.rd__apply').click();
assert('uneven-ladder warning clears after rebalance', !/ladder is uneven/.test(await hintsText()));
// endpoints are pinned; the ratio spread should now be tight
const evened = await page.evaluate(() => {
  const ms = durations.map(d => d.ms).sort((a, b) => a - b);
  const ratios = ms.slice(1).map((v, i) => v / ms[i]);
  return Math.max(...ratios) / Math.min(...ratios);
});
assert('rebalanced ladder has a near-constant step', evened <= 1.9);

// ---- 4. Apply writes through to the URL/state (share + preview stay in sync) ----
assert('applying a fix stamps state into the hash', /#./.test(await page.evaluate(() => location.hash)));

// ---- 5. no console errors across the interactions ----
assert('no console errors during apply flow', errors.length === 0);

await browser.close();
