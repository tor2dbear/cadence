/* Build-time generator: CHANGELOG.md → a styled /changelog page in the site's
 * identity. CHANGELOG.md stays the single source of truth; build.sh runs this
 * and writes the result to dist/changelog.html. The Markdown here is a known,
 * small subset (headings, lists, **bold**, `code`, [links]) authored by us, so
 * a minimal converter is enough — no dependency. */
import { readFileSync } from 'node:fs';

const md = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const HOST = 'https://cadence.tor2dbear.com';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// inline: escape first, then re-introduce our own tags for code / bold / links
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_, b) => `<strong>${b}</strong>`)
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, (_, pre, i) => `${pre}<em>${i}</em>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
}

// --- block parse ---
let body = '', list = null, para = [];
const flushPara = () => { if (para.length) { body += `<p>${inline(para.join(' '))}</p>\n`; para = []; } };
const flushList = () => { if (list) { body += `<ul>\n${list.map(li => `<li>${inline(li)}</li>`).join('\n')}\n</ul>\n`; list = null; } };

for (const line of md.split('\n')) {
  if (/^#\s/.test(line)) { flushPara(); flushList(); body += `<h1 class="cl-h1">${inline(line.replace(/^#\s/, ''))}</h1>\n`; continue; }
  if (/^##\s/.test(line)) {
    flushPara(); flushList();
    const t = line.replace(/^##\s/, '').trim();
    const m = t.match(/^\[([^\]]+)\]\s*—\s*(.+)$/);
    body += m
      ? `<h2 class="cl-ver" id="v${m[1].replace(/\./g, '-')}"><span class="cl-num">${esc(m[1])}</span><time>${esc(m[2])}</time></h2>\n`
      : `<h2 class="cl-ver">${inline(t)}</h2>\n`;
    continue;
  }
  if (/^###\s/.test(line)) { flushPara(); flushList(); body += `<h3 class="cl-sec">${inline(line.replace(/^###\s/, ''))}</h3>\n`; continue; }
  if (/^-\s/.test(line)) { flushPara(); (list ||= []).push(line.replace(/^-\s/, '')); continue; }
  if (/^\s+\S/.test(line) && list) { list[list.length - 1] += ' ' + line.trim(); continue; } // wrapped bullet
  if (/^\s*$/.test(line)) { flushPara(); flushList(); continue; }
  flushList(); para.push(line.trim()); // intro paragraph
}
flushPara(); flushList();

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="description" content="Release notes for Cadence, the motion system designer — every version, what shipped and why." />
<title>Changelog — Cadence</title>
<meta name="author" content="Torbjörn Hedberg" />
<link rel="canonical" href="${HOST}/changelog" />
<meta name="theme-color" content="#ece5d6" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#191712" media="(prefers-color-scheme: dark)" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Cadence" />
<meta property="og:title" content="Changelog — Cadence" />
<meta property="og:description" content="Release notes for Cadence — every version, what shipped and why." />
<meta property="og:url" content="${HOST}/changelog" />
<meta property="og:image" content="${HOST}/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Cadence — not more knobs; structure, and an opinion." />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Changelog — Cadence" />
<meta name="twitter:description" content="Release notes for Cadence — every version, what shipped and why." />
<meta name="twitter:image" content="${HOST}/og.png" />
<link rel="icon" href="favicon.svg" type="image/svg+xml" />
<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png" />
<link rel="apple-touch-icon" href="apple-touch-icon.png" />
<link rel="stylesheet" href="styles.css" />
<style>
  body{background:var(--bg);color:var(--ink)}
  .clwrap{max-width:720px;margin:0 auto;padding:26px 20px 96px}
  .clnav{display:flex;align-items:center;justify-content:space-between;margin-bottom:7vh}
  .clbrand{display:inline-flex;align-items:center;gap:9px;font-family:var(--serif);font-size:18px;font-weight:600;letter-spacing:-.01em;color:var(--ink);text-decoration:none}
  .clbrand img{display:block}
  .clbrand:hover{opacity:.62}
  .cl-kicker{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0 0 12px}
  .cl-h1{font-family:var(--serif);font-size:clamp(30px,6vw,46px);line-height:1.05;letter-spacing:-.02em;margin:0 0 14px;font-weight:600;font-optical-sizing:auto}
  .changelog > p{font-size:15px;line-height:1.66;color:var(--ink-dim);margin:0 0 8px;max-width:66ch}
  .changelog > p a{color:var(--accent);text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--accent) 40%,transparent)}
  .cl-ver{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;
    font-family:var(--serif);font-weight:600;letter-spacing:-.01em;margin:48px 0 6px;padding-top:22px;border-top:1px solid var(--line)}
  .cl-num{font-size:clamp(22px,3.4vw,28px)}
  .cl-ver time{font-family:var(--mono);font-size:12px;font-weight:400;color:var(--ink-faint)}
  .cl-sec{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin:20px 0 8px}
  .changelog ul{margin:0 0 8px;padding-left:20px}
  .changelog li{font-size:14px;line-height:1.62;color:var(--ink-dim);margin:7px 0;max-width:70ch}
  .changelog li strong{color:var(--ink);font-weight:600}
  .changelog code{font-family:var(--mono);font-size:.86em;background:var(--panel-2);border:1px solid var(--line);border-radius:5px;padding:1px 5px;color:var(--ink-dim)}
  .changelog li a{color:var(--accent);text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--accent) 40%,transparent)}
  .clfoot{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);font-family:var(--mono);font-size:11px;color:var(--ink-faint)}
  .clfoot a{color:var(--ink-dim);text-decoration:none;border-bottom:1px solid var(--line)}
  .clfoot a:hover{color:var(--ink);border-color:var(--accent)}
</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Cadence","item":"${HOST}/"},{"@type":"ListItem","position":2,"name":"Changelog","item":"${HOST}/changelog"}]}
</script>
</head>
<body>
<div class="clwrap">
  <nav class="clnav">
    <a class="clbrand" href="index.html"><img class="logomark" src="favicon.svg" alt="" width="20" height="20" />cadence</a>
    <a class="lnav__link" href="index.html#tool">Open the tool&nbsp;→</a>
  </nav>
  <article class="changelog">
${body}  </article>
  <footer class="clfoot">
    Cadence — a motion system designer · <a href="index.html">Home</a> · <a href="guide.html">Guide</a> · <a href="https://github.com/tor2dbear/cadence" target="_blank" rel="noopener">Source</a>
  </footer>
</div>
</body>
</html>
`;

process.stdout.write(page);
