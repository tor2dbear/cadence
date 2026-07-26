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
await purpose.type('open & close <x>');   // prose punctuation must survive (not the token sanitizer)
await page.waitForTimeout(150);
assert('editing purpose keeps prose punctuation (not stripped)', (await page.evaluate(() => intents[0].purpose)) === 'open & close <x>');
assert('the purpose field keeps focus while typing', await page.evaluate(() => document.activeElement?.classList.contains('intent__purpose')));
assert('purpose round-trips through the share link intact',
  (await page.evaluate(() => { writeURL(); applyEncoded(location.hash.replace(/^#/, '')); return intents[0].purpose; })) === 'open & close <x>');
const x = page.locator('#exportToggle');
if (await x.count()) await x.click();
const tab = async fmt => { await page.click(`.tab[data-fmt="${fmt}"]`); await page.waitForTimeout(80); return page.locator('#out').innerText(); };
assert('purpose rides along in the JSON export', (await tab('json')).includes('open & close <x>'));
assert('purpose rides along in the Style Dictionary export (on a child token)', (await tab('sd')).includes('open & close <x>'));
// the Rationale is a Markdown deliverable — purpose is HTML-escaped so "<x>" survives rendering
assert('purpose rides along in the Rationale export, escaped for Markdown', (await tab('rationale')).includes('open &amp; close &lt;x&gt;'));
assert('no script injection from purpose text', await page.evaluate(() => !document.querySelector('.intent__purpose ~ script, script[data-x]')));

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

// dragging the distance slider replays the orb live (its endpoint is captured at
// play() time, so the input handler must re-trigger it)
const draggedEnd = await page.evaluate(async () => {
  probes[0].kind = 'orb'; probes[0].intent = intents[0].id;
  intents[0].binds[0].distance = 'nudge';
  renderBench();
  const di = distances.findIndex(d => d.name === 'nudge');
  distances[di].px = 600;
  const el = document.createElement('input');
  el.type = 'range'; el.dataset.scope = 'xpx'; el.dataset.i = String(di); el.value = '600';
  document.body.appendChild(el);
  el.dispatchEvent(new Event('input', { bubbles: true }));   // the event the slider fires
  await new Promise(r => setTimeout(r, 450));                // past the debounce + the rAF that sets END
  return document.querySelector('.probe[data-i="0"] .orb')?.style.left;
});
assert('dragging the distance slider replays the orb to the new endpoint',
  /calc\(/.test(draggedEnd) && draggedEnd !== '14px' && draggedEnd !== 'calc(100% - 40px)');

// assigning a distance via the dropdown (a change event) must also replay the orb
const assignedEnd = await page.evaluate(async () => {
  probes[0].kind = 'orb'; probes[0].intent = intents[0].id;
  delete intents[0].binds[0].distance; renderBench();
  const el = document.createElement('select');
  el.dataset.scope = 'idist'; el.dataset.i = '0';
  const a = document.createElement('option'); a.value = '';
  const c = document.createElement('option'); c.value = 'nudge';
  el.append(a, c); el.value = 'nudge'; document.body.appendChild(el);
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 450));
  return document.querySelector('.probe[data-i="0"] .orb')?.style.left;
});
assert('assigning a distance via the dropdown replays the orb',
  /calc\(/.test(assignedEnd) && assignedEnd !== '14px' && assignedEnd !== 'calc(100% - 40px)');

// the intent row (name + purpose + remove) must fit a narrow card — the inputs
// shrink so the remove button stays on-screen (was overflowing at 320px)
const narrow = await browser.newPage({ viewport: { width: 320, height: 700 } });
await narrow.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await narrow.reload({ waitUntil: 'networkidle' });
await narrow.waitForTimeout(200);
const fits = await narrow.evaluate(() => {
  const card = document.querySelector('.intent');
  const rm = card.querySelector('.intent__rm').getBoundingClientRect();
  return rm.right <= card.getBoundingClientRect().right + 1 && document.documentElement.scrollWidth <= innerWidth + 1;
});
assert('the intent row fits a 320px card with the remove button on-screen', fits);
await narrow.close();

// under reduced-motion, an edit-triggered orb replay must not fire (like the rest
// of the bench, which skips playAll/idle for this preference)
const rm = await browser.newContext({ reducedMotion: 'reduce' });
const rp = await rm.newPage({ viewport: { width: 1300, height: 1000 } });
await rp.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await rp.reload({ waitUntil: 'networkidle' });
await rp.waitForTimeout(250);
const reducedLeft = await rp.evaluate(async () => {
  probes[0].kind = 'orb'; probes[0].intent = intents[0].id;
  intents[0].binds[0].distance = 'nudge'; renderBench();
  const di = distances.findIndex(d => d.name === 'nudge'); distances[di].px = 600;
  const el = document.createElement('input');
  el.type = 'range'; el.dataset.scope = 'xpx'; el.dataset.i = String(di); el.value = '600';
  document.body.appendChild(el); el.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  return document.querySelector('.probe[data-i="0"] .orb')?.style.left;
});
assert('reduced-motion suppresses the edit-triggered orb replay', !reducedLeft);
await rm.close();

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
