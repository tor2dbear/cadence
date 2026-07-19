import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const out = (fmt) => page.click(`.tab[data-fmt="${fmt}"]`).then(()=>page.locator('#out').innerText());
const enterProp = page.locator('#intents .intent').first().locator('[data-scope="iprop"]');

await page.goto(BASE, { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
await page.locator('#intents .intent').first().locator('.intent__more').click();  // reveal stagger/property

// property field present, defaults to "all"
assert('property field defaults to all', (await enterProp.inputValue()) === 'all');
assert('property has 7 options', (await enterProp.locator('option').count()) === 7);

// CSS emits a composite transition token by default (enter has stagger 70 → delay)
let css = await out('css');
assert('composite token: enter (with delay)', css.includes('--motion-enter: all var(--motion-enter-duration) var(--motion-enter-ease) 70ms;'));
assert('composite token: move (no delay)', css.includes('--motion-move: all var(--motion-move-duration) var(--motion-move-ease);'));

// set enter's property → composite uses it, resolved line shows it, property token appears
await enterProp.selectOption('opacity');
assert('resolved line shows property', (await page.locator('#intents .intent').first().locator('.intent__resolved').innerText()).includes('· opacity'));
css = await out('css');
assert('composite uses chosen property', css.includes('--motion-enter: opacity var(--motion-enter-duration) var(--motion-enter-ease) 70ms;'));

const json = JSON.parse(await out('json'));
assert('JSON has property when set', json.semantic.enter.property === 'opacity' && !('property' in json.semantic.move));
const sd = JSON.parse(await out('sd'));
assert('Style Dictionary has property token', sd.motion.enter.property.value === 'opacity');
const ts = await out('ts');
assert('TS intent includes property', /enter: \{ duration: "200ms", easing: ".*", property: "opacity", stagger: "70ms" \}/.test(ts));
const tw = await out('tailwind');
assert('Tailwind emits transitionProperty', tw.includes('transitionProperty') && tw.includes('"enter": "opacity"'));

// property round-trips through the URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
await p2.locator('#intents .intent').first().locator('.intent__more').click();  // property lives in the advanced panel
assert('property restored on fresh load', (await p2.locator('#intents .intent').first().locator('[data-scope="iprop"]').inputValue()) === 'opacity');

// back to "all" → property drops from JSON, composite still emits with all
await enterProp.selectOption('all');
const json2 = JSON.parse(await out('json'));
assert('property omitted when all', !('property' in json2.semantic.enter));
assert('composite still present with all', (await out('css')).includes('--motion-enter: all var(--motion-enter-duration)'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
