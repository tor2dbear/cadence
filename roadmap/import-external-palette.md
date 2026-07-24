---
title: Import an external motion palette and critique it
status: next
tags: [opinion-layer]
updated: 2026-07-24
order: 20
---

## Goal
Paste or import your OWN motion tokens (not just the built-in templates) and run
the system read over them — the "reverse-engineer the art direction" angle
applied to an arbitrary system.

## Research
- Partly there already: "Load a system" seeds from real framework palettes and
  the read runs on whatever's loaded; the comparative read benchmarks against
  them. What's missing is an entry point for external/arbitrary tokens.
- Needs a small importer that maps common token shapes (CSS custom properties, a
  JSON token file, a Tailwind / Style-Dictionary export) into the model shape
  `systemRead` already consumes.

## Open questions
- Which input formats to accept first? CSS custom properties are the
  lowest-friction paste.
- How to infer intents when a palette only ships primitives (durations/easings)
  and no semantic layer?
