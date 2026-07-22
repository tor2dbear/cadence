import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const previewing = () => page.evaluate(() => document.body.classList.contains('previewing'));

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });

// --- glossary titles (P4) ---
assert('Intents header carries a plain-language title',
  (await page.locator('.col.mid h2.sec').first().getAttribute('title') || '').includes('Semantic tokens'));

// --- System read badge (P3) ---
assert('hint count badge present + filled', (await page.locator('#hintCount').innerText()).length > 0);
// force a long-duration warning: point enter at the slowest step
await page.locator('#intents .intent').first().locator('[data-scope="idur"]').selectOption('xslow');
assert('badge flips to warn state', await page.locator('#hintCount').evaluate(el => el.classList.contains('warn')));
assert('badge text counts items to review', (await page.locator('#hintCount').innerText()).includes('review'));

// --- docked preview (P2): a direct #tool boot does NOT auto-open ---
assert('preview hidden on direct #tool boot', await page.locator('#preview').isHidden());
assert('not previewing initially', !(await previewing()));
// opening it docks beside the editor (wide) rather than covering it
await page.locator('#previewToggle').click();
assert('preview opens', await page.locator('#preview').isVisible());
assert('body marked previewing', await previewing());
const w = await page.locator('#preview').evaluate(el => el.offsetWidth);
assert('preview is docked (a side pane, not full-width)', w > 300 && w < 680);
assert('editor stays visible beside the dock', await page.locator('#toolview .wrap').isVisible());
// close returns to editor-only
await page.locator('#previewClose').click();
assert('preview closes', await page.locator('#preview').isHidden());
assert('previewing cleared on close', !(await previewing()));

// --- auto-open when entering from the landing (wide) ---
const p2 = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const e2 = [];
p2.on('pageerror', e => e2.push('' + e));
await p2.goto(BASE, { waitUntil: 'networkidle' });      // landing
await p2.locator('#startTool').click();
await p2.waitForTimeout(400);                            // VT + auto-open
assert('landing→tool auto-docks the preview', await p2.evaluate(() => document.body.classList.contains('previewing')));
assert('preview visible after landing entry', await p2.locator('#preview').isVisible());

assert('no console/page errors', errors.length === 0 && e2.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
