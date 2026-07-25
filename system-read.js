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

  // sample a damped spring (mass 1) to N points over its own settle time, 0→1 —
  // the same shape the app exports as CSS linear(). Two springs are compared by
  // their rendered curves (not raw stiffness/damping), because an absolute
  // damping gap means very different things at high vs low damping.
  function sampleSpring(sp, N) {
    N = N || 24;
    const k = Math.max(1, +sp.stiffness || 170), c = Math.max(0, +sp.damping || 12), w0 = Math.sqrt(k);
    const zeta = c / (2 * Math.sqrt(k));
    const T = zeta > 0 ? Math.min(10, Math.max(0.15, Math.log(220) / (zeta * w0))) : 6;
    const out = [];
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * T; let x;
      if (zeta < 1) { const wd = w0 * Math.sqrt(1 - zeta * zeta); x = 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t)); }
      else if (zeta < 1.0001) { x = 1 - Math.exp(-w0 * t) * (1 + w0 * t); }
      else { const wd = w0 * Math.sqrt(zeta * zeta - 1); x = 1 - Math.exp(-zeta * w0 * t) * (Math.cosh(wd * t) + (zeta * w0 / wd) * Math.sinh(wd * t)); }
      out.push(x);
    }
    out[0] = 0; out[N - 1] = 1;
    return out;
  }
  // mean absolute difference between two springs' rendered curves (0 = identical)
  const springCurveDist = (a, b) => { const sa = sampleSpring(a), sb = sampleSpring(b); let s = 0; for (let i = 0; i < sa.length; i++) s += Math.abs(sa[i] - sb[i]); return s / sa.length; };

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
    // each finding carries a scorecard category (set per check below), so a
    // score/scorecard can group findings by dimension without re-deriving them.
    let cat = "robustness";
    const push = (status, sev, msg, fix, apply) => out.push({ status, sev, icon: iconFor[sev], msg, fix: fix || null, apply: apply || null, cat });
    // largest ladder rung strictly below / at-most a duration — used to pick a
    // concrete target when a fix means "drop onto a shorter step".
    const rungAtMost = ms => { const c = ctx.durations.filter(d => +d.ms <= ms).sort((a, b) => b.ms - a.ms)[0]; return c ? c.name : null; };
    // apply ops target an intent by INDEX, not just name — intent names aren't
    // unique (two "custom" intents, or a rename), so a name lookup could hit the
    // wrong one. Index is stable between rendering a finding and applying it (any
    // model change re-runs the read). Name is kept for the label/aria only.
    const idxOf = it => intents.indexOf(it);

    // 0. duplicate names — token exports key custom-property and object names
    //    straight off each scale's `name` (--motion-<name>-*, { <name>: … }), so a
    //    repeated name silently collides: the later declaration overwrites the
    //    earlier in the generated CSS/TS/Tailwind and a token quietly vanishes.
    //    The editor now dedupes on add, but an imported or hand-edited system can
    //    still carry a clash. Which one to rename is genuinely ambiguous → text
    //    fix, no one-click apply.
    // the collision belongs to the DIMENSION it corrupts, so the scorecard flags
    // "Duration ladder" / "Easing set" rather than hiding it under Robustness.
    const scaleCat = { duration: "ladder", easing: "easing", distance: "budget", intent: "robustness" };
    const scales = [["duration", durations], ["easing", easings], ["distance", ctx.distances], ["intent", intents]];
    for (const [kind, arr] of scales) {
      const seen = new Set(); let clash = null;
      for (const x of (arr || [])) { const n = x && x.name; if (n == null) continue; if (seen.has(n)) { clash = n; break; } seen.add(n); }
      if (clash != null) {
        cat = scaleCat[kind] || "robustness";
        push("warn", WARN, `Two ${kind}s are both named “${clash}”. Exported token names key off these, so the duplicate silently overwrites the first — a token quietly drops out of the CSS/TS output.`, `Rename one of the “${clash}” ${kind}s so the exported names don't collide.`);
        break;   // one clash is enough to prompt the fix; the re-read surfaces the next
      }
    }

    // 1. ladder evenness — needs ≥2 steps to form a ratio; guard the empty/one
    //    case so a single-rung ladder can't produce NaN (was a latent bug).
    cat = "ladder";
    if (durations.length >= 2) {
      const ratios = durations.slice(1).map((d, i) => +d.ms / +durations[i].ms);
      const spread = Math.max(...ratios) / Math.min(...ratios);
      if (spread > 1.9) push("warn", NIT, `Your duration ladder is uneven — step ratios run ${Math.min(...ratios).toFixed(2)}× to ${Math.max(...ratios).toFixed(2)}×. A ladder that grows at a steadier rate feels more like one scale.`, "Even out the ladder to a constant step.", { op: "rebalanceLadder" });
      else push("ok", OK, "Duration ladder grows at a fairly even rate — it reads as one considered scale.");
    }

    // 2. easing redundancy — cubic curves compared by control points; springs
    //    compared by physics (near-equal stiffness/damping), so a duplicate
    //    spring no longer slips through the cubic-only test.
    cat = "easing";
    let dup = null;
    for (let a = 0; a < easings.length && !dup; a++) for (let b = a + 1; b < easings.length && !dup; b++) {
      const ea = easings[a], eb = easings[b];
      if (ea.bez && eb.bez) {
        const d = ea.bez.reduce((s, v, k) => s + Math.abs(v - eb.bez[k]), 0);
        if (d < 0.15) dup = [ea.name, eb.name];
      } else if (ea.type === "spring" && eb.type === "spring" && ea.spring && eb.spring) {
        // compare rendered curves — a small absolute damping gap can still be a
        // large change at low damping (160/2 vs 160/3 is a 50% shift).
        if (springCurveDist(ea.spring, eb.spring) < 0.03) dup = [ea.name, eb.name];
      }
    }
    if (dup) push("warn", WARN, `“${dup[0]}” and “${dup[1]}” are nearly identical curves. A tight easing set is easier to apply consistently — trim one.`, `Delete “${dup[1]}” and point its users at “${dup[0]}”.`, { op: "dropEasing", ease: dup[1], into: dup[0] });
    else push("ok", OK, `${easings.length} distinct easings — a lean, legible set.`);

    // 3. enter/exit asymmetry
    cat = "asymmetry";
    const en = intents.find(x => /enter|open|in$/i.test(x.name)), ex = intents.find(x => /exit|close|out$/i.test(x.name));
    if (en && ex) {
      const de = durMs(bindOf(en).dur), dx = durMs(bindOf(ex).dur);
      // pick a rung at least 40ms under the enter, so applying it actually clears
      // the asymmetry threshold (a rung only 10ms below would just re-trip the
      // near-equal branch). No qualifying rung → no one-click fix.
      const quicker = rungAtMost(de - 40);
      const exFix = quicker ? { op: "setDur", intent: ex.name, intentIndex: idxOf(ex), dur: quicker } : null;
      if (Math.abs(de - dx) < 40) push("warn", WARN, `“${en.name}” and “${ex.name}” resolve to near-equal durations (${de}/${dx}ms). Real motion is asymmetric — exits should be quicker so leaving feels decisive.`, "Drop the exit onto a shorter duration than the enter.", exFix);
      else if (dx < de) push("ok", OK, `“${ex.name}” (${dx}ms) is quicker than “${en.name}” (${de}ms) — leaving feels decisive.`);
      else push("warn", DEFECT, `“${ex.name}” (${dx}ms) is slower than “${en.name}” (${de}ms). The user already chose to dismiss; a slow exit drags.`, "Swap the exit onto a duration below the enter's.", exFix);
    }

    // 4. long-duration budget
    cat = "budget";
    const longIntent = intents.find(x => durMs(bindOf(x).dur) > 550);
    if (longIntent) {
      const under = rungAtMost(550);
      const longFix = (under && under !== bindOf(longIntent).dur) ? { op: "setDur", intent: longIntent.name, intentIndex: idxOf(longIntent), dur: under } : null;
      push("warn", WARN, `“${longIntent.name}” resolves to ${durMs(bindOf(longIntent).dur)}ms. Past ~550ms motion starts to feel like waiting — reserve the top of the ladder for large travel only.`, "Move it down the ladder unless it covers a long distance.", longFix);
    }

    // 5. stagger budget (measured against a 5-item list)
    cat = "budget";
    const staggered = intents.filter(x => +bindOf(x).stagger > 0).sort((a, b) => +bindOf(b).stagger - +bindOf(a).stagger)[0];
    if (staggered) {
      const st = +bindOf(staggered).stagger, lead = st * 4;
      if (lead > 500) push("warn", WARN, `“${staggered.name}” staggers ${st}ms — across a 5-item list the last item waits ${lead}ms to even start. Long staggers make lists drag; keep the lead under ~500ms.`, "Lower the stagger so a 5-item lead stays under ~500ms.", { op: "setStagger", intent: staggered.name, intentIndex: idxOf(staggered), ms: 120 });
      else push("ok", OK, `“${staggered.name}” staggers ${st}ms — a 5-item list cascades over ${lead}ms, brisk enough to read as one gesture.`);
    }

    // 6. spatial/effects split that hasn't diverged is just noise
    cat = "easing";
    const idleSplit = intents.find(x => { const b = bindOf(x); return b.effectsEase && b.effectsEase === b.ease; });
    if (idleSplit) push("warn", NIT, `“${idleSplit.name}” is split into spatial · effects but both use the same easing. Diverge them (e.g. a spring for position, a flat curve for opacity) or collapse the split.`, "Give the effects track its own easing, or collapse the split.", { op: "collapseSplit", intent: idleSplit.name, intentIndex: idxOf(idleSplit) });

    // 7. distance / velocity — only when an intent opts into a travel distance
    cat = "budget";
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
    cat = "robustness";
    const revIntents = intents.filter(x => typeof bindOf(x).reveal === "number");
    if (revIntents.length) {
      const revStag = revIntents.find(x => +bindOf(x).stagger > 0);
      if (revStag) push("warn", NIT, `“${revStag.name}” is a scroll reveal carrying a ${+bindOf(revStag).stagger}ms stagger. Native scroll-driven gives each item its own timeline, so the stagger only lands in the JS fallback — the two paths won't look identical. Drop the stagger, or accept the split.`, "Drop the stagger for a consistent native/JS reveal.", { op: "setStagger", intent: revStag.name, intentIndex: idxOf(revStag), ms: 0 });
      else push("ok", OK, `${revIntents.length} scroll reveal${revIntents.length > 1 ? "s" : ""} — exported as native CSS scroll-driven with an IntersectionObserver fallback for browsers without it (Firefox today).`);
    }

    // 9. scroll scrubs — flag non-linear easing (scrub speed then fights the scroll)
    cat = "robustness";
    const scrubIntents = intents.filter(x => bindOf(x).scrub);
    if (scrubIntents.length) {
      const nonLin = scrubIntents.find(x => { const e = easeObj(bindOf(x).ease); return !(e && e.bez && isLinearBez(e.bez)); });
      if (nonLin) push("warn", NIT, `“${nonLin.name}” scrubs with a non-linear easing — the motion speeds up and slows down against your scroll. That reads as intentional for a reveal-style scrub, but parallax/progress usually want a linear curve for a true 1:1 feel.`, "Use a linear curve for a true 1:1 scrub.", { op: "linearizeScrub", intent: nonLin.name, intentIndex: idxOf(nonLin) });
      else push("ok", OK, `${scrubIntents.length} scroll scrub${scrubIntents.length > 1 ? "s" : ""} — native scroll-driven (no duration; the range is the axis) with a scroll-position fallback for browsers without it.`);
    }

    // 10. view transitions — opt-in; VT's only knobs are duration + easing
    cat = "robustness";
    const vtIntents = intents.filter(x => bindOf(x).vt);
    if (vtIntents.length) push("ok", OK, `${vtIntents.length} view transition${vtIntents.length > 1 ? "s" : ""} — same-document VT is Baseline (Chrome/Edge 111+, Safari 18+, Firefox 144+). The recipe feature-detects startViewTransition and honours reduced-motion, so unsupported browsers just swap instantly.`);

    // 11. reduced-motion mode that does nothing — opt-in (only fires once a
    //     "reduced" mode exists), so the default read stays quiet. A reduced
    //     mode whose every binding equals the default mode is dead weight. The
    //     comparison always reads bind 0 vs bind rmi, so it holds regardless of
    //     which mode is active (including while the reduced mode itself is being
    //     edited).
    cat = "robustness";
    const rmi = ctx.modes.findIndex(m => m.name === "reduced");
    if (rmi >= 0) {
      // compare RESOLVED values, not token names — a reduced binding that points
      // at a differently-named token which resolves to the same ms / same curve
      // (e.g. two rungs dragged to the same value) doesn't actually calm anything.
      const easeSig = name => { const e = easeObj(name); return e ? (e.type === "spring" ? `s:${e.spring && e.spring.stiffness}/${e.spring && e.spring.damping}` : `c:${(e.bez || []).join(",")}`) : String(name); };
      const changes = intents.some(it => {
        const base = it.binds[0], r = it.binds[Math.min(rmi, it.binds.length - 1)];
        if (!base || !r) return false;
        return durMs(r.dur) !== durMs(base.dur) || easeSig(r.ease) !== easeSig(base.ease) || (+r.stagger || 0) !== (+base.stagger || 0);
      });
      if (!changes) push("warn", NIT, `Your “reduced” mode resolves to the same durations, easings and staggers as the default — it won't calm anything for users who ask for less motion.`, "Shorten or flatten its bindings, or drop the mode.");
    }

    // 12. the comparative read — measure this system against a corpus of real
    //     design systems ("your ladder is steeper than Material's"). This is the
    //     "reverse-engineer the art direction" angle: the critique stops judging
    //     in a vacuum and positions the system in the field. Opt-in — only runs
    //     when a corpus is supplied, so the headless default read is unchanged.
    //     Each corpus entry is a named system snapshot: {name, durations, intents}.
    cat = "field";
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

  // The composite verdict. systemRead answers "what's wrong, ranked"; this folds
  // those findings into a single "is this good?" — a 0-100 score + letter grade —
  // plus a per-dimension scorecard, so the read can lead with an answer instead of
  // a scrolling list. Deterministic and DOM-free like systemRead; pass its
  // already-computed findings via opts.findings to avoid a second pass.
  const CATS = [
    ["ladder", "Duration ladder"], ["easing", "Easing set"], ["asymmetry", "Enter / exit"],
    ["budget", "Duration budgets"], ["field", "Vs the field"], ["robustness", "Robustness"],
  ];
  // a warn costs points by severity; ok findings are free. Tuned so a real
  // defect bites and warnings walk the score down through the bands.
  const PENALTY = { 1: 5, 2: 12, 3: 22 };
  function scoreSystem(system, opts) {
    const findings = (opts && opts.findings) || systemRead(system, opts);
    let score = 100;
    for (const f of findings) if (f.status === "warn") score -= (PENALTY[f.sev] || 8);
    score = Math.max(0, Math.min(100, score));
    const warns = findings.filter(f => f.status === "warn").length;
    // A demands an all-clear read of an ACTUALLY-ASSESSED system. Coverage is read
    // off the findings (scoreSystem may be handed findings with no system): the
    // ladder check only runs with ≥2 rungs and easing with ≥1, so a degenerate
    // import (one duration, one easing) produces no ladder finding — that's
    // "too thin to judge", not "flawless". Don't hand it an A · 100.
    const assessed = new Set(findings.map(f => f.cat));
    const coreCovered = assessed.has("ladder") && assessed.has("easing");
    // A is all-clear AND assessed; anything flagged (even one nitpick) reads at
    // most B, so the header verdict never says "A · 1 to review".
    const grade = (warns === 0 && coreCovered) ? "A"
      : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";
    const summary = warns > 0
      ? `${warns} thing${warns > 1 ? "s" : ""} to review.`
      : coreCovered
        ? "No warnings — the system reads as considered throughout."
        : "Too little system to fully assess — build out the duration ladder for a confident read.";
    // per-dimension: the worst finding in each category present (a warn outranks
    // an ok; higher sev leads), so the scorecard shows where to look.
    const categories = CATS.map(([key, label]) => {
      const fs = findings.filter(f => f.cat === key);
      if (!fs.length) return null;
      const worst = fs.slice().sort((a, b) =>
        (b.status === "warn") - (a.status === "warn") || b.sev - a.sev)[0];
      return { key, label, status: worst.status, sev: worst.status === "warn" ? worst.sev : 0, icon: worst.icon, note: worst.msg };
    }).filter(Boolean);
    return { score, grade, summary, warns, total: findings.length, categories };
  }

  // Read SOMEONE ELSE's palette. A tolerant scanner that pulls named motion
  // tokens out of raw text — CSS custom properties (`--dur-fast: 150ms`,
  // `--ease: cubic-bezier(...)`), a tokens.json / Style-Dictionary tree
  // (`"fast": "150ms"`), or a Tailwind theme fragment (`fast: '150ms'`) — into the
  // snapshot shape systemRead consumes, so the exact same critique runs over a
  // third-party system ("reverse-engineer the art direction"). Deliberately
  // lenient and read-only: it extracts NAMED duration/easing definitions and
  // ignores everything else; no eval, no DOM. Returns null when nothing parses.
  const EASE_KW = { ease: [.25, .1, .25, 1], "ease-in": [.42, 0, 1, 1], "ease-out": [0, 0, .58, 1], "ease-in-out": [.42, 0, .58, 1], linear: [0, 0, 1, 1] };
  function parsePalette(text) {
    text = String(text == null ? "" : text);
    const cleanName = raw => (raw || "").replace(/^[-\s"'.]+|[-\s"',;]+$/g, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "token";
    const durs = [], eas = [];
    let m;
    // <name> [quote] :|= [quote] <value> — the optional quote between the name
    // and the separator lets JSON keys ("fast": …) parse alongside CSS vars
    // (--fast: …) and JS literals (fast: …).
    const NV = `([A-Za-z][\\w-]*)\\s*["']?\\s*[:=]\\s*["']?\\s*`;
    // durations: value is <number>(ms|s)
    const dre = new RegExp(NV + `(\\d*\\.?\\d+)\\s*(ms|s)\\b`, "g");
    while ((m = dre.exec(text))) {
      let ms = parseFloat(m[2]) * (m[3] === "s" ? 1000 : 1);
      if (!(ms > 0) || ms > 60000) continue;                 // skip 0s and absurd values
      durs.push({ name: cleanName(m[1]), ms: Math.round(ms) });
    }
    // easings: value is cubic-bezier(a,b,c,d) or a named CSS timing keyword. The
    // (?![\w-]) after a keyword stops "linear" matching inside "linear-gradient".
    const ere = new RegExp(NV + `(cubic-bezier\\s*\\([^)]*\\)|(?:ease-in-out|ease-in|ease-out|ease|linear)(?![\\w-]))`, "gi");
    while ((m = ere.exec(text))) {
      let bez = null;
      const cb = m[2].match(/cubic-bezier\s*\(([^)]*)\)/i);
      if (cb) { const n = cb[1].split(",").map(x => parseFloat(x)); if (n.length === 4 && n.every(x => !isNaN(x))) bez = n; }
      else { const kw = EASE_KW[m[2].toLowerCase()]; if (kw) bez = kw.slice(); }
      if (bez) eas.push({ name: cleanName(m[1]), type: "cubic", bez });
    }
    if (!durs.length && !eas.length) return null;
    // de-dup identical (name+value) rows, then make names unique for token export
    const uniqRows = (arr, sig) => { const seen = new Set(); return arr.filter(x => { const k = sig(x); if (seen.has(k)) return false; seen.add(k); return true; }); };
    const uniqNames = arr => { const seen = {}; return arr.map(x => { let n = x.name, k = 2; while (seen[n]) n = x.name + "-" + (k++); seen[n] = 1; return Object.assign({}, x, { name: n }); }); };
    const durations = uniqNames(uniqRows(durs, x => x.name + ":" + x.ms).sort((a, b) => a.ms - b.ms));
    const easings = uniqNames(uniqRows(eas, x => x.name + ":" + x.bez.join(",")));
    // no intents come out of a raw token dump — the read assesses the primitives
    // (ladder, easing set) and the comparative fingerprint, and stays quiet on the
    // intent-level checks it has no data for.
    return { durations, distances: [], easings, intents: [], modes: [{ name: "default" }], activeMode: 0 };
  }

  return { systemRead, scoreSystem, fingerprint, parsePalette, iconFor };
});
