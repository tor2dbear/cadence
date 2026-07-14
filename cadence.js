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
let probes = [
  {type:"drawer",label:"drawer",intent:null},
  {type:"button",label:"button hover",intent:null},
  {type:"acc",label:"accordion",intent:null},
  {type:"reveal",label:"list reveal",intent:null},
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
// default probe intents
probes[0].intent = intents[0].id; probes[1].intent = intents[4].id;
probes[2].intent = intents[2].id; probes[3].intent = intents[0].id;

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

// ---------- render: easing set ----------
function curveSVG(bez,color){
  const X=x=>x*100,Y=y=>100-y*100;
  return `<svg viewBox="0 0 100 100"><line x1="0" y1="100" x2="100" y2="0" stroke="#333940" stroke-width="2" stroke-dasharray="4 4"/>
    <path d="M0,100 C${X(bez[0])},${Y(bez[1])} ${X(bez[2])},${Y(bez[3])} 100,0" fill="none" stroke="${color}" stroke-width="4"/></svg>`;
}
function renderEasings(){
  const el=document.getElementById("easings");
  el.innerHTML = easings.map((e,i)=>`
    <div class="ecard">
      <div class="ecard__top">${curveSVG(e.bez,"var(--accent)")}<input class="ecard__name" value="${e.name}" data-scope="ename" data-i="${i}" aria-label="easing name" spellcheck="false"><button class="ecard__rm" data-scope="erm" data-i="${i}" title="remove easing" aria-label="remove ${e.name}">×</button></div>
      <select data-scope="ease" data-i="${i}" aria-label="${e.name} curve">
        ${Object.keys(PRESETS).map(k=>`<option ${JSON.stringify(PRESETS[k])===JSON.stringify(e.bez)?"selected":""}>${k}</option>`).join("")}
      </select>
    </div>`).join("");
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
    let stage="";
    if(p.type==="drawer") stage=`<div class="scrim"></div><div class="drawer"><span class="l"></span><span class="l"></span><span class="l"></span></div>`;
    if(p.type==="button") stage=`<div class="btnpad">Hover me</div>`;
    if(p.type==="acc") stage=`<div class="acc"><div class="acc__hd">Details <span class="chev">⌄</span></div><div class="acc__body"><p>Height and chevron ride the same token, so the change feels like one gesture.</p></div></div>`;
    if(p.type==="reveal") stage=`<div class="reveal"><span class="card"></span><span class="card"></span><span class="card"></span></div>`;
    return `<div class="probe" data-i="${i}">
      <div class="probe__hd">
        <span class="probe__name">${p.label}</span>
        <select class="probe__sel" data-scope="probe" data-i="${i}" aria-label="intent for ${p.label}">${opts}</select>
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
  if(p.type==="drawer"){
    const dr=root.querySelector(".drawer"),sc=root.querySelector(".scrim");
    dr.style.transform="translateX(105%)";sc.style.opacity="0";
    anim(sc,{opacity:"1"},r);anim(dr,{transform:"translateX(0)"},r);
    setTimeout(()=>{anim(sc,{opacity:"0"},r);anim(dr,{transform:"translateX(105%)"},r);},1400);
  }
  if(p.type==="button"){
    const b=root.querySelector(".btnpad");
    b.style.transform="translate(-50%,-50%) scale(1)";
    anim(b,{transform:"translate(-50%,-50%) scale(1.14)"},r);
    setTimeout(()=>anim(b,{transform:"translate(-50%,-50%) scale(1)"},r),900);
  }
  if(p.type==="acc"){
    const b=root.querySelector(".acc__body"),c=root.querySelector(".chev");
    b.style.transition=`height ${r.d} ${r.e}`;c.style.transition=`transform ${r.d} ${r.e}`;
    b.style.height="0px";c.style.transform="rotate(0deg)";
    requestAnimationFrame(()=>{b.style.height=b.scrollHeight+"px";c.style.transform="rotate(180deg)";});
    setTimeout(()=>{b.style.height="0px";c.style.transform="rotate(0deg)";},1500);
  }
  if(p.type==="reveal"){
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
function render(){
  const o=document.getElementById("out");
  if(fmt==="css"){
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
    s+=`}`;
    o.innerHTML=s;
  } else {
    const obj={primitives:{duration:{},easing:{}},semantic:{}};
    durations.forEach(d=>obj.primitives.duration[d.name]=d.ms+"ms");
    easings.forEach(e=>obj.primitives.easing[e.name]=bezStr(e.bez));
    intents.forEach(it=>obj.semantic[it.name]={duration:`{duration.${it.dur}}`,easing:`{easing.${it.ease}}`,purpose:it.purpose});
    o.textContent=JSON.stringify(obj,null,2);
  }
}

// ---------- orchestrate ----------
function refreshTokens(){
  const s=document.documentElement.style;
  durations.forEach(d=>s.setProperty(`--motion-duration-${d.name}`,d.ms+"ms"));
  easings.forEach(e=>s.setProperty(`--motion-ease-${e.name}`,bezStr(e.bez)));
}
function rerenderAll(){ renderDurations();renderEasings();renderIntents();renderBench();refreshTokens();render();critique(); }

function updateResolvedLines(){
  document.querySelectorAll(".intent__resolved").forEach((el,k)=>{
    if(!intents[k]) return;
    const r=resolve(intents[k]); el.textContent=`→ ${r.d} · ${r.e}`;
  });
}

// ---------- events (delegated) ----------
document.addEventListener("input", e=>{
  const t=e.target, sc=t.dataset.scope, i=+t.dataset.i;
  if(sc==="dur"){ durations[i].ms=+t.value; refreshTokens(); renderDurations(); render(); critique(); updateResolvedLines(); }
  if(sc==="iname"){ intents[i].name=t.value.trim()||intents[i].name; render(); critique(); }
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
  if(sc==="ease"){ easings[i].bez=PRESETS[t.value].slice(); rerenderAll(); }
  if(sc==="dname"){ renameScale(durations,i,t.value,"dur"); }
  if(sc==="ename"){ renameScale(easings,i,t.value,"ease"); }
  if(sc==="idur"){ intents[i].dur=t.value; refreshTokens(); render(); critique(); updateResolvedLines(); }
  if(sc==="iease"){ intents[i].ease=t.value; render(); critique(); updateResolvedLines(); }
  if(sc==="probe"){ probes[i].intent=t.value; }
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

rerenderAll();
if(!reduce) setTimeout(playAll,500);
