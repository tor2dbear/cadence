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
- A lens-based bench: each probe is a lens on one intent — a unified **scope**
  (curve + time playhead + property-driven demo elements that cascade by
  stagger), an abstract **orb**, a **cascade** stagger timeline, or a UI
  component (drawer, button, accordion, list reveal).
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
evenness, redundant easings, enter/exit asymmetry, duration budget, stagger
budget, an idle spatial/effects split, and distance/velocity (travel fast enough
to read as a jump).

Roadmap (stays static): bring-your-own component into the bench; import an
existing motion palette (a framework's tokens) and run the system-read over it —
the "reverse-engineer the art direction" angle.

Candidates that would add a backend (a conscious fork from static-only):
the **opinion layer as a service** — extract the pure resolve + system-read into
a headless module and expose it as a serverless endpoint (a Cloudflare Worker
fits the current stack) plus an optional MCP wrapper, so a CI step or an agent
can POST a system and get its warnings ("block the build if exit is slower than
enter"); and light security-header hardening (CSP, `frame-ancestors` on the
demo) at the CDN layer.

## License

MIT
