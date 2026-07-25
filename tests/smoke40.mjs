/* Read another system's palette: paste third-party motion tokens and run the
 * SAME opinion layer over them.
 *
 * The engine and its parser are unit-tested headlessly in smoke31; this guards
 * the in-tool wiring — that a pasted palette produces a real verdict + findings,
 * that junk input shows a clean error (not a crash), and that foreign token names
 * can't inject markup into the rendered read. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// the reader lives in the System-read column, collapsed by default
assert('the palette reader starts collapsed', !(await page.locator('#paletteRd').evaluate(el => el.open)));
await page.locator('#paletteRd summary').click();

// a foreign palette with a deliberate flaw: two identical easings + a steep ladder
const foreign = `--dur-fast: 90ms;\n--dur-base: 100ms;\n--dur-huge: 900ms;\n--ease-a: cubic-bezier(.2,0,.2,1);\n--ease-b: cubic-bezier(.2,0,.2,1);`;
await page.fill('#paletteIn', foreign);
await page.locator('#paletteRead').click();
await page.waitForTimeout(200);

const verdict = (await page.locator('.paletterd__verdict').textContent()) || '';
assert('a pasted palette produces a grade + /100 verdict', /[A-E]\s*·\s*\d+\/100/.test(verdict));
assert('the verdict meta counts the parsed primitives', /duration/.test(verdict) && /easing/.test(verdict));
const findings = await page.$$eval('#paletteOut .rd', els => els.map(e => e.textContent));
assert('the read renders findings over the foreign system', findings.length >= 2);
assert('it catches the duplicate easing in the pasted tokens', findings.some(f => /nearly identical curves/.test(f)));
assert('a warning finding carries its fix', findings.some(f => /→/.test(f)));

// junk input → a clean error, no verdict, no crash
await page.fill('#paletteIn', 'this is just prose, not tokens');
await page.locator('#paletteRead').click();
await page.waitForTimeout(150);
assert('junk input shows a clean error', await page.locator('#paletteErr').isVisible());
assert('junk input clears the previous verdict', (await page.locator('#paletteOut').textContent()).trim() === '');

// a hostile token name can't inject markup into the rendered read
await page.fill('#paletteIn', '--<img src=x onerror=alert(1)>evil: 150ms; --base: 200ms; --slow: 300ms;');
await page.locator('#paletteRead').click();
await page.waitForTimeout(150);
assert('no <img> element is injected from a hostile token name', (await page.locator('#paletteOut img').count()) === 0);

// Clear resets the reader
await page.locator('#paletteClear').click();
assert('Clear empties the input and output', (await page.locator('#paletteIn').inputValue()) === '' && (await page.locator('#paletteOut').textContent()).trim() === '');

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
