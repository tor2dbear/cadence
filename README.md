# Cadence

A motion **system** designer — not another easing toy.

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

## Status

Prototype (v0.3). Rough edges expected.

Shipped since v0.2: editable scales (add/remove/rename duration steps and
easings), a draggable bézier editor (author each easing by dragging its control
points, with headroom for overshoot), a shareable system — the whole token set
is encoded in the URL, so a link restores it — export to CSS, JSON, Tailwind
config, Style Dictionary, and a typed TS object, and a lens-based bench: each
probe defaults to an abstract "orb" that shows pure motion, and can switch to a
UI component (drawer, button, accordion, list reveal) to stress-test a token,
and a "Load a system" picker that seeds the whole model from a real design
system's motion palette (Material 3, Carbon, Fluent, Ant, Tailwind, Atlassian,
Polaris, Primer, Spectrum) for comparison or as a starting point, and a
motion-mode axis: add modes (e.g. productive/expressive, min/mid/max) and each
intent carries a separate (duration, easing) binding per mode, switched globally
— so one system can hold coordinated variants without duplicating easings.

Roadmap: bring-your-own component into the bench; import an existing motion
palette (a framework's tokens) and run the system-read over it — the
"reverse-engineer the art direction" angle. Further model extensions surfaced by
the design-system survey: a delay/stagger primitive, and an optional property
axis on intents.

## License

MIT
