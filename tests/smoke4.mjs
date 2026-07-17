import { chromium } from 'playwright';
const BASE = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
await page.goto(BASE, { waitUntil: 'networkidle' });

const pick = async fmt => { await page.click(`.tab[data-fmt="${fmt}"]`); return page.locator('#out').innerText(); };

assert('5 tabs present', await page.locator('.tabs .tab').count() === 5);

const css = await pick('css');
assert('CSS: primitives + var() reference', css.includes('--motion-duration-fast: 150ms') && css.includes('--motion-enter-ease: var(--motion-ease-emphasized)'));

const json = await pick('json');
assert('JSON: valid + primitives/semantic', (() => { try { const o = JSON.parse(json); return o.primitives && o.semantic && o.primitives.duration.fast === '150ms'; } catch { return false; } })());

const tw = await pick('tailwind');
assert('Tailwind: config shape', tw.includes('module.exports') && tw.includes('transitionDuration') && tw.includes('transitionTimingFunction'));
assert('Tailwind: primitive + intent entries', tw.includes('"fast": "150ms"') && tw.includes('"enter":') && tw.includes('// intent'));

const sd = await pick('sd');
assert('Style Dictionary: valid JSON + references', (() => { try { const o = JSON.parse(sd); return o.motion.duration.fast.value === '150ms' && o.motion.enter.easing.value === '{motion.easing.emphasized}' && o.motion.easing.standard.type === 'cubicBezier'; } catch { return false; } })());

const ts = await pick('ts');
assert('TS: export const + as const + intent block', ts.includes('export const motion = {') && ts.includes('as const;') && ts.includes('intent: {') && ts.includes('enter: { duration: "200ms", easing: "cubic-bezier(0.22, 1, 0.36, 1)", stagger: "70ms" }'));

// edits flow into the active non-CSS format live
await page.click('.tab[data-fmt="tailwind"]');
const dn = page.locator('#durations .drow__name').first();
await dn.fill('quick'); await dn.blur();
const tw2 = await page.locator('#out').innerText();
assert('Tailwind updates after rename', tw2.includes('"quick": "150ms"') && !tw2.includes('"fast": "150ms"'));

// copy reads textContent (plain), even though CSS uses innerHTML spans
await page.click('.tab[data-fmt="css"]');
const copyText = await page.locator('#out').evaluate(el => el.textContent);
assert('CSS copy text has no span markup', copyText.includes('--motion-duration') && !copyText.includes('<span'));

assert('no console/page errors', errors.length === 0);
if (errors.length) console.log('ERRORS:', errors);
await browser.close();
