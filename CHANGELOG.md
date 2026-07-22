# Changelog

All notable changes to Cadence. It's a prototype, so versions are milestones
rather than releases; the format loosely follows
[Keep a Changelog](https://keepachangelog.com). The version badge in the app
shows the deployed semver plus the commit it was built from, stamped at deploy.

## [0.8.1] — 2026-07-22

### Changed — the live demo joins the identity
- **`demo.html` now wears the Sand/Ink-navy identity in both light and dark.**
  It followed the old near-black stage + blue accent and clashed with the
  rest of the app; it's now fully tokenised and dual-theme
  (`prefers-color-scheme`) — a warm sand stage framing the product shell in
  light, a warm-dark stage in dark, with the ink-navy / periwinkle accent.
- **The demo's labels are self-hosted JetBrains Mono**, tying its mono to the
  app without a CDN. The product surface itself stays in system sans (it's a
  deliberately plain, "any product" surface — only its motion should be
  interesting).
- Extended the identity guard (`smoke26`) to the demo: no external font host,
  mono self-hosted, the old blue accent gone, dual-theme present.

## [0.8.0] — 2026-07-22

A visual identity of its own — the app stops looking like a generic dark-mode
dev tool and gets a real point of view: warm sand, an ink-navy, and a display
serif with an opinion.

### Changed
- **New palette — warm "Sand" light theme + a matching dark counterpart.**
  A warm paper (`#ece5d6`) with ink-navy (`#22356e`) accent replaces the old
  near-black/violet scheme. Both light and dark are first-class and follow
  `prefers-color-scheme`; every surface, border, and state colour is a token,
  so the two themes stay in lockstep. The export code block is its own
  theme-independent warm-dark "terminal" (`--code-*` tokens).
- **New type system — self-hosted, zero external requests.** Display is
  **Fraunces** (a warm, opinionated old-style serif, used with its real
  italic for emphasis), body is **Switzer**, mono is **JetBrains Mono** — all
  shipped as local `woff2` (`fonts/`) via `@font-face`. No Google Fonts, no
  Fontshare, no CDN: the "one static page, no dependency" thesis now covers
  the fonts too. Body/mono are carried over from the author's portfolio so
  Cadence ties back to a personal brand.
- **Motion as a graphic sign.** The wordmark carries a small easing-curve
  swash — the "Curve = easing" primitive rendered as identity, not decoration.

### Added
- `tests/smoke26.mjs` — an identity guard: no external font hosts in source,
  `@font-face` stays local, Fraunces (incl. italic) actually paints, the sand
  background is live, and the curve mark is present.

## [0.7.4] — 2026-07-20

The redesign's finishing pass — trust and voice (the last of the UX review).

### Changed
- **The "PROTOTYPE" badge is now a clean version tag** (e.g. `v0.7.4`, still
  linking to the changelog). "Prototype" undersold the copy-paste-ready output;
  the version + changelog carry the same information without the caveat.
- **The landing's author line grew into a colophon** — a short note on the
  thesis and the fact that everything on the page is timed by Cadence's own
  system, plus the tech facts (one static page, no framework/runtime/dependency)
  and Source / Changelog links. Gives the visiting designer the "why & how"
  without leaving the page.
- Freshened the Preview button's tooltip to match the docked behaviour.

## [0.7.3] — 2026-07-20

### Added — landing scroll montage
- **The landing now teaches the model by scrolling.** Below the hero, a
  four-step montage assembles the two-layer system — primitives → intents →
  the opinion layer → export — each step **revealing via
  `animation-timeline: view()`** as it enters the viewport, with a
  **reading-progress bar scrubbed by `animation-timeline: scroll()`** up top.
  The landing dogfoods scroll-driven motion (reveal + scrub) by using it to
  explain itself. IntersectionObserver / scroll-listener fallbacks for browsers
  without native scroll timelines; reduced-motion shows everything statically.

## [0.7.2] — 2026-07-20

### Changed — the entrance
- **The landing → tool transition is now a shared-element View Transition.** The
  wordmark morphs from the landing nav into the editor header (a shared
  `view-transition-name`), while the rest cross-fades — dogfooding the View
  Transitions feature on the app's own entrance, timed by the system's own
  duration/easing tokens. Reduced-motion still swaps instantly.

## [0.7.1] — 2026-07-20

In-tool UX, part of the redesign — making the editor↔demo loop and the opinion
layer impossible to miss.

### Changed — the tool
- **The live preview docks beside the editor.** On wide screens it's a side
  pane (not a full-screen overlay), and it **auto-opens when you enter from the
  landing** — so the edit → see loop is felt at once, with the demo re-timing
  as you edit. Narrow screens keep the overlay; the Preview button still
  toggles it.
- **System read, elevated.** It now reads as a panel (accent edge) with a
  persistent **badge** in its header — "all clear" or "N to review" — so the
  differentiator is legible without scrolling to it.
- **Glossary titles** on the section headers map the vocabulary to familiar
  terms (primitives = design tokens, intents = semantic tokens, bench = live
  probes).

## [0.7.0] — 2026-07-20

A landing page — the first slice of a UX redesign. The tool used to drop you
straight into a dense three-column cockpit; now there's a front door that leads
with the thesis and *demonstrates it with motion*, then hands you into the
editor.

### Added — landing view
- **Self-demonstrating hero.** Every animation on the landing is timed by
  Cadence's own default system (staggered entrance, a spring, an easing curve
  that draws itself), so the page *is* the proof.
- **The signature toggle — "with taste / naïve".** One switch flips the page's
  motion between the tasteful default and a naïve system (linear, symmetric, no
  stagger); the whole page flattens and the live opinion line lights up red.
  The thesis, provable in one gesture.
- **Live opinion line** that rotates through real system-read observations —
  the differentiator, on the front page.
- **Two doors:** *Start designing* (dogfoods a View Transition into the editor)
  and *How it's built*; plus an author note and a "copy-paste-ready" trust line.
- **Boot gate:** an empty hash shows the landing; any hash (`#tool`, a share
  link, or state) boots straight into the editor — so shared systems and
  deep links skip the intro. Reduced-motion and mobile are first-class.

## [0.6.1] — 2026-07-20

The live demo catches up to the tool: it now exercises all three scroll/state
surfaces, each driven by the same `--role-*` tokens the shell already uses, so
they re-time live as you edit the system.

### Added — demo surface
- **View transitions on the tabs** — switching Overview / Activity / Settings
  runs `document.startViewTransition`, cross-fading the panel on the `move`
  token, with a feature-detected instant-swap fallback. Real Activity and
  Settings panels were added so there's something to transition between.
- **Native scroll reveal** — a section below the shell whose cards reveal via
  `animation-timeline: view()` (timed by `enter`), with an IntersectionObserver
  fallback.
- **Scroll scrub** — a reading-progress bar that tracks the scrollbar via
  `animation-timeline: scroll()`, with a scroll-listener fallback.
- Reduced-motion pins every end state; unsupported browsers just show content.

## [0.6.0] — 2026-07-20

View Transitions. The View Transitions API's only knobs are duration + easing —
which an intent already is — so Cadence can drive DOM state swaps (navigation,
toggles) straight from your semantic tokens.

### Added — view transitions
- **View-transition toggle** on any intent, with a **kind**: `root` (a
  whole-page cross-fade) or `shared` (a named element that morphs between
  states). Independent of the scroll-driven modes — a different trigger
  (state swap, not scroll).
- **New “Transitions” export tab.** Emits the `::view-transition-old/new/group`
  pseudo-elements timed by that intent's `--motion-<intent>-duration` /
  `-ease`, a `view-transition-name` for shared elements, a reduced-motion block
  that keeps the instant swap, and a `swap()` scaffold that feature-detects
  `startViewTransition` so unsupported browsers just update the DOM.
- **System read** notes that same-document VT is Baseline now (Chrome/Edge
  111+, Safari 18+, Firefox 144+), so this is progressive enhancement, not a
  gamble.
- **Simulated bench lens** (`view transition`): a real `startViewTransition`
  would snapshot the whole page, so the lens mimics the old→new cross-fade /
  shared morph with plain transitions timed by the intent — enough to feel it.

## [0.5.0] — 2026-07-20

Scroll, part two: **scrub**. Where a reveal plays once on entry, a scrub binds
an element's progress to scroll *position* — parallax, a progress bar, a fade
that tracks the scrollbar. No duration; the range is the axis.

### Added — scroll scrub
- **Scrub mode** on any scroll-driven intent (a `reveal · on entry` /
  `scrub · follow` switch). A scrub exposes three axes: **timeline**
  (`view()` — the element's own passage — or `scroll()` — the page), **range**
  (`cover` / `entry` / `exit` / `contain`), and **effect** (`progress` /
  `parallax` / `fade`). Reveal and scrub are mutually exclusive — an element
  either plays once or scrubs continuously.
- **Dual export in the Scroll tab.** Native CSS emits `@keyframes` +
  `animation: … auto …` (auto duration → the timeline drives it) +
  `animation-timeline` + `animation-range`. The **JS fallback** maps the
  element's viewport progress (0→1) to the same property via a passive scroll
  listener, for browsers without native scroll timelines (Firefox today).
  Reduced-motion pins the end state.
- **System read** flags a scrub running on a non-linear easing — the motion
  then speeds up and slows down against the scroll, which parallax/progress
  usually don't want.
- **Live scrub probe** — a bench lens (`scroll · scrub`) whose target tracks
  the box's own scroll position, so you can feel position-as-axis directly.

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
