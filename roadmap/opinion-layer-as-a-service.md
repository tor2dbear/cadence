---
title: Opinion layer as a service
status: next
tags: [opinion-layer, backend]
updated: 2026-07-24
order: 10
---

## Goal
Expose the system read as a callable service, so a CI step or an agent can POST a
motion system and get its warnings back — "block the build if exit is slower than
enter."

## Research
- The pure logic is already extracted: `system-read.js` is DOM-free
  (`systemRead(system, {corpus})`), browser-global + CommonJS. This is a wrapper,
  not a rewrite.
- Host: a **Cloudflare Worker** fits the current stack (Cloudflare Pages already
  fronts the site; Worker free tier ~100k req/day, separate bucket).
- An **MCP wrapper** over the same function makes the critique callable from an
  editor/agent — the one genuinely agent-shaped part of Cadence.
- Conscious fork from static-only: this adds a backend surface. Weigh it against
  the portfolio-code readability the static footprint buys.

## Open questions
- Ship the benchmark corpus with the Worker, or accept it in the request body?
- Versioning: pin the checks so a CI gate doesn't shift under a deploy.
