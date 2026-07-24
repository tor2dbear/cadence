---
title: Security-header hardening
status: later
tags: [ops]
updated: 2026-07-24
order: 40
---

## Goal
Ship a CSP, `frame-ancestors 'self'` on `demo.html` (so nobody else can iframe
the demo), and stricter `Cache-Control`.

## Research
- Config task — it doesn't touch the app. Cloudflare Pages serves custom headers
  from a static `_headers` file, so `build.sh` can emit/copy one into `dist/`.
- Prior art: `pia-terminal` does this via a `dist/_headers` generated at build
  time by a Vite CSP plugin. Cadence has no build step, so a hand-written
  `_headers` copied by `build.sh` is the natural fit.

## Open questions
- CSP is easy to break with the inline boot script in `index.html` (it sets the
  view class before first paint). May need a hash or nonce for that one inline.
