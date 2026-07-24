/* Cadence — the opinion layer, as a pure module.
 *
 * `systemRead(system)` is the whole "system read" with the DOM removed: it takes
 * an explicit snapshot of a motion system and returns ranked, structured
 * findings. No globals, no document — so the exact same critique runs three
 * ways: in the app (cadence.js calls it and renders the result), in a headless
 * unit test (tests/smoke31.mjs requires it directly), and — the roadmap goal —
 * behind a serverless endpoint or MCP wrapper where a CI step POSTs a system
 * and gets its warnings back ("block the build if exit is slower than enter").
 *
 * Input  — system: {
 *   durations: [{name, ms}], distances: [{name, px}],
 *   easings:   [{name, type:"cubic"|"spring", bez?, spring?{stiffness,damping}}],
 *   intents:   [{name, purpose?, binds:[{dur, ease, stagger?, prop?, distance?,
 *                effectsEase?, reveal?, scrub?, vt?}]}],
 *   modes?: [{name}], activeMode?: number }
 *
 * Output — [{ status:"ok"|"warn", sev:0..3, icon, msg, fix|null }], sorted
 *   worst-first (higher sev leads; stable within a tier). `sev` is the ranking
 *   knob every consumer shares: 3 a real defect, 2 a warning, 1 a nitpick,
 *   0 an all-clear. `fix` is a one-line prescription for the warns — the layer
 *   stops at diagnosis no longer.
 *
 * UMD-ish: assigns module.exports under Node, else globalThis.CadenceSystemRead.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (root || globalThis).CadenceSystemRead = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // severity → the icon the app has always used, so the visual read is unchanged
  const OK = 0, NIT = 1, WARN = 2, DEFECT = 3;
  const iconFor = { 0: "✓", 1: "~", 2: "!", 3: "≠" };

  // a self-contained resolve context bound to ONE system snapshot (no globals)
  function makeCtx(system) {
    const durations = system.durations || [];
    const distances = system.distances || [];
    const easings   = system.easings   || [];
    const intents   = system.intents   || [];
    const modes     = system.modes     || [{ name: "default" }];
    const activeMode = system.activeMode || 0;
    const durMs  = name => { const d = durations.find(x => x.name === name); return d ? +d.ms : (durations[0] ? +durations[0].ms : 0); };
    const distPx = name => { const d = distances.find(x => x.name === name); return d ? +d.px : null; };
    const easeObj = name => easings.find(e => e.name === name) || easings[0];
    const bindOf = it => it.binds[Math.min(activeMode, it.binds.length - 1)] || it.binds[0];
    return { durations, distances, easings, intents, modes, activeMode, durMs, distPx, easeObj, bindOf };
  }

  // is a cubic curve effectively the linear ramp? (used by the scrub check)
  const isLinearBez = b => b && Math.abs(b[0]) < .05 && Math.abs(b[1]) < .05 && Math.abs(b[2] - 1) < .05 && Math.abs(b[3] - 1) < .05;

  function systemRead(system) {
    const ctx = makeCtx(system);
    const { durations, easings, intents, durMs, distPx, easeObj, bindOf } = ctx;
    const out = [];
    const push = (status, sev, msg, fix) => out.push({ status, sev, icon: iconFor[sev], msg, fix: fix || null });

    // 1. ladder evenness — needs ≥2 steps to form a ratio; guard the empty/one
    //    case so a single-rung ladder can't produce NaN (was a latent bug).
    if (durations.length >= 2) {
      const ratios = durations.slice(1).map((d, i) => +d.ms / +durations[i].ms);
      const spread = Math.max(...ratios) / Math.min(...ratios);
      if (spread > 1.9) push("warn", NIT, `Your duration ladder is uneven — step ratios run ${Math.min(...ratios).toFixed(2)}× to ${Math.max(...ratios).toFixed(2)}×. A ladder that grows at a steadier rate feels more like one scale.`, "Aim for a roughly constant step (~1.5× each rung).");
      else push("ok", OK, "Duration ladder grows at a fairly even rate — it reads as one considered scale.");
    }

    // 2. easing redundancy — cubic curves compared by control points; springs
    //    compared by physics (near-equal stiffness/damping), so a duplicate
    //    spring no longer slips through the cubic-only test.
    let dup = null;
    for (let a = 0; a < easings.length && !dup; a++) for (let b = a + 1; b < easings.length && !dup; b++) {
      const ea = easings[a], eb = easings[b];
      if (ea.bez && eb.bez) {
        const d = ea.bez.reduce((s, v, k) => s + Math.abs(v - eb.bez[k]), 0);
        if (d < 0.15) dup = [ea.name, eb.name];
      } else if (ea.type === "spring" && eb.type === "spring" && ea.spring && eb.spring) {
        const ds = Math.abs((+ea.spring.stiffness || 0) - (+eb.spring.stiffness || 0));
        const dc = Math.abs((+ea.spring.damping || 0) - (+eb.spring.damping || 0));
        if (ds <= 12 && dc <= 1.2) dup = [ea.name, eb.name];
      }
    }
    if (dup) push("warn", WARN, `“${dup[0]}” and “${dup[1]}” are nearly identical curves. A tight easing set is easier to apply consistently — trim one.`, "Delete one and point its users at the other.");
    else push("ok", OK, `${easings.length} distinct easings — a lean, legible set.`);

    // 3. enter/exit asymmetry
    const en = intents.find(x => /enter|open|in$/i.test(x.name)), ex = intents.find(x => /exit|close|out$/i.test(x.name));
    if (en && ex) {
      const de = durMs(bindOf(en).dur), dx = durMs(bindOf(ex).dur);
      if (Math.abs(de - dx) < 40) push("warn", WARN, `“${en.name}” and “${ex.name}” resolve to near-equal durations (${de}/${dx}ms). Real motion is asymmetric — exits should be quicker so leaving feels decisive.`, "Drop the exit onto a shorter duration than the enter.");
      else if (dx < de) push("ok", OK, `“${ex.name}” (${dx}ms) is quicker than “${en.name}” (${de}ms) — leaving feels decisive.`);
      else push("warn", DEFECT, `“${ex.name}” (${dx}ms) is slower than “${en.name}” (${de}ms). The user already chose to dismiss; a slow exit drags.`, "Swap the exit onto a duration below the enter's.");
    }

    // 4. long-duration budget
    const longIntent = intents.find(x => durMs(bindOf(x).dur) > 550);
    if (longIntent) push("warn", WARN, `“${longIntent.name}” resolves to ${durMs(bindOf(longIntent).dur)}ms. Past ~550ms motion starts to feel like waiting — reserve the top of the ladder for large travel only.`, "Move it down the ladder unless it covers a long distance.");

    // 5. stagger budget (measured against a 5-item list)
    const staggered = intents.filter(x => +bindOf(x).stagger > 0).sort((a, b) => +bindOf(b).stagger - +bindOf(a).stagger)[0];
    if (staggered) {
      const st = +bindOf(staggered).stagger, lead = st * 4;
      if (lead > 500) push("warn", WARN, `“${staggered.name}” staggers ${st}ms — across a 5-item list the last item waits ${lead}ms to even start. Long staggers make lists drag; keep the lead under ~500ms.`, "Lower the stagger so a 5-item lead stays under ~500ms.");
      else push("ok", OK, `“${staggered.name}” staggers ${st}ms — a 5-item list cascades over ${lead}ms, brisk enough to read as one gesture.`);
    }

    // 6. spatial/effects split that hasn't diverged is just noise
    const idleSplit = intents.find(x => { const b = bindOf(x); return b.effectsEase && b.effectsEase === b.ease; });
    if (idleSplit) push("warn", NIT, `“${idleSplit.name}” is split into spatial · effects but both use the same easing. Diverge them (e.g. a spring for position, a flat curve for opacity) or collapse the split.`, "Give the effects track its own easing, or remove the split.");

    // 7. distance / velocity — only when an intent opts into a travel distance
    const withDist = intents.map(x => { const b = bindOf(x); if (!b.distance) return null;
      const px = distPx(b.distance); if (px == null) return null;
      const ms = durMs(b.dur); return { name: x.name, px, ms, v: px / Math.max(1, ms) }; }).filter(Boolean);
    if (withDist.length) {
      const fast = withDist.slice().sort((a, b) => b.v - a.v)[0];
      const slow = withDist.slice().sort((a, b) => a.v - b.v)[0];
      if (fast.v > 5) push("warn", WARN, `“${fast.name}” covers ${fast.px}px in ${fast.ms}ms — that's ${fast.v.toFixed(1)}px/ms, fast enough to read as a jump rather than a move. Slow it down or shorten the travel.`, "Lengthen the duration or shorten the distance.");
      else if (slow.v < 0.4 && slow.px >= 64) push("warn", NIT, `“${slow.name}” crawls ${slow.px}px over ${slow.ms}ms (${slow.v.toFixed(2)}px/ms). Long, slow travel reads as sluggish — tighten the duration or the distance.`, "Tighten the duration or the distance.");
      else push("ok", OK, `Travel speeds read naturally — “${fast.name}” moves ${fast.px}px in ${fast.ms}ms (${fast.v.toFixed(1)}px/ms), in the range the eye tracks as motion.`);
    }

    // 8. scroll reveals — only when an intent opts in (keeps the default read quiet)
    const revIntents = intents.filter(x => typeof bindOf(x).reveal === "number");
    if (revIntents.length) {
      const revStag = revIntents.find(x => +bindOf(x).stagger > 0);
      if (revStag) push("warn", NIT, `“${revStag.name}” is a scroll reveal carrying a ${+bindOf(revStag).stagger}ms stagger. Native scroll-driven gives each item its own timeline, so the stagger only lands in the JS fallback — the two paths won't look identical. Drop the stagger, or accept the split.`, "Drop the stagger for a consistent native/JS reveal.");
      else push("ok", OK, `${revIntents.length} scroll reveal${revIntents.length > 1 ? "s" : ""} — exported as native CSS scroll-driven with an IntersectionObserver fallback for browsers without it (Firefox today).`);
    }

    // 9. scroll scrubs — flag non-linear easing (scrub speed then fights the scroll)
    const scrubIntents = intents.filter(x => bindOf(x).scrub);
    if (scrubIntents.length) {
      const nonLin = scrubIntents.find(x => { const e = easeObj(bindOf(x).ease); return !(e && e.bez && isLinearBez(e.bez)); });
      if (nonLin) push("warn", NIT, `“${nonLin.name}” scrubs with a non-linear easing — the motion speeds up and slows down against your scroll. That reads as intentional for a reveal-style scrub, but parallax/progress usually want a linear curve for a true 1:1 feel.`, "Use a linear curve for a true 1:1 scrub.");
      else push("ok", OK, `${scrubIntents.length} scroll scrub${scrubIntents.length > 1 ? "s" : ""} — native scroll-driven (no duration; the range is the axis) with a scroll-position fallback for browsers without it.`);
    }

    // 10. view transitions — opt-in; VT's only knobs are duration + easing
    const vtIntents = intents.filter(x => bindOf(x).vt);
    if (vtIntents.length) push("ok", OK, `${vtIntents.length} view transition${vtIntents.length > 1 ? "s" : ""} — same-document VT is Baseline (Chrome/Edge 111+, Safari 18+, Firefox 144+). The recipe feature-detects startViewTransition and honours reduced-motion, so unsupported browsers just swap instantly.`);

    // 11. reduced-motion mode that does nothing — opt-in (only fires once a
    //     "reduced" mode exists), so the default read stays quiet. A reduced
    //     mode whose every binding equals the default mode is dead weight.
    const rmi = ctx.modes.findIndex(m => m.name === "reduced");
    if (rmi >= 0 && rmi !== ctx.activeMode) {
      const changes = intents.some(it => {
        const base = it.binds[0], r = it.binds[Math.min(rmi, it.binds.length - 1)];
        if (!base || !r || r === base) return false;
        return r.dur !== base.dur || r.ease !== base.ease || (+r.stagger || 0) !== (+base.stagger || 0);
      });
      if (!changes) push("warn", NIT, `Your “reduced” mode resolves to the same durations, easings and staggers as the default — it won't calm anything for users who ask for less motion.`, "Shorten or flatten its bindings, or drop the mode.");
    }

    // rank worst-first, stable within a severity tier (preserves check order)
    return out.map((f, i) => ({ f, i })).sort((a, b) => b.f.sev - a.f.sev || a.i - b.i).map(x => x.f);
  }

  return { systemRead, iconFor };
});
