# Cadence — project notes

Context and rationale behind the tool, so any future session (or collaborator)
can pick up without replaying the original conversation.

## The thesis

Color and type are solved in design systems; **motion is still copy-pasted
magic numbers.** Most tooling (cubic-bezier.com, easings.net) hands you *one
curve at a time* — a toy, not a system. The gap: math gets you ~80% of the way,
but quality is art direction, and no tool makes that last 20% legible or
reusable.

Cadence's answer is not "more knobs." It's **structure + an opinion.**

## The model — two token layers

Mirrors how design systems encode color (primitives → semantic):

1. **Primitives (Scales)** — a duration ladder + an easing set. General,
   component-agnostic. The vocabulary.
2. **Intents (Semantic)** — `enter`, `exit`, `move`, … composed *by reference*
   from the primitives (`enter = duration.base + emphasized`). Extensible: users
   add their own. This is where art direction lives.

**Components are demoted to a swappable "bench."** Each probe is just a lens you
point at one intent. This was a deliberate pivot: an earlier version hardwired 4
roles to 4 demo components, which didn't scale — any new component "fell
outside." Organizing around the *token architecture* instead means nothing can.

**The opinion layer ("System read")** critiques the whole system, not one
component: ladder evenness, redundant easings, enter/exit asymmetry, duration
budget (~550ms "now I'm waiting" line). Encoding an art director's eye into
checks is the differentiator — tools generate, they don't judge.

## Decisions on record

- **Name:** Cadence (rhythm/tempo of a whole motion system). Working name;
  alternatives floated: Tempo, Motif, Choreo.
- **Scope:** small & sharp — a weekend v1, one clear idea done well.
- **Stack:** plain static site, no build step — readable as portfolio code,
  deploys anywhere.
- **Deploy:** GitHub Pages for now (workflow included); may move to
  Netlify/Vercel later.
- **Positioning:** primarily a *design-engineering* piece (bridges design ↔
  code), but the two-layer model + opinion layer also carry the AD and
  product-thinking story. Intended as a standalone works-case on the portfolio.

## Roadmap

- Draggable bézier editor (author curves directly, not just presets).
- Editable ladder — add/remove/rename duration steps and easings.
- Custom probes — "bring your own component" into the bench.
- Shareable system via URL state (encode the whole token set in the link).
- More export targets: Tailwind config, Style Dictionary, JS/TS objects.
- Optional: import an existing palette of motion (a framework's tokens) and
  visualize/critique it — the "reverse-engineer the art direction" angle.

## How this repo was bootstrapped

Built as a prototype in a Claude session, delivered as a starter package.
Files: `index.html`, `styles.css`, `cadence.js` (model + render + opinion
layer), `README.md`, GitHub Pages workflow under `.github/workflows/`.
