import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
{ const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)

// each easing card has exactly 2 draggable handles
const card0 = page.locator('#easings .ecard').nth(0);
assert('card 0 has 2 handles', await card0.locator('.bz-h').count() === 2);

const easeLine = async (name) => {
  const out = await page.locator('#out').innerText();
  const line = out.split('\n').find(l => l.includes(`--motion-ease-${name}:`));
  return line ? line.split(':').slice(1).join(':').trim().replace(/;$/, '') : null;
};
const before = await easeLine('standard');
assert('standard starts as default', before === 'cubic-bezier(0.2, 0, 0.2, 1)');

// drag handle #1 of card 0 up-and-left
const h1 = card0.locator('.bz-h').first();
const bb = await h1.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x - 40, bb.y - 40, { steps: 10 });
await page.mouse.up();

const after = await easeLine('standard');
assert('drag changed the standard curve', after && after !== before);
// dropdown for card 0 should now read "custom"
assert('dropdown shows custom after drag', await card0.locator('select').inputValue() === 'custom');
// the custom curve is captured in the shareable hash
assert('hash updated after drag', (await page.evaluate(() => location.hash)).length > 1);

// selecting a preset restores a known curve and clears custom
await card0.locator('select').selectOption('gentle');
const g = await easeLine('standard');
assert('preset "gentle" applied', g === 'cubic-bezier(0.25, 0.1, 0.25, 1)');
assert('dropdown no longer custom', await card0.locator('select').inputValue() === 'gentle');

// restore the dragged system on a fresh page from the hash
await card0.locator('select').selectOption('sharp');           // some known change
const url = await page.evaluate(() => location.href);
const p2 = await browser.newPage();
await p2.goto(url, { waitUntil: 'networkidle' });
{ const _x=p2.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
const restored = await p2.locator('#out').innerText();
assert('shared curve restored on reload', restored.includes('--motion-ease-standard: cubic-bezier(0.4, 0, 0.6, 1)'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
