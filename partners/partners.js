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
const dAr=d=>{try{return new Date(d).toLocaleDateString(window.VXP_LOCALE||"ar-IQ-u-nu-latn",{day:"numeric",month:"long",year:"numeric"})}catch(e){return ""}};
const langSel=()=>`<label class="lang">${ic("globe")}<select aria-label="Language" onchange="VXP_setLang(this.value)">${[["ar","العربية"],["en","English"],["fr","Français"],["de","Deutsch"]].map(([k,t])=>`<option value="${k}"${(window.VXP_LANG||"ar")===k?" selected":""}>${t}</option>`).join("")}</select></label>`;
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
  dash6:()=>PREVIEW?DEMO.dash6:rpc("partner_dash_v6"),
  team:()=>PREVIEW?DEMO.team:rpc("partner_team"),
  lb:(scope,period)=>PREVIEW?DEMO.lb:rpc("partner_leaderboard",{scope,period}),
  claim:iid=>PREVIEW?Promise.resolve("PENDING"):rpc("partner_claim_incentive",{iid}),
  apply:d=>PREVIEW?Promise.resolve("PENDING"):(window.VexoraAttribution&&window.VexoraAttribution.applyWithTeam?window.VexoraAttribution.applyWithTeam(d,body=>rpc("partner_apply",{d:body})):rpc("partner_apply",{d})),
  ticket:(subj,bdy)=>PREVIEW?Promise.resolve(1):rpc("partner_ticket",{subj,bdy}),
  myIb:()=>PREVIEW?DEMO.ib:rpc("my_ib"),
  ibSave:(d,submit)=>PREVIEW?Promise.resolve(submit?"SUBMITTED":"DRAFT"):rpc("ib_save",{d,submit}),
  upload:async file=>{if(PREVIEW)return"demo/ib/x";const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,5);const path=`${session.user.id}/ib/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;const r=await sb.storage.from("partner-docs").upload(path,file,{contentType:file.type,upsert:false});if(r.error)throw r.error;return path},
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
  dash6:null,team:{code:"DEMO01",team_on:true,size:5,team_month:85,team_sales_month:4,legs:{L:3,R:2,L_sales:6,R_sales:3},
    direct:[{name:"سارة م.",status:"APPROVED",leg:"L",at:day(2)},{name:"علي ح.",status:"PENDING",leg:"R",at:day(5)}],
    tree:[{id:"a",parent:"me",leg:"L",depth:1,name:"سارة م.",level:"Silver",status:"APPROVED"},{id:"b",parent:"me",leg:"R",depth:1,name:"علي ح.",level:"Starter",status:"APPROVED"},{id:"c",parent:"a",leg:"L",depth:2,name:"نور ك.",level:"Starter",status:"APPROVED"}]},
  lb:[{name:"Kh*** A",country:"SA",level:"gold",n:16},{name:"أنت",me:true,country:"IQ",level:"silver",n:11},{name:"Ra*** H",country:"JO",level:"silver",n:9}],
  ib:{app:null,contract:{id:1,version:"1.0",title:"عقد IB",body:"نص العقد يظهر هنا من قاعدة البيانات."},earnings:[]},
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

DEMO.dash6=Object.assign({},DEMO.dash,{level:{code:"silver",name:"Silver",min_sales:10},next:{code:"gold",name:"Gold",min_sales:30},confirmed:14,rate:15,team1_pct:5,team_on:true,
  levels:[{code:"starter",name:"Starter",min_sales:0,rate:10},{code:"silver",name:"Silver",min_sales:10,rate:15},{code:"gold",name:"Gold",min_sales:30,rate:20},{code:"diamond",name:"Diamond",min_sales:75,rate:25}],
  incentives:[{id:1,title:"كورس مجاني",descr:"عند 10 مبيعات شخصية مؤكدة",target:10,value:10,done:true,claim:null},{id:2,title:"اشتراك VIP شهرين",descr:"عند 50 مبيعة مؤكدة لفريقك",target:50,value:36,done:false},{id:3,title:"جلسة خاصة مع الكوتش",descr:"عند الوصول لرتبة Gold",target:30,value:14,done:false}],
  contract:{title:"عقد شريك مبيعات",version:"1.0",signed_at:day(30),sign_name:"شريك تجريبي",body:"نص العقد الموقّع يظهر هنا."},tickets:[{id:3,subject:"سؤال عن العمولة",body:"متى تتحول العمولة لمعتمدة؟",status:"answered",reply:"بعد انتهاء فترة المراجعة المكتوبة بالعقد.",created_at:day(3)}]});
DEMO.portal={me:null,min_payout:"50",levels:DEMO.dash6.levels,contracts:[{id:1,ptype:"sales",version:"1.0",title:"عقد شريك مبيعات",body:"1. الأطراف: VEXORA والشريك.\n2. العمولة على المبيعات المؤكدة فقط.\n3. يمنع وعد العملاء بأرباح مضمونة.\n4. السحب يتم بعد اعتماد الإدارة."},{id:2,ptype:"distributor",version:"1.0",title:"عقد موزع معتمد",body:"نص عقد الموزع."}]};

/* ---------------- shared pieces ---------------- */
function sideNav(items,active,extra=""){
  if(items===P_ITEMS&&isOwner())items=items.concat([["owner","shield","إدارة الشركاء (المالك)"]]);
  return`<aside class="side"><a class="wm" href="partners.html#join" style="background:none;height:auto;padding:0">VEXORA</a>
  <a href="${CFG.APP}" class="back">${ic("arrow")}<span>رجوع لمنصة فيكسورا</span></a>
  ${items.map(([h,n,t,b])=>`<a href="${h.includes(".html")?h:"#"+h}" class="${h===active?"on":""}">${ic(n)}<span>${t}</span>${b?`<span class="badge">${b}</span>`:""}</a>`).join("")}${extra}</aside>`;
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
  return[...m].map(([d,v])=>({d,v,l:new Date(d).toLocaleDateString(window.VXP_LOCALE||"ar-IQ-u-nu-latn",{day:"numeric",month:"long"})}))};

/* ---------------- 1) landing ---------------- */
async function landing(){
  document.body.className="";
  let me=null;try{const p=await API.portal();me=p&&p.me}catch(e){}
  const applyHref="#apply";
  const status=me?`<span class="tag">حالة طلبك: ${esc((STATUS[me.status]||[me.status])[0])}</span>`:`<span class="tag">برنامج شركاء VEXORA</span>`;
  const dashBtn=me&&me.status==="APPROVED"?`<a class="btn gold" href="#partner">${ic("arrowup")} لوحة الشريك</a>`:`<a class="btn gold" href="${applyHref}">${ic("arrowup")} قدم طلب الشراكة</a>`;
  $("#app").innerHTML=`
  <header class="lnav"><a class="wm" href="index.html">VEXORA</a>
    <nav><a href="index.html">الرئيسية</a><a href="academy.html">الأكاديمية</a><a href="${CFG.APP}#indicators">المؤشرات</a><a href="${CFG.APP}#ai">الذكاء الاصطناعي</a><a href="${CFG.APP}#marketing">مركز التسويق</a><a class="on" href="#join">برنامج الشركاء</a></nav>
    <div class="acts">${langSel()}<a class="btn" href="${CFG.APP}#login">تسجيل الدخول</a><a class="btn gold" href="#apply">قدم طلب الشراكة</a></div></header>
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
const A=h=>CFG.APP+"#"+h;
const P_ITEMS=[["partner","home","الرئيسية"],["partner/link","link","رابط الإحالة"],["partner/clients","users","العملاء المحالون"],["partner/payouts","wallet","العمولات والسحب"],["team","users","فريقي"],["ranks","crown","الرتب والحوافز"],["plan","layers","خطة الأرباح"],["lead","trophy","المتصدرين"],["partner/tools","mega","أدوات التسويق"],["reports","chartup","التقارير والتحليلات"],["ib","bank","طلب IB"],["help","headset","دعم الشركاء"],["agreement","doc","العقد"]];
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
  <main class="main"><div class="top">${langSel()}<a class="btn sm" href="${CFG.APP}">${ic("home")} منصة فيكسورا</a><div class="who"><span class="av">${ic("user")}</span>${esc(d.name||"شريك")} ${ic("crown","gold-ic")}</div></div>
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
  if(sub){
    const main=document.querySelector(".main"),top=main.querySelector(".top").outerHTML,grab=id=>{const e=document.getElementById(id);return e?e.outerHTML:""};
    const head=(t,p)=>`<section class="phero sm"><div class="ptitle"><span class="tag">${ic("crown","gold-ic")} ${esc((d.level&&d.level.name)||"شريك معتمد")}</span><h1>${t}</h1><p>${p}</p></div></section>`;
    const K=(...x)=>`<div class="kpis">${x.join("")}</div>`;
    const kp=(i,t,v,sm)=>`<div class="kpi"><div class="h">${ic(i)}${t}</div><strong>${v}</strong><small>${sm||""}</small></div>`;
    const CST={PENDING:"بانتظار التحقق",VERIFIED:"قيد المراجعة",APPROVED:"معتمدة",PAID:"مدفوعة",REVERSED:"ملغاة"};
    let body="";
    if(sub==="link")body=head("رابط الإحالة","شارك رابطك، وكل اشتراك مؤكد من خلاله ينحسب إلك.")+K(kp("link","زيارات آخر 30 يوم",intf(d.visits30),vChange==null?"":`<b>${vChange>0?"+":""}${vChange}%</b>عن الشهر السابق`),kp("users","سجلوا من رابطك",intf(d.referred),`<b>+${intf(d.referred30)}</b>آخر 30 يوم`),kp("check","اشتراكات مؤكدة",intf(d.sales),"عبر رابطك"),kp("bars","كود الشريك",esc(d.code||"—"),"يظهر بآخر الرابط"))
      +`<div class="dgrid dg1"><article class="card"><h3>${ic("chartup")} زيارات الرابط</h3><div class="chart">${areaChart([{pts:visits,c:"#e9cc8c",area:true,dots:true}],{label:"زيارات الرابط"})}</div></article>${grab("link")}</div>`;
    else if(sub==="clients")body=head("العملاء المحالون","العملاء اللي سجلوا من رابطك، وحالة اشتراكاتهم.")+K(kp("users","إجمالي المحالين",intf(d.referred),""),kp("useradd","جدد آخر 30 يوم",intf(d.referred30),""),kp("check","اشتراكات مؤكدة",intf(d.sales),""),kp("chartup","نسبة التحويل",num(d.referred)?Math.round(num(d.sales)/num(d.referred)*100)+"%":"—","من التسجيل للاشتراك"))
      +`<div style="margin-top:18px">${grab("clients")}</div>`;
    else if(sub==="payouts")body=head("العمولات والسحب","سجل مالي موثّق، والسحب باعتماد الإدارة.")+K(kp("clock","قيد المراجعة",money2(s.pending),""),kp("check","معتمدة وجاهزة",money2(s.approved),""),kp("wallet","بطلب سحب",money2(s.in_payout),""),kp("coins","مدفوعة",money2(s.paid),""))
      +`<div class="dgrid dg1"><article class="card"><h3>${ic("coins")} سجل العمولات</h3><div class="tblw"><table class="tbl"><thead><tr><th>التاريخ</th><th>المنتج</th><th>البيع</th><th>العمولة</th><th>الحالة</th></tr></thead><tbody>${ledger.length?ledger.map(c=>`<tr><td>${dAr(c.at)}</td><td>${esc(c.product||c.kind||"—")}</td><td class="ltr">${c.amount!=null?money2(c.amount):"—"}</td><td class="ltr">${money2(c.commission)}</td><td><span class="pill ${c.status==="PAID"||c.status==="APPROVED"?"ok":c.status==="REVERSED"?"bad":"wait"}">${CST[c.status]||esc(c.status)}</span></td></tr>`).join(""):`<tr><td colspan="5" class="empty">ماكو عمولات بعد</td></tr>`}</tbody></table></div></article>${grab("payouts")}</div>
      <article class="card" style="margin-top:18px"><h3>${ic("wallet")} طلبات السحب السابقة</h3><div class="tblw"><table class="tbl"><thead><tr><th>#</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th><th>الحالة</th><th>المرجع</th></tr></thead><tbody>${(d.payouts||[]).length?d.payouts.map(x=>`<tr><td>${x.id}</td><td class="ltr">${money2(x.amount)}</td><td>${esc(x.method||"—")}</td><td>${dAr(x.created_at)}</td><td>${pill(x.status)}</td><td class="ltr">${esc(x.paid_ref||"—")}</td></tr>`).join(""):`<tr><td colspan="6" class="empty">ماكو طلبات سحب</td></tr>`}</tbody></table></div></article>`;
    else if(sub==="tools"){const S=d.assets||[];body=head("أدوات التسويق","مواد جاهزة من الإدارة، ومركز التسويق بالذكاء الاصطناعي.")+`<div class="dgrid dg1">${grab("tools")}<article class="card"><h3>${ic("image")} مواد من الإدارة</h3>${S.length?`<div class="tools" style="grid-template-columns:repeat(2,1fr)">${S.map(a=>`<a href="${esc(a.url)}" target="_blank" rel="noopener">${ic(a.kind==="video"?"play2":a.kind==="text"?"doc":"image")}${esc(a.title)}</a>`).join("")}</div>`:`<div class="empty">الإدارة ما نزّلت مواد بعد</div>`}</article></div>`}
    if(body)main.innerHTML=top+body;
  }
  if($("#cp"))$("#cp").onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(ref).then(()=>toast("انتسخ الرابط"),()=>{})};
  if($("#pay"))$("#pay").onclick=async()=>{
    if(avail<=0)return toast("ماكو رصيد معتمد للسحب حالياً");
    const meth=prompt("طريقة الاستلام (مثلاً: تحويل بنكي، USDT):");if(!meth)return;
    const det=prompt("تفاصيل الاستلام:");if(!det)return;
    try{await API.payoutReq(meth,det);toast("انرسل طلب السحب للإدارة");partnerPage(sub)}catch(e){toast(String(e.message||e).split(":").pop())}
  };
}

/* ---------------- 3) owner management ---------------- */
let ADM=null;
const O_ITEMS=()=>{const p=(ADM&&ADM.partners)||[];const pend=p.filter(x=>x.status==="PENDING"||x.status==="UNDER_REVIEW").length;const pay=((ADM&&ADM.payouts)||[]).filter(x=>x.status==="requested").length;
  const cm=((ADM&&ADM.comms)||[]).filter(c=>c.status==="PENDING"||c.status==="VERIFIED").length,ib=((ADM&&ADM.ib)||[]).filter(x=>["SUBMITTED","VEXORA_REVIEW"].includes(x.status)).length,tk=((ADM&&ADM.tickets)||[]).filter(t=>t.status==="open").length;
  return[["owner","home","نظرة عامة"],["owner/requests","clip","طلبات الانضمام",pend||""],["owner/list","users","الشركاء"],["owner/comms","coins","العمولات",cm||""],["owner/payouts","upload","السحوبات",pay||""],["owner/levels","crown","الرتب والنسب"],["owner/rewards","gift","الحوافز والهدايا"],["owner/contracts","doc","العقود"],["owner/ib","bank","طلبات IB",ib||""],["owner/support","headset","رسائل الشركاء",tk||""],["owner/assets","image","المواد التسويقية"],["owner/report","bars","التقرير الشهري"],["owner/log","list","سجل العمليات"],["owner/settings","gear","إعدادات البرنامج"],["partner","arrow","واجهة الشريك"]]};
const OT={"":"إدارة الشركاء",requests:"طلبات الانضمام",list:"الشركاء",comms:"العمولات",payouts:"السحوبات",levels:"الرتب والنسب",rewards:"الحوافز والهدايا",contracts:"العقود",ib:"طلبات IB",support:"رسائل الشركاء",assets:"المواد التسويقية",report:"التقرير الشهري",log:"سجل العمليات",settings:"إعدادات البرنامج"};
const CMS={PENDING:"بانتظار التحقق",VERIFIED:"متحقق منها",APPROVED:"معتمدة",PAID:"مدفوعة",REVERSED:"ملغاة"};
const OV={
  async comms(){const C=ADM.comms||[];return`<article class="card"><h3>${ic("coins")} العمولات</h3><p class="sub">تحقق من البيع ← اعتمد العمولة. الإلغاء للاسترجاع أو الخطأ.</p><div class="tblw"><table class="tbl"><thead><tr><th>#</th><th>الشريك</th><th>المشتري</th><th>المنتج</th><th>البيع</th><th>العمولة</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>
    ${C.length?C.map(c=>`<tr><td>${c.id}</td><td>${esc(c.partner||c.partner_name||"—")}</td><td>${esc(c.buyer||"—")}</td><td>${esc(c.product||c.kind||"—")}</td><td class="ltr">${c.sale_amount!=null?money2(c.sale_amount):"—"}</td><td class="ltr">${money2(c.amount)}</td><td><span class="pill ${c.status==="PAID"||c.status==="APPROVED"?"ok":c.status==="REVERSED"?"bad":"wait"}">${CMS[c.status]||esc(c.status)}</span></td>
      <td><div class="acts2">${c.status==="PENDING"?`<button class="btn sm" data-cm="${c.id}" data-a="verify">تحقق</button>`:""}${c.status==="VERIFIED"?`<button class="btn gold sm" data-cm="${c.id}" data-a="approve">اعتماد</button>`:""}${["PENDING","VERIFIED","APPROVED"].includes(c.status)?`<button class="ib n" data-cm="${c.id}" data-a="reverse" aria-label="إلغاء">${ic("x")}</button>`:""}</div></td></tr>`).join(""):`<tr><td colspan="8" class="empty">ماكو عمولات</td></tr>`}</tbody></table></div></article>`},
  async levels(){const L=ADM.levels||[];return`<form class="card" id="lvf"><h3>${ic("crown")} الرتب والنسب</h3><p class="sub">التغيير يطبق على العمولات الجديدة بس، وينسجل بالسجل.</p><div class="tblw"><table class="tbl"><thead><tr><th>الرتبة</th><th>الاسم</th><th>بعد كم مبيعة</th><th>النسبة %</th><th>المزايا</th><th>فعّالة</th></tr></thead><tbody>
    ${L.map((l,i)=>`<tr data-i="${i}"><td class="ltr">${esc(l.code)}</td><td><input class="cell" name="name" value="${esc(l.name)}"></td><td><input class="cell n" name="min_sales" type="number" min="0" value="${num(l.min_sales)}"></td><td><input class="cell n" name="rate" type="number" min="0" max="100" step="0.5" value="${num(l.rate)}"></td><td><input class="cell" name="perks" value="${esc(l.perks||"")}"></td><td><input type="checkbox" name="active" ${l.active!==false?"checked":""}></td></tr>`).join("")}</tbody></table></div>
    <p class="err" id="lverr"></p><button class="btn gold" type="submit">${ic("check")} حفظ الرتب</button></form>`},
  async rewards(){let v={incentives:[],claims:[]};try{v=PREVIEW?{incentives:DEMO.dash6.incentives,claims:[]}:await rpc("admin_partners_v6")}catch(e){}ADM._v6=v;const I=v.incentives||[],K=v.claims||[];
    return`<div class="dgrid dg1" style="margin-top:0"><article class="card"><h3>${ic("gift")} طلبات الهدايا</h3><div class="tblw"><table class="tbl"><thead><tr><th>الشريك</th><th>الهدية</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>${K.length?K.map(c=>`<tr><td>${esc(c.partner)}</td><td>${esc(c.title)}</td><td>${esc(c.status)}</td><td><div class="acts2">${c.status==="requested"?`<button class="btn gold sm" data-cl="${c.id}" data-a="approve">اعتماد</button><button class="ib n" data-cl="${c.id}" data-a="reject" aria-label="رفض">${ic("x")}</button>`:""}${c.status==="approved"?`<button class="btn sm" data-cl="${c.id}" data-a="deliver">تم التسليم</button>`:""}</div></td></tr>`).join(""):`<tr><td colspan="4" class="empty">ماكو طلبات</td></tr>`}</tbody></table></div></article>
    <form class="card" id="incf"><h3>${ic("plus")} حافز جديد / تعديل</h3><div class="form"><label>الحافز<select class="sel" name="id"><option value="">جديد</option>${I.map(i=>`<option value="${i.id}">${esc(i.title)}</option>`).join("")}</select></label><label>العنوان<input name="title" required></label>
      <label>المقياس<select class="sel" name="metric"><option value="personal_sales">مبيعات شخصية</option><option value="team_sales">مبيعات الفريق</option><option value="rank">الوصول لرتبة</option><option value="balance">توازن الطرفين</option></select></label><label>الهدف<input name="target" type="number" min="1"></label>
      <label>الفترة<select class="sel" name="period"><option value="all">كل الوقت</option><option value="month">شهري</option></select></label><label>رمز الرتبة (للرتبة)<input name="rank_code" class="ltr"></label>
      <label class="w">الوصف<input name="descr"></label><label>الجائزة<input name="reward"></label><label>قيمة الجائزة $<input name="reward_amount" type="number" min="0"></label><label class="ck"><input type="checkbox" name="active" checked> فعّال</label></div><p class="err" id="incerr"></p><button class="btn gold wide-btn" type="submit">${ic("check")} حفظ الحافز</button></form></div>`},
  async contracts(){const K=ADM.contracts||[];return`<div class="dgrid dg1" style="margin-top:0"><article class="card"><h3>${ic("doc")} العقود الحالية</h3><div class="tblw"><table class="tbl"><thead><tr><th>النوع</th><th>العنوان</th><th>النسخة</th><th>فعّال</th></tr></thead><tbody>${K.map(k=>`<tr><td>${{sales:"شريك مبيعات",distributor:"موزع",ib:"IB"}[k.ptype]||esc(k.ptype)}</td><td>${esc(k.title)}</td><td class="ltr">${esc(k.version)}</td><td>${k.active?pill("APPROVED"):"—"}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">ماكو عقود</td></tr>`}</tbody></table></div><p class="sub">نسخة جديدة ما تغيّر العقود الموقّعة سابقاً.</p></article>
    <form class="card" id="ctf"><h3>${ic("pen")} نسخة عقد جديدة</h3><div class="form"><label>النوع<select class="sel" name="pt"><option value="sales">شريك مبيعات</option><option value="distributor">موزع</option><option value="ib">IB</option></select></label><label>رقم النسخة<input name="ver" class="ltr" placeholder="1.1" required></label><label class="w">العنوان<input name="ttl" required></label><label class="w">نص العقد<textarea name="bdy" rows="10" required></textarea></label></div><p class="err" id="cterr"></p><button class="btn gold wide-btn" type="submit">${ic("check")} نشر النسخة</button></form></div>`},
  async ib(){const B=ADM.ib||[];const ST={SUBMITTED:"مقدّم",VEXORA_REVIEW:"مراجعة فيكسورا",BROKER_PENDING:"عند الوسيط",BROKER_APPROVED:"مقبول",BROKER_REJECTED:"مرفوض",DRAFT:"مسودة"};
    return`<article class="card"><h3>${ic("bank")} طلبات IB</h3><div class="tblw"><table class="tbl"><thead><tr><th>الاسم</th><th>الإيميل</th><th>الدولة</th><th>المستندات</th><th>الحالة</th><th>رقم IB</th><th>الإجراء</th></tr></thead><tbody>${B.length?B.map(a=>`<tr><td>${esc(a.full_name)}</td><td class="ltr">${esc(a.email||a.acct_email)}</td><td>${esc(a.country||"—")}</td><td>${(a.docs||[]).map((d,i)=>`<button class="btn sm" data-doc="${esc(d)}">ملف ${i+1}</button>`).join(" ")||"—"}</td><td>${esc(ST[a.status]||a.status)}</td><td class="ltr">${esc(a.ib_number||"—")}</td>
      <td><div class="acts2"><select class="sel" data-ibst="${a.id}"><option value="">تغيير الحالة…</option>${["VEXORA_REVIEW","BROKER_PENDING","BROKER_APPROVED","BROKER_REJECTED","DRAFT"].map(k=>`<option value="${k}">${ST[k]}</option>`).join("")}</select></div></td></tr>`).join(""):`<tr><td colspan="7" class="empty">ماكو طلبات IB</td></tr>`}</tbody></table></div></article>`},
  async support(){const T=ADM.tickets||[];return`<article class="card"><h3>${ic("headset")} رسائل الشركاء</h3>${T.length?T.map(t=>`<div class="msg"><div class="mh"><b>${esc(t.subject)}</b><span>${esc(t.name||"")}</span><span class="pill ${t.status==="open"?"wait":"ok"}">${t.status==="open"?"مفتوحة":t.status==="answered"?"تم الرد":"مغلقة"}</span><small>${dAr(t.created_at)}</small></div><p>${esc(t.body)}</p>${t.reply?`<div class="reply">${ic("headset")} ${esc(t.reply)}</div>`:""}
    ${t.status!=="closed"?`<form class="rep" data-tk="${t.id}"><input name="rep" placeholder="اكتب الرد…" required><label class="ck" style="margin:0"><input type="checkbox" name="cl"> إغلاق</label><button class="btn gold sm" type="submit">رد</button></form>`:""}</div>`).join(""):`<div class="empty">ماكو رسائل</div>`}</article>`},
  async assets(){const S=ADM.assets||[];return`<div class="dgrid dg1" style="margin-top:0"><article class="card"><h3>${ic("image")} المواد التسويقية</h3><div class="tblw"><table class="tbl"><thead><tr><th>العنوان</th><th>النوع</th><th>الرابط</th><th>فعّال</th><th></th></tr></thead><tbody>${S.length?S.map(a=>`<tr><td>${esc(a.title)}</td><td>${esc(a.kind)}</td><td class="ltr"><a href="${esc(a.url)}" target="_blank" rel="noopener">فتح</a></td><td>${a.active?pill("APPROVED"):"—"}</td><td><button class="btn sm" data-as="${a.id}" data-on="${a.active?0:1}">${a.active?"إخفاء":"إظهار"}</button></td></tr>`).join(""):`<tr><td colspan="5" class="empty">ماكو مواد</td></tr>`}</tbody></table></div></article>
    <form class="card" id="asf"><h3>${ic("plus")} مادة جديدة</h3><div class="form"><label class="w">العنوان<input name="title" required></label><label>النوع<select class="sel" name="kind"><option value="image">صورة</option><option value="video">فيديو</option><option value="text">نص</option><option value="link">رابط</option></select></label><label>الرابط<input name="url" class="ltr" required placeholder="https://"></label></div><p class="err" id="aserr"></p><button class="btn gold wide-btn" type="submit">${ic("check")} إضافة</button></form></div>`},
  async report(){const m=ADM._mon||new Date().toISOString().slice(0,7);let R=[];try{R=PREVIEW?[]:await rpc("admin_partner_report",{mon:m})}catch(e){}
    return`<article class="card"><div class="thead"><h3>${ic("bars")} التقرير الشهري</h3><input type="month" class="sel" id="mon" value="${m}"><button class="btn sm" id="rcsv">${ic("download")} CSV</button></div><div class="tblw"><table class="tbl" id="rt"><thead><tr><th>الشريك</th><th>الكود</th><th>الرتبة</th><th>المبيعات</th><th>الإيراد</th><th>العمولة</th></tr></thead><tbody>${R.length?R.map(r=>`<tr><td>${esc(r.partner)}</td><td class="ltr">${esc(r.code)}</td><td>${esc(r.level||"—")}</td><td>${intf(r.sales)}</td><td class="ltr">${money2(r.revenue)}</td><td class="ltr">${money2(r.commission)}</td></tr>`).join(""):`<tr><td colspan="6" class="empty">ماكو بيانات لهالشهر</td></tr>`}</tbody></table></div></article>`},
  async settings(){const c=ADM.cfg||{};return`<form class="card" id="cff"><h3>${ic("gear")} إعدادات البرنامج</h3><div class="form"><label class="ck w"><input type="checkbox" name="partner_enabled" ${c.partner_enabled==="1"?"checked":""}> استقبال طلبات شراكة جديدة</label><label>الحد الأدنى للسحب ($)<input name="partner_min_payout" type="number" min="0" value="${esc(c.partner_min_payout||"")}"></label></div><p class="err" id="cferr"></p><button class="btn gold" type="submit">${ic("check")} حفظ</button></form>
    <article class="card" style="margin-top:18px"><h3>${ic("gear")} أدوات متقدمة</h3><p class="sub">دعم الوسيط، استيراد تسوية IB، الخطة الشبكية، ونسبة أو رتبة خاصة لشريك معيّن.</p><a class="btn" href="${CFG.APP}?legacy=1#admin/partners">${ic("arrow")} فتح الأدوات المتقدمة</a></article>`}
};
async function ownerAct(fn,okMsg,again){try{if(!PREVIEW)await fn();toast(okMsg);ownerPage(again)}catch(e){toast(errMsg(e))}}
function bindOwner(view){
  document.querySelectorAll("[data-cm]").forEach(b=>b.onclick=()=>{const a=b.dataset.a;const nt=a==="reverse"?prompt("سبب الإلغاء:"):"";if(a==="reverse"&&!nt)return;if(!confirm("تأكيد؟"))return;ownerAct(()=>rpc("admin_comm_act",{cid:+b.dataset.cm,act:a,nt:nt||""}),"تم","comms")});
  const lv=$("#lvf");if(lv)lv.onsubmit=e=>{e.preventDefault();const rows=(ADM.levels||[]).map((l,i)=>{const tr=lv.querySelector(`tr[data-i="${i}"]`);const g=n=>tr.querySelector(`[name="${n}"]`);return Object.assign({},l,{name:g("name").value,min_sales:+g("min_sales").value,rate:+g("rate").value,perks:g("perks").value,active:g("active").checked})});
    if(!confirm("حفظ الرتب والنسب؟"))return;ownerAct(()=>rpc("admin_partner_levels_save",{rows}),"انحفظت الرتب","levels")};
  document.querySelectorAll("[data-cl]").forEach(b=>b.onclick=()=>{const nt=b.dataset.a==="reject"?prompt("السبب:"):"";if(b.dataset.a==="reject"&&!nt)return;ownerAct(()=>rpc("admin_incentive_claim",{cid:+b.dataset.cl,act:b.dataset.a,nt:nt||""}),"تم","rewards")});
  const inc=$("#incf");if(inc){const I=(ADM._v6&&ADM._v6.incentives)||[];inc.id.onchange=()=>{const x=I.find(i=>String(i.id)===inc.id.value)||{};["title","metric","target","period","rank_code","descr","reward","reward_amount"].forEach(k=>{if(inc[k])inc[k].value=x[k]??(k==="metric"?"personal_sales":k==="period"?"all":"")});inc.active.checked=x.active!==false};
    inc.onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(inc).entries());f.active=inc.active.checked;if(!f.id)delete f.id;ownerAct(()=>rpc("admin_incentive_save",{r:f}),"انحفظ الحافز","rewards")}}
  const ct=$("#ctf");if(ct)ct.onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(ct).entries());if(!confirm("نشر نسخة عقد جديدة؟ الشركاء الجدد يوقّعون عليها."))return;ownerAct(()=>rpc("admin_partner_contract_save",f),"انحفظ العقد","contracts")};
  document.querySelectorAll("[data-ibst]").forEach(s=>s.onchange=()=>{const st=s.value;if(!st)return;let ibn="",nt="";if(st==="BROKER_APPROVED"){ibn=prompt("رقم IB من الوسيط:");if(!ibn){s.value="";return}}if(st==="BROKER_REJECTED"){nt=prompt("السبب:")||""}
    ownerAct(()=>rpc("admin_ib_update",{aid:+s.dataset.ibst,st,nt,ibn,proof:""}),"تم تحديث الطلب","ib")});
  document.querySelectorAll("[data-doc]").forEach(b=>b.onclick=async()=>{try{const r=await sb.storage.from("partner-docs").createSignedUrl(b.dataset.doc,300);if(r.error)throw r.error;window.open(r.data.signedUrl,"_blank","noopener")}catch(e){toast("تعذر فتح الملف")}});
  document.querySelectorAll("form.rep").forEach(f=>f.onsubmit=e=>{e.preventDefault();ownerAct(()=>rpc("admin_partner_ticket_reply",{tid:+f.dataset.tk,rep:f.rep.value,cl:f.cl.checked}),"انرسل الرد","support")});
  const as=$("#asf");if(as)as.onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(as).entries());f.active=true;ownerAct(()=>rpc("admin_partner_asset",{a:f}),"انضافت المادة","assets")};
  document.querySelectorAll("[data-as]").forEach(b=>b.onclick=()=>{const a=(ADM.assets||[]).find(x=>String(x.id)===b.dataset.as);ownerAct(()=>rpc("admin_partner_asset",{a:Object.assign({},a,{active:b.dataset.on==="1"})}),"تم","assets")});
  const mon=$("#mon");if(mon)mon.onchange=()=>{ADM._mon=mon.value;ownerPage("report")};
  const rc=$("#rcsv");if(rc)rc.onclick=()=>{const t=[...document.querySelectorAll("#rt tr")].map(tr=>[...tr.children].map(td=>`"${td.textContent.replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+t],{type:"text/csv"}));a.download="partners-"+(ADM._mon||"report")+".csv";a.click()};
  const cf=$("#cff");if(cf)cf.onsubmit=async e=>{e.preventDefault();ownerAct(async()=>{await rpc("admin_partner_cfg",{k:"partner_enabled",v:cf.partner_enabled.checked?"1":"0"});await rpc("admin_partner_cfg",{k:"partner_min_payout",v:cf.partner_min_payout.value})},"انحفظت الإعدادات","settings")};
}
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
  }else if(OV[view]){
    table=await OV[view]();
  }else{
    const rows=view==="list"?P:reqs.concat(P.filter(x=>!reqs.includes(x))).slice(0,view==="requests"?999:8);
    table=`<article class="card"><div class="thead"><h3>${ic("useradd")} ${view==="list"?"قائمة الشركاء":"طلبات انضمام الشركاء"}</h3>
      <label class="search">${ic("search")}<input id="q" placeholder="البحث بالاسم أو البريد أو الدولة..." aria-label="بحث"></label>
      <select class="sel" id="fs" aria-label="الحالة"><option value="">كل الحالات</option><option value="PENDING">قيد المراجعة</option><option value="APPROVED">نشط</option><option value="REJECTED">مرفوض</option><option value="SUSPENDED">موقوف</option></select>
      <a class="btn gold sm" href="#owner/requests">مراجعة الكل ${ic("arrow")}</a></div>
      <div class="tblw"><table class="tbl" id="pt"><thead><tr><th>#</th><th>الاسم</th><th>الدولة</th><th>مصدر المعرفة</th><th>تاريخ الطلب</th><th>المحالون</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>
      ${rows.length?rows.map((x,i)=>`<tr data-s="${esc(x.status)}" data-q="${esc([x.full_name,x.email,x.country].join(" ").toLowerCase())}"><td>${i+1}</td><td><span class="av2">${ic("user")}</span>${esc(x.full_name)}</td><td>${esc(x.country||"—")}</td><td>${esc(x.channels||"—")}</td><td>${dAr(x.created_at)}</td><td>${intf(x.referred)}</td><td>${pill(x.status)}</td>
        <td><div class="acts2">${x.status==="PENDING"||x.status==="UNDER_REVIEW"||x.status==="SUSPENDED"?`<button class="ib y" data-dec="${esc(x.user_id)}" data-st="APPROVED" aria-label="قبول">${ic("check")}</button>`:""}${x.status==="PENDING"||x.status==="UNDER_REVIEW"?`<button class="ib n" data-dec="${esc(x.user_id)}" data-st="REJECTED" aria-label="رفض">${ic("x")}</button>`:""}${x.status==="APPROVED"?`<button class="ib n" data-dec="${esc(x.user_id)}" data-st="SUSPENDED" aria-label="إيقاف">${ic("x")}</button>`:""}</div></td></tr>`).join(""):`<tr><td colspan="8" class="empty">ماكو طلبات حالياً</td></tr>`}</tbody></table></div></article>`;
  }
  $("#app").innerHTML=`<div class="shell">${sideNav(O_ITEMS(),sub?"owner/"+sub:"owner")}
  <main class="main"><div class="ocol">
    <div class="otop"><div><h1>${esc(OT[view]||"إدارة الشركاء")}</h1><p>التحكم الكامل في برنامج الشركاء والعمولات</p></div>${langSel()}<a class="btn sm" href="${CFG.APP}">${ic("home")} منصة فيكسورا</a><div class="who"><span><small>المالك</small><b>${esc((profile&&profile.full_name)||"Omar Rabah")}</b></span><span class="av2">${ic("user")}</span></div></div>
    ${view?"":`<div class="okpis">
      <div class="okpi">${ic("link")}<div><span>إجمالي الشركاء</span><strong>${intf(P.length)}</strong></div></div>
      <div class="okpi">${ic("users")}<div><span>الشركاء النشطون</span><strong>${intf(active.length)}</strong>${newActive30?`<small class="up">▲ +${newActive30}</small>`:""}</div></div>
      <div class="okpi">${ic("wallet")}<div><span>عمولات معلقة</span><strong>${money(pendC)}</strong><small style="color:var(--mut)">(في الانتظار)</small></div></div>
      <div class="okpi">${ic("coins")}<div><span>إجمالي العمولات</span><strong>${money(sumC)}</strong></div></div></div>
    <div class="dgrid og1">
      <article class="card"><h3>${ic("clock")} إجراءات بانتظار المراجعة</h3><div class="queue">
        <a href="#owner/requests">${ic("users")} طلبات انضمام شركاء جديدة<span class="n">${reqs.length}</span></a>
        <a href="#owner/payouts">${ic("wallet")} طلبات سحب عمولة<span class="n">${payReq.length}</span></a>
        <a href="#owner/ib">${ic("doc")} طلبات IB بانتظار المراجعة<span class="n">${ibReq.length}</span></a></div>
        <p class="sub" style="margin-top:12px">الاعتماد والصرف بيد المالك فقط، وكل إجراء ينسجل بسجل العمليات.</p></article>
      <article class="card"><div class="chd"><h3>أداء برنامج الشركاء</h3><span class="sub" style="margin:0">مجموع 7 أيام</span><span class="legend"><span><i style="background:#d8b46a"></i>العمولات</span><span><i style="background:#8f877a"></i>الشركاء الجدد</span></span></div>
        <div class="chart">${areaChart([{pts:cd,c:"#d8b46a",area:true,dots:true},{pts:nd,c:"#8f877a",w:1.5}],{label:"العمولات والشركاء الجدد"})}</div></article>
    </div>`}
    <div style="margin-top:18px">${table}</div>
  </div><div class="win" aria-hidden="true"></div></main></div>`;
  bindOwner(view);
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

/* ---------------- 5) portal sections (same shell & style as the partner dashboard) ---------------- */
function shell(active,title,sub,body,opts={}){
  const nm=(profile&&profile.full_name)||(PREVIEW?"شريك تجريبي":"شريك");
  return`<div class="shell">${sideNav(P_ITEMS,active,`<div class="gift">${ic("gift")}<b>مكافآت الشركاء</b><span>عروض وحوافز خاصة للشركاء المميزين</span></div>`)}
  <main class="main"><div class="top">${langSel()}<a class="btn sm" href="${CFG.APP}">${ic("home")} منصة فيكسورا</a><div class="who"><span class="av">${ic("user")}</span>${esc(nm)} ${ic("crown","gold-ic")}</div></div>
  <section class="phero sm"><div class="ptitle">${opts.tag?`<span class="tag">${opts.tag}</span>`:""}<h1>${title}</h1><p>${sub}</p></div></section>${body}</main></div>`;
}
const card=(icn,t,inner,extra="")=>`<article class="card ${extra}"><h3>${ic(icn)} ${t}</h3>${inner}</article>`;
const cream=(icn,t,v,s)=>`<div class="kpi"><div class="h">${ic(icn)}${t}</div><strong>${v}</strong><small>${s||""}</small></div>`;
async function guard(fn,label){if(!PREVIEW&&!session){$("#app").innerHTML=needLogin(label);return null}
  try{return await fn()}catch(e){const m=String(e.message||e);$("#app").innerHTML=`<div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3 style="justify-content:center">${esc(label)}</h3><p class="sub">${m.includes("NOT_PARTNER")?"هذا القسم ينفتح بعد موافقة الإدارة على طلب الشراكة.":"تعذر تحميل البيانات."}</p><p><a class="btn gold" href="#apply">طلب الانضمام</a></p></div>`;return null}}
const errMsg=e=>{const m=String(e&&e.message||e);return m.includes(":")?m.split(":").slice(1).join(":").trim():m};

/* apply + application status */
async function applyPage(){
  document.body.className="";
  if(!PREVIEW&&!session){$("#app").innerHTML=needLogin("طلب الانضمام");return}
  let po;try{po=await API.portal()}catch(e){po={contracts:[],me:null}}
  const me=po.me,C=po.contracts||[];
  if(me&&me.status!=="REJECTED"){
    const steps=[["PENDING","استلمنا طلبك"],["UNDER_REVIEW","قيد المراجعة"],["APPROVED","تمت الموافقة"]];const idx=Math.max(0,steps.findIndex(x=>x[0]===me.status));
    $("#app").innerHTML=shell("apply","حالة طلب الشراكة","نتابع طلبك خطوة بخطوة، ويوصلك إشعار عند كل تحديث.",`
      <div class="kpis" style="grid-template-columns:repeat(3,1fr)">${steps.map(([k,t],i)=>cream(i<=idx?"check":"clock",t,i<=idx?"✓":"—",i===idx?"المرحلة الحالية":"")).join("")}</div>
      <div class="dgrid dg1">${card("doc","تفاصيل الطلب",`<table class="tbl"><tr><td>الحالة</td><td>${pill(me.status)}</td></tr><tr><td>نوع الشراكة</td><td>${me.ptype==="distributor"?"موزع معتمد":"شريك مبيعات"}</td></tr><tr><td>تاريخ الطلب</td><td>${dAr(me.created_at)}</td></tr><tr><td>توقيع العقد</td><td>${me.signed_at?dAr(me.signed_at)+" · نسخة "+esc(me.contract_version):"—"}</td></tr></table>`)}
      ${card("arrowup","الخطوة الجاية",me.status==="APPROVED"?`<p class="sub">شراكتك فعّالة.</p><a class="btn gold wide-btn" href="#partner">افتح لوحة الشريك</a>`:`<p class="sub">الإدارة تراجع طلبك. ما تحتاج تسوي شي هسه.</p><a class="btn wide-btn" href="#help">${ic("headset")} تواصل ويه دعم الشركاء</a>`)}</div>`,{tag:ic("crown","gold-ic")+" برنامج شركاء VEXORA"});
    return}
  let pt="sales";
  const draw=()=>{const k=C.find(c=>c.ptype===pt)||{};
    $("#app").innerHTML=shell("apply","طلب الانضمام","أربع خطوات: نوع الشراكة، بياناتك، العقد، والتوقيع.",`
    ${me&&me.status==="REJECTED"?`<div class="card" style="margin-top:18px"><p class="sub" style="margin:0">طلبك السابق ما انقبل: ${esc(me.admin_note||"")} · تگدر تعدّل وتقدّم مرة ثانية.</p></div>`:""}
    <div class="dgrid" style="grid-template-columns:repeat(3,1fr)">
      ${[["sales","briefcase","شريك مبيعات","رابط إحالة شخصي وعمولة على كل بيع مؤكد"],["distributor","store","موزع معتمد","مواد جاهزة ودعم أولوية لعملائك"],["ib","bank","IB لدى INFINOX","طلب منفصل يراجعه الوسيط نفسه"]].map(([k2,i2,t2,d2])=>`<button type="button" class="card pick${pt===k2?" on":""}" data-pt="${k2}"><h3>${ic(i2)} ${t2}</h3><p class="sub">${d2}</p></button>`).join("")}</div>
    <form class="dgrid dg1" id="apf" novalidate>
      ${card("user","بياناتك",`<div class="form">
        <label>الاسم الكامل *<input name="full_name" required minlength="3" value="${esc(profile&&profile.full_name||"")}"></label>
        <label>الهاتف<input name="phone" class="ltr" inputmode="tel"></label>
        <label>الدولة<input name="country"></label>
        <label>قنوات الترويج<input name="channels" placeholder="تيليجرام، إنستغرام، يوتيوب…"></label>
        <label class="w">جمهورك<input name="audience" placeholder="مثلاً: متداولين مبتدئين بالعراق"></label>
        <label class="w">خبرتك<textarea name="experience" rows="3"></textarea></label></div>`)}
      ${card("doc",esc(k.title||"العقد")+(k.version?` <small class="sub">· نسخة ${esc(k.version)}</small>`:""),`<div class="contract">${esc(k.body||"العقد غير متوفر حالياً.").replace(/\n/g,"<br>")}</div>
        <label class="ck"><input type="checkbox" name="accept"> قرأت العقد وأوافق عليه</label>
        <label class="ck"><input type="checkbox" name="disclose"> أتعهد أوضح للعملاء إني شريك، وما أوعد بأرباح مضمونة</label>
        <div class="form"><label class="w">اكتب اسمك الكامل كتوقيع *<input name="sign_name" required minlength="3"></label></div>
        <p class="err" id="aperr" role="alert"></p>
        <button class="btn gold wide-btn" type="submit"${k.id?"":" disabled"}>${ic("pen")} وقّع وقدّم الطلب</button>`)}
    </form>`,{tag:ic("crown","gold-ic")+" برنامج شركاء VEXORA"});
    document.querySelectorAll("[data-pt]").forEach(b=>b.onclick=()=>{if(b.dataset.pt==="ib"){location.hash="ib";return}pt=b.dataset.pt;draw()});
    $("#apf").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),d=Object.fromEntries(f.entries()),er=$("#aperr");er.textContent="";
      if((d.full_name||"").trim().length<3){er.textContent="اكتب الاسم الكامل";return}
      if(!f.get("accept")||!f.get("disclose")){er.textContent="لازم توافق على العقد والإفصاح";return}
      if((d.sign_name||"").trim().length<3){er.textContent="اكتب اسمك كتوقيع";return}
      try{await API.apply(Object.assign(d,{ptype:pt,contract_id:k.id,accept:true,disclose:true,ua:navigator.userAgent}));toast("انرسل طلبك للإدارة");applyPage()}catch(e){er.textContent=errMsg(e)}};
  };draw();
}

/* team */
async function teamPage(){
  document.body.className="";
  const t=await guard(()=>API.team(),"فريقي");if(!t)return;
  const L=t.legs||{},tree=t.tree||[];
  const node=(n)=>`<div class="tnode${n?"":" empty"}"><span class="av2">${ic("user")}</span><b>${n?esc(n.name):"مكان فارغ"}</b><small>${n?esc(n.level||"")+" · "+(STATUS[n.status]||[n.status])[0]:"ينضاف تلقائياً"}</small></div>`;
  const kids=(pid,leg)=>tree.find(x=>x.parent===pid&&x.leg===leg);
  const lv1L=tree.find(x=>x.depth===1&&x.leg==="L"),lv1R=tree.find(x=>x.depth===1&&x.leg==="R");
  $("#app").innerHTML=shell("team","فريقي","كل شريك يسجل من رابط فريقك ينضاف تحتك باليمين أو اليسار.",`
    <div class="kpis">${cream("users","حجم فريقي",intf(t.size),"شريك")}${cream("chartup","مبيعات الفريق هالشهر",intf(t.team_sales_month),"مبيعة مؤكدة")}${cream("coins","عمولة الفريق",money2(t.team_month),"هالشهر")}${cream("tree","الطرف الأضعف",num(L.L_sales)<=num(L.R_sales)?"اليسار":"اليمين","ركّز عليه لتحافظ على التوازن")}</div>
    <div class="dgrid dg1">${card("tree","شجرة الفريق",`<div class="tree"><div class="trow">${node({name:"أنت",level:"",status:"APPROVED"})}</div>
        <div class="trow two">${node(lv1R)}${node(lv1L)}</div>
        <div class="trow four">${node(lv1R&&kids(lv1R.id,"R"))}${node(lv1R&&kids(lv1R.id,"L"))}${node(lv1L&&kids(lv1L.id,"R"))}${node(lv1L&&kids(lv1L.id,"L"))}</div></div>
        <div class="legs"><span>اليمين: <b>${intf(L.R)}</b> شريك · <b>${intf(L.R_sales)}</b> مبيعة</span><span>اليسار: <b>${intf(L.L)}</b> شريك · <b>${intf(L.L_sales)}</b> مبيعة</span></div>`)}
      ${card("useradd","سجلوا من رابط فريقك",(t.direct||[]).length?`<div class="tblw"><table class="tbl"><thead><tr><th>الشريك</th><th>الطرف</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${t.direct.map(d=>`<tr><td>${ic("user")} ${esc(d.name)}</td><td>${d.leg==="L"?"اليسار":d.leg==="R"?"اليمين":"—"}</td><td>${dAr(d.at)}</td><td>${pill(d.status)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">ماكو شركاء سجلوا من رابطك بعد</div>`)}</div>`);
}

/* ranks & rewards */
async function ranksPage(){
  document.body.className="";
  const d=await guard(()=>API.dash6(),"الرتب والحوافز");if(!d)return;
  const Ls=d.levels||[],lv=d.level||{},nx=d.next,n=num(d.confirmed);
  const pc=nx?Math.min(100,Math.round((n-num(lv.min_sales))/Math.max(1,num(nx.min_sales)-num(lv.min_sales))*100)):100;
  $("#app").innerHTML=shell("ranks","الرتب والحوافز","ارتقِ بالرتب وافتح هدايا وحوافز حقيقية.",`
    <article class="card rank" style="margin-top:18px"><div class="rk-b">${ic("medal")}</div><div class="rk-m"><h3>رتبتك: ${esc(lv.name||"—")} <small class="sub">${intf(n)} مبيعة مؤكدة</small></h3>
      <div class="bar"><i style="width:${Math.max(4,pc)}%"></i></div><div class="steps">${Ls.map(l=>`<span class="${l.code===lv.code?"on":""}">${esc(l.name)}${nx&&l.code===nx.code?` · باقي ${Math.max(0,num(nx.min_sales)-n)}`:""}</span>`).join("")}</div></div>
      <div class="rk-p"><b>${num(d.rate)}%</b><span>نسبة أرباحك الحالية${d.team_on&&num(d.team1_pct)?`<br>+${num(d.team1_pct)}% من مبيعات فريقك المباشر`:""}</span></div></article>
    <div class="dgrid" style="grid-template-columns:repeat(${Math.min(4,Math.max(1,Ls.length))},1fr)">${Ls.map(l=>`<article class="card lvl${l.code===lv.code?" on":""}">${ic(l.code===lv.code?"crown":"medal")}<b>${esc(l.name)}</b><strong>${num(l.rate)}%</strong><small>${num(l.min_sales)?`بعد ${intf(l.min_sales)} مبيعة مؤكدة`:"من أول بيع مؤكد"}</small></article>`).join("")}</div>
    <div class="dgrid" style="grid-template-columns:repeat(3,1fr)">${(d.incentives||[]).map(i=>{const p=Math.min(100,Math.round(num(i.value)/Math.max(1,num(i.target))*100));
      return`<article class="card gift">${ic("gift")}<h3 style="justify-content:center">${esc(i.title)}</h3><p class="sub">${esc(i.descr||"")}</p><div class="bar"><i style="width:${Math.max(4,p)}%"></i></div><small class="sub">${intf(i.value)} / ${intf(i.target)}</small>
        ${i.claim?`<p>${pill(i.claim.status==="approved"?"APPROVED":i.claim.status==="rejected"?"REJECTED":"PENDING")}</p>`:i.done?`<button class="btn gold sm" data-claim="${i.id}" type="button">${ic("gift")} استلم الهدية</button>`:`<button class="btn sm" disabled type="button">بعدك</button>`}</article>`}).join("")||`<div class="empty">ماكو حوافز فعّالة حالياً</div>`}</div>`);
  document.querySelectorAll("[data-claim]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await API.claim(+b.dataset.claim);toast("انرسل طلب الهدية للإدارة");ranksPage()}catch(e){toast(errMsg(e));b.disabled=false}});
}

/* compensation plan (read from the live levels) */
async function planPage(){
  document.body.className="";
  let po;try{po=await API.portal()}catch(e){po={levels:[]}}
  const Ls=po.levels||[];
  $("#app").innerHTML=shell("plan","خطة الأرباح","كيف تنحسب عمولتك، ومتى تتحول لرصيد قابل للسحب.",`
    <div class="dgrid" style="grid-template-columns:repeat(${Math.min(4,Math.max(1,Ls.length))},1fr);margin-top:18px">${Ls.map(l=>`<article class="card lvl">${ic("medal")}<b>${esc(l.name)}</b><strong>${num(l.rate)}%</strong><small>${num(l.min_sales)?`بعد ${intf(l.min_sales)} مبيعة مؤكدة`:"من أول بيع مؤكد"}</small>${num(l.team1_pct)?`<small>+${num(l.team1_pct)}% فريق مباشر</small>`:""}</article>`).join("")||`<div class="empty">الإدارة ما نشرت الرتب بعد</div>`}</div>
    <div class="dgrid dg1">${card("layers","مراحل العمولة",`<div class="how"><ol>
      <li><span class="num">1</span><span><b>بيع عبر رابطك</b><span>العميل يشترك من رابطك وتنسجل العملية باسمك.</span></span></li>
      <li><span class="num">2</span><span><b>تأكيد الدفع</b><span>الإدارة تأكد الدفعة، وتصير العمولة «قيد المراجعة».</span></span></li>
      <li><span class="num">3</span><span><b>اعتماد العمولة</b><span>بعد فترة المراجعة المكتوبة بالعقد تصير «معتمدة».</span></span></li>
      <li><span class="num">4</span><span><b>طلب السحب</b><span>تطلب السحب من لوحتك، والإدارة تحوّل وتسجل المرجع.</span></span></li></ol></div>`)}
      ${card("shield","قواعد مهمة",`<div class="why"><ul><li><i class="chk"></i>العمولة على المبيعات المؤكدة فقط.</li><li><i class="chk"></i>الاسترجاع يلغي العمولة المرتبطة به.</li><li><i class="chk"></i>الحد الأدنى للسحب: ${esc(po.min_payout||"—")}$.</li><li><i class="chk"></i>ممنوع وعد العملاء بأرباح مضمونة.</li></ul></div>`)}</div>`);
}

/* leaderboard */
async function leadPage(sub){
  document.body.className="";
  const [scope,period]=(sub||"all-week").split("-");
  const rows=await guard(()=>API.lb(scope,period),"المتصدرين");if(!rows)return;
  const seg=(k,v,t)=>`<button type="button" class="${(k==="s"?scope:period)===v?"on":""}" data-${k}="${v}">${t}</button>`;
  $("#app").innerHTML=shell("lead","المتصدرين","ترتيب الشركاء حسب المبيعات المؤكدة.",`
    <div class="seg">${seg("p","week","هالأسبوع")}${seg("p","month","هالشهر")}${seg("p","all","الكل")}<span style="width:24px"></span>${seg("s","all","كل الشركاء")}${seg("s","team","فريقي")}</div>
    ${card("trophy","أعلى مبيعات مؤكدة",`<div class="tblw"><table class="tbl"><thead><tr><th>الترتيب</th><th>الشريك</th><th>الدولة</th><th>مبيعات مؤكدة</th><th>الرتبة</th></tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr${r.me?' class="me"':""}><td>${i<3?`<span class="rk${i+1}">${i+1}</span>`:"#"+(i+1)}</td><td>${esc(r.name)}</td><td>${esc(r.country||"—")}</td><td>${intf(r.n)}</td><td><span class="pill wait">${esc(r.level||"—")}</span></td></tr>`).join(""):`<tr><td colspan="5" class="empty">ماكو مبيعات بهالفترة</td></tr>`}</tbody></table></div>
      <p class="sub">الأسماء مخفية جزئياً للخصوصية، وما تنعرض أي مبالغ.</p>`,"")}`);
  document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>location.hash="lead/"+scope+"-"+b.dataset.p);
  document.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>location.hash="lead/"+b.dataset.s+"-"+period);
}

/* support */
async function helpPage(){
  document.body.className="";
  const d=await guard(()=>API.dash6(),"دعم الشركاء");if(!d)return;
  const T=d.tickets||[];
  $("#app").innerHTML=shell("help","دعم الشركاء","اسألنا عن أي شي يخص شراكتك، والرد يوصلك هنا وبالإشعارات.",`
    <div class="dgrid dg1">${card("chat","رسائلي",T.length?T.map(t=>`<div class="msg"><div class="mh"><b>${esc(t.subject)}</b>${pill(t.status==="open"?"PENDING":"APPROVED").replace("قيد المراجعة","مفتوحة").replace("نشط","تم الرد")}<small>${dAr(t.created_at)}</small></div><p>${esc(t.body)}</p>${t.reply?`<div class="reply">${ic("headset")} ${esc(t.reply)}</div>`:""}</div>`).join(""):`<div class="empty">ما عندك رسائل سابقة</div>`)}
    <form id="tkf">${card("plus","رسالة جديدة",`<div class="form"><label class="w">الموضوع<input name="subj" required minlength="3"></label><label class="w">رسالتك<textarea name="bdy" rows="6" required minlength="5"></textarea></label></div><p class="err" id="tkerr" role="alert"></p><button class="btn gold wide-btn" type="submit">${ic("arrow")} إرسال</button>`)}</form></div>`);
  $("#tkf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),er=$("#tkerr");er.textContent="";
    if(String(f.get("subj")).trim().length<3||String(f.get("bdy")).trim().length<5){er.textContent="اكتب الموضوع والرسالة";return}
    try{await API.ticket(f.get("subj"),f.get("bdy"));toast("انرسلت رسالتك");helpPage()}catch(x){er.textContent=errMsg(x)}};
}

/* agreement */
async function agreementPage(){
  document.body.className="";
  const d=await guard(()=>API.dash6(),"العقد");if(!d)return;const k=d.contract||{};
  $("#app").innerHTML=shell("agreement","عقد الشراكة","النسخة اللي وقّعت عليها، محفوظة ببصمة رقمية.",`
    <div class="dgrid dg1">${card("doc",esc(k.title||"العقد"),`<div class="contract tall">${esc(k.body||"—").replace(/\n/g,"<br>")}</div>`)}
    ${card("pen","التوقيع",`<table class="tbl"><tr><td>النسخة</td><td>${esc(k.version||"—")}</td></tr><tr><td>الموقّع</td><td>${esc(k.sign_name||"—")}</td></tr><tr><td>تاريخ التوقيع</td><td>${dAr(k.signed_at)}</td></tr><tr><td>البصمة</td><td class="ltr" style="font-size:11px;white-space:normal;word-break:break-all">${esc(k.hash||"—")}</td></tr></table>
      <button class="btn wide-btn" type="button" onclick="print()">${ic("download")} طباعة / حفظ PDF</button>`)}</div>`);
}

/* IB request */
async function ibPage(){
  document.body.className="";
  const d=await guard(()=>API.myIb(),"طلب IB");if(!d)return;
  const a=d.app,k=d.contract||{},locked=a&&!["DRAFT","BROKER_REJECTED"].includes(a.status);
  const ST={DRAFT:"مسودة",SUBMITTED:"انرسل للوسيط",BROKER_REVIEW:"عند الوسيط",BROKER_APPROVED:"مقبول من الوسيط",BROKER_REJECTED:"مرفوض من الوسيط"};
  let docs=(a&&a.docs)||[];
  $("#app").innerHTML=shell("ib","طلب IB","Introducing Broker لدى INFINOX · الموافقة النهائية من الوسيط نفسه.",`
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">${cream("doc","حالة الطلب",esc(a?ST[a.status]||a.status:"ما مقدّم"),a&&a.updated_at?dAr(a.updated_at):"")}${cream("bank","رقم IB",esc(a&&a.ib_number||"—"),"يطلع بعد موافقة الوسيط")}${cream("coins","أرباح IB",intf((d.earnings||[]).length),"كشوفات مستوردة")}</div>
    <form class="dgrid dg1" id="ibf" novalidate>
      ${card("user","بياناتك",`<div class="form">
        <label>الاسم الكامل *<input name="full_name" value="${esc(a&&a.full_name||profile&&profile.full_name||"")}" ${locked?"disabled":""}></label>
        <label>الإيميل *<input name="email" class="ltr" value="${esc(a&&a.email||session&&session.user.email||"")}" ${locked?"disabled":""}></label>
        <label>الهاتف<input name="phone" class="ltr" value="${esc(a&&a.phone||"")}" ${locked?"disabled":""}></label>
        <label>الدولة *<input name="country" value="${esc(a&&a.country||"")}" ${locked?"disabled":""}></label>
        <label>عدد العملاء المتوقع<input name="expected_clients" value="${esc(a&&a.expected_clients||"")}" ${locked?"disabled":""}></label>
        <label>قنواتك<input name="channels" value="${esc(a&&a.channels||"")}" ${locked?"disabled":""}></label>
        <label class="w">خبرتك<textarea name="experience" rows="3" ${locked?"disabled":""}>${esc(a&&a.experience||"")}</textarea></label>
        <label class="w">مستند الهوية *<input type="file" id="ibdoc" accept="image/*,application/pdf" ${locked?"disabled":""}></label></div><p class="sub" id="ibdocs">${docs.length?"مرفوع: "+docs.length+" ملف":"ما مرفوع ملف بعد"}</p>`)}
      ${card("doc",esc(k.title||"عقد IB"),`<div class="contract">${esc(k.body||"—").replace(/\n/g,"<br>")}</div>
        ${locked?`<p class="sub">الطلب مقفول لأنه قيد المراجعة.</p>`:`<label class="ck"><input type="checkbox" name="accept"> قرأت العقد وأوافق عليه</label><div class="form"><label class="w">اسمك كتوقيع *<input name="sign_name"></label></div>
        <p class="err" id="iberr" role="alert"></p><div class="acts2" style="gap:10px"><button class="btn" type="button" id="ibdraft">${ic("doc")} حفظ مسودة</button><button class="btn gold" type="submit" style="flex:1">${ic("pen")} وقّع وأرسل</button></div>`}`)}
    </form>`);
  if(locked)return;
  $("#ibdoc").onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>8*1024*1024){toast("الحد الأقصى 8MB");return}
    try{const p=await API.upload(f);docs=docs.concat(p);$("#ibdocs").textContent="مرفوع: "+docs.length+" ملف"}catch(x){toast("تعذر رفع الملف")}};
  const save=async submit=>{const f=new FormData($("#ibf")),d2=Object.fromEntries(f.entries()),er=$("#iberr");er.textContent="";
    Object.assign(d2,{docs,accept:!!f.get("accept"),ua:navigator.userAgent});
    try{await API.ibSave(d2,submit);toast(submit?"انرسل طلبك":"انحفظت المسودة");ibPage()}catch(x){er.textContent=errMsg(x)}};
  $("#ibdraft").onclick=()=>save(false);$("#ibf").onsubmit=e=>{e.preventDefault();save(true)};
}
const SECTIONS={apply:applyPage,team:teamPage,ranks:ranksPage,plan:planPage,lead:leadPage,help:helpPage,agreement:agreementPage,ib:ibPage};

/* ---------------- router ---------------- */
async function route(){
  const h=(location.hash||"#join").slice(1),[root,sub]=h.split("/");
  window.scrollTo(0,0);
  if(root==="partner")return partnerPage(sub);
  if(SECTIONS[root])return SECTIONS[root](sub);
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
