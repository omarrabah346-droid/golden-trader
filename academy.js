
(function(){
"use strict";
const CONFIG={
  SUPABASE_URL:"https://rczvkpzxkwxzoivyiblo.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_S4Huon2QXOIltvxoFIDdXQ_h79LR245",
  SITE:"app.html",
  IB:"https://myaccount.infinox.com/ar/links/go/9935360",
};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(v,c)=>`${c||S.info.currency||"$"}${Number(v||0).toLocaleString("en-US")}`;
const fmtDate=d=>new Date(d).toLocaleString(window.LANG||"ar",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"});
const toast=t=>{const e=document.createElement("div");e.className="toast";e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),3200)};

/* ================= data ================= */
function realApi(){
  const sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
  const chk=r=>{if(r.error)throw new Error(r.error.message);return r.data};
  return{
    async user(){const{data}=await sb.auth.getSession();return data.session?data.session.user:null},
    async rpc7(f,a){return chk(await sb.rpc(f,a))},
    // Supabase يرسل SIGNED_IN كل ما ترجع للصفحة أو يتجدد التوكن، وهذا كان يعيد رسم الصفحة (يصفّر الاختبار ويطلعك لفوق)
    // هسه نعيد الرسم بس إذا فعلاً تغيّر المستخدم (دخول جديد أو خروج)
    onAuth(cb){let last;sb.auth.getSession().then(({data})=>{last=data.session?data.session.user.id:null});
      sb.auth.onAuthStateChange((ev,session)=>{const id=session&&session.user?session.user.id:null;
        if(ev!=="SIGNED_IN"&&ev!=="SIGNED_OUT")return;if(id===last)return;last=id;cb()})},
    async signOut(){await sb.auth.signOut()},
    async profile(id){return chk(await sb.from("profiles").select("id,full_name,avatar_url,role,status,email").eq("id",id).maybeSingle())},
    async info(){const r=chk(await sb.from("site_info").select("key,value"));const o={};r.forEach(x=>o[x.key]=x.value);return o},
    async courses(){return chk(await sb.from("courses").select("*").order("sort"))},
    async lessons(){return chk(await sb.from("lessons").select("*").order("course_id").order("idx"))},
    async body(id){return chk(await sb.from("lesson_bodies").select("body,quiz").eq("lesson_id",id).maybeSingle())},
    async progress(){return chk(await sb.from("lesson_progress").select("lesson_id,score"))},
    async saveProgress(id,score){chk(await sb.from("lesson_progress").upsert({lesson_id:id,score}))},
    async submitQuiz(lid,picks){return chk(await sb.rpc("submit_quiz",{lid,picks}))},
    async certs(){return chk(await sb.from("certificates").select("*"))},
    async issueCert(cid,en_name){return chk(await sb.rpc("issue_certificate",{cid,en_name}))},
    async verifyCert(cc){return chk(await sb.rpc("verify_certificate",{cc}))},
    async publicStats(){return chk(await sb.rpc("public_stats"))},
    async uploadCert(blob,code){const u=(await sb.auth.getUser()).data.user;const path=`${u.id}/${code}.png`;
      chk(await sb.storage.from("certs").upload(path,blob,{upsert:true,contentType:"image/png",cacheControl:"3600"}));return sb.storage.from("certs").getPublicUrl(path).data.publicUrl},
    async uploadImg(blob,name,type){const u=(await sb.auth.getUser()).data.user;const path=`${u.id}/${name}`;chk(await sb.storage.from("certs").upload(path,blob,{upsert:true,contentType:type||"image/jpeg",cacheControl:"3600"}));return sb.storage.from("certs").getPublicUrl(path).data.publicUrl},
    async pushSub(ep,k,a,agent){return chk(await sb.rpc("push_subscribe",{ep,k,a,agent}))},
    async certEmail(cc,img){return chk(await sb.rpc("cert_email",{cc,img:img||""}))},
    async purchases(){return chk(await sb.from("purchases").select("*").order("created_at",{ascending:false}))},
    async buy(f){const r=await sb.from("purchases").insert(f);if(r.error&&/receipt_hash/.test(r.error.message)){delete f.receipt_hash;chk(await sb.from("purchases").insert(f))}else chk(r)},
    async touch(pg){chk(await sb.rpc("touch_presence",{pg}))},
    async uploadReceipt(blob){const u=(await sb.auth.getUser()).data.user;const path=`${u.id}/${Date.now()}-${Math.random().toString(36).slice(2,10)}.jpg`;
      chk(await sb.storage.from("receipts").upload(path,blob,{contentType:blob.type||"image/jpeg",cacheControl:"3600"}));return sb.storage.from("receipts").getPublicUrl(path).data.publicUrl},
    async sessions(){return chk(await sb.from("live_sessions").select("id,title,description,course_id,starts_at,minutes,audience").gte("starts_at",new Date(Date.now()-3*3600e3).toISOString()).order("starts_at"))},
    async rsvps(){return chk(await sb.from("session_rsvp").select("session_id"))},
    async rsvp(id,on){if(on)chk(await sb.from("session_rsvp").upsert({session_id:id}));else chk(await sb.from("session_rsvp").delete().eq("session_id",id))},
    async link(id){return chk(await sb.rpc("get_session_link",{sid:id}))},
    async aiAsk(q,ctx,lang){return chk(await sb.rpc("ai_ask",{q,ctx,lang}))},
    async aiResult(id){return chk(await sb.rpc("ai_result",{aid:id}))},
    async recordings(){return chk(await sb.rpc("my_recordings"))},
    async candles(sym,tf){const r=chk(await sb.from("market_cache").select("sym,tf,data,updated_at").eq("tf",tf));return r||[]},
    async labSave(r){chk(await sb.from("lab_trades").insert(r))},
    async adsHome(){return chk(await sb.rpc("ads_home"))},
    async seats(){return chk(await sb.rpc("session_seats"))},
    async mentorStats(){return chk(await sb.rpc("mentor_stats"))},
    async mentorAsk(lang){return chk(await sb.rpc("mentor_ask",{lang}))},
    async mentorPlan(week){return chk(await sb.from("mentor_plans").select("*").eq("week",week).maybeSingle())},
    async mentorSave(r){chk(await sb.from("mentor_plans").upsert(r,{onConflict:"user_id,week"}))},
    async certRequest(f){chk(await sb.from("cert_requests").insert(f))},
    async myCertRequests(){const q=c=>sb.from("cert_requests").select(c).order("created_at",{ascending:false}).limit(20);const B="id,course_id,en_name,email,status,cert_code,admin_note,created_at";let r=await q(B+",exam_status,exam_at,exam_link,exam_score,consent,pub_status,pref_times");if(r.error)r=await q(B);return chk(r)},
    async aCertRequests(){return chk(await sb.rpc("admin_cert_requests"))},
    async aIssueCert(rid,nm,cid,sc){return chk(await sb.rpc("admin_issue_cert",{rid,nm,cid,sc}))},
    async aRejectCert(rid,why){chk(await sb.rpc("admin_reject_cert",{rid,why}))},
    async aSetSession(id,f){chk(await sb.from("live_sessions").update(f).eq("id",id))},
    async indRequest(f){chk(await sb.from("indicator_requests").insert(f))},
    async myIndRequests(){return chk(await sb.from("indicator_requests").select("indicator,tv_user,status,admin_note,created_at,expires_at").order("created_at",{ascending:false}).limit(30))},
    async aIndRequests(){return chk(await sb.rpc("admin_ind_requests"))},
    async aMedia(blob,path,type){chk(await sb.storage.from("media").upload(path,blob,{contentType:type,cacheControl:"31536000",upsert:false}));return sb.storage.from("media").getPublicUrl(path).data.publicUrl},
    async aIndRemoved(rid){chk(await sb.rpc("admin_ind_removed",{rid}))},
    async aIndSet(rid,ok,why){chk(await sb.rpc("admin_ind_set",{rid,ok,why:why||""}))},
    async aSetRecording(sid,url){chk(await sb.rpc("admin_set_recording",{sid,url}))},
    async aAttendance(sid){return chk(await sb.rpc("admin_attendance",{sid}))},
    async aMarkAttended(sid,uid,ok){chk(await sb.rpc("admin_mark_attended",{sid,uid,ok}))},
    // admin
    async aStats(){return chk(await sb.rpc("admin_academy_stats"))},
    async myPerms(){return chk(await sb.rpc("my_perms"))||[]},
    async aPurchases(){return chk(await sb.rpc("admin_purchases"))},
    async aSetPurchase(id,f){chk(await sb.from("purchases").update(f).eq("id",id))},
    async aSessions(){return chk(await sb.rpc("admin_sessions"))},
    async aMembers(){return chk(await sb.rpc("admin_members"))},
    async aGrant(uid,what,cid,days){return chk(await sb.rpc("admin_grant",{uid,what,cid:cid||null,days:days||null}))},
    async aRevoke(pid){chk(await sb.rpc("admin_revoke",{pid}))},
    async aAddSession(f){chk(await sb.from("live_sessions").insert(f))},
    async aDelSession(id){chk(await sb.from("live_sessions").delete().eq("id",id))},
    async aSetInfo(o){chk(await sb.from("site_info").upsert(Object.entries(o).map(([key,value])=>({key,value}))))},
    async aSetCourse(id,f){chk(await sb.from("courses").update(f).eq("id",id))},
    async aUpload(blob,name){const path=`coach/${name}`;chk(await sb.storage.from("avatars").upload(path,blob,{upsert:true,contentType:"image/jpeg",cacheControl:"60"}));return sb.storage.from("avatars").getPublicUrl(path).data.publicUrl+"?v="+Date.now()},
  };
}
const API=window.__ACADEMY_MOCK||realApi();
function trackAcademyAttribution(){
  if(window.__ACADEMY_MOCK)return;
  window.VexoraAttribution?.visit("campaign",(c,a,pth)=>API.rpc7("track_visit",{c,a,pth}))?.catch(()=>{});
  window.VexoraAttribution?.visit("partner",(c,a)=>API.rpc7("partner_visit",{c,a}))?.catch(()=>{});
}
function assignAcademyAttribution(user){
  if(window.__ACADEMY_MOCK||!user)return;
  window.VexoraAttribution?.assign("campaign",user.id,c=>API.rpc7("set_my_campaign",{c}))?.catch(()=>{});
  window.VexoraAttribution?.assign("partner",user.id,c=>API.rpc7("set_my_partner",{c}))?.catch(()=>{});
}
trackAcademyAttribution();
window.addEventListener("online",()=>{
  trackAcademyAttribution();
  API.user().then(assignAcademyAttribution).catch(()=>{});
});

/* ================= state ================= */
const S={user:null,profile:null,info:{},courses:[],lessons:[],progress:{},purchases:[],sessions:[],rsvp:new Set(),certs:[]};
const isAdmin=()=>S.profile&&S.profile.role==="admin";
const freeN=()=>parseInt(S.info.free_lessons||"1",10)||1;
const paid=p=>p.status==="paid"||p.status==="done";
const hasMonthly=()=>isAdmin()||canP("courses")||S.purchases.some(p=>p.kind==="monthly"&&paid(p)&&new Date(p.expires_at)>new Date());
const ownsCourse=cid=>isAdmin()||canP("courses")||hasMonthly()||S.purchases.some(p=>p.kind==="course"&&p.course_id===cid&&paid(p));
const pendingFor=(kind,cid)=>S.purchases.find(p=>p.kind===kind&&(kind!=="course"||p.course_id===cid)&&p.status==="pending");
const lessonsOf=cid=>S.lessons.filter(l=>l.course_id===cid).sort((a,b)=>a.idx-b.idx);
const isMember=()=>isAdmin()||(S.profile&&S.profile.status==="approved");
const canRead=l=>!!S.user&&((isMember()&&l.idx<=freeN())||ownsCourse(l.course_id));
const course=id=>S.courses.find(c=>c.id===id);
const coachName=()=>S.info.coach_name||"كوتش عمر";
const tgUser=()=>(S.info.coach_tg||"omo_rabah").replace(/^@/,"");
const chUser=()=>(S.info.coach_channel||"sbworldmodel").replace(/^@/,"");
const photo=()=>S.info.coach_photo||"coach-sq.jpg";
const cover=()=>S.info.coach_cover||"coach.jpg";
const JL=(k,d)=>{try{const v=JSON.parse(S.info[k]||"");return Array.isArray(v)?v:d}catch(e){return d}};
const VX_COACHES=[{name:"كوتش إيفان",title:"مدرّب تداول · الكريبتو والفوركس",photo:"coach-ivan.jpg",tg:"Evan_ProfZone"},{name:"كوتش عمر",title:"مدرّب تداول · التحليل الفني والكلاسيكي",photo:"coach-omar.jpg",tg:"omo_rabah"}];
const VX_CERTS=[{flag:"🇫🇷",country:"فرنسا",name:""},{flag:"🇩🇪",country:"ألمانيا",name:""},{flag:"🇸🇪",country:"السويد",name:""},{flag:"🇬🇧",country:"بريطانيا",name:""}];
const VXP={sbworldmodel:"avatar-omar.jpg",omo_rabah:"avatar-omar.jpg",cochevano:"avatar-ivan.jpg",evan_profzone:"avatar-ivan.jpg"};
const VX_CONTACTS=[{type:"channel",name:"قناة البروفيسور",user:"cochEvano"},{type:"channel",name:"قناة الباشا",user:"sbworldmodel"},{type:"coach",name:"كوتش إيفان",user:"Evan_ProfZone"},{type:"coach",name:"كوتش عمر",user:"omo_rabah"}];
const coaches=()=>JL("vx_coaches",VX_COACHES),vxCerts=()=>JL("vx_certs",VX_CERTS),vxInds=()=>JL("vx_indicators",[]),vxContacts=()=>JL("vx_contacts",VX_CONTACTS);
const tgU=u=>String(u||"").trim().replace(/^https?:\/\/(t\.me|telegram\.me)\//i,"").replace(/^@/,"").replace(/[^A-Za-z0-9_+].*$/,"");
const canP=k=>isAdmin()||(S.perms||[]).includes(k);
const isStaff=()=>isAdmin()||(S.perms||[]).length>0;

async function loadAll(){
  const [info,courses,lessons]=await Promise.all([API.info(),API.courses().catch(e=>{console.error("[VEXORA] courses:",e);return[]}),API.lessons().catch(e=>{console.error("[VEXORA] lessons:",e);return[]})]);
  S.info=info;S.courses=courses;S.lessons=lessons;if(info.ib_link&&/^https?:\/\//i.test(info.ib_link))CONFIG.IB=info.ib_link;
  S.user=await API.user();S.profile=null;S.perms=[];S.progress={};S.purchases=[];S.rsvp=new Set();S.certs=[];
  assignAcademyAttribution(S.user);
  if(S.user){
    const [pf,pr,pu,rs]=await Promise.all([API.profile(S.user.id).catch(()=>null),API.progress().catch(()=>[]),API.purchases().catch(()=>[]),API.rsvps().catch(()=>[])]);
    S.profile=pf;pr.forEach(x=>S.progress[x.lesson_id]=x.score);S.purchases=pu;S.rsvp=new Set(rs.map(x=>x.session_id));
    try{S.certs=API.certs?await API.certs()||[]:[]}catch(e){S.certs=[]}
    S.perms=[];try{S.perms=API.myPerms?await API.myPerms()||[]:[]}catch(e){S.perms=[]}
  }
  try{S.sessions=await API.sessions()}catch(e){S.sessions=[]}
}

/* ================= shell ================= */
function renderWho(){
  const w=$("who");
  if(!S.user){w.innerHTML=`<a class="btn sm" href="${CONFIG.SITE}">تسجيل الدخول</a><a class="btn gold sm" href="${CONFIG.SITE}#signup">سجّل الآن</a>`;}
  else{const n=(S.profile&&S.profile.full_name)||S.user.email||"";const a=S.profile&&S.profile.avatar_url;
    w.innerHTML=`${a?`<img class="av" src="${esc(a)}" alt="">`:`<span class="av" aria-hidden="true">${esc((n||"؟").trim()[0]||"؟")}</span>`}<span class="muted" style="font-size:13.5px">${esc(n.split(/[\s@]/)[0])}</span><button class="btn sm ghost" type="button" id="outBtn">خروج</button>`;
    $("outBtn").onclick=async()=>{await API.signOut();await loadAll();render()}}
  $("navOrders").hidden=!S.user;$("navAdmin").hidden=!isStaff();{const g=document.getElementById("gAdm");if(g)g.hidden=!isStaff()}
  $("footLinks").innerHTML="";window.__VXC=vxContacts();
}
function coachLinks(small){
  const c=small?"btn sm":"btn";
  return `<a class="${c}" href="https://t.me/${esc(tgUser())}" target="_blank" rel="noopener">✈️ تيليجرام @${esc(tgUser())}</a>`
   +`<a class="${c}" href="https://t.me/${esc(chUser())}" target="_blank" rel="noopener">📢 قناتي @${esc(chUser())}</a>`
   +(S.info.coach_email?`<a class="${c}" href="mailto:${esc(S.info.coach_email)}">✉️ ${esc(S.info.coach_email)}</a>`:"");
}
function coachCards(){return coaches().map(c=>`<div class="vxc"><div class="ph" style="background-image:url('${esc(c.photo||"")}')" role="img" aria-label="${esc(c.name)}"></div><div class="bd"><b>${esc(c.name)}</b><small>${esc(c.title||"")}</small>${c.tg?`<a href="https://t.me/${esc(tgU(c.tg))}" target="_blank" rel="noopener">@${esc(tgU(c.tg))}</a>`:""}</div></div>`).join("")}
function vxCompany(){return`<section class="vx-sec" id="company"><div class="wrap vx-co"><div>
  <span class="kicker">🏢 مع مَن تتعامل</span><h2 style="margin:10px 0 4px">شركة مسجّلة رسمياً، مو قناة مجهولة خلف يوزر</h2>
  <div class="vx-kv"><div><small>🏢 الكيان القانوني</small><b>فيكسورا للتجارة العامة - ذ.م.م</b></div><div><small>⚖️ الشكل القانوني</small><b>شركة ذات مسؤولية محدودة (ذ.م.م)</b></div>
  <div class="w"><small>🏛 مسجّلة في</small><b>أبوظبي، الإمارات العربية المتحدة — دائرة التنمية الاقتصادية، سلطة أبوظبي للتسجيل (ADRA)</b></div></div>
  <div class="vx-rules">❖ عنوان دفع واحد فقط، الظاهر داخل المنصة. ما راح يطلب منك أي كوتش تحويل فلوس لأي جهة ثانية.<br>❖ كل طلب إله رقم، وكل اعتماد مسجّل.<br>❖ الكوتشات معروفين بالاسم، والتواصل وياهم كتابةً من داخل المنصة.</div>
  <p class="vx-claim">نحن نعلّم التداول. لا ندير أموالك، ولا نستلم ودائع، ولا نعد بأرباح — ومن يفعل ذلك ليس نحن.</p></div>
  <figure class="vx-photo" style="margin:0"><img src="${esc(S.info.vx_team_photo||"team.jpg")}" alt="كوتش إيفان وكوتش عمر" loading="lazy"><figcaption>كوتش إيفان وكوتش عمر · مؤتمر EVOLVE الأوروبي، براغ</figcaption></figure></div></section>`}
function vxCertsHTML(){const L=vxCerts();if(!L.length)return"";return`<section class="vx-sec" id="certificates"><div class="wrap"><span class="kicker">🎓 اعتمادات دولية</span><h2 style="margin:10px 0 4px">شهادات الكوتشات الدولية</h2>
  <div class="vx-certs">${L.map(c=>`<div class="vx-cert"><span class="fl">${esc(c.flag||"🎓")}</span><div><b>${esc(c.name||c.country||"")}</b>${c.name&&c.country?`<span>${esc(c.country)}</span>`:""}</div></div>`).join("")}</div></div></section>`}
function vxIndsHTML(){const L=vxInds();if(!L.length)return"";return`<section class="vx-sec" id="indicators"><div class="wrap"><span class="kicker">📈 مؤشرات حصرية</span><h2 style="margin:10px 0 4px">مؤشرات فيكسورا</h2>
  <div class="vx-inds">${L.map(c=>`<div class="vx-ind"><b>📈 ${esc(c.name||"")}</b>${c.platform?`<span class="chip gold" style="margin-bottom:8px">${esc(c.platform)}</span>`:""}${c.image&&!c.video?`<img class="v2-indimg" src="${esc(c.image)}" alt="${esc(c.name||"")}" loading="lazy">`:""}<p>${esc(c.desc||"")}</p>${v2IndVid(c)}${v2IndBtn(c)}</div>`).join("")}</div></div></section>`}
function vxSupportHTML(){const L=vxContacts();if(!L.length)return"";return`<section class="vx-sec" id="support"><div class="wrap"><span class="kicker">🎧 الدعم والتواصل</span><h2 style="margin:10px 0 4px">تواصل ويانا مباشرة</h2>
  <div class="vx-sup">${L.map(c=>`<a href="https://t.me/${esc(tgU(c.user))}" target="_blank" rel="noopener"><span class="ic${c.type==="coach"?" c":""}" style="${c.photo||VXP[tgU(c.user).toLowerCase()]?`background:#222 url('${esc(c.photo||VXP[tgU(c.user).toLowerCase()])}') center/cover;border-radius:50%;border:2px solid #d4af37`:""}">${c.photo||VXP[tgU(c.user).toLowerCase()]?"":c.type==="coach"?"👤":"📢"}</span><span><b>${esc(c.name||"")}</b><span>@${esc(tgU(c.user))}</span></span></a>`).join("")}</div></div></section>`}
function setNav(k){document.querySelectorAll("[data-nav]").forEach(a=>a.toggleAttribute("aria-current",a.dataset.nav===k));if(document.querySelector(`[data-nav="${k}"]`))document.querySelector(`[data-nav="${k}"]`).setAttribute("aria-current","page")}

/* ================= home ================= */
function courseCard(c){
  const ls=lessonsOf(c.id),done=ls.filter(l=>S.progress[l.id]!=null).length,own=ownsCourse(c.id),pend=pendingFor("course",c.id);
  const first=ls[0];
  return `<article class="course">
    ${own&&!isAdmin()?'<span class="chip up owned">✓ مفتوحة لك</span>':pend?'<span class="chip gold owned">⏳ بانتظار التفعيل</span>':""}
    <div class="ic" aria-hidden="true">${esc(c.icon)}</div>
    <h3>${esc(c.title)}</h3>
    <p>${esc(c.subtitle)}</p>
    <div class="meta"><span class="chip">${ls.length} دروس</span><span class="chip">⏱ ${ls.reduce((s,l)=>s+(+l.minutes||0),0)} دقيقة</span><span class="chip">${esc(c.level)}</span><span class="chip gold">الدرس الأول مجاني</span></div>
    ${v2Pre(c)?`<div class="pre">📌 يفضّل تخلص قبلها: ${esc(v2Pre(c).title)}</div>`:""}
    ${S.user&&done?`<div><div class="bar"><i style="width:${Math.round(done/ls.length*100)}%"></i></div><small class="muted">أنهيت ${done} من ${ls.length}</small></div>`:""}
    <div class="foot">${own?'<span class="chip up">كاملة</span>':`<span class="price">${money(c.price)}</span>`}
      <a class="btn gold sm" href="#course/${esc(c.id)}">${done?"كمّل التعلّم":own?"ابدأ الدورة":"ابدأ مجاناً"}</a></div>
  </article>`;
}
function aiPlanHTML(){
  const has=S.purchases.some(p=>p.kind==="ai"&&paid(p)&&new Date(p.expires_at)>new Date()),pend=S.purchases.some(p=>p.kind==="ai"&&p.status==="pending");
  return`<div class="panel" style="margin-top:16px;border-color:var(--accent);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center">
    <div><h3 style="margin:0 0 6px;font-size:19px">🤖 اشتراك مساعد الذكاء الصناعي</h3>
      <p class="muted" style="margin:0 0 8px">مساعد يقرا الشارت ويه تحليل المنصة ويشرحلك: الاتجاه، الدعوم والمقاومات، الفيبوناتشي، الموجات، والصفقة. ويعلّمك شلون ترسمها بنفسك.</p>
      <ul style="margin:0;padding-inline-start:18px;font-size:14px;line-height:1.9"><li>30 سؤال باليوم بدل سؤال واحد مجاني</li><li>يشتغل على كل الأزواج والفريمات، ويا شارت التحليل الكامل</li><li>بالعربي والإنكليزي والفرنسي والألماني</li></ul></div>
    <div style="text-align:center"><div class="price" style="font-size:28px">${money(S.info.price_ai||10)}<small class="muted" style="font-size:14px"> / شهر</small></div>
      ${has?'<span class="chip up">✓ اشتراكك فعّال</span>':pend?'<span class="chip gold">⏳ طلبك بانتظار التفعيل</span>':'<button class="btn gold" type="button" data-buy="ai">اشترك بالمساعد</button>'}
      <div style="margin-top:8px"><a class="muted" style="font-size:12.5px" href="app.html#chart">جرّبه مجاناً (سؤال باليوم) ←</a></div></div></div>`}
const hasVip=()=>isAdmin()||S.purchases.some(p=>["vip","deposit","monthly"].includes(p.kind)&&paid(p)&&new Date(p.expires_at)>new Date());
function vipOfferHTML(){
  const pend=pendingFor("deposit")||pendingFor("vip"),min=S.info.vip_min_deposit||100;
  const until=S.purchases.filter(p=>["vip","deposit","monthly"].includes(p.kind)&&paid(p)&&new Date(p.expires_at)>new Date()).map(p=>new Date(p.expires_at)).sort((a,b)=>b-a)[0];
  return `<div class="offers" style="margin-bottom:18px"><div class="offer best" style="grid-column:1/-1">
    <span class="chip gold" style="align-self:flex-start">⭐ VIP</span>
    <h3>قناة التوصيات والتوصيات المفتوحة ومؤشرات TradingView</h3>
    <ul><li>توصيات الذهب والفوركس وقت الدخول، بالدخول والوقف والأهداف وسبب الدخول</li><li>قناة التوصيات على تيليجرام</li><li>مؤشرات TradingView مجاناً طول مدة اشتراكك</li></ul>
    <p class="muted" style="margin:4px 0 12px">تفعّله بطريقتين: <b>أودع ${money(min)} أو أكثر بحسابك عند INFINOX</b> وارفع صورة الإيداع (مجاناً، شهر كامل)، أو <b>اشترك ${money(S.info.price_vip||100)} بالشهر</b>.</p>
    ${hasVip()&&!isAdmin()?`<span class="chip up">✓ VIP فعّال${until?` لحد ${until.toLocaleDateString(window.LANG||"ar")}`:""}</span>`:pend?'<span class="chip gold">⏳ طلبك بانتظار المراجعة</span>':`<div class="acts2"><button class="btn gold" type="button" data-buy="deposit">🏦 أودعت، فعّل VIP</button><button class="btn" type="button" data-buy="vip">💳 اشترك ${money(S.info.price_vip||100)} / شهر</button></div>`}
  </div></div>`;
}
function openDeposit(){
  const min=Number(S.info.vip_min_deposit||100),acc0=(S.profile&&S.profile.broker_account)||"";
  $("dlgBody").innerHTML=`<h2>تفعيل VIP بالإيداع</h2>
    <p class="muted">إذا أودعت <b>${money(min)} أو أكثر</b> بحسابك عند INFINOX، ارفع صورة الإيداع ويتفعّل VIP <b>شهر كامل</b> بعد ما نتأكد منه. الفلوس تبقى بحسابك إنت.</p>
    <form class="fm" id="depForm">
      <label>رقم حسابك عند INFINOX<input id="dAcc" class="ltr" inputmode="numeric" maxlength="20" required value="${esc(acc0)}" placeholder="مثلاً 88014637"></label>
      <label>مبلغ الإيداع ($)<input id="dAmt" class="ltr" type="number" min="${min}" step="1" required placeholder="${min}"></label>
      <label>📷 صورة الإيداع من INFINOX<span class="rcp" id="dBox"><span class="muted">اضغط واختار صورة الإيداع (من سجل المعاملات بحسابك)</span></span><input id="dRcp" type="file" accept="image/*" hidden></label>
      <button class="btn gold" type="submit">أرسل للمراجعة</button>
      <p class="msg" id="dMsg"></p>
    </form>
    <button class="btn ghost" type="button" data-close>إلغاء</button>`;
  $("dlg").showModal();
  let rcp=null,rcpOrig=null;
  $("dBox").onclick=()=>$("dRcp").click();
  $("dRcp").onchange=async e=>{const f=e.target.files[0];if(!f)return;rcpOrig=f;try{rcp=await shrinkImg(f,1400);$("dBox").innerHTML=`<img src="${URL.createObjectURL(rcp)}" alt="">`}catch(err){rcp=f.size<12e6?f:null;$("dBox").innerHTML=rcp?'<span>✓ تم اختيار الصورة</span>':`<span class="muted">${esc(err.message)}</span>`}};
  $("depForm").onsubmit=async e=>{e.preventDefault();const btn=e.submitter||$("depForm").querySelector("button");
    const say=(m,ok)=>{$("dMsg").className="msg "+(ok?"ok":"err");$("dMsg").textContent=m};
    const acc=($("dAcc").value||"").replace(/\D/g,""),amt=Number($("dAmt").value||0);
    if(acc.length<5)return say("اكتب رقم حسابك عند INFINOX صح");
    if(!(amt>=min))return say(`أقل إيداع للتفعيل ${money(min)}`);
    if(!rcp)return say("ارفع صورة الإيداع");
    btn.disabled=true;say("جاري الإرسال…",true);
    const f={kind:"deposit",pay_ref:"",note:`حساب INFINOX: ${acc} · الإيداع: ${amt}$`};
    if(rcpOrig&&crypto.subtle){try{const b=await crypto.subtle.digest("SHA-256",await rcpOrig.arrayBuffer());f.receipt_hash=[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}catch(_){}}
    try{f.receipt_url=await API.uploadReceipt(rcp)}catch(err){btn.disabled=false;return say("ما گدرنا نرفع الصورة: "+err.message)}
    try{await API.buy(f);S.purchases=await API.purchases();$("dlg").close();toast("✅ وصل طلبك. أول ما نتأكد من الإيداع يتفعّل VIP ويوصلك إشعار");location.hash="orders"}
    catch(err){say(err.message);btn.disabled=false}};
}
function offersHTML(){
  const m=pendingFor("monthly"),z=pendingFor("zoom");
  return `<div class="offers">
    <div class="offer best">
      <span class="chip gold" style="align-self:flex-start">⭐ الأوفر</span>
      <h3>الاشتراك الشهري الكامل</h3>
      <div class="price">${money(S.info.price_monthly)} <small>/ شهر</small></div>
      <ul><li>كل الدورات الخمس بكل دروسها</li><li>كل دروس الزوم المباشرة الأسبوعية</li><li>مراجعة صفقاتك ويا الكوتش</li><li>تذكير بالإيميل وتيليجرام قبل كل درس</li></ul>
      ${hasMonthly()&&!isAdmin()?'<span class="chip up">✓ اشتراكك فعّال</span>':m?'<span class="chip gold">⏳ طلبك بانتظار التفعيل</span>':`<button class="btn gold" type="button" data-buy="monthly">اشترك الآن</button>`}
    </div>
    <div class="offer">
      <h3>جلسة زوم خاصة ويا الكوتش</h3>
      <div class="price">${money(S.info.price_zoom)} <small>/ ساعة</small></div>
      <ul><li>ساعة كاملة ون تو ون على زوم</li><li>نحلل حسابك وصفقاتك سوا</li><li>تختار الموضوع: فني، موجي، زمني، رقمي، كلاسيكي</li><li>تختار الوقت المناسب إلك</li></ul>
      ${z?'<span class="chip gold">⏳ عندك طلب جلسة بانتظار التأكيد</span>':`<button class="btn" type="button" data-buy="zoom">احجز جلستك</button>`}
    </div>
  </div>`;
}
function pageHead(t,sub,extra){return`<div class="wrap"><div class="phead"><div><h1>${t}</h1>${sub?`<p>${sub}</p>`:""}</div>${extra||""}</div></div>`}
const IC3={"cap": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M24 11 7 19l17 8 17-8z\" fill=\"url(#g3g)\"/><path d=\"M24 11 7 19l17 8z\" fill=\"#fff6d2\" opacity=\".35\"/><path d=\"M14 22.5v7c0 2.6 4.5 5 10 5s10-2.4 10-5v-7l-10 4.7z\" fill=\"#26201a\" stroke=\"url(#g3b)\" stroke-width=\"1\"/><path d=\"M37 20v9\" stroke=\"#e9bf4f\" stroke-width=\"1.6\"/><circle cx=\"37\" cy=\"31\" r=\"2.2\" fill=\"url(#g3g)\"/></g></svg>", "candles": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><rect x=\"13.2\" y=\"12\" width=\"1.6\" height=\"24\" rx=\".8\" fill=\"#1fbf80\"/><rect x=\"10\" y=\"17\" width=\"8\" height=\"13\" rx=\"1.6\" fill=\"url(#g3gr)\"/><rect x=\"23.2\" y=\"9\" width=\"1.6\" height=\"26\" rx=\".8\" fill=\"#e5414f\"/><rect x=\"20\" y=\"13\" width=\"8\" height=\"15\" rx=\"1.6\" fill=\"url(#g3rd)\"/><rect x=\"33.2\" y=\"10\" width=\"1.6\" height=\"24\" rx=\".8\" fill=\"#1fbf80\"/><rect x=\"30\" y=\"14\" width=\"8\" height=\"17\" rx=\"1.6\" fill=\"url(#g3gr)\"/></g></svg>", "cam": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><rect x=\"8\" y=\"15\" width=\"22\" height=\"18\" rx=\"4\" fill=\"url(#g3g)\"/><path d=\"M30 21l10-5v16l-10-5z\" fill=\"url(#g3g)\"/><rect x=\"8\" y=\"15\" width=\"22\" height=\"6\" rx=\"4\" fill=\"#fff6d2\" opacity=\".4\"/><circle cx=\"14\" cy=\"21\" r=\"2.4\" fill=\"#e5414f\"/></g></svg>", "medal": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M16 8h6l3 9-5 2zM32 8h-6l-3 9 5 2z\" fill=\"#e5414f\"/><path d=\"M19 8h3l2.5 7.5-2.4 1z\" fill=\"#ff8d97\" opacity=\".6\"/><circle cx=\"24\" cy=\"28\" r=\"10\" fill=\"url(#g3g)\"/><circle cx=\"24\" cy=\"28\" r=\"7\" fill=\"none\" stroke=\"#9a6f12\" stroke-width=\"1.2\"/><path d=\"m24 22.6 1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z\" fill=\"#fff4cf\"/></g></svg>", "trophy": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M15 11h18v6.5c0 6-4 10-9 10s-9-4-9-10z\" fill=\"url(#g3g)\"/><path d=\"M15 13H9.5c0 5 2.6 8 6.6 8.4M33 13h5.5c0 5-2.6 8-6.6 8.4\" fill=\"none\" stroke=\"url(#g3g)\" stroke-width=\"2.4\"/><rect x=\"21.5\" y=\"27\" width=\"5\" height=\"5\" fill=\"#b98b22\"/><path d=\"M15 37h18l-2-5H17z\" fill=\"url(#g3g)\"/><path d=\"M18 13h3v8c-2-1-3-4-3-8z\" fill=\"#fff6d2\" opacity=\".6\"/></g></svg>", "bars": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M10 37V27l3-2.4h6L16 27v10z\" fill=\"#7a5810\"/><rect x=\"10\" y=\"27\" width=\"6\" height=\"10\" fill=\"url(#g3gs)\"/><path d=\"M10 27l3-2.4h6L16 27z\" fill=\"#fff0bd\"/><rect x=\"20\" y=\"20\" width=\"6\" height=\"17\" fill=\"url(#g3gs)\"/><path d=\"M20 20l3-2.4h6L26 20z\" fill=\"#fff0bd\"/><path d=\"M26 20l3-2.4V35L26 37z\" fill=\"#7a5810\"/><rect x=\"30\" y=\"12\" width=\"6\" height=\"25\" fill=\"url(#g3gs)\"/><path d=\"M30 12l3-2.4h6L36 12z\" fill=\"#fff0bd\"/><path d=\"M36 12l3-2.4V35L36 37z\" fill=\"#7a5810\"/></g></svg>", "line": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M9 34l9-10 7 5 12-15\" fill=\"none\" stroke=\"#5a3f08\" stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(0 1.2)\"/><path d=\"M9 34l9-10 7 5 12-15\" fill=\"none\" stroke=\"url(#g3g)\" stroke-width=\"3.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"9\" cy=\"34\" r=\"3.2\" fill=\"url(#g3g)\"/><circle cx=\"18\" cy=\"24\" r=\"3.2\" fill=\"url(#g3g)\"/><circle cx=\"25\" cy=\"29\" r=\"3.2\" fill=\"url(#g3g)\"/><circle cx=\"37\" cy=\"14\" r=\"3.6\" fill=\"#fff4cf\"/></g></svg>", "mega": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M10 21h6l16-8v22l-16-8h-6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z\" fill=\"url(#g3g)\"/><path d=\"M14 27l2.5 9h4.5L19 27z\" fill=\"#b98b22\"/><path d=\"M36 19a6 6 0 0 1 0 10\" stroke=\"#e9bf4f\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>", "user": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><circle cx=\"24\" cy=\"17\" r=\"7\" fill=\"url(#g3g)\"/><path d=\"M10 38c0-7.5 6.3-12 14-12s14 4.5 14 12z\" fill=\"url(#g3g)\"/><circle cx=\"21.5\" cy=\"14.5\" r=\"2.4\" fill=\"#fff6d2\" opacity=\".6\"/></g></svg>", "cal": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><rect x=\"10\" y=\"12\" width=\"28\" height=\"26\" rx=\"4\" fill=\"url(#g3iv)\"/><path d=\"M10 16a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v4H10z\" fill=\"#e5414f\"/><rect x=\"16\" y=\"9\" width=\"3\" height=\"7\" rx=\"1.5\" fill=\"url(#g3g)\"/><rect x=\"29\" y=\"9\" width=\"3\" height=\"7\" rx=\"1.5\" fill=\"url(#g3g)\"/><g fill=\"#8a8578\"><rect x=\"14\" y=\"24\" width=\"4\" height=\"3.4\" rx=\".8\"/><rect x=\"22\" y=\"24\" width=\"4\" height=\"3.4\" rx=\".8\"/><rect x=\"30\" y=\"24\" width=\"4\" height=\"3.4\" rx=\".8\"/><rect x=\"14\" y=\"30.5\" width=\"4\" height=\"3.4\" rx=\".8\"/><rect x=\"22\" y=\"30.5\" width=\"4\" height=\"3.4\" rx=\".8\" fill=\"#d4a93a\"/></g></g></svg>", "crown": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M9 33 7 15l9 7 8-11 8 11 9-7-2 18z\" fill=\"url(#g3g)\"/><path d=\"M9 33 7 15l9 7 8-11v22z\" fill=\"#fff6d2\" opacity=\".3\"/><rect x=\"9\" y=\"33\" width=\"30\" height=\"4.6\" rx=\"1.4\" fill=\"#b98b22\"/><circle cx=\"24\" cy=\"25\" r=\"2.8\" fill=\"#e5414f\"/><circle cx=\"7\" cy=\"14\" r=\"2.2\" fill=\"url(#g3g)\"/><circle cx=\"24\" cy=\"10\" r=\"2.2\" fill=\"url(#g3g)\"/><circle cx=\"41\" cy=\"14\" r=\"2.2\" fill=\"url(#g3g)\"/></g></svg>", "tools": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M12 36 30 18\" stroke=\"#cfd3da\" stroke-width=\"4.2\" stroke-linecap=\"round\"/><path d=\"M30 18l3-3 4 1 1 4-3 3z\" fill=\"#e6e8ec\"/><path d=\"M12 36l3.5-3.5\" stroke=\"#e5414f\" stroke-width=\"5.2\" stroke-linecap=\"round\"/><path d=\"M36 36 19 19\" stroke=\"url(#g3gs)\" stroke-width=\"4.2\" stroke-linecap=\"round\"/><path d=\"M19.5 19.5a6 6 0 1 1-1.2-8.4l-3.4 3.4.6 3 3 .6 3.4-3.4a6 6 0 0 1-2.4 4.8z\" fill=\"url(#g3g)\"/></g></svg>"};
async function realNums(){const el=$("realNums");if(!el||!API.publicStats)return;let r=null;try{r=await API.publicStats()}catch(e){}
  if(!r)return;const f=n=>Number(n||0).toLocaleString("en-US");
  const items=[[f(r.members),"عضو بالمنصة"],[f(r.signals),"توصية منشورة"],...(r.win_rate==null?[]:[[r.win_rate+"%","نسبة نجاح التوصيات (90 يوم)"]]),[f(r.certs),"شهادة صادرة"]];
  $("realNumsG").innerHTML=items.map(([b,t])=>`<div><b><bdi dir="ltr">${b}</bdi></b><span>${t}</span></div>`).join("");el.hidden=false}
function home(){
  setNav("home");setTimeout(()=>V4A.hero(),0);
  const nL=S.lessons.length,next=S.sessions.find(s=>new Date(s.starts_at).getTime()>Date.now());
  $("view").innerHTML=`<div class="wrap" id="v4AHero" hidden style="padding-top:14px"></div>
  <section class="hero"><div class="wrap">
    <div>
      <span class="kicker">⟡ أكاديمية فيكسورا ⟡</span>
      <h1>الكريبتو والفوركس<br><em>تعليم تداول بمعايير المؤسسات</em></h1>
      <p class="lead">أكاديمية تعمل تحت شركة مسجّلة رسمياً في أبوظبي. دورات من الصفر للاحتراف، دروس زوم مباشرة، أدوات تحليل، ومنصة توصيات ويا شرح كل صفقة.</p>
      <div class="dips"><span class="chip gold">📈 دبلوم التحليل الفني</span><span class="chip gold">📐 الكلاسيكي</span><span class="chip gold">🌊 الموجي</span><span class="chip gold">⏳ الزمني</span><span class="chip gold">🔢 الرقمي</span></div>
      <div class="cta">${S.user&&isMember()?`<a class="btn gold" href="#courses">ابدأ التعلّم</a><a class="btn" href="app.html">📊 التوصيات</a>`:`<a class="btn gold" href="#join">شلون تنضم</a><a class="btn" href="${CONFIG.IB}" target="_blank" rel="noopener">افتح حساب INFINOX</a>${VXI.btn("join","▶️ شاهد الشرح","ghost")}`}</div>
    </div>
    <div class="vx-coaches">${coachCards()}</div>
  </div>
  <div class="wrap"><div class="stats">
    <div>${IC3.cap}<span><b>${S.courses.length}</b><span>دورات احترافية</span></span></div>
    <div>${IC3.candles}<span><b>${nL}</b><span>درس برسومات واختبارات</span></span></div>
    <div>${IC3.cam}<span><b>Zoom</b><span>دروس مباشرة أسبوعية</span></span></div>
    <div>${IC3.medal}<span><b>شهادة</b><span>موثّقة لكل دورة</span></span></div>
  </div>
  <div class="realnums" id="realNums" hidden><div class="rh"><b>📊 أرقام حقيقية من المنصة</b><small>تتحدث لحالها</small></div><div class="rg" id="realNumsG"></div></div></div></section>
  <section class="blk"><div class="wrap">
    <div class="sh"><div><h2>من وين تبدأ؟</h2><p>كل قسم إله صفحته.</p></div></div>
    <div class="tiles">
      <a class="tile" href="#courses"><span class="ti">${IC3.cap}</span><b>الدورات</b><span>${S.courses.length} دورات · ${nL} درس · الدرس الأول مجاني</span><i>افتح الدورات ←</i></a>
      <a class="tile" href="#live"><span class="ti">${IC3.cam}</span><b>دروس الزوم المباشرة</b><span>${next?`القادم: ${esc(next.title)} · ${fmtDate(next.starts_at)}`:"شوف المواعيد واضغط «ذكّرني»"}</span><i>المواعيد ←</i></a>
      <a class="tile" href="#tools"><span class="ti">${IC3.tools}</span><b>أدوات التحليل</b><span>فيبوناتشي، الزمني، القنوات، البيفوت، إليوت، السمارت موني، جان، وإدارة المخاطر</span><i>افتح الأدوات ←</i></a>
      <a class="tile" href="#plans"><span class="ti">${IC3.crown}</span><b>الاشتراك الشهري والجلسات الخاصة</b><span>كل الدورات + الزوم بـ ${money(S.info.price_monthly)} شهرياً، أو ساعة خاصة بـ ${money(S.info.price_zoom)}</span><i>الاشتراكات ←</i></a>
      <a class="tile" href="#courses"><span class="ti">🎓</span><b>شهادة إتمام موثّقة لكل دورة</b><span>باسمك، برقم و QR للتحقق، وتوصلك على الإيميل</span><i>شوف الشهادة ←</i></a>
      <a class="tile" href="app.html"><span class="ti">${IC3.candles}</span><b>منصة التوصيات</b><span>صفقات الذهب والفوركس والكريبتو بالتحليل الفني والكلاسيكي والموجي والزمني والرقمي</span><i>افتح المنصة ←</i></a>
    </div>
  </div></section>${vxCompany()}${vxCertsHTML()}${vxIndsHTML()}${vxSupportHTML()}`;
  setTimeout(realNums,0);
}
function coursesPage(){
  setNav("courses");
  $("view").innerHTML=pageHead("الدورات","كل دورة تفتح أول درس مجاناً. افتح الدورة اللي تهمك، أو اشترك بكلهن.",`<a class="btn" href="#plans">⭐ كل الدورات بالاشتراك الشهري</a>`)
    +`<section class="blk" style="padding-top:6px"><div class="wrap">${v2Continue()}<div class="v2a-bar"><input id="v2Q" type="search" placeholder="🔎 دوّر على دورة أو درس…" value="${esc(V2A.q)}" aria-label="بحث"><div class="chips" id="v2Lv">${["الكل",...new Set(S.courses.map(c=>c.level).filter(Boolean))].map(x=>`<button type="button" data-lv="${esc(x)}" class="${(V2A.lv||"الكل")===x?"on":""}">${esc(x)}</button>`).join("")}</div></div><div class="grid" id="v2Grid">${v2Filter().map(courseCard).join("")||'<div class="empty">ما لكينا دورة بهذا البحث.</div>'}</div><div style="margin-top:26px">${certShow(null)}</div></div></section>`;
}
function plansPage(){
  setNav("plans");
  $("view").innerHTML=pageHead("الاشتراكات والجلسات الخاصة","تعلّم ويا الكوتش مباشرة: اشتراك شهري لكل شي، أو ساعة خاصة على زوم، أو دورة وحدة بدفعة وحدة.")
    +`<section class="blk" style="padding-top:6px"><div class="wrap">${vipOfferHTML()}${offersHTML()}${aiPlanHTML()}
      <div class="sh" style="margin-top:30px"><div><h2>أو اشتري دورة وحدة</h2><p>دفعة وحدة ووصول دائم.</p></div></div>
      <div class="tbl"><table><thead><tr><th>الدورة</th><th>الدروس</th><th>السعر</th><th></th></tr></thead><tbody>${S.courses.map(c=>`<tr><td><b>${esc(c.icon)} ${esc(c.title)}</b><div class="muted" style="font-size:12.5px">${esc(c.level)}</div></td><td>${lessonsOf(c.id).length}</td><td class="price" style="font-size:17px">${money(c.price)}</td><td>${ownsCourse(c.id)?'<span class="chip up">✓ مفتوحة</span>':`<a class="btn sm" href="#course/${esc(c.id)}">التفاصيل</a>`}</td></tr>`).join("")}</tbody></table></div>
      <div class="panel" style="margin-top:18px"><b style="color:var(--accent)">💵 طريقة الدفع</b><div class="payinfo" style="margin-top:8px">${esc(S.info.pay_info||"")}</div></div>
    </div></section>`;
}
function livePage(){
  setNav("live");
  $("view").innerHTML=pageHead("دروس الزوم المباشرة","اضغط «ذكّرني» ويوصلك تذكير قبل يوم وقبل ساعة. رابط الدخول يطلع هنا قبل الدرس.",`<button class="btn" type="button" data-buy="zoom">🎯 احجز جلسة خاصة</button>`)
    +`<section class="blk" style="padding-top:6px"><div class="wrap"><p class="muted" style="font-size:13px;margin:0 0 12px">🕒 كل المواعيد معروضة بتوقيت جهازك (${esc(Intl.DateTimeFormat().resolvedOptions().timeZone||"")}).</p>${sessionsHTML()}<div id="v2Rec" style="margin-top:22px"></div></div></section>`;
  tickCountdowns();v2Recs();V4A.seats();
}
function indicatorsPage(){
  setNav("indicators");const L=vxInds();
  $("view").innerHTML=pageHead("مؤشرات فيكسورا","مؤشرات حصرية من كوتشات فيكسورا، ويا شرح شنو يسوي كل مؤشر وشلون تحصل عليه.")
   +`<section class="blk" style="padding-top:6px"><div class="wrap">${L.length?`<div class="vx-inds" style="margin-top:0">${L.map(c=>`<div class="vx-ind"><b>📈 ${esc(c.name||"")}</b>${c.platform?`<span class="chip gold" style="margin-bottom:8px">${esc(c.platform)}</span>`:""}${c.image&&!c.video?`<img class="v2-indimg" src="${esc(c.image)}" alt="${esc(c.name||"")}" loading="lazy">`:""}<p>${esc(c.desc||"")}</p>${v2IndVid(c)}${v2IndBtn(c)}</div>`).join("")}</div>`
     :`<div class="empty">المؤشرات راح تنضاف هنا قريباً.${canP("content")?` <a href="#admin" onclick="ADM.tab='content'">أضفها من إدارة الأكاديمية ← محتوى الموقع</a>`:""}</div>`}</div></section>`;
}
function toolsPage(){
  setNav("tools");
  const head=pageHead("أدوات التحليل","كل أدوات المدارس الست بمكان واحد: فيبوناتشي، الزمني، القنوات، الدعوم والمقاومات، إليوت، السمارت موني، جان، وإدارة المخاطر. وتحت كل أداة شرحها.");
  if(!S.user||!isMember()){$("view").innerHTML=head+`<section class="blk" style="padding-top:6px"><div class="wrap">${S.user?brokerGate():`<div class="paywall"><div class="lockic">🛠</div><h2>الأدوات للأعضاء</h2><p>سجّل وفعّل حسابك حتى تستخدم أدوات التحليل.</p><div class="cta"><a class="btn gold" href="${CONFIG.SITE}#signup">سجّل الآن</a><a class="btn" href="#join">شلون تنضم</a></div></div>`}</div></section>`;return}
  const INFO={
   fib:{d:"فيبوناتشي أداة ترسمها من قاع لقمة (أو العكس)، وتطلعلك نسب يرجع لها السعر عادةً قبل ما يكمل اتجاهه (التصحيح)، ونسب يوصلها بعد ما يكمل (الامتداد). أهم نسبة بيها 61.8%.",
    u:["تعرف وين تدخل بعد ما السعر يصحح، بدل ما تطارد الحركة","تحدد وقف منطقي خلف 78.6%","تحدد أهداف واقعية بالامتداد 161.8% و261.8%"],
    s:["حدد آخر موجة واضحة على الفريم اللي تشتغل عليه (قاع وقمة)","اكتب القمة والقاع واختار اتجاه الحركة","انتظر السعر يوصل المنطقة الذهبية (50%–61.8%) ودوّر شمعة تأكيد، مثل الابتلاعية أو البن بار","حط الوقف خلف 78.6%، والأهداف: القمة السابقة ثم الامتدادات"],
    t:"فيبوناتشي وحده ما يكفي. أقوى دخول لما تتلاقى المنطقة الذهبية ويا دعم أو مقاومة، أو خط ترند، أو أوردر بلوك."},
   time:{d:"التحليل الزمني يجاوب على سؤال: متى؟ مو بس وين. ياخذ مدة موجة سابقة ويضربها بنسب فيبوناتشي، أو يعد شموع بأرقام فيبوناتشي (13، 21، 34، 55…) من قمة أو قاع مهم. الأوقات اللي تطلع مرشحة لانعكاس أو تسارع بالحركة.",
    u:["تعرف الأوقات اللي ممكن تصير بيها قمة أو قاع جديد","تنتبه وتشدد إدارة صفقتك لما يقرب وقت مهم","لما يتلاقى وقت فيبوناتشي ويا مستوى سعري مهم، تصير الإشارة أقوى"],
    s:["حدد وقت بداية ونهاية آخر موجة مهمة (وقت القاع ووقت القمة)","اكتب الوقتين واختار الفريم اللي تشتغل عليه","شوف الأوقات المتوقعة، وراقب السعر قربها: إذا وصل مستوى مهم بنفس الوقت، دوّر إشارة انعكاس"],
    t:"الوقت يعطيك نافذة احتمال، مو أمر دخول. لا تدخل بس لأن الوقت وصل، استنى تأكيد من السعر. والأوقات تقريبية لأن السوق يسد بالعطلة."},
   chan:{d:"القناة خطين متوازيين يمشي السعر بيناتهم: خط ترند يربط قاعين (بالقناة الصاعدة) أو قمتين (بالهابطة)، وخط موازي إله يمر من القمة أو القاع المقابل. طول ما السعر داخل القناة، الخط الجوّاني دعم والفوكاني مقاومة.",
    u:["تعرف وين تشتري ووين تبيع داخل الترند","تحدد أهدافك: وسط القناة ثم طرفها الثاني","كسر القناة ينبهك إن الترند ممكن ينتهي أو يتسارع"],
    s:["اختار نوع القناة: صاعدة (على القيعان) أو هابطة (على القمم)","اكتب سعر النقطة 1 والنقطة 2، وكم شمعة بيناتهم","اكتب سعر النقطة المقابلة (القمة أو القاع اللي بالنص) وبعدها عن النقطة 1 بالشموع","اكتب بعد الشمعة الحالية عن النقطة 1، وتطلعلك أسعار القناة هسه وخطة الدخول"],
    t:"أقوى قناة اللي يلمسها السعر 3 مرات أو أكثر. وإذا كسرها بشمعة إغلاق قوية، لا تعاند وتدخل عكس الكسر."},
   piv:{d:"نقاط البيفوت مستويات تنحسب من قمة وقاع وإغلاق اليوم اللي فات. يستخدمها المتداولين والبنوك كمستويات يومية: النقطة المحورية P بالنص، وفوكها 3 مقاومات (R1–R3)، وجوّاها 3 دعوم (S1–S3).",
    u:["تعرف اتجاه اليوم بسرعة: فوك P إيجابي، جوّا P سلبي","تحدد أهداف ووقف منطقية لصفقات اليوم","مفيدة جداً للسكالبينغ والتداول اليومي"],
    s:["خذ قمة وقاع وإغلاق يوم أمس من الشارت اليومي","اكتبهم وتطلعلك المستويات","إذا السعر فوك P دوّر شراء من P أو S1 والهدف R1 ثم R2، وإذا جوّا P دوّر بيع من P أو R1 والهدف S1 ثم S2"],
    t:"R3 وS3 مستويات بعيدة يوصلها السعر بالأيام القوية أو وقت الأخبار. وانتبه للأخبار لأنها تكسر أي مستوى."},
   ew:{d:"نظرية إليوت تقول إن الترند يمشي بخمس موجات: 1 و3 و5 باتجاه الترند، و2 و4 تصحيح. الموجة 3 عادةً أطول وأقوى موجة، وغالباً تكون 161.8% من الموجة 1.",
    u:["تعرف إذا التصحيح الحالي موجة 2، وتدخل ويا بداية الموجة 3 (أقوى حركة)","تحسب أهداف الموجة 3 والموجة 5","القواعد تكشفلك إذا العد غلط قبل ما تخسر"],
    s:["حدد بداية الموجة 1 ونهايتها، ونهاية التصحيح (الموجة 2)","اكتب الأسعار الثلاثة","تأكد من القاعدة: الموجة 2 ما تكسر بداية الموجة 1","ادخل ويا كسر قمة الموجة 1، والوقف خلف نهاية الموجة 2، والأهداف أهداف الموجة 3"],
    t:"قواعد إليوت الثلاث: الموجة 2 ما تكسر بداية 1، الموجة 3 مو أقصر موجة، والموجة 4 ما تدخل منطقة الموجة 1. إذا انكسرت وحدة منها، العد غلط."},
   smc:{d:"مدرسة السمارت موني تقسم النطاق (من قاع لقمة) لنصين على مستوى 50% (التوازن): النص الفوكاني «بريميوم» يعني غالي، والجوّاني «ديسكاونت» يعني رخيص. المؤسسات تشتري بالرخيص وتبيع بالغالي، وأفضل منطقة دخول اسمها OTE، بين 62% و79%.",
    u:["ما تشتري وانت بالبريميوم، ولا تبيع وانت بالديسكاونت","تحدد منطقة دخول دقيقة (OTE) بوقف صغير","تعرف أهداف السيولة: فوك القمة أو جوّا القاع"],
    s:["حدد آخر نطاق كسر الهيكل (قاع وقمة الحركة اللي سوّت BOS)","اكتب القمة والقاع واختار الاتجاه","بالصاعد استنى السعر ينزل للديسكاونت ويوصل OTE، ودوّر أوردر بلوك أو FVG هناك","الوقف خلف القاع، والأهداف: سيولة القمة ثم الامتدادات"],
    t:"أقوى دخول لما يكون بمنطقة OTE أوردر بلوك أو فجوة FVG، وبعد سحب سيولة (كسر وهمي لقاع أو قمة)."},
   gann:{d:"مربع التسعة أداة من مدرسة جان (المدرسة الرقمية). يحوّل السعر لجذره التربيعي ويدور بيه على دائرة: كل لفة كاملة (360°) تضيف 2 للجذر. المستويات اللي على زوايا 90° و180° و360° تشتغل دعوم ومقاومات رقمية.",
    u:["تطلعلك دعوم ومقاومات حتى بمناطق ما بيها قمم وقيعان سابقة","مفيدة للذهب لأن أسعاره كبيرة وتتفاعل ويا الأرقام","تأكيد إضافي لما يتلاقى مستوى جان ويا فيبوناتشي أو دعم"],
    s:["اكتب سعر مهم: آخر قمة أو قاع، أو السعر الحالي","اختار الزاوية: 90° للمستويات القريبة، و180° أو 360° للبعيدة","اختار نوع الأداة (العملات تنحسب بدون الفاصلة)","راقب تفاعل السعر ويا المستويات، ولا تدخل بدون تأكيد"],
    t:"جان أداة مساعدة. استخدمها ويا التحليل الفني، مو بداله."},
   risk:{d:"إدارة المخاطر أهم شي بالتداول: تحدد كم تخسر إذا الصفقة فشلت قبل ما تدخل. حاسبة اللوت تطلعلك الحجم المناسب حسب رأس مالك، وحاسبة الربح للمخاطرة تكلك إذا الصفقة تستاهل.",
    u:["ما تخسر حسابك بصفقة وحدة","تعرف أقل نسبة نجاح تحتاجها حتى تبقى رابح","تتداول بثقة لأنك تعرف خسارتك من البداية"],
    s:["حدد نسبة المخاطرة بكل صفقة (1–2% من رأس المال للمبتدئين)","اكتب الدخول والوقف، وتطلعلك اللوت المناسب","تأكد إن الربح للمخاطرة 1:1.5 أو أكثر قبل ما تدخل"],
    t:"لا تبعّد الوقف إذا السعر قرّب عليه. الوقف موجود حتى يحميك."}};
  const info=k=>{const I=INFO[k];return`<details class="tinfo" open><summary>📘 شرح الأداة: شنو هي، شنو تفيدك، وشلون تستخدمها</summary><div class="ti-g">
    <div><b>شنو هي؟</b><p>${I.d}</p></div><div><b>شنو تفيدك؟</b><ul>${I.u.map(x=>`<li>${x}</li>`).join("")}</ul></div>
    <div><b>شلون تستخدمها؟</b><ol>${I.s.map(x=>`<li>${x}</li>`).join("")}</ol></div></div><div class="ti-tip">⚠️ ${I.t}</div></details>`};
  const th=(ic,n,s)=>`<div class="th"><span class="tic">${ic}</span><div><h3>${n}</h3><p class="muted" style="margin:0">${s}</p></div></div>`;
  const TABS=[["all","الكل"],["fib","فيبوناتشي"],["time","الزمني"],["chan","القنوات"],["piv","الدعوم والمقاومات"],["ew","موجات إليوت"],["smc","Smart Money"],["gann","الرقمي (جان)"],["risk","إدارة المخاطر"]];
  $("view").innerHTML=head+`<section class="blk" style="padding-top:6px"><div class="wrap"><a class="paywall" href="app.html#chart" style="display:flex;gap:14px;align-items:center;text-align:start;margin-bottom:16px;text-decoration:none;color:inherit;padding:18px 20px"><span style="font-size:34px">📐</span><span style="flex:1"><b style="font-size:17px;display:block">شارت التحليل الكامل + 🤖 مساعد الذكاء الصناعي</b><span class="muted" style="font-size:13.5px">ارسم بنفسك بكل الأدوات (فيبوناتشي، موجات إليوت، خطوط الاتجاه…)، واسأل المساعد يشرحلك الشارت.</span></span><span class="btn gold sm">افتح الشارت ←</span></a>
  <div class="tchips" id="tChips">${TABS.map(([k,n],i)=>`<button type="button" data-k="${k}"${i?"":' class="on"'}>${n}</button>`).join("")}</div><div class="tools tools1">
   <div class="panel tool" data-t="fib">${th("📐","فيبوناتشي (تصحيح وامتداد)","اكتب القمة والقاع واختار اتجاه الحركة، وتطلعلك المستويات مرسومة.")}
    <div class="fm"><div class="two"><label>القمة<input id="fH" class="ltr" type="number" step="any" value="4150"></label><label>القاع<input id="fL" class="ltr" type="number" step="any" value="4030"></label></div>
    <label>اتجاه الحركة<select id="fD"><option value="up">صاعدة (من القاع للقمة): نشتري التصحيح</option><option value="down">هابطة (من القمة للقاع): نبيع التصحيح</option></select></label></div>
    <div id="fOut"></div>${info("fib")}</div>
   <div class="panel tool" data-t="time">${th("⏳","فيبوناتشي الزمني","متى ممكن تصير القمة أو القاع الجاي؟ اكتب وقت بداية ونهاية آخر موجة.")}
    <div class="fm"><div class="two"><label>وقت بداية الموجة<input id="tA" class="ltr" type="datetime-local"></label><label>وقت نهاية الموجة<input id="tB" class="ltr" type="datetime-local"></label></div>
    <label>الفريم (لعدّ الشموع)<select id="tF"><option value="15">M15 (ربع ساعة)</option><option value="60" selected>H1 (ساعة)</option><option value="240">H4 (4 ساعات)</option><option value="1440">D1 (يومي)</option></select></label></div>
    <div id="tOut"></div>${info("time")}</div>
   <div class="panel tool" data-t="chan">${th("📈","القنوات السعرية","اكتب نقطتين على خط الترند ونقطة مقابلة، وتطلعلك حدود القناة هسه.")}
    <div class="fm"><label>نوع القناة<select id="cD"><option value="up">صاعدة: الخط على القيعان</option><option value="down">هابطة: الخط على القمم</option></select></label>
     <div class="two"><label>سعر النقطة 1<input id="cP1" class="ltr" type="number" step="any" value="4000"></label><label>سعر النقطة 2<input id="cP2" class="ltr" type="number" step="any" value="4060"></label></div>
     <div class="two"><label>عدد الشموع بين 1 و2<input id="cN" class="ltr" type="number" value="20"></label><label>سعر النقطة المقابلة<input id="cH" class="ltr" type="number" step="any" value="4110"></label></div>
     <div class="two"><label>بعد النقطة المقابلة عن 1 (شموع)<input id="cK" class="ltr" type="number" value="10"></label><label>بعد الشمعة الحالية عن 1 (شموع)<input id="cM" class="ltr" type="number" value="30"></label></div></div>
    <div id="cOut"></div>${info("chan")}</div>
   <div class="panel tool" data-t="piv">${th("🧱","الدعوم والمقاومات (Pivot Points)","اكتب قمة وقاع وإغلاق يوم أمس، وتطلعلك مستويات اليوم.")}
    <div class="fm"><div class="three"><label>قمة أمس<input id="pH" class="ltr" type="number" step="any" value="4120"></label><label>قاع أمس<input id="pL" class="ltr" type="number" step="any" value="4060"></label><label>إغلاق أمس<input id="pC" class="ltr" type="number" step="any" value="4105"></label></div></div>
    <div id="pOut"></div>${info("piv")}</div>
   <div class="panel tool" data-t="ew">${th("🌊","موجات إليوت: أهداف الموجة 3 و5","اكتب بداية الموجة 1 ونهايتها ونهاية الموجة 2.")}
    <div class="fm"><div class="three"><label>بداية الموجة 1<input id="eA" class="ltr" type="number" step="any" value="4000"></label><label>نهاية الموجة 1<input id="eB" class="ltr" type="number" step="any" value="4060"></label><label>نهاية الموجة 2<input id="eC" class="ltr" type="number" step="any" value="4025"></label></div></div>
    <div id="eOut"></div>${info("ew")}</div>
   <div class="panel tool" data-t="smc">${th("🏦","Smart Money: بريميوم وديسكاونت + OTE","اكتب قمة وقاع النطاق، وتطلعلك مناطق الغالي والرخيص ومنطقة الدخول المثالية.")}
    <div class="fm"><div class="two"><label>قمة النطاق<input id="sH" class="ltr" type="number" step="any" value="4150"></label><label>قاع النطاق<input id="sL" class="ltr" type="number" step="any" value="4030"></label></div>
    <label>الاتجاه<select id="sD"><option value="up">صاعد: ندور شراء بالديسكاونت</option><option value="down">هابط: ندور بيع بالبريميوم</option></select></label></div>
    <div id="sOut"></div>${info("smc")}</div>
   <div class="panel tool" data-t="gann">${th("🔢","الرقمي: مربع التسعة (جان)","اكتب سعر مهم واختار الزاوية، وتطلعلك الدعوم والمقاومات الرقمية.")}
    <div class="fm"><div class="three"><label>السعر<input id="gP" class="ltr" type="number" step="any" value="4100"></label><label>الزاوية<select id="gD"><option value="45">45°</option><option value="90" selected>90°</option><option value="180">180°</option><option value="360">360°</option></select></label>
     <label>نوع الأداة<select id="gK"><option value="1">الذهب والمؤشرات</option><option value="10000">العملات (EURUSD…)</option><option value="100">أزواج الين</option></select></label></div></div>
    <div id="gOut"></div>${info("gann")}</div>
   <div class="panel tool" data-t="risk">${th("🛡","إدارة المخاطر","حاسبة حجم اللوت وحاسبة الربح للمخاطرة.")}
    <div class="tools" style="margin-top:12px"><div class="subt"><h4>💰 حاسبة حجم اللوت</h4><p class="muted" style="margin:0">حتى ما تخسر أكثر من النسبة اللي تحددها.</p>
    <div class="fm"><label>الزوج<select id="lS"><option value="gold">الذهب XAUUSD</option><option value="fx">أزواج الدولار (EURUSD، GBPUSD…)</option><option value="jpy">أزواج الين (USDJPY…)</option><option value="btc">البيتكوين BTCUSD</option></select></label>
     <div class="two"><label>رأس المال $<input id="lB" class="ltr" type="number" value="1000"></label><label>المخاطرة %<input id="lR" class="ltr" type="number" step="0.1" value="1"></label></div>
     <div class="two"><label>سعر الدخول<input id="lE" class="ltr" type="number" step="any" value="4100"></label><label>سعر الوقف<input id="lSL" class="ltr" type="number" step="any" value="4090"></label></div></div>
    <div class="res" id="lOut"></div></div>
   <div class="subt"><h4>🎯 الربح للمخاطرة R:R</h4><p class="muted" style="margin:0">اعرف إذا الصفقة تستاهل قبل ما تدخل.</p>
    <div class="fm"><div class="two"><label>الدخول<input id="rE" class="ltr" type="number" step="any" value="4100"></label><label>الوقف<input id="rS" class="ltr" type="number" step="any" value="4090"></label></div>
     <div class="two"><label>الهدف 1<input id="r1" class="ltr" type="number" step="any" value="4115"></label><label>الهدف 2<input id="r2" class="ltr" type="number" step="any" value="4130"></label></div></div>
    <div class="res" id="rOut"></div></div></div>${info("risk")}</div>
  </div></div></section>`;
  const v=id=>parseFloat($(id).value);
  const dp=x=>Math.abs(x)>=100?2:Math.abs(x)>=10?3:5;
  const NAR=innerWidth<640,VW=NAR?440:700,XR=NAR?280:540,FS=NAR?17:12.5;
  const row=(t,b,st)=>`<div${st?` style="${st}"`:""}><span>${t}</span>${b===undefined?"":`<b>${b}</b>`}</div>`;
  const err=(id,m)=>{$(id).innerHTML=`<p class="msg err">${m}</p>`};
  /* رسم مستويات أفقية + مسار السعر */
  function lvSVG(L,o={}){
    const ps=[...L.map(x=>x.p),...(o.path||[]).map(x=>x[1])],mn=Math.min(...ps),mx=Math.max(...ps),pad=(mx-mn)*.05||1;
    const Y=p=>20+(mx+pad-p)/(mx-mn+2*pad)*300,X0=30,X1=XR;let g="";
    (o.bands||[]).forEach(([a,b,c,op])=>{g+=`<rect x="${X0}" y="${Y(Math.max(a,b))}" width="${X1-X0}" height="${Math.max(1,Math.abs(Y(a)-Y(b)))}" fill="${c}" fill-opacity="${op||.16}"/>`});
    const S=L.map(x=>({...x,y:Y(x.p)})).sort((a,b)=>a.y-b.y);let last=-99;S.forEach(x=>{x.ly=Math.max(x.y+5,last+(NAR?20:15));last=x.ly});
    S.forEach(x=>{g+=`<line x1="${X0}" x2="${X1}" y1="${x.y}" y2="${x.y}" stroke="${x.c}" stroke-width="${x.w||1.4}"${x.d?' stroke-dasharray="6 4"':""}/><text x="${X1+8}" y="${x.ly}" fill="${x.c}" font-size="${FS}" font-weight="700" direction="ltr">${x.t}</text>`});
    if(o.path){const P=o.path.map(([f,p])=>[X0+f*(X1-X0),Y(p)]);g+=`<polyline points="${P.map(q=>q.join(",")).join(" ")}" fill="none" stroke="#e9e9ee" stroke-width="2" stroke-dasharray="5 4"/>`;
      o.path.forEach(([f,p,l],i)=>{if(l===undefined)return;const[x,y]=P[i],nb=[P[i-1],P[i+1]].filter(Boolean),top=nb.every(q=>y<=q[1]);g+=`<circle cx="${x}" cy="${y}" r="4" fill="#d4af37"/><text x="${x}" y="${y+(top?-10:20)}" fill="#f5d76e" font-size="${FS+.5}" font-weight="700" text-anchor="middle">${l}</text>`})}
    (o.labels||[]).forEach(([f,p,t,c])=>{g+=`<text x="${X0+f*(X1-X0)}" y="${Y(p)+4}" fill="${c||"#d4af37"}" font-size="${FS}" font-weight="700" direction="rtl" text-anchor="middle">${t}</text>`});
    const H=Math.max(340,last+14);
    return`<svg class="fibsvg" viewBox="0 0 ${VW} ${H}" font-family="IBM Plex Sans Arabic,Tahoma,sans-serif">${g}</svg>`}
  /* 1) فيبوناتشي */
  function fibCalc(){const H=v("fH"),L=v("fL"),up=$("fD").value==="up";if(!(H>L))return err("fOut","القمة لازم أكبر من القاع");
    const R=H-L,d=dp(H),ret=[0,.236,.382,.5,.618,.786,1],ext=[1.272,1.618,2.618];
    const rp=r=>up?H-R*r:L+R*r, ep=r=>up?L+R*r:H-R*r;
    const COL={0:"#9aa0a6",.236:"#f0606f",.382:"#f59e0b",.5:"#34c98e",.618:"#14b8a6",.786:"#3b82f6",1:"#9aa0a6",1.272:"#a855f7",1.618:"#d4af37",2.618:"#ec4899"};
    const lv=[...ret.map(r=>({p:rp(r),c:COL[r],t:`${(r*100).toFixed(1).replace(/\.0$/,"")}%  ${rp(r).toFixed(d)}`})),...ext.map(r=>({p:ep(r),c:COL[r],d:1,t:`${(r*100).toFixed(1).replace(/\.0$/,"")}%  ${ep(r).toFixed(d)}`}))];
    $("fOut").innerHTML=lvSVG(lv,{bands:[[rp(.5),rp(.618),"#d4af37",.18]],path:[[.04,up?L:H],[.38,up?H:L],[.6,rp(.618)],[.96,ep(1.618)]],labels:[[.6,rp(.618)+(up?-1:1)*R*.09,"المنطقة الذهبية"]]})
     +`<div class="res">${row(up?"🟡 المنطقة الذهبية (50%–61.8%): منطقة شراء":"🟡 المنطقة الذهبية (50%–61.8%): منطقة بيع",`${rp(.618).toFixed(d)} – ${rp(.5).toFixed(d)}`)}
     ${row("الوقف المقترح (خلف 78.6%)",rp(.836).toFixed(d))}${row(up?"🎯 الهدف 1: القمة السابقة":"🎯 الهدف 1: القاع السابق",(up?H:L).toFixed(d))}
     ${row("🎯 الهدف 2: امتداد 161.8%",ep(1.618).toFixed(d))}${row("🎯 الهدف 3: امتداد 261.8%",ep(2.618).toFixed(d))}</div>`}
  /* 2) الزمني */
  const z2=n=>String(n).padStart(2,"0"),dtl=d=>`${d.getFullYear()}-${z2(d.getMonth()+1)}-${z2(d.getDate())}T${z2(d.getHours())}:${z2(d.getMinutes())}`;
  const fdt=d=>d.toLocaleString(window.LANG||"ar",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",numberingSystem:"latn"});
  const wk=d=>d.getDay()===0||d.getDay()===6;
  function addT(d,min){let t=new Date(d),left=min,i=0;while(left>0&&i++<5000){if(wk(t)){t.setDate(t.getDate()+(t.getDay()===6?2:1));t.setHours(0,0,0,0);continue}
      const e=new Date(t);e.setHours(24,0,0,0);const can=(e-t)/6e4;if(left<=can){t=new Date(t.getTime()+left*6e4);left=0}else{left-=can;t=e}}
    while(wk(t)){t.setDate(t.getDate()+(t.getDay()===6?2:1));t.setHours(0,0,0,0)}return t}
  function tMin(a,b){let m=0,t=new Date(a),i=0;while(t<b&&i++<2000){const e=new Date(t);e.setHours(24,0,0,0);const f=e<b?e:b;if(!wk(t))m+=(f-t)/6e4;t=e}return m}
  {let B=new Date();B.setMinutes(0,0,0);B.setHours(B.getHours()-2);while(wk(B)){B.setDate(B.getDate()-1);B.setHours(16)}let A=new Date(B.getTime()-2*864e5);while(wk(A))A.setDate(A.getDate()-1);$("tA").value=dtl(A);$("tB").value=dtl(B)}
  function timeCalc(){const A=new Date($("tA").value),B=new Date($("tB").value),tf=+$("tF").value;
    if(isNaN(A)||isNaN(B)||!(B>A))return err("tOut","وقت النهاية لازم بعد وقت البداية");
    const D=tMin(A,B);if(D<1)return err("tOut","المدة قصيرة جداً");
    const R=[[.382,"#f59e0b"],[.618,"#14b8a6"],[1,"#9aa0a6"],[1.618,"#d4af37"],[2.618,"#ec4899"]].map(([r,c])=>({r,c,t:addT(B,D*r)}));
    const N=[8,13,21,34,55,89].map(n=>({n,t:addT(B,n*tf)}));
    const t0=A.getTime(),t1=R[R.length-1].t.getTime(),X=t=>30+(t-t0)/(t1-t0)*(VW-80);
    let g=`<line x1="20" x2="${VW-20}" y1="200" y2="200" stroke="#33333a"/><polyline points="${X(t0)},180 ${X(B.getTime())},50" fill="none" stroke="#e9e9ee" stroke-width="2.4"/>
      <circle cx="${X(t0)}" cy="180" r="5" fill="#34c98e"/><circle cx="${X(B.getTime())}" cy="50" r="5" fill="#f0606f"/>
      <text x="${X(t0)}" y="222" fill="#aaa" font-size="${FS}" text-anchor="middle">A</text><text x="${X(B.getTime())}" y="222" fill="#aaa" font-size="${FS}" text-anchor="middle">B</text>`;
    let lx=-99,ly=22;R.forEach(({r,c,t})=>{const x=X(t.getTime());ly=x-lx<(NAR?62:44)&&ly===22?42:22;lx=x;g+=`<line x1="${x}" x2="${x}" y1="${ly+8}" y2="200" stroke="${c}" stroke-width="1.6" stroke-dasharray="5 4"/><text x="${x}" y="${ly}" fill="${c}" font-size="${FS}" font-weight="700" text-anchor="middle" direction="ltr">${r}</text>`});
    $("tOut").innerHTML=`<svg class="fibsvg" viewBox="0 0 ${VW} 235" font-family="IBM Plex Sans Arabic,Tahoma,sans-serif" direction="ltr">${g}</svg>
     <div class="res">${row("مدة الموجة (بدون العطلة)",`${Math.floor(D/60)}h ${z2(Math.round(D%60))}m`)}</div>
     <h4 class="th4">⏳ نسب زمنية من نهاية الموجة (B)</h4><div class="res">${R.map(x=>row(`<b style="color:${x.c};font-family:var(--f-num)">${x.r}</b>`,fdt(x.t))).join("")}</div>
     <h4 class="th4">🕯 عدّ شموع فيبوناتشي من الشمعة المحورية (B)</h4><div class="res">${N.map(x=>row(`<b style="font-family:var(--f-num)">${x.n}</b>`,fdt(x.t))).join("")}</div>
     <p class="muted" style="font-size:12.5px;margin:8px 0 0">الأوقات بتوقيت جهازك، وتتجاوز السبت والأحد تقريبياً.</p>`}
  /* 3) القنوات */
  function chanCalc(){const P1=v("cP1"),P2=v("cP2"),N=v("cN"),Hh=v("cH"),K=v("cK"),M=v("cM"),up=$("cD").value==="up";
    if(!(N>0)||[P1,P2,Hh,K,M].some(isNaN))return err("cOut","اكتب أرقام صحيحة، وعدد الشموع لازم أكبر من صفر");
    const s=(P2-P1)/N,base=m=>P1+s*m,w=Hh-base(K),W=Math.abs(w),d=dp(P1);
    if(!W)return err("cOut","النقطة المقابلة لازم تكون بعيدة عن خط الترند");
    const lo=m=>Math.min(base(m),base(m)+w),hi=m=>Math.max(base(m),base(m)+w),Lw=lo(M),Up=hi(M),Md=(Lw+Up)/2;
    const bad=up?!(s>0&&w>0):!(s<0&&w<0);
    const end=Math.max(M,N,K)+4,xs=m=>30+m/end*(XR-30),ps=[lo(0),hi(0),lo(end),hi(end),P1,P2,Hh],mn=Math.min(...ps),mx=Math.max(...ps),pad=(mx-mn)*.06;
    const Y=p=>20+(mx+pad-p)/(mx-mn+2*pad)*300;
    const ln=(f,c,da)=>`<line x1="${xs(0)}" y1="${Y(f(0))}" x2="${xs(end)}" y2="${Y(f(end))}" stroke="${c}" stroke-width="2"${da?' stroke-dasharray="6 4"':""}/>`;
    let g=`<polygon points="${xs(0)},${Y(lo(0))} ${xs(end)},${Y(lo(end))} ${xs(end)},${Y(hi(end))} ${xs(0)},${Y(hi(0))}" fill="#d4af37" fill-opacity=".07"/>`
      +ln(lo,"#34c98e")+ln(hi,"#f0606f")+ln(m=>(lo(m)+hi(m))/2,"#9aa0a6",1)
      +`<polyline points="${xs(0)},${Y(P1)} ${xs(K)},${Y(Hh)} ${xs(N)},${Y(P2)}" fill="none" stroke="#e9e9ee" stroke-width="2" stroke-dasharray="5 4"/>`
      +[[0,P1,"1"],[N,P2,"2"],[K,Hh,"3"]].map(([m,p,l])=>`<circle cx="${xs(m)}" cy="${Y(p)}" r="4.5" fill="#d4af37"/><text x="${xs(m)}" y="${Y(p)+((p===Hh)===up?-10:20)}" fill="#f5d76e" font-size="${FS+.5}" font-weight="700" text-anchor="middle">${l}</text>`).join("")
      +`<line x1="${xs(M)}" x2="${xs(M)}" y1="14" y2="330" stroke="#3b82f6" stroke-width="1.4" stroke-dasharray="4 4"/><text x="${xs(M)}" y="12" fill="#3b82f6" font-size="${FS}" font-weight="700" text-anchor="middle">هسه</text>`
      +[[Up,"#f0606f"],[Md,"#9aa0a6"],[Lw,"#34c98e"]].map(([p,c])=>`<text x="${XR+12}" y="${Y(p)+5}" fill="${c}" font-size="${FS}" font-weight="700" direction="ltr">${p.toFixed(d)}</text>`).join("");
    const plan=up?row("🟢 منطقة الشراء (قرب دعم القناة)",`${Lw.toFixed(d)} – ${(Lw+W*.15).toFixed(d)}`)+row("الوقف (تحت القناة)",(Lw-W*.15).toFixed(d))+row("🎯 الهدف 1: وسط القناة",Md.toFixed(d))+row("🎯 الهدف 2: أعلى القناة",Up.toFixed(d))
      :row("🔴 منطقة البيع (قرب مقاومة القناة)",`${(Up-W*.15).toFixed(d)} – ${Up.toFixed(d)}`)+row("الوقف (فوك القناة)",(Up+W*.15).toFixed(d))+row("🎯 الهدف 1: وسط القناة",Md.toFixed(d))+row("🎯 الهدف 2: أسفل القناة",Lw.toFixed(d));
    $("cOut").innerHTML=`<svg class="fibsvg" viewBox="0 0 ${VW} 340" font-family="IBM Plex Sans Arabic,Tahoma,sans-serif">${g}</svg>
     ${bad?`<p class="msg err">${up?"بالقناة الصاعدة: النقطة 2 لازم أعلى من النقطة 1، والنقطة المقابلة فوك خط الترند.":"بالقناة الهابطة: النقطة 2 لازم أوطى من النقطة 1، والنقطة المقابلة جوّا خط الترند."}</p>`:""}
     <div class="res">${row("أعلى القناة هسه (مقاومة)",Up.toFixed(d))}${row("وسط القناة",Md.toFixed(d))}${row("أسفل القناة هسه (دعم)",Lw.toFixed(d))}${row("عرض القناة",W.toFixed(d))}${row("ميل القناة لكل شمعة",(s>=0?"+":"")+s.toFixed(d))}</div>
     <h4 class="th4">📋 خطة التداول داخل القناة</h4><div class="res">${plan}${row("⚡ إذا السعر كسر القناة بإغلاق شمعة، الخطة تتلغى")}</div>`}
  /* 4) البيفوت */
  function pivCalc(){const H=v("pH"),L=v("pL"),C=v("pC");if(!(H>L)||!(C<=H&&C>=L))return err("pOut","القمة لازم أكبر من القاع، والإغلاق بيناتهم");
    const P=(H+L+C)/3,R=H-L,d=dp(H),Lv={R3:H+2*(P-L),R2:P+R,R1:2*P-L,P,S1:2*P-H,S2:P-R,S3:L-2*(H-P)};
    const C2={R3:"#be123c",R2:"#e11d48",R1:"#f0606f",P:"#d4af37",S1:"#34c98e",S2:"#16a34a",S3:"#15803d"};
    $("pOut").innerHTML=lvSVG(Object.entries(Lv).map(([k,p])=>({p,c:C2[k],w:k==="P"?2.4:1.4,d:k==="R3"||k==="S3",t:`${k}  ${p.toFixed(d)}`})))
     +`<div class="res">${row("🔴 R3 مقاومة بعيدة",Lv.R3.toFixed(d))}${row("🔴 R2 مقاومة ثانية",Lv.R2.toFixed(d))}${row("🔴 R1 مقاومة أولى",Lv.R1.toFixed(d))}
      ${row("🟡 P النقطة المحورية",Lv.P.toFixed(d),"border-color:var(--accent)")}${row("🟢 S1 دعم أول",Lv.S1.toFixed(d))}${row("🟢 S2 دعم ثاني",Lv.S2.toFixed(d))}${row("🟢 S3 دعم بعيد",Lv.S3.toFixed(d))}</div>
      <h4 class="th4">📋 شلون تقرا اليوم</h4><div class="res">${row("السعر فوك P: الأفضلية للشراء، والأهداف R1 ثم R2")}${row("السعر جوّا P: الأفضلية للبيع، والأهداف S1 ثم S2")}</div>`}
  /* 5) إليوت */
  function ewCalc(){const A=v("eA"),B=v("eB"),C=v("eC");if([A,B,C].some(isNaN)||A===B)return err("eOut","اكتب أرقام صحيحة");
    const up=B>A,g=up?1:-1,W1=Math.abs(B-A),d=dp(B),ret=(B-C)*g/W1*100;
    const ok2=up?C>A:C<A,ok2b=up?C<B:C>B;
    const w3=r=>C+g*W1*r,W3=W1*1.618,e3=w3(1.618),w4a=e3-g*W3*.236,w4b=e3-g*W3*.382,ok4=up?w4b>B:w4b<B,w5a=w4b+g*W1,w5b=w4b+g*.618*Math.abs(e3-A);
    if(!ok2b)return err("eOut",up?"نهاية الموجة 2 لازم أوطى من نهاية الموجة 1":"نهاية الموجة 2 لازم أعلى من نهاية الموجة 1");
    $("eOut").innerHTML=lvSVG([{p:w3(1),c:"#9aa0a6",d:1,t:`100%  ${w3(1).toFixed(d)}`},{p:e3,c:"#d4af37",t:`161.8%  ${e3.toFixed(d)}`},{p:w3(2.618),c:"#ec4899",d:1,t:`261.8%  ${w3(2.618).toFixed(d)}`},{p:B,c:"#f59e0b",d:1,t:`W1  ${B.toFixed(d)}`},{p:A,c:"#6b7280",d:1,t:`0  ${A.toFixed(d)}`}],
      {bands:[[w4a,w4b,"#3b82f6",.14]],path:[[.03,A,"0"],[.2,B,"1"],[.32,C,"2"],[.6,e3,"3"],[.72,w4b,"4"],[.95,w5a,"5"]]})
     +`${ok2?"":`<p class="msg err">⚠️ الموجة 2 كسرت بداية الموجة 1، فهذا مو عد إليوت صحيح.</p>`}
     <div class="res">${row("تصحيح الموجة 2",ret.toFixed(1)+"%")}${row(ok2?"✅ قاعدة الموجة 2 متحققة":"❌ قاعدة الموجة 2 مكسورة")}</div>
     <h4 class="th4">🎯 أهداف الموجة 3</h4><div class="res">${row("100% من الموجة 1",w3(1).toFixed(d))}${row("161.8% (الأشهر)",e3.toFixed(d),"border-color:var(--accent)")}${row("261.8% (الممتدة)",w3(2.618).toFixed(d))}</div>
     <h4 class="th4">🌊 الموجة 4 والموجة 5 (تقديرية)</h4><div class="res">${row("منطقة الموجة 4 المتوقعة (23.6%–38.2%)",`${w4a.toFixed(d)} – ${w4b.toFixed(d)}`)}${ok4?"":row("⚠️ الموجة 4 لازم ما تدخل منطقة الموجة 1")}
      ${row("الموجة 5: مساوية للموجة 1",w5a.toFixed(d))}${row("الموجة 5: 61.8% من (0 إلى 3)",w5b.toFixed(d))}</div>
     <h4 class="th4">📋 خطة الدخول</h4><div class="res">${row(up?"الدخول: شراء ويا كسر قمة الموجة 1":"الدخول: بيع ويا كسر قاع الموجة 1",B.toFixed(d))}${row("الوقف: خلف نهاية الموجة 2",C.toFixed(d))}</div>`}
  /* 6) سمارت موني */
  function smcCalc(){const H=v("sH"),L=v("sL"),up=$("sD").value==="up";if(!(H>L))return err("sOut","القمة لازم أكبر من القاع");
    const R=H-L,d=dp(H),eq=L+R/2,o=r=>up?H-R*r:L+R*r,x=r=>up?H+R*r:L-R*r;
    $("sOut").innerHTML=lvSVG([{p:H,c:"#f0606f",t:`100%  ${H.toFixed(d)}`},{p:eq,c:"#e9e9ee",w:2,t:`50%  ${eq.toFixed(d)}`},{p:o(.62),c:"#d4af37",t:`62%  ${o(.62).toFixed(d)}`},{p:o(.705),c:"#f5d76e",d:1,t:`70.5%  ${o(.705).toFixed(d)}`},{p:o(.79),c:"#d4af37",t:`79%  ${o(.79).toFixed(d)}`},{p:L,c:"#34c98e",t:`0%  ${L.toFixed(d)}`},{p:x(.27),c:"#a855f7",d:1,t:`-27%  ${x(.27).toFixed(d)}`},{p:x(.62),c:"#ec4899",d:1,t:`-62%  ${x(.62).toFixed(d)}`}],
      {bands:[[H,eq,"#f0606f",.08],[eq,L,"#34c98e",.08],[o(.62),o(.79),"#d4af37",.22]],path:[[.04,up?L:H],[.36,up?H:L],[.6,o(.705)],[.96,x(.27)]],labels:[[NAR?.27:.15,up?(H+eq)/2:(H+o(.79))/2,"بريميوم (غالي)","#f0606f"],[NAR?.27:.15,up?(L+o(.79))/2:(L+eq)/2,"ديسكاونت (رخيص)","#34c98e"]]})
     +`<div class="res">${row("⚖️ التوازن (50%)",eq.toFixed(d))}${row("🔴 بريميوم: فوك التوازن",`${eq.toFixed(d)} – ${H.toFixed(d)}`)}${row("🟢 ديسكاونت: جوّا التوازن",`${L.toFixed(d)} – ${eq.toFixed(d)}`)}</div>
     <h4 class="th4">📋 خطة الدخول</h4><div class="res">${row(up?"🟡 منطقة OTE للشراء (62%–79%)":"🟡 منطقة OTE للبيع (62%–79%)",`${o(.79).toFixed(d)} – ${o(.62).toFixed(d)}`,"border-color:var(--accent)")}${row("أفضل نقطة (70.5%)",o(.705).toFixed(d))}
      ${row(up?"الوقف: تحت قاع النطاق":"الوقف: فوك قمة النطاق",(up?L-R*.03:H+R*.03).toFixed(d))}${row(up?"🎯 الهدف 1: سيولة القمة":"🎯 الهدف 1: سيولة القاع",(up?H:L).toFixed(d))}${row("🎯 الهدف 2: امتداد -27%",x(.27).toFixed(d))}${row("🎯 الهدف 3: امتداد -62%",x(.62).toFixed(d))}</div>`}
  /* 7) جان */
  function gannCalc(){const p=v("gP"),deg=+$("gD").value,sc=+$("gK").value;if(!(p>0))return err("gOut","اكتب سعر صحيح");
    const r=Math.sqrt(p*sc),inc=deg/180,d=sc===10000?5:sc===100?3:2,lv=[];
    for(let k=4;k>=1;k--)lv.push({k,p:(r+k*inc)**2/sc});for(let k=1;k<=4&&r-k*inc>0;k++)lv.push({k:-k,p:(r-k*inc)**2/sc});
    const col=k=>k>0?["#f0606f","#e11d48","#be123c","#9f1239"][k-1]:["#34c98e","#16a34a","#15803d","#166534"][-k-1];
    $("gOut").innerHTML=lvSVG([...lv.map(x=>({p:x.p,c:col(x.k),d:Math.abs(x.k)>2,t:`${x.k>0?"+":"−"}${Math.abs(x.k)*deg}°  ${x.p.toFixed(d)}`})),{p,c:"#d4af37",w:2.4,t:`0°  ${p.toFixed(d)}`}])
     +`<div class="res">${row("√ جذر السعر",r.toFixed(4))}${lv.filter(x=>x.k>0).map(x=>row(`🔴 مقاومة +${x.k*deg}°`,x.p.toFixed(d))).join("")}${row("🟡 السعر",p.toFixed(d),"border-color:var(--accent)")}${lv.filter(x=>x.k<0).map(x=>row(`🟢 دعم −${-x.k*deg}°`,x.p.toFixed(d))).join("")}</div>`}
  /* 8) إدارة المخاطر */
  function lotCalc(){const B=v("lB"),R=v("lR"),E=v("lE"),SL=v("lSL"),t=$("lS").value,dist=Math.abs(E-SL);const risk=B*R/100;
    if(!(dist>0&&B>0&&R>0)){$("lOut").innerHTML='<div><span>اكتب أرقام صحيحة</span></div>';return}
    let perLot,unit;
    if(t==="gold"){perLot=dist*100;unit=`${dist.toFixed(2)}$ (${Math.round(dist*10)} نقطة)`}
    else if(t==="fx"){perLot=dist*100000;unit=`${Math.round(dist*10000)} نقطة`}
    else if(t==="jpy"){perLot=dist*100000/E;unit=`${Math.round(dist*100)} نقطة`}
    else{perLot=dist;unit=`${dist.toFixed(0)}$`}
    const lot=Math.floor(risk/perLot*100)/100;
    $("lOut").innerHTML=`<div><span>المبلغ اللي تخاطر بيه</span><b>${risk.toFixed(2)}$</b></div><div><span>مسافة الوقف</span><b>${unit}</b></div>
     <div style="border-color:var(--accent)"><span>حجم اللوت المناسب</span><b style="font-size:18px">${lot>0?lot.toFixed(2):"أقل من 0.01"}</b></div>
     ${lot<0.01?'<div><span class="down">رأس المال صغير على هذا الوقف. قرّب الوقف أو زِد المخاطرة شوية.</span></div>':`<div><span>الخسارة الفعلية إذا ضرب الوقف</span><b>${(lot*perLot).toFixed(2)}$</b></div>`}`}
  function rrCalc(){const E=v("rE"),SL=v("rS"),t1=v("r1"),t2=v("r2"),risk=Math.abs(E-SL);if(!(risk>0)){$("rOut").innerHTML="";return}
    const r1=Math.abs(t1-E)/risk,r2=Math.abs(t2-E)/risk,ok=r2>=1.5;
    const need=r=>Math.round(100/(1+r));
    $("rOut").innerHTML=`<div><span>الهدف 1</span><b>1:${r1.toFixed(2)}</b></div><div><span>الهدف 2</span><b>1:${r2.toFixed(2)}</b></div>
     <div><span>أقل نسبة نجاح تحتاجها حتى تربح (على الهدف 2)</span><b>${need(r2)}%</b></div>
     <div style="border-color:${ok?"var(--buy)":"var(--sell)"}"><span>${ok?"✅ الصفقة تستاهل":"⚠️ الربح قليل مقابل المخاطرة، دوّر دخول أفضل"}</span></div>`}
  const BIND=[[["fH","fL","fD"],fibCalc],[["tA","tB","tF"],timeCalc],[["cD","cP1","cP2","cN","cH","cK","cM"],chanCalc],[["pH","pL","pC"],pivCalc],[["eA","eB","eC"],ewCalc],[["sH","sL","sD"],smcCalc],[["gP","gD","gK"],gannCalc],[["lS","lB","lR","lE","lSL"],lotCalc],[["rE","rS","r1","r2"],rrCalc]];
  BIND.forEach(([ids,f])=>{ids.forEach(i=>{$(i).addEventListener("input",f);$(i).addEventListener("change",f)});f()});
  $("tChips").addEventListener("click",e=>{const b=e.target.closest("button[data-k]");if(!b)return;const k=b.dataset.k;
    $("tChips").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));
    document.querySelectorAll(".tools1>.tool").forEach(p=>{p.hidden=k!=="all"&&p.dataset.t!==k});
    if(k!=="all")$("tChips").scrollIntoView({behavior:"smooth",block:"start"})});
}
function joinPage(){
  setNav("join");
  const logged=!!S.user;
  $("view").innerHTML=pageHead("شلون تنضم","فيكسورا حصرية لعملاء وكالتنا على INFINOX: التوصيات اليومية والأكاديمية كاملة.")
    +`<section class="blk" style="padding-top:6px"><div class="wrap">${logged&&isMember()?`<div class="paywall"><div class="lockic">✅</div><h2>حسابك مفعّل</h2><p>كل شي مفتوح إلك: التوصيات والدروس المجانية ودروس الزوم.</p><div class="cta"><a class="btn gold" href="app.html">منصة التوصيات</a><a class="btn" href="#courses">الدورات</a></div></div>`
      :logged?brokerGate()
      :`<div class="tiles">
        <div class="tile"><span class="ti">1️⃣</span><b>افتح حساب INFINOX</b><span>من رابط وكالتنا حصراً، حتى نگدر نفعّلك.</span><span style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn gold sm" href="${CONFIG.IB}" target="_blank" rel="noopener">افتح الحساب</a>${VXI.btn("broker","▶️ شلون أفتحه","sm")}</span></div>
        <div class="tile"><span class="ti">2️⃣</span><b>سجّل بالموقع</b><span>سوّ حساب واكتب رقم حسابك بـ INFINOX ويوزر تيليجرام.</span><span style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="${CONFIG.SITE}#signup">سجّل الآن</a>${VXI.btn("join","▶️ شلون أسجّل","sm ghost")}</span></div>
        <div class="tile"><span class="ti">3️⃣</span><b>نفعّلك</b><span>نتأكد من حسابك وتنفتح لك التوصيات والأكاديمية وقناة الصفقات.</span></div>
      </div><div style="margin-top:14px">${offerHTML()}</div>`}</div></section>`;
}
function coachPage(){
  setNav("coach");
  $("view").innerHTML=`<section class="hero"><div class="wrap">
    <div>
      <span class="kicker">👑 تعرّف على الكوتشات</span>
      <h1>كوتشات <em>فيكسورا</em></h1>
      <p class="lead">مدرّبين معروفين بالاسم، بشهادات دولية من فرنسا وألمانيا والسويد وبريطانيا. تتعلم وياهم بالدورات، ودروس الزوم، والجلسات الخاصة.</p>
      <div class="cta"><button class="btn gold" type="button" data-buy="zoom">احجز جلسة خاصة · ${money(S.info.price_zoom)}</button><a class="btn" href="#courses">الدورات</a></div>
    </div>
    <div class="vx-coaches">${coachCards()}</div>
  </div></section>${vxCertsHTML()}${vxCompany()}${vxSupportHTML()}`;
}

/* ================= sessions ================= */
function sessionsHTML(){
  const up=S.sessions.filter(s=>new Date(s.starts_at).getTime()+s.minutes*60e3>Date.now());
  if(!up.length)return`<div class="empty">ما في دروس مباشرة مجدولة حالياً. تابع قناتي <a href="https://t.me/${esc(chUser())}" target="_blank" rel="noopener">@${esc(chUser())}</a> حتى توصلك المواعيد أول بأول.</div>`;
  return `<div class="sess">${up.map(s=>{
    const d=new Date(s.starts_at),c=s.course_id&&course(s.course_id),on=S.rsvp.has(s.id);
    const can=isMember()&&(s.audience==="all"||hasMonthly()||(s.course_id&&ownsCourse(s.course_id)));
    const soon=d.getTime()-Date.now()<45*60e3;
    const g=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(s.title)}&dates=${gdate(d)}/${gdate(new Date(d.getTime()+s.minutes*60e3))}&details=${encodeURIComponent((s.description||"")+"\n"+location.href.split("#")[0])}`;
    return `<div class="srow">
      <div class="date"><b>${d.getDate()}</b><span>${d.toLocaleDateString(window.LANG||"ar",{month:"short"})}</span></div>
      <div><h3>${esc(s.title)}</h3><div class="muted" style="font-size:13.5px">${fmtDate(d)} · ${s.minutes} دقيقة ${c?`· ${esc(c.title)}`:""}</div>
        ${s.description?`<div style="font-size:14px;color:#cfcfd6">${esc(s.description)}</div>`:""}
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px">${s.audience==="paid"?'<span class="chip gold">للمشتركين</span>':'<span class="chip up">مفتوح لكل الأعضاء</span>'}<span class="cd" data-cd="${d.getTime()}"></span><span data-seat="${s.id}"></span></div></div>
      <div class="acts">
        ${!S.user?`<a class="btn gold sm" href="${CONFIG.SITE}#signup">سجّل حتى تحضر</a>`
          :!isMember()?`<a class="btn gold sm" href="#join">فعّل حسابك حتى تحضر</a>`
          :!can?`<button class="btn gold sm" type="button" data-buy="monthly">اشترك حتى تحضر</button>`
          :`${soon?`<button class="btn gold sm" type="button" data-join="${s.id}">🎥 دخول الزوم</button>`:""}<button class="btn sm" type="button" data-rsvp="${s.id}">${on?"✓ راح أذكّرك":"🔔 ذكّرني"}</button>`}
        <a class="btn sm ghost" href="${g}" target="_blank" rel="noopener">📅 للتقويم</a>
      </div></div>`}).join("")}</div>`;
}
const gdate=d=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
function tickCountdowns(){
  document.querySelectorAll("[data-cd]").forEach(e=>{const ms=+e.dataset.cd-Date.now();
    if(ms<=0){e.textContent="🔴 جاري الآن";return}
    const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
    e.textContent="⏳ يبدأ بعد "+(d?`${d} يوم `:"")+(h?`${h} ساعة `:"")+(d?"":`${m} دقيقة`)});
}
setInterval(tickCountdowns,30e3);

/* ================= course ================= */
function coursePage(id){
  const c=course(id);if(!c)return home();
  setNav("courses");
  const ls=lessonsOf(id),own=ownsCourse(id),pend=pendingFor("course",id),done=ls.filter(l=>S.progress[l.id]!=null).length;
  $("view").innerHTML=`<div class="wrap">
    <div class="crumb"><a href="#">الأكاديمية</a><span>‹</span><a href="#courses">الدورات</a><span>‹</span><span>${esc(c.title)}</span></div>
    <div class="chead">
      <div>
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><div class="course" style="padding:0;border:0;background:none"><div class="ic">${esc(c.icon)}</div></div><div><h1 style="font-size:clamp(24px,3.4vw,34px)">${esc(c.title)}</h1><div class="muted">${esc(c.level)} · ${ls.length} دروس · ${ls.reduce((a,l)=>a+l.minutes,0)} دقيقة</div></div></div>
        <p style="color:#d4d4da;margin:0 0 16px">${esc(c.subtitle)}</p>
        ${S.user&&done?`<div style="margin-bottom:14px"><div class="bar"><i style="width:${Math.round(done/ls.length*100)}%"></i></div><small class="muted">أنهيت ${done} من ${ls.length}</small></div>`:""}
        ${certBox(c,ls,done)}
        <div class="lessons">${ls.map(l=>{const ok=canRead(l),dn=S.progress[l.id]!=null,free=l.idx<=freeN();
          return `<a class="lrow ${dn?"done":ok&&free&&!own?"free":ok?"":"lock"}" href="#lesson/${esc(l.id)}">
            <span class="n">${dn?"✓":ok?l.idx:"🔒"}</span>
            <span><b>${esc(l.title)}</b><small>${esc(l.summary)}</small></span>
            <span>${free&&!own?'<span class="chip gold">مجاني</span>':""} <small class="muted num">${l.minutes}m</small></span></a>`}).join("")}</div>
        ${S.certs.some(x=>x.course_id===c.id)?"":certShow(c)}
      </div>
      <aside class="buybox">${buyBox(c,own,pend)}${coachMini()}</aside>
    </div></div>`;
}
/* ================= certificates ================= */
const certMin=()=>+(S.info.cert_min||70);
const EN_NAME=/^[A-Za-z][A-Za-z .'-]{1,58}[A-Za-z.]$/;
function certBox(c,ls,done){
  if(!S.user||!ls.length)return"";
  const ct=S.certs.find(x=>x.course_id===c.id);
  if(ct)return`<div class="certbox ok"><span class="cb-ic">🎓</span><div><b>شهادتك جاهزة</b><small class="muted">رمز الشهادة <span class="num">${esc(ct.code)}</span> · معدلك ${ct.score}%</small></div><a class="btn gold sm" href="#cert/${esc(ct.code)}">اعرض الشهادة</a></div>`;
  const sc=ls.map(l=>S.progress[l.id]).filter(v=>v!=null),avg=sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length):0;
  if(done<ls.length)return`<div class="certbox"><span class="cb-ic">🎓</span><div><b>شهادة إتمام باسمك</b><small class="muted">كمّل كل الدروس (${done}/${ls.length}) واختباراتها بمعدل ${certMin()}% أو أكثر، وتطلعلك شهادة رسمية بالإنكليزي من أكاديمية فيكسورا برابط تحقق.</small></div></div>`;
  if(avg<certMin())return`<div class="certbox"><span class="cb-ic">📖</span><div><b>باقي خطوة للشهادة</b><small class="muted">خلّصت كل الدروس 👏 بس معدل اختباراتك ${avg}% والمطلوب ${certMin()}%. ارجع للدروس اللي درجتها واطية وأعد اختبارها.</small></div></div>`;
  const guess=(S.profile&&S.profile.full_name||"").trim();
  return`<div class="certbox go"><span class="cb-ic">🏆</span><div><b>مبروك! خلّصت الدورة بمعدل ${avg}%</b><small class="muted">الشهادة بالإنكليزي. اكتب اسمك بالحروف الإنكليزية مثل ما تريده يطلع، لأنه ما يتغير بعد الإصدار.</small>
    <div class="cb-f"><input id="certName" class="ltr" dir="ltr" maxlength="60" autocomplete="name" placeholder="e.g. Ahmed Ali Hassan" value="${EN_NAME.test(guess)?esc(guess):""}"><button class="btn gold sm" type="button" data-cert="${esc(c.id)}">🎓 طلّع شهادتي</button></div></div></div>`;
}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-cert]");if(!b)return;
  const nm=($("certName").value||"").trim().replace(/\s+/g," ");
  if(!EN_NAME.test(nm)){toast("اكتب اسمك بالحروف الإنكليزية بس (مثل Ahmed Ali)");$("certName").focus();return}
  if(nm.split(" ").length<2){toast("اكتب اسمك الكامل: الاسم واسم الأب على الأقل");$("certName").focus();return}
  if(!confirm(`The certificate will be issued to: ${nm}\nالاسم صحيح؟ ما يتغير بعد الإصدار.`))return;
  b.disabled=true;try{const ct=await API.issueCert(b.dataset.cert,nm);S.certs=S.certs.filter(x=>x.code!==ct.code).concat(ct);S.justIssued=ct.code;location.hash="cert/"+ct.code}
  catch(err){toast(String(err.message||err).replace(/^CERT_\w+:\s*/,""));b.disabled=false}});
async function certPage(code){
  setNav("courses");
  $("view").innerHTML=`<div class="wrap"><div class="empty" style="margin-top:30px">جاري التحقق من الشهادة…</div></div>`;
  let ct=null;try{ct=await API.verifyCert(code)}catch(e){}
  if(!ct){$("view").innerHTML=`<div class="wrap"><div class="certv bad"><b>❌ ما لكينا شهادة بهذا الرمز</b><span class="muted">تأكد من الرمز: <span class="num">${esc(code)}</span></span></div></div>`;return}
  const url=location.href.split("#")[0]+"#cert/"+ct.code,mine=S.certs.some(x=>x.code===ct.code);
  const txt=`🎓 I earned my "${ct.course_title}" certificate from Vexora Trading Academy with a ${ct.score}% score`;
  const d=new Date(ct.issued_at).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  $("view").innerHTML=`<div class="wrap">
    <div class="crumb"><a href="#">الأكاديمية</a><span>‹</span><a href="#courses">الدورات</a><span>‹</span><span>شهادة ${esc(ct.code)}</span></div>
    <div class="certv"><b>✅ شهادة حقيقية صادرة من أكاديمية فيكسورا</b><span class="muted" style="font-size:13px">${esc(ct.kind||"شهادة إتمام دورة تعليمية")} · ${esc(ct.issuer||"أكاديمية فيكسورا · VEXORA Academy")}</span><span class="muted ltr" dir="ltr" data-noi18n>${esc(ct.full_name)} · ${esc(ct.course_title)} · ${ct.lessons} lessons · ${ct.score}% · ${esc(d)} · ${esc(ct.code)}</span></div>
    <div class="certimg"><img id="certImg" alt="Certificate ${esc(ct.full_name)}"></div>
    <div class="certact">${mine?`<button class="btn gold" type="button" id="certDl">⬇️ نزّل الشهادة (صورة)</button>`:`<a class="btn gold" href="#courses">🎓 ابدأ دورتك وطلّع شهادتك</a>`}
      ${mine?`<button class="btn" type="button" id="certMail">📧 أرسلها لإيميلي</button>`:""}<button class="btn" type="button" id="certCopy">🔗 انسخ رابط التحقق</button>
      <a class="btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(txt)}">Telegram</a>
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt+"\n"+url)}">WhatsApp</a>
      <a class="btn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Facebook</a>
      <a class="btn" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(url)}">X</a>
      <a class="btn" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}">LinkedIn</a></div>
    <p class="muted" style="font-size:12.5px;margin-top:14px">ℹ️ هذي شهادة إتمام تعليمية تثبت إن صاحبها خلّص دروس الدورة واختباراتها بالأكاديمية. مو ترخيص مهني ولا شهادة معتمدة من جهة حكومية أو دولية.</p>
  </div>`;
  const cv=await drawCert(ct,d,url);$("certImg").src=cv.toDataURL("image/png");
  $("certCopy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(url);toast("✓ انسخ الرابط")}catch(e){prompt("انسخ الرابط:",url)}});
  const sendMail=async auto=>{const mb=$("certMail");if(mb)mb.disabled=true;
    try{let img="";if(API.uploadCert){const blob=await new Promise(r=>cv.toBlob(r,"image/png"));img=await API.uploadCert(blob,ct.code)}
      const r=await API.certEmail(ct.code,img);toast(r==="ok"?"📧 انرسلت الشهادة لإيميلك":r==="limit"?"وصلت الحد اليوم (3 مرات). جرب باجر.":"ما عندك إيميل بالحساب")}
    catch(err){if(!auto)toast(err.message)}if(mb)mb.disabled=false};
  const mb=$("certMail");if(mb)mb.addEventListener("click",()=>sendMail(false));
  if(mine&&S.justIssued===ct.code){S.justIssued=null;sendMail(true)}
  const dl=$("certDl");if(dl)dl.addEventListener("click",()=>{const a=document.createElement("a");a.download=`VEXORA-Certificate-${ct.code}.png`;a.href=cv.toDataURL("image/png");a.click()});
}
let QRLIB=null;
function loadQR(){return QRLIB||(QRLIB=new Promise(r=>{if(window.qrcode)return r(window.qrcode);const sc=document.createElement("script");sc.src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";sc.onload=()=>r(window.qrcode||null);sc.onerror=()=>r(null);document.head.appendChild(sc);setTimeout(()=>r(window.qrcode||null),6000)}))}
async function drawCert(ct,d,url){
  const W=1600,H=1131,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const PF='"Playfair Display",Georgia,"Times New Roman",serif',SC='"Great Vibes","Brush Script MT","Segoe Script",cursive',SA='"Readex Pro",Arial,sans-serif',MO='"IBM Plex Mono",monospace';
  try{await Promise.all(['700 40px "Playfair Display"','italic 400 30px "Playfair Display"','400 60px "Great Vibes"','500 20px "Readex Pro"','600 16px "IBM Plex Mono"'].map(f=>document.fonts.load(f)))}catch(e){}
  const qr=await loadQR();
  const INK="#1c1c1e",SUB="#55555c",GOLD="#a8842c",G1="#7a5c14",G2="#d9b65a",G3="#f3dd8f";
  const gold=(x0,x1)=>{const g=x.createLinearGradient(x0,0,x1,0);g.addColorStop(0,G1);g.addColorStop(.35,G2);g.addColorStop(.5,G3);g.addColorStop(.65,G2);g.addColorStop(1,G1);return g};
  // الورقة
  x.fillStyle="#141416";x.fillRect(0,0,W,H);
  const pg=x.createLinearGradient(0,0,W,H);pg.addColorStop(0,"#fdfaf2");pg.addColorStop(1,"#f3ecd9");x.fillStyle=pg;x.fillRect(30,30,W-60,H-60);
  // نقشة أمان (guilloche) بالحاشية
  x.save();x.beginPath();x.rect(44,44,W-88,H-88);x.rect(96,96,W-192,H-192);x.clip("evenodd");x.strokeStyle="rgba(168,132,44,.38)";x.lineWidth=.8;
  for(let k=0;k<6;k++){x.beginPath();for(let t=0;t<=W;t+=3){const y=70+Math.sin(t/14+k)*14;t?x.lineTo(t,y):x.moveTo(t,y)}x.stroke();x.beginPath();for(let t=0;t<=W;t+=3){const y=H-70+Math.sin(t/14+k)*14;t?x.lineTo(t,y):x.moveTo(t,y)}x.stroke();
    x.beginPath();for(let t=0;t<=H;t+=3){const xx=70+Math.sin(t/14+k)*14;t?x.lineTo(xx,t):x.moveTo(xx,t)}x.stroke();x.beginPath();for(let t=0;t<=H;t+=3){const xx=W-70+Math.sin(t/14+k)*14;t?x.lineTo(xx,t):x.moveTo(xx,t)}x.stroke()}
  x.restore();
  x.strokeStyle=gold(0,W);x.lineWidth=3;x.strokeRect(44,44,W-88,H-88);x.lineWidth=1.2;x.strokeRect(96,96,W-192,H-192);x.lineWidth=.6;x.strokeRect(104,104,W-208,H-208);
  // زخرفة الزوايا
  [[104,104,1,1],[W-104,104,-1,1],[104,H-104,1,-1],[W-104,H-104,-1,-1]].forEach(([a,b,sx,sy])=>{x.save();x.translate(a,b);x.scale(sx,sy);x.strokeStyle=GOLD;x.lineWidth=1.5;
    x.beginPath();x.moveTo(14,60);x.lineTo(14,14);x.lineTo(60,14);x.stroke();x.beginPath();x.moveTo(22,40);x.lineTo(22,22);x.lineTo(40,22);x.stroke();x.fillStyle=GOLD;x.save();x.translate(14,14);x.rotate(Math.PI/4);x.fillRect(-4,-4,8,8);x.restore();x.restore()});
  // روزيت باهتة بالخلفية
  x.save();x.translate(W/2,H/2+20);x.strokeStyle="rgba(168,132,44,.07)";x.lineWidth=1;for(let k=0;k<36;k++){x.rotate(Math.PI/18);x.beginPath();x.ellipse(0,0,330,120,0,0,Math.PI*2);x.stroke()}x.restore();
  x.textAlign="center";x.direction="ltr";x.textBaseline="alphabetic";
  const T=(t,f,c,y,ls,cx)=>{x.font=f;x.fillStyle=c;x.letterSpacing=ls||"0px";x.fillText(t,cx||W/2,y);x.letterSpacing="0px"};
  const rule=(y,w)=>{x.strokeStyle=gold(W/2-w,W/2+w);x.lineWidth=1.4;x.beginPath();x.moveTo(W/2-w,y);x.lineTo(W/2-10,y);x.moveTo(W/2+10,y);x.lineTo(W/2+w,y);x.stroke();x.save();x.translate(W/2,y);x.rotate(Math.PI/4);x.fillStyle=GOLD;x.fillRect(-4,-4,8,8);x.restore()};
  T("VEXORA TRADING ACADEMY",`600 24px ${SA}`,GOLD,182,"9px");
  rule(206,170);
  T("CERTIFICATE",`700 88px ${PF}`,INK,300,"12px");
  T("OF COMPLETION",`600 22px ${SA}`,GOLD,344,"16px");
  T("This is to certify that",`italic 400 28px ${PF}`,SUB,418);
  let fs=104;x.font=`400 ${fs}px ${SC}`;while(x.measureText(ct.full_name).width>W-420&&fs>56){fs-=4;x.font=`400 ${fs}px ${SC}`}
  T(ct.full_name,`400 ${fs}px ${SC}`,INK,512);
  x.strokeStyle=gold(W/2-380,W/2+380);x.lineWidth=1.6;x.beginPath();x.moveTo(W/2-380,540);x.lineTo(W/2+380,540);x.stroke();
  T("has successfully completed the professional course",`400 24px ${SA}`,SUB,594);
  let cs=46;x.font=`700 ${cs}px ${PF}`;while(x.measureText(ct.course_title).width>W-420&&cs>28){cs-=2;x.font=`700 ${cs}px ${PF}`}
  T(ct.course_title,`700 ${cs}px ${PF}`,INK,656);
  const hrs=ct.minutes?Math.round(ct.minutes/6)/10:0;
  T(`comprising ${ct.lessons} lessons${hrs?` (${hrs} learning hours)`:""} and all assessments, with a final score of ${ct.score}%.`,`400 22px ${SA}`,SUB,706);
  // التوقيع
  const yS=880,signer=S.info.cert_signer||"Coach Omar",sig=signer.replace(/^(coach|mr\.?|dr\.?)\s+/i,"");
  let ss=50;x.font=`400 ${ss}px ${SC}`;while(x.measureText(sig).width>300&&ss>30){ss-=2;x.font=`400 ${ss}px ${SC}`}
  T(sig,`400 ${ss}px ${SC}`,INK,yS-18,"0px",400);
  x.strokeStyle="#9a9aa0";x.lineWidth=1;x.beginPath();x.moveTo(250,yS);x.lineTo(550,yS);x.stroke();
  T(signer,`600 19px ${SA}`,INK,yS+30,"0px",400);T("Head Trainer & Founder",`400 16px ${SA}`,SUB,yS+54,"1px",400);
  // التاريخ والرقم
  const RX=1130;T(d,`600 22px ${SA}`,INK,yS-60,"0px",RX);x.strokeStyle="#9a9aa0";x.beginPath();x.moveTo(RX-140,yS-46);x.lineTo(RX+140,yS-46);x.stroke();T("DATE OF ISSUE",`600 13px ${SA}`,SUB,yS-24,"3px",RX);
  T(ct.code,`600 22px ${MO}`,INK,yS+30,"2px",RX);x.beginPath();x.moveTo(RX-140,yS+44);x.lineTo(RX+140,yS+44);x.stroke();T("CREDENTIAL ID",`600 13px ${SA}`,SUB,yS+66,"3px",RX);
  // الختم الذهبي
  const sx=W/2,sy=yS-24;x.save();x.translate(sx,sy);
  x.fillStyle="#7a5c14";[[-1,1],[1,1]].forEach(([d1])=>{x.beginPath();x.moveTo(d1*18,40);x.lineTo(d1*50,118);x.lineTo(d1*35,104);x.lineTo(d1*22,124);x.lineTo(d1*-6,52);x.closePath();x.fill()});
  x.beginPath();for(let k=0;k<64;k++){const r=k%2?92:100,a=k*Math.PI/32;x.lineTo(Math.cos(a)*r,Math.sin(a)*r)}x.closePath();const sg=x.createRadialGradient(-30,-30,10,0,0,100);sg.addColorStop(0,G3);sg.addColorStop(.6,G2);sg.addColorStop(1,G1);x.fillStyle=sg;x.fill();
  x.strokeStyle="rgba(90,66,10,.7)";x.lineWidth=1.5;x.beginPath();x.arc(0,0,78,0,Math.PI*2);x.stroke();x.beginPath();x.arc(0,0,56,0,Math.PI*2);x.stroke();
  const ring="VEXORA TRADING ACADEMY • CERTIFIED • ";x.font=`700 12px ${SA}`;x.fillStyle="#4a3608";x.textAlign="center";
  const step=Math.PI*2/ring.length;for(let k=0;k<ring.length;k++){x.save();x.rotate(-Math.PI/2+k*step);x.translate(0,-62);x.fillText(ring[k],0,0);x.restore()}
  x.fillStyle="#3d2c06";x.font=`700 15px ${SA}`;x.letterSpacing="2px";x.fillText("VERIFIED",0,-4);x.letterSpacing="0px";x.font=`700 26px ${PF}`;x.fillText(String(new Date(ct.issued_at).getFullYear()),0,26);
  x.restore();
  // QR للتحقق
  if(qr){try{const q=qr(0,"M");q.addData(url);q.make();const n=q.getModuleCount(),sz=120,cell=sz/n,qx=1330,qy=yS-70;
    x.fillStyle="#ffffff";x.fillRect(qx-8,qy-8,sz+16,sz+16);x.fillStyle=INK;for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))x.fillRect(qx+c*cell,qy+r*cell,Math.ceil(cell),Math.ceil(cell));
    T("SCAN TO VERIFY",`600 11px ${SA}`,SUB,qy+sz+26,"2px",qx+sz/2)}catch(e){}}
  T(`Verify this credential at ${url.replace(/^https?:\/\//,"")}`,`400 15px ${MO}`,"#8a8a90",H-128);
  return cv;
}
/* ================= إشعارات الموبايل (Web Push) ================= */
const PUSH={
  ok:()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window&&window.isSecureContext,
  ios:()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1),
  standalone:()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true,
  u8(b){const p="=".repeat((4-b.length%4)%4),s=atob((b+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(s,c=>c.charCodeAt(0))},
  async sub(){if(!PUSH.ok())return null;const r=await navigator.serviceWorker.getRegistration();return r?await r.pushManager.getSubscription():null},
  async state(){if(!PUSH.ok())return PUSH.ios()&&!PUSH.standalone()?"ios":"no";if(Notification.permission==="denied")return"denied";return(await PUSH.sub().catch(()=>null))?"on":"off"},
  async enable(vapid,save){if(!vapid)throw new Error("الإشعارات بعدها ما تفعّلت من الإدارة");
    const pm=await Notification.requestPermission();if(pm!=="granted")throw new Error("ما سمحت بالإشعارات. فعّلها من إعدادات المتصفح للموقع");
    const reg=await navigator.serviceWorker.register("sw.js");await navigator.serviceWorker.ready;
    let s=await reg.pushManager.getSubscription();if(!s){try{s=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:PUSH.u8(vapid)})}catch(err){throw new Error(/permission|denied/i.test(err.message)?"المتصفح منع الإشعارات. اسمح بيها من إعدادات الموقع وجرب مرة ثانية":"ما گدرنا نفعّل الإشعارات على هذا الجهاز: "+err.message)}}
    const j=s.toJSON();await save(j.endpoint,j.keys.p256dh,j.keys.auth,navigator.userAgent)},
  async disable(del){const s=await PUSH.sub();if(s){try{await del(s.endpoint)}catch(e){}await s.unsubscribe()}},
  // شريط يدعو لتفعيل الإشعارات (مرة كل 5 أيام)
  async nudge(vapid,save,txt){try{if(!vapid)return;const st=await PUSH.state();if(st!=="off"&&st!=="ios")return;
      const k="albasha_push_nudge",t=+localStorage.getItem(k)||0;if(Date.now()-t<5*864e5)return;
      if(document.getElementById("pushNudge"))return;const d=document.createElement("div");d.id="pushNudge";d.className="pnudge";d.setAttribute("role","dialog");
      d.innerHTML=st==="ios"?`<b>📲 خلي التوصيات توصلك على الآيفون</b><span>اضغط زر المشاركة <b>⬆️</b> بالأسفل ← <b>إضافة إلى الشاشة الرئيسية</b>، وافتح فيكسورا من الأيقونة. بعدها فعّل الإشعارات.</span><div><button type="button" data-pn="x">تمام</button></div>`
        :`<b>📲 ${txt||"خلي التوصيات توصلك على الموبايل أول بأول"}</b><span>توصية جديدة، هدف تحقق، تفعيل حسابك، شهادتك… حتى لو المنصة مسدودة.</span><div><button type="button" class="go" data-pn="on">🔔 فعّل الإشعارات</button><button type="button" data-pn="x">لاحقاً</button></div>`;
      document.body.appendChild(d);
      d.addEventListener("click",async e=>{const b=e.target.closest("[data-pn]");if(!b)return;try{localStorage.setItem(k,String(Date.now()))}catch(_){}
        if(b.dataset.pn==="on"){b.disabled=true;try{await PUSH.enable(vapid,save);d.innerHTML="<b>✅ تفعّلت الإشعارات على هذا الجهاز</b>";setTimeout(()=>d.remove(),2500);return}catch(err){d.querySelector("span").textContent=err.message;b.disabled=false;return}}
        d.remove()});
    }catch(e){}}
};
if(PUSH.ok())navigator.serviceWorker.register("sw.js").catch(()=>{});

const ipushSave=(e,k,a,u)=>API.pushSub(e,k,a,u);

/* ===== عرض الشهادة كحافز ===== */
const EN_TITLE={tech:"Technical Analysis",cls:"Classical Chart Analysis",wav:"Elliott Wave Analysis",tim:"Time Cycle Analysis",num:"Quantitative & Statistical Analysis"};
const courseEn=c=>c&&(c.title_en||EN_TITLE[c.id])||"Technical Analysis";
const PREV={};
function certShow(c,compact){
  const ls=c?lessonsOf(c.id):S.lessons,done=S.user?ls.filter(l=>S.progress[l.id]!=null).length:0,left=ls.length-done,key="cp-"+(c?c.id:"all");
  const pct=ls.length?Math.round(done/ls.length*100):0;
  const head=c?(done?`باقيلك <b>${left}</b> درس وتطلع شهادتك 🔥`:`كمّل ${ls.length} درس واختباراتهن وتطلع شهادتك`):"كل دورة تكملها تطلعلك شهادة إتمام موثّقة باسمك";
  return`<div class="cshow${compact?" sm":""}"><div class="cs-img"><img data-cprev="${esc(c?c.id:"")}" id="${key}" alt="نموذج الشهادة"><span class="cs-tag">نموذج</span></div>
    <div class="cs-t"><span class="chip gold">🎓 شهادة إتمام موثّقة</span><h3>${head}</h3>
      ${c&&S.user&&done?`<div class="bar" style="margin:4px 0 2px"><i style="width:${pct}%"></i></div><small class="muted">أنهيت ${done} من ${ls.length} · المطلوب معدل ${certMin()}% بالاختبارات</small>`:""}
      <ul><li>✍️ باسمك بالإنكليزي ومختومة بختم الأكاديمية وتوقيع الكوتش</li><li>🔎 رقم شهادة و QR، وأي شركة أو شخص يتحقق منها برابط</li><li>📧 توصلك على الإيميل أول ما تخلّص</li><li>💼 تنشرها على LinkedIn والسوشيال بضغطة</li></ul>
      ${c?(left?`<a class="btn gold" href="#lesson/${esc((ls.find(l=>S.progress[l.id]==null)||ls[0]||{}).id||"")}">${done?"كمّل الدورة ←":"ابدأ أول درس ←"}</a>`:""):`<a class="btn gold" href="#courses">ابدأ دورتك ←</a>`}</div></div>`;
}
async function fillCertPrev(){
  const imgs=[...document.querySelectorAll("img[data-cprev]")];if(!imgs.length)return;
  for(const im of imgs){const cid=im.dataset.cprev,c=cid?course(cid):S.courses[0];
    const nm=(S.profile&&S.profile.full_name||"").trim(),name=EN_NAME.test(nm)?nm.replace(/\b\w/g,m=>m.toUpperCase()):"Your Name Here";
    const k=(cid||"all")+"|"+name;
    if(!PREV[k]){const ls=c?lessonsOf(c.id):[];const ct={code:"AB-000000",full_name:name,course_title:courseEn(c),lessons:ls.length||8,minutes:ls.reduce((a,l)=>a+(+l.minutes||0),0),score:95,issued_at:new Date().toISOString()};
      const cv=await drawCert(ct,new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}),location.href.split("#")[0]+"#cert/AB-000000");
      const x=cv.getContext("2d");x.save();x.translate(cv.width/2,cv.height/2);x.rotate(-.32);x.font='700 210px "Playfair Display",Georgia,serif';x.textAlign="center";x.textBaseline="middle";x.fillStyle="rgba(168,132,44,.13)";x.letterSpacing="30px";x.fillText("SAMPLE",0,0);x.restore();
      PREV[k]=cv.toDataURL("image/jpeg",.86)}
    im.src=PREV[k]}
}
function certsPage(){
  setNav("certs");
  const mine=S.certs.slice().sort((a,b)=>a.issued_at<b.issued_at?1:-1);
  const rows=S.courses.filter(c=>!mine.some(x=>x.course_id===c.id)).map(c=>{const ls=lessonsOf(c.id),done=S.user?ls.filter(l=>S.progress[l.id]!=null).length:0,pct=ls.length?Math.round(done/ls.length*100):0;
    return`<a class="crow" href="#course/${esc(c.id)}"><span class="ci">${esc(c.icon||"📘")}</span><span class="cn"><b>${esc(c.title)}</b><small class="muted ltr" dir="ltr">${esc(courseEn(c))}</small><span class="bar"><i style="width:${pct}%"></i></span></span><span class="cp">${done===ls.length&&ls.length?"🏆 جاهزة، طلّعها":`${done}/${ls.length} درس`}</span></a>`}).join("");
  $("view").innerHTML=pageHead("🎓 شهاداتي","كل دورة تكملها بكل دروسها واختباراتها بمعدل "+certMin()+"% أو أكثر، تطلعلك شهادة إتمام موثّقة بالإنكليزي باسمك، برقم و QR للتحقق، وتوصلك على الإيميل.")
   +`<section class="blk" style="padding-top:6px"><div class="wrap">
     ${!S.user?`<div class="panel" style="margin-bottom:18px">سجّل دخول حتى تشوف شهاداتك وتقدمك. <a class="btn gold sm" href="${CONFIG.SITE}">تسجيل الدخول</a></div>`:""}
     ${mine.length?`<div class="sh"><div><h2>شهاداتك (${mine.length})</h2></div></div><div class="cgrid">${mine.map(ct=>`<a class="ccard" href="#cert/${esc(ct.code)}"><span class="cc-ic">🎓</span><b class="ltr" dir="ltr">${esc(ct.course_title)}</b><small class="muted">معدل ${ct.score}% · <bdi dir="ltr">${esc(new Date(ct.issued_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}))}</bdi></small><span class="num muted" style="font-size:12px">${esc(ct.code)}</span><i>اعرض الشهادة ←</i></a>`).join("")}</div>`:""}
     ${rows?`<div class="sh" style="margin-top:${mine.length?26:0}px"><div><h2>${mine.length?"الشهادات الجاية":"شهاداتك الجاية"}</h2><p>كل دورة وكم باقيلك حتى تطلع شهادتها.</p></div></div><div class="clist">${rows}</div>`:""}
     ${S.user?`<div id="v2CertReq" style="margin-top:26px"></div>`:""}
     ${certShow(null)}
   </div></section>`;
  v2CertReq();
}
function buyBox(c,own,pend){
  if(own)return`<div class="panel"><span class="chip up">✓ الدورة مفتوحة لك كاملة</span><p class="muted" style="margin:10px 0 0">كمّل دروسك واختباراتك، وإذا عندك سؤال احجز جلسة خاصة أو راسلني على تيليجرام.</p></div>`;
  return`<div class="panel" style="border-color:var(--accent)">
    <div class="muted" style="font-size:13px">افتح الدورة كاملة</div>
    <div class="price" style="font-size:32px;margin:4px 0">${money(c.price)}</div>
    <ul style="margin:0 0 12px;padding:0 18px 0 0;color:#d5d5dc"><li>كل الدروس (${lessonsOf(c.id).length}) بالرسومات والاختبارات</li><li>وصول دائم، دفعة وحدة</li><li>دعم مباشر على تيليجرام</li></ul>
    ${pend?'<span class="chip gold">⏳ طلبك بانتظار التفعيل</span>':`<button class="btn gold" style="width:100%" type="button" data-buy="course" data-course="${esc(c.id)}">افتح الدورة الآن</button>`}
    <div class="muted" style="font-size:12.5px;margin-top:10px;text-align:center">أو <a href="#" data-buy="monthly">اشترك شهرياً</a> وتفتح كل الدورات ودروس الزوم بـ ${money(S.info.price_monthly)}</div>
  </div>`;
}
function coachMini(){return`<div class="panel"><div class="mini"><img src="${esc(photo())}" alt=""><div><b>${esc(coachName())}</b><span class="muted" style="font-size:13px">بالأسواق من ${esc(S.info.coach_since||"2018")}</span></div></div><div class="links" style="margin-top:12px">${coachLinks(true)}</div></div>`}

/* ================= lesson ================= */
async function lessonPage(id){
  const l=S.lessons.find(x=>x.id===id);if(!l)return home();
  const c=course(l.course_id),ls=lessonsOf(l.course_id),i=ls.findIndex(x=>x.id===id),prev=ls[i-1],next=ls[i+1];
  setNav("courses");
  const head=`<div class="crumb"><a href="#">الأكاديمية</a><span>‹</span><a href="#course/${esc(c.id)}">${esc(c.title)}</a><span>‹</span><span>الدرس ${l.idx}</span></div>`;
  const side=`<aside class="side"><div class="panel"><b style="color:var(--accent)">${esc(c.title)}</b><div class="lessons" style="margin-top:10px">${ls.map(x=>{const ok=canRead(x),dn=S.progress[x.id]!=null;
    return`<a class="lrow ${dn?"done":ok?"":"lock"}" style="padding:8px 10px;${x.id===id?"border-color:var(--accent)":""}" href="#lesson/${esc(x.id)}"><span class="n" style="width:28px;height:28px;font-size:13px">${dn?"✓":ok?x.idx:"🔒"}</span><span style="font-size:13.5px">${esc(x.title)}</span><span></span></a>`}).join("")}</div></div>${coachMini()}</aside>`;
  $("view").innerHTML=`<div class="wrap">${head}<div class="lesson"><article class="content" id="lc"><p class="muted">جاري تحميل الدرس…</p></article>${side}</div></div>`;
  window.scrollTo(0,0);
  if(!canRead(l))return paywall(l,c);
  let b=null;try{b=await API.body(id)}catch(e){}
  if(!b){return paywall(l,c)}
  $("lc").innerHTML=`<span class="chip gold">الدرس ${l.idx} من ${ls.length} · ${l.minutes} دقيقة</span>
    <h1 style="margin-top:10px">${esc(l.title)}</h1><p class="muted">${esc(l.summary)}</p>
    <div class="lbody">${b.body}</div><a class="btn gold" href="app.html#chart" style="margin:18px 0 6px;display:inline-flex">📐 طبّق الدرس على الشارت + 🤖 اسأل المساعد</a>
    ${quizHTML(b.quiz||[])}
    ${l.idx<=freeN()&&!ownsCourse(c.id)?`<div class="paywall" style="margin-top:26px"><div class="lockic">🔓</div><h2>عجبك الدرس؟ هذا بس البداية</h2><p>الدروس الجاية فيها الأدوات اللي أستخدمها كل يوم من ${esc(S.info.coach_since||"2018")}. افتح الدورة كاملة وكمّل الطريق.</p><div class="cta">${pendingFor("course",c.id)?'<span class="chip gold">⏳ طلبك بانتظار التفعيل</span>':`<button class="btn gold" type="button" data-buy="course" data-course="${esc(c.id)}">افتح الدورة · ${money(c.price)}</button>`}<button class="btn" type="button" data-buy="monthly">كل الدورات + الزوم شهرياً</button></div></div>`:""}
    <div class="lnav">${prev?`<a class="btn" href="#lesson/${esc(prev.id)}">→ الدرس السابق</a>`:"<span></span>"}${next?`<a class="btn gold" href="#lesson/${esc(next.id)}">الدرس التالي ←</a>`:`<a class="btn gold" href="#course/${esc(c.id)}">رجوع للدورة</a>`}</div>`;
  bindQuiz(l,b.quiz||[]);
  try{localStorage.setItem("vx_last_lesson",JSON.stringify({id:l.id,t:Date.now(),title:`الدرس ${l.idx}: ${l.title}`,course:c.title}))}catch(e){}
  v2Tutor(l,c);
}
const OFFER={spread:"22–27",cashback:"7$",bonus:"100%",invites:10}; // عدّل أرقام العرض من هنا
function offerHTML(){return`<div class="offer"><div class="of-h">🎁 مميزات التسجيل من رابطنا</div><div class="of-g">
  <div><b class="num">${OFFER.spread}</b><span>حجم السبريد من 22 إلى 27</span></div>
  <div><b class="num">${OFFER.cashback}</b><span>كاش باك على تداولك الشخصي يوصل لـ 7$</span></div>
  <div><b class="num">${OFFER.bonus}</b><span>بونص 100% على الإيداع</span></div>
  <div><b class="num">🎟 ${OFFER.invites}</b><span>ادعُ 10 أشخاص ينضمون للبروكر والمنصة وتدخل السحب على دورة أو اشتراك مجاني</span></div>
  </div><small>حسب شروط وأحكام INFINOX</small></div>`}
function brokerGate(){
  const st=S.profile&&S.profile.status;
  const head=st==="pending"?"⏳ طلبك قيد المراجعة":st==="rejected"?"ما گدرنا نفعّل حسابك":"حصري لعملاء وكالة فيكسورا";
  const sub=st==="pending"?"وصلنا طلبك، ونتأكد إن حسابك بـ INFINOX مسجّل تحت وكالتنا. أول ما يتفعّل تنفتح لك الأكاديمية والتوصيات."
    :st==="rejected"?`حسابك بـ INFINOX مو مسجّل تحت وكالتنا.${S.profile.note?` (${esc(S.profile.note)})`:""} افتح حساب من رابط الوكالة وحدّث رقم حسابك.`
    :"الأكاديمية والتوصيات مجانية لعملاء INFINOX اللي فتحوا حسابهم عن طريق وكالتنا. ثلاث خطوات وتبدأ:";
  return`<div class="paywall"><div class="lockic">👑</div><h2>${head}</h2><p>${sub}</p>
    ${st==="pending"?"":`<ol class="steps"><li><b>افتح حساب INFINOX</b> من رابط الوكالة</li><li><b>أكمل ملفك</b> برقم حسابك ويوزر تيليجرام</li><li><b>نفعّلك</b> وتنفتح لك الدروس والتوصيات</li></ol>`}
    ${st==="pending"?"":offerHTML()}
    <div class="cta">${st==="pending"?"":`<a class="btn gold" href="${CONFIG.IB}" target="_blank" rel="noopener">افتح حساب INFINOX</a>${VXI.btn("broker","▶️ شلون أفتحه وأوثّقه")}`}<a class="btn" href="${CONFIG.SITE}">${st==="pending"?"تحديث الحالة":"أكمل ملفي"}</a><a class="btn ghost" href="https://t.me/${esc(tgUser())}" target="_blank" rel="noopener">✈️ مساعدة</a></div></div>`;
}
function paywall(l,c){
  const need=!S.user;
  $("lc").innerHTML=`<span class="chip">الدرس ${l.idx}</span><h1 style="margin-top:10px">${esc(l.title)}</h1><p class="muted">${esc(l.summary)}</p>
    <div class="paywall">
      <div class="lockic">🔒</div>
      ${need?`<h2>سجّل وابدأ التعلّم</h2><p>الأكاديمية حصرية لعملاء وكالة فيكسورا على INFINOX. سوّ حساب، وافتح حسابك بالبروكر من رابطنا، وتنفتح لك الدروس.</p><div class="cta"><a class="btn gold" href="${CONFIG.SITE}#signup">سجّل الآن</a><a class="btn" href="${CONFIG.SITE}">عندي حساب</a></div>`
      :!isMember()?brokerGate().replace('<div class="paywall"><div class="lockic">👑</div>','').replace(/<\/div>$/,'')
      :`<h2>هذا الدرس من الدورة الكاملة</h2><p>افتح «${esc(c.title)}» كاملة بدفعة وحدة، أو اشترك شهرياً وتفتح كل الدورات ودروس الزوم المباشرة.</p>
        <div class="cta">${pendingFor("course",c.id)?'<span class="chip gold">⏳ طلبك بانتظار التفعيل، أول ما يتأكد الدفع ينفتح</span>':`<button class="btn gold" type="button" data-buy="course" data-course="${esc(c.id)}">افتح الدورة · ${money(c.price)}</button>`}<button class="btn" type="button" data-buy="monthly">الاشتراك الشهري · ${money(S.info.price_monthly)}</button></div>`}
    </div>
    <div class="blur" aria-hidden="true"><p>${"محتوى الدرس ".repeat(60)}</p></div>`;
}
function quizHTML(qz){
  if(!qz.length)return"";
  return`<section class="quiz" id="quiz"><h3>🧠 اختبر نفسك</h3>${qz.map((q,i)=>`<div class="qq" data-q="${i}"><p>${i+1}. ${esc(q.q)}</p>${v2Shuffle(q.o.map((o,j)=>[o,j])).map(([o,j])=>`<button type="button" class="opt" data-o="${j}">${esc(o)}</button>`).join("")}<div class="why" hidden></div></div>`).join("")}<div class="score" id="qScore" hidden></div></section>`;
}
function bindQuiz(l,qz){
  const box=$("quiz");if(!box)return;let ans=0,ok=0;const picks=new Array(qz.length).fill(-1);
  box.addEventListener("click",async e=>{const b=e.target.closest(".opt");if(!b)return;const qq=b.closest(".qq");if(qq.dataset.answered)return;
    qq.dataset.answered=1;const q=qz[+qq.dataset.q],pick=+b.dataset.o;ans++;picks[+qq.dataset.q]=pick;
    qq.querySelectorAll(".opt").forEach(x=>{const j=+x.dataset.o;if(j===q.a)x.classList.add("ok");else if(j===pick)x.classList.add("bad")});
    if(pick===q.a)ok++;const w=qq.querySelector(".why");w.hidden=false;w.textContent=(pick===q.a?"✓ صح. ":"✗ مو هيچ. ")+q.why;
    if(ans===qz.length){const s=$("qScore");s.hidden=false;const pct=Math.round(ok/qz.length*100);
      s.innerHTML=`نتيجتك: <b class="num">${ok}/${qz.length}</b> ${pct===100?"🔥 ممتاز!":pct>=66?"👏 زين، راجع اللي غلطت بيه":"📖 راجع الدرس مرة ثانية"}`;
      try{const sv=API.submitQuiz?await API.submitQuiz(l.id,picks):(await API.saveProgress(l.id,pct),pct);S.progress[l.id]=Math.max(S.progress[l.id]||0,+sv)}catch(e){toast("ما انحفظت الدرجة: "+(e.message||e))}}
  });
}

/* ================= buying ================= */
function openBuy(kind,cid){
  if(!S.user){location.href=CONFIG.SITE+"#signup";return}
  if(!isMember()){location.hash="join";return}
  if(kind==="deposit")return openDeposit();
  const c=kind==="course"&&cid&&course(cid),ind=kind==="indicator"?vxInds().find(x=>x.name===cid):null;
  if(kind==="indicator"&&!ind)return toast("المؤشر مو موجود");
  const vipFree=kind==="indicator"&&hasVip()&&!isAdmin();
  const label=kind==="indicator"?`مؤشر ${ind.name} (${IPER[ind.period||"month"]||""})`:kind==="course"?`دورة ${c.title}`:kind==="zoom"?"جلسة زوم خاصة (ساعة)":kind==="ai"?"اشتراك مساعد الذكاء الصناعي (شهر)":kind==="vip"?"اشتراك VIP: القناة والتوصيات والمؤشرات (شهر)":"الاشتراك الشهري الكامل";
  const price=kind==="indicator"?(vipFree?0:v2IndPrice(ind)):kind==="course"?c.price:kind==="zoom"?S.info.price_zoom:kind==="ai"?(S.info.price_ai||10):kind==="vip"?(S.info.price_vip||100):S.info.price_monthly;
  const tg=`https://t.me/${tgUser()}?text=${encodeURIComponent(`مرحبا كوتش، أريد أدفع: ${label} (${money(price)}). إيميلي: ${S.user.email||""}`)}`;
  const W=(S.info.pay_wallet||"").trim(),NET=(S.info.pay_network||"TRC20").toUpperCase();
  const amt=Number(price||0);
  $("dlgBody").innerHTML=`<h2>${kind==="zoom"?"احجز جلستك الخاصة":"إتمام الطلب"}</h2>
    <div class="sum"><b>${esc(label)}</b><span class="price">${money(price)}</span></div>
    ${vipFree?'<div class="payinfo">⭐ مجاني لأنك عضو VIP، ويبقى فعّال طول مدة اشتراكك.</div>':W?`<div class="wal">
      <div class="wal-h"><b>💳 ادفع <span class="num">${amt} USDT</span></b><span class="chip gold">شبكة ${esc(NET)}</span></div>
      <div class="wal-b"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=6&data=${encodeURIComponent(W)}" alt="QR" width="130" height="130" loading="lazy">
        <div style="display:grid;gap:8px;min-width:0"><span class="muted" style="font-size:12.5px">عنوان المحفظة</span><code class="wal-a" id="walA">${esc(W)}</code><button class="btn sm" type="button" id="walC">📋 نسخ العنوان</button></div></div>
      <p class="wal-w">⚠️ أرسل <b>USDT</b> على شبكة <b>${esc(NET)}</b> بس. التحويل على شبكة ثانية يضيع.</p></div>`
      :`<div class="payinfo">${esc(S.info.pay_info||"")}</div>`}
    <form class="fm" id="buyForm">
      ${kind==="zoom"?`<label>شنو تحب نشتغل عليه بالجلسة؟<textarea id="bNote" maxlength="600" placeholder="مثلاً: التحليل الموجي على الذهب ومراجعة صفقاتي"></textarea></label>
      <label>الوقت المناسب إلك<input id="bTime" maxlength="120" placeholder="مثلاً: السبت أو الأحد بعد 8 مساءً بتوقيت بغداد"></label>`:""}
      ${kind==="indicator"?`<label>يوزرك بـ TradingView (حتى نضيفك على المؤشر)<input id="bTv" class="ltr" maxlength="40" placeholder="TradingView username" required value="${esc(((IND.mine||[]).find(x=>x.tv_user)||{}).tv_user||"")}"><small class="muted">تلكاه بـ TradingView: اضغط صورتك فوق ← يطلع اسمك تحت الصورة (بدون @).</small></label>`:""}
      <label>📷 صورة التحويل<span class="rcp" id="rcpBox"><span class="muted">اضغط واختار صورة التحويل من محفظتك</span></span><input id="bRcp" type="file" accept="image/*" hidden></label>
      <label>رقم العملية TxID ${NET==="TRC20"&&W?'<span class="chip up" style="font-size:11px">يتفعّل تلقائياً ⚡</span>':""}<input id="bRef" class="ltr" maxlength="300" placeholder="الصق TxID أو رابط العملية من المحفظة"></label>
      ${NET==="TRC20"&&W?'<p class="muted" style="margin:-4px 0 0;font-size:12.5px">إذا كتبت TxID، المنصة تتأكد من التحويل على الشبكة وتفعّل طلبك تلقائياً خلال دقايق.</p>':""}
      <button class="btn gold" type="submit">${kind==="zoom"?"أرسل طلب الحجز":"تم الدفع، أرسل الطلب"}</button>
      <p class="msg" id="bMsg"></p>
    </form>
    <a class="btn ghost" href="${tg}" target="_blank" rel="noopener">✈️ عندك سؤال؟ راسل الكوتش</a>
    <button class="btn ghost" type="button" data-close>إلغاء</button>`;
  $("dlg").showModal();
  if($("walC"))$("walC").onclick=async()=>{try{await navigator.clipboard.writeText(W)}catch(e){const r=document.createRange();r.selectNodeContents($("walA"));const s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand("copy")}$("walC").textContent="✓ انسخ"};
  let rcp=null,rcpOrig=null;
  $("rcpBox").onclick=()=>$("bRcp").click();
  $("bRcp").onchange=async e=>{const f=e.target.files[0];if(!f)return;rcpOrig=f;try{rcp=await shrinkImg(f,1400);$("rcpBox").innerHTML=`<img src="${URL.createObjectURL(rcp)}" alt="">`}catch(err){rcp=f.size<12e6?f:null;$("rcpBox").innerHTML=rcp?'<span>✓ تم اختيار الصورة</span>':`<span class="muted">${esc(err.message)}</span>`}};
  $("buyForm").onsubmit=async e=>{e.preventDefault();const btn=e.submitter||$("buyForm").querySelector("button");
    const ref=($("bRef").value||"").trim(),tx=(ref.match(/[0-9a-fA-F]{64}/)||[""])[0];
    const f={kind,course_id:kind==="course"?cid:null,...(kind==="indicator"?{item:cid,tv_user:($("bTv").value||"").trim().replace(/^@/,"")}:{}),pay_ref:tx||ref,note:$("bNote")?$("bNote").value.trim():"",preferred_time:$("bTime")?$("bTime").value.trim():""};
    const say=(m,ok)=>{$("bMsg").className="msg "+(ok?"ok":"err");$("bMsg").textContent=m};
    if(kind==="zoom"&&!f.preferred_time)return say("اكتب الوقت المناسب إلك");
    if(kind==="indicator"&&!/^[A-Za-z0-9_.-]{2,40}$/.test(f.tv_user))return say("اكتب يوزر TradingView صحيح (حروف إنكليزية وأرقام)");
    if(vipFree)f.pay_ref="VIP";
    if(kind!=="zoom"&&!vipFree&&!rcp&&!f.pay_ref)return say("ارفع صورة التحويل أو اكتب TxID");
    btn.disabled=true;say("جاري الإرسال…",true);
    if(rcpOrig&&crypto.subtle){try{const b=await crypto.subtle.digest("SHA-256",await rcpOrig.arrayBuffer());f.receipt_hash=[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}catch(_){}}
    try{if(rcp){try{f.receipt_url=await API.uploadReceipt(rcp)}catch(err){if(!f.pay_ref){btn.disabled=false;return say("ما گدرنا نرفع الصورة: "+err.message)}}}
      await API.buy(f);S.purchases=await API.purchases();$("dlg").close();
      toast(tx&&W&&NET==="TRC20"?"✅ وصل طلبك. نتأكد من التحويل ويتفعّل تلقائياً خلال دقايق":"✅ وصل طلبك. أول ما يتأكد الدفع يتفعّل ويوصلك إشعار");if(location.hash==="#buy-ai"||location.hash==="#buy-vip")location.hash="orders";else render()}
    catch(err){say(err.message);btn.disabled=false}};
}
async function shrinkImg(file,max){const url=URL.createObjectURL(file),img=new Image();try{await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(new Error("الملف مو صورة"));img.src=url});
  const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);return await new Promise(r=>c.toBlob(r,"image/jpeg",.85))}finally{URL.revokeObjectURL(url)}}

/* ================= orders ================= */
const KIND={course:"دورة",zoom:"جلسة زوم خاصة",monthly:"اشتراك شهري",ai:"🤖 اشتراك المساعد",indicator:"📈 مؤشر",vip:"⭐ اشتراك VIP",deposit:"🏦 تفعيل VIP بالإيداع"};
const ST={pending:["بانتظار التفعيل","gold"],paid:["مفعّل","up"],done:["منتهي","up"],rejected:["مرفوض","down"]};
function ordersPage(){
  setNav("orders");
  if(!S.user)return home();
  const rows=S.purchases;
  $("view").innerHTML=`<div class="wrap"><div class="sh" style="margin-top:26px"><div><h2>طلباتي</h2><p>حالة مشترياتك وجلساتك الخاصة.</p></div><a class="btn" href="https://t.me/${esc(tgUser())}" target="_blank" rel="noopener">✈️ تواصل ويا الكوتش</a></div>
    ${rows.length?`<div class="tbl"><table><thead><tr><th>الطلب</th><th>المبلغ</th><th>الحالة</th><th>التفاصيل</th><th>التاريخ</th></tr></thead><tbody>${rows.map(p=>{const c=p.course_id&&course(p.course_id);
      return`<tr><td><b>${KIND[p.kind]||esc(p.kind)}</b>${c?`<div class="muted">${esc(c.title)}</div>`:""}${p.kind==="indicator"?`<div class="muted">${esc(p.item||"")}${p.expires_at&&p.status==="paid"?` · ينتهي ${new Date(p.expires_at).toLocaleDateString(window.LANG||"ar")}`:""}</div>`:""}</td><td class="num">${money(p.amount,p.currency)}</td>
      <td><span class="chip ${ST[p.status][1]}">${ST[p.status][0]}</span>${p.admin_note?`<div class="muted" style="font-size:12.5px">${esc(p.admin_note)}</div>`:""}${p.status==="pending"&&/^[0-9a-f]{64}$/i.test(p.pay_ref||"")&&!p.verify_note?'<div class="muted" style="font-size:12.5px">🔎 نتأكد من التحويل تلقائياً…</div>':p.verify_note?`<div class="muted" style="font-size:12.5px">${esc(p.verify_note)}</div>`:""}</td>
      <td style="font-size:13px">${p.kind==="zoom"?(p.session_at?`🗓 ${fmtDate(p.session_at)}${p.zoom_url&&paid(p)?`<br><a href="${esc(p.zoom_url)}" target="_blank" rel="noopener">🎥 رابط الزوم</a>`:""}`:`<span class="muted">الوقت المقترح: ${esc(p.preferred_time||"—")}</span>`):p.kind==="monthly"&&p.expires_at?`ينتهي ${new Date(p.expires_at).toLocaleDateString(window.LANG||"ar")}`:""}</td>
      <td class="muted">${new Date(p.created_at).toLocaleDateString(window.LANG||"ar")}</td></tr>`}).join("")}</tbody></table></div>`
      :`<div class="empty">ما عندك طلبات بعد. ابدأ بالدرس المجاني من <a href="#courses">الدورات</a>.</div>`}</div>`;
}

/* ================= admin ================= */
const ADM={tab:"pending",rows:[],sess:[]};
async function adminPage(){
  setNav("admin");
  if(!isStaff())return home();
  $("view").innerHTML=`<div class="wrap"><div class="sh" style="margin-top:26px"><div><h2>إدارة الأكاديمية</h2><p>${isAdmin()?"الطلبات، دروس الزوم، محتوى الموقع، والأسعار.":"الأقسام اللي عندك صلاحية عليها."}</p></div><button class="btn" type="button" id="aRef">تحديث</button></div>
    <div class="atiles" id="aStats"></div>
    <div class="tabs" id="aTabs"></div>
    <div id="aBody"><p class="muted">جاري التحميل…</p></div></div>`;
  $("aRef").onclick=adminPage;
  try{const [st,rows,sess]=await Promise.all([API.aStats().catch(()=>({})),canP("payments")?API.aPurchases():[],canP("zoom")?API.aSessions():[]]);ADM.rows=rows||[];ADM.sess=sess||[];
    const s=st||{};$("aStats").innerHTML=[["طلبات بانتظارك",s.pending||0],["طلبات مفعّلة",s.paid||0],["مشتركين شهري فعّالين",s.monthly||0],["طلاب بدأوا الدروس",s.students||0],["مجموع المبيعات",money(s.revenue||0)]].map(([a,b])=>`<div><span class="muted" style="font-size:12.5px">${a}</span><b>${b}</b></div>`).join("");
  }catch(e){$("aBody").innerHTML=`<p class="msg err">${esc(e.message)}</p>`;return}
  adminTab();
}
function adminTab(){
  const n=ADM.rows.filter(r=>r.status==="pending").length;
  const tabs=[["pending",`الطلبات الجديدة (${n})`,"payments"],["all","كل الطلبات","payments"],["access","🔑 صلاحيات الطلاب","payments"],["live","دروس الزوم","zoom"],["students","📚 طلابي","courses"],["certs","🎓 الشهادات","courses"],["inds","📈 طلبات المؤشرات","content"],["content","🌐 محتوى الموقع","content"],["settings","الإعدادات والأسعار","owner"]].filter(t=>t[2]==="owner"?isAdmin():canP(t[2]));
  if(!tabs.length){$("aTabs").innerHTML="";$("aBody").innerHTML=`<div class="empty">ما عندك صلاحيات بالأكاديمية. صلاحياتك بلوحة إدارة المنصة.</div>`;return}
  if(!tabs.some(t=>t[0]===ADM.tab))ADM.tab=tabs[0][0];
  $("aTabs").innerHTML=tabs.map(([k,t])=>`<button type="button" data-at="${k}" aria-selected="${ADM.tab===k}">${t}</button>`).join("");
  if(ADM.tab==="access")return adminAccess();
  if(ADM.tab==="live")return adminLive();
  if(ADM.tab==="students")return V8S.load();if(ADM.tab==="certs")return adminCerts();
  if(ADM.tab==="inds")return adminInds();
  if(ADM.tab==="settings")return adminSettings();
  if(ADM.tab==="content")return adminContent();
  const rows=ADM.tab==="pending"?ADM.rows.filter(r=>r.status==="pending"):ADM.rows;
  $("aBody").innerHTML=rows.length?`<div class="tbl"><table><thead><tr><th>العميل</th><th>الطلب</th><th>المبلغ</th><th>الدفع والملاحظات</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows.map(r=>{const c=r.course_id&&course(r.course_id);
    return`<tr><td><div class="mcell">${r.avatar_url?`<img class="av" src="${esc(r.avatar_url)}" alt="">`:`<span class="av">${esc((r.full_name||"؟")[0])}</span>`}<div><b>${esc(r.full_name||"—")}</b><span>${esc(r.email||"")}</span>${r.telegram?`<a href="https://t.me/${esc(r.telegram.replace(/^@/,""))}" target="_blank" rel="noopener" class="num" style="font-size:12px">${esc(r.telegram)}</a>`:""}</div></div></td>
      <td><b>${KIND[r.kind]||esc(r.kind)}</b>${c?`<div class="muted">${esc(c.title)}</div>`:""}${r.kind==="indicator"?`<div class="muted">${esc(r.item||"")}</div><div class="ltr" style="font-size:12.5px">TradingView: <b>${esc(r.tv_user||"")}</b></div>`:""}<div class="muted" style="font-size:12px">${new Date(r.created_at).toLocaleString(window.LANG||"ar")}</div></td>
      <td class="num">${money(r.amount,r.currency)}</td>
      <td style="font-size:13px;max-width:240px">${r.receipt_url?`<a href="${esc(r.receipt_url)}" target="_blank" rel="noopener"><img src="${esc(r.receipt_url)}" alt="صورة التحويل" style="max-width:120px;max-height:90px;border-radius:8px;display:block;margin-bottom:6px"></a>`:""}${r.verify_note?`<div class="chip ${/✓/.test(r.verify_note)?"up":"gold"}" style="margin-bottom:4px">${esc(r.verify_note)}</div><br>`:""}${r.pay_ref?`🧾 <a class="num" style="word-break:break-all" href="https://tronscan.org/#/transaction/${esc(r.pay_ref)}" target="_blank" rel="noopener">${esc(r.pay_ref.slice(0,18))}…</a><br>`:""}${r.preferred_time?`🕐 ${esc(r.preferred_time)}<br>`:""}${r.note?`📝 ${esc(r.note)}`:""}</td>
      <td><span class="chip ${ST[r.status][1]}">${ST[r.status][0]}</span>${r.kind==="zoom"&&r.session_at?`<div class="muted" style="font-size:12px">${fmtDate(r.session_at)}</div>`:""}</td>
      <td>${r.status==="pending"?`<div class="acts2">
        ${r.kind==="zoom"?`<input type="datetime-local" id="at-${r.id}" title="موعد الجلسة"><input class="ltr" id="zu-${r.id}" placeholder="رابط الزوم https://zoom.us/j/…">`:""}
        <button class="btn gold sm" type="button" data-pay="${r.id}">✓ تم الدفع، فعّل</button>
        <input id="rn-${r.id}" placeholder="سبب الرفض"><button class="btn sm" type="button" data-rej="${r.id}">رفض</button></div>`
        :r.status==="paid"&&r.kind==="zoom"?`<button class="btn sm" type="button" data-done="${r.id}">الجلسة انتهت</button>`:""}</td></tr>`}).join("")}</tbody></table></div>`
    :`<div class="empty">ما في طلبات هنا.</div>`;
}
async function adminAccess(force){
  if(!ADM.mem||force){$("aBody").innerHTML='<p class="muted">جاري التحميل…</p>';try{ADM.mem=await API.aMembers()||[]}catch(e){$("aBody").innerHTML=`<p class="msg err">${esc(e.message)}</p>`;return}}
  const q=(ADM.q||"").trim().toLowerCase(),MST={new:["غير مكتمل",""],pending:["قيد المراجعة","gold"],approved:["مفعّل","up"],rejected:["مرفوض","down"]};
  const list=ADM.mem.filter(m=>m.role!=="admin"&&(!q||[m.full_name,m.email,m.telegram,m.broker_account].some(x=>(x||"").toLowerCase().includes(q))));
  const copts=S.courses.map(c=>`<option value="c:${esc(c.id)}">${esc(c.icon)} ${esc(c.title)}</option>`).join("");
  const acc=a=>a.kind==="vip"||a.kind==="deposit"?`${a.kind==="deposit"?"🏦 VIP بالإيداع":"⭐ VIP"} · لحد <span class="num">${new Date(a.expires_at).toLocaleDateString(window.LANG||"ar")}</span>`:a.kind==="ai"?`🤖 اشتراك المساعد · لحد <span class="num">${new Date(a.expires_at).toLocaleDateString(window.LANG||"ar")}</span>`:a.kind==="monthly"?`⭐ كل الدورات · لحد <span class="num">${new Date(a.expires_at).toLocaleDateString(window.LANG||"ar")}</span>`:`${esc(course(a.course_id)?.icon||"📘")} ${esc(course(a.course_id)?.title||a.course_id)}`;
  $("aBody").innerHTML=`<div class="panel" style="margin-bottom:14px"><p class="muted" style="margin:0 0 10px">افتح لأي طالب VIP (قناة التوصيات والتوصيات المفتوحة والمؤشرات)، أو كل الدورات، أو دورة محددة، حتى لو ما مشترك وما دافع. الصلاحية تنفتح فوراً، ولما تخلص مدة VIP يطلع من القناة وحده.</p>
    <input id="accQ" placeholder="ابحث بالاسم أو الإيميل أو التيليجرام أو رقم الحساب" value="${esc(ADM.q||"")}" style="width:100%"></div>
    ${list.length?`<div class="tbl"><table><thead><tr><th>الطالب</th><th>الحالة</th><th>الصلاحيات الحالية</th><th>منح صلاحية</th></tr></thead><tbody>${list.map(m=>`<tr>
      <td><div class="mcell">${m.avatar_url?`<img class="av" src="${esc(m.avatar_url)}" alt="">`:`<span class="av">${esc((m.full_name||"؟")[0])}</span>`}<div><b>${esc(m.full_name||"—")}</b><span>${esc(m.email||"")}</span>${m.telegram?`<span class="num">${esc(m.telegram)}</span>`:""}</div></div></td>
      <td><span class="chip ${(MST[m.status]||MST.new)[1]}">${(MST[m.status]||MST.new)[0]}</span>${m.broker_account?`<div class="muted num" style="font-size:12px">${esc(m.broker_account)}</div>`:""}${m.invites?`<div class="chip gold" style="margin-top:4px">🎟 دعا ${m.invites}</div>`:""}${m.referred_by?`<div class="muted" style="font-size:12px">دعاه <span class="num">${esc(m.referred_by)}</span></div>`:""}</td>
      <td style="font-size:13px">${(m.access||[]).length?(m.access||[]).map(a=>`<div style="display:flex;gap:6px;align-items:center;margin:3px 0"><span>${acc(a)}</span><button class="btn sm" type="button" data-revoke="${a.id}" title="سحب الصلاحية">✕</button></div>`).join(""):'<span class="muted">—</span>'}</td>
      <td><div class="acts2"><select id="gw-${m.id}"><option value="vip">⭐ VIP: القناة والتوصيات والمؤشرات</option><option value="all">🎓 كل الدورات + الزوم</option><option value="ai">🤖 اشتراك المساعد</option>${copts}</select>
        <select id="gd-${m.id}" title="المدة"><option value="30">شهر</option><option value="7">أسبوع</option><option value="14">أسبوعين</option><option value="90">3 أشهر</option><option value="180">6 أشهر</option><option value="365">سنة</option><option value="0">دائم</option></select>
        <button class="btn gold sm" type="button" data-grant="${m.id}">🔑 منح</button></div></td></tr>`).join("")}</tbody></table></div>`
      :`<div class="empty">ما في طلاب بهذا البحث.</div>`}`;
  const qi=$("accQ");qi.oninput=()=>{ADM.q=qi.value;clearTimeout(ADM.qt);ADM.qt=setTimeout(()=>{adminAccess();const n=$("accQ");n.focus();n.setSelectionRange(n.value.length,n.value.length)},250)};
  list.forEach(m=>{const w=$("gw-"+m.id),d=$("gd-"+m.id);w.onchange=()=>{d.hidden=!["all","ai","vip"].includes(w.value)}});
}
function adminLive(){
  const opts=S.courses.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("");
  $("aBody").innerHTML=`<div class="panel" style="margin-bottom:14px"><h3 style="font-size:17px;margin-bottom:10px">➕ درس زوم جديد</h3>
    <form class="fm" id="sForm">
      <label>العنوان<input id="sTitle" required maxlength="120" placeholder="مثلاً: تحليل الذهب الأسبوعي بالموجات"></label>
      <label>الوصف<textarea id="sDesc" maxlength="500" placeholder="شنو راح نغطي بالدرس"></textarea></label>
      <div class="two"><label>الموعد (بتوقيتك)<input id="sAt" type="datetime-local" required></label><label>المدة بالدقائق<input id="sMin" type="number" min="15" max="300" value="60"></label></div>
      <div class="two"><label>من يقدر يحضر؟<select id="sAud"><option value="all">كل المسجّلين (مجاني)</option><option value="paid">المشتركين بس</option></select></label><label>الدورة المرتبطة<select id="sCourse"><option value="">—</option>${opts}</select></label></div>
      <label>رابط الزوم<input id="sUrl" class="ltr" placeholder="https://zoom.us/j/…" required></label>
      <button class="btn gold" type="submit">إضافة الدرس</button><p class="msg" id="sMsg"></p>
    </form></div>
    ${ADM.sess.length?`<div class="tbl"><table><thead><tr><th>الدرس</th><th>الموعد</th><th>الحضور</th><th>الرابط</th><th></th></tr></thead><tbody>${ADM.sess.map(s=>`<tr><td><b>${esc(s.title)}</b><div class="muted" style="font-size:12.5px">${esc(s.description||"")}</div></td><td>${fmtDate(s.starts_at)}<div class="muted">${s.minutes} دقيقة</div></td><td>${s.audience==="all"?"كل المسجّلين":"المشتركين"}</td><td><a class="num" href="${esc(s.zoom_url)}" target="_blank" rel="noopener" style="font-size:12px">${esc(s.zoom_url).slice(0,34)}</a></td><td><button class="btn sm" type="button" data-dels="${s.id}">حذف</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">ما في دروس زوم بعد.</div>`}`;
  $("sForm").onsubmit=async e=>{e.preventDefault();
    const f={title:$("sTitle").value.trim(),description:$("sDesc").value.trim(),starts_at:new Date($("sAt").value).toISOString(),minutes:+$("sMin").value||60,audience:$("sAud").value,course_id:$("sCourse").value||null,zoom_url:$("sUrl").value.trim()};
    try{await API.aAddSession(f);toast("✅ انضاف الدرس");ADM.sess=await API.aSessions();S.sessions=await API.sessions();adminLive()}catch(err){$("sMsg").className="msg err";$("sMsg").textContent=err.message}};
  v2AdminRec();
}
function adminSettings(){
  const I=S.info,f=(k,l,ph,ltr)=>`<label>${l}<input id="i-${k}" value="${esc(I[k]||"")}" ${ph?`placeholder="${esc(ph)}"`:""} ${ltr?'class="ltr"':""}></label>`;
  $("aBody").innerHTML=`<a class="paywall" href="app.html#settings" style="display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;margin-bottom:14px;padding:14px 18px;text-align:start"><span style="font-size:26px">⚙️</span><span style="flex:1"><b>صفحة إعدادات المنصة الكاملة</b><br><span class="muted" style="font-size:13px">المحفظة، كل الأسعار، رابط الوكالة، المساعد، الموزعين، ومعلومات الكوتش بمكان واحد.</span></span><span class="btn gold sm">افتح ←</span></a><div class="panel" style="margin-bottom:14px"><h3 style="font-size:17px;margin-bottom:10px">👤 معلومات الكوتش</h3>
    <div class="mini" style="margin-bottom:12px"><img src="${esc(photo())}" alt="" id="phPrev"><label class="btn sm" for="phFile">تغيير الصورة</label><input id="phFile" type="file" accept="image/*" hidden></div>
    <div class="fm">${f("coach_name","الاسم")}${f("coach_title","اللقب")}<label>النبذة<textarea id="i-coach_bio">${esc(I.coach_bio||"")}</textarea></label>
    <div class="two">${f("coach_tg","يوزر تيليجرام","omo_rabah",1)}${f("coach_channel","يوزر القناة","sbworldmodel",1)}</div>
    <div class="two">${f("coach_email","الإيميل العام","coach@example.com",1)}${f("coach_since","بالأسواق منذ سنة","2018",1)}</div></div></div>
    <div class="panel" style="margin-bottom:14px"><h3 style="font-size:17px;margin-bottom:10px">💵 الأسعار والدفع</h3>
    <div class="fm"><div class="two">${f("price_monthly","الاشتراك الشهري","99",1)}${f("price_zoom","ساعة الزوم الخاصة","50",1)}</div>
    <div class="two">${f("currency","العملة","$",1)}${f("free_lessons","عدد الدروس المجانية بكل دورة","1",1)}</div>
    <div class="two">${f("pay_wallet","عنوان محفظة USDT","T…",1)}${f("pay_network","الشبكة","TRC20",1)}</div>
    <label>طريقة الدفع (تطلع للعميل)<textarea id="i-pay_info">${esc(I.pay_info||"")}</textarea></label>
    <h4 style="margin:6px 0 0;color:var(--accent)">أسعار الدورات</h4>
    ${S.courses.map(c=>`<label>${esc(c.icon)} ${esc(c.title)}<input id="cp-${esc(c.id)}" class="ltr" type="number" min="0" value="${c.price}"></label>`).join("")}</div></div>
    <button class="btn gold" type="button" id="iSave">حفظ كل الإعدادات</button> <span class="msg" id="iMsg"></span>`;
  let blob=null;
  $("phFile").onchange=async e=>{const file=e.target.files[0];if(!file)return;blob=await squareJpeg(file,480);$("phPrev").src=URL.createObjectURL(blob)};
  $("iSave").onclick=async()=>{const b=$("iSave");b.disabled=true;$("iMsg").className="msg";$("iMsg").textContent="جاري الحفظ…";
    try{const o={};["coach_name","coach_title","coach_bio","coach_tg","coach_channel","coach_email","coach_since","price_monthly","price_zoom","currency","free_lessons","pay_info","pay_wallet","pay_network"].forEach(k=>o[k]=$("i-"+k).value.trim());
      o.coach_tg=o.coach_tg.replace(/^@/,"");o.coach_channel=o.coach_channel.replace(/^@/,"");
      if(blob)o.coach_photo=await API.aUpload(blob,"photo.jpg");
      await API.aSetInfo(o);for(const c of S.courses){const v=+$("cp-"+c.id).value;if(v!==+c.price)await API.aSetCourse(c.id,{price:v})}
      await loadAll();renderWho();$("iMsg").className="msg ok";$("iMsg").textContent="✓ انحفظ"}
    catch(err){$("iMsg").className="msg err";$("iMsg").textContent=err.message}b.disabled=false};
}
const CED={
  vx_coaches:{t:"👤 الكوتشات (بالصفحة الرئيسية)",f:[["name","الاسم"],["title","الوصف تحت الاسم"],["tg","يوزر تيليجرام",1],["photo","photo"]],d:()=>coaches(),n:{name:"",title:"",tg:"",photo:""}},
  vx_certs:{t:"🎓 الشهادات الدولية",f:[["flag","العلم (إيموجي)"],["country","الدولة"],["name","اسم الشهادة / الجهة"]],d:()=>vxCerts(),n:{flag:"🎓",country:"",name:""}},
  vx_indicators:{t:"📈 مؤشرات فيكسورا",f:[["name","اسم المؤشر"],["platform","المنصة (TradingView / MT5)"],["link","رابط التحميل (اختياري) — خليه فاضي إذا المؤشر بالدعوة على TradingView"],["desc","شنو يسوي المؤشر","ta"],["image","صورة المؤشر","img"],["video","فيديو الشرح والتفعيل","vid"],["price","السعر بالدولار (فاضي = مجاني)"],["period","مدة الاشتراك","per"]],d:()=>vxInds(),n:{name:"",platform:"TradingView",link:"",desc:"",image:"",video:"",price:"",period:"month"}},
  vx_contacts:{t:"🎧 الدعم والتواصل",f:[["type","النوع","sel"],["name","الاسم الظاهر"],["user","اليوزر أو رابط t.me",1],["photo","photo"]],d:()=>vxContacts(),n:{type:"channel",name:"",user:"",photo:""}}};
const CEDS={};
function adminContent(){
  Object.keys(CED).forEach(k=>{if(!CEDS[k])CEDS[k]=JSON.parse(JSON.stringify(CED[k].d()))});
  const inp=(k,i,[f,l,x],v)=>x==="ta"?`<label>${l}<textarea data-ck="${k}" data-ci="${i}" data-cf="${f}">${esc(v||"")}</textarea></label>`
    :x==="img"?`<div class="ced-media"><span class="muted" style="font-size:13px">${l}</span>${v?`<img src="${esc(v)}" alt="" class="ced-mimg">`:'<span class="ced-mph">🖼️ ماكو صورة</span>'}<label class="btn sm">${v?"تغيير الصورة":"رفع صورة"}<input type="file" accept="image/*" hidden data-cimg="${i}" data-cpk="${k}" data-cf="${f}"></label></div>`
    :x==="vid"?`<div class="ced-media"><span class="muted" style="font-size:13px">${l}</span>${v?(/\.(mp4|webm|mov)(\?|$)/i.test(v)||/\/storage\/v1\/object\/public\//.test(v)?`<video src="${esc(v)}" controls preload="metadata" class="ced-mimg"></video>`:`<a href="${esc(v)}" target="_blank" rel="noopener" class="ltr" style="font-size:12px;word-break:break-all">${esc(v)}</a>`):'<span class="ced-mph">🎬 ماكو فيديو</span>'}
      <label class="btn sm">${v?"تغيير الفيديو":"رفع فيديو من جهازك"}<input type="file" accept="video/mp4,video/webm,video/quicktime" hidden data-cvid="${i}" data-cpk="${k}" data-cf="${f}"></label>
      <label style="font-size:12px">أو الصق رابط YouTube<input class="ltr" data-ck="${k}" data-ci="${i}" data-cf="${f}" value="${/^https:\/\/(www\.)?(youtu|drive\.google)/i.test(v||"")?esc(v):""}" placeholder="https://youtu.be/…"></label>${v?`<button type="button" class="btn sm" data-cclr="${i}" data-cpk="${k}" data-cf="${f}">🗑 شيل الفيديو</button>`:""}</div>`
    :x==="per"?`<label>${l}<select data-ck="${k}" data-ci="${i}" data-cf="${f}">${[["month","شهري (30 يوم)"],["year","سنوي (365 يوم)"],["life","مدى الحياة"]].map(([a,b])=>`<option value="${a}"${(v||"month")===a?" selected":""}>${b}</option>`).join("")}</select></label>`
    :x==="sel"?`<label>${l}<select data-ck="${k}" data-ci="${i}" data-cf="${f}"><option value="channel"${v==="channel"?" selected":""}>📢 قناة</option><option value="coach"${v==="coach"?" selected":""}>👤 كوتش</option></select></label>`
    :f==="photo"?`<div class="ced-ph"><img src="${esc(v||VXP[tgU((CEDS[k][i]||{}).user||(CEDS[k][i]||{}).tg).toLowerCase()]||"logo-mark.png")}" alt=""><label class="btn sm">تغيير الصورة<input type="file" accept="image/*" hidden data-cph="${i}" data-cpk="${k}"></label></div>`
    :`<label>${l}<input data-ck="${k}" data-ci="${i}" data-cf="${f}" value="${esc(v||"")}"${x?' class="ltr"':""}></label>`;
  $("aBody").innerHTML=`<p class="muted" style="margin:0 0 12px">كل شي هنا يطلع بالصفحة الرئيسية وصفحة الكوتشات. القسم الفارغ ما يطلع بالموقع.</p>`+Object.entries(CED).map(([k,c])=>`<div class="panel" style="margin-bottom:14px"><h3 style="font-size:17px;margin-bottom:10px">${c.t}</h3><div class="ced">
    ${CEDS[k].map((r,i)=>`<div class="ced-row">${c.f.map(F=>inp(k,i,F,r[F[0]])).join("")}<button type="button" class="btn sm ced-x" data-cdel="${k}" data-ci="${i}">🗑 حذف</button></div>`).join("")||'<p class="muted" style="margin:0">ماكو شي بعد.</p>'}
    </div><button type="button" class="btn sm" style="margin-top:10px" data-cadd="${k}">+ إضافة</button></div>`).join("")
    +`<button class="btn gold" type="button" id="cSave">حفظ محتوى الموقع</button> <span class="msg" id="cMsg"></span>`;
  $("aBody").oninput=e=>{const t=e.target;if(t.dataset.ck)CEDS[t.dataset.ck][+t.dataset.ci][t.dataset.cf]=t.value};
  $("aBody").onchange=async e=>{const t=e.target;if(t.dataset.ck){CEDS[t.dataset.ck][+t.dataset.ci][t.dataset.cf]=t.value;return}
    if((t.dataset.cimg!==undefined||t.dataset.cvid!==undefined)&&t.files[0]){const f=t.files[0],vid=t.dataset.cvid!==undefined,i=+(vid?t.dataset.cvid:t.dataset.cimg);
      if(vid&&f.size>50*1024*1024){$("cMsg").className="msg err";$("cMsg").textContent=`حجم الفيديو ${Math.round(f.size/1048576)}MB. الحد 50MB، صغّره أو صوّره بدقة 720p`;$("cMsg").scrollIntoView({block:"center"});return}
      try{$("cMsg").className="msg";$("cMsg").textContent=vid?"⏳ جاري رفع الفيديو… لا تسكّر الصفحة":"جاري رفع الصورة…";$("cMsg").scrollIntoView({block:"center"});
        const blob=vid?f:await fitJpeg(f,1400),ext=vid?((f.name.match(/\.(mp4|webm|mov)$/i)||[,"mp4"])[1].toLowerCase()):"jpg";
        CEDS[t.dataset.cpk][i][t.dataset.cf]=await API.aMedia(blob,`ind/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`,vid?(f.type||"video/mp4"):"image/jpeg");
        adminContent();$("cMsg").className="msg ok";$("cMsg").textContent="✓ ارتفع. لا تنسى تضغط «حفظ محتوى الموقع»"}catch(err){$("cMsg").className="msg err";$("cMsg").textContent=err.message}return}
    if(t.dataset.cph!==undefined&&t.files[0]){const i=+t.dataset.cph;try{$("cMsg").className="msg";$("cMsg").textContent="جاري رفع الصورة…";const blob=await fitJpeg(t.files[0],900);
      CEDS[t.dataset.cpk||"vx_coaches"][i].photo=await API.aUpload(blob,`vx-${Date.now()}.jpg`);$("cMsg").textContent="";adminContent()}catch(err){$("cMsg").className="msg err";$("cMsg").textContent=err.message}}};
  $("aBody").onclick=async e=>{const a=e.target.closest("[data-cadd]");if(a){CEDS[a.dataset.cadd].push({...CED[a.dataset.cadd].n});adminContent();return}
    const cl=e.target.closest("[data-cclr]");if(cl){CEDS[cl.dataset.cpk][+cl.dataset.cclr][cl.dataset.cf]="";adminContent();return}
    const d=e.target.closest("[data-cdel]");if(d){CEDS[d.dataset.cdel].splice(+d.dataset.ci,1);adminContent();return}
    if(e.target.id==="cSave"){const b=e.target;b.disabled=true;$("cMsg").className="msg";$("cMsg").textContent="جاري الحفظ…";
      try{const o={};Object.keys(CED).forEach(k=>o[k]=JSON.stringify(CEDS[k].filter(r=>Object.entries(r).some(([f,v])=>f!=="type"&&f!=="flag"&&f!=="platform"&&f!=="period"&&String(v||"").trim()))));
        await API.aSetInfo(o);await loadAll();Object.keys(CEDS).forEach(k=>delete CEDS[k]);adminContent();$("cMsg").className="msg ok";$("cMsg").textContent="✓ انحفظ وصار يطلع بالموقع"}
      catch(err){$("cMsg").className="msg err";$("cMsg").textContent=err.message;b.disabled=false}}};
}
async function fitJpeg(file,max){const url=URL.createObjectURL(file),img=new Image();await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(new Error("الملف مو صورة"));img.src=url});
  const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);return await new Promise(r=>c.toBlob(r,"image/jpeg",.88))}
async function squareJpeg(file,max){const url=URL.createObjectURL(file),img=new Image();await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(new Error("الملف مو صورة"));img.src=url});
  const s=Math.min(img.width,img.height),o=Math.min(max,s),c=document.createElement("canvas");c.width=c.height=o;
  c.getContext("2d").drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,o,o);return await new Promise(r=>c.toBlob(r,"image/jpeg",.9))}

function acBeat(){if(!S.user||document.hidden||!API.touch)return;API.touch("ac:"+location.hash.slice(1)).catch(()=>{})}
setInterval(acBeat,60000);addEventListener("hashchange",()=>setTimeout(acBeat,500));document.addEventListener("visibilitychange",()=>{if(!document.hidden)acBeat()});setTimeout(acBeat,2500);
/* ================= events & routing ================= */
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-buy]");if(b){e.preventDefault();openBuy(b.dataset.buy,b.dataset.course);return}
  if(e.target.closest("[data-close]")){$("dlg").close();return}
  const r=e.target.closest("[data-rsvp]");if(r){const id=+r.dataset.rsvp,on=!S.rsvp.has(id);r.disabled=true;try{await API.rsvp(id,on);on?S.rsvp.add(id):S.rsvp.delete(id);r.textContent=on?"✓ راح أذكّرك":"🔔 ذكّرني";toast(on?"✅ راح يوصلك تذكير قبل يوم وقبل ساعة":"تم إلغاء التذكير")}catch(err){toast(err.message)}r.disabled=false;return}
  const j=e.target.closest("[data-join]");if(j){j.disabled=true;try{const u=await API.link(+j.dataset.join);if(u)window.open(u,"_blank","noopener");else toast("الرابط مو متوفر إلك")}catch(err){toast(err.message)}j.disabled=false;return}
  const t=e.target.closest("[data-at]");if(t){ADM.tab=t.dataset.at;adminTab();return}
  const gr=e.target.closest("[data-grant]");if(gr){const id=gr.dataset.grant,w=$("gw-"+id).value,days=+$("gd-"+id).value;gr.disabled=true;
    try{if(w==="all"||w==="ai"||w==="vip")await API.aGrant(id,w,null,days);else await API.aGrant(id,"course",w.slice(2));toast("✅ انفتحت الصلاحية للطالب");await adminAccess(true)}catch(err){toast(err.message);gr.disabled=false}return}
  const rv=e.target.closest("[data-revoke]");if(rv){if(!confirm("تسحب هذي الصلاحية من الطالب؟"))return;try{await API.aRevoke(+rv.dataset.revoke);toast("تم سحب الصلاحية");await adminAccess(true)}catch(err){toast(err.message)}return}
  const pay=e.target.closest("button[data-pay]");if(pay){const id=+pay.dataset.pay,r=ADM.rows.find(x=>x.id===id),f={status:"paid"};
    if(r.kind==="zoom"){const at=$("at-"+id).value,zu=$("zu-"+id).value.trim();if(!at){$("at-"+id).focus();toast("حدد موعد الجلسة");return}f.session_at=new Date(at).toISOString();f.zoom_url=zu}
    pay.disabled=true;try{await API.aSetPurchase(id,f);toast("✅ تفعّل ووصل العميل إيميل");adminPage()}catch(err){toast(err.message);pay.disabled=false}return}
  const rej=e.target.closest("button[data-rej]");if(rej){const id=+rej.dataset.rej;try{await API.aSetPurchase(id,{status:"rejected",admin_note:$("rn-"+id).value.trim()});adminPage()}catch(err){toast(err.message)}return}
  const dn=e.target.closest("button[data-done]");if(dn){try{await API.aSetPurchase(+dn.dataset.done,{status:"done"});adminPage()}catch(err){toast(err.message)}return}
  const ds=e.target.closest("[data-dels]");if(ds){if(!confirm("تحذف هذا الدرس؟"))return;try{await API.aDelSession(+ds.dataset.dels);ADM.sess=await API.aSessions();S.sessions=await API.sessions();adminLive()}catch(err){toast(err.message)}return}
});
function render(){
  renderWho();
  const h=location.hash.slice(1);
  if(h.startsWith("course/"))return coursePage(decodeURIComponent(h.slice(7)));
  if(h.startsWith("lesson/"))return lessonPage(decodeURIComponent(h.slice(7)));
  if(h.startsWith("cert/"))return certPage(decodeURIComponent(h.slice(5)));
  if(h==="orders")return ordersPage();
  if(h==="buy-ai"){plansPage();setTimeout(()=>openBuy("ai"),60);return}
  if(h==="buy-vip"){plansPage();setTimeout(()=>openBuy("vip"),60);return}
  if(h==="deposit"){plansPage();setTimeout(()=>openBuy("deposit"),60);return}
  if(h==="courses")return coursesPage();
  if(h==="certs")return certsPage();
  if(h==="live")return livePage();
  if(h==="plans")return plansPage();
  if(h==="coach")return coachPage();
  if(h==="join")return joinPage();
  if(h==="tools")return toolsPage();
  if(h==="indicators")return indicatorsPage();
  if(h==="lab")return labPage();
  if(h==="mentor")return mentorPage();
  if(h==="admin")return adminPage();
  home();
}


/* ================= V7: ترجمة المحتوى + دعم البروكر + قناة الدورة ================= */
(function(){const lg=window.LANG||"ar";if(lg==="ar"||!API.rpc7)return;let TC=null,TL=null;
  const c0=API.courses.bind(API),l0=API.lessons.bind(API),b0=API.body.bind(API);
  API.courses=async()=>{const r=await c0();try{TC=TC||await API.rpc7("content_tr_get",{lg,kd:"course"})||{};(r||[]).forEach(c=>["title","subtitle","level"].forEach(f=>{const t=TC[c.id+"|"+f];if(t)c[f]=t}))}catch(e){}return r};
  API.lessons=async()=>{const r=await l0();try{TL=TL||await API.rpc7("content_tr_get",{lg,kd:"lesson"})||{};(r||[]).forEach(l=>["title","summary"].forEach(f=>{const t=TL[l.id+"|"+f];if(t)l[f]=t}))}catch(e){}return r};
  API.body=async id=>{const b=await b0(id);if(!b)return b;try{const t=await API.rpc7("lesson_body_tr",{lg,lid:id});if(t){if(t.body)b.body=t.body;const Q=t.quiz||{};
    if(Array.isArray(b.quiz))b.quiz=b.quiz.map((q,i)=>({...q,q:Q["q."+i]||q.q,why:Q["w."+i]||q.why,o:(q.o||[]).map((o,j)=>Q["o."+i+"."+j]||o)}))}}catch(e){}return b};
})();
const V7A={sup:null,
  async getSup(){if(V7A.sup)return V7A.sup;try{V7A.sup=API.rpc7?await API.rpc7("public_support",{}):(API.support?await API.support():null)}catch(e){V7A.sup=null}return V7A.sup},
  box(s){if(!s||(!s.tg&&!s.wa))return"";return`<div class="panel v7-sup"><b style="color:var(--accent)">🎧 دعم البروكر</b><p class="muted" style="margin:6px 0 10px">لأي مشكلة بحساب INFINOX: فتح حساب، إيداع، سحب، أو ربط MT5 — تواصل مباشرة:</p><div class="vx-sup">${s.tg?`<a class="tg" href="https://t.me/${encodeURIComponent(s.tg)}" target="_blank" rel="noopener">✈️ Telegram · @${esc(s.tg)}</a>`:""}${s.wa?`<a class="wa" href="https://wa.me/${encodeURIComponent(String(s.wa).replace(/[^0-9]/g,""))}" target="_blank" rel="noopener">🟢 WhatsApp · <bdi dir="ltr">${esc(s.wa)}</bdi></a>`:""}</div></div>`},
  async place(sel,where){const s=await V7A.getSup(),w=[...document.querySelectorAll(sel)].filter(x=>!x.hidden&&x.offsetParent!==null).pop();if(!w||!s||w.querySelector(".v7-sup"))return;const d=document.createElement("div");d.innerHTML=V7A.box(s);if(d.firstElementChild)(where==="top"?w.prepend(d.firstElementChild):w.append(d.firstElementChild))},
  async channel(id){if(!S.user||!ownsCourse(id)||!API.rpc7)return;let L=[];try{L=await API.rpc7("my_course_channels",{})||[]}catch(e){return}const x=L.find(y=>y.course_id===id);if(!x)return;
    const host=document.querySelector("#view .lessons");if(!host||document.getElementById("v7Ch"))return;const d=document.createElement("div");d.id="v7Ch";d.className="panel";d.style.margin="0 0 14px";
    d.innerHTML=`<b style="color:var(--accent)">✈️ قناة الدورة على تيليجرام</b><p class="muted" style="margin:6px 0 10px">قناة خاصة لطلاب هذي الدورة. البوت يسويلك رابط دخول لمرة وحدة${x.link?"":" — اطلبه من هنا، ويوصلك بالإشعارات وعلى تيليجرام إذا حسابك مربوط"}.</p>
      ${x.link?`<a class="btn primary" href="${esc(x.link)}" target="_blank" rel="noopener">انضم للقناة ←</a> `:""}<button class="btn" type="button" id="v7ChReq">${x.link?"رابط جديد":"اطلب رابط الدخول"}</button>`;
    host.parentNode.insertBefore(d,host);
    document.getElementById("v7ChReq").onclick=async()=>{try{const r=await API.rpc7("course_tg_request",{cid:id});toast(r==="WAIT"?"طلبت رابط قبل شوية — استنى 10 دقايق":"✅ انطلب الرابط — يوصلك خلال دقيقة")}catch(e){toast(String(e.message||e))}}}
};
(function(){const w=(n,after)=>{const f=window[n]||eval(n);return function(){const r=f.apply(this,arguments);try{after.apply(this,arguments)}catch(e){}return r}};
  coursePage=w("coursePage",id=>{V7A.channel(id);V7A.place("#view .wrap","end")});
  home=w("home",()=>V7A.place("#view .wrap","end"));
  ordersPage=w("ordersPage",()=>V7A.place("#view .wrap","end"));
  joinPage=w("joinPage",()=>V7A.place("#view .wrap","end"));
  plansPage=w("plansPage",()=>V7A.place("#view .wrap","end"));
})();


/* ================= V8: الشهادة باختبار ويا الكوتش + موافقة الإدارة + تهاني الخريجين ================= */
const V8={pre:"",
  on(){return !!API.rpc7&&String((S.info||{}).cert_exam||"")==="1"},
  r(f,a){return API.rpc7(f,a||{})},
  err(e){return String(e&&e.message||e).replace(/^CERT_\w+:\s*/,"")},
  t(iso){try{return new Date(iso).toLocaleString(window.LANG&&window.LANG!=="ar"?window.LANG:"ar-IQ",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch(e){return iso}},
  left(iso){const ms=new Date(iso).getTime()-Date.now();if(ms<=0)return"";const h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4);return`${h}:${String(m).padStart(2,"0")}`},
  cn(g){return(window.LANG&&window.LANG!=="ar"&&g.course_en)||g.course},
  ring(p){p=Math.max(0,Math.min(100,+p||0));return`<span class="v8-ring" style="--p:${p}"><b class="num">${p}%</b></span>`},
  steps(r){const st=r.status==="issued"?5:r.exam_status==="passed"?4:r.exam_status==="scheduled"?3:2;
    const L=[["✓","خلصت الدروس"],["2","طلب الاختبار"],["3","الاختبار ويا الكوتش"],["4","موافقة الإدارة"],["5","الشهادة"]];
    return`<div class="v8-steps">${L.map(([n,t],i)=>`<div class="${i+1<st||st===5?"done":i+1===st?"cur":""}"><b>${i+1<st||st===5?"✓":n}</b><span>${t}</span></div>`).join("")}</div>`},
  async uploadImg(file,tag){const ext=(file.type||"").includes("png")?"png":"jpg";const code=`${tag}-${Date.now()}`;
    if(API.uploadImg)return API.uploadImg(file,code+"."+ext,file.type||"image/jpeg");return API.uploadCert(file,code)},
  async certBlob(ct){const cv=await drawCert(ct,new Date(ct.issued_at).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}),location.href.split("#")[0]+"#cert/"+ct.code);
    return await new Promise(r=>cv.toBlob(r,"image/png"))}
};

/* --- صندوق الشهادة داخل الدورة --- */
certBox=(function(f){return function(c,ls,done){if(!V8.on()||!S.user||!ls.length)return f.apply(this,arguments);
  if(S.certs.find(x=>x.course_id===c.id))return f.apply(this,arguments);
  if(done<ls.length)return`<div class="certbox"><span class="cb-ic">🎓</span><div><b>شهادة إتمام باسمك</b><small class="muted">كمّل كل الدروس: <bdi class="num" dir="ltr">${done}/${ls.length}</bdi><br>بعدها تطلب اختبار ويا الكوتش. إذا نجحت والإدارة وافقت، تطلعلك شهادة إتمام بالإنكليزي من أكاديمية فيكسورا برابط تحقق.</small></div></div>`;
  return`<div class="certbox go"><span class="cb-ic">🏆</span><div><b>خلصت الدورة 👏 قدّم على الشهادة</b><small class="muted">الخطوة الجاية اختبار عملي ويا الكوتش. إذا نجحت والإدارة وافقت تصدر شهادتك.</small>
    <div class="cb-f"><a class="btn gold sm" href="#certs" data-v8pre="${esc(c.id)}">📝 اطلب اختبار الشهادة</a></div></div></div>`}})(certBox);
document.addEventListener("click",e=>{const a=e.target.closest("[data-v8pre]");if(a)V8.pre=a.dataset.v8pre},true);

/* --- صفحة شهاداتي: طلب الاختبار + حالة الطلبات --- */
v2CertReq=(function(f){return async function(){if(!V8.on())return f.apply(this,arguments);const el=$("v2CertReq");if(!el)return;
  let L=[];try{L=await API.myCertRequests()||[]}catch(e){}
  const done=c=>{const ls=lessonsOf(c.id);return ls.length&&ls.every(l=>S.progress[l.id]!=null)};
  const open=id=>L.some(r=>r.course_id===id&&r.status==="open");
  const ok=S.courses.filter(c=>done(c)&&!S.certs.some(x=>x.course_id===c.id)&&!open(c.id));
  const guess=(S.profile&&S.profile.full_name||"").trim();
  const ST=r=>r.status==="issued"?["✅ صدرت","up"]:r.status==="rejected"?(r.exam_status==="failed"?["📘 ما نجحت هالمرة","down"]:["✏️ ما انوافق عليها","down"])
    :r.exam_status==="passed"?["⏳ نجحت · تنتظر موافقة الإدارة","gold"]:r.exam_status==="scheduled"?["📅 الاختبار محدد","blue"]:r.exam_status==="requested"?["⏳ ينتظر موعد من الكوتش","gold"]:["⏳ قيد المراجعة","gold"];
  const row=r=>{const c=course(r.course_id)||{},[t,k]=ST(r);return`<div class="v8-req"><div class="v8-rh"><b>${esc(c.title||r.course_id)}</b><span class="chip ${k}">${t}</span></div>
    ${r.exam_status&&r.status!=="rejected"?V8.steps(r):""}
    ${r.exam_status==="scheduled"&&r.exam_at?`<div class="v8-when">📅 موعد اختبارك: <b>${esc(V8.t(r.exam_at))}</b>${r.exam_link?` · <a href="${esc(r.exam_link)}" target="_blank" rel="noopener">رابط الاختبار ←</a>`:""}</div>`:""}
    ${r.exam_score!=null&&r.exam_status!=="requested"&&r.exam_status!=="scheduled"?`<div class="muted" style="font-size:13.5px">نتيجة الاختبار: <b class="num">${r.exam_score}%</b></div>`:""}
    ${r.status==="rejected"&&r.admin_note?`<div class="muted" style="font-size:13.5px">${esc(r.admin_note)}${r.exam_status==="failed"?" · تكدر تراجع الدروس وتطلب اختبار جديد.":""}</div>`:""}
    ${r.status==="issued"&&r.cert_code?`<a class="btn gold sm" href="#cert/${esc(r.cert_code)}">اعرض الشهادة</a>`:""}
    ${r.exam_status?`<label class="v8-cons"><input type="checkbox" data-v8cons="${r.id}" ${r.consent?"checked":""}> أوافق تنشر المنصة اسمي وشهادتي ونسبتي وتحليلي${r.pub_status==="published"?" <span class=\"chip up\">منشورة</span>":""}</label>`:""}</div>`};
  el.innerHTML=`<div class="v2a-card"><h2 style="margin:0 0 6px;font-size:20px">🎓 قدّم على الشهادة</h2>
    <p class="muted" style="margin:0 0 6px;font-size:14px">الشهادة صارت باختبار عملي ويا الكوتش: تخلص كل دروس الدورة ← تطلب الاختبار ← الكوتش يحدد موعد ويختبرك ← إذا نجحت، الإدارة توافق وتصدر شهادتك وتوصلك على الإيميل.</p>
    ${ok.length?`<form class="fm" id="v8F" style="max-width:720px;margin-top:12px">
      <label>الدورة<select id="v8C">${ok.map(c=>`<option value="${esc(c.id)}"${c.id===V8.pre?" selected":""}>${esc(c.title)}</option>`).join("")}</select></label>
      <label>الاسم بالإنكليزي (مثل ما يطلع على الشهادة)<input id="v8N" class="ltr" dir="ltr" maxlength="60" placeholder="Ahmed Ali Hassan" required value="${EN_NAME.test(guess)?esc(guess):""}"></label>
      <label>إيميلك<input id="v8E" class="ltr" dir="ltr" type="email" maxlength="120" required value="${esc(S.user.email||"")}"></label>
      <label>الأوقات اللي تناسبك للاختبار<input id="v8T" maxlength="200" placeholder="مثلاً: المسا من 7 لـ 10، الأحد إلى الخميس"></label>
      <label class="v8-cons big"><input type="checkbox" id="v8K" checked> <span>أوافق تنشر المنصة اسمي وشهادتي ونسبة نجاحي وتحليلي بالأكاديمية وقناة الأخبار إذا نجحت. <small class="muted">(تكدر تشيل الصح، وتكدر تغيره بعدين)</small></span></label>
      <button class="btn gold" type="submit">📨 اطلب الاختبار</button><p class="msg" id="v8M"></p></form>`
     :`<div class="empty" style="margin-top:10px">${L.some(r=>r.status==="open")?"طلبك وصل، تابع حالته هنا.":"خلّص كل دروس دورة حتى تكدر تطلب اختبار الشهادة."}</div>`}
    ${L.length?`<h3 style="margin:20px 0 10px;font-size:16px">طلباتك</h3><div class="v8-reqs">${L.map(row).join("")}</div>`:""}</div>`;
  const F=$("v8F");if(F)F.onsubmit=async e=>{e.preventDefault();const M=$("v8M"),n=$("v8N").value.trim().replace(/\s+/g," "),m=$("v8E").value.trim();
    if(!EN_NAME.test(n)||n.split(" ").length<2){M.className="msg err";M.textContent="اكتب اسمك الكامل بالحروف الإنكليزية (الاسم واسم الأب على الأقل)";return}
    const b=F.querySelector("button");b.disabled=true;
    try{await API.certRequest({course_id:$("v8C").value,en_name:n,email:m,note:"",pref_times:$("v8T").value.trim(),consent:$("v8K").checked});V8.pre="";M.className="msg ok";M.textContent="✓ وصل طلبك. يوصلك إشعار بموعد الاختبار.";setTimeout(v2CertReq,1000)}
    catch(err){b.disabled=false;M.className="msg err";M.textContent=V8.err(err)}};
  el.querySelectorAll("[data-v8cons]").forEach(x=>x.onchange=async()=>{try{await V8.r("my_cert_consent",{rid:+x.dataset.v8cons,ok:x.checked});toast(x.checked?"✓ انحفظت موافقتك":"✓ ما راح ينشر شي، وإذا كان منشور انشال")}catch(e){x.checked=!x.checked;toast(V8.err(e))}});
}})(v2CertReq);

/* --- إدارة الأكاديمية ← الشهادات: الكوتش والإدارة --- */
const V8A={Q:null,
  async load(){$("aBody").innerHTML='<p class="muted">جاري التحميل…</p>';try{V8A.Q=await V8.r("cert_queue")}catch(e){V8A.Q=null}
    if(!V8A.Q)return V8A.old();V8A.draw()},
  old:null,
  draw(){const Q=V8A.Q,R=Q.rows||[],adm=Q.admin;
    const appr=R.filter(r=>r.status==="open"&&r.exam_status==="passed"),pub=R.filter(r=>r.pub_status==="pending"&&r.status==="issued");
    const exam=R.filter(r=>r.status==="open"&&(r.exam_status==="requested"||r.exam_status==="scheduled"));
    const live=R.filter(r=>r.pub_status==="published"),legacy=R.filter(r=>r.status==="open"&&!r.exam_status);
    const hist=R.filter(r=>!appr.includes(r)&&!pub.includes(r)&&!exam.includes(r)&&!live.includes(r)&&!legacy.includes(r));
    const who=r=>`<b>${esc(r.full_name||"—")}</b> <span class="ltr muted" dir="ltr">(${esc(r.en_name)})</span><div class="muted" style="font-size:12.5px">${esc(r.course_title)}${r.telegram?` · <span class="ltr" dir="ltr">${esc(r.telegram)}</span>`:""}</div>`;
    const prog=r=>r.lessons_total?`<span class="chip">📚 ${r.lessons_done}/${r.lessons_total}</span> <span class="chip">📝 معدل الاختبارات ${r.quiz_avg}%</span>`:"";
    const sec=(t,n,body)=>`<div class="v8-sec"><h3>${t} <span class="chip gold">${n}</span></h3>${body}</div>`;
    let h=`<p class="muted" style="font-size:13.5px">الطالب يخلص الدروس ويطلب اختبار ← الكوتش يحدد موعد ويسجل النتيجة والتحليل ← ${adm?"إنت توافق على الشهادة ← وبعدها توافق على النشر":"الإدارة توافق وتنشر"}.</p>`;
    if(adm&&!Q.tg)h+=`<p class="msg err" style="font-size:13px">قناة الأخبار مو محددة بالإعدادات (news_chat)، فالنشر بتيليجرام يتخطى لحد ما تحددها.</p>`;
    if(adm)h+=`<details class="v8-card v8-ann"${V8A.pre?" open":""}><summary><b>📣 أعلن شهادة صادرة من قبل</b> <span class="muted" style="font-size:12.5px">للشهادات القديمة قبل نظام الاختبار</span></summary>
      <div class="v8-acts"><input class="ltr" dir="ltr" id="v8aC" placeholder="VX-XXXXXX" value="${esc(V8A.pre||"")}" style="max-width:200px"><input id="v8aT" maxlength="600" placeholder="ملخص التحليل أو كلمة عن الطالب (اختياري، ينشر)"></div>
      <label class="v8-cons"><input type="checkbox" id="v8aK"> الطالب موافق على نشر اسمه وشهادته ونسبته (يكدر يسحب موافقته من «شهاداتي» بأي وقت)</label>
      <div class="v8-acts"><button class="btn gold sm" id="v8aGo" type="button">➕ جهّزها للنشر</button></div></details>`;V8A.pre="";
    if(adm)h+=sec("✅ بانتظار موافقتك على الشهادة",appr.length,appr.length?appr.map(r=>`<div class="v8-card"><div class="v8-row">${V8.ring(r.exam_score)}<div style="flex:1">${who(r)}<div class="muted" style="font-size:13px;margin-top:4px">الكوتش: ${esc(r.coach_name||"—")} · ${prog(r)}</div>
      ${r.analysis_text?`<div class="v8-an">📈 ${esc(r.analysis_text)}</div>`:""}${r.coach_note?`<div class="muted" style="font-size:12.5px">📝 ${esc(r.coach_note)}</div>`:""}
      <div class="muted" style="font-size:12.5px">${r.consent?"✓ الطالب موافق على النشر":"✗ الطالب ما وافق على النشر (تنصدر بدون إعلان)"}</div></div>
      ${r.analysis_img?`<a href="${esc(r.analysis_img)}" target="_blank" rel="noopener"><img class="v8-th" src="${esc(r.analysis_img)}" alt="التحليل" loading="lazy"></a>`:""}</div>
      <div class="v8-acts"><input class="ltr" dir="ltr" id="v8n-${r.id}" value="${esc(r.en_name)}" title="الاسم على الشهادة"><button class="btn gold sm" data-v8ok="${r.id}">✅ أوافق وأصدر الشهادة</button><input id="v8w-${r.id}" placeholder="سبب الرفض (يوصل للطالب)"><button class="btn sm" data-v8no="${r.id}">✗ لا</button></div></div>`).join(""):'<div class="empty">ماكو شي ينتظرك.</div>');
    if(adm)h+=sec("📣 بانتظار موافقتك على النشر",pub.length,pub.length?pub.map(r=>`<div class="v8-card"><div class="v8-row"><img class="v8-cert" data-v8cv="${r.id}" alt="الشهادة"><div style="flex:1">${who(r)}<div style="margin:6px 0">${V8.ring(r.exam_score)}</div>
      <div class="v8-flags">${[["academy","تهنئة بالأكاديمية"],["tg","قناة الأخبار بتيليجرام"],["notify","إشعار لكل المستخدمين"],["banner","بانر بالرئيسية 24 ساعة"]].map(([k,t])=>`<label><input type="checkbox" data-v8f="${k}" data-r="${r.id}" checked> ${t}</label>`).join("")}</div></div></div>
      <div class="v8-acts"><button class="btn gold sm" data-v8pub="${r.id}">📣 انشر الآن</button><button class="btn sm" data-v8nopub="${r.id}">لا تنشر</button></div></div>`).join(""):'<div class="empty">ماكو شهادات تنتظر النشر.</div>');
    h+=sec("📝 طلبات الاختبار",exam.length,exam.length?exam.map(r=>{const mine=!r.coach_id||r.coach_id===Q.me||adm;return`<div class="v8-card"><div class="v8-row"><div style="flex:1">${who(r)}<div style="margin-top:6px">${prog(r)} ${r.exam_status==="scheduled"?`<span class="chip blue">📅 ${esc(V8.t(r.exam_at))}</span>`:`<span class="chip gold">⏳ ينتظر موعد</span>`}${r.coach_name?` <span class="chip">🧑‍🏫 ${esc(r.coach_name)}</span>`:""}</div>
      ${r.pref_times?`<div class="muted" style="font-size:13px;margin-top:6px">🕒 يناسبه: ${esc(r.pref_times)}</div>`:""}</div></div>
      ${mine?`<details class="v8-d"${r.exam_status==="requested"?" open":""}><summary>📅 ${r.exam_status==="scheduled"?"غيّر الموعد":"حدد موعد"}</summary><div class="v8-acts"><input type="datetime-local" id="v8at-${r.id}"><input class="ltr" dir="ltr" id="v8lk-${r.id}" placeholder="https://zoom.us/… (اختياري)" value="${esc(r.exam_link||"")}"><button class="btn sm" data-v8sch="${r.id}">حفظ وإشعار الطالب</button></div></details>
      <details class="v8-d"${r.exam_status==="scheduled"?" open":""}><summary>📝 سجّل النتيجة</summary><div class="v8-grade">
        <label>النسبة %<input type="number" min="0" max="100" id="v8sc-${r.id}" class="num" placeholder="${Q.min}+ للنجاح"></label>
        <label>تحليل الطالب (صورة الشارت)<input type="file" accept="image/png,image/jpeg,image/webp" id="v8im-${r.id}"></label>
        <label class="full">ملخص التحليل (ينشر ويا الشهادة)<textarea id="v8an-${r.id}" rows="3" maxlength="600"></textarea></label>
        <label class="full">ملاحظة (توصل للطالب والإدارة)<input id="v8nt-${r.id}" maxlength="400"></label>
        <div class="v8-acts full"><button class="btn gold sm" data-v8pass="${r.id}">✅ ناجح · ارفع للإدارة</button><button class="btn sm" data-v8fail="${r.id}">✗ ما نجح</button></div></div></details>`:`<div class="muted" style="font-size:12.5px">ويا كوتش ثاني.</div>`}</div>`}).join(""):'<div class="empty">ماكو طلبات اختبار.</div>');
    if(live.length)h+=sec("🏆 المنشورة",live.length,live.map(r=>`<div class="v8-card"><div class="v8-row"><div style="flex:1">${who(r)}<div class="muted" style="font-size:12.5px">${esc(V8.t(r.pub_at))}${r.pub_until&&new Date(r.pub_until)>new Date()?` · البانر ينتهي بعد ${V8.left(r.pub_until)}`:""}</div></div>${V8.ring(r.exam_score)}</div>
      ${adm?`<div class="v8-acts"><button class="btn sm" data-v8tg="${r.id}">📡 حالة تيليجرام</button><button class="btn sm" data-v8hide="${r.id}">شيل التهنئة والبانر</button></div>`:""}</div>`).join(""));
    if(legacy.length)h+=`<div id="v8Old"></div>`;
    if(hist.length)h+=sec("السجل",hist.length,`<div class="tbl"><table><thead><tr><th>الطالب</th><th>الدورة</th><th>النتيجة</th><th>الحالة</th></tr></thead><tbody>${hist.slice(0,60).map(r=>`<tr><td>${esc(r.full_name||r.en_name)}</td><td>${esc(r.course_title)}</td><td class="num">${r.exam_score!=null?r.exam_score+"%":"—"}</td><td>${r.status==="issued"?`<span class="chip up">✅ صدرت</span> <a class="num" href="#cert/${esc(r.cert_code)}">${esc(r.cert_code)}</a>${r.pub_status==="declined"?' <span class="chip">بدون نشر</span>':r.pub_status==="no_consent"?' <span class="chip">الطالب ما وافق على النشر</span>':r.pub_status==="hidden"?' <span class="chip">مشالة</span>':""}`:`<span class="chip down">${r.exam_status==="failed"?"ما نجح":"مرفوض"}</span> <span class="muted" style="font-size:12px">${esc(r.admin_note||"")}</span>`}</td></tr>`).join("")}</tbody></table></div>`);
    $("aBody").innerHTML=h;
    if(legacy.length&&V8A.old){const host=$("v8Old");host.innerHTML=`<div class="v8-sec"><h3>طلبات قديمة (قبل نظام الاختبار) <span class="chip gold">${legacy.length}</span></h3><button class="btn sm" id="v8OldB">اعرضها بالطريقة القديمة</button></div>`;$("v8OldB").onclick=()=>V8A.old()}
    pub.forEach(async r=>{const im=document.querySelector(`[data-v8cv="${r.id}"]`);if(!im||!r.cert)return;try{const b=await V8.certBlob(r.cert);im.src=URL.createObjectURL(b)}catch(e){}});
    $("aBody").onclick=V8A.click},
  async click(e){if(e.target.closest("#v8aGo")){const b=e.target.closest("#v8aGo");if(!$("v8aK").checked)return toast("أكّد إن الطالب موافق على النشر");b.disabled=true;
      try{await V8.r("admin_cert_announce",{cc:$("v8aC").value.trim(),analysis:$("v8aT").value.trim()});toast("✅ انضافت لـ «بانتظار موافقتك على النشر». راجعها واضغط انشر");V8A.load()}catch(err){b.disabled=false;toast(V8.err(err))}return}
const g=k=>{const b=e.target.closest(`[data-${k}]`);return b?[b,+b.dataset[k]]:null};let x;
    const busy=async(b,fn)=>{b.disabled=true;try{await fn()}catch(err){toast(V8.err(err))}finally{b.disabled=false}};
    if(x=g("v8sch"))return busy(x[0],async()=>{const v=$("v8at-"+x[1]).value;if(!v)throw new Error("اختار الموعد");await V8.r("coach_cert_schedule",{rid:x[1],at_ts:new Date(v).toISOString(),lnk:$("v8lk-"+x[1]).value.trim()});toast("✅ انحفظ الموعد ووصل إشعار للطالب");V8A.load()});
    if((x=g("v8pass"))||(x=g("v8fail"))){const ok=e.target.closest("[data-v8pass]")!=null,id=x[1],sc=parseInt($("v8sc-"+id).value,10);
      return busy(x[0],async()=>{if(!(sc>=0&&sc<=100))throw new Error("اكتب النسبة من 0 إلى 100");const f=$("v8im-"+id).files[0];let img="";
        if(f){if(f.size>6e6)throw new Error("الصورة أكبر من 6MB");img=await V8.uploadImg(f,"exam-"+id)}
        await V8.r("coach_cert_grade",{rid:id,ok,sc,analysis:$("v8an-"+id).value.trim(),img,cnote:$("v8nt-"+id).value.trim()});
        toast(ok?"✅ انرفعت النتيجة للإدارة":"انحفظت النتيجة ووصل إشعار للطالب");V8A.load()})}
    if(x=g("v8ok"))return busy(x[0],async()=>{const r=await V8.r("admin_cert_decide",{rid:x[1],ok:true,why:"",nm:$("v8n-"+x[1]).value.trim()});toast("✅ صدرت الشهادة "+r.code+(r.pub==="pending"?" · هسه وافق على النشر":""));V8A.load()});
    if(x=g("v8no"))return busy(x[0],async()=>{await V8.r("admin_cert_decide",{rid:x[1],ok:false,why:$("v8w-"+x[1]).value.trim(),nm:""});toast("انرفض ووصل إشعار للطالب");V8A.load()});
    if(x=g("v8nopub"))return busy(x[0],async()=>{await V8.r("admin_cert_publish",{rid:x[1],ok:false,img:"",flags:{}});toast("تمام، ما راح تنشر");V8A.load()});
    if(x=g("v8hide"))return busy(x[0],async()=>{await V8.r("admin_cert_unpublish",{rid:x[1]});toast("انشالت من الأكاديمية والرئيسية (منشور تيليجرام تمسحه من القناة)");V8A.load()});
    if(x=g("v8tg"))return busy(x[0],async()=>{const s=await V8.r("admin_cert_pub_status",{rid:x[1]});toast(s.state==="ok"?"✅ تيليجرام استلم المنشور":s.state==="waiting"?"⏳ بعده ينتظر رد تيليجرام":s.state==="none"?"ما انرسل لتيليجرام":"❌ تيليجرام رجّع خطأ "+(s.code||"")+" "+(s.body||""))});
    if(x=g("v8pub"))return busy(x[0],async()=>{const id=x[1],r=V8A.Q.rows.find(y=>y.id===id),flags={};document.querySelectorAll(`[data-v8f][data-r="${id}"]`).forEach(c=>flags[c.dataset.v8f]=c.checked);
      if(!Object.values(flags).some(Boolean))throw new Error("اختار مكان واحد على الأقل للنشر");
      let img="";if(r&&r.cert){const b=await V8.certBlob(r.cert);img=await API.uploadCert(b,r.cert.code)}
      const p=await V8.r("admin_cert_publish",{rid:id,ok:true,img,flags});
      toast(p.tg==="no_channel"?"✅ انشرت · تيليجرام: قناة الأخبار مو محددة":"✅ انشرت بالأكاديمية"+(flags.tg?" · جاري الإرسال لتيليجرام":""));
      if(p.tg==="sent")setTimeout(async()=>{try{const s=await V8.r("admin_cert_pub_status",{rid:id});toast(s.state==="ok"?"✅ تيليجرام: انشر بالقناة":s.state==="waiting"?"⏳ تيليجرام بعده ما رد، شوف «حالة تيليجرام» بعد شوية":"❌ تيليجرام: "+(s.body||s.code||"خطأ"))}catch(e){}},4500);
      V8A.load()})}
};
V8A.old=adminCerts;
adminCerts=function(){if(!V8.on())return V8A.old();return V8A.load()};

/* --- تهاني الخريجين + بانر الرئيسية --- */
const V8G={
  card(g,big){return`<article class="v8-post${big?" big":""}"><div class="v8-av">${esc((g.name||"?").trim()[0]||"?")}</div><div class="v8-pb"><div><b>مبروك <bdi>${esc(g.name)}</bdi> 🎉</b> <span class="muted">· ${esc(V8.t(g.pub_at))}</span></div>
    <div class="muted" style="margin:4px 0 10px">نجح باختبار <b style="color:var(--accent-2)">${esc(V8.cn(g))}</b>${g.coach?` <span>ويا</span> <bdi>${esc(g.coach)}</bdi>`:""} <span>بنسبة</span> <b style="color:var(--buy)" dir="ltr">${g.score}%</b></div>
    <div class="v8-media">${g.cert_img?`<a href="#cert/${esc(g.code)}"><img src="${esc(g.cert_img)}" alt="شهادة ${esc(g.name)}" loading="lazy"></a>`:`<a class="v8-noimg" href="#cert/${esc(g.code)}">🎓<span class="num">${esc(g.code)}</span></a>`}${g.analysis_img?`<a href="${esc(g.analysis_img)}" target="_blank" rel="noopener"><img src="${esc(g.analysis_img)}" alt="التحليل" loading="lazy"></a>`:""}
      ${g.analysis?`<blockquote>“${esc(g.analysis)}”</blockquote>`:""}</div>
    <a class="v8-ver" href="#cert/${esc(g.code)}">🔎 تحقق من الشهادة</a></div></article>`},
  async feed(n){try{return await V8.r("grads_feed",{lim:n||20})||[]}catch(e){return[]}},
  async page(){setNav("certs");$("view").innerHTML=pageHead("🏆 خريجين الأكاديمية","كل اللي نجحوا باختبار الكوتش ووافقوا ننشر إنجازهم. خلّص دوراتك واطلب اختبارك، ممكن تكون إنت الجاي 💪",`<a class="btn gold" href="#certs">🎓 قدّم على شهادتك</a>`)+`<section class="blk" style="padding-top:6px"><div class="wrap" id="v8Feed"><p class="muted">جاري التحميل…</p></div></section>`;
    const L=await V8G.feed(40),el=$("v8Feed");if(!el)return;el.innerHTML=L.length?L.map(g=>V8G.card(g,true)).join(""):`<div class="empty">بعد ماكو خريجين منشورين. أول واحد ينجح ويوافق ينشر هنا 🎓</div>`},
  async strip(){const host=document.querySelector("#view .hero");if(!host||document.getElementById("v8Strip"))return;const L=await V8G.feed(3);if(!L.length)return;
    const s=document.createElement("section");s.className="blk";s.id="v8Strip";s.innerHTML=`<div class="wrap"><div class="sh"><div><h2>🏆 آخر الخريجين</h2><p>نجحوا باختبار الكوتش وأخذوا شهادتهم.</p></div><a class="btn" href="#grads">كل الخريجين ←</a></div>${L.map(g=>V8G.card(g)).join("")}</div>`;host.after(s)},
  async banner(){const v=$("view");if(!v||document.getElementById("v8Ban"))return;let b=null;try{b=await V8.r("grad_banner")}catch(e){}
    if(!b||!b.pub_until||new Date(b.pub_until)<=new Date())return;try{if(localStorage.getItem("v8ban")===String(b.id))return}catch(e){}
    if(location.hash.slice(1)!==""&&location.hash!=="#")return;
    const d=document.createElement("div");d.className="wrap";d.id="v8Ban";d.style.paddingTop="14px";d.innerHTML=V8G.ban(b);v.prepend(d);V8G.wire(d,b)},
  ban(b){return`<div class="v8-ban"><span class="v8-bi">🎓</span><div class="v8-bt"><b><span>مبروك لـ</span> <bdi>${esc(b.name)}</bdi><span>! نجح بشهادة</span> <bdi>${esc(V8.cn(b))}</bdi> <span>بنسبة</span> <span style="color:var(--buy)" dir="ltr">${b.score}%</span></b><small class="muted">خلّص دوراتك واطلب اختبارك ويا الكوتش، ممكن تكون إنت الجاي 💪</small></div>${V8.ring(b.score)}<a class="btn gold sm" href="#cert/${esc(b.code)}">شوف الشهادة</a><button type="button" class="v8-x" aria-label="إغلاق">×</button></div>`},
  wire(d,b){d.querySelector(".v8-x").onclick=()=>{try{localStorage.setItem("v8ban",String(b.id))}catch(e){}d.remove()}}
};
(function(){const w=(f,after)=>function(){const r=f.apply(this,arguments);try{after.apply(this,arguments)}catch(e){}return r};
  home=w(home,()=>{if(!API.rpc7)return;V8G.banner();V8G.strip()});
  render=(function(f){return function(){const h=location.hash.slice(1);if(h==="grads"&&API.rpc7){renderWho();return V8G.page()}if(h==="admin/certs"){ADM.tab="certs";renderWho();return adminPage()}return f.apply(this,arguments)}})(render);
  certsPage=w(certsPage,()=>{if(!V8.on())return;const ph=document.querySelector("#view .phead");if(ph&&!ph.querySelector(".v8-gl")){const a=document.createElement("a");a.className="btn v8-gl";a.href="#grads";a.textContent="🏆 خريجين الأكاديمية";ph.append(a)}
    const p=document.querySelector("#view .phead p");if(p)p.textContent="خلّص كل دروس الدورة واطلب اختبار ويا الكوتش. إذا نجحت والإدارة وافقت، تطلعلك شهادة إتمام بالإنكليزي باسمك، برقم و QR للتحقق، وتوصلك على الإيميل."});
})();
window.__V8=V8;

/* ================= V8b: صفحة «طلابي» — تقدم كل طالب بكل دورة ================= */
const V8S={
  async journal(uid){let d;try{d=await V8.r("coach_journal",{uid})}catch(err){toast(V8.err(err));return}
    const T=(d&&d.trades)||[],c=(d.settings&&d.settings.acct_ccy)||"USD",cl=T.filter(t=>t.pnl!=null),w=cl.filter(t=>+t.pnl>0).length,net=cl.reduce((a,t)=>a+ +t.pnl,0),pl=cl.filter(t=>t.followed_plan!=null),ns=T.filter(t=>t.sl==null).length;
    const ov=document.createElement("div");ov.className="v8s-jov";ov.innerHTML=`<div class="v8s-jbox" role="dialog" aria-modal="true"><div class="v8s-jh"><b>📒 دفتر تداول الطالب</b><button type="button" class="btn sm" data-x>إغلاق</button></div>
      <div class="v8s-jk"><div><span>صفقات مسكّرة</span><b>${cl.length}</b></div><div><span>نسبة النجاح</span><b>${cl.length?Math.round(w/cl.length*100)+"%":"—"}</b></div><div><span>الصافي</span><b dir="ltr" class="${net>=0?"up":"down"}">${net.toFixed(2)} ${esc(c)}</b></div><div><span>الالتزام بالخطة</span><b>${pl.length?Math.round(pl.filter(t=>t.followed_plan).length/pl.length*100)+"%":"—"}</b></div><div><span>بدون وقف</span><b class="${ns?"down":""}">${ns}</b></div></div>
      <div class="v8s-jt"><table><thead><tr><th>التاريخ</th><th>الأصل</th><th>الصافي</th><th>R</th><th>الاستراتيجية</th><th>الشعور</th><th>الخطة</th><th>سبب الدخول</th></tr></thead><tbody>${T.slice(0,100).map(t=>`<tr><td dir="ltr">${esc(String(t.opened_at||"").slice(0,16).replace("T"," "))}</td><td dir="ltr">${t.side==="buy"?"▲":"▼"} ${esc(t.sym)}</td><td dir="ltr" class="${+t.pnl>0?"up":+t.pnl<0?"down":""}">${t.pnl==null?"مفتوحة":(+t.pnl).toFixed(2)}</td><td dir="ltr">${t.r_mult==null?"—":(+t.r_mult).toFixed(2)}</td><td data-noi18n>${esc(t.strategy||"—")}</td><td>${esc(t.emotion||"—")}</td><td>${t.followed_plan==null?"—":t.followed_plan?"✓":"✗"}</td><td data-noi18n>${esc((t.reason_in||"").slice(0,80))}</td></tr>`).join("")||'<tr><td colspan="8">ما أكو صفقات.</td></tr>'}</tbody></table></div>
      <p class="v8s-jn">الطالب وافق على مشاركة دفتره. الصور الخاصة ما تنعرض، وكل فتح للدفتر ينسجل بسجل الإدارة.</p></div>`;
    document.body.appendChild(ov);ov.addEventListener("click",e=>{if(e.target===ov||e.target.closest("[data-x]"))ov.remove()})},D:null,q:"",c:"",f:"all",n:100,
  ago(iso){if(!iso)return"—";const m=(Date.now()-new Date(iso).getTime())/6e4;if(m<60)return"قبل شوية";const h=m/60;if(h<24)return`قبل ${Math.round(h)} ساعة`;const d=Math.round(h/24);return d===1?"أمس":`قبل ${d} يوم`},
  days(iso){return iso?Math.floor((Date.now()-new Date(iso).getTime())/864e5):999},
  st(r){const q=r.req||{},open=q.status==="open";
    if(r.cert)return["cert","g",`✅ أخذ الشهادة <span class="num">${esc(r.cert)}</span>`];
    if(open&&q.exam==="scheduled")return["wait","b",`📅 اختبار ${esc(V8.t(q.at))}`];
    if(open&&q.exam==="passed")return["wait","b",`⏳ نجح <span class="num">${q.score}%</span> · ينتظر موافقتك`];
    if(open)return["wait","y","⏳ طلب اختبار"];
    if(r.total&&r.done>=r.total)return["ready","y",q.exam==="failed"?"🔁 ما نجح · يكدر يعيد":"🏁 خلص · ما طلب الاختبار"];
    if(!r.done)return["new","n","🆕 ما بدأ"];
    const d=V8S.days(r.last);if(d>=14)return["stall","r",`⏸ متوقف ${d} يوم`];
    return["learn","n","📖 يتعلم"]},
  async load(){$("aBody").innerHTML='<p class="muted">جاري التحميل…</p>';try{V8S.D=await V8.r("academy_students")}catch(e){$("aBody").innerHTML=`<p class="msg err">${esc(V8.err(e))} (شغّل vexora_v8b.sql)</p>`;return}V8S.draw()},
  draw(){const R=(V8S.D.rows||[]).map(r=>({...r,s:V8S.st(r)})),U=new Set(R.map(r=>r.uid));
    const act=new Set(R.filter(r=>V8S.days(r.last)<=7||V8S.days(r.seen)<=7).map(r=>r.uid));
    const k=t=>R.filter(r=>r.s[0]===t).length;
    const cs=[...new Map(R.map(r=>[r.cid,r.course])).entries()];
    const q=V8S.q.trim().toLowerCase();
    const L=R.filter(r=>(!V8S.c||r.cid===V8S.c)&&(V8S.f==="all"||r.s[0]===V8S.f)&&(!q||[r.name,r.email,r.tg].some(x=>String(x||"").toLowerCase().includes(q))));
    const F=[["all","الكل"],["ready","جاهز للاختبار"],["wait","بانتظار اختبار"],["stall","متوقف +14 يوم"],["cert","أخذ الشهادة"]];
    $("aBody").innerHTML=`<p class="muted" style="font-size:13.5px">تقدم كل طالب بكل دورة. البيانات حقيقية من المنصة وتتحدث كل ما تفتح الصفحة.</p>
    <div class="v8s-kp"><div><span>طلاب عندهم دروس</span><b class="num">${U.size}</b></div><div><span>نشطين آخر 7 أيام</span><b class="num">${act.size}</b></div><div><span>خلصوا دورة وما طلبوا الاختبار</span><b class="num">${k("ready")}</b></div><div><span>بانتظار اختبار</span><b class="num">${k("wait")}</b></div><div><span>أخذوا شهادة</span><b class="num">${k("cert")}</b></div></div>
    <div class="v8s-bar"><input id="v8sQ" type="search" placeholder="🔎 دوّر بالاسم أو الإيميل أو التيليجرام" value="${esc(V8S.q)}"><select id="v8sC"><option value="">كل الدورات</option>${cs.map(([i,t])=>`<option value="${esc(i)}"${i===V8S.c?" selected":""}>${esc(t)}</option>`).join("")}</select>
      <div class="v8s-ch">${F.map(([i,t])=>`<button type="button" data-v8sf="${i}" class="${V8S.f===i?"on":""}">${t}</button>`).join("")}</div></div>
    ${L.length?`<div class="tbl"><table class="v8s-t"><thead><tr><th>الطالب</th><th>الدورة</th><th>التقدم</th><th>معدل الاختبارات</th><th>الحالة</th><th>آخر نشاط</th><th></th></tr></thead><tbody>${L.slice(0,V8S.n).map(r=>{const p=r.total?Math.round(r.done/r.total*100):0,tg=String(r.tg||"").replace(/^@/,"");
      return`<tr><td><b>${esc(r.name||"—")}</b><div class="muted ltr" dir="ltr" style="font-size:12px">${tg?`<a href="https://t.me/${encodeURIComponent(tg)}" target="_blank" rel="noopener">@${esc(tg)}</a>`:esc(r.email||"")}</div></td>
        <td>${esc(r.course)}</td><td><span class="num">${r.done}/${r.total}</span><span class="v8s-pb"><i style="width:${p}%"></i></span></td>
        <td class="num">${r.avg!=null?r.avg+"%":"—"}</td><td><span class="chip ${r.s[1]==="g"?"up":r.s[1]==="r"?"down":r.s[1]==="b"?"blue":r.s[1]==="y"?"gold":""}">${r.s[2]}</span></td>
        <td class="muted" style="font-size:12.5px">${esc(V8S.ago(r.last||r.seen))}</td>
        <td>${r.s[0]==="wait"?`<a class="btn sm" href="#admin/certs" data-v8sgo="1">🎓 الطلب</a>`:r.s[0]==="cert"?(V8S.D.admin?`<a class="btn sm" href="#admin/certs" data-v8sann="${esc(r.cert)}">📣 أعلن</a>`:""):`<button class="btn sm" type="button" data-v8srm="${esc(r.uid)}|${esc(r.cid)}">🔔 ذكّره</button>`} <button class="btn sm" type="button" data-v8sjr="${esc(r.uid)}">📒 الدفتر</button></td></tr>`}).join("")}</tbody></table></div>
      ${L.length>V8S.n?`<button class="btn" type="button" id="v8sMore" style="margin-top:10px">اعرض أكثر (${L.length-V8S.n})</button>`:""}<p class="muted" style="font-size:12.5px;margin-top:8px">${L.length} صف</p>`
     :`<div class="empty">ماكو طلاب بهذا الفلتر.</div>`}`;
    const Q=$("v8sQ");Q.oninput=()=>{V8S.q=Q.value;clearTimeout(V8S.tm);V8S.tm=setTimeout(()=>{V8S.draw();const e=$("v8sQ");e.focus();e.setSelectionRange(e.value.length,e.value.length)},250)};
    $("v8sC").onchange=e=>{V8S.c=e.target.value;V8S.n=100;V8S.draw()};
    const M=$("v8sMore");if(M)M.onclick=()=>{V8S.n+=200;V8S.draw()};
    $("aBody").onclick=async e=>{const f=e.target.closest("[data-v8sf]");if(f){V8S.f=f.dataset.v8sf;V8S.n=100;return V8S.draw()}
      if(e.target.closest("[data-v8sgo]")){ADM.tab="certs"}
      const an=e.target.closest("[data-v8sann]");if(an){ADM.tab="certs";V8A.pre=an.dataset.v8sann}
      const jr=e.target.closest("[data-v8sjr]");if(jr){V8S.journal(jr.dataset.v8sjr);return}
      const b=e.target.closest("[data-v8srm]");if(b){const[u,c]=b.dataset.v8srm.split("|");b.disabled=true;try{const r=await V8.r("coach_remind",{uid:u,cid:c});toast(r==="exam"?"✅ وصله تذكير يطلب اختبار الشهادة":"✅ وصله تذكير يكمّل الدورة");b.textContent="✓ انذكّر"}catch(err){b.disabled=false;toast(V8.err(err))}}}}
};
render=(function(f){return function(){if(location.hash.slice(1)==="admin/students"){ADM.tab="students";renderWho();return adminPage()}return f.apply(this,arguments)}})(render);


/* ================= V12: فيديوهات الترحيب (التسجيل بالأكاديمية + فتح حساب INFINOX) ================= */
const VXI={K:"vx_intro_v1",
  V:{join:{src:"media/vexora-join.mp4",poster:"media/vexora-join.jpg",t:"شلون تنضم للأكاديمية"},broker:{src:"media/vexora-broker.mp4",poster:"media/vexora-broker.jpg",t:"شلون تفتح حساب INFINOX"}},
  seen(){try{return localStorage.getItem(VXI.K)==="1"}catch(e){return true}},
  mark(){try{localStorage.setItem(VXI.K,"1")}catch(e){}},
  open(tab){if(document.getElementById("vxiOv"))return;VXI.mark();const ov=document.createElement("div");ov.id="vxiOv";ov.className="vxi-ov";
    ov.innerHTML=`<div class="vxi-box" role="dialog" aria-modal="true" aria-label="فيديو تعريفي"><button type="button" class="vxi-x" aria-label="إغلاق">✕</button>
      <div class="vxi-tabs"><button type="button" data-v="join">🎓 التسجيل بالأكاديمية</button><button type="button" data-v="broker">🏦 فتح حساب INFINOX</button></div>
      <div class="vxi-vid"><video id="vxiV" playsinline muted preload="metadata"></video><button type="button" class="vxi-snd" id="vxiS">🔊 شغّل الصوت</button>
        <div class="vxi-end" id="vxiE" hidden></div></div>
      <div class="vxi-cta"><a class="btn gold" href="${CONFIG.IB}" target="_blank" rel="noopener">افتح حساب INFINOX</a><a class="btn" href="${CONFIG.SITE}#signup">سجّل بالموقع</a></div></div>`;
    document.body.appendChild(ov);document.body.style.overflow="hidden";
    const v=ov.querySelector("#vxiV"),snd=ov.querySelector("#vxiS"),end=ov.querySelector("#vxiE");
    const play=k=>{VXI.cur=k;ov.querySelectorAll(".vxi-tabs button").forEach(b=>b.classList.toggle("on",b.dataset.v===k));end.hidden=true;v.poster=VXI.V[k].poster;v.src=VXI.V[k].src;v.currentTime=0;const p=v.play();if(p&&p.catch)p.catch(()=>{v.controls=true})};
    const close=()=>{v.pause();ov.remove();document.body.style.overflow=""};
    ov.querySelector(".vxi-x").onclick=close;ov.addEventListener("click",e=>{if(e.target===ov)close()});document.addEventListener("keydown",function k(e){if(e.key==="Escape"){close();document.removeEventListener("keydown",k)}});
    ov.querySelectorAll(".vxi-tabs button").forEach(b=>b.onclick=()=>{play(b.dataset.v);if(!v.muted)snd.hidden=true});
    snd.onclick=()=>{v.muted=false;v.controls=true;snd.hidden=true;if(v.paused)v.play()};
    v.addEventListener("ended",()=>{end.hidden=false;end.innerHTML=VXI.cur==="join"?`<b>الخطوة الجاية</b><button type="button" class="btn gold" data-n="broker">▶️ شلون تفتح حساب INFINOX</button><button type="button" class="btn" data-n="join">↺ أعد التشغيل</button>`
        :`<b>جاهز تبدي؟</b><a class="btn gold" href="${CONFIG.IB}" target="_blank" rel="noopener">افتح حساب INFINOX</a><button type="button" class="btn" data-n="broker">↺ أعد التشغيل</button>`;
      end.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>play(b.dataset.n))});
    play(tab==="broker"?"broker":"join")},
  // يطلع تلقائياً مرة وحدة للزائر الجديد بس (مو للأعضاء، ومو بصفحات الدروس أو الإدارة)
  auto(){return;const h=location.hash.slice(1);if(S.user||VXI.seen()||/^(lesson|cert|admin|course)\//.test(h)||/bot|crawl|spider|lighthouse/i.test(navigator.userAgent))return;setTimeout(()=>{if(!S.user&&!document.getElementById("vxiOv"))VXI.open("join")},1400)},
  btn(tab,txt,cls){return`<button type="button" class="btn ${cls||""}" data-vxi="${tab}">${txt}</button>`}
};
document.addEventListener("click",e=>{const b=e.target.closest("[data-vxi]");if(b){e.preventDefault();VXI.open(b.dataset.vxi)}});
window.__VXI=VXI;

/* ================= V2 PREMIUM ================= */
// ===== المؤشرات بالدعوة: الطالب يطلب بيوزر TradingView، والإدارة تضيفه وتأكد =====
const IND={mine:null};
function v2IndVid(c){const u=String(c.video||"").trim();if(!/^https:\/\//i.test(u))return"";
  if(/\.(mp4|webm|mov)(\?|$)/i.test(u)||/\/storage\/v1\/object\/public\//.test(u))return`<div class="v2-vid"><video src="${esc(u)}" controls preload="metadata" playsinline${c.image?` poster="${esc(c.image)}"`:""}></video></div>`;
  const y=u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/),d=u.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  const src=y?`https://www.youtube-nocookie.com/embed/${y[1]}?rel=0`:d?`https://drive.google.com/file/d/${d[1]}/preview`:"";
  return src?`<div class="v2-vid"><iframe src="${esc(src)}" title="شرح ${esc(c.name||"")}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`
    :`<a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener" style="margin-bottom:8px">🎬 شاهد شرح المؤشر وطريقة تفعيله</a>`}
const IPER={month:"شهرياً",year:"سنوياً",life:"مدى الحياة"};
function v2IndPrice(c){const p=parseFloat(String(c.price||"").replace(/[^0-9.]/g,""))||0;return p}
function v2IndBtn(c){const nm=String(c.name||"");const pr=v2IndPrice(c);
  if(pr>0&&!(c.link&&/^https?:/i.test(c.link)))return`<div class="v2-ip"><b class="price">${money(pr)}</b><span class="muted"> ${IPER[c.period||"month"]||""}</span></div><span class="v2-ind" data-ind="${esc(nm)}"><button class="btn gold sm" type="button" data-indbuy="${esc(nm)}">💳 اشترك بالمؤشر</button></span>`;if(c.link&&/^https?:/i.test(c.link))return`<a class="btn gold sm" href="${esc(c.link)}" target="_blank" rel="noopener">📥 احصل على المؤشر</a>`;
  if(c.link&&!/^https?:/i.test(c.link)&&!API.indRequest)return`<a class="btn gold sm" href="https://t.me/${esc(tgU(c.link))}" target="_blank" rel="noopener">📥 احصل على المؤشر</a>`;
  return`<span class="v2-ind" data-ind="${esc(nm)}"><button class="btn gold sm" type="button" data-indreq="${esc(nm)}">📥 اطلب المؤشر</button></span>`}
async function v2IndState(){const els=document.querySelectorAll(".v2-ind[data-ind]");if(!els.length||!S.user||!API.myIndRequests)return;
  if(!IND.mine){try{IND.mine=await API.myIndRequests()||[]}catch(e){IND.mine=[]}}
  els.forEach(el=>{const r=IND.mine.find(x=>x.indicator===el.dataset.ind);if(!r)return;
    el.innerHTML=r.status==="done"?`<span class="chip up">✅ انضاف لحسابك (${esc(r.tv_user)})</span>${r.expires_at?`<small class="muted" style="display:block;margin-top:6px">ينتهي ${new Date(r.expires_at).toLocaleDateString(window.LANG||"ar")} · <a href="#" data-indbuy="${esc(el.dataset.ind)}">جدّد</a></small>`:""}<small class="muted" style="display:block;margin-top:6px">افتح TradingView ← Indicators ← Invite-only scripts</small>`
      :r.status==="open"?`<span class="chip gold">⏳ طلبك وصل، ننضيفك قريباً (${esc(r.tv_user)})</span>`
      :`<span class="chip down">ما تم: ${esc(r.admin_note||"راسل الدعم")}</span> <button class="btn sm" type="button" data-indreq="${esc(el.dataset.ind)}">اطلب مرة ثانية</button>`})}
document.addEventListener("click",e=>{const b=e.target.closest("[data-indbuy]");if(!b)return;e.preventDefault();openBuy("indicator",b.dataset.indbuy)});
document.addEventListener("click",async e=>{const b=e.target.closest("[data-indreq]");if(!b)return;const nm=b.dataset.indreq,box=b.closest(".v2-ind");
  if(!S.user){location.href=CONFIG.SITE+"#signup";return}
  if(!isMember()){toast("المؤشرات للأعضاء المفعّلين. فعّل حسابك أول");location.hash="join";return}
  const last=(IND.mine||[]).find(x=>x.tv_user);
  box.innerHTML=`<div class="v2a-t" style="margin-top:6px;display:grid;gap:8px"><span>اكتب يوزرك بـ TradingView حتى نضيفك على المؤشر</span>
    <input class="ltr" data-tvu maxlength="40" placeholder="TradingView username" value="${esc(last?last.tv_user:"")}" style="background:#141417;border:1px solid rgba(212,175,55,.3);border-radius:10px;padding:9px 12px;color:var(--fg);font:inherit">
    <small class="muted">تلكاه بـ TradingView: اضغط صورتك فوق ← يطلع اسمك تحت الصورة (بدون @).</small>
    <div style="display:flex;gap:6px"><button class="btn gold sm" type="button" data-indsend="${esc(nm)}">إرسال الطلب</button><button class="btn sm" type="button" data-indx>إلغاء</button></div></div>`;
  box.querySelector("[data-tvu]").focus()});
document.addEventListener("click",async e=>{const x=e.target.closest("[data-indx]");if(x){IND.mine=null;render();return}
  const s=e.target.closest("[data-indsend]");if(!s)return;const box=s.closest(".v2-ind"),u=box.querySelector("[data-tvu]").value.trim().replace(/^@/,"");
  if(!/^[A-Za-z0-9_.-]{2,40}$/.test(u))return toast("اكتب يوزر TradingView صحيح (حروف إنكليزية وأرقام)");s.disabled=true;
  try{await API.indRequest({indicator:s.dataset.indsend,tv_user:u});IND.mine=null;toast("✅ وصل طلبك. يوصلك إشعار أول ما ننضيفك");await v2IndState()}
  catch(err){s.disabled=false;toast(/duplicate|unique/i.test(err.message)?"عندك طلب مفتوح لهذا المؤشر":/row-level|policy/i.test(err.message)?"المؤشرات للأعضاء المفعّلين":err.message)}});
async function adminInds(){$("aBody").innerHTML='<p class="muted">جاري التحميل…</p>';let L=[];try{L=await API.aIndRequests()||[]}catch(e){$("aBody").innerHTML=`<p class="msg err">${esc(e.message)} (شغّل ملف indicators.sql)</p>`;return}
  $("aBody").innerHTML=`<ol class="muted" style="font-size:13.5px;line-height:1.9;margin:0 0 12px;padding-inline-start:20px"><li>انسخ يوزر الطالب بزر «📋 نسخ».</li><li>بـ TradingView افتح المؤشر، واضغط <bdi dir="ltr">Manage access</bdi>، وأضف اليوزر.</li><li>ارجع هنا واضغط «✅ تمت الإضافة»، والطالب يوصله إشعار.</li></ol>`+(L.length?`<div class="tbl"><table><thead><tr><th>العضو</th><th>المؤشر</th><th>يوزر TradingView</th><th>إجراء</th></tr></thead><tbody>${L.map(r=>`<tr>
    <td><b>${esc(r.full_name||"—")}</b>${r.telegram?`<div class="muted ltr" style="font-size:12px">${esc(r.telegram)}</div>`:""}<div class="muted" style="font-size:12px">${new Date(r.created_at).toLocaleString(window.LANG||"ar")}</div>${r.member_status!=="approved"?'<span class="chip down">مو مفعّل</span>':""}</td>
    <td>${esc(r.indicator)}</td><td><b class="ltr">${esc(r.tv_user)}</b> <button class="btn sm" type="button" data-cp="${esc(r.tv_user)}">📋 نسخ</button></td>
    <td>${r.status==="open"?`<div class="acts2"><button class="btn gold sm" type="button" data-ido="${r.id}">✅ تمت الإضافة</button><input id="ir-${r.id}" placeholder="سبب الرفض"><button class="btn sm" type="button" data-idx="${r.id}">رفض</button></div>`
      :r.status==="done"?(r.expires_at&&new Date(r.expires_at)<new Date()?`<span class="chip down">⏰ خلص الاشتراك</span><div class="muted" style="font-size:12px">شيله من TradingView</div><button class="btn sm" type="button" data-idrm="${r.id}">✓ شلته</button>`:`<span class="chip up">✅ انضاف</span>${r.expires_at?`<div class="muted" style="font-size:12px">ينتهي ${new Date(r.expires_at).toLocaleDateString(window.LANG||"ar")}</div>`:r.paid?"":'<div class="muted" style="font-size:12px">مجاني</div>'}`):`<span class="chip down">مرفوض</span><div class="muted" style="font-size:12px">${esc(r.admin_note)}</div>`}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">ما في طلبات مؤشرات.</div>');
  $("aBody").onclick=async e=>{const c=e.target.closest("[data-cp]");if(c){try{await navigator.clipboard.writeText(c.dataset.cp);toast("✓ انسخ")}catch(_){prompt("انسخ:",c.dataset.cp)}return}
    const rm=e.target.closest("[data-idrm]");if(rm){try{await API.aIndRemoved(+rm.dataset.idrm);toast("✓ انحفظ");adminInds()}catch(err){toast(err.message)}return}
    const o=e.target.closest("[data-ido]"),x=e.target.closest("[data-idx]");
    if(o){try{await API.aIndSet(+o.dataset.ido,true);toast("✅ انحفظ ووصل إشعار للطالب");adminInds()}catch(err){toast(err.message)}}
    if(x){try{await API.aIndSet(+x.dataset.idx,false,$("ir-"+x.dataset.idx).value.trim());toast("انرفض ووصل إشعار للطالب");adminInds()}catch(err){toast(err.message)}}}}

// ===== طلب الشهادة: الطالب يرسل بياناته وإيميله الرسمي، والإدارة تصدرها وترجعله بالإيميل =====
async function v2CertReq(){const el=$("v2CertReq");if(!el||!API.certRequest)return;let L=[];try{L=await API.myCertRequests()||[]}catch(e){}
  const ST={open:["⏳ قيد المراجعة","gold"],issued:["✅ صدرت","up"],rejected:["✏️ تحتاج تعديل","down"]};
  el.innerHTML=`<div class="v2a-card"><h2 style="margin:0 0 6px;font-size:20px">📨 اطلب شهادتك</h2><p class="muted" style="margin:0 0 14px;font-size:14px">اكتب اسمك بالإنكليزي مثل ما تريده يطلع على الشهادة، وإيميلك الرسمي. الإدارة تراجع الطلب وتصدر الشهادة وتوصلك على هذا الإيميل.</p>
    <form class="fm" id="v2CrF" style="max-width:620px"><label>الدورة<select id="v2CrC">${S.courses.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("")}</select></label>
      <label>الاسم بالإنكليزي (مثل ما يطلع على الشهادة)<input id="v2CrN" class="ltr" maxlength="60" placeholder="Ahmed Ali Hassan" required></label>
      <label>إيميلك الرسمي<input id="v2CrE" class="ltr" type="email" maxlength="120" placeholder="name@example.com" required value="${esc(S.user.email||"")}"></label>
      <label>ملاحظة (اختياري)<input id="v2CrT" maxlength="300"></label>
      <button class="btn gold" type="submit">إرسال الطلب</button><p class="msg" id="v2CrM"></p></form>
    ${L.length?`<div class="tbl" style="margin-top:14px"><table><thead><tr><th>الدورة</th><th>الاسم</th><th>الإيميل</th><th>الحالة</th></tr></thead><tbody>${L.map(r=>{const c=course(r.course_id),s=ST[r.status]||ST.open;return`<tr><td>${esc(c?c.title:r.course_id)}</td><td class="ltr">${esc(r.en_name)}</td><td class="ltr">${esc(r.email)}</td><td><span class="chip ${s[1]}">${s[0]}</span>${r.status==="issued"?` <a href="#cert/${esc(r.cert_code)}">عرض</a>`:""}${r.admin_note?`<div class="muted" style="font-size:12px">${esc(r.admin_note)}</div>`:""}</td></tr>`}).join("")}</tbody></table></div>`:""}</div>`;
  $("v2CrF").onsubmit=async e=>{e.preventDefault();const n=$("v2CrN").value.trim().replace(/\s+/g," "),m=$("v2CrE").value.trim(),M=$("v2CrM");
    if(!/^[A-Za-z][A-Za-z .'-]{1,58}[A-Za-z.]$/.test(n)){M.className="msg err";M.textContent="اكتب الاسم بالحروف الإنكليزية بس";return}
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)){M.className="msg err";M.textContent="اكتب إيميل صحيح";return}
    try{await API.certRequest({course_id:$("v2CrC").value,en_name:n,email:m,note:$("v2CrT").value.trim()});M.className="msg ok";M.textContent="✓ وصل طلبك للإدارة. توصلك الشهادة على الإيميل أول ما تصدر.";setTimeout(v2CertReq,1200)}
    catch(err){M.className="msg err";M.textContent=/row-level|policy/i.test(err.message)?"ما انرسل الطلب. تأكد من البيانات، وما تكدر ترسل أكثر من 3 طلبات مفتوحة":err.message}}}
async function adminCerts(){$("aBody").innerHTML='<p class="muted">جاري التحميل…</p>';let L=[];try{L=await API.aCertRequests()||[]}catch(e){$("aBody").innerHTML=`<p class="msg err">${esc(e.message)} (شغّل vexora_v2.sql)</p>`;return}
  const opts=id=>S.courses.map(c=>`<option value="${esc(c.id)}"${c.id===id?" selected":""}>${esc(c.title)}</option>`).join("");
  $("aBody").innerHTML=`<p class="muted" style="font-size:13.5px">كمّل بيانات الشهادة (الاسم، الدورة، المعدل) واضغط «أصدر وأرسل». الشهادة تنحفظ برقم و QR وتوصل للطالب على إيميله الرسمي، ويوصله إشعار بالمنصة.</p>`+(L.length?`<div class="tbl"><table><thead><tr><th>الطالب</th><th>بيانات الشهادة</th><th>التقدم بالدورة</th><th>إجراء</th></tr></thead><tbody>${L.map(r=>`<tr>
    <td><b>${esc(r.full_name||"—")}</b><div class="muted ltr" style="font-size:12.5px">${esc(r.email)}</div>${r.telegram?`<div class="muted ltr" style="font-size:12px">${esc(r.telegram)}</div>`:""}<div class="muted" style="font-size:12px">${new Date(r.created_at).toLocaleString(window.LANG||"ar")}</div>${r.note?`<div style="font-size:12.5px">📝 ${esc(r.note)}</div>`:""}</td>
    <td>${r.status==="open"?`<div class="acts2" style="display:grid;gap:6px;min-width:220px"><input class="ltr" id="cn-${r.id}" value="${esc(r.en_name)}" placeholder="Name in English"><select id="cc-${r.id}">${opts(r.course_id)}</select><input id="cs-${r.id}" type="number" min="0" max="100" value="${r.avg_score||""}" placeholder="المعدل %"></div>`
      :`<b class="ltr">${esc(r.en_name)}</b><div class="muted">${esc((course(r.course_id)||{}).title||r.course_id)}</div>`}</td>
    <td>${r.done} من ${r.total} درس<div class="muted">المعدل ${r.avg_score}%</div></td>
    <td>${r.status==="open"?`<div class="acts2"><button class="btn gold sm" type="button" data-ci="${r.id}">🎓 أصدر وأرسل</button><input id="cr-${r.id}" placeholder="سبب الرفض"><button class="btn sm" type="button" data-cx="${r.id}">رفض</button></div>`
      :r.status==="issued"?`<span class="chip up">✅ صدرت</span> <a class="num" href="#cert/${esc(r.cert_code)}">${esc(r.cert_code)}</a>`:`<span class="chip down">مرفوض</span><div class="muted" style="font-size:12px">${esc(r.admin_note)}</div>`}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">ما في طلبات شهادات.</div>');
  $("aBody").onclick=async e=>{const i=e.target.closest("[data-ci]"),x=e.target.closest("[data-cx]");
    if(i){const id=i.dataset.ci,sc=parseInt($("cs-"+id).value,10);if(!(sc>=0&&sc<=100))return toast("اكتب المعدل من 0 إلى 100");i.disabled=true;
      try{const code=await API.aIssueCert(+id,$("cn-"+id).value.trim(),$("cc-"+id).value,sc);toast("✅ صدرت الشهادة "+code+" وانرسلت للطالب");adminCerts()}catch(err){i.disabled=false;toast(err.message)}}
    if(x){const id=x.dataset.cx;try{await API.aRejectCert(+id,$("cr-"+id).value.trim());toast("انرفض الطلب ووصل إشعار للطالب");adminCerts()}catch(err){toast(err.message)}}}}

const V2A={q:"",lv:""};
function v2Shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function v2Pre(c){if(!/متوسط|متقدم|محترف/.test(c.level||""))return null;const i=S.courses.findIndex(x=>x.id===c.id);for(let k=i-1;k>=0;k--){const x=S.courses[k];if(!/متوسط|متقدم|محترف/.test(x.level||"")||/متوسط/.test(x.level||"")&&/متقدم|محترف/.test(c.level||""))return x}return null}
function v2Filter(){const q=V2A.q.trim().toLowerCase(),lv=V2A.lv&&V2A.lv!=="الكل"?V2A.lv:"";
  return S.courses.filter(c=>(!lv||c.level===lv)&&(!q||[c.title,c.subtitle,c.title_en,...lessonsOf(c.id).map(l=>l.title)].join(" ").toLowerCase().includes(q)))}
function v2Continue(){if(!S.user)return"";let d=null;try{d=JSON.parse(localStorage.getItem("vx_last_lesson")||"null")}catch(e){}
  const l=d&&S.lessons.find(x=>x.id===d.id);if(!l)return"";const c=course(l.course_id),ls=lessonsOf(l.course_id),done=ls.filter(x=>S.progress[x.id]!=null).length;
  const nx=S.progress[l.id]!=null?ls.find(x=>x.idx>l.idx&&S.progress[x.id]==null)||l:l;
  return`<div class="v2a-card v2a-cont"><div><span class="chip gold">▶️ كمّل من وين ما وكفت</span><h3 style="margin:8px 0 2px">${esc(c.icon||"")} ${esc(c.title)}</h3><span class="muted" style="font-size:13.5px">الدرس ${nx.idx}: ${esc(nx.title)} · أنهيت ${done} من ${ls.length}</span><div class="bar" style="margin-top:8px;max-width:340px"><i style="width:${Math.round(done/ls.length*100)}%"></i></div></div><a class="btn gold" href="#lesson/${esc(nx.id)}">كمّل الدرس ←</a></div>`}
document.addEventListener("input",e=>{if(e.target.id!=="v2Q")return;V2A.q=e.target.value;const g=$("v2Grid");if(g)g.innerHTML=v2Filter().map(courseCard).join("")||'<div class="empty">ما لكينا دورة بهذا البحث.</div>'});
document.addEventListener("click",e=>{const b=e.target.closest("#v2Lv [data-lv]");if(!b)return;V2A.lv=b.dataset.lv;document.querySelectorAll("#v2Lv button").forEach(x=>x.classList.toggle("on",x===b));const g=$("v2Grid");if(g)g.innerHTML=v2Filter().map(courseCard).join("")||'<div class="empty">ما لكينا دورة بهذا البحث.</div>'});
// المساعد التعليمي داخل الدرس
function v2Tutor(l,c){const lc=$("lc");if(!lc||!API.aiAsk)return;const box=document.createElement("section");box.className="v2a-card v2a-ai";box.style.marginTop="22px";
  box.innerHTML=`<h3 style="margin:0 0 6px">🤖 اسأل المساعد عن هذا الدرس</h3><p class="muted" style="font-size:13px;margin:0 0 10px">${!S.user?"سجّل دخول حتى تسأل.":!isMember()?"المساعد للأعضاء المفعّلين.":"عندك أسئلة محدودة يومياً (حسب اشتراكك). المساعد يشرح الدرس، مو نصيحة مالية."}</p>
    ${S.user&&isMember()?`<textarea id="v2TQ" maxlength="500" placeholder="${esc((window.__t||String)("مثلاً: ما فهمت الفرق بين الدعم والمقاومة، اشرحلي بمثال"))}"></textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn gold sm" type="button" id="v2TB">إرسال السؤال</button>${["لخّصلي الدرس بنقاط","اعطني مثال عملي على الشارت","شنو أكثر غلطة يسويها المبتدئ هنا؟"].map(q=>`<button class="btn sm" type="button" data-tq="${esc(q)}">${esc(q)}</button>`).join("")}</div><div id="v2TA"></div>`:""}`;
  const qz=$("quiz");(qz||lc.querySelector(".lnav")).before(box);
  const ask=async q=>{q=(q||"").trim();if(!q)return;const a=$("v2TA"),b=$("v2TB");b.disabled=true;a.innerHTML='<div class="v2a-ans">🤖 جاري التفكير…</div>';
    try{const id=await API.aiAsk(q,{lesson:l.title,course:c.title,summary:l.summary,text:(lc.querySelector(".lbody")||{}).innerText?.slice(0,3500)||"",mode:"tutor"},window.LANG||"ar");let r=null;
      for(let i=0;i<60;i++){await new Promise(z=>setTimeout(z,1500));r=await API.aiResult(id);if(r&&r.status!=="pending")break}
      if(!r||r.status==="pending")throw new Error("المساعد ما رد. جرّب مرة ثانية.");a.innerHTML=`<div class="v2a-ans${r.status==="error"?" err":""}">${esc(r.answer||"")}</div>`}
    catch(err){a.innerHTML=`<div class="v2a-ans err">${esc(String(err.message||err).replace(/^AI_FREE_LIMIT:\s*/,""))}</div>`}b.disabled=false};
  const tb=$("v2TB");if(tb){tb.onclick=()=>ask($("v2TQ").value);box.addEventListener("click",e=>{const x=e.target.closest("[data-tq]");if(x){$("v2TQ").value=x.dataset.tq;ask(x.dataset.tq)}})}}
// تسجيلات الزوم
async function v2Recs(){const el=$("v2Rec");if(!el||!S.user||!API.recordings)return;let L=[];try{L=await API.recordings()||[]}catch(e){return}
  el.innerHTML=`<div class="sh"><div><h2>🎬 تسجيلات المحاضرات</h2><p>فاتتك محاضرة؟ شوف تسجيلها هنا (للي عنده صلاحية الحضور).</p></div></div>`+(L.length?`<div class="v2a-rec">${L.map(s=>`<a class="srow" href="${esc(s.recording_url)}" target="_blank" rel="noopener"><div class="date"><b>${new Date(s.starts_at).getDate()}</b><span>${new Date(s.starts_at).toLocaleDateString(window.LANG||"ar",{month:"short"})}</span></div><div><h3 style="margin:0">${esc(s.title)}</h3><div class="muted" style="font-size:13px">${fmtDate(new Date(s.starts_at))} · ${s.minutes} دقيقة</div></div><span class="btn sm gold">▶️ شاهد</span></a>`).join("")}</div>`:'<div class="empty">ما أكو تسجيلات متاحة إلك بعد.</div>')}
// إدارة: التسجيل والحضور
function v2AdminRec(){const tb=$("aBody")&&$("aBody").querySelector("tbody");if(!tb||!API.aSetRecording)return;
  [...tb.querySelectorAll("tr")].forEach((tr,k)=>{const s=ADM.sess[k];if(!s)return;const td=tr.lastElementChild;const w=document.createElement("div");w.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px";
    w.innerHTML=`<button class="btn sm" type="button" data-zl="${s.id}">✏️ رابط الزوم</button><button class="btn sm" type="button" data-rec="${s.id}">🎬 ${s.recording_url?"تعديل التسجيل":"رابط التسجيل"}</button><button class="btn sm" type="button" data-att="${s.id}">👥 الحضور</button>`;td.appendChild(w)});
  $("aBody").onclick=async e=>{const r=e.target.closest("[data-rec]"),a=e.target.closest("[data-att]"),zl=e.target.closest("[data-zl]");
    if(zl){const s=ADM.sess.find(x=>String(x.id)===zl.dataset.zl);const u=prompt("رابط الزوم الجديد (يطلع للطلاب المسموحلهم قبل الدرس بـ 45 دقيقة):",s.zoom_url||"");if(u==null)return;
      if(!/^https:\/\//i.test(u.trim()))return toast("الرابط لازم يبدي بـ https://");try{await API.aSetSession(s.id,{zoom_url:u.trim()});s.zoom_url=u.trim();toast("✅ انحفظ رابط الزوم");adminLive()}catch(err){toast(err.message)}return}
    if(r){const s=ADM.sess.find(x=>String(x.id)===r.dataset.rec);const u=prompt("الصق رابط التسجيل (YouTube غير مدرج أو Google Drive). يطلع بس للطلاب اللي عدهم صلاحية الحضور.",s.recording_url||"");if(u==null)return;
      try{await API.aSetRecording(s.id,u.trim());s.recording_url=u.trim();toast(u.trim()?"✅ انحفظ التسجيل ووصل إشعار للي سجّلوا":"انشال الرابط")}catch(err){toast(err.message)}return}
    if(a){const sid=+a.dataset.att;let L=[];try{L=await API.aAttendance(sid)||[]}catch(err){return toast(err.message)}
      let bx=$("v2Att"+sid);if(!bx){bx=document.createElement("tr");bx.id="v2Att"+sid;a.closest("tr").after(bx)}
      bx.innerHTML=`<td colspan="9"><div class="v2a-att"><b>👥 اللي سجّلوا (${L.length}) · الحضور: ${L.filter(x=>x.attended).length}</b>${L.map(x=>`<label><input type="checkbox" data-mk="${sid}" data-uid="${esc(x.user_id)}"${x.attended?" checked":""}> ${esc(x.full_name||"—")} <span class="muted ltr">${esc(x.telegram||"")}</span></label>`).join("")||'<span class="muted">ما أحد ضغط «ذكّرني» بعد.</span>'}</div></td>`;
      bx.onchange=async ev=>{const c=ev.target.closest("[data-mk]");if(!c)return;try{await API.aMarkAttended(+c.dataset.mk,c.dataset.uid,c.checked)}catch(err){c.checked=!c.checked;toast(err.message)}}}}}
// ===== المختبر الافتراضي: تداول تجريبي على شموع حقيقية مخزّنة بالسيرفر =====
const LAB={bal:10000,pos:null,log:[],i:0,cs:[],sym:"XAU/USD",tf:"H1",timer:null,sets:[]};window.__vxLab=LAB;
function labPage(){setNav("tools");
  $("view").innerHTML=pageHead("🧪 المختبر الافتراضي","تدرّب على الدخول والوقف والأهداف بشموع حقيقية من السوق، بدون فلوس حقيقية. الشموع تنعرض وحدة وحدة مثل السوق الحي.")
   +`<section class="blk" style="padding-top:6px"><div class="wrap">${!S.user?`<div class="empty">سجّل دخول حتى تستخدم المختبر. <a href="${CONFIG.SITE}#signup">سجّل هنا</a></div>`:`<div class="lab"><div class="v2a-card">
      <div class="lab-ctl" style="margin:0 0 10px"><select id="labSym" aria-label="الزوج"></select><span class="muted" id="labInfo" style="font-size:12.5px"></span></div>
      <canvas class="lab-cv" id="labCv"></canvas>
      <div class="lab-ctl"><button class="btn sm" type="button" id="labNext">⏭ شمعة</button><button class="btn sm" type="button" id="labPlay">▶️ تشغيل</button><button class="btn sm" type="button" id="labReset">↺ بداية جديدة</button><span class="muted num" id="labPx" style="margin-inline-start:auto;font-size:15px"></span></div></div>
    <aside class="lab-side"><div class="v2a-card"><div class="lab-g"><div class="v2a-t"><span>الرصيد التجريبي</span><b class="num" id="labBal"></b></div><div class="v2a-t"><span>الصفقات</span><b class="num" id="labN"></b></div></div>
      <div class="lab-g" style="margin-top:10px"><label>الوقف (نقاط)<input id="labSl" type="number" min="1" value="150"></label><label>الهدف (نقاط)<input id="labTp" type="number" min="1" value="300"></label></div>
      <label style="margin-top:8px">المخاطرة من الرصيد %<input id="labRisk" type="number" min="0.1" max="5" step="0.1" value="1"></label>
      <div class="lab-ctl"><button class="btn buy" type="button" id="labBuy" style="flex:1">شراء</button><button class="btn sell" type="button" id="labSell" style="flex:1">بيع</button></div>
      <div class="lab-pos" id="labPos"></div></div>
      <div class="v2a-card"><b style="font-size:14px">📒 سجل صفقاتك</b><div class="lab-log" id="labLog" style="margin-top:8px"></div><a class="m3-link" href="#mentor">🎯 المرشد الشخصي يحلّل صفقاتك وأخطاءك ←</a></div>
      <p class="muted" style="font-size:12px;margin:0">للتدريب فقط. ما في تنفيذ حقيقي ولا ربط مع البروكر، والنتائج ما تضمن نتائج حقيقية. الشموع حقيقية من السيرفر، والشموع الجاية مخفية لحد ما توصلها. الدخول بالشراء على سعر الطلب (مع السبريد التقديري)، والعمولة ما محسوبة.</p></aside></div>`}</div></section>`;
  if(S.user)labLoad()}
async function labLoad(){let rows=[];try{rows=API.candles?await API.candles(null,LAB.tf):[]}catch(e){}
  LAB.sets=(rows||[]).filter(r=>Array.isArray(r.data)&&r.data.length>80);
  if(!LAB.sets.length){$("labInfo").textContent="ما أكو شموع مخزّنة بعد. المختبر يشتغل لمن السيرفر يحفظ أسعار.";["labNext","labPlay","labBuy","labSell"].forEach(i=>$(i).disabled=true);return}
  const sel=$("labSym");sel.innerHTML=LAB.sets.map(r=>`<option value="${esc(r.sym)}">${esc(r.sym)}</option>`).join("");if(!LAB.sets.some(r=>r.sym===LAB.sym))LAB.sym=LAB.sets[0].sym;sel.value=LAB.sym;
  sel.onchange=()=>{LAB.sym=sel.value;labReset()};$("labNext").onclick=()=>labStep();$("labReset").onclick=()=>labReset();
  $("labPlay").onclick=()=>{if(LAB.timer){clearInterval(LAB.timer);LAB.timer=null;$("labPlay").textContent="▶️ تشغيل"}else{LAB.timer=setInterval(labStep,700);$("labPlay").textContent="⏸ إيقاف"}};
  $("labBuy").onclick=()=>labOpen(1);$("labSell").onclick=()=>labOpen(-1);
  try{const s=JSON.parse(localStorage.getItem("vx_lab")||"null");if(s){LAB.bal=s.bal;LAB.log=s.log||[]}}catch(e){}
  addEventListener("resize",labDraw);labReset()}
const LSPR={"XAU/USD":.27,"XAG/USD":.03,"EUR/USD":.00012,"GBP/USD":.00016,"USD/JPY":.016,"AUD/USD":.00014,"USD/CAD":.00018,"USD/CHF":.00018,"GBP/JPY":.028};
function labSpr(){return LSPR[LAB.sym]||labPip()*1.5}
function labPip(){return/JPY/.test(LAB.sym)?.01:/XAU/.test(LAB.sym)?.1:/XAG/.test(LAB.sym)?.01:/BTC|ETH/.test(LAB.sym)?1:.0001}
function labDec(){return/JPY/.test(LAB.sym)?3:/XAU|BTC|ETH/.test(LAB.sym)?2:/XAG/.test(LAB.sym)?3:5}
function labReset(){const set=LAB.sets.find(r=>r.sym===LAB.sym);LAB.cs=set.data.map(c=>({t:c[0],o:c[1],h:c[2],l:c[3],c:c[4]})).filter(c=>c.h!==c.l);
  const max=Math.max(60,LAB.cs.length-40);LAB.i=Math.min(LAB.cs.length-2,60+Math.floor(Math.random()*Math.max(1,max-60)));LAB.pos=null;
  $("labInfo").textContent=`${LAB.tf} · السبريد التقديري ${(labSpr()/labPip()).toFixed(1)} نقطة · التاريخ مخفي حتى ما تعرف شنو صار بعدين`;labDraw();labUI()}
function labStep(){if(LAB.i>=LAB.cs.length-1){if(LAB.timer)$("labPlay").click();toast("خلصت الشموع المخزّنة. اضغط «بداية جديدة».");return}LAB.i++;
  const c=LAB.cs[LAB.i],p=LAB.pos;if(p){const sp=p.d<0?labSpr():0,hitSl=p.d>0?c.l<=p.sl:c.h+sp>=p.sl,hitTp=p.d>0?c.h>=p.tp:c.l+sp<=p.tp;if(hitSl||hitTp)labClose(hitSl?p.sl:p.tp,hitSl?"وقف":"هدف")}labDraw();labUI()}
function labOpen(d){if(LAB.pos)return toast("عندك صفقة مفتوحة. انتظرها تسكّر أو سكّرها.");const bid=LAB.cs[LAB.i].c,px=d>0?bid+labSpr():bid,pip=labPip(),sl=+$("labSl").value||100,tp=+$("labTp").value||200,risk=LAB.bal*(+$("labRisk").value||1)/100;
  LAB.pos={d,e:px,sl:px-d*sl*pip,tp:px+d*tp*pip,risk,slp:sl,tpp:tp,at:LAB.i,rp:+$("labRisk").value||1};labDraw();labUI()}
function labClose(px,why){const p=LAB.pos;if(!p)return;const pips=(px-p.e)*p.d/labPip(),r=pips/p.slp,pnl=Math.round(p.risk*r*100)/100;LAB.bal=Math.round((LAB.bal+pnl)*100)/100;
  const rp=p.rp||1,mk=[],prev=LAB.log.slice(0,2);if(rp>2)mk.push("big_risk");if(p.tpp<p.slp)mk.push("low_rr");if(why==="يدوي"&&pnl>0&&pips<.5*p.tpp)mk.push("early_win");
  if(prev.length===2&&prev.every(x=>x.pnl<0)&&rp>Math.max(...prev.map(x=>x.rp||1)))mk.push("revenge");if(LAB.log.filter(x=>Date.now()-x.t<864e5).length>=10)mk.push("overtrade");
  if(API.labSave&&S.user)API.labSave({sym:LAB.sym,tf:LAB.tf,dir:p.d,pips:Math.round(pips),pnl,r:+r.toFixed(2),risk_pct:rp,rr:+(p.tpp/p.slp).toFixed(2),why,mistakes:mk}).catch(()=>{});
  LAB.log.unshift({sym:LAB.sym,d:p.d,pips:Math.round(pips),pnl,why,t:Date.now(),rp,mk});LAB.log=LAB.log.slice(0,50);LAB.pos=null;try{localStorage.setItem("vx_lab",JSON.stringify({bal:LAB.bal,log:LAB.log}))}catch(e){}}
function labUI(){const f=v=>v.toLocaleString("en-US",{minimumFractionDigits:labDec(),maximumFractionDigits:labDec()}),p=LAB.pos,c=LAB.cs[LAB.i];if(!c)return;
  $("labBal").textContent="$"+LAB.bal.toLocaleString("en-US");$("labN").textContent=LAB.log.length?`${LAB.log.filter(x=>x.pnl>0).length} رابحة من ${LAB.log.length}`:"0";$("labPx").textContent=f(c.c);
  $("labPos").innerHTML=p?`<div style="margin-top:10px"><b class="${p.d>0?"up":"down"}">${p.d>0?"شراء":"بيع"} مفتوح</b><br>الدخول <span class="num">${f(p.e)}</span> · الوقف <span class="num down">${f(p.sl)}</span> · الهدف <span class="num up">${f(p.tp)}</span><br>الربح/الخسارة الحالي: <b class="num ${(c.c-p.e)*p.d>=0?"up":"down"}">${Math.round((c.c-p.e)*p.d/labPip())} نقطة</b><br><button class="btn sm" type="button" id="labCl" style="margin-top:6px">سكّر الصفقة هسه</button></div>`:'<div class="muted" style="margin-top:10px;font-size:13px">اختار الوقف والهدف، بعدين اضغط شراء أو بيع.</div>';
  const cl=$("labCl");if(cl)cl.onclick=()=>{labClose(LAB.cs[LAB.i].c+(LAB.pos&&LAB.pos.d<0?labSpr():0),"يدوي");labDraw();labUI()};
  $("labLog").innerHTML=LAB.log.map(x=>`<div><b class="${x.pnl>=0?"up":"down"}">${x.pnl>=0?"+":""}$${x.pnl}</b> · ${x.d>0?"شراء":"بيع"} ${esc(x.sym)} · ${x.pips>0?"+":""}${x.pips} نقطة · ${esc(x.why)}${(x.mk||[]).length?` <small class="m3-mk">⚠ ${x.mk.map(k=>MISTAKE[k]?MISTAKE[k][0]:k).join("، ")}</small>`:""}</div>`).join("")||'<div class="muted">لسه ما سويت صفقات.</div>'}
function labDraw(){const cv=$("labCv");if(!cv||!LAB.cs.length)return;const dpr=devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;const g=cv.getContext("2d");g.direction="ltr";g.textAlign="left";g.scale(dpr,dpr);g.clearRect(0,0,W,H);
  const n=Math.max(30,Math.min(90,Math.floor(W/9))),from=Math.max(0,LAB.i-n+1),cs=LAB.cs.slice(from,LAB.i+1),p=LAB.pos;let hi=Math.max(...cs.map(c=>c.h)),lo=Math.min(...cs.map(c=>c.l));
  if(p){hi=Math.max(hi,p.sl,p.tp);lo=Math.min(lo,p.sl,p.tp)}const pad=(hi-lo)*.08||1;hi+=pad;lo-=pad;const R=64,Y=v=>10+(hi-v)/(hi-lo)*(H-20),bw=(W-R-10)/n;
  g.strokeStyle="rgba(255,255,255,.05)";g.fillStyle="#6b6b73";g.font="11px monospace";for(let k=0;k<=5;k++){const v=lo+(hi-lo)*k/5,y=Y(v);g.beginPath();g.moveTo(0,y);g.lineTo(W-R,y);g.stroke();g.fillText(v.toFixed(labDec()),W-R+4,y+4)}
  cs.forEach((c,k)=>{const x=5+k*bw+bw/2,up=c.c>=c.o;g.strokeStyle=g.fillStyle=up?"#34c98e":"#f0606f";g.beginPath();g.moveTo(x,Y(c.h));g.lineTo(x,Y(c.l));g.stroke();const y1=Y(Math.max(c.o,c.c)),y2=Y(Math.min(c.o,c.c));g.fillRect(x-bw*.35,y1,bw*.7,Math.max(1,y2-y1))});
  const line=(v,col,t)=>{const y=Y(v);g.strokeStyle=col;g.setLineDash([5,4]);g.beginPath();g.moveTo(0,y);g.lineTo(W-R,y);g.stroke();g.setLineDash([]);g.fillStyle=col;g.fillRect(W-R,y-8,R,16);g.fillStyle="#0b0b0d";g.font="bold 10px sans-serif";g.fillText(t,W-R+4,y+4)};
  if(p){line(p.e,"#d4af37","دخول");line(p.sl,"#f0606f","وقف");line(p.tp,"#34c98e","هدف")}const last=cs.at(-1);line(last.c,"#9a9aa3",last.c.toFixed(labDec()))}

// ===== V3: المرشد الشخصي =====
const MISTAKE={big_risk:["مخاطرة عالية","خاطرت بأكثر من 2% من الرصيد بالصفقة","ثبّت المخاطرة على 1% لـ 10 صفقات ورا بعض"],
  low_rr:["هدف أصغر من الوقف","الهدف كان أصغر من الوقف، يعني تحتاج نسبة ربح عالية جداً حتى تربح","خلي كل هدف ضعف الوقف على الأقل (1:2)"],
  early_win:["سكّرت الرابحة بدري","سكّرت صفقة رابحة يدوي قبل نص الطريق للهدف","خلي 3 صفقات رابحة توصل هدفها بدون تدخل"],
  revenge:["تداول انتقامي","رفعت المخاطرة بعد خسارتين ورا بعض","بعد خسارتين: وكّف 30 دقيقة ورجّع المخاطرة لـ 1%"],
  overtrade:["تداول زايد","فتحت 10 صفقات أو أكثر بنفس اليوم","حد أقصى 5 صفقات باليوم، وكل وحدة بسبب واضح"]};
const MENT={st:null,plan:null,busy:false};
function mWeek(){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toISOString().slice(0,10)}
async function mentorPage(){setNav("tools");
  $("view").innerHTML=pageHead("🎯 المرشد الشخصي","يتابع تقدّمك بالدروس والاختبارات وصفقات المختبر، يكشف أخطاءك المتكررة، ويسويلك خطة أسبوعية.")
   +`<section class="blk" style="padding-top:6px"><div class="wrap" id="mBody">${!S.user?`<div class="empty">سجّل دخول حتى يشتغل المرشد. <a href="${CONFIG.SITE}#signup">سجّل هنا</a></div>`:'<p class="muted">جاري تحميل تقدّمك…</p>'}</div></section>`;
  if(!S.user)return;
  try{const[st,pl]=await Promise.all([API.mentorStats(),API.mentorPlan(mWeek())]);MENT.st=st;MENT.plan=pl}catch(e){$("mBody").innerHTML=`<div class="empty">${esc(e.message)} (شغّل ملف vexora_v3.sql)</div>`;return}
  mentorDraw()}
function mentorDraw(){const s=MENT.st,el=$("mBody");if(!el||!s)return;const pc=s.lessons_total?Math.round(s.lessons_done/s.lessons_total*100):0,wr=s.lab_n?Math.round(s.lab_wins/s.lab_n*100):0;
  const mk=Object.entries(s.mistakes||{}).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...mk.map(x=>x[1])),days=s.last_lesson?Math.floor((Date.now()-new Date(s.last_lesson))/864e5):null;
  el.innerHTML=`<div class="m3-g">
    <div class="v2a-t"><span>تقدّم الدروس</span><b class="num">${pc}%</b><div class="m3-bar"><i style="width:${pc}%"></i></div><small class="muted">${s.lessons_done} من ${s.lessons_total} درس</small></div>
    <div class="v2a-t"><span>معدّل الاختبارات</span><b class="num">${s.quiz_avg!=null?s.quiz_avg+"%":"—"}</b><small class="muted">${s.weak.length?s.weak.length+" دروس تحتاج إعادة":"ما أكو دروس ضعيفة"}</small></div>
    <div class="v2a-t"><span>صفقات المختبر</span><b class="num">${s.lab_n}</b><small class="muted">${s.lab_n?`${wr}% رابحة · <bdi dir="ltr">${s.lab_pnl>=0?"+$":"−$"}${Math.abs(s.lab_pnl)}</bdi>`:"لسه ما بديت"}</small></div>
    <div class="v2a-t"><span>نشاطك هذا الأسبوع</span><b class="num">${s.week_lessons+s.lab_week}</b><small class="muted">${s.week_lessons} درس · ${s.lab_week} صفقة${days!=null&&days>3?` · آخر درس قبل ${days} يوم`:""}</small></div></div>
   <div class="m3-two"><div class="v2a-card m3-c"><h3>⚠️ أخطاؤك المتكررة (آخر 30 يوم)</h3>${mk.length?mk.map(([k,n])=>`<div class="m3-mrow"><div><b>${esc(MISTAKE[k]?MISTAKE[k][0]:k)}</b><small class="muted">${esc(MISTAKE[k]?MISTAKE[k][1]:"")}</small></div><i><em style="width:${n/mx*100}%"></em></i><b class="num">${n}</b></div>`).join("")
       :`<p class="muted" style="margin:0">${s.lab_n?"ممتاز، ما أكو أخطاء متكررة بصفقاتك. كمّل هيچ 👏":"تدرّب بـ <a href=\"#lab\">المختبر الافتراضي</a> والمرشد يكشفلك أخطاءك تلقائياً."}</p>`}
       ${s.weak.length?`<h3 style="margin-top:14px">📚 دروس تحتاج إعادة</h3>${s.weak.map(w=>`<a class="m3-wk" href="#lesson/${encodeURIComponent(w.id)}"><span>${esc(w.title)}</span><b class="num">${w.score}%</b></a>`).join("")}`:""}</div>
     <div class="v2a-card m3-c" id="mPlan"></div></div>
   <p class="muted" style="font-size:12px">المرشد يقرا بياناتك أنت بس (تقدّمك وصفقات المختبر التجريبية)، وما يشوفها غيرك. الخطة إرشادية وما تضمن أي نتيجة بالتداول الحقيقي.</p>`;
  planDraw()}
function planDraw(){const el=$("mPlan"),P=MENT.plan;if(!el)return;
  if(!P){el.innerHTML=`<h3>🗓 خطتك لهذا الأسبوع</h3><p class="muted" style="margin:0 0 12px">ما عندك خطة لهذا الأسبوع بعد. المرشد يقرا تقدّمك وأخطاءك ويكتبلك مهام واضحة.</p>
    <div class="m3-act"><button class="btn primary" type="button" id="mAi">🤖 اطلب خطة من المرشد الذكي</button><button class="btn" type="button" id="mRule">⚡ خطة سريعة من القواعد</button></div>
    <p class="muted" style="font-size:12px;margin:8px 0 0">الخطة الذكية تنحسب من أسئلة المساعد اليومية. الخطة السريعة ببلاش.</p>`;
    $("mAi").onclick=()=>mentorAi();$("mRule").onclick=()=>mentorRule();return}
  const done=new Set(P.done||[]),T=P.tasks||[],n=T.filter((_,i)=>done.has(i)).length;
  el.innerHTML=`<div class="m3-ph"><h3>🗓 خطتك لهذا الأسبوع</h3><span class="m3-chip">${P.source==="ai"?"🤖 من المرشد الذكي":"⚡ من القواعد"}</span></div>${P.summary?`<p class="m3-sum">${esc(P.summary)}</p>`:""}
    <div class="m3-bar" style="margin:6px 0 10px"><i style="width:${T.length?n/T.length*100:0}%"></i></div><small class="muted">${n} من ${T.length} مهام خلصت</small>
    <div class="m3-tasks">${T.map((t,i)=>`<label class="m3-t${done.has(i)?" on":""}"><input type="checkbox" data-ti="${i}"${done.has(i)?" checked":""}><span><b>${t.day?`<em>${esc(t.day)}</em> `:""}${esc(t.t||"")}</b>${t.why?`<small class="muted">${esc(t.why)}</small>`:""}</span></label>`).join("")}</div>
    <div class="m3-act"><button class="btn" type="button" id="mRe">↻ خطة جديدة</button></div>`;
  el.querySelectorAll("[data-ti]").forEach(c=>c.onchange=async()=>{const d=new Set(P.done||[]),i=+c.dataset.ti;c.checked?d.add(i):d.delete(i);P.done=[...d].sort((a,b)=>a-b);
    try{await API.mentorSave({week:P.week,summary:P.summary,tasks:P.tasks,done:P.done,source:P.source});planDraw();if(P.done.length===T.length)toast("🎉 خلّصت كل مهام الأسبوع!")}catch(e){toast(e.message)}});
  $("mRe").onclick=()=>{if(confirm("تبدّل خطة هذا الأسبوع بخطة جديدة؟")){MENT.plan=null;planDraw()}}}
function mentorRules(s){const T=[],D=["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"];
  (s.weak||[]).slice(0,2).forEach(w=>T.push({t:`عيد درس «${w.title}» وحاول توصل 80% أو أكثر بالاختبار`,why:`نتيجتك السابقة ${w.score}%`}));
  if(s.lessons_done<s.lessons_total)T.push({t:"كمّل درسين جداد من دورتك الحالية",why:`خلصت ${s.lessons_done} من ${s.lessons_total} درس`});
  Object.entries(s.mistakes||{}).sort((a,b)=>b[1]-a[1]).slice(0,2).forEach(([k,n])=>{if(MISTAKE[k])T.push({t:MISTAKE[k][2],why:`تكرر ${n} مرة: ${MISTAKE[k][1]}`})});
  if(s.lab_n<10)T.push({t:"سوّي 10 صفقات بالمختبر على الذهب H1، واكتب سبب كل دخول قبل ما تضغط",why:"التكرار يبني الثقة بالخطة"});
  else T.push({t:"سوّي 5 صفقات بالمختبر بنفس القاعدة بالضبط وقارن النتيجة",why:`نسبة ربحك الحالية ${Math.round(s.lab_wins/s.lab_n*100)}%`});
  T.push({t:"افتح سجل الأداء بالمنصة وراجع 3 توصيات منشورة: وين كان الدخول والوقف وليش",why:"تتعلم من صفقات حقيقية موثّقة"});
  return T.slice(0,7).map((t,i)=>({...t,day:D[i]}))}
async function mentorRule(){const s=MENT.st,P={week:mWeek(),summary:`خلصت ${s.lessons_done} من ${s.lessons_total} درس${s.lab_n?`، وسويت ${s.lab_n} صفقة بالمختبر`:""}. هذي مهامك لهذا الأسبوع حسب تقدّمك وأخطاءك.`,tasks:mentorRules(s),done:[],source:"rules"};
  try{await API.mentorSave(P);MENT.plan=P;planDraw();toast("✅ انحفظت خطة الأسبوع")}catch(e){toast(e.message)}}
async function mentorAi(){if(MENT.busy)return;MENT.busy=true;const b=$("mAi");b.disabled=true;b.textContent="المرشد يكتب خطتك…";
  try{const lang=(window.LANG&&window.LANG!=="ar")?window.LANG:"iq",aid=await API.mentorAsk(lang);let r={status:"pending"};
    for(let k=0;k<45&&r.status==="pending";k++){await new Promise(z=>setTimeout(z,2000));r=await API.aiResult(aid)}
    if(r.status!=="done")throw new Error(r.answer||"المرشد ما رد. جرّب مرة ثانية.");
    const m=String(r.answer).match(/\{[\s\S]*\}/);let j=null;try{j=JSON.parse(m[0])}catch(e){}
    if(!j||!Array.isArray(j.tasks)||!j.tasks.length)throw new Error("الرد ما جان بالشكل المطلوب. جرّب مرة ثانية أو استخدم الخطة السريعة.");
    const P={week:mWeek(),summary:[j.summary,(j.focus||[]).length?"ركّز على: "+j.focus.join("، "):""].filter(Boolean).join(" ").slice(0,900),tasks:j.tasks.slice(0,7).map(t=>({day:String(t.day||"").slice(0,20),t:String(t.t||"").slice(0,200),why:String(t.why||"").slice(0,200)})),done:[],source:"ai"};
    await API.mentorSave(P);MENT.plan=P;planDraw();toast("✅ وصلت خطتك من المرشد")}
  catch(e){const m=String(e.message||e);toast(/AI_FREE_LIMIT/.test(m)?"خلص سؤالك المجاني اليوم. استخدم الخطة السريعة أو ارجع باچر.":/AI_CAP/.test(m)?"المساعد واصل سقف الاستخدام الشهري. استخدم الخطة السريعة.":m.replace(/^[A-Z_]+:\s*/,""));if($("mAi")){$("mAi").disabled=false;$("mAi").textContent="🤖 اطلب خطة من المرشد الذكي"}}
  finally{MENT.busy=false}}


// ===== V4A: إعلان المسابقة بالرئيسية + المقاعد =====
const V4A={i:0,L:[],
  async hero(){const el=$("v4AHero");if(!el||!API.adsHome)return;try{V4A.L=await API.adsHome()||[]}catch(e){V4A.L=[]}if(!V4A.L.length){el.hidden=true;return}el.hidden=false;V4A.draw();
    clearInterval(V4A.t);if(V4A.L.length>1)V4A.t=setInterval(()=>{const e=$("v4AHero");if(!e){clearInterval(V4A.t);return}if(document.hidden||e.matches(":hover"))return;V4A.i=(V4A.i+1)%V4A.L.length;V4A.draw()},8000)},
  draw(){const el=$("v4AHero"),c=V4A.L[V4A.i],n=V4A.L.length;if(!el||!c)return;const pz=((c.prizes||[]).find(x=>+x.rank===1)||{}).text||c.prize||"";
    el.innerHTML=`<section class="hx"><div class="hx-bg" style="${c.image_url?`background-image:url('${esc(c.image_url)}')`:"background:radial-gradient(500px 300px at 40% 50%,rgba(212,175,55,.35),transparent 70%),#0e0e10"}">${c.image_url?"":'<span class="hx-ph">🏆</span>'}</div>
      ${n>1?'<button type="button" class="hx-arr" data-ha="1" style="right:10px" aria-label="التالي">›</button><button type="button" class="hx-arr" data-ha="-1" style="left:10px" aria-label="السابق">‹</button>':""}
      <div class="hx-c"><span class="hx-tag">🏆 ${n>1?`المسابقة ${V4A.i+1} من ${n}`:"المسابقة الحالية"}</span><h2>${esc(c.title)}</h2>${c.body?`<p class="hx-sub">${esc(c.body.length>110?c.body.slice(0,110)+"…":c.body)}</p>`:""}
      <div class="hx-boxes">${c.ends_at?`<div class="hx-box"><small>⏱ الوقت المتبقي على انتهاء التحدي</small><div class="hx-cd" data-v4cd="${esc(c.ends_at)}"></div></div>`:""}${pz?`<div class="hx-box"><small>🎁 الجائزة الرئيسية</small><b>${esc(pz)}</b></div>`:""}<div class="hx-box"><small>عدد المشاركين</small><span class="big">${c.participants}</span></div></div>
      <div class="hx-act"><a class="btn primary" href="app.html#comp/${c.id}" style="text-decoration:none;text-align:center">🚀 ${c.joined?"افتح المسابقة":"انضم للتحدي"}</a><a class="btn" href="app.html#rewards" style="text-decoration:none;text-align:center">☰ كل المسابقات</a></div></div>
      ${n>1?`<div class="hx-dots">${V4A.L.map((_,i)=>`<i class="${i===V4A.i?"on":""}"></i>`).join("")}</div>`:""}</section>`;
    V4A.tick();el.onclick=e=>{const a=e.target.closest("[data-ha]");if(a){V4A.i=(V4A.i+ +a.dataset.ha+n)%n;V4A.draw()}}},
  tick(){document.querySelectorAll("[data-v4cd]").forEach(el=>{let s=Math.max(0,Math.floor((new Date(el.dataset.v4cd)-Date.now())/1000));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;const p=v=>String(v).padStart(2,"0");
    el.innerHTML=[[d,"يوم"],[h,"ساعة"],[m,"دقيقة"],[s,"ثانية"]].map(([v,l])=>`<div><b>${p(v)}</b><small>${l}</small></div>`).join("")})},
  async seats(){if(!API.seats||!S.user)return;let L=[];try{L=await API.seats()||[]}catch(e){return}
    L.forEach(x=>{const el=document.querySelector(`[data-seat="${x.session_id}"]`);if(!el)return;
      el.innerHTML=x.my_status==="waitlist"?'<span class="chip gold">⏳ أنت بقائمة الانتظار</span>':x.capacity?`<span class="chip">${x.going>=x.capacity?"🔴 ممتلئ":"🎟 "+(x.capacity-x.going)+" مقعد باقي"}${x.waitlist?` · ${x.waitlist} بالانتظار`:""}</span>`:""})}
};
setInterval(()=>{try{V4A.tick()}catch(e){}},1000);

// شاشة البداية لما ينفتح كتطبيق
(function(){if(!(matchMedia("(display-mode: standalone)").matches||navigator.standalone))return;const d=document.createElement("div");d.className="v2a-splash";d.innerHTML='<div><img src="logo-mark.png" alt=""><b>VEXORA</b><small>فيكسورا · أكاديمية التداول</small></div>';document.body.appendChild(d);
  const go=()=>{d.classList.add("out");setTimeout(()=>d.remove(),500)};addEventListener("load",()=>setTimeout(go,500));setTimeout(go,2500)})();

window.addEventListener("hashchange",()=>{render();window.scrollTo(0,0);setTimeout(fillCertPrev,30);setTimeout(v2IndState,60)});
API.onAuth(async()=>{await loadAll();render();setTimeout(fillCertPrev,30);IND.mine=null;setTimeout(v2IndState,60)});
(async()=>{try{await loadAll()}catch(e){console.error("[VEXORA] academy load failed:",e);$("view").innerHTML=`<div class="wrap"><div class="empty" style="margin-top:30px">تعذّر تحميل الأكاديمية حالياً، يرجى المحاولة بعد قليل.<br><button type="button" class="btn gold sm" style="margin-top:12px" onclick="location.reload()">إعادة المحاولة</button></div></div>`;return}render();setTimeout(fillCertPrev,30);setTimeout(v2IndState,80);VXI.auto();if(S.user&&API.pushSub)setTimeout(()=>PUSH.nudge(S.info.vapid_public,ipushSave,"خلي الدروس والتوصيات توصلك على الموبايل"),5000)})();
})();
