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

- ✅ Draggable bézier editor (author curves directly, not just presets).
- ✅ Editable ladder — add/remove/rename duration steps and easings.
- Custom probes — "bring your own component" into the bench. *(Partly there: a
  swappable set of abstract instruments in the bench + a full `demo.html`
  surface of real components; "bring your **own** markup" is still open.)*
- ✅ Shareable system via URL state (encode the whole token set in the link).
- ✅ More export targets: Tailwind config, Style Dictionary, JS/TS objects.
- ✅ Opinion layer, matured: extracted to a pure, DOM-free `systemRead(system)`
  module; findings ranked worst-first by severity; each warning carries a
  one-line fix, most with a one-click **Apply**; a **comparative read** that
  benchmarks the live system against the shipped design-system corpus (ladder
  growth + tempo vs Material, Carbon, Fluent, …).
- Import an existing palette of motion and critique it — the "reverse-engineer
  the art direction" angle. *(Partly there: "Load a system" seeds from real
  framework palettes and the read runs on whatever's loaded, and the comparative
  read benchmarks against them. Still open: paste/import your **own** external
  tokens, not just the built-in templates.)*
- *(Also shipped, not originally listed: springs → CSS `linear()`, motion-mode
  axis, stagger + cascade lens, property axis, distance/travel primitive +
  velocity check, tempo, reduced-motion, a live demo surface, "Load a system".)*

### Candidates that add a backend — a conscious fork from static-only

These break the "plain static site, no build" rule, so they're a deliberate
branch, not default scope. Weigh them against the portfolio-code readability the
static footprint buys.

- **Opinion layer as a service.** The pure logic is already extracted — the
  system-read checks live in `system-read.js`, no DOM, browser-global +
  CommonJS. What's left is to expose it as a serverless endpoint so a CI step or
  an agent can POST a motion system and get its warnings back — "block the build
  if exit is slower than enter." Given the current stack (Cloudflare in front of
  Pages), a **Cloudflare Worker** is the natural host (free tier ~100k req/day,
  separate bucket). An **MCP wrapper** over the same function makes the critique
  callable from an editor/agent — the one genuinely agent-shaped part of Cadence.
- **Security-header hardening.** CSP + `frame-ancestors 'self'` on `demo.html`
  (so nobody else can iframe the demo), stricter `Cache-Control`. Cheap, doesn't
  touch the app — set at the Cloudflare layer, since Pages can't send custom
  headers. Really a config task, parked here so it isn't forgotten.
- **Hosting note:** Cloudflare Pages already covers the hosting needs, including
  per-branch deploy previews (a preview URL lands on every PR). No reason to move
  the site; weigh the static-vs-backend tradeoff only for the Worker above.

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
