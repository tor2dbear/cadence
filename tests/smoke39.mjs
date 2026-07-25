/* Download each export format as a real file.
 *
 * The export panel used to offer only Copy — an engineer wanting tokens.css or
 * motion.ts in their repo had to select-all, copy, and hand-name a file. A
 * Download button now Blobs the active format's output under the conventional
 * filename. This guards that each tab downloads the right name AND that the file
 * carries the same text the panel shows. Pure client-side (Blob + <a download>),
 * consistent with the static-only thesis. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('#exportToggle').click().catch(() => {});
await page.waitForTimeout(150);

// [tab, expected filename, a marker the file's content must contain]
const CASES = [
  ['css', 'tokens.css', '--motion-'],
  ['ts', 'motion.ts', 'motion.ts'],
  ['tailwind', 'tailwind.config.js', 'transitionDuration'],
  ['json', 'tokens.json', '{'],
  ['rationale', 'rationale.md', '# Motion system rationale'],
];
for (const [fmt, expected, marker] of CASES) {
  await page.locator(`.tab[data-fmt="${fmt}"]`).click();
  await page.waitForTimeout(80);
  const shown = (await page.locator('#out').textContent()) || '';
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.evaluate(() => document.getElementById('download').click()),
  ]);
  assert(`${fmt} downloads as ${expected}`, dl.suggestedFilename() === expected);
  const body = readFileSync(await dl.path(), 'utf8');
  assert(`${expected} carries its content (${marker})`, body.includes(marker));
  assert(`${expected} matches what the panel shows`, body === shown);
}

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
