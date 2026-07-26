/* Browser Back/Forward move between the landing and the tool.
 *
 * Entering the tool (the Start button) is a real forward navigation, so the
 * browser Back button returns to the landing and Forward comes back to the tool;
 * the home wordmark (exit) is symmetric. In-tool edits must NOT spam history —
 * they replaceState in place. Shared links still boot straight into the tool. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const view = () => page.evaluate(() => document.documentElement.classList.contains('boot-tool') ? 'tool' : 'landing');
const hash = () => page.evaluate(() => location.hash);

// an empty hash boots the landing (the first impression)
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
assert('an empty hash boots the landing', (await view()) === 'landing');

// entering the tool via the Start button is a forward navigation
await page.click('#startTool');
await page.waitForTimeout(300);
assert('the Start button enters the tool', (await view()) === 'tool');
assert('entering the tool stamps a hash', (await hash()) === '#tool');

// browser Back returns to the landing…
await page.goBack();
await page.waitForTimeout(300);
assert('browser Back returns to the landing', (await view()) === 'landing');
assert('Back clears the hash', (await hash()) === '');

// …and Forward comes back to the tool
await page.goForward();
await page.waitForTimeout(300);
assert('browser Forward returns to the tool', (await view()) === 'tool');

// the home wordmark (exit) is symmetric: a forward nav back to the landing,
// which Back then re-enters
await page.click('#brandHome');
await page.waitForTimeout(300);
assert('the home wordmark exits to the landing', (await view()) === 'landing');
await page.goBack();
await page.waitForTimeout(300);
assert('Back after exiting re-enters the tool', (await view()) === 'tool');

// in-tool edits replaceState (they must not each add a history entry)
const before = await page.evaluate(() => history.length);
await page.evaluate(() => { durations[0].ms = 210; writeURL(); durations[0].ms = 220; writeURL(); });
await page.waitForTimeout(120);
const after = await page.evaluate(() => history.length);
assert('editing does not spam the history stack', after === before);

// revisiting a pristine #tool entry restores the DEFAULT system — a later in-memory
// edit must not stay active — and must not rewrite that historical entry's hash to
// the edited state (the "#tool" sentinel decodes to the default, not "keep current")
const def0 = await page.evaluate(() => DEFAULT_S.d[0][1]);   // the default first-duration ms
const pristine = await page.evaluate(async d => {
  durations[0].ms = d + 111;                    // diverge the in-memory state
  location.hash = 'tool';                        // navigate onto a pristine #tool entry
  await new Promise(r => setTimeout(r, 150));
  return { ms: durations[0].ms, hash: location.hash };
}, def0);
assert('revisiting #tool restores the default state (edit does not persist)', pristine.ms === def0);
assert('revisiting #tool keeps a clean #tool hash (no rewrite to an edited hash)', pristine.hash === '#tool');

// a shared/deep link still boots straight into the tool (unchanged)
const deep = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
await deep.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await deep.waitForTimeout(250);
assert('a #tool deep link boots the tool', await deep.evaluate(() => document.documentElement.classList.contains('boot-tool')));
await deep.close();

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
