#!/usr/bin/env bash
# Assemble the deployable static site into dist/ — only the site's own files, so
# the test tooling (package.json, node_modules/, tests/) never ships to the CDN.
# Cadence has no real build step; this is deploy glue. Point Cloudflare Pages at
# "Build command: bash build.sh" and "Build output directory: dist".
set -euo pipefail
rm -rf dist
mkdir -p dist
shopt -s nullglob
for f in *.html *.css *.js *.svg *.png *.ico *.webmanifest; do
  cp "$f" dist/
done

# stamp an automatic build version into the badge: v<semver> · <short commit>.
# semver comes from package.json (bump it at milestones); the commit is filled
# in by Cloudflare Pages' env (CF_PAGES_COMMIT_SHA), or git locally.
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo 0.0.0)"
SHA="${CF_PAGES_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 0000000)}"
STAMP="v${VERSION} · ${SHA:0:7}"
if [ -f dist/index.html ]; then
  sed -i "s|\(id=\"proto\">\)[^<]*|\1${STAMP}|" dist/index.html
fi

echo "version: ${STAMP}"
echo "dist/ contains:" && ls -1 dist/
