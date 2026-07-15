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
};
let durations = [
  {name:"fast",ms:150},{name:"base",ms:200},{name:"slow",ms:300},{name:"slower",ms:500},{name:"xslow",ms:800},
];
let easings = [
  {name:"standard",bez:PRESETS.standard.slice()},
  {name:"decelerate",bez:PRESETS.decelerate.slice()},
  {name:"accelerate",bez:PRESETS.accelerate.slice()},
  {name:"emphasized",bez:PRESETS.emphasized.slice()},
];
let idc = 0;
const nid = () => "i"+(idc++);
let intents = [
  {id:nid(),name:"enter",dur:"base",ease:"emphasized",purpose:"things appearing"},
  {id:nid(),name:"exit",dur:"fast",ease:"accelerate",purpose:"things leaving"},
  {id:nid(),name:"move",dur:"slow",ease:"standard",purpose:"in-place change"},
  {id:nid(),name:"emphasized",dur:"slower",ease:"emphasized",purpose:"hero moments"},
  {id:nid(),name:"hover",dur:"fast",ease:"standard",purpose:"pointer feedback"},
];
// probes reference an intent by id
// each probe is a lens (kind) pointed at one intent. "orb" is the abstract,
// component-agnostic default; the rest are a swappable UI-component library.
const KINDS = [
  {k:"orb",label:"orb · abstract"},
  {k:"drawer",label:"drawer"},
  {k:"button",label:"button"},
  {k:"acc",label:"accordion"},
  {k:"reveal",label:"list reveal"},
];
let probes = [
  {kind:"orb",intent:null},
  {kind:"orb",intent:null},
  {kind:"orb",intent:null},
  {kind:"orb",intent:null},
];
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
const easeBez = name => (easings.find(e=>e.name===name)||easings[0]).bez;
const bezStr = a => `cubic-bezier(${a.join(", ")})`;
const resolve = intent => ({ d: durMs(intent.dur)+"ms", e: bezStr(easeBez(intent.ease)) });
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
// default probe intents: enter / exit / move / hover, one abstract orb each
probes[0].intent = intents[0].id; probes[1].intent = intents[1].id;
probes[2].intent = intents[2].id; probes[3].intent = intents[4].id;

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
      <button class="drow__rm" data-scope="drm" data-i="${i}" title="remove step" aria-label="remove ${d.name}">×</button>
    </div>`;
  }).join("");
}

// ---------- render: easing set (each card is a draggable bézier editor) ----------
const BZPAD = 0.35;                        // vertical headroom so overshoot curves are authorable
const SX = x => x*100;
const SY = y => (1-(y+BZPAD)/(1+2*BZPAD))*100;
function easingSVG(bez){
  const [x1,y1,x2,y2]=bez;
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
// update one plot's SVG in place (keeps elements alive so a drag isn't interrupted)
function updateEasingPlot(i){
  const svg=document.querySelector(`.ecard__plot[data-i="${i}"] svg.bz`); if(!svg) return;
  const [x1,y1,x2,y2]=easings[i].bez;
  const c1=[SX(x1),SY(y1)],c2=[SX(x2),SY(y2)],p0=[SX(0),SY(0)],p3=[SX(1),SY(1)];
  const arms=svg.querySelectorAll(".bz-arm");
  arms[0].setAttribute("x2",c1[0]); arms[0].setAttribute("y2",c1[1]);
  arms[1].setAttribute("x2",c2[0]); arms[1].setAttribute("y2",c2[1]);
  svg.querySelector(".bz-curve").setAttribute("d",`M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p3[0]},${p3[1]}`);
  const hs=svg.querySelectorAll(".bz-h");
  hs[0].setAttribute("cx",c1[0]); hs[0].setAttribute("cy",c1[1]);
  hs[1].setAttribute("cx",c2[0]); hs[1].setAttribute("cy",c2[1]);
}
function renderEasings(){
  const el=document.getElementById("easings");
  el.innerHTML = easings.map((e,i)=>{
    const match=Object.keys(PRESETS).find(k=>JSON.stringify(PRESETS[k])===JSON.stringify(e.bez));
    const opts=Object.keys(PRESETS).map(k=>`<option ${k===match?"selected":""}>${k}</option>`).join("");
    const custom=match?"":`<option value="custom" selected>custom</option>`;
    return `<div class="ecard">
      <div class="ecard__top"><input class="ecard__name" value="${e.name}" data-scope="ename" data-i="${i}" aria-label="easing name" spellcheck="false"><button class="ecard__rm" data-scope="erm" data-i="${i}" title="remove easing" aria-label="remove ${e.name}">×</button></div>
      <div class="ecard__plot" data-i="${i}">${easingSVG(e.bez)}</div>
      <select data-scope="ease" data-i="${i}" aria-label="${e.name} curve">${custom}${opts}</select>
    </div>`;
  }).join("");
}

// ---------- render: intents ----------
function renderIntents(){
  const el=document.getElementById("intents");
  el.innerHTML = intents.map((it,i)=>{
    const r=resolve(it);
    return `<div class="intent" data-id="${it.id}">
      <div class="intent__top">
        <input class="intent__name" value="${it.name}" data-scope="iname" data-i="${i}" aria-label="intent name">
        <span class="intent__purpose">${it.purpose||""}</span>
        <button class="intent__rm" data-scope="irm" data-i="${i}" title="remove" aria-label="remove intent">×</button>
      </div>
      <div class="intent__ref">
        <div class="field"><label>Duration</label>
          <select data-scope="idur" data-i="${i}">${durations.map(d=>`<option ${d.name===it.dur?"selected":""}>${d.name}</option>`).join("")}</select></div>
        <div class="field"><label>Easing</label>
          <select data-scope="iease" data-i="${i}">${easings.map(e=>`<option ${e.name===it.ease?"selected":""}>${e.name}</option>`).join("")}</select></div>
      </div>
      <div class="intent__resolved">→ ${r.d} · ${r.e}</div>
    </div>`;
  }).join("");
}

// ---------- render: bench ----------
function renderBench(){
  const el=document.getElementById("bench");
  el.innerHTML = probes.map((p,i)=>{
    const opts = intents.map(it=>`<option value="${it.id}" ${it.id===p.intent?"selected":""}>${it.name}</option>`).join("");
    const kinds = KINDS.map(kd=>`<option value="${kd.k}" ${kd.k===p.kind?"selected":""}>${kd.label}</option>`).join("");
    let stage="";
    if(p.kind==="orb") stage=`<div class="orb"></div><span class="orb-base"></span>`;
    if(p.kind==="drawer") stage=`<div class="scrim"></div><div class="drawer"><span class="l"></span><span class="l"></span><span class="l"></span></div>`;
    if(p.kind==="button") stage=`<div class="btnpad">Hover me</div>`;
    if(p.kind==="acc") stage=`<div class="acc"><div class="acc__hd">Details <span class="chev">⌄</span></div><div class="acc__body"><p>Height and chevron ride the same token, so the change feels like one gesture.</p></div></div>`;
    if(p.kind==="reveal") stage=`<div class="reveal"><span class="card"></span><span class="card"></span><span class="card"></span></div>`;
    return `<div class="probe" data-i="${i}">
      <div class="probe__hd">
        <select class="probe__kind" data-scope="pkind" data-i="${i}" aria-label="lens">${kinds}</select>
        <select class="probe__sel" data-scope="probe" data-i="${i}" aria-label="intent">${opts}</select>
      </div>
      <div class="probe__stage" data-play="${i}">${stage}</div>
    </div>`;
  }).join("");
}

// ---------- animation ----------
function anim(el,props,r,delay=0){
  el.style.transition="none"; void el.offsetWidth;
  el.style.transition=Object.keys(props).map(p=>`${p} ${r.d} ${r.e} ${delay}ms`).join(", ");
  requestAnimationFrame(()=>{ for(const p in props) el.style[p]=props[p]; });
}
function play(i){
  const p=probes[i], r=resolve(findIntent(p.intent));
  const root=document.querySelector(`.probe[data-i="${i}"]`);
  if(p.kind==="orb"){
    // abstract lens: travel + fade + scale, purely showing the token's character
    const o=root.querySelector(".orb");
    o.style.left="14px"; o.style.opacity=".3"; o.style.transform="translateY(-50%) scale(.5)";
    anim(o,{left:"calc(100% - 40px)",opacity:"1",transform:"translateY(-50%) scale(1)"},r);
    setTimeout(()=>anim(o,{left:"14px",opacity:".3",transform:"translateY(-50%) scale(.5)"},r),1400);
  }
  if(p.kind==="drawer"){
    const dr=root.querySelector(".drawer"),sc=root.querySelector(".scrim");
    dr.style.transform="translateX(105%)";sc.style.opacity="0";
    anim(sc,{opacity:"1"},r);anim(dr,{transform:"translateX(0)"},r);
    setTimeout(()=>{anim(sc,{opacity:"0"},r);anim(dr,{transform:"translateX(105%)"},r);},1400);
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
  if(p.kind==="reveal"){
    const cards=[...root.querySelectorAll(".card")];
    cards.forEach(c=>{c.style.opacity="0";c.style.transform="translateY(14px)";});
    cards.forEach((c,k)=>anim(c,{opacity:"1",transform:"translateY(0)"},r,k*70));
    setTimeout(()=>cards.forEach((c,k)=>anim(c,{opacity:"0",transform:"translateY(14px)"},r,k*40)),1500);
  }
}
function playAll(){ probes.forEach((_,i)=>setTimeout(()=>play(i), i*130)); }

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
    const d=easings[a].bez.reduce((s,v,k)=>s+Math.abs(v-easings[b].bez[k]),0);
    if(d<0.15) dup=[easings[a].name,easings[b].name];
  }
  if(dup) out.push(["warn","!",`“${dup[0]}” and “${dup[1]}” are nearly identical curves. A tight easing set is easier to apply consistently — trim one.`]);
  else out.push(["ok","✓",`${easings.length} distinct easings — a lean, legible set.`]);
  // 3. enter/exit asymmetry
  const en=intents.find(x=>/enter|open|in$/i.test(x.name)), ex=intents.find(x=>/exit|close|out$/i.test(x.name));
  if(en&&ex){
    const de=durMs(en.dur),dx=durMs(ex.dur);
    if(Math.abs(de-dx)<40) out.push(["warn","≠",`“${en.name}” and “${ex.name}” resolve to near-equal durations (${de}/${dx}ms). Real motion is asymmetric — exits should be quicker so leaving feels decisive.`]);
    else if(dx<de) out.push(["ok","✓",`“${ex.name}” (${dx}ms) is quicker than “${en.name}” (${de}ms) — leaving feels decisive.`]);
    else out.push(["warn","!",`“${ex.name}” (${dx}ms) is slower than “${en.name}” (${de}ms). The user already chose to dismiss; a slow exit drags.`]);
  }
  // 4. long-duration budget
  const longIntent = intents.find(x=>durMs(x.dur)>550);
  if(longIntent) out.push(["warn","!",`“${longIntent.name}” resolves to ${durMs(longIntent.dur)}ms. Past ~550ms motion starts to feel like waiting — reserve the top of the ladder for large travel only.`]);
  document.getElementById("hints").innerHTML = out.map(h=>`<div class="rd ${h[0]}"><span class="ic">${h[1]}</span><span>${h[2]}</span></div>`).join("");
}

// ---------- export ----------
let fmt="css";
const isIdent = k => /^[a-z_$][\w$]*$/i.test(k);   // safe as a bare object key?
// CSS keeps syntax-highlight spans (innerHTML); the rest are plain text.
function buildCSS(){
  let s=`<span class="cm">/* Cadence — motion system */</span>\n:root{\n`;
  s+=`  <span class="cm">/* primitives · durations */</span>\n`;
  durations.forEach(d=>s+=`  <span class="tk">--motion-duration-${d.name}</span>: ${d.ms}ms;\n`);
  s+=`\n  <span class="cm">/* primitives · easing */</span>\n`;
  easings.forEach(e=>s+=`  <span class="tk">--motion-ease-${e.name}</span>: ${bezStr(e.bez)};\n`);
  s+=`\n  <span class="cm">/* semantic · intents → reference primitives */</span>\n`;
  intents.forEach(it=>{
    s+=`  <span class="tk2">--motion-${it.name}-duration</span>: <span class="tk">var(--motion-duration-${it.dur})</span>;\n`;
    s+=`  <span class="tk2">--motion-${it.name}-ease</span>: <span class="tk">var(--motion-ease-${it.ease})</span>;\n`;
  });
  return s+`}`;
}
function buildJSON(){
  const obj={primitives:{duration:{},easing:{}},semantic:{}};
  durations.forEach(d=>obj.primitives.duration[d.name]=d.ms+"ms");
  easings.forEach(e=>obj.primitives.easing[e.name]=bezStr(e.bez));
  intents.forEach(it=>obj.semantic[it.name]={duration:`{duration.${it.dur}}`,easing:`{easing.${it.ease}}`,purpose:it.purpose});
  return JSON.stringify(obj,null,2);
}
function buildTailwind(){
  const q=JSON.stringify;
  const dur=[...durations.map(d=>`        ${q(d.name)}: ${q(d.ms+"ms")},`),
             ...intents.map(it=>`        ${q(it.name)}: ${q(durMs(it.dur)+"ms")}, // intent`)];
  const ease=[...easings.map(e=>`        ${q(e.name)}: ${q(bezStr(e.bez))},`),
              ...intents.map(it=>`        ${q(it.name)}: ${q(bezStr(easeBez(it.ease)))}, // intent`)];
  return `// tailwind.config.js — motion tokens from Cadence\n`+
    `module.exports = {\n  theme: {\n    extend: {\n`+
    `      transitionDuration: {\n${dur.join("\n")}\n      },\n`+
    `      transitionTimingFunction: {\n${ease.join("\n")}\n      },\n`+
    `    },\n  },\n};`;
}
function buildStyleDictionary(){
  const obj={motion:{duration:{},easing:{}}};
  durations.forEach(d=>obj.motion.duration[d.name]={value:d.ms+"ms",type:"duration"});
  easings.forEach(e=>obj.motion.easing[e.name]={value:bezStr(e.bez),type:"cubicBezier"});
  intents.forEach(it=>obj.motion[it.name]={
    duration:{value:`{motion.duration.${it.dur}}`,type:"duration"},
    easing:{value:`{motion.easing.${it.ease}}`,type:"cubicBezier"},
  });
  return JSON.stringify(obj,null,2);
}
function buildTS(){
  const key=k=>isIdent(k)?k:JSON.stringify(k), q=JSON.stringify;
  const dur=durations.map(d=>`    ${key(d.name)}: ${q(d.ms+"ms")},`).join("\n");
  const ease=easings.map(e=>`    ${key(e.name)}: ${q(bezStr(e.bez))},`).join("\n");
  const sem=intents.map(it=>`    ${key(it.name)}: { duration: ${q(durMs(it.dur)+"ms")}, easing: ${q(bezStr(easeBez(it.ease)))} },`).join("\n");
  return `// motion.ts — design tokens from Cadence\n`+
    `export const motion = {\n`+
    `  duration: {\n${dur}\n  },\n`+
    `  easing: {\n${ease}\n  },\n`+
    `  // semantic intents (resolved from primitives)\n`+
    `  intent: {\n${sem}\n  },\n} as const;`;
}
function render(){
  const o=document.getElementById("out");
  if(fmt==="css"){ o.innerHTML=buildCSS(); return; }
  const build={json:buildJSON,tailwind:buildTailwind,sd:buildStyleDictionary,ts:buildTS}[fmt]||buildJSON;
  o.textContent=build();
}

// ---------- orchestrate ----------
function refreshTokens(){
  const s=document.documentElement.style;
  durations.forEach(d=>s.setProperty(`--motion-duration-${d.name}`,d.ms+"ms"));
  easings.forEach(e=>s.setProperty(`--motion-ease-${e.name}`,bezStr(e.bez)));
}
function rerenderAll(){ renderDurations();renderEasings();renderIntents();renderBench();refreshTokens();render();critique();writeURL(); }

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

// ---------- shareable state (whole system encoded in the URL hash) ----------
const b64urlEncode = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const b64urlDecode = s => decodeURIComponent(escape(atob(s.replace(/-/g,"+").replace(/_/g,"/"))));
function encodeState(){
  const s = {
    d: durations.map(d=>[d.name,d.ms]),
    e: easings.map(e=>[e.name,...e.bez]),
    i: intents.map(it=>[it.name,it.dur,it.ease,it.purpose||""]),
    p: probes.map(pb=>{ const k=intents.findIndex(x=>x.id===pb.intent); return [pb.kind, k<0?0:k]; }),
  };
  return b64urlEncode(JSON.stringify(s));
}
function applyEncoded(raw){ applyState(JSON.parse(b64urlDecode(raw))); }
// mutate the model in place from a parsed state object; throws on malformed input
function applyState(o){
  if(!o||!Array.isArray(o.d)||!Array.isArray(o.e)||!Array.isArray(o.i)) throw new Error("bad state");
  const d = o.d.map(x=>({name:String(x[0]),ms:+x[1]||200}));
  const e = o.e.map(x=>({name:String(x[0]),bez:[+x[1],+x[2],+x[3],+x[4]]}));
  const it = o.i.map(x=>({id:nid(),name:String(x[0]),dur:String(x[1]),ease:String(x[2]),purpose:String(x[3]||"")}));
  if(!d.length||!e.length||!it.length) throw new Error("empty scale");
  durations=d; easings=e; intents=it;
  // intents that reference a now-missing name fall back to the first slot
  const dn=new Set(durations.map(x=>x.name)), en=new Set(easings.map(x=>x.name));
  intents.forEach(x=>{ if(!dn.has(x.dur))x.dur=durations[0].name; if(!en.has(x.ease))x.ease=easings[0].name; });
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
function writeURL(){
  try{ history.replaceState(null,"",location.pathname+location.search+"#"+encodeState()); }catch(_){}
}

function updateResolvedLines(){
  document.querySelectorAll(".intent__resolved").forEach((el,k)=>{
    if(!intents[k]) return;
    const r=resolve(intents[k]); el.textContent=`→ ${r.d} · ${r.e}`;
  });
}

// ---------- events (delegated) ----------
document.addEventListener("input", e=>{
  const t=e.target, sc=t.dataset.scope, i=+t.dataset.i;
  if(sc==="dur"){ durations[i].ms=+t.value; refreshTokens(); renderDurations(); render(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="iname"){ intents[i].name=t.value.trim()||intents[i].name; render(); critique(); writeURL(); }
});
// rename a scale slot (duration or easing); intents reference by name, so
// carry every referencing intent over to the new name. `kind` is "dur"|"ease".
function renameScale(arr, i, raw, kind){
  const old = arr[i].name, s = slug(raw);
  if(!s){ rerenderAll(); return; }        // empty/invalid → keep old name
  const next = uniqueName(s, arr, i);
  if(next!==old){
    arr[i].name = next;
    intents.forEach(it=>{ if(it[kind]===old) it[kind]=next; });
  }
  rerenderAll();
}
document.addEventListener("change", e=>{
  const t=e.target, sc=t.dataset.scope, i=+t.dataset.i;
  if(sc==="ease"){ if(PRESETS[t.value]){ easings[i].bez=PRESETS[t.value].slice(); rerenderAll(); } }
  if(sc==="dname"){ renameScale(durations,i,t.value,"dur"); }
  if(sc==="ename"){ renameScale(easings,i,t.value,"ease"); }
  if(sc==="idur"){ intents[i].dur=t.value; refreshTokens(); render(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="iease"){ intents[i].ease=t.value; render(); critique(); updateResolvedLines(); writeURL(); }
  if(sc==="probe"){ probes[i].intent=t.value; writeURL(); }
  if(sc==="pkind"){ probes[i].kind=t.value; renderBench(); writeURL(); }
});
document.addEventListener("click", e=>{
  const playT=e.target.closest("[data-play]");
  if(playT){ play(+playT.dataset.play); return; }
  const t=e.target, sc=t.dataset.scope, i=+t.dataset.i;
  if(sc==="irm"){ if(intents.length>1){ const gone=intents[i].id; intents.splice(i,1);
      probes.forEach(p=>{if(p.intent===gone)p.intent=intents[0].id;}); rerenderAll(); } }
  if(sc==="drm"){ if(durations.length>1){ const g=durations[i].name; durations.splice(i,1);
      const fb=durations[0].name; intents.forEach(it=>{if(it.dur===g)it.dur=fb;}); rerenderAll(); } }
  if(sc==="erm"){ if(easings.length>1){ const g=easings[i].name; easings.splice(i,1);
      const fb=easings[0].name; intents.forEach(it=>{if(it.ease===g)it.ease=fb;}); rerenderAll(); } }
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
document.getElementById("addDuration").addEventListener("click",()=>{
  const last=durations[durations.length-1];
  const ms=Math.min(1000,Math.max(60, last?Math.round(last.ms*1.5):300));
  durations.push({name:uniqueName("step",durations),ms});
  rerenderAll();
});
document.getElementById("addEasing").addEventListener("click",()=>{
  easings.push({name:uniqueName("custom",easings),bez:PRESETS.standard.slice()});
  rerenderAll();
});
document.getElementById("addIntent").addEventListener("click",()=>{
  intents.push({id:nid(),name:"custom",dur:"base",ease:"standard",purpose:"your own"});
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

// restore a shared system from the URL hash before the first render
(function initFromURL(){
  const h=location.hash.replace(/^#/,"");
  if(h){ try{ applyEncoded(h); }catch(_){ /* malformed link → keep defaults */ } }
})();
// re-apply when the hash changes on an already-open page (pasting a shared
// link into the address bar, or back/forward). Our own writes use
// replaceState, which never fires hashchange — so this can't loop.
window.addEventListener("hashchange", ()=>{
  const h=location.hash.replace(/^#/,"");
  if(!h || h===encodeState()) return;
  try{ applyEncoded(h); rerenderAll(); }catch(_){}
});

rerenderAll();
if(!reduce) setTimeout(playAll,500);
