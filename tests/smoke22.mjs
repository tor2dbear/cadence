import { chromium } from 'playwright';
const DEMO = new URL('../demo.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const visible = sel => page.locator(sel).evaluate(el => !el.hidden).catch(()=>false);
const opacity = sel => page.locator(sel).evaluate(el => parseFloat(getComputedStyle(el).opacity));

await page.goto(DEMO, { waitUntil: 'networkidle' });

// --- structure: the three new surfaces are present ---
assert('scroll progress bar present', await page.locator('#progress').count() === 1);
assert('reveal section has 5 cards', await page.locator('.revealcard').count() === 5);
assert('native scroll timelines supported here', await page.evaluate(() => CSS.supports('animation-timeline: view()')));

// --- view transition: switching tabs swaps the panel ---
assert('overview panel visible by default', await visible('.panel[data-panel="overview"]'));
assert('activity panel hidden by default', !(await visible('.panel[data-panel="activity"]')));
await page.locator('#tabs .tab[data-panel="activity"]').click();
await page.waitForTimeout(250);   // let the view transition settle
assert('activity panel visible after tab switch', await visible('.panel[data-panel="activity"]'));
assert('overview panel hidden after tab switch', !(await visible('.panel[data-panel="overview"]')));
assert('activity tab is active', await page.locator('#tabs .tab[data-panel="activity"]').evaluate(el => el.classList.contains('active')));
assert('no error during startViewTransition', errors.length === 0);

// --- settings toggle rides the tokens ---
await page.locator('#tabs .tab[data-panel="settings"]').click();
await page.waitForTimeout(200);
const sw = page.locator('.panel[data-panel="settings"] [data-switch]').nth(1);   // starts off
assert('second switch starts off', !(await sw.evaluate(el => el.classList.contains('on'))));
await sw.click();
assert('switch toggles on', await sw.evaluate(el => el.classList.contains('on')));

// back to overview for the scroll checks
await page.locator('#tabs .tab[data-panel="overview"]').click();
await page.waitForTimeout(150);

// --- scroll reveal: a below-fold card is hidden, then reveals as it enters ---
const lastCard = '.revealcard:last-child';
assert('below-fold reveal card starts hidden', await opacity(lastCard) < 0.1);
await page.locator(lastCard).scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
assert('reveal card becomes visible after scrolling in', await opacity(lastCard) > 0.6);

// --- scroll scrub: the progress bar advances with scroll ---
const scaleX = () => page.locator('#progress').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(200);
assert('progress bar fills near the bottom', await scaleX() > 0.6);

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
