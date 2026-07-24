/* Portability: export the current system as a self-describing .cadence.json
 * (marker + name + full state), re-import it losslessly, reject non-Cadence
 * files with a clear message, and carry the name into the CSS export as a
 * comment banner (never a token). */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const BASE = new URL('../index.html', import.meta.url).href;
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const browser = await chromium.launch();
const dur = pg => pg.evaluate(() => document.querySelector('.col.scales').innerText.match(/(\d+)ms/)[1]);
const expPath = join(tmpdir(), 'cadence-smoke34.cadence.json');
const junkPath = join(tmpdir(), 'cadence-smoke34-junk.json');

// ---- export + CSS name banner ----
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

await page.click('#exportToggle'); await page.waitForTimeout(100);
await page.click('.tab[data-fmt="css"]'); await page.waitForTimeout(60);
assert('CSS banner is generic before a system loads',
  (await page.locator('#out').innerText()).startsWith('/* Cadence — motion system */'));

await page.selectOption('#loadSystem', 'Material 3 · Google');
await page.waitForTimeout(120);
assert('CSS banner reflects the loaded system name (as a comment, not a token)',
  (await page.locator('#out').innerText()).startsWith('/* Cadence — Material 3 · Google */'));

await page.click('#saveSys'); await page.waitForTimeout(80);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sysExport')]);
await dl.saveAs(expPath);
assert('export downloads a *.cadence.json file', /\.cadence\.json$/.test(dl.suggestedFilename()));
const doc = JSON.parse(readFileSync(expPath, 'utf8'));
assert('the file is self-describing (marker + name + full state)',
  doc.cadence === 1 && doc.name === 'Material 3 · Google' && Array.isArray(doc.state.d) && Array.isArray(doc.state.e));
await ctx.close();

// ---- import into a fresh browser (nothing loaded) ----
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const pg = await ctx2.newPage();
const errors2 = [];
pg.on('console', m => { if (m.type() === 'error') errors2.push(m.text()); });
pg.on('pageerror', e => errors2.push('pageerror: ' + e.message));
await pg.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(120);
const before = await dur(pg);
await pg.click('#saveSys'); await pg.waitForTimeout(50);
await pg.setInputFiles('#sysFile', expPath); await pg.waitForTimeout(200);
assert('importing a system file applies its tokens', (await dur(pg)) !== before);
assert('import prefills the name so it can be saved into My systems',
  (await pg.locator('#sysName').inputValue()) === 'Material 3 · Google');

// ---- invalid import: clear message, current system untouched ----
writeFileSync(junkPath, '{"totally":"not cadence"}');
const held = await dur(pg);
// the popover is still open from the import above; importing junk shows the
// error in place (don't toggle Save here — that would just close the popover)
await pg.setInputFiles('#sysFile', junkPath); await pg.waitForTimeout(120);
assert('a non-Cadence file is rejected with a clear message',
  await pg.locator('#sysErr').isVisible() && /Cadence system file/.test(await pg.locator('#sysErr').innerText()));
assert('a rejected import leaves the current system untouched', (await dur(pg)) === held);

// ---- security: an untrusted file can't inject via the CSS export ----
// token names flow into buildCSS()'s innerHTML and into /* */ comments, so a
// shared .cadence.json with markup or a comment terminator must be neutralized
{
  const ctx3 = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const pg3 = await ctx3.newPage();
  let dialog = false; pg3.on('dialog', d => { dialog = true; d.dismiss(); });
  await pg3.goto(BASE + '#tool', { waitUntil: 'networkidle' });
  await pg3.evaluate(() => document.fonts.ready);
  await pg3.click('#exportToggle'); await pg3.waitForTimeout(60);
  await pg3.click('.tab[data-fmt="css"]'); await pg3.waitForTimeout(40);
  const payload = "x</span><img src=x onerror='window.__xss=1'>";
  const evil = join(tmpdir(), 'cadence-smoke34-evil.cadence.json');
  writeFileSync(evil, JSON.stringify({ cadence: 1, name: 'pwn */ body{display:none} /*', state: {
    d: [[payload, 150]], e: [['std', 0.4, 0, 0.2, 1]], i: [['enter', 'appear', [[payload, 'std']]]] } }));
  await pg3.click('#saveSys'); await pg3.waitForTimeout(40);
  await pg3.setInputFiles('#sysFile', evil); await pg3.waitForTimeout(200);
  assert('a malicious imported name neither executes nor injects markup',
    !(await pg3.evaluate(() => window.__xss)) && !dialog && !(await pg3.evaluate(() => !!document.querySelector('#out img'))));
  const line = (await pg3.locator('#out').innerText()).split('\n')[0];
  const inner = line.replace(/^\/\*\s*/, '').replace(/\s*\*\/$/, '');
  assert('a name cannot break out of the CSS comment banner', !inner.includes('*/'));
  rmSync(evil, { force: true });
  await ctx3.close();
}

assert('no console/page errors', errors.length === 0 && errors2.length === 0);
[...errors, ...errors2].forEach(e => console.log('   ! ' + e));
rmSync(expPath, { force: true }); rmSync(junkPath, { force: true });
await browser.close();
