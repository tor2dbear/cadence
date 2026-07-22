import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const out = (fmt) => page.click(`.tab[data-fmt="${fmt}"]`).then(()=>page.locator('#out').innerText());

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)

// distance block is collapsed by default, and default export has NO distance tokens
assert('distance block collapsed by default', await page.locator('#distanceWrap').isHidden());
assert('CSS has no distance tokens by default', !(await out('css')).includes('--motion-distance'));

// expand it → the 4 default distances render
await page.click('#distToggle');
assert('distance block expands', await page.locator('#distanceWrap').isVisible());
assert('four default distances', (await page.locator('#distances .drow').count()) === 4);
assert('screen distance shows 720px', (await page.locator('#distances .drow').last().locator('.drow__val').innerText()) === '720px');

// point "enter" at the "screen" distance via the intent's more panel
const enter = page.locator('#intents .intent').first();
await enter.locator('.intent__more').click();
const idist = enter.locator('[data-scope="idist"]');
assert('distance selector defaults to none', (await idist.inputValue()) === '');
assert('distance selector has none + 4', (await idist.locator('option').count()) === 5);
await idist.selectOption('screen');

// resolved line shows the px; export now carries distance tokens
assert('resolved line shows px', (await enter.locator('.intent__resolved').innerText()).includes('720px'));
let css = await out('css');
assert('CSS emits distance primitive', css.includes('--motion-distance-screen: 720px;'));
assert('CSS emits intent distance var', css.includes('--motion-enter-distance: var(--motion-distance-screen);'));
const json = JSON.parse(await out('json'));
assert('JSON primitive distance', json.primitives.distance.screen === '720px');
assert('JSON semantic distance ref', json.semantic.enter.distance === '{distance.screen}');
const sd = JSON.parse(await out('sd'));
assert('Style Dictionary distance token', sd.motion.enter.distance.value === '720px');
const ts = await out('ts');
assert('TS intent includes distance', /enter: \{ duration:.*distance: "720px".* \}/.test(ts));

// system-read: 720px in 200ms = 3.6px/ms → reads naturally (ok). Speed it up → jump warning.
let hints = await page.locator('#hints').innerText();
assert('velocity ok at 3.6px/ms', /Travel speeds read naturally/.test(hints) && /3\.6px\/ms/.test(hints));
await enter.locator('[data-scope="idur"]').selectOption('fast');   // 150ms → 4.8px/ms still ok
await enter.locator('.intent__more');
// drop to an even faster duration by scaling tempo down twice would help, but easier: retarget nudge? Instead push px up via slider
const screenSlider = page.locator('#distances .drow').last().locator('input[type=range]');
await screenSlider.evaluate(el => { el.value = 1000; el.dispatchEvent(new Event('input', {bubbles:true})); });
hints = await page.locator('#hints').innerText();
assert('fast large travel warns as a jump', /read as a jump/.test(hints));

// distance round-trips through the URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
assert('distance block auto-opens on load when used', await p2.locator('#distanceWrap').isVisible());
await p2.locator('#intents .intent').first().locator('.intent__more').click();
assert('intent distance restored', (await p2.locator('#intents .intent').first().locator('[data-scope="idist"]').inputValue()) === 'screen');

// remove the distance from the intent → tokens disappear again
await idist.selectOption('');
assert('distance tokens drop when set to none', !(await out('css')).includes('--motion-distance'));

// renaming a distance cascades to the binding
await idist.selectOption('panel');
await page.locator('#distances .drow').nth(2).locator('.drow__name').fill('sheet');
await page.locator('#distances .drow').nth(2).locator('.drow__name').dispatchEvent('change');
await page.waitForTimeout(40);
assert('rename cascades to intent binding', (await enter.locator('[data-scope="idist"]').inputValue()) === 'sheet');
assert('renamed distance token in CSS', (await out('css')).includes('--motion-distance-sheet'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
