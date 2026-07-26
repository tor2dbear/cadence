/* Editor authoring round-out.
 *
 * An intent's purpose is editable (it rides along in the JSON / Rationale export
 * and the share link), and the distance primitive is now visible in the bench:
 * the orb lens travels a fraction of the rail proportional to the intent's
 * distance token instead of always crossing the whole width. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1050 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// --- purpose is an editable field ---
const purpose = page.locator('.intent__purpose').first();
assert('intent purpose is an input, not static text', (await purpose.evaluate(el => el.tagName)) === 'INPUT');
await purpose.click();
await purpose.fill('');
await purpose.type('makes the point');
await page.waitForTimeout(150);
assert('editing purpose updates the model', (await page.evaluate(() => intents[0].purpose)) === 'makes the point');
assert('the purpose field keeps focus while typing', await page.evaluate(() => document.activeElement?.classList.contains('intent__purpose')));
const x = page.locator('#exportToggle');
if (await x.count()) await x.click();
await page.click('.tab[data-fmt="json"]');
await page.waitForTimeout(100);
assert('purpose rides along in the JSON export', (await page.locator('#out').innerText()).includes('makes the point'));

// --- distance drives the orb travel ---
const end = dist => page.evaluate(async d => {
  probes[0].kind = 'orb'; probes[0].intent = intents[0].id;
  if (d) intents[0].binds[0].distance = d; else delete intents[0].binds[0].distance;
  renderBench(); play(0);
  await new Promise(r => setTimeout(r, 120));
  return document.querySelector('.probe[data-i="0"] .orb')?.style.left;
}, dist);
const small = await end('nudge');    // 8px → short
const full = await end('screen');    // 720px → full width
const none = await end(null);        // no distance → full width
assert('a small distance shortens the orb travel', /\*\s*0?\.\d|12%/.test(small) && small !== full);
assert('a large distance travels the full rail', full === 'calc(100% - 40px)');
assert('no distance keeps the full travel (unchanged default)', none === full);

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
