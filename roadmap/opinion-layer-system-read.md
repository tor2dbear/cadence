---
title: Opinion layer — pure module, ranked, actionable, comparative
status: done
tags: [opinion-layer]
updated: 2026-07-24
issue: 34
order: 1
---

## Goal
Turn the system read from a DOM-coupled prose critique into a pure, ranked,
actionable, self-aware layer.

## What shipped (PR #34)
- Extracted the whole critique into `system-read.js` — a DOM-free
  `systemRead(system, {corpus})`, browser-global + CommonJS. The identical read
  runs in the app, in a headless unit test, and (next) as a service.
- Findings ranked worst-first by severity.
- Each warning carries a one-line fix; the deterministic ones carry a one-click
  **Apply** that mutates the model and re-reads.
- A comparative read that benchmarks the live system against the shipped
  design-system corpus (ladder growth + tempo vs Material, Carbon, Fluent, …).
- Correctness fixes surfaced during review: spring redundancy by sampled curve,
  resolved reduced-mode compare, stable index-based Apply targets, effects-track
  repoint on easing deletion, order-safe ladder rebalance.

## Research / notes
Kept as history — see `CHANGELOG.md` 0.9.18–0.9.20 for the blow-by-blow. The
natural follow-ups spun out into their own pucks: `opinion-layer-as-a-service`,
`import-external-palette`, `apply-undo`.
