import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const out = (fmt) => page.click(`.tab[data-fmt="${fmt}"]`).then(()=>page.locator('#out').innerText());
const fastMs = () => page.locator('#durations .drow__val').first().innerText();
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)

// tempo scales the whole ladder
const before = parseInt(await fastMs());
await page.click('#tempoUp');
const up = parseInt(await fastMs());
assert('tempo + speeds up (fast grows)', up > before);
await page.click('#tempoDown'); await page.click('#tempoDown');
const down = parseInt(await fastMs());
assert('tempo − slows down (fast shrinks below the sped-up value)', down < up);

// reduced-motion mode: one click adds a minimal mode
await page.goto('about:blank');                                 // force a real reload…
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });  // …fresh load resets tempo
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
assert('reduced-motion button present', (await page.locator('.mode--reduced').count()) === 1);
await page.click('.mode--reduced');
assert('reduced mode added + active', (await page.locator('.mode.active .mode__name').inputValue()) === 'reduced');
assert('reduced button gone (already exists)', (await page.locator('.mode--reduced').count()) === 0);
// enter's reduced binding: fastest duration, no stagger
const enterResolved = await page.locator('#intents .intent').first().locator('.intent__resolved').innerText();
assert('reduced enter has no stagger', !enterResolved.includes('stagger'));
assert('reduced enter uses fastest duration (150ms)', enterResolved.includes('150ms'));

// CSS export emits a prefers-reduced-motion block
assert('CSS exports @media reduced-motion', (await out('css')).includes('@media (prefers-reduced-motion: reduce)'));

// it round-trips (reduced is just a mode)
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
const names = await p2.locator('.modes .mode').evaluateAll(els => els.map(e => (e.querySelector('.mode__name')?.value) || e.textContent.trim()));
assert('reduced mode restored from URL', names.some(n => n === 'reduced'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
