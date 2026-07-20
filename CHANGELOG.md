# Changelog

All notable changes to Cadence. It's a prototype, so versions are milestones
rather than releases; the format loosely follows
[Keep a Changelog](https://keepachangelog.com). The version badge in the app
shows the deployed semver plus the commit it was built from, stamped at deploy.

## [0.4.0] — 2026-07-20

Scroll into the picture: the first scroll-driven surface. Any intent can now be
tagged as a **scroll reveal** — motion that plays as the element enters the
viewport — with a dual export that stays honest about where the platform is.

### Added — scroll reveals
- **Scroll-reveal toggle** on any intent (in the advanced panel), with a
  **trigger threshold** (reveal by _N_% into view). It reuses the intent's own
  duration, easing and distance, so a reveal is just a semantic token with a
  trigger — no new knobs.
- **Dual export — a new “Scroll” tab.** For every reveal it emits both the
  native **CSS scroll-driven** recipe (`animation-timeline: view()` +
  `animation-range`, Chrome/Edge 115+, Safari 26+, Opera) **and** an
  **IntersectionObserver fallback** (behind `@supports not (...)`) for browsers
  without it — Firefox today. Reduced-motion honoured in both paths.
- **Honesty baked in.** The export names the real difference — native _scrubs_
  the reveal to scroll position, the fallback _triggers_ it once at a threshold —
  and the **system read** warns when a reveal's stagger only lands in the JS
  path (native gives each item its own timeline).
- **Live in-view probe** — a new bench lens (`scroll · in-view`): a genuine
  scroll box whose cards reveal as they cross the threshold, driven by a scoped
  IntersectionObserver, so the abstract token becomes something you can scroll.

## [0.3.0] — 2026-07-18

The enrichment milestone: richer motion primitives, an opinion layer that reads
more of the system, a real demo surface, and the tooling to ship it safely.

### Added — authoring the scales
- **Spring easings** — an easing can be a stiffness/damping spring instead of a
  cubic-bézier, sampled to CSS `linear()` so real multi-bounce physics animates
  natively (with a cubic-bézier fallback noted in the export). Back / anticipate
  bézier presets too.
- **Distance (travel) scale** — an opt-in third primitive; intents can reference
  how far they move, which the system read uses to judge velocity.
- **Global tempo** control, and a one-click **reduced-motion** mode exported
  under `prefers-reduced-motion`.

### Added — composing intents
- **Motion-mode axis** — modes (productive/expressive, min/mid/max, reduced),
  each intent carrying a separate binding per mode, switched globally.
- Per-intent **stagger** (per-item delay), a **property** axis (the CSS property
  each intent animates → composite `transition` shorthands), and an optional
  **spatial · effects easing split**.

### Added — seeing it
- **Scope lens** — one view of a token's whole signature (curve + time playhead
  + property-driven demo elements that cascade by stagger).
- **Cascade lens** — the stagger plotted as a timeline.
- **Live demo** (`demo.html`) — a real product surface where the system is
  applied to actual components, re-timing live as you edit (BroadcastChannel +
  URL hash), openable in a tab or an in-editor preview overlay.

### Added — sharing & exporting
- Export targets **Tailwind**, **Style Dictionary**, and a typed **TS** object,
  alongside CSS and JSON.
- **"Load a system"** picker seeding the model from real design-system motion
  palettes (Material 3 / M3 Expressive, Carbon, Fluent, Ant, Tailwind,
  Atlassian, Polaris, Primer, Spectrum).

### Added — the opinion layer
- System-read checks for ladder evenness, easing redundancy, enter/exit
  asymmetry, duration and stagger budgets, an idle spatial/effects split, and
  distance/velocity ("fast enough to read as a jump").

### Changed
- **Export moved from a permanent column to a dismissible panel** — a reflowing
  right column on wide screens, a full-screen keyboard-modal sheet below 1260px —
  so the editor gets full width and the token lines stop clipping.
- Progressive disclosure on intent cards (core vs "more"), role colours, tidier
  mobile header, and a rebalanced editor (wider primitives column, capped &
  centred layout).

### Infrastructure
- A versioned **Playwright smoke suite** run in **CI** on every PR (branch → PR →
  CI + preview → merge).
- Hosting moved to **Cloudflare Pages** with a per-PR **preview deployment** on
  every pull request; custom domain, a branded **404**, and a `dist/` build so
  the test tooling never ships.
- **Logomark + favicons**, and an **automatic build version** stamped into the
  badge at deploy time.

## [0.2.0] — 2026-07-14

Initial public starter — the core idea, deployable as plain static files.

### Added
- Two-layer token model — **primitives** (a duration ladder + an easing set) →
  **intents** (semantic tokens composed *by reference* from the primitives).
- **Editable scales** (add / remove / rename) and a **draggable bézier editor**
  per easing.
- A **lens-based bench** — an abstract "orb" plus a swappable UI-component
  library, each a lens pointed at one intent.
- **Shareable system** encoded in the URL hash.
- Export to **CSS** custom properties and **JSON**.
