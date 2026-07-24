---
title: Undo for one-click Apply
status: inbox
tags: [opinion-layer]
updated: 2026-07-24
---

## Goal
An undo for the system read's one-click fixes, so applying a fix isn't a one-way
door.

## Research
- Apply mutates the model then `rerenderAll()`s. The whole system is already
  URL-encoded (shareable), so snapshotting before/after is cheap — an undo stack
  of encoded states would cover Apply and, for free, most other edits.
- Undecided whether a general undo (all edits) is worth it over a narrow "undo
  last Apply." Parked in inbox until it's a real decision.
