# Roadmap — convention

A **puck** = one thing we want to build. Each puck lives in its own file here
under `roadmap/`. The truth is plain markdown in the repo: readable for you in
the editor, for an agent via `cat`/`grep`, and meant to be harvested by an
external aggregator site that gives a visual overview across several repos. No
lock-in — these are just files.

> **The field names and status values below are an interface.** Tools (the
> aggregator) read them, so keep them exactly as specified and in English. The
> body is free-form prose.

This is the same convention used in the sibling `pia-terminal` repo, so both
feed the shared overview identically.

## One puck = one file (or one folder)

The default is a file per puck:

```
roadmap/
  import-external-palette.md
  bring-your-own-markup.md
  opinion-layer-as-a-service.md
```

**The filename (slug) is the puck's stable ID and anchor link.** Don't rename it
without reason. Use short, descriptive, hyphenated slugs. Skip number prefixes
(`001-`) — ordering is driven by the `order` field, not the filename.

When a puck needs **attachments** (sketches, images, several documents), promote
it from a file to a folder with the same slug:

```
roadmap/
  bring-your-own-markup/
    README.md          ← the puck itself (same format as a file-puck)
    sketch.png
    prior-art.md
```

The rule the aggregator follows: **a puck is either `roadmap/<slug>.md` or
`roadmap/<slug>/README.md`.** Nothing else needs to change when you promote.

## Frontmatter

Every puck opens with YAML frontmatter:

```markdown
---
title: Import an external motion palette
status: next
tags: [opinion-layer]
updated: 2026-07-24
issue: 41
order: 20
---
```

| Field     | Required | Meaning |
|-----------|----------|---------|
| `title`   | yes      | Short heading for the board. |
| `status`  | yes      | One of: `inbox`, `now`, `next`, `later`, `done`. See lifecycle. |
| `updated` | yes      | `YYYY-MM-DD`, last touched. The aggregator sorts and shows freshness on it. |
| `tags`    | no       | Areas, e.g. `[opinion-layer]`, `[bench]`. For filtering. |
| `issue`   | no       | Number of the working issue/PR in the repo, when the puck is in progress. |
| `order`   | no       | Manual order **within** a status column (lower = higher up). Falls back to `updated`. |

## Body

Free markdown under the frontmatter. Recommended skeleton — drop what you don't
need:

```markdown
## Goal
One sentence on why the puck exists.

## Research
Links, alternatives weighed, decisions and why. The stuff that otherwise goes
homeless.

## Open questions
- ...
```

The point of a file per puck: **the research lives in the puck from day one**
instead of cluttering a shared file. A puck can be as thick as it likes without
bothering anyone else.

## Lifecycle (status)

```
inbox  →  now / next / later  →  done
```

- **`inbox`** — raw material and research that isn't a decision yet. Drop early
  research here directly; the aggregator shows `inbox` dimmed in its own column
  (or hides it on a public view). Nothing here is a promise.
- **`now`** — actively in progress right now. Keep it short.
- **`next`** — up next, decided.
- **`later`** — want to do, not soon.
- **`done`** — shipped. The aggregator collapses/archives it. Keep the file as
  history; don't delete.

A puck usually starts in `inbox`, is promoted to `now/next/later` once it's an
actual decision, and lands in `done`. Update `updated` every time you touch the
status or the content.

## For agents

- Working on a specific puck? Open `roadmap/<slug>.md` — everything about it
  (goal, research, open questions) is there.
- Want the whole repo picture? `ls roadmap/` and read the frontmatter.
- When you start on a puck: set `status: now`, link the `issue:` if there is one,
  and update `updated`. When it's shipped: `status: done`.
- Create new pucks in `inbox` unless the work is decided — not in `now/next/later`.
