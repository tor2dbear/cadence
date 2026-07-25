# Cadence — agent guide

Cadence is a motion-system designer that ships as **one static page — no
framework, no runtime, no dependency**. Keep changes true to that thesis:
client-side only, no build step beyond `build.sh`'s deploy glue, and no external
requests at runtime.

## Working agreement

- **Tests:** `npm test` runs the Playwright smoke suite (`tests/run.mjs`
  auto-discovers `smoke*.mjs`). Add or extend a smoke test for every
  user-facing change; the suite must stay green.
- **Docs stay in sync:** `smoke35` fails the build if the README or guide stop
  mentioning a shipped capability. The "definition of done" for a user-facing
  change is: update the code, the docs (README + guide), and the changelog.

## Changelog & versioning

Keep a Changelog 1.1.0 + SemVer; the project's version field (e.g.
`package.json` `version`) is the single source of truth. **The agent keeps this
current itself — no CI bot, no external tool:**

- **Every PR** adds one human-readable, grouped line under `## [Unreleased]`
  (`Added` / `Changed` / `Fixed` / `Removed` / `Deprecated` / `Security`) —
  prose, never a commit-log dump (Keep a Changelog's cardinal rule). Purely
  internal churn (refactor, test/tooling only) may be omitted.
- **A release-worthy PR** (a notable feature, or when asked to "cut a release")
  *also* rolls a version: move the accumulated `## [Unreleased]` items into a
  new `## [X.Y.Z] — YYYY-MM-DD` section (this PR's line included), pick X.Y.Z by
  SemVer (major = breaking, minor = feature, patch = fix), bump the version
  field to match, add the `[X.Y.Z]: …/releases/tag/vX.Y.Z` reference link and
  re-point `[Unreleased]` at `compare/vX.Y.Z...HEAD`. **After the PR merges,
  create the `vX.Y.Z` git tag + a GitHub release** so those changelog links
  actually resolve (a bump without a tag is why they 404).
- Always leave an (often empty) `## [Unreleased]` at the top. Don't dump git
  logs. This rule is meant to be copied verbatim across sibling repos.

The `/changelog` page is generated from `CHANGELOG.md` at build time
(`scripts/gen-changelog.mjs`), so `CHANGELOG.md` stays the single source of
truth — keep the markdown within the small subset the generator understands
(headings, lists, `**bold**`, `` `code` ``, `[links](url)`, and reference-link
definitions at the bottom).
