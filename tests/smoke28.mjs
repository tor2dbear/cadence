/* Two wayfinding/polish fixes:
 *  1. demo.html carries a "home" mark (it can be reached as a standalone
 *     shared link, so it must not be a dead end).
 *  2. the landing's rotating "system read" line reserves the tallest
 *     observation's height, so swapping the text never reflows the cards
 *     below it (the line wraps to 1–3 lines depending on the string). */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const DEMO = new URL('../demo.html', import.meta.url).href;
const browser = await chromium.launch();
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

// ---- 1. demo home mark ----
{
  const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO, { waitUntil: 'networkidle' });
  const a = page.locator('.demohome');
  assert('demo carries a home mark', await a.count() === 1);
  assert('home mark points at the designer', await a.getAttribute('href') === 'index.html');
  assert('home mark opens without disturbing the demo (new tab)',
    await a.getAttribute('target') === '_blank' && (await a.getAttribute('rel') || '').includes('noopener'));
  assert('home mark has an accessible label', !!(await a.getAttribute('aria-label')));
  assert('demo has no page errors', errs.length === 0);
  await page.close();
}

// ---- 2. the rotating opinion line is height-stable ----
{
  // narrow viewport so the longest observation wraps to its full 3 lines
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const boxH = () => page.locator('#opinionLine').evaluate(el => el.getBoundingClientRect().height);
  const setLine = t => page.evaluate(txt => { document.getElementById('opinionLine').textContent = txt; }, t);

  assert('the opinion line reserves a min-height',
    await page.locator('#opinionLine').evaluate(el => parseFloat(el.style.minHeight) > 0));

  await setLine('4 distinct easings — a lean, legible set.');            // ~1–2 lines
  await page.waitForTimeout(20);
  const shortH = await boxH();
  await setLine('enter staggers 70ms — a 5-item list cascades over 280ms, brisk enough to read as one gesture.'); // 3 lines
  await page.waitForTimeout(20);
  const longH = await boxH();
  assert('box height is stable across short/long observations (no reflow)', Math.abs(shortH - longH) < 1);
  await page.close();
}

await browser.close();
