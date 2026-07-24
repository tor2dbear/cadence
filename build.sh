#!/usr/bin/env bash
# Assemble the deployable static site into dist/ — only the site's own files, so
# the test tooling (package.json, node_modules/, tests/) never ships to the CDN.
# Cadence has no real build step; this is deploy glue. Point Cloudflare Pages at
# "Build command: bash build.sh" and "Build output directory: dist".
set -euo pipefail
rm -rf dist
mkdir -p dist
shopt -s nullglob
for f in *.html *.css *.js *.svg *.png *.ico *.webmanifest *.txt *.xml; do
  cp "$f" dist/
done
# self-hosted fonts (woff2) — ship the whole dir so @font-face resolves on the CDN
[ -d fonts ] && cp -r fonts dist/

# generate the /changelog page from CHANGELOG.md (single source of truth)
if [ -f scripts/gen-changelog.mjs ]; then
  node scripts/gen-changelog.mjs > dist/changelog.html && echo "generated dist/changelog.html"
fi

# stamp an automatic build version into the badge: v<semver> · <short commit>.
# semver comes from package.json (bump it at milestones); the commit is filled
# in by Cloudflare Pages' env (CF_PAGES_COMMIT_SHA), or git locally.
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo 0.0.0)"
SHA="${CF_PAGES_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 0000000)}"
STAMP="v${VERSION} · ${SHA:0:7}"
if [ -f dist/index.html ]; then
  sed -i "s|\(id=\"proto\">\)[^<]*|\1${STAMP}|" dist/index.html
  # Cache-bust the stylesheet + script. Cloudflare caches these for 4h and the
  # filenames are stable, so without this a fresh deploy isn't seen until the
  # cache expires (or a hard refresh). index.html itself is always revalidated
  # (max-age=0), so a per-deploy ?v=<commit> query is picked up immediately.
  sed -i "s|href=\"styles.css\"|href=\"styles.css?v=${SHA:0:7}\"|; s|src=\"cadence.js\"|src=\"cadence.js?v=${SHA:0:7}\"|; s|src=\"system-read.js\"|src=\"system-read.js?v=${SHA:0:7}\"|" dist/index.html
fi
# the guide shares styles.css (no cadence.js) — cache-bust its stylesheet too
[ -f dist/guide.html ] && sed -i "s|href=\"styles.css\"|href=\"styles.css?v=${SHA:0:7}\"|" dist/guide.html
[ -f dist/changelog.html ] && sed -i "s|href=\"styles.css\"|href=\"styles.css?v=${SHA:0:7}\"|" dist/changelog.html

# Inject Cloudflare Web Analytics into the deployed pages only. It loads an
# external beacon, so keeping it out of the source means the offline Playwright
# smoke tests (which open the source files) don't trip over a blocked request —
# analytics is a deploy concern, like the version stamp and cache-bust above.
BEACON='<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='"'"'{"token": "b306d2ac08f646a399bf3d359b262463"}'"'"'></script>'
for f in dist/index.html dist/demo.html dist/guide.html dist/changelog.html; do
  [ -f "$f" ] && sed -i "s|</body>|${BEACON}</body>|" "$f"
done

echo "version: ${STAMP}"
echo "dist/ contains:" && ls -1 dist/
