import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
await page.goto(BASE, { waitUntil: 'networkidle' });

// intent dots colour by role
const dot0 = await page.locator('.intent__dot').first().evaluate(el => getComputedStyle(el).backgroundColor);
assert('enter dot is teal', dot0 === 'rgb(138, 208, 198)');
assert('5 intent dots', (await page.locator('.intent__dot').count()) === 5);

// probes inherit their intent's colour
const scope0 = await page.locator('.probe[data-i="0"] .scope__dot').first().evaluate(el => getComputedStyle(el).backgroundColor);
assert('probe 0 (enter) scope teal', scope0 === 'rgb(138, 208, 198)');
const orb1 = await page.locator('.probe[data-i="1"] .orb').evaluate(el => getComputedStyle(el).backgroundColor);
assert('probe 1 (exit) orb red', orb1 === 'rgb(224, 139, 127)');
const orb2 = await page.locator('.probe[data-i="2"] .orb').evaluate(el => getComputedStyle(el).backgroundColor);
assert('probe 2 (move) orb amber', orb2 === 'rgb(233, 184, 114)');
// changing a probe's intent recolours it
await page.locator('.probe[data-i="2"] .probe__sel').selectOption({ label: 'exit' });
const orb2b = await page.locator('.probe[data-i="2"] .orb').evaluate(el => getComputedStyle(el).backgroundColor);
assert('repoint probe → recolours to exit red', orb2b === 'rgb(224, 139, 127)');

// intro strip: visible, dismissible, remembered across reload
assert('intro visible initially', !(await page.locator('#intro').getAttribute('hidden') !== null));
await page.click('#introClose');
assert('intro hidden after dismiss', (await page.locator('#intro').isHidden()));
await page.reload({ waitUntil: 'networkidle' });
assert('intro stays hidden after reload', (await page.locator('#intro').isHidden()));

// mobile header: no horizontal overflow, actions grouped
const m = await ctx.newPage();
await m.setViewportSize({ width: 380, height: 780 });
await m.goto(BASE, { waitUntil: 'networkidle' });
const ov = await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
assert('mobile: no horizontal overflow', ov);
assert('header actions grouped', (await m.locator('.header-actions .loadsys').count()) === 1 && (await m.locator('.header-actions .proto').count()) === 1);

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
