/* The landing's "with taste" line speaks the ENGINE, and the editor never mints
 * colliding token names.
 *
 * The rotating opinion line used to be four hand-typed strings that merely
 * matched the default system — so a change to the default's durations/easings
 * would silently make the shopfront assert stale numbers. It now derives from the
 * same systemRead the tool runs, so this guards that every displayed line is a
 * real engine finding (drift trips CI). And "+ Add intent" now dedupes names like
 * every other scale, so exported --motion-<name>-* / { <name>: … } keys can't
 * collide and silently drop a token. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

// --- the landing speaks the engine ---------------------------------------
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const landingLines = await page.evaluate(() => document.getElementById('opinionLine')?.__readLines || null);
const shown = (await page.locator('#opinionLine').textContent())?.trim();

// the same read the tool shows for the default system
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const okFindings = await page.$$eval('#hints .rd.ok', els => els.map(e => e.querySelector('span:last-child').textContent.trim()));

assert('the engine produces the celebratory reads for the default system', okFindings.length >= 4);
assert('the landing derives its lines from the engine (not hand-typed)', Array.isArray(landingLines) && landingLines.length >= 2);
assert('every rotating "with taste" line IS a live engine finding', landingLines.every(l => okFindings.includes(l)));
assert('the initially shown line comes from the engine', okFindings.includes(shown));

// --- the editor dedupes new intent names ----------------------------------
// fire the handler directly (we're testing its dedup logic, not the button's
// on-screen actionability, which is exercised elsewhere)
await page.evaluate(() => document.getElementById('addIntent').click());
await page.evaluate(() => document.getElementById('addIntent').click());
await page.waitForTimeout(150);
const names = await page.$$eval('#intents .intent__name', els => els.map(e => (e.value ?? e.textContent).trim()));
const customs = names.filter(n => /^custom/.test(n));
assert('two "+ Add intent" clicks yield two custom intents', customs.length === 2);
assert('the two custom intents have DISTINCT names (no collision)', new Set(customs).size === 2);

// and the two custom intents reach the export under DISTINCT custom-property
// names (before the fix, both were "custom" → one --motion-custom-duration
// silently overwrote the other; now custom + custom-2 are separate tokens)
await page.locator('#exportToggle').click().catch(() => {});
await page.waitForTimeout(150);
const css = await page.evaluate(() => {
  const o = document.getElementById('out');
  return o ? o.textContent : '';
});
assert('exported CSS emits both custom intents as distinct duration vars',
  /--motion-custom-duration\b/.test(css) && /--motion-custom-2-duration\b/.test(css));

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
