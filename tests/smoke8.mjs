import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const out = (fmt) => page.click(`.tab[data-fmt="${fmt}"]`).then(()=>page.locator('#out').innerText());
const enterStag = page.locator('#intents .intent').first().locator('input.stag');

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
await page.locator('#intents .intent').first().locator('.intent__more').click();  // reveal stagger/property

// default: enter carries stagger 70, shown in the resolved line
assert('enter defaults to stagger 70', (await enterStag.inputValue()) === '70');
assert('resolved line shows stagger', (await page.locator('#intents .intent').first().locator('.intent__resolved').innerText()).includes('stagger 70ms'));

// CSS export emits the stagger token; zero-stagger intents omit it
const css = await out('css');
assert('CSS has --motion-enter-stagger', css.includes('--motion-enter-stagger: 70ms'));
assert('CSS omits stagger for move (0)', !css.includes('--motion-move-stagger'));

// the reveal probe uses the intent's stagger token (per-item delay)
await page.locator('.probe__kind').first().selectOption('reveal');   // probe 0 points at "enter"
await page.locator('.probe[data-i="0"] .probe__stage').click();
await page.waitForTimeout(60);
const t1 = await page.locator('.probe[data-i="0"] .card').nth(1).evaluate(el => el.style.transition);
const t2 = await page.locator('.probe[data-i="0"] .card').nth(2).evaluate(el => el.style.transition);
assert('reveal card 2 delayed 70ms', /(^|\s)70ms/.test(t1));
assert('reveal card 3 delayed 140ms', /(^|\s)140ms/.test(t2));

// system-read: a healthy stagger reads ok; a long one warns
let hints = await page.locator('#hints').innerText();
assert('system-read notes the stagger (ok)', /staggers 70ms/.test(hints) && /cascades over 280ms/.test(hints));
await enterStag.fill('200');
await enterStag.dispatchEvent('input');
await page.waitForTimeout(30);
hints = await page.locator('#hints').innerText();
assert('long stagger warns (lead 800ms)', /waits 800ms/.test(hints));

// other export formats carry stagger too
const ts = await out('ts');
assert('TS intent includes stagger', /enter: \{ duration:.*stagger: "200ms" \}/.test(ts));
const tw = await out('tailwind');
assert('Tailwind emits transitionDelay', tw.includes('transitionDelay') && tw.includes('"enter": "200ms"'));
const sd = await out('sd');
assert('Style Dictionary emits stagger token', JSON.parse(sd).motion.enter.stagger.value === '200ms');

// stagger round-trips through the URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
await p2.locator('#intents .intent').first().locator('.intent__more').click();  // stagger lives in the advanced panel
assert('stagger restored on fresh load', (await p2.locator('#intents .intent').first().locator('input.stag').inputValue()) === '200');

// set to 0 → stagger token disappears from export
await enterStag.fill('0'); await enterStag.dispatchEvent('input');
assert('zeroing stagger removes the token', !(await out('css')).includes('--motion-enter-stagger'));

// a loaded template (no stagger data) exports clean
await page.selectOption('#loadSystem', 'GitHub Primer');
await page.waitForTimeout(40);
assert('template has no stagger tokens', !(await out('css')).includes('-stagger'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
