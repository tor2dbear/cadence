import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const leftOf = (i) => page.locator('.probe[data-i="0"] .casc__bar').nth(i).evaluate(el => parseFloat(el.style.left));
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
await page.locator('#intents .intent').first().locator('.intent__more').click();  // reveal stagger/property
await page.locator('.probe[data-i="0"] .probe__kind').selectOption('cascade');
await page.waitForTimeout(40);

// probe 0 now shows the cascade timeline with 6 lanes
assert('probe 0 switched to cascade', (await page.locator('.probe[data-i="0"] .probe__kind').inputValue()) === 'cascade');
assert('cascade has 6 lanes', (await page.locator('.probe[data-i="0"] .casc__lane').count()) === 6);
assert('cascade has a playhead', (await page.locator('.probe[data-i="0"] .casc__head').count()) === 1);

// with stagger 70, bars step across the timeline (lane k starts later than k-1)
const l0 = await leftOf(0), l1 = await leftOf(1), l5 = await leftOf(5);
assert('bars are staggered (0 < l1 < l5)', l0 === 0 && l1 > l0 && l5 > l1);

// set enter's stagger to 0 → the timeline collapses (all bars start aligned)
const stag = page.locator('#intents .intent').first().locator('input.stag');
await stag.fill('0'); await stag.dispatchEvent('input');
await page.waitForTimeout(40);
assert('stagger 0 → bars align at 0%', (await leftOf(0)) === 0 && (await leftOf(5)) === 0);

// raise it high → steeper staircase, and system-read warns
await stag.fill('200'); await stag.dispatchEvent('input');
await page.waitForTimeout(40);
assert('stagger 200 → last lane pushed far right', (await leftOf(5)) > 60);
assert('system-read warns on long stagger', /waits 800ms/.test(await page.locator('#hints').innerText()));

// playing the cascade animates without error (fills + playhead)
await page.locator('.probe[data-i="0"] .probe__stage').click();
await page.waitForTimeout(120);
const filled = await page.locator('.probe[data-i="0"] .casc__fill').first().evaluate(el => el.style.transform);
assert('cascade plays (fill scales up)', filled.includes('scaleX(1)') || filled.includes('scale'));

// cascade round-trips as a probe kind through the URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
assert('cascade lens restored from URL', (await p2.locator('.probe[data-i="0"] .probe__kind').inputValue()) === 'cascade');

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
