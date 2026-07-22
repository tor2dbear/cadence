import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const out = (fmt) => page.click(`.tab[data-fmt="${fmt}"]`).then(()=>page.locator('#out').innerText());
const enter = () => page.locator('#intents .intent').first();
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
await enter().locator('.intent__more').click();

// split toggle present, off by default; no effects field yet
assert('split toggle present, unchecked', (await enter().locator('[data-scope="isplit"]').isChecked()) === false);
assert('no effects easing field yet', (await enter().locator('[data-scope="ieff"]').count()) === 0);

// enable split → effects field appears, spatial label, and system-read nudges (both equal)
await enter().locator('[data-scope="isplit"]').check();
assert('effects easing field appears', (await enter().locator('[data-scope="ieff"]').count()) === 1);
assert('core easing relabels to spatial', (await enter().innerText()).toLowerCase().includes('spatial'));
assert('system-read nudges idle split', (await page.locator('#hints').innerText()).includes('both use the same easing'));

// diverge: effects → accelerate (spatial stays emphasized)
await enter().locator('[data-scope="ieff"]').selectOption('accelerate');
assert('idle-split nudge clears', !(await page.locator('#hints').innerText()).includes('both use the same easing'));

// exports carry the split
const css = await out('css');
assert('CSS emits effects-ease + effects composite',
  css.includes('--motion-enter-effects-ease: var(--motion-ease-accelerate)') &&
  css.includes('--motion-enter-effects: opacity var(--motion-enter-duration) var(--motion-enter-effects-ease)'));
const json = JSON.parse(await out('json'));
assert('JSON carries effectsEasing', json.semantic.enter.effectsEasing === '{easing.accelerate}');

// scope demo (property "all") drives opacity with effects, transform with spatial
await page.locator('.probe[data-i="0"] .probe__stage').click();
await page.waitForTimeout(80);
const tr = await page.locator('.probe[data-i="0"] .scope__dot').first().evaluate(el => el.style.transition);
assert('scope: opacity uses effects easing', tr.includes('opacity') && tr.includes('cubic-bezier(0.4, 0, 1, 1)'));
assert('scope: transform uses spatial easing', tr.includes('transform') && tr.includes('cubic-bezier(0.22, 1, 0.36, 1)'));

// round-trips through URL
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
await p2.locator('#intents .intent').first().locator('.intent__more').click();
assert('split restored from URL', (await p2.locator('#intents .intent').first().locator('[data-scope="ieff"]').inputValue()) === 'accelerate');

// collapse the split → effects tokens disappear
await enter().locator('[data-scope="isplit"]').uncheck();
assert('collapsing split removes effects tokens', !(await out('css')).includes('--motion-enter-effects-ease'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
