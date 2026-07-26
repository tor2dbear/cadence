# Changelog

All notable changes to Cadence, a motion-system designer that ships as one
static page. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html);
`package.json`'s `version` field is the single source of truth. The entries below
consolidate a rapid prototyping run into five pre-1.0 milestones (nothing was
tagged before, so the history was regrouped into real releases). The in-app
version badge shows the deployed version plus the commit it was built from,
stamped at deploy time.

## [Unreleased]

### Fixed
- **Role colours are now legible on the light theme.** The per-intent bench
  colours were a single bright set used in both themes; on the light (parchment)
  surface they sat at ~1.4–2.3:1 contrast — effectively invisible. They're now
  theme-aware CSS tokens (`--intent-0…6`): deepened, same-hue variants on light
  (all clear WCAG 3:1 for graphics) and the original bright set on dark, so the
  bench recolours correctly per theme and updates live when the OS theme changes.

### Added
- **A standalone, text-free hero animation** (`hero.html`) for showcasing
  Cadence off-site (a portfolio hero band, an embed). It carries the motion, not
  the words: the whole system is drawn as a fan of the four role-coloured intents
  (`enter` / `move` / `emphasized` / `exit`), one lit at a time, with an orb
  riding the active easing curve — comet trail, velocity-driven motion blur, and
  a soft wash of the role colour breathing behind it. Springs are sampled to a
  `linear()` polyline just as the tool exports them. One file, no dependencies,
  no runtime requests. It behaves like a **video, not a responsive layout**: the
  whole composition lives in one SVG on a fixed 16:9 frame, so it scales
  uniformly (letterboxed) and never reflows. Cadence's **primary brand colour**
  carries the instrument (grid, axes, anchors, handles, the system-at-rest fan,
  and the token chips) while the four role colours light only the active intent.
  It **follows the host's theme**: `prefers-color-scheme` live by default, a
  `postMessage({theme})` hook for a manual toggle, or `#light` / `#dark` to lock
  it; role colours are deepened on light for legibility. `#label` reveals a
  token-chip readout. Under `prefers-reduced-motion` (e.g. iOS "Reduce Motion")
  it falls back to a calm cross-fade loop rather than freezing. See the README's
  "Embedding the hero" for the iframe snippet.

## [0.6.0] — 2026-07-26

Editor authoring round-out, honest Back/Forward navigation, and a documented
opinion layer.

### Added
- **An intent's purpose is now editable** — a small field per intent (it was
  display-only). The purpose rides along in the JSON / Style Dictionary /
  Rationale exports and the share link.
- **A no-JS notice on the landing.** With JavaScript disabled, a note explains
  that the interactive designer needs it, while the (static) landing content
  stays readable.

### Changed
- **The bench reflects the distance primitive.** The orb lens now travels a
  fraction of the rail proportional to the intent's distance token (720px
  "screen" = full width) instead of always crossing the whole width, so editing
  the distance scale is visible in the preview.
- **The guide now documents the opinion layer** — the ranked system read with
  one-click Apply, the composite verdict + scorecard, the comparative "vs the
  field" read, the Rationale export, and reading another system's palette. The
  product's differentiator was under-described; `smoke35` now guards it.

### Fixed
- **The browser Back and Forward buttons now move between the landing and the
  tool.** Entering the editor was a silent in-place URL replace, so Back never
  returned to the intro; entering and leaving are now real navigations, so Back
  goes home and Forward returns to the editor, while in-tool edits still update
  the share link in place (no history spam).
- **Scroll-driven and view-transition are now mutually exclusive on an intent.**
  Both could be enabled at once — contradictory (one binds motion to scroll, the
  other to a DOM state swap) and double-emitting in the exports. Enabling one now
  clears the other, and a legacy/shared link carrying both loads scroll-driven only.
- **The landing degrades gracefully without JavaScript.** The boot gate never
  ran, so both views stacked and the hero's staggered reveals stayed at
  `opacity:0`; the landing is now the default view (the no-JS fallback) with its
  content revealed statically.
- **The Copy and Copy-share-link buttons no longer claim false success.** They
  flashed "Copied ✓" even when the clipboard API was absent or the write was
  rejected; they now confirm only on a real success and, on failure, prompt a
  manual copy (selecting the source text so the shortcut just works).
- The `/changelog` page's version-number links rendered in the browser-default
  blue — unreadable on the dark theme. They now inherit the heading colour with a
  quiet accent underline, matching the page's other links.

## [0.5.0] — 2026-07-25

Accessibility and export correctness.

### Added
- **Keyboard-operable easing curves.** Each bézier control point is a focusable
  `role="slider"`: arrow keys nudge it (Shift for larger steps), `aria-valuetext`
  reads out its value, and focus stays on the handle through both keyboard and
  pointer editing.
- **The editor is a `main` landmark, reachable by a skip link.** The first tab
  stop in each view skips the dense header straight to the editor (tool) or the
  hero (landing); only one `main` is exposed at a time.
- **A screen-reader announcement for the system-read verdict** — a polite
  `role="status"` region speaks the grade and finding count as they change, and
  only when they change.

### Changed
- **The 404 page rejoins the brand** — it dropped its hardcoded dark/teal theme
  for the shared stylesheet (Sand/Ink-navy tokens, Fraunces, light/dark), with
  root-absolute links so it resolves at any URL depth.
- **The landing's "live proof" tiles are legible to assistive tech** — the
  decorative animations stay hidden, but the section is a labelled region and its
  captions are read.

### Fixed
- **The CSS export's spring fallback is real, usable CSS** instead of a comment:
  a `cubic-bezier` approximation derived from the actual spring, upgraded to the
  sampled `linear()` behind an `@supports` feature query.
- **The TypeScript export emits the distance-primitives block**, matching the
  JSON and CSS exports.
- **Skip links no longer clobber the shared/edited state hash** (they move focus
  without navigating), and a focused curve handle's ring now contrasts with its
  own fill.

## [0.4.0] — 2026-07-25

Saveable systems, richer exports, and hardening.

### Added
- **Save & name your own systems** in the browser (`localStorage`, no account),
  with a picker split into Presets and My systems, and Update / Delete / a Reload
  that restores a system's saved values.
- **Import & export a system as a self-describing `.cadence.json` file** — the
  durable, portable "save" that fits the static thesis; import is strict about
  being a Cadence system but tolerant of a bare state object.
- **The opinion layer became a deliverable.** A `scoreSystem()` folds the ranked
  findings into a 0–100 score, a letter grade, and a per-dimension scorecard; a
  composite verdict leads the System-read header; and a **Rationale** export
  writes the critique — verdict, scorecard, every finding and its fix — as
  shareable Markdown.
- **Read another system's palette** — paste a third-party token set (CSS custom
  properties, a `tokens.json`, or a Tailwind fragment) and the same `systemRead()`
  runs over it, entirely client-side.
- **Download any export format as a file** under its conventional filename.
- **A hand-drawn inline-SVG icon set** — severity marks, play, disclosure
  chevrons, close and external — drawn to the logomark's geometry and themed via
  `currentColor`, replacing the platform unicode glyphs.

### Changed
- **The landing's opinion line now derives from the live `systemRead()`** over
  the default system instead of hand-typed prose, so it can't drift.
- **The tool header baseline-aligns the wordmark and tagline** and hides the
  tagline on compact viewports; the hero's single forward arrow marks the primary
  CTA.

### Fixed
- **"+ Add intent" dedupes token names** (`custom`, `custom-2`, …) so two intents
  can't silently emit colliding CSS custom properties.

### Security
- **A strict Content-Security-Policy at the CDN layer** (`scripts/gen-headers.mjs`
  generates `dist/_headers`): `default-src 'self'`, `object-src 'none'`,
  `frame-ancestors 'self'`, and the executable inline scripts allowed by **sha256
  hash** rather than `'unsafe-inline'`, plus `nosniff`, `Referrer-Policy` and
  frame protections.

## [0.3.0] — 2026-07-24

A visual identity, discoverability, and a maturing opinion engine.

### Added
- **The system read became a pure, headless module** (`system-read.js`): a
  DOM-free `systemRead(system)` returning ranked, worst-first findings, each with
  a one-line fix — the same critique runs in the app, in a headless test, and
  (per the roadmap) behind an endpoint.
- **A comparative "vs the field" read** — the system is benchmarked against the
  shipped design-system palettes (Material 3, Carbon, Fluent, …) on ladder growth
  and overall tempo.
- **One-click Apply** for the deterministic fixes — the model changes, the read
  re-runs, and the share link and preview restamp.
- **Discoverability** — SEO metadata, a social image, `robots.txt` /
  `sitemap.xml`, JSON-LD, a long-form **/guide** page with an FAQ, and Google
  Search Console verification; a **self-hosted /changelog** page generated from
  this file; and cookieless analytics injected at build time only.

### Changed
- **A visual identity of its own** — a warm **Sand** light theme with an
  **ink-navy** accent and a matching dark counterpart; **self-hosted** Fraunces /
  Switzer / JetBrains Mono (zero external requests); and a **logomark that is a
  live easing curve** (SMIL, frozen under reduced-motion), carried into the
  favicons and social image.
- **The bench was rationalised to abstract instruments** — the orb became a comet
  with a fading trail; the scope lens grew a playhead that rides the curve and
  doubles as an honest spring preview; and each probe opens in the lens that
  actually previews its intent.
- **The live-preview dock was redesigned** as a floating card that animates with
  the tool's own `enter` / `exit` tokens, and the demo wears its own slate+indigo
  "external product" palette.
- **The shareable URL encodes only the diff from the default**, and stays a clean
  `#tool` until the system actually diverges.

### Removed
- The low-fidelity wireframe-component bench lenses (`drawer`, `list reveal`) —
  the demo page owns real components; old share links fall back to the orb.

### Fixed
- Cross-browser centering of the travelling orb on iOS Safari; the correct
  (variable) Fraunces optical size; the easing tile drawing in one clean stroke;
  the motion switch snapping instead of crawling; and the canonical / OG / sitemap
  URLs matching the clean paths the CDN serves.

## [0.2.0] — 2026-07-20

Rich primitives, scroll-driven motion, view transitions, and a
self-demonstrating landing.

### Added
- **Richer primitives** — spring easings (sampled to CSS `linear()`), an opt-in
  distance/travel scale, a global tempo control, a one-click reduced-motion mode,
  a motion-mode axis, per-intent stagger, a property axis, and a spatial/effects
  easing split.
- **Scroll-driven motion** — any intent can be a **scroll reveal** (plays on
  entry) or a **scrub** (bound to scroll position: parallax / progress / fade),
  each emitting a native `animation-timeline` recipe **and** a JS fallback, with
  live bench lenses.
- **View Transitions** — a `root` or `shared` transition on any intent, a
  Transitions export tab, and a simulated bench lens; the live demo exercises
  reveals, scrubs and tab transitions on the shared tokens.
- **A self-demonstrating landing** — a hero timed entirely by Cadence's own
  default system, a "crafted ⟷ plain" toggle that flattens the whole page, a live
  opinion line, a scroll montage that assembles the model, and a shared-element
  View Transition into the editor.
- **More export targets** — Tailwind, Style Dictionary, and a typed TS object
  alongside CSS and JSON, plus a "Load a system" picker seeding from real
  design-system palettes.
- **The live demo** (`demo.html`) — a real product surface that re-times as you
  edit (BroadcastChannel + URL hash), dockable beside the editor.
- **Delivery tooling** — a versioned Playwright smoke suite run in CI on every
  PR, per-PR preview deployments on **Cloudflare Pages**, a `dist/` build so the
  test tooling never ships, and an automatic build-version stamp.

### Changed
- **Export moved from a permanent column to a dismissible panel** so the editor
  gets full width; progressive disclosure on intent cards; and a rebalanced,
  capped-and-centred layout.
- **System read, elevated** into an accent-edged panel with a persistent verdict
  badge; glossary titles map the vocabulary to design-token terms.

## [0.1.0] — 2026-07-14

Initial public starter — the core idea, deployable as plain static files.

### Added
- A **two-layer token model** — primitives (a duration ladder + an easing set)
  composed *by reference* into semantic **intents**.
- **Editable scales** (add / remove / rename) with a draggable bézier editor per
  easing.
- A **lens-based bench** pointing abstract and component lenses at one intent.
- A **shareable system** encoded in the URL hash.
- Export to **CSS** custom properties and **JSON**.

[Unreleased]: https://github.com/tor2dbear/cadence/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/tor2dbear/cadence/releases/tag/v0.6.0
[0.5.0]: https://github.com/tor2dbear/cadence/releases/tag/v0.5.0
[0.4.0]: https://github.com/tor2dbear/cadence/releases/tag/v0.4.0
[0.3.0]: https://github.com/tor2dbear/cadence/releases/tag/v0.3.0
[0.2.0]: https://github.com/tor2dbear/cadence/releases/tag/v0.2.0
[0.1.0]: https://github.com/tor2dbear/cadence/releases/tag/v0.1.0
