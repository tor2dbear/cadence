import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const out = (fmt) => page.click(`.tab[data-fmt="${fmt}"]`).then(()=>page.locator('#out').innerText());
const enterMore = () => page.locator('#intents .intent').first().locator('.intent__more');
const revChk = page.locator('#intents .intent').first().locator('[data-scope="ireveal"]');
const revAt  = page.locator('#intents .intent').first().locator('[data-scope="irevat"]');
const resolved = () => page.locator('#intents .intent').first().locator('.intent__resolved').innerText();

await page.goto(BASE, { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
await enterMore().click();  // reveal the advanced panel

// with nothing tagged, the Scroll tab shows a placeholder (not a broken export)
assert('scroll export placeholder when no reveals', (await out('scroll')).includes('No scroll reveals yet'));

// tick "scroll reveal" on enter → defaults to 15% and shows in the resolved line
// (click, not check(): toggling re-renders the panel and detaches the node)
await revChk.click();
assert('reveal checkbox toggles the % field in', await revAt.count() === 1);
assert('reveal defaults to 15%', (await revAt.inputValue()) === '15');
assert('resolved line shows reveal@15%', (await resolved()).includes('reveal@15%'));

// Scroll tab now emits BOTH recipes: native scroll-driven + IO fallback
let scr = await out('scroll');
assert('emits @keyframes for the reveal', scr.includes('@keyframes reveal-enter{'));
assert('emits native animation-timeline:view()', scr.includes('animation-timeline:view();'));
assert('maps 15% → animation-range entry 85%', scr.includes('animation-range:entry 0% entry 85%;'));
assert('emits @supports fallback guard', scr.includes('@supports not (animation-timeline:view()){'));
assert('fallback drives .is-in class', scr.includes('.reveal-enter.is-in{ opacity:1; transform:none; }'));
assert('ships an IntersectionObserver driver', scr.includes('new IntersectionObserver') && scr.includes("threshold:0.15"));
assert('honors reduced-motion', scr.includes('@media (prefers-reduced-motion:reduce){'));
assert('honesty note: scrub vs trigger', /SCRUBS[\s\S]*TRIGGERS/.test(scr));

// system read gains a reveal note only now (opt-in — quiet by default)
assert('system read notes the reveal', /scroll reveal/.test(await page.locator('#hints').innerText()));

// change the trigger → range + IO threshold follow
await revAt.fill('30'); await revAt.dispatchEvent('input');
assert('resolved line updates to reveal@30%', (await resolved()).includes('reveal@30%'));
scr = await out('scroll');
assert('30% → animation-range entry 70%', scr.includes('animation-range:entry 0% entry 70%;'));
assert('30% → IO threshold 0.30', scr.includes('threshold:0.30'));

// a stagger on a reveal surfaces the honest split note
await page.locator('#intents .intent').first().locator('[data-scope="istag"]').fill('80');
await page.locator('#intents .intent').first().locator('[data-scope="istag"]').dispatchEvent('input');
assert('reveal + stagger warns about the native/JS split', /own timeline/.test(await page.locator('#hints').innerText()));

// the scroll-reveal bench lens renders a real scroll box with hidden cards
await page.locator('.probe__kind').first().selectOption('scrollreveal');
assert('scrollreveal lens present', await page.locator('.probe[data-i="0"] .sreveal').count() === 1);
assert('lens has 5 reveal cards', await page.locator('.probe[data-i="0"] .sr-card').count() === 5);
assert('cards start hidden (opacity 0)',
  (await page.locator('.probe[data-i="0"] .sr-card').first().evaluate(el => getComputedStyle(el).opacity)) === '0');

// reveal round-trips through the URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }
await p2.locator('#intents .intent').first().locator('.intent__more').click();
assert('reveal % restored on fresh load',
  (await p2.locator('#intents .intent').first().locator('[data-scope="irevat"]').inputValue()) === '30');

// untick → reveal drops, Scroll tab returns to the placeholder
await revChk.click();
assert('unticking removes the % field', await revAt.count() === 0);
assert('scroll export back to placeholder', (await out('scroll')).includes('No scroll reveals yet'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
