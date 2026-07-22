/* SEO + analytics wiring (static checks, no browser):
 *  - the pages carry canonical + Open Graph + Twitter + (index) JSON-LD, with
 *    an absolute og:image so crawlers and social unfurls resolve it;
 *  - robots.txt / sitemap.xml exist and point at the live host;
 *  - the Cloudflare beacon is injected at BUILD time (dist only), never in the
 *    source — otherwise its external load would trip the offline smoke tests;
 *  - build.sh copies the new .txt/.xml assets. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(fileURLToPath(new URL(p, root)), 'utf8');
const assert = (n, c) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);

const index = read('index.html');
const demo = read('demo.html');
const build = read('build.sh');
const robots = read('robots.txt');
const sitemap = read('sitemap.xml');

const HOST = 'https://cadence.tor2dbear.com';

// --- discoverability meta on both pages ---
for (const [name, html, url] of [['index', index, HOST + '/'], ['demo', demo, HOST + '/demo.html']]) {
  assert(`${name}: canonical points at the live URL`, html.includes(`rel="canonical" href="${url}"`));
  assert(`${name}: has an og:title + og:description`, /property="og:title"/.test(html) && /property="og:description"/.test(html));
  assert(`${name}: og:image is an absolute URL`, new RegExp(`property="og:image" content="${HOST}/og\\.png"`).test(html));
  assert(`${name}: has a summary_large_image twitter card`, /name="twitter:card" content="summary_large_image"/.test(html));
  assert(`${name}: declares a theme-color`, /name="theme-color"/.test(html));
}
assert('index carries JSON-LD structured data', /application\/ld\+json/.test(index) && /"@type":"WebApplication"/.test(index));

// --- crawl files ---
assert('robots.txt points at the sitemap', robots.includes(`Sitemap: ${HOST}/sitemap.xml`));
assert('sitemap lists the landing + demo', sitemap.includes(`${HOST}/</loc>`) && sitemap.includes(`${HOST}/demo.html</loc>`));

// --- analytics is a deploy concern, not in the tested source ---
assert('beacon is NOT in the source pages', !/cloudflareinsights/.test(index) && !/cloudflareinsights/.test(demo));
assert('build.sh injects the beacon into dist', /cloudflareinsights/.test(build) && /dist\/index\.html dist\/demo\.html/.test(build));
assert('build.sh copies .txt and .xml assets', /\*\.txt \*\.xml/.test(build));
