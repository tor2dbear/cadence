import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const errors = [];
const mk = async () => { const p = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push(''+e)); return p; };
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const easeOf = (p, i=0) => p.locator('#intents .intent').nth(i).locator('.intent__ref select').nth(1).inputValue();

const page = await mk();
await page.goto(BASE, { waitUntil: 'networkidle' });

// default: one mode named "default"
assert('starts with one mode "default"', (await page.locator('.mode.active .mode__name').inputValue()) === 'default');
const enterEaseDefault = await easeOf(page);

// add a mode → copies current bindings, becomes active
await page.click('.mode--add');
assert('add mode → active input is "mode"', (await page.locator('.mode.active .mode__name').inputValue()) === 'mode');
assert('add mode → new binding copied (enter ease matches)', (await easeOf(page)) === enterEaseDefault);

// diverge the new mode: change enter's easing here
const easings = await page.locator('#easings .ecard__name').evaluateAll(e=>e.map(x=>x.value));
const other = easings.find(n => n !== enterEaseDefault);
await page.locator('#intents .intent').first().locator('.intent__ref select').nth(1).selectOption(other);
assert('new mode enter ease changed', (await easeOf(page)) === other);

// switch back to "default" → original binding intact (independence)
await page.locator('.mode[data-scope="mset"]').first().click();
assert('default mode unchanged after editing other mode', (await easeOf(page)) === enterEaseDefault);

// switch to mode 2 again → divergent value preserved
await page.locator('.mode[data-scope="mset"]').first().click();  // now "mode" is the non-active button
assert('second mode keeps its divergent ease', (await easeOf(page)) === other);

// export notes the active mode when >1 mode
await page.click('.tab[data-fmt="css"]');
assert('CSS export notes the mode', (await page.locator('#out').innerText()).includes('mode:'));

// URL round-trips modes + per-mode bindings
const url = await page.evaluate(() => location.href);
const p2 = await mk();
await p2.goto(url, { waitUntil: 'networkidle' });
const modeButtons = await p2.locator('.modes .mode[data-scope="mset"]').count();  // non-active modes
assert('restored: 2 modes total (1 active + 1 button)', modeButtons === 1);
// active mode is index 1 ("mode") → enter ease should be the divergent one
assert('restored: active mode binding preserved', (await easeOf(p2)) === other);
// switch to default on restored page → original
await p2.locator('.mode[data-scope="mset"]').first().click();
assert('restored: default mode binding preserved', (await easeOf(p2)) === enterEaseDefault);

// rename active mode
await p2.locator('.mode.active .mode__name').fill('productive');
await p2.locator('.mode.active .mode__name').blur();
assert('mode rename sticks', (await p2.locator('.mode.active .mode__name').inputValue()) === 'productive');

// remove active mode → back to one
await p2.locator('.mode.active .mode__rm').click();
assert('remove mode → single mode remains', (await p2.locator('.mode__name').count()) === 1);

// legacy link (old single-binding format, no modes key) still loads
const LEGACY = BASE + '#eyJkIjpbWyJmYXN0IiwxNTBdLFsiYmFzZSIsMjAwXSxbInNsb3ciLDMwMF0sWyJzbG93ZXIiLDUwMF0sWyJ4c2xvdyIsMTAwMF1dLCJlIjpbWyJzdGFuZGFyZCIsMC4yLDAsMC4yLDFdLFsiZGVjZWxlcmF0ZSIsMCwwLDAuMiwxXSxbImFjY2VsZXJhdGUiLDAuNCwwLDEsMV0sWyJlbXBoYXNpemVkIiwwLjIyLDEsMC4zNiwxXSxbImN1c3QiLDAsMCwxLDFdXSwiaSI6W1siZW50ZXIiLCJiYXNlIiwiZW1waGFzaXplZCIsInRoaW5ncyBhcHBlYXJpbmciXSxbImV4aXQiLCJmYXN0IiwiYWNjZWxlcmF0ZSIsInRoaW5ncyBsZWF2aW5nIl0sWyJlbXBoYXNpemVkIiwic2xvd2VyIiwiZW1waGFzaXplZCIsImhlcm8gbW9tZW50cyJdLFsiaG92ZXIiLCJmYXN0Iiwic3RhbmRhcmQiLCJwb2ludGVyIGZlZWRiYWNrIl0sWyJjdXN0b20iLCJzbG93ZXIiLCJkZWNlbGVyYXRlIiwieW91ciBvd24iXV0sInAiOlswLDMsMCwwXX0';
const p3 = await mk();
await p3.goto(LEGACY, { waitUntil: 'networkidle' });
assert('legacy link → single default mode', (await p3.locator('.mode.active .mode__name').inputValue()) === 'default' && (await p3.locator('#easings .ecard').count()) === 5);

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
