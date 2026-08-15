/* Stamp the sitemap's <lastmod> at build time.
 *
 * The committed sitemap.xml carries placeholder dates; shipping them unchanged
 * tells crawlers the pages never move, so Google has no signal to re-crawl after
 * a content update. Here each URL's <lastmod> is set from the last commit date of
 * the source that actually drives that page — so a deploy advertises an honest
 * "changed on" date. Falls back to today's date when git isn't available (a
 * shallow or export-only build), never a frozen date.
 *
 * Reads ./sitemap.xml, writes the stamped XML to stdout — build.sh redirects it
 * over dist/sitemap.xml, mirroring gen-changelog.mjs / gen-headers.mjs. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const xml = readFileSync(fileURLToPath(new URL('sitemap.xml', root)), 'utf8');
const today = new Date().toISOString().slice(0, 10);

const gitDate = file => {
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', file],
      { cwd: fileURLToPath(root), encoding: 'utf8' }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  } catch { return today; }
};

// the source whose history is this page's freshness (the demo is noindexed and
// never listed here, so it needs no mapping)
const sourceFor = loc =>
  /\/guide\/?$/.test(loc)     ? 'guide.html' :
  /\/changelog\/?$/.test(loc) ? 'CHANGELOG.md' :
  'index.html';   // the home page (and anything else) tracks the landing

const stamped = xml.replace(/<url>[\s\S]*?<\/url>/g, block => {
  const loc = (block.match(/<loc>([^<]*)<\/loc>/) || [])[1] || '';
  const date = gitDate(sourceFor(loc));
  return block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${date}</lastmod>`);
});

process.stdout.write(stamped);
