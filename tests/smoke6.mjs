import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)

// picker present + populated (11 systems + placeholder = 12 options)
const opts = await page.locator('#loadSystem option').count();
assert('picker has 12 options (placeholder + 11)', opts === 12);

// the Material 3 Expressive template loads real springs
await page.selectOption('#loadSystem', 'Material 3 Expressive · Google');
await page.waitForTimeout(60);
const springCards = await page.locator('#easings .ecard__spring').count();
const cssX = await page.click('.tab[data-fmt="css"]').then(()=>page.locator('#out').innerText());
assert('Material Expressive → 3 spring easings, linear() export',
  springCards === 3 && /--motion-ease-spatial-default: linear\(/.test(cssX));

// expected easing counts per template (verifies the right palette loads)
const expect = {
  'Material 3 · Google': 6, 'IBM Carbon': 6, 'Fluent 2 · Microsoft': 6, 'Ant Design': 7,
  'Tailwind CSS': 4, 'Atlassian': 4, 'Polaris · Shopify': 5, 'GitHub Primer': 5, 'Adobe Spectrum': 4,
};
for (const [name, n] of Object.entries(expect)) {
  await page.selectOption('#loadSystem', name);
  await page.waitForTimeout(60);
  const e = await page.locator('#easings .ecard').count();
  const nameShown = await page.locator('#easings .ecard__name').first().inputValue();
  const hash = await page.evaluate(() => location.hash.length);
  const backToPlaceholder = await page.locator('#loadSystem').inputValue();
  assert(`${name} → ${e} easings, url updated, picker reset`,
    e === n && hash > 1 && backToPlaceholder === '');
}

// loading a template makes a shareable URL that round-trips on fresh load
await page.selectOption('#loadSystem', 'IBM Carbon');
await page.waitForTimeout(60);
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
const carbonEase = await p2.locator('#easings .ecard').count();
const carbonHasExpressive = (await p2.locator('#out').innerText()).includes('--motion-ease-entrance-expressive');
assert('Carbon URL round-trips on fresh load', carbonEase === 6 && carbonHasExpressive);

// reset back to Cadence starter
await page.selectOption('#loadSystem', 'Cadence starter');
await page.waitForTimeout(60);
const d = await page.locator('#durations .drow').count();
const firstDur = await page.locator('#durations .drow__name').first().inputValue();
assert('Cadence starter resets (5 durations, first = fast)', d === 5 && firstDur === 'fast');

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
