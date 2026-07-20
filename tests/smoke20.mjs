import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const out = (fmt) => page.click(`.tab[data-fmt="${fmt}"]`).then(()=>page.locator('#out').innerText());
const intent = () => page.locator('#intents .intent').first();
const mode   = () => intent().locator('[data-scope="iscrollmode"]');
const resolved = () => intent().locator('.intent__resolved').innerText();

await page.goto(BASE, { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel
await intent().locator('.intent__more').click();  // reveal the advanced panel

// enable scroll-driven (defaults to reveal), then switch to scrub
await intent().locator('[data-scope="ireveal"]').click();
assert('mode select appears when scroll enabled', await mode().count() === 1);
await mode().selectOption('scrub');
assert('scrub fields appear', await intent().locator('[data-scope="iscrubfx"]').count() === 1);
assert('switching to scrub drops the reveal % field', await intent().locator('[data-scope="irevat"]').count() === 0);
assert('resolved line shows scrub·view/progress', (await resolved()).includes('scrub·view/progress'));

// Scroll tab emits the native scrub recipe (progress / view / cover)
let scr = await out('scroll');
assert('header notes scroll POSITION is the axis', /scroll POSITION is the axis/.test(scr));
assert('emits @keyframes scrub', scr.includes('@keyframes scrub-enter{'));
assert('progress → scaleX keyframes', scr.includes('transform:scaleX(0)') && scr.includes('transform:scaleX(1)'));
assert('progress sets transform-origin', scr.includes('transform-origin:left;'));
assert('auto duration (timeline-driven)', scr.includes('animation:scrub-enter auto var(--motion-enter-ease) both;'));
assert('native animation-timeline:view()', scr.includes('animation-timeline:view();'));
assert('range spans cover 0→100', scr.includes('animation-range:cover 0% cover 100%;'));
assert('reduced-motion pins the end state', scr.includes('.scrub-enter{ animation:none; transform:scaleX(1); }'));
assert('scrub fallback driver present', scr.includes("scrubItems=[['.scrub-enter','progress',40]]"));

// effect → parallax: translateY keyframes
await intent().locator('[data-scope="iscrubfx"]').selectOption('parallax');
scr = await out('scroll');
assert('parallax → translateY keyframes', scr.includes('transform:translateY(40px)') && scr.includes('transform:translateY(-40px)'));
assert('parallax reduced-motion pins end', scr.includes('.scrub-enter{ animation:none; transform:translateY(-40px); }'));

// timeline → scroll(): swaps the timeline and drops the named range
await intent().locator('[data-scope="iscrubtl"]').selectOption('scroll');
assert('range field hidden for scroll() timeline', await intent().locator('[data-scope="iscrubrange"]').count() === 0);
scr = await out('scroll');
assert('native animation-timeline:scroll()', scr.includes('animation-timeline:scroll();'));
assert('no named range under scroll()', !/animation-range/.test(scr));

// back to view + range entry
await intent().locator('[data-scope="iscrubtl"]').selectOption('view');
await intent().locator('[data-scope="iscrubrange"]').selectOption('entry');
scr = await out('scroll');
assert('range entry 0→100', scr.includes('animation-range:entry 0% entry 100%;'));

// system read notes the scrub (non-linear easing → warns; enter uses emphasized)
assert('system read notes the scrub', /scroll scrub|scrubs with a non-linear/.test(await page.locator('#hints').innerText()));

// the scrub bench lens renders a real scroll box + target
await page.locator('.probe__kind').first().selectOption('scrub');
assert('scrub lens present', await page.locator('.probe[data-i="0"] .scrubx').count() === 1);
assert('lens target carries the effect class', await page.locator('.probe[data-i="0"] .scrubx__target--parallax').count() === 1);

// scrub round-trips through the URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }
await p2.locator('#intents .intent').first().locator('.intent__more').click();
assert('scrub mode restored on fresh load',
  (await p2.locator('#intents .intent').first().locator('[data-scope="iscrollmode"]').inputValue()) === 'scrub');
assert('scrub effect restored on fresh load',
  (await p2.locator('#intents .intent').first().locator('[data-scope="iscrubfx"]').inputValue()) === 'parallax');

// switching back to reveal drops scrub (mutual exclusivity)
await page.locator('#intents .intent').first().locator('[data-scope="iscrollmode"]').selectOption('reveal');
assert('reveal restores its % field', await page.locator('#intents .intent').first().locator('[data-scope="irevat"]').count() === 1);
assert('scrub fields gone', await page.locator('#intents .intent').first().locator('[data-scope="iscrubfx"]').count() === 0);

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
