import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const out = (fmt) => page.click(`.tab[data-fmt="${fmt}"]`).then(()=>page.locator('#out').innerText());
const ecard0 = page.locator('#easings .ecard').first();
await page.goto(BASE, { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)

// Level 1: a back/overshoot preset is available and exports as cubic-bezier
await ecard0.locator('select[data-scope="ease"]').selectOption('out-back');
assert('back preset exports overshoot cubic-bezier', (await out('css')).includes('--motion-ease-standard: cubic-bezier(0.34, 1.56, 0.64, 1)'));

// Level 2: convert "standard" to a spring
await ecard0.locator('select[data-scope="ease"]').selectOption('spring');
assert('spring card shows stiffness+damping sliders', (await ecard0.locator('.ecard__spring input[data-scope="sk"]').count())===1 && (await ecard0.locator('.ecard__spring input[data-scope="sd"]').count())===1);
assert('spring plot is a polyline', (await ecard0.locator('svg.bz polyline.bz-curve').count())===1);

// exports emit linear() with a fallback note
const css = await out('css');
assert('CSS emits linear() for the spring', /--motion-ease-standard: linear\(0, [-0-9., ]+1\);/.test(css));
assert('CSS notes a cubic fallback', css.includes('fallback: --motion-ease-standard: cubic-bezier'));
const json = JSON.parse(await out('json'));
assert('JSON easing is linear()', json.primitives.easing.standard.startsWith('linear('));

// the sampled spring actually overshoots (a value > 1 in the linear list)
const m = css.match(/--motion-ease-standard: linear\(([^)]+)\)/);
const vals = m[1].split(',').map(parseFloat);
assert('spring overshoots (a sample > 1)', Math.max(...vals) > 1);

// an intent bound to "standard" (move) reflects the spring
assert('resolved line shows spring label', (await page.locator('#intents .intent').nth(2).locator('.intent__resolved').innerText()).includes('spring 170/12'));

// stiffness slider changes the sampled curve live
const sk = ecard0.locator('input[data-scope="sk"]');
await sk.fill('60'); await sk.dispatchEvent('input');
await page.waitForTimeout(40);
const css2 = await out('css');
assert('changing stiffness changes linear()', css2.match(/--motion-ease-standard: linear\(([^)]+)\)/)[1] !== m[1]);

// the bench animates the spring natively (linear() lands in the transition)
await page.locator('.probe[data-i="2"] .probe__stage').click();  // probe 2 = move (uses standard)
await page.waitForTimeout(80);
const tr = await page.locator('.probe[data-i="2"] .orb').evaluate(el => el.style.transition);
assert('bench transition uses linear()', tr.includes('linear('));

// spring round-trips through the URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
assert('spring restored from URL (sliders present)', (await p2.locator('#easings .ecard').first().locator('input[data-scope="sk"]').inputValue())==='60');

// convert back to a cubic preset
await ecard0.locator('select[data-scope="ease"]').selectOption('gentle');
assert('converts back to cubic', (await out('css')).includes('--motion-ease-standard: cubic-bezier(0.25, 0.1, 0.25, 1)') && !(await out('css')).includes('--motion-ease-standard: linear('));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
