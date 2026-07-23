import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

// --- bare load → the landing, not the tool ---
await page.goto(BASE, { waitUntil: 'networkidle' });
assert('landing visible on bare load', await page.locator('#landing').isVisible());
assert('tool hidden on bare load', !(await page.locator('#toolview').isVisible()));
assert('thesis is present', (await page.locator('.lhead').innerText()).toLowerCase().includes('structure, and an'));
assert('opinion line reads as ok', await page.locator('#opinionLine').evaluate(el => el.classList.contains('ok')));
assert('three proof tiles', await page.locator('.ltile').count() === 3);

// --- signature toggle: flip to naïve, the page + opinion degrade ---
await page.locator('#tasteToggle').click();
assert('toggle adds the naïve class', await page.locator('#landing').evaluate(el => el.classList.contains('naive')));
assert('opinion line flips to warn', await page.locator('#opinionLine').evaluate(el => el.classList.contains('warn')));
assert('state label shows naïve', (await page.locator('#tasteState').innerText()).includes('na'));
await page.locator('#tasteToggle').click();
assert('toggle back removes naïve', !(await page.locator('#landing').evaluate(el => el.classList.contains('naive'))));
assert('opinion line back to ok', await page.locator('#opinionLine').evaluate(el => el.classList.contains('ok')));

// --- the entrance is a shared-element View Transition: the wordmark morphs ---
assert('landing wordmark is the shared VT element',
  (await page.locator('.lbrand').evaluate(el => getComputedStyle(el).viewTransitionName)) === 'brand');
assert('header wordmark shares the VT name (morph target)',
  (await page.locator('#toolview header.top .brand').evaluate(el => getComputedStyle(el).viewTransitionName)) === 'brand');

// --- "Start designing" enters the tool (same document) ---
await page.locator('#startTool').click();
await page.waitForTimeout(300);   // let the view transition settle
assert('tool visible after Start', await page.locator('#toolview').isVisible());
assert('landing hidden after Start', !(await page.locator('#landing').isVisible()));
assert('editor is live (durations rendered)', await page.locator('#durations .drow').count() > 0);
// entering the tool at defaults keeps a clean #tool — no wall of base64 until
// you actually diverge from the default system
assert('entering the tool keeps a clean #tool', (await page.evaluate(() => location.hash)) === '#tool');
// an edit then stamps a shareable state hash — a diff from the default, so it's
// far shorter than the full encode (which the demo link/channel still use)
await page.locator('#durations .drow input[type=range]').first().evaluate(el => { el.value = Number(el.value) + 40; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(80);
const hInfo = await page.evaluate(() => ({ h: location.hash, full: encodeStateFull().length }));
assert('an edit stamps a state hash (not #tool)', hInfo.h !== '#tool' && hInfo.h.length > 8);
assert('the state hash is a short diff, not the full encode', (hInfo.h.length - 1) < hInfo.full / 3);
assert('no console/page errors (landing→tool)', errors.length === 0);
// the shared hash round-trips: a fresh load restores the edited duration
const pr = await browser.newPage();
await pr.goto(await page.evaluate(() => location.href), { waitUntil: 'networkidle' });
assert('short diff hash round-trips (duration restored)',
  (await pr.locator('#durations .drow input[type=range]').first().inputValue()) ===
  (await page.locator('#durations .drow input[type=range]').first().inputValue()));

// --- #tool boots straight into the tool, skipping the landing ---
const p2 = await browser.newPage();
const e2 = [];
p2.on('pageerror', e => e2.push('' + e));
await p2.goto(BASE + '#tool', { waitUntil: 'networkidle' });
assert('#tool shows the editor immediately', await p2.locator('#toolview').isVisible());
assert('#tool skips the landing', !(await p2.locator('#landing').isVisible()));

// --- a shared state hash also skips the landing ---
const share = await page.evaluate(() => location.href);   // has encoded state
const p3 = await browser.newPage();
await p3.goto(share, { waitUntil: 'networkidle' });
assert('shared link opens the tool, not the landing', await p3.locator('#toolview').isVisible());

assert('no console/page errors', errors.length === 0 && e2.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
