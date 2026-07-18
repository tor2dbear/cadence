import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const P0 = '.probe[data-i="0"]';
const dotTr = (i) => page.locator(`${P0} .scope__dot`).nth(i).evaluate(el => el.style.transition);
await page.goto(BASE, { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
await page.locator('#intents .intent').first().locator('.intent__more').click();  // reveal stagger/property

// probe 0 defaults to the scope lens: curve + 5 demo dots + playhead
assert('probe 0 is scope', (await page.locator(`${P0} .probe__kind`).inputValue()) === 'scope');
assert('scope has 5 demo dots', (await page.locator(`${P0} .scope__dot`).count()) === 5);
assert('scope has a playhead', (await page.locator(`${P0} .scope__head`).count()) === 1);
// enter uses a cubic easing → the curve is a <path>
assert('scope curve is a path (cubic)', (await page.locator(`${P0} .scope__curve path`).count()) === 1);

// property awareness: set enter → transform, play, dots animate transform on a stagger
await page.locator('#intents .intent').first().locator('[data-scope="iprop"]').selectOption('transform');
await page.locator(`${P0} .probe__stage`).click();
await page.waitForTimeout(80);
const t1 = await dotTr(1), t2 = await dotTr(2);
assert('scope demo animates the chosen property', t1.includes('transform'));
assert('scope demo is staggered (70ms / 140ms)', /(^|\s)70ms/.test(t1) && /(^|\s)140ms/.test(t2));

// spring easing → curve becomes a polyline and the demo bounces via linear()
await page.locator('#easings .ecard').nth(3).locator('select[data-scope="ease"]').selectOption('spring'); // "emphasized" → spring (enter uses it)
await page.waitForTimeout(50);
assert('scope curve becomes a polyline (spring)', (await page.locator(`${P0} .scope__curve polyline`).count()) === 1);
await page.locator(`${P0} .probe__stage`).click();
await page.waitForTimeout(80);
assert('scope demo uses linear() for the spring', (await dotTr(0)).includes('linear('));

// scope lens round-trips through the URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
assert('scope lens restored from URL', (await p2.locator(`${P0} .probe__kind`).inputValue()) === 'scope');

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
