import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;

const browser = await chromium.launch();
const errors = [];
const newPage = async () => {
  const p = await browser.newPage();
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  return p;
};
const assert = (name, cond) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);

// --- author a system on page A ---
const a = await newPage();
await a.goto(BASE, { waitUntil: 'networkidle' });

// hash should be written on load
await a.waitForFunction(() => location.hash.length > 1);
assert('hash written on load', (await a.evaluate(() => location.hash)).length > 1);

// mutate: add a step, rename first duration, add an easing, repoint a probe
await a.click('#addDuration');
const dn = a.locator('#durations .drow__name').first();
await dn.fill('instant'); await dn.blur();
await a.click('#addEasing');
// change the first probe's intent to the last intent
const probeSel = a.locator('.probe__sel').first();
const intentNames = await a.locator('#intents .intent__name').evaluateAll(els => els.map(e => e.value));
await probeSel.selectOption({ label: intentNames[intentNames.length - 1] });

const durCountA = await a.locator('#durations .drow').count();
const easeCountA = await a.locator('#easings .ecard').count();
const sharedURL = await a.evaluate(() => location.href);
const probeValA = await probeSel.inputValue();
assert('shared URL has hash', sharedURL.includes('#'));

// --- open the shared URL fresh on page B ---
const b = await newPage();
await b.goto(sharedURL, { waitUntil: 'networkidle' });
assert('restored duration count', await b.locator('#durations .drow').count() === durCountA);
assert('restored easing count', await b.locator('#easings .ecard').count() === easeCountA);
const namesB = await b.locator('#durations .drow__name').evaluateAll(els => els.map(e => e.value));
assert('restored renamed step "instant"', namesB.includes('instant'));
// probe mapping restored (by index): first probe selects same intent id position
const probeValB = await b.locator('.probe__sel').first().inputValue();
const intentsA = await a.locator('.probe__sel').first().evaluate(el => [...el.options].map(o => o.textContent));
const intentsB = await b.locator('.probe__sel').first().evaluate(el => [...el.options].map(o => o.textContent));
assert('restored probe points to same intent name',
  intentsA[[...await a.locator('.probe__sel').first().evaluate(el => [...el.options].map(o=>o.value))].indexOf(probeValA)] ===
  intentsB[[...await b.locator('.probe__sel').first().evaluate(el => [...el.options].map(o=>o.value))].indexOf(probeValB)]);

// export on B should reflect the renamed token
const outB = await b.locator('#out').innerText();
assert('restored export contains --motion-duration-instant', outB.includes('--motion-duration-instant'));

// --- malformed hash falls back to defaults ---
const c = await newPage();
await c.goto(BASE + '#s=totally%20broken!!!', { waitUntil: 'networkidle' });
assert('malformed hash -> default 5 durations', await c.locator('#durations .drow').count() === 5);
assert('malformed hash -> default 4 easings', await c.locator('#easings .ecard').count() === 4);

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);

await browser.close();
