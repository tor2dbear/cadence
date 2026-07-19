import { chromium } from 'playwright';
const EDITOR = new URL('../index.html', import.meta.url).href;
const DEMO = new URL('../demo.html', import.meta.url).href;
const browser = await chromium.launch();
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

// ---- demo.html standalone: default state animates ----
{
  const page = await browser.newPage({ viewport: { width: 640, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(DEMO, { waitUntil: 'networkidle' });
  { const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
  // role tokens land on :root
  const dur = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--role-enter-duration').trim());
  assert('demo resolves --role-enter-duration by default', dur === '200ms');
  // labels get filled with the resolved intent name
  assert('enter label shows intent name', (await page.locator('[data-role-name="enter"]').first().innerText()).toLowerCase().includes('enter'));
  assert('move duration label filled', (await page.locator('[data-role-dur="move"]').first().innerText()) === '300ms');
  // modal opens/closes via fake state
  await page.click('#inviteBtn');
  await page.waitForTimeout(60);
  assert('modal shows on invite', await page.locator('#modal').evaluate(el => el.classList.contains('show')));
  await page.click('#modalCancel');
  await page.waitForTimeout(60);
  assert('modal hides on cancel', !(await page.locator('#modal').evaluate(el => el.classList.contains('show'))));
  // accordion toggles (move)
  await page.click('#accRow');
  assert('accordion opens', await page.locator('#acc').evaluate(el => el.classList.contains('open')));
  assert('no console/page errors (demo)', errors.length === 0);
  if (errors.length) console.log('ERRORS:', errors);
  await page.close();
}

// ---- demo.html reads an encoded system from the hash ----
{
  // build a hash from the editor after loading a spring template (Material 3 Expressive)
  const ed = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  await ed.goto(EDITOR, { waitUntil: 'networkidle' });
  { const _x=ed.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
  await ed.selectOption('#loadSystem', 'Material 3 Expressive · Google');
  await ed.waitForTimeout(50);
  const hash = await ed.evaluate(() => location.hash);
  assert('editor produced a hash', hash.length > 5);
  const demoHref = await ed.locator('#demoLink').getAttribute('href');
  assert('demo link carries the hash', demoHref === 'demo.html' + hash);

  const page = await browser.newPage({ viewport: { width: 640, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(DEMO + hash, { waitUntil: 'networkidle' });
  { const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
  // a spring intent → --role-enter-ease should be a linear() timing function
  const ease = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--role-enter-ease').trim());
  assert('spring template yields linear() easing in demo', ease.startsWith('linear('));
  assert('no errors decoding hash', errors.length === 0);
  await page.close();
  await ed.close();
}

// ---- editor: preview overlay opens with an iframe pointed at demo.html ----
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(EDITOR, { waitUntil: 'networkidle' });
  { const _x=page.locator('#exportToggle'); if(await _x.count()) await _x.click(); }  // open export panel (reflow column)
  assert('preview overlay hidden initially', await page.locator('#preview').isHidden());
  await page.click('#previewToggle');
  assert('preview overlay opens', await page.locator('#preview').isVisible());
  const src = await page.locator('#previewFrame').getAttribute('src');
  assert('iframe src points at demo.html with hash', src.startsWith('demo.html#'));
  // iframe actually loads the demo
  await page.waitForTimeout(200);
  const frame = page.frames().find(f => f.url().includes('demo.html'));
  assert('demo iframe present', !!frame);
  if (frame) assert('iframe rendered the shell', await frame.locator('.shell').count() === 1);
  await page.click('#previewClose');
  assert('preview overlay closes', await page.locator('#preview').isHidden());
  assert('no console/page errors (editor+preview)', errors.length === 0);
  if (errors.length) console.log('ERRORS:', errors);
  await page.close();
}

await browser.close();
