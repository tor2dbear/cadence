/* Stamp the sitemap's <lastmod> at build time.
 *
 * The committed sitemap.xml carries placeholder dates; shipping them unchanged
 * tells crawlers the pages never move, so Google has no signal to re-crawl after
 * a content update. Here each URL's <lastmod> is set from the MOST RECENT commit
 * across the sources that actually drive that page — a page changes when any of
 * its inputs do (the home page's script/styles, not just its HTML), so we take
 * the max, not one file's date. Falls back to today when git isn't available (a
 * shallow or export-only build), never a frozen date.
 *
 * Reads ./sitemap.xml, writes the stamped XML to stdout — build.sh redirects it
 * over dist/sitemap.xml, mirroring gen-changelog.mjs / gen-headers.mjs. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const cwd = fileURLToPath(root);
const xml = readFileSync(fileURLToPath(new URL('sitemap.xml', root)), 'utf8');
const today = new Date().toISOString().slice(0, 10);

// the most recent commit date across a page's inputs (YYYY-MM-DD sorts
// chronologically, so the lexical max is the newest); today if none resolve
const lastmodFor = files => {
  const dates = files.map(f => {
    try {
      const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', f], { cwd, encoding: 'utf8' }).trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
    } catch { return ''; }
  }).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : today;
};

// every source whose change alters the deployed page (the demo is noindexed and
// never listed here, so it needs no mapping). package.json rides along because
// build.sh stamps its version into the home page's badge.
const sourcesFor = loc =>
  /\/guide\/?$/.test(loc)     ? ['guide.html', 'styles.css'] :
  /\/changelog\/?$/.test(loc) ? ['CHANGELOG.md', 'scripts/gen-changelog.mjs', 'styles.css'] :
  ['index.html', 'cadence.js', 'system-read.js', 'styles.css', 'package.json'];

const stamped = xml.replace(/<url>[\s\S]*?<\/url>/g, block => {
  const loc = (block.match(/<loc>([^<]*)<\/loc>/) || [])[1] || '';
  const date = lastmodFor(sourcesFor(loc));
  return block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${date}</lastmod>`);
});

process.stdout.write(stamped);
