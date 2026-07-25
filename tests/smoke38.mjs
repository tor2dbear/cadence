/* The opinion layer as a first-class deliverable: a composite VERDICT in the
 * header, and a shareable Rationale export.
 *
 * systemRead answers "what's wrong, ranked"; scoreSystem folds that into an
 * "is this good?" — a grade the header leads with, and a Markdown report the
 * export panel emits (verdict + scorecard + findings/fixes + fingerprint). This
 * guards that the verdict tracks the system (healthy → A, a warning drops it)
 * and that the report actually carries the critique, not just tokens. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// --- header verdict, default (healthy) system -----------------------------
const badge0 = (await page.locator('#hintCount').textContent()).trim();
const title0 = await page.locator('#hintCount').getAttribute('title');
assert('header leads with an A verdict for the healthy default', /^A · all clear/.test(badge0));
assert('the verdict carries a /100 score in its tooltip', /Score \d+\/100/.test(title0 || ''));

// --- the Rationale export carries the critique, not just tokens -----------
await page.locator('#exportToggle').click().catch(() => {});
await page.waitForTimeout(150);
await page.locator('.tab[data-fmt="rationale"]').click();
await page.waitForTimeout(200);
const md0 = await page.locator('#out').textContent();
for (const section of ['# Motion system rationale', '**Verdict: A**', '## Scorecard', '## Findings', '## Fingerprint', 'Benchmarked against']) {
  assert(`rationale report has "${section}"`, md0.includes(section));
}
assert('rationale scorecard names the enter/exit dimension', /Enter \/ exit/.test(md0));

// --- introduce a warning: "+ Add easing" clones the standard curve --------
// (a near-identical easing → the redundancy check warns). Fire the handler
// directly so the test doesn't depend on the button's on-screen position.
await page.evaluate(() => document.getElementById('addEasing').click());
await page.waitForTimeout(250);
const badge1 = (await page.locator('#hintCount').textContent()).trim();
assert('a redundant easing drops the verdict off "all clear"', /to review/.test(badge1));
assert('the grade is no longer A', !/^A /.test(badge1));

// the report now shows the warning AND its one-line fix
await page.locator('.tab[data-fmt="rationale"]').click();
await page.waitForTimeout(150);
const md1 = await page.locator('#out').textContent();
assert('rationale verdict is below 100 once a warning exists', /\*\*Verdict: [B-E]\*\* — \d+\/100/.test(md1));
assert('rationale lists the redundant-easing finding', /nearly identical curves/.test(md1));
assert('rationale carries the fix line for a warning', /→ \*/.test(md1));

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
