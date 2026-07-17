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
echo "dist/ contains:" && ls -1 dist/
