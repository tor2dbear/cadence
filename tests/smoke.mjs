import { chromium } from 'playwright';

const URL = new globalThis.URL('../index.html', import.meta.url).href;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(URL + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)

const durCount = () => page.locator('#durations .drow').count();
const easeCount = () => page.locator('#easings .ecard').count();
const outText = () => page.locator('#out').innerText();
const hintCount = () => page.locator('#hints .rd').count();

const assert = (name, cond) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);

// initial state
assert('initial durations = 5', await durCount() === 5);
assert('initial easings = 4', await easeCount() === 4);
assert('system-read renders hints', await hintCount() >= 3);
assert('export has enter->emphasized', (await outText()).includes('--motion-enter-ease') && (await outText()).includes('var(--motion-ease-emphasized)'));

// add a duration step
await page.click('#addDuration');
assert('add step -> durations = 6', await durCount() === 6);

// add an easing
await page.click('#addEasing');
assert('add easing -> easings = 5', await easeCount() === 5);

// rename first duration "fast" -> "quick" and confirm the cascade into export
const firstDurName = page.locator('#durations .drow__name').first();
await firstDurName.fill('quick');
await firstDurName.blur();
let out = await outText();
assert('rename cascades: --motion-duration-quick present', out.includes('--motion-duration-quick'));
assert('rename cascades: old --motion-duration-fast gone', !out.includes('--motion-duration-fast:'));
// "exit" intent referenced "fast" -> should now reference "quick"
assert('rename cascades into intent ref (exit->quick)', out.includes('--motion-exit-duration') && out.includes('var(--motion-duration-quick)'));

// rename cascade for easing: rename "emphasized" easing slot -> "expressive"
const emphInput = page.locator('#easings .ecard__name', { hasText: '' });
// find the ecard whose value is "emphasized"
const names = await page.locator('#easings .ecard__name').evaluateAll(els => els.map(e => e.value));
const emphIdx = names.indexOf('emphasized');
const emphField = page.locator('#easings .ecard__name').nth(emphIdx);
await emphField.fill('expressive');
await emphField.blur();
out = await outText();
assert('easing rename: --motion-ease-expressive present', out.includes('--motion-ease-expressive'));
assert('easing rename cascades into enter intent', out.includes('--motion-enter-ease') && out.includes('var(--motion-ease-expressive)'));

// remove the easing we just added back down: remove first easing
await page.locator('#easings .ecard__rm').first().click();
assert('remove easing -> easings = 4', await easeCount() === 4);

// remove a duration
await page.locator('#durations .drow__rm').first().click();
assert('remove step -> durations = 5', await durCount() === 5);

// slug safety: rename with spaces/caps -> becomes slug
const dn = page.locator('#durations .drow__name').first();
await dn.fill('Super Slow!!');
await dn.blur();
const slugged = await page.locator('#durations .drow__name').first().inputValue();
assert('name slugified to "super-slow"', slugged === 'super-slow');

// play-all should not throw
await page.click('#playAll');
await page.waitForTimeout(400);

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);

await browser.close();
