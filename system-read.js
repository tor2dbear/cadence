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

  const median = xs => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  // A few order-invariant scalars that summarise a system's *character* — enough
  // to benchmark it against real design systems (the comparative read). `growth`
  // is the geometric-mean step of the duration ladder ((max/min)^(1/(rungs-1))),
  // i.e. "grows ~1.5× per step"; `medianIntentMs` is the tempo the system
  // actually animates at (median of the resolved intent durations).
  function fingerprint(system) {
    const ctx = makeCtx(system);
    const { durations, intents, durMs, bindOf } = ctx;
    const ms = durations.map(d => +d.ms).filter(x => x > 0);
    const rungs = ms.length;
    const minMs = rungs ? Math.min(...ms) : 0, maxMs = rungs ? Math.max(...ms) : 0;
    const growth = rungs >= 2 && minMs > 0 ? Math.pow(maxMs / minMs, 1 / (rungs - 1)) : null;
    const medianIntentMs = median(intents.map(it => durMs(bindOf(it).dur)).filter(x => x > 0));
    return { rungs, minMs, maxMs, growth, medianIntentMs };
  }

  function systemRead(system, opts) {
    const ctx = makeCtx(system);
    const { durations, easings, intents, durMs, distPx, easeObj, bindOf } = ctx;
    const out = [];
    // `apply` (optional) is a machine-readable version of `fix`: a one-click
    // operation the app can run to actually make the change. Params reference
    // scale slots by NAME (not index) so a fix survives reordering. Deterministic
    // fixes carry one; genuinely ambiguous ones (which knob?) stay text-only.
    const push = (status, sev, msg, fix, apply) => out.push({ status, sev, icon: iconFor[sev], msg, fix: fix || null, apply: apply || null });
    // largest ladder rung strictly below / at-most a duration — used to pick a
    // concrete target when a fix means "drop onto a shorter step".
    const rungBelow  = ms => { const c = ctx.durations.filter(d => +d.ms <  ms).sort((a, b) => b.ms - a.ms)[0]; return c ? c.name : null; };
    const rungAtMost = ms => { const c = ctx.durations.filter(d => +d.ms <= ms).sort((a, b) => b.ms - a.ms)[0]; return c ? c.name : null; };

    // 1. ladder evenness — needs ≥2 steps to form a ratio; guard the empty/one
    //    case so a single-rung ladder can't produce NaN (was a latent bug).
    if (durations.length >= 2) {
      const ratios = durations.slice(1).map((d, i) => +d.ms / +durations[i].ms);
      const spread = Math.max(...ratios) / Math.min(...ratios);
      if (spread > 1.9) push("warn", NIT, `Your duration ladder is uneven — step ratios run ${Math.min(...ratios).toFixed(2)}× to ${Math.max(...ratios).toFixed(2)}×. A ladder that grows at a steadier rate feels more like one scale.`, "Even out the ladder to a constant step.", { op: "rebalanceLadder" });
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
    if (dup) push("warn", WARN, `“${dup[0]}” and “${dup[1]}” are nearly identical curves. A tight easing set is easier to apply consistently — trim one.`, `Delete “${dup[1]}” and point its users at “${dup[0]}”.`, { op: "dropEasing", ease: dup[1], into: dup[0] });
    else push("ok", OK, `${easings.length} distinct easings — a lean, legible set.`);

    // 3. enter/exit asymmetry
    const en = intents.find(x => /enter|open|in$/i.test(x.name)), ex = intents.find(x => /exit|close|out$/i.test(x.name));
    if (en && ex) {
      const de = durMs(bindOf(en).dur), dx = durMs(bindOf(ex).dur);
      const quicker = rungBelow(de);   // largest rung under the enter, to speed the exit up
      const exFix = quicker ? { op: "setDur", intent: ex.name, dur: quicker } : null;
      if (Math.abs(de - dx) < 40) push("warn", WARN, `“${en.name}” and “${ex.name}” resolve to near-equal durations (${de}/${dx}ms). Real motion is asymmetric — exits should be quicker so leaving feels decisive.`, "Drop the exit onto a shorter duration than the enter.", exFix);
      else if (dx < de) push("ok", OK, `“${ex.name}” (${dx}ms) is quicker than “${en.name}” (${de}ms) — leaving feels decisive.`);
      else push("warn", DEFECT, `“${ex.name}” (${dx}ms) is slower than “${en.name}” (${de}ms). The user already chose to dismiss; a slow exit drags.`, "Swap the exit onto a duration below the enter's.", exFix);
    }

    // 4. long-duration budget
    const longIntent = intents.find(x => durMs(bindOf(x).dur) > 550);
    if (longIntent) {
      const under = rungAtMost(550);
      const longFix = (under && under !== bindOf(longIntent).dur) ? { op: "setDur", intent: longIntent.name, dur: under } : null;
      push("warn", WARN, `“${longIntent.name}” resolves to ${durMs(bindOf(longIntent).dur)}ms. Past ~550ms motion starts to feel like waiting — reserve the top of the ladder for large travel only.`, "Move it down the ladder unless it covers a long distance.", longFix);
    }

    // 5. stagger budget (measured against a 5-item list)
    const staggered = intents.filter(x => +bindOf(x).stagger > 0).sort((a, b) => +bindOf(b).stagger - +bindOf(a).stagger)[0];
    if (staggered) {
      const st = +bindOf(staggered).stagger, lead = st * 4;
      if (lead > 500) push("warn", WARN, `“${staggered.name}” staggers ${st}ms — across a 5-item list the last item waits ${lead}ms to even start. Long staggers make lists drag; keep the lead under ~500ms.`, "Lower the stagger so a 5-item lead stays under ~500ms.", { op: "setStagger", intent: staggered.name, ms: 120 });
      else push("ok", OK, `“${staggered.name}” staggers ${st}ms — a 5-item list cascades over ${lead}ms, brisk enough to read as one gesture.`);
    }

    // 6. spatial/effects split that hasn't diverged is just noise
    const idleSplit = intents.find(x => { const b = bindOf(x); return b.effectsEase && b.effectsEase === b.ease; });
    if (idleSplit) push("warn", NIT, `“${idleSplit.name}” is split into spatial · effects but both use the same easing. Diverge them (e.g. a spring for position, a flat curve for opacity) or collapse the split.`, "Give the effects track its own easing, or collapse the split.", { op: "collapseSplit", intent: idleSplit.name });

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
      if (revStag) push("warn", NIT, `“${revStag.name}” is a scroll reveal carrying a ${+bindOf(revStag).stagger}ms stagger. Native scroll-driven gives each item its own timeline, so the stagger only lands in the JS fallback — the two paths won't look identical. Drop the stagger, or accept the split.`, "Drop the stagger for a consistent native/JS reveal.", { op: "setStagger", intent: revStag.name, ms: 0 });
      else push("ok", OK, `${revIntents.length} scroll reveal${revIntents.length > 1 ? "s" : ""} — exported as native CSS scroll-driven with an IntersectionObserver fallback for browsers without it (Firefox today).`);
    }

    // 9. scroll scrubs — flag non-linear easing (scrub speed then fights the scroll)
    const scrubIntents = intents.filter(x => bindOf(x).scrub);
    if (scrubIntents.length) {
      const nonLin = scrubIntents.find(x => { const e = easeObj(bindOf(x).ease); return !(e && e.bez && isLinearBez(e.bez)); });
      if (nonLin) push("warn", NIT, `“${nonLin.name}” scrubs with a non-linear easing — the motion speeds up and slows down against your scroll. That reads as intentional for a reveal-style scrub, but parallax/progress usually want a linear curve for a true 1:1 feel.`, "Use a linear curve for a true 1:1 scrub.", { op: "linearizeScrub", intent: nonLin.name });
      else push("ok", OK, `${scrubIntents.length} scroll scrub${scrubIntents.length > 1 ? "s" : ""} — native scroll-driven (no duration; the range is the axis) with a scroll-position fallback for browsers without it.`);
    }

    // 10. view transitions — opt-in; VT's only knobs are duration + easing
    const vtIntents = intents.filter(x => bindOf(x).vt);
    if (vtIntents.length) push("ok", OK, `${vtIntents.length} view transition${vtIntents.length > 1 ? "s" : ""} — same-document VT is Baseline (Chrome/Edge 111+, Safari 18+, Firefox 144+). The recipe feature-detects startViewTransition and honours reduced-motion, so unsupported browsers just swap instantly.`);

    // 11. reduced-motion mode that does nothing — opt-in (only fires once a
    //     "reduced" mode exists), so the default read stays quiet. A reduced
    //     mode whose every binding equals the default mode is dead weight. The
    //     comparison always reads bind 0 vs bind rmi, so it holds regardless of
    //     which mode is active (including while the reduced mode itself is being
    //     edited).
    const rmi = ctx.modes.findIndex(m => m.name === "reduced");
    if (rmi >= 0) {
      const changes = intents.some(it => {
        const base = it.binds[0], r = it.binds[Math.min(rmi, it.binds.length - 1)];
        if (!base || !r || r === base) return false;
        return r.dur !== base.dur || r.ease !== base.ease || (+r.stagger || 0) !== (+base.stagger || 0);
      });
      if (!changes) push("warn", NIT, `Your “reduced” mode resolves to the same durations, easings and staggers as the default — it won't calm anything for users who ask for less motion.`, "Shorten or flatten its bindings, or drop the mode.");
    }

    // 12. the comparative read — measure this system against a corpus of real
    //     design systems ("your ladder is steeper than Material's"). This is the
    //     "reverse-engineer the art direction" angle: the critique stops judging
    //     in a vacuum and positions the system in the field. Opt-in — only runs
    //     when a corpus is supplied, so the headless default read is unchanged.
    //     Each corpus entry is a named system snapshot: {name, durations, intents}.
    const corpus = (opts && opts.corpus) || [];
    if (corpus.length) {
      const mine = fingerprint(system);
      const refs = corpus.map(c => ({ name: c.name, fp: fingerprint(c) }));
      const nearestBy = (pick, val) => refs.filter(r => pick(r.fp) != null)
        .slice().sort((a, b) => Math.abs(pick(a.fp) - val) - Math.abs(pick(b.fp) - val)).slice(0, 3);

      // ladder growth vs the field
      const withG = refs.filter(r => r.fp.growth != null);
      if (mine.growth != null && withG.length >= 3) {
        const gs = withG.map(r => r.fp.growth), lo = Math.min(...gs), hi = Math.max(...gs), g = mine.growth;
        const nameG = r => `${r.name} ${r.fp.growth.toFixed(1)}×`;
        if (g > hi * 1.02) {
          const steep = withG.slice().sort((a, b) => b.fp.growth - a.fp.growth)[0];
          push("warn", NIT, `Your duration ladder grows ~${g.toFixed(1)}× per step — steeper than every reference system (the steepest, ${nameG(steep)}). Steep ladders jump between tempos and skip the middle.`, "Add an intermediate rung, or flatten the top of the ladder.");
        } else if (g < lo * 0.98) {
          const flat = withG.slice().sort((a, b) => a.fp.growth - b.fp.growth)[0];
          push("warn", NIT, `Your duration ladder grows ~${g.toFixed(1)}× per step — flatter than every reference system (the flattest, ${nameG(flat)}). Steps this close together can read as redundant.`, "Widen the ladder, or drop a rung.");
        } else {
          push("ok", OK, `Your duration ladder grows ~${g.toFixed(1)}× per step — in the range real systems use (${nearestBy(fp => fp.growth, g).map(nameG).join(", ")}).`);
        }
      }

      // overall tempo (typical resolved intent duration) vs the field
      const meds = refs.map(r => r.fp.medianIntentMs).filter(x => x != null);
      if (mine.medianIntentMs != null && meds.length >= 3) {
        const lo = Math.min(...meds), hi = Math.max(...meds), m = Math.round(mine.medianIntentMs);
        const nameM = r => `${r.name} ${Math.round(r.fp.medianIntentMs)}ms`;
        if (mine.medianIntentMs > hi) push("ok", OK, `Your system's typical intent runs ${m}ms — more leisurely than the field (the slowest reference sits at ${Math.round(hi)}ms). A deliberate choice; keep an eye on the duration budget.`);
        else if (mine.medianIntentMs < lo) push("ok", OK, `Your system's typical intent runs ${m}ms — snappier than the field (the quickest reference sits at ${Math.round(lo)}ms).`);
        else push("ok", OK, `Your system's typical intent runs ${m}ms — right in the field's range (${nearestBy(fp => fp.medianIntentMs, mine.medianIntentMs).map(nameM).join(", ")}).`);
      }
    }

    // rank worst-first, stable within a severity tier (preserves check order)
    return out.map((f, i) => ({ f, i })).sort((a, b) => b.f.sev - a.f.sev || a.i - b.i).map(x => x.f);
  }

  return { systemRead, fingerprint, iconFor };
});
