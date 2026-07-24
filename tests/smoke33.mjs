/* "My systems": name + save the current system to THIS browser (localStorage,
 * no backend), see it in the picker split into Presets / My systems, reload it
 * to undo edits, and delete it. Covers the save/manage flow end to end. */
import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(BASE + '#tool', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(150);

const firstDur = () => page.evaluate(() => document.querySelector('.col.scales').innerText.match(/(\d+)ms/)[1]);
const hasMine = () => page.evaluate(() => !!document.querySelector('#loadSystem optgroup[label="My systems"]'));
const label = () => page.evaluate(() => { const s = document.getElementById('loadSystem'); return s.options[s.selectedIndex].text; });

// fresh browser: no saved systems, presets grouped, reload button hidden
assert('presets live under a "Presets" group', await page.evaluate(() => !!document.querySelector('#loadSystem optgroup[label="Presets"]')));
assert('no "My systems" group before saving', !(await hasMine()));
assert('reload button hidden with nothing selected', await page.locator('#reloadSys').isHidden());

// load a preset, then save it under a name
await page.selectOption('#loadSystem', 'Material 3 · Google');
await page.waitForTimeout(120);
assert('reload button appears once a system is selected', await page.locator('#reloadSys').isVisible());
const savedDur = await firstDur();
await page.click('#saveSys');
await page.fill('#sysName', 'My tuned');
assert('saving a preset shows only "Save as new" (no Update/Delete)', await page.locator('#sysSavedRow').isHidden());
await page.click('#sysSaveNew');
await page.waitForTimeout(120);
assert('saved system appears under "My systems"', await hasMine());
assert('picker now shows the saved system by name', await label() === 'My tuned');

// edit a token, then Reload restores the saved values
await page.evaluate(() => { const i = document.querySelector('.col.scales input[type=range]'); i.value = i.max || 999; i.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(80);
assert('editing a token changes the value', (await firstDur()) !== savedDur);
await page.click('#reloadSys');
await page.waitForTimeout(150);
assert('Reload restores the selected system (undo edits)', (await firstDur()) === savedDur);

// persists across a full page reload (localStorage)
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(150);
assert('saved system persists across a page reload', await hasMine());

// select it → Update + Delete offered; delete removes it
const savedVal = await page.evaluate(() => document.querySelector('#loadSystem optgroup[label="My systems"] option').value);
await page.selectOption('#loadSystem', savedVal);
await page.click('#saveSys');
await page.waitForTimeout(60);
assert('a saved system offers Update + Delete', await page.locator('#sysUpdate').isVisible() && await page.locator('#sysDelete').isVisible());
await page.click('#sysDelete');
await page.waitForTimeout(120);
assert('delete removes it from "My systems"', !(await hasMine()));

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));
await browser.close();
