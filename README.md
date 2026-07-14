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
the primitives, exactly as you'd ship them) or as JSON.

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

Prototype (v0.2). Rough edges expected.

Roadmap: draggable bézier editor, editable ladder steps (add/remove), custom
probes ("bring your own component"), shareable system via URL state, more
export targets (Tailwind, Style Dictionary).

## License

MIT
