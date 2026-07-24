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

**Components are demoted to a swappable "bench" of abstract instruments.** Each
probe is a lens you point at one intent — it isolates one *measurable quality*
of a token (the easing curve, the stagger, the travel), rather than re-staging a
component. This was a deliberate pivot: an earlier version hardwired 4 roles to 4
demo components, which didn't scale — any new component "fell outside."
Organizing around the *token architecture* instead means nothing can. Real,
integrated components live on the `demo.html` surface, not the bench.

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
- **Deploy:** Cloudflare Pages (build via `build.sh`), with per-branch preview
  URLs on every PR.
- **Positioning:** primarily a *design-engineering* piece (bridges design ↔
  code), but the two-layer model + opinion layer also carry the AD and
  product-thinking story. Intended as a standalone works-case on the portfolio.

## Roadmap

Planned work now lives in **`roadmap/`** — one markdown file per item ("puck"),
with YAML frontmatter (`title`, `status`, `updated`, …) and a free-form body for
goal/research/open questions. Status flows `inbox → now / next / later → done`.
See `roadmap/README.md` for the convention (shared with the `pia-terminal` repo,
so both feed the same multi-repo overview). `ls roadmap/` for the current board.

Open pucks at a glance: `opinion-layer-as-a-service` and `import-external-palette`
(next), `bring-your-own-markup` and `security-headers` (later), `apply-undo`
(inbox). Anything that adds a backend (the service, the headers) is a **conscious
fork from static-only** — it breaks the "plain static site, no build" rule, so
weigh it against the portfolio-code readability the static footprint buys.

Already shipped (kept as history): draggable bézier editor; editable ladder
(add/remove/rename durations + easings); shareable system via URL state; export
to Tailwind / Style Dictionary / JS+TS; the matured opinion layer (pure
`system-read.js`, ranked findings, one-click Apply, comparative read — see the
`opinion-layer-system-read` puck); plus springs → CSS `linear()`, motion-mode
axis, stagger + cascade lens, property axis, distance/travel + velocity check,
tempo, reduced-motion, a live demo surface, and "Load a system".

**Hosting note:** Cloudflare Pages already covers hosting, including per-branch
deploy previews (a preview URL lands on every PR). No reason to move the site.

## Directions explored and ruled out (so we don't re-loop)

Getting to "motion" took several iterations. Recording the dead ends so a future
session doesn't re-propose them:

- **Color scale / palette tools — rejected.** Atmos.io already nails
  auto-generate → manual curve editing (Lightness/Chroma/Hue) → export. Red
  ocean. A sub-idea — a *critique/linter* that judges palettes instead of
  generating them — was interesting but parked; we chose to leave color
  entirely.
- **Fluid type scale / clamp generator — rejected.** Utopia (utopia.fyi) owns
  that space, and the portfolio's own type ladder is already hand-tuned (e.g.
  `--text-2xl: 1.3125rem`), so a generic modular-scale tool wouldn't fit.
- **The meta-lesson driving all of it:** unique ideas come from *personal
  friction, not a product category.* Every category-level idea ("a palette
  tool", "a type tool") collapsed into something that already exists. The
  personal-pain framing — "I can't reach quality with math alone" — is what
  produced Cadence. Keep pulling on real friction, not categories.

## The actual end goal: a portfolio works-case

Cadence exists to double as a **works-case** on the portfolio
(github: tor2dbear/portfolio, Hugo). Once the tool is solid, write the entry.
Works entries live at `content/english/works/<slug>/index.md` with frontmatter
(title, subtitle, role, tags, `details{year,platform,scope}`, `client`) and
sections: Challenge / Approach / Solution / Impact / Role. Angle for the writeup:
design engineering first, but lead with the thesis (math vs art direction), the
two-layer decision, and the opinion layer.

## Dogfooding / tie-back narrative

The portfolio *already ships a real motion token system* —
`--motion-duration-fast/base/slow/slower/xslow`,
`--motion-ease-emphasized: cubic-bezier(0.22, 1, 0.36, 1)`, stagger and distance
tokens — plus a live motion demo in its ui-library. Two payoffs: (1) it's a
source of realistic default values for Cadence, and (2) a strong case narrative
is to **rebuild the portfolio's own motion tokens with Cadence** — "I used my
tool on my own site." Validation and story in one.

## Prototype design tokens (visual continuity)

Deliberate single dark "instrument panel" theme (a motion lab, like a DAW — not
a forgotten light mode). Accent teal `#8ad0c6`. Role colors: enter `#8ad0c6`,
exit `#e08b7f`, move `#e9b872`, emphasized `#b79cf0`. Mono for wordmark and
labels to signal "engineering", system sans for body. Opinion-layer heuristics
currently encoded: enter/exit asymmetry, exit-should-accelerate-out, duration
budget (~550ms "now I'm waiting" line), ladder evenness, easing-set redundancy.

A private live prototype of v0.2 was published as a Claude artifact during the
bootstrapping session (URL not committed here; ask the owner if needed).

## How this repo was bootstrapped

Built as a prototype in a Claude session, delivered as a starter package.
Files: `index.html`, `styles.css`, `cadence.js` (model + render + opinion
layer), `README.md`, GitHub Pages workflow under `.github/workflows/`.
