/* Batch: the animated orb must sit ON its track line (it centred with
 * translateY(-50%), which iOS Safari drops when compositing the animated
 * transform — the orb ended up below the line), plus a contact path in the
 * landing colophon and a slim footer on the standalone demo. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const DEMO = new URL('../demo.html', import.meta.url).href;
const browser = await chromium.launch();
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const midY = (page, sel) => page.locator(sel).evaluate(el => { const b = el.getBoundingClientRect(); return (b.top + b.bottom) / 2; });

// ---- landing: orb centred on the line, + a contact link ----
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  // sample a few animation frames: the orb centre must track the line centre
  let maxDelta = 0;
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(160);
    const d = Math.abs((await midY(page, '.lt-orb')) - (await midY(page, '.lt-base')));
    if (d > maxDelta) maxDelta = d;
  }
  assert('the spring orb stays centred on its line', maxDelta < 1.5);
  // the orb is centred by margin now, not by a translateY in the transform
  assert('orb centred via margin, not translateY (Safari-proof)',
    await page.locator('.lt-orb').evaluate(el => !/translateY/.test(getComputedStyle(el).transform) ||
      getComputedStyle(el).marginTop !== '0px'));

  const contact = page.locator('.lcolophon a[href^="mailto:"]');
  assert('landing colophon offers a contact link', await contact.count() === 1);
  assert('contact carries the cadence subject',
    (await contact.first().getAttribute('href')).toLowerCase().includes('subject=cadence'));
  await page.close();
}

// ---- demo: slim standalone footer ----
{
  const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
  await page.goto(DEMO, { waitUntil: 'networkidle' });
  const foot = page.locator('.demofoot');
  assert('demo has a footer', await foot.count() === 1);
  assert('demo footer links to the designer', await foot.locator('a[href="index.html"]').count() === 1);
  assert('demo footer offers a contact link', await foot.locator('a[href^="mailto:"]').count() === 1);
  await page.close();
}

// ---- the "naïve" toggle is explained (not just a bare label) ----
{
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const hint = page.locator('.ltaste__hint');
  assert('the naïve toggle carries an explanation', await hint.count() === 1);
  assert('the explanation defines what naïve means',
    /naïve/.test(await hint.innerText()) && /stagger|linear|craft/i.test(await hint.innerText()));
  await page.close();
}

// ---- the guide's primary CTA text is visible on its filled button ----
// (it used to inherit --accent from `.guide a` and vanish, navy-on-navy)
{
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.goto(new URL('../guide.html', import.meta.url).href, { waitUntil: 'networkidle' });
  const contrast = await page.locator('.gcta__btn').evaluate(el => {
    const s = getComputedStyle(el);
    return s.color !== s.backgroundColor;
  });
  assert('guide CTA text contrasts its button (not navy-on-navy)', contrast);
  // the tool's orb also sits on its line (margin-centred, Safari-robust)
  await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const orbDelta = await page.evaluate(() => {
    const o = document.querySelector('.orb'), b = document.querySelector('.orb-base');
    if (!o || !b) return 0;
    const a = o.getBoundingClientRect(), c = b.getBoundingClientRect();
    return Math.abs((a.top + a.bottom) / 2 - (c.top + c.bottom) / 2);
  });
  assert('tool orb is centred on its line', orbDelta < 1);
  await page.close();
}

await browser.close();
