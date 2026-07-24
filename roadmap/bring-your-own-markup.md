---
title: Bring your own markup into the bench
status: later
tags: [bench]
updated: 2026-07-24
order: 30
---

## Goal
Let a user drop their OWN component markup into the bench and point a probe at
it, instead of only the built-in abstract instruments.

## Research
- Partly there: the bench ships a swappable set of abstract instruments, and
  `demo.html` stages real components at full fidelity. "Bring your **own**
  markup" is the open part.
- The probe model already isolates one intent per lens, so the seam exists — the
  work is a safe way to inject arbitrary user HTML/CSS and bind it to a token.

## Open questions
- Sandboxing untrusted markup: the tool is a static site, and pasted markup must
  not be able to script the page or exfiltrate anything (URL state is shared).
