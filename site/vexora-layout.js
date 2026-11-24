/* VEXORA premium layout (from the approved references):
   1) top navigation bar with the main sections + "المزيد" drawer for everything else
   2) logged-in home: welcome, platform tools, live XAUUSD chart, learning, quick access
   3) visitor landing hero with the six services
   Links point to the existing sections; no data is invented. */
(()=>{
"use strict";
const I=n=>window.VXG?window.VXG.svg(n,"vxs-nav"):"";
const MAIN=[["app.html","chartUp","الرئيسية",""],["app.html#ai","spark","التحليل الذكي","ai"],["app.html#trades","target","التوصيات","trades"],["app.html#copier","link","ناسخ الصفقات","copier"],["index.html#courses","cap","الأكاديمية",""],["app.html#news","doc","أخبار الأسواق","news"],["index.html#indicators","chart","المؤشرات",""]];
const TOOLS=[["app.html#ai","spark","التحليل الذكي","تحليل شامل ومتعدد الأساليب"],["app.html#trades","target","التوصيات","فرص تداول مدروسة"],["app.html#copier","link","ناسخ الصفقات","مزامنة صفقات احترافية"],["index.html#courses","cap","الأكاديمية","دورات تدريبية متكاملة"],["app.html#news","doc","أخبار الأسواق","أهم الأحداث والتأثيرات"],["index.html#indicators","chart","المؤشرات","أدوات تحليل احترافية"]];
const sec=()=>(location.hash||"#").slice(1).split("?")[0];
function nav(){
  const top=document.querySelector("#app > header.top")||document.querySelector("body > header.top .wrap");if(!top||top.querySelector(".vxs-main"))return;
  document.body.classList.add("vxs-topnav");const old=top.querySelector(":scope > nav.nav");if(old)old.classList.add("vxs-old");top.querySelectorAll("a").forEach(a=>{if(!a.closest(".vxs-main")&&/منصة التوصيات/.test(a.textContent)&&!a.closest(".umenu"))a.classList.add("vxs-old")});
  const n=document.createElement("nav");n.className="vxs-main";n.setAttribute("aria-label","الأقسام الرئيسية");
  n.innerHTML=MAIN.map(([h,i,t,k])=>`<a href="${h}" data-k="${k}">${I(i)}<span>${t}</span></a>`).join("")+`<button type="button" class="vxs-more" aria-expanded="false">${I("gear")}<span>المزيد</span></button>`;
  const brand=top.querySelector(".brand");brand?brand.after(n):top.prepend(n);
  const more=n.querySelector(".vxs-more");more.onclick=()=>{const on=!document.body.classList.contains("vxs-drawer");document.body.classList.toggle("vxs-drawer",on);more.setAttribute("aria-expanded",on)};
  document.addEventListener("click",e=>{if(document.body.classList.contains("vxs-drawer")&&!e.target.closest("#gside,.vxs-more")){document.body.classList.remove("vxs-drawer");more.setAttribute("aria-expanded","false")}});
  mark();
}
const LN={ar:"العربية",en:"English",fr:"Français",de:"Deutsch",uz:"Oʻzbek",ckb:"کوردی سۆرانی",kmr:"Kurdî",tr:"Türkçe"};
function globe(){const top=document.querySelector("#app > header.top .tright")||document.querySelector("body > header.top .wrap");const gl=document.querySelector(".glang");
  if(!top||!gl||top.querySelector(".vxs-globe"))return;const btns=[...gl.querySelectorAll("button[data-l]")];if(!btns.length)return;
  const cur=(btns.find(b=>b.classList.contains("on"))||btns[0]).dataset.l;
  const w=document.createElement("div");w.className="vxs-globe";
  w.innerHTML=`<button type="button" class="vxs-gbtn" aria-haspopup="true" aria-expanded="false" aria-label="اللغة">${I("globe")}<span>${(LN[cur]||cur).split(" ")[0]}</span></button><div class="vxs-gmenu" hidden>${btns.map(b=>`<button type="button" data-l="${b.dataset.l}" class="${b.dataset.l===cur?"on":""}">${LN[b.dataset.l]||b.textContent}</button>`).join("")}</div>`;
  if(top.classList.contains('wrap'))top.append(w);else top.prepend(w);const m=w.querySelector(".vxs-gmenu"),t=w.querySelector(".vxs-gbtn");
  t.onclick=e=>{e.stopPropagation();m.hidden=!m.hidden;t.setAttribute("aria-expanded",!m.hidden)};
  m.onclick=e=>{const x=e.target.closest("[data-l]");if(!x)return;const o=btns.find(b=>b.dataset.l===x.dataset.l);if(o)o.click();m.hidden=true};
  document.addEventListener("click",()=>{m.hidden=true;t.setAttribute("aria-expanded","false")})}
function mark(){const k=sec();document.querySelectorAll(".vxs-main a").forEach(a=>{const ak=a.dataset.k;const isApp=/app\.html/.test(location.pathname)||/\/app$/.test(location.pathname);
  const href=a.getAttribute("href"),toIdx=href.startsWith("index.html");
  a.classList.toggle("on",isApp?(!toIdx&&(ak===k&&ak!==""||href==="app.html"&&(k===""||k==="home"))):(toIdx&&k!==""&&href==="index.html#"+k))})}
function loadTV(){if(window.TradingView)return Promise.resolve();return new Promise((ok,bad)=>{const s=document.createElement("script");s.src="https://s3.tradingview.com/tv.js";s.async=true;s.onload=ok;s.onerror=bad;document.head.appendChild(s)})}
function home(){
  const tv=document.getElementById("terminalView");if(!tv||document.getElementById("vxsHome"))return;
  const name=(document.getElementById("uName")||{}).textContent||"";
  const h=document.createElement("section");h.id="vxsHome";h.className="vxs-home";
  h.innerHTML=`
  <div class="vxs-col vxs-c1">
    <article class="vxs-card vxs-welcome"><span class="vxs-mark"><img src="logo-mark.png" alt=""></span><div><h2>مرحباً بك في فيكسورا${name&&!/^(مستخدم|—|-)$/.test(name.trim())?"، "+name.trim().split(" ")[0]:""}</h2><p>منصتك المتكاملة للتحليل والتداول والتعلم.</p></div></article>
    <article class="vxs-card"><h3>أدوات المنصة</h3><div class="vxs-tools">${TOOLS.map(([hr,i,t])=>`<a href="${hr}">${I(i)}<span>${t}</span></a>`).join("")}</div></article>
  </div>
  <article class="vxs-card vxs-chart"><div class="vxs-ch"><b>XAUUSD</b><small>الذهب / الدولار الأمريكي</small><span class="vxs-live">سعر مباشر من TradingView</span></div><div id="vxsTV" class="vxs-tv"><div class="vxs-empty">يتم تحميل الشارت…</div></div></article>
  <div class="vxs-col vxs-c3">
    <article class="vxs-card"><h3>${I("cap")} مسارك التعليمي</h3><p class="vxs-sub">كمّل من وين ما وقفت بدروس قصيرة وتمارين.</p><a class="vxs-btn2" href="index.html#path">${I("arrowL")} متابعة التعلّم</a></article>
    <article class="vxs-card"><h3>${I("bolt")} وصول سريع</h3><div class="vxs-quick">${[["app.html#deep","search","التحليل التفصيلي"],["app.html#record","clip","سجل الأداء"],["app.html#news/calendar","clock","التقويم الاقتصادي"],["app.html#rewards","trophy","المسابقات والجوائز"],["partners.html#partner","users","شركاء فيكسورا"]].map(([hr,i,t])=>`<a href="${hr}">${I(i)}<span>${t}</span><i>‹</i></a>`).join("")}</div></article>
  </div>`;
  tv.prepend(h);
  loadTV().then(()=>{try{new window.TradingView.widget({container_id:"vxsTV",autosize:true,symbol:"OANDA:XAUUSD",interval:"60",timezone:"Etc/UTC",theme:"dark",style:"1",locale:"ar_AE",hide_side_toolbar:true,hide_top_toolbar:false,allow_symbol_change:true,withdateranges:true,save_image:false,
    toolbar_bg:"#14120f",backgroundColor:"#14120f",gridColor:"rgba(216,180,106,0.06)",
    overrides:{"paneProperties.background":"#14120f","paneProperties.backgroundType":"solid","mainSeriesProperties.candleStyle.upColor":"#e7c784","mainSeriesProperties.candleStyle.downColor":"#6b5a3a","mainSeriesProperties.candleStyle.borderUpColor":"#e7c784","mainSeriesProperties.candleStyle.borderDownColor":"#8a7650","mainSeriesProperties.candleStyle.wickUpColor":"#e7c784","mainSeriesProperties.candleStyle.wickDownColor":"#8a7650"}})}catch(e){}})
  .catch(()=>{const t=document.getElementById("vxsTV");if(t)t.innerHTML=`<div class="vxs-empty">ما گدرنا نحمّل الشارت. تأكد من الإنترنت.</div>`});
}
function landing(){
  const g=document.getElementById("gate");if(!g||g.querySelector(".vxs-land"))return;
  const d=document.createElement("section");d.className="vxs-land";
  d.innerHTML=`<div class="vxs-hero"><div class="vxs-hero-tx"><small>منصة فيكسورا للتداول والتحليل</small><h1>تحليل <em>احترافي</em><span class="vxs-sep"> · </span><br class="vxs-mbr">تعليم متكامل<br>وأدوات تداول متقدمة</h1>
    <p>بيئة متكاملة تجمع بين التحليل الدقيق، التوصيات، ناسخ الصفقات، والأكاديمية لتطوير مهاراتك في التداول.</p>
    <div class="vxs-cta"><a class="vxs-btn" href="#signup">انضم الآن ${I("arrowL")}</a><a class="vxs-btn2" href="index.html#join">${I("arrowR")} كيف تنضم</a><button type="button" class="vxs-btn2 vxs-play" data-vxi="join">▶ شاهد فيديو الانضمام</button></div></div></div>
    <div class="vxs-svc">${TOOLS.map(([hr,i,t,s])=>`<a href="${hr}">${I(i)}<b>${t}</b><span>${s}</span></a>`).join("")}</div>
    <p class="vxs-risk">التداول ينطوي على مخاطر عالية، والمحتوى تعليمي ولا يعتبر نصيحة استثمارية.</p>`;
  g.prepend(d);
  trust(g);
}
function trust(g){
  if(g.querySelector(".vxs-trust"))return;
  const W=[["clip","سجل أداء شفاف","كل صفقة تُسجَّل بنتيجتها، الرابحة والخاسرة.","app.html#record"],
    ["cap","أول درس مجاني","ابدأ أي دورة بدرسها الأول قبل أن تشترك.","index.html#courses"],
    ["users","كوتشات حقيقيون","دروس زوم مباشرة ومتابعة مع فريق فيكسورا.","index.html#coach"],
    ["target","أسباب واضحة لكل صفقة","منطقة الدخول ووقف الخسارة والأهداف مع سبب الدخول.","app.html#trades"]];
  const S=[["افتح حسابك مع INFINOX","الوصول للمنصة متاح لعملاء الوسيط الشريك."],["أكمل ملفك الشخصي","سجّل بالموقع وأدخل رقم حسابك."],["التفعيل من الإدارة","تتم مراجعة الطلب وتفعيل حسابك."]];
  const t=document.createElement("section");t.className="vxs-trust";t.setAttribute("aria-label","لماذا فيكسورا");
  t.innerHTML=`<h2>لماذا <em>فيكسورا</em>؟</h2>
    <div class="vxs-why">${W.map(([i,h,p,u])=>`<a href="${u}">${I(i)}<b>${h}</b><span>${p}</span></a>`).join("")}</div>
    <h2>ثلاث خطوات للانضمام</h2>
    <ol class="vxs-steps">${S.map(([h,p],n)=>`<li><i>${n+1}</i><b>${h}</b><span>${p}</span></li>`).join("")}</ol>`;
  const f=document.createElement("footer");f.className="vxs-foot";
  f.innerHTML=`<div class="vxs-fl"><a href="index.html">الأكاديمية</a><a href="learn-trading.html">تعلّم التداول</a><a href="free-tools.html">حاسبة نقطة التعادل</a><a href="partners.html">برنامج الشركاء</a><a href="privacy.html">سياسة الخصوصية</a><a href="terms.html">شروط الاستخدام</a><a href="https://t.me/omo_rabah" target="_blank" rel="noopener">الدعم عبر تيليجرام</a></div>
    <p>التداول بالعملات والذهب والعملات الرقمية ينطوي على مخاطر عالية وقد يؤدي إلى خسارة رأس المال. المحتوى تعليمي ولا يُعدّ نصيحة استثمارية، والنتائج السابقة لا تضمن النتائج المستقبلية.</p>
    <p>© ${new Date().getFullYear()} فيكسورا للتجارة العامة ذ.م.م · أبوظبي، الإمارات العربية المتحدة</p>`;
  g.append(t,f);
}
function run(){try{nav();globe();mark();landing();if(sec()===""||sec()==="home")home()}catch(e){}}
const go=()=>{run();setTimeout(run,700);setTimeout(run,2000)};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();
addEventListener("hashchange",()=>setTimeout(run,120));
new MutationObserver(()=>{if(!document.querySelector(".vxs-main"))run()}).observe(document.documentElement,{childList:true,subtree:false});
})();
