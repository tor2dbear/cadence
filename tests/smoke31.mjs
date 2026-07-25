/* Headless unit test for the extracted opinion layer (system-read.js).
 *
 * No browser: it requires the pure module directly and feeds it plain system
 * snapshots. That's the whole point of the extraction — the critique runs with
 * no DOM, so it's unit-testable here and service-able later. Emits PASS/FAIL
 * lines like the Playwright suites, so tests/run.mjs aggregates it the same way. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { systemRead, fingerprint } = require("../system-read.js");
const assert = (n, c) => console.log(`${c ? "PASS" : "FAIL"}  ${n}`);

// cubic easings by control points
const E = (name, bez) => ({ name, type: "cubic", bez });
const healthyEasings = [
  E("standard", [0.2, 0, 0.2, 1]), E("decelerate", [0, 0, 0.2, 1]),
  E("accelerate", [0.4, 0, 1, 1]), E("emphasized", [0.22, 1, 0.36, 1]),
];
const healthyDurations = [
  { name: "fast", ms: 150 }, { name: "base", ms: 200 }, { name: "slow", ms: 300 },
  { name: "slower", ms: 500 }, { name: "xslow", ms: 800 },
];
const intent = (name, dur, ease, extra = {}) => ({ name, binds: [{ dur, ease, stagger: 0, prop: "all", ...extra }] });
const base = () => ({
  durations: healthyDurations.map(d => ({ ...d })),
  distances: [{ name: "panel", px: 240 }],
  easings: healthyEasings.map(e => ({ ...e, bez: e.bez.slice() })),
  intents: [
    intent("enter", "base", "emphasized", { stagger: 70 }),
    intent("exit", "fast", "accelerate"),
    intent("move", "slow", "standard"),
    intent("emphasized", "slower", "emphasized"),
  ],
  modes: [{ name: "default" }], activeMode: 0,
});
const msgs = out => out.map(f => f.msg).join("\n");

// 1. a healthy default system reads all-clear, and every finding is shaped right
{
  const out = systemRead(base());
  assert("healthy system has no warnings", out.every(f => f.status === "ok"));
  assert("findings carry sev + icon + msg", out.every(f => typeof f.sev === "number" && f.icon && f.msg));
}

// 2. a one-rung ladder no longer produces NaN / crashes (was a latent bug)
{
  let out, threw = false;
  try { out = systemRead({ ...base(), durations: [{ name: "only", ms: 200 }],
    intents: [intent("enter", "only", "emphasized"), intent("exit", "only", "accelerate")] }); }
  catch (e) { threw = true; }
  assert("single-duration ladder does not throw", !threw);
  assert("single-duration ladder emits no NaN text", out && !/NaN|undefined×/.test(msgs(out)));
}

// 3. an uneven ladder warns
{
  const s = base();
  s.durations = [{ name: "a", ms: 100 }, { name: "b", ms: 110 }, { name: "c", ms: 900 }];
  assert("uneven ladder warns", /ladder is uneven/.test(msgs(systemRead(s))));
}

// 4. two near-identical springs are now flagged (cubic-only check missed this)
{
  const s = base();
  s.easings = s.easings.concat([
    { name: "bounce", type: "spring", spring: { stiffness: 170, damping: 12 } },
    { name: "bouncy", type: "spring", spring: { stiffness: 174, damping: 12.5 } },
  ]);
  const out = systemRead(s);
  assert("duplicate springs flagged", /nearly identical curves/.test(msgs(out)) &&
    out.some(f => /bounce.*bouncy|bouncy.*bounce/.test(f.msg)));
}

// 4b. springs are compared by rendered curve, not absolute damping — a small
// damping gap at LOW damping is a big shape change and must NOT read as a dup
{
  const s = base();
  s.easings = s.easings.concat([
    { name: "loose2", type: "spring", spring: { stiffness: 160, damping: 2 } },
    { name: "loose3", type: "spring", spring: { stiffness: 160, damping: 3 } },
  ]);
  assert("low-damping springs are NOT falsely flagged", !/nearly identical curves/.test(msgs(systemRead(s))));
}

// 5. an exit slower than enter is the worst finding — and ranks first
{
  const s = base();
  s.intents = [intent("enter", "fast", "emphasized"), intent("exit", "slower", "accelerate")];
  const out = systemRead(s);
  assert("slow exit is a top-severity defect", out[0].sev === 3 && /slower than/.test(out[0].msg));
  assert("worst finding sorts before oks", out[0].status === "warn");
}

// 6. warnings prescribe a fix; all-clears don't
{
  const s = base();
  s.intents = [intent("enter", "fast", "emphasized"), intent("exit", "slower", "accelerate")];
  const out = systemRead(s);
  assert("every warning carries a fix", out.filter(f => f.status === "warn").every(f => f.fix && f.fix.length));
  assert("all-clears carry no fix", out.filter(f => f.status === "ok").every(f => f.fix === null));
}

// 7. a reduced-motion mode that changes nothing is called out (opt-in: quiet by default)
{
  const s = base();
  s.modes = [{ name: "default" }, { name: "reduced" }];
  s.intents = s.intents.map(it => ({ ...it, binds: [it.binds[0], { ...it.binds[0] }] }));  // reduced == default
  assert("no-op reduced mode warns", /won't calm anything/.test(msgs(systemRead(s))));
  // …and it still warns while the reduced mode is the active one (the check
  // reads bind 0 vs bind rmi, so it must not depend on activeMode)
  assert("no-op reduced mode warns even while it's active", /won't calm anything/.test(msgs(systemRead({ ...s, activeMode: 1 }))));
  // and once it genuinely dampens, the warning clears
  const s2 = base();
  s2.modes = [{ name: "default" }, { name: "reduced" }];
  s2.intents = s2.intents.map(it => ({ ...it, binds: [it.binds[0], { ...it.binds[0], dur: "fast", stagger: 0 }] }));
  assert("dampening reduced mode clears the warning", !/won't calm anything/.test(msgs(systemRead(s2))));
}

// 8. the comparative read — benchmark a system against a corpus of real ones
{
  // geometric-mean step: (max/min)^(1/(rungs-1)). 100..800 over 6 rungs → 8^(1/5)
  const fp = fingerprint({ durations: [100, 200, 300, 400, 500, 800].map((ms, i) => ({ name: "d" + i, ms })), intents: [] });
  assert("fingerprint growth ~1.5× for a Material-like ladder", Math.abs(fp.growth - Math.pow(8, 1 / 5)) < 1e-9);

  // a small stand-in corpus (name + duration ladder) around ~1.5× growth
  const corpus = [
    { name: "Material", durations: [100, 200, 300, 400, 500, 800].map((ms, i) => ({ name: "d" + i, ms })), intents: [] },
    { name: "Carbon", durations: [70, 110, 150, 240, 400, 700].map((ms, i) => ({ name: "d" + i, ms })), intents: [] },
    { name: "Fluent", durations: [50, 100, 150, 200, 250, 300, 400, 500].map((ms, i) => ({ name: "d" + i, ms })), intents: [] },
  ];
  // no corpus → no comparative line (backward compatible)
  assert("no corpus ⇒ no comparative read", !/reference system|the field|real systems use/.test(msgs(systemRead(base()))));

  // an in-range ladder gets an informational (non-warning) comparative line
  {
    const out = systemRead(base(), { corpus });   // starter grows ~1.5×, mid-field
    assert("in-range ladder gets a comparative line naming references",
      out.some(f => /real systems use/.test(f.msg) && /Material|Carbon|Fluent/.test(f.msg)));
    assert("in-range comparative line is not a warning",
      out.filter(f => /grows ~/.test(f.msg)).every(f => f.status === "ok"));
  }

  // a steep outlier is flagged as a nit, above the whole field
  {
    const steep = { ...base(), durations: [{ name: "a", ms: 100 }, { name: "b", ms: 1200 }] };  // 12× in one step
    const out = systemRead(steep, { corpus });
    assert("steeper-than-the-field ladder warns", out.some(f => f.status === "warn" && /steeper than every reference/.test(f.msg)));
  }

  // a flat outlier is flagged too
  {
    const flat = { ...base(), durations: [{ name: "a", ms: 200 }, { name: "b", ms: 210 }, { name: "c", ms: 220 }] };
    const out = systemRead(flat, { corpus });
    assert("flatter-than-the-field ladder warns", out.some(f => f.status === "warn" && /flatter than every reference/.test(f.msg)));
  }
}

// 9. one-click apply — the deterministic fixes carry a machine-readable op
{
  const find = (out, re) => out.find(f => re.test(f.msg));

  // a long stagger → setStagger op with a lead-safe value
  {
    const s = base();
    s.intents = [{ name: "list", binds: [{ dur: "base", ease: "standard", stagger: 200, prop: "all" }] }];
    const f = find(systemRead(s), /staggers 200ms/);
    assert("long stagger carries a setStagger op", f.apply && f.apply.op === "setStagger" && f.apply.ms * 4 <= 500);
  }

  // an uneven ladder → rebalanceLadder op
  {
    const s = base();
    s.durations = [{ name: "a", ms: 100 }, { name: "b", ms: 110 }, { name: "c", ms: 900 }];
    assert("uneven ladder carries a rebalance op", find(systemRead(s), /ladder is uneven/).apply.op === "rebalanceLadder");
  }

  // duplicate easings → dropEasing op naming which to drop and what to keep
  {
    const s = base();
    s.easings = s.easings.concat([{ name: "twin", type: "cubic", bez: [0.2, 0, 0.2, 1] }]);  // == standard
    const f = find(systemRead(s), /nearly identical/);
    assert("duplicate easing carries a dropEasing op", f.apply.op === "dropEasing" && f.apply.ease && f.apply.into);
  }

  // a slow exit → setDur op pointing at a rung below the enter
  {
    const s = base();
    s.intents = [intent("enter", "slow", "emphasized"), intent("exit", "slower", "accelerate")];  // 300 vs 500
    const f = find(systemRead(s), /slower than/);
    assert("slow exit carries a setDur op onto a shorter rung", f.apply.op === "setDur" && f.apply.intent === "exit");
  }

  // the exit fix must land ≥40ms under the enter, or it just re-trips near-equal.
  // rungs 190/200/500, enter/exit 200/500 → fix must NOT choose 190ms
  {
    const s = {
      ...base(),
      durations: [{ name: "d190", ms: 190 }, { name: "d200", ms: 200 }, { name: "d500", ms: 500 }],
      intents: [intent("enter", "d200", "standard"), intent("exit", "d500", "standard")],
    };
    const f = systemRead(s).find(x => /slower than|near-equal/.test(x.msg));
    // no rung is ≤ 160ms, so there's no clean fix — Apply is omitted rather than offered a 190ms no-op
    assert("exit fix omitted when no rung clears the 40ms threshold", f && f.apply === null);
  }

  // every op-bearing finding is a warning that also keeps its prose fix
  {
    const s = base();
    s.durations = [{ name: "a", ms: 100 }, { name: "b", ms: 110 }, { name: "c", ms: 900 }];
    const out = systemRead(s);
    assert("apply only on warnings, always with prose too",
      out.filter(f => f.apply).every(f => f.status === "warn" && f.fix));
    assert("all-clears never carry an apply op", out.filter(f => f.status === "ok").every(f => f.apply === null));
  }

  // intent-targeting ops carry a stable index — names collide (two "custom"
  // intents), so the op must point at the offending one, not the first match
  {
    const s = { ...base(), intents: [
      { name: "custom", binds: [{ dur: "base", ease: "standard", stagger: 0, prop: "all" }] },
      { name: "custom", binds: [{ dur: "base", ease: "standard", stagger: 200, prop: "all" }] },
    ] };
    const f = find(systemRead(s), /staggers 200ms/);
    assert("stagger op targets the offending intent by index", f.apply.intentIndex === 1);
  }
}

// 10. reduced-mode no-op is judged on RESOLVED values, not token names
{
  const msgs2 = out => out.map(f => f.msg).join("\n");
  // two rungs at the same ms; reduced points at the other name → same animation
  const s = {
    durations: [{ name: "base", ms: 200 }, { name: "slow", ms: 200 }],
    distances: [], easings: [{ name: "standard", type: "cubic", bez: [0.2, 0, 0.2, 1] }],
    intents: [{ name: "enter", binds: [
      { dur: "base", ease: "standard", stagger: 0, prop: "all" },
      { dur: "slow", ease: "standard", stagger: 0, prop: "all" },   // reduced: different name, same 200ms
    ] }],
    modes: [{ name: "default" }, { name: "reduced" }], activeMode: 0,
  };
  assert("reduced mode pointing at an equal-value token still warns", /won't calm anything/.test(msgs2(systemRead(s))));
  // and a genuinely shorter reduced binding clears it
  const s2 = { ...s, durations: [{ name: "base", ms: 200 }, { name: "slow", ms: 80 }] };
  assert("a shorter reduced binding clears the warning", !/won't calm anything/.test(msgs2(systemRead(s2))));
}

// 11. duplicate scale names are flagged — token exports key off `name`, so a
//     repeated one silently overwrites the first in the generated CSS/TS. The
//     editor dedupes on add, but imported / hand-edited systems can still clash.
{
  const clash = base();
  clash.intents.push(intent("custom", "base", "standard"));
  clash.intents.push(intent("custom", "fast", "accelerate"));   // second "custom" — collision
  assert("duplicate intent names warn", /both named .custom./.test(msgs(systemRead(clash))));

  const dupDur = base();
  dupDur.durations.push({ name: "fast", ms: 175 });   // second "fast"
  assert("duplicate duration names warn", /Two durations are both named/.test(msgs(systemRead(dupDur))));

  assert("a clean system has no duplicate-name warning", !/both named/.test(msgs(systemRead(base()))));
}

// 12. scoreSystem — the composite verdict folds findings into a grade + scorecard
{
  const { scoreSystem } = require("../system-read.js");
  const h = scoreSystem(base());
  assert("healthy system scores A / 100", h.grade === "A" && h.score === 100);
  assert("healthy system reports zero warns", h.warns === 0);
  assert("scorecard covers the core dimensions", ["ladder", "easing", "asymmetry"].every(k => h.categories.some(c => c.key === k)));
  assert("every scorecard entry carries label + status + note", h.categories.every(c => c.label && c.status && c.note));

  // a real defect (exit slower than enter) drops the grade and shows warns
  const bad = base();
  bad.intents = [intent("enter", "fast", "emphasized"), intent("exit", "slower", "accelerate")];   // exit 500 > enter 150
  const b = scoreSystem(bad);
  assert("a defect lowers the score below 100", b.score < 100 && b.warns >= 1);
  assert("a defect drops the grade below A", b.grade !== "A");
  assert("the enter/exit dimension reflects the warn", b.categories.find(c => c.key === "asymmetry")?.status === "warn");

  // opts.findings lets a caller reuse an already-computed read (no second pass)
  const findings = systemRead(bad);
  const reused = scoreSystem(null, { findings });
  assert("scoreSystem(null,{findings}) matches scoreSystem(system)", reused.score === b.score && reused.grade === b.grade);

  // A is all-clear only: a single nitpick (an idle spatial·effects split) must
  // NOT still read A, or the verdict would say "A · 1 to review"
  const nit = base();
  nit.intents = [intent("enter", "base", "emphasized", { effectsEase: "emphasized" })];   // split, both tracks same easing → NIT
  const n = scoreSystem(nit);
  assert("the split nitpick is the only warning", n.warns === 1 && n.total >= 1);
  assert("one nitpick reads B, never A", n.grade === "B");
}

// 13. scoreSystem coverage + collision categorisation (Codex P2s)
{
  const { scoreSystem } = require("../system-read.js");
  // a degenerate import (one rung, one easing) can't assess the ladder — so it
  // must NOT read "A · all clear · 100"; A requires the core dims to be assessed
  const thin = { durations: [{ name: "base", ms: 200 }], distances: [],
    easings: [{ name: "standard", type: "cubic", bez: [0.2, 0, 0.2, 1] }],
    intents: [intent("enter", "base", "standard")], modes: [{ name: "default" }], activeMode: 0 };
  const t = scoreSystem(thin);
  assert("an under-assessed system is not awarded A", t.grade !== "A");
  assert("an under-assessed system's summary flags thin coverage", /assess/i.test(t.summary));

  // a duplicate DURATION name shows under the ladder dimension, not Robustness
  const dupDur = base();
  dupDur.durations.push({ name: "fast", ms: 175 });   // second "fast"
  const d = scoreSystem(dupDur);
  const ladder = d.categories.find(c => c.key === "ladder");
  assert("a duplicate duration name lands on the ladder dimension", ladder && ladder.status === "warn" && /both named/.test(ladder.note));
  const robust = d.categories.find(c => c.key === "robustness");
  assert("the collision is not misfiled under robustness", !robust || !/both named/.test(robust.note));
}

// 14. parsePalette — read someone else's tokens into a system the engine can judge
{
  const { parsePalette, scoreSystem } = require("../system-read.js");
  // CSS custom properties (durations in ms + s, cubic-bezier easings)
  const css = parsePalette(`:root{
    --dur-fast: 150ms; --dur-base: 200ms; --dur-slow: 0.3s;
    --ease-standard: cubic-bezier(0.2, 0, 0.2, 1);
    --ease-emph: cubic-bezier(.22,1,.36,1);
    --brand: #123; --pad: 16px; }`);
  assert("CSS: three durations parsed", css.durations.length === 3);
  assert("CSS: seconds convert to ms (0.3s → 300)", css.durations.some(d => d.ms === 300));
  assert("CSS: two cubic-bezier easings parsed", css.easings.length === 2 && css.easings.every(e => e.bez.length === 4));
  assert("CSS: non-motion props are ignored", !css.durations.some(d => /brand|pad/.test(d.name)));

  // a JSON tokens tree (quoted keys) parses too
  const json = parsePalette(`{ "duration": { "fast": "100ms", "slow": "400ms" }, "easing": { "out": "ease-out" } }`);
  assert("JSON: quoted keys parse", json && json.durations.length === 2 && json.easings.length === 1);

  // a Tailwind theme fragment (unquoted keys, single quotes) parses too
  const tw = parsePalette(`transitionDuration: { fast: '120ms', slow: '500ms' }, transitionTimingFunction: { snappy: 'cubic-bezier(0.3,0,0,1)' }`);
  assert("Tailwind: fragment parses", tw && tw.durations.length === 2 && tw.easings.length === 1);

  // "linear-gradient" must NOT be mistaken for a linear easing
  assert("a linear-gradient value is not read as an easing", (parsePalette(`--bg: linear-gradient(90deg,#000,#fff); --d: 200ms;`).easings).length === 0);

  // nothing motion-shaped → null (so the UI can show a clean error)
  assert("no tokens ⇒ null", parsePalette("just some prose, no tokens") === null);

  // the SAME engine runs over the parsed system
  const sc = scoreSystem(css);
  assert("a parsed palette gets a real verdict", /^[A-E]$/.test(sc.grade) && sc.total >= 2);
}

// 15. parsePalette robustness (Codex P2s): SD nesting, stagger/delay, comments
{
  const { parsePalette } = require("../system-read.js");
  // Style-Dictionary / DTCG leaves key off the OUTER token, not the inner `value`
  const sd = parsePalette(`{ "fast": { "value": "150ms", "type": "duration" },
    "base": { "value": "200ms" }, "standard": { "value": "cubic-bezier(0.2,0,0.2,1)" } }`);
  assert("SD nesting: outer token names, not 'value'", sd.durations.map(d => d.name).sort().join(",") === "base,fast");
  assert("SD nesting: nested easing value parses", sd.easings.length === 1 && sd.easings[0].name === "standard");

  // stagger / delay are time values but must NOT become ladder rungs
  const st = parsePalette(`--dur-fast: 150ms; --dur-base: 200ms; --dur-slow: 300ms;
    --stagger: 1000ms; --enter-delay: 500ms; --transition-delay: 800ms;`);
  assert("stagger/delay excluded from the ladder", st.durations.length === 3 && !st.durations.some(d => /stagger|delay/.test(d.name)));

  // commented-out tokens (block + line) don't join the read
  const cm = parsePalette(`/* --deprecated: 3000ms; */\n--fast: 150ms;\n// --old: 5000ms;\n--base: 200ms;`);
  assert("commented tokens are ignored", cm.durations.length === 2 && !cm.durations.some(d => /deprecated|old/.test(d.name)));

  // …but a URL's // is not treated as a comment
  const u = parsePalette(`--ref: url(https://x.com/a); --fast: 150ms; --base: 200ms;`);
  assert("https:// URLs survive comment-stripping", u.durations.length === 2);
}

// 16. more parsePalette / scoring edge cases (Codex re-review P2s)
{
  const { parsePalette, scoreSystem } = require("../system-read.js");
  // Tailwind's numeric duration keys ('75': '75ms') must parse, not return null
  const tw = parsePalette(`transitionDuration: { '75': '75ms', '100': '100ms', '150': '150ms', '300': '300ms' }`);
  assert("numeric Tailwind keys parse", tw && tw.durations.length === 4 && tw.durations.some(d => d.name === "75"));

  // a duration-only paste is under-assessed (no easing dimension) → not a false A
  const donly = parsePalette(`--fast: 100ms; --base: 200ms; --slow: 400ms;`);
  const sc = scoreSystem(donly);
  assert("duration-only paste is not awarded A", sc.grade !== "A");
  assert("duration-only paste exposes no easing dimension", !sc.categories.some(c => c.key === "easing"));
  // the engine must not emit a nonsensical "0 distinct easings" finding
  const { systemRead } = require("../system-read.js");
  assert("no '0 distinct easings' finding when there are none", !systemRead(donly).some(f => /^0 distinct easings/.test(f.msg)));
}

// 17. reading Cadence's OWN export back: inline-marked intent rows are aliases of
// the primitives, not new tokens — they must not double the ladder or flag a
// phantom duplicate easing (Codex P2 on dogfooding the Tailwind export)
{
  const { parsePalette, systemRead } = require("../system-read.js");
  const tw = `transitionDuration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    enter: '200ms', // intent
    exit: '150ms', // intent
    hover: '150ms', // intent
  },
  transitionTimingFunction: {
    standard: 'cubic-bezier(0.2, 0, 0.2, 1)',
    emphasized: 'cubic-bezier(0.22, 1, 0.36, 1)',
    enter: 'cubic-bezier(0.22, 1, 0.36, 1)', // intent
    exit: 'cubic-bezier(0.4, 0, 1, 1)', // intent
  }`;
  const sys = parsePalette(tw);
  assert("intent-marked rows don't become ladder rungs", sys.durations.length === 3 && !sys.durations.some(d => /enter|exit|hover/.test(d.name)));
  assert("intent-marked easings don't duplicate the primitives", sys.easings.length === 2 && !sys.easings.some(e => /enter|exit/.test(e.name)));
  assert("no phantom duplicate-easing warning from resolved aliases", !systemRead(sys).some(f => /nearly identical/.test(f.msg)));
}

// 18. an intent marker only drops the declaration it marks — primitives that
// share a compact line before it survive (Codex P2 on multi-entry lines)
{
  const { parsePalette } = require("../system-read.js");
  const sys = parsePalette(`transitionDuration: { fast: '100ms', base: '200ms', enter: '200ms', // intent
    slow: '300ms' }`);
  assert("primitives before an inline intent marker survive", sys.durations.some(d => d.name === "fast") && sys.durations.some(d => d.name === "base"));
  assert("only the marked alias is dropped", !sys.durations.some(d => d.name === "enter"));
}

// 19. delay/stagger SECTIONS and case-insensitive units (Codex P2s)
{
  const { parsePalette } = require("../system-read.js");
  // a transitionDelay block with numeric leaf keys must not feed the ladder
  const sec = parsePalette(`transitionDuration: { fast: '100ms', base: '200ms', slow: '300ms' },
    transitionDelay: { 500: '500ms', 1000: '1000ms' }`);
  assert("delay/stagger sections are excluded from the ladder", sec.durations.length === 3 && !sec.durations.some(d => d.ms >= 500));
  // CSS units are case-insensitive: 100MS / .3S must parse
  const ci = parsePalette(`--fast: 100MS; --base: 200Ms; --slow: .3S;`);
  assert("uppercase / dotless CSS duration units parse", ci && ci.durations.length === 3 && ci.durations.some(d => d.ms === 300));
}

// 20. DTCG typed token values (Codex P2): { value: 150, unit: "ms" } + [.2,0,.2,1]
{
  const { parsePalette } = require("../system-read.js");
  const sys = parsePalette(`{
    "fast": { "$type": "duration", "$value": { "value": 150, "unit": "ms" } },
    "base": { "$type": "duration", "$value": { "value": 200, "unit": "ms" } },
    "standard": { "$type": "cubicBezier", "$value": [0.2, 0, 0.2, 1] } }`);
  assert("DTCG duration objects parse to ms", sys && sys.durations.map(d => d.name + ":" + d.ms).join(",") === "fast:150,base:200");
  assert("DTCG cubicBezier arrays parse to an easing", sys.easings.length === 1 && sys.easings[0].name === "standard" && sys.easings[0].bez.join(",") === "0.2,0,0.2,1");
}

// 21. duplicate declarations collapse to the cascade winner; nested delay
// sections are excluded recursively (Codex P2s)
{
  const { parsePalette } = require("../system-read.js");
  const dup = parsePalette(`--dur-fast: 100ms; --dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 300ms;`);
  assert("a repeated declaration collapses to the last value", dup.durations.length === 3 &&
    dup.durations.find(d => d.name === "dur-fast").ms === 120 && !dup.durations.some(d => /-2$/.test(d.name)));

  const nested = parsePalette(`{ "duration": { "fast": "100ms", "base": "200ms", "slow": "300ms" },
    "delay": { "modal": { "short": "500ms", "long": "900ms" } } }`);
  assert("nested delay sections are excluded from the ladder", nested.durations.length === 3 && !nested.durations.some(d => d.ms >= 500));
}

// 22. resolved semantic leaves (enter: { duration, easing }) are not primitives
// (Codex P2 — the JSON counterpart of the Tailwind // intent alias case)
{
  const { parsePalette } = require("../system-read.js");
  const semanticOnly = parsePalette(`{ "enter": { "duration": "200ms", "easing": "ease-out" },
    "exit": { "duration": "150ms", "easing": "ease-in" } }`);
  assert("a resolved-semantic-only file yields no primitives", semanticOnly === null);

  const mixed = parsePalette(`{ "primitives": { "duration": { "fast": "150ms", "base": "200ms", "slow": "300ms" },
    "easing": { "standard": "cubic-bezier(.2,0,.2,1)" } },
    "semantic": { "enter": { "duration": "200ms", "easing": "ease-out" } } }`);
  assert("primitives are read while semantic leaves are skipped", mixed.durations.map(d => d.name).join(",") === "fast,base,slow" && mixed.easings.length === 1);

  // a primitive that carries a scale in its name is NOT skipped
  const scaled = parsePalette(`--duration-fast: 150ms; --duration-base: 200ms;`);
  assert("scale-suffixed duration primitives still parse", scaled.durations.length === 2);
}
