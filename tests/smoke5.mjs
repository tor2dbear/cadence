import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const BASE = new URL('../index.html', import.meta.url).href;
const src = p => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const LEGACY = BASE + '#eyJkIjpbWyJmYXN0IiwxNTBdLFsiYmFzZSIsMjAwXSxbInNsb3ciLDMwMF0sWyJzbG93ZXIiLDUwMF0sWyJ4c2xvdyIsMTAwMF1dLCJlIjpbWyJzdGFuZGFyZCIsMC4yLDAsMC4yLDFdLFsiZGVjZWxlcmF0ZSIsMCwwLDAuMiwxXSxbImFjY2VsZXJhdGUiLDAuNCwwLDEsMV0sWyJlbXBoYXNpemVkIiwwLjIyLDEsMC4zNiwxXSxbImN1c3QiLDAsMCwxLDFdXSwiaSI6W1siZW50ZXIiLCJiYXNlIiwiZW1waGFzaXplZCIsInRoaW5ncyBhcHBlYXJpbmciXSxbImV4aXQiLCJmYXN0IiwiYWNjZWxlcmF0ZSIsInRoaW5ncyBsZWF2aW5nIl0sWyJlbXBoYXNpemVkIiwic2xvd2VyIiwiZW1waGFzaXplZCIsImhlcm8gbW9tZW50cyJdLFsiaG92ZXIiLCJmYXN0Iiwic3RhbmRhcmQiLCJwb2ludGVyIGZlZWRiYWNrIl0sWyJjdXN0b20iLCJzbG93ZXIiLCJkZWNlbGVyYXRlIiwieW91ciBvd24iXV0sInAiOlswLDMsMCwwXX0';

const browser = await chromium.launch();
const errors = [];
const mk = async () => { const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message)); return p; };
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

const page = await mk();
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)

// default: 4 probes, each seeded with the lens that fits its intent —
// scope (enter, flagship) · orb (exit) · orb (move) · button (hover)
assert('4 probes', await page.locator('.probe').count() === 4);
const kinds = await page.locator('.probe__kind').evaluateAll(els => els.map(e => e.value));
assert('default lenses fit the intents (scope · orb · orb · button)',
  JSON.stringify(kinds) === JSON.stringify(['scope', 'orb', 'orb', 'button']));
assert('2 orb stages + 1 scope + 1 button stage',
  await page.locator('.probe .orb').count() === 2 && await page.locator('.probe .scope').count() === 1
  && await page.locator('.probe .btnpad').count() === 1);
// default intents spread enter/exit/move/hover
const intentSel = await page.locator('.probe__sel').evaluateAll(els => els.map(e => e.selectedOptions[0].textContent));
assert('default intents spread', JSON.stringify(intentSel) === JSON.stringify(['enter','exit','move','hover']));

// switch probe 0 lens -> button: stage swaps to the button gesture, orb gone
await page.locator('.probe__kind').first().selectOption('button');
assert('probe 0 now shows the button lens', await page.locator('.probe').first().locator('.btnpad').count() === 1);
assert('probe 0 orb gone', await page.locator('.probe').first().locator('.orb').count() === 0);

// play an orb probe (probe 1) — the comet head is opaque and travels on play
await page.locator('.probe').nth(1).locator('.probe__stage').click();
await page.waitForTimeout(120);
const head = page.locator('.probe').nth(1).locator('.orb');
assert('comet head is opaque (no see-through)', (await head.evaluate(el => getComputedStyle(el).opacity)) === '1');
assert('comet head travels on play', (await head.evaluate(el => el.style.left)) !== '14px');

// lens choice round-trips through the URL
await page.waitForTimeout(1600);
const url = await page.evaluate(() => location.href);
const p2 = await mk();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
assert('restored: probe 0 lens = button', (await p2.locator('.probe__kind').first().inputValue()) === 'button');
assert('restored: probe 1 lens = orb', (await p2.locator('.probe__kind').nth(1).inputValue()) === 'orb');

// legacy link (bare intent indices, no kind) still loads: intents restored,
// kinds fall back to the seeded defaults (scope · orb · orb · button)
const p3 = await mk();
await p3.goto(LEGACY, { waitUntil: 'networkidle' });
{ const _x=p3.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
assert('legacy link: 5 easings restored', await p3.locator('#easings .ecard').count() === 5);
const lk = await p3.locator('.probe__kind').evaluateAll(els => els.map(e => e.value));
assert('legacy link: kinds fall back to the seeded defaults',
  JSON.stringify(lk) === JSON.stringify(['scope', 'orb', 'orb', 'button']));

// re-pointing a probe follows the new intent's character (unless the lens was
// chosen explicitly). probe 1 is seeded orb (unlocked).
const kindOf = i => page.locator('.probe__kind').nth(i).inputValue();
await page.locator('.probe__sel').nth(1).selectOption({ label: 'hover' });
assert('re-point → hover picks the button (press) lens', (await kindOf(1)) === 'button');
await page.locator('.probe__sel').nth(1).selectOption({ label: 'enter' });
assert('re-point → enter falls back to scope (stagger shows there)', (await kindOf(1)) === 'scope');
// an explicit lens choice locks: re-pointing afterwards keeps it
await page.locator('.probe__kind').nth(2).selectOption('cascade');
await page.locator('.probe__sel').nth(2).selectOption({ label: 'hover' });
assert('explicit lens choice survives a re-point', (await kindOf(2)) === 'cascade');

// the bench stays alive (idle-loop) and signposts replay (static guards, robust)
{
  const js = src('../cadence.js'), css = src('../styles.css');
  assert('bench has an idle-loop that keeps a lens in motion',
    /function startBenchIdle\(\)/.test(js) && /startBenchIdle\(\)/.test(js.replace(/function startBenchIdle\(\)/, '')));
  assert('idle loop is gated on reduced-motion + tool view',
    /startBenchIdle[\s\S]{0,220}reduce/.test(js) && /startBenchIdle[\s\S]{0,260}mode!=="tool"/.test(js));
  assert('a replay affordance is signposted on the lens', /\.probe__stage::after\{content:"↻ replay"/.test(css));
}

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
