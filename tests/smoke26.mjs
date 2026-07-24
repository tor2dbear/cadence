/* Identity guard: the visual identity must stay self-hosted and applied.
 * The whole thesis is "one static page, no runtime, no dependency" — so the
 * fonts ship with the site (no Google Fonts / Fontshare CDN), @font-face
 * points at local fonts/, and the display face (Fraunces) actually paints. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const BASE = new URL('index.html', root).href;
const read = p => readFileSync(fileURLToPath(new URL(p, root)), 'utf8');
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

// --- static-source checks: no external font hosts anywhere ---
const css = read('styles.css');
const html = read('index.html');
const demo = read('demo.html');
const cdnRe = /fonts\.googleapis\.com|fonts\.gstatic\.com|api\.fontshare\.com|use\.typekit/i;
assert('styles.css references no external font CDN', !cdnRe.test(css));
assert('index.html references no external font CDN', !cdnRe.test(html));
assert('demo.html references no external font CDN', !cdnRe.test(demo));
// the demo shares the identity: mono self-hosted, no leftover old-blue accent
assert('demo.html self-hosts JetBrains Mono', /@font-face[^}]*url\(["']?fonts\/jetbrains-mono/.test(demo));
assert('demo.html dropped the old blue accent', !/#3b6ef5|#3160e0/i.test(demo));
assert('demo.html is dual-theme (prefers-color-scheme)', /@media\s*\(prefers-color-scheme:\s*dark\)/.test(demo));
assert('@font-face sources are local fonts/', /@font-face[^}]*url\(["']?fonts\//.test(css));
assert('Fraunces, Switzer, JetBrains Mono all self-hosted',
  /font-family:\s*Fraunces/i.test(css) &&
  /font-family:\s*Switzer/i.test(css) &&
  /font-family:\s*["']?JetBrains Mono/i.test(css));
// Fraunces must be the VARIABLE font (opsz axis) so display sizes get the
// display cut — a weight *range* on the @font-face is the tell; a single-weight
// static instance (the old bug) renders every size at one optical size.
assert('Fraunces is the variable font (weight range, opsz)',
  /@font-face[^}]*font-family:\s*Fraunces[^}]*font-weight:\s*\d+\s+\d+/is.test(css) &&
  /url\(["']?fonts\/fraunces-var/.test(css));
// the easing tile draws via a clip-path wipe, not a stroke-dash (which broke
// into disconnected segments under non-scaling-stroke on a stretched path)
assert('easing curve draws via clip-path, not a mismatched stroke-dash',
  /@keyframes ltDraw\{[^}]*clip-path/i.test(css) && !/\.lt-curve path\{[^}]*stroke-dasharray/.test(css));
// the spring tile travels proportionally (left across the track), not a fixed
// translateX that only reached ~40% on wide/mobile tiles
const springKf = (css.match(/@keyframes ltSpring\{[^\n]*/) || [''])[0];
assert('spring tile travels the full track via left, not a fixed translateX',
  /left:calc\(100% - 22px\)/.test(springKf) && !/translateX/.test(springKf));
// variant A — traces: a GENERATIVE field. JS sweeps comets along random
// easing-curve paths (WAAPI, no SMIL), each leaving a faint grey trail that
// lingers ~a minute then fades → an ever-changing web, never fixed curves
const js = read('cadence.js');
assert('traces: a generative field container, not fixed curves',
  /class="lherobg"/.test(html)
  && /class="ltr-field"/.test(html)
  && !/ltr-echo/.test(html) && !/id="ltrp/.test(html));
assert('the field spawns comets on random paths with long-lingering trails (WAAPI, no SMIL)',
  /ltr-field/.test(js) && /createElementNS/.test(js) && /Math\.random/.test(js)
  && /\.animate\(/.test(js) && /ltr-gtrail/.test(js) && /ltr-gcomet/.test(js)
  && !/<animateTransform/.test(html));
assert('the field is gated (reduced-motion + editor-only variant) + styled faint',
  /if\(!reduce && hv!=="editor"\)\{\s*\(function\(\)\{[\s\S]*?ltr-field/.test(js)
  && /\.ltr-gcomet\{[^}]*stroke:var\(--accent\)/.test(css)
  && /\.ltr-gtrail\{[\s\S]*?color-mix\(in srgb,var\(--ink\)/.test(css));
// variant B — a live editor that morphs + zoom/pans, BOTH SMIL on one timeline
// (the viewBox animation shares the morph's keyTimes), so they stay in sync;
// kept behind ?hero=editor (comet field is the shipped default)
// shape morph (21s = 3 beats) and viewBox zoom (28s = 4 beats) are separate SMIL
// on a shared 7s beat, so transitions coincide (synced) but the shape↔zoom
// pairing keeps shifting (3 and 4 coprime) — no CSS lcePan drift
assert('editor: shape (21s) + zoom (28s) are beat-synced SMIL with coprime periods',
  /class="lce-live"/.test(html)
  && /<animate attributeName="d" dur="21s"/.test(html)
  && /<animate attributeName="viewBox" dur="28s"[\s\S]*?keyTimes="0;0.1964;0.25;0.4464;0.5;0.6964;0.75;0.9464;1"/.test(html)
  && !/@keyframes lcePan/.test(css)
  && /\.lherobg\[data-hero="editor"\] \.ltr-svg\{display:none\}/.test(css));
// the loop runs three DISTINCT easing shapes (ease-out / ease-in / overshoot)
assert('editor loop has 3 distinct easing shapes (ease-in dips low, overshoot goes above)',
  /C84,100 150,86/.test(html) && /C68,-18 150,42/.test(html) && /C50,28 122,24/.test(html));
// each morph overshoots past its target then settles (a bounce) via extra
// value-frames — e.g. the ease-in P1 overshoots to 114 before settling to 100
assert('editor morphs bounce (a subtle overshoot value-frame past the target)',
  /C87,107 153,92/.test(html) && /values="[^"]*;107;100;/.test(html));
// the editor sits in the open right-hand space, sways about its Y axis between
// morphs, and is a desktop-only flourish
assert('editor is confined to the right + sways on the Y axis, desktop-only',
  /\.lce-svg\{position:absolute;top:[\d.]+%;right:[\d.]+%/.test(css)
  && /@keyframes lceSpin\{[\s\S]*?rotateY/.test(css)
  && /@media \(max-width:\d+px\)\{\s*\.lherobg\[data-hero\] \.lce-svg\{display:none/.test(css));

// --- runtime checks: the fonts load and the identity is applied ---
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

assert('Fraunces (display) is loaded', await page.evaluate(() => document.fonts.check('600 40px Fraunces')));
assert('Fraunces italic is loaded', await page.evaluate(() => document.fonts.check('italic 600 40px Fraunces')));
assert('headline actually renders in Fraunces',
  await page.locator('.lhead').evaluate(el => /Fraunces/.test(getComputedStyle(el).fontFamily)));
assert('emphasis is italic (shows off the display italic)',
  await page.locator('.lhead em').evaluate(el => getComputedStyle(el).fontStyle === 'italic'));

// --- the sand palette is live (not the old near-black) ---
assert('landing background is the warm sand, not near-black',
  await page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
    return r > 200 && g > 190 && b > 170;   // #ece5d6-ish
  }));

// --- the curve wordmark mark is present (motion as a graphic sign) ---
assert('brand carries the easing-curve swash', await page.locator('.lbrand__curve path').count() === 1);

assert('no console/page errors', errors.length === 0);
if (errors.length) errors.forEach(e => console.log('   ! ' + e));

await browser.close();
