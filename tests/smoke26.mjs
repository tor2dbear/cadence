/* Identity guard: the visual identity must stay self-hosted and applied.
 * The whole thesis is "one static page, no runtime, no dependency" — so the
 * fonts ship with the site (no Google Fonts / Fontshare CDN), @font-face
 * points at local fonts/, and the display face (Fraunces) actually paints. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const BASE = new URL('index.html', root).href;
const read = p => readFileSync(fileURLToPath(new URL(p, root)), 'utf8');
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

// --- static-source checks: no external font hosts anywhere ---
const css = read('styles.css');
const html = read('index.html');
const cdnRe = /fonts\.googleapis\.com|fonts\.gstatic\.com|api\.fontshare\.com|use\.typekit/i;
assert('styles.css references no external font CDN', !cdnRe.test(css));
assert('index.html references no external font CDN', !cdnRe.test(html));
assert('@font-face sources are local fonts/', /@font-face[^}]*url\(["']?fonts\//.test(css));
assert('Fraunces, Switzer, JetBrains Mono all self-hosted',
  /font-family:\s*Fraunces/i.test(css) &&
  /font-family:\s*Switzer/i.test(css) &&
  /font-family:\s*["']?JetBrains Mono/i.test(css));

// --- runtime checks: the fonts load and the identity is applied ---
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

assert('Fraunces (display) is loaded', await page.evaluate(() => document.fonts.check('600 40px Fraunces')));
assert('Fraunces italic is loaded', await page.evaluate(() => document.fonts.check('italic 600 40px Fraunces')));
assert('headline actually renders in Fraunces',
  await page.locator('.lhead').evaluate(el => /Fraunces/.test(getComputedStyle(el).fontFamily)));
assert('emphasis is italic (shows off the display italic)',
  await page.locator('.lhead em').evaluate(el => getComputedStyle(el).fontStyle === 'italic'));

// --- the sand palette is live (not the old near-black) ---
assert('landing background is the warm sand, not near-black',
  await page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
    return r > 200 && g > 190 && b > 170;   // #ece5d6-ish
  }));

// --- the curve wordmark mark is present (motion as a graphic sign) ---
assert('brand carries the easing-curve swash', await page.locator('.lbrand__curve path').count() === 1);

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
