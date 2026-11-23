(()=>{
"use strict";
const CFG={URL:"https://rczvkpzxkwxzoivyiblo.supabase.co",KEY:"sb_publishable_S4Huon2QXOIltvxoFIDdXQ_h79LR245",APP:"app.html"};
const PREVIEW=/[?&]preview=1\b/.test(location.search);
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic=(n,c="")=>`<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const num=v=>Number(v||0);
const money=v=>"$ "+num(v).toLocaleString("en-US",{minimumFractionDigits:num(v)%1?2:0,maximumFractionDigits:2});
const money2=v=>"$ "+num(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const intf=v=>num(v).toLocaleString("en-US");
const dAr=d=>{try{return new Date(d).toLocaleDateString("ar-IQ-u-nu-latn",{day:"numeric",month:"long",year:"numeric"})}catch(e){return ""}};
const toast=m=>{const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)};
const STATUS={APPROVED:["نشط","ok"],PENDING:["قيد المراجعة","wait"],UNDER_REVIEW:["قيد المراجعة","wait"],REJECTED:["مرفوض","bad"],SUSPENDED:["موقوف مؤقتاً","bad"],
  requested:["قيد المراجعة","wait"],approved:["معتمد","wait"],paid:["تمت الموافقة","ok"],rejected:["مرفوض","bad"],
  PAID:["مدفوعة","ok"],VERIFIED:["قيد المراجعة","wait"],CANCELLED:["ملغاة","bad"]};
const pill=s=>{const[t,c]=STATUS[s]||[s||"—","wait"];return`<span class="pill ${c}">${esc(t)}</span>`};

/* ---------------- data layer ---------------- */
let sb=null,session=null,profile=null;
async function boot(){
  if(PREVIEW)return;
  if(!window.supabase)return;
  sb=window.supabase.createClient(CFG.URL,CFG.KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  const r=await sb.auth.getSession();session=r.data&&r.data.session;
  if(session){const p=await sb.from("profiles").select("id,full_name,role,status").eq("id",session.user.id).maybeSingle();profile=p.data||null}
}
async function rpc(n,a){if(!sb)throw new Error("NO_CLIENT");const r=await sb.rpc(n,a||{});if(r.error)throw r.error;return r.data}
const isOwner=()=>PREVIEW||(profile&&profile.role==="admin");
const API={
  portal:()=>PREVIEW?DEMO.portal:rpc("partner_portal"),
  dash:()=>PREVIEW?DEMO.dash:rpc("partner_dash"),
  admin:()=>PREVIEW?DEMO.admin:rpc("admin_partners_data"),
  decide:(pid,st,nt)=>PREVIEW?Promise.resolve():rpc("admin_partner_decide",{pid,st,nt}),
  payoutDecide:(pid,act,nt,ref)=>PREVIEW?Promise.resolve():rpc("admin_payout_decide",{pid,act,nt,ref}),
  payoutReq:(meth,det)=>PREVIEW?Promise.resolve():rpc("partner_payout_request",{meth,det}),
};

/* Preview-only sample data. Shown with a visible banner; never sent anywhere. */
const day=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)};
const DEMO={
  portal:{me:null,min_payout:"50"},
  dash:{code:"DEMO01",name:"شريك تجريبي",sum:{pending:120,approved:360,in_payout:0,paid:480},referred:9,referred30:4,sales:3,visits30:210,visits_prev30:150,
    daily:Array.from({length:28},(_,i)=>({d:day(27-i),v:Math.round(4+i*.6+Math.sin(i/2)*3)})),
    ledger:[{at:day(2),commission:40,status:"APPROVED",product:"اشتراك شهري"},{at:day(5),commission:120,status:"PAID",product:"اشتراك أول"},{at:day(9),commission:40,status:"PENDING",product:"اشتراك شهري"}],
    payouts:[{id:1,amount:120,currency:"$",status:"paid",created_at:day(12)}],
    referrals:[{name:"عميل تجريبي 1",plan:"شهري",at:day(1),status:"APPROVED"},{name:"عميل تجريبي 2",plan:"أول اشتراك",at:day(3),status:"APPROVED"},{name:"عميل تجريبي 3",plan:"شهري",at:day(6),status:"APPROVED"},{name:"عميل تجريبي 4",plan:"شهري",at:day(8),status:"PENDING"}],
    assets:[],min_payout:"50"},
  admin:{partners:[
    {user_id:"d1",full_name:"شريك تجريبي أ",country:"العراق",status:"PENDING",created_at:day(1),channels:"تيليجرام",referred:0,pending:0,approved:0,paid:0},
    {user_id:"d2",full_name:"شريك تجريبي ب",country:"الأردن",status:"PENDING",created_at:day(2),channels:"يوتيوب",referred:0,pending:0,approved:0,paid:0},
    {user_id:"d3",full_name:"شريك تجريبي ج",country:"مصر",status:"UNDER_REVIEW",created_at:day(4),channels:"توصية",referred:0,pending:0,approved:0,paid:0},
    {user_id:"d4",full_name:"شريك تجريبي د",country:"السعودية",status:"APPROVED",created_at:day(20),channels:"محتوى تعليمي",referred:6,pending:40,approved:120,paid:200},
    {user_id:"d5",full_name:"شريك تجريبي هـ",country:"الإمارات",status:"APPROVED",created_at:day(35),channels:"إعلان المنصة",referred:11,pending:80,approved:40,paid:360}],
    comms:[{created_at:day(1),amount:40,status:"PENDING"},{created_at:day(4),amount:120,status:"APPROVED"},{created_at:day(8),amount:40,status:"PAID"},{created_at:day(15),amount:120,status:"PAID"},{created_at:day(22),amount:40,status:"PAID"}],
    payouts:[{id:7,partner:"شريك تجريبي د",amount:160,currency:"$",status:"requested",created_at:day(1)}],
    ib:[],tickets:[],audit:[{at:day(1),action:"partner_decide",detail:"معاينة"}],levels:[],cfg:{partner_min_payout:"50"}}
};

/* ---------------- shared pieces ---------------- */
function sideNav(items,active,extra=""){
  return`<aside class="side"><a class="wm" href="partners.html#join" style="background:none;height:auto;padding:0">VEXORA</a>
  ${items.map(([h,n,t,b])=>`<a href="#${h}" class="${h===active?"on":""}">${ic(n)}<span>${t}</span>${b?`<span class="badge">${b}</span>`:""}</a>`).join("")}${extra}</aside>`;
}
function areaChart(series,opts={}){
  const W=760,H=190,P={l:34,r:8,t:10,b:24};
  const all=series.flatMap(s=>s.pts.map(p=>p.v));const max=Math.max(1,...all);
  const n=Math.max(...series.map(s=>s.pts.length),2);
  const x=i=>P.l+(W-P.l-P.r)*(i/(n-1)),y=v=>H-P.b-(H-P.t-P.b)*(v/max);
  const ticks=[0,.25,.5,.75,1].map(f=>Math.round(max*f));
  let g=ticks.map(t=>`<line x1="${P.l}" x2="${W-P.r}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(216,180,106,.1)"/><text class="ax" x="${P.l-6}" y="${y(t)+4}" text-anchor="end">${t>=1000?(t/1000).toFixed(t%1000?1:0)+"K":t}</text>`).join("");
  const labs=series[0].pts.filter((_,i)=>i%Math.ceil(n/8)===0).map(p=>{const i=series[0].pts.indexOf(p);return`<text class="ax" x="${x(i)}" y="${H-4}" text-anchor="middle">${esc(p.l||"")}</text>`}).join("");
  const body=series.map((s,k)=>{
    const d=s.pts.map((p,i)=>`${i?"L":"M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
    const id="g"+k+Math.random().toString(36).slice(2,6);
    const bars=s.bars?s.pts.map((p,i)=>{const w=(W-P.l-P.r)/n*.55;return`<rect x="${x(i)-w/2}" y="${y(p.v)}" width="${w}" height="${H-P.b-y(p.v)}" rx="2" fill="url(#${id})"/>`}).join(""):"";
    return`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c}" stop-opacity="${s.bars?.95:.45}"/><stop offset="1" stop-color="${s.c}" stop-opacity="${s.bars?.45:0}"/></linearGradient></defs>
      ${bars}${s.area?`<path d="${d} L${x(s.pts.length-1)} ${H-P.b} L${x(0)} ${H-P.b}Z" fill="url(#${id})"/>`:""}
      ${s.line!==false?`<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.w||2}"/>`:""}
      ${s.dots?s.pts.map((p,i)=>i%Math.ceil(n/12)===0||i===n-1?`<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="#fff4d6" stroke="${s.c}"/>`:"").join(""):""}`;
  }).join("");
  return`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(opts.label||"رسم بياني")}">${g}${body}${labs}</svg>`;
}
const lastDays=(rows,days,key="at",val=r=>1)=>{const m=new Map();for(let i=days-1;i>=0;i--)m.set(day(i),0);rows.forEach(r=>{const d=String(r[key]||"").slice(0,10);if(m.has(d))m.set(d,m.get(d)+val(r))});
  return[...m].map(([d,v])=>({d,v,l:new Date(d).toLocaleDateString("ar-IQ-u-nu-latn",{day:"numeric",month:"long"})}))};

/* ---------------- 1) landing ---------------- */
async function landing(){
  document.body.className="";
  let me=null;try{const p=await API.portal();me=p&&p.me}catch(e){}
  const applyHref=CFG.APP+"#partners/apply";
  const status=me?`<span class="tag">حالة طلبك: ${esc((STATUS[me.status]||[me.status])[0])}</span>`:`<span class="tag">برنامج شركاء VEXORA</span>`;
  const dashBtn=me&&me.status==="APPROVED"?`<a class="btn gold" href="#partner">${ic("arrowup")} لوحة الشريك</a>`:`<a class="btn gold" href="${applyHref}">${ic("arrowup")} قدم طلب الشراكة</a>`;
  $("#app").innerHTML=`
  <header class="lnav"><a class="wm" href="index.html">VEXORA</a>
    <nav><a href="index.html">الرئيسية</a><a href="academy.html">الأكاديمية</a><a href="${CFG.APP}#indicators">المؤشرات</a><a href="${CFG.APP}#ai">الذكاء الاصطناعي</a><a href="${CFG.APP}#marketing">مركز التسويق</a><a class="on" href="#join">برنامج الشركاء</a></nav>
    <div class="acts"><a class="btn" href="${CFG.APP}#login">تسجيل الدخول</a><a class="btn gold" href="${applyHref}">قدم طلب الشراكة</a></div></header>
  <section class="hero"><div class="in">${status}
    <h1>كن شريكاً في نجاح فيكسورا</h1>
    <p>انضم إلى برنامج الشركاء وحقق دخلاً مستمراً من خلال ترشيح المتداولين والمهتمين إلى منظومة <span class="ltr">VEXORA</span> المتكاملة.</p>
    <div class="cta">${dashBtn}<a class="btn" href="#how">${ic("play")} اكتشف التفاصيل</a></div></div></section>
  <section class="feats">
    <div>${ic("bars")}<span><b>دخل متكرر</b><small>من عمولات حقيقية</small></span></div>
    <div>${ic("layers")}<span><b>منظومة متكاملة</b><small>أكاديمية، توصيات، مؤشرات، ذكاء اصطناعي</small></span></div>
    <div>${ic("headset")}<span><b>دعم مباشر</b><small>وفريق مختص للشركاء</small></span></div>
    <div>${ic("shield")}<span><b>مصداقية وثقة</b><small>بعلامة <span class="ltr">VEXORA</span></small></span></div></section>
  <div class="lgrid lg1">
    <article class="card how" id="how"><h3>${ic("gear")} كيف يعمل البرنامج؟</h3><ol>
      <li><span class="num">1</span><span><b>قدم طلب الشراكة</b><span>املأ نموذج الانضمام ووقّع العقد ليتم مراجعته.</span></span></li>
      <li><span class="num">2</span><span><b>احصل على رابطك الخاص</b><span>بعد القبول ستحصل على رابط إحالة فريد.</span></span></li>
      <li><span class="num">3</span><span><b>شارك وحقق الأرباح</b><span>روّج لخدمات <span class="ltr">VEXORA</span> واحصل على عمولاتك.</span></span></li></ol></article>
    <article class="card"><h3>${ic("coins")} نموذج العمولات</h3><p class="sub">عمولة على كل اشتراك مؤكد، وتظهر نسبتك الفعلية بلوحتك بعد القبول.</p>
      <div class="models">
        <div><small>الاشتراك الشهري</small><strong>100$</strong><em>عمولة تصل إلى</em><span class="v">حسب العقد</span></div>
        <div><small>الاشتراك الأول</small><strong>300$</strong><em>عمولة تصل إلى</em><span class="v">حسب العقد</span></div>
        <div><small>عميل نشط ومستمر</small><strong style="font-size:17px;font-family:inherit;margin:10px 0">مكافآت إضافية</strong><em>حسب الأداء والعدد</em></div></div></article>
    <div class="flag" role="img" aria-label="علم VEXORA"></div>
  </div>
  <div class="lgrid lg2">
    <article class="card why"><h3>${ic("trophy")} لماذا تختار VEXORA؟</h3><ul>
      <li><i class="chk"></i>خدمات حقيقية يحتاجها المتداولون.</li><li><i class="chk"></i>نسب عمولة واضحة ومكتوبة بالعقد.</li>
      <li><i class="chk"></i>متابعة وتقارير واضحة لأدائك.</li><li><i class="chk"></i>دعم مباشر ومتابعة مستمرة.</li></ul></article>
    <article class="card"><h3>${ic("chat")} الأسئلة الشائعة</h3><div class="faq">
      <details><summary>من يمكنه الانضمام إلى برنامج الشركاء؟</summary><p>أي عضو مسجّل بالمنصة يوافق على عقد الشراكة والإفصاح، وتتم مراجعة الطلب من الإدارة.</p></details>
      <details><summary>متى يتم احتساب العمولة؟</summary><p>بعد تأكيد دفع الاشتراك من الإدارة وانتهاء فترة المراجعة المكتوبة بالعقد.</p></details>
      <details><summary>كيف يتم استلام الأرباح؟</summary><p>تطلب السحب من لوحتك بعد اعتماد العمولات، وتراجعه الإدارة وتحوّله يدوياً.</p></details>
      <details><summary>هل هناك حد أدنى للسحب؟</summary><p>نعم، يظهر الحد الأدنى الحالي بلوحة الشريك قبل طلب السحب.</p></details></div>
      <p class="sub" style="margin-top:10px">التداول ينطوي على مخاطر، ولا نضمن أرباحاً للعملاء أو الشركاء.</p></article>
    <article class="card"><h3>${ic("layers")} الموارد التسويقية</h3><p class="sub">كل ما تحتاجه للترويج باحترافية.</p><div class="res">
      <a href="${CFG.APP}#marketing">${ic("mega")}مواد تسويقية</a><a href="${CFG.APP}#marketing">${ic("doc")}نصوص ترويجية</a>
      <a href="${CFG.APP}#marketing">${ic("image")}تصاميم إعلانية</a><a href="${CFG.APP}#marketing">${ic("play2")}فيديوهات جاهزة</a></div></article>
  </div>
  <section class="band"><div class="t"><h2>انضم الآن إلى برنامج شركاء <span class="wm">VEXORA</span></h2><p>فرصة حقيقية لبناء دخل إضافي ومستدام مع منصة تعليمية متكاملة في عالم التداول.</p></div>
    <a class="btn gold" href="${applyHref}">${ic("arrowup")} قدم طلب الشراكة الآن</a></section>`;
}

/* ---------------- 2) partner dashboard ---------------- */
const P_ITEMS=[["partner","home","الرئيسية"],["partner/link","link","رابط الإحالة"],["partner/clients","users","العملاء المحالون"],["partner/subs","layers","الاشتراكات"],["partner/comms","coins","العمولات"],["partner/payouts","wallet","طلبات السحب"],["partner/tools","mega","أدوات التسويق"],["reports","chart","التقارير والتحليلات"],["partner/settings","gear","الإعدادات"]];
function needLogin(t){return`<div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3 style="justify-content:center">${esc(t)}</h3><p class="sub">سجّل دخولك بحسابك بالمنصة حتى تنفتح اللوحة.</p><p><a class="btn gold" href="${CFG.APP}#login">تسجيل الدخول</a></p></div>`}
async function partnerPage(sub){
  document.body.className="";
  if(!PREVIEW&&!session){$("#app").innerHTML=needLogin("لوحة الشريك");return}
  let d;try{d=await API.dash()}catch(e){
    const msg=String(e.message||e);
    $("#app").innerHTML=`<div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3 style="justify-content:center">لوحة الشريك</h3><p class="sub">${msg.includes("NOT_PARTNER")?"لوحة الشريك تنفتح بعد موافقة الإدارة على طلبك.":"تعذر تحميل البيانات."}</p><p><a class="btn gold" href="#join">برنامج الشركاء</a></p></div>`;return}
  const s=d.sum||{};const total=num(s.pending)+num(s.approved)+num(s.in_payout)+num(s.paid);
  const ref=location.origin+location.pathname.replace(/[^/]*$/,"")+"index.html?p="+encodeURIComponent(d.code||"");
  const pct=(a,b)=>b?Math.round((a-b)/b*1000)/10:null;
  const vChange=pct(num(d.visits30),num(d.visits_prev30));
  const ledger=d.ledger||[];const daily=(d.daily||[]);
  const visits=lastDays(daily.map(x=>({at:x.d,v:x.v})),28,"at",r=>num(r.v));
  const comms=lastDays(ledger,28,"at",r=>num(r.commission));
  const refs=d.referrals||[];
  const lastPay=(d.payouts||[])[0];
  const avail=num(s.approved);
  $("#app").innerHTML=`<div class="shell">${sideNav(P_ITEMS,sub?"partner/"+sub:"partner",`<div class="gift">${ic("gift")}<b>مكافآت الشركاء</b><span>عروض وحوافز خاصة للشركاء المميزين</span></div>`)}
  <main class="main"><div class="top"><div class="who"><span class="av">${ic("user")}</span>${esc(d.name||"شريك")} ${ic("crown","gold-ic")}</div><span class="bell">${ic("bell")}</span><span class="lang">${ic("globe")} العربية ${ic("chev")}</span></div>
  <section class="phero"><div class="ptitle"><span class="tag">${ic("crown","gold-ic")} ${esc((d.level&&d.level.name)||"شريك معتمد")}</span>
    <h1>مرحباً بك في برنامج شركاء <span class="wm">VEXORA</span></h1><p>لوحة شريكك لمتابعة الأداء، العملاء، العمولات، وسحب الأرباح.</p></div>
    <div class="kpis">
      <div class="kpi"><div class="h">${ic("coins")}إجمالي العمولات</div><strong>${money2(total)}</strong><small>${money(s.pending)} قيد المراجعة</small></div>
      <div class="kpi"><div class="h">${ic("users")}الاشتراكات المؤكدة</div><strong>${intf(d.sales)}</strong><small>عبر رابطك</small></div>
      <div class="kpi"><div class="h">${ic("users")}العملاء المحالون</div><strong>${intf(d.referred)}</strong><small><b>+${intf(d.referred30)}</b>آخر 30 يوم</small></div>
      <div class="kpi"><div class="h">${ic("bars")}الأرباح المدفوعة</div><strong>${money2(s.paid)}</strong><small>${vChange==null?"زيارات الرابط: "+intf(d.visits30):`<b>${vChange>0?"+":""}${vChange}%</b>زيارات مقارنة بالشهر الماضي`}</small></div></div></section>
  <div class="dgrid dg1">
    <article class="card"><div class="chd"><h3>${ic("chartup")} أداء الشراكة</h3><span class="legend"><span><i style="background:#d8b46a"></i>العمولات ($)</span><span><i style="background:#f3ece0"></i>زيارات الرابط</span></span><select class="sel" aria-label="الفترة"><option>آخر 30 يوماً</option></select></div>
      <div class="chart">${areaChart([{pts:comms,c:"#c9a35c",bars:true,line:false},{pts:visits,c:"#e9cc8c",dots:true,w:2}],{label:"العمولات والزيارات"})}</div></article>
    <article class="card" id="link"><h3>${ic("link")} رابط الإحالة الخاص بك</h3><p class="sub">شارك رابطك وابدأ بتحقيق عمولاتك.</p>
      <div class="refbox"><button type="button" id="cp" aria-label="نسخ الرابط">${ic("copy")}</button><input readonly value="${esc(ref)}" aria-label="رابط الإحالة"></div>
      <div class="share"><a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ref)}" target="_blank" rel="noopener" aria-label="فيسبوك">${ic("fb")}</a><a href="https://x.com/intent/post?url=${encodeURIComponent(ref)}" target="_blank" rel="noopener" aria-label="X">${ic("xs")}</a><a href="https://t.me/share/url?url=${encodeURIComponent(ref)}" target="_blank" rel="noopener" aria-label="تيليجرام">${ic("tg")}</a><a href="https://wa.me/?text=${encodeURIComponent(ref)}" target="_blank" rel="noopener" aria-label="واتساب">${ic("wa")}</a></div></article>
  </div>
  <div class="dgrid dg2">
    <article class="card" id="payouts"><h3>${ic("wallet")} طلبات السحب</h3>
      <div class="bal"><span>الرصيد القابل للسحب</span><strong>${money2(avail)}</strong><button class="btn gold" id="pay" type="button">طلب سحب جديد ${ic("arrow")}</button></div>
      ${lastPay?`<div class="last"><span>آخر طلب: <b class="ltr">${money2(lastPay.amount)}</b></span>${pill(lastPay.status)}</div>`:`<div class="last"><span>ما عندك طلبات سحب سابقة</span></div>`}
      <p class="sub">الحد الأدنى للسحب: ${esc(d.min_payout||"—")}$ · الاعتماد من الإدارة فقط.</p></article>
    <article class="card" id="clients"><h3>${ic("users")} آخر العملاء المحالين</h3>
      ${refs.length?`<div class="tblw"><table class="tbl"><thead><tr><th>العميل</th><th>الباقة</th><th>تاريخ التسجيل</th><th>الحالة</th></tr></thead><tbody>${refs.slice(0,5).map(r=>`<tr><td>${ic("user")} ${esc(r.name)}</td><td>${esc(r.plan)}</td><td>${dAr(r.at)}</td><td>${pill(r.status)}</td></tr>`).join("")}</tbody></table></div>`
        :`<div class="empty">العدد الكلي للمحالين: ${intf(d.referred)}.<br>قائمة الأسماء تحتاج دالة قراءة مخصصة تحترم خصوصية العملاء (مقترحة بالتقرير).</div>`}</article>
    <article class="card" id="tools"><h3>${ic("layers")} أدوات التسويق</h3><p class="sub">مواد جاهزة تساعدك على جذب عملاء جدد.</p>
      <div class="tools"><a href="${CFG.APP}#marketing">${ic("doc")}نصوص جاهزة</a><a href="${CFG.APP}#marketing">${ic("image")}تصاميم سوشيال</a><a href="${CFG.APP}#marketing">${ic("play2")}فيديوهات ترويجية</a></div>
      <a class="btn wide-btn" href="${CFG.APP}#marketing">${ic("download")} تحميل حزمة المواد كاملة</a></article>
  </div></main></div>`;
  $("#cp").onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(ref).then(()=>toast("انتسخ الرابط"),()=>{})};
  $("#pay").onclick=async()=>{
    if(avail<=0)return toast("ماكو رصيد معتمد للسحب حالياً");
    const meth=prompt("طريقة الاستلام (مثلاً: تحويل بنكي، USDT):");if(!meth)return;
    const det=prompt("تفاصيل الاستلام:");if(!det)return;
    try{await API.payoutReq(meth,det);toast("انرسل طلب السحب للإدارة");partnerPage(sub)}catch(e){toast(String(e.message||e).split(":").pop())}
  };
  if(sub){const el=document.getElementById(sub);if(el)el.scrollIntoView({behavior:"smooth",block:"start"})}
}

/* ---------------- 3) owner management ---------------- */
let ADM=null;
const O_ITEMS=()=>{const p=(ADM&&ADM.partners)||[];const pend=p.filter(x=>x.status==="PENDING"||x.status==="UNDER_REVIEW").length;const pay=((ADM&&ADM.payouts)||[]).filter(x=>x.status==="requested").length;
  return[["owner/home","home","لوحة التحكم"],["owner","users","إدارة الشركاء"],["owner/requests","clip","طلبات الانضمام",pend||""],["owner/list","users","قائمة الشركاء"],["owner/rules","coins","إعدادات العمولات"],["owner/clients","user","العملاء المحالون"],["owner/verify","card","التحقق من المدفوعات"],["owner/payouts","upload","مراجعة طلبات السحب",pay||""],["owner/log","list","سجل العمليات"],["reports","bars","التقارير والإحصائيات"],["owner/roles","shield","الصلاحيات والأدوار"],["owner/settings","gear","إعدادات البرنامج"]]};
async function ownerPage(sub){
  document.body.className="owner";
  if(!PREVIEW&&!session){$("#app").innerHTML=needLogin("إدارة الشركاء");return}
  if(!isOwner()){$("#app").innerHTML=`<div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3 style="justify-content:center">هذه الصفحة للمالك فقط</h3></div>`;return}
  try{ADM=await API.admin()}catch(e){$("#app").innerHTML=`<div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3 style="justify-content:center">تعذر تحميل بيانات الشركاء</h3><p class="sub">${esc(e.message||e)}</p></div>`;return}
  const P=ADM.partners||[],C=ADM.comms||[],PO=ADM.payouts||[];
  const active=P.filter(x=>x.status==="APPROVED"),reqs=P.filter(x=>x.status==="PENDING"||x.status==="UNDER_REVIEW");
  const sumC=C.reduce((a,c)=>a+(c.status!=="CANCELLED"?num(c.amount):0),0);
  const pendC=C.filter(c=>c.status==="PENDING"||c.status==="VERIFIED").reduce((a,c)=>a+num(c.amount),0);
  const newActive30=active.filter(x=>x.approved_at&&new Date(x.approved_at)>Date.now()-30*864e5).length;
  const roll=a=>a.map((p,i)=>({...p,v:a.slice(Math.max(0,i-6),i+1).reduce((s,x)=>s+x.v,0)}));
  const cd=roll(lastDays(C,34,"created_at",r=>num(r.amount))).slice(6),nd=roll(lastDays(P,34,"created_at")).slice(6);
  const payReq=PO.filter(x=>x.status==="requested"),ibReq=(ADM.ib||[]).filter(x=>x.status==="SUBMITTED");
  const view=sub||"";
  let table;
  if(view==="payouts"){
    table=`<article class="card"><div class="thead"><h3>${ic("upload")} طلبات السحب</h3></div><div class="tblw"><table class="tbl"><thead><tr><th>#</th><th>الشريك</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>
      ${PO.length?PO.map(x=>`<tr><td>${x.id}</td><td>${esc(x.partner)}</td><td class="ltr">${money2(x.amount)}</td><td>${dAr(x.created_at)}</td><td>${pill(x.status)}</td><td><div class="acts2">${x.status==="requested"?`<button class="ib y" data-pay="${x.id}" data-a="approve" aria-label="اعتماد">${ic("check")}</button>`:""}${x.status==="requested"||x.status==="approved"?`<button class="ib" data-pay="${x.id}" data-a="paid" aria-label="تم التحويل">${ic("card")}</button><button class="ib n" data-pay="${x.id}" data-a="reject" aria-label="رفض">${ic("x")}</button>`:""}</div></td></tr>`).join(""):`<tr><td colspan="6" class="empty">ماكو طلبات سحب</td></tr>`}</tbody></table></div></article>`;
  }else if(view==="log"){
    const A=ADM.audit||[];
    table=`<article class="card"><h3>${ic("list")} سجل العمليات</h3><div class="tblw"><table class="tbl"><thead><tr><th>الوقت</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>${A.length?A.map(a=>`<tr><td>${dAr(a.at)}</td><td class="ltr">${esc(a.action)}</td><td>${esc(typeof a.detail==="object"?JSON.stringify(a.detail):a.detail||a.title||"")}</td></tr>`).join(""):`<tr><td colspan="3" class="empty">ماكو عمليات مسجلة</td></tr>`}</tbody></table></div></article>`;
  }else{
    const rows=view==="list"?P:reqs.concat(P.filter(x=>!reqs.includes(x))).slice(0,view==="requests"?999:8);
    table=`<article class="card"><div class="thead"><h3>${ic("useradd")} ${view==="list"?"قائمة الشركاء":"طلبات انضمام الشركاء"}</h3>
      <label class="search">${ic("search")}<input id="q" placeholder="البحث بالاسم أو البريد أو الدولة..." aria-label="بحث"></label>
      <select class="sel" id="fs" aria-label="الحالة"><option value="">كل الحالات</option><option value="PENDING">قيد المراجعة</option><option value="APPROVED">نشط</option><option value="REJECTED">مرفوض</option><option value="SUSPENDED">موقوف</option></select>
      <a class="btn gold sm" href="#owner/requests">مراجعة الكل ${ic("arrow")}</a></div>
      <div class="tblw"><table class="tbl" id="pt"><thead><tr><th>#</th><th>الاسم</th><th>الدولة</th><th>مصدر المعرفة</th><th>تاريخ الطلب</th><th>المحالون</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>
      ${rows.length?rows.map((x,i)=>`<tr data-s="${esc(x.status)}" data-q="${esc([x.full_name,x.email,x.country].join(" ").toLowerCase())}"><td>${i+1}</td><td><span class="av2">${ic("user")}</span>${esc(x.full_name)}</td><td>${esc(x.country||"—")}</td><td>${esc(x.channels||"—")}</td><td>${dAr(x.created_at)}</td><td>${intf(x.referred)}</td><td>${pill(x.status)}</td>
        <td><div class="acts2">${x.status==="PENDING"||x.status==="UNDER_REVIEW"||x.status==="SUSPENDED"?`<button class="ib y" data-dec="${esc(x.user_id)}" data-st="APPROVED" aria-label="قبول">${ic("check")}</button>`:""}${x.status==="PENDING"||x.status==="UNDER_REVIEW"?`<button class="ib n" data-dec="${esc(x.user_id)}" data-st="REJECTED" aria-label="رفض">${ic("x")}</button>`:""}${x.status==="APPROVED"?`<button class="ib n" data-dec="${esc(x.user_id)}" data-st="SUSPENDED" aria-label="إيقاف">${ic("x")}</button>`:""}<a class="ib" href="${CFG.APP}#admin/partners" aria-label="التفاصيل الكاملة">${ic("dots")}</a></div></td></tr>`).join(""):`<tr><td colspan="8" class="empty">ماكو طلبات حالياً</td></tr>`}</tbody></table></div></article>`;
  }
  $("#app").innerHTML=`<div class="shell">${sideNav(O_ITEMS(),sub?"owner/"+sub:"owner")}
  <main class="main"><div class="ocol">
    <div class="otop"><div><h1>إدارة الشركاء</h1><p>التحكم الكامل في برنامج الشركاء والعمولات</p></div><span class="bell">${ic("bell")}</span><div class="who"><span><small>المالك</small><b>${esc((profile&&profile.full_name)||"Omar Rabah")}</b></span><span class="av2">${ic("user")}</span></div></div>
    <div class="period"><select class="sel" aria-label="الفترة"><option>هذا الشهر</option><option>آخر 30 يوم</option><option>كل الفترة</option></select></div>
    <div class="okpis">
      <div class="okpi">${ic("link")}<div><span>إجمالي الشركاء</span><strong>${intf(P.length)}</strong></div></div>
      <div class="okpi">${ic("users")}<div><span>الشركاء النشطون</span><strong>${intf(active.length)}</strong>${newActive30?`<small class="up">▲ +${newActive30}</small>`:""}</div></div>
      <div class="okpi">${ic("wallet")}<div><span>عمولات معلقة</span><strong>${money(pendC)}</strong><small style="color:var(--mut)">(في الانتظار)</small></div></div>
      <div class="okpi">${ic("coins")}<div><span>إجمالي العمولات</span><strong>${money(sumC)}</strong></div></div></div>
    <div class="dgrid og1">
      <article class="card"><h3>${ic("clock")} إجراءات بانتظار المراجعة</h3><div class="queue">
        <a href="#owner/requests">${ic("users")} طلبات انضمام شركاء جديدة<span class="n">${reqs.length}</span></a>
        <a href="#owner/payouts">${ic("wallet")} طلبات سحب عمولة<span class="n">${payReq.length}</span></a>
        <a href="${CFG.APP}#admin/partners">${ic("doc")} طلبات IB بانتظار المراجعة<span class="n">${ibReq.length}</span></a></div>
        <p class="sub" style="margin-top:12px">الاعتماد والصرف بيد المالك فقط، وكل إجراء ينسجل بسجل العمليات.</p></article>
      <article class="card"><div class="chd"><h3>أداء برنامج الشركاء</h3><span class="sub" style="margin:0">مجموع 7 أيام</span><span class="legend"><span><i style="background:#d8b46a"></i>العمولات</span><span><i style="background:#8f877a"></i>الشركاء الجدد</span></span></div>
        <div class="chart">${areaChart([{pts:cd,c:"#d8b46a",area:true,dots:true},{pts:nd,c:"#8f877a",w:1.5}],{label:"العمولات والشركاء الجدد"})}</div></article>
    </div>
    <div style="margin-top:18px">${table}</div>
  </div><div class="win" aria-hidden="true"></div></main></div>`;
  const q=$("#q"),fs=$("#fs");const filt=()=>document.querySelectorAll("#pt tbody tr[data-q]").forEach(tr=>{const okq=!q.value||tr.dataset.q.includes(q.value.toLowerCase());const oks=!fs.value||tr.dataset.s===fs.value||(fs.value==="PENDING"&&tr.dataset.s==="UNDER_REVIEW");tr.hidden=!(okq&&oks)});
  if(q){q.oninput=filt;fs.onchange=filt}
  document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=async()=>{
    const st=b.dataset.st,label={APPROVED:"قبول",REJECTED:"رفض",SUSPENDED:"إيقاف"}[st];
    const nt=st==="APPROVED"?"":prompt("سبب "+label+" (يوصل للشريك):");if(st!=="APPROVED"&&!nt)return;
    if(!confirm("تأكيد "+label+" الطلب؟"))return;
    try{await API.decide(b.dataset.dec,st,nt||"");toast("تم "+label+" الطلب");ownerPage(sub)}catch(e){toast(String(e.message||e).split(":").pop())}
  });
  document.querySelectorAll("[data-pay]").forEach(b=>b.onclick=async()=>{
    const a=b.dataset.a;let nt="",ref="";
    if(a==="paid"){ref=prompt("رقم/مرجع التحويل:");if(!ref)return}
    if(a==="reject"){nt=prompt("سبب الرفض:");if(!nt)return}
    if(!confirm("تأكيد الإجراء على طلب السحب #"+b.dataset.pay+"؟"))return;
    try{await API.payoutDecide(+b.dataset.pay,a,nt,ref);toast("تم");ownerPage("payouts")}catch(e){toast(String(e.message||e).split(":").pop())}
  });
}

/* ---------------- 4) reports ---------------- */
async function reportsPage(sub){
  document.body.className="";
  if(!PREVIEW&&!session){$("#app").innerHTML=needLogin("التقارير");return}
  const owner=isOwner();
  let rows=[],payouts=[],kp;
  try{
    if(owner){const a=ADM||await API.admin();ADM=a;rows=(a.comms||[]).map(c=>({at:c.created_at,amount:c.amount,status:c.status,who:c.partner,product:c.product}));payouts=a.payouts||[];
      kp=[["الشركاء",intf((a.partners||[]).length)],["المحالون",intf((a.partners||[]).reduce((s,p)=>s+num(p.referred),0))],["العمولات",money(rows.reduce((s,r)=>s+num(r.amount),0))],["المدفوع للشركاء",money(payouts.filter(p=>p.status==="paid").reduce((s,p)=>s+num(p.amount),0))]];}
    else{const d=await API.dash();rows=(d.ledger||[]).map(c=>({at:c.at,amount:c.commission,status:c.status,product:c.product}));payouts=d.payouts||[];
      kp=[["زيارات 30 يوم",intf(d.visits30)],["المحالون",intf(d.referred)],["الاشتراكات المؤكدة",intf(d.sales)],["المدفوع",money((d.sum||{}).paid)]];}
  }catch(e){$("#app").innerHTML=`<div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3 style="justify-content:center">تعذر تحميل التقارير</h3></div>`;return}
  const tab=sub||"comms";
  const items=owner?O_ITEMS():P_ITEMS;
  const series=lastDays(rows,90,"at",r=>num(r.amount));
  const byStatus={};rows.forEach(r=>{byStatus[r.status]=(byStatus[r.status]||0)+num(r.amount)});
  const csv=()=>{const h="date,amount,status,product,partner\n"+rows.map(r=>[String(r.at).slice(0,10),r.amount,r.status,`"${String(r.product||"").replace(/"/g,'""')}"`,`"${String(r.who||"").replace(/"/g,'""')}"`].join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+h],{type:"text/csv"}));a.download="vexora-partner-report.csv";a.click()};
  $("#app").innerHTML=`<div class="shell">${sideNav(items,"reports")}
  <main class="main"><div class="top"><div><h1 style="margin:0;font-size:28px">التقارير والتحليلات</h1></div><button class="btn sm" id="csv" style="margin-inline-start:auto">${ic("download")} تصدير CSV</button></div>
    <div class="seg">${[["comms","العمولات"],["payouts","العمليات المالية"],["subs","الاشتراكات والإحالات"]].map(([k,t])=>`<button type="button" data-t="${k}" class="${k===tab?"on":""}">${t}</button>`).join("")}</div>
    <div class="rgrid">${kp.map(([t,v])=>`<div class="okpi"><div><span>${t}</span><strong>${v}</strong></div></div>`).join("")}</div>
    <div class="dgrid og1"><article class="card"><h3>${ic("chartup")} العمولات اليومية · آخر 90 يوم</h3><div class="chart">${areaChart([{pts:series,c:"#d8b46a",area:true}],{label:"العمولات اليومية"})}</div></article>
      <article class="card"><h3>${ic("coins")} حسب الحالة</h3><div class="queue">${Object.keys(byStatus).length?Object.entries(byStatus).map(([k,v])=>`<a>${pill(k)}<span class="n" style="min-width:90px">${money(v)}</span></a>`).join(""):`<div class="empty">ماكو عمولات بعد</div>`}</div></article></div>
    <article class="card" style="margin-top:18px">${tab==="payouts"?`<h3>${ic("wallet")} العمليات المالية</h3><div class="tblw"><table class="tbl"><thead><tr><th>#</th>${owner?"<th>الشريك</th>":""}<th>المبلغ</th><th>التاريخ</th><th>الحالة</th><th>المرجع</th></tr></thead><tbody>${payouts.length?payouts.map(p=>`<tr><td>${p.id}</td>${owner?`<td>${esc(p.partner)}</td>`:""}<td class="ltr">${money2(p.amount)}</td><td>${dAr(p.created_at)}</td><td>${pill(p.status)}</td><td class="ltr">${esc(p.paid_ref||"—")}</td></tr>`).join(""):`<tr><td colspan="6" class="empty">ماكو عمليات مالية</td></tr>`}</tbody></table></div>`
      :`<h3>${ic("coins")} ${tab==="subs"?"الاشتراكات المؤكدة عبر الإحالات":"سجل العمولات"}</h3><div class="tblw"><table class="tbl"><thead><tr><th>التاريخ</th>${owner?"<th>الشريك</th>":""}<th>المنتج</th><th>العمولة</th><th>الحالة</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${dAr(r.at)}</td>${owner?`<td>${esc(r.who)}</td>`:""}<td>${esc(r.product||"—")}</td><td class="ltr">${money2(r.amount)}</td><td>${pill(r.status)}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">ماكو سجلات بعد</td></tr>`}</tbody></table></div>`}</article>
  </main></div>`;
  $("#csv").onclick=csv;
  document.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{location.hash="reports/"+b.dataset.t});
}

/* ---------------- router ---------------- */
async function route(){
  const h=(location.hash||"#join").slice(1),[root,sub]=h.split("/");
  window.scrollTo(0,0);
  if(root==="partner")return partnerPage(sub);
  if(root==="owner")return ownerPage(sub==="home"?"":sub);
  if(root==="reports")return reportsPage(sub);
  return landing();
}
window.addEventListener("hashchange",route);
boot().catch(()=>{}).then(()=>{
  if(PREVIEW){const b=document.createElement("div");b.className="demo";b.textContent="معاينة · بيانات تجريبية للعرض فقط";document.body.appendChild(b)}
  route();
});
})();
