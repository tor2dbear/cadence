import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)

// Enter commits a rename (no blur needed)
const dn = page.locator('#durations .drow__name').first();
await dn.click(); await dn.fill('zippy'); await dn.press('Enter');
await page.waitForTimeout(40);
assert('Enter commits duration rename', (await page.locator('#durations .drow__name').first().inputValue()) === 'zippy');
const css = await page.click('.tab[data-fmt="css"]').then(()=>page.locator('#out').innerText());
assert('rename cascaded via Enter (exit → zippy)', css.includes('--motion-exit-duration: var(--motion-duration-zippy)'));

// remove-× hidden at the minimum
for (let k=0;k<4;k++){ await page.locator('#durations .drow__rm').first().click(); await page.waitForTimeout(20); }
assert('durations down to 1 → no remove-×', (await page.locator('#durations .drow').count())===1 && (await page.locator('#durations .drow__rm').count())===0);
for (let k=0;k<3;k++){ await page.locator('#easings .ecard__rm').first().click(); await page.waitForTimeout(20); }
assert('easings down to 1 → no remove-×', (await page.locator('#easings .ecard').count())===1 && (await page.locator('#easings .ecard__rm').count())===0);
for (let k=0;k<4;k++){ await page.locator('#intents .intent__rm').first().click(); await page.waitForTimeout(20); }
assert('intents down to 1 → no remove-×', (await page.locator('#intents .intent').count())===1 && (await page.locator('#intents .intent__rm').count())===0);

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
