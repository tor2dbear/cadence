import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const opacity = sel => page.locator(sel).evaluate(el => parseFloat(getComputedStyle(el).opacity));

await page.goto(BASE, { waitUntil: 'networkidle' });   // bare load → landing

// --- structure ---
assert('progress rail present', await page.locator('.lprogress').count() === 1);
assert('montage has four steps', await page.locator('.lm-step').count() === 4);
// colophon (author voice + trust) replaces the plain author line (P5)
assert('colophon present, author line retired',
  await page.locator('.lcolophon').count() === 1 && await page.locator('.lauthor').count() === 0);
assert('colophon links to source + changelog', await page.locator('.lcolo-meta a').count() === 2);
assert('native scroll timelines supported here', await page.evaluate(() => CSS.supports('animation-timeline: view()')));

// --- scroll reveal: a below-fold montage step is hidden, then reveals ---
const lastStep = '.lm-step:last-child';
assert('below-fold step starts hidden', await opacity(lastStep) < 0.1);
await page.locator(lastStep).scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
assert('step reveals once scrolled into view', await opacity(lastStep) > 0.6);

// --- scrub: the progress rail advances with scroll ---
const scaleX = () => page.locator('.lprogress').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(200);
assert('progress rail fills near the bottom', await scaleX() > 0.6);

// --- montage teaches the two layers (content sanity) ---
assert('step 1 covers primitives', (await page.locator('.lm-step').nth(0).innerText()).includes('Primitives'));
assert('step 2 covers intents', (await page.locator('.lm-step').nth(1).innerText()).includes('Intents'));
assert('step 3 is the opinion layer', (await page.locator('.lm-step').nth(2).innerText()).toLowerCase().includes('critiques itself'));

// --- entering the tool still works from the montage'd landing ---
await page.evaluate(() => window.scrollTo(0, 0));
await page.locator('#startTool').click();
await page.waitForTimeout(300);
assert('Start still enters the tool', await page.locator('#toolview').isVisible());

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
