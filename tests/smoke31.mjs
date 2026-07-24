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

  // every op-bearing finding is a warning that also keeps its prose fix
  {
    const s = base();
    s.durations = [{ name: "a", ms: 100 }, { name: "b", ms: 110 }, { name: "c", ms: 900 }];
    const out = systemRead(s);
    assert("apply only on warnings, always with prose too",
      out.filter(f => f.apply).every(f => f.status === "warn" && f.fix));
    assert("all-clears never carry an apply op", out.filter(f => f.status === "ok").every(f => f.apply === null));
  }
}
