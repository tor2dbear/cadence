/* Cadence — a motion system designer.
 *
 * Two token layers, mirroring how real design systems encode motion:
 *   1. Primitives — a duration ladder + an easing set. General, component-agnostic.
 *   2. Intents    — semantic tokens (enter/exit/move/…) composed *by reference*
 *                   from the primitives. This is where art direction lives.
 * Components are demoted to a swappable "bench": each probe is just a lens you
 * point at one intent, so nothing is hardwired to a fixed set of components.
 */

// ---------- model ----------
const PRESETS = {
  "standard":[0.2,0,0.2,1], "decelerate":[0,0,0.2,1], "accelerate":[0.4,0,1,1],
  "emphasized":[0.22,1,0.36,1], "emph-out":[0.05,0.7,0.1,1], "sharp":[0.4,0,0.6,1],
  "gentle":[0.25,0.1,0.25,1], "linear":[0,0,1,1],
  "out-back":[0.34,1.56,0.64,1], "in-back":[0.36,0,0.66,-0.56], "in-out-back":[0.68,-0.6,0.32,1.6],
};
const SPRING_DEFAULT = {stiffness:170, damping:12};   // a lively single-overshoot spring
let durations = [
  {name:"fast",ms:150},{name:"base",ms:200},{name:"slow",ms:300},{name:"slower",ms:500},{name:"xslow",ms:800},
];
// distance/travel primitives (px) — no design system tokenizes these; they let
// the system-read judge whether a duration suits how far something moves.
let distances = [
  {name:"nudge",px:8},{name:"inline",px:48},{name:"panel",px:240},{name:"screen",px:720},
];
let distOpen = false;   // the distance scale is opt-in (collapsed by default)
// an easing is either a single cubic-bézier (type "cubic") or a sampled spring
// (type "spring", {stiffness, damping}) — springs express multi-bounce / physics
// that a single bézier can't, and export as CSS linear().
let easings = [
  {name:"standard",type:"cubic",bez:PRESETS.standard.slice()},
  {name:"decelerate",type:"cubic",bez:PRESETS.decelerate.slice()},
  {name:"accelerate",type:"cubic",bez:PRESETS.accelerate.slice()},
  {name:"emphasized",type:"cubic",bez:PRESETS.emphasized.slice()},
];
let idc = 0;
const nid = () => "i"+(idc++);
// motion "modes" (e.g. Carbon productive/expressive, Fluent min/mid/max): a
// global axis so one intent resolves to a different (duration, easing) per mode.
let modes = [{name:"default"}];
let activeMode = 0;
// which CSS property an intent animates (Primer/Atlassian treat this as a
// first-class attribute). "all" is the neutral default.
const PROPS = ["all","opacity","transform","color","background-color","height","width"];
// scroll-scrub: an element's animation progress follows scroll POSITION rather
// than a clock (no duration — the range is the axis). Three axes: the timeline
// source, the range it spans, and the effect (which property maps from→to).
const SCRUB_TL = ["view","scroll"];
const SCRUB_RANGE = ["cover","entry","exit","contain"];
const SCRUB_FX = ["progress","parallax","fade"];
const SCRUB_DEFAULT = {tl:"view",range:"cover",fx:"progress"};
// view transitions: animate DOM STATE swaps (navigation, toggles) via the
// View Transitions API. Same-document VT is Baseline; the only knobs are
// duration + easing — which an intent already is. Two shapes: a whole-page
// `root` cross-fade, or a `shared` named element that morphs between states.
const VT_TYPE = ["root","shared"];
const VT_DEFAULT = {type:"root"};
// a stable colour per intent (by position) so the bench reads by role, not one
// flat teal. Defaults land on enter=teal, exit=red, move=amber, emphasized=violet.
const INTENT_COLORS = ["#8ad0c6","#e08b7f","#e9b872","#b79cf0","#7ab8f0","#d69ce0","#9ad17f"];
const colorOf = i => INTENT_COLORS[((i%INTENT_COLORS.length)+INTENT_COLORS.length)%INTENT_COLORS.length];
// each intent carries one binding {dur, ease, stagger, prop} per mode. `stagger`
// (ms) is the per-item delay for sequenced elements; `prop` is the target.
let intents = [
  {id:nid(),name:"enter",purpose:"things appearing",binds:[{dur:"base",ease:"emphasized",stagger:70,prop:"all"}]},
  {id:nid(),name:"exit",purpose:"things leaving",binds:[{dur:"fast",ease:"accelerate",stagger:0,prop:"all"}]},
  {id:nid(),name:"move",purpose:"in-place change",binds:[{dur:"slow",ease:"standard",stagger:0,prop:"all"}]},
  {id:nid(),name:"emphasized",purpose:"hero moments",binds:[{dur:"slower",ease:"emphasized",stagger:0,prop:"all"}]},
  {id:nid(),name:"hover",purpose:"pointer feedback",binds:[{dur:"fast",ease:"standard",stagger:0,prop:"all"}]},
];
// the binding for the active mode (clamped so ragged data never throws)
const bindOf = it => it.binds[Math.min(activeMode, it.binds.length-1)] || it.binds[0];
// probes reference an intent by id
// each probe is a lens (kind) pointed at one intent. "orb" is the abstract,
// component-agnostic default; the rest are a swappable UI-component library.
const KINDS = [
  // abstract instruments — each isolates one measurable quality of a token.
  // Real components (a drawer, a list, a modal) live on the demo page, at full
  // fidelity and integrated; the bench doesn't re-stage low-fi copies of them.
  {k:"scope",label:"scope · everything"},
  {k:"orb",label:"orb · abstract"},
  {k:"cascade",label:"cascade · timeline"},
  {k:"button",label:"button · press"},
  {k:"acc",label:"accordion · reflow"},
  {k:"scrollreveal",label:"scroll · in-view"},
  {k:"scrub",label:"scroll · scrub"},
  {k:"viewtransition",label:"view transition"},
];
const CASC_N = 6;    // items in the stagger timeline
const SCOPE_N = 5;   // demo elements in the scope lens
const ORB_TRAIL = 9; // trailing echoes behind the comet head (orb lens)
// how each animated property reads on the scope demo elements
const SCOPE_ANIM = {
  opacity:  {props:["opacity"],   before:{opacity:"0"}, after:{opacity:"1"}},
  transform:{props:["transform"], before:{transform:"translateY(11px) scale(.5)"}, after:{transform:"translateY(0) scale(1)"}},
  all:      {props:["opacity","transform"], before:{opacity:"0",transform:"translateY(11px)"}, after:{opacity:"1",transform:"translateY(0)"}},
  color:    {props:["background-color"], before:{background:"var(--panel-2)"}, after:{background:"var(--accent)"}},
  "background-color":{props:["background-color"], before:{background:"var(--panel-2)"}, after:{background:"var(--accent)"}},
  height:   {props:["transform"], before:{transform:"scaleY(.18)"}, after:{transform:"scaleY(1)"}},
  width:    {props:["transform"], before:{transform:"scaleX(.18)"}, after:{transform:"scaleX(1)"}},
};
// the bench probes — seeded below (see SEED_INTENTS) once resolve()/defaultLensFor
// exist, so each opens in the lens that fits its intent's character
let probes = [];
// token names double as CSS custom-property suffixes, so keep them slug-safe
const slug = s => (s||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
function uniqueName(base, arr, skipIdx){
  base = base || "item";
  let n = base, k = 2;
  const taken = v => arr.some((x,idx)=>idx!==skipIdx && x.name===v);
  while(taken(n)) n = base+"-"+(k++);
  return n;
}
const findIntent = id => intents.find(x=>x.id===id) || intents[0];
const durMs = name => (durations.find(d=>d.name===name)||durations[0]).ms;
const easeObj = name => easings.find(e=>e.name===name)||easings[0];
const bezStr = a => `cubic-bezier(${a.join(", ")})`;
// sample a damped spring (mass 1) to N values over its settle time; endpoints pinned 0→1
const SPRING_N = 24;
function springSamples(sp, N=SPRING_N){
  const k=Math.max(1,+sp.stiffness||170), c=Math.max(0,+sp.damping||12), w0=Math.sqrt(k);
  const zeta=c/(2*Math.sqrt(k));
  const T = zeta>0 ? Math.min(10, Math.max(0.15, Math.log(220)/(zeta*w0))) : 6;
  const out=[];
  for(let i=0;i<N;i++){
    const t=(i/(N-1))*T; let x;
    if(zeta<1){ const wd=w0*Math.sqrt(1-zeta*zeta);
      x=1-Math.exp(-zeta*w0*t)*(Math.cos(wd*t)+(zeta*w0/wd)*Math.sin(wd*t)); }
    else if(zeta<1.0001){ x=1-Math.exp(-w0*t)*(1+w0*t); }
    else { const wd=w0*Math.sqrt(zeta*zeta-1);
      x=1-Math.exp(-zeta*w0*t)*(Math.cosh(wd*t)+(zeta*w0/wd)*Math.sinh(wd*t)); }
    out.push(x);
  }
  out[0]=0; out[N-1]=1;
  return out;
}
// unified CSS timing-function for either easing type
const easeCSS = e => e.type==="spring"
  ? "linear("+springSamples(e.spring).map(v=>+v.toFixed(4)).join(", ")+")"
  : bezStr(e.bez);
// short human label (the linear() string is too long to show inline)
const easeLabel = e => e.type==="spring"
  ? `spring ${e.spring.stiffness}/${e.spring.damping}`
  : bezStr(e.bez);
const distPx = name => { const d=distances.find(x=>x.name===name); return d?d.px:null; };
const resolve = it => { const b=bindOf(it); const e=easeObj(b.ease);
  const split = !!(b.effectsEase && b.effectsEase!==b.ease);
  const eff = split ? easeObj(b.effectsEase) : e;
  const dpx = b.distance ? distPx(b.distance) : null;
  return { d: durMs(b.dur)+"ms", e: easeCSS(e), eLabel: easeLabel(e), eEff: easeCSS(eff), split, s: +b.stagger||0, prop: b.prop||"all", distName: b.distance||"", distPx: dpx, reveal: (typeof b.reveal==="number") ? b.reveal : null, scrub: b.scrub ? {tl:b.scrub.tl||"view",range:b.scrub.range||"cover",fx:b.scrub.fx||"progress"} : null, vt: b.vt ? {type:b.vt.type||"root"} : null }; };
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
// pick the lens that best previews an intent's *defining* trait. Structural
// mechanics win first (only their lens can show them at all), then a named
// press/hover gesture, then sequence rhythm — else the flagship "everything"
// the general everyday default is the orb (its comet reads travel + easing, and
// its trailing echoes even show a spring's overshoot), so the bench spreads
// across lenses instead of collapsing to one. scope is the deliberate
// "inspect the curve / ride-dot" lens — it leads probe 0 but isn't a catch-all.
// Used for the *default* only; an explicit lens choice (probes[i].lensSet) wins.
function defaultLensFor(it){
  const r=resolve(it);
  if(r.scrub) return "scrub";                                   // scroll-linked → progress, not a clock
  if(r.vt) return "viewtransition";                             // DOM state swap
  if(r.reveal!=null) return "scrollreveal";                     // in-view reveal threshold
  if(r.prop==="height"||r.prop==="width") return "acc";         // layout reflow
  if(/\b(hover|press|tap|click|focus|toggle|button|ripple)\b/i.test(`${it.name||""} ${it.purpose||""}`)) return "button";
  if(r.s>0) return "cascade";                                   // a sequence → show its rhythm
  return "orb";                                                 // plain / spring / travel → the comet
}
// the mechanic lenses can't show a general intent (and vice-versa) — so a
// re-point only re-lenses when one of these is involved; scope/orb/cascade can
// show any plain/spring/staggered intent and are kept, preserving bench variety.
const SPECIALIST_LENS = new Set(["scrub","viewtransition","scrollreveal","acc","button"]);
// seed the bench: probe 0 leads on the flagship scope (the curve + ride-dot),
// the rest open in the lens that fits their intent — so the bench opens varied
// (scope · orb · orb · button for the default enter/exit/move/hover).
const SEED_INTENTS=[intents[0].id, intents[1].id, intents[2].id, intents[4].id];
probes = SEED_INTENTS.map((id,idx)=>({ kind: idx===0 ? "scope" : defaultLensFor(findIntent(id)), intent:id }));

// ---------- render: duration ladder ----------
const maxMs = () => Math.max(...durations.map(d=>d.ms));
function renderDurations(){
  const el=document.getElementById("durations");
  el.innerHTML = durations.map((d,i)=>{
    const mult = i>0 ? "×"+(d.ms/durations[i-1].ms).toFixed(2) : "";
    return `<div class="drow">
      <input class="drow__name" value="${d.name}" data-scope="dname" data-i="${i}" aria-label="duration name" spellcheck="false">
      <span class="drow__track"><input type="range" min="60" max="1000" step="10" value="${d.ms}" data-scope="dur" data-i="${i}" aria-label="${d.name} duration"></span>
      <span class="drow__val">${d.ms}ms</span>
      <span class="drow__mult">${mult}</span>
      ${durations.length>1?`<button class="drow__rm" data-scope="drm" data-i="${i}" title="remove step" aria-label="remove ${d.name}">×</button>`:""}
    </div>`;
  }).join("");
}

// ---------- render: distance scale (opt-in travel primitive) ----------
function renderDistances(){
  const el=document.getElementById("distances");
  if(el){
    el.innerHTML = distances.map((d,i)=>`<div class="drow">
      <input class="drow__name" value="${d.name}" data-scope="xname" data-i="${i}" aria-label="distance name" spellcheck="false">
      <span class="drow__track"><input type="range" min="0" max="1000" step="4" value="${d.px}" data-scope="xpx" data-i="${i}" aria-label="${d.name} distance"></span>
      <span class="drow__val">${d.px}px</span>
      ${distances.length>1?`<button class="drow__rm" data-scope="xrm" data-i="${i}" title="remove distance" aria-label="remove ${d.name}">×</button>`:""}
    </div>`).join("");
  }
  // sync the collapse chrome (the block is opt-in / collapsed by default)
  const wrap=document.getElementById("distanceWrap"), tog=document.getElementById("distToggle");
  if(wrap) wrap.hidden=!distOpen;
  if(tog){ tog.setAttribute("aria-expanded", distOpen?"true":"false");
    const chev=tog.querySelector(".block__chev"); if(chev) chev.textContent=distOpen?"▾":"▸"; }
}

// ---------- render: easing set (cubic = draggable bézier; spring = sliders) ----------
const BZPAD = 0.6;                         // vertical headroom so overshoot / bounce is visible
const SX = x => x*100;
const SY = y => (1-(y+BZPAD)/(1+2*BZPAD))*100;
function springPoints(sp){
  const s=springSamples(sp), N=s.length;
  return s.map((v,i)=>`${SX(i/(N-1)).toFixed(2)},${SY(v).toFixed(2)}`).join(" ");
}
function easingSVG(e){
  if(e.type==="spring"){
    return `<svg class="bz" viewBox="0 0 100 100">
      <line class="bz-guide" x1="${SX(0)}" y1="${SY(0)}" x2="${SX(1)}" y2="${SY(1)}"/>
      <polyline class="bz-curve" points="${springPoints(e.spring)}"/>
    </svg>`;
  }
  const [x1,y1,x2,y2]=e.bez;
  const p0=[SX(0),SY(0)],p3=[SX(1),SY(1)],c1=[SX(x1),SY(y1)],c2=[SX(x2),SY(y2)];
  return `<svg class="bz" viewBox="0 0 100 100">
    <line class="bz-guide" x1="${p0[0]}" y1="${p0[1]}" x2="${p3[0]}" y2="${p3[1]}"/>
    <line class="bz-arm" x1="${p0[0]}" y1="${p0[1]}" x2="${c1[0]}" y2="${c1[1]}"/>
    <line class="bz-arm" x1="${p3[0]}" y1="${p3[1]}" x2="${c2[0]}" y2="${c2[1]}"/>
    <path class="bz-curve" d="M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p3[0]},${p3[1]}"/>
    <circle class="bz-h" data-pt="1" cx="${c1[0]}" cy="${c1[1]}" r="7"/>
    <circle class="bz-h" data-pt="2" cx="${c2[0]}" cy="${c2[1]}" r="7"/>
  </svg>`;
}
// update a plot's SVG in place (keeps elements alive so a drag/slide isn't interrupted)
function updateEasingPlot(i){
  const e=easings[i]; if(e.type==="spring"){ updateSpringPlot(i); return; }
  const svg=document.querySelector(`.ecard__plot[data-i="${i}"] svg.bz`); if(!svg) return;
  const [x1,y1,x2,y2]=e.bez;
  const c1=[SX(x1),SY(y1)],c2=[SX(x2),SY(y2)],p0=[SX(0),SY(0)],p3=[SX(1),SY(1)];
  const arms=svg.querySelectorAll(".bz-arm");
  arms[0].setAttribute("x2",c1[0]); arms[0].setAttribute("y2",c1[1]);
  arms[1].setAttribute("x2",c2[0]); arms[1].setAttribute("y2",c2[1]);
  svg.querySelector(".bz-curve").setAttribute("d",`M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p3[0]},${p3[1]}`);
  const hs=svg.querySelectorAll(".bz-h");
  hs[0].setAttribute("cx",c1[0]); hs[0].setAttribute("cy",c1[1]);
  hs[1].setAttribute("cx",c2[0]); hs[1].setAttribute("cy",c2[1]);
}
function updateSpringPlot(i){
  const poly=document.querySelector(`.ecard__plot[data-i="${i}"] polyline.bz-curve`); if(!poly) return;
  poly.setAttribute("points", springPoints(easings[i].spring));
}
function renderEasings(){
  const el=document.getElementById("easings");
  el.innerHTML = easings.map((e,i)=>{
    let controls;
    if(e.type==="spring"){
      const sp=e.spring;
      controls = `<select data-scope="ease" data-i="${i}" aria-label="${e.name} type"><option value="spring" selected>spring</option>${Object.keys(PRESETS).map(k=>`<option>${k}</option>`).join("")}</select>
        <div class="ecard__spring">
          <label><span>Stiffness</span><b>${sp.stiffness}</b><input type="range" min="20" max="300" step="5" value="${sp.stiffness}" data-scope="sk" data-i="${i}" aria-label="stiffness"></label>
          <label><span>Damping</span><b>${sp.damping}</b><input type="range" min="2" max="40" step="1" value="${sp.damping}" data-scope="sd" data-i="${i}" aria-label="damping"></label>
        </div>`;
    } else {
      const match=Object.keys(PRESETS).find(k=>JSON.stringify(PRESETS[k])===JSON.stringify(e.bez));
      const opts=Object.keys(PRESETS).map(k=>`<option ${k===match?"selected":""}>${k}</option>`).join("");
      const custom=match?"":`<option value="custom" selected>custom</option>`;
      controls = `<select data-scope="ease" data-i="${i}" aria-label="${e.name} curve">${custom}${opts}<option value="spring">spring…</option></select>`;
    }
    return `<div class="ecard">
      <div class="ecard__top"><input class="ecard__name" value="${e.name}" data-scope="ename" data-i="${i}" aria-label="easing name" spellcheck="false">${easings.length>1?`<button class="ecard__rm" data-scope="erm" data-i="${i}" title="remove easing" aria-label="remove ${e.name}">×</button>`:""}</div>
      <div class="ecard__plot" data-i="${i}">${easingSVG(e)}</div>
      ${controls}
    </div>`;
  }).join("");
}

// ---------- render: modes (the global variant axis) ----------
function renderModes(){
  const el=document.getElementById("modes");
  if(!el) return;
  el.innerHTML = modes.map((m,i)=>{
    if(i===activeMode) return `<span class="mode active">
        <input class="mode__name" value="${m.name}" data-scope="mname" data-i="${i}" aria-label="mode name" spellcheck="false">
        ${modes.length>1?`<button class="mode__rm" data-scope="mrm" data-i="${i}" title="remove mode" aria-label="remove mode">×</button>`:""}
      </span>`;
    return `<button class="mode" data-scope="mset" data-i="${i}">${m.name}</button>`;
  }).join("") + `<button class="mode mode--add" data-scope="madd" title="add a mode (copies the current one)">+ mode</button>`
    + (modes.some(m=>m.name==="reduced") ? "" : `<button class="mode mode--reduced" data-scope="mreduced" title="add a reduced-motion mode (minimal, exported under prefers-reduced-motion)">+ reduced-motion</button>`);
}

// ---------- render: intents ----------
function renderIntents(){
  const el=document.getElementById("intents");
  el.innerHTML = intents.map((it,i)=>{
    const b=bindOf(it), r=resolve(it);
    const isSplit=!!b.effectsEase;
    const durF=`<div class="field"><label>Duration</label><select data-scope="idur" data-i="${i}">${durations.map(d=>`<option ${d.name===b.dur?"selected":""}>${d.name}</option>`).join("")}</select></div>`;
    const easeF=`<div class="field"><label>Easing${isSplit?" · spatial":""}</label><select data-scope="iease" data-i="${i}">${easings.map(e=>`<option ${e.name===b.ease?"selected":""}>${e.name}</option>`).join("")}</select></div>`;
    const stagF=`<div class="field field--stag"><label>Stagger·ms</label><input class="stag" type="number" min="0" max="400" step="5" value="${+b.stagger||0}" data-scope="istag" data-i="${i}" aria-label="stagger in ms"></div>`;
    const propF=`<div class="field"><label>Property</label><select data-scope="iprop" data-i="${i}">${PROPS.map(pp=>`<option ${pp===(b.prop||"all")?"selected":""}>${pp}</option>`).join("")}</select></div>`;
    const distF=`<div class="field"><label>Distance</label><select data-scope="idist" data-i="${i}"><option value="" ${!b.distance?"selected":""}>none</option>${distances.map(d=>`<option ${d.name===b.distance?"selected":""}>${d.name}</option>`).join("")}</select></div>`;
    const effF=isSplit?`<div class="field"><label>Easing · effects</label><select data-scope="ieff" data-i="${i}">${easings.map(e=>`<option ${e.name===b.effectsEase?"selected":""}>${e.name}</option>`).join("")}</select></div>`:"";
    const isReveal=typeof b.reveal==="number", scrub=b.scrub||null, scrollOn=isReveal||!!scrub;
    // scroll-driven: reveal (plays once on entry) OR scrub (follows scroll position)
    const modeF=scrollOn?`<div class="field"><label>Scroll</label><select data-scope="iscrollmode" data-i="${i}"><option value="reveal" ${!scrub?"selected":""}>reveal · on entry</option><option value="scrub" ${scrub?"selected":""}>scrub · follow</option></select></div>`:"";
    const revF=(scrollOn&&!scrub)?`<div class="field field--stag"><label>Reveal·%</label><input class="stag" type="number" min="0" max="100" step="5" value="${b.reveal}" data-scope="irevat" data-i="${i}" aria-label="reveal trigger, percent in view"></div>`:"";
    const tlF=scrub?`<div class="field"><label>Timeline</label><select data-scope="iscrubtl" data-i="${i}">${SCRUB_TL.map(v=>`<option ${v===scrub.tl?"selected":""}>${v}</option>`).join("")}</select></div>`:"";
    const rangeF=(scrub&&scrub.tl!=="scroll")?`<div class="field"><label>Range</label><select data-scope="iscrubrange" data-i="${i}">${SCRUB_RANGE.map(v=>`<option ${v===scrub.range?"selected":""}>${v}</option>`).join("")}</select></div>`:"";
    const fxF=scrub?`<div class="field"><label>Effect</label><select data-scope="iscrubfx" data-i="${i}">${SCRUB_FX.map(v=>`<option ${v===scrub.fx?"selected":""}>${v}</option>`).join("")}</select></div>`:"";
    const vt=b.vt||null;
    const vtTypeF=vt?`<div class="field"><label>VT kind</label><select data-scope="ivttype" data-i="${i}">${VT_TYPE.map(v=>`<option ${v===vt.type?"selected":""}>${v}</option>`).join("")}</select></div>`:"";
    const splitT=`<label class="intent__split"><input type="checkbox" data-scope="isplit" data-i="${i}" ${isSplit?"checked":""}> split spatial · effects (position vs colour/opacity)</label>`;
    const revT=`<label class="intent__split"><input type="checkbox" data-scope="ireveal" data-i="${i}" ${scrollOn?"checked":""}> scroll-driven · reacts as it scrolls (reveal once, or scrub with position)</label>`;
    const vtT=`<label class="intent__split"><input type="checkbox" data-scope="ivt" data-i="${i}" ${vt?"checked":""}> view transition · animates DOM state swaps (nav, toggles)</label>`;
    const adv = it.open ? `<div class="intent__adv"><div class="intent__ref">${stagF}${propF}${distF}${effF}${modeF}${revF}${tlF}${rangeF}${fxF}${vtTypeF}</div>${splitT}${revT}${vtT}</div>` : "";
    return `<div class="intent" data-id="${it.id}">
      <div class="intent__top">
        <span class="intent__dot" style="background:${colorOf(i)}" aria-hidden="true"></span>
        <input class="intent__name" value="${it.name}" data-scope="iname" data-i="${i}" aria-label="intent name">
        <span class="intent__purpose">${it.purpose||""}</span>
        ${intents.length>1?`<button class="intent__rm" data-scope="irm" data-i="${i}" title="remove" aria-label="remove intent">×</button>`:""}
      </div>
      <div class="intent__ref">${durF}${easeF}</div>
      ${adv}
      <div class="intent__foot">
        <button class="intent__more" data-scope="imore" data-i="${i}" aria-expanded="${!!it.open}">${it.open?"less ▴":"more ▾"}</button>
        <span class="intent__resolved">→ ${r.d} · ${r.eLabel}${r.s?` · stagger ${r.s}ms`:""}${r.prop!=="all"?` · ${r.prop}`:""}${r.distName?` · ${r.distPx}px`:""}${r.reveal!=null?` · reveal@${r.reveal}%`:""}${r.scrub?` · scrub·${r.scrub.tl}/${r.scrub.fx}`:""}${r.vt?` · vt·${r.vt.type}`:""}</span>
      </div>
    </div>`;
  }).join("");
}

// ---------- render: bench ----------
function renderBench(){
  const el=document.getElementById("bench");
  el.innerHTML = probes.map((p,i)=>{
    if(!KINDS.some(k=>k.k===p.kind)) p.kind="orb";   // retired lens in an old link → fall back
    const opts = intents.map(it=>`<option value="${it.id}" ${it.id===p.intent?"selected":""}>${it.name}</option>`).join("");
    const kinds = KINDS.map(kd=>`<option value="${kd.k}" ${kd.k===p.kind?"selected":""}>${kd.label}</option>`).join("");
    const ii = intents.findIndex(x=>x.id===p.intent);   // colour the probe by its intent
    const color = colorOf(ii<0?0:ii);
    let stage="";
    if(p.kind==="scope"){
      const eo=easeObj(bindOf(findIntent(p.intent)).ease);
      let curve;
      if(eo.type==="spring") curve=`<polyline points="${springPoints(eo.spring)}"/>`;
      else { const [x1,y1,x2,y2]=eo.bez; curve=`<path d="M${SX(0)},${SY(0)} C${SX(x1)},${SY(y1)} ${SX(x2)},${SY(y2)} ${SX(1)},${SY(1)}"/>`; }
      stage=`<div class="scope">
        <div class="scope__graph"><svg class="scope__curve" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${SX(0)}" y1="${SY(0)}" x2="${SX(1)}" y2="${SY(1)}"/>${curve}</svg><div class="scope__head"></div><div class="scope__ride" style="left:${SX(0)}%;top:${SY(0)}%"></div></div>
        <div class="scope__demo">${'<span class="scope__dot"></span>'.repeat(SCOPE_N)}</div>
      </div>`;
    }
    if(p.kind==="orb"){
      // comet lens: an opaque head + a fading trail. The head leads; each echo
      // lags a little, so the trail stretches where the token moves fast —
      // easing you can see. Echoes fade + shrink toward the tail.
      let echoes="";
      for(let i=1;i<=ORB_TRAIL;i++){ const t=i/ORB_TRAIL;
        echoes+=`<i class="orb-echo" style="opacity:${(0.52*(1-t*0.72)).toFixed(3)};transform:scale(${(1-0.42*t).toFixed(2)})"></i>`; }
      stage=`<span class="orb-base"></span><span class="orb-track"><span class="orb-rail"><div class="orb"></div>${echoes}</span></span>`;
    }
    if(p.kind==="cascade"){
      const rr=resolve(findIntent(p.intent)), dms=parseInt(rr.d)||200, st=rr.s|0;
      const total=Math.max(1,(CASC_N-1)*st+dms);
      let lanes="";
      for(let k=0;k<CASC_N;k++){
        const left=(k*st)/total*100, w=Math.max(5,dms/total*100);
        lanes+=`<div class="casc__lane"><div class="casc__bar" style="left:${left.toFixed(2)}%;width:${w.toFixed(2)}%"><i class="casc__fill"></i></div></div>`;
      }
      stage=`<div class="casc"><div class="casc__lanes">${lanes}<div class="casc__head"></div></div></div>`;
    }
    if(p.kind==="button") stage=`<div class="btnpad">Hover me</div>`;
    if(p.kind==="acc") stage=`<div class="acc"><div class="acc__hd">Details <span class="chev">⌄</span></div><div class="acc__body"><p>Height and chevron ride the same token, so the change feels like one gesture.</p></div></div>`;
    if(p.kind==="scrollreveal"){
      // a real scroll box: cards start below the fold and reveal as they cross
      // the intent's trigger threshold (via IntersectionObserver, so it's the
      // genuine in-view behaviour — the honest counterpart to native view())
      const rr=resolve(findIntent(p.intent));
      const at=rr.reveal!=null?rr.reveal:15;
      stage=`<div class="sreveal" data-at="${at}"><div class="sreveal__scroll">`
        +`<div class="sr-pad"></div>`
        +'<span class="sr-card"></span>'.repeat(5)
        +`<div class="sr-pad"></div></div><span class="sreveal__cue">scroll ↓</span></div>`;
    }
    if(p.kind==="scrub"){
      // a real scroll box whose target scrubs to the box's scroll position —
      // the honest counterpart to native scroll() (progress = position, no clock)
      const sc=resolve(findIntent(p.intent)).scrub||SCRUB_DEFAULT;
      stage=`<div class="scrubx" data-fx="${sc.fx}"><div class="scrubx__scroll">`
        +`<div class="sr-pad"></div><div class="sr-pad"></div></div>`
        +`<div class="scrubx__target scrubx__target--${sc.fx}"></div><span class="sreveal__cue">scroll ↓</span></div>`;
    }
    if(p.kind==="viewtransition"){
      // a simulated state swap — a real startViewTransition() would snapshot the
      // whole page, so this mimics the old→new cross-fade / shared morph with
      // plain transitions timed by the intent's token (click to replay)
      const ty=(resolve(findIntent(p.intent)).vt||VT_DEFAULT).type;
      stage=ty==="shared"
        ? `<div class="vt vt--shared"><span class="vt__morph"></span><span class="vt__cue">state swap ↻ (simulated)</span></div>`
        : `<div class="vt vt--root"><span class="vt__old"></span><span class="vt__new"></span><span class="vt__cue">state swap ↻ (simulated)</span></div>`;
    }
    return `<div class="probe" data-i="${i}" style="--accent:${color}">
      <div class="probe__hd">
        <select class="probe__kind" data-scope="pkind" data-i="${i}" aria-label="lens">${kinds}</select>
        <select class="probe__sel" data-scope="probe" data-i="${i}" aria-label="intent">${opts}</select>
      </div>
      <div class="probe__stage" data-play="${i}">${stage}</div>
    </div>`;
  }).join("");
  // the button lens is a hover/press gesture — make "Hover me" honest (it also
  // replays on click, like every lens, via the [data-play] handler)
  el.querySelectorAll(".btnpad").forEach(b=>b.addEventListener("mouseenter",()=>{
    const pr=b.closest("[data-play]"); if(pr) play(+pr.dataset.play);
  }));
  armScrollReveals();
}

// scroll-reveal lens: attach a scoped IntersectionObserver so cards reveal as
// they cross the intent's threshold inside their own scroll box. Re-armed on
// every renderBench (old boxes are replaced, so their observers fall away).
function armScrollReveal(pr){
  const box=pr.querySelector(".sreveal"); if(!box) return;
  const i=+pr.dataset.i, r=resolve(findIntent(probes[i].intent));
  const scroll=box.querySelector(".sreveal__scroll");
  const cards=[...box.querySelectorAll(".sr-card")];
  const travel=Math.max(8,Math.min(40, r.distPx!=null?r.distPx:16));
  if(reduce){ cards.forEach(c=>{c.style.opacity="1";c.style.transform="none";c.style.transition="none";}); return; }
  cards.forEach(c=>{ c.style.transition="none"; c.style.opacity="0"; c.style.transform=`translateY(${travel}px)`; });
  void box.offsetWidth;
  const at=Math.max(0.01,Math.min(1,(+box.dataset.at||15)/100));
  // each card reveals on its own timeline — in-view reveal is per-item, so
  // stagger (a list concept) deliberately doesn't apply here
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){
    const c=e.target;
    c.style.transition=`opacity ${r.d} ${r.eEff||r.e}, transform ${r.d} ${r.e}`;
    c.style.opacity="1"; c.style.transform="none"; io.unobserve(c);
  }}),{root:scroll,threshold:at});
  cards.forEach(c=>io.observe(c));
}
// scrub lens: map the box's own scroll position (0→1) to the target's property,
// so the effect follows the scroll rather than a clock — native scroll() in miniature
function armScrub(pr){
  const box=pr.querySelector(".scrubx"); if(!box) return;
  const scroll=box.querySelector(".scrubx__scroll"), target=box.querySelector(".scrubx__target");
  if(!scroll||!target) return;
  const fx=box.dataset.fx;
  const set=p=>{
    if(fx==="progress"){ target.style.transform=`scaleX(${p})`; }
    else if(fx==="parallax"){ target.style.transform=`translateY(${(20-40*p).toFixed(1)}px)`; }
    else { target.style.opacity=String(p); }
  };
  if(reduce){ set(1); return; }
  const apply=()=>{ const max=scroll.scrollHeight-scroll.clientHeight; set(max>0?scroll.scrollTop/max:0); };
  scroll.addEventListener("scroll",apply,{passive:true});
  apply();
}
function armScrollReveals(){ document.querySelectorAll(".probe").forEach(pr=>{ armScrollReveal(pr); armScrub(pr); }); }

// ---------- animation ----------
function anim(el,props,r,delay=0){
  el.style.transition="none"; void el.offsetWidth;
  el.style.transition=Object.keys(props).map(p=>`${p} ${r.d} ${r.e} ${delay}ms`).join(", ");
  requestAnimationFrame(()=>{ for(const p in props) el.style[p]=props[p]; });
}
function play(i){
  const p=probes[i], r=resolve(findIntent(p.intent));
  const root=document.querySelector(`.probe[data-i="${i}"]`);
  if(p.kind==="scope"){
    // everything lens: curve + playhead (time), plus staggered demo elements whose
    // actual property animates with the token's easing/spring (bounce shows natively)
    const dms=parseInt(r.d)||200, st=r.s|0, total=Math.max(1,(SCOPE_N-1)*st+dms);
    const head=root.querySelector(".scope__head");
    const ride=root.querySelector(".scope__ride");
    const dots=[...root.querySelectorAll(".scope__dot")];
    const a=SCOPE_ANIM[r.prop]||SCOPE_ANIM.all;
    const set=(el,o)=>{ for(const kk in o) el.style[kk]=o[kk]; };
    if(head){ head.style.transition="none"; head.style.left="0%"; head.style.opacity="1"; }
    // ride dot starts at the curve's origin; left is linear time, top is the eased
    // value — since SY is affine, top eased by the token traces the drawn curve,
    // overshooting for a spring (the missing spring preview)
    if(ride){ ride.style.transition="none"; ride.style.left=SX(0)+"%"; ride.style.top=SY(0)+"%"; ride.style.opacity="1"; }
    dots.forEach(d=>{ d.style.transition="none"; set(d,a.before); });
    void root.offsetWidth;
    if(head) head.style.transition=`left ${total}ms linear`;
    if(ride) ride.style.transition=`left ${r.d} linear, top ${r.d} ${r.e}`;
    const easeFor=pr=>/(opacity|color)/.test(pr)?r.eEff:r.e;   // effects vs spatial when split
    dots.forEach((d,k)=>{ d.style.transition=a.props.map(pr=>`${pr} ${r.d} ${easeFor(pr)} ${k*st}ms`).join(", "); });
    requestAnimationFrame(()=>{ if(head) head.style.left="100%"; if(ride){ ride.style.left=SX(1)+"%"; ride.style.top=SY(1)+"%"; } dots.forEach(d=>set(d,a.after)); });
    setTimeout(()=>{ if(head){ head.style.transition="opacity 250ms"; head.style.opacity="0"; } if(ride){ ride.style.transition="opacity 250ms"; ride.style.opacity="0"; } }, total+80);
  }
  if(p.kind==="cascade"){
    // timeline lens: each lane fills at its staggered start; a playhead sweeps time
    const dms=parseInt(r.d)||200, st=r.s|0, total=Math.max(1,(CASC_N-1)*st+dms);
    const fills=[...root.querySelectorAll(".casc__fill")], head=root.querySelector(".casc__head");
    fills.forEach(f=>{ f.style.transition="none"; f.style.transform="scaleX(0)"; });
    if(head){ head.style.transition="none"; head.style.left="0%"; head.style.opacity="1"; }
    void root.offsetWidth;
    fills.forEach((f,k)=>{ f.style.transition=`transform ${r.d} ${r.e} ${k*st}ms`; });
    if(head) head.style.transition=`left ${total}ms linear`;
    requestAnimationFrame(()=>{ fills.forEach(f=>f.style.transform="scaleX(1)"); if(head) head.style.left="100%"; });
    setTimeout(()=>{ if(head){ head.style.transition="opacity 250ms"; head.style.opacity="0"; } }, total+80);
  }
  if(p.kind==="orb"){
    // comet lens: the head leads, each echo lags i*step ms, so the trail
    // stretches through the fast part of the easing and retracts at the ends.
    const rail=root.querySelector(".orb-rail");
    const dots=[...rail.querySelectorAll(".orb, .orb-echo")]; // head first, then echoes
    const START="14px", END="calc(100% - 40px)", step=Math.max(9,(parseInt(r.d)||200)/15);
    const setTrans=()=>dots.forEach((el,i)=>{ el.style.transition=`left ${r.d} ${r.e} ${i*step}ms`; });
    dots.forEach(el=>{ el.style.transition="none"; el.style.left=START; });
    void rail.offsetWidth; setTrans();
    requestAnimationFrame(()=>dots.forEach(el=>el.style.left=END));
    setTimeout(()=>{ setTrans(); requestAnimationFrame(()=>dots.forEach(el=>el.style.left=START)); },1400);
  }
  if(p.kind==="button"){
    const b=root.querySelector(".btnpad");
    b.style.transform="translate(-50%,-50%) scale(1)";
    anim(b,{transform:"translate(-50%,-50%) scale(1.14)"},r);
    setTimeout(()=>anim(b,{transform:"translate(-50%,-50%) scale(1)"},r),900);
  }
  if(p.kind==="acc"){
    const b=root.querySelector(".acc__body"),c=root.querySelector(".chev");
    b.style.transition=`height ${r.d} ${r.e}`;c.style.transition=`transform ${r.d} ${r.e}`;
    b.style.height="0px";c.style.transform="rotate(0deg)";
    requestAnimationFrame(()=>{b.style.height=b.scrollHeight+"px";c.style.transform="rotate(180deg)";});
    setTimeout(()=>{b.style.height="0px";c.style.transform="rotate(0deg)";},1500);
  }
  if(p.kind==="scrollreveal"){
    // replay: scroll back to the top and re-arm, so the reveals re-fire on scroll
    const sc=root.querySelector(".sreveal__scroll"); if(sc) sc.scrollTop=0;
    armScrollReveal(root);
  }
  if(p.kind==="scrub"){
    // replay: scroll back to the top; the target scrubs as you scroll again
    const sc=root.querySelector(".scrubx__scroll"); if(sc) sc.scrollTop=0;
    armScrub(root);
  }
  if(p.kind==="viewtransition"){
    const ty=(r.vt||VT_DEFAULT).type;
    if(ty==="shared"){
      const m=root.querySelector(".vt__morph"); if(!m) return;
      m.style.transition="none"; m.classList.remove("b"); void m.offsetWidth;
      m.style.transition=`left ${r.d} ${r.e}, top ${r.d} ${r.e}, width ${r.d} ${r.e}, height ${r.d} ${r.e}`;
      requestAnimationFrame(()=>m.classList.add("b"));
      setTimeout(()=>{ m.classList.remove("b"); },1500);
    } else {
      const o=root.querySelector(".vt__old"), n=root.querySelector(".vt__new"); if(!o||!n) return;
      const reset=()=>{ o.style.transition="none";n.style.transition="none"; o.style.opacity="1";o.style.transform="scale(1)"; n.style.opacity="0";n.style.transform="scale(1.04)"; };
      reset(); void root.offsetWidth;
      const tr=`opacity ${r.d} ${r.e}, transform ${r.d} ${r.e}`;
      o.style.transition=tr; n.style.transition=tr;
      requestAnimationFrame(()=>{ o.style.opacity="0";o.style.transform="scale(.98)"; n.style.opacity="1";n.style.transform="scale(1)"; });
      setTimeout(reset,1600);
    }
  }
}
function playAll(){ probes.forEach((_,i)=>setTimeout(()=>play(i), i*130)); }
// keep the bench alive: after the intro, gently rotate through the probes so
// one is always in motion (a motion tool that sits frozen reads as dead). One
// at a time, calm cadence; skipped for reduced-motion and when off-screen.
let benchIdle=null, benchRot=0;
function startBenchIdle(){
  if(reduce || benchIdle) return;
  benchIdle=setInterval(()=>{
    if(document.hidden || mode!=="tool" || document.body.classList.contains("previewing")) return;
    for(let n=0;n<probes.length;n++){                     // next probe with visible motion
      const idx=(benchRot++)%probes.length, k=probes[idx].kind;
      if(k!=="scrollreveal" && k!=="scrub"){ play(idx); break; }
    }
  }, 2600);
}

// ---------- system read (the opinion layer) ----------
function critique(){
  const out=[];
  // 1. ladder evenness
  const ratios = durations.slice(1).map((d,i)=>d.ms/durations[i].ms);
  const spread = Math.max(...ratios)/Math.min(...ratios);
  if(spread>1.9) out.push(["warn","~",`Your duration ladder is uneven — step ratios run ${Math.min(...ratios).toFixed(2)}× to ${Math.max(...ratios).toFixed(2)}×. A ladder that grows at a steadier rate feels more like one scale.`]);
  else out.push(["ok","✓","Duration ladder grows at a fairly even rate — it reads as one considered scale."]);
  // 2. easing redundancy
  let dup=null;
  for(let a=0;a<easings.length;a++)for(let b=a+1;b<easings.length;b++){
    const ea=easings[a],eb=easings[b];
    if(!ea.bez||!eb.bez) continue;   // redundancy check compares cubic curves only
    const d=ea.bez.reduce((s,v,k)=>s+Math.abs(v-eb.bez[k]),0);
    if(d<0.15) dup=[ea.name,eb.name];
  }
  if(dup) out.push(["warn","!",`“${dup[0]}” and “${dup[1]}” are nearly identical curves. A tight easing set is easier to apply consistently — trim one.`]);
  else out.push(["ok","✓",`${easings.length} distinct easings — a lean, legible set.`]);
  // 3. enter/exit asymmetry
  const en=intents.find(x=>/enter|open|in$/i.test(x.name)), ex=intents.find(x=>/exit|close|out$/i.test(x.name));
  if(en&&ex){
    const de=durMs(bindOf(en).dur),dx=durMs(bindOf(ex).dur);
    if(Math.abs(de-dx)<40) out.push(["warn","≠",`“${en.name}” and “${ex.name}” resolve to near-equal durations (${de}/${dx}ms). Real motion is asymmetric — exits should be quicker so leaving feels decisive.`]);
    else if(dx<de) out.push(["ok","✓",`“${ex.name}” (${dx}ms) is quicker than “${en.name}” (${de}ms) — leaving feels decisive.`]);
    else out.push(["warn","!",`“${ex.name}” (${dx}ms) is slower than “${en.name}” (${de}ms). The user already chose to dismiss; a slow exit drags.`]);
  }
  // 4. long-duration budget
  const longIntent = intents.find(x=>durMs(bindOf(x).dur)>550);
  if(longIntent) out.push(["warn","!",`“${longIntent.name}” resolves to ${durMs(bindOf(longIntent).dur)}ms. Past ~550ms motion starts to feel like waiting — reserve the top of the ladder for large travel only.`]);
  // 5. stagger budget (measured against a 5-item list)
  const staggered = intents.filter(x=>+bindOf(x).stagger>0).sort((a,b)=>+bindOf(b).stagger-+bindOf(a).stagger)[0];
  if(staggered){ const st=+bindOf(staggered).stagger, lead=st*4;
    if(lead>500) out.push(["warn","!",`“${staggered.name}” staggers ${st}ms — across a 5-item list the last item waits ${lead}ms to even start. Long staggers make lists drag; keep the lead under ~500ms.`]);
    else out.push(["ok","✓",`“${staggered.name}” staggers ${st}ms — a 5-item list cascades over ${lead}ms, brisk enough to read as one gesture.`]);
  }
  // 6. spatial/effects split that hasn't diverged is just noise
  const idleSplit = intents.find(x=>{ const b=bindOf(x); return b.effectsEase && b.effectsEase===b.ease; });
  if(idleSplit) out.push(["warn","!",`“${idleSplit.name}” is split into spatial · effects but both use the same easing. Diverge them (e.g. a spring for position, a flat curve for opacity) or collapse the split.`]);
  // 7. distance / velocity — only when an intent opts into a travel distance
  const withDist = intents.map(x=>{ const b=bindOf(x); if(!b.distance) return null;
    const px=distPx(b.distance); if(px==null) return null;
    const ms=durMs(b.dur); return {name:x.name, px, ms, v:px/Math.max(1,ms)}; }).filter(Boolean);
  if(withDist.length){
    const fast=withDist.slice().sort((a,b)=>b.v-a.v)[0];
    const slow=withDist.slice().sort((a,b)=>a.v-b.v)[0];
    if(fast.v>5) out.push(["warn","!",`“${fast.name}” covers ${fast.px}px in ${fast.ms}ms — that's ${fast.v.toFixed(1)}px/ms, fast enough to read as a jump rather than a move. Slow it down or shorten the travel.`]);
    else if(slow.v<0.4 && slow.px>=64) out.push(["warn","~",`“${slow.name}” crawls ${slow.px}px over ${slow.ms}ms (${slow.v.toFixed(2)}px/ms). Long, slow travel reads as sluggish — tighten the duration or the distance.`]);
    else out.push(["ok","✓",`Travel speeds read naturally — “${fast.name}” moves ${fast.px}px in ${fast.ms}ms (${fast.v.toFixed(1)}px/ms), in the range the eye tracks as motion.`]);
  }
  // 8. scroll reveals — only when an intent opts in (keeps the default read quiet)
  const revIntents = intents.filter(x=>typeof bindOf(x).reveal==="number");
  if(revIntents.length){
    const staggered = revIntents.find(x=>+bindOf(x).stagger>0);
    if(staggered) out.push(["warn","~",`“${staggered.name}” is a scroll reveal carrying a ${+bindOf(staggered).stagger}ms stagger. Native scroll-driven gives each item its own timeline, so the stagger only lands in the JS fallback — the two paths won't look identical. Drop the stagger, or accept the split.`]);
    else out.push(["ok","✓",`${revIntents.length} scroll reveal${revIntents.length>1?"s":""} — exported as native CSS scroll-driven with an IntersectionObserver fallback for browsers without it (Firefox today).`]);
  }
  // 9. scroll scrubs — flag non-linear easing (scrub speed then fights the scroll)
  const scrubIntents = intents.filter(x=>bindOf(x).scrub);
  if(scrubIntents.length){
    const isLin=e=>e.bez && Math.abs(e.bez[0])<.05 && Math.abs(e.bez[1])<.05 && Math.abs(e.bez[2]-1)<.05 && Math.abs(e.bez[3]-1)<.05;
    const nonLin = scrubIntents.find(x=>!isLin(easeObj(bindOf(x).ease)));
    if(nonLin) out.push(["warn","~",`“${nonLin.name}” scrubs with a non-linear easing — the motion speeds up and slows down against your scroll. That reads as intentional for a reveal-style scrub, but parallax/progress usually want a linear curve for a true 1:1 feel.`]);
    else out.push(["ok","✓",`${scrubIntents.length} scroll scrub${scrubIntents.length>1?"s":""} — native scroll-driven (no duration; the range is the axis) with a scroll-position fallback for browsers without it.`]);
  }
  // 10. view transitions — opt-in; VT's only knobs are duration + easing
  const vtIntents = intents.filter(x=>bindOf(x).vt);
  if(vtIntents.length){
    out.push(["ok","✓",`${vtIntents.length} view transition${vtIntents.length>1?"s":""} — same-document VT is Baseline (Chrome/Edge 111+, Safari 18+, Firefox 144+). The recipe feature-detects startViewTransition and honours reduced-motion, so unsupported browsers just swap instantly.`]);
  }
  document.getElementById("hints").innerHTML = out.map(h=>`<div class="rd ${h[0]}"><span class="ic">${h[1]}</span><span>${h[2]}</span></div>`).join("");
  // a persistent read-at-a-glance badge in the section header (P3 visibility)
  const warns=out.filter(h=>h[0]==="warn").length;
  const badge=document.getElementById("hintCount");
  if(badge){ badge.textContent = warns ? `${warns} to review` : "all clear"; badge.className = "hintcount"+(warns?" warn":""); }
}

// ---------- export ----------
let fmt="css";
const isIdent = k => /^[a-z_$][\w$]*$/i.test(k);   // safe as a bare object key?
// with >1 mode, exports reflect the active mode (noted in a comment/field).
const modeNote = () => modes.length>1 ? ` · mode: ${modes[activeMode].name}` : "";
// CSS keeps syntax-highlight spans (innerHTML); the rest are plain text.
function buildCSS(){
  let s=`<span class="cm">/* Cadence — motion system */</span>\n:root{\n`;
  s+=`  <span class="cm">/* primitives · durations */</span>\n`;
  durations.forEach(d=>s+=`  <span class="tk">--motion-duration-${d.name}</span>: ${d.ms}ms;\n`);
  const hasSpring=easings.some(e=>e.type==="spring");
  s+=`\n  <span class="cm">/* primitives · easing${hasSpring?" (linear() = sampled spring; needs a 2023+ browser)":""} */</span>\n`;
  easings.forEach(e=>{
    s+=`  <span class="tk">--motion-ease-${e.name}</span>: ${easeCSS(e)};\n`;
    if(e.type==="spring") s+=`  <span class="cm">/* fallback: --motion-ease-${e.name}: cubic-bezier(0.34, 1.4, 0.5, 1); */</span>\n`;
  });
  // distance primitives only when an intent references them (opt-in scale)
  const usedDist=[...new Set(intents.map(it=>bindOf(it).distance).filter(Boolean))];
  if(usedDist.length){
    s+=`\n  <span class="cm">/* primitives · distance (travel) */</span>\n`;
    distances.filter(d=>usedDist.includes(d.name)).forEach(d=>s+=`  <span class="tk">--motion-distance-${d.name}</span>: ${d.px}px;\n`);
  }
  s+=`\n  <span class="cm">/* semantic · intents → reference primitives${modeNote()} */</span>\n`;
  intents.forEach(it=>{ const b=bindOf(it);
    s+=`  <span class="tk2">--motion-${it.name}-duration</span>: <span class="tk">var(--motion-duration-${b.dur})</span>;\n`;
    s+=`  <span class="tk2">--motion-${it.name}-ease</span>: <span class="tk">var(--motion-ease-${b.ease})</span>;\n`;
    if(+b.stagger>0) s+=`  <span class="tk2">--motion-${it.name}-stagger</span>: ${+b.stagger}ms;\n`;
    if(b.distance) s+=`  <span class="tk2">--motion-${it.name}-distance</span>: <span class="tk">var(--motion-distance-${b.distance})</span>;\n`;
    // composite transition shorthand: property + duration + easing (+ delay)
    const delay = +b.stagger>0 ? ` ${+b.stagger}ms` : "";
    s+=`  <span class="tk2">--motion-${it.name}</span>: ${b.prop||"all"} <span class="tk">var(--motion-${it.name}-duration)</span> <span class="tk">var(--motion-${it.name}-ease)</span>${delay};\n`;
    // spatial vs effects: a second easing + composite for colour/opacity
    if(b.effectsEase && b.effectsEase!==b.ease){
      s+=`  <span class="tk2">--motion-${it.name}-effects-ease</span>: <span class="tk">var(--motion-ease-${b.effectsEase})</span>;\n`;
      s+=`  <span class="tk2">--motion-${it.name}-effects</span>: opacity <span class="tk">var(--motion-${it.name}-duration)</span> <span class="tk">var(--motion-${it.name}-effects-ease)</span>${delay};\n`;
    }
  });
  // a "reduced" mode exports as an OS-honoring override block
  const rmi=modes.findIndex(m=>m.name==="reduced");
  let rb="";
  if(rmi>=0){
    rb=`\n\n<span class="cm">/* honor OS reduced-motion */</span>\n@media (prefers-reduced-motion: reduce){\n  :root{\n`;
    intents.forEach(it=>{ const b=it.binds[Math.min(rmi,it.binds.length-1)]||it.binds[0];
      const delay=+b.stagger>0?` ${+b.stagger}ms`:"";
      rb+=`    <span class="tk2">--motion-${it.name}</span>: ${b.prop||"all"} <span class="tk">var(--motion-duration-${b.dur})</span> <span class="tk">var(--motion-ease-${b.ease})</span>${delay};\n`;
    });
    rb+=`  }\n}`;
  }
  return s+`}`+rb;
}
function buildJSON(){
  const obj={primitives:{duration:{},easing:{}},semantic:{}};
  if(modes.length>1) obj.mode=modes[activeMode].name;
  durations.forEach(d=>obj.primitives.duration[d.name]=d.ms+"ms");
  easings.forEach(e=>obj.primitives.easing[e.name]=easeCSS(e));
  const usedD=[...new Set(intents.map(it=>bindOf(it).distance).filter(Boolean))];
  if(usedD.length){ obj.primitives.distance={}; distances.filter(d=>usedD.includes(d.name)).forEach(d=>obj.primitives.distance[d.name]=d.px+"px"); }
  intents.forEach(it=>{ const b=bindOf(it); const v={duration:`{duration.${b.dur}}`,easing:`{easing.${b.ease}}`,purpose:it.purpose};
    if(b.effectsEase&&b.effectsEase!==b.ease) v.effectsEasing=`{easing.${b.effectsEase}}`;
    if(b.prop&&b.prop!=="all") v.property=b.prop;
    if(b.distance) v.distance=`{distance.${b.distance}}`;
    if(+b.stagger>0) v.stagger=(+b.stagger)+"ms"; obj.semantic[it.name]=v; });
  return JSON.stringify(obj,null,2);
}
function buildTailwind(){
  const q=JSON.stringify;
  const dur=[...durations.map(d=>`        ${q(d.name)}: ${q(d.ms+"ms")},`),
             ...intents.map(it=>`        ${q(it.name)}: ${q(durMs(bindOf(it).dur)+"ms")}, // intent`)];
  const ease=[...easings.map(e=>`        ${q(e.name)}: ${q(easeCSS(e))},`),
              ...intents.map(it=>`        ${q(it.name)}: ${q(easeCSS(easeObj(bindOf(it).ease)))}, // intent`)];
  const stag=intents.filter(it=>+bindOf(it).stagger>0)
    .map(it=>`        ${q(it.name)}: ${q((+bindOf(it).stagger)+"ms")}, // per-item stagger`);
  const delayBlock = stag.length ? `      transitionDelay: {\n${stag.join("\n")}\n      },\n` : "";
  const prop=intents.filter(it=>{ const p=bindOf(it).prop; return p&&p!=="all"; })
    .map(it=>`        ${q(it.name)}: ${q(bindOf(it).prop)}, // intent`);
  const propBlock = prop.length ? `      transitionProperty: {\n${prop.join("\n")}\n      },\n` : "";
  return `// tailwind.config.js — motion tokens from Cadence${modeNote()}\n`+
    `module.exports = {\n  theme: {\n    extend: {\n`+
    `      transitionDuration: {\n${dur.join("\n")}\n      },\n`+
    `      transitionTimingFunction: {\n${ease.join("\n")}\n      },\n`+
    propBlock+delayBlock+
    `    },\n  },\n};`;
}
function buildStyleDictionary(){
  const obj={motion:{duration:{},easing:{}}};
  durations.forEach(d=>obj.motion.duration[d.name]={value:d.ms+"ms",type:"duration"});
  easings.forEach(e=>obj.motion.easing[e.name]={value:easeCSS(e),type:e.type==="spring"?"other":"cubicBezier"});
  intents.forEach(it=>{ const b=bindOf(it); const t={
    duration:{value:`{motion.duration.${b.dur}}`,type:"duration"},
    easing:{value:`{motion.easing.${b.ease}}`,type:"cubicBezier"},
  }; if(b.prop&&b.prop!=="all") t.property={value:b.prop,type:"other"};
    if(b.distance){ const px=distPx(b.distance); if(px!=null) t.distance={value:px+"px",type:"dimension"}; }
    if(+b.stagger>0) t.stagger={value:(+b.stagger)+"ms",type:"duration"}; obj.motion[it.name]=t; });
  return JSON.stringify(obj,null,2);
}
function buildTS(){
  const key=k=>isIdent(k)?k:JSON.stringify(k), q=JSON.stringify;
  const dur=durations.map(d=>`    ${key(d.name)}: ${q(d.ms+"ms")},`).join("\n");
  const ease=easings.map(e=>`    ${key(e.name)}: ${q(easeCSS(e))},`).join("\n");
  const sem=intents.map(it=>{ const b=bindOf(it);
    const prp=(b.prop&&b.prop!=="all")?`, property: ${q(b.prop)}`:"";
    const dpx=b.distance?distPx(b.distance):null;
    const dist=dpx!=null?`, distance: ${q(dpx+"px")}`:"";
    const stag=+b.stagger>0?`, stagger: ${q((+b.stagger)+"ms")}`:"";
    return `    ${key(it.name)}: { duration: ${q(durMs(b.dur)+"ms")}, easing: ${q(easeCSS(easeObj(b.ease)))}${prp}${dist}${stag} },`; }).join("\n");
  return `// motion.ts — design tokens from Cadence${modeNote()}\n`+
    `export const motion = {\n`+
    `  duration: {\n${dur}\n  },\n`+
    `  easing: {\n${ease}\n  },\n`+
    `  // semantic intents (resolved from primitives)\n`+
    `  intent: {\n${sem}\n  },\n} as const;`;
}
// scroll-driven motion: for every intent tagged scroll-driven, emit BOTH the
// native CSS recipe (animation-timeline) and a JS fallback for browsers without
// it (Firefox today). Two shapes: REVEAL (plays once at a threshold — native
// scrubs, fallback triggers) and SCRUB (progress follows scroll position — no
// duration, the range is the axis; fallback is a scroll-position driver).
const scrubFrames = (fx, travel) =>
  fx==="parallax" ? {prop:"transform", from:`translateY(${travel})`, to:`translateY(-${travel})`, extra:""} :
  fx==="fade"     ? {prop:"opacity",    from:"0",                     to:"1",                        extra:""} :
                    {prop:"transform",  from:"scaleX(0)",             to:"scaleX(1)",                extra:"  transform-origin:left;\n"};
function buildScroll(){
  const revs=intents.filter(it=>typeof bindOf(it).reveal==="number");
  const scrubs=intents.filter(it=>bindOf(it).scrub);
  if(!revs.length && !scrubs.length){
    return "/* No scroll-driven motion yet.\n"
      + " *\n"
      + " * Open an intent's “more” panel and tick “scroll-driven”, then choose\n"
      + " * reveal (plays once on entry) or scrub (progress follows scroll). Both\n"
      + " * export here as native CSS scroll-driven animation with a JS fallback\n"
      + " * for browsers that lack it (Firefox today). */";
  }
  let s="/* Cadence — scroll-driven motion"+modeNote()+"\n"
    + " *\n"
    + " * Native CSS scroll-driven animation (Chrome/Edge 115+, Safari 26+, Opera),\n"
    + " * with a JS fallback for browsers without it (Firefox today).\n"
    + " *\n"
    + " * REVEAL scrubs on entry natively / triggers at a threshold in the fallback.\n"
    + " * SCRUB has no duration — scroll POSITION is the axis; the fallback maps the\n"
    + " * element's viewport progress to the same property. Keep scrub easing linear\n"
    + " * for a true 1:1 feel. Pair with the CSS-tab tokens (--motion-<intent>-*). */\n\n";
  // ---- reveals ----
  revs.forEach(it=>{
    const b=bindOf(it), nm=it.name;
    const dvar=`var(--motion-${nm}-duration)`, evar=`var(--motion-${nm}-ease)`;
    const travel=b.distance ? `var(--motion-distance-${b.distance})` : "16px";
    const at=Math.max(0,Math.min(100,b.reveal));
    s+=`/* — ${nm} · reveal by ${at}% into view */\n`;
    s+=`@keyframes reveal-${nm}{\n  from{ opacity:0; transform:translateY(${travel}); }\n  to{ opacity:1; transform:none; }\n}\n`;
    s+=`.reveal-${nm}{\n`;
    s+=`  animation:reveal-${nm} ${dvar} ${evar} both;\n`;
    s+=`  animation-timeline:view();\n`;
    s+=`  animation-range:entry 0% entry ${100-at}%;   /* done ${at}% past the entry edge */\n`;
    s+=`}\n`;
    if(+b.stagger>0)
      s+=`/* “${nm}” carries a ${+b.stagger}ms stagger. Native scroll-driven gives each\n`
        +`   item its own timeline, so stagger lands only in the fallback below\n`
        +`   (set el.style.transitionDelay = i*${+b.stagger}+'ms' as you observe). */\n`;
    s+=`@supports not (animation-timeline:view()){\n`;
    s+=`  .reveal-${nm}{ animation:none; opacity:0; transform:translateY(${travel});\n`;
    s+=`    transition:${dvar} ${evar}; transition-property:opacity,transform; }\n`;
    s+=`  .reveal-${nm}.is-in{ opacity:1; transform:none; }\n`;
    s+=`}\n`;
    s+=`@media (prefers-reduced-motion:reduce){\n  .reveal-${nm}{ animation:none; transition:none; opacity:1; transform:none; }\n}\n\n`;
  });
  // ---- scrubs ----
  scrubs.forEach(it=>{
    const b=bindOf(it), nm=it.name, sc=b.scrub;
    const evar=`var(--motion-${nm}-ease)`;
    const travelPx=b.distance ? (distPx(b.distance)||40) : 40;
    const travel=b.distance ? `var(--motion-distance-${b.distance})` : "40px";
    const kf=scrubFrames(sc.fx, travel);
    const tl = sc.tl==="scroll" ? "scroll()" : "view()";
    const rangeLine = sc.tl==="scroll" ? "" : `  animation-range:${sc.range} 0% ${sc.range} 100%;\n`;
    s+=`/* — ${nm} · scrub (${sc.tl} / ${sc.fx}) — progress follows scroll */\n`;
    s+=`@keyframes scrub-${nm}{\n  from{ ${kf.prop}:${kf.from}; }\n  to{ ${kf.prop}:${kf.to}; }\n}\n`;
    s+=`.scrub-${nm}{\n`;
    s+=kf.extra;
    s+=`  animation:scrub-${nm} auto ${evar} both;   /* auto duration → the timeline drives it */\n`;
    s+=`  animation-timeline:${tl};\n`;
    s+=rangeLine;
    s+=`}\n`;
    s+=`@media (prefers-reduced-motion:reduce){\n  .scrub-${nm}{ animation:none; ${kf.prop}:${kf.to}; }\n}\n\n`;
  });
  // ---- fallback drivers ----
  s+="/* Fallback — runs only where native scroll timelines are missing (Firefox today). */\n";
  s+="if(!CSS.supports('animation-timeline: view()')){\n";
  if(revs.length){
    const selList=revs.map(it=>".reveal-"+it.name).join(", ");
    s+="  /* reveals: trigger at a threshold */\n";
    s+="  const io=new IntersectionObserver(es=>{\n";
    s+="    for(const e of es) if(e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); }\n";
    s+="  },{threshold:"+(revs.length===1?(Math.max(0,Math.min(100,bindOf(revs[0]).reveal))/100).toFixed(2):"0.15")+"});   /* maps to the reveal % */\n";
    s+="  document.querySelectorAll('"+selList+"').forEach(el=>io.observe(el));\n";
  }
  if(scrubs.length){
    const items=scrubs.map(it=>{ const sc=bindOf(it).scrub; const amt=bindOf(it).distance?(distPx(bindOf(it).distance)||40):40;
      return `['.scrub-${it.name}','${sc.fx}',${amt}]`; }).join(", ");
    s+="  /* scrubs: map the element's viewport progress (0→1) to the property */\n";
    s+="  const prog=el=>{ const r=el.getBoundingClientRect(); return Math.min(1,Math.max(0,(innerHeight-r.top)/(innerHeight+r.height))); };\n";
    s+="  const fx={ progress:(el,p)=>{el.style.transform='scaleX('+p+')';el.style.transformOrigin='left';},\n";
    s+="             parallax:(el,p,a)=>{el.style.transform='translateY('+(a-2*a*p)+'px)';},\n";
    s+="             fade:(el,p)=>{el.style.opacity=p;} };\n";
    s+="  const scrubItems=["+items+"];\n";
    s+="  const upd=()=>scrubItems.forEach(([sel,f,a])=>document.querySelectorAll(sel).forEach(el=>fx[f](el,prog(el),a)));\n";
    s+="  addEventListener('scroll',upd,{passive:true}); addEventListener('resize',upd); upd();\n";
  }
  s+="}";
  return s;
}
// view transitions: animate DOM state swaps via the View Transitions API. The
// only knobs are duration + easing, so an intent maps straight onto the
// ::view-transition-* pseudo-elements. Same-document VT is Baseline; the JS
// scaffold feature-detects startViewTransition so older browsers swap instantly.
function buildVT(){
  const vts=intents.filter(it=>bindOf(it).vt);
  if(!vts.length){
    return "/* No view transitions yet.\n"
      + " *\n"
      + " * Open an intent's “more” panel and tick “view transition” to emit a\n"
      + " * recipe here: the ::view-transition-* pseudo-elements timed by that\n"
      + " * intent's duration + easing, plus a startViewTransition() scaffold. */";
  }
  let s="/* Cadence — view transitions"+modeNote()+"\n"
    + " *\n"
    + " * Same-document View Transitions are Baseline (Chrome/Edge 111+, Safari 18+,\n"
    + " * Firefox 144+). The only knobs are duration + easing, so each intent maps\n"
    + " * straight onto the pseudo-elements. Progressive enhancement — the scaffold\n"
    + " * feature-detects startViewTransition(), so older browsers just swap. */\n\n";
  vts.forEach(it=>{
    const nm=it.name, ty=bindOf(it).vt.type;
    const dvar=`var(--motion-${nm}-duration)`, evar=`var(--motion-${nm}-ease)`;
    if(ty==="shared"){
      s+=`/* — ${nm} · shared element morph. Put the SAME view-transition-name on the\n`;
      s+=`   element in BOTH states (before and after the DOM swap) so the browser\n`;
      s+=`   morphs it between them; names must be unique per snapshot. */\n`;
      s+=`.${nm}-shared{ view-transition-name:${nm}; }\n`;
      s+=`::view-transition-group(${nm}){\n  animation-duration:${dvar};\n  animation-timing-function:${evar};\n}\n`;
      s+=`::view-transition-old(${nm}),\n::view-transition-new(${nm}){\n  animation-duration:${dvar};\n  animation-timing-function:${evar};\n}\n\n`;
    } else {
      s+=`/* — ${nm} · root cross-fade (whole page old→new) */\n`;
      s+=`::view-transition-old(root),\n::view-transition-new(root){\n  animation-duration:${dvar};\n  animation-timing-function:${evar};\n}\n\n`;
    }
  });
  s+=`/* Honor reduced-motion — skip the animation, keep the instant swap. */\n`;
  s+=`@media (prefers-reduced-motion:reduce){\n`;
  s+=`  ::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){ animation:none !important; }\n}\n\n`;
  s+="/* Wrap any DOM change; the browser snapshots old→new and cross-fades. */\n";
  s+="function swap(update){\n";
  s+="  if(!document.startViewTransition){ update(); return; }   /* fallback: no animation */\n";
  s+="  document.startViewTransition(update);\n";
  s+="}\n";
  s+="// swap(() => { /* navigate, toggle, or re-render the DOM here */ });";
  return s;
}
function render(){
  const o=document.getElementById("out");
  if(fmt==="css"){ o.innerHTML=buildCSS(); return; }
  const build={json:buildJSON,tailwind:buildTailwind,sd:buildStyleDictionary,ts:buildTS,scroll:buildScroll,vt:buildVT}[fmt]||buildJSON;
  o.textContent=build();
}

// ---------- orchestrate ----------
function refreshTokens(){
  const s=document.documentElement.style;
  durations.forEach(d=>s.setProperty(`--motion-duration-${d.name}`,d.ms+"ms"));
  easings.forEach(e=>s.setProperty(`--motion-ease-${e.name}`,easeCSS(e)));
}
function rerenderAll(){ renderModes();renderDurations();renderDistances();renderEasings();renderIntents();renderBench();refreshTokens();render();critique();writeURL(); }

// ---------- starter templates: motion palettes from established design systems ----------
// state shape matches encodeState: d[[name,ms]] · e[[name,x1,y1,x2,y2]] · i[[name,dur,ease,purpose]] · p[[kind,intentIdx]]
const TEMPLATES = {
  "Cadence starter": {d:[["fast",150],["base",200],["slow",300],["slower",500],["xslow",800]],
    e:[["standard",0.2,0,0.2,1],["decelerate",0,0,0.2,1],["accelerate",0.4,0,1,1],["emphasized",0.22,1,0.36,1]],
    i:[["enter","base","emphasized","things appearing"],["exit","fast","accelerate","things leaving"],["move","slow","standard","in-place change"],["emphasized","slower","emphasized","hero moments"],["hover","fast","standard","pointer feedback"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",4]]},
  "Material 3 · Google": {d:[["short2",100],["short4",200],["medium2",300],["medium4",400],["long2",500],["xlong2",800]],
    e:[["linear",0,0,1,1],["standard",0.2,0,0,1],["standard-accel",0.3,0,1,1],["standard-decel",0,0,0,1],["emph-accel",0.3,0,0.8,0.15],["emph-decel",0.05,0.7,0.1,1]],
    i:[["enter","medium4","emph-decel","element arriving"],["exit","short4","emph-accel","element leaving"],["move","medium2","standard","in-place change"],["emphasized","long2","emph-decel","hero moment"],["hover","short2","standard","pointer feedback"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
  "Material 3 Expressive · Google": {d:[["short2",100],["short4",200],["medium2",300],["medium4",400],["long2",500]],
    e:[["linear",0,0,1,1],["standard",0.2,0,0,1],["spatial-default","spring",160,15],["spatial-fast","spring",300,22],["effects","spring",200,28]],
    i:[["enter","medium4","spatial-default","spatial spring in"],["exit","short4","standard","utility out"],["move","medium2","effects","non-bouncy change"],["emphasized","long2","spatial-default","expressive hero"],["hover","short2","standard","pointer feedback"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
  "IBM Carbon": {d:[["fast-01",70],["fast-02",110],["moderate-01",150],["moderate-02",240],["slow-01",400],["slow-02",700]],
    e:[["std-productive",0.2,0,0.38,0.9],["entrance-productive",0,0,0.38,0.9],["exit-productive",0.2,0,1,0.9],["std-expressive",0.4,0.14,0.3,1],["entrance-expressive",0,0,0.3,1],["exit-expressive",0.4,0.14,1,1]],
    i:[["enter","moderate-01","entrance-productive","productive entrance"],["exit","moderate-01","exit-productive","productive exit"],["move","moderate-02","std-productive","on-screen change"],["emphasized","slow-01","entrance-expressive","expressive entrance"],["hover","fast-01","std-productive","pointer feedback"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
  "Fluent 2 · Microsoft": {d:[["ultra-fast",50],["faster",100],["fast",150],["normal",200],["gentle",250],["slow",300],["slower",400],["ultra-slow",500]],
    e:[["linear",0,0,1,1],["easy-ease",0.33,0,0.67,1],["accelerate-mid",1,0,1,1],["decelerate-mid",0,0,0,1],["accelerate-max",0.9,0.1,1,0.2],["decelerate-max",0.1,0.9,0.2,1]],
    i:[["enter","normal","decelerate-mid","element arriving"],["exit","fast","accelerate-mid","element leaving"],["move","normal","easy-ease","in-place change"],["emphasized","slow","decelerate-max","large travel enter"],["hover","faster","easy-ease","pointer feedback"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
  "Ant Design": {d:[["fast",100],["mid",200],["slow",300]],
    e:[["ease-in-out",0.645,0.045,0.355,1],["ease-out",0.215,0.61,0.355,1],["out-circ",0.08,0.82,0.17,1],["in-out-circ",0.78,0.14,0.15,0.86],["out-quint",0.23,1,0.32,1],["in-quint",0.755,0.05,0.855,0.06],["out-back",0.12,0.4,0.29,1.46]],
    i:[["zoom-in","mid","out-circ","zoom appear"],["zoom-out","mid","in-out-circ","zoom leave"],["slide-in","slow","out-quint","slide appear"],["move","mid","ease-in-out","in-place change"],["hover","fast","ease-out","pointer feedback"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
  "Tailwind CSS": {d:[["d75",75],["d100",100],["d150",150],["d200",200],["d300",300],["d500",500],["d700",700],["d1000",1000]],
    e:[["linear",0,0,1,1],["ease-in",0.4,0,1,1],["ease-out",0,0,0.2,1],["ease-in-out",0.4,0,0.2,1]],
    i:[["enter","d200","ease-out","element arriving"],["exit","d150","ease-in","element leaving"],["move","d300","ease-in-out","in-place change"],["default","d150","ease-in-out","default transition"],["hover","d150","ease-in-out","pointer feedback"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
  "Atlassian": {d:[["small",100],["medium",350],["large",700]],
    e:[["out-bold",0,0.4,0,1],["in-out-bold",0.4,0,0,1],["in-practical",0.6,0,0.8,0.6],["out-practical",0.4,1,0.6,1]],
    i:[["enter","medium","out-bold","element entering"],["exit","small","in-practical","element exiting"],["move","medium","in-out-bold","scaling / repositioning"],["emphasized","large","out-bold","large entrance"],["hover","small","out-practical","subtle hover / fade"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
  "Polaris · Shopify": {d:[["d100",100],["d150",150],["d200",200],["d300",300],["d400",400],["d500",500]],
    e:[["linear",0,0,1,1],["ease",0.25,0.1,0.25,1],["ease-in",0.42,0,1,1],["ease-out",0.19,0.91,0.38,1],["ease-in-out",0.42,0,0.58,1]],
    i:[["enter","d200","ease-out","element arriving"],["exit","d150","ease-in","element leaving"],["move","d200","ease-in-out","in-place change"],["emphasized","d300","ease-out","emphasis"],["hover","d100","ease","pointer feedback"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
  "GitHub Primer": {d:[["micro",100],["short",200],["medium",300],["long",500]],
    e:[["linear",0,0,1,1],["ease",0.25,0.1,0.25,1],["ease-in",0.7,0.1,0.75,0.9],["ease-out",0.3,0.8,0.6,1],["ease-in-out",0.6,0,0.2,1]],
    i:[["hover","micro","ease","pointer feedback"],["state-change","short","ease-in-out","on-screen change"],["enter","medium","ease-out","element arriving"],["exit","short","ease-in","element leaving"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
  "Adobe Spectrum": {d:[["d130",130],["d190",190],["d250",250],["d300",300],["d400",400],["d500",500]],
    e:[["linear",0,0,1,1],["ease-in-out",0.45,0,0.4,1],["ease-in",0.5,0,1,1],["ease-out",0,0,0.4,1]],
    i:[["enter","d250","ease-out","element arriving"],["exit","d190","ease-in","element leaving"],["move","d250","ease-in-out","in-place change"],["emphasized","d400","ease-out","emphasis"],["hover","d130","ease-out","pointer feedback"]],
    p:[["orb",0],["orb",1],["orb",2],["orb",3]]},
};

// ---------- shareable state (whole system encoded in the URL) ----------
const b64urlEncode = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const b64urlDecode = s => decodeURIComponent(escape(atob(s.replace(/-/g,"+").replace(/_/g,"/"))));
// the full system as a compact positional object (arrays, not keyed fields)
function stateObj(){
  return {
    d: durations.map(d=>[d.name,d.ms]),
    e: easings.map(e=> e.type==="spring" ? [e.name,"spring",e.spring.stiffness,e.spring.damping] : [e.name,...e.bez]),
    m: modes.map(x=>x.name),
    am: activeMode,
    // i: [name, purpose, [[dur,ease,stagger,prop,effectsEase,distance] per mode]]
    i: intents.map(it=>[it.name,it.purpose||"",it.binds.map(b=>[b.dur,b.ease,+b.stagger||0,b.prop||"all",b.effectsEase||"",b.distance||"",typeof b.reveal==="number"?b.reveal:-1,b.scrub?[b.scrub.tl,b.scrub.range,b.scrub.fx]:0,b.vt?[b.vt.type]:0])]),
    x: distances.map(d=>[d.name,d.px]),
    p: probes.map(pb=>{ const k=intents.findIndex(x=>x.id===pb.intent); return [pb.kind, k<0?0:k]; }),
  };
}
// the full encoding — used for the live-demo link + channel, which want the
// complete state no matter what changed (demo.html decodes this format)
function encodeStateFull(){ return b64urlEncode(JSON.stringify(stateObj())); }
// one positional section vs its default: null if identical, {f:rows} if the
// shape changed (rows added/removed), else {d:{idx:row}} for just the differing
// rows — so a lightly edited system encodes to a fraction of the full state.
function packArr(cur, def){
  if(cur.length!==def.length) return {f:cur};
  const delta={}; let any=false;
  for(let i=0;i<cur.length;i++) if(JSON.stringify(cur[i])!==JSON.stringify(def[i])){ delta[i]=cur[i]; any=true; }
  return any ? {d:delta} : null;
}
function unpackArr(packed, def){
  if(!packed) return def;
  if(packed.f) return packed.f;
  const out=def.slice(); for(const k in packed.d) out[+k]=packed.d[k]; return out;
}
// the short encoding — only the diff from the default system. This is what the
// editor puts in the address bar, so the shared link is short (see writeURL).
function encodeState(){
  const s=stateObj(), D={};
  if(s.am!==DEFAULT_S.am) D.am=s.am;
  for(const k of ["d","e","m","i","x","p"]){ const p=packArr(s[k],DEFAULT_S[k]); if(p) D[k]=p; }
  return b64urlEncode(JSON.stringify(D));
}
function expandDiff(D){                    // rebuild the full state (missing/unchanged → default)
  return { am:("am" in D)?D.am:DEFAULT_S.am,
    d:unpackArr(D.d,DEFAULT_S.d), e:unpackArr(D.e,DEFAULT_S.e), m:unpackArr(D.m,DEFAULT_S.m),
    i:unpackArr(D.i,DEFAULT_S.i), x:unpackArr(D.x,DEFAULT_S.x), p:unpackArr(D.p,DEFAULT_S.p) };
}
function applyEncoded(raw){
  const o=JSON.parse(b64urlDecode(raw));
  // legacy / demo links carry the full state (every section a bare array); the
  // short links carry only the diff (sections wrapped in {d/f}, or absent)
  const full = Array.isArray(o.d) && Array.isArray(o.e) && Array.isArray(o.i);
  applyState(full ? o : JSON.parse(JSON.stringify(expandDiff(o))));
}
// mutate the model in place from a parsed state object; throws on malformed input
function applyState(o){
  if(!o||!Array.isArray(o.d)||!Array.isArray(o.e)||!Array.isArray(o.i)) throw new Error("bad state");
  const d = o.d.map(x=>({name:String(x[0]),ms:+x[1]||200}));
  const e = o.e.map(x=> x[1]==="spring"
    ? {name:String(x[0]),type:"spring",spring:{stiffness:+x[2]||170,damping:+x[3]||12}}
    : {name:String(x[0]),type:"cubic",bez:[+x[1],+x[2],+x[3],+x[4]]});
  // modes: new links carry `m`; legacy links imply a single "default" mode.
  const md = Array.isArray(o.m)&&o.m.length ? o.m.map(n=>({name:String(n)})) : [{name:"default"}];
  const it = o.i.map(x=>{
    // new: [name, purpose, [[dur,ease],...]]  ·  legacy: [name, dur, ease, purpose]
    const binds = Array.isArray(x[2])
      ? x[2].map(b=>{ const o={dur:String(b[0]),ease:String(b[1]),stagger:+b[2]||0,prop:String(b[3]||"all")}; if(b[4]) o.effectsEase=String(b[4]); if(b[5]) o.distance=String(b[5]); if(typeof b[6]!=="undefined" && +b[6]>=0) o.reveal=Math.max(0,Math.min(100,+b[6])); if(Array.isArray(b[7])){ o.scrub={tl:String(b[7][0]||"view"),range:String(b[7][1]||"cover"),fx:String(b[7][2]||"progress")}; delete o.reveal; } if(Array.isArray(b[8])){ o.vt={type:String(b[8][0]||"root")}; } return o; })
      : [{dur:String(x[1]),ease:String(x[2]),stagger:0,prop:"all"}];
    const purpose = Array.isArray(x[2]) ? String(x[1]||"") : String(x[3]||"");
    // pad/trim bindings so every intent has exactly one per mode
    while(binds.length<md.length) binds.push({...binds[binds.length-1]});
    binds.length=md.length;
    return {id:nid(),name:String(x[0]),purpose,binds};
  });
  if(!d.length||!e.length||!it.length) throw new Error("empty scale");
  // distance scale: new links carry `x`; legacy/template links fall back to the default set
  const dist = Array.isArray(o.x)&&o.x.length
    ? o.x.map(x=>({name:String(x[0]),px:Math.max(0,Math.min(1000,+x[1]||0))}))
    : [{name:"nudge",px:8},{name:"inline",px:48},{name:"panel",px:240},{name:"screen",px:720}];
  durations=d; easings=e; intents=it; modes=md; distances=dist;
  activeMode=Math.max(0,Math.min(modes.length-1, +o.am||0));
  // bindings that reference a now-missing name fall back to the first slot (distance just drops)
  const dn=new Set(durations.map(x=>x.name)), en=new Set(easings.map(x=>x.name)), xn=new Set(distances.map(x=>x.name));
  intents.forEach(x=>x.binds.forEach(b=>{ if(!dn.has(b.dur))b.dur=durations[0].name; if(!en.has(b.ease))b.ease=easings[0].name; if(b.effectsEase&&!en.has(b.effectsEase))delete b.effectsEase; if(b.distance&&!xn.has(b.distance))delete b.distance; }));
  // reveal the distance scale if anything now uses it
  distOpen = intents.some(x=>x.binds.some(b=>b.distance));
  // restore each probe's lens (kind) + intent. New format stores [kind, idx];
  // legacy links stored a bare intent index (kind stays the default).
  const pick=k=>intents[Math.max(0,Math.min(intents.length-1,k))].id;
  const validKind=k=>KINDS.some(x=>x.k===k)?k:"orb";
  if(Array.isArray(o.p)&&o.p.length===probes.length) probes.forEach((pb,k)=>{
    const v=o.p[k];
    if(Array.isArray(v)){ pb.kind=validKind(v[0]); pb.intent=pick(+v[1]||0); }
    else pb.intent=pick(+v||0);
  });
  else probes.forEach((pb,k)=>pb.intent=pick(k));
}
// a channel so an open live-demo (tab or preview iframe) re-times as you edit
let bchan=null; try{ bchan=new BroadcastChannel("cadence"); }catch(_){}
// "landing" (the intro/marketing view) vs "tool" (the editor). Resolved at boot
// from the hash: empty → landing; anything else (state, "tool", or garbage) →
// tool. Only the tool stamps its state into the hash, so the landing stays clean.
let mode="tool";
function writeURL(){
  const enc=encodeState();          // short (diff from default) — for the address bar
  // keep a clean `#tool` until the system diverges from the default; only then
  // stamp the (short) shareable state into the address bar.
  const hash = enc===DEFAULT_ENC ? "tool" : enc;
  if(mode==="tool"){ try{ history.replaceState(null,"",location.pathname+location.search+"#"+hash); }catch(_){} }
  // the demo link + live-preview channel want the complete state (demo.html
  // decodes the full format), so they always get the full encode.
  const full=encodeStateFull();
  if(bchan){ try{ bchan.postMessage({hash:full}); }catch(_){} }
  const dl=document.getElementById("demoLink"); if(dl) dl.href="demo.html#"+full;
}

function updateResolvedLines(){
  document.querySelectorAll(".intent__resolved").forEach((el,k)=>{
    if(!intents[k]) return;
    const r=resolve(intents[k]); el.textContent=`→ ${r.d} · ${r.eLabel}${r.s?` · stagger ${r.s}ms`:""}${r.prop!=="all"?` · ${r.prop}`:""}${r.distName?` · ${r.distPx}px`:""}${r.reveal!=null?` · reveal@${r.reveal}%`:""}${r.scrub?` · scrub·${r.scrub.tl}/${r.scrub.fx}`:""}${r.vt?` · vt·${r.vt.type}`:""}`;
  });
}

// ---------- events (delegated) ----------
// Enter commits an edit (name/stagger inputs) by blurring — no waiting for focus loss
document.addEventListener("keydown", e=>{
  if(e.key==="Enter" && e.target.tagName==="INPUT" && e.target.dataset.scope){ e.preventDefault(); e.target.blur(); }
});
document.addEventListener("input", e=>{
  const t=e.target, sc=t.dataset.scope, i=+t.dataset.i;
  if(sc==="dur"){ durations[i].ms=+t.value; refreshTokens(); renderDurations(); render(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="xpx"){ distances[i].px=+t.value; const v=t.closest(".drow")?.querySelector(".drow__val"); if(v)v.textContent=t.value+"px"; render(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="iname"){ intents[i].name=t.value.trim()||intents[i].name; render(); critique(); writeURL(); }
  if(sc==="istag"){ bindOf(intents[i]).stagger=Math.max(0,Math.min(400,+t.value||0)); render(); renderBench(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="irevat"){ bindOf(intents[i]).reveal=Math.max(0,Math.min(100,+t.value||0)); render(); renderBench(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="sk"||sc==="sd"){
    easings[i].spring[sc==="sk"?"stiffness":"damping"]=+t.value;
    if(t.previousElementSibling) t.previousElementSibling.textContent=t.value;  // live number label
    updateSpringPlot(i); refreshTokens(); render(); renderBench(); critique(); updateResolvedLines(); writeURL();
  }
});
// rename a scale slot (duration or easing); intents reference by name, so
// carry every referencing intent over to the new name. `kind` is "dur"|"ease".
function renameScale(arr, i, raw, kind){
  const old = arr[i].name, s = slug(raw);
  if(!s){ rerenderAll(); return; }        // empty/invalid → keep old name
  const next = uniqueName(s, arr, i);
  if(next!==old){
    arr[i].name = next;
    intents.forEach(it=>it.binds.forEach(b=>{ if(b[kind]===old) b[kind]=next; }));
  }
  rerenderAll();
}
document.addEventListener("change", e=>{
  const t=e.target, sc=t.dataset.scope, i=+t.dataset.i;
  if(sc==="ease"){
    if(t.value==="spring"){ easings[i]={name:easings[i].name,type:"spring",spring:{...SPRING_DEFAULT}}; rerenderAll(); }
    else if(PRESETS[t.value]){ easings[i]={name:easings[i].name,type:"cubic",bez:PRESETS[t.value].slice()}; rerenderAll(); }
  }
  if(sc==="dname"){ renameScale(durations,i,t.value,"dur"); }
  if(sc==="ename"){ renameScale(easings,i,t.value,"ease"); }
  if(sc==="xname"){ renameScale(distances,i,t.value,"distance"); }
  if(sc==="idist"){ const bb=bindOf(intents[i]); if(t.value) bb.distance=t.value; else delete bb.distance; render(); renderBench(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="idur"){ bindOf(intents[i]).dur=t.value; refreshTokens(); render(); renderBench(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="iease"){ bindOf(intents[i]).ease=t.value; render(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="iprop"){ bindOf(intents[i]).prop=t.value; render(); renderBench(); updateResolvedLines(); writeURL(); }
  if(sc==="isplit"){ const bb=bindOf(intents[i]); if(t.checked) bb.effectsEase=bb.ease; else delete bb.effectsEase; rerenderAll(); }
  if(sc==="ireveal"){ const bb=bindOf(intents[i]); if(t.checked){ bb.reveal=15; delete bb.scrub; } else { delete bb.reveal; delete bb.scrub; } rerenderAll(); }
  if(sc==="iscrollmode"){ const bb=bindOf(intents[i]); if(t.value==="scrub"){ delete bb.reveal; bb.scrub={...SCRUB_DEFAULT}; } else { delete bb.scrub; bb.reveal=15; } rerenderAll(); }
  if(sc==="iscrubtl"){ const bb=bindOf(intents[i]); if(bb.scrub) bb.scrub.tl=t.value; rerenderAll(); }
  if(sc==="iscrubrange"){ const bb=bindOf(intents[i]); if(bb.scrub) bb.scrub.range=t.value; render(); renderBench(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="iscrubfx"){ const bb=bindOf(intents[i]); if(bb.scrub) bb.scrub.fx=t.value; render(); renderBench(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="ivt"){ const bb=bindOf(intents[i]); if(t.checked) bb.vt={...VT_DEFAULT}; else delete bb.vt; rerenderAll(); }
  if(sc==="ivttype"){ const bb=bindOf(intents[i]); if(bb.vt) bb.vt.type=t.value; render(); renderBench(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="ieff"){ bindOf(intents[i]).effectsEase=t.value; render(); renderBench(); critique(); updateResolvedLines(); writeURL(); }
  // re-point a probe: keep its current lens if that lens can still show the new
  // intent (general lenses show any plain/spring/staggered intent) — only
  // re-lens when a specialist mechanic is involved on either side, so the bench
  // keeps its variety instead of collapsing. An explicit choice always wins.
  if(sc==="probe"){ probes[i].intent=t.value;
    if(!probes[i].lensSet){ const need=defaultLensFor(findIntent(t.value));
      if(SPECIALIST_LENS.has(need) || SPECIALIST_LENS.has(probes[i].kind)) probes[i].kind=need; }
    renderBench(); writeURL(); }
  if(sc==="pkind"){ probes[i].kind=t.value; probes[i].lensSet=true; renderBench(); writeURL(); }
  if(sc==="mname"){ const s=(t.value.trim())||modes[i].name; modes[i].name=uniqueName(s,modes,i); rerenderAll(); }
});
document.addEventListener("click", e=>{
  const playT=e.target.closest("[data-play]");
  if(playT){ play(+playT.dataset.play); return; }
  const t=e.target, sc=t.dataset.scope, i=+t.dataset.i;
  if(sc==="imore"){ intents[i].open=!intents[i].open; renderIntents(); }
  if(sc==="irm"){ if(intents.length>1){ const gone=intents[i].id; intents.splice(i,1);
      probes.forEach(p=>{if(p.intent===gone)p.intent=intents[0].id;}); rerenderAll(); } }
  if(sc==="drm"){ if(durations.length>1){ const g=durations[i].name; durations.splice(i,1);
      const fb=durations[0].name; intents.forEach(it=>it.binds.forEach(b=>{if(b.dur===g)b.dur=fb;})); rerenderAll(); } }
  if(sc==="erm"){ if(easings.length>1){ const g=easings[i].name; easings.splice(i,1);
      const fb=easings[0].name; intents.forEach(it=>it.binds.forEach(b=>{if(b.ease===g)b.ease=fb;})); rerenderAll(); } }
  if(sc==="xrm"){ if(distances.length>1){ const g=distances[i].name; distances.splice(i,1);
      intents.forEach(it=>it.binds.forEach(b=>{if(b.distance===g)delete b.distance;})); rerenderAll(); } }
  if(sc==="mset"){ activeMode=Math.max(0,Math.min(modes.length-1,i)); rerenderAll(); }
  if(sc==="madd"){ const src=activeMode; modes.push({name:uniqueName("mode",modes)});
      intents.forEach(it=>it.binds.push({...it.binds[src]})); activeMode=modes.length-1; rerenderAll(); }
  if(sc==="mreduced"){
      const fastDur=durations.slice().sort((a,b)=>a.ms-b.ms)[0].name;
      const flatEase=(easings.find(e=>e.name==="linear")||easings[0]).name;
      modes.push({name:uniqueName("reduced",modes)});
      intents.forEach(it=>{ const cur=it.binds[activeMode]||it.binds[0]; it.binds.push({dur:fastDur,ease:flatEase,stagger:0,prop:cur.prop||"all"}); });
      activeMode=modes.length-1; rerenderAll(); }
  if(sc==="mrm"){ if(modes.length>1){ modes.splice(i,1); intents.forEach(it=>it.binds.splice(i,1));
      activeMode=Math.max(0,Math.min(modes.length-1,activeMode>=i?activeMode-1:activeMode)); rerenderAll(); } }
});
// ---------- bézier drag editing ----------
let bzDrag=null, bzRAF=null;
function bzDownstream(){                    // rAF-coalesced: heavy recompute at most once per frame
  if(bzRAF) return;
  bzRAF=requestAnimationFrame(()=>{ bzRAF=null; refreshTokens(); render(); critique(); updateResolvedLines(); writeURL(); });
}
document.addEventListener("pointerdown", e=>{
  const h=e.target.closest && e.target.closest(".bz-h"); if(!h) return;
  const plot=h.closest(".ecard__plot"); if(!plot) return;
  bzDrag={ i:+plot.dataset.i, pt:+h.dataset.pt, svg:plot.querySelector("svg.bz") };
  h.classList.add("drag"); try{ h.setPointerCapture(e.pointerId); }catch(_){}
  e.preventDefault();
});
document.addEventListener("pointermove", e=>{
  if(!bzDrag) return;
  const r=bzDrag.svg.getBoundingClientRect();
  const x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
  let y=(1-(e.clientY-r.top)/r.height)*(1+2*BZPAD)-BZPAD;
  y=Math.min(1+BZPAD,Math.max(-BZPAD,y));
  const b=easings[bzDrag.i].bez, o=bzDrag.pt===1?0:2;
  b[o]=+x.toFixed(3); b[o+1]=+y.toFixed(3);
  updateEasingPlot(bzDrag.i); bzDownstream();
});
document.addEventListener("pointerup", ()=>{
  if(!bzDrag) return;
  bzDrag=null;
  document.querySelectorAll(".bz-h.drag").forEach(h=>h.classList.remove("drag"));
  rerenderAll();                            // normalize the preset dropdown (custom vs matched)
});
// global tempo: scale the whole ladder, preserving proportions
function scaleTempo(f){
  durations.forEach(d=>{ d.ms=Math.max(60,Math.min(1000,Math.round(d.ms*f/5)*5)); });
  rerenderAll();
}
document.getElementById("tempoDown").addEventListener("click",()=>scaleTempo(0.9));
document.getElementById("tempoUp").addEventListener("click",()=>scaleTempo(1.1));
document.getElementById("addDuration").addEventListener("click",()=>{
  const last=durations[durations.length-1];
  const ms=Math.min(1000,Math.max(60, last?Math.round(last.ms*1.5):300));
  durations.push({name:uniqueName("step",durations),ms});
  rerenderAll();
});
document.getElementById("addDistance").addEventListener("click",()=>{
  const last=distances[distances.length-1];
  const px=Math.min(1000,Math.max(0, last?Math.round(last.px*2):48));
  distances.push({name:uniqueName("dist",distances),px});
  distOpen=true; rerenderAll();
});
document.getElementById("distToggle").addEventListener("click",()=>{ distOpen=!distOpen; renderDistances(); });
document.getElementById("addEasing").addEventListener("click",()=>{
  easings.push({name:uniqueName("custom",easings),type:"cubic",bez:PRESETS.standard.slice()});
  rerenderAll();
});
document.getElementById("addIntent").addEventListener("click",()=>{
  const dur=durations[0].name, ease=easings[0].name;
  intents.push({id:nid(),name:"custom",purpose:"your own",binds:modes.map(()=>({dur,ease,stagger:0,prop:"all"}))});
  rerenderAll();
});
document.getElementById("playAll").addEventListener("click",playAll);
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active"); fmt=t.dataset.fmt; render();
}));
document.getElementById("copy").addEventListener("click",()=>{
  navigator.clipboard?.writeText(document.getElementById("out").textContent);
  const b=document.getElementById("copy"); b.textContent="Copied ✓"; setTimeout(()=>b.textContent="Copy",1200);
});
document.getElementById("share").addEventListener("click",()=>{
  writeURL();
  navigator.clipboard?.writeText(location.href);
  const b=document.getElementById("share"); b.textContent="Link copied ✓"; setTimeout(()=>b.textContent="Copy share link",1400);
});

// load-a-system picker: populate from TEMPLATES, apply on choose
(function initLoader(){
  const sel=document.getElementById("loadSystem");
  if(!sel) return;
  sel.innerHTML=`<option value="">Load a system…</option>`+
    Object.keys(TEMPLATES).map(k=>`<option value="${k}">${k}</option>`).join("");
  sel.addEventListener("change",()=>{
    const t=TEMPLATES[sel.value];
    sel.value="";                          // reset so re-picking the same one re-fires
    if(!t) return;
    try{ applyState(structuredClone(t)); rerenderAll(); }catch(_){}
  });
})();

// live-demo preview: an iframe of demo.html seeded with the current system; it
// stays live via the BroadcastChannel above (same origin). On wide screens it
// docks beside the editor (body.previewing) so the edit→see loop is visible;
// on narrow screens it's a full-screen overlay.
let openPreview=()=>{};
(function initPreview(){
  const pv=document.getElementById("preview"), tog=document.getElementById("previewToggle");
  const cl=document.getElementById("previewClose"), fr=document.getElementById("previewFrame"), pop=document.getElementById("previewPop");
  if(!pv||!tog||!fr) return;
  const setP=on=>{
    if(on && (pv.hidden || !fr.src)){ const enc=encodeStateFull(); fr.src="demo.html#"+enc; if(pop) pop.href="demo.html#"+enc; }
    pv.hidden=!on; document.body.classList.toggle("previewing", on);
  };
  openPreview=()=>setP(true);
  tog.addEventListener("click",()=>setP(pv.hidden));
  if(cl) cl.addEventListener("click",()=>setP(false));
  document.addEventListener("keydown",e=>{ if(e.key==="Escape" && !pv.hidden) setP(false); });
})();

// export column: hidden by default so the editor is full-width; opening adds a
// reflowing right column (no overlay) whose code still updates live as you edit
(function initExport(){
  const panel=document.getElementById("exportPanel"), tog=document.getElementById("exportToggle");
  const cl=document.getElementById("exportClose"), wrap=document.querySelector(".wrap");
  if(!panel||!tog||!wrap) return;
  // everything the full-screen sheet covers — including the header/intro, which
  // live outside .wrap — goes inert so nothing behind it stays keyboard-reachable
  const behind=[...document.querySelectorAll("header.top,.intro,.col.scales,.col.mid")];
  const isSheet=()=>matchMedia("(max-width:1260px)").matches;   // export is a modal sheet below this
  const setOpen=o=>{
    panel.hidden=!o; wrap.classList.toggle("xopen",o); tog.setAttribute("aria-expanded",o?"true":"false");
    // as a full-screen sheet: pull focus into it and make the editor behind
    // inert, so keyboard users aren't tabbing through hidden controls
    const modal=o&&isSheet();
    behind.forEach(el=>modal?el.setAttribute("inert",""):el.removeAttribute("inert"));
    if(modal){ (cl||panel).focus(); } else if(!o){ tog.focus(); }
  };
  tog.addEventListener("click",()=>setOpen(panel.hidden));
  if(cl) cl.addEventListener("click",()=>setOpen(false));
  document.addEventListener("keydown",e=>{ if(e.key==="Escape" && !panel.hidden) setOpen(false); });
})();

// dismissible orientation strip (remembered across visits)
(function initIntro(){
  const el=document.getElementById("intro"); if(!el) return;
  try{ if(localStorage.getItem("cadence-intro")==="off") el.hidden=true; }catch(_){}
  const x=document.getElementById("introClose");
  if(x) x.addEventListener("click",()=>{ el.hidden=true; try{ localStorage.setItem("cadence-intro","off"); }catch(_){} });
})();

// the pristine default system, snapshotted once before any shared link is
// applied — the baseline the short encoding diffs against, and the sentinel for
// a clean `#tool` (the address bar stays clean while the state matches it, and
// the short shareable hash only appears once you diverge — see writeURL).
const DEFAULT_S = stateObj();
const DEFAULT_ENC = encodeState();
// restore a shared system from the URL hash + decide landing vs tool. Empty
// hash → landing (first impression); any hash → straight into the tool (so
// share links and #tool both skip the landing, and tests boot the editor).
(function initFromURL(){
  const h=location.hash.replace(/^#/,"");
  if(h && h!=="tool"){ try{ applyEncoded(h); }catch(_){ /* malformed link → keep defaults */ } }
  mode = h ? "tool" : "landing";
})();
// re-apply when the hash changes on an already-open page (pasting a shared
// link into the address bar, or back/forward). Our own writes use
// replaceState, which never fires hashchange — so this can't loop.
window.addEventListener("hashchange", ()=>{
  const h=location.hash.replace(/^#/,"");
  if(!h || h==="tool" || h===encodeState()) return;
  try{ applyEncoded(h); mode="tool"; setBootClass(); rerenderAll(); }catch(_){}
});

// ---------- landing view: the product demonstrating its own thesis ----------
function setBootClass(){
  const r=document.documentElement.classList;
  r.toggle("boot-landing", mode!=="tool"); r.toggle("boot-tool", mode==="tool");
}
function enterTool(){
  if(mode==="tool") return;
  const go=()=>{ mode="tool"; setBootClass(); writeURL(); window.scrollTo(0,0); if(!reduce){ setTimeout(playAll,120); startBenchIdle(); }
    // dock the live preview beside the editor so the edit→see loop is felt at once
    if(matchMedia("(min-width:1001px)").matches) setTimeout(openPreview,80); };
  // the entrance itself is a View Transition — the newest feature, dogfooded
  if(document.startViewTransition && !reduce) document.startViewTransition(go); else go();
}
function exitTool(){
  if(mode==="tool"){
    const go=()=>{ mode="landing"; setBootClass();
      // drop the state hash so a reload stays on the intro; in-memory state is
      // kept, so re-entering the tool restores the same system.
      try{ history.replaceState(null,"",location.pathname+location.search); }catch(_){}
      window.scrollTo(0,0);
      const land=document.getElementById("landing");
      if(land){ land.classList.remove("in"); requestAnimationFrame(()=>requestAnimationFrame(()=>land.classList.add("in"))); }
    };
    // reverse the entrance — the brand wordmark morphs back (shared v-t-name)
    if(document.startViewTransition && !reduce) document.startViewTransition(go); else go();
  }
}
(function initLanding(){
  setBootClass();
  // hero backdrop A/B switch (temporary, for picking a direction): ?hero=editor
  // shows the bezier-editor motif, ?hero=both overlays both; default is traces.
  try{ const hv=new URLSearchParams(location.search).get("hero");
    const bg=document.querySelector(".lherobg"); if(hv&&bg) bg.setAttribute("data-hero",hv);
    // both variants animate via SMIL (not CSS), so honour reduced-motion by
    // pausing them at their initial frame (the CSS zoom/pan is already gated;
    // the parked trace heads are hidden via a reduced-motion CSS rule)
    if(reduce){ document.querySelectorAll(".lce-svg,.ltr-svg").forEach(s=>s.pauseAnimations&&s.pauseAnimations()); }
  }catch(_){}
  const start=document.getElementById("startTool");
  if(start) start.addEventListener("click",enterTool);
  // the tool's wordmark is a home link → back to the intro. Plain modified
  // clicks (new tab / middle-click) fall through to the href.
  const home=document.getElementById("brandHome");
  if(home) home.addEventListener("click",e=>{
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0) return;
    e.preventDefault(); exitTool();
  });
  // trigger the staggered entrance once painted
  const land=document.getElementById("landing");
  if(land) requestAnimationFrame(()=>requestAnimationFrame(()=>land.classList.add("in")));

  // scroll-montage fallbacks — only where native scroll timelines are missing
  // (Firefox today). The montage itself dogfoods reveal (view()) + scrub (scroll()).
  if(!CSS.supports("animation-timeline: view()")){
    const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }),{threshold:0.18});
    document.querySelectorAll(".landing .reveal-scroll").forEach(el=>io.observe(el));
  }
  if(!CSS.supports("animation-timeline: scroll()")){
    const bar=document.querySelector(".lprogress"), de=document.documentElement;
    if(bar){ const upd=()=>{ const max=de.scrollHeight-de.clientHeight; bar.style.transform="scaleX("+(max>0?de.scrollTop/max:0)+")"; };
      addEventListener("scroll",upd,{passive:true}); addEventListener("resize",upd); upd(); }
  }

  // signature: the page critiques its OWN motion. Flip "with taste → naïve" and
  // the whole page flattens while the opinion line lights up — the thesis in one
  // gesture. The tasteful read rotates through real system-read observations.
  const TASTE=[
    "exit (150ms) is quicker than enter (200ms) — leaving feels decisive.",
    "4 distinct easings — a lean, legible set.",
    "enter staggers 70ms — a 5-item list cascades over 280ms, brisk enough to read as one gesture.",
    "the ladder grows at an even rate — it reads as one considered scale.",
  ];
  const NAIVE="exit as slow as enter, everything linear, no stagger — the motion reads as sluggish and undesigned.";
  const line=document.getElementById("opinionLine");
  const toggle=document.getElementById("tasteToggle");
  let naive=false, tick=0, timer=null;
  const stop=()=>{ if(timer){ clearInterval(timer); timer=null; } };
  const rotate=()=>{ if(!line) return; line.textContent=TASTE[tick%TASTE.length]; tick++; };
  // reserve the tallest observation's height so the rotating text (1–3 lines,
  // depending on the string and the viewport width) never reflows the cards
  // below. Measured across every candidate at the current width; recomputed on
  // resize since wrapping — and therefore the max — changes with it.
  function reserveLine(){
    if(!line) return;
    const keep=line.textContent; line.style.minHeight="0px";
    let max=0;
    for(const s of TASTE){ line.textContent=s; if(line.offsetHeight>max) max=line.offsetHeight; }
    line.textContent=NAIVE; if(line.offsetHeight>max) max=line.offsetHeight;
    line.textContent=keep; line.style.minHeight=max+"px";
  }
  let rz; addEventListener("resize",()=>{ clearTimeout(rz); rz=setTimeout(reserveLine,150); },{passive:true});
  function sync(){
    if(land) land.classList.toggle("naive", naive);   // drives the active label + curve/stagger vars
    if(toggle) toggle.setAttribute("aria-pressed", naive?"true":"false");
    if(!line) return;
    stop();
    if(naive){ line.textContent=NAIVE; line.className="opinion warn"; }
    else { line.className="opinion ok"; rotate(); if(!reduce) timer=setInterval(rotate,3600); }
  }
  if(toggle) toggle.addEventListener("click",()=>{ naive=!naive; sync(); });
  sync();
  reserveLine();
  // re-measure once the self-hosted mono has actually loaded (it changes the
  // wrapping, and thus the reserved height)
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(reserveLine);
})();

rerenderAll();
if(mode==="tool" && !reduce){ setTimeout(playAll,500); startBenchIdle(); }
