# Changelog

All notable changes to Cadence. It's a prototype, so versions are milestones
rather than releases; the format loosely follows
[Keep a Changelog](https://keepachangelog.com). The version badge in the app
shows the deployed semver plus the commit it was built from, stamped at deploy.

## [0.9.10] — 2026-07-22

### Changed — the test bench is now abstract instruments only
- **Retired the wireframe-component lenses (`drawer`, `list reveal`).** They
  were low-fidelity copies of what the **demo page** already does with real,
  integrated components — so they blurred the line between the two. The bench's
  job is to *isolate one measurable quality of a token* (curve, stagger, travel,
  scroll mechanic, state swap); the demo page owns real components at full
  fidelity. Old share links that referenced a retired lens fall back to `orb`.
- **The `button` lens is honest now** — labelled `button · press`, it responds
  to **hover** (as "Hover me" always implied) as well as click-to-replay. The
  `accordion` lens is reframed as `accordion · reflow` (the expand-in-place
  gesture the abstract lenses can't show).

## [0.9.9] — 2026-07-22

### Changed
- **The tool's orb lens is now a comet, not a fading disc.** It used to animate
  `opacity` from `.3` to `1`, so at rest the track line showed straight through
  the semi-transparent orb — unfinished. The head is now **fully opaque** and
  leaves a **trail of fading echoes**: the head leads and each echo lags a
  little, so the trail stretches through the fast part of the easing and
  retracts at the ends — the token's easing character, now visible as motion
  blur. (The trail's translucency reads as blur, not a see-through orb.)

## [0.9.8] — 2026-07-22

### Added
- **A self-hosted `/changelog` page**, generated from `CHANGELOG.md` at build
  time (this file stays the single source of truth — a small `scripts/
  gen-changelog.mjs` converts it, no dependency). Styled in the identity like
  the guide, with its own canonical, Open Graph, and `BreadcrumbList`. The
  version badge and the colophon now link there instead of the raw file on
  GitHub — keeping visitors on-domain, adding an indexable page and a
  freshness signal, and reading as a finished product rather than a repo file.

## [0.9.7] — 2026-07-22

### Fixed
- **The spring orb finally sits on its line (iOS Safari).** Two earlier
  attempts (margin-centring, then constraint-based `margin-block:auto`) still
  let Safari drop the composited, animating orb a few pixels below the track.
  The orb is now a **flex item in a `display:flex; align-items:center` track**,
  so the layout engine places it and the compositor respects that — the
  centering no longer lives in a `top`/`margin` the GPU layer can round. Both
  the landing "emphasized" tile and the tool's orb lens; travel is unchanged.

## [0.9.6] — 2026-07-22

### Fixed
- **The right Fraunces now loads.** The self-hosted files were single-weight
  *static* instances baked at a low optical size (~9, the "text" cut), so the
  big display headings rendered in the sturdy text cut instead of the delicate,
  high-contrast display cut — visible in glyphs like the "m". Replaced them with
  the **variable** Fraunces (opsz 9–144, wght 400–600, roman + italic); with
  `font-optical-sizing: auto` (the browser default) display sizes now get the
  display cut and small labels the text cut, from one file per style. (~+95 KB;
  three static files → two variable.)
- **The easing tile draws its curve in one clean stroke.** The "draw" used
  `stroke-dasharray` on a path with `vector-effect: non-scaling-stroke`, which
  computes dashes in screen space — so on the stretched path the dash repeated
  and the curve appeared in disconnected chunks. It now reveals via a
  left-to-right `clip-path` wipe (which reads as drawing for the monotonic
  curve) regardless of the rendered path length.

## [0.9.5] — 2026-07-22

### Fixed
- **The guide's primary CTA text is visible again.** "Build your motion system"
  inherited `--accent` from the `.guide a` prose-link rule (higher specificity),
  so it rendered navy-on-navy and vanished. The CTA rules are now `a.<class>`
  so they win, and use `--on-accent`.
- **The travelling orb sits on its line, cross-browser.** Both the landing's
  "emphasized" tile and the tool's orb lens now centre with `top/bottom:0 +
  margin-block:auto` (constraint-based) instead of `top:50%` + a negative
  margin, which iOS Safari could still nudge below the line for a composited,
  animating element.

### Changed
- **The "naïve" toggle is explained.** A one-line note now says what flipping
  to naïve does — linear easing, symmetric timings, no stagger — so the label
  isn't a bare, unexplained term.
- **The colophon credits the author with a link** to tor-bjorn.com.
- **Added `BreadcrumbList` structured data** to the guide (Cadence › Guide),
  completing the schema coverage (WebApplication + FAQPage on the landing,
  TechArticle + BreadcrumbList on the guide).

## [0.9.4] — 2026-07-22

### Added
- **Google Search Console verification** meta tag on the landing, so the
  `cadence.tor2dbear.com` property can be verified and the sitemap submitted
  (SEO #3 — getting the site into Google's index). It's an inert meta tag (no
  external request), so it lives in the source, not the build step.

## [0.9.3] — 2026-07-22

### Fixed
- **Canonical / OG / sitemap URLs now match what the CDN serves.** Cloudflare
  Pages serves clean, extensionless URLs and 308-redirects the `.html` forms
  (`/guide.html` → `/guide`), so pointing the canonical, `og:url` and sitemap
  entries at the `.html` URLs sent crawlers through a redirect to reach the
  real page. They now use the clean URLs (`/guide`, `/demo`). Internal `href`s
  keep `.html` so the pages still open directly from disk and in the tests.

## [0.9.2] — 2026-07-22

### Added — a second indexable page (SEO #2, site architecture)
- **A `/guide.html` page: "How to build a motion system".** A genuine,
  long-form content page — primitives (duration ladder + easing set), composing
  intents, stagger & distance, exporting to CSS/Tailwind/Style Dictionary/JSON,
  and scroll-driven animations + view transitions — with code examples. It's a
  real second rankable URL targeting more of the queries designers search, in
  the site's identity (Fraunces, sand, the terminal code style), with its own
  canonical, Open Graph, and `TechArticle` structured data.
- **Internal linking:** the landing links to the guide (nav + "how it works"),
  and the guide links back to the tool and home.

### Changed
- **The demo is now `noindex, follow`** and dropped from the sitemap. It's a
  thin, tool-dependent surface; keeping it out of the index stops it competing
  with the landing and guide while its links still flow.
- `sitemap.xml` now lists the landing + guide; `build.sh` cache-busts and
  injects the analytics beacon into `guide.html` too.

## [0.9.1] — 2026-07-22

### Changed — on-page SEO (relevance)
- **The title and metadata now lead with what people search**, not the brand
  ("Cadence" collides with a large EDA company and the plain word, so it can't
  be the discovery vector). New `<title>`: *Motion design tokens & easing scale
  generator — Cadence*, with a keyword-led description.
- **Fixed the double `<h1>`.** The tool's wordmark was an `<h1>` (a second,
  keyword-free top heading); it's now a plain element, leaving the landing's
  hero as the single `<h1>`. The wordmark's home link and brand View Transition
  are unchanged.
- **Added a real, crawlable content section** — "what it is / how it works /
  what it exports / who it's for" plus an FAQ — targeting the queries designers
  actually type (motion design tokens, easing/duration scales, export to CSS /
  Tailwind / Style Dictionary, scroll-driven animations, view transitions).
  Roughly doubled the page's indexable text (~525 → ~1040 words) and added
  **FAQ structured data** (`FAQPage` JSON-LD) for rich-result eligibility.

## [0.9.0] — 2026-07-22

### Added — discoverability & traffic
- **SEO metadata.** Both pages now carry a canonical URL, Open Graph and
  Twitter (`summary_large_image`) tags, light/dark `theme-color`, and the
  landing carries JSON-LD (`WebApplication`) structured data. Titles and
  descriptions were already there; this makes shares unfurl and crawlers
  understand the page.
- **A social share image** (`og.png`, 1200×630) rendered in the identity —
  Fraunces headline, the sand palette, the ease curve as a background sweep.
- **`robots.txt` + `sitemap.xml`** pointing crawlers at the landing and demo.
- **Cloudflare Web Analytics** (privacy-first, cookieless). The beacon is
  injected at **build time into `dist/` only** — never the source — so the
  offline smoke tests don't trip over its external request. `build.sh` also
  now copies `.txt`/`.xml` assets into the deploy.

## [0.8.5] — 2026-07-22

### Fixed
- **The spring demo's orb no longer sits below its line on iOS Safari.** The
  travelling orb (on the landing's "emphasized" tile and the tool's orb lens)
  was centred with `top:50%` + `transform:translateY(-50%)`. Safari drops the
  `-50%` when it composites the *animated* transform, so the orb dropped half
  its height below the track. It's now centred with a negative margin, leaving
  the transform free for the travel/scale — bulletproof across browsers.

### Added
- **A way to get in touch.** The landing colophon gains a "Get in touch" link
  (`hi@tor-bjorn.com`, subject "Cadence"), and the standalone demo gains a slim
  footer — a colophon line plus links to the designer, source and contact — so
  a shared `demo.html` is no longer branding-only with no way onward.

## [0.8.4] — 2026-07-22

### Added
- **The live demo carries a way home.** `demo.html` can be reached as a
  standalone shared link, so it was a dead end — its only branding was the
  fake "Northwind" product. It now shows a `cadence` home mark that opens the
  designer (in a new tab, so it never disturbs the demo surface). Same
  "click the wordmark → home" gesture as the tool, now consistent across all
  three surfaces.

### Fixed
- **The landing's "system read" line no longer makes the page jump.** The
  tasteful observation under the motion toggle rotates through strings of
  different lengths (1–3 lines depending on the text and viewport), and the
  line grew/shrank with each — shoving the cards below up and down. It now
  reserves the tallest observation's height (measured across all of them at
  the current width, recomputed on resize), so the text swaps in place.

## [0.8.3] — 2026-07-22

### Added
- **The tool's wordmark is now a "home" link back to the intro.** Entering the
  editor was one-way — the only way back to the landing was to hand-edit the
  URL. Clicking the `cadence` wordmark now returns to the landing (the brand
  wordmark morphs back via the same View Transition as the entrance), clears
  the state hash so a reload stays on the intro, and keeps your system in
  memory so "Start designing" drops you back into the same work. Modified
  clicks (open-in-new-tab) fall through to a plain `index.html` link, and the
  affordance carries an accessible label.

### Fixed
- **The tool header wordmark no longer sits high.** The header was
  baseline-aligned, but the wordmark's icon-plus-text flexbox threw off its
  baseline, so `cadence` rode ~8px above the tagline and controls next to it.
  The header now centre-aligns its row (the convention for a control bar), so
  the wordmark, tagline, selector, buttons and badge share one line.

## [0.8.2] — 2026-07-22

### Fixed
- **Deploys are now visible immediately.** `styles.css` and `cadence.js` are
  cached for 4h by the CDN and their filenames are stable, so a fresh deploy
  wasn't seen until the cache expired (or a hard refresh) — the new v0.8.0/0.8.1
  identity looked "not live" even though it was. `build.sh` now appends a
  per-deploy `?v=<commit>` query to both references; since `index.html` itself
  is always revalidated (`max-age=0`), the new query — and thus the new CSS/JS
  — is picked up on the next load.

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
