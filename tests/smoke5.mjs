import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const LEGACY = BASE + '#eyJkIjpbWyJmYXN0IiwxNTBdLFsiYmFzZSIsMjAwXSxbInNsb3ciLDMwMF0sWyJzbG93ZXIiLDUwMF0sWyJ4c2xvdyIsMTAwMF1dLCJlIjpbWyJzdGFuZGFyZCIsMC4yLDAsMC4yLDFdLFsiZGVjZWxlcmF0ZSIsMCwwLDAuMiwxXSxbImFjY2VsZXJhdGUiLDAuNCwwLDEsMV0sWyJlbXBoYXNpemVkIiwwLjIyLDEsMC4zNiwxXSxbImN1c3QiLDAsMCwxLDFdXSwiaSI6W1siZW50ZXIiLCJiYXNlIiwiZW1waGFzaXplZCIsInRoaW5ncyBhcHBlYXJpbmciXSxbImV4aXQiLCJmYXN0IiwiYWNjZWxlcmF0ZSIsInRoaW5ncyBsZWF2aW5nIl0sWyJlbXBoYXNpemVkIiwic2xvd2VyIiwiZW1waGFzaXplZCIsImhlcm8gbW9tZW50cyJdLFsiaG92ZXIiLCJmYXN0Iiwic3RhbmRhcmQiLCJwb2ludGVyIGZlZWRiYWNrIl0sWyJjdXN0b20iLCJzbG93ZXIiLCJkZWNlbGVyYXRlIiwieW91ciBvd24iXV0sInAiOlswLDMsMCwwXX0';

const browser = await chromium.launch();
const errors = [];
const mk = async () => { const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message)); return p; };
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

const page = await mk();
await page.goto(BASE, { waitUntil: 'networkidle' });

// default: 4 probes, all "orb" lens, each stage has an .orb
assert('4 probes', await page.locator('.probe').count() === 4);
const kinds = await page.locator('.probe__kind').evaluateAll(els => els.map(e => e.value));
assert('default lenses: scope + 3 orbs', kinds[0] === 'scope' && kinds.slice(1).every(k => k === 'orb'));
assert('3 orb stages + 1 scope stage', await page.locator('.probe .orb').count() === 3 && await page.locator('.probe .scope').count() === 1);
// default intents spread enter/exit/move/hover
const intentSel = await page.locator('.probe__sel').evaluateAll(els => els.map(e => e.selectedOptions[0].textContent));
assert('default intents spread', JSON.stringify(intentSel) === JSON.stringify(['enter','exit','move','hover']));

// switch probe 0 lens -> drawer: stage swaps to a drawer, orb gone
await page.locator('.probe__kind').first().selectOption('drawer');
assert('probe 0 now shows drawer', await page.locator('.probe').first().locator('.drawer').count() === 1);
assert('probe 0 orb gone', await page.locator('.probe').first().locator('.orb').count() === 0);

// play an orb probe (probe 1) — should animate without error
await page.locator('.probe').nth(1).locator('.probe__stage').click();
await page.waitForTimeout(200);
const midOpacity = await page.locator('.probe').nth(1).locator('.orb').evaluate(el => getComputedStyle(el).opacity);
assert('orb animates on play (opacity rose above rest .3)', parseFloat(midOpacity) > 0.3);

// lens choice round-trips through the URL
await page.waitForTimeout(1600);
const url = await page.evaluate(() => location.href);
const p2 = await mk();
await p2.goto(url, { waitUntil: 'networkidle' });
assert('restored: probe 0 lens = drawer', (await p2.locator('.probe__kind').first().inputValue()) === 'drawer');
assert('restored: probe 1 lens = orb', (await p2.locator('.probe__kind').nth(1).inputValue()) === 'orb');

// legacy link (bare intent indices, no kind) still loads: intents restored, kinds default to orb
const p3 = await mk();
await p3.goto(LEGACY, { waitUntil: 'networkidle' });
assert('legacy link: 5 easings restored', await p3.locator('#easings .ecard').count() === 5);
const lk = await p3.locator('.probe__kind').evaluateAll(els => els.map(e => e.value));
assert('legacy link: kinds fall back to defaults (scope + orbs)', lk[0] === 'scope' && lk.slice(1).every(k => k === 'orb'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
