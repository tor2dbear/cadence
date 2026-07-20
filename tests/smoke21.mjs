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
const resolved = () => intent().locator('.intent__resolved').innerText();

await page.goto(BASE, { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }
await intent().locator('.intent__more').click();

// 7 tabs now (added Transitions)
assert('7 export tabs present', await page.locator('.tabs .tab').count() === 7);
// nothing tagged → placeholder
assert('vt export placeholder when none', (await out('vt')).includes('No view transitions yet'));

// tick "view transition" on enter → defaults to root
await intent().locator('[data-scope="ivt"]').click();
assert('VT kind select appears', await intent().locator('[data-scope="ivttype"]').count() === 1);
assert('resolved line shows vt·root', (await resolved()).includes('vt·root'));

// Transitions tab emits the root cross-fade recipe keyed to the intent tokens
let vt = await out('vt');
assert('header notes VT is Baseline', vt.includes('Baseline (Chrome/Edge 111+, Safari 18+,') && vt.includes('Firefox 144+)'));
assert('root targets ::view-transition-old/new(root)', vt.includes('::view-transition-old(root),') && vt.includes('::view-transition-new(root){'));
assert('root uses the intent duration token', vt.includes('animation-duration:var(--motion-enter-duration);'));
assert('root uses the intent ease token', vt.includes('animation-timing-function:var(--motion-enter-ease);'));
assert('reduced-motion nixes the animation', vt.includes('::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){ animation:none !important; }'));
assert('feature-detects startViewTransition', vt.includes('if(!document.startViewTransition){ update(); return; }'));
assert('ships a swap() scaffold', vt.includes('document.startViewTransition(update);'));
assert('no nested block comments in scaffold', !/\/\*[^*]*\/\*/.test(vt.split('swap(update)')[1] || vt));

// switch to shared → named element morph
await intent().locator('[data-scope="ivttype"]').selectOption('shared');
assert('resolved line shows vt·shared', (await resolved()).includes('vt·shared'));
vt = await out('vt');
assert('shared sets a view-transition-name', vt.includes('view-transition-name:enter;'));
assert('shared targets the group pseudo', vt.includes('::view-transition-group(enter){'));
assert('shared group uses the intent tokens', vt.includes('animation-duration:var(--motion-enter-duration);'));

// system read notes VT
assert('system read notes the view transition', /view transition/.test(await page.locator('#hints').innerText()));

// bench lens: shared → morph element present
await page.locator('.probe__kind').first().selectOption('viewtransition');
assert('VT lens shows the shared morph', await page.locator('.probe[data-i="0"] .vt__morph').count() === 1);
// back to root type → lens shows old/new cross-fade panes
await intent().locator('[data-scope="ivttype"]').selectOption('root');
assert('VT lens shows root old/new panes',
  await page.locator('.probe[data-i="0"] .vt__old').count() === 1 && await page.locator('.probe[data-i="0"] .vt__new').count() === 1);

// vt round-trips through the URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }
await p2.locator('#intents .intent').first().locator('.intent__more').click();
assert('vt restored on fresh load', await p2.locator('#intents .intent').first().locator('[data-scope="ivttype"]').inputValue() === 'root');

// untick → drops, back to placeholder
await intent().locator('[data-scope="ivt"]').click();
assert('unticking removes the kind select', await intent().locator('[data-scope="ivttype"]').count() === 0);
assert('vt export back to placeholder', (await out('vt')).includes('No view transitions yet'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
