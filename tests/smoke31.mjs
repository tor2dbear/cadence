/* Headless unit test for the extracted opinion layer (system-read.js).
 *
 * No browser: it requires the pure module directly and feeds it plain system
 * snapshots. That's the whole point of the extraction — the critique runs with
 * no DOM, so it's unit-testable here and service-able later. Emits PASS/FAIL
 * lines like the Playwright suites, so tests/run.mjs aggregates it the same way. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { systemRead } = require("../system-read.js");
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
