# Cadence

A motion **system** designer — not another easing toy.

**Live:** [cadence.tor2dbear.com](https://cadence.tor2dbear.com) · [live demo](https://cadence.tor2dbear.com/demo.html) (the system applied to a real UI, re-timing as you edit)

Most tools let you tune one `cubic-bezier` at a time. Cadence treats motion the
way design systems treat color and type: as two layers of tokens.

- **Primitives** — a duration ladder and an easing set. General and
  component-agnostic; the vocabulary everything else is built from.
- **Intents** — semantic tokens (`enter`, `exit`, `move`, …) composed *by
  reference* from the primitives. Extensible: add your own. This is where art
  direction lives.

Components are just a **swappable bench**: each probe is a lens you point at one
intent, so nothing is hardwired to a fixed set of components. A **system read**
panel critiques the whole system — ladder evenness, redundant easings,
enter/exit asymmetry, duration budget.

Export the result as CSS custom properties (semantic tokens `var()`-reference
the primitives, exactly as you'd ship them), or as JSON, a Tailwind config, a
Style Dictionary token file, or a typed TS object.

## Run

No build step — it's a static site. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 4173
# → http://127.0.0.1:4173
```

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Markup |
| `styles.css` | Styles |
| `cadence.js` | Model, rendering, animation, and the system-read layer |
| `demo.html` | Standalone live demo — the system applied to a real UI |

## Status

Prototype (v0.3). Rough edges expected.

### Shipped since v0.2

**Authoring the scales**
- Editable scales — add / remove / rename duration steps and easings; a global
  **tempo** control scales the whole ladder while keeping its proportions.
- A draggable **bézier editor** — author each easing by dragging its control
  points, with headroom for overshoot (includes back / anticipate presets).
- **Spring easings** — an easing can be a stiffness/damping spring instead of a
  cubic-bézier, sampled to CSS `linear()` so real multi-bounce physics animates
  natively (a cubic-bézier fallback is noted in the export).
- An optional **distance (travel) scale** — a third primitive; intents can
  reference how far they move, which the system read uses to judge velocity.

**Composing intents**
- A **motion-mode axis** — add modes (productive/expressive, min/mid/max, a
  reduced-motion mode that exports under `prefers-reduced-motion`) and each
  intent carries a separate binding per mode, switched globally.
- Per-intent **stagger** (the per-item delay for sequenced elements), a
  **property** axis (the CSS property each intent animates), an optional
  spatial · effects **easing split**, and a **distance** reference.

**Seeing it**
- A lens-based bench of **abstract instruments**: each probe is a lens on one
  intent that isolates one measurable quality of a token — a unified **scope**
  (curve + time playhead + property-driven demo elements that cascade by
  stagger), an **orb** comet (travel + easing as motion blur), a **cascade**
  stagger timeline, **press** / **reflow** gestures, and **scroll-driven** &
  **view-transition** lenses. Each probe opens in the lens that fits its
  intent's character (a press gesture in `button·press`, a scroll-scrub in
  `scroll·scrub`, a sequence in `cascade`, otherwise the everyday `orb`), with
  `scope` as the deliberate inspect-the-curve lens leading probe 0 — so the
  bench opens varied rather than collapsing to one lens. Re-pointing a probe
  keeps its lens when it can still show the intent, and only switches for a
  specialist mechanic. Real, integrated components live on the demo page — not
  the bench.
- A **live demo** (`demo.html`) — a real product surface where the system is
  applied to actual components; it re-times live as you edit (BroadcastChannel +
  the URL hash), openable in a tab or as an in-editor preview overlay.

**Sharing & exporting**
- A **shareable system** — the whole token set is encoded in the URL, so a link
  restores it.
- Export to **CSS** custom properties (semantic tokens `var()`-reference the
  primitives, with composite `transition` shorthands), **JSON**, a **Tailwind**
  config, a **Style Dictionary** token file, and a typed **TS** object.
- A **"Load a system"** picker that seeds the model from a real design system's
  motion palette (Material 3 and Material 3 Expressive, Carbon, Fluent, Ant,
  Tailwind, Atlassian, Polaris, Primer, Spectrum) — Material 3 Expressive ships
  real springs.

**The opinion layer** — a system read that critiques the whole system: ladder
evenness, redundant easings (cubics *and* springs), enter/exit asymmetry,
duration budget, stagger budget, an idle spatial/effects split, distance/velocity
(travel fast enough to read as a jump), and a reduced-motion mode that doesn't
actually calm anything. It also runs a **comparative read** — benchmarking the
live system against the field of real design systems it ships (ladder growth and
overall tempo vs Material, Carbon, Fluent, …), so the numbers get a reference
frame ("steeper than every reference system"). Findings are **ranked worst-first**
by severity, and each warning carries a one-line **fix** — most of them with a
one-click **Apply** that makes the change for you (rebalance the ladder, trim a
duplicate easing, drop a slow exit onto a shorter step, …). The read tells you
what to do, not only what's wrong. The logic lives in `system-read.js` as a pure,
DOM-free `systemRead(system, {corpus})` (browser global + CommonJS), so the
identical critique runs in the app, in a headless unit test, and — see below — as
a service.

Roadmap (stays static): bring-your-**own** markup into the bench; import an
**external** motion palette (paste your own tokens) and run the system-read over
it — the "reverse-engineer the art direction" angle. (The built-in palettes are
already covered: "Load a system" seeds from them and the comparative read
benchmarks against them.)

Candidates that would add a backend (a conscious fork from static-only):
the **opinion layer as a service** — the pure system-read is already extracted
(`system-read.js`, no DOM), so what's left is to wrap it in a serverless endpoint
(a Cloudflare Worker fits the current stack) plus an optional MCP wrapper, so a
CI step or an agent can POST a system and get its warnings ("block the build if
exit is slower than enter"); and light security-header hardening (CSP,
`frame-ancestors` on the demo) at the CDN layer.

## License

MIT
