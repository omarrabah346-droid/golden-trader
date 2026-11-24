/* VEXORA Partners · gold finish for the in-app partner portal.
   1) Swaps emoji for line icons in the brand gold.  2) Recolours any leftover purple/blue accents to gold.
   Visual only: it never changes data, links or handlers. */
(()=>{
"use strict";
const ROOT_ID="v5PartView";
const P={ /* 24x24 stroke paths */
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  back:'<path d="M9 14l-5-5 5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3"/>',
  medal:'<circle cx="12" cy="15" r="6"/><path d="M8 3l2 6M16 3l-2 6M8 3h8"/>',
  gem:'<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 18 3-18"/>',
  bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  arrowL:'<path d="M19 12H5M11 6l-6 6 6 6"/>',arrowR:'<path d="M5 12h14M13 6l6 6-6 6"/>',arrowD:'<path d="M12 4v14M6 12l6 6 6-6"/>',
  money:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.7-3.6 3.4-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  cap:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6v4H9z"/>',
  gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12"/><path d="M12 8S10.5 3 8 4s0 4 4 4zM12 8s1.5-5 4-4 0 4-4 4z"/>',
  crown:'<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  scale:'<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',chartUp:'<path d="M3 20h18"/><path d="M5 16l5-5 4 3 6-7"/><path d="M15 7h5v5"/>',
  tree:'<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M12 7.5V12M6 16.5V14h12v2.5M12 12v2"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5S13 18 13 17s.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
  film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  pin:'<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  ruler:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  wave:'<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  receipt:'<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  payout:'<path d="M3 7h18v10H3z"/><path d="M12 10v4M10 12h4"/><path d="M7 21h10"/>',
  scroll:'<path d="M6 3h11a2 2 0 0 1 2 2v12"/><path d="M6 3a2 2 0 0 0-2 2v2h4"/><path d="M8 5v14a2 2 0 0 0 4 0v-2h9v2a2 2 0 0 1-2 2H10"/>',
  briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
  store:'<path d="M4 9l1-5h14l1 5"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/>',
  bank:'<path d="M3 9l9-5 9 5"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>',
  doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  pen:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  warn:'<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17v.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.01"/>',
  paperclip:'<path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>',
  inbox:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  save:'<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  bag:'<path d="M6 7h12l1 14H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 17v.01"/>',
  rocket:'<path d="M12 3c4 2 6 6 6 10l-3 3H9l-3-3c0-4 2-8 6-10z"/><circle cx="12" cy="10" r="2"/><path d="M9 16l-2 5 5-3 5 3-2-5"/>',
  teacher:'<circle cx="8" cy="7" r="3"/><path d="M3 21c.5-4 2.5-6 5-6s4.5 2 5 6"/><path d="M12 4h9v8h-6"/>',
  newb:'<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 15v-6l3 6V9M12 9h-2v6h2M10 12h2M15 9l1 6 1.5-4 1.5 4 1-6"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  fire:'<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  x:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  dot:'<circle cx="12" cy="12" r="3"/>'
};
const MAP={"🔒":"lock","🔓":"lock","↩":"back","↪":"back","🧪":"flask","🥇":"m1","🥈":"m2","🥉":"m3","🏅":"medal","🎖":"medal","💎":"gem","⚡":"bolt",
  "⬅":"arrowL","➡":"arrowR","⬇":"arrowD","↗":"arrowR","💵":"money","💰":"money","💲":"money","💸":"payout","👥":"users","👤":"user","🧑":"user","🔗":"link","📋":"clip",
  "🎓":"cap","🏆":"trophy","🎁":"gift","👑":"crown","♛":"crown","🎙":"mic","⚖":"scale","📊":"chart","📈":"chartUp","🌳":"tree","✨":"spark","✦":"spark","⚙":"gear","🛠":"gear",
  "🎨":"palette","🖼":"image","🎬":"film","📌":"pin","📍":"pin","🎯":"target","📐":"ruler","🌊":"wave","🧾":"receipt","📜":"scroll","💼":"briefcase","🏬":"store","🏪":"store",
  "🏦":"bank","📄":"doc","📝":"pen","✍":"pen","✅":"check","✔":"check","☑":"check","⚠":"warn","ℹ":"info","📎":"paperclip","📮":"inbox","💾":"save","💬":"chat","➕":"plus",
  "🧮":"calc","❓":"help","❔":"help","🚀":"rocket","🧑‍🏫":"teacher","🆕":"newb","🔔":"bell","⭐":"star","🌟":"star","🔥":"fire","🌍":"globe","🌐":"globe","⏳":"clock","⏰":"clock",
  "🕒":"clock","🔑":"key","🛡":"shield","📧":"mail","✉":"mail","📱":"phone","🔍":"search","🔎":"search","❌":"x","✖":"x","🤝":"users","📣":"bell","📢":"bell","🎧":"chat","🏠":"chart","ℹ️":"info"};
const svg=(n,cls)=>{
  if(n==="m1"||n==="m2"||n==="m3"){const k=n[1];return`<svg class="vxg-ic vxg-medal ${cls||""}" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2l2.5 6M16 2l-2.5 6" stroke="#a88645" stroke-width="1.6" fill="none"/><circle cx="12" cy="15" r="7" fill="url(#vxgM${k})" stroke="#f0d79b" stroke-width=".8"/><text x="12" y="18.6" text-anchor="middle" font-size="9.5" font-weight="700" fill="#1b140a" font-family="Georgia,serif">${k}</text></svg>`}
  return`<svg class="vxg-ic ${cls||""}" viewBox="0 0 24 24" aria-hidden="true">${P[n]||P.dot}</svg>`};
const DEFS='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><radialGradient id="vxgM1" cx=".35" cy=".3"><stop offset="0" stop-color="#fbe6b0"/><stop offset="1" stop-color="#b98d48"/></radialGradient><radialGradient id="vxgM2" cx=".35" cy=".3"><stop offset="0" stop-color="#f1efe8"/><stop offset="1" stop-color="#9c9a92"/></radialGradient><radialGradient id="vxgM3" cx=".35" cy=".3"><stop offset="0" stop-color="#f0c39a"/><stop offset="1" stop-color="#9a5f33"/></radialGradient></defs></svg>';
const RE=/(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*|[↩↪⬅➡⬇↗♛✦✔☑ℹ✖✉⚖⚙⚠⚡✍])️?/gu;
const SKIP=new Set(["SCRIPT","STYLE","TEXTAREA","INPUT","SELECT","OPTION","CODE","PRE","svg","SVG"]);
function swapEmoji(root){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;if(!p||SKIP.has(p.tagName)||p.closest("svg,[contenteditable]"))return NodeFilter.FILTER_REJECT;RE.lastIndex=0;return RE.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
  const list=[];while(w.nextNode())list.push(w.currentNode);
  for(const t of list){
    const html=t.nodeValue.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])).replace(RE,m=>{const k=MAP[m]||MAP[m.replace(/️/g,"")];return k?svg(k):""});
    const span=document.createElement("span");span.className="vxg-t";span.innerHTML=html;t.replaceWith(span);
  }
}
/* leftover purple / blue accents → gold */
const isCool=s=>(s.match(/rgba?\([^)]*\)/g)||[]).some(x=>{const[r,g,b,a]=x.match(/[\d.]+/g).map(Number);return(a===undefined||a>.04)&&b>r+35&&b>g+30});
function recolor(root){
  root.querySelectorAll("*").forEach(e=>{
    if(e.closest("svg"))return;
    const cs=getComputedStyle(e);
    if(isCool(cs.backgroundImage)){e.style.setProperty("background-image","linear-gradient(180deg,rgba(40,34,26,.9),rgba(16,14,11,.92))","important")}
    if(isCool(cs.backgroundColor)){e.style.setProperty("background-color","rgba(216,180,106,.1)","important")}
    if(isCool(cs.borderTopColor+cs.borderLeftColor+cs.borderRightColor+cs.borderBottomColor)){e.style.setProperty("border-color","rgba(216,180,106,.35)","important")}
    if(isCool(cs.color)){e.style.setProperty("color","#e7c784","important");e.style.setProperty("-webkit-text-fill-color","#e7c784","important")}
    if(isCool(cs.boxShadow)){e.style.setProperty("box-shadow","none","important")}
    if(isCool(cs.textShadow)){e.style.setProperty("text-shadow","none","important")}
  });
}
let q=0;
function run(){q=0;const r=document.getElementById(ROOT_ID);if(!r||r.hidden)return;mo.disconnect();try{swapEmoji(r);recolor(r)}finally{mo.observe(document.body,{childList:true,subtree:true,characterData:true})}}
const mo=new MutationObserver(()=>{if(!q)q=requestAnimationFrame(run)});
function start(){if(!document.getElementById("vxgDefs")){const d=document.createElement("div");d.id="vxgDefs";d.innerHTML=DEFS;document.body.appendChild(d)}
  mo.observe(document.body,{childList:true,subtree:true,characterData:true});run();addEventListener("hashchange",()=>setTimeout(run,60))}
/* the redesigned dashboard / landing / owner pages live in partners.html */
const NEW={"#partner/dashboard":"partners.html#partner","#partners":"partners.html#join","#partners/links":"partners.html#partner/link","#partners/money":"partners.html#partner/payouts","#partners/apply":"partners.html#apply","#partners/team":"partners.html#team","#partners/ranks":"partners.html#ranks","#partners/plan":"partners.html#plan","#partners/lead":"partners.html#lead","#partners/help":"partners.html#help","#partners/agreement":"partners.html#agreement","#partners/ib":"partners.html#ib","#partners/marketing":"app.html#marketing","#admin/partners":"partners.html#owner"};
const LEGACY=/[?&]legacy=1\b/.test(location.search);
function reroute(){if(LEGACY)return;const t=NEW[location.hash];if(t)location.replace(t)}
reroute();addEventListener("hashchange",reroute);
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest('a[href]');if(!a)return;const h=a.getAttribute("href");if(!LEGACY&&NEW[h]){e.preventDefault();location.assign(NEW[h])}},true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
