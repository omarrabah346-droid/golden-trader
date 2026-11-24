
(function(){
"use strict";
/* ================= config ================= */
const SYMS=[
  {s:"XAU/USD",n:"الذهب",pip:.1,dec:2,lot:100,p:4088,vol:.0022,q:"usd"},
  {s:"EUR/USD",n:"يورو/دولار",pip:.0001,dec:5,lot:1e5,p:1.158,vol:.0011,q:"usd"},
  {s:"GBP/USD",n:"باوند/دولار",pip:.0001,dec:5,lot:1e5,p:1.312,vol:.0013,q:"usd"},
  {s:"USD/JPY",n:"دولار/ين",pip:.01,dec:3,lot:1e5,p:153.4,vol:.0013,q:"base"},
  {s:"AUD/USD",n:"أسترالي/دولار",pip:.0001,dec:5,lot:1e5,p:.6555,vol:.0014,q:"usd"},
  {s:"USD/CAD",n:"دولار/كندي",pip:.0001,dec:5,lot:1e5,p:1.402,vol:.0009,q:"base"},
  {s:"USD/CHF",n:"دولار/فرنك",pip:.0001,dec:5,lot:1e5,p:.805,vol:.0011,q:"base"},
  {s:"GBP/JPY",n:"باوند/ين",pip:.01,dec:3,lot:1e5,p:201.3,vol:.0017,q:"jpy"},
  {s:"XAG/USD",n:"الفضة",pip:.01,dec:3,lot:5000,p:48.6,vol:.0035,q:"usd"},
  {s:"BTC/USD",n:"بيتكوين",pip:1,dec:2,lot:1,p:95000,vol:.006,q:"usd"},
  {s:"ETH/USD",n:"إيثريوم",pip:.1,dec:2,lot:1,p:3200,vol:.008,q:"usd"}
];
const TFS={M5:{td:"5min",bn:"5m",s:300,w:.3},M15:{td:"15min",bn:"15m",s:900,w:.5},M30:{td:"30min",bn:"30m",s:1800,w:.75},H1:{td:"1h",bn:"1h",s:3600,w:1},H4:{td:"4h",bn:"4h",s:14400,w:1.5},D1:{td:"1day",bn:"1d",s:86400,w:2}};
const TFK=Object.keys(TFS);
const MTFK=["M15","H1","H4","D1"];
const W={tech:.30,cls:.20,smc:.15,wav:.15,tim:.10,num:.10};
const TH=30, ZZ=2.2;
const NAMES={smc:"Smart Money",tech:"التحليل الفني",cls:"التحليل الكلاسيكي",wav:"التحليل الموجي",tim:"التحليل الزمني",num:"التحليل الرقمي"};
const SUBS={smc:"كسر الهيكل BOS، تغيّر الاتجاه CHOCH، الفجوات FVG، Premium و Discount",tech:"المتوسطات، RSI، MACD، ستوكاستك، ADX، بولنجر",cls:"هيكل السوق، الدعوم والمقاومات، النماذج",wav:"عدّ إليوت الآلي ومستويات فيبوناتشي",tim:"دورات الزمن، فيبوناتشي الزمني، الجلسات",num:"إحصاءات السعر والتذبذب والمدى اليومي"};

const $=id=>document.getElementById(id);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clamp=(x,a=-100,b=100)=>Math.max(a,Math.min(b,x));
let SERVER_SCAN=false,TD_BLOCK=0;
const nextUtcMidnight=()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1,0,3)};
const creditMsg=()=>`خلص رصيد الأسعار الحقيقية لليوم (800 طلب). ترجع الأسعار الحقيقية لحالها الساعة ${new Date(TD_BLOCK).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}.`;
let S={sym:SYMS[0],tf:"H1",key:"",candles:[],src:"",A:null,plan:null,alt:null,mtf:{},bt:[],timer:null,tok:0};
try{const s=JSON.parse(localStorage.getItem("mizanfx")||"{}");S.sym=SYMS.find(x=>x.s===s.sym)||S.sym;S.tf=TFS[s.tf]?s.tf:S.tf;S.key=s.key||""}catch(e){}
const save=()=>{try{localStorage.setItem("mizanfx",JSON.stringify({sym:S.sym.s,tf:S.tf,key:S.key}))}catch(e){}};
const F=(v,d=S.sym.dec)=>v==null||!isFinite(v)?"—":v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const PIPS=(d)=>Math.round(Math.abs(d)/S.sym.pip);

/* ================= data ================= */
const cache={};
let nextSlot=0;
async function slot(){const now=Date.now(),at=Math.max(now,nextSlot);nextSlot=at+7600;if(at>now)await new Promise(r=>setTimeout(r,at-now))}
async function fetchTD(sym,tf){
  await slot();
  const u=`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym.s)}&interval=${TFS[tf].td}&outputsize=1000&timezone=UTC&apikey=${encodeURIComponent(S.key)}`;
  const r=await fetch(u);const j=await r.json();
  if(j.status==="error"||!j.values)throw new Error(j.message||"خطأ من مزوّد البيانات");
  return j.values.slice().reverse().map(v=>({time:Math.floor(Date.parse(v.datetime.length<=10?v.datetime+"T00:00:00Z":v.datetime.replace(" ","T")+"Z")/1000),open:+v.open,high:+v.high,low:+v.low,close:+v.close}));
}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function simulate(sym,tf){
  const T=TFS[tf],seed=[...sym.s].reduce((a,c)=>a*31+c.charCodeAt(0),7)+T.s;
  const r=rng(seed),n=1000,vol=sym.vol*Math.sqrt(T.s/3600);
  let p=sym.p,drift=0,out=[];const now=Math.floor(Date.now()/1000/T.s)*T.s;
  for(let i=0;i<n;i++){
    if(r()<.025)drift=(r()-.5)*vol*.7;
    const o=p,c=o*(1+drift+gauss(r)*vol);
    const h=Math.max(o,c)*(1+Math.abs(gauss(r))*vol*.45),l=Math.min(o,c)*(1-Math.abs(gauss(r))*vol*.45);
    out.push({time:now-(n-1-i)*T.s,open:o,high:h,low:l,close:c});p=c;
  }
  const k=sym.p/out[n-1].close;out.forEach(c=>{c.open*=k;c.high*=k;c.low*=k;c.close*=k});
  return out;
}
async function getData(sym,tf,force){
  const k=sym.s+"|"+tf,c=cache[k];
  if(c&&!force&&Date.now()-c.t<(c.src==="sim"?36e5:3e5))return c;
  let data=null,src="",err="",stale=null;
  // 1) أسعار السيرفر المشتركة (ما تصرف من رصيد Twelve Data)
  try{const r=await DB.candles(sym.s,tf);
    if(r&&r.data&&r.data.length>220){const cs=r.data.map(x=>({time:x[0],open:x[1],high:x[2],low:x[3],close:x[4]})),age=Date.now()-new Date(r.updated_at);
      if(age<Math.max(2*TFS[tf].s*1000,20*60e3)){data=cs;src="Twelve Data"}else stale=cs}}catch(e){}
  // 2) المفتاح مباشرة: للمدير دائماً، وللأعضاء بس إذا سيرفر التوصيات مطفي
  if(!data&&S.key&&(isAdminUser()||!SERVER_SCAN)&&Date.now()>=TD_BLOCK){try{data=await fetchTD(sym,tf);src="Twelve Data"}catch(e){err=e.message;if(/API credits|run out of/i.test(err)){TD_BLOCK=nextUtcMidnight();err=creditMsg()}}}
  else if(!data&&Date.now()<TD_BLOCK)err=creditMsg();
  if(!data&&stale){data=stale;src="Twelve Data"}
  if(!data){data=(c&&c.src==="sim")?c.data:simulate(sym,tf);src="sim"}
  return cache[k]={t:Date.now(),data,src,err};
}

/* ================= indicators (all causal) ================= */
function ema(v,p){const o=Array(v.length).fill(null),k=2/(p+1);const i0=v.findIndex(x=>x!=null);if(i0<0||v.length-i0<p)return o;
  let s=0;for(let i=i0;i<i0+p;i++)s+=v[i];o[i0+p-1]=s/p;for(let i=i0+p;i<v.length;i++)o[i]=v[i]*k+o[i-1]*(1-k);return o}
function sma(v,p){const o=Array(v.length).fill(null);let s=0,c=0;for(let i=0;i<v.length;i++){if(v[i]==null){s=0;c=0;continue}s+=v[i];c++;if(c>p){s-=v[i-p];c=p}if(c===p)o[i]=s/p}return o}
function stdev(v,p,m){return v.map((_,i)=>{if(m[i]==null)return null;let s=0;for(let j=i-p+1;j<=i;j++)s+=(v[j]-m[i])**2;return Math.sqrt(s/p)})}
function rsi(c,p=14){const o=Array(c.length).fill(null);if(c.length<=p)return o;let g=0,l=0;
  for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d}g/=p;l/=p;o[p]=l===0?100:100-100/(1+g/l);
  for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1];g=(g*(p-1)+Math.max(d,0))/p;l=(l*(p-1)+Math.max(-d,0))/p;o[i]=l===0?100:100-100/(1+g/l)}return o}
function indicators(cs){
  const n=cs.length,c=cs.map(x=>x.close),h=cs.map(x=>x.high),l=cs.map(x=>x.low);
  const tr=cs.map((x,i)=>i?Math.max(x.high-x.low,Math.abs(x.high-cs[i-1].close),Math.abs(x.low-cs[i-1].close)):x.high-x.low);
  const atr=Array(n).fill(null);if(n>15){let s=0;for(let i=1;i<=14;i++)s+=tr[i];atr[14]=s/14;for(let i=15;i<n;i++)atr[i]=(atr[i-1]*13+tr[i])/14}
  const e12=ema(c,12),e26=ema(c,26),macd=c.map((_,i)=>e12[i]!=null&&e26[i]!=null?e12[i]-e26[i]:null),sig=ema(macd,9);
  const hist=macd.map((m,i)=>m!=null&&sig[i]!=null?m-sig[i]:null);
  const raw=c.map((x,i)=>{if(i<13)return null;let hh=-Infinity,ll=Infinity;for(let j=i-13;j<=i;j++){hh=Math.max(hh,h[j]);ll=Math.min(ll,l[j])}return hh===ll?50:(x-ll)/(hh-ll)*100});
  const K=sma(raw,3),D=sma(K,3);
  const A=Array(n).fill(null),PD=Array(n).fill(null),MD=Array(n).fill(null),dx=Array(n).fill(null);
  let st=0,sp=0,sm=0;
  for(let i=1;i<n;i++){const up=h[i]-h[i-1],dn=l[i-1]-l[i],p_=up>dn&&up>0?up:0,m_=dn>up&&dn>0?dn:0;
    if(i<=14){st+=tr[i];sp+=p_;sm+=m_;if(i<14)continue}else{st=st-st/14+tr[i];sp=sp-sp/14+p_;sm=sm-sm/14+m_}
    PD[i]=st?100*sp/st:0;MD[i]=st?100*sm/st:0;dx[i]=PD[i]+MD[i]?100*Math.abs(PD[i]-MD[i])/(PD[i]+MD[i]):0}
  let cnt=0,acc=0;for(let i=14;i<n;i++){if(dx[i]==null)continue;if(cnt<14){acc+=dx[i];cnt++;if(cnt===14)A[i]=acc/14}else A[i]=(A[i-1]*13+dx[i])/14}
  const bm=sma(c,20),bs=stdev(c,20,bm),m50=sma(c,50),s50=stdev(c,50,m50);
  return{c,atr,macd,sig,e20:ema(c,20),e50:ema(c,50),e200:ema(c,200),rsi:rsi(c),hist,K,D,adx:A,pdi:PD,mdi:MD,bm,bs,m50,s50};
}

/* ================= zigzag ================= */
function zigzag(cs,atr,end){
  const piv=[];let dir=0,ei=0,ep=0,hiI=0,hiP=cs[0].high,loI=0,loP=cs[0].low;
  for(let i=1;i<=end;i++){const b=cs[i],th=(atr[i]||b.high-b.low)*ZZ;
    if(dir===0){if(b.high>hiP){hiP=b.high;hiI=i}if(b.low<loP){loP=b.low;loI=i}
      if(hiP-loP>=th){if(hiI>loI){piv.push({i:loI,p:loP,t:"L"});dir=1;ei=hiI;ep=hiP}else{piv.push({i:hiI,p:hiP,t:"H"});dir=-1;ei=loI;ep=loP}}continue}
    if(dir===1){if(b.high>=ep){ep=b.high;ei=i}else if(ep-b.low>=th){piv.push({i:ei,p:ep,t:"H"});dir=-1;ei=i;ep=b.low}}
    else{if(b.low<=ep){ep=b.low;ei=i}else if(b.high-ep>=th){piv.push({i:ei,p:ep,t:"L"});dir=1;ei=i;ep=b.high}}
  }
  return{piv,cur:dir?{i:ei,p:ep,t:dir===1?"H":"L",tent:true}:null};
}

/* ================= modules ================= */
function techA(I,e,px){
  const it=[],add=(v,t)=>it.push({v,t});
  const {e20,e50,e200,rsi:R,hist,K,D,adx,pdi,mdi,bm,bs}=I;
  if(e20[e]>e50[e]&&e50[e]>e200[e])add(30,"المتوسطات مرتبة صعوداً (EMA20 > 50 > 200)");
  else if(e20[e]<e50[e]&&e50[e]<e200[e])add(-30,"المتوسطات مرتبة هبوطاً (EMA20 < 50 < 200)");
  else add(px>e200[e]?10:-10,px>e200[e]?"السعر فوق EMA200 لكن المتوسطات متداخلة":"السعر تحت EMA200 لكن المتوسطات متداخلة");
  add(hist[e]>0?15:-15,hist[e]>0?"هيستوجرام MACD موجب":"هيستوجرام MACD سالب");
  if(hist[e]>0&&Math.min(hist[e-1],hist[e-2],hist[e-3])<=0)add(10,"تقاطع MACD صاعد حديث");
  if(hist[e]<0&&Math.max(hist[e-1],hist[e-2],hist[e-3])>=0)add(-10,"تقاطع MACD هابط حديث");
  const r=R[e];
  if(r>70)add(-15,`RSI عند ${r.toFixed(1)}: تشبّع شرائي`);else if(r<30)add(15,`RSI عند ${r.toFixed(1)}: تشبّع بيعي`);
  else if(r>55)add(10,`RSI ${r.toFixed(1)} فوق 55، زخم شرائي`);else if(r<45)add(-10,`RSI ${r.toFixed(1)} تحت 45، زخم بيعي`);
  else add(0,`RSI ${r.toFixed(1)} في منطقة حياد`);
  if(K[e]!=null&&D[e]!=null){if(K[e]>80&&K[e]<D[e])add(-10,`ستوكاستك ${K[e].toFixed(0)}: تقاطع هابط في منطقة التشبّع`);
    else if(K[e]<20&&K[e]>D[e])add(10,`ستوكاستك ${K[e].toFixed(0)}: تقاطع صاعد في منطقة التشبّع`)}
  if(adx[e]!=null){const a=adx[e];if(a>=25)add(pdi[e]>mdi[e]?15:-15,`ADX ${a.toFixed(0)}: ترند قوي ${pdi[e]>mdi[e]?"صاعد (+DI أعلى)":"هابط (−DI أعلى)"}`);
    else if(a<20)add(0,`ADX ${a.toFixed(0)}: لا يوجد ترند واضح`)}
  if(bm[e]!=null){const u=bm[e]+2*bs[e],l=bm[e]-2*bs[e];
    if(px>u)add(-10,"السعر خارج بولنجر العلوي، تمدد");else if(px<l)add(10,"السعر خارج بولنجر السفلي، تمدد")}
  return{s:clamp(it.reduce((a,x)=>a+x.v,0)),items:it,kv:[["RSI",r.toFixed(1)],["ADX",adx[e]?.toFixed(1)??"—"],["Stoch",K[e]?.toFixed(0)??"—"]]};
}
function zonesFrom(piv,atr){
  const pts=piv.slice(-40).map(x=>x.p).sort((a,b)=>a-b),tol=atr*.6,cl=[];
  for(const p of pts){const z=cl[cl.length-1];if(z&&p-z.b<=tol){z.b=p;z.n++;z.s+=p}else cl.push({a:p,b:p,n:1,s:p})}
  return cl.map(z=>({lo:z.a-atr*.15,hi:z.b+atr*.15,mid:z.s/z.n,n:z.n}));
}
function clsA(cs,I,e,zz,px,atr){
  const it=[],add=(v,t)=>it.push({v,t});const P=zz.piv,H=P.filter(x=>x.t==="H"),L=P.filter(x=>x.t==="L");
  let struct="غير محدد";
  if(H.length>=2&&L.length>=2){const hh=H.at(-1).p>H.at(-2).p,hl=L.at(-1).p>L.at(-2).p;
    if(hh&&hl){struct="صاعد";add(35,"هيكل صاعد: قمم وقيعان أعلى (HH / HL)")}
    else if(!hh&&!hl){struct="هابط";add(-35,"هيكل هابط: قمم وقيعان أدنى (LH / LL)")}
    else{struct="متذبذب";add(0,"هيكل متذبذب: لا توجد قمم وقيعان متتالية بنفس الاتجاه")}}
  const lh=H.at(-1),ll=L.at(-1);
  // double top/bottom
  if(H.length>=2&&L.length>=1){const a=H.at(-2),b=H.at(-1),mid=L.filter(x=>x.i>a.i&&x.i<b.i).at(-1);
    if(mid&&Math.abs(a.p-b.p)<=.5*atr){if(px<mid.p)add(-30,`قمة مزدوجة مؤكدة عند ${F(b.p)} وكسر خط العنق ${F(mid.p)}`);else if(px<b.p-atr)add(-10,`قمة مزدوجة محتملة عند ${F(b.p)}`)}}
  if(L.length>=2&&H.length>=1){const a=L.at(-2),b=L.at(-1),mid=H.filter(x=>x.i>a.i&&x.i<b.i).at(-1);
    if(mid&&Math.abs(a.p-b.p)<=.5*atr){if(px>mid.p)add(30,`قاع مزدوج مؤكد عند ${F(b.p)} وكسر خط العنق ${F(mid.p)}`);else if(px>b.p+atr)add(10,`قاع مزدوج محتمل عند ${F(b.p)}`)}}
  // head & shoulders
  if(P.length>=5){const q=P.slice(-5);
    if(q[0].t==="H"&&q[2].p>q[0].p&&q[2].p>q[4].p&&Math.abs(q[0].p-q[4].p)<=1.2*atr){const neck=Math.min(q[1].p,q[3].p);
      add(px<neck?-30:-12,px<neck?`رأس وكتفين مكتمل، كسر خط العنق ${F(neck)}`:`رأس وكتفين قيد التكوين، خط العنق ${F(neck)}`)}
    if(q[0].t==="L"&&q[2].p<q[0].p&&q[2].p<q[4].p&&Math.abs(q[0].p-q[4].p)<=1.2*atr){const neck=Math.max(q[1].p,q[3].p);
      add(px>neck?30:12,px>neck?`رأس وكتفين مقلوب مكتمل، اختراق خط العنق ${F(neck)}`:`رأس وكتفين مقلوب قيد التكوين، خط العنق ${F(neck)}`)}}
  const Z=zonesFrom(P,atr),sup=Z.filter(z=>z.mid<px).sort((a,b)=>b.mid-a.mid),res=Z.filter(z=>z.mid>=px).sort((a,b)=>a.mid-b.mid);
  const inS=sup.find(z=>px<=z.hi+.2*atr&&px-z.hi<.4*atr),inR=res.find(z=>px>=z.lo-.2*atr&&z.lo-px<.4*atr);
  if(inS)add(15,`السعر على منطقة دعم ${F(inS.lo)} – ${F(inS.hi)} (${inS.n} لمسات)`);
  if(inR)add(-15,`السعر تحت منطقة مقاومة ${F(inR.lo)} – ${F(inR.hi)} (${inR.n} لمسات)`);
  let s=it.reduce((a,x)=>a+x.v,0);if(I.adx[e]!=null&&I.adx[e]<20)s*=.7;
  return{s:clamp(Math.round(s)),items:it,struct,zones:Z,sup,res,kv:[["الهيكل",struct],["أقرب دعم",sup[0]?F(sup[0].mid):"—"],["أقرب مقاومة",res[0]?F(res[0].mid):"—"]]};
}
function smcA(cs,e,zz,px,atr){
  const it=[],add=(v,t)=>it.push({v,t});const P=zz.piv,H=P.filter(x=>x.t==="H"),L=P.filter(x=>x.t==="L");
  let trend=0;
  if(H.length>=2&&L.length>=2){const hh=H.at(-1).p>H.at(-2).p,hl=L.at(-1).p>L.at(-2).p;trend=hh&&hl?1:!hh&&!hl?-1:0}
  const lh=H.at(-1),ll=L.at(-1);
  if(lh&&px>lh.p){if(trend<0)add(30,`CHOCH صاعد: أول كسر لقمة ${F(lh.p)} عكس الاتجاه الهابط`);else add(20,`BOS صاعد: كسر قمة ${F(lh.p)} مع الاتجاه`)}
  else if(ll&&px<ll.p){if(trend>0)add(-30,`CHOCH هابط: أول كسر لقاع ${F(ll.p)} عكس الاتجاه الصاعد`);else add(-20,`BOS هابط: كسر قاع ${F(ll.p)} مع الاتجاه`)}
  else add(0,`لا يوجد كسر جديد. السعر بين قمة ${lh?F(lh.p):"—"} وقاع ${ll?F(ll.p):"—"}`);
  let bull=null,bear=null;
  for(let i=e;i>=Math.max(2,e-60)&&!(bull&&bear);i--){
    const a=cs[i-2],c=cs[i];
    if(!bull&&c.low>a.high&&c.low-a.high>=.1*atr){const lo=a.high,hi=c.low;let f=false;for(let j=i+1;j<=e;j++)if(cs[j].low<=lo){f=true;break}if(!f)bull={lo,hi}}
    if(!bear&&c.high<a.low&&a.low-c.high>=.1*atr){const lo=c.high,hi=a.low;let f=false;for(let j=i+1;j<=e;j++)if(cs[j].high>=hi){f=true;break}if(!f)bear={lo,hi}}
  }
  if(bull&&px>=bull.lo&&px-bull.hi<=1.5*atr)add(15,`فجوة سعرية صاعدة FVG غير ممتلئة ${F(bull.lo)} – ${F(bull.hi)}: منطقة طلب قريبة`);
  else if(bull)add(0,`FVG صاعدة غير ممتلئة عند ${F(bull.lo)} – ${F(bull.hi)}`);
  if(bear&&px<=bear.hi&&bear.lo-px<=1.5*atr)add(-15,`فجوة سعرية هابطة FVG غير ممتلئة ${F(bear.lo)} – ${F(bear.hi)}: منطقة عرض قريبة`);
  else if(bear)add(0,`FVG هابطة غير ممتلئة عند ${F(bear.lo)} – ${F(bear.hi)}`);
  let zoneLbl="—";
  if(lh&&ll&&lh.p>ll.p&&px<=lh.p&&px>=ll.p){const pos=(px-ll.p)/(lh.p-ll.p);
    if(pos>.5){zoneLbl="Premium";add(-10,`السعر في منطقة Premium (${(pos*100).toFixed(0)}% من آخر مدى): الأفضلية للبيع`)}
    else{zoneLbl="Discount";add(10,`السعر في منطقة Discount (${(pos*100).toFixed(0)}% من آخر مدى): الأفضلية للشراء`)}}
  return{s:clamp(it.reduce((a,x)=>a+x.v,0)),items:it,fvg:{bull,bear},
    kv:[["الاتجاه",trend>0?"صاعد":trend<0?"هابط":"متذبذب"],["FVG",bull&&bear?"الاثنين":bull?"صاعدة":bear?"هابطة":"لا يوجد"],["المنطقة",zoneLbl]]};
}
function imp(a){return a[0]<a[1]&&a[2]>a[0]&&a[2]<a[1]&&a[3]>a[1]&&a[4]>a[1]&&a[4]<a[3]&&a[5]>a[3]&&!((a[3]-a[2])<(a[1]-a[0])&&(a[3]-a[2])<(a[5]-a[4]))}
function wavA(zz,px,atr){
  const pts=[...zz.piv,...(zz.cur?[zz.cur]:[])],n=pts.length;
  const out={s:0,items:[],labels:[],zone:null,tg:[],inval:null,name:"لا يوجد عدّ موجي واضح",dir:0};
  if(n<4){out.items.push({v:0,t:"عدد القمم والقيعان غير كافٍ للعدّ"});return out}
  const cands=[];
  for(const d of[1,-1]){
    const v=pts.map(p=>p.p*d),B=x=>x*d,Z=(a,b)=>d>0?[Math.min(a,b),Math.max(a,b)]:[Math.min(-a,-b),Math.max(-a,-b)];
    const lab=(st,txt)=>txt.map((t,k)=>({i:pts[st+k].i,p:pts[st+k].p,t,top:pts[st+k].t==="H"}));
    if(n>=7){const a=v.slice(n-7,n-1);if(imp(a)){const len=a[5]-a[0];
      cands.push({pri:1,d,s:-50*d,name:"اكتملت 5 موجات، تصحيح ABC جارٍ",labels:lab(n-7,["0","1","2","3","4","5"]),
        tg:[B(a[5]-.382*len),B(a[5]-.618*len)],zone:Z(a[5]-.236*len,a[5]),inval:B(a[5]+.1*len),dir:-d,
        txt:`تصحيح متوقع نحو ${F(B(a[5]-.382*len))} ثم ${F(B(a[5]-.618*len))} (38.2% و61.8% من الدفعة)`});continue}}
    if(n>=6){const a=v.slice(n-6);if(imp(a)){const w1=a[1]-a[0];
      cands.push({pri:2,d,s:15*d,name:"الموجة 5 جارية، مرحلة متأخرة",labels:lab(n-6,["0","1","2","3","4","5?"]),
        tg:[B(a[4]+w1)],zone:null,inval:B(a[4]),dir:d,txt:`هدف الموجة 5 بالتساوي مع الموجة 1: ${F(B(a[4]+w1))}. الدخول متأخر، والانعكاس قريب`});continue}}
    if(n>=4){const a=v.slice(n-4),w1=a[1]-a[0],r=(a[1]-a[2])/w1;
      if(w1>0&&r>=.382&&r<=.886&&a[3]>a[1]){
        cands.push({pri:3,d,s:60*d,name:"الموجة 3 جارية",labels:lab(n-4,["0","1","2","3?"]),
          tg:[B(a[2]+1.618*w1),B(a[2]+2.618*w1)],zone:Z(a[1]-.3*atr*1,a[1]+.3*atr),inval:B(a[2]),dir:d,
          txt:`الموجة 2 صحّحت ${(r*100).toFixed(0)}% من الموجة 1. هدف الموجة 3 عند امتداد 161.8%: ${F(B(a[2]+1.618*w1))}`});continue}}
    if(n>=5){const a=v.slice(n-5),w1=a[1]-a[0],w3=a[3]-a[2];
      if(a[0]<a[1]&&a[2]>a[0]&&a[2]<a[1]&&a[3]>a[1]&&a[4]<a[3]&&a[4]>a[1]&&w3>=.9*w1){
        const zn=Z(a[3]-.5*w3,a[3]-.236*w3),mid=a[3]-.382*w3;
        cands.push({pri:4,d,s:45*d,name:"تصحيح الموجة 4 جارٍ، متوقع موجة 5",labels:lab(n-5,["0","1","2","3","4?"]),
          tg:[B(a[3]),B(mid+w1)],zone:zn,inval:B(a[1]),dir:d,
          txt:`منطقة نهاية الموجة 4 بين 23.6% و50% من الموجة 3. الإلغاء إذا دخل السعر منطقة الموجة 1 تحت ${F(B(a[1]))}`});continue}}
    if(n>=3){const a=v.slice(n-3),w1=a[1]-a[0],r=(a[1]-a[2])/w1;
      if(w1>=3*atr&&r>=.3&&r<=.886){
        cands.push({pri:5,d,s:35*d,name:"تصحيح موجة 2 محتمل",labels:lab(n-3,["0","1","2?"]),
          tg:[B(a[1]),B(a[1]-.55*w1+1.618*w1)],zone:Z(a[1]-.618*w1,a[1]-.5*w1),inval:B(a[0]),dir:d,
          txt:`السعر صحّح ${(r*100).toFixed(0)}% من الدفعة. أفضل منطقة لبداية الموجة 3 بين 50% و61.8%`});}}
  }
  cands.sort((a,b)=>a.pri-b.pri);const c=cands[0];
  if(c){Object.assign(out,c);out.items.push({v:c.s,t:c.name},{v:0,t:c.txt})}
  else out.items.push({v:0,t:"الحركة الحالية لا تطابق قواعد إليوت الدافعة، غالباً تصحيح أو تذبذب"});
  const prev=pts[n-2],cur=pts[n-1],len=Math.abs(cur.p-prev.p);
  if(len>0){const rt=Math.abs(cur.p-px)/len*100,up=cur.t==="H";
    out.fib={start:prev.p,end:cur.p,up};
    out.items.push({v:0,t:`الموجة الحالية ${up?"صاعدة":"هابطة"} من ${F(prev.p)} إلى ${F(cur.p)}، والسعر صحّح ${rt.toFixed(1)}% منها`});
    out.kv=[["المرحلة",c?c.labels.at(-1).t:"—"],["تصحيح الموجة",rt.toFixed(0)+"%"],["الإلغاء",c?F(c.inval):"—"]];}
  else out.kv=[["المرحلة","—"],["تصحيح الموجة","—"],["الإلغاء","—"]];
  return out;
}
function session(h){return h<7?"آسيا":h<12?"لندن":h<16?"تداخل لندن ونيويورك":h<21?"نيويورك":"ما بعد نيويورك"}
function timA(cs,e,zz,tf){
  const it=[],add=(v,t)=>it.push({v,t});const P=zz.piv,cur=zz.cur;
  let kv=[["الجلسة","—"],["مدة الموجة","—"],["متوسط الموجة","—"]];
  if(P.length>=4&&cur){
    const d=[];for(let k=Math.max(1,P.length-10);k<P.length;k++)d.push(P[k].i-P[k-1].i);
    const avg=d.reduce((a,b)=>a+b,0)/d.length,sd=Math.sqrt(d.reduce((a,b)=>a+(b-avg)**2,0)/d.length);
    const last=P.at(-1),bars=e-last.i,ratio=bars/avg,legDir=cur.t==="H"?1:-1;
    if(ratio>1.3)add(-25*legDir,`الحركة ${legDir>0?"الصاعدة":"الهابطة"} الحالية عمرها ${bars} شمعة، أطول من المتوسط (${avg.toFixed(0)}) بـ ${ratio.toFixed(1)}×، احتمال إرهاق زمني`);
    else if(ratio<.5)add(15*legDir,`الحركة ${legDir>0?"الصاعدة":"الهابطة"} في بدايتها زمنياً (${bars} من ${avg.toFixed(0)} شمعة بالمتوسط)`);
    else add(0,`عمر الحركة الحالية ${bars} شمعة مقابل متوسط ${avg.toFixed(0)} شمعة`);
    const fib=[8,13,21,34,55,89,144].find(f=>Math.abs(bars-f)<=1&&bars>=7);
    if(fib)add(-15*legDir,`مرّت ${bars} شمعة على آخر ${last.t==="H"?"قمة":"قاع"}، قريب من رقم فيبوناتشي ${fib}: نافذة انعكاس زمنية`);
    const t0=cs[last.i].time+(avg-sd/2)*TFS[tf].s,t1=cs[last.i].time+(avg+sd/2)*TFS[tf].s;
    const fmt=t=>new Date(t*1000).toLocaleString(window.LANG||"ar",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
    add(0,`النافذة المتوقعة للقمة/القاع القادم: ${fmt(Math.max(t0,cs[e].time))} إلى ${fmt(Math.max(t1,cs[e].time+TFS[tf].s))}`);
    kv=[["الجلسة","—"],["مدة الموجة",bars+" شمعة"],["متوسط الموجة",avg.toFixed(0)+" شمعة"]];
  }
  const nowT=cs[e].time,h=new Date(nowT*1000).getUTCHours(),dow=new Date(nowT*1000).getUTCDay();
  kv[0][1]=session(h);
  if(TFS[tf].s<=3600){const byH=Array(24).fill(0),cn=Array(24).fill(0);let all=0;
    for(let i=Math.max(0,e-700);i<=e;i++){const hh=new Date(cs[i].time*1000).getUTCHours(),r=cs[i].high-cs[i].low;byH[hh]+=r;cn[hh]++;all+=r}
    const avgAll=all/Math.min(e+1,701),hv=cn[h]?byH[h]/cn[h]:avgAll,rel=hv/avgAll;
    add(0,`جلسة ${session(h)}: تذبذب هذه الساعة ${rel>=1?"أعلى":"أقل"} من المتوسط بنسبة ${Math.abs((rel-1)*100).toFixed(0)}%`);}
  else add(0,`الجلسة الحالية: ${session(h)}`);
  if(dow===5&&h>=18)add(0,"قرب الإغلاق الأسبوعي: الفجوات واردة، والأفضل تقليل الحجم");
  return{s:clamp(it.reduce((a,x)=>a+x.v,0)),items:it,kv};
}
function numA(cs,I,e){
  const it=[],add=(v,t)=>it.push({v,t});const c=I.c,px=c[e];
  const z=I.s50[e]?(px-I.m50[e])/I.s50[e]:0;
  if(z>2)add(-25,`السعر أعلى من متوسطه بـ ${z.toFixed(1)} انحراف معياري: تمدد إحصائي`);
  else if(z<-2)add(25,`السعر أدنى من متوسطه بـ ${Math.abs(z).toFixed(1)} انحراف معياري: تمدد إحصائي`);
  else add(0,`Z-Score = ${z.toFixed(2)} (السعر ضمن نطاقه الطبيعي)`);
  const N=50;let sx=0,sy=0,sxy=0,sxx=0,syy=0;for(let k=0;k<N;k++){const y=c[e-N+1+k];sx+=k;sy+=y;sxy+=k*y;sxx+=k*k;syy+=y*y}
  const slope=(N*sxy-sx*sy)/(N*sxx-sx*sx),r=(N*sxy-sx*sy)/Math.sqrt((N*sxx-sx*sx)*(N*syy-sy*sy)),r2=r*r;
  add(Math.round(Math.sign(slope)*r2*50),`انحدار آخر 50 شمعة: ميل ${slope>=0?"+":""}${(slope/S.sym.pip).toFixed(1)} نقطة/شمعة، R² = ${r2.toFixed(2)} (${r2>.6?"ترند منتظم":r2>.3?"ترند ضعيف":"بدون ترند"})`);
  let lo=Infinity,hi=-Infinity;for(let i=e-99;i<=e;i++){lo=Math.min(lo,cs[i].low);hi=Math.max(hi,cs[i].high)}
  const pct=(px-lo)/(hi-lo)*100;add(0,`موقع السعر في مدى آخر 100 شمعة: ${pct.toFixed(0)}%`);
  let aa=0,ac=0;for(let i=e-99;i<=e;i++)if(I.atr[i]!=null){aa+=I.atr[i];ac++}
  const vr=I.atr[e]/(aa/ac);add(0,`التذبذب (ATR) ${vr>1.15?"يتوسع":vr<.85?"ينكمش":"مستقر"}: ${(vr*100).toFixed(0)}% من متوسطه، ${PIPS(I.atr[e])} نقطة للشمعة`);
  const roc=(px/c[e-10]-1)*100;add(roc>0?5:-5,`زخم آخر 10 شموع: ${roc>=0?"+":""}${roc.toFixed(2)}%`);
  const days={};for(let i=Math.max(0,e-800);i<=e;i++){const k=Math.floor(cs[i].time/86400);const d=days[k]||(days[k]={h:-Infinity,l:Infinity});d.h=Math.max(d.h,cs[i].high);d.l=Math.min(d.l,cs[i].low)}
  const ks=Object.keys(days).map(Number).sort((a,b)=>a-b),today=days[ks.at(-1)],prevD=ks.slice(-15,-1).map(k=>days[k].h-days[k].l);
  let adr=null,used=null;if(prevD.length>=3){adr=prevD.reduce((a,b)=>a+b,0)/prevD.length;used=(today.h-today.l)/adr*100;
    add(0,`المدى اليومي المتوسط ${PIPS(adr)} نقطة، واستُهلك اليوم ${used.toFixed(0)}% منه${used>90?"، الحركة المتبقية محدودة":""}`)}
  return{s:clamp(it.reduce((a,x)=>a+x.v,0)),items:it,kv:[["Z-Score",z.toFixed(2)],["R²",r2.toFixed(2)],["ADR",adr?PIPS(adr)+" نقطة":"—"]]};
}

/* ================= engine ================= */
function analyze(cs,I,e,tf){
  const px=cs[e].close,atr=I.atr[e];
  if(atr==null||I.e200[e]==null||I.adx[e]==null||e<110)return null;
  const zz=zigzag(cs,I.atr,e);
  const M={tech:techA(I,e,px),cls:clsA(cs,I,e,zz,px,atr),smc:smcA(cs,e,zz,px,atr),wav:wavA(zz,px,atr),tim:timA(cs,e,zz,tf),num:numA(cs,I,e)};
  let t=0;for(const k in W)t+=W[k]*M[k].s;
  return{e,px,atr,zz,M,base:Math.round(t),total:Math.round(t),I};
}
function planFor(A,d){
  // work in mirrored space so the logic is written once for buys
  const m=x=>x*d,px=m(A.px),atr=A.atr,I=A.I,e=A.e;
  const C=[];
  const zones=A.M.cls.zones.map(z=>d>0?{lo:z.lo,hi:z.hi,n:z.n,mid:z.mid}:{lo:-z.hi,hi:-z.lo,n:z.n,mid:-z.mid});
  zones.filter(z=>z.mid<px+.2*atr&&z.mid>px-3*atr).forEach(z=>C.push({lo:z.lo,hi:z.hi,w:Math.min(z.n,4),src:`${d>0?"دعم":"مقاومة"} (${z.n} لمسات)`}));
  const fb=A.M.wav.fib;if(fb&&((fb.up&&d>0)||(!fb.up&&d<0))){const s=m(fb.start),en=m(fb.end),L=en-s;
    C.push({lo:en-.618*L,hi:en-.382*L,w:1.5,src:"تصحيح فيبوناتشي 38.2%–61.8%"})}
  if(A.M.wav.zone&&A.M.wav.dir===d){const z=A.M.wav.zone.map(m).sort((a,b)=>a-b);C.push({lo:z[0],hi:z[1],w:2,src:"منطقة الموجة"})}
  [["EMA20",I.e20[e]],["EMA50",I.e50[e]]].forEach(([n,v])=>{v=m(v);if(v<px+.1*atr&&v>px-3*atr)C.push({lo:v-.25*atr,hi:v+.25*atr,w:1,src:n})});
  const fv=d>0?A.M.smc.fvg.bull:A.M.smc.fvg.bear;
  if(fv){const z=d>0?[fv.lo,fv.hi]:[-fv.hi,-fv.lo];if(z[1]<px+.2*atr&&z[1]>px-3*atr)C.push({lo:z[0],hi:z[1],w:1.5,src:"فجوة FVG"})}
  const ov=(a,b)=>a.lo<=b.hi&&b.lo<=a.hi;
  C.forEach(c=>{c.sc=c.w+C.filter(o=>o!==c&&ov(o,c)).reduce((s,o)=>s+o.w*.8,0)-Math.max(0,(px-c.hi)/atr)*.4;
    c.with=[c.src,...C.filter(o=>o!==c&&ov(o,c)).map(o=>o.src)]});
  C.sort((a,b)=>b.sc-a.sc);
  let lo,hi,type,srcs;const best=C[0];
  if(!best||best.hi>=px-.3*atr){lo=px-.25*atr;hi=px;type="market";srcs=best?[...new Set(best.with)]:["السعر الحالي"]}
  else{lo=best.lo;hi=Math.min(best.hi,px-.1*atr);type="limit";srcs=[...new Set(best.with)]}
  if(hi<lo)hi=lo+.2*atr;
  const entry=(lo+hi)/2;
  const lows=A.zz.piv.filter(p=>p.t===(d>0?"L":"H")).map(p=>m(p.p)).filter(p=>p<lo&&p>lo-2.5*atr);
  let sl=Math.min(lo,...lows)-.4*atr;
  const risk0=entry-sl;if(risk0<1*atr)sl=entry-1*atr;if(risk0>3.5*atr)sl=entry-3.5*atr;
  const risk=entry-sl;
  const T=[];
  zones.filter(z=>z.lo>entry).forEach(z=>T.push({p:z.lo-.1*atr,src:`${d>0?"مقاومة":"دعم"} (${z.n} لمسات)`}));
  if(fb){const s=m(fb.start),en=m(fb.end);if(en>s){const L=en-s;T.push({p:s+1.272*L,src:"امتداد فيبوناتشي 127.2%"},{p:s+1.618*L,src:"امتداد فيبوناتشي 161.8%"})}}
  if(A.M.wav.dir===d)A.M.wav.tg.forEach(t=>T.push({p:m(t),src:"هدف موجي"}));
  const cand=T.filter(t=>t.p>=entry+risk).sort((a,b)=>a.p-b.p);
  const tps=[];let last=entry;
  const pick=(minR,fb_)=>{const c=cand.find(t=>t.p>=entry+minR*risk&&t.p>=last+.5*risk);const fp=Math.max(entry+fb_*risk,last+risk);const r=c||{p:fp,src:`مضاعف ${((fp-entry)/risk).toFixed(1)}R`};last=r.p;tps.push(r)};
  pick(1,1.5);pick(1.8,2.5);pick(2.8,4);
  const back=v=>v*d,bz=d>0?[lo,hi]:[-hi,-lo];
  return{d,type,lo:bz[0],hi:bz[1],entry:back(entry),sl:back(sl),risk,
    tps:tps.map(t=>({p:back(t.p),src:t.src,r:(t.p-entry)/risk})),srcs};
}
function decide(A,mtfAdj){
  const t=clamp(A.base+mtfAdj);A.total=t;
  return t>=TH?1:t<=-TH?-1:0;
}

/* ================= backtest ================= */
function backtest(cs,I,tf){
  const out=[];let prevDir=0,pend=null,pos=null;
  for(let i=220;i<cs.length;i++){
    const b=cs[i];
    if(pend&&!pos){
      const hit=pend.d>0?b.low<=pend.entry:b.high>=pend.entry;
      if(hit){pos={...pend,fillT:b.time};pend=null}
      else if(i-pend.i>12)pend=null;
    }
    if(pos){
      const sl=pos.d>0?b.low<=pos.sl:b.high>=pos.sl,tp=pos.d>0?b.high>=pos.tp:b.low<=pos.tp;
      if(sl||tp){pos.res=sl?-1:pos.rr;out.push(pos);pos=null}
    }
    if(i>=cs.length-1)break;
    const A=analyze(cs,I,i,tf);if(!A){prevDir=0;continue}
    const dir=decide(A,0);
    if(dir&&dir!==prevDir&&!pos&&!pend){const p=planFor(A,dir);
      if(p.type==="market"){pos={d:dir,entry:cs[i+1].open,sl:p.sl,tp:p.tps[1].p,i,fillT:cs[i+1].time};
        const rk=Math.abs(pos.entry-pos.sl);pos.rr=rk?Math.abs(pos.tp-pos.entry)/rk:0;
        if((dir>0&&pos.entry<=pos.sl)||(dir<0&&pos.entry>=pos.sl)||pos.rr<.8)pos=null}
      else pend={d:dir,entry:p.entry,sl:p.sl,tp:p.tps[1].p,i,rr:Math.abs(p.tps[1].p-p.entry)/Math.abs(p.entry-p.sl)}}
    prevDir=dir;
  }
  if(pos){pos.res=null;out.push(pos)}
  return out;
}


/* ================= helpers ================= */
S.tab="tech";
const signed=v=>(v>0?"+":"")+v;
const esc=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const pctOf=t=>Math.min(100,Math.abs(Math.round(t)));
const fx=(v,dec)=>v==null||!isFinite(v)?"—":v.toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec});
const hm=t=>new Date(t*1000).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const dayStart=()=>{const d=new Date();d.setHours(0,0,0,0);return Math.floor(d.getTime()/1000)};
const chipOf=d=>d>0?'<span class="chip buy">شراء</span>':d<0?'<span class="chip sell">بيع</span>':'<span class="chip">انتظار</span>';

/* ================= sessions ================= */
const SESS=[{n:"سيدني",a:22,b:7},{n:"طوكيو",a:0,b:9},{n:"لندن",a:8,b:17},{n:"نيويورك",a:13,b:22}];
const inS=(h,s)=>s.a<s.b?h>=s.a&&h<s.b:h>=s.a||h<s.b;
function renderSessions(){
  const now=new Date(),h=now.getUTCHours()+now.getUTCMinutes()/60,dow=now.getUTCDay();
  const weekend=dow===6||(dow===0&&h<22)||(dow===5&&h>=22);
  const loc=u=>{const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),u));return d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})};
  const until=t=>{let x=(t-h+24)%24;return x<1?Math.round(x*60)+" د":x.toFixed(1).replace(".0","")+" س"};
  const open=SESS.filter(s=>!weekend&&inS(h,s));
  $("sessions").innerHTML=SESS.map(s=>{const o=!weekend&&inS(h,s);
    return`<div class="se${o?" open":""}"><b>${s.n}</b><span class="st">${weekend?"السوق مغلق":o?"مفتوحة · تغلق بعد "+until(s.b):"تفتح بعد "+until(s.a)}</span><span class="h">${loc(s.a)} – ${loc(s.b)}</span></div>`}).join("")+
    `<p class="label" style="margin:2px 0 0">أقوى حركة غالباً وقت تداخل لندن ونيويورك (${loc(13)} – ${loc(17)}).</p>`;
  $("sessNow").textContent=weekend?"السوق مغلق":open.length?open.map(s=>s.n).join(" + "):"هادئة";
  $("clock").textContent=now.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
}

/* ================= chart ================= */
let chart,cS,l20,l50,l200,zzS,lines=[],rC,rS,mC,mH,mL,mSg;
function mk(el,ts){
  return LightweightCharts.createChart(el,{autoSize:true,
    layout:{background:{color:"transparent"},textColor:css("--muted"),fontFamily:"IBM Plex Mono, monospace",fontSize:11},
    grid:{vertLines:{color:css("--line-2")},horzLines:{color:css("--line-2")}},
    rightPriceScale:{borderColor:css("--line"),minimumWidth:78},
    timeScale:Object.assign({borderColor:css("--line"),timeVisible:true,secondsVisible:false},ts||{}),crosshair:{mode:0}});
}
function makeChart(){
  if(!window.LightweightCharts){$("chart").innerHTML='<p class="label" style="padding:20px">تعذّر تحميل مكتبة الرسم البياني. التحليل يعمل بدونها.</p>';return}
  chart=mk($("chart"),{visible:false});
  cS=chart.addCandlestickSeries({upColor:css("--buy"),downColor:css("--sell"),borderVisible:false,wickUpColor:css("--buy"),wickDownColor:css("--sell")});
  const L=(c,w=1.5)=>chart.addLineSeries({color:c,lineWidth:w,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
  l20=L("#d4a84a");l50=L("#5b8def");l200=L("#a06bd6");zzS=L("#9a9aa3",1);
  rC=mk($("rsiChart"),{visible:false});
  rS=rC.addLineSeries({color:"#D4AF37",lineWidth:1.5,priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false});
  rS.createPriceLine({price:70,color:css("--sell"),lineWidth:1,lineStyle:2,axisLabelVisible:false});
  rS.createPriceLine({price:30,color:css("--buy"),lineWidth:1,lineStyle:2,axisLabelVisible:false});
  mC=mk($("macdChart"));
  mH=mC.addHistogramSeries({priceLineVisible:false,lastValueVisible:false});
  mL=mC.addLineSeries({color:"#5b8def",lineWidth:1.5,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
  mSg=mC.addLineSeries({color:"#D4AF37",lineWidth:1.5,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
  let busy=false;
  const sync=(a,others)=>a.timeScale().subscribeVisibleLogicalRangeChange(r=>{if(!r||busy)return;busy=true;others.forEach(o=>o.timeScale().setVisibleLogicalRange(r));busy=false});
  sync(chart,[rC,mC]);sync(rC,[chart,mC]);sync(mC,[chart,rC]);
}
function drawChart(full){
  if(!cS)return;const cs=S.candles,A=S.A,I=A.I,sym=S.sym;
  const ws=a=>cs.map((c,i)=>a[i]==null?{time:c.time}:{time:c.time,value:a[i]});
  const hc=v=>v>=0?"rgba(52,201,142,.55)":"rgba(240,96,111,.55)";
  if(full){
    cS.applyOptions({priceFormat:{type:"price",precision:sym.dec,minMove:Math.pow(10,-sym.dec)}});
    cS.setData(cs);
    const ln=a=>cs.map((c,i)=>a[i]==null?null:{time:c.time,value:a[i]}).filter(Boolean);
    l20.setData(ln(I.e20));l50.setData(ln(I.e50));l200.setData(ln(I.e200));
    rS.setData(ws(I.rsi));mL.setData(ws(I.macd));mSg.setData(ws(I.sig));
    mH.setData(cs.map((c,i)=>I.hist[i]==null?{time:c.time}:{time:c.time,value:I.hist[i],color:hc(I.hist[i])}));
    chart.timeScale().setVisibleLogicalRange({from:cs.length-150,to:cs.length+6});
  }else{
    const e=cs.length-1,t=cs[e].time;cS.update(cs[e]);
    if(I.rsi[e]!=null)rS.update({time:t,value:I.rsi[e]});
    if(I.hist[e]!=null){mH.update({time:t,value:I.hist[e],color:hc(I.hist[e])});mL.update({time:t,value:I.macd[e]});mSg.update({time:t,value:I.sig[e]})}
  }
  const pts=[...A.zz.piv,...(A.zz.cur?[A.zz.cur]:[])].filter(p=>p.i>=cs.length-400);
  zzS.setData(pts.map(p=>({time:cs[p.i].time,value:p.p})));
  const mk_=[];
  (A.M.wav.labels||[]).forEach(l=>mk_.push({time:cs[l.i].time,position:l.top?"aboveBar":"belowBar",color:css("--accent"),shape:"circle",text:l.t,size:.6}));
  S.bt.forEach(t=>mk_.push({time:t.fillT,position:t.d>0?"belowBar":"aboveBar",color:t.res==null?css("--accent"):t.res>0?css("--buy"):css("--sell"),shape:t.d>0?"arrowUp":"arrowDown"}));
  mk_.sort((a,b)=>a.time-b.time);cS.setMarkers(mk_);
  lines.forEach(l=>cS.removePriceLine(l));lines=[];
  const pl=(price,color,title,style=2)=>lines.push(cS.createPriceLine({price,color,lineWidth:1,lineStyle:style,axisLabelVisible:true,title}));
  const p=S.plan;
  if(p){pl(p.hi,css("--accent"),"دخول");pl(p.lo,css("--accent"),"");pl(p.sl,css("--sell"),"SL",0);p.tps.forEach((t,k)=>pl(t.p,css("--buy"),"TP"+(k+1),0))}
  else{const c=A.M.cls;[c.sup[0],c.res[0]].forEach((z,k)=>{if(z)pl(z.mid,css("--muted"),k?"مقاومة":"دعم",1)})}
  if(window.__v3&&__v3.lines&&__v3.lines.sym===sym.s&&__v3.lines.tf===S.tf)__v3.lines.L.forEach(l=>pl(l.p,l.c,l.t,2));
}

/* ================= main render ================= */
function renderTicket(){
  const A=S.A,p=S.plan,d=p?p.d:0,pct=pctOf(A.total);
  $("verdict").className="vhead "+(d>0?"buy":d<0?"sell":"wait");
  $("vText").textContent=d>0?"BUY":d<0?"SELL":"WAIT";
  $("vConf").textContent=d?`${d>0?"شراء":"بيع"} · ثقة ${pct>=60?"عالية":pct>=45?"جيدة":"متوسطة"}`:`لا صفقة الآن · النسبة أقل من ${TH}%`;
  $("vScore").textContent=pct+"%";$("ringArc").style.strokeDashoffset=String(326.7*(1-pct/100));
  $("symName").textContent=`${S.sym.s} · ${S.tf}`;
  if(p){
    $("otype").innerHTML=`<span class="chip ${d>0?"buy":"sell"}">${d>0?"Buy":"Sell"} ${p.type==="market"?"Market":"Limit"}</span><span class="label">${p.type==="market"?"السعر داخل منطقة الدخول":"انتظر وصول السعر للمنطقة"}</span>`;
    $("levels").innerHTML=
      `<div class="lv entry wide"><span class="k">منطقة الدخول</span><span class="v">${F(p.lo)} – ${F(p.hi)}</span><span class="s">${p.srcs.slice(0,3).join(" + ")}</span></div>`+
      `<div class="lv sl"><span class="k">وقف الخسارة</span><span class="v">${F(p.sl)}</span><span class="x">-${PIPS(p.entry-p.sl)} نقطة</span></div>`+
      p.tps.map((t,k)=>`<div class="lv tp"><span class="k">الهدف ${k+1}</span><span class="v">${F(t.p)}</span><span class="x">+${PIPS(t.p-p.entry)} · 1:${t.r.toFixed(1)}</span></div>`).join("");
    $("slp").value=PIPS(p.entry-p.sl);
  }else{
    const b=S.altB,s=S.altS;
    $("otype").innerHTML=`<span class="chip">انتظار</span><span class="label">لا يوجد توافق كافٍ بين التحليلات</span>`;
    $("levels").innerHTML=[["سيناريو شراء",b,"up"],["سيناريو بيع",s,"down"]].map(([n,x,c])=>
      `<div class="lv wide"><span class="k">${n}</span><span class="v ${c}">${F(x.lo)} – ${F(x.hi)}</span><span class="s">SL ${F(x.sl)} · الهدف ${F(x.tps[0].p)} · ${x.srcs.slice(0,2).join(" + ")}</span></div>`).join("");
    const z=A.total>=0?b:s;$("slp").value=PIPS(z.entry-z.sl);
  }
  const all=[];for(const k in A.M)A.M[k].items.forEach(x=>{if(x.v)all.push({...x,k,w:Math.abs(x.v)*W[k]})});
  const dir=d||Math.sign(A.total)||1;
  const pro=all.filter(x=>Math.sign(x.v)===dir).sort((a,b)=>b.w-a.w).slice(0,6),con=all.filter(x=>Math.sign(x.v)===-dir).sort((a,b)=>b.w-a.w).slice(0,3);
  const li=x=>`<li class="${x.v>0?"p":"n"}">${x.t}<small>${NAMES[x.k].replace("التحليل ","")}</small></li>`;
  $("reasons").innerHTML=pro.map(li).join("")||"<li>لا توجد أسباب كافية</li>";
  $("against").innerHTML=con.map(li).join("");$("againstWrap").hidden=!con.length;
  if(p){const o=S.altOpp;$("alt").innerHTML=`<span class="label">السيناريو البديل</span><span>إذا أُغلقت شمعة ${S.tf} ${d>0?"تحت":"فوق"} <span class="num">${F(p.sl)}</span> تُلغى الصفقة، والانعكاس ${d>0?"للبيع":"للشراء"} مرجّح نحو <span class="num">${F(o.tps[0].p)}</span>.</span>`;$("alt").hidden=false}
  else $("alt").hidden=true;
  $("sigTime").textContent=`المصدر: ${S.src==="sim"?"محاكاة":S.src} · آخر شمعة ${new Date(S.candles.at(-1).time*1000).toLocaleString(window.LANG||"ar",{dateStyle:"medium",timeStyle:"short"})}`;
}
function renderHead(){
  setTimeout(()=>newsBar().catch(()=>{}),0);
  const cs=S.candles,px=cs.at(-1).close,ds=dayStart();
  $("price").textContent=F(px);
  const back=Math.max(0,cs.length-1-Math.round(86400/TFS[S.tf].s)),ch=(px/cs[back].close-1)*100;
  $("chg").innerHTML=`<span class="${ch>=0?"up":"down"}">${ch>=0?"+":""}${ch.toFixed(2)}%</span> <span class="label">24س</span>`;
  const td=cs.filter(c=>c.time>=ds);
  $("ohlc").textContent=td.length?`H ${F(Math.max(...td.map(c=>c.high)))}  L ${F(Math.min(...td.map(c=>c.low)))}`:"";
}
function renderDesks(){
  const A=S.A;
  $("tabs").innerHTML=Object.keys(W).map(k=>{const s=A.M[k].s;
    return`<button type="button" role="tab" id="tab-${k}" data-tab="${k}" aria-selected="${k===S.tab}">${NAMES[k]} <span class="chip ${s>=20?"buy":s<=-20?"sell":""} num">${signed(s)}</span></button>`}).join("");
  const m=A.M[S.tab];
  try{V2.cons(A)}catch(e){}
  $("deskBody").innerHTML=`<div class="label">${S.tab==="wav"?m.name:SUBS[S.tab]} · وزن ${Math.round(W[S.tab]*100)}%</div>`+
    (m.kv?`<div class="kvs">${m.kv.map(([a,b])=>`<div><div class="label">${a}</div><div class="v">${b}</div></div>`).join("")}</div>`:"")+
    `<ul class="list">${m.items.map(x=>`<li class="${x.v>0?"p":x.v<0?"n":""}">${x.t}</li>`).join("")}</ul>`;
}
$("tabs").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(!b)return;S.tab=b.dataset.tab;renderDesks()});
function renderMTF(){
  $("mtf").innerHTML=MTFK.map(tf=>{const r=S.mtf[tf];
    if(!r)return`<tr><td class="num">${tf}</td><td colspan="4" class="label">جاري التحميل…</td></tr>`;
    if(r.na)return`<tr><td class="num">${tf}</td><td colspan="4" class="label">بيانات غير كافية</td></tr>`;
    const c=r.s>=20?"up":r.s<=-20?"down":"flat";
    return`<tr${tf===S.tf?' class="cur"':""}><td class="num">${tf}</td><td class="${c}">${r.s>=20?"صاعد":r.s<=-20?"هابط":"محايد"}</td><td>${r.struct}</td><td class="num">${r.rsi.toFixed(0)}</td><td class="num ${c}">${signed(r.s)}</td></tr>`}).join("");
}
function renderBT(){
  const T=S.bt,done=T.filter(t=>t.res!=null),w=done.filter(t=>t.res>0).length,net=done.reduce((s,t)=>s+t.res,0);
  const gw=done.filter(t=>t.res>0).reduce((s,t)=>s+t.res,0),gl=-done.filter(t=>t.res<0).reduce((s,t)=>s+t.res,0);
  const days=Math.round((S.candles.at(-1).time-S.candles[220].time)/86400);
  $("perfSym").textContent=`${S.sym.s} · ${S.tf} · ${days} يوم`;
  $("pWin").textContent=done.length?(w/done.length*100).toFixed(0)+"%":"—";
  $("pKv").innerHTML=[["الصفقات",`${w} / ${done.length}`],["معامل الربح",gl?(gw/gl).toFixed(2):"—"],["الصافي",(net>=0?"+":"")+net.toFixed(1)+"R"]]
    .map(([a,b])=>`<div><div class="label">${a}</div><div class="v">${b}</div></div>`).join("");
  $("trades").innerHTML=T.slice(-12).reverse().map((t,k)=>`<tr><td class="num">${T.length-k}</td><td>${chipOf(t.d)}</td>
    <td class="num">${new Date(t.fillT*1000).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
    <td class="num">${F(t.entry)}</td><td class="num">${F(t.sl)}</td><td class="num">${F(t.tp)}</td>
    <td class="num ${t.res==null?"":t.res>0?"up":"down"}">${t.res==null?"مفتوحة":(t.res>0?"+":"")+t.res.toFixed(1)+"R"}</td></tr>`).join("")
    ||`<tr><td colspan="7" class="label">لم تظهر صفقات في هذه الفترة.</td></tr>`;
}
function pipValue(){const s=S.sym,px=S.candles.at(-1).close;
  if(s.q==="usd")return s.lot*s.pip;if(s.q==="base")return s.lot*s.pip/px;
  const uj=cache["USD/JPY|"+S.tf]?.data?.at(-1)?.close||153;return s.lot*s.pip/uj}
function renderRisk(){
  if(!S.candles.length)return;
  const bal=+$("bal").value||0,rp=+$("rp").value||0,sl=+$("slp").value||0,pv=pipValue(),risk=bal*rp/100,lots=sl&&pv?risk/(sl*pv):0;
  $("lotBig").textContent=lots?lots.toFixed(lots<.1?3:2)+" lot":"—";
  const tp=S.plan?S.plan.tps[1]:null;
  $("riskOut").innerHTML=[["المخاطرة",`$${risk.toFixed(2)}`],["قيمة النقطة",`$${pv.toFixed(2)}`],["ربح الهدف 2",tp?`+$${(risk*tp.r).toFixed(0)}`:"—"]]
    .map(([a,b])=>`<div><div class="label">${a}</div><div class="v">${b}</div></div>`).join("");
}
["bal","rp","slp"].forEach(id=>$(id).addEventListener("input",renderRisk));

/* ================= flow ================= */
function compute(full){
  const cs=S.candles,I=indicators(cs),e=cs.length-1;
  const A=analyze(cs,I,e,S.tf);if(!A){S.A=null;return false}
  let adj=0,ws=0,acc=0;for(const tf of MTFK){if(tf===S.tf)continue;const r=S.mtf[tf];if(r&&!r.na){acc+=Math.sign(r.s)*(Math.abs(r.s)>=20?1:0)*TFS[tf].w;ws+=TFS[tf].w}}
  if(ws)adj=Math.round(acc/ws*12);
  A.mtfAdj=adj;
  const d=decide(A,adj);S.A=A;
  S.plan=d?planFor(A,d):null;S.altB=planFor(A,1);S.altS=planFor(A,-1);S.altOpp=d>0?S.altS:S.altB;
  if(adj)A.M.tech.items.push({v:adj,t:`الفريمات الأخرى ${adj>0?"تميل للصعود":"تميل للهبوط"} (تعديل ${signed(adj)})`});
  if(full)S.bt=backtest(cs,I,S.tf);
  return true;
}
function renderAll(full){
  if(!compute(full)){$("vText").textContent="—";$("vConf").textContent="بيانات غير كافية";return}
  renderHead();renderTicket();renderDesks();renderMTF();if(full)renderBT();drawChart(full);renderRisk();
}
async function loadMTF(tok){
  for(const tf of MTFK){
    if(tok!==S.tok)return;
    const c=tf===S.tf?{data:S.candles}:await getData(S.sym,tf,false);
    const cs=c.data,I=indicators(cs),e=cs.length-1;
    if(e<220||I.e200[e]==null||I.adx[e]==null){S.mtf[tf]={na:true};continue}
    const zz=zigzag(cs,I.atr,e),t=techA(I,e,cs[e].close),k=clsA(cs,I,e,zz,cs[e].close,I.atr[e]);
    S.mtf[tf]={s:Math.round(t.s*.6+k.s*.4),struct:k.struct,rsi:I.rsi[e],adx:I.adx[e],above:cs[e].close>I.e200[e]};
    if(tok===S.tok)renderMTF();
  }
  if(tok===S.tok)renderAll(false);
}
async function load(){
  const tok=++S.tok;clearInterval(S.timer);$("goBtn").disabled=true;$("goBtn").textContent="جارٍ…";$("mainArea").classList.add("loading");
  const c=await getData(S.sym,S.tf,true);if(tok!==S.tok)return;
  S.candles=c.data.map(x=>({...x}));S.src=c.src;S.mtf={};
  const sim=c.src==="sim";
  $("modePill").className="pill "+(sim?"sim":"live");$("modeText").textContent=sim?"أسعار محاكاة":"أسعار حية · "+c.src;
  $("simBanner").hidden=!sim;
  $("simWhy").textContent=c.err?(/^خلص رصيد/.test(c.err)?c.err:`تعذّر جلب الأسعار: ${c.err}`):S.key?"تعذّر الاتصال بمزوّد البيانات من هنا. افتح الموقع من رابطه على GitHub.":"أضف مفتاح Twelve Data من زر \"الإعدادات\" فوق للحصول على أسعار حقيقية. التحليل هنا على شموع مولّدة لعرض طريقة العمل فقط.";
  renderAll(true);$("mainArea").classList.remove("loading");$("goBtn").disabled=false;$("goBtn").textContent="تحديث";
  renderWatch();
  loadMTF(tok);
  S.timer=setInterval(async()=>{
    if(sim){const cs=S.candles,l=cs.at(-1),T=TFS[S.tf].s,nb=Math.floor(Date.now()/1000/T)*T,px=l.close*(1+(Math.random()-.5)*S.sym.vol*.25);
      if(nb>l.time){cs.push({time:nb,open:l.close,high:Math.max(l.close,px),low:Math.min(l.close,px),close:px});renderAll(true)}
      else{l.close=px;l.high=Math.max(l.high,px);l.low=Math.min(l.low,px);renderAll(false)}}
    else{if(document.hidden)return;const d=await getData(S.sym,S.tf,true);if(tok!==S.tok||d.src==="sim")return;const nb=d.data.at(-1).time!==S.candles.at(-1).time;S.candles=d.data.map(x=>({...x}));renderAll(nb)}
  },sim?3000:300000);
}

/* ================= today's trades tracking ================= */
function trackPlan(cs,i,p){
  const d=p.d,n=cs.length;let st="pending",fill=null,entry=p.entry,best=0,endT=null;
  if(p.type==="market"){if(i+1>=n)return{st:"open",entry,best:0,fill:null,endT:null};fill=i+1;entry=cs[i+1].open;st="open"}
  for(let j=i+1;j<n;j++){
    const b=cs[j];
    if(fill==null){if(j-i>12){st="expired";break}if(!(d>0?b.low<=p.entry:b.high>=p.entry))continue;fill=j;st="open"}
    if(d>0?b.low<=p.sl:b.high>=p.sl){st=best?"tp"+best+"_sl":"sl";endT=b.time;break}
    while(best<3&&(d>0?b.high>=p.tps[best].p:b.low<=p.tps[best].p))best++;
    if(best===3){st="tp3";endT=b.time;break}
  }
  if(st==="open"&&best)st="tp"+best+"_open";
  return{st,entry,best,fill,endT};
}
function stInfo(g){
  const t=g.tr,p=g.plan,pp=x=>Math.round(Math.abs(x)/g.sym.pip),tpP=t.best?pp(p.tps[t.best-1].p-t.entry):0;
  if(t.st==="pending")return{k:"pending",l:"بانتظار التفعيل",c:"acc",pips:null};
  if(t.st==="expired")return{k:"expired",l:"انتهت بدون تفعيل",c:"",pips:null};
  if(t.st==="sl")return{k:"loss",l:"ضربت الوقف",c:"sell",pips:-pp(t.entry-p.sl)};
  if(t.st==="tp3")return{k:"win",l:"الهدف 3 ✓",c:"buy",pips:tpP};
  if(t.st.endsWith("_sl"))return{k:"win",l:`الهدف ${t.best} ✓ ثم الوقف`,c:"buy",pips:tpP};
  if(t.best)return{k:"win",l:`الهدف ${t.best} ✓ مفتوحة`,c:"buy",pips:tpP};
  return{k:"open",l:"مفتوحة",c:"acc",pips:null};
}
function scanSym(sym,cs,tf){
  const keep=S.sym;S.sym=sym;
  try{
    const I=indicators(cs),n=cs.length,e=n-1,A=analyze(cs,I,e,tf);
    const back=Math.max(0,e-Math.round(86400/TFS[tf].s));
    const row={px:cs[e].close,chg:(cs[e].close/cs[back].close-1)*100,d:0,pct:0};
    if(A){row.d=decide(A,0);row.pct=pctOf(A.total);if(row.d)row.plan=planFor(A,row.d)}
    const ds=dayStart(),first=cs.findIndex(c=>c.time>=ds),sigs=[];
    if(first>=0){let prev=0,until=-1;
      for(let i=Math.max(220,first-30);i<n;i++){
        const a=analyze(cs,I,i,tf);if(!a){prev=0;continue}
        const d=decide(a,0);
        if(d&&d!==prev&&cs[i].time>=ds&&cs[i].time>until){
          const p=planFor(a,d),tr=trackPlan(cs,i,p);
          until=tr.endT!=null?tr.endT:tr.st==="expired"?cs[Math.min(n-1,i+13)].time:Infinity;
          sigs.push({id:`${sym.s}|${tf}|${cs[i].time}`,sym,tf,time:cs[i].time,d,plan:p,tr,pct:pctOf(a.total),A:a,age:cs[e].time-cs[i].time});
        }
        prev=d;
      }}
    return{row,sigs};
  }finally{S.sym=keep}
}

/* ================= telegram ================= */
const SC={syms:["XAU/USD","EUR/USD","GBP/USD","USD/JPY"],auto:false,tg:{token:"",chat:""},sumHour:23,sent:{},stSent:{},sumDay:"",rows:{},day:{},busy:false};
try{const v=JSON.parse(localStorage.getItem("gat-scan2")||"{}");
  Object.assign(SC,{syms:v.syms||SC.syms,auto:!!v.auto,tg:v.tg||SC.tg,sumHour:v.sumHour??23,sent:v.sent||{},stSent:v.stSent||{},sumDay:v.sumDay||""})}catch(e){}
function saveSC(){
  const old=Date.now()/1000-3*86400;
  for(const k in SC.sent)if(+k.split("|")[2]<old){delete SC.sent[k];delete SC.stSent[k]}
  try{localStorage.setItem("gat-scan2",JSON.stringify({syms:SC.syms,auto:SC.auto,tg:SC.tg,sumHour:SC.sumHour,sent:SC.sent,stSent:SC.stSent,sumDay:SC.sumDay}))}catch(e){}
}
const tgReady=()=>!!(SC.tg.token&&String(SC.tg.chat||"").trim());
const chatList=()=>String(SC.tg.chat||"").split(/[\s,]+/).filter(Boolean);
async function tgSend(text,to){
  if(!SC.tg.token||!(to||chatList().length))throw new Error("أضف توكن البوت ورقم القناة من الإعدادات");
  const targets=to?[to]:chatList(),errs=[];let ok=0;
  for(const chat of targets){
    const u=`https://api.telegram.org/bot${SC.tg.token}/sendMessage?chat_id=${encodeURIComponent(chat)}&parse_mode=HTML&disable_web_page_preview=true&text=${encodeURIComponent(text)}`;
    try{const r=await fetch(u);const j=await r.json();if(j.ok)ok++;else errs.push(`${chat}: ${j.description||"رُفضت"}`)}
    catch(e){try{await fetch(u,{mode:"no-cors"});ok++}catch(e2){errs.push(`${chat}: فشل الاتصال`)}}
  }
  if(!ok)throw new Error(errs.join(" · ")||"تيليجرام رفض الرسالة");
  if(errs.length)SC.tgErr=errs.join(" · ");
  return true;
}
function reasonsOf(A,d,n){const all=[];for(const k in A.M)A.M[k].items.forEach(x=>{if(x.v&&Math.sign(x.v)===d)all.push({t:x.t,w:Math.abs(x.v)*W[k]})});return all.sort((a,b)=>b.w-a.w).slice(0,n).map(x=>x.t)}
const RLM="‏",SEP="━━━━━━━━━━━━━━━",BRAND="👑 <b>فيكسورا</b>  |  VEXORA SIGNALS",FOOT="● 👑 <b>فيكسورا</b> 💎";
function sigText(r){
  const f=v=>fx(v,r.sym.dec),p=r.plan,buy=r.d>0,pp=x=>Math.round(Math.abs(x)/r.sym.pip);
  const sim=r.src==="sim"?"  (محاكاة)":"";
  if(!p)return[BRAND,SEP,`${RLM}⏸ <b>${r.sym.s}</b> · ${r.tf} · لا توجد صفقة الآن`,`${RLM}📊 نسبة الدخول: <b>${r.pct}/100</b>`].join("\n");
  const L=[BRAND,SEP,
    `${RLM}${buy?"🟢":"🔴"} <b>${buy?"شراء":"بيع"}  ${r.sym.s}</b>  ·  ${buy?"Buy":"Sell"} ${p.type==="market"?"Market":"Limit"}${sim}`,
    `${RLM}⏱ الفريم: <b>${r.tf}</b>   |   📊 نسبة الدخول: <b>${r.pct}/100</b>`,
    SEP,"",
    `${RLM}📍 منطقة الدخول:  <b>${f(p.lo)} – ${f(p.hi)}</b>`,"",
    `${RLM}⛔ وقف الخسارة:  <b>${f(p.sl)}</b>   (−${pp(p.entry-p.sl)} نقطة)`,""];
  p.tps.forEach((t,k)=>L.push(`${RLM}🎯 الهدف ${k+1}:  <b>${f(t.p)}</b>   (+${pp(t.p-p.entry)} نقطة · 1:${t.r.toFixed(1)})`));
  const rs=reasonsOf(r.A,r.d,4);
  if(rs.length)L.push("",`<blockquote expandable>${RLM}💡 <b>أسباب الدخول</b>\n${rs.map(t=>RLM+"◆ "+esc(t)).join("\n")}</blockquote>`);
  L.push("",`${RLM}⚠️ <i>التزم بإدارة رأس المال · تحليل آلي وليس نصيحة استثمارية</i>`,FOOT);
  return L.join("\n");
}
function updText(g,info){
  const loss=info.k==="loss",pips=info.pips;
  return[BRAND,SEP,
    `${RLM}${loss?"❌":"✅"} <b>${esc(info.l)}</b>`,
    `${RLM}${g.d>0?"🟢 شراء":"🔴 بيع"} <b>${g.sym.s}</b> · ${g.tf} · من ${hm(g.time)}`,
    pips!=null?`${RLM}💰 النتيجة: <b>${pips>0?"+":""}${pips} نقطة</b>`:"",
    "",FOOT].filter((x,i,a)=>x!==""||a[i-1]!=="").join("\n");
}
function todayAll(){return Object.values(SC.day).flatMap(x=>x.sigs).sort((a,b)=>b.time-a.time)}
function tally(list){
  const r={win:0,loss:0,open:0,pending:0,pips:0};
  list.forEach(g=>{const i=stInfo(g);if(i.k in r)r[i.k]++;if(i.pips!=null)r.pips+=i.pips});
  r.rate=r.win+r.loss?Math.round(r.win/(r.win+r.loss)*100):null;return r;
}
function sumText(){
  const list=todayAll(),t=tally(list),day=new Date().toLocaleDateString("ar",{weekday:"long",day:"numeric",month:"long"});
  const L=[BRAND,SEP,`${RLM}📅 <b>ملخص اليوم</b> · ${day} · ${S.tf}`,SEP,"",
    `${RLM}✅ صفقات رابحة:  <b>${t.win}</b>`,`${RLM}❌ صفقات خاسرة:  <b>${t.loss}</b>`,`${RLM}⏳ مفتوحة: <b>${t.open}</b> · بانتظار التفعيل: <b>${t.pending}</b>`,"",
    `${RLM}🎯 نسبة النجاح:  <b>${t.rate==null?"—":t.rate+"%"}</b>`,`${RLM}💰 صافي اليوم:  <b>${t.pips>0?"+":""}${t.pips} نقطة</b>`];
  const rows=[];
  list.slice().reverse().forEach(g=>{const i=stInfo(g);if(i.k==="expired")return;
    rows.push(`${RLM}${i.k==="win"?"✅":i.k==="loss"?"❌":"⏳"} ${hm(g.time)} · <b>${g.sym.s}</b> ${g.d>0?"شراء":"بيع"} · ${esc(i.l)}${i.pips!=null?` (<b>${i.pips>0?"+":""}${i.pips}</b>)`:""}`)});
  if(rows.length)L.push("",`<blockquote expandable>${RLM}📋 <b>تفاصيل الصفقات</b>\n${rows.join("\n")}</blockquote>`);
  L.push("",`${RLM}⚠️ <i>تحليل آلي، وليس نصيحة استثمارية</i>`,FOOT);
  return L.join("\n");
}
async function notify(sigs,tf){
  const T=TFS[tf].s;
  for(const g of sigs){
    const info=stInfo(g);
    if(!(g.id in SC.sent)){
      if(g.age<=2*T&&info.k!=="expired"&&info.k!=="loss"){
        try{await tgSend(sigText({...g,src:"live"}));SC.sent[g.id]=1;SC.stSent[g.id]=info.l}catch(e){SC.tgErr=e.message}
      }else SC.sent[g.id]=0;
    }else if(SC.sent[g.id]===1&&SC.stSent[g.id]!==info.l&&(info.k==="win"||info.k==="loss")){
      try{await tgSend(updText(g,info));SC.stSent[g.id]=info.l}catch(e){SC.tgErr=e.message}
    }
  }
}

/* ================= scanner ================= */
async function runScan(){
  if(SC.busy)return;SC.busy=true;$("scanNow").disabled=true;$("scanStatus").textContent="جارٍ الفحص…";
  const tf=S.tf;let anySim=false;SC.tgErr="";
  for(const s of [...SC.syms]){
    const sym=SYMS.find(x=>x.s===s);if(!sym)continue;
    try{
      const c=await getData(sym,tf,false);if(c.src==="sim")anySim=true;
      const r=scanSym(sym,c.data,tf);
      SC.rows[s]={...r.row,src:c.src,checked:Date.now()};SC.day[s]={tf,sigs:r.sigs};
      if(c.src!=="sim"&&SC.auto&&!SERVER_SCAN&&tgReady()&&isAdminUser())await notify(r.sigs,tf);
    }catch(e){SC.rows[s]={err:e.message}}
    renderWatch();renderTicker();renderToday();
  }
  if(!anySim&&SC.auto&&!SERVER_SCAN&&tgReady()&&isAdminUser()){const now=new Date(),key=now.toDateString();
    if(now.getHours()>=SC.sumHour&&SC.sumDay!==key){try{await tgSend(sumText());SC.sumDay=key}catch(e){SC.tgErr=e.message}}}
  saveSC();SC.busy=false;$("scanNow").disabled=false;
  const nx=new Date(Date.now()+15*60000).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
  $("scanStatus").textContent=`آخر فحص ${new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})} · القادم ${nx}`+
    (SERVER_SCAN?" · 🖥 السيرفر يرسل التوصيات 24 ساعة، ما تحتاج تخلي الصفحة مفتوحة":SC.tgErr?` · تيليجرام: ${SC.tgErr}`:anySim?" · محاكاة، ما يُرسل شي تلقائياً":SC.auto?(tgReady()?" · الإرسال التلقائي شغّال، خلي الصفحة مفتوحة":" · أضف بيانات البوت من الإعدادات"):" · الإرسال التلقائي مطفي");
}
function renderWatch(){
  $("watch").innerHTML=SC.syms.map(s=>{const sym=SYMS.find(x=>x.s===s),r=SC.rows[s];
    const head=`<div><div class="n">${sym.n}</div><div class="s">${s}</div></div>`;
    if(!r)return`<div class="wi${sym===S.sym?" on":""}" data-s="${s}" role="button" tabindex="0">${head}<div class="label">…</div></div>`;
    if(r.err)return`<div class="wi" data-s="${s}" role="button" tabindex="0">${head}<div class="label">${esc(r.err).slice(0,40)}</div></div>`;
    return`<div class="wi${sym===S.sym?" on":""}" data-s="${s}" role="button" tabindex="0">${head}<div><div class="p">${fx(r.px,sym.dec)}</div><div class="sig"><span class="pc">${r.pct}%</span>${chipOf(r.d)}</div></div></div>`}).join("")
    ||`<p class="label">اختر أزواج من الإعدادات.</p>`;
}
function renderTicker(){
  $("ticker").innerHTML=SC.syms.map(s=>{const sym=SYMS.find(x=>x.s===s),r=SC.rows[s];
    if(!r||r.err)return`<button type="button" class="tk" data-s="${s}"><div class="r1"><b>${sym.n}</b><span class="label num">${s}</span></div><div class="label">…</div></button>`;
    return`<button type="button" class="tk" data-s="${s}"><div class="r1"><b>${sym.n}</b>${chipOf(r.d)}</div><div class="p">${fx(r.px,sym.dec)}</div><div class="r1"><span class="c ${r.chg>=0?"up":"down"}">${r.chg>=0?"+":""}${r.chg.toFixed(2)}%</span><span class="label num">${r.pct}%</span></div></button>`}).join("");
}
function renderToday(){
  const list=todayAll(),t=tally(list);
  $("todayTf").textContent=`${S.tf} · ${SC.syms.length} أزواج`;
  $("tWin").textContent=t.win;$("tLoss").textContent=t.loss;
  $("tKv").innerHTML=[["مفتوحة",t.open+(t.pending?` · ${t.pending} معلّقة`:"")],["نسبة النجاح",t.rate==null?"—":t.rate+"%"],["الصافي",`${t.pips>0?"+":""}${t.pips} نقطة`]]
    .map(([a,b])=>`<div><div class="label">${a}</div><div class="v">${b}</div></div>`).join("");
  $("todayTbl").innerHTML=list.map(g=>{const i=stInfo(g),f=v=>fx(v,g.sym.dec);
    return`<tr><td class="num">${hm(g.time)}</td><td><b>${g.sym.n}</b> <span class="label num">${g.sym.s}</span></td><td>${chipOf(g.d)}</td><td class="num">${g.pct}%</td>
      <td class="num">${f(g.tr.entry)}</td><td class="num down">${f(g.plan.sl)}</td><td class="num up">${f(g.plan.tps[0].p)}</td>
      <td><span class="chip ${i.c}">${i.l}</span></td><td class="num ${i.pips>0?"up":i.pips<0?"down":""}">${i.pips==null?"—":(i.pips>0?"+":"")+i.pips}</td></tr>`}).join("")
    ||`<tr><td colspan="9" class="label">ما طلعت صفقات اليوم لحد الآن على هذا الفريم.</td></tr>`;
}

/* ================= controls ================= */
function renderControls(){
  $("selSym").innerHTML=SYMS.map(x=>`<option value="${x.s}"${x===S.sym?" selected":""}>${x.n} · ${x.s}</option>`).join("");
  $("tfBtns").innerHTML=TFK.map(t=>`<button type="button" data-t="${t}" aria-pressed="${t===S.tf}">${t}</button>`).join("");
}
function pick(s){const x=SYMS.find(y=>y.s===s);if(!x)return;S.sym=x;renderControls();save();load()}
$("selSym").addEventListener("change",e=>pick(e.target.value));
$("tfBtns").addEventListener("click",e=>{const b=e.target.closest("[data-t]");if(!b||b.dataset.t===S.tf)return;S.tf=b.dataset.t;SC.rows={};SC.day={};renderControls();save();renderToday();load().then(runScan)});
$("goBtn").addEventListener("click",()=>{delete cache[S.sym.s+"|"+S.tf];load()});
$("watch").addEventListener("click",e=>{const w=e.target.closest("[data-s]");if(w)pick(w.dataset.s)});
$("watch").addEventListener("keydown",e=>{if(e.key==="Enter"){const w=e.target.closest("[data-s]");if(w)pick(w.dataset.s)}});
$("ticker").addEventListener("click",e=>{const w=e.target.closest("[data-s]");if(w)pick(w.dataset.s)});
$("scanNow").addEventListener("click",runScan);
$("setBtn").addEventListener("click",()=>{const p=$("settings");p.hidden=!p.hidden;$("setBtn").setAttribute("aria-expanded",String(!p.hidden));$("apikey").value=S.key});
$("saveKey").addEventListener("click",async()=>{S.key=$("apikey").value.trim();save();try{await DB.setConfig("twelve_key",S.key,false)}catch(e){$("keyMsg").textContent=e.message}Object.keys(cache).forEach(k=>delete cache[k]);$("keyMsg").textContent="جاري الاختبار…";
  await load();$("keyMsg").textContent=S.src==="Twelve Data"?"تم. الأسعار الآن حقيقية.":"المفتاح محفوظ لكن الاتصال لم ينجح: "+(cache[S.sym.s+"|"+S.tf]?.err||"المتصفح منع الاتصال");runScan()});
$("clearKey").addEventListener("click",()=>{S.key="";DB.setConfig("twelve_key","",false).catch(()=>{});$("apikey").value="";save();Object.keys(cache).forEach(k=>delete cache[k]);$("keyMsg").textContent="تم مسح المفتاح.";load().then(runScan)});
function renderScanCtl(){
  $("scanSyms").innerHTML=SYMS.map(x=>{const id="sc-"+x.s.replace("/","");return`<label for="${id}"><input type="checkbox" id="${id}" data-sc="${x.s}"${SC.syms.includes(x.s)?" checked":""}>${x.n}</label>`}).join("");
  $("autoSend").checked=SC.auto;$("tgToken").value=SC.tg.token;{const l=String(SC.tg.chat||"").split(/[\s,]+/).filter(Boolean);$("tgChat").value=l[0]||"";$("tgChat2").value=l[1]||""}$("tgAdmin").value=SC.tg.admin||"";$("tgNews").value=SC.tg.news||"";
  $("sumHour").innerHTML=Array.from({length:24},(_,h)=>`<option value="${h}"${h===SC.sumHour?" selected":""}>${String(h).padStart(2,"0")}:00</option>`).join("");
}
$("scanSyms").addEventListener("change",e=>{const v=e.target.dataset.sc;if(!v)return;const set=new Set(SC.syms);e.target.checked?set.add(v):set.delete(v);
  SC.syms=SYMS.map(x=>x.s).filter(x=>set.has(x));Object.keys(SC.day).forEach(k=>{if(!set.has(k))delete SC.day[k]});saveSC();renderWatch();renderTicker();renderToday()});
$("autoSend").addEventListener("change",e=>{SC.auto=e.target.checked;saveSC();$("tgMsg").textContent=SC.auto&&!tgReady()?"أضف التوكن ورقم المحادثة واضغط حفظ.":""});
$("sumHour").addEventListener("change",e=>{SC.sumHour=+e.target.value;saveSC()});
const readTg=()=>{SC.tg={token:$("tgToken").value.trim(),chat:[$("tgChat").value.trim(),$("tgChat2").value.trim()].filter(Boolean).join(","),admin:$("tgAdmin").value.trim(),news:$("tgNews").value.trim()};saveSC();DB.setConfig("tg_news",SC.tg.news,false).catch(()=>{});DB.setConfig("tg_admin",SC.tg.admin,false).catch(()=>{});DB.setConfig("tg_token",SC.tg.token,false).catch(()=>{});DB.setConfig("tg_chat",SC.tg.chat,false).catch(()=>{});
  const inv=$("tgInvite").value.trim();if(inv!==(ME.invite||"")){ME.invite=inv;DB.setConfig("tg_invite",inv,true).catch(()=>{})}
  const inv2=$("tgInvite2").value.trim();if(inv2!==(ME.invite2||"")){ME.invite2=inv2;DB.setConfig("tg_invite2",inv2,true).catch(()=>{})}};
$("tgFind").addEventListener("click",async()=>{
  const tok=$("tgToken").value.trim();if(!tok){$("tgMsg").textContent="الصق توكن البوت أولاً";return}
  $("tgMsg").textContent="جاري البحث…";
  try{const j=await(await fetch(`https://api.telegram.org/bot${tok}/getUpdates?allowed_updates=${encodeURIComponent('["channel_post","my_chat_member","message"]')}`)).json();
    if(!j.ok)throw new Error(j.description||"التوكن غلط");
    const chats={};(j.result||[]).forEach(u=>{const m=u.channel_post||u.my_chat_member||u.edited_channel_post||u.message;const c=m&&m.chat;if(c&&(c.type==="channel"||c.type==="supergroup"))chats[c.id]=c.title||c.username||c.id});
    const news=$("tgNews").value.trim(),found=Object.keys(chats).filter(id=>id!==news);
    const known=[$("tgChat").value.trim(),$("tgChat2").value.trim()].filter(k=>/^(-100\d+|@\w+)$/.test(k));
    const ids=[...new Set([...known,...found])].slice(0,2);
    if(!found.length&&!known.length){$("tgMsg").textContent="ما لقيت قنوات. انشر رسالة بكل قناة (والبوت مشرف بيها)، وبعدها اضغط الزر مرة ثانية.";return}
    $("tgChat").value=ids[0]||"";$("tgChat2").value=ids[1]||"";readTg();
    $("tgMsg").textContent="لقيت: "+ids.map(i=>`"${chats[i]||i}" (${i})`).join(" و ")+". انحفظ ✓ هسه اضغط \"إرسال رسالة تجربة\".";
  }catch(e){$("tgMsg").textContent=e instanceof TypeError?"المتصفح منع الاتصال بتيليجرام. جرّب من Chrome على الكمبيوتر.":e.message}
});
$("tgFindNews").addEventListener("click",async()=>{
  const tok=$("tgToken").value.trim();if(!tok){$("tgMsg").textContent="الصق توكن البوت أولاً";return}
  $("tgMsg").textContent="جاري البحث…";
  try{const j=await(await fetch(`https://api.telegram.org/bot${tok}/getUpdates?allowed_updates=${encodeURIComponent('["channel_post","my_chat_member"]')}`)).json();
    if(!j.ok)throw new Error(j.description||"التوكن غلط");
    const sig=[$("tgChat").value.trim(),$("tgChat2").value.trim()];let ch=null;
    (j.result||[]).forEach(u=>{const m=u.channel_post||u.my_chat_member;const c=m&&m.chat;if(c&&c.type==="channel"&&!sig.includes(String(c.id)))ch=c});
    if(!ch){$("tgMsg").textContent="ما لقيت قناة أخبار. تأكد إن البوت مشرف بيها، وانشر بيها رسالة، وبعدها اضغط الزر مرة ثانية.";return}
    $("tgNews").value=ch.id;readTg();
    await tgSend("👑 <b>فيكسورا</b>\n📰 هنا راح توصل أخبار الذهب والفوركس والكريبتو تلقائياً.",String(ch.id));
    $("tgMsg").textContent=`لقيت قناة الأخبار "${ch.title||ch.id}" (${ch.id}). انحفظت ✓ ووصلتها رسالة تجربة.`;
  }catch(e){$("tgMsg").textContent=e instanceof TypeError?"المتصفح منع الاتصال بتيليجرام. جرّب من Chrome على الكمبيوتر.":e.message}
});
$("tgFindMe").addEventListener("click",async()=>{
  const tok=$("tgToken").value.trim();if(!tok){$("tgMsg").textContent="الصق توكن البوت أولاً";return}
  $("tgMsg").textContent="جاري البحث…";
  try{const j=await(await fetch(`https://api.telegram.org/bot${tok}/getUpdates`)).json();
    if(!j.ok)throw new Error(j.description||"التوكن غلط");
    let me=null;(j.result||[]).forEach(u=>{const m=u.message;if(m&&m.chat&&m.chat.type==="private")me=m.chat});
    if(!me){$("tgMsg").textContent="ما لقيت محادثتك. افتح البوت بتيليجرام واضغط Start (أو اكتب له أي رسالة)، وبعدها اضغط الزر مرة ثانية.";return}
    $("tgAdmin").value=me.id;readTg();
    await tgSend("👑 <b>فيكسورا</b>\n✅ هنا راح توصلك تنبيهات طلبات الانضمام.",String(me.id));
    $("tgMsg").textContent=`لقيت محادثتك (${me.first_name||""} · ${me.id}). انحفظت ✓ ووصلتك رسالة تجربة بالخاص.`;
  }catch(e){$("tgMsg").textContent=e instanceof TypeError?"المتصفح منع الاتصال بتيليجرام. جرّب من Chrome على الكمبيوتر.":e.message}
});
$("tgSave").addEventListener("click",()=>{readTg();$("tgMsg").textContent=tgReady()?"تم الحفظ.":"أكمل الخانتين."});
$("tgTest").addEventListener("click",async()=>{readTg();SC.tgErr="";$("tgMsg").textContent="جاري الإرسال…";
  try{await tgSend("👑 <b>فيكسورا</b>\n✅ البوت متصل وجاهز لإرسال الصفقات");$("tgMsg").textContent=SC.tgErr?"أُرسلت لقناة وحدة بس: "+SC.tgErr:"أُرسلت ✓ إذا ما وصلت لكل قناة، تأكد إن البوت مشرف بيها."}catch(e){$("tgMsg").textContent=e.message}});
$("sendCur").addEventListener("click",async()=>{if(!S.A)return;$("sendMsg").textContent="جاري الإرسال…";
  try{await tgSend(sigText({sym:S.sym,tf:S.tf,src:S.src,A:S.A,d:S.plan?S.plan.d:0,plan:S.plan,pct:pctOf(S.A.total)}));$("sendMsg").textContent="أُرسلت إلى تيليجرام ✓"}catch(e){$("sendMsg").textContent=e.message}});
$("sendSum").addEventListener("click",async()=>{const b=$("sendSum");b.disabled=true;
  try{await tgSend(sumText());b.textContent="أُرسل الملخص ✓"}catch(e){b.textContent=e.message}setTimeout(()=>{b.disabled=false;b.textContent="إرسال ملخص اليوم لتيليجرام"},4000)});

/* ================= start ================= */
function startTerminal(){
  renderControls();renderScanCtl();renderSessions();renderWatch();renderTicker();renderToday();makeChart();
  load().then(()=>setTimeout(runScan,600));
  setInterval(runScan,15*60*1000);setInterval(renderSessions,20000);
}

/* ================= members: settings ================= */
const CONFIG={
  SUPABASE_URL:"https://rczvkpzxkwxzoivyiblo.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_S4Huon2QXOIltvxoFIDdXQ_h79LR245",
  BROKER_NAME:"INFINOX",
  BROKER_LINK:"https://myaccount.infinox.com/ar/links/go/9935360",
  SUPPORT_TG:"omo_rabah",   // يوزر تيليجرام للدعم (بدون @)
  OFFICIAL_TG:"sbworldmodel" // القناة الرسمية العامة (بدون @)
};

/* ================= members: data layer ================= */
const DEMO=!(CONFIG.SUPABASE_URL&&CONFIG.SUPABASE_ANON_KEY&&window.supabase);
const ERR={
  "Invalid login credentials":"الإيميل أو كلمة السر غلط",
  "Email not confirmed":"أكّد إيميلك أولاً من الرسالة اللي وصلتك",
  "User already registered":"هذا الإيميل مسجّل من قبل، سوّ دخول",
  "Password should be at least 6 characters":"كلمة السر لازم 6 أحرف أو أكثر",
  "Unable to validate email address: invalid format":"صيغة الإيميل غلط",
  "Unsupported provider: provider is not enabled":"تسجيل الدخول بـ Google مو مفعّل بعد",
};
const tr=e=>{const m=e&&e.message||String(e);for(const k in ERR)if(m.includes(k))return ERR[k];return m};
const here=()=>location.origin+location.pathname;


/* V4 backend adapters */
function mkV4Supa(sb,chk,meId){const R=(f,a)=>sb.rpc(f,a).then(chk);return{
  adsHome:()=>R("ads_home"),adNext:()=>R("ad_next"),adMark:(cid,act)=>R("ad_mark",{cid,act}),
  comps:async()=>chk(await sb.from("events").select("*").eq("kind","contest").neq("status","draft").order("ad_priority").order("created_at",{ascending:false}).limit(60)),
  comp:async id=>chk(await sb.from("events").select("*").eq("id",id).maybeSingle()),
  myEntries:async()=>chk(await sb.from("comp_entries").select("*").eq("user_id",meId())),
  myEntry:async cid=>chk(await sb.from("comp_entries").select("*").eq("comp_id",cid).eq("user_id",meId()).maybeSingle()),
  board:cid=>R("comp_board",{cid}),count:cid=>R("comp_participants",{cid}),winners:cid=>R("comp_winners_pub",{cid}),
  join:(cid,src,team)=>R("comp_join",{cid,src:src||"",team:team||""}),submit:(cid,ans,img)=>R("comp_submit",{cid,ans,img:img||""}),
  uploadEntry:async(cid,file)=>{const ext=(file.type.split("/")[1]||"jpg").replace("jpeg","jpg"),path=`${meId()}/${cid}/${Date.now()}.${ext}`;chk(await sb.storage.from("entries").upload(path,file,{contentType:file.type,upsert:false}));return path},
  entryUrl:async path=>{const r=await sb.storage.from("entries").createSignedUrl(path,600);if(r.error)throw r.error;return r.data.signedUrl},
  pred:(cid,d)=>R("pred_submit",{cid,d}),myPreds:async cid=>chk(await sb.from("pred_entries").select("*").eq("comp_id",cid).eq("user_id",meId()).order("day",{ascending:false}).limit(60)),
  paper:cid=>R("my_paper",{cid}),paperOpen:(cid,s,d,lots,sl,tp)=>R("paper_open",{cid,s,d,lots,sl,tp}),paperClose:tid=>R("paper_close",{tid}),
  points:()=>R("my_points"),ptsBoard:p=>R("pts_board",{period:p}),ledger:async()=>chk(await sb.from("points_ledger").select("*").eq("user_id",meId()).order("created_at",{ascending:false}).limit(60)),
  rules:async()=>chk(await sb.from("points_rules").select("*").order("points",{ascending:false})),saveRule:async(key,points,active)=>chk(await sb.from("points_rules").update({points,active}).eq("key",key)),
  rewards:async()=>chk(await sb.from("rewards").select("*").eq("active",true).order("cost",{ascending:true,nullsFirst:false})),
  myClaims:async()=>chk(await sb.from("reward_claims").select("*,rewards(title,icon,kind)").eq("user_id",meId()).order("created_at",{ascending:false})),
  myWins:async()=>chk(await sb.from("comp_winners").select("*").eq("user_id",meId())),claim:(rid,wid)=>R("reward_claim",{rid,wid}),
  gws:async()=>chk(await sb.from("giveaways").select("id,title,descr,prize,image_url,reg_from,reg_to,draw_at,winners,min_lessons,seed_hash,seed,entries_hash,result,drawn_at,status").order("created_at",{ascending:false}).limit(20)),
  gw:async id=>chk(await sb.from("giveaways").select("*").eq("id",id).maybeSingle()),gwInfo:gid=>R("gw_info",{gid}),gwEnter:gid=>R("gw_enter",{gid}),
  sessions:async()=>chk(await sb.from("live_sessions").select("id,title,starts_at,minutes,capacity,kind,cert").gte("starts_at",new Date(Date.now()-3*3600e3).toISOString()).order("starts_at").limit(20)),seats:()=>R("session_seats"),
  refStats:()=>R("my_ref_stats"),track:(c,a,p)=>R("track_visit",{c,a,pth:p||""}),setCamp:c=>R("set_my_campaign",{c}),
  aComps:async()=>chk(await sb.from("events").select("*").eq("kind","contest").order("created_at",{ascending:false}).limit(100)),aStats:()=>R("admin_comp_stats"),
  aSave:async row=>{const r={...row};delete r.id;if(row.id){chk(await sb.from("events").update(r).eq("id",row.id));return row.id}return chk(await sb.from("events").insert(r).select("id").single()).id},
  aSecret:async cid=>{const r=chk(await sb.from("comp_secrets").select("data").eq("comp_id",cid).maybeSingle());return r&&r.data},aSetSecret:async(cid,data)=>chk(await sb.from("comp_secrets").upsert({comp_id:cid,data})),
  aEntries:cid=>R("admin_comp_entries",{cid}),aReview:(eid,ok,sc,why)=>R("admin_comp_review",{eid,ok,sc,why:why||""}),aFinalize:(cid,uids)=>R("admin_comp_finalize",{cid,uids}),aPaperFlags:cid=>R("paper_flags",{cid}),
  aRewards:async()=>chk(await sb.from("rewards").select("*").order("id")),aRewardSave:async row=>chk(await sb.from("rewards").upsert(row)),aClaims:()=>R("admin_claims"),aDecide:(cid,st,dl,why)=>R("admin_reward_decide",{cid,st,dl,why:why||""}),
  aGwCreate:(ttl,dsc,prz,img,rto,dat,nw,ml)=>R("admin_gw_create",{ttl,dsc,prz,img,rto,dat,nw,ml}),aGwDraw:gid=>R("admin_gw_draw",{gid}),
  aCamps:()=>R("admin_campaigns"),aCampSave:async row=>chk(await sb.from("campaigns").insert(row)),aPromos:async()=>chk(await sb.from("promo_codes").select("*").order("created_at",{ascending:false})),aPromoSave:async row=>chk(await sb.from("promo_codes").upsert(row)),
  aRef:()=>R("admin_ref_monitor"),aGrowth:()=>R("admin_growth"),aPoints:(uid,d,nt)=>R("admin_points",{uid,d,nt}),
  aFindUser:async em=>chk(await sb.from("profiles").select("id,full_name,email").ilike("email",em).maybeSingle()),
  aSessions:async()=>chk(await sb.from("live_sessions").select("*").order("starts_at",{ascending:false}).limit(40)),aSessionSet:async(id,row)=>chk(await sb.from("live_sessions").update(row).eq("id",id)),
  uploadMedia:async file=>{const ext=(file.type.split("/")[1]||"jpg").replace("jpeg","jpg"),path=`comp/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;chk(await sb.storage.from("media").upload(path,file,{contentType:file.type,cacheControl:"3600"}));return sb.storage.from("media").getPublicUrl(path).data.publicUrl}
}}

/* النسخة التجريبية المحلية (للعرض والاختبار بدون سيرفر) */
function mkV4Demo(get,put,meId){
  const D=()=>{const d=get();if(!d.v4){const n=Date.now(),day=864e5,img=window.__V4_DEMO_IMG||"";d.v4={seq:100,
      comps:[{id:1,kind:"contest",title:"تحدي فيكسورا للذهب",body:"حلّل الذهب XAU/USD على فريم H4 واكتب السيناريو والدخول والوقف والأهداف. لجنة الكوتش تقيّم كل تحليل.",rules:"• تحليل واحد لكل عضو، ويتعدّل لحد نهاية الوقت.\n• التقييم من 100: الفكرة 40، إدارة المخاطرة 30، الوضوح 30.\n• ممنوع نسخ تحليل غيرك.",ctype:"analysis",status:"published",audience:"members",winners:3,entry_kind:"text_image",starts_at:new Date(n-2*day).toISOString(),ends_at:new Date(n+3*day+14*36e5+27*6e4).toISOString(),prizes:[{rank:1,text:"حساب ممول 10,000$",points:500,reward_id:5},{rank:2,text:"اشتراك VIP 3 أشهر",points:300},{rank:3,text:"مؤشر الباشا شهر",points:150}],prize:"حساب ممول 10,000$",cfg:{},image_url:img,popup_url:"",ad_home:true,ad_signup:true,ad_existing:true,ad_priority:1,created_at:new Date(n-2*day).toISOString()},
        {id:2,kind:"contest",title:"توقّع اتجاه الذهب اليومي",body:"صعود لو نزول لإغلاق اليوم؟ النتيجة تنحسب تلقائياً من سعر إغلاق السيرفر.",ctype:"prediction",status:"published",audience:"members",winners:3,entry_kind:"none",ends_at:new Date(n+20*day).toISOString(),prizes:[{rank:1,text:"+20 نقطة لكل توقع صحيح",points:200}],cfg:{sym:"XAU/USD",lock_hour:20},image_url:"",ad_home:true,ad_priority:2,created_at:new Date(n-day).toISOString()},
        {id:3,kind:"contest",title:"بطولة الحساب الورقي الشهرية",body:"رصيد ورقي 10,000$ بسعر السيرفر. الترتيب حسب العائد المعدّل بالمخاطرة، وأقصى تراجع 10%.",ctype:"paper",status:"published",audience:"members",winners:5,entry_kind:"none",ends_at:new Date(n+17*day).toISOString(),prizes:[{rank:1,text:"حساب ممول 10,000$",points:500,reward_id:5},{rank:2,text:"مؤشر الباشا 3 أشهر",points:300}],cfg:{balance:10000,max_dd:10,min_trades:10,max_risk:5,syms:["XAU/USD","EUR/USD","GBP/USD","USD/JPY"]},image_url:"",ad_home:true,ad_priority:3,created_at:new Date(n-3*day).toISOString()},
        {id:4,kind:"contest",title:"تحدي Smart Money",body:"5 أسئلة على BOS و CHOCH ومناطق FVG. تصحيح تلقائي.",ctype:"smc",status:"published",audience:"members",winners:10,entry_kind:"text",ends_at:new Date(n+6*day).toISOString(),prizes:[{rank:1,text:"دورة SMC + 300 نقطة",points:300}],cfg:{questions:[{q:"شنو يعني BOS؟",o:["كسر الهيكل باتجاه الترند","انعكاس الترند","فجوة سعرية"]},{q:"منطقة FVG هي؟",o:["فجوة سعرية غير ممتلئة","دعم كلاسيكي","مؤشر زخم"]},{q:"CHOCH يدل على؟",o:["استمرار","تغيّر الطابع (انعكاس محتمل)","سيولة"]}]},image_url:"",created_at:new Date(n-day).toISOString()},
        {id:5,kind:"contest",title:"دوري المحللين VIP",body:"مسابقة خاصة لأعضاء VIP: 4 جولات تحليل فني وموجي وزمني ورقمي.",ctype:"technical",status:"published",audience:"vip",winners:1,entry_kind:"text_image",ends_at:new Date(n+25*day).toISOString(),prizes:[{rank:1,text:"جلسة خاصة مع الكوتش"}],cfg:{},image_url:"",created_at:new Date(n-day).toISOString()},
        {id:6,kind:"contest",title:"ماراثون الدروس",body:"كمّل 10 دروس واجتاز اختباراتها بـ 80% أو أكثر قبل نهاية الشهر.",ctype:"lessons",status:"published",audience:"members",winners:20,entry_kind:"none",ends_at:new Date(n+14*day).toISOString(),prizes:[{rank:1,text:"شارة ماراثوني + 400 نقطة",points:400}],cfg:{min_score:80},image_url:"",created_at:new Date(n-4*day).toISOString()}],
      secrets:{4:{answers:[0,0,1]}},entries:[],preds:[],trades:[],winners:[],views:{},claims:[],
      ledger:[{id:1,delta:15,reason:"lesson_done",note:"خلّصت درس «مناطق FVG»",created_at:new Date(n-36e5).toISOString()},{id:2,delta:40,reason:"quiz_pass",note:"اجتزت اختبار «كسر الهيكل BOS» بـ 90%",created_at:new Date(n-2*36e5).toISOString()},{id:3,delta:100,reason:"referral_ok",note:"إحالة مؤهلة: سارة م.",created_at:new Date(n-day).toISOString()},{id:4,delta:30,reason:"event_attend",note:"حضرت جلسة الزوم المباشرة",created_at:new Date(n-3*day).toISOString()},{id:5,delta:1890,reason:"admin_adjust",note:"نقاط سابقة (بيانات تجريبية)",created_at:new Date(n-9*day).toISOString()}],
      rewards:[{id:1,title:"اشتراك VIP شهر",descr:"توصيات وتحليلات VIP لمدة 30 يوم.",icon:"👑",kind:"vip",cost:2000,stock:12,min_level:"silver",active:true},{id:2,title:"مؤشر الباشا شهر",descr:"تفعيل على يوزر TradingView مالتك.",icon:"📊",kind:"indicator",cost:1800,stock:8,min_level:"silver",active:true},{id:3,title:"كود خصم 30%",descr:"على أي دورة أو اشتراك، صالح 14 يوم.",icon:"🎟",kind:"coupon",cost:600,stock:40,min_level:"bronze",active:true},{id:4,title:"جلسة خاصة مع الكوتش",descr:"45 دقيقة زوم لمراجعة تداولك.",icon:"🧑‍🏫",kind:"session",cost:3500,stock:3,min_level:"diamond",active:true},{id:5,title:"حساب ممول كهدية",descr:"جائزة للفائزين بالمسابقات الكبيرة. نشتريه باسم الفائز من شركة تمويل، والشركة ترسل بيانات الدخول لإيميله مباشرة.",icon:"💼",kind:"funded",cost:null,stock:2,min_level:"bronze",active:true}],
      gws:[{id:1,title:"سحب مجاني: اشتراك VIP 3 أشهر",descr:"سحب شهري لأعضاء الأكاديمية.",prize:"اشتراك VIP 3 أشهر",reg_from:new Date(n-day).toISOString(),reg_to:new Date(n+4*day).toISOString(),winners:1,min_lessons:1,seed_hash:"9f2c4e81b7a05d3c6e1f8a2b47d90c5e3a18f6b2d4c7e90a1b3f5d8c2e6a4b71",status:"open",n:412,joined:[]}],
      camps:[{id:1,name:"تحدي الذهب · تيليجرام",goal:"comp",code:"gold-tg",channel:"telegram",comp_id:1,active:true,visits:3420,signups:412,activated:238,joins:197,conv:12.0},{id:2,name:"سحب VIP · إنستغرام",goal:"giveaway",code:"vip-ig",channel:"instagram",comp_id:null,active:true,visits:2180,signups:196,activated:101,joins:0,conv:9.0}],
      promos:[{code:"GOLD30",pct:30,max_uses:100,used:48,active:true},{code:"WELCOME10",pct:10,max_uses:null,used:211,active:true}],
      rules:[["lesson_done",15,"خلّصت درس"],["quiz_pass",40,"اجتزت اختبار درس (70% أو أكثر)"],["comp_join",10,"اشتركت بمسابقة"],["comp_accept",25,"انقبلت مشاركتك بمسابقة"],["pred_correct",20,"توقّع صحيح"],["referral_ok",100,"إحالة مؤهلة"],["event_attend",30,"حضرت فعالية مباشرة"]].map(([key,points,label])=>({key,points,label,active:true})),
      sessions:[{id:1,title:"بث زوم: خطة الذهب للأسبوع",starts_at:new Date(n+2*day).toISOString(),minutes:60,capacity:100,kind:"zoom",cert:false,going:84,waitlist:0,my:"going"},{id:2,title:"ورشة: رسم الموجات خطوة بخطوة",starts_at:new Date(n+5*day).toISOString(),minutes:90,capacity:30,kind:"workshop",cert:true,going:30,waitlist:3,my:"waitlist"},{id:3,title:"جلسة أسئلة وأجوبة مفتوحة",starts_at:new Date(n+6*day).toISOString(),minutes:45,capacity:200,kind:"qa",cert:false,going:44,waitlist:0,my:null}]};
      const fake=[["أحمد ع.",3120],["سارة م.",2860],["حسين ك.",2505],["زينب ر.",2010],["علي ح.",1740],["نور س.",1510]];d.v4.fake=fake;
      [["أحمد ع.",88],["سارة م.",81],["علي ح.",0],["نور س.",0],["مصطفى ج.",0]].forEach(([nm,sc],i)=>d.v4.entries.push({id:500+i,comp_id:1,user_id:"u"+i,name:nm,status:sc?"accepted":"pending",answer:"السعر فوق EMA200 والترند صاعد على H4. أنتظر تصحيح لمنطقة 4,060–4,068 (FVG + فيبو 61.8) وأدخل شراء مع شمعة رفض. الوقف تحت 4,048 والأهداف 4,105 ثم 4,128. العائد للمخاطرة 1:2.4.",image_path:i<2?"demo.png":"",score:sc||null,reason:"",src:i===2?"gold-tg":"",updated_at:new Date(n-(i+1)*36e5).toISOString()}));
      for(let i=0;i<81;i++)d.v4.entries.push({id:600+i,comp_id:1,user_id:"x"+i,name:"عضو "+i,status:"joined",updated_at:new Date(n-i*6e5).toISOString()});put()}return d.v4},
  me=()=>meId(),mine=v=>v.entries.filter(e=>e.user_id===me()),bal=v=>v.ledger.reduce((s,x)=>s+x.delta,0),earn=v=>v.ledger.filter(x=>x.delta>0).reduce((s,x)=>s+x.delta,0),
  lv=e=>e>=3000?"diamond":e>=1500?"gold":e>=500?"silver":"bronze",cnt=(v,cid)=>v.entries.filter(e=>e.comp_id===cid).length,nid=v=>++v.seq,
  addPts=(v,delta,reason,note)=>{v.ledger.unshift({id:nid(v),delta,reason,note,created_at:new Date().toISOString()})},
  px={"XAU/USD":4088.4,"EUR/USD":1.1584,"GBP/USD":1.3121,"USD/JPY":153.42},val=(s,p)=>s==="XAU/USD"?100:/\/USD$/.test(s)?100000:100000/p,
  eq=(v,cid)=>{const T=v.trades.filter(t=>t.comp_id===cid),cl=T.filter(t=>t.status==="closed").reduce((s,t)=>s+t.pnl,0),op=T.filter(t=>t.status==="open").reduce((s,t)=>s+(px[t.sym]-t.entry)*t.dir*t.lots*val(t.sym,px[t.sym]),0);return{cl,op,n:T.filter(t=>t.status==="closed").length}};
  return{
  adsHome:async()=>{const v=D();return v.comps.filter(c=>c.status==="published"&&c.ad_home&&new Date(c.ends_at)>Date.now()&&c.audience!=="vip").sort((a,b)=>a.ad_priority-b.ad_priority).map(c=>({...c,participants:cnt(v,c.id),eligible:true,joined:mine(v).some(e=>e.comp_id===c.id)}))},
  adNext:async()=>{const v=D(),c=v.comps.filter(c=>c.status==="published"&&(c.ad_signup||c.ad_existing)&&new Date(c.ends_at)>Date.now()&&c.audience!=="vip"&&!v.views[c.id]&&!mine(v).some(e=>e.comp_id===c.id)).sort((a,b)=>a.ad_priority-b.ad_priority)[0];
    if(!c)return null;v.views[c.id]={seen:1};put();return{id:c.id,title:c.title,body:c.body,ctype:c.ctype,image:c.popup_url||c.image_url,ends_at:c.ends_at,prize:c.prize,prizes:c.prizes,participants:cnt(v,c.id),winners:c.winners,audience:c.audience}},
  adMark:async(cid,act)=>{const v=D();v.views[cid]={...(v.views[cid]||{}),[act]:Date.now()};put()},
  comps:async()=>D().comps.filter(c=>c.status!=="draft"),comp:async id=>D().comps.find(c=>c.id===id)||null,myEntries:async()=>mine(D()),myEntry:async cid=>mine(D()).find(e=>e.comp_id===cid)||null,
  board:async cid=>{const v=D(),c=v.comps.find(x=>x.id===cid);let L=v.entries.filter(e=>e.comp_id===cid&&!["rejected","disqualified"].includes(e.status));
    if(c.ctype==="paper"){L=L.map(e=>{if(e.user_id===me()){const q=eq(v,cid);return{...e,score:+((q.cl+q.op)/100/1).toFixed(2)}}return e})}
    if(["analysis","technical","manual"].includes(c.ctype))L=L.filter(e=>e.status==="accepted");
    return L.sort((a,b)=>(b.score??-1e9)-(a.score??-1e9)).map((e,i)=>({pos:i+1,name:e.user_id===me()?"أنت":e.name,score:e.score,is_me:e.user_id===me(),uid:e.user_id,flag:null}))},
  count:async cid=>cnt(D(),cid),winners:async cid=>D().winners.filter(w=>w.comp_id===cid),
  join:async(cid,src)=>{const v=D(),c=v.comps.find(x=>x.id===cid);if(c.audience==="vip")throw new Error("المسابقة لأعضاء VIP");if(mine(v).some(e=>e.comp_id===cid))return;
    v.entries.push({id:nid(v),comp_id:cid,user_id:me(),name:"أنت",status:"joined",answer:"",src,score:c.ctype==="paper"?0:null,meta:{},updated_at:new Date().toISOString()});addPts(v,10,"comp_join","اشتركت بمسابقة: "+c.title);put()},
  submit:async(cid,ans,img)=>{const v=D(),c=v.comps.find(x=>x.id===cid),e=mine(v).find(x=>x.comp_id===cid);if(!e)throw new Error("اشترك بالمسابقة أول");if(new Date(c.ends_at)<Date.now())throw new Error("انتهى وقت المسابقة، ما تكدر تعدّل");
    if(c.ctype==="smc"||c.ctype==="quiz"){const a=JSON.parse(ans),k=(v.secrets[cid]||{}).answers||[];const ok=a.filter((x,i)=>x===k[i]).length;Object.assign(e,{status:"accepted",score:+(ok*100/k.length).toFixed(1),meta:{correct:ok,total:k.length}})}
    else{if(String(ans).trim().length<10)throw new Error("اكتب تحليلك (10 أحرف على الأقل)");Object.assign(e,{answer:ans,image_path:img||e.image_path||"",status:"pending",updated_at:new Date().toISOString()})}put()},
  uploadEntry:async(cid,f)=>"demo/"+f.name,entryUrl:async()=>"data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#111"/><text x="300" y="150" fill="#d4af37" font-size="24" text-anchor="middle">صورة الشارت (تجريبي)</text></svg>'),
  pred:async(cid,d)=>{const v=D(),day=new Date().toISOString().slice(0,10);if(v.preds.some(p=>p.comp_id===cid&&p.day===day))throw new Error("سويت توقّع اليوم. ما يتعدّل بعد الإرسال");if(!mine(v).some(e=>e.comp_id===cid))await this_join(cid);v.preds.unshift({comp_id:cid,day,dir:d,open_px:4074.2,close_px:null,correct:null});put()},
  myPreds:async cid=>{const v=D(),L=v.preds.filter(p=>p.comp_id===cid);if(!L.some(p=>p.day!==new Date().toISOString().slice(0,10))){const b=Date.now();[[1,4051.2,4066.8,true],[-1,4066.8,4071.5,false],[1,4071.5,4082.0,true],[1,4082.0,4074.2,false],[1,4038.6,4051.2,true]].forEach(([dir,o,c,ok],i)=>L.push({comp_id:cid,day:new Date(b-(i+1)*864e5).toISOString().slice(0,10),dir,open_px:o,close_px:c,correct:ok}))}return L},
  paper:async cid=>{const v=D(),e=mine(v).find(x=>x.comp_id===cid);if(!e)return null;const c=v.comps.find(x=>x.id===cid),q=eq(v,cid),b0=c.cfg.balance||10000,E=b0+q.cl+q.op;
    return{bal0:b0,equity:+E.toFixed(2),ret:+((E-b0)/b0*100).toFixed(2),maxdd:+(Math.max(0,-q.op)/b0*100).toFixed(2),closed:q.n,status:e.status,reason:e.reason,score:+((E-b0)/b0*100/Math.max(1,0)).toFixed(2),rank:4,max_dd:c.cfg.max_dd,min_trades:c.cfg.min_trades,max_risk:c.cfg.max_risk,syms:c.cfg.syms,prices:Object.fromEntries(Object.entries(px).map(([k,p])=>[k,{px:p}])),trades:v.trades.filter(t=>t.comp_id===cid)}},
  paperOpen:async(cid,s,d,lots,sl,tp)=>{const v=D(),p=px[s]+(d>0&&s==="XAU/USD"?.27:0);if(d>0?sl>=p:sl<=p)throw new Error("الوقف إلزامي وبالجهة الصحيحة");const r=Math.abs(p-sl)*lots*val(s,p);if(r>(10000+eq(v,cid).cl)*.05)throw new Error("مخاطرة الصفقة أكثر من الحد 5%");
    v.trades.unshift({id:nid(v),comp_id:cid,sym:s,dir:d,lots,entry:+p.toFixed(5),sl,tp,status:"open",opened_at:new Date().toISOString()});put()},
  paperClose:async tid=>{const v=D(),t=v.trades.find(x=>x.id===tid);Object.assign(t,{status:"closed",exit_px:px[t.sym],pnl:+((px[t.sym]-t.entry)*t.dir*t.lots*val(t.sym,px[t.sym])).toFixed(2),why:"يدوي"});put()},
  points:async()=>{const v=D(),e=earn(v);return{balance:bal(v),earned:e,level:lv(e),week_rank:4,week_total:312,silver:500,gold:1500,diamond:3000,
    badges:[["first_lesson","أول درس","🎓",1],["quiz5","5 اختبارات","✅",1],["pred10","10 توقعات صح","🎯",1],["ref3","جبت 3 أعضاء","🤝",1],["winner","فائز مسابقة","🏆",0],["paper_champ","بطل الحساب الورقي","📈",0],["event3","حاضر دائماً","🎟",1],["gold","المستوى الذهبي","🥇",e>=1500],["diamond","المستوى الماسي","💎",e>=3000]].map(([key,name,icon,has])=>({key,name,icon,descr:name,has:!!has}))}},
  ptsBoard:async p=>{const v=D(),me_=earn(v),L=[...v.fake.map(([n,s])=>({name:n,pts:p==="month"?s*2:s})),{name:"أنت",pts:p==="month"?me_+300:me_,is_me:true}].sort((a,b)=>b.pts-a.pts);return L.slice(0,8).map((x,i)=>({...x,pos:i+1}))},
  ledger:async()=>D().ledger,rules:async()=>D().rules,saveRule:async(k,points,active)=>{const r=D().rules.find(x=>x.key===k);Object.assign(r,{points,active});put()},
  rewards:async()=>D().rewards.filter(r=>r.active),myClaims:async()=>{const v=D();return v.claims.filter(c=>c.user_id===me()).map(c=>({...c,rewards:v.rewards.find(r=>r.id===c.reward_id)}))},
  myWins:async()=>D().winners.filter(w=>w.user_id===me()),
  claim:async(rid,wid)=>{const v=D(),r=v.rewards.find(x=>x.id===rid);if(v.claims.some(c=>c.user_id===me()&&c.reward_id===rid&&c.status==="pending"))throw new Error("عندك طلب على هذي الجائزة من قبل");
    if(!wid){if(r.cost==null)throw new Error("هذي الجائزة تنكسب بالفوز بس");if(bal(v)<r.cost)throw new Error("نقاطك ما تكفي");addPts(v,-r.cost,"reward","طلب جائزة: "+r.title)}
    v.claims.unshift({id:nid(v),reward_id:rid,user_id:me(),winner_id:wid,cost:wid?0:r.cost,status:"pending",delivery:{},reason:"",created_at:new Date().toISOString()});if(r.stock!=null)r.stock--;put()},
  gws:async()=>D().gws,gw:async id=>D().gws.find(g=>g.id===id),gwInfo:async id=>{const g=D().gws.find(x=>x.id===id);return{n:g.n+g.joined.length,joined:g.joined.includes(me())}},
  gwEnter:async id=>{const v=D(),g=v.gws.find(x=>x.id===id);if(!g.joined.includes(me()))g.joined.push(me());put()},
  sessions:async()=>D().sessions,seats:async()=>D().sessions.map(s=>({session_id:s.id,capacity:s.capacity,going:s.going,waitlist:s.waitlist,my_status:s.my})),
  refStats:async()=>({code:myCode(),total:14,qualified:9,pending:3,invalid:2}),track:async()=>{},setCamp:async()=>{},
  aComps:async()=>D().comps,aStats:async()=>{const v=D();return v.comps.map(c=>({id:c.id,entries:cnt(v,c.id),pending:v.entries.filter(e=>e.comp_id===c.id&&e.status==="pending").length,views:c.id===1?4812:c.id===2?1204:0,clicks:c.id===1?731:c.id===2?210:0,ad_joins:c.id===1?214:c.id===2?88:0}))},
  aSave:async row=>{const v=D();if(row.id){Object.assign(v.comps.find(c=>c.id===row.id),row);put();return row.id}const id=nid(v);v.comps.unshift({...row,id,created_at:new Date().toISOString()});put();return id},
  aSecret:async cid=>D().secrets[cid]||null,aSetSecret:async(cid,data)=>{D().secrets[cid]=data;put()},
  aEntries:async cid=>D().entries.filter(e=>e.comp_id===cid).map(e=>({...e,name:e.user_id===me()?"omar":e.name,email:"member@example.com"})),
  aReview:async(eid,ok,sc,why)=>{const e=D().entries.find(x=>x.id===eid);Object.assign(e,{status:ok?"accepted":"rejected",score:ok?sc:null,reason:why||""});put()},
  aFinalize:async(cid,uids)=>{const v=D(),c=v.comps.find(x=>x.id===cid);uids.forEach((u,i)=>{const e=v.entries.find(x=>x.comp_id===cid&&x.user_id===u),pz=(c.prizes||[]).find(p=>+p.rank===i+1)||{};v.winners.push({id:nid(v),comp_id:cid,user_id:u,rank:i+1,name:e?e.name:"عضو",prize:pz.text||"",reward_id:pz.reward_id||null,is_me:u===me()})});c.status="closed";put()},
  aPaperFlags:async()=>[{name:"مصطفى ج.",ret:14.2,maxdd:4.1,trades:12,top_share:62,flag:"صفقة وحدة أكثر من 40% من الربح"},{name:"علي ح.",ret:8.4,maxdd:3.2,trades:18,top_share:21,flag:null}],
  aRewards:async()=>D().rewards,aRewardSave:async row=>{const v=D();if(row.id)Object.assign(v.rewards.find(r=>r.id===row.id),row);else v.rewards.push({...row,id:nid(v)});put()},
  aClaims:async()=>{const v=D(),L=v.claims.map(c=>{const r=v.rewards.find(x=>x.id===c.reward_id);return{...c,reward:r.title,kind:r.kind,name:"omar",email:"omar@example.com"}});
    if(!L.length)L.push({id:9001,reward:"حساب ممول كهدية",kind:"funded",name:"أحمد ع.",email:"ahmed@example.com",status:"pending",cost:0,winner:{comp:"بطولة الحساب الورقي (أكتوبر)",rank:1,score:3.46},delivery:{},created_at:new Date(Date.now()-36e5).toISOString()},{id:9002,reward:"كود خصم 30%",kind:"coupon",name:"سارة م.",email:"sara@example.com",status:"pending",cost:600,created_at:new Date(Date.now()-2*36e5).toISOString()});return L},
  aDecide:async(id,st,dl,why)=>{const c=D().claims.find(x=>x.id===id);if(c)Object.assign(c,{status:st,delivery:dl||{},reason:why||""});put()},
  aGwCreate:async(t,d,p,img,rto,dat,nw,ml)=>{const v=D();v.gws.unshift({id:nid(v),title:t,descr:d,prize:p,reg_from:new Date().toISOString(),reg_to:rto,winners:nw,min_lessons:ml,seed_hash:"demo",status:"open",n:0,joined:[]});put()},
  aGwDraw:async id=>{const g=D().gws.find(x=>x.id===id);g.status="drawn";put();return[{name:"أحمد ع."}]},
  aCamps:async()=>D().camps,aCampSave:async row=>{const v=D();v.camps.unshift({...row,id:nid(v),active:true,visits:0,signups:0,activated:0,joins:0,conv:0});put()},aPromos:async()=>D().promos,aPromoSave:async row=>{const v=D(),p=v.promos.find(x=>x.code===row.code);if(p)Object.assign(p,row);else v.promos.unshift({used:0,...row});put()},
  aRef:async()=>[{name:"عمر ر.",total:14,qualified:9,dup:0,flag:false},{name:"كرار ف.",total:22,qualified:3,dup:11,flag:true},{name:"مريم ع.",total:6,qualified:6,dup:0,flag:false}],
  aGrowth:async()=>({signups_30:684,signups_prev:561,active_week:1193,active_month:2410,participants_week:417,completion:68.4,winners:23,delivered:41,pending_claims:2,pending_entries:3,points_month:48210,retention_30:47,visits_30:6360,sources:[{src:"حملة: gold-tg",n:412},{src:"إحالة",n:174},{src:"مباشر",n:62},{src:"حملة: vip-ig",n:36}]}),
  aPoints:async(uid,d,nt)=>{addPts(D(),d,"admin_adjust",nt);put()},aFindUser:async em=>({id:me(),full_name:"omar",email:em}),
  aSessions:async()=>D().sessions,aSessionSet:async(id,row)=>{Object.assign(D().sessions.find(s=>s.id===id),row);put()},
  uploadMedia:async f=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)})};
  async function this_join(cid){const v=D();v.entries.push({id:nid(v),comp_id:cid,user_id:me(),name:"أنت",status:"accepted",score:0,updated_at:new Date().toISOString()});put()}
}


/* V9 backend adapters: رادار السوق + دفتر التداول + إضافات المخاطر */
function mkV9Supa(sb,chk,meId){const R=(f,a)=>sb.rpc(f,a).then(chk);return{demo:false,
  radar:tf=>R("radar_get",{tf}),rules:j=>R("admin_regime_rules",{j}),rstats:d=>R("radar_signal_stats",{days:d}),
  jList:async()=>chk(await sb.from("journal_trades").select("*").order("opened_at",{ascending:false}).limit(5000)),
  jAdd:async r=>chk(await sb.from("journal_trades").insert(r)),jAddMany:async rows=>chk(await sb.from("journal_trades").insert(rows)),
  jUpd:async(id,r)=>chk(await sb.from("journal_trades").update(r).eq("id",id)),jDel:async id=>chk(await sb.from("journal_trades").delete().eq("id",id)),
  jDelAll:()=>R("journal_delete_all"),jSet:async()=>chk(await sb.from("journal_settings").select("*").maybeSingle()),
  jSetSave:async r=>chk(await sb.from("journal_settings").upsert({...r,user_id:meId(),updated_at:new Date().toISOString()})),
  jImg:async f=>{const ext=(f.type.split("/")[1]||"jpg").replace("jpeg","jpg"),path=`${meId()}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;chk(await sb.storage.from("journal").upload(path,f,{contentType:f.type,upsert:false}));return path},
  jImgUrl:async p=>{const r=await sb.storage.from("journal").createSignedUrl(p,600);if(r.error)throw r.error;return r.data.signedUrl},
  rkExt:async r=>chk(await sb.from("risk_settings").upsert({...r,user_id:meId(),updated_at:new Date().toISOString()})),
  alertLog:(k,m,lvl)=>R("risk_alert_log",{k,m,lvl}),alerts:async()=>chk(await sb.from("risk_alerts").select("*").order("created_at",{ascending:false}).limit(20))}}

function mkV9Demo(get,put,meId){
  const V=()=>{const d=get();if(!d.v9){d.v9={j:null,js:{acct_ccy:"USD",start_balance:5000,share_coach:false},alerts:[],rules:{mode:"observe",block_sideways:false,block_abnormal:true,block_high_vol:false,block_stale:false}};put()}
    if(!d.v9.j){d.v9.j=v9DemoTrades();put()}return d.v9};
  return{demo:true,
    radar:async tf=>{const rows=JSON.parse(JSON.stringify((V9_DEMO_RADAR[tf]||[]))),now=Date.now();rows.forEach((r,i)=>{r.hist=[{state:i%3?"sideways":"trend_down",at:new Date(now-(30+i*7)*36e5).toISOString()},{state:r.state,at:new Date(now-(2+i)*36e5).toISOString()}];r.candle_t=new Date(Math.floor(now/36e5)*36e5-36e5).toISOString();if(r.sym==="XAU/USD")r.news={title:"مؤشر أسعار المستهلك الأمريكي CPI",at:new Date(now+2*36e5).toISOString(),country:"USD"}});
      return{tf,rows,rules:V().rules}},
    rules:async j=>{const v=V();v.rules={...v.rules,...j,mode:"observe"};put();return v.rules},
    rstats:async()=>[{state:"trend_up",n:38,win:22,loss:13,open:3,would_block:0},{state:"sideways",n:21,win:8,loss:12,open:1,would_block:0},{state:"trend_down",n:17,win:9,loss:7,open:1,would_block:0},{state:"abnormal",n:4,win:1,loss:3,open:0,would_block:4},{state:"untagged",n:112,win:61,loss:47,open:0,would_block:0}],
    jList:async()=>V().j.slice().sort((a,b)=>new Date(b.opened_at)-new Date(a.opened_at)),
    jAdd:async r=>{const v=V();v.j.push({...r,id:Date.now()+Math.floor(Math.random()*999),created_at:new Date().toISOString()});put()},
    jAddMany:async rows=>{const v=V();rows.forEach((r,i)=>v.j.push({...r,id:Date.now()+i,created_at:new Date().toISOString()}));put()},
    jUpd:async(id,r)=>{const t=V().j.find(x=>String(x.id)===String(id));if(t)Object.assign(t,r);put()},jDel:async id=>{const v=V();v.j=v.j.filter(x=>String(x.id)!==String(id));put()},
    jDelAll:async()=>{const v=V(),n=v.j.length;v.j=[];put();return n},jSet:async()=>V().js,jSetSave:async r=>{V().js={...V().js,...r};put()},
    jImg:async f=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)}),jImgUrl:async p=>p,
    rkExt:async r=>{const d=get();d.v3=d.v3||{};d.v3.risk={...(d.v3.risk||{}),...r};put()},
    alertLog:async(k,m,lvl)=>{const v=V(),day=new Date().toISOString().slice(0,10);if(v.alerts.some(a=>a.kind===k&&a.day===day))return false;v.alerts.unshift({kind:k,msg:m,level:lvl,day,created_at:new Date().toISOString()});put();return true},
    alerts:async()=>V().alerts}}
// صفقات توضيحية للمعاينة بس (وضع العرض بدون قاعدة بيانات) — مو نتائج حقيقية
function v9DemoTrades(){let seed=7;const r=()=>(seed=(seed*9301+49297)%233280)/233280,out=[],now=Date.now(),SY=[["XAU/USD",4060,100,2,.1],["EUR/USD",1.158,1e5,5,.0001],["GBP/USD",1.312,1e5,5,.0001],["USD/JPY",153.4,1e5,3,.01]],ST=["كسر ترند","ارتداد من دعم","توصية فيكسورا","نموذج موجي"],EM=["هادئ","واثق","متردد","طمعان","انتقام","هادئ","هادئ"];
  for(let i=0;i<46;i++){const s=SY[Math.floor(r()*SY.length)],side=r()>.5?"buy":"sell",dir=side==="buy"?1:-1,o=new Date(now-(45-i)*0.7*864e5-r()*8*36e5),c=new Date(+o+(1+r()*20)*36e5),e=+(s[1]*(1+(r()-.5)*.02)).toFixed(s[3]),stop=s[4]*(s[0]==="XAU/USD"?60:25)*(0.7+r()*.6),sl=+(e-dir*stop).toFixed(s[3]);
    const em=EM[Math.floor(r()*EM.length)],fp=em==="انتقام"||em==="طمعان"?r()>.7:r()>.15,win=r()<(fp?.6:.36),rr=win?(1+r()*1.6):-(fp?1:1+r()*.6),x=+(e+dir*stop*rr).toFixed(s[3]),lots=s[0]==="XAU/USD"?+(0.03+r()*.07).toFixed(2):+(0.1+r()*.5).toFixed(2);
    const vp=s[0]==="USD/JPY"?s[2]/153.4:s[2],g=(x-e)*dir*lots*vp,cm=+(lots*7).toFixed(2),sw=+((r()-.6)*lots*4).toFixed(2);
    out.push({id:1e6+i,sym:s[0],side,opened_at:o.toISOString(),closed_at:c.toISOString(),lots,entry:e,sl,tp:null,exits:[{lots,price:x,at:c.toISOString()}],commission:cm,spread_cost:0,swap:sw,fx_rate:1,quote_ccy:"USD",
      pnl:+(g-cm+sw).toFixed(2),r_mult:+(g/(stop*lots*vp)).toFixed(3),strategy:ST[Math.floor(r()*ST.length)],emotion:em,followed_plan:fp,reason_in:"",reason_out:"",notes:"",images:[],source:i%5===0?"signal":"manual",created_at:o.toISOString()})}
  return out}

const V9_DEMO_RADAR={"H1":[{"sym":"XAU/USD","tf":"H1","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 73.6","RSI 58.3","المتوسطات مرتبة صعوداً","ATR +5% عن المتوسط","عرض بولنجر بالنسبة المئوية 14"],"metrics":{"adx":73.63,"atr":8.22197,"rsi":58.32,"close":4723.97,"ema20":4722.65,"ema50":4691.89,"slope":2.381,"bb_pct":14.0,"ema200":4522.88,"range20":37.4605,"atr_ratio":1.045,"spark":[4646.34,4652.15,4653.62,4660.27,4668.21,4665.36,4668.58,4676.02,4675.88,4675.67,4676.67,4680.71,4678.06,4681.99,4687.21,4684.34,4688.76,4691.51,4687.87,4690.9,4691.78,4693.64,4690.45,4696.3,4700.23,4701.14,4699.45,4706.84,4705.97,4709.07,4716.0,4719.65,4715.91,4714.43,4718.07,4720.42,4726.71,4733.8,4730.01,4728.47,4733.16,4734.26,4739.31,4736.37,4734.78,4730.93,4727.38,4723.97]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"EUR/USD","tf":"H1","state":"sideways","trend":"side","vol":"normal","abnormal":false,"score":75,"reasons":["ADX 13.1","RSI 45.0","المتوسطات مرتبة نزولاً","ATR -9% عن المتوسط","عرض بولنجر بالنسبة المئوية 7"],"metrics":{"adx":13.12,"atr":0.00183727,"rsi":45.0,"close":1.15705,"ema20":1.15793,"ema50":1.15797,"slope":-0.117,"bb_pct":7.0,"ema200":1.15808,"range20":0.00469195,"atr_ratio":0.906,"spark":[1.15893,1.15808,1.15877,1.15881,1.15882,1.15988,1.15776,1.15732,1.15685,1.157,1.1577,1.15735,1.15659,1.15721,1.15658,1.15645,1.15687,1.15692,1.15579,1.15594,1.15636,1.15808,1.1578,1.15666,1.15856,1.15902,1.15861,1.15975,1.1587,1.158,1.15887,1.15936,1.15978,1.15967,1.15886,1.15996,1.15898,1.15775,1.15733,1.15657,1.15777,1.15741,1.15732,1.15707,1.15795,1.15851,1.1581,1.15705]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"GBP/USD","tf":"H1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 55.2","RSI 30.0","المتوسطات مرتبة نزولاً","ATR -5% عن المتوسط","عرض بولنجر بالنسبة المئوية 3"],"metrics":{"adx":55.2,"atr":0.00232635,"rsi":29.97,"close":1.14435,"ema20":1.14806,"ema50":1.15638,"slope":-2.073,"bb_pct":3.0,"ema200":1.19996,"range20":0.00638708,"atr_ratio":0.949,"spark":[1.17054,1.17121,1.16924,1.16802,1.16668,1.16667,1.16671,1.16795,1.16598,1.16585,1.16487,1.16427,1.16471,1.16266,1.16339,1.16142,1.16164,1.15952,1.15824,1.15617,1.15411,1.1551,1.15447,1.15201,1.14993,1.14922,1.14978,1.14726,1.14605,1.14649,1.14757,1.14762,1.14872,1.14668,1.14651,1.1473,1.14779,1.1455,1.14617,1.14559,1.14675,1.14749,1.1474,1.14848,1.1472,1.14732,1.1454,1.14435]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"USD/JPY","tf":"H1","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 79.4","RSI 84.1","المتوسطات مرتبة صعوداً","ATR +3% عن المتوسط","عرض بولنجر بالنسبة المئوية 12"],"metrics":{"adx":79.42,"atr":0.29264,"rsi":84.08,"close":175.886,"ema20":175.0,"ema50":173.824,"slope":2.583,"bb_pct":12.0,"ema200":167.853,"range20":1.75493,"atr_ratio":1.033,"spark":[171.85,172.021,172.239,172.226,172.343,172.558,172.739,172.739,172.905,172.904,173.21,173.29,173.271,173.478,173.472,173.683,173.602,173.58,173.731,173.64,173.681,173.83,174.124,174.28,174.301,174.22,174.152,174.328,174.575,174.62,174.706,174.646,174.591,174.667,174.737,174.732,174.702,174.847,175.06,174.992,174.993,175.292,175.208,175.261,175.509,175.418,175.679,175.886]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"AUD/USD","tf":"H1","state":"sideways","trend":"side","vol":"normal","abnormal":false,"score":50,"reasons":["ADX 11.7","RSI 57.1","المتوسطات مرتبة صعوداً","ATR -3% عن المتوسط","عرض بولنجر بالنسبة المئوية 35"],"metrics":{"adx":11.67,"atr":0.00120641,"rsi":57.14,"close":0.656706,"ema20":0.655891,"ema50":0.655594,"slope":0.267,"bb_pct":35.0,"ema200":0.655487,"range20":0.00401843,"atr_ratio":0.975,"spark":[0.655638,0.655086,0.654378,0.653805,0.653311,0.65482,0.65565,0.654897,0.655524,0.655874,0.655426,0.656254,0.656377,0.656894,0.656099,0.655779,0.656391,0.656337,0.655162,0.655776,0.654873,0.654163,0.654625,0.654013,0.653591,0.6532,0.654258,0.653935,0.654159,0.655028,0.655597,0.655936,0.655321,0.655738,0.654902,0.655752,0.655519,0.655429,0.65473,0.6551,0.656179,0.656522,0.657163,0.65679,0.656439,0.656425,0.655971,0.656706]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"USD/CAD","tf":"H1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 92.3","RSI 5.7","المتوسطات مرتبة نزولاً","ATR +2% عن المتوسط","عرض بولنجر بالنسبة المئوية 63"],"metrics":{"adx":92.3,"atr":0.00273195,"rsi":5.65,"close":1.21565,"ema20":1.22596,"ema50":1.24102,"slope":-3.729,"bb_pct":63.0,"ema200":1.29238,"range20":0.0244846,"atr_ratio":1.016,"spark":[1.26535,1.26578,1.2651,1.26493,1.26306,1.26317,1.26238,1.26243,1.26345,1.26115,1.26012,1.26047,1.25841,1.25637,1.25633,1.25436,1.25421,1.25315,1.25361,1.25108,1.24829,1.24687,1.2441,1.24432,1.24301,1.24135,1.23865,1.23878,1.23642,1.23422,1.23233,1.23155,1.22992,1.22755,1.22783,1.22724,1.226,1.22345,1.22365,1.22368,1.22303,1.22325,1.22112,1.21979,1.22016,1.21821,1.2176,1.21565]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"USD/CHF","tf":"H1","state":"low_vol","trend":"side","vol":"low","abnormal":false,"score":50,"reasons":["ADX 9.7","RSI 40.8","المتوسطات مرتبة نزولاً","ATR -51% عن المتوسط","عرض بولنجر بالنسبة المئوية 33"],"metrics":{"adx":9.69,"atr":0.000516565,"rsi":40.78,"close":0.804003,"ema20":0.804391,"ema50":0.804605,"slope":-0.393,"bb_pct":33.0,"ema200":0.804779,"range20":0.00147153,"atr_ratio":0.495,"spark":[0.804943,0.804574,0.804242,0.80451,0.804629,0.805168,0.804804,0.805134,0.805455,0.804938,0.805216,0.804874,0.805009,0.805019,0.804786,0.80485,0.804474,0.804262,0.804158,0.803952,0.804245,0.804637,0.804479,0.804888,0.804776,0.805086,0.805104,0.80505,0.804685,0.80461,0.80512,0.804821,0.804936,0.805032,0.804751,0.804811,0.80448,0.804535,0.804463,0.804253,0.804021,0.803975,0.804551,0.804432,0.804245,0.804077,0.804003,0.804003]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"GBP/JPY","tf":"H1","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 90.6","RSI 92.3","المتوسطات مرتبة صعوداً","ATR +0% عن المتوسط","عرض بولنجر بالنسبة المئوية 52"],"metrics":{"adx":90.56,"atr":0.395681,"rsi":92.32,"close":230.793,"ema20":229.254,"ema50":227.307,"slope":3.289,"bb_pct":52.0,"ema200":219.369,"range20":3.4872,"atr_ratio":1.0,"spark":[224.647,224.709,225.048,225.254,225.184,225.096,225.069,225.369,225.265,225.409,225.24,225.61,225.729,226.106,226.023,226.295,226.12,226.304,226.63,226.439,226.549,226.781,227.005,226.902,226.996,227.371,227.577,227.6,227.953,228.131,228.007,228.398,228.54,228.829,228.96,229.172,229.209,229.235,229.426,229.349,229.392,229.471,229.834,229.812,230.189,230.229,230.494,230.793]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"XAG/USD","tf":"H1","state":"abnormal","trend":"up","vol":"high","abnormal":true,"score":60,"reasons":["ADX 20.7","RSI 75.2","المتوسطات متداخلة","ATR +53% عن المتوسط","عرض بولنجر بالنسبة المئوية 100","حركة غير طبيعية: آخر شمعة 5.2 × ATR"],"metrics":{"adx":20.68,"atr":0.134171,"rsi":75.16,"close":49.1027,"ema20":48.6241,"ema50":48.5974,"slope":0.16,"bb_pct":100.0,"ema200":48.6012,"range20":0.800039,"atr_ratio":1.529,"spark":[48.5676,48.5274,48.5914,48.5558,48.6212,48.6774,48.7287,48.7369,48.7184,48.6451,48.6448,48.6279,48.6281,48.6305,48.58,48.6006,48.5282,48.4989,48.502,48.4789,48.4408,48.4295,48.5221,48.5699,48.5849,48.5357,48.5141,48.5941,48.5361,48.4908,48.5346,48.5826,48.5571,48.6282,48.6234,48.6033,48.5398,48.5467,48.625,48.5916,48.5634,48.5154,48.5128,48.5277,48.61,48.6619,48.5924,49.1027]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"BTC/USD","tf":"H1","state":"high_vol","trend":"side","vol":"high","abnormal":false,"score":50,"reasons":["ADX 18.1","RSI 51.5","المتوسطات مرتبة صعوداً","ATR +86% عن المتوسط","عرض بولنجر بالنسبة المئوية 96"],"metrics":{"adx":18.06,"atr":306.85,"rsi":51.49,"close":95055.6,"ema20":95030.1,"ema50":94997.1,"slope":0.217,"bb_pct":96.0,"ema200":94983.4,"range20":1215.69,"atr_ratio":1.857,"spark":[95041.9,95025.3,94954.4,95021.7,95057.2,95104.5,94979.9,95075.6,95098.8,95039.7,95051.8,94953.9,95092.5,94994.3,94885.1,94983.7,94873.6,95032.5,95103.4,95168.5,94965.0,95001.8,94957.9,94969.5,94950.6,94935.8,94830.7,94818.3,95048.4,94899.4,95072.7,94941.0,94892.5,94772.4,94783.2,94557.5,94543.1,94821.4,94821.9,95002.6,95158.2,95364.4,95358.2,95454.9,95050.9,95005.0,95044.9,95055.6]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false},{"sym":"ETH/USD","tf":"H1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 64.8","RSI 24.1","المتوسطات مرتبة نزولاً","ATR -4% عن المتوسط","عرض بولنجر بالنسبة المئوية 55"],"metrics":{"adx":64.75,"atr":5.88095,"rsi":24.12,"close":2752.88,"ema20":2766.25,"ema50":2789.04,"slope":-2.523,"bb_pct":55.0,"ema200":2901.23,"range20":32.2637,"atr_ratio":0.955,"spark":[2825.86,2823.45,2819.9,2814.09,2808.84,2811.32,2813.2,2813.35,2816.38,2815.1,2812.53,2806.89,2804.06,2798.08,2800.95,2797.69,2796.75,2796.44,2798.39,2794.37,2792.24,2791.11,2790.06,2787.62,2784.12,2780.15,2782.27,2778.39,2779.05,2780.83,2782.8,2778.37,2777.09,2772.92,2770.07,2764.53,2761.79,2764.54,2766.96,2768.94,2762.84,2758.83,2755.34,2756.26,2759.0,2757.96,2754.67,2752.88]},"candle_t":"2026-11-18T14:00:00+01:00","stale":false}],"H4":[{"sym":"XAU/USD","tf":"H4","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 63.1","RSI 13.4","المتوسطات مرتبة نزولاً","ATR -18% عن المتوسط","عرض بولنجر بالنسبة المئوية 78"],"metrics":{"adx":63.05,"atr":6.54602,"rsi":13.37,"close":3554.25,"ema20":3570.06,"ema50":3596.0,"slope":-2.774,"bb_pct":78.0,"ema200":3729.72,"range20":45.9936,"atr_ratio":0.825,"spark":[3640.46,3633.74,3627.55,3625.28,3625.86,3620.39,3614.03,3606.48,3609.29,3607.56,3604.94,3601.27,3596.64,3598.31,3594.65,3597.79,3594.54,3596.01,3591.67,3593.35,3594.72,3594.17,3593.17,3596.8,3599.3,3601.96,3596.31,3593.78,3595.47,3590.01,3591.29,3591.99,3591.93,3589.55,3583.88,3577.12,3571.38,3569.42,3564.94,3564.91,3563.02,3560.17,3559.33,3559.58,3558.09,3556.14,3554.57,3554.25]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"EUR/USD","tf":"H4","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 67.4","RSI 15.6","المتوسطات مرتبة نزولاً","ATR -9% عن المتوسط","عرض بولنجر بالنسبة المئوية 65"],"metrics":{"adx":67.39,"atr":0.00200681,"rsi":15.61,"close":1.01858,"ema20":1.02392,"ema50":1.03313,"slope":-3.072,"bb_pct":65.0,"ema200":1.0721,"range20":0.0149783,"atr_ratio":0.913,"spark":[1.04772,1.04706,1.04761,1.04546,1.0451,1.0432,1.04412,1.04496,1.04382,1.04405,1.04262,1.04208,1.04192,1.04076,1.04013,1.03944,1.03832,1.03851,1.039,1.03858,1.03648,1.03523,1.03535,1.03582,1.03694,1.03661,1.03466,1.03242,1.03082,1.02933,1.02933,1.0289,1.02662,1.0244,1.02229,1.02303,1.02262,1.02139,1.02146,1.02172,1.02203,1.02165,1.02067,1.02095,1.02141,1.01978,1.01888,1.01858]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"GBP/USD","tf":"H4","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 83.1","RSI 17.0","المتوسطات مرتبة نزولاً","ATR 0% عن المتوسط","عرض بولنجر بالنسبة المئوية 10"],"metrics":{"adx":83.12,"atr":0.00248072,"rsi":16.96,"close":1.10599,"ema20":1.11382,"ema50":1.12585,"slope":-3.089,"bb_pct":10.0,"ema200":1.18019,"range20":0.0172167,"atr_ratio":0.998,"spark":[1.14154,1.14151,1.13934,1.13961,1.14088,1.14123,1.13987,1.13965,1.13849,1.13604,1.13664,1.13502,1.13328,1.13196,1.13163,1.12921,1.12994,1.13005,1.12905,1.12725,1.12755,1.12622,1.12518,1.12562,1.12633,1.1238,1.12224,1.1205,1.12161,1.11899,1.11729,1.11537,1.11634,1.1163,1.11426,1.11341,1.11429,1.11405,1.11319,1.11245,1.11363,1.11385,1.11217,1.11062,1.10826,1.10744,1.10807,1.10599]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"USD/JPY","tf":"H4","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 69.2","RSI 82.1","المتوسطات مرتبة صعوداً","ATR +0% عن المتوسط","عرض بولنجر بالنسبة المئوية 18"],"metrics":{"adx":69.15,"atr":0.292058,"rsi":82.15,"close":175.306,"ema20":174.377,"ema50":173.257,"slope":2.431,"bb_pct":18.0,"ema200":167.634,"range20":1.85494,"atr_ratio":1.004,"spark":[171.59,171.453,171.762,172.052,172.223,172.438,172.325,172.492,172.376,172.62,172.813,172.77,172.626,172.676,172.719,172.635,172.891,173.021,172.9,173.158,173.098,173.301,173.215,173.396,173.387,173.5,173.77,173.747,173.633,173.844,174.004,174.123,174.076,174.057,174.306,174.345,174.403,174.264,174.22,174.3,174.571,174.547,174.589,174.697,174.561,174.866,175.011,175.306]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"AUD/USD","tf":"H4","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 58.4","RSI 72.3","المتوسطات مرتبة صعوداً","ATR -3% عن المتوسط","عرض بولنجر بالنسبة المئوية 23"],"metrics":{"adx":58.4,"atr":0.00115749,"rsi":72.28,"close":0.743317,"ema20":0.741402,"ema50":0.737773,"slope":1.963,"bb_pct":23.0,"ema200":0.71518,"range20":0.00450881,"atr_ratio":0.973,"spark":[0.731777,0.731223,0.732009,0.731922,0.731838,0.732237,0.731942,0.733143,0.733409,0.734247,0.73466,0.735437,0.735854,0.737009,0.736762,0.736413,0.737731,0.737112,0.737877,0.738484,0.73831,0.738909,0.73992,0.740292,0.741152,0.740624,0.740373,0.740008,0.740052,0.741343,0.740996,0.740905,0.740441,0.740784,0.740785,0.740176,0.739881,0.74005,0.740881,0.740931,0.741938,0.742239,0.742754,0.742289,0.742388,0.743321,0.743002,0.743317]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"USD/CAD","tf":"H4","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 75.7","RSI 78.7","المتوسطات مرتبة صعوداً","ATR +3% عن المتوسط","عرض بولنجر بالنسبة المئوية 10"],"metrics":{"adx":75.67,"atr":0.00280149,"rsi":78.73,"close":1.60362,"ema20":1.59635,"ema50":1.58368,"slope":2.844,"bb_pct":10.0,"ema200":1.53035,"range20":0.0138114,"atr_ratio":1.03,"spark":[1.56144,1.56326,1.56278,1.56413,1.56621,1.56895,1.56767,1.56775,1.56673,1.56857,1.56946,1.57016,1.57053,1.57263,1.57312,1.5747,1.57617,1.57891,1.58043,1.58083,1.5821,1.58316,1.58286,1.58488,1.58753,1.58794,1.59001,1.59267,1.59211,1.59297,1.59261,1.59188,1.59248,1.59454,1.59514,1.59781,1.60004,1.60045,1.59933,1.59831,1.59916,1.59799,1.59977,1.59921,1.59989,1.59874,1.60138,1.60362]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"USD/CHF","tf":"H4","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 83.1","RSI 83.0","المتوسطات مرتبة صعوداً","ATR -4% عن المتوسط","عرض بولنجر بالنسبة المئوية 39"],"metrics":{"adx":83.06,"atr":0.00145032,"rsi":82.97,"close":0.92076,"ema20":0.9169,"ema50":0.910991,"slope":2.742,"bb_pct":39.0,"ema200":0.881823,"range20":0.00893612,"atr_ratio":0.96,"spark":[0.903175,0.902392,0.902949,0.903728,0.903429,0.904894,0.905834,0.906799,0.907477,0.906994,0.908174,0.907919,0.907756,0.90854,0.90809,0.90741,0.908332,0.909073,0.908631,0.908582,0.908449,0.909306,0.908913,0.910498,0.911597,0.91113,0.911063,0.91264,0.912269,0.913828,0.914281,0.913982,0.915399,0.914628,0.915899,0.915756,0.916203,0.917081,0.917885,0.917733,0.917853,0.918549,0.918921,0.9191,0.918632,0.919715,0.920498,0.92076]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"GBP/JPY","tf":"H4","state":"sideways","trend":"side","vol":"normal","abnormal":false,"score":75,"reasons":["ADX 16.9","RSI 55.8","المتوسطات متداخلة","ATR +4% عن المتوسط","عرض بولنجر بالنسبة المئوية 1"],"metrics":{"adx":16.93,"atr":0.379646,"rsi":55.81,"close":201.565,"ema20":201.326,"ema50":201.312,"slope":0.035,"bb_pct":1.0,"ema200":201.353,"range20":0.998142,"atr_ratio":1.041,"spark":[201.401,201.485,201.702,201.367,201.571,201.245,201.09,201.142,201.29,201.417,201.586,201.343,201.388,201.181,201.148,201.148,201.463,201.558,201.373,201.358,201.341,201.035,201.145,200.932,201.098,201.214,200.967,200.914,201.158,201.08,201.127,201.201,201.477,201.207,201.235,201.411,201.589,201.385,201.168,201.307,201.215,201.348,201.115,201.446,201.307,201.465,201.347,201.565]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"XAG/USD","tf":"H4","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 64.5","RSI 13.9","المتوسطات مرتبة نزولاً","ATR +1% عن المتوسط","عرض بولنجر بالنسبة المئوية 70"],"metrics":{"adx":64.46,"atr":0.0912729,"rsi":13.91,"close":42.4827,"ema20":42.792,"ema50":43.1273,"slope":-2.427,"bb_pct":70.0,"ema200":44.6883,"range20":0.564651,"atr_ratio":1.005,"spark":[43.737,43.7434,43.7314,43.6819,43.7155,43.6272,43.5477,43.4826,43.5196,43.4701,43.4058,43.3227,43.3054,43.3416,43.2833,43.1908,43.1992,43.187,43.1553,43.1352,43.172,43.1892,43.1059,43.0886,42.9944,42.9701,43.0028,42.978,42.9204,42.941,42.9639,42.9335,42.918,42.9398,42.9645,42.8979,42.8998,42.9411,42.9519,42.8767,42.8403,42.7569,42.6746,42.6532,42.5964,42.5574,42.5473,42.4827]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"BTC/USD","tf":"H4","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 75.2","RSI 15.1","المتوسطات مرتبة نزولاً","ATR +3% عن المتوسط","عرض بولنجر بالنسبة المئوية 79"],"metrics":{"adx":75.23,"atr":181.075,"rsi":15.06,"close":83499.6,"ema20":84157.0,"ema50":84909.0,"slope":-2.801,"bb_pct":79.0,"ema200":87898.8,"range20":1357.61,"atr_ratio":1.025,"spark":[86046.3,85949.8,85845.8,85659.9,85623.5,85676.2,85538.4,85364.4,85428.6,85345.5,85302.1,85300.6,85311.9,85135.1,85046.2,85034.1,85119.9,85092.5,84981.5,85043.9,85077.7,84904.5,84796.6,84820.2,84818.2,84862.9,84896.0,84744.7,84607.2,84569.6,84627.6,84597.7,84497.1,84475.6,84499.9,84387.6,84337.8,84211.1,84233.2,84196.6,84011.0,83896.1,83971.1,83809.9,83872.4,83843.2,83672.7,83499.6]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false},{"sym":"ETH/USD","tf":"H4","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 86.3","RSI 86.9","المتوسطات مرتبة صعوداً","ATR +1% عن المتوسط","عرض بولنجر بالنسبة المئوية 26"],"metrics":{"adx":86.32,"atr":6.03514,"rsi":86.92,"close":3660.42,"ema20":3641.49,"ema50":3609.66,"slope":3.409,"bb_pct":26.0,"ema200":3489.22,"range20":43.7555,"atr_ratio":1.015,"spark":[3555.53,3554.96,3559.0,3561.37,3560.8,3561.65,3567.66,3569.13,3572.35,3570.32,3573.47,3577.12,3580.49,3580.79,3579.04,3584.78,3584.12,3588.39,3590.8,3595.73,3599.45,3602.95,3605.05,3609.68,3609.65,3613.48,3613.36,3618.44,3621.23,3625.69,3631.76,3632.3,3637.39,3639.98,3641.97,3646.64,3646.41,3647.22,3647.69,3646.02,3643.47,3644.68,3650.43,3648.58,3652.85,3657.7,3657.16,3660.42]},"candle_t":"2026-11-18T09:00:00+01:00","stale":false}],"D1":[{"sym":"XAU/USD","tf":"D1","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 55.3","RSI 75.9","المتوسطات مرتبة صعوداً","ATR -6% عن المتوسط","عرض بولنجر بالنسبة المئوية 4"],"metrics":{"adx":55.28,"atr":7.31977,"rsi":75.95,"close":4572.53,"ema20":4558.12,"ema50":4536.09,"slope":1.9,"bb_pct":4.0,"ema200":4414.48,"range20":36.0283,"atr_ratio":0.936,"spark":[4509.72,4511.64,4510.67,4512.31,4511.49,4510.96,4517.29,4523.86,4523.39,4521.13,4520.67,4519.84,4515.86,4515.7,4517.46,4513.86,4518.22,4523.19,4526.93,4524.33,4532.22,4532.16,4539.64,4537.12,4542.66,4543.81,4541.23,4541.73,4548.19,4549.02,4551.27,4557.75,4554.48,4556.69,4558.2,4559.76,4562.09,4564.25,4566.34,4566.09,4565.03,4561.19,4557.35,4560.54,4561.45,4564.49,4567.16,4572.53]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"EUR/USD","tf":"D1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 87.7","RSI 8.5","المتوسطات مرتبة نزولاً","ATR +2% عن المتوسط","عرض بولنجر بالنسبة المئوية 100"],"metrics":{"adx":87.73,"atr":0.00218164,"rsi":8.53,"close":0.997936,"ema20":1.00698,"ema50":1.01612,"slope":-2.95,"bb_pct":100.0,"ema200":1.05493,"range20":0.0182668,"atr_ratio":1.017,"spark":[1.0289,1.0274,1.0264,1.02628,1.02556,1.02596,1.02543,1.0255,1.02354,1.02363,1.02214,1.02299,1.02239,1.02131,1.0212,1.01999,1.01953,1.01795,1.01796,1.01838,1.01775,1.01762,1.01789,1.01797,1.01752,1.01698,1.01705,1.01546,1.01472,1.01378,1.01482,1.0146,1.01275,1.01079,1.01109,1.01051,1.01151,1.00964,1.00966,1.00738,1.00754,1.00541,1.00387,1.00208,1.00187,0.999678,0.999237,0.997936]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"GBP/USD","tf":"D1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 73.5","RSI 20.8","المتوسطات مرتبة نزولاً","ATR +0% عن المتوسط","عرض بولنجر بالنسبة المئوية 25"],"metrics":{"adx":73.54,"atr":0.00245519,"rsi":20.78,"close":1.13742,"ema20":1.14384,"ema50":1.15367,"slope":-2.494,"bb_pct":25.0,"ema200":1.19981,"range20":0.0131729,"atr_ratio":1.001,"spark":[1.16702,1.16676,1.16641,1.16406,1.16228,1.16164,1.15957,1.1599,1.15751,1.15732,1.15509,1.15489,1.15506,1.15599,1.15609,1.15676,1.15477,1.15546,1.15493,1.15562,1.15588,1.15559,1.15469,1.15252,1.15098,1.15153,1.15014,1.14914,1.14669,1.14525,1.14617,1.14715,1.14761,1.14507,1.14535,1.14531,1.14487,1.14258,1.14362,1.14426,1.14451,1.14295,1.14411,1.14177,1.14021,1.13806,1.13817,1.13742]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"USD/JPY","tf":"D1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 84.9","RSI 6.2","المتوسطات مرتبة نزولاً","ATR 0% عن المتوسط","عرض بولنجر بالنسبة المئوية 66"],"metrics":{"adx":84.85,"atr":0.299602,"rsi":6.2,"close":131.568,"ema20":132.838,"ema50":134.378,"slope":-3.463,"bb_pct":66.0,"ema200":140.118,"range20":2.57648,"atr_ratio":0.997,"spark":[136.702,136.722,136.443,136.474,136.296,136.2,136.134,135.863,135.845,135.815,135.696,135.811,135.687,135.696,135.573,135.53,135.256,135.323,135.467,135.222,134.913,134.972,134.741,134.802,134.497,134.327,134.27,134.007,134.057,133.829,133.588,133.557,133.427,133.347,133.279,133.05,132.745,132.684,132.782,132.766,132.713,132.688,132.535,132.357,132.049,131.912,131.798,131.568]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"AUD/USD","tf":"D1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 58.2","RSI 23.6","المتوسطات مرتبة نزولاً","ATR +5% عن المتوسط","عرض بولنجر بالنسبة المئوية 8"],"metrics":{"adx":58.19,"atr":0.00130333,"rsi":23.55,"close":0.579212,"ema20":0.582001,"ema50":0.587013,"slope":-2.451,"bb_pct":8.0,"ema200":0.609428,"range20":0.00642469,"atr_ratio":1.055,"spark":[0.593851,0.593087,0.592502,0.591262,0.591288,0.591197,0.591404,0.591456,0.59207,0.59178,0.592321,0.591531,0.590516,0.590278,0.590033,0.590387,0.589458,0.588418,0.588156,0.587235,0.586249,0.585094,0.585311,0.585733,0.585154,0.585296,0.585801,0.584621,0.584187,0.583882,0.582575,0.582834,0.582286,0.582812,0.582611,0.582699,0.582424,0.582941,0.58167,0.580747,0.58055,0.580549,0.581043,0.581645,0.581142,0.580214,0.57909,0.579212]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"USD/CAD","tf":"D1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 87.1","RSI 10.7","المتوسطات مرتبة نزولاً","ATR -5% عن المتوسط","عرض بولنجر بالنسبة المئوية 26"],"metrics":{"adx":87.1,"atr":0.00256922,"rsi":10.7,"close":1.22121,"ema20":1.2295,"ema50":1.24253,"slope":-3.308,"bb_pct":26.0,"ema200":1.29305,"range20":0.0154914,"atr_ratio":0.953,"spark":[1.2671,1.26647,1.26374,1.26392,1.26428,1.26192,1.26145,1.26101,1.25886,1.2598,1.258,1.2555,1.25487,1.25437,1.25269,1.25134,1.25102,1.24825,1.24561,1.24282,1.24104,1.24006,1.23909,1.23686,1.23501,1.23261,1.23356,1.23446,1.23354,1.23416,1.23363,1.2337,1.23305,1.23258,1.23256,1.23303,1.23375,1.23199,1.22949,1.22729,1.22728,1.22734,1.22538,1.22485,1.22444,1.22369,1.22402,1.22121]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"USD/CHF","tf":"D1","state":"trend_up","trend":"up","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 61.9","RSI 72.4","المتوسطات مرتبة صعوداً","ATR -4% عن المتوسط","عرض بولنجر بالنسبة المئوية 39"],"metrics":{"adx":61.93,"atr":0.00144841,"rsi":72.43,"close":0.913168,"ema20":0.9109,"ema50":0.905339,"slope":2.435,"bb_pct":39.0,"ema200":0.876708,"range20":0.00729837,"atr_ratio":0.956,"spark":[0.898794,0.899658,0.900909,0.901361,0.902076,0.901795,0.902669,0.902705,0.904146,0.90442,0.904647,0.905087,0.905775,0.906266,0.907016,0.907204,0.906572,0.906128,0.905558,0.906497,0.908098,0.907325,0.906956,0.90721,0.90854,0.907929,0.907393,0.907525,0.907245,0.908172,0.908196,0.907488,0.907667,0.909258,0.909937,0.910552,0.910003,0.910613,0.911597,0.910918,0.910613,0.911607,0.912875,0.913095,0.913553,0.913628,0.913041,0.913168]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"GBP/JPY","tf":"D1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 80.4","RSI 15.4","المتوسطات مرتبة نزولاً","ATR -1% عن المتوسط","عرض بولنجر بالنسبة المئوية 37"],"metrics":{"adx":80.43,"atr":0.35636,"rsi":15.39,"close":174.061,"ema20":175.065,"ema50":176.706,"slope":-3.039,"bb_pct":37.0,"ema200":183.807,"range20":2.74629,"atr_ratio":0.991,"spark":[179.383,179.309,179.149,178.809,178.681,178.65,178.307,178.226,178.393,178.202,177.891,177.547,177.409,177.484,177.367,177.449,177.593,177.393,177.477,177.479,177.473,177.539,177.505,177.111,176.851,176.695,176.442,176.475,176.33,175.932,175.594,175.478,175.071,175.076,175.271,175.263,175.161,175.122,174.881,175.031,174.748,174.769,174.556,174.649,174.366,174.294,174.041,174.061]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"XAG/USD","tf":"D1","state":"sideways","trend":"side","vol":"normal","abnormal":false,"score":25,"reasons":["ADX 10.6","RSI 58.3","المتوسطات مرتبة نزولاً","ATR +10% عن المتوسط","عرض بولنجر بالنسبة المئوية 76"],"metrics":{"adx":10.56,"atr":0.102959,"rsi":58.34,"close":48.6762,"ema20":48.5769,"ema50":48.5928,"slope":-0.106,"bb_pct":76.0,"ema200":48.602,"range20":0.290542,"atr_ratio":1.097,"spark":[48.6858,48.6749,48.6791,48.5982,48.6689,48.6529,48.6707,48.7089,48.7037,48.6499,48.5804,48.6402,48.5771,48.5841,48.6552,48.6707,48.7014,48.6417,48.5894,48.6551,48.5864,48.5338,48.6127,48.5545,48.5718,48.6189,48.678,48.6022,48.6626,48.5995,48.6203,48.5642,48.5217,48.5202,48.4823,48.4601,48.5395,48.5829,48.551,48.516,48.4726,48.5489,48.5663,48.5078,48.5708,48.6153,48.6275,48.6762]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"BTC/USD","tf":"D1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 80.6","RSI 14.8","المتوسطات مرتبة نزولاً","ATR -1% عن المتوسط","عرض بولنجر بالنسبة المئوية 58"],"metrics":{"adx":80.6,"atr":178.485,"rsi":14.76,"close":82110.8,"ema20":82669.2,"ema50":83571.1,"slope":-3.381,"bb_pct":58.0,"ema200":86850.3,"range20":1401.74,"atr_ratio":0.994,"spark":[84969.4,85009.5,85020.4,85020.0,85013.1,84923.8,84833.7,84726.8,84621.1,84588.9,84656.8,84636.1,84555.3,84538.4,84412.5,84397.2,84473.9,84362.0,84312.1,84145.7,84092.5,84005.9,83874.8,83799.5,83662.8,83585.4,83570.2,83409.4,83233.3,83056.7,82930.8,82839.7,82772.2,82713.3,82625.7,82601.3,82688.1,82747.3,82600.0,82456.3,82510.6,82435.4,82387.9,82460.2,82362.7,82171.0,82120.0,82110.8]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false},{"sym":"ETH/USD","tf":"D1","state":"trend_down","trend":"down","vol":"normal","abnormal":false,"score":100,"reasons":["ADX 49.5","RSI 29.8","المتوسطات مرتبة نزولاً","ATR -11% عن المتوسط","عرض بولنجر بالنسبة المئوية 28"],"metrics":{"adx":49.54,"atr":5.40474,"rsi":29.8,"close":2812.28,"ema20":2820.36,"ema50":2834.37,"slope":-1.732,"bb_pct":28.0,"ema200":2932.08,"range20":22.5012,"atr_ratio":0.891,"spark":[2853.89,2855.79,2855.37,2850.7,2850.26,2852.07,2849.13,2846.68,2842.4,2837.45,2834.47,2834.39,2831.2,2832.47,2834.68,2836.04,2838.42,2834.54,2837.0,2838.27,2839.19,2836.74,2836.41,2833.35,2828.66,2830.51,2826.48,2828.14,2830.13,2827.47,2827.35,2826.79,2827.86,2824.71,2826.44,2822.19,2824.01,2820.44,2817.43,2813.67,2814.94,2815.09,2814.8,2817.21,2816.3,2815.35,2816.71,2812.28]},"candle_t":"2026-11-17T01:00:00+01:00","stale":false}]};

/* V10 backend adapters: نسبة النجاح + COT */
function mkV10Supa(sb,chk){const R=(f,a)=>sb.rpc(f,a).then(chk);return{demo:false,
  stats:d=>R("signal_stats",{days:d}),similar:id=>R("signal_similar",{sid:id}),cot:()=>R("cot_get"),cotFetch:()=>R("admin_cot_fetch")}}
function mkV10Demo(){const r=s=>{if(s.status==="loss")return-1;if(s.status!=="win"||!s.entry||!s.sl)return null;const t=[null,s.tp1,s.tp2,s.tp3][s.best||1]||s.tp1;return Math.abs(t-s.entry)/Math.abs(s.entry-s.sl)};
  const grp=(L,k)=>{const R=L.filter(x=>x.r!=null),n=R.length,w=R.filter(x=>x.r>0).length,gw=R.reduce((a,x)=>a+Math.max(x.r,0),0),gl=-R.reduce((a,x)=>a+Math.min(x.r,0),0);
    return{k,n,win:w,loss:n-w,rate:n?Math.round(w/n*100):null,ci:V10.wil(w,n),avg_r:n?+(R.reduce((a,x)=>a+x.r,0)/n).toFixed(2):null,pf:gl>0?+(gw/gl).toFixed(2):null}};
  return{demo:true,
    async stats(days){let S0=(await DB.signals(Math.min(days,3650)))||[];if(S0.filter(x=>x.status==="win"||x.status==="loss").length<10)S0=v10DemoSignals(days);const L=S0.slice().reverse().map(s=>{const h=new Date(s.sig_time).getUTCHours();return{...s,r:r(s),sess:h>=7&&h<12?"london":h>=12&&h<16?"overlap":h>=16&&h<22?"ny":"asia",reg:(s.regime&&s.regime.state)||"untagged",q:s.qscore==null?"none":s.qscore>=85?"q85":s.qscore>=70?"q70":s.qscore>=55?"q55":"q0"}});
      let st=0,mx=0;L.forEach(x=>{if(x.r==null)return;if(x.r<0){st++;mx=Math.max(mx,st)}else st=0});
      const by=k=>{const m={};L.forEach(x=>(m[x[k]]=m[x[k]]||[]).push(x));return Object.entries(m).map(([k2,a])=>grp(a,k2)).filter(g=>g.n).sort((a,b)=>b.n-a.n)};
      return{days,all:grp(L,"all"),max_loss_streak:mx,open:L.filter(x=>!["win","loss","expired"].includes(x.status)).length,expired:L.filter(x=>x.status==="expired").length,by_sym:by("sym"),by_tf:by("tf"),by_sess:by("sess"),by_reg:by("reg"),by_q:by("q"),by_side:by("side")}},
    similar:async()=>null,
    cot:async()=>{const d=new Date(Date.now()-((new Date().getUTCDay()+5)%7)*864e5).toISOString().slice(0,10);return{err:"",rows:[["XAU",218e3,6e3],["XAG",41e3,-2e3],["EUR",71e3,9e3],["GBP",-24e3,-5e3],["JPY",-96e3,12e3],["AUD",-38e3,3e3],["CAD",-61e3,-4e3],["CHF",-18e3,1e3]].map(([a,n,c])=>({asset:a,net:n,chg:c,date:d}))}},
    cotFetch:async()=>"requested"}}
// توصيات توضيحية للمعاينة بس (وضع العرض بدون قاعدة بيانات) — مو نتائج حقيقية
function v10DemoSignals(days){let sd=3;const r=()=>(sd=(sd*9301+49297)%233280)/233280,out=[],now=Date.now(),SY=["XAU/USD","XAU/USD","XAU/USD","EUR/USD","GBP/USD","USD/JPY","BTC/USD"],RG=["trend_up","trend_up","trend_down","sideways","high_vol"];
  for(let i=0;i<260;i++){const t=now-i*0.35*864e5;if(t<now-days*864e5)break;const sym=SY[Math.floor(r()*SY.length)],q=Math.round(45+r()*50),reg=RG[Math.floor(r()*RG.length)],p=.38+(q-45)/50*.3-(reg==="sideways"?.08:0),
    st=i<3?"open":r()<.05?"expired":r()<p?"win":"loss",best=st==="win"?(r()<.5?1:r()<.7?2:3):0;out.push({id:"d"+i,sym,tf:"H1",side:r()<.55?"buy":"sell",sig_time:new Date(t).toISOString(),entry:100,sl:99,tp1:101.2,tp2:102,tp3:103,status:st,best,qscore:q,regime:{state:reg}})}
  return out}

/* V11 backend adapters */
function mkV11Supa(sb,chk,meId){const R=(f,a)=>sb.rpc(f,a).then(chk);return{demo:false,
  news:d=>R("news_outlook",{days:d}),brief:d=>R("brief_get",{d}),briefAct:a=>R("admin_brief",{act:a}),path:()=>R("my_path"),levelSave:sc=>R("my_level_save",{scores:sc}),
  myTickets:async()=>chk(await sb.from("support_tickets").select("*").order("updated_at",{ascending:false}).limit(50)),
  ticketOpen:(s,c,b)=>R("ticket_open",{subject:s,cat:c,body:b}),ticketReply:(t,b)=>R("ticket_reply",{tid:t,body:b}),ticketClose:t=>R("ticket_close",{tid:t}),ticketGet:t=>R("ticket_get",{tid:t}),
  adminTickets:st=>R("admin_tickets",{st}),ticketSet:(t,j)=>R("admin_ticket_set",{tid:t,j}),memberCard:u=>R("admin_member_card",{uid:u}),memberNote:(u,b)=>R("admin_member_note",{uid:u,body:b}),
  ops:()=>R("admin_ops"),exportJson:k=>R("admin_export",{kind:k}),bi:d=>R("admin_bi",{days:d}),compliance:()=>R("admin_compliance"),audit:(q,l)=>R("admin_audit",{q,lim:l}),
  consentSave:(c,t,b,r)=>R("admin_consent_doc_save",{c,ttl:t,bdy:b,req:r}),consentsNeeded:()=>R("my_consents_needed"),consentAccept:(c,v)=>R("consent_accept",{c,v})}}
function mkV11Demo(get,put,meId){
  const V=()=>{const d=get();if(!d.v11){d.v11={tk:[],msgs:[],seq:100,level:null,cons:{},notes:[],brief_tg:false,docs:[{code:"risk",version:1,title:"إفصاح المخاطر",body:"تداول العملات والذهب فيه مخاطرة عالية وممكن تخسر كل رأس مالك. التوصيات والأدوات تعليمية وليست نصيحة مالية.",required:true},{code:"data",version:1,title:"استخدام البيانات",body:"نحفظ بياناتك حتى نقدم الخدمة، ودفتر التداول خاص بيك.",required:false}]};put()}return d.v11};
  const now=Date.now(),iso=t=>new Date(t).toISOString(),E=m=>{throw new Error(m)};
  return{demo:true,
    async news(){const ev=[["CPI y/y","التضخم السنوي CPI","USD",26,"3.0%","3.1%",{n:36,above:21,below:12},{"XAU/USD":[35,9,29,20,.42],"EUR/USD":[35,11,29,19,.31],"USD/JPY":[35,26,29,8,.38],"GBP/USD":[35,12,29,18,.29]}],["Non-Farm Employment Change","الوظائف غير الزراعية NFP","USD",74,"165K","142K",{n:36,above:17,below:19},{"XAU/USD":[17,5,19,13,.55],"EUR/USD":[17,6,19,12,.36]}],["Main Refinancing Rate","قرار الفائدة الأوروبي","EUR",50,"2.00%","2.00%",{n:18,above:2,below:3},{}],["Retail Sales m/m","مبيعات التجزئة البريطانية","GBP",98,"0.3%","-0.2%",{n:29,above:15,below:13},{"GBP/USD":[15,9,13,4,.24],"GBP/JPY":[15,10,13,5,.28]}]];
      return{measured:412,with_actual:388,rows:ev.map(([t,ta,c,h,f,p,hi,rx],i)=>({id:"d"+i,title:t,title_ar:ta,country:c,at:iso(now+h*36e5),forecast:f,previous:p,hist:{...hi,inline:hi.n-hi.above-hi.below},past:hi.n,react:Object.fromEntries(Object.entries(rx).map(([s,[an,au,bn,bu,ab]])=>[s,{above:{n:an,up:au},below:{n:bn,up:bu},all:{n:an+bn,up:au+bu,abs:ab}}]))}))}},
    async brief(){const v=V(),day=new Date().toISOString().slice(0,10),mk=[["XAU/USD","trend_up","trend_up","ADX 32.4"],["EUR/USD","sideways","trend_down","ADX 14.1"],["GBP/USD","high_vol","trend_down","ATR +48% عن المتوسط"],["USD/JPY","trend_down","trend_down","ADX 27.0"],["BTC/USD","trend_up","sideways","ADX 22.3"]].map(([s,h,d,r])=>({sym:s,h4:h,d1:d,reason:r}));
      const ev=[{title:"التضخم السنوي CPI",country:"USD",at:iso(now+5*36e5),forecast:"3.0%",syms:["XAU/USD","EUR/USD","GBP/USD","USD/JPY"]},{title:"محضر FOMC",country:"USD",at:iso(now+11*36e5),forecast:"",syms:["XAU/USD","EUR/USD"]}];
      const txt="☀️ ملخص السوق اليومي · "+day+"\n\n"+mk.map(m=>"• "+V9.symN(m.sym)+": "+V9.ST[m.h4][0]+" على H4، "+V9.ST[m.d1][0]+" على D1").join("\n")+"\n\n📰 الأخبار القوية اليوم (بتوقيت بغداد):\n• CPI أمريكي — التوقع 3.0%\n\nالملخص مكتوب تلقائياً من بيانات المنصة، تعليمي وليس نصيحة مالية.";
      return{day,days:[day],txt,tg_on:v.brief_tg,tg_sent:false,admin:true,body:{market:mk,events:ev}}},
    async briefAct(a){const v=V();if(a==="tg_on")v.brief_tg=true;if(a==="tg_off")v.brief_tg=false;put()},
    async path(){const v=V(),L=await(async()=>{try{return(await DB.v9.jList())||[]}catch(e){return[]}})(),cl=L.filter(t=>t.closed_at&&t.pnl!=null),nosl=L.filter(t=>!t.sl).length,pb=L.filter(t=>t.followed_plan===false).length,em=L.filter(t=>["انتقام","طمعان","خايف","مستعجل"].includes(t.emotion)).length;
      const LS={"tech-17":"حجم المركز والوقف والعائد للمخاطرة","num-16":"إدارة رأس المال بالأرقام","num-15":"قياس التراجع (Drawdown)","tech-16":"السيناريو الأساسي والبديل","tech-01":"ليش 90% يخسرون… وشلون تصير من الـ 10%","num-07":"التوقع الرياضي: ليش تربح بنسبة نجاح 40%","tim-06":"الأخبار الاقتصادية والتوقيت","tim-03":"أفضل وأسوأ أوقات التداول"};
      const rec=(why,n,ids)=>({why,n,items:ids.map((id,i)=>({id,title:LS[id],course:id.split("-")[0],done:i===2}))}),recs=[];
      if(nosl)recs.push(rec("صفقات بدون وقف خسارة: "+nosl,nosl,["tech-17","num-16","num-15"]));if(pb>=2)recs.push(rec("صفقات خارج الخطة: "+pb,pb,["tech-16","tech-01","num-07"]));if(em>=2)recs.push(rec("صفقات بمشاعر قوية (انتقام/طمع/خوف/استعجال): "+em,em,["tech-01","num-07","num-16"]));
      const C=[["tech","التحليل الفني",18,7,"tech-07","MACD وستوكاستك"],["cls","التحليل الكلاسيكي",15,3,"cls-10","المستطيل والنطاقات الأفقية"],["wav","التحليل الموجي (إليوت)",15,0,"wav-01","السوق يتنفس بموجات… واللي يشوفها يسبق الكل"],["tim","التحليل الزمني",14,5,"tim-12","دورات اليوم والأسبوع"],["num","التحليل الرقمي (الإحصائي)",18,18,null,null]];
      return{level:v.level,journal:{closed:cl.length},recs,courses:C.map(([id,t,tot,dn,nid,nt])=>({id,title:t,total:tot,done:dn,next:nid?{id:nid,title:nt}:null}))}},
    async levelSave(sc){const av=Object.values(sc).reduce((a,b)=>a+b,0)/Object.keys(sc).length,lv=av>=75?"advanced":av>=45?"intermediate":"beginner";V().level={level:lv,scores:sc,taken_at:iso(now)};put();return lv},
    async myTickets(){return V().tk.filter(t=>t.user_id===(meId()||"me")).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at))},
    async ticketOpen(s,c,b){if((s||"").trim().length<3||(b||"").trim().length<5)E("اكتب عنوان ورسالة واضحة");const v=V(),id=++v.seq;v.tk.push({id,user_id:meId()||"me",subject:s.trim(),cat:c,status:"open",priority:"normal",last_by:"user",created_at:iso(Date.now()),updated_at:iso(Date.now()),name:"Omar Rabah",email:"o@x.com"});v.msgs.push({tid:id,staff:false,body:b.trim(),at:iso(Date.now()),name:"Omar Rabah"});put();return id},
    async ticketReply(t,b){if(!(b||"").trim())E("الرسالة فارغة");const v=V(),k=v.tk.find(x=>x.id===t),st=location.hash.includes("crm");v.msgs.push({tid:t,staff:st,body:b.trim(),at:iso(Date.now()),name:st?"فريق فيكسورا":"Omar Rabah"});Object.assign(k,{status:st?"pending":"open",updated_at:iso(Date.now())});put()},
    async ticketClose(t){const k=V().tk.find(x=>x.id===t);k.status="closed";put()},
    async ticketGet(t){const v=V(),k=v.tk.find(x=>x.id===t);return{...k,msgs:v.msgs.filter(m=>m.tid===t)}},
    async adminTickets(st){const v=V(),R=v.tk.filter(t=>st==="active"?t.status!=="closed":st==="closed"?t.status==="closed":true).map(t=>({...t,msgs:v.msgs.filter(m=>m.tid===t.id).length}));return{counts:{open:v.tk.filter(t=>t.status==="open").length,pending:v.tk.filter(t=>t.status==="pending").length,closed7:v.tk.filter(t=>t.status==="closed").length,first_reply_h:2.4},rows:R}},
    async ticketSet(t,j){const k=V().tk.find(x=>x.id===t);if(j.priority)k.priority=j.priority;put()},
    async memberCard(u){const v=V();return{profile:{name:"Omar Rabah",email:"o@x.com",telegram:"@omar",status:"approved",last_seen:iso(now)},tickets:v.tk,notes:v.notes,purchases:[{kind:"course",amount:120,status:"paid"}],academy:{lessons_done:33,certs:1,level:v.level&&v.level.level},journal:46}},
    async memberNote(u,b){if((b||"").trim().length<2)E("الملاحظة فارغة");V().notes.unshift({body:b.trim(),at:iso(Date.now()),by:"Omar"});put()},
    async ops(){return{engine:{last:iso(now-4*6e4),runs24:288,ok24:285,last_err:{at:iso(now-9*36e5),note:"Twelve Data: rate limit"}},http24:{total:1342,errors:6},regime:{rows:15,stale:2},mfa:{admins:2,with_mfa:1},
      jobs:[["vx-regime","*/15 * * * *",0],["vx-cot","*/10 * * * *",0],["vx-news-react","7,37 * * * *",0],["vx-brief","0 4 * * *",0],["vx-binary","30 21 * * 5",0],["engine","*/5 * * * *",1]].map(([n,s,f])=>({name:n,schedule:s,active:true,fails24:f,last:{status:f?"failed":"succeeded",at:iso(now-12*6e4)}})),
      prices:[["D1",5,153,3393],["H1",5,3,3183],["H4",5,48,3168],["M5",2,3,3]].map(([tf,n,a,b])=>({tf,syms:n,newest_min:a,oldest_min:b})),errors:{cot:"",news_fail:"0",news_last:{at:iso(now-15*6e4),ok:true},tr_failed:0,push_pending:3},
      admin_log:[["Omar","regime_rules","config"],["Omar","cot_fetch","cot"],["Evan","ticket_close","104"],["Omar","cert_publish","VX-1011"]].map(([a,b,c],i)=>({actor:a,action:b,target:c,at:iso(now-i*37*6e4)}))}},
    async exportJson(k){return{at:iso(now),kind:k,demo:true}},
    async bi(d){let s=5;const r=()=>(s=(s*9301+49297)%233280)/233280,D=[];for(let i=d;i>=0;i--)D.push({day:new Date(now-i*864e5).toISOString().slice(0,10),signups:Math.round(3+r()*9+(d-i)/d*6),paid:r()<.35?Math.round(49+r()*200):0,lessons:Math.round(20+r()*60)});
      return{days:d,kpi:{users:1284,members:612,new:Math.round(D.reduce((a,x)=>a+x.signups,0)),active7:233,active30:418,revenue:D.reduce((a,x)=>a+x.paid,0),paid_orders:D.filter(x=>x.paid).length,lessons_done:D.reduce((a,x)=>a+x.lessons,0),certs:17,tickets:41},daily:D,
        funnel:{signup:640,approved:388,lesson:291,paid:96,cert:17},cohorts:[0,1,2,3,4,5,6,7].map(i=>({week:new Date(now-(i+1)*7*864e5).toISOString().slice(0,10),n:60+i*4,w1:Math.round((60+i*4)*.52),w2:Math.round((60+i*4)*.41),w4:Math.round((60+i*4)*.29),ready1:i>=1,ready2:i>=2,ready4:i>=4})),
        by_kind:[{kind:"monthly",n:58,sum:2842},{kind:"course",n:27,sum:3240},{kind:"zoom",n:11,sum:880}],countries:[["IQ",742],["SA",121],["AE",88],["JO",64],["DE",41]].map(([k,n])=>({k,n}))}},
    async compliance(){const v=V();return{docs:v.docs.map(d=>({...d,accepted:d.code==="risk"?574:212,users:612})),data_requests:[{kind:"export",status:"done",at:iso(now-3*864e5),email:"user@x.com"}],admin_actions_30d:184}},
    async audit(q){const L=[["Omar","regime_rules","config"],["Omar","cot_fetch","cot"],["Evan","ticket_close","104"],["Omar","consent_doc","risk"],["Omar","cert_publish","VX-1011"]].map(([a,b,c],i)=>({actor:a,action:b,target:c,at:iso(now-i*36e5)}));return L.filter(x=>!q||JSON.stringify(x).includes(q))},
    async consentSave(c,t,b,r){const d=V().docs.find(x=>x.code===c);if(d.body!==b)d.version++;Object.assign(d,{title:t,body:b,required:r});put();return d.version},
    async consentsNeeded(){try{if(localStorage.getItem("v11demoConsent")!=="1")return[]}catch(e){return[]}const v=V();return v.docs.filter(d=>d.required&&v.cons[d.code]!==d.version)},
    async consentAccept(c,ver){V().cons[c]=ver;put()}}}
/* V13 backend adapters: الناسخ التلقائي */
function mkV13Supa(sb,chk){const R=(f,a)=>sb.rpc(f,a).then(chk);return{demo:false,
  me:()=>R("copier_me"),join:p=>R("copier_join",{p}),save:p=>R("copier_save",{p}),toggle:a=>R("copier_toggle",{act:a}),consent:(c,v)=>R("consent_accept",{c,v}),
  aList:()=>R("admin_copier_list"),aSet:(u,a,w)=>R("admin_copier_set",{uid:u,act:a,why:w||""}),aCfg:p=>R("admin_copier_cfg",{p}),aKill:c=>R("admin_copier_kill",{close_open:!!c})}}
function mkV13Demo(get,put,meId){
  const L0={on:false,live:false,max_risk:3,max_day:5,max_open:3,max_lot:.5,min_bal:100,src:"all",min_pct:70,syms:["XAU/USD","EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","USD/CHF","GBP/JPY","XAG/USD","BTC/USD","ETH/USD"]};
  const DEF={risk:1,lot_mode:"auto",lot:.01,max_day:3,max_open:2,day_target:3,day_stop:2,syms:["XAU/USD"],tp:"tp2"};
  const S=()=>{const d=get();if(!d.v13){d.v13={L:{...L0},acct:null,ev:[],ok:false,others:[
    {user_id:"d1",name:"أحمد علي",account:"9935412",status:"approved",active:true,balance:2400,is_demo:true,settings:{...DEF,risk:1},today:{opened:2,pnl:31},last_seen:new Date().toISOString()},
    {user_id:"d2",name:"مريم عادل",account:"9935522",status:"pending",active:false,balance:null,settings:{...DEF},today:{opened:0,pnl:0},last_seen:null},
    {user_id:"d3",name:"حسين محمد",account:"9935501",status:"approved",active:false,balance:1100,is_demo:true,settings:{...DEF,risk:2},today:{opened:2,pnl:-22},last_seen:new Date(Date.now()-36e5).toISOString()}]};put(d)}return d};
  const E=m=>{throw new Error(m)},sv=f=>{const d=S();f(d.v13);put(d)};
  const me=()=>{const v=S().v13;return{profile:{name:"عضو تجريبي",account:"9935360",status:"approved"},eligible:true,limits:v.L,defaults:DEF,acct:v.acct,
    today:{opened:v.ev.filter(e=>e.kind==="open").length,closed:0,pnl:0},events:v.ev.slice(0,20),consent:{code:"copier",version:1,title:"إفصاح مخاطر الناسخ التلقائي",body:"الناسخ يفتح صفقات حقيقية على حسابك بالإعدادات اللي إنت تختارها. التداول بالرافعة فيه مخاطرة عالية وممكن تخسر كل رأس مالك.\n• النتائج السابقة ما تضمن نتائج قادمة.\n• ما نطلب ولا نخزن كلمة سر حسابك.",ok:v.ok}}};
  const clean=p=>{const L=S().v13.L,o={...DEF,...(S().v13.acct||{}).settings,...p};
    if(o.risk<0.1||o.risk>L.max_risk)E("BAD_RISK: نسبة المخاطرة لازم من 0.1 لحد "+L.max_risk);if(o.lot<0.01||o.lot>L.max_lot)E("BAD_LOT: اللوت لازم بين 0.01 و "+L.max_lot);
    if(o.max_day<1||o.max_day>L.max_day)E("BAD_MAX_DAY: أقصى صفقات باليوم بين 1 و "+L.max_day);if(o.max_open<1||o.max_open>L.max_open)E("BAD_MAX_OPEN: أقصى صفقات مفتوحة بين 1 و "+L.max_open);
    if(!o.syms||!o.syms.length)E("BAD_SYMS: اختار زوج واحد على الأقل");return o};
  return{demo:true,
    async me(){return me()},
    async join(p){const ac=String(p.account||"9935360").trim();if(!/^[0-9]{5,12}$/.test(ac))E("BAD_ACCOUNT: اكتب رقم حساب MT5 صحيح (أرقام بس)");sv(v=>{v.acct={account:ac,server:p.server||"INFINOX-Live",holder:p.holder||"",status:"pending",reason:"",active:false,token:null,settings:{...DEF},cmd:"",balance:null,equity:null,is_demo:null,ea_version:"",last_seen:null}});return me()},
    async save(p){const o=clean(p);sv(v=>{v.acct.settings=o});return me()},
    async toggle(a){const v=S().v13;if(a==="on"){if(v.acct.status!=="approved")E("NOT_APPROVED: بانتظار موافقة الإدارة");if(!v.ok)E("CONSENT: وافق على إفصاح مخاطر الناسخ أول")}
      sv(x=>{x.acct.active=a==="on";if(a==="close_all"){x.acct.cmd="close_all";x.ev.unshift({kind:"cmd",reason:"طلب إغلاق كل صفقات الناسخ",at:new Date().toISOString()})}});return me()},
    async consent(){sv(v=>{v.ok=true})},
    async aList(){const v=S().v13,rows=[...(v.acct?[{user_id:meId()||"me",name:"عضو تجريبي (إنت)",account:v.acct.account,status:v.acct.status,active:v.acct.active,balance:v.acct.balance,is_demo:v.acct.is_demo,settings:v.acct.settings,today:{opened:0,pnl:0},last_seen:v.acct.last_seen}]:[]),...v.others];return{limits:v.L,rows}},
    async aSet(u,a){sv(v=>{const r=v.others.find(x=>x.user_id===u)||(v.acct&&{ref:v.acct});const t=r&&(r.ref||r);if(!t)return;
      if(a==="approve"){t.status="approved";t.token=t.token||"demo"+Math.random().toString(16).slice(2).padEnd(60,"0");if(r.ref){t.balance=1250;t.is_demo=true;t.last_seen=new Date().toISOString();t.ea_version="1.0"}}
      else if(a==="reject"){t.status="rejected";t.active=false}else if(a==="pause"){t.status="paused";t.active=false}else if(a==="resume")t.status="approved"})},
    async aCfg(p){sv(v=>{for(const k in p)if(k in v.L)v.L[k]=k==="on"||k==="live"?!!p[k]:k==="src"?p[k]:+p[k]});return S().v13.L},
    async aKill(c){let n=0;sv(v=>{v.L.on=false;if(v.acct){v.acct.active=false;if(c)v.acct.cmd="close_all";n++}v.others.forEach(o=>{if(o.active){o.active=false;n++}})});return n}}}

/* V5 backend adapters: VEXORA NEWS + PARTNERS */
function mkV5Supa(sb,chk,meId){const R=(f,a)=>sb.rpc(f,a).then(chk);return{demo:false,ownerPolicyRead:()=>R("vexora_v3_owner_policy_read"),ownerPolicySave:a=>R("vexora_v3_owner_policy_save",a),...v7Supa(R),grad:()=>R("grad_banner").catch(()=>null),
  // ---- news ----
  events:async(a,b)=>chk(await sb.from("econ_events").select("*").gte("at",a).lte("at",b).order("at")),
  event:id=>R("news_event",{eid:id}),feed:()=>R("news_feed",{lim:40}),
  myNews:()=>R("my_news"),savePrefs:p=>R("set_news_prefs",{p}),tgCode:()=>R("news_tg_code"),tgUnlink:()=>R("news_tg_unlink"),
  admNews:(a,b)=>R("admin_news_list",{dfrom:a,dto:b}),admStatus:()=>R("admin_news_status"),admEvent:e=>R("admin_news_event_save",{e}),
  admArticle:a=>R("admin_news_article_save",{a}),admCfg:(k,v)=>R("admin_news_cfg",{k,v}),admTgTest:()=>R("admin_news_tg_test"),admPost:p=>R("admin_news_post",{p}),
  admSync:()=>R("admin_news_sync_now"),admFeed:f=>R("admin_news_feed_save",{f}),
  // ---- partners ----
  portal:()=>R("partner_portal"),apply:d=>window.VexoraAttribution
    ?window.VexoraAttribution.applyWithTeam(d,body=>R("partner_apply",{d:body}))
    :R("partner_apply",{d}),dash:()=>R("partner_dash"),
  payout:(meth,det)=>R("partner_payout_request",{meth,det}),ticket:(subj,bdy)=>R("partner_ticket",{subj,bdy}),
  visit:(c,a)=>R("partner_visit",{c,a}),setRef:c=>R("set_my_partner",{c}),
  myIb:()=>R("my_ib"),ibSave:(d,submit)=>R("ib_save",{d,submit}),brokers:(lg,ctry,aud)=>R("broker_support",{lg,ctry,aud:aud||"traders"}),
  dash6:()=>R("partner_dash_v6"),team:()=>R("partner_team"),setPlace:pref=>R("partner_set_place",{pref}),claimInc:iid=>R("partner_claim_incentive",{iid}),
  brokerTicket:(ch,topic,bdy)=>R("broker_ticket",{ch,topic,bdy}),myTickets:ch=>R("my_tickets",{ch}),
  uploadDoc:async(file,uid)=>{const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,5),path=`${uid||meId()}/ib/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;
    chk(await sb.storage.from("partner-docs").upload(path,file,{contentType:file.type,upsert:false}));return path},
  docUrl:async path=>{const r=await sb.storage.from("partner-docs").createSignedUrl(path,300);if(r.error)throw r.error;return r.data.signedUrl},
  adm:{data:()=>R("admin_partners_data"),decide:(pid,st,nt)=>R("admin_partner_decide",{pid,st,nt}),level:(pid,lid)=>R("admin_partner_level",{pid,lid}),
    levels:rows=>R("admin_partner_levels_save",{rows}),product:r=>R("admin_partner_product_save",{r}),contract:(pt,ver,ttl,bdy)=>R("admin_partner_contract_save",{pt,ver,ttl,bdy}),
    comm:(cid,act,nt)=>R("admin_comm_act",{cid,act,nt}),adjust:(pid,amt,nt)=>R("admin_comm_adjust",{pid,amt,nt}),payout:(pid,act,nt,ref)=>R("admin_payout_decide",{pid,act,nt,ref}),
    report:mon=>R("admin_partner_report",{mon}),ib:(aid,st,nt,ibn,proof)=>R("admin_ib_update",{aid,st,nt,ibn,proof}),ibImport:(per,fname,rows)=>R("admin_ib_import",{per,fname,rows}),ibPlans:()=>R("admin_ib_plans"),v6:()=>R("admin_partners_v6"),rate:(pid,rate)=>R("admin_partner_rate",{pid,rate}),incSave:r=>R("admin_incentive_save",{r}),incClaim:(cid,act,nt)=>R("admin_incentive_claim",{cid,act,nt}),ibPlan:(uid,p)=>R("admin_ib_plan_save",{uid,p}),
    broker:b=>R("admin_broker_save",{b}),brokerOrder:ids=>R("admin_broker_order",{ids}),asset:a=>R("admin_partner_asset",{a}),
    ticket:(tid,rep,cl)=>R("admin_partner_ticket_reply",{tid,rep,cl}),cfg:(k,v)=>R("admin_partner_cfg",{k,v})}
}}

/* Demo backend (local preview only): every record is marked as DEMO and never reaches production */
function mkV5Demo(get,put,meId){
  const NOW=()=>Date.now(),iso=ms=>new Date(ms).toISOString(),E=m=>{throw new Error(m)};
  const D=()=>{const d=get();if(!d.v5){const n=NOW(),m=6e4,h=36e5,day=864e5,r0=x=>Math.round(x/m)*m;
    const ev=(id,title,ar,c,at,imp,fc,prev,act,st,cat)=>({id,title,title_ar:ar,country:c,at:iso(r0(at)),impact:imp,forecast:fc,previous:prev,actual:act||"",status:st||(act?"released":"upcoming"),source:"demo",source_url:"",manual:false,category:cat,note:"",updated_at:iso(n-12*m),actual_at:act?iso(at+60*1000):null});
    d.v5={seq:500,events:[
      ev("d1","Core CPI m/m","مؤشر أسعار المستهلك الأساسي CPI","USD",n+102*m,"High","0.3%","0.3%","","","inflation"),
      ev("d2","CPI y/y","مؤشر أسعار المستهلك السنوي","USD",n+102*m,"High","2.9%","3.0%","","","inflation"),
      ev("d3","Crude Oil Inventories","مخزونات النفط الخام","USD",n+192*m,"Medium","-1.4M","2.1M","","","other"),
      ev("d4","GDP q/q","الناتج المحلي الإجمالي","EUR",n-3.5*h,"Medium","0.2%","0.1%","0.2%","","gdp"),
      ev("d5","CPI y/y","نسبة التضخم البريطانية","GBP",n-5.5*h,"High","2.4%","2.6%","2.7%","","inflation"),
      ev("d6","BOJ Gov Speaks","كلمة محافظ بنك اليابان","JPY",n+6*h,"Medium","","","","postponed","speech"),
      ev("d7","Federal Funds Rate","قرار الفائدة الفيدرالي","USD",n+7.5*h,"High","4.25%","4.25%","","","rates"),
      ev("d8","Main Refinancing Rate","قرار فائدة المركزي الأوروبي","EUR",n+day+3*h,"High","2.15%","2.15%","","","rates"),
      ev("d9","Unemployment Claims","طلبات إعانة البطالة","USD",n+day+4*h,"Medium","220K","217K","","","jobs"),
      ev("d10","Non-Farm Employment Change","الوظائف غير الزراعية NFP","USD",n+2*day+4*h,"High","145K","142K","","","jobs"),
      ev("d11","Unemployment Rate","نسبة البطالة","USD",n+2*day+4*h,"High","4.2%","4.2%","","","jobs"),
      ev("d12","German ZEW Economic Sentiment","مؤشر ZEW الألماني","EUR",n-day+2*h,"Medium","38.5","39.3","41.2","","pmi")],
      log:{d5:[{at:iso(n-5.5*h+6e4),kind:"actual",changes:{actual:["","2.7%"]}},{at:iso(n-5.75*h),kind:"sent",changes:{kind:"r15"}},{at:iso(n-6.5*h),kind:"sent",changes:{kind:"r60"}},{at:iso(n-day),kind:"updated",changes:{forecast:["2.5%","2.4%"]}},{at:iso(n-3*day),kind:"created",changes:{source:"demo"}}],
           d1:[{at:iso(n-20*h),kind:"updated",changes:{forecast:["0.2%","0.3%"]}},{at:iso(n-3*day),kind:"created",changes:{source:"demo"}}]},
      articles:[{id:1,title:"تحليل الكوتش: شلون تتعامل ويه خبر CPI",title_en:"Coach's take: trading around CPI",body:"قبل الخبر بـ 15 دقيقة لا تفتح صفقة جديدة، وخلي وقف الخسارة بمكانه. بعد صدور الرقم استنى أول شمعة 5 دقايق تسكر قبل لا تقرر.",body_en:"Avoid opening new trades in the 15 minutes before the release and keep your stop loss in place. After the number, wait for the first 5-minute candle to close.",category:"analysis",ccy:"USD",breaking:false,status:"published",source_name:"VEXORA",source_url:"",published_at:iso(n-2*h)},
        {id:2,title:"الفيدرالي يبقي الفائدة دون تغيير، والذهب يتحرك بعد القرار",title_en:"Fed holds rates; gold moves after the decision",body:"",body_en:"",category:"rates",ccy:"USD",breaking:true,status:"published",source_name:"VEXORA",source_url:"",published_at:iso(n-6*m)}],
      headlines:[{title:"الذهب يرتفع قبل بيانات التضخم الأمريكية",link:"https://example.com/demo-1",cat:"gold",at:iso(n-25*m),feed:"مصدر تجريبي"},{title:"الدولار يتراجع أمام العملات الرئيسية مع ترقب الأسواق",link:"https://example.com/demo-2",cat:"fx",at:iso(n-h),feed:"مصدر تجريبي"},{title:"اليورو يستقر بعد بيانات الناتج المحلي",link:"https://example.com/demo-3",cat:"fx",at:iso(n-2*h),feed:"مصدر تجريبي"}],
      prefs:null,tg:null,cfg:{cal_alerts:"1",cal_currencies:"USD,EUR,GBP,JPY",news_rem:"60,30,15",news_min_imp:"High",news_result:"1",news_chat:"",news_ch_link:"https://t.me/vexora_news_demo",news_provider:"forexfactory",news_fetch_min:"15",news_rate:"25",tg_bot_user:"VexoraDemoBot"},
      outbox:[{id:3,kind:"result",target:"channel",status:"sent",err:"",at:iso(n-5.5*h),events:["d5"],body:"✅ صدرت النتيجة · GBP CPI y/y 2.7%"},{id:2,kind:"r15",target:"channel",status:"sent",err:"",at:iso(n-5.75*h),events:["d5"],body:"⏰ خبر بعد 15 دقيقة"},{id:1,kind:"r60",target:"user",status:"failed",err:"Forbidden: bot was blocked by the user",at:iso(n-6.5*h),events:["d5"],body:""}],
      sync:[{id:2,at:iso(n-12*m),provider:"demo",ok:true,http:200,n_new:0,n_upd:2,n_resched:0,n_actual:1,err:""},{id:1,at:iso(n-3*h),provider:"demo",ok:false,http:503,n_new:0,n_upd:0,n_resched:0,n_actual:0,err:"Service unavailable (demo)"}],
      // partners
      levels:[{id:1,code:"starter",name:"Starter",icon:"🥉",min_sales:0,rate:10,team1_pct:0,team2_pct:0,perks:"رابط إحالة + مواد تسويقية",upgrade_rule:"من أول بيع مؤكد",active:true,active_from:"2026-11-01",sort:1},{id:2,code:"silver",name:"Silver",icon:"🥈",min_sales:10,rate:15,team1_pct:5,team2_pct:0,perks:"دعم أولوية",upgrade_rule:"بعد 10 مبيعات مؤكدة",active:true,active_from:"2026-11-01",sort:2},{id:3,code:"gold",name:"Gold",icon:"🥇",min_sales:30,rate:20,team1_pct:5,team2_pct:2,perks:"صفحة شريك خاصة",upgrade_rule:"بعد 30 مبيعة مؤكدة",active:true,active_from:"2026-11-01",sort:3},{id:4,code:"diamond",name:"Diamond",icon:"💎",min_sales:75,rate:25,team1_pct:7,team2_pct:3,perks:"جلسة شهرية مع الكوتش",upgrade_rule:"بعد 75 مبيعة مؤكدة",active:true,active_from:"2026-11-01",sort:4}],
      products:[{code:"monthly",name:"اشتراك VIP",commissionable:true,rate_override:null,hold_days:14},{code:"course",name:"الكورسات",commissionable:true,rate_override:null,hold_days:14},{code:"zoom",name:"الجلسات الخاصة",commissionable:true,rate_override:null,hold_days:14},{code:"ai",name:"اشتراك المساعد AI",commissionable:false,rate_override:null,hold_days:14}],
      contracts:[{id:1,ptype:"sales",version:"v1.0",title:"عقد شريك مبيعات · VEXORA Sales Partner",active:true,body:"تنبيه: هذا قالب أولي من فيكسورا، وما يعتبر عقداً قانونياً نهائياً قبل مراجعته من مختص قانوني.\n\n1. الأطراف\nالطرف الأول: فيكسورا VEXORA. الطرف الثاني: الشريك المسجّل بياناته في الطلب.\n\n2. نوع الشراكة ونطاق العمل\nترويج الخدمات المؤهلة للعمولة عبر رابط الإحالة الخاص.\n\n3. الصلاحيات\nلا يحق للشريك التعاقد أو تحصيل الأموال باسم فيكسورا.\n\n4. نسب العمولات\nحسب مستوى الشريك المعتمد وقت البيع.\n\n5. شروط الاستحقاق\nالمبيعات المؤكدة فقط. تسجيل حساب لدى وسيط أو الإيداع لا يعتبر بيعاً.\n\n6. مواعيد التسوية · 7. الإلغاء والاسترجاع · 8. قواعد التسويق · 9. السرية · 10. حماية البيانات · 11. تضارب المصالح · 12. الإفصاح عن العلاقة التجارية · 13. مدة العقد · 14. الإنهاء والتعليق · 15. القانون الحاكم وآلية النزاعات"},
        {id:2,ptype:"distributor",version:"v1.0",title:"عقد موزع معتمد · VEXORA Distributor",active:true,body:"تنبيه: قالب أولي يحتاج مراجعة مختص قانوني.\n\n(نفس بنود عقد الشريك مع نطاق إعادة التوزيع المسموح.)"},
        {id:3,ptype:"ib",version:"v1.0",title:"إقرار طلب IB · VEXORA IB Applicant",active:true,body:"تنبيه: قالب أولي يحتاج مراجعة مختص قانوني.\n\n1. فيكسورا لا تملك صلاحية اعتماد IB نيابة عن INFINOX، ودورها مراجعة الطلب ورفعه فقط.\n2. صفة IB ورقم IB الرسمي تصدر من الوسيط وحده.\n3. عمولات IB تخضع لاتفاقية الوسيط وحدها.\n4. أي مشاركة لعمولات IB لا تتم إلا إذا كانت مصرحاً بها."}],
      partners:{},sales:[],comms:[],commlog:[],payouts:[],visits:[],tickets:[],ib:{},ibEarn:[],ibImports:[],statuslog:[],
      brokers:[{id:1,broker:"INFINOX",logo_url:"",agent_name:"[اسم مسؤول الدعم]",telegram:"@infinox_support_demo",whatsapp:"",email:"support@example.com",website:"https://www.infinox.com",hours:"الأحد–الخميس 9:00–18:00",langs:["ar","en"],countries:[],notes:"لفتح الحساب ومشاكل الإيداع والسحب.",visible:true,verified:true,is_default:true,sort:1},{id:2,broker:"INFINOX",agent_name:"English desk",langs:["en"],countries:[],notes:"",telegram:"",whatsapp:"",email:"",website:"",hours:"",logo_url:"",visible:false,verified:false,is_default:false,sort:2}],
      assets:[{id:1,title:"بانرات ستوري وبوست",kind:"image",url:"https://example.com/demo-banners.zip",active:true},{id:2,title:"فيديو تعريفي",kind:"video",url:"https://example.com/demo-video.mp4",active:true}],
      pcfg:{partner_min_payout:"20",partner_enabled:"1"}};
    // شريك تجريبي معتمد حتى تبين لوحة الشريك ولوحة الإدارة بالمعاينة
    const P="demo-partner-1";d.v5.partners[P]={user_id:P,ptype:"sales",status:"APPROVED",code:"OMAR7K",level_id:2,full_name:"أحمد ك. (تجريبي)",phone:"",country:"IQ",channels:"تيليجرام، إنستغرام",audience:"",experience:"",contract_id:1,contract_version:"v1.0",contract_hash:"9f2c4e81b7a05d3c6e1f",sign_name:"Ahmed K",signed_at:iso(n-40*day),approved_at:iso(n-38*day),created_at:iso(n-41*day),admin_note:"",email:"partner@demo"};
    d.v5.partners["demo-partner-2"]={user_id:"demo-partner-2",ptype:"distributor",status:"PENDING",code:null,level_id:null,full_name:"سارة م. (تجريبي)",phone:"",country:"JO",channels:"يوتيوب",audience:"",experience:"3 سنوات",contract_id:2,contract_version:"v1.0",contract_hash:"ab12",sign_name:"Sara M",signed_at:iso(n-day),created_at:iso(n-day),admin_note:"",email:"sara@demo"};
    const S=(id,prod,amt,st,days,rate)=>{d.v5.sales.push({id,partner_id:P,purchase_id:1000+id,buyer_id:"b"+id,product:prod,amount:amt,currency:"$",status:"paid",created_at:iso(n-days*day)});d.v5.comms.push({id,partner_id:P,sale_id:id,kind:"commission",amount:Math.round(amt*rate)/100,rate,currency:"$",status:st,level_code:"silver",payout_id:null,note:"",created_at:iso(n-days*day)})};
    S(1,"monthly",49,"PENDING",1,15);S(2,"course",120,"VERIFIED",3,15);S(3,"zoom",80,"APPROVED",8,15);S(4,"monthly",49,"PAID",15,10);S(5,"monthly",49,"REVERSED",20,10);
    for(let i=0;i<12;i++)S(10+i,"monthly",49,"PAID",25+i,10);
    for(let i=0;i<30;i++)for(let k=0;k<5+((i*7)%9);k++)d.v5.visits.push({code:"OMAR7K",day:iso(n-i*day).slice(0,10),anon:"a"+i+"-"+k});
    put()}return d};
  const S=()=>D().v5,uid=()=>meId()||"demo-me",sav=()=>put();
  const lvl=id=>S().levels.find(l=>l.id===id),confirmed=pid=>S().comms.filter(c=>c.partner_id===pid&&c.kind==="commission"&&["APPROVED","PAID"].includes(c.status)).length;
  const isAdm=()=>{try{return isAdminUser()}catch(e){return true}};
  return{demo:true,...v7Demo({S,sav,uid,isAdm,E,NOW,iso}),grad:async()=>{const g=S().v8grad;return g&&new Date(g.pub_until)>new Date()?g:null},
    async events(a,b){const A=new Date(a),B=new Date(b);return S().events.filter(e=>new Date(e.at)>=A&&new Date(e.at)<=B).sort((x,y)=>new Date(x.at)-new Date(y.at))},
    async event(id){const e=S().events.find(x=>x.id===id);if(!e)return null;return{...e,log:(S().log[id]||[{at:e.updated_at,kind:"created",changes:{source:"demo"}}]),related:S().events.filter(x=>x.id!==id&&x.country===e.country&&x.category===e.category).slice(0,4),channel:S().cfg.news_ch_link}},
    async feed(){return{articles:S().articles.filter(a=>a.status==="published").sort((a,b)=>(b.breaking-a.breaking)||new Date(b.published_at)-new Date(a.published_at)),headlines:S().headlines,channel:S().cfg.news_ch_link}},
    async myNews(){return{prefs:S().prefs||{ccys:["USD","EUR","XAU"],impacts:["High"],leads:[30],on_result:true,in_site:true,tg:false,paused:false,new:true},tg:S().tg,bot:S().cfg.tg_bot_user,channel:S().cfg.news_ch_link}},
    async savePrefs(p){S().prefs={...p,tg:!!(p.tg&&S().tg)};sav()},
    async tgCode(){const c="VX"+Math.random().toString(36).slice(2,8).toUpperCase();setTimeout(()=>{S().tg={username:"demo_user",active:true,linked_at:iso(NOW())};sav()},4000);return{code:c,bot:S().cfg.tg_bot_user,url:"https://t.me/"+S().cfg.tg_bot_user+"?start="+c,expires_at:iso(NOW()+6e5)}},
    async tgUnlink(){S().tg=null;if(S().prefs)S().prefs.tg=false;sav()},
    async admNews(a,b){return{events:await this.events(a,b),articles:S().articles,feeds:[{id:1,name:"أخبار الذهب",url:"https://news.google.com/rss/search?q=...",keywords:"",enabled:true},{id:2,name:"أخبار الفوركس",url:"https://news.google.com/rss/search?q=...",keywords:"",enabled:false}]}},
    async admStatus(){const v=S();return{provider:v.cfg.news_provider,active_provider:"demo",api_key_set:false,token_set:false,tg_hook:true,chats:["(تجريبي)"],news_chat:v.cfg.news_chat,last_sync:v.sync[0].at,fails:"0",cfg:v.cfg,
      counts:{events_week:v.events.length,manual:v.events.filter(e=>e.manual).length,subs:v.prefs?1:0,linked:v.tg?1:0,sent7:v.outbox.filter(o=>o.status==="sent").length,failed7:v.outbox.filter(o=>o.status==="failed").length,queued:0,articles_draft:v.articles.filter(a=>a.status==="draft").length},sync:v.sync,outbox:v.outbox}},
    async admEvent(e){const v=S();if(!e.id){if(!e.title||!e.at)E("REQUIRED: العنوان والموعد");const id="m"+(++v.seq);v.events.push({id,title:e.title,title_ar:e.title_ar||"",country:(e.country||"USD").toUpperCase(),at:new Date(e.at).toISOString(),impact:e.impact||"High",forecast:e.forecast||"",previous:e.previous||"",actual:e.actual||"",status:e.actual?"released":"upcoming",source:"VEXORA",source_url:e.source_url||"",manual:true,category:e.category||"other",note:e.note||"",updated_at:iso(NOW()),actual_at:e.actual?iso(NOW()):null});(v.log[id]=[]).unshift({at:iso(NOW()),kind:"created",changes:{manual:true}});sav();return id}
      const o=v.events.find(x=>x.id===e.id);if(!o)E("NOT_FOUND");let st=e.status||o.status;const act=e.actual!=null?e.actual:o.actual;if(act&&!o.actual&&st==="upcoming")st="released";if(!act&&st==="released")E("ACTUAL_REQUIRED: ما نكتب «صدرت» بدون رقم فعلي");
      const ch={};["title","title_ar","country","impact","forecast","previous","note","source_url"].forEach(k=>{if(e[k]!=null&&e[k]!==o[k]){ch[k]=[o[k],e[k]];o[k]=e[k]}});if(e.at&&new Date(e.at).toISOString()!==o.at){ch.at=[o.at,new Date(e.at).toISOString()];o.at=new Date(e.at).toISOString()}
      if(act!==o.actual){ch.actual=[o.actual,act];o.actual=act;o.actual_at=iso(NOW())}if(st!==o.status){ch.status=[o.status,st];o.status=st}o.updated_at=iso(NOW());
      if(Object.keys(ch).length)(v.log[o.id]=v.log[o.id]||[]).unshift({at:iso(NOW()),kind:ch.at?"rescheduled":ch.actual?"actual":ch.status?"status":"updated",changes:ch});sav();return o.id},
    async admArticle(a){const v=S();if(!a.title)E("REQUIRED");if(a.id){const o=v.articles.find(x=>x.id==a.id);Object.assign(o,a,{published_at:a.status==="published"?(o.published_at||iso(NOW())):o.published_at})}else v.articles.unshift({...a,id:++v.seq,published_at:a.status==="published"?iso(NOW()):null});sav()},
    async admCfg(k,v){if(!isAdm())E("FORBIDDEN: الإعدادات للمالك بس");if(k==="news_rem"&&v.split(",").filter(x=>x.trim()).length>4)E("TOO_MANY: أقصى 4 تذكيرات حتى ما تنغرق القناة");S().cfg[k]=v;sav()},
    async admPost(p){const T={gold:"XAU",rates:"RATES",fx:"FX",oil:"OIL",stocks:"STOCKS",crypto:"CRYPTO",news:"NEWS"},es=s=>String(s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]);const k=p.cat||"news";if(!p.title)E("REQUIRED");const body=(p.urgent?"⚡️ <b>عاجل | "+T[k]+"</b>\n":"")+"<b>"+es(p.title)+"</b>"+(p.meaning?"\n\n<blockquote>🧭 <b>شنو يعني للسوق؟</b>\n"+es(p.meaning)+"</blockquote>":"")+"\n<code>"+[es(p.tags),es(p.src),new Date().toTimeString().slice(0,5)].filter(Boolean).join(" · ")+"</code>";const site=k==="gold"?"📈 شارت الذهب على فيكسورا":"🌐 فيكسورا";return{body,photo:"https://albashafx.com/media/news/"+(k==="rates"?"rates":k)+(p.urgent?"-u":"")+".jpg?v=1",kb:{inline_keyboard:[p.url?[{text:"📰 المصدر",url:p.url},{text:site}]:[{text:site}]]},queued:p.dry?undefined:0}},admTgTest(){E("TG_TOKEN_MISSING: بالمعاينة المحلية ماكو بوت حقيقي. بالسيرفر يشتغل بعد إضافة التوكن.")},
    async admSync(){S().sync.unshift({id:Date.now(),at:iso(NOW()),provider:"demo",ok:true,http:200,n_new:0,n_upd:0,n_resched:0,n_actual:0,err:""});sav()},
    async admFeed(f){},
    // ---------- partners ----------
    async portal(){const v=S(),me=v.partners[uid()];return{levels:v.levels.filter(l=>l.active),products:v.products.filter(p=>p.commissionable),contracts:v.contracts.filter(c=>c.active),
      me:me?{status:me.status,ptype:me.ptype,code:me.status==="APPROVED"?me.code:null,admin_note:["REJECTED","SUSPENDED"].includes(me.status)?me.admin_note:"",created_at:me.created_at,signed_at:me.signed_at,contract_version:me.contract_version,reviewed_at:me.reviewed_at,approved_at:me.approved_at}:null,
      log:v.statuslog.filter(l=>l.user_id===uid()&&l.kind==="partner"),min_payout:v.pcfg.partner_min_payout}},
    async apply(d){const v=S(),me=v.partners[uid()];if(!d.accept||!d.disclose)E("ACCEPT_REQUIRED: لازم توافق على العقد والإفصاح");if(!d.sign_name||d.sign_name.trim().length<3)E("SIGN_REQUIRED: اكتب اسمك كتوقيع");if(!d.full_name||d.full_name.trim().length<3)E("REQUIRED: الاسم الكامل");
      if(me&&["PENDING","UNDER_REVIEW","APPROVED"].includes(me.status))E("ALREADY: عندك طلب أو شراكة فعالة");const k=v.contracts.find(c=>c.id==d.contract_id&&c.active);if(!k)E("CONTRACT_CHANGED");
      v.partners[uid()]={user_id:uid(),ptype:d.ptype,status:"PENDING",code:null,level_id:null,full_name:d.full_name,phone:d.phone||"",country:d.country||"",channels:d.channels||"",audience:d.audience||"",experience:d.experience||"",contract_id:k.id,contract_version:k.version,contract_hash:"demo",sign_name:d.sign_name,signed_at:iso(NOW()),created_at:iso(NOW()),admin_note:"",email:"you@demo"};
      v.statuslog.push({user_id:uid(),kind:"partner",to_status:"PENDING",at:iso(NOW())});sav();return"PENDING"},
    async dash(){const v=S();let pid=uid();if(!v.partners[pid]||v.partners[pid].status!=="APPROVED"){if(isAdm()&&v.partners["demo-partner-1"])pid="demo-partner-1";else E("NOT_PARTNER: لوحة الشريك تنفتح بعد موافقة الإدارة")}
      const p=v.partners[pid],lv=lvl(p.level_id),n=confirmed(pid),nx=v.levels.filter(l=>l.active&&l.min_sales>(lv?lv.min_sales:-1)).sort((a,b)=>a.min_sales-b.min_sales)[0]||null,C=v.comms.filter(c=>c.partner_id===pid),sum=f=>Math.round(C.filter(f).reduce((s,c)=>s+c.amount,0)*100)/100,vis=v.visits.filter(x=>x.code===p.code),d30=new Date(NOW()-30*864e5).toISOString().slice(0,10),d60=new Date(NOW()-60*864e5).toISOString().slice(0,10);
      const daily={};vis.filter(x=>x.day>d30).forEach(x=>daily[x.day]=(daily[x.day]||0)+1);
      return{code:p.code,ptype:p.ptype,name:p.full_name,since:p.approved_at,level:lv,next:nx,confirmed:n,levels:v.levels.filter(l=>l.active),visits:vis.length,visits30:vis.filter(x=>x.day>d30).length,visits_prev30:vis.filter(x=>x.day<=d30&&x.day>d60).length,referred:86,referred30:9,sales:v.sales.filter(s=>s.partner_id===pid).length,
        sum:{pending:sum(c=>["PENDING","VERIFIED"].includes(c.status)&&c.kind==="commission"),approved:sum(c=>c.status==="APPROVED"&&!c.payout_id),in_payout:sum(c=>c.status==="APPROVED"&&c.payout_id),paid:sum(c=>c.status==="PAID")},
        daily:Object.keys(daily).sort().map(k=>({d:k,v:daily[k]})),
        ledger:C.slice().sort((a,b)=>b.id-a.id).map(c=>{const s=v.sales.find(x=>x.id===c.sale_id)||{};return{id:c.id,at:c.created_at,kind:c.kind,product:(v.products.find(p=>p.code===s.product)||{}).name||c.note,amount:s.amount,commission:c.amount,rate:c.rate,status:c.status,currency:c.currency,note:c.note}}),
        payouts:v.payouts.filter(x=>x.partner_id===pid),assets:v.assets.filter(a=>a.active),tickets:v.tickets.filter(t=>t.user_id===pid),
        contract:{title:(v.contracts.find(c=>c.id===p.contract_id)||{}).title,version:p.contract_version,signed_at:p.signed_at,sign_name:p.sign_name,hash:p.contract_hash,body:(v.contracts.find(c=>c.id===p.contract_id)||{}).body},min_payout:v.pcfg.partner_min_payout,demoView:pid!==uid()}},
    async payout(meth,det){const v=S(),pid=v.partners[uid()]&&v.partners[uid()].status==="APPROVED"?uid():"demo-partner-1";if(v.payouts.some(x=>x.partner_id===pid&&["requested","approved"].includes(x.status)))E("PENDING_PAYOUT: عندك طلب سحب قيد المراجعة");
      const C=v.comms.filter(c=>c.partner_id===pid&&c.status==="APPROVED"&&!c.payout_id),amt=Math.round(C.reduce((s,c)=>s+c.amount,0)*100)/100;if(amt<+v.pcfg.partner_min_payout||amt<=0)E("MIN_PAYOUT: الرصيد المعتمد أقل من الحد الأدنى");
      const id=++v.seq;v.payouts.unshift({id,partner_id:pid,amount:amt,currency:"$",method:meth,details:det,status:"requested",admin_note:"",paid_ref:"",created_at:iso(NOW())});C.forEach(c=>c.payout_id=id);sav();return id},
    async ticket(s,b){const v=S();if(!s||s.length<3||!b||b.length<5)E("REQUIRED");v.tickets.unshift({id:++v.seq,user_id:v.partners[uid()]?uid():"demo-partner-1",subject:s,body:b,status:"open",reply:"",created_at:iso(NOW())});sav()},
    async visit(){},async setRef(){return false},
    async myIb(){const v=S(),a=v.ib[uid()];return{plan:(v.ibPlans||{})[uid()]||null,app:a?{...a,ib_number:a.status==="BROKER_APPROVED"?a.ib_number:null,has_proof:!!a.broker_proof}:null,contract:v.contracts.find(c=>c.ptype==="ib"&&c.active),earnings:a&&a.status==="BROKER_APPROVED"?v.ibEarn.filter(e=>e.user_id===uid()):[],last_sync:null}},
    async ibSave(d,submit){const v=S(),a=v.ib[uid()];if(a&&!["DRAFT","BROKER_REJECTED"].includes(a.status))E("LOCKED: الطلب قيد المراجعة");
      if(submit){if(!d.full_name||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email||"")||!d.country)E("REQUIRED: الاسم والإيميل والدولة");if(!(d.docs||[]).length)E("DOCS_REQUIRED: ارفع مستند الهوية");if(!d.accept||!d.sign_name)E("ACCEPT_REQUIRED")}
      v.ib[uid()]={...(a||{}),id:a?a.id:++v.seq,user_id:uid(),broker:"INFINOX",status:submit?"SUBMITTED":"DRAFT",full_name:d.full_name||"",email:d.email||"",phone:d.phone||"",country:d.country||"",experience:d.experience||"",expected_clients:d.expected_clients||"",channels:d.channels||"",docs:d.docs||[],sign_name:submit?d.sign_name:null,admin_notes:"",submitted_at:submit?iso(NOW()):null,updated_at:iso(NOW()),created_at:a?a.created_at:iso(NOW())};sav();return submit?"SUBMITTED":"DRAFT"},
    async uploadDoc(file,u){return`${u||uid()}/ib/${Date.now()}-${file.name.replace(/[^\w.]/g,"").slice(-20)}`},
    async docUrl(){return"about:blank"},
    async dash6(){const d=await this.dash(),v=S(),pid=v.partners[uid()]&&v.partners[uid()].status==="APPROVED"?uid():"demo-partner-1",p=v.partners[pid],lv=lvl(p.level_id)||{};
      const inc=(v.inc=v.inc||[{id:1,title:"كورس مجاني",icon:"🎓",descr:"عند 10 مبيعات شخصية مؤكدة",metric:"personal_sales",target:10,reward:"كورس من اختيارك",period:"all"},{id:2,title:"اشتراك VIP شهرين",icon:"👑",descr:"عند 50 مبيعة مؤكدة لفريقك",metric:"team_sales",target:50,reward:"اشتراك VIP شهرين",period:"all"},{id:3,title:"جلسة خاصة مع الكوتش",icon:"🎙",descr:"عند الوصول لرتبة Gold",metric:"rank",target:30,reward:"جلسة خاصة ساعة",period:"all"},{id:4,title:"حافز توازن الفريق",icon:"⚖️",descr:"10 مبيعات مؤكدة باليمين و10 باليسار بنفس الشهر",metric:"balance",target:10,reward:"مكافأة يحددها المدير",reward_amount:50,period:"month"}]);
      const val={personal_sales:d.confirmed,team_sales:36,rank:d.confirmed,balance:6};v.claims=v.claims||[];
      return{...d,rate:p.rate_override!=null?p.rate_override:lv.rate,rate_override:p.rate_override,team1_pct:lv.team1_pct!=null?lv.team1_pct:5,team2_pct:lv.team2_pct!=null?lv.team2_pct:0,team_on:true,team_size:23,team_month:185,month_total:640,prev_month_total:525,
        incentives:inc.filter(i=>i.active!==false).map(i=>{const c=v.claims.find(x=>x.incentive_id===i.id&&x.user_id===pid);return{...i,value:val[i.metric],done:val[i.metric]>=i.target,claim:c?{status:c.status,note:c.note||""}:null}}),
        feed:[{t:"join",at:iso(NOW()-12*6e4),name:"علي",leg:"L",status:"PENDING"},{t:"sale",at:iso(NOW()-36e5),kind:"commission",amount:7.35,status:"PENDING",note:"اشتراك VIP"},{t:"sale",at:iso(NOW()-2*36e5),kind:"team1",amount:6,status:"VERIFIED",note:"فريق مستوى 1 · سارة · الكورسات"},{t:"join",at:iso(NOW()-864e5),name:"رامي",leg:"R",status:"APPROVED"}]}},
    async team(){const v=S();if(!(v.partners[uid()]&&v.partners[uid()].status==="APPROVED")&&!isAdm())E("NOT_PARTNER: الفريق ينفتح بعد موافقة الإدارة");
      const n=(id,parent,leg,depth,name,level,icon,status)=>({id,parent,leg,depth,name,level,icon,status:status||"APPROVED",direct:depth===1});
      return{code:"OMAR7K",place_pref:v.pref||"auto",place_mode:v.pcfg.partner_place_mode||"auto",team_on:true,size:23,team_month:185,team_sales_month:9,legs:{L:8,R:15,L_sales:56,R_sales:91},
        tree:[n("a",null,"L",1,"علي ح.","Starter","🥉"),n("b",null,"R",1,"سارة م.","Silver","🥈"),n("c","a","L",2,"مصطفى ع.","Starter","🥉"),n("d","b","L",2,"حسين ك.","Starter","🥉"),n("e","b","R",2,"زينب ر.","Gold","🥇")],
        direct:[{name:"علي ح.",status:"PENDING",leg:"L",at:iso(NOW()-12*6e4)},{name:"رامي ك.",status:"APPROVED",leg:"R",at:iso(NOW()-864e5)},{name:"نور أ.",status:"APPROVED",leg:"R",at:iso(NOW()-3*864e5)}]}},
    async setPlace(pref){const v=S();if((v.pcfg.partner_place_mode||"auto")!=="choice"&&pref!=="auto")E("LOCKED: المدير مخلّي الترتيب تلقائي");v.pref=pref;sav()},
    async claimInc(iid){const v=S(),d=await this.dash6(),i=d.incentives.find(x=>x.id==iid);if(!i)E("NOT_FOUND");if(!i.done)E("NOT_REACHED: بعدك ما وصلت الهدف");if(i.claim)E("ALREADY: طلبتها قبل");v.claims.push({id:++v.seq,incentive_id:i.id,user_id:v.partners[uid()]&&v.partners[uid()].status==="APPROVED"?uid():"demo-partner-1",status:"requested",created_at:iso(NOW())});sav();return"requested"},
    async brokerTicket(ch,topic,bdy){const v=S();if(!bdy||bdy.length<10)E("REQUIRED: اشرح المشكلة بشوية تفاصيل");v.tickets.unshift({id:++v.seq,user_id:uid(),subject:topic||"دعم الوسيط",body:bdy,channel:ch,topic,status:"open",reply:"",created_at:iso(NOW())});sav()},
    async myTickets(ch){return S().tickets.filter(t=>t.user_id===uid()&&(t.channel||"partner")===ch)},
    async brokers(lg,ctry,aud){aud=aud||"traders";return S().brokers.filter(b=>b.visible&&b.verified&&((b.audience||"both")==="both"||b.audience===aud)).sort((a,b)=>(b.langs.includes(lg)-a.langs.includes(lg))||(b.is_default-a.is_default)||a.sort-b.sort)},
    adm:{
      async data(){if(!isAdm())E("FORBIDDEN");const v=S();return{partners:Object.values(v.partners).map(p=>{const l=lvl(p.level_id)||{},C=v.comms.filter(c=>c.partner_id===p.user_id),sm=f=>Math.round(C.filter(f).reduce((s,c)=>s+c.amount,0)*100)/100;return{...p,level:l.name,level_icon:l.icon,rate:l.rate,confirmed:confirmed(p.user_id),pending:sm(c=>["PENDING","VERIFIED"].includes(c.status)),approved:sm(c=>c.status==="APPROVED"),paid:sm(c=>c.status==="PAID"),referred:p.code?86:0}}),
        levels:v.levels,products:v.products,contracts:v.contracts,comms:v.comms.slice().sort((a,b)=>b.id-a.id).map(c=>{const s=v.sales.find(x=>x.id===c.sale_id)||{},p=v.partners[c.partner_id]||{};return{...c,partner:p.full_name,code:p.code,product:s.product,sale_amount:s.amount,purchase_id:s.purchase_id,buyer:"عميل تجريبي"}}),
        payouts:v.payouts.map(x=>({...x,partner:(v.partners[x.partner_id]||{}).full_name})),ib:Object.values(v.ib).filter(a=>a.status!=="DRAFT"),ib_imports:v.ibImports,brokers:v.brokers,assets:v.assets,tickets:v.tickets.map(t=>({...t,name:(v.partners[t.user_id]||{}).full_name||"—"})),audit:[],cfg:v.pcfg}},
      async decide(pid,st,nt){const v=S(),p=v.partners[pid];if(!p)E("NOT_FOUND");if(st==="APPROVED"){if(!p.signed_at)E("NOT_SIGNED: العقد مو موقّع");p.code=p.code||Math.random().toString(36).slice(2,8).toUpperCase();p.level_id=p.level_id||1;p.approved_at=p.approved_at||iso(NOW())}
        if(st==="REJECTED"&&p.status==="APPROVED")E("BAD_TRANSITION: استخدم التعليق");v.statuslog.push({user_id:pid,kind:"partner",to_status:st,at:iso(NOW())});p.status=st;p.admin_note=nt||"";p.reviewed_at=iso(NOW());sav()},
      async level(pid,lid){S().partners[pid].level_id=+lid;sav()},
      async levels(rows){const v=S();rows.forEach(r=>{const o=r.id&&v.levels.find(l=>l.id==r.id);if(o)Object.assign(o,{...r,id:o.id,min_sales:+r.min_sales,rate:+r.rate});else v.levels.push({...r,id:++v.seq,min_sales:+r.min_sales,rate:+r.rate,active:true})});sav()},
      async product(r){const v=S(),o=v.products.find(p=>p.code===r.code);if(o)Object.assign(o,r);else v.products.push(r);sav()},
      async contract(pt,ver,ttl,bdy){const v=S();if(!ver||!bdy||bdy.length<50)E("REQUIRED");v.contracts.forEach(c=>{if(c.ptype===pt)c.active=false});v.contracts.unshift({id:++v.seq,ptype:pt,version:ver,title:ttl,body:bdy,active:true,created_at:iso(NOW())});sav()},
      async comm(cid,act,nt){const v=S(),c=v.comms.find(x=>x.id==cid);if(!c)E("NOT_FOUND");const T={verify:["PENDING","VERIFIED"],approve:["VERIFIED","APPROVED"]};
        if(act==="reverse"){if(!nt)E("NOTE_REQUIRED: سبب العكس");if(!["PENDING","VERIFIED","APPROVED"].includes(c.status)||c.payout_id)E("BAD_TRANSITION");c.status="REVERSED"}else if(T[act]&&c.status===T[act][0])c.status=T[act][1];else E("BAD_TRANSITION");v.commlog.push({comm_id:cid,to:c.status,note:nt,at:iso(NOW())});sav()},
      async adjust(pid,amt,nt){const v=S();if(!+amt||!nt)E("REQUIRED: المبلغ والسبب");v.comms.push({id:++v.seq,partner_id:pid,sale_id:null,kind:"adjustment",amount:+amt,rate:null,currency:"$",status:"APPROVED",payout_id:null,note:nt,created_at:iso(NOW())});sav()},
      async payout(pid,act,nt,ref){const v=S(),x=v.payouts.find(p=>p.id==pid);if(!x)E("NOT_FOUND");if(act==="paid"){if(!ref)E("REF_REQUIRED: رقم/مرجع التحويل");x.status="paid";x.paid_ref=ref;v.comms.filter(c=>c.payout_id==pid).forEach(c=>c.status="PAID")}
        else if(act==="reject"){if(!nt)E("NOTE_REQUIRED");x.status="rejected";v.comms.filter(c=>c.payout_id==pid).forEach(c=>c.payout_id=null)}else x.status="approved";x.admin_note=nt||x.admin_note;x.decided_at=iso(NOW());sav()},
      async report(mon){const v=S();return Object.values(v.partners).filter(p=>p.status==="APPROVED").map(p=>{const S2=v.sales.filter(s=>s.partner_id===p.user_id&&s.created_at.slice(0,7)===mon),C=v.comms.filter(c=>c.partner_id===p.user_id&&c.created_at.slice(0,7)===mon);
        return{partner:p.full_name,code:p.code,level:(lvl(p.level_id)||{}).name,sales:S2.length,revenue:S2.reduce((s,x)=>s+x.amount,0),commission:Math.round(C.filter(c=>c.status!=="REVERSED").reduce((s,c)=>s+c.amount,0)*100)/100,reversed:Math.round(C.filter(c=>c.status==="REVERSED").reduce((s,c)=>s+c.amount,0)*100)/100,paid_out:0,visits:v.visits.filter(x=>x.code===p.code&&x.day.slice(0,7)===mon).length}})},
      async ib(aid,st,nt,ibn,proof){const v=S(),a=Object.values(v.ib).find(x=>x.id==aid);if(!a)E("NOT_FOUND");if(st==="BROKER_APPROVED"&&(!ibn||!(proof||a.broker_proof)))E("PROOF_REQUIRED: رقم IB الرسمي وإثبات موافقة الوسيط مطلوبين");Object.assign(a,{status:st,admin_notes:nt||a.admin_notes,ib_number:st==="BROKER_APPROVED"?ibn:a.ib_number,broker_proof:proof||a.broker_proof,updated_at:iso(NOW())});sav()},
      async ibImport(per,fname,rows){const v=S();if(!/^\d{4}-\d{2}$/.test(per))E("BAD_PERIOD");let m=0;const um=[];rows.forEach(r=>{const a=Object.values(v.ib).find(x=>x.status==="BROKER_APPROVED"&&x.ib_number===r.ib_number);if(!a){um.push(r.ib_number);return}v.ibEarn=v.ibEarn.filter(e=>!(e.user_id===a.user_id&&e.period===per));v.ibEarn.push({user_id:a.user_id,ib_number:r.ib_number,period:per,clients:+r.clients||0,confirmed:+r.confirmed||0,pending:+r.pending||0,paid:+r.paid||0,currency:"$",source:"statement",updated_at:iso(NOW())});m++});
        v.ibImports.unshift({id:++v.seq,period:per,file_name:fname,rows:rows.length,matched:m,unmatched:um,at:iso(NOW())});sav();return{rows:rows.length,matched:m,unmatched:um}},
      async ibPlans(){return S().ibPlans||{}},
      async v6(){const v=S();await (async()=>{})();return{incentives:v.inc||[],claims:(v.claims||[]).map(c=>{const i=(v.inc||[]).find(x=>x.id===c.incentive_id)||{};return{...c,partner:(v.partners[c.user_id]||{}).full_name,title:i.title,icon:i.icon,reward:i.reward,reward_amount:i.reward_amount}}),tree:Object.fromEntries(Object.values(v.partners).map(p=>[p.user_id,{sponsor:p.sponsor_name||null,leg:p.leg||null,rate_override:p.rate_override==null?null:p.rate_override}])),cfg:{partner_team_on:v.pcfg.partner_team_on||"1",partner_place_mode:v.pcfg.partner_place_mode||"auto"}}},
      async rate(pid,r){if(r!=null&&(r<0||r>90))E("BAD_VALUE");S().partners[pid].rate_override=r;sav()},
      async incSave(r){const v=S();v.inc=v.inc||[];if(!r.title)E("REQUIRED");const o=r.id&&v.inc.find(x=>x.id==r.id);const x={...r,target:+r.target||1,reward_amount:r.reward_amount===""?null:+r.reward_amount};if(o)Object.assign(o,x,{id:o.id});else v.inc.push({...x,id:++v.seq});sav()},
      async incClaim(cid,act){const c=(S().claims||[]).find(x=>x.id==cid);if(!c)E("NOT_FOUND");c.status=act==="approve"?"approved":act==="deliver"?"delivered":"rejected";sav()},
      async ibPlan(u,p){const v=S();for(const k of['per_lot','share_pct','cashback_ib','cashback_clients','salary'])if(p[k]!==''&&+p[k]<0)E('BAD_VALUE: الأرقام لازم تكون موجبة');if(+p.share_pct>100)E('BAD_VALUE: النسبة أكثر من 100%');(v.ibPlans=v.ibPlans||{})[u]={...p,updated_at:iso(NOW())};sav()},
      async broker(b){const v=S();if(!b.broker)E("REQUIRED");if(b.website&&!/^https:\/\//.test(b.website))E("BAD_URL");if(b.is_default)v.brokers.forEach(x=>x.is_default=false);const o=b.id&&v.brokers.find(x=>x.id==b.id),r={...b,visible:!!(b.visible&&b.verified)};if(o)Object.assign(o,r);else v.brokers.push({...r,id:++v.seq,sort:v.brokers.length+1});sav()},
      async brokerOrder(ids){const v=S();ids.forEach((id,i)=>{const b=v.brokers.find(x=>x.id==id);if(b)b.sort=i+1});sav()},
      async asset(a){const v=S();if(a.id){Object.assign(v.assets.find(x=>x.id==a.id)||{},a)}else v.assets.unshift({...a,id:++v.seq,active:true});sav()},
      async ticket(tid,rep,cl){const t=S().tickets.find(x=>x.id==tid);if(t){t.reply=rep;t.status=cl?"closed":"answered"}sav()},
      async cfg(k,val){S().pcfg[k]=val;sav()}}
  }}

/* V7 adapters: network plan, leaderboard, orders, IB gate, broker support, course channels, translations */
function v7Supa(R){return{
  dash7:()=>R("partner_dash_v7"),myIbSet:()=>R("my_ib_settlements"),tree:d=>R("partner_tree",{depth:d||3}),lb:(scope,period)=>R("partner_leaderboard",{scope,period}),hideLb:v=>R("partner_set_hide_lb",{v:!!v}),
  orders:()=>R("my_orders"),linkProducts:()=>R("partner_link_products"),ibElig:()=>R("ib_eligible"),support:()=>R("public_support"),
  myChannels:()=>R("my_course_channels"),chReq:cid=>R("course_tg_request",{cid}),uiTr:lg=>R("ui_tr_get",{lg}),
  a7:{cfg:()=>R("admin_cfg_v7_get"),set:(k,v)=>R("admin_cfg_v7",{k,v:String(v)}),binLevels:rows=>R("admin_bin_levels_save",{rows}),binWeeks:wk=>R("admin_bin_weeks",{wk:wk||null}),
    binCompute:(start,commit)=>R("partner_bin_compute",{wk_start:start||null,do_commit:!!commit}),chList:()=>R("admin_course_tg_list"),chSet:(cid,chat)=>R("admin_course_tg_set",{cid,chat}),
    trStart:(langs,scope)=>R("admin_tr_start",{langs,scope}),trStatus:()=>R("admin_tr_status"),trRetry:()=>R("admin_tr_retry"),admins:()=>R("admin_list_admins"),setC:(k,v)=>R("admin_cfg_v7c",{k,v:String(v)}),ibsCompute:per=>R("admin_ib_settle_compute",{per}),ibsSet:(sid,sal,nt)=>R("admin_ib_settle_set",{sid,sal:!!sal,nt:nt||""}),ibsStatus:(sid,st,ref)=>R("admin_ib_settle_status",{sid,st,ref:ref||""}),ibsList:per=>R("admin_ib_settle_list",{per}),setAdmin:(mail,on)=>R("admin_set_admin",{mail,make_admin:!!on})}}}

function v7Demo(H){const{S,sav,uid,isAdm,E,NOW,iso}=H;
  const V=()=>{const v=S();if(!v.v7){v.v7={cfg:{partner_bin_on:"0",partner_bin_cap:"40",partner_bin_depth:"0",partner_tank_hours:"72",ib_clients_only:"1",support_tg:"omo_rabah",support_wa:"",translate_key_set:false,langs_extra:"uz,ckb,kmr,tr",tg_bot:true,tr_auto_content:"1"},
      bin:{silver:{bin_pct:8,req_pts:1500,req_refs:1,req_leaders:0},gold:{bin_pct:10,req_pts:5000,req_refs:2,req_leaders:0},diamond:{bin_pct:12,req_pts:15000,req_refs:3,req_leaders:2}},
      channels:{},hide:false,tr:{queue:{},done:{}}};sav()}return v.v7};
  const lvls=()=>S().levels.map(l=>({...l,...(V().bin[l.code]||{bin_pct:0,req_pts:0,req_refs:0,req_leaders:0})}));
  const wkStart=()=>{const d=new Date(NOW()+3*36e5);const dow=(d.getUTCDay()+1)%7;d.setUTCHours(0,0,0,0);return new Date(d-dow*864e5-3*36e5).toISOString()};
  const isP=()=>S().partners[uid()]&&S().partners[uid()].status==="APPROVED";
  return{
    async dash7(){if(!isP())return{status:(S().partners[uid()]||{}).status||"NONE"};const L=lvls(),cur=L.find(l=>l.code==="silver"),nx=L.find(l=>l.code==="gold");
      return{status:"APPROVED",demo:true,code:"OMAR7K",name:"Omar",hide_lb:V().hide,bin_on:V().cfg.partner_bin_on==="1",cap:V().cfg.partner_bin_cap,
        week:{start:wkStart(),end:new Date(+new Date(wkStart())+7*864e5).toISOString(),l_pts:2100,r_pts:1500,l_refs:3,r_refs:2},level:cur,next:nx,levels:L,
        weeks:[3,2,1].map((k,i)=>({wk:new Date(+new Date(wkStart())-k*7*864e5).toISOString().slice(0,10),l_pts:[1800,1650,1900][i],r_pts:[1550,1500,1200][i],level_id:i<2?cur.id:null,pct:i<2?8:0,raw:i<2?[124,120][i]:0,paid:i<2?[124,120][i]:0,committed:true})).reverse(),
        by_kind:{commission:640,binary:420,team1:120,bonus:104},pending_payout:180,total:1284,
        months:["2026-06","2026-07","2026-08","2026-09","2026-10","2026-11"].map((m,i)=>({m,s:[120,180,210,260,240,274][i]})),tank:2,tank_hours:V().cfg.partner_tank_hours}},
    async tree(){if(!isP()&&!isAdm())E("NOT_PARTNER");const n=(id,parent,leg,d,name,level,direct)=>({id,parent,leg,d,name,level,direct});
      return[n("a","me","L",1,"Sa*** M.","starter",true),n("b","me","R",1,"Al*** K.","silver",true),n("c","a","L",2,"Ha*** R.","starter",false),n("e","b","L",2,"Ze*** T.","starter",true),n("f","b","R",2,"Mo*** A.","starter",false)]},
    async lb(scope,period){const me={name:"أنت",me:true,country:"IQ",level:"silver",n:11};const R=[{name:"Kh*** A.",country:"SA",level:"gold",n:16},{name:"As*** H.",country:"IQ",level:"gold",n:12},me,{name:"Ra*** H.",country:"JO",level:"silver",n:9},{name:"Ba*** S.",country:"KW",level:"silver",n:9},{name:"Ma*** K.",country:"LY",level:"starter",n:5}];
      return(scope==="team"?R.filter((x,i)=>i>1):R).filter(x=>!(V().hide&&x.me&&false))},
    async hideLb(v){V().hide=!!v;sav()},
    async orders(){return[{id:10587,kind:"monthly",amount:99,currency:"$",status:"paid",created_at:iso(NOW()-16*864e5),expires_at:iso(NOW()+14*864e5)},{id:9027,kind:"course",title:"التحليل الفني",amount:49,currency:"$",status:"done",created_at:iso(NOW()-46*864e5)},{id:7890,kind:"zoom",amount:50,currency:"$",status:"rejected",created_at:iso(NOW()-76*864e5)}]},
    async linkProducts(){return{courses:[{id:"tech",title:"التحليل الفني",icon:"📈",price:49},{id:"classic",title:"التحليل الكلاسيكي",icon:"📐",price:49},{id:"wave",title:"التحليل الموجي (إليوت)",icon:"🌊",price:69}],products:S().products.filter(p=>p.commissionable).map(p=>({code:p.code,name:p.name}))}},
    async ibElig(){const only=V().cfg.ib_clients_only==="1";return{only,ok:!only||isAdm()||!!(window.ME&&ME.profile&&ME.profile.status==="approved"&&ME.profile.broker_account),ib_link:"https://myaccount.infinox.com/ar/links/go/9935360"}},
    async support(){return{tg:V().cfg.support_tg,wa:V().cfg.support_wa,ib_link:"https://myaccount.infinox.com/ar/links/go/9935360"}},
    async myChannels(){return[]},
    async myIbSet(){return(V().ibs||[]).filter(x=>x.status!=="DRAFT")},async chReq(){return"QUEUED"},async uiTr(){return{}},
    a7:{async cfg(){if(!isAdm())E("FORBIDDEN");return{...V().cfg}},
      async set(k,v){if(!isAdm())E("FORBIDDEN");if(k==="partner_bin_cap"&&(+v<0||+v>60))E("CAP_RANGE: من 0 إلى 60");if(k==="support_tg")v=String(v).replace(/^(https?:\/\/)?(t\.me\/)?@?/,"");if(k==="support_wa")v=String(v).replace(/[^0-9+]/g,"");
        if(k==="translate_api_key"){V().cfg.translate_key_set=!!v}else V().cfg[k]=String(v);sav()},
      async binLevels(rows){if(!isAdm())E("FORBIDDEN");rows.forEach(r=>{const l=S().levels.find(x=>x.id==r.id);if(l)V().bin[l.code]={bin_pct:+r.bin_pct||0,req_pts:+r.req_pts||0,req_refs:+r.req_refs||0,req_leaders:+r.req_leaders||0}});sav()},
      async binWeeks(){return{weeks:[{wk:"2026-11-07",n:23,raw:410,paid:410,scale:1,committed:true},{wk:"2026-10-31",n:21,raw:388,paid:372.5,scale:.96,committed:true}],rows:[{name:"Omar Rabah",l:1800,r:1550,lr:3,rr:2,level:"silver",pct:8,raw:124,paid:124},{name:"Sara M.",l:900,r:400,lr:1,rr:1,level:null,pct:0,raw:0,paid:0}]}},
      async binCompute(start,commit){if(!isAdm())E("FORBIDDEN");if(commit&&V().cfg.partner_bin_on!=="1")E("BIN_OFF: شغّل الخطة الشبكية من الإعدادات");return{wk:(start||wkStart()).slice(0,10),partners:23,sales:2650,raw:412,cap:1060,scale:1,committed:!!commit}},
      async chList(){return[{id:"tech",title:"التحليل الفني",icon:"📈",tg_chat:V().channels.tech||"",check:V().channels.tech?'{"ok":true,"result":{"title":"VEXORA · التحليل الفني"}}':"",sent:V().channels.tech?4:0,failed:0},{id:"classic",title:"التحليل الكلاسيكي",icon:"📐",tg_chat:V().channels.classic||"",check:"",sent:0,failed:0},{id:"wave",title:"التحليل الموجي (إليوت)",icon:"🌊",tg_chat:V().channels.wave||"",check:"",sent:0,failed:0}]},
      async chSet(cid,chat){if(!isAdm())E("FORBIDDEN");V().channels[cid]=chat;sav()},
      async trStart(langs){if(!V().cfg.translate_key_set)E("NO_KEY: حط مفتاح الترجمة بالإعدادات أول");langs.forEach(l=>V().tr.queue[l+":queued"]=1350);sav();return{queued:1350*langs.length}},
      async trStatus(){return{queue:V().tr.queue,done:V().tr.done,ui:{total:2560,uz:420,ckb:420,kmr:420,tr:160},last_err:null,key_set:V().cfg.translate_key_set}},
      async trRetry(){return 0},
      async ibsCompute(per){if(!isAdm())E("FORBIDDEN");const v=V();v.ibs=v.ibs||[];const P={per_lot:2,share_pct:10,cashback_ib:1,cashback_clients:3,salary:500,salary_terms:"20 عميل فعال"};
        const calc=x=>{x.per_lot_amt=+(x.lots*P.per_lot).toFixed(2);x.share_amt=+(x.broker_comm*P.share_pct/100).toFixed(2);x.cashback_ib_amt=+(x.lots*P.cashback_ib).toFixed(2);x.cashback_clients_amt=+(x.lots*P.cashback_clients).toFixed(2);x.salary_amt=x.salary_ok?P.salary:0;x.total=x.per_lot_amt+x.share_amt+x.cashback_ib_amt+x.salary_amt;return x};
        let n=0;[["Ahmed K.","IB1203",150,1000,22],["Sara M.","IB1311",64,410,9]].forEach(([name,num,lots,bc,cl],i)=>{let x=v.ibs.find(y=>y.period===per&&y.ib_number===num);if(x&&x.status!=="DRAFT")return;if(!x){x={id:Date.now()+i,period:per,name,ib_number:num,salary_ok:false,status:"DRAFT",note:"",currency:"$",salary_terms:P.salary_terms};v.ibs.push(x)}Object.assign(x,{lots,broker_comm:bc,clients:cl});calc(x);x._c=calc;n++});
        sav();return{period:per,drafts:n,locked:0,no_plan:0}},
      async ibsSet(sid,sal,nt){const x=(V().ibs||[]).find(y=>y.id==sid);if(!x)E("NOT_FOUND");if(x.status!=="DRAFT")E("LOCKED: التسوية معتمدة، ما تتعدل");x.salary_ok=!!sal;x.note=nt||"";x.salary_amt=sal?500:0;x.total=x.per_lot_amt+x.share_amt+x.cashback_ib_amt+x.salary_amt;sav()},
      async ibsStatus(sid,st,ref){const x=(V().ibs||[]).find(y=>y.id==sid);if(!x)E("NOT_FOUND");if(!((x.status==="DRAFT"&&st==="APPROVED")||(x.status==="APPROVED"&&(st==="PAID"||st==="DRAFT"))))E("BAD_TRANSITION");if(st==="PAID"&&!String(ref||"").trim())E("REF_REQUIRED: اكتب رقم/مرجع التحويل");x.status=st;if(st==="PAID"){x.paid_ref=ref;x.paid_at=iso(NOW())}sav()},
      async ibsList(per){const R=(V().ibs||[]).filter(x=>x.period===per),t=st=>R.filter(x=>x.status===st).reduce((a,x)=>a+x.total,0);return{rows:R,imported:R.length,ibs:2,no_plan:[],totals:{draft:t("DRAFT"),approved:t("APPROVED"),paid:t("PAID"),client_cashback:R.reduce((a,x)=>a+x.cashback_clients_amt,0)}}},
      async setC(k,v){if(!isAdm())E("FORBIDDEN");V().cfg[k]=String(v);sav()},
      async admins(){const v=V();v.admins=v.admins||[{email:(window.ME&&ME.user&&ME.user.email)||"owner@albashafx.com",name:"Omar",role:"admin",me:true}];return v.admins},
      async setAdmin(mail,on){if(!isAdm())E("FORBIDDEN");const v=V(),a=await this.admins();if(!/@/.test(mail))E("NOT_FOUND: لازم الشخص يسجّل بالمنصة بهذا الإيميل أول");const x=a.find(y=>y.email.toLowerCase()===mail.toLowerCase());
        if(on){if(!x)a.push({email:mail,name:mail.split("@")[0],role:"admin"});else x.role="admin"}else{if(x&&x.me)E("SELF: ما تكدر تشيل صلاحيتك");v.admins=a.filter(y=>y.email.toLowerCase()!==mail.toLowerCase())}sav();return on?"admin":"member"}}}}

function supaBackend(){
  const sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
  window.__vxIbClient=sb;
  const chk=({data,error})=>{if(error)throw new Error(tr(error));return data};
  return{
    demo:false,
    async session(){const {data}=await sb.auth.getSession();return data.session?{id:data.session.user.id,email:data.session.user.email}:null},
    onAuth(cb){sb.auth.onAuthStateChange((ev,s)=>cb(s?{id:s.user.id,email:s.user.email}:null,ev))},
    async signUp(email,pw,name){const d=chk(await sb.auth.signUp({email,password:pw,options:{data:{full_name:name,ref:(()=>{try{return localStorage.getItem("albasha_ref")||""}catch(e){return""}})()},emailRedirectTo:here()}}));return{confirm:!d.session}},
    async signIn(email,pw){chk(await sb.auth.signInWithPassword({email,password:pw}))},
    async google(){chk(await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:here()}}))},
    async reset(email){chk(await sb.auth.resetPasswordForEmail(email,{redirectTo:here()}))},
    async setPassword(pw){chk(await sb.auth.updateUser({password:pw}))},
    async signOut(){await sb.auth.signOut()},
    async getProfile(id){return chk(await sb.from("profiles").select("*").eq("id",id).maybeSingle())},
    async saveProfile(id,f){return chk(await sb.from("profiles").update(f).eq("id",id).select().single())},
    async uploadAvatar(id,blob){
      const path=`${id}/avatar.jpg`;
      chk(await sb.storage.from("avatars").upload(path,blob,{upsert:true,contentType:blob.type||"image/jpeg",cacheControl:"60"}));
      return sb.storage.from("avatars").getPublicUrl(path).data.publicUrl+"?v="+Date.now();
    },
    async listProfiles(){return chk(await sb.from("profiles").select("*").order("created_at",{ascending:false}))},
    async myPerms(){return chk(await sb.rpc("my_perms"))||[]},
    async staffList(){return chk(await sb.rpc("admin_staff"))||[]},
    async setStaff(mail,ps){return chk(await sb.rpc("admin_set_staff",{mail,ps}))},
    async setStatus(id,status,note){return chk(await sb.from("profiles").update({status,note:note||""}).eq("id",id))},
    async getConfig(){const rows=chk(await sb.from("config").select("key,value"));const o={};rows.forEach(r=>o[r.key]=r.value);return o},
    async setConfig(key,value,members){chk(await sb.from("config").upsert({key,value,members:!!members}))},
    async notifs(){return chk(await sb.from("notifications").select("*").order("created_at",{ascending:false}).limit(30))},
    async pushSub(ep,k,a,agent){return chk(await sb.rpc("push_subscribe",{ep,k,a,agent}))},
    async pushUnsub(ep){return chk(await sb.rpc("push_unsubscribe",{ep}))},
    async pushStatus(){return chk(await sb.rpc("admin_push_status"))},
    async pushTest(){return chk(await sb.rpc("admin_push_test"))},
    async addNotif(f){chk(await sb.from("notifications").insert({...f,user_id:null}))},
    async events(){return chk(await sb.from("events").select("*").or(`ends_at.is.null,ends_at.gte.${new Date(Date.now()-864e5).toISOString()}`).order("created_at",{ascending:false}))},
    async addEvent(f){chk(await sb.from("events").insert(f))},
    async delEvent(id){chk(await sb.from("events").delete().eq("id",id))},
    async myRefs(){return chk(await sb.rpc("my_referrals"))},
    async sigEvents(id){return chk(await sb.from("signal_events").select("at,kind,changes,reason").eq("signal_id",id).order("at"))},
    async adminStatus(){return chk(await sb.rpc("admin_status"))},
    async uptime(){return chk(await sb.rpc("admin_uptime"))},
    async message(uid,ttl,bdy){chk(await sb.rpc("admin_message",{uid,ttl,bdy}))},
    async inbox(uid){return chk(await sb.from("notifications").select("*").or(`user_id.is.null,user_id.eq.${uid}`).order("created_at",{ascending:false}).limit(100))},
    async mySubs(uid){return chk(await sb.from("purchases").select("kind,item,course_id,status,expires_at,paid_at").eq("user_id",uid).eq("status","paid").order("paid_at",{ascending:false}).limit(20))},
    async broadcastMail(ttl,bdy,lnk,aud){return chk(await sb.rpc("admin_broadcast_mail",{ttl,bdy,lnk,aud}))},
    async adminActivity(n){return chk(await sb.rpc("admin_activity",{n:n||30}))},
    async savePrefs(id,o){return chk(await sb.from("profiles").update({notif_prefs:o}).eq("id",id).select("notif_prefs").single())},
    async dataRequest(kind,note){chk(await sb.from("data_requests").insert({kind,note}))},
    async myDataRequests(){return chk(await sb.from("data_requests").select("kind,note,status,created_at").order("created_at",{ascending:false}).limit(10))},
    async mfaList(){const r=await sb.auth.mfa.listFactors();if(r.error)throw r.error;return(r.data&&r.data.totp)||[]},
    async mfaEnroll(){const r=await sb.auth.mfa.enroll({factorType:"totp",friendlyName:"VEXORA "+Date.now()});if(r.error)throw r.error;return r.data},
    async mfaVerify(fid,code){const c=await sb.auth.mfa.challenge({factorId:fid});if(c.error)throw c.error;const v=await sb.auth.mfa.verify({factorId:fid,challengeId:c.data.id,code});if(v.error)throw v.error;return true},
    async mfaRemove(fid){const r=await sb.auth.mfa.unenroll({factorId:fid});if(r.error)throw r.error},
    async courses(){return chk(await sb.from("courses").select("id,title,icon").order("sort"))},
    async aiAsk(q,ctx,lang){return chk(await sb.rpc("ai_ask",{q,ctx,lang}))},
    marketing:{rpc:async(name,args)=>chk(await sb.rpc(name,args)),ask:async q=>chk(await sb.rpc("ai_ask",{q,ctx:{},lang:"ar"})),result:async aid=>chk(await sb.rpc("ai_result",{aid})),
      async partnerLinks(){
        const partners=V5.api();
        const [sales,team]=await Promise.allSettled([partners.dash(),partners.team()]);
        return {
          sale:sales.status==="fulfilled"&&sales.value?.code?PP.links_(sales.value).sale:null,
          team:team.status==="fulfilled"&&team.value?.code?PP.links_(team.value).team:null
        };
      },
      localVoice:null},
    async aiResult(id){return chk(await sb.rpc("ai_result",{aid:id}))},
    v4:mkV4Supa(sb,chk,()=>ME.user&&ME.user.id),
    v5:mkV5Supa(sb,chk,()=>ME.user&&ME.user.id),
    v9:mkV9Supa(sb,chk,()=>ME.user&&ME.user.id),
    v10:mkV10Supa(sb,chk),
    v11:mkV11Supa(sb,chk,()=>ME.user&&ME.user.id),
    v13:mkV13Supa(sb,chk),
    async aiPro(cid,q,ctx,lang,mode){return chk(await sb.rpc("ai_pro_ask",{cid,q,ctx,lang,mode}))},
    async aiChats(){return chk(await sb.from("ai_chats").select("id,title,sym,tf,mode,updated_at").order("updated_at",{ascending:false}).limit(100))},
    async aiMsgs(cid){return chk(await sb.from("ai_messages").select("id,role,content,meta,status,req_id,created_at").eq("chat_id",cid).order("id"))},
    async aiDelChat(id){chk(await sb.from("ai_chats").delete().eq("id",id))},
    async aiUsage(){return chk(await sb.rpc("admin_ai_usage"))},
    async stratList(){return chk(await sb.from("strategies").select("*").order("updated_at",{ascending:false}))},
    async stratAdd(r){return chk(await sb.from("strategies").insert(r).select("id").single())},
    async stratUpd(id,r){chk(await sb.from("strategies").update({...r,updated_at:new Date().toISOString()}).eq("id",id))},
    async stratDel(id){chk(await sb.from("strategies").delete().eq("id",id))},
    async scanUni(){return chk(await sb.rpc("scan_universe"))},
    async scans(){return chk(await sb.from("scans").select("*").order("created_at",{ascending:false}))},
    async scanAdd(r){chk(await sb.from("scans").insert(r))},
    async scanSet(id,r){chk(await sb.from("scans").update(r).eq("id",id))},
    async scanDel(id){chk(await sb.from("scans").delete().eq("id",id))},
    async scanHits(){return chk(await sb.from("scan_hits").select("*").order("created_at",{ascending:false}).limit(30))},
    async riskGet(){return chk(await sb.from("risk_settings").select("*").maybeSingle())},
    async riskSet(r){chk(await sb.from("risk_settings").upsert({...r,updated_at:new Date().toISOString()}))},
    async riskTrades(){return chk(await sb.from("risk_trades").select("*").order("created_at",{ascending:false}).limit(200))},
    async riskAdd(r){chk(await sb.from("risk_trades").insert(r))},
    async riskUpd(id,r){chk(await sb.from("risk_trades").update(r).eq("id",id))},
    async riskDel(id){chk(await sb.from("risk_trades").delete().eq("id",id))},
    async aiStatus(){return chk(await sb.rpc("ai_status"))},
    async touch(pg){chk(await sb.rpc("touch_presence",{pg}))},
    async online(){return chk(await sb.rpc("admin_online"))},
    async engineRun(){return chk(await sb.rpc("admin_engine_run"))},
    async econ(a,b){return chk(await sb.from("econ_events").select("id,title,country,at,impact,forecast,previous").gte("at",a).lte("at",b).order("at"))},
    async myCertCount(){const{count}=await sb.from("certificates").select("code",{count:"exact",head:true});return count||0},
    async candles(sym,tf){const{data,error}=await sb.from("market_cache").select("data,updated_at").eq("sym",sym).eq("tf",tf).maybeSingle();if(error)return null;return data},
    async mailTest(){return chk(await sb.rpc("admin_mail_test"))},
    async mailStatus(){return chk(await sb.rpc("admin_mail_status"))},
    async signals(days){const C="id,sym,tf,side,sig_time,pct,entry,sl,tp1,tp2,tp3,dec,status,status_label,pips,best";{const r=await sb.from("signals").select(C+",qscore,qparts").eq("tg_sent",1).gte("sig_time",new Date(Date.now()-days*864e5).toISOString()).order("sig_time",{ascending:false}).limit(2000);if(!r.error)return r.data}return chk(await sb.from("signals").select(C).eq("tg_sent",1).gte("sig_time",new Date(Date.now()-days*864e5).toISOString()).order("sig_time",{ascending:false}).limit(2000))},
    async allInfo(){const r=chk(await sb.from("site_info").select("key,value"));const o={};(r||[]).forEach(x=>o[x.key]=x.value);return o},
    async coursesFull(){return chk(await sb.from("courses").select("id,title,icon,price,sort").order("sort"))},
    async setCourse(id,f){chk(await sb.from("courses").update(f).eq("id",id))},
    async uploadCoach(blob){const path="coach/photo.jpg";chk(await sb.storage.from("avatars").upload(path,blob,{upsert:true,contentType:"image/jpeg",cacheControl:"60"}));return sb.storage.from("avatars").getPublicUrl(path).data.publicUrl+"?v="+Date.now()},
    async access(uid){const r=chk(await sb.rpc("admin_members"))||[];const m=r.find(x=>x.id===uid);return m?m.access||[]:[]},
    async grant(uid,what,cid,days){return chk(await sb.rpc("admin_grant",{uid,what,cid:cid||null,days:days||null}))},
    async revoke(pid){chk(await sb.rpc("admin_revoke",{pid}))},
    async leaderboard(){return chk(await sb.rpc("ref_leaderboard"))},
    async info(){const r=chk(await sb.from("site_info").select("key,value").in("key",["dist_share","dist_text","price_ai","currency"]));const o={};r.forEach(x=>o[x.key]=x.value);return o},
    async setInfo(o){chk(await sb.from("site_info").upsert(Object.entries(o).map(([key,value])=>({key,value}))))},
  };
}

function demoBackend(){
  const K="gat-demo-db";let db=null;const subs=[];
  const now=()=>new Date().toISOString();
  const ex=(id,n,em,tg,acc,st,days)=>({id,email:em,full_name:n,telegram:tg,phone:"+964 770 000 00"+id.slice(-2),country:"العراق",broker_account:acc,avatar_url:"",status:st,role:"member",note:st==="rejected"?"رقم الحساب غير موجود تحت رابطنا":"",created_at:new Date(Date.now()-days*864e5).toISOString(),example:true});
  function get(){
    if(db)return db;
    try{db=JSON.parse(localStorage.getItem(K)||"null")}catch(e){}
    if(!db){db={users:[],profiles:{},config:{twelve_key:"",tg_token:"",tg_chat:"",tg_admin:""},session:null};
      [ex("ex01","أحمد علي (مثال)","ahmed@example.com","@ahmed_fx","7701234","pending",0),
       ex("ex02","سارة محمد (مثال)","sara@example.com","@sara_gold","7705678","approved",3),
       ex("ex03","حسين كريم (مثال)","hussein@example.com","@hk_trader","7709999","rejected",6)].forEach(p=>db.profiles[p.id]=p)}
    return db;
  }
  const put=()=>{try{localStorage.setItem(K,JSON.stringify(db))}catch(e){}};
  const user=()=>{const d=get();const u=d.users.find(x=>x.id===d.session);return u?{id:u.id,email:u.email}:null};
  const emit=ev=>subs.forEach(f=>f(user(),ev));
  const wait=()=>new Promise(r=>setTimeout(r,250));
  function create(email,pw,name){
    const d=get(),id="u"+Math.random().toString(36).slice(2,10),first=!Object.values(d.profiles).some(p=>!p.example);
    d.users.push({id,email,pw});
    let rr="";try{rr=(localStorage.getItem("albasha_ref")||"").replace(/^@/,"").toLowerCase()}catch(e){}
    const ro=Object.values(d.profiles).find(p=>p.ref_code===rr||(p.telegram||"").toLowerCase()==="@"+rr);
    d.profiles[id]={id,email,full_name:name||"",telegram:"",phone:"",country:"",broker_account:"",avatar_url:"",status:first?"approved":"new",role:first?"admin":"member",note:"",created_at:now(),ref_code:Math.random().toString(36).slice(2,9),referred_by:ro?ro.ref_code:""};
    if(ro){(d.notifs=d.notifs||[]).unshift({id:Date.now(),user_id:ro.id,icon:"👤",title:"شخص جديد سجّل من رابطك (+1 نقطة)",body:"",link:"app.html#rewards",created_at:now()})}
    d.session=id;put();return id;
  }
  return{
    demo:true,
    async session(){return user()},
    onAuth(cb){subs.push(cb)},
    async signUp(email,pw,name){await wait();const d=get();
      if(!/^\S+@\S+\.\S+$/.test(email))throw new Error("صيغة الإيميل غلط");
      if(pw.length<6)throw new Error("كلمة السر لازم 6 أحرف أو أكثر");
      if(d.users.some(u=>u.email===email))throw new Error("هذا الإيميل مسجّل من قبل، سوّ دخول");
      create(email,pw,name);emit("SIGNED_IN");return{confirm:false}},
    async signIn(email,pw){await wait();const d=get(),u=d.users.find(x=>x.email===email&&x.pw===pw);
      if(!u)throw new Error("الإيميل أو كلمة السر غلط");d.session=u.id;put();emit("SIGNED_IN")},
    async google(){await wait();const d=get(),em="google.user@gmail.com",u=d.users.find(x=>x.email===em);
      if(u){d.session=u.id;put()}else create(em,Math.random().toString(36),"مستخدم Google");emit("SIGNED_IN")},
    async reset(){await wait()},
    async setPassword(pw){const d=get(),u=d.users.find(x=>x.id===d.session);if(u){u.pw=pw;put()}},
    async signOut(){get().session=null;put();emit("SIGNED_OUT")},
    async getProfile(id){return get().profiles[id]||null},
    async saveProfile(id,f){const d=get(),p=d.profiles[id],admin=p.role==="admin";
      const g={...f};delete g.role;delete g.note;
      if(!admin&&g.status&&!(g.status==="pending"&&["new","rejected"].includes(p.status)))delete g.status;
      Object.assign(p,g);put();return p},
    async uploadAvatar(id,blob){return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(blob)})},
    async listProfiles(){return Object.values(get().profiles).sort((a,b)=>b.created_at.localeCompare(a.created_at))},
    async myPerms(){const d=get(),p=d.profiles[d.session]||{};return p.role==="admin"?[...PERM_KEYS,"owner"]:p.role==="staff"?(p.perms||[]):[]},
    async staffList(){return Object.values(get().profiles).filter(p=>p.role==="admin"||p.role==="staff")},
    async setStaff(mail,ps){const d=get(),p=Object.values(d.profiles).find(x=>(x.email||"").toLowerCase()===mail.trim().toLowerCase());if(!p)throw new Error("ما لكينا عضو بهذا الإيميل. خلّيه يسجّل بالموقع أول.");if(p.role==="admin")throw new Error("هذا حساب المدير");
      ps=ps.filter(x=>PERM_KEYS.includes(x));if(!ps.length){p.role="member";p.perms=[];put();return"removed"}p.role="staff";p.perms=ps;p.status="approved";put();return"ok"},
    async setStatus(id,status,note){const p=get().profiles[id];p.status=status;p.note=note||"";put()},
    async getConfig(){return{...get().config}},
    async setConfig(k,v){get().config[k]=v;put()},
    async pushSub(){return null},async pushUnsub(){return null},async pushStatus(){return{devices:0,users:0,ready:true,err:"",sent24:0}},async pushTest(){return null},
    async notifs(){const d=get();return(d.notifs||[]).filter(n=>!n.user_id||n.user_id===d.session).slice(0,30)},
    async addNotif(f){const d=get();(d.notifs=d.notifs||[]).unshift({...f,id:Date.now(),user_id:null,created_at:now()});put()},
    async events(){return get().events||[]},
    async addEvent(f){const d=get();(d.events=d.events||[]).unshift({...f,id:Date.now(),created_at:now()});(d.notifs=d.notifs||[]).unshift({id:Date.now()+1,user_id:null,icon:"🏆",title:"مسابقة جديدة: "+f.title,body:f.body||"",link:"app.html#rewards",created_at:now()});put()},
    async delEvent(id){const d=get();d.events=(d.events||[]).filter(x=>x.id!==id);put()},
    async myRefs(){const d=get(),me=d.profiles[d.session];if(!me)return null;if(!me.ref_code){me.ref_code=Math.random().toString(36).slice(2,9);put()}
      const inv=Object.values(d.profiles).filter(p=>p.referred_by&&p.referred_by===me.ref_code&&p.id!==me.id),ap=inv.filter(p=>p.status==="approved").length;
      return{code:me.ref_code,signed:inv.length,pending:inv.filter(p=>p.status==="pending").length,approved:ap,points:inv.length+9*ap,list:inv.map(p=>({name:(p.full_name||"—").split(" ")[0],status:p.status,created_at:p.created_at}))}},
    async leaderboard(){const d=get(),P=Object.values(d.profiles);return P.map(o=>{const inv=P.filter(p=>o.ref_code&&p.referred_by===o.ref_code&&p.id!==o.id),ap=inv.filter(p=>p.status==="approved").length;return{name:(o.full_name||"عضو").split(" ")[0],approved:ap,points:inv.length+9*ap,is_me:o.id===d.session}}).filter(x=>x.points>0).sort((a,b)=>b.points-a.points).slice(0,10)},
    async info(){const d=get();return d.info||{dist_share:"",dist_text:"صير شريك وموزع لوكالة فيكسورا: كل شخص يفتح حساب INFINOX من رابطك ويتداول، تاخذ نسبة من عمولة تداوله، كل شهر وبدون سقف. نوفرلك رابطك الخاص، والمنصة والأكاديمية لعملائك، والدعم المباشر."}},
    async setInfo(o){const d=get();d.info={...(d.info||{}),...o};put()},
    async allInfo(){return get().info||{}},
    async sigEvents(id){const s=(get().signals||[]).find(x=>x.id===id);if(!s)return[];const L=[{at:s.sig_time,kind:"created",changes:{},reason:""},{at:s.sig_time,kind:"published",changes:{tg_sent:[0,1]},reason:""}];
      if(s.status==="win"||s.status==="loss")L.push({at:s.updated_at||s.sig_time,kind:"closed",changes:{status:["open",s.status]},reason:""});return L},
    async adminStatus(){const d=get(),P=Object.values(d.profiles).filter(p=>p.role!=="admin");return{members:P.length,approved:P.filter(p=>p.status==="approved").length,pending:P.filter(p=>p.status==="pending").length,
      new_week:P.filter(p=>Date.now()-new Date(p.created_at)<7*864e5).length,active_today:0,pay_pending:0,engine_last:d.config.engine_last||"",engine_err:d.config.engine_err||"",server_scan:d.config.server_scan||"0",
      prices_at:null,tg_last:null,emails_week:0,push_subs:0,push_failed:0,runs:[],rejections:[],mfa:{staff:1,on:0},demo:true}},
    async adminActivity(){return(get().alog||[]).slice(0,30)},
    async broadcastMail(){return Object.values(get().profiles).length},
    async uptime(){return[]},async message(uid,ttl,bdy){const d=get();(d.notifs=d.notifs||[]).unshift({id:Date.now(),user_id:uid,icon:"💬",title:"رسالة من الإدارة: "+ttl,body:bdy,link:"app.html#inbox",kind:"coach",created_at:now()});put()},
    async inbox(){return this.notifs()},async mySubs(){return[]},
    async savePrefs(id,o){const d=get();if(d.profiles[id]){d.profiles[id].notif_prefs=o;put()}return{notif_prefs:o}},
    async dataRequest(kind,note){const d=get();(d.dreq=d.dreq||[]).unshift({kind,note,status:"open",created_at:now(),user_id:d.session});put()},
    async myDataRequests(){const d=get();return(d.dreq||[]).filter(x=>x.user_id===d.session).slice(0,10)},
    async mfaList(){return[]},async mfaEnroll(){throw new Error("التحقق بخطوتين يشتغل بالموقع الحقيقي بس (مو بالنسخة التجريبية)")},async mfaVerify(){return true},async mfaRemove(){},
    async signals(){return(get().signals||[]).slice().sort((a,b)=>a.sig_time<b.sig_time?1:-1)},
    async econ(){return(get().econ||[]).slice().sort((a,b)=>a.at<b.at?-1:1)},
    async myCertCount(){return 0},
    async candles(sym,tf){const c=cache[sym+"|"+tf];return c&&c.src!=="sim"?{data:c.data.map(x=>[x.time,x.open,x.high,x.low,x.close]),updated_at:new Date(c.t).toISOString()}:null},
    async mailTest(){const c=get().config;return c.brevo_key?"ok:"+((get().profiles[get().session]||{}).email||""):"ناقص مفتاح Brevo"},
    async mailStatus(){const c=get().config;return{key:!!c.brevo_key,from:c.mail_from||"",name:c.mail_name||"",today:0,month:0,last:null}},
    async engineRun(){const c=get().config;c.engine_last=new Date().toISOString();c.engine_err="";put();return 1},
    async touch(pg){const d=get(),me=d.profiles[d.session];if(me){me.last_seen=new Date().toISOString();me.last_page=pg||"";put()}},
    async online(){const d=get(),P=Object.values(d.profiles),t=Date.now(),L=P.filter(p=>p.last_seen&&t-new Date(p.last_seen)<864e5).sort((a,b)=>b.last_seen<a.last_seen?-1:1);
      const day=new Date();day.setHours(0,0,0,0);return{now:P.filter(p=>p.last_seen&&t-new Date(p.last_seen)<12e4).length,today:P.filter(p=>p.last_seen&&new Date(p.last_seen)>=day).length,week:P.filter(p=>p.last_seen&&t-new Date(p.last_seen)<6048e5).length,list:L.map(p=>({...p,online:t-new Date(p.last_seen)<12e4}))}},
    async coursesFull(){const d=get(),P=d.cprices||{};return(await this.courses()).map((c,i)=>({...c,price:P[c.id]??[49,49,79,59,59][i],sort:i}))},
    async setCourse(id,f){const d=get();(d.cprices=d.cprices||{})[id]=f.price;put()},
    async uploadCoach(blob){return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(blob)})},
    async courses(){return[{id:"tech",title:"التحليل الفني",icon:"📈"},{id:"cls",title:"التحليل الكلاسيكي",icon:"📐"},{id:"wav",title:"التحليل الموجي (إليوت)",icon:"🌊"},{id:"tim",title:"التحليل الزمني",icon:"⏳"},{id:"num",title:"التحليل الرقمي (الإحصائي)",icon:"🔢"}]},
    async access(uid){return(get().grants||[]).filter(g=>g.uid===uid)},
    async aiAsk(q,ctx){const d=get();d.ai=d.ai||{};const st=await this.aiStatus();if(!st.member)throw new Error("المساعد للأعضاء المفعّلين بس");if(st.used>=st.limit&&!st.sub)throw new Error("AI_FREE_LIMIT: خلص سؤالك المجاني اليوم. اشترك بالمساعد حتى تسأل أكثر");const id=Date.now();(d.aiu=d.aiu||{})[id]=d.session;const sc=ctx.schools||{},pl=ctx.signal;
      d.ai[id]=`**نسخة تجريبية** (المساعد الحقيقي يشتغل بعد ما الكوتش يضيف المفتاح)\n\n**${ctx.name} · ${ctx.timeframe}** السعر ${ctx.price??"—"}\n- النتيجة الكلية للتحليل: ${ctx.total_score??"—"}\n`+Object.entries(sc).slice(0,4).map(([k,v])=>`- ${k}: ${v.points[0]||"—"}`).join("\n")+(pl?`\n- الصفقة: ${pl.side==="buy"?"شراء":"بيع"} من ${pl.entry_zone.join(" – ")} والوقف ${pl.stop_loss}`:"\n- ما في صفقة واضحة هسه")+`\n\nالتزم بالوقف وإدارة رأس المال.`;put();return id},
    async aiResult(id){return{status:"done",answer:get().ai[id]||""}},
    v4:mkV4Demo(get,put,()=>ME.user&&ME.user.id),
    v5:mkV5Demo(get,put,()=>ME.user&&ME.user.id),
    v9:mkV9Demo(get,put,()=>ME.user&&ME.user.id),
    v10:mkV10Demo(),
    v11:mkV11Demo(get,put,()=>ME.user&&ME.user.id),
    v13:mkV13Demo(get,put,()=>ME.user&&ME.user.id),
    async aiPro(cid,q,ctx,lang,mode){const d=get(),v=d.v3=d.v3||{chats:[],msgs:[],strat:[],scans:[],hits:[],risk:null,rt:[]};
      const aid=await this.aiAsk(q,ctx,lang);let ch=v.chats.find(c=>c.id===cid);
      if(!ch){ch={id:Date.now(),title:q.slice(0,70),sym:ctx.symbol||"",tf:ctx.timeframe||"",mode,updated_at:now()};v.chats.unshift(ch)}else ch.updated_at=now();
      const c=ctx.card||{},F=x=>x==null?"—":(+x).toFixed(c.dec||2),bs=c.bullS,be=c.bearS;
      let a=mode==="agents"&&c.agents?`**نسخة تجريبية** (الرد الحقيقي يكتبه Claude بعد ما الكوتش يضيف المفتاح)\n\n**نقاش الوكلاء:**\n`+c.agents.map(g=>`- **${g.n}** (${g.st>0?"شراء":g.st<0?"بيع":"محايد"}): ${g.r[0]||"ما عندي إشارة واضحة"}`).join("\n")+`\n\n**حكم الحَكَم:** ${c.verdict&&c.verdict.d>0?"شراء":c.verdict&&c.verdict.d<0?"بيع":"انتظار"}، لأن الأوزان الأكبر (الفني والكلاسيكي) ${c.d>0?"تميل للصعود":c.d<0?"تميل للهبوط":"متعارضة"}.${bs?`\n- تفعيل الصعود: ${bs.trig}، والإبطال: ${bs.inv}`:""}`
        :`**نسخة تجريبية** (الرد الحقيقي يكتبه Claude بعد ما الكوتش يضيف المفتاح)\n\n**الاتجاه العام:** ${c.d>0?"صاعد":c.d<0?"هابط":"متذبذب"}، ${Math.max(c.bull||0,c.bear||0)} من 6 مدارس متفقة.\n- أقرب دعم ${c.sup?F(c.sup.lo)+" – "+F(c.sup.hi):"غير متوفر"}، وأقرب مقاومة ${c.res?F(c.res.lo)+" – "+F(c.res.hi):"غير متوفرة"}.\n${bs?`- **الصاعد:** ${bs.trig}. الأهداف ${bs.tps.slice(0,2).map(F).join(" و ")}، والإبطال ${bs.inv}.\n`:""}${be?`- **الهابط:** ${be.trig}. الأهداف ${be.tps.slice(0,2).map(F).join(" و ")}، والإبطال ${be.inv}.\n`:""}\nالتزم بالوقف ولا تخاطر بأكثر من 1–2%.`;
      d.ai[aid]=a;v.msgs.push({id:Date.now(),chat_id:ch.id,role:"user",content:q,meta:{},status:"done",created_at:now()},{id:Date.now()+1,chat_id:ch.id,role:"assistant",content:a,meta:{card:ctx.card,mode},status:"done",req_id:aid,created_at:now()});put();return{chat:ch.id,aid}},
    async aiChats(){return((get().v3||{}).chats||[]).slice().sort((a,b)=>a.updated_at<b.updated_at?1:-1)},
    async aiMsgs(cid){return((get().v3||{}).msgs||[]).filter(m=>m.chat_id===cid)},
    async aiDelChat(id){const v=get().v3;if(!v)return;v.chats=v.chats.filter(c=>c.id!==id);v.msgs=v.msgs.filter(m=>m.chat_id!==id);put()},
    async aiUsage(){const n=Object.keys(get().ai||{}).length;return{today:n,today_users:1,month:n,month_cost:+(n*.006).toFixed(2),cap:40,price_in:1,price_out:5,chats:((get().v3||{}).chats||[]).length,
      by_kind:[{kind:"pro",n,cost:+(n*.006).toFixed(3)}],top:[{name:"المدير",n,cost:+(n*.006).toFixed(3)}],days:Array.from({length:14},(_,i)=>({d:new Date(Date.now()-(13-i)*864e5).toISOString().slice(0,10),n:i===13?n:0,cost:0}))}},
    _v(){const d=get();return d.v3=d.v3||{chats:[],msgs:[],strat:[],scans:[],hits:[],risk:null,rt:[]}},
    async stratList(){return this._v().strat},async stratAdd(r){const x={...r,id:Date.now(),updated_at:now()};this._v().strat.unshift(x);put();return{id:x.id}},
    async stratUpd(id,r){const s=this._v().strat.find(x=>x.id===id);if(s)Object.assign(s,r,{updated_at:now()});put()},async stratDel(id){const v=this._v();v.strat=v.strat.filter(x=>x.id!==id);put()},
    async scanUni(){return Object.entries(cache).filter(([k,c])=>c.src!=="sim"&&c.data&&c.data.length>60).map(([k,c])=>({sym:k.split("|")[0],tf:k.split("|")[1],updated_at:new Date(c.t).toISOString(),n:c.data.length}))},async scans(){return this._v().scans},async scanAdd(r){this._v().scans.unshift({...r,id:Date.now(),active:true,hits:0,created_at:now()});put()},
    async scanSet(id,r){const s=this._v().scans.find(x=>x.id===id);if(s)Object.assign(s,r);put()},async scanDel(id){const v=this._v();v.scans=v.scans.filter(x=>x.id!==id);put()},async scanHits(){return this._v().hits},
    async riskGet(){return this._v().risk},async riskSet(r){this._v().risk=r;put()},async riskTrades(){return this._v().rt},
    async riskAdd(r){this._v().rt.unshift({...r,id:Date.now(),status:"open",created_at:now()});put()},async riskUpd(id,r){const t=this._v().rt.find(x=>x.id===id);if(t)Object.assign(t,r);put()},
    async riskDel(id){const v=this._v();v.rt=v.rt.filter(x=>x.id!==id);put()},
    async aiStatus(){const d=get(),me=d.profiles[d.session]||{},adm=me.role==="admin",g=(d.grants||[]).find(x=>x.uid===d.session&&x.kind==="ai"&&new Date(x.expires_at)>new Date());
      const used=Object.keys(d.ai||{}).filter(k=>+k>Date.now()-864e5&&(d.aiu||{})[k]===d.session).length,c=d.config||{};
      return{member:adm||me.status==="approved",sub:adm||!!g,until:g?g.expires_at:null,pending:false,used,limit:(adm||g)?+(c.ai_daily||30):+(c.ai_free||1),price:(d.info||{}).price_ai||"10",currency:"$"}},
    async grant(uid,what,cid,days){const d=get();(d.grants=d.grants||[]).unshift({id:Date.now(),uid,kind:what==="all"?"monthly":what==="ai"?"ai":"course",course_id:cid,expires_at:what!=="course"?new Date(Date.now()+(days||3650)*864e5).toISOString():null});put()},
    async revoke(pid){const d=get();d.grants=(d.grants||[]).filter(g=>g.id!==pid);put()},
  };
}
const DB=DEMO?demoBackend():supaBackend();
const ME={user:null,profile:null,started:false};
function isAdminUser(){return ME.profile?.role==="admin"}
const PERM_KEYS=["members","payments","courses","zoom","content"];
const PERM_L={members:"👥 الأعضاء: قبول، رفض، تعديل البيانات، المتواجدين",payments:"💳 طلبات الأكاديمية والمدفوعات وإهداء الكورسات",courses:"🎓 فتح كل الدورات والدروس",zoom:"🎥 دروس الزوم",content:"🌐 محتوى الموقع: الكوتشات، الشهادات، المؤشرات، التواصل",news:"📰 أخبار فيكسورا: الأحداث والمقالات"};
const PERM_S={members:"الأعضاء",payments:"المدفوعات",courses:"الدورات",zoom:"الزوم",content:"المحتوى"};
function can(k){return isAdminUser()||(ME.perms||[]).includes(k)}

/* ================= members: helpers ================= */
const initials=n=>(n||"؟").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("");
function avHTML(p,cls=""){
  if(p&&p.avatar_url)return`<img class="av ${cls}" src="${esc(p.avatar_url)}" alt="">`;
  return`<span class="av ${cls}" aria-hidden="true">${esc(initials(p&&p.full_name))}</span>`;
}
const STATUS={new:["غير مكتمل",""],pending:["قيد المراجعة","acc"],approved:["مفعّل","buy"],rejected:["مرفوض","sell"]};
const badge=p=>p.role==="admin"?'<span class="chip acc">مدير</span>':`<span class="chip ${STATUS[p.status][1]}">${STATUS[p.status][0]}</span>`;
const normTg=v=>{v=(v||"").normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\s]/g,"")
  .replace(/^(https?:)?\/*(www\.)?(t|telegram)\.me\//i,"").replace(/[?#].*$/,"").replace(/\/+$/,"")
  .replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/^@+/,"");return v?"@"+v:""};
function tgProblem(t){if(!t)return"اكتب يوزر تيليجرام";const u=t.slice(1);
  if(/[\u0600-\u06FF]/.test(u))return"اليوزر يكون بالإنجليزي، مو اسمك بالعربي. تلگاه بتيليجرام ← الإعدادات ← اسم المستخدم";
  if(/^\+?\d+$/.test(u))return"هذا رقم هاتف، اكتب اليوزر مالتك (يبدي بـ @)";
  if(u.length<5)return"اليوزر قصير، لازم 5 أحرف أو أكثر";
  if(!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(u))return"اليوزر بس حروف إنجليزية وأرقام و _ ، ويبدي بحرف";
  return""}
const dateAr=s=>new Date(s).toLocaleDateString(window.LANG||"ar",{day:"numeric",month:"short",year:"numeric"});
async function squareJpeg(file,max=320){
  const url=URL.createObjectURL(file),img=new Image();
  try{await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(new Error("الملف مو صورة"));img.src=url});
    const side=Math.min(img.width,img.height),out=Math.min(max,side),c=document.createElement("canvas");c.width=c.height=out;
    c.getContext("2d").drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,out,out);
    return await new Promise(r=>c.toBlob(r,"image/jpeg",.86));
  }finally{URL.revokeObjectURL(url)}
}
function avatarPicker(fileId,holderId,getP){
  const st={blob:null};
  $(fileId).addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;
    try{st.blob=await squareJpeg(f);const u=URL.createObjectURL(st.blob);$(holderId).innerHTML=`<img class="av lg" src="${u}" alt="">`}
    catch(err){if(f.size<12e6&&(/^image\//.test(f.type)||/\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))){st.blob=f;$(holderId).innerHTML=`<span class="av lg" aria-hidden="true">✓</span>`}else alert(err.message)}});
  st.reset=()=>{st.blob=null;$(holderId).innerHTML=avHTML(getP(),"lg")};
  return st;
}

/* ================= members: views ================= */
document.querySelectorAll(".brokerN,#brokerName1,#brokerName2").forEach(el=>el.textContent=CONFIG.BROKER_NAME);
$("brokerLink").href=CONFIG.BROKER_LINK;setTimeout(()=>{if(DB.allInfo)DB.allInfo().then(applyInfo).catch(()=>{})},0);$("brokerLink").textContent=`افتح حسابك مع ${CONFIG.BROKER_NAME}`;
$("demoNote").hidden=!DEMO;
try{const rf=new URLSearchParams(location.search).get("ref");if(rf)localStorage.setItem("albasha_ref",rf.replace(/^@/,""))}catch(e){}
document.querySelectorAll(".support").forEach(el=>{el.innerHTML=`عندك مشكلة بالتسجيل؟ راسلنا على تيليجرام <a class="gold num" href="https://t.me/${CONFIG.SUPPORT_TG}" target="_blank" rel="noopener">@${CONFIG.SUPPORT_TG}</a>`});
function gate(view){
  $("app").hidden=true;$("gate").hidden=false;if(!$("gOffer").innerHTML)$("gOffer").innerHTML=offerHTML();
  ["vAuth","vReset","vOnboard","vPending"].forEach(v=>$(v).hidden=v!==view);
  window.scrollTo(0,0);
}
$("pwEye").addEventListener("click",()=>{const i=$("aPass"),sh=i.type==="password";i.type=sh?"text":"password";$("pwEye").setAttribute("aria-label",sh?"اخفِ كلمة السر":"أظهر كلمة السر");$("pwEye").style.color=sh?"var(--accent)":""});
let mode="in";
function setMode(m){mode=m;$("tabIn").setAttribute("aria-selected",m==="in");$("tabUp").setAttribute("aria-selected",m==="up");
  $("aNameL").hidden=m!=="up";$("gate").classList.toggle("signup",m==="up");$("authSub").textContent=m==="up"?"انضم لمجتمع فيكسورا وابدأ رحلتك بالتداول":"هلا بيك، كمّل من وين وكفت";$("aSubmit").textContent=m==="up"?"إنشاء حساب":"دخول";$("authTitle").textContent=m==="up"?"حساب جديد":"تسجيل الدخول";
  $("aPass").autocomplete=m==="up"?"new-password":"current-password";$("aMsg").textContent="";$("aMsg").className="msg"}
$("tabIn").addEventListener("click",()=>setMode("in"));$("tabUp").addEventListener("click",()=>setMode("up"));
const say=(id,t,ok)=>{$(id).textContent=t;$(id).className="msg "+(ok?"ok":"err")};
$("authForm").addEventListener("submit",async e=>{e.preventDefault();
  const email=$("aEmail").value.trim().toLowerCase(),pw=$("aPass").value,name=$("aName").value.trim();
  if(!email||!pw)return say("aMsg","اكتب الإيميل وكلمة السر");
  if(mode==="up"&&!name)return say("aMsg","اكتب اسمك الكامل");
  $("aSubmit").disabled=true;say("aMsg","لحظة…",true);
  try{if(mode==="up"){const r=await DB.signUp(email,pw,name);if(r.confirm)say("aMsg","أرسلنا رابط تأكيد على إيميلك. افتحه وارجع سوّ دخول.",true)}
    else await DB.signIn(email,pw)}
  catch(err){say("aMsg",err.message)}finally{$("aSubmit").disabled=false}});
$("gBtn").addEventListener("click",async()=>{try{await DB.google()}catch(err){say("aMsg",err.message)}});
$("forgotBtn").addEventListener("click",async()=>{const email=$("aEmail").value.trim();if(!email)return say("aMsg","اكتب إيميلك فوق وبعدين اضغط نسيت كلمة السر");
  try{await DB.reset(email);say("aMsg","أرسلنا رابط تغيير كلمة السر على إيميلك.",true)}catch(err){say("aMsg",err.message)}});
$("resetForm").addEventListener("submit",async e=>{e.preventDefault();const pw=$("rPass").value;if(pw.length<6)return say("rMsg","كلمة السر لازم 6 أحرف أو أكثر");
  try{await DB.setPassword(pw);say("rMsg","تم تغيير كلمة السر.",true);setTimeout(()=>route(),900)}catch(err){say("rMsg",err.message)}});
document.addEventListener("click",async e=>{if(e.target.closest("[data-out]")){$("userMenu").hidden=true;await DB.signOut();location.hash="";location.reload()}});

/* onboarding */
function setCountry(id,v){const el=$(id);v=v||"";if(v&&![...el.options].some(o=>o.value===v)){const o=document.createElement("option");o.value=o.textContent=v;el.appendChild(o)}el.value=v}
const obPick=avatarPicker("obFile","obAv",()=>ME.profile);
const OBF=["obName","obTg","obPhone","obCountry","obRef","obAcc"];
const obKey=()=>"vx_ob_"+(ME.user?ME.user.id:"x");
function obDraft(){try{return JSON.parse(localStorage.getItem(obKey())||"null")}catch(e){return null}}
function obSave(extra){try{const d=obDraft()||{};OBF.forEach(k=>d[k]=$(k).value);d.open=1;Object.assign(d,extra||{});localStorage.setItem(obKey(),JSON.stringify(d))}catch(e){}}
function obClear(){try{localStorage.removeItem(obKey())}catch(e){}}
function obRestore(){const d=obDraft();if(!d)return;OBF.forEach(k=>{if(d[k]!=null&&d[k]!==""){if(k==="obCountry")setCountry(k,d[k]);else $(k).value=d[k]}});
  if(d.photo&&!obPick.blob){fetch(d.photo).then(r=>r.blob()).then(b=>{obPick.blob=b;$("obAv").innerHTML=`<img class="av lg" src="${d.photo}" alt="">`}).catch(()=>{})}
  $("obMsg").className="msg ok";$("obMsg").textContent="✓ رجعنالك البيانات اللي كتبتها. كمّل من وين ما وكفت."}
function fillOnboard(){const p=ME.profile;window.VexoraMarketing?.memberAutomation($("obAv"),DB.marketing,false);$("obAv").innerHTML=avHTML(p,"lg");obPick.blob=null;
  $("obName").value=p.full_name||"";$("obTg").value=p.telegram||"";$("obPhone").value=p.phone||"";setCountry("obCountry",p.country);$("obOffer").innerHTML=offerHTML();let rr="";try{rr=localStorage.getItem("albasha_ref")||""}catch(e){}$("obRef").value=p.referred_by?"":(rr?rr:"");$("obRef").closest("label").hidden=!!p.referred_by;$("obAcc").value=p.broker_account||"";
  $("obAgree").checked=false;$("obMsg").textContent=p.status==="rejected"&&p.note?"سبب الرفض: "+p.note:"";$("obMsg").className="msg err";
  if(["new","rejected"].includes(p.status))obRestore();obSave()}
$("obForm").addEventListener("input",()=>obSave());$("obForm").addEventListener("change",()=>obSave());
$("obFile").addEventListener("change",()=>setTimeout(()=>{if(!obPick.blob)return;const fr=new FileReader();fr.onload=()=>{if(String(fr.result).length<900000)obSave({photo:fr.result})};fr.readAsDataURL(obPick.blob)},700));
$("obForm").addEventListener("submit",async e=>{e.preventDefault();
  const f={full_name:$("obName").value.trim(),telegram:normTg($("obTg").value),phone:$("obPhone").value.trim(),country:$("obCountry").value.trim(),broker_account:$("obAcc").value.trim()};
  const ref=normTg($("obRef").value);if(ref&&ref.toLowerCase()!==f.telegram.toLowerCase())f.referred_by=ref;
  if(!f.full_name||!f.telegram||!f.broker_account)return say("obMsg","أكمل الاسم ويوزر تيليجرام ورقم الحساب");
  if(!f.country)return say("obMsg","اختر دولتك");
  {const er=tgProblem(f.telegram);if(er){$("obTg").focus();return say("obMsg",er)}}
  if(!$("obAgree").checked)return say("obMsg","أكّد إنك فتحت حسابك من رابطنا");
  $("obSubmit").disabled=true;say("obMsg","جاري الإرسال…",true);
  try{if(obPick.blob){try{f.avatar_url=await DB.uploadAvatar(ME.user.id,obPick.blob)}catch(e){console.warn(e)}}
    f.status="pending";ME.profile=await DB.saveProfile(ME.user.id,f);obClear();
    if(DEMO)demoJoinAlert(ME.profile);
    route()}
  catch(err){say("obMsg",err.message)}finally{$("obSubmit").disabled=false}});
async function demoJoinAlert(p){
  // في النسخة الحقيقية يرسل الخادم (Supabase) التنبيه، وهنا نرسله من المتصفح للتجربة فقط
  try{const c=await DB.getConfig();if(!c.tg_token||!c.tg_admin)return;SC.tg={token:c.tg_token,chat:c.tg_chat||"",admin:c.tg_admin};await tgSend(joinText(p),c.tg_admin)}catch(e){}
}
const joinText=p=>`👑 <b>فيكسورا</b>\n🆕 <b>طلب انضمام جديد</b>\n\n👤 الاسم: ${esc(p.full_name)}\n✈️ تيليجرام: ${esc(p.telegram)}\n📧 الإيميل: ${esc(p.email)}\n🏦 حساب ${esc(CONFIG.BROKER_NAME)}: <code>${esc(p.broker_account)}</code>\n📱 الهاتف: ${esc(p.phone||"—")}\n🌍 الدولة: ${esc(p.country||"—")}\n\nراجع الطلب من لوحة الإدارة.`;

/* pending */
function fillPending(){const p=ME.profile;window.VexoraMarketing?.memberAutomation($("pdInfo"),DB.marketing,false);
  $("pdAv").innerHTML=avHTML(p,"xl");$("pdName").textContent=p.full_name;$("pdBadge").innerHTML=badge(p);
  $("pdText").innerHTML=p.status==="rejected"
    ?`ما قدرنا نفعّل حسابك.${p.note?` <b class="down">السبب: ${esc(p.note)}</b>`:""} تأكد إنك فتحت حسابك مع ${esc(CONFIG.BROKER_NAME)} من <a class="gold" href="${esc(CONFIG.BROKER_LINK)}" target="_blank" rel="noopener">رابطنا</a>، وعدّل بياناتك وأرسلها مرة ثانية.`
    :`وصلنا طلبك وراح نراجعه قريباً. نتأكد إن حسابك في ${esc(CONFIG.BROKER_NAME)} مسجّل عن طريقنا، وبعدها يتفعّل دخولك للمنصة.`;
  $("pdInfo").innerHTML=[["تيليجرام",p.telegram],["رقم الحساب",p.broker_account],["الإيميل",p.email],["التسجيل",dateAr(p.created_at)]]
    .map(([a,b])=>`<div><div class="label">${a}</div><div class="v" style="font-size:13px">${esc(b||"—")}</div></div>`).join("");
  $("pdInfo").style.gridTemplateColumns="1fr 1fr";
}
$("pdEdit").addEventListener("click",()=>{fillOnboard();gate("vOnboard")});
$("pdRefresh").addEventListener("click",async()=>{ME.profile=await DB.getProfile(ME.user.id);route()});

/* app shell */
function fillUser(){const p=ME.profile;$("uAv").innerHTML=avHTML(p,"sm");$("uName").textContent=(p.full_name||p.email).split(" ")[0];document.body.classList.toggle("is-admin",isAdminUser());document.body.classList.toggle("can-members",can("members"));document.body.classList.toggle("can-payments",can("payments"));{const g=document.getElementById("gAdm");if(g)g.hidden=!(isAdminUser()||(ME.perms||[]).length)}}
$("userBtn").addEventListener("click",e=>{e.stopPropagation();const m=$("userMenu");m.hidden=!m.hidden;$("userBtn").setAttribute("aria-expanded",String(!m.hidden))});
document.addEventListener("click",e=>{if(!e.target.closest(".umenu-w"))$("userMenu").hidden=true});
document.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(!g)return;$("userMenu").hidden=true;location.hash=g.dataset.go;showView()});
window.addEventListener("hashchange",showView);
const PAGES={analysis:["mainArea"],trades:["secTrades","secLower"],deep:["secDeep"]};
function setPage(pg){
  for(const k in PAGES)PAGES[k].forEach(id=>{const e=$(id);if(e)e.hidden=k!==pg});
  document.querySelectorAll(".secnav [data-pg]").forEach(a=>a.toggleAttribute("aria-current",a.dataset.pg===pg));
  const a=document.querySelector(`.secnav [data-pg="${pg}"]`);if(a)a.setAttribute("aria-current","page");
  if(pg==="deep"&&$("deepHead"))$("deepHead").textContent=`${S.sym.n} · ${S.sym.s} · ${S.tf}`;
}
function showView(){
  if($("app").hidden)return;
  let v=location.hash.slice(1),v4a="",v5a="";{let m5;if(m5=v.match(/^admin\/(news|partners|broker-support)$/)){v5a=m5[1]==="broker-support"?"brokers":"";v=m5[1]==="news"?"newsadm":"partadm"}else if(m5=v.match(/^(news|economic-calendar|calendar)(?:\/(.*))?$/)){v5a=m5[1]==="news"?(m5[2]||""):"calendar";v="news"}else if(v==="broker-help"){v="brokerhelp"}else if(m5=v.match(/^(partners|partner|broker-support)(?:\/(.*))?$/)){v5a=m5[1]==="partner"?"dashboard":m5[1]==="broker-support"?"support":(m5[2]||"");v="partners"}}if(v==="newsadm"&&!can("news"))v="news";if(v==="partadm"&&!isAdminUser())v="partners";{const m=v.match(/^(comp|gw|growth|rewards)\/(.+)$/);if(m){v=m[1];v4a=m[2]}}if(v==="admin"&&!can("members"))v="";if(v==="growth"&&v4a!=="marketing-ai"&&!isAdminUser())v="";
  if(!["","trades","deep","profile","admin","rewards","chart","settings","record","calendar","inbox","ai","strategy","scanner","risk","comp","gw","growth","news","partners","newsadm","partadm","brokerhelp","journal","radar","winrate","zones","analysis","forecast","brief","path","help","crm","ops","bi","compliance","copier"].includes(v))v="";if(["ops","bi","compliance"].includes(v)&&!isAdminUser())v="";
  if(v==="settings"&&!isAdminUser())v="";
  const term=v===""||v==="trades"||v==="deep";
  $("terminalView").hidden=!term;$("profileView").hidden=v!=="profile";$("adminView").hidden=v!=="admin";$("rewardsView").hidden=v!=="rewards";if(v==="rewards")loadRewards();$("chartView").hidden=v!=="chart";if(v==="chart")chartPage();$("settingsView").hidden=v!=="settings";if(v==="settings")settingsPage();$("recordView").hidden=v!=="record";if(v==="record")loadRecord();$("calView").hidden=v!=="calendar";if(v==="calendar")calPage();$("inboxView").hidden=v!=="inbox";
  if(ME.locked)$("lockCard").hidden=!(term||v==="chart");
  document.querySelectorAll(".secnav [data-pg]").forEach(a=>a.toggleAttribute("aria-current",false));
  if(term)setPage(v||"analysis");
  $("dHero").hidden=v!==""||!!ME.locked;$("dStats").hidden=v!==""||!!ME.locked;if(v===""&&!ME.locked){dashTop().catch(()=>{});V8B()}else{const g=$("v8Grad");if(g)g.hidden=true}
  if(v==="profile")fillProfile();if(v==="admin")loadAdmin();try{V2.view(v)}catch(e){console.warn(e)}try{V3.view(v)}catch(e){console.warn(e)}try{V9.view(v)}catch(e){console.warn(e)}try{V10.view(v)}catch(e){console.warn(e)}try{V11.view(v)}catch(e){console.warn(e)}try{V13.view(v)}catch(e){console.warn(e)}try{V4.view(v,v4a)}catch(e){console.warn(e)}try{V5.view(v,v5a)}catch(e){console.warn(e)}
  window.scrollTo(0,0);
}
const OFFER={spread:"22–27",cashback:"7$",bonus:"100%",invites:10}; // عدّل أرقام العرض من هنا
function offerHTML(){return`<div class="offer"><div class="of-h">🎁 مميزات التسجيل من رابطنا</div><div class="of-g">
  <div><b class="num">${OFFER.spread}</b><span>حجم السبريد من 22 إلى 27</span></div>
  <div><b class="num">${OFFER.cashback}</b><span>كاش باك على تداولك الشخصي يوصل لـ 7$</span></div>
  <div><b class="num">${OFFER.bonus}</b><span>بونص 100% على الإيداع</span></div>
  <div><b class="num">🎟 ${OFFER.invites}</b><span>ادعُ 10 أشخاص ينضمون للبروكر والمنصة وتدخل السحب على دورة أو اشتراك مجاني</span></div>
  </div><small>حسب شروط وأحكام INFINOX</small></div>`}
function fillLock(){const p=ME.profile,el=$("lockCard"),B=esc(CONFIG.BROKER_NAME),IB=esc(CONFIG.BROKER_LINK);
  document.body.classList.toggle("locked",!!ME.locked);el.hidden=!ME.locked;if(!ME.locked){el.innerHTML="";return}
  const sup=`<p class="label" style="font-size:13px">عندك مشكلة بالتسجيل؟ راسلنا على تيليجرام <a class="gold num" href="https://t.me/${CONFIG.SUPPORT_TG}" target="_blank" rel="noopener">@${CONFIG.SUPPORT_TG}</a></p>`;
  if(p.status==="pending"){
    el.innerHTML=`<div class="lk-ic">⏳</div><h2>طلبك قيد المراجعة</h2>
      <p>وصلنا رقم حسابك، ونتأكد إنه مسجّل تحت وكالتنا بـ ${B}. أول ما يتفعّل تنفتح لك المنصة كاملة وقناة التوصيات.</p>
      <div class="kvs" style="grid-template-columns:1fr 1fr">${[["تيليجرام",p.telegram],["رقم الحساب",p.broker_account]].map(([a,b])=>`<div><div class="label">${a}</div><div class="v" style="font-size:13px">${esc(b||"—")}</div></div>`).join("")}</div>
      <div class="lk-cta"><button type="button" class="btn primary" id="lkRefresh">تحديث الحالة</button><button type="button" class="btn" id="lkEdit">تعديل بياناتي</button></div>${sup}`;
  }else{
    const rej=p.status==="rejected";
    el.innerHTML=`<div class="lk-ic">🔒</div><h2>المنصة مقفلة</h2>
      <p>التوصيات والصفقات والتحليل وقناة تيليجرام حصرية لعملاء وكالة فيكسورا على ${B}. افتح حسابك من رابطنا وتنفتح لك كلها.</p>
      ${rej?`<p class="down" style="color:#f0606f">ما قدرنا نفعّل حسابك.${p.note?` السبب: ${esc(p.note)}`:""}</p>`:""}
      <ol><li><span><b>افتح حساب ${B}</b> من رابطنا</span></li><li><span><b>أكمل بياناتك</b> واكتب رقم حسابك ويوزر تيليجرام</span></li><li><span><b>نفعّلك</b> وتنفتح المنصة وقناة التوصيات</span></li></ol>${offerHTML()}
      <div class="lk-cta"><a class="btn primary" href="${IB}" target="_blank" rel="noopener">افتح حسابك مع ${B}</a><button type="button" class="btn" id="lkEdit">فتحت حسابي، أكمل بياناتي</button></div>${sup}`;
  }
  const ed=$("lkEdit");if(ed)ed.onclick=()=>{fillOnboard();gate("vOnboard")};
  const rf=$("lkRefresh");if(rf)rf.onclick=async()=>{rf.disabled=true;try{ME.profile=await DB.getProfile(ME.user.id)}catch(e){}route()};
}
$("obBack").addEventListener("click",()=>{obSave({open:0});route()});
$("obTg").addEventListener("input",()=>{const t=normTg($("obTg").value),er=t?tgProblem(t):"",h=$("obTgHint");
  h.textContent=!t?"ما عندك يوزر؟ افتح تيليجرام ← الإعدادات ← اسم المستخدم، وسوّي واحد بالإنجليزي.":er?er:"✓ "+t;h.style.color=!t?"":er?"#f0606f":"#34c98e"});
async function enterApp(){
  $("gate").hidden=true;$("app").hidden=false;fillUser();fillLock();
  try{const c=await DB.getConfig();
    if(c.twelve_key)S.key=c.twelve_key;else if(!isAdminUser()&&S.key){S.key="";save()}
    SERVER_SCAN=c.server_scan==="1";if(c.td_block_until&&Date.parse(c.td_block_until)>Date.now())TD_BLOCK=Date.parse(c.td_block_until);
    if(isAdminUser()&&(c.tg_token||c.tg_chat)){SC.tg={token:c.tg_token||SC.tg.token,chat:c.tg_chat||SC.tg.chat,admin:c.tg_admin||SC.tg.admin||"",news:c.tg_news||SC.tg.news||""}}
    if(!isAdminUser())SC.auto=false;
    ME.invite=c.tg_invite||"";if($("tgInvite"))$("tgInvite").value=ME.invite;ME.invite2=c.tg_invite2||"";if($("tgInvite2"))$("tgInvite2").value=ME.invite2;
  }catch(e){}
  $("chanCard").hidden=!(ME.invite||ME.invite2)||isAdminUser()||!!ME.locked;$("chanLink").hidden=$("pChan").hidden=!ME.invite;$("chanLink2").hidden=$("pChan2").hidden=!ME.invite2;if(ME.invite){$("chanLink").href=ME.invite;$("pChan").href=ME.invite}if(ME.invite2){$("chanLink2").href=ME.invite2;$("pChan2").href=ME.invite2}
  $("chanUser").textContent=ME.profile.telegram||"";
  if(!ME.started){ME.started=true;startTerminal()}
  showView();if(can("members"))refreshPendCount();loadBell();startBeat();setTimeout(()=>PUSH.nudge(VAPID,pushSave),4000);
  try{const rr=localStorage.getItem("albasha_ref");if(rr&&!ME.profile.referred_by&&ME.profile.status==="new"&&rr!==ME.profile.ref_code){ME.profile=await DB.saveProfile(ME.user.id,{referred_by:rr})||ME.profile}}catch(e){}
}

/* profile page */
const pfPick=avatarPicker("pfFile","pfAv",()=>ME.profile);
function fillProfile(){const p=ME.profile;window.VexoraMarketing?.memberAutomation($("pInfo"),DB.marketing,p.status==="approved");
  {const u=p.ref_code||(p.telegram||"").replace(/^@/,""),el=$("pInvite");el.hidden=!u;if(u){const link=refLink(u);
    el.innerHTML=`<div class="of-h">🎟 رابط دعوتك</div><span style="font-size:13px;color:#d6d6dc">ادعُ 10 أشخاص ينضمون للبروكر والمنصة من رابطك، وتدخل السحب على دورة أو اشتراك مجاني.</span><div style="display:flex;gap:8px;align-items:center"><input class="ltr" readonly value="${esc(link)}" style="flex:1;min-width:0" id="pInvLink"><button class="btn" type="button" id="pInvCopy">نسخ</button></div><a class="gold" href="#rewards" data-go="rewards" style="font-size:13px">🎁 شوف دعواتك ونقاطك والمسابقات ←</a>`;
    $("pInvCopy").onclick=async()=>{try{await navigator.clipboard.writeText(link)}catch(e){$("pInvLink").select();document.execCommand("copy")}$("pInvCopy").textContent="✓"}}}
  $("pAv").innerHTML=avHTML(p,"xl");$("pName").textContent=p.full_name||"—";$("pEmail").textContent=p.email;$("pBadge").innerHTML=badge(p);
  $("pInfo").innerHTML=[["تيليجرام",p.telegram],["رقم الحساب",p.broker_account],["الهاتف",V2.mask(p.phone)],["الدولة",p.country],["عضو منذ",dateAr(p.created_at)]]
    .map(([a,b])=>`<div><div class="label">${a}</div><div class="v" style="font-size:13px">${esc(b||"—")}</div></div>`).join("");
  pfPick.reset();$("pfName").value=p.full_name||"";$("pfTg").value=p.telegram||"";$("pfPhone").value=p.phone||"";setCountry("pfCountry",p.country);$("pfAcc").value=p.broker_account||"";$("pfMsg").textContent="";
}
$("pfForm").addEventListener("submit",async e=>{e.preventDefault();
  const f={full_name:$("pfName").value.trim(),telegram:normTg($("pfTg").value),phone:$("pfPhone").value.trim(),country:$("pfCountry").value.trim(),broker_account:$("pfAcc").value.trim()};
  if(!f.full_name)return say("pfMsg","الاسم مطلوب");
  if(f.telegram){const er=tgProblem(f.telegram);if(er)return say("pfMsg",er)}
  say("pfMsg","جاري الحفظ…",true);
  try{if(pfPick.blob)f.avatar_url=await DB.uploadAvatar(ME.user.id,pfPick.blob);ME.profile=await DB.saveProfile(ME.user.id,f);fillProfile();fillUser();say("pfMsg","تم الحفظ ✓",true)}
  catch(err){say("pfMsg",err.message)}});
$("pwForm").addEventListener("submit",async e=>{e.preventDefault();const pw=$("pw1").value;if(pw.length<6)return say("pwMsg","كلمة السر لازم 6 أحرف أو أكثر");
  try{await DB.setPassword(pw);$("pw1").value="";say("pwMsg","تم تغيير كلمة السر ✓",true)}catch(err){say("pwMsg",err.message)}});

/* admin page */
const ADM={rows:[],tab:"pending"};
async function refreshPendCount(){try{const r=await DB.listProfiles();ADM.rows=r;const n=r.filter(p=>p.status==="pending").length;$("pendCount").hidden=!n;$("pendCount").textContent=n}catch(e){}}
async function loadAiCfg(){try{const c=await DB.getConfig();$("aiKey").value="";$("aiKey").placeholder=c.anthropic_key?"✓ المفتاح محفوظ (اكتب جديد حتى تغيّره)":"sk-ant-…";$("aiDaily").value=c.ai_daily||"30";$("aiFree").value=c.ai_free??"1";$("aiModel").value=c.ai_model||"claude-haiku-5-5"}catch(e){}}
$("aiSave").addEventListener("click",async()=>{try{let k=$("aiKey").value.trim();if(k){const m=k.match(/sk-ant-[A-Za-z0-9_-]{20,}/);if(!m)throw new Error("المفتاح لازم يبدي بـ sk-ant-. انسخ المفتاح لحاله بزر Copy، مو مثال الكود");k=m[0];await DB.setConfig("anthropic_key",k,false);$("aiKey").value=""}await DB.setConfig("ai_daily",String(+$("aiDaily").value||30),false);await DB.setConfig("ai_free",String(Math.max(0,+$("aiFree").value||0)),false);await DB.setConfig("ai_model",$("aiModel").value.trim()||"claude-haiku-5-5",false);say("aiMsg","✓ انحفظ",true);loadAiCfg()}catch(err){say("aiMsg",err.message)}});
async function loadAdmin(){loadOnline();if(isAdminUser())loadStaff();$("admRows").innerHTML=`<tr><td colspan="8" class="label">جاري التحميل…</td></tr>`;
  try{ADM.rows=await DB.listProfiles()}catch(err){$("admRows").innerHTML=`<tr><td colspan="8" class="down">${esc(err.message)}</td></tr>`;return}
  renderAdmin();refreshPendCount()}
function renderAdmin(){
  const R=ADM.rows.filter(p=>p.role!=="admin"),c=k=>R.filter(p=>p.status===k).length;
  $("admStats").innerHTML=[["كل الأعضاء",R.length,""],["بانتظار المراجعة",c("pending"),"gold"],["مفعّلين",c("approved"),"up"],["مرفوضين",c("rejected"),"down"]]
    .map(([a,b,cl])=>`<div><span class="label">${a}</span><b class="${cl}">${b}</b></div>`).join("");
  const tabs=[["pending","بانتظار المراجعة"],["approved","المفعّلين"],["rejected","المرفوضين"],["new","غير مكتمل"],["all","الكل"]];
  $("admTabs").innerHTML=tabs.map(([k,l])=>`<button type="button" role="tab" data-at="${k}" aria-selected="${k===ADM.tab}">${l} <span class="chip num">${k==="all"?R.length:c(k)}</span></button>`).join("");
  const list=ADM.tab==="all"?R:R.filter(p=>p.status===ADM.tab);
  $("admRows").innerHTML=list.map(p=>{const id=esc(p.id),tg=(p.telegram?`<a class="gold num" href="https://t.me/${esc(p.telegram.slice(1))}" target="_blank" rel="noopener">${esc(p.telegram)}</a>`:"—")+` <button type="button" class="linkb" data-etg="${id}" title="تعديل اليوزر">✏️</button>`;
    const acts=p.status==="approved"
      ?`<div class="acts"><input id="note-${id}" placeholder="سبب الإيقاف"><button type="button" class="btn no" data-act="rejected" data-id="${id}">إيقاف</button></div>`
      :`<div class="acts"><button type="button" class="btn ok" data-act="approved" data-id="${id}">قبول</button><input id="note-${id}" placeholder="سبب الرفض (يرجع للعضو يصححه)"><button type="button" class="btn no" data-act="rejected" data-id="${id}">رفض</button></div>`;
    const extra=`<div class="acts" style="margin-top:6px"><button type="button" class="btn" data-medit="${id}">✏️ تعديل البيانات</button><button type="button" class="btn" data-mmsg="${id}">💬 رسالة</button><button type="button" class="btn need-payments" data-mgift="${id}" style="color:var(--accent);border-color:#5a4a16">🎁 إهداء كورس</button></div>`;
    return`<tr><td><div class="mcell">${avHTML(p)}<div><b>${esc(p.full_name||"—")}</b><span>${esc(p.email)}</span>${p.last_seen?`<span class="lseen${Date.now()-new Date(p.last_seen)<12e4?" live":""}">${Date.now()-new Date(p.last_seen)<12e4?"🟢 فاتح هسه":"آخر دخول: "+ago(p.last_seen)}</span>`:""}</div></div>${extra}</td><td>${tg}</td>
      <td class="num">${esc(p.broker_account||"—")}</td><td class="num">${esc(p.phone||"—")}</td><td>${esc(p.country||"—")}</td><td>${dateAr(p.created_at)}</td>
      <td>${badge(p)}${p.note?`<div class="label" style="white-space:normal;max-width:180px">${esc(p.note)}</div>`:""}</td><td>${acts}</td></tr>`}).join("")
    ||`<tr><td colspan="8" class="label">لا يوجد أعضاء بهذي القائمة.</td></tr>`;
}
$("admTabs").addEventListener("click",e=>{const b=e.target.closest("[data-at]");if(!b)return;ADM.tab=b.dataset.at;renderAdmin()});
$("admRows").addEventListener("click",async e=>{const me=e.target.closest("[data-medit]");if(me){memberEdit(ADM.rows.find(x=>x.id===me.dataset.medit));return}
  const mg=e.target.closest("[data-mgift]");if(mg){memberGift(ADM.rows.find(x=>x.id===mg.dataset.mgift));return}
  const et=e.target.closest("[data-etg]");if(et){const p=ADM.rows.find(x=>x.id===et.dataset.etg);
    const v=prompt("يوزر تيليجرام الصحيح للعضو:",p.telegram||"");if(v==null)return;const t=normTg(v),er=tgProblem(t);if(er){alert(er);return}
    try{await DB.saveProfile(p.id,{telegram:t});await loadAdmin()}catch(err){alert(err.message)}return}
  const b=e.target.closest("[data-act]");if(!b)return;
  const id=b.dataset.id,note=($("note-"+id)?.value||"").trim();
  if(b.dataset.act==="rejected"&&!note){$("note-"+id).focus();$("note-"+id).placeholder="اكتب السبب أولاً";return}
  b.disabled=true;try{await DB.setStatus(id,b.dataset.act,note);await loadAdmin()}catch(err){alert(err.message);b.disabled=false}});
$("admRefresh").addEventListener("click",loadAdmin);


/* ================= rewards & notifications ================= */
const RW={info:{},refs:null};
const refLink=code=>location.href.split(/[?#]/)[0]+"?ref="+encodeURIComponent(code||"");
const myCode=()=>ME.profile&&(ME.profile.ref_code||(ME.profile.telegram||"").replace(/^@/,""));
function shareMsg(link){return`👑 منصة فيكسورا للتداول | كوتش عمر

📈 توصيات الذهب والفوركس والكريبتو يومياً بالتحليل الفني والكلاسيكي والموجي والزمني والرقمي
🎓 أكاديمية كاملة: دورات ودروس زوم مباشرة
📲 قناة توصيات خاصة على تيليجرام

🎁 مميزات التسجيل ويا وكالة فيكسورا على INFINOX:
• حجم السبريد من 22 إلى 27
• كاش باك على تداولك الشخصي يوصل لـ 7$
• بونص 100% على الإيداع

✅ كلها مجانية لعملاء الوكالة
سجّل من رابطي 👇
${link}`}
const shareBtns=(text,link)=>`<a class="btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text.replace(link,"").trim())}">✈️ تيليجرام</a><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">💬 واتساب</a>`;
async function copyTxt(t,btn){try{await navigator.clipboard.writeText(t)}catch(e){const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}if(btn){const o=btn.textContent;btn.textContent="✓ انسخ";setTimeout(()=>btn.textContent=o,1500)}}
const ST_RW={new:["سجّل بس",""],pending:["بانتظار التفعيل","acc"],approved:["مفعّل ✓","buy"],rejected:["مرفوض","sell"]};
async function loadRewards(){
  const code=myCode(),link=refLink(code);
  let R={code,signed:0,pending:0,approved:0,points:0,list:[]},ev=[],board=[];
  try{const [a,b,c,i]=await Promise.all([DB.myRefs().catch(()=>null),DB.events().catch(()=>[]),DB.leaderboard().catch(()=>[]),DB.info().catch(()=>({}))]);if(a)R=a;ev=b||[];board=c||[];RW.info=i||{}}catch(e){}
  const L=refLink(R.code||code),goal=10,pct=Math.min(100,Math.round(R.approved/goal*100));
  $("rwLink").innerHTML=`<h3>🔗 رابط دعوتك الخاص</h3><div class="rw-link"><input class="ltr" readonly value="${esc(L)}" id="rwL"><button class="btn primary" type="button" id="rwCopy">نسخ</button></div>
    <div class="rw-share">${shareBtns(shareMsg(L),L)}</div>
    <div class="rw-stats"><div><b>${R.signed}</b><span>سجّلوا</span></div><div><b class="gold">${R.pending}</b><span>بانتظار التفعيل</span></div><div><b class="up">${R.approved}</b><span>تفعّلوا</span></div><div><b class="gold">${R.points}</b><span>نقاطك</span></div></div>
    <div style="margin-top:14px;font-size:14px"><b>🎓 كورس مجاني:</b> <span class="num">${Math.min(R.approved,goal)} / ${goal}</span> <span class="label">مفعّلين</span></div>
    <div class="rw-bar"><i style="width:${pct}%"></i></div>
    <div class="label" style="font-size:12.5px">${R.approved>=goal?"🏆 مبروك! وصلت الهدف، الكوتش راح يفتحلك الكورس.":`باقي ${goal-R.approved} حتى تربح الكورس`}</div>`;
  $("rwCopy").onclick=e=>copyTxt(L,e.target);
  $("rwMine").innerHTML=R.list.length?`<table class="rw-tb"><tbody>${R.list.map(x=>`<tr><td>${esc(x.name)}</td><td><span class="chip ${(ST_RW[x.status]||ST_RW.new)[1]}">${(ST_RW[x.status]||ST_RW.new)[0]}</span></td><td class="label">${new Date(x.created_at).toLocaleDateString(window.LANG||"ar",{day:"numeric",month:"short"})}</td></tr>`).join("")}</tbody></table>`
    :`<p class="label" style="margin:0">بعد ما أحد سجّل من رابطك. انسخ الرابط أو الرسالة الجاهزة وانشرها.</p>`;
  $("rwBoard").innerHTML=board.length?`<table class="rw-tb"><thead><tr><th>#</th><th>العضو</th><th>مفعّلين</th><th>النقاط</th></tr></thead><tbody>${board.map((x,i)=>`<tr class="${x.is_me?"me":""}"><td class="num gold">${["🥇","🥈","🥉"][i]||i+1}</td><td>${esc(x.name)}${x.is_me?' <span class="chip acc">أنت</span>':""}</td><td class="num">${x.approved}</td><td class="num gold">${x.points}</td></tr>`).join("")}</tbody></table>`
    :`<p class="label" style="margin:0">المسابقة بدت هذا الشهر. كون أول واحد بالترتيب!</p>`;
  const KN={contest:"🏆 مسابقة",event:"📣 فعالية",offer:"🎁 عرض"},adm=isAdminUser();
  $("rwEvents").innerHTML=ev.length?`<div class="rw-ev">${ev.map(x=>`<article><span class="chip acc" style="justify-self:start">${KN[x.kind]||KN.event}</span><b>${esc(x.title)}</b>${x.body?`<p>${esc(x.body)}</p>`:""}${x.prize?`<div style="font-size:13.5px">🎁 <b class="gold">الجائزة:</b> ${esc(x.prize)}</div>`:""}${x.ends_at?`<div class="label" style="font-size:12.5px">⏳ تنتهي ${new Date(x.ends_at).toLocaleDateString(window.LANG||"ar",{day:"numeric",month:"long"})}</div>`:""}${adm?`<button class="btn" type="button" data-delev="${x.id}" style="justify-self:start">حذف</button>`:""}${x.kind==="contest"?`<a class="btn v2s" href="#comp/${x.id}" style="justify-self:start;text-decoration:none">🏆 التفاصيل والاشتراك ←</a>`:""}</article>`).join("")}</div>`
    :`<p class="label" style="margin:0">ما في مسابقات حالياً. تابع الإشعارات 🔔 حتى توصلك أول ما تنزل.</p>`;
  const msg=shareMsg(L);$("rwMsgT").value=msg;
  $("rwMsgB").innerHTML=`<button class="btn primary" type="button" id="rwMsgC">نسخ الرسالة</button>`+shareBtns(msg,L);
  $("rwMsgC").onclick=e=>copyTxt(msg,e.target);
  const I=RW.info,tgw=`https://t.me/${CONFIG.SUPPORT_TG}?text=${encodeURIComponent("مرحبا كوتش، أريد أصير موزع (شريك) لوكالة فيكسورا.")}`;
  $("rwDist").innerHTML=`<h3>💼 صير موزع (شريك) ويانا</h3><p style="margin:0 0 10px;line-height:1.8;color:#d6d6dc">${esc(I.dist_text||"")}</p>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-radius:14px;background:rgba(212,175,55,.10);border:1px solid rgba(212,175,55,.35)"><span style="font-size:14px">💰 <b>نسبة الموزع:</b> <b class="gold num">${esc(I.dist_share||"")}</b>${I.dist_share?"":'<span class="label">تتحدد حسب حجم تداول عملائك</span>'}</span><a class="btn primary" style="text-decoration:none;margin-inline-start:auto" href="${tgw}" target="_blank" rel="noopener">أريد أصير موزع</a></div>`;
  if(adm)renderRwAdmin();
}
function renderRwAdmin(){const I=RW.info;
  $("rwAdmin").innerHTML=`<h3>⚙️ إدارة الهدايا (تطلع إلك بس)</h3><div class="rw-grid">
    <form class="fm" id="nfForm"><b>📣 إشعار لكل الأعضاء</b><label>العنوان<input id="nfT" required maxlength="120"></label><label>التفاصيل<textarea id="nfB" maxlength="400"></textarea></label><label>رابط (اختياري)<input id="nfL" class="ltr" placeholder="app.html#rewards"></label><label class="v2-tg" style="border:0;padding:4px 0"><span>📧 أرسله إيميل هم<small>كل عضو يوصله مرة وحدة</small></span><span class="v2-sw"><input type="checkbox" id="nfMail"><i></i></span></label><select id="nfAud"><option value="approved">للأعضاء المفعّلين بس</option><option value="all">لكل المسجّلين</option></select><button class="btn primary" type="submit">إرسال الإشعار</button><p class="msg" id="nfM"></p></form>
    <form class="fm" id="evForm"><b>🏆 مسابقة أو فعالية جديدة</b><label>النوع<select id="evK"><option value="contest">🏆 مسابقة</option><option value="event">📣 فعالية</option><option value="offer">🎁 عرض</option></select></label><label>العنوان<input id="evT" required maxlength="120"></label><label>التفاصيل<textarea id="evB" maxlength="800"></textarea></label><label>الجائزة<input id="evP" maxlength="160"></label><label>تنتهي بتاريخ<input id="evE" type="date"></label><button class="btn primary" type="submit">نشر (ويوصل إشعار للكل)</button><p class="msg" id="evM"></p></form>
    <form class="fm" id="dsForm"><b>💼 برنامج الموزعين</b><label>نسبة الموزع<input id="dsS" value="${esc(I.dist_share||"")}" placeholder="مثلاً: 50% من عمولة الوكالة"></label><label>الشرح<textarea id="dsT" style="min-height:140px">${esc(I.dist_text||"")}</textarea></label><button class="btn primary" type="submit">حفظ</button><p class="msg" id="dsM"></p></form></div>`;
  $("nfForm").onsubmit=async e=>{e.preventDefault();const T=$("nfT").value.trim(),B=$("nfB").value.trim(),L=$("nfL").value.trim(),em=$("nfMail").checked,aud=$("nfAud").value;
    if(em&&!confirm(aud==="all"?"ينرسل إيميل لكل المسجّلين. متأكد؟":"ينرسل إيميل لكل الأعضاء المفعّلين. متأكد؟"))return;
    try{await DB.addNotif({title:T,body:B,link:L,icon:"📣"});let msg="✓ انرسل الإشعار";if(em){const n=await DB.broadcastMail(T,B,L,aud);msg+=` و ${n} إيميل`}say("nfM",msg,true);e.target.reset();loadBell()}catch(err){say("nfM",err.message)}};
  $("evForm").onsubmit=async e=>{e.preventDefault();const d=$("evE").value;try{await DB.addEvent({kind:$("evK").value,title:$("evT").value.trim(),body:$("evB").value.trim(),prize:$("evP").value.trim(),ends_at:d?new Date(d+"T23:59:00").toISOString():null});say("evM","✓ انتشرت",true);loadRewards();loadBell()}catch(err){say("evM",err.message)}};
  $("dsForm").onsubmit=async e=>{e.preventDefault();try{await DB.setInfo({dist_share:$("dsS").value.trim(),dist_text:$("dsT").value.trim()});say("dsM","✓ انحفظ",true);loadRewards()}catch(err){say("dsM",err.message)}};
}
document.addEventListener("click",async e=>{const d=e.target.closest("[data-delev]");if(!d)return;if(!confirm("تحذف هذي المسابقة؟"))return;try{await DB.delEvent(+d.dataset.delev);loadRewards()}catch(err){alert(err.message)}});
/* bell */
const seenKey=()=>"albasha_seen_"+(ME.user&&ME.user.id);
let BELL=[];
async function loadBell(){if(!ME.user)return;try{BELL=await DB.notifs()||[]}catch(e){BELL=[]}
  let seen=0;try{seen=+localStorage.getItem(seenKey())||0}catch(e){}
  const n=BELL.filter(x=>new Date(x.created_at).getTime()>seen).length;$("bellN").hidden=!n;$("bellN").textContent=n>9?"9+":n;
  renderBell(seen)}
function renderBell(seen){
  $("bellMenu").innerHTML=`<div class="nh"><span>🔔 الإشعارات</span><span style="display:flex;gap:10px"><a class="gold" style="font-size:12.5px;font-weight:400" href="#inbox" data-go="inbox">📬 كل الرسائل</a><a class="gold" style="font-size:12.5px;font-weight:400" href="#rewards" data-go="rewards">🎁 الهدايا</a></span></div><div class="bpush" id="bellPush"></div>`+
    (BELL.length?BELL.map(x=>{const t=new Date(x.created_at);return`<a class="ni${t.getTime()>seen?" new":""}" href="${esc(x.link||"#rewards")}"><i>${esc(x.icon||"🔔")}</i><span><b>${esc(x.title)}</b>${x.body?`<small>${esc(x.body)}</small>`:""}<small class="num">${t.toLocaleString(window.LANG||"ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</small></span></a>`}).join("")
      :`<div class="ne">ما عندك إشعارات بعد</div>`)}
$("bellBtn").addEventListener("click",e=>{e.stopPropagation();const m=$("bellMenu");m.hidden=!m.hidden;$("userMenu").hidden=true;
  if(!m.hidden){let seen=0;try{seen=+localStorage.getItem(seenKey())||0;localStorage.setItem(seenKey(),String(Date.now()))}catch(e){}renderBell(seen);bellPushRow();$("bellN").hidden=true}});
document.addEventListener("click",e=>{if(!e.target.closest(".bell-w"))$("bellMenu").hidden=true;const a=e.target.closest("#bellMenu .ni");if(a){$("bellMenu").hidden=true;const h=a.getAttribute("href")||"";if(h.startsWith("#")){e.preventDefault();location.hash=h.slice(1);showView()}else if(h.startsWith("app.html#")){e.preventDefault();location.hash=h.split("#")[1];showView()}}});
setInterval(()=>{if(!$("app").hidden)loadBell()},120000);


/* ================= admin: edit member & gift course ================= */
let COURSES=null;
const mdlOpen=h=>{$("mdlC").innerHTML=h;$("mdl").hidden=false};
const mdlClose=()=>{$("mdl").hidden=true;$("mdlC").innerHTML=""};
$("mdl").addEventListener("click",e=>{if(e.target.id==="mdl"||e.target.closest("[data-mclose]"))mdlClose()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("mdl").hidden)mdlClose()});
function memberEdit(p){
  const copts=$("obCountry").innerHTML;
  mdlOpen(`<h3>✏️ تعديل بيانات العضو</h3><p class="label" style="margin:0">${esc(p.email||"")}</p>
    <form class="fm" id="meForm">
      <div class="avpick"><span id="meAv">${avHTML(p,"lg")}</span><div style="display:grid;gap:4px"><label class="btn" for="meFile" style="display:inline-block;color:var(--fg)">📷 إضافة أو تغيير الصورة</label><input id="meFile" type="file" accept="image/*" hidden></div></div>
      <label>الاسم الكامل<input id="meName" value="${esc(p.full_name||"")}"></label>
      <label>يوزر تيليجرام<input id="meTg" class="ltr" value="${esc(p.telegram||"")}" placeholder="@username"></label>
      <label>رقم الهاتف<input id="mePh" class="ltr" value="${esc(p.phone||"")}"></label>
      <label>الدولة<select id="meCo">${copts}</select></label>
      <label>رقم الحساب بـ ${esc(CONFIG.BROKER_NAME)}<input id="meAcc" class="ltr" value="${esc(p.broker_account||"")}"></label>
      ${p.status!=="approved"?`<label class="chk"><input type="checkbox" id="meAp"> <span>فعّله مباشرة بعد الحفظ</span></label>`:""}
      <button class="btn primary" type="submit">حفظ</button><p class="msg" id="meMsg"></p></form>`);
  setCountry("meCo",p.country);
  let meBlob=null;$("meFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;
    try{meBlob=await squareJpeg(f);$("meAv").innerHTML=`<img class="av lg" src="${URL.createObjectURL(meBlob)}" alt="">`}
    catch(err){if(f.size<12e6&&(/^image\//.test(f.type)||/\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))){meBlob=f;$("meAv").innerHTML='<span class="av lg">✓</span>'}else say("meMsg",err.message)}};
  $("meForm").onsubmit=async e=>{e.preventDefault();
    const f={full_name:$("meName").value.trim(),telegram:normTg($("meTg").value),phone:$("mePh").value.trim(),country:$("meCo").value,broker_account:$("meAcc").value.trim()};
    if(f.telegram){const er=tgProblem(f.telegram);if(er)return say("meMsg",er)}
    try{say("meMsg","جاري الحفظ…",true);
      if(meBlob){try{f.avatar_url=await DB.uploadAvatar(p.id,meBlob)}catch(err){return say("meMsg","ما گدرنا نرفع الصورة: "+err.message+" (شغّل photo_admin.sql)")}}
      await DB.saveProfile(p.id,f);
      if($("meAp")&&$("meAp").checked)await DB.setStatus(p.id,"approved","");
      mdlClose();await loadAdmin()}catch(err){say("meMsg",err.message)}};
}
async function memberGift(p){
  mdlOpen(`<h3>🎁 إهداء كورس</h3><p class="label" style="margin:0">${esc(p.full_name||p.email||"")}</p><div id="mgBody"><p class="label">جاري التحميل…</p></div>`);
  try{if(!COURSES)COURSES=await DB.courses()||[]}catch(e){COURSES=[]}
  const cname=id=>{const c=COURSES.find(x=>x.id===id);return c?`${c.icon||"📘"} ${c.title}`:id};
  const render=async()=>{let acc=[];try{acc=await DB.access(p.id)||[]}catch(e){}
    $("mgBody").innerHTML=`<div class="acc-l">${acc.length?acc.map(a=>`<div><span>${a.kind==="ai"?`🤖 اشتراك المساعد · لحد <span class="num">${new Date(a.expires_at).toLocaleDateString(window.LANG||"ar")}</span>`:a.kind==="monthly"?`⭐ كل الدورات · لحد <span class="num">${new Date(a.expires_at).toLocaleDateString(window.LANG||"ar")}</span>`:esc(cname(a.course_id))}</span><button class="btn" type="button" data-mrev="${a.id}" title="سحب الصلاحية">✕</button></div>`).join(""):'<span class="label">ما عنده دورات مفتوحة بعد.</span>'}</div>
      <form class="fm" id="mgForm"><label>شنو تهديه؟<select id="mgW"><option value="all">⭐ كل الدورات + الزوم</option><option value="ai">🤖 اشتراك المساعد</option>${COURSES.map(c=>`<option value="c:${esc(c.id)}">${esc(c.icon||"")} ${esc(c.title)}</option>`).join("")}</select></label>
        <label id="mgDL">المدة<select id="mgD"><option value="30">شهر</option><option value="90">3 أشهر</option><option value="180">6 أشهر</option><option value="365">سنة</option><option value="0">دائم</option></select></label>
        <button class="btn primary" type="submit">🎁 إهداء</button><p class="msg" id="mgMsg"></p><p class="label" style="margin:0;font-size:12.5px">الدورة تنفتح له فوراً، ويوصله إشعار وإيميل.</p></form>`;
    $("mgW").onchange=()=>{$("mgDL").hidden=!["all","ai"].includes($("mgW").value)};
    $("mgForm").onsubmit=async e=>{e.preventDefault();const w=$("mgW").value;try{say("mgMsg","لحظة…",true);
      if(w==="all"||w==="ai")await DB.grant(p.id,w,null,+$("mgD").value);else await DB.grant(p.id,"course",w.slice(2));
      await render();say("mgMsg","✅ انفتحت الصلاحية للطالب",true)}catch(err){say("mgMsg",err.message)}};
    $("mgBody").querySelectorAll("[data-mrev]").forEach(b=>b.onclick=async()=>{if(!confirm("تسحب هذي الصلاحية من الطالب؟"))return;try{await DB.revoke(+b.dataset.mrev);await render()}catch(err){alert(err.message)}});
  };
  render();
}


/* ================= chart page + AI assistant ================= */
const TVSYM={"XAU/USD":"OANDA:XAUUSD","EUR/USD":"OANDA:EURUSD","GBP/USD":"OANDA:GBPUSD","USD/JPY":"OANDA:USDJPY","AUD/USD":"OANDA:AUDUSD","USD/CAD":"OANDA:USDCAD","USD/CHF":"OANDA:USDCHF","GBP/JPY":"OANDA:GBPJPY","XAG/USD":"OANDA:XAGUSD","BTC/USD":"BITSTAMP:BTCUSD","ETH/USD":"BITSTAMP:ETHUSD"};
const TVINT={M5:"5",M15:"15",M30:"30",H1:"60",H4:"240",D1:"D"};
const TVLOC={ar:"ar_AE",en:"en",fr:"fr",de:"de_DE"};
let TV={key:"",loading:null};
function loadTV(){if(window.TradingView)return Promise.resolve();if(TV.loading)return TV.loading;
  TV.loading=new Promise((ok,bad)=>{const s=document.createElement("script");s.src="https://s3.tradingview.com/tv.js";s.async=true;s.onload=ok;s.onerror=()=>{TV.loading=null;bad(new Error("ما گدرنا نحمّل شارت TradingView. تأكد من الإنترنت وجرّب مرة ثانية."))};document.head.appendChild(s)});return TV.loading}
async function mountTV(force){
  const k=S.sym.s+"|"+S.tf+"|"+(window.LANG||"ar");if(!force&&TV.key===k&&$("tvBox").querySelector("iframe"))return;TV.key=k;
  try{await loadTV()}catch(e){$("tvBox").innerHTML=`<p class="msg err" style="padding:20px">${esc(e.message)}</p>`;return}
  $("tvBox").innerHTML="";
  new TradingView.widget({container_id:"tvBox",autosize:true,symbol:TVSYM[S.sym.s]||"OANDA:XAUUSD",interval:TVINT[S.tf]||"60",timezone:"Asia/Baghdad",theme:"dark",style:"1",
    locale:TVLOC[window.LANG]||"ar_AE",toolbar_bg:"#0b0b0d",enable_publishing:false,allow_symbol_change:true,hide_side_toolbar:false,withdateranges:true,details:true,save_image:true,
    studies:["MAExp@tv-basicstudies","RSI@tv-basicstudies"]});
}
function chartPage(){
  const sel=$("cvSym");if(!sel.options.length)sel.innerHTML=SYMS.map(x=>`<option value="${esc(x.s)}">${esc(x.n)} · ${esc(x.s)}</option>`).join("");
  sel.value=S.sym.s;mountTV();aiQuota();
  if(!$("cvChips").innerHTML){const Q=["شلون أشوف الاتجاه هسه؟","وين أهم الدعوم والمقاومات؟","اشرحلي الصفقة الحالية","شنو عدّ الموجات؟","وين أرسم الفيبوناتشي؟","شنو يكول التحليل الزمني؟"];
    $("cvChips").innerHTML=Q.map(q=>`<button type="button" data-cvq="${esc(q)}">${esc(q)}</button>`).join("");
    if(!$("cvMsgs").children.length)cvAdd("a",`أهلاً ${esc((ME.profile&&ME.profile.full_name||"").split(" ")[0])} 👋<br>أنا مساعد فيكسورا. أقرا تحليل المنصة لـ <b>${esc(S.sym.n)}</b> على فريم <b>${esc(S.tf)}</b> وأشرحلك. اختار سؤال من فوق أو اكتب سؤالك.`)}
}
$("cvSym").addEventListener("change",e=>{pick(e.target.value);setTimeout(()=>mountTV(true),50)});
function aiContext(){const A=S.A,f=v=>v==null||!isFinite(v)?null:+(+v).toFixed(S.sym.dec);
  const lc=S.candles&&S.candles.at(-1),ageM=lc?Math.round((Date.now()/1000-lc.time)/60):null,stale=ageM!=null&&ageM>TFS[S.tf].s/60*3;const base={symbol:S.sym.s,name:S.sym.n,timeframe:S.tf,source:S.src==="sim"?"simulated prices (demo)":S.src,data_as_of:lc?new Date(lc.time*1000).toISOString():null,data_age_minutes:ageM,data_warning:S.src==="sim"?"These are SIMULATED demo prices, not the real market. Say so clearly at the start of the answer.":stale?`The last candle is ${ageM} minutes old (market closed or delayed data). Say clearly at the start that prices may be outdated and the analysis is not for live entry.`:null};
  if(!A)return{...base,note:"analysis not ready"};
  const sch={};for(const k in A.M){const m=A.M[k];sch[NAMES[k]||k]={score:Math.round(m.s),points:(m.items||[]).map(x=>x.t).slice(0,7),info:(m.kv||[]).map(([a,b])=>a+": "+b)}}
  const zones=(A.M.cls.zones||[]).slice(0,8).map(z=>({from:f(z.lo),to:f(z.hi),touches:z.n,type:z.mid<A.px?"support":"resistance"}));
  const fb=A.M.wav.fib,p=S.plan;
  const plan=p?{side:p.sl<p.lo?"buy":"sell",type:p.type,entry_zone:[f(p.lo),f(p.hi)],stop_loss:f(p.sl),targets:(p.tps||[]).map(t=>f(t.p)),reasons:p.srcs||p.with||undefined}:null;
  const mtf={};for(const tf of MTFK){const r=S.mtf[tf];if(r&&!r.na)mtf[tf]={score:r.s,structure:r.struct}}
  return{...base,price:f(A.px),atr:f(A.atr),total_score:A.total,entry_score:S.pct??undefined,signal:plan,alt_buy:S.altB?{entry:[f(S.altB.lo),f(S.altB.hi)],sl:f(S.altB.sl)}:null,alt_sell:S.altS?{entry:[f(S.altS.lo),f(S.altS.hi)],sl:f(S.altS.sl)}:null,
    zones,fibonacci:fb?{from:f(fb.start),to:f(fb.end),direction:fb.up?"up":"down"}:null,timeframes:mtf,schools:sch}}
function mdLite(t){const L=esc(t).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").split(/\n/);let h="",ul=false;
  for(const l of L){const m=l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);if(m){if(!ul){h+="<ul>";ul=true}h+=`<li>${m[1]}</li>`;continue}if(ul){h+="</ul>";ul=false}
    const hd=l.match(/^\s*#{1,4}\s*(.*)/);h+=hd?`<b>${hd[1]}</b><br>`:(l.trim()?l+"<br>":"")}
  return h+(ul?"</ul>":"")}
function cvAdd(who,html,cls=""){const d=document.createElement("div");d.className=`cv-m ${who} ${cls}`;d.innerHTML=html;$("cvMsgs").appendChild(d);$("cvMsgs").scrollTop=1e9;return d}

let AIST=null;
async function aiQuota(){try{AIST=await DB.aiStatus()}catch(e){AIST=null}const q=$("cvQuota");if(!AIST){q.innerHTML="";return}
  const left=Math.max(0,AIST.limit-AIST.used),pr=`${AIST.currency||"$"}${AIST.price}`;
  if(!AIST.member){q.innerHTML=`<span>🔒 المساعد للأعضاء المفعّلين بس</span>`;return}
  q.innerHTML=AIST.sub?`<span>⭐ مشترك بالمساعد${AIST.until?` لحد <b class="num">${new Date(AIST.until).toLocaleDateString(window.LANG||"ar",{day:"numeric",month:"short"})}</b>`:""}</span><span>باقي اليوم: <b class="num">${left}</b></span>`
    :`<span>🎁 سؤال مجاني باليوم · باقي: <b class="num">${left}</b></span>${AIST.pending?'<span class="chip acc">⏳ اشتراكك بانتظار التفعيل</span>':`<a class="btn primary" href="index.html#buy-ai">اشترك ${pr} / شهر</a>`}`}
function cvSubCard(){const pr=AIST?`${AIST.currency||"$"}${AIST.price}`:"";
  return`<div class="cv-sub"><b>🎁 خلص سؤالك المجاني اليوم</b><span>اشترك بمساعد الذكاء الصناعي واسأل لحد ${AIST&&AIST.sub?"":"30"} سؤال باليوم${pr?` بـ <b class="gold">${pr}</b> بالشهر`:""}.</span>${AIST&&AIST.pending?'<span class="chip acc">⏳ طلبك بانتظار التفعيل</span>':'<a class="btn primary" href="index.html#buy-ai">اشترك بالمساعد</a>'}<span class="label" style="font-size:12px">أو ارجع باچر لسؤالك المجاني.</span></div>`}
let cvBusy=false;
async function cvAsk(q){q=(q||"").trim();if(!q||cvBusy)return;cvBusy=true;$("cvSend").disabled=true;
  cvAdd("u",esc(q));const w=cvAdd("a",'<span class="cv-dots">يحلل</span>');
  try{const id=await DB.aiAsk(q,aiContext(),window.LANG||"ar");let r=null;
    for(let i=0;i<60;i++){await new Promise(z=>setTimeout(z,1500));r=await DB.aiResult(id);if(r&&r.status!=="pending")break}
    if(!r||r.status==="pending")throw new Error("المساعد ما رد. جرّب مرة ثانية.");
    if(r.status==="error"){w.classList.add("err");w.textContent=r.answer}else w.innerHTML=mdLite(r.answer)}
  catch(err){if(/AI_FREE_LIMIT/.test(err.message)){w.innerHTML=cvSubCard()}else{w.classList.add("err");w.textContent=err.message}}
  finally{cvBusy=false;$("cvSend").disabled=false;$("cvMsgs").scrollTop=1e9;aiQuota()}}
$("cvForm").addEventListener("submit",e=>{e.preventDefault();const q=$("cvQ").value;$("cvQ").value="";cvAsk(q)});
$("cvQ").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("cvForm").requestSubmit()}});
document.addEventListener("click",e=>{const b=e.target.closest("[data-cvq]");if(b)cvAsk(b.dataset.cvq)});


/* ================= admin settings page ================= */
const ST_KEYS=["pay_wallet","pay_network","currency","pay_info","price_monthly","price_zoom","price_ai","free_lessons","ib_link","support_tg","coach_name","coach_title","coach_bio","coach_tg","coach_channel","coach_email","coach_since","dist_share","dist_text","cert_signer"];
let stBlob=null,stCourses=[];
function stQR(){const w=$("s-pay_wallet").value.trim();$("sQR").innerHTML=w?`<img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=4&data=${encodeURIComponent(w)}" width="96" height="96" alt="QR"><span class="label" style="font-size:12.5px">هذا اللي يشوفه الطالب. تأكد إن العنوان صحيح حرف بحرف.</span>`:""}
async function settingsPage(){
  $("stMsg").textContent="";let I={};try{I=await DB.allInfo()||{}}catch(e){}
  ST_KEYS.forEach(k=>{const el=$("s-"+k);if(el)el.value=I[k]??(k==="pay_network"?"TRC20":"")});
  if(!I.ib_link)$("s-ib_link").value=CONFIG.BROKER_LINK;if(!I.support_tg)$("s-support_tg").value=CONFIG.SUPPORT_TG;
  $("sPh").src=I.coach_photo||"coach-sq.jpg";stBlob=null;stQR();
  try{stCourses=await DB.coursesFull()||[]}catch(e){stCourses=[]}
  $("sCourses").innerHTML=stCourses.map(c=>`<label><span>${esc(c.icon||"📘")} ${esc(c.title)}</span><input id="sc-${esc(c.id)}" type="number" min="0" class="ltr" value="${esc(c.price)}"></label>`).join("")||'<span class="label">ما في دورات بعد.</span>';
  loadAiCfg();loadEngine();loadMail();loadPushAdmin();
}
$("s-pay_wallet").addEventListener("input",stQR);
$("sPhF").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{stBlob=await squareJpeg(f);$("sPh").src=URL.createObjectURL(stBlob)}catch(err){say("stMsg",err.message)}});
$("stSave").addEventListener("click",async()=>{const b=$("stSave");b.disabled=true;say("stMsg","جاري الحفظ…",true);
  try{const o={};ST_KEYS.forEach(k=>{const el=$("s-"+k);if(el)o[k]=el.value.trim()});
    o.coach_tg=o.coach_tg.replace(/^@/,"");o.coach_channel=o.coach_channel.replace(/^@/,"");o.support_tg=o.support_tg.replace(/^@/,"");
    if(o.pay_wallet&&o.pay_network==="TRC20"&&!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(o.pay_wallet)){b.disabled=false;return say("stMsg","عنوان TRC20 لازم يبدي بـ T ويكون 34 حرف. تأكد منه.")}
    if(o.ib_link&&!/^https?:\/\//i.test(o.ib_link)){b.disabled=false;return say("stMsg","رابط الوكالة لازم يبدي بـ https://")}
    if(stBlob)o.coach_photo=await DB.uploadCoach(stBlob);
    await DB.setInfo(o);
    for(const c of stCourses){const v=+$("sc-"+c.id).value;if(v!==+c.price)await DB.setCourse(c.id,{price:v})}
    let k=$("aiKey").value.trim();if(k){const m=k.match(/sk-ant-[A-Za-z0-9_-]{20,}/);if(!m)throw new Error("المفتاح لازم يبدي بـ sk-ant-. انسخ المفتاح لحاله بزر Copy، مو مثال الكود");k=m[0];await DB.setConfig("anthropic_key",k,false);$("aiKey").value=""}
    await DB.setConfig("ai_daily",String(+$("aiDaily").value||30),false);await DB.setConfig("ai_free",String(Math.max(0,+$("aiFree").value||0)),false);await DB.setConfig("ai_model",$("aiModel").value.trim()||"claude-haiku-5-5",false);
    applyInfo(o);stBlob=null;say("stMsg","✓ انحفظت كل الإعدادات",true);loadAiCfg();try{stCourses=await DB.coursesFull()||[]}catch(e){}}
  catch(err){say("stMsg",err.message)}b.disabled=false});
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

let VAPID="";
const pushSave=(e,k,a,u)=>DB.pushSub(e,k,a,u),pushDel=e=>DB.pushUnsub(e);
async function bellPushRow(){const el=$("bellPush");if(!el)return;const st=await PUSH.state();
  el.innerHTML=st==="on"?`<span>✅ الإشعارات مفعّلة على هذا الجهاز</span><button type="button" data-bp="off">إيقاف</button>`
   :st==="off"?`<span>📲 خلي التوصيات توصلك على الموبايل</span><button type="button" class="go" data-bp="on">فعّل</button>`
   :st==="ios"?`<span>📲 بالآيفون: مشاركة ⬆️ ← «إضافة إلى الشاشة الرئيسية»، وافتح فيكسورا من الأيقونة حتى تفعّل الإشعارات</span>`
   :st==="denied"?`<span>🔕 الإشعارات ممنوعة لهذا الموقع. فعّلها من إعدادات المتصفح</span>`:`<span>هذا المتصفح ما يدعم الإشعارات</span>`}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-bp]");if(!b)return;e.stopPropagation();b.disabled=true;
  try{if(b.dataset.bp==="on")await PUSH.enable(VAPID,pushSave);else await PUSH.disable(pushDel)}catch(err){alert(err.message)}bellPushRow()});
async function loadPushAdmin(){const el=$("puStat");if(!el)return;let m=null;try{m=await DB.pushStatus()}catch(e){}
  if(!m){el.className="en-stat bad";el.innerHTML='<span class="down">شغّل ملف push.sql وانشر الدالة albasha-push</span>';return}
  el.className="en-stat "+(m.ready&&!m.err?"ok":m.ready?"bad":"");
  el.innerHTML=(m.ready?(m.err?"🔴 آخر إرسال بيه مشكلة":"🟢 الإشعارات جاهزة"):"⏳ بانتظار الدالة albasha-push (انشرها وطفّي Verify JWT)")
   +` · أجهزة مشتركة: <b>${m.devices}</b> (${m.users} عضو) · انرسل آخر 24 ساعة: <b>${m.sent24}</b>`+(m.err?`<br><span class="down ltr" style="font-size:12px">${esc(String(m.err).slice(0,200))}</span>`:"")}

$("puMe").addEventListener("click",async()=>{try{await PUSH.enable(VAPID,pushSave);say("puMsg","✓ تفعّلت على هذا الجهاز",true);loadPushAdmin()}catch(err){say("puMsg",err.message)}});
$("puTest").addEventListener("click",async()=>{try{if((await PUSH.state())!=="on")throw new Error("فعّلها على جهازك أول");await DB.pushTest();say("puMsg","✓ انرسل. لازم يوصلك خلال ثواني",true);setTimeout(loadPushAdmin,8000)}catch(err){say("puMsg",err.message)}});

/* ===== email settings ===== */
async function loadMail(){let m=null;try{m=await DB.mailStatus()}catch(e){}
  const st=$("mlStat");if(!m){st.className="en-stat bad";st.innerHTML='<span class="down">شغّل ملف albasha_v3.sql أول</span>';return}
  $("mlKey").value="";$("mlKey").placeholder=m.key?"✓ المفتاح محفوظ (اكتب جديد حتى تغيّره)":"xkeysib-…";$("mlFrom").value=m.from||"";$("mlName").value=m.name||"";
  const L=m.last,bad=L&&(L.code>=400||!/messageId/.test(L.body||""));
  st.className="en-stat "+(m.key&&m.from&&!bad?"ok":m.key||m.from?"bad":"");
  st.innerHTML=(m.key&&m.from?(bad?"🔴 Brevo رفض آخر إيميل":"🟢 الإيميلات شغّالة"):"⚪ الإيميلات مطفية: ناقص "+[!m.key&&"المفتاح",!m.from&&"إيميل المرسل"].filter(Boolean).join(" و"))
    +` · انرسل باليوم: <b>${m.today}</b> · بالشهر: <b>${m.month}</b>`+(bad?`<br><span class="down ltr" style="font-size:12px">${esc((L.body||"").slice(0,200))}</span>`:"");
}
$("mlSave").addEventListener("click",async()=>{const b=$("mlSave");b.disabled=true;
  try{const k=$("mlKey").value.trim(),f=$("mlFrom").value.trim();
    if(k&&!/^xkeysib-/.test(k))throw new Error("مفتاح Brevo يبدي بـ xkeysib-. انسخه من Brevo ← SMTP & API ← API Keys");
    if(f&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f))throw new Error("إيميل المرسل مو صحيح");
    if(k)await DB.setConfig("brevo_key",k,false);await DB.setConfig("mail_from",f,false);await DB.setConfig("mail_name",$("mlName").value.trim()||"فيكسورا · VEXORA",false);
    say("mlMsg","✓ انحفظ",true);loadMail()}catch(err){say("mlMsg",err.message)}b.disabled=false});
$("mlTest").addEventListener("click",async()=>{const b=$("mlTest");b.disabled=true;
  try{const r=await DB.mailTest();if(!/^ok:/.test(r||""))throw new Error(r||"ما انرسل");
    say("mlMsg",`✓ انرسل لـ ${r.slice(3)}. شوف البريد (وإذا ما لكيته شوف Spam). بعد دقيقة النتيجة تطلع فوق.`,true);setTimeout(loadMail,20000)}
  catch(err){say("mlMsg",err.message)}b.disabled=false});

/* ===== server engine settings ===== */
async function loadEngine(){
  let c={};try{c=await DB.getConfig()}catch(e){}
  const on=c.server_scan==="1",set=new Set(String(c.scan_syms||"XAU/USD,EUR/USD,GBP/USD,USD/JPY").split(/[\s,]+/));
  $("enOn").checked=on;$("enCal").checked=c.cal_alerts!=="0";$("enPause").checked=c.news_pause!=="0";
  $("enSyms").innerHTML=SYMS.map(x=>`<label><input type="checkbox" value="${esc(x.s)}"${set.has(x.s)?" checked":""}> ${esc(x.s)} <span class="label">${esc(x.n)}</span></label>`).join("");
  $("enTf").innerHTML=["M5","M15","M30","H1","H4"].map(t=>`<option${(c.scan_tf||"H1")===t?" selected":""}>${t}</option>`).join("");
  $("enSum").value=c.sum_hour??"23";
  const last=c.engine_last?new Date(c.engine_last):null,age=last?(Date.now()-last)/6e4:1e9,st=$("enStat");
  const miss=[!c.twelve_key&&"مفتاح Twelve Data",!c.tg_token&&"توكن البوت",!c.tg_chat&&"قناة التوصيات"].filter(Boolean);
  st.className="en-stat "+(on&&age<35&&!c.engine_err?"ok":on?"bad":"");
  const blk=c.td_block_until&&Date.parse(c.td_block_until)>Date.now()?new Date(c.td_block_until):null;
  if(on&&blk){st.className="en-stat";st.innerHTML=`🟡 متوقف مؤقتاً: خلص رصيد Twelve Data لليوم (800 طلب). يرجع يشتغل لحاله الساعة <b>${blk.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</b>`+(last?` · آخر فحص ${last.toLocaleString("en-GB",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}`:"");SERVER_SCAN=on;return}
  st.innerHTML=(on?(last?`${age<35?"🟢 شغّال":"🔴 ما اشتغل من فترة"} · آخر فحص ${last.toLocaleString("en-GB",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}`:"⏳ بانتظار أول فحص (إذا ما نشرت الدالة albasha-engine بعد، انشرها)"):"⚪ السيرفر مطفي، التوصيات تنرسل بس من المتصفح وهو مفتوح")
    +(c.engine_err?`<br><span class="down">⚠️ ${esc(c.engine_err.length>300?c.engine_err.slice(0,300)+"…":c.engine_err)}</span>`:"")+(miss.length?`<br><span class="down">ناقص: ${miss.join("، ")} (من زر «الإعدادات» فوق)</span>`:"");
  SERVER_SCAN=on;
}
$("enSave").addEventListener("click",async()=>{const b=$("enSave");b.disabled=true;
  try{const syms=[...$("enSyms").querySelectorAll("input:checked")].map(x=>x.value);if(!syms.length)throw new Error("اختار سوق واحد على الأقل");
    if(syms.length>4)throw new Error("الحد 4 أسواق (حدود مفتاح Twelve Data المجاني: 800 طلب باليوم)");
    if($("enTf").value==="M5"&&syms.length>2)throw new Error("فريم M5 يفحص كل 5 دقايق، فالحد سوقين بس (حدود مفتاح Twelve Data المجاني)");
    const h=Math.round(+$("enSum").value);
    await DB.setConfig("scan_syms",syms.join(","),false);await DB.setConfig("scan_tf",$("enTf").value,false);
    await DB.setConfig("cal_alerts",$("enCal").checked?"1":"0",false);await DB.setConfig("news_pause",$("enPause").checked?"1":"0",true);
    await DB.setConfig("sum_hour",String(isFinite(h)?Math.max(-1,Math.min(23,h)):23),false);await DB.setConfig("server_scan",$("enOn").checked?"1":"0",false);
    say("enMsg","✓ انحفظ",true);loadEngine()}catch(err){say("enMsg",err.message)}b.disabled=false});
$("enRun").addEventListener("click",async()=>{const b=$("enRun");b.disabled=true;say("enMsg","جاري الفحص، ياخذ حوالي دقيقة…",true);
  try{await DB.engineRun();setTimeout(()=>{loadEngine();say("enMsg","✓ خلص. إذا أكو توصية جديدة راح توصل للقناة",true);b.disabled=false},60000)}catch(err){say("enMsg",err.message);b.disabled=false}});
/* ================= economic calendar ================= */
const ECON_AR=[["ADP Non-Farm", "وظائف ADP"],["Non-Farm Employment", "الوظائف غير الزراعية NFP"],["Unemployment Claims", "طلبات إعانة البطالة"],["Unemployment Rate", "نسبة البطالة"],["Average Hourly Earnings", "متوسط الأجور"],["JOLTS", "الوظائف الشاغرة JOLTS"],["Core PCE", "مؤشر PCE الأساسي"],["Core CPI", "التضخم الأساسي CPI"],["CPI", "التضخم CPI"],["Core PPI", "أسعار المنتجين الأساسية"],["PPI", "أسعار المنتجين PPI"],["Federal Funds Rate", "قرار الفائدة الأمريكية"],["FOMC Press Conference", "المؤتمر الصحفي للفيدرالي"],["FOMC Meeting Minutes", "محضر اجتماع الفيدرالي"],["FOMC Statement", "بيان الفيدرالي"],["FOMC Economic Projections", "توقعات الفيدرالي"],["Main Refinancing Rate", "قرار الفائدة الأوروبية"],["ECB Press Conference", "مؤتمر البنك المركزي الأوروبي"],["Official Bank Rate", "قرار فائدة بنك إنجلترا"],["BOJ Policy Rate", "قرار فائدة بنك اليابان"],["Policy Rate", "قرار الفائدة"],["Cash Rate", "قرار الفائدة"],["Overnight Rate", "قرار الفائدة"],["Speaks", "كلمة مسؤول"],["GDP", "الناتج المحلي GDP"],["Core Retail Sales", "مبيعات التجزئة الأساسية"],["Retail Sales", "مبيعات التجزئة"],["ISM Manufacturing PMI", "مؤشر ISM الصناعي"],["ISM Services PMI", "مؤشر ISM الخدمي"],["Manufacturing PMI", "PMI الصناعي"],["Services PMI", "PMI الخدمي"],["Consumer Sentiment", "ثقة المستهلك"],["Consumer Confidence", "ثقة المستهلك"],["Crude Oil Inventories", "مخزونات النفط"],["Bank Holiday", "عطلة رسمية"],["Trade Balance", "الميزان التجاري"],["Employment Change", "التغير في الوظائف"]];
const isAr=()=>(window.LANG||"ar")==="ar";
const econAr=t=>{if(!isAr())return"";const x=ECON_AR.find(([e])=>t.toLowerCase().includes(e.toLowerCase()));return x?x[1]:""};
const FLAG={USD:"🇺🇸",EUR:"🇪🇺",GBP:"🇬🇧",JPY:"🇯🇵",AUD:"🇦🇺",CAD:"🇨🇦",CHF:"🇨🇭",NZD:"🇳🇿",CNY:"🇨🇳"};
const IMPV={High:3,Medium:2,Low:1,Holiday:0};
const CAL={ev:[],at:0,imp:2,cc:new Set(["USD","EUR","GBP","JPY"]),t:null};
async function calLoad(force){if(!force&&Date.now()-CAL.at<6e5)return CAL.ev;
  try{CAL.ev=await DB.econ(new Date(Date.now()-7*864e5).toISOString(),new Date(Date.now()+8*864e5).toISOString())||[];CAL.at=Date.now()}catch(e){}return CAL.ev}
const calName=t=>{const a=econAr(t);return a?`${esc(a)}<small class="ltr">${esc(t)}</small>`:`<span class="ltr">${esc(t)}</span>`};
function untilTxt(ms){const m=Math.round(ms/6e4);if(m<60)return`${m} دقيقة`;const h=Math.floor(m/60);if(h<24)return`${h} ساعة و ${m%60} دقيقة`;return`${Math.floor(h/24)} يوم و ${h%24} ساعة`}
async function calPage(){$("calDays").innerHTML='<div class="panel label">جاري التحميل…</div>';await calLoad(true);renderCal();clearInterval(CAL.t);CAL.t=setInterval(()=>{if(!$("calView").hidden)renderCal();else clearInterval(CAL.t)},30000)}
function renderCal(){
  const all=CAL.ev,ccs=[...new Set(all.map(e=>e.country))].sort((a,b)=>(FLAG[b]?1:0)-(FLAG[a]?1:0)||a.localeCompare(b));
  $("calCc").innerHTML=ccs.map(c=>`<button type="button" data-cc="${esc(c)}" class="${CAL.cc.has(c)?"on":""}">${FLAG[c]||"🌐"} ${esc(c)}</button>`).join("");
  const now=Date.now(),list=all.filter(e=>CAL.cc.has(e.country)&&(IMPV[e.impact]??1)>=CAL.imp||(e.impact==="Holiday"&&CAL.cc.has(e.country)&&CAL.imp<=1));
  const nx=all.find(e=>e.impact==="High"&&CAL.cc.has(e.country)&&new Date(e.at)>now);
  $("calNext").innerHTML=nx?`<div><span class="label">🔴 الخبر القوي الجاي</span><div style="font-size:16px;margin-top:4px">${FLAG[nx.country]||"🌐"} <b>${esc(nx.country)}</b> · ${econAr(nx.title)?esc(econAr(nx.title)):`<span class="ltr">${esc(nx.title)}</span>`}</div><div class="label" style="font-size:12.5px">${new Date(nx.at).toLocaleString("en-GB",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div></div><div style="text-align:center"><span class="label">باقي</span><br><b class="cd">${untilTxt(new Date(nx.at)-now)}</b></div>`
    :`<span class="label">${all.length?(new Date().getDay()===6||new Date().getDay()===0?"عطلة نهاية الأسبوع: أخبار الأسبوع الجاي تنزل بالتقويم ليلة الأحد. تحت أخبار الأسبوع اللي فات.":"ما أكو أخبار قوية جاية بهذا الأسبوع للعملات المختارة."):"التقويم بعده ما تحمّل. إذا توّك شغّلت calendar.sql استنى 5 دقايق."}</span>`;
  const days={};list.forEach(e=>{const d=new Date(e.at),k=d.toLocaleDateString("en-CA");(days[k]=days[k]||[]).push(e)});
  const tk=new Date().toLocaleDateString("en-CA"),tm=new Date(now+864e5).toLocaleDateString("en-CA");
  $("calDays").innerHTML=Object.keys(days).sort().sort((a,b)=>nx?0:a<b?1:-1).map(k=>{const d=new Date(k+"T12:00:00");
    return`<div class="panel cal-day${k===tk?" today":""}"><h3>${d.toLocaleDateString(window.LANG||"ar",{weekday:"long",day:"numeric",month:"long"})}${k===tk?' <span class="chip acc tdy">اليوم</span>':k===tm?' <span class="chip tdy">باجر</span>':""}</h3>${days[k].map(e=>{const t=new Date(e.at),iv=IMPV[e.impact]??1;
      return`<div class="cal-r${t<now-30*6e4?" past":""}"><span class="tm">${t.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span><span class="cc">${FLAG[e.country]||"🌐"} <b>${esc(e.country)}</b></span><span class="imp ${iv>=3?"h":iv===2?"m":iv===1?"l":""}" title="${esc(e.impact)}"></span><span class="nm">${e.impact==="Holiday"?"🏖 "+calName(e.title):calName(e.title)}</span><span class="fp">${e.forecast||e.previous?`التوقع <b><bdi dir="ltr">${esc(e.forecast||"—")}</bdi></b> · السابق <bdi dir="ltr">${esc(e.previous||"—")}</bdi>`:""}</span></div>`}).join("")}</div>`}).join("")
    ||`<div class="panel rc-empty">ما أكو أخبار بهذا الفلتر.</div>`;
}
$("calImp").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;CAL.imp=+b.dataset.i;$("calImp").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));renderCal()});
$("calCc").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const c=b.dataset.cc;CAL.cc.has(c)?CAL.cc.delete(c):CAL.cc.add(c);renderCal()});
// تنبيه بالمنصة: خبر قوي قريب على السوق المفتوح
async function newsBar(){const el=$("newsBar");if(!el)return;await calLoad(false);
  const cur=S.sym.s.split("/"),now=Date.now(),e=CAL.ev.find(x=>x.impact==="High"&&cur.includes(x.country)&&new Date(x.at)>now-15*6e4&&new Date(x.at)<now+60*6e4);
  if(!e){el.hidden=true;return}const ms=new Date(e.at)-now,nm=econAr(e.title)||e.title;
  const mm=Math.round(ms/6e4);el.hidden=false;el.innerHTML=isAr()?`<span>⚠️ <b>${ms>0?`خبر قوي بعد ${untilTxt(ms)}`:"خبر قوي نزل هسه"}:</b> ${FLAG[e.country]||""} ${esc(nm)} (${esc(e.country)}). ${ms>0?"تجنب فتح صفقة جديدة قبله بـ 15 دقيقة.":"السوق متذبذب، استنى يهدأ."}</span>`
    :`<span class="ltr">⚠️ <b>${ms>0?`High-impact news in ${mm>=60?Math.floor(mm/60)+"h "+(mm%60)+"m":mm+" min"}`:"High-impact news just released"}:</b> ${FLAG[e.country]||""} ${esc(e.title)} (${esc(e.country)}). ${ms>0?"Avoid opening new trades in the 15 minutes before it.":"Volatile market, wait for it to settle."}</span>`;el.innerHTML+=`<a href="#calendar" data-go="calendar">📅 التقويم</a>`}
setInterval(()=>{if(!$("app").hidden)newsBar()},60000);

const IC3={"cap": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M24 11 7 19l17 8 17-8z\" fill=\"url(#g3g)\"/><path d=\"M24 11 7 19l17 8z\" fill=\"#fff6d2\" opacity=\".35\"/><path d=\"M14 22.5v7c0 2.6 4.5 5 10 5s10-2.4 10-5v-7l-10 4.7z\" fill=\"#26201a\" stroke=\"url(#g3b)\" stroke-width=\"1\"/><path d=\"M37 20v9\" stroke=\"#e9bf4f\" stroke-width=\"1.6\"/><circle cx=\"37\" cy=\"31\" r=\"2.2\" fill=\"url(#g3g)\"/></g></svg>", "candles": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><rect x=\"13.2\" y=\"12\" width=\"1.6\" height=\"24\" rx=\".8\" fill=\"#1fbf80\"/><rect x=\"10\" y=\"17\" width=\"8\" height=\"13\" rx=\"1.6\" fill=\"url(#g3gr)\"/><rect x=\"23.2\" y=\"9\" width=\"1.6\" height=\"26\" rx=\".8\" fill=\"#e5414f\"/><rect x=\"20\" y=\"13\" width=\"8\" height=\"15\" rx=\"1.6\" fill=\"url(#g3rd)\"/><rect x=\"33.2\" y=\"10\" width=\"1.6\" height=\"24\" rx=\".8\" fill=\"#1fbf80\"/><rect x=\"30\" y=\"14\" width=\"8\" height=\"17\" rx=\"1.6\" fill=\"url(#g3gr)\"/></g></svg>", "cam": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><rect x=\"8\" y=\"15\" width=\"22\" height=\"18\" rx=\"4\" fill=\"url(#g3g)\"/><path d=\"M30 21l10-5v16l-10-5z\" fill=\"url(#g3g)\"/><rect x=\"8\" y=\"15\" width=\"22\" height=\"6\" rx=\"4\" fill=\"#fff6d2\" opacity=\".4\"/><circle cx=\"14\" cy=\"21\" r=\"2.4\" fill=\"#e5414f\"/></g></svg>", "medal": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M16 8h6l3 9-5 2zM32 8h-6l-3 9 5 2z\" fill=\"#e5414f\"/><path d=\"M19 8h3l2.5 7.5-2.4 1z\" fill=\"#ff8d97\" opacity=\".6\"/><circle cx=\"24\" cy=\"28\" r=\"10\" fill=\"url(#g3g)\"/><circle cx=\"24\" cy=\"28\" r=\"7\" fill=\"none\" stroke=\"#9a6f12\" stroke-width=\"1.2\"/><path d=\"m24 22.6 1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z\" fill=\"#fff4cf\"/></g></svg>", "trophy": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M15 11h18v6.5c0 6-4 10-9 10s-9-4-9-10z\" fill=\"url(#g3g)\"/><path d=\"M15 13H9.5c0 5 2.6 8 6.6 8.4M33 13h5.5c0 5-2.6 8-6.6 8.4\" fill=\"none\" stroke=\"url(#g3g)\" stroke-width=\"2.4\"/><rect x=\"21.5\" y=\"27\" width=\"5\" height=\"5\" fill=\"#b98b22\"/><path d=\"M15 37h18l-2-5H17z\" fill=\"url(#g3g)\"/><path d=\"M18 13h3v8c-2-1-3-4-3-8z\" fill=\"#fff6d2\" opacity=\".6\"/></g></svg>", "bars": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M10 37V27l3-2.4h6L16 27v10z\" fill=\"#7a5810\"/><rect x=\"10\" y=\"27\" width=\"6\" height=\"10\" fill=\"url(#g3gs)\"/><path d=\"M10 27l3-2.4h6L16 27z\" fill=\"#fff0bd\"/><rect x=\"20\" y=\"20\" width=\"6\" height=\"17\" fill=\"url(#g3gs)\"/><path d=\"M20 20l3-2.4h6L26 20z\" fill=\"#fff0bd\"/><path d=\"M26 20l3-2.4V35L26 37z\" fill=\"#7a5810\"/><rect x=\"30\" y=\"12\" width=\"6\" height=\"25\" fill=\"url(#g3gs)\"/><path d=\"M30 12l3-2.4h6L36 12z\" fill=\"#fff0bd\"/><path d=\"M36 12l3-2.4V35L36 37z\" fill=\"#7a5810\"/></g></svg>", "line": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M9 34l9-10 7 5 12-15\" fill=\"none\" stroke=\"#5a3f08\" stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(0 1.2)\"/><path d=\"M9 34l9-10 7 5 12-15\" fill=\"none\" stroke=\"url(#g3g)\" stroke-width=\"3.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"9\" cy=\"34\" r=\"3.2\" fill=\"url(#g3g)\"/><circle cx=\"18\" cy=\"24\" r=\"3.2\" fill=\"url(#g3g)\"/><circle cx=\"25\" cy=\"29\" r=\"3.2\" fill=\"url(#g3g)\"/><circle cx=\"37\" cy=\"14\" r=\"3.6\" fill=\"#fff4cf\"/></g></svg>", "mega": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M10 21h6l16-8v22l-16-8h-6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z\" fill=\"url(#g3g)\"/><path d=\"M14 27l2.5 9h4.5L19 27z\" fill=\"#b98b22\"/><path d=\"M36 19a6 6 0 0 1 0 10\" stroke=\"#e9bf4f\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\"/></g></svg>", "user": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><circle cx=\"24\" cy=\"17\" r=\"7\" fill=\"url(#g3g)\"/><path d=\"M10 38c0-7.5 6.3-12 14-12s14 4.5 14 12z\" fill=\"url(#g3g)\"/><circle cx=\"21.5\" cy=\"14.5\" r=\"2.4\" fill=\"#fff6d2\" opacity=\".6\"/></g></svg>", "cal": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><rect x=\"10\" y=\"12\" width=\"28\" height=\"26\" rx=\"4\" fill=\"url(#g3iv)\"/><path d=\"M10 16a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v4H10z\" fill=\"#e5414f\"/><rect x=\"16\" y=\"9\" width=\"3\" height=\"7\" rx=\"1.5\" fill=\"url(#g3g)\"/><rect x=\"29\" y=\"9\" width=\"3\" height=\"7\" rx=\"1.5\" fill=\"url(#g3g)\"/><g fill=\"#8a8578\"><rect x=\"14\" y=\"24\" width=\"4\" height=\"3.4\" rx=\".8\"/><rect x=\"22\" y=\"24\" width=\"4\" height=\"3.4\" rx=\".8\"/><rect x=\"30\" y=\"24\" width=\"4\" height=\"3.4\" rx=\".8\"/><rect x=\"14\" y=\"30.5\" width=\"4\" height=\"3.4\" rx=\".8\"/><rect x=\"22\" y=\"30.5\" width=\"4\" height=\"3.4\" rx=\".8\" fill=\"#d4a93a\"/></g></g></svg>", "crown": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M9 33 7 15l9 7 8-11 8 11 9-7-2 18z\" fill=\"url(#g3g)\"/><path d=\"M9 33 7 15l9 7 8-11v22z\" fill=\"#fff6d2\" opacity=\".3\"/><rect x=\"9\" y=\"33\" width=\"30\" height=\"4.6\" rx=\"1.4\" fill=\"#b98b22\"/><circle cx=\"24\" cy=\"25\" r=\"2.8\" fill=\"#e5414f\"/><circle cx=\"7\" cy=\"14\" r=\"2.2\" fill=\"url(#g3g)\"/><circle cx=\"24\" cy=\"10\" r=\"2.2\" fill=\"url(#g3g)\"/><circle cx=\"41\" cy=\"14\" r=\"2.2\" fill=\"url(#g3g)\"/></g></svg>", "tools": "<svg class=\"ic3\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect class=\"t3\" x=\"2\" y=\"2\" width=\"44\" height=\"44\" rx=\"12\" fill=\"url(#g3t)\" stroke=\"url(#g3b)\" stroke-width=\"1.3\"/><path d=\"M8 4h32a8 8 0 0 1 6 6v6C30 13 18 13 2 18v-8a8 8 0 0 1 6-6z\" fill=\"url(#g3hl)\"/><g filter=\"url(#g3sh)\"><path d=\"M12 36 30 18\" stroke=\"#cfd3da\" stroke-width=\"4.2\" stroke-linecap=\"round\"/><path d=\"M30 18l3-3 4 1 1 4-3 3z\" fill=\"#e6e8ec\"/><path d=\"M12 36l3.5-3.5\" stroke=\"#e5414f\" stroke-width=\"5.2\" stroke-linecap=\"round\"/><path d=\"M36 36 19 19\" stroke=\"url(#g3gs)\" stroke-width=\"4.2\" stroke-linecap=\"round\"/><path d=\"M19.5 19.5a6 6 0 1 1-1.2-8.4l-3.4 3.4.6 3 3 .6 3.4-3.4a6 6 0 0 1-2.4 4.8z\" fill=\"url(#g3g)\"/></g></svg>"};
/* ===== لوحة المنصة: الترحيب والأرقام الحقيقية ===== */
async function dashTop(){const st=$("dStats");if(!st||$("terminalView").hidden||$("dStats").hidden)return;
  const nm=(ME.profile&&ME.profile.full_name||"").trim().split(/\s+/)[0];$("dHi").textContent="👋 هلا "+(nm||"بيك");
  let rows=[];try{rows=await DB.signals(30)||[]}catch(e){}
  const t=rcStats(rows.filter(r=>r.status!=="expired")),last=rows[0];let certs=0;try{certs=await DB.myCertCount()}catch(e){}
  const sg=v=>(v>0?"+":"")+v,ar=s=>({"XAU/USD":"الذهب","XAG/USD":"الفضة","BTC/USD":"البيتكوين"}[s]||s);
  st.innerHTML=[[IC3.trophy,t.rate==null?"—":t.rate+"%","نسبة النجاح (30 يوم)","record"],[IC3.bars,sg(t.pips),"صافي النقاط (30 يوم)","record"],[IC3.candles,t.open,"صفقات مفتوحة الآن","trades"],[IC3.medal,certs,"شهاداتك","index.html#certs"]]
    .map(([ic,b,l,h])=>`<a href="${h.includes(".")?h:"#"+h}"${h.includes(".")?"":` data-go="${h}"`}>${ic}<span><b><bdi dir="ltr">${esc(String(b))}</bdi></b><span>${l}</span></span></a>`).join("");
  let sub=[];if(last){const age=(Date.now()-new Date(last.sig_time))/36e5;if(age<24)sub.push(`آخر توصية: <b>${last.side==="buy"?"شراء":"بيع"} ${esc(ar(last.sym))}</b> ${age<1?"قبل شوية":"قبل "+Math.round(age)+" ساعة"}`)}
  try{await calLoad(false);const n=CAL.ev.find(x=>x.impact==="High"&&new Date(x.at)>Date.now());if(n)sub.push(`خبر قوي بعد <b>${untilTxt(new Date(n.at)-Date.now())}</b>`)}catch(e){}
  if(sub.length)$("dSub").innerHTML=sub.join(" · ");
}

/* ================= verified track record ================= */
const RC={d:30,sym:"",rows:[],at:0};
async function loadRecord(force){
  if(force||Date.now()-RC.at>6e4){$("rcRows").innerHTML=`<tr><td colspan="8" class="label">جاري التحميل…</td></tr>`;
    try{RC.rows=await DB.signals(120)||[];RC.at=Date.now()}catch(err){$("rcRows").innerHTML=`<tr><td colspan="8" class="down">${esc(err.message)}</td></tr>`;return}}
  const syms=[...new Set(RC.rows.map(r=>r.sym))].sort(),sel=$("rcSym");
  sel.innerHTML=`<option value="">كل الأسواق</option>`+syms.map(s=>`<option${s===RC.sym?" selected":""}>${esc(s)}</option>`).join("");
  const cta=$("rcCta");cta.hidden=!ME.locked;if(ME.locked)cta.innerHTML=`<span>هذي التوصيات توصل لأعضاء القناة أول بأول. انضم للبروكر من رابطنا حتى تتفعّل عندك المنصة والقناة.</span><a class="btn primary" href="${esc(CONFIG.BROKER_LINK)}" target="_blank" rel="noopener" style="text-decoration:none">افتح حسابك مع INFINOX</a>`;
  renderRecord();
}
function rcStats(list){const t={n:list.length,win:0,loss:0,open:0,pips:0};
  list.forEach(r=>{if(r.status==="win")t.win++;else if(r.status==="loss")t.loss++;else if(r.status==="open"||r.status==="pending")t.open++;if(r.pips!=null&&(r.status==="win"||r.status==="loss"))t.pips+=r.pips});
  t.rate=t.win+t.loss?Math.round(t.win/(t.win+t.loss)*100):null;return t}
function renderRecord(){
  const since=RC.d?Date.now()-RC.d*864e5:0;
  const list=RC.rows.filter(r=>r.status!=="expired"&&new Date(r.sig_time)>=since&&(!RC.sym||r.sym===RC.sym));
  const t=rcStats(list),sg=v=>(v>0?"+":"")+v;
  $("rcK").innerHTML=[["نسبة النجاح",t.rate==null?"—":t.rate+"%",t.rate==null?"":t.rate>=50?"up":"down"],["صافي النقاط",sg(t.pips),t.pips>0?"up":t.pips<0?"down":""],
    ["صفقات رابحة",t.win,"up"],["صفقات خاسرة",t.loss,"down"],["مفتوحة الآن",t.open,"gold"],["كل التوصيات",t.n,""]]
    .map(([l,v,c])=>`<div class="kp"><span>${l}</span><b class="${c}">${v}</b></div>`).join("");
  // منحنى النقاط التراكمي للصفقات المسكّرة
  const closed=list.filter(r=>(r.status==="win"||r.status==="loss")&&r.pips!=null).sort((a,b)=>a.sig_time<b.sig_time?-1:1);
  if(closed.length<2)$("rcCurve").innerHTML=`<div class="rc-empty">${closed.length?"يحتاج صفقتين مسكّرات على الأقل حتى يطلع المنحنى.":"لسه ما أكو صفقات مسكّرة بهذي الفترة."}</div>`;
  else{let c=0;const pts=[0,...closed.map(r=>c+=r.pips)],W=600,Hh=220,p=14,mn=Math.min(0,...pts),mx=Math.max(0,...pts),rg=mx-mn||1;
    const X=i=>p+i*(W-2*p)/(pts.length-1),Y=v=>Hh-p-(v-mn)*(Hh-2*p)/rg,d=pts.map((v,i)=>`${i?"L":"M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(""),end=pts.at(-1),col=end>=0?"var(--buy)":"var(--sell)";
    $("rcCurve").innerHTML=`<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="منحنى النقاط"><line x1="${p}" x2="${W-p}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)" stroke-dasharray="4 4"/><path d="${d}L${X(pts.length-1)},${Y(0)}L${X(0)},${Y(0)}Z" fill="${col}" opacity=".12"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg><div class="label" style="font-size:12px;display:flex;justify-content:space-between"><span>${closed.length} صفقة مسكّرة</span><b class="${end>=0?"up":"down"}">${sg(end)} نقطة</b></div>`}
  // حسب السوق
  const by={};list.forEach(r=>(by[r.sym]=by[r.sym]||[]).push(r));
  const bk=Object.keys(by).sort((a,b)=>by[b].length-by[a].length);
  $("rcBy").innerHTML=bk.length?`<table class="rc-by"><thead><tr><th>السوق</th><th>توصيات</th><th>النجاح</th><th>نقاط</th></tr></thead><tbody>${bk.map(s=>{const x=rcStats(by[s]);return`<tr><td class="ltr"><b>${esc(s)}</b></td><td>${x.n}</td><td>${x.rate==null?"—":x.rate+"%"}</td><td class="${x.pips>0?"up":x.pips<0?"down":""}">${sg(x.pips)}</td></tr>`}).join("")}</tbody></table>`:`<div class="rc-empty">ما أكو توصيات بعد.</div>`;
  // الجدول
  const fd=(r,v)=>v==null?"—":fx(v,r.dec??5);
  $("rcRows").innerHTML=list.length?list.map(r=>{const st=r.status,c=st==="win"?"up":st==="loss"?"down":"gold",ic=st==="win"?"✅":st==="loss"?"❌":"⏳";
    const tps=[r.tp1,r.tp2,r.tp3].map((v,k)=>`<span class="tp${(r.best||0)>k?" hit":""}">${(r.best||0)>k?"✓ ":""}${fd(r,v)}</span>`).join("");
    return`<tr><td>${new Date(r.sig_time).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td><td class="ltr"><b>${esc(r.sym)}</b> <span class="label">${esc(r.tf)}</span></td>
      <td>${r.side==="buy"?'<span class="chip buy">شراء</span>':'<span class="chip sell">بيع</span>'}</td><td>${fd(r,r.entry)}</td><td>${fd(r,r.sl)}</td><td>${tps}</td>
      <td class="${c}">${ic} ${esc(r.status_label||st)}</td><td class="${r.pips>0?"up":r.pips<0?"down":""}"><b>${r.pips==null?"—":sg(r.pips)}</b></td></tr>`}).join("")
    :`<tr><td colspan="8"><div class="rc-empty">ما انرسلت توصيات بهذي الفترة بعد. أول ما السيرفر يرسل توصية للقناة تطلع هنا.</div></td></tr>`;
  [...$("rcRows").querySelectorAll("tr")].forEach((tr,k)=>{if(list[k])tr.dataset.sig=list[k].id});
  try{V2.perf(list)}catch(e){console.warn(e)}
}
$("rcPer").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;RC.d=+b.dataset.d;$("rcPer").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));renderRecord()});
$("rcSym").addEventListener("change",e=>{RC.sym=e.target.value;renderRecord()});
function applyInfo(I){if(!I)return;if(I.vapid_public)VAPID=I.vapid_public;if(I.ib_link&&/^https?:\/\//i.test(I.ib_link))CONFIG.BROKER_LINK=I.ib_link;if(I.support_tg)CONFIG.SUPPORT_TG=I.support_tg.replace(/^@/,"");
  const bl=$("brokerLink");if(bl)bl.href=CONFIG.BROKER_LINK;document.querySelectorAll(".support a").forEach(a=>{a.href="https://t.me/"+CONFIG.SUPPORT_TG;a.textContent="@"+CONFIG.SUPPORT_TG})}


/* ================= presence: who is online ================= */
const PG_NAMES={"":"منصة التداول",platform:"منصة التداول",trades:"الصفقات والنتائج",deep:"التحليل التفصيلي",chart:"الشارت + المساعد",rewards:"الهدايا والمسابقات",profile:"ملفه الشخصي",settings:"الإعدادات",admin:"لوحة الإدارة"};
function pgName(p){p=p||"";if(p.startsWith("ac:")){const h=p.slice(3);return h.startsWith("lesson/")?"📚 يقرا درس "+h.slice(7):h.startsWith("course/")?"🎓 دورة "+h.slice(7):"🎓 الأكاديمية"+(h?" · "+h:"")}return PG_NAMES[p]||p}
function ago(t){if(!t)return"";const m=Math.round((Date.now()-new Date(t))/6e4);return m<2?"هسه":m<60?`قبل ${m} دقيقة`:m<1440?`قبل ${Math.round(m/60)} ساعة`:new Date(t).toLocaleDateString(window.LANG||"ar",{day:"numeric",month:"short"})}
let beatT=null;
function beat(){if(!ME.user||document.hidden)return;DB.touch((location.hash||"#").slice(1)||"platform").catch(()=>{})}
function startBeat(){if(beatT)return;beat();beatT=setInterval(beat,60000);addEventListener("hashchange",()=>setTimeout(beat,300));document.addEventListener("visibilitychange",()=>{if(!document.hidden)beat()})}
async function loadOnline(){if(!can("members"))return;let o=null;try{o=await DB.online()}catch(e){$("onList").innerHTML=`<p class="down" style="margin:0">${esc(e.message)} (شغّل online.sql)</p>`;return}
  if(!o)return;const L=(o.list||[]).filter(p=>p.id!==ME.user.id);$("onN").textContent=L.filter(p=>p.online).length;$("onStats").textContent=`اليوم: ${o.today} · هذا الأسبوع: ${o.week}`;
  $("onList").innerHTML=L.length?L.map(p=>`<div class="on-i${p.online?" live":""}"><span class="on-dot"></span>${avHTML(p)}<div style="min-width:0"><b>${esc(p.full_name||p.email||"—")}</b><small>${p.online?"🟢 فاتح هسه":ago(p.last_seen)} · ${esc(pgName(p.last_page))}</small>${p.telegram?`<small class="num">${esc(p.telegram)}</small>`:""}</div></div>`).join("")
    :'<p class="label" style="margin:0">ماكو أحد فاتح المنصة آخر 24 ساعة غيرك.</p>'}
setInterval(()=>{if(!$("adminView").hidden)loadOnline()},30000);

/* المشرفين والصلاحيات (للمدير بس) */
function stfBoxes(sel){$("stfPerms").innerHTML=PERM_KEYS.map(k=>`<label><input type="checkbox" value="${k}"${sel.includes(k)?" checked":""}><span>${PERM_L[k]}</span></label>`).join("")}
async function loadStaff(){if(!$("stfPerms").children.length)stfBoxes(["members"]);let L=[];try{L=await DB.staffList()}catch(e){$("stfList").innerHTML=`<p class="down" style="margin:8px 0 0">${esc(e.message)} (شغّل ملف vexora_update.sql)</p>`;return}
  $("stfList").innerHTML=L.map(p=>`<div class="stf-row">${avHTML(p)}<div class="stf-i"><b>${esc(p.full_name||p.email)}</b><span class="label ltr" style="font-size:12.5px">${esc(p.email)}</span><div>${p.role==="admin"?'<span class="chip up">المدير · كل الصلاحيات</span>':(p.perms||[]).map(k=>`<span class="chip acc">${PERM_S[k]||esc(k)}</span>`).join("")}</div></div>
    ${p.role==="admin"?"":`<button type="button" class="btn" data-stfedit="${esc(p.email)}" data-perms="${esc((p.perms||[]).join(","))}">✏️ تعديل</button><button type="button" class="btn no" data-stfdel="${esc(p.email)}">إزالة</button>`}</div>`).join("")}
$("stfSave").addEventListener("click",async()=>{const m=$("stfMail").value.trim(),ps=[...$("stfPerms").querySelectorAll("input:checked")].map(x=>x.value);
  if(!/^\S+@\S+\.\S+$/.test(m))return say("stfMsg","اكتب إيميل صحيح");if(!ps.length)return say("stfMsg","اختار صلاحية وحدة على الأقل");
  const b=$("stfSave");b.disabled=true;try{await DB.setStaff(m,ps);say("stfMsg","✓ انحفظ. المشرف يشوف لوحته من يحدّث الصفحة",true);$("stfMail").value="";stfBoxes(["members"]);loadStaff()}catch(e){say("stfMsg",e.message)}b.disabled=false});
$("stfList").addEventListener("click",async e=>{const ed=e.target.closest("[data-stfedit]");if(ed){$("stfMail").value=ed.dataset.stfedit;stfBoxes(ed.dataset.perms.split(",").filter(Boolean));$("stfMail").scrollIntoView({behavior:"smooth",block:"center"});return}
  const dl=e.target.closest("[data-stfdel]");if(dl){if(!confirm("تشيل صلاحيات هذا المشرف؟ يرجع عضو عادي."))return;try{await DB.setStaff(dl.dataset.stfdel,[]);loadStaff()}catch(err){say("stfMsg",err.message)}}});


/* ================= V2 PREMIUM ================= */
const SPR={"XAU/USD":2.7,"EUR/USD":1.2,"GBP/USD":1.6,"USD/JPY":1.6,"XAG/USD":3,"AUD/USD":1.4,"USD/CAD":1.8,"USD/CHF":1.8,"GBP/JPY":2.8};
const escA=t=>String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const V2={
  // --- إجماع المدارس ---
  cons(A){const el=$("v2Cons");if(!el||!A)return;const ks=Object.keys(A.M);let b=0,s=0,n=0;ks.forEach(k=>{const v=A.M[k].s;if(v>=20)b++;else if(v<=-20)s++;else n++});
    const t=ks.length||1,lead=b>s?"buy":s>b?"sell":"",ag=Math.max(b,s);
    el.innerHTML=`<div class="v2-cons"><b style="font-size:14px">🧭 إجماع المدارس</b><div class="v2-meter" title="شراء ${b} · محايد ${n} · بيع ${s}"><i class="b" style="width:${b/t*100}%"></i><i class="n" style="width:${n/t*100}%"></i><i class="s" style="width:${s/t*100}%"></i></div>
      <span class="chip ${lead}">${lead?`${ag} من ${t} ${lead==="buy"?"تميل للشراء":"تميل للبيع"}`:"ما أكو اتفاق واضح"}</span>
      <button type="button" class="btn v2s" id="v2AiBtn">🤖 سيناريوهات AI</button></div>${V2.consDetail(A,lead)}<div id="v2AiOut"></div>`},
  async scen(){const o=$("v2AiOut");if(!o)return;o.innerHTML=`<div class="v2-t" style="margin-bottom:10px"><span>🤖 جاري التحليل…</span></div>`;
    try{const id=await DB.aiAsk("اعطني 3 سيناريوهات مختصرة للسعر (صعود، هبوط، تذبذب) مع شرط تفعيل كل سيناريو ومستوى الإلغاء، بالاعتماد على تحليل المنصة فقط. تعليمي وليس نصيحة.",aiContext(),window.LANG||"ar");let r=null;
      for(let i=0;i<60;i++){await new Promise(z=>setTimeout(z,1500));r=await DB.aiResult(id);if(r&&r.status!=="pending")break}
      if(!r||r.status==="pending")throw new Error("المساعد ما رد. جرّب مرة ثانية.");if(r.status==="error")throw new Error(r.answer);
      o.innerHTML=`<div class="v2-t" style="margin-bottom:10px"><span>🤖 سيناريوهات الذكاء الاصطناعي · تعليمي، مو نصيحة مالية</span><div class="v2-ai">${mdLite(r.answer)}</div></div>`}
    catch(e){o.innerHTML=`<div class="v2-warn">${esc(String(e.message||e).replace(/^AI_FREE_LIMIT:\s*/,""))}</div>`}},
  // --- مركز الأداء ---
  perf(list){const el=$("v2Perf");if(!el)return;
    const cl=list.filter(r=>(r.status==="win"||r.status==="loss")&&r.pips!=null).sort((a,b)=>a.sig_time<b.sig_time?-1:1);
    const gw=cl.filter(r=>r.pips>0).reduce((s,r)=>s+r.pips,0),gl=-cl.filter(r=>r.pips<0).reduce((s,r)=>s+r.pips,0);
    let c=0,pk=0,dd=0;cl.forEach(r=>{c+=r.pips;pk=Math.max(pk,c);dd=Math.max(dd,pk-c)});
    const rrs=list.map(r=>{const k=Math.abs(r.entry-r.sl);return k&&r.tp2!=null?Math.abs(r.tp2-r.entry)/k:null}).filter(x=>x&&isFinite(x));
    const W=cl.filter(r=>r.pips>0),L=cl.filter(r=>r.pips<=0),avg=a=>a.length?Math.round(a.reduce((s,r)=>s+r.pips,0)/a.length):0;
    const per=k=>{const g={};cl.forEach(r=>{const d=new Date(r.sig_time);let key=d.toISOString().slice(0,10);if(k==="w"){const x=new Date(d);x.setUTCDate(x.getUTCDate()-x.getUTCDay());key=x.toISOString().slice(0,10)}if(k==="m")key=key.slice(0,7);(g[key]=g[key]||[]).push(r)});
      return Object.keys(g).sort().reverse().slice(0,8).map(key=>{const a=g[key],w=a.filter(r=>r.pips>0).length,p=a.reduce((s,r)=>s+r.pips,0);return`<tr><td class="num">${key}</td><td class="num">${a.length}</td><td class="num">${Math.round(w/a.length*100)}%</td><td class="num ${p>0?"up":p<0?"down":""}">${p>0?"+":""}${p}</td></tr>`}).join("")};
    V2.pk=V2.pk||"w";
    el.innerHTML=`<div class="v2-h"><h3>🏛 مركز الأداء</h3><div class="rc-per" id="v2PerK"><button type="button" data-k="d"${V2.pk==="d"?' class="on"':""}>يومي</button><button type="button" data-k="w"${V2.pk==="w"?' class="on"':""}>أسبوعي</button><button type="button" data-k="m"${V2.pk==="m"?' class="on"':""}>شهري</button></div></div>
      <div class="v2-g">${[["معامل الربح (PF)",gl?(gw/gl).toFixed(2):cl.length?"∞":"—"],["أكبر تراجع",dd?"-"+dd+" نقطة":"0"],["متوسط العائد/المخاطرة",rrs.length?"1:"+(rrs.reduce((a,b)=>a+b,0)/rrs.length).toFixed(2):"—"],
        ["صافي بعد السبريد (تقديري)",cl.length?(()=>{const n=cl.reduce((s,r)=>s+r.pips-(SPR[r.sym]||0),0);return(n>0?"+":"")+Math.round(n)+" نقطة"})():"—"],["متوسط الربح",W.length?"+"+avg(W):"—"],["متوسط الخسارة",L.length?avg(L):"—"],["حجم العينة",cl.length+" صفقة مسكّرة"]].map(([a,b])=>`<div class="v2-t"><span>${a}</span><b class="num">${b}</b></div>`).join("")}</div>
      ${cl.length<30?`<div class="v2-warn">⚠️ العينة صغيرة (${cl.length} صفقة). الأرقام تصير موثوقة أكثر بعد 30 صفقة مسكّرة على الأقل.</div>`:""}
      ${cl.length?`<table class="v2-tbl" style="margin-top:12px"><thead><tr><th>الفترة</th><th>صفقات</th><th>النجاح</th><th>نقاط</th></tr></thead><tbody>${per(V2.pk)}</tbody></table>`:""}
      <p class="v2-note">💸 كل الصفقات الخاسرة محسوبة. «صافي بعد السبريد» يطرح سبريد تقديري لكل صفقة (الذهب 2.7 نقطة، اليورو 1.2، الباوند 1.6، الين 1.6)، وما يشمل العمولة أو الانزلاق السعري.</p><p class="v2-note">📌 هذا الأداء الحقيقي (Live) للتوصيات اللي انرسلت فعلاً للقناة، مسجّل من السيرفر ومحفوظ بسجل تدقيق ما ينعدل. الاختبار الرجعي (Backtest) موجود بصفحة التحليل التفصيلي ومنفصل عنه. اضغط على أي توصية بالجدول حتى تشوف تفاصيلها وسجل تعديلاتها.</p>`;
    $("v2PerK").onclick=e=>{const b=e.target.closest("[data-k]");if(!b)return;V2.pk=b.dataset.k;V2.perf(list)}},
  // --- تفاصيل التوصية ---
  async sig(id){const r=(RC.rows||[]).find(x=>x.id===id)||(V2.last||[]).find(x=>x.id===id);if(!r)return;
    let dl=$("v2Sig");if(!dl){dl=document.createElement("div");dl.id="v2Sig";dl.className="v2-dlg";document.body.appendChild(dl);dl.addEventListener("click",e=>{if(e.target===dl||e.target.closest("[data-x]"))dl.hidden=true})}
    const d=r.dec??5,f=v=>fx(v,d),risk=Math.abs(r.entry-r.sl),rr=k=>risk&&k!=null?(Math.abs(k-r.entry)/risk).toFixed(2):"—";
    const lv=`${r.side==="buy"?"BUY":"SELL"} ${r.sym}\nEntry: ${f(r.entry)}\nSL: ${f(r.sl)}\nTP1: ${f(r.tp1)}\nTP2: ${f(r.tp2)}\nTP3: ${f(r.tp3)}`;
    dl.innerHTML=`<div class="v2-card" role="dialog" aria-modal="true"><div class="v2-h"><h3><span class="ltr">${esc(r.sym)}</span> · ${esc(r.tf)} ${r.side==="buy"?'<span class="chip buy">شراء</span>':'<span class="chip sell">بيع</span>'}</h3><button type="button" class="btn v2s" data-x>✕</button></div>
      <div class="label" style="font-size:12.5px">${new Date(r.sig_time).toLocaleString(window.LANG||"ar",{dateStyle:"medium",timeStyle:"short"})} · ${esc(r.status_label||r.status)}${r.pips!=null?` · <b class="${r.pips>0?"up":"down"}">${r.pips>0?"+":""}${r.pips} نقطة</b>`:""}</div>
      <div class="v2-lv"><div class="v2-t"><span>الدخول</span><b>${f(r.entry)}</b></div><div class="v2-t sl"><span>الوقف</span><b>${f(r.sl)}</b></div><div class="v2-t"><span>القوة</span><b>${r.pct!=null?r.pct+"%":"—"}</b></div>
        ${[r.tp1,r.tp2,r.tp3].map((v,k)=>`<div class="v2-t tp"><span>الهدف ${k+1} · R:R 1:${rr(v)}${(r.best||0)>k?" ✓":""}</span><b>${f(v)}</b></div>`).join("")}</div>
      ${V2.qHTML(r)}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary v2s" id="v2Copy">📋 نسخ المستويات</button><a class="btn v2s" href="#chart" data-go="chart" data-sym="${escA(r.sym)}">📐 افتح على الشارت</a></div>
      <h3 style="font-size:14px;margin:16px 0 4px">🧾 سجل التوصية (ما ينعدل ولا ينحذف)</h3><div class="v2-tl" id="v2Tl"><div class="label">جاري التحميل…</div></div>
      <p class="v2-note">تحليل آلي تعليمي، مو نصيحة مالية. الأداء السابق ما يضمن النتائج.</p></div>`;
    dl.hidden=false;
    $("v2Copy").onclick=async()=>{try{await navigator.clipboard.writeText(lv);$("v2Copy").textContent="✓ انتسخت"}catch(e){prompt("انسخ:",lv)}};
    dl.querySelector("[data-sym]").onclick=e=>{e.preventDefault();dl.hidden=true;try{pick(r.sym)}catch(_){}location.hash="chart";showView()};
    const K={created:"🆕 انشأت",published:"📣 انرسلت للقناة",edited:"✏️ تعديل",closed:"🏁 انسكرت",status:"🔄 تحديث الحالة",deleted:"🗑 انحذفت"};
    try{const ev=await DB.sigEvents(r.id)||[];$("v2Tl").innerHTML=ev.length?ev.map(x=>{const ch=Object.entries(x.changes||{}).filter(([k,v])=>Array.isArray(v)&&k!=="tg_sent").map(([k,v])=>`${k}: ${v[0]??"—"} ← ${v[1]??"—"}`).join(" · ");
      return`<div><b>${K[x.kind]||esc(x.kind)}</b>${ch?` <span class="num ltr">${esc(ch)}</span>`:""}${x.reason?`<small>السبب: ${esc(x.reason)}</small>`:""}<small>${new Date(x.at).toLocaleString(window.LANG||"ar")}</small></div>`}).join(""):'<div class="label">ما أكو سجل بعد (يبدي من تحديث V2).</div>'}
    catch(e){$("v2Tl").innerHTML=`<div class="label">السجل يشتغل بعد تشغيل ملف vexora_v2.sql</div>`}},
  // --- الداشبورد ---
  async dash(){const el=$("v2Dash");if(!el)return;if(ME.locked){el.hidden=true;return}el.hidden=false;
    let L=[];try{L=await DB.signals(30)||[]}catch(e){}V2.last=L;const t=rcStats(L.filter(r=>r.status!=="expired"));
    const nm=s=>(SYMS.find(x=>x.s===s)||{}).n||s;
    el.innerHTML=`<div class="panel"><div class="v2-h"><h3>⚡ آخر التوصيات</h3><a class="gold" href="#record" data-go="record" style="font-size:13px">السجل الكامل ←</a></div><div class="v2-list">${L.slice(0,4).map(r=>`<div class="v2-sig" data-v2sig="${escA(r.id)}">${r.side==="buy"?'<span class="chip buy">شراء</span>':'<span class="chip sell">بيع</span>'}<div class="s"><b>${esc(nm(r.sym))}</b> <span class="label ltr">${esc(r.sym)} · ${esc(r.tf)}</span><small>${ago(r.sig_time)}${r.qscore!=null?` · ⭐ ${r.qscore}/100`:""}</small></div><span class="${r.status==="win"?"up":r.status==="loss"?"down":"gold"}" style="font-size:12.5px">${esc(r.status_label||r.status)}</span></div>`).join("")||'<div class="label">ما أكو توصيات آخر 30 يوم.</div>'}</div></div>
      <div class="panel"><div class="v2-h"><h3>📊 آخر 30 يوم</h3></div><div class="v2-g" style="grid-template-columns:1fr 1fr">${[["نسبة النجاح",t.rate==null?"—":t.rate+"%"],["صافي النقاط",(t.pips>0?"+":"")+t.pips],["رابحة / خاسرة",t.win+" / "+t.loss],["مفتوحة الآن",t.open]].map(([a,b])=>`<div class="v2-t"><span>${a}</span><b class="num">${b}</b></div>`).join("")}</div><p class="v2-note">من سجل الأداء الموثّق.</p></div><div class="panel" id="v2News"></div><div class="panel" id="v2Learn"></div>`;V2.news();V2.learn()},
  // --- مركز التحكم ---
  async ctl(){const el=$("v2Ctl");if(!el)return;el.innerHTML='<div class="label">جاري تحميل حالة النظام…</div>';let s;
    try{s=await DB.adminStatus()}catch(e){el.innerHTML=`<div class="v2-h"><h3>🛰 مركز التحكم</h3></div><div class="v2-warn">${esc(e.message)} — شغّل ملف vexora_v2.sql</div>`;return}
    const mins=t=>t?Math.round((Date.now()-new Date(t))/6e4):null,em=mins(s.engine_last),blk=s.td_block_until&&Date.parse(s.td_block_until)>Date.now();
    const eng=s.server_scan!=="1"?["warn","السيرفر مطفي (الفحص من المتصفح)"]:blk?["warn","رصيد Twelve Data خلص لليوم"]:em==null?["bad","ما اشتغل بعد"]:em<=20?["ok",`يشتغل · آخر دورة قبل ${em} د`]:["bad",`واكف من ${em} دقيقة`];
    const pr=mins(s.prices_at),runs=(s.runs||[]).slice().reverse();
    el.innerHTML=`<div class="v2-h"><h3>🛰 مركز التحكم</h3><button type="button" class="btn v2s" id="v2CtlR">↻ تحديث</button></div>
      <div class="v2-g">${[["الأعضاء",s.members],["المفعّلين",s.approved],["بانتظار المراجعة",s.pending],["جدد هذا الأسبوع",s.new_week],["نشطين اليوم",s.active_today],["طلبات دفع معلّقة",s.pay_pending]].map(([a,b])=>`<div class="v2-t"><span>${a}</span><b class="num">${b??"—"}</b></div>`).join("")}</div>
      <div class="v2-g" style="margin-top:10px">
        <div class="v2-t"><span>محرك التوصيات</span><b style="font-size:14px"><i class="v2-dot ${eng[0]}"></i>${eng[1]}</b></div>
        <div class="v2-t"><span>الأسعار</span><b style="font-size:14px"><i class="v2-dot ${pr==null?"":pr<=30?"ok":"warn"}"></i>${pr==null?"—":`آخر تحديث قبل ${pr} د`}</b></div>
        <div class="v2-t"><span>آخر نشر تيليجرام</span><b style="font-size:14px">${s.tg_last?ago(s.tg_last):"—"}</b></div>
        <div class="v2-t"><span>الإشعارات</span><b style="font-size:14px">${s.push_subs} جهاز · ${s.push_failed} فشل/24س</b></div>
        <div class="v2-t"><span>إيميلات الأسبوع</span><b style="font-size:14px">${s.emails_week}</b></div>
        <div class="v2-t"><span>🔐 التحقق بخطوتين</span><b style="font-size:14px">${s.mfa?s.mfa.on+" من "+s.mfa.staff+" إداري":"—"}</b></div></div>
      ${s.engine_err?`<div class="v2-warn">⚠️ ${esc(s.engine_err)}</div>`:""}
      <h3 style="font-size:14px;margin:14px 0 6px">دورات المحرك آخر 24 ساعة <span class="label" style="font-size:12px">(أخضر: ناجحة · أصفر: رفض فلتر الجودة · أحمر: خطأ)</span></h3>
      <div class="v2-bars">${runs.length?runs.map(r=>`<i class="${!r.ok?"x":r.rejected?"r":""}" style="height:${!r.ok?100:30+Math.min(70,(r.sent+r.rejected)*35)}%" title="${escA(new Date(r.at).toLocaleTimeString()+(r.note?" · "+r.note:""))}"></i>`).join(""):'<span class="label" style="font-size:12.5px">ما أكو دورات مسجلة بعد.</span>'}</div>
      <div id="v2Up"></div>
      <h3 style="font-size:14px;margin:14px 0 6px">🚫 توصيات رفضها فلتر الجودة</h3>
      <div class="v2-list">${(s.rejections||[]).length?s.rejections.map(r=>`<div class="v2-li"><span class="chip ${r.side==="buy"?"buy":"sell"}">${r.side==="buy"?"شراء":"بيع"}</span><div><b class="ltr">${esc(r.sym)} · ${esc(r.tf)}</b><small>${(r.reasons||[]).map(esc).join(" · ")}</small><small class="num">${ago(r.at)}</small></div></div>`).join(""):'<div class="label" style="font-size:13px">ما أكو رفض. كل التوصيات عبرت الفلتر.</div>'}</div>
      <p class="v2-note">الفلتر يرفض التوصية إذا: العائد للمخاطرة أقل من الحد، السعر قديم، أكو توصية فعّالة على نفس الزوج، وصلنا حد التوصيات الفعّالة، السبريد التقديري كبير، تذبذب مفاجئ، أو خبر قوي قريب.${s.demo?" (نسخة تجريبية)":""}</p>`;
    $("v2CtlR").onclick=()=>V2.ctl();V2.up();
    if(isAdminUser()){const lg=$("v2Log");lg.innerHTML='<div class="v2-h"><h3>📜 سجل نشاط الإدارة</h3></div><div class="label">جاري التحميل…</div>';
      try{const A=await DB.adminActivity(30)||[];lg.innerHTML=`<div class="v2-h"><h3>📜 سجل نشاط الإدارة</h3><span class="label" style="font-size:12px">مين سوّى شنو، ومتى. ما ينعدل.</span></div><div class="v2-list">${A.length?A.map(a=>`<div class="v2-li"><div><b>${esc(a.action)}</b> · ${esc(a.target||"")}<small>${esc(a.actor_name||"")} · <span class="num">${new Date(a.at).toLocaleString(window.LANG||"ar")}</span></small></div></div>`).join(""):'<div class="label" style="font-size:13px">ما أكو نشاط مسجّل بعد.</div>'}</div>`}
      catch(e){lg.innerHTML=`<div class="v2-h"><h3>📜 سجل نشاط الإدارة</h3></div><div class="v2-warn">${esc(e.message)}</div>`}}},
  // --- الملف: الإشعارات، الأمان، البيانات ---
  PREFS:[["sig_new","📊 توصية جديدة","بدون مستويات على شاشة القفل"],["sig_upd","✏️ تعديل على توصية","أي تغيير بالوقف أو الأهداف"],["sig_close","🏁 نتيجة توصية","هدف تحقق أو وقف"],["zoom","🎥 دروس الزوم","تذكير قبل المحاضرة بساعة"],["cert","🎓 الشهادات والدورات",""],["news","📅 الأخبار الاقتصادية",""],["general","📣 إعلانات وهدايا",""]],
  prefs(){const el=$("v2Prefs");if(!el)return;const P=(ME.profile&&ME.profile.notif_prefs)||{};
    el.innerHTML=`<h3 class="sh">🔔 الإشعارات اللي توصلني</h3>${V2.PREFS.map(([k,t,d])=>`<label class="v2-tg"><span>${t}${d?`<small>${d}</small>`:""}</span><span class="v2-sw"><input type="checkbox" data-pf="${k}"${P[k]===false?"":" checked"}><i></i></span></label>`).join("")}<p class="msg" id="v2PfMsg"></p>`;
    el.onchange=async e=>{const c=e.target.closest("[data-pf]");if(!c)return;const o={...((ME.profile&&ME.profile.notif_prefs)||{})};o[c.dataset.pf]=c.checked;
      try{await DB.savePrefs(ME.user.id,o);ME.profile.notif_prefs=o;say("v2PfMsg","✓ انحفظ",true)}catch(err){c.checked=!c.checked;say("v2PfMsg",err.message)}}},
  async sec(){const el=$("v2Sec");if(!el)return;el.innerHTML=`<h3 class="sh">🔐 التحقق بخطوتين</h3><p class="label" style="font-size:13px;margin:0 0 10px">طبقة حماية إضافية: بعد كلمة السر يطلب رمز من تطبيق Google Authenticator أو Authy.${ME.profile&&ME.profile.role!=="member"?" <b class='gold'>مستحسن جداً لحسابات الإدارة.</b>":""}</p><div id="v2MfaB" class="label">…</div><p class="msg" id="v2MfaMsg"></p>`;
    let L=[];try{L=await DB.mfaList()}catch(e){}const on=L.find(f=>f.status==="verified");
    $("v2MfaB").innerHTML=on?`<div class="v2-t"><span>الحالة</span><b style="font-size:14px"><i class="v2-dot ok"></i>مفعّل</b></div><button type="button" class="btn no v2s" id="v2MfaOff" style="margin-top:8px">إلغاء التفعيل</button>`
      :`<button type="button" class="btn primary" id="v2MfaOn">تفعيل التحقق بخطوتين</button>`;
    const off=$("v2MfaOff");if(off)off.onclick=async()=>{if(!confirm("تلغي التحقق بخطوتين؟"))return;try{await DB.mfaRemove(on.id);V2.sec()}catch(e){say("v2MfaMsg",e.message)}};
    const bt=$("v2MfaOn");if(bt)bt.onclick=async()=>{try{for(const f of L.filter(f=>f.status!=="verified"))await DB.mfaRemove(f.id).catch(()=>{});const d=await DB.mfaEnroll();
      $("v2MfaB").innerHTML=`<div class="v2-mfa"><p style="font-size:13px;margin:0 0 8px">1) امسح الرمز بتطبيق المصادقة:</p><img src="${escA(d.totp.qr_code)}" alt="QR"><p class="label ltr num" style="font-size:12px;word-break:break-all">${esc(d.totp.secret)}</p>
        <p style="font-size:13px;margin:8px 0">2) اكتب الرمز اللي يطلعلك (6 أرقام):</p><div style="display:flex;gap:8px"><input id="v2MfaC" class="ltr num" inputmode="numeric" maxlength="6" style="max-width:140px"><button type="button" class="btn primary" id="v2MfaV">تأكيد</button></div></div>`;
      $("v2MfaV").onclick=async()=>{try{await DB.mfaVerify(d.id,$("v2MfaC").value.trim());say("v2MfaMsg","✓ تفعّل التحقق بخطوتين",true);setTimeout(()=>V2.sec(),900)}catch(e){say("v2MfaMsg","الرمز غلط أو انتهى. جرّب الرمز الجديد")}}}
      catch(e){say("v2MfaMsg",e.message)}}},
  async data(){const el=$("v2Data");if(!el)return;let L=[];try{L=await DB.myDataRequests()||[]}catch(e){}
    el.innerHTML=`<h3 class="sh">🗂 بياناتي</h3><p class="label" style="font-size:13px;margin:0 0 10px">تكدر تطلب تصحيح أي معلومة ما تكدر تعدلها بنفسك، أو تطلب حذف حسابك وبياناتك. الطلب يوصل للإدارة مباشرة.</p>
      <div class="fm" style="max-width:560px"><select id="v2DrK"><option value="fix">طلب تصحيح بيانات</option><option value="delete">طلب حذف الحساب والبيانات</option></select>
      <textarea id="v2DrN" maxlength="500" placeholder="${escA((window.__t||String)("اكتب شنو تريد نصحح، أو سبب الحذف (اختياري)"))}" style="min-height:70px"></textarea><button type="button" class="btn" id="v2DrB">إرسال الطلب</button><p class="msg" id="v2DrMsg"></p></div>
      ${L.length?`<div class="v2-list" style="margin-top:8px">${L.map(x=>`<div class="v2-li"><div><b>${x.kind==="delete"?"طلب حذف":"طلب تصحيح"}</b> · <span class="${x.status==="open"?"gold":"up"}">${x.status==="open"?"قيد المراجعة":"تم"}</span><small>${esc(x.note||"")}</small><small>${new Date(x.created_at).toLocaleDateString(window.LANG||"ar")}</small></div></div>`).join("")}</div>`:""}`;
    $("v2DrB").onclick=async()=>{const k=$("v2DrK").value,n=$("v2DrN").value.trim();if(k==="delete"&&!confirm("متأكد تريد تطلب حذف حسابك؟ الإدارة تراجع الطلب وتتواصل وياك."))return;
      try{await DB.dataRequest(k,n);say("v2DrMsg","✓ وصل طلبك للإدارة",true);setTimeout(()=>V2.data(),900)}catch(e){say("v2DrMsg",e.message)}}},
  // --- سجل النقاط ---
  async pts(){const el=$("v2Pts");if(!el)return;let R=null;try{R=await DB.myRefs()}catch(e){}const L=(R&&R.list)||[];
    el.innerHTML=`<div class="v2-h"><h3>🧮 سجل النقاط</h3><b class="gold num" style="font-size:18px">${R?R.points:0} نقطة</b></div>
      ${L.length?`<table class="v2-tbl"><thead><tr><th>الشخص</th><th>الحالة</th><th>النقاط</th><th>التاريخ</th></tr></thead><tbody>${L.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.status==="approved"?"تفعّل حسابه":"سجّل بالمنصة"}</td><td class="num up">+${x.status==="approved"?10:1}</td><td class="num label">${x.created_at?new Date(x.created_at).toLocaleDateString(window.LANG||"ar"):"—"}</td></tr>`).join("")}</tbody></table>`
        :'<p class="label" style="margin:0;font-size:13px">لسه ما أكو نقاط. انشر رابطك من فوق وكل تسجيل يضيفلك نقطة، وكل تفعيل 10 نقاط.</p>'}
      <p class="v2-note">النقاط تنحسب تلقائياً، وكل شخص ينحسب مرة وحدة بس (نفس الحساب ما ينحسب مرتين).</p>`},
  view(v){const vd=$("v2Dash");if(vd)vd.hidden=v!==""||!!ME.locked;if(v===""&&!ME.locked)V2.dash();if(v==="admin")V2.ctl();if(v==="profile"){V2.prefs();V2.sec();V2.data();V2.comp()}if(v==="inbox")V2.inbox();if(v==="rewards")V2.pts();if(v==="chart")V2.upd();document.body.classList.remove("v2-focus")},
  upd(){const u=$("v2Upd");if(!u)return;const c=cache[S.sym.s+"|"+S.tf];const t=c&&c.t;u.textContent=t?"آخر تحديث للسعر: "+new Date(t).toLocaleTimeString(window.LANG||"ar",{hour:"2-digit",minute:"2-digit"})+(c.src==="sim"?" (محاكاة)":""):""}
};
document.addEventListener("click",e=>{const a=e.target.closest("#v2AiBtn");if(a){V2.scen();return}
  const tr=e.target.closest("#rcRows tr[data-sig]");if(tr){V2.sig(tr.dataset.sig);return}
  const sg=e.target.closest("[data-v2sig]");if(sg){V2.sig(sg.dataset.v2sig);return}});
$("v2Focus").addEventListener("click",()=>{const on=document.body.classList.toggle("v2-focus");$("v2Focus").textContent=on?"↩︎ رجوع":"🎯 وضع التركيز";try{localStorage.setItem("vx_focus",on?"1":"")}catch(e){}});
$("v2Full").addEventListener("click",()=>{const p=$("tvBox").closest(".panel");if(document.fullscreenElement)document.exitFullscreen();else if(p.requestFullscreen)p.requestFullscreen().catch(()=>{})});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){const d=$("v2Sig");if(d)d.hidden=true;document.body.classList.remove("v2-focus")}});
// القائمة الجانبية: تصغير + تلميحات
(function(){const sd=document.getElementById("gside");if(!sd)return;sd.querySelectorAll(".gi").forEach(a=>{const l=a.querySelector(".gl");if(l&&!a.title)a.title=l.textContent.trim()});
  const b=document.createElement("button");b.type="button";b.className="v2-mini";b.setAttribute("aria-label","تصغير القائمة");b.title="تصغير/توسيع القائمة";b.textContent="❯";sd.appendChild(b);
  try{if(localStorage.getItem("vx_side")==="mini")document.body.classList.add("v2-side-mini")}catch(e){}
  b.addEventListener("click",()=>{const m=document.body.classList.toggle("v2-side-mini");try{localStorage.setItem("vx_side",m?"mini":"")}catch(e){}})})();
// شريط انقطاع الإنترنت
(function(){const o=document.createElement("div");o.className="v2-off";o.hidden=navigator.onLine!==false;o.textContent="📡 انقطع الإنترنت. البيانات اللي تشوفها ممكن تكون قديمة، ونرجع نحدّث أول ما يرجع الاتصال.";document.body.appendChild(o);
  addEventListener("offline",()=>o.hidden=false);addEventListener("online",()=>{o.hidden=true;try{if(!$("app").hidden)showView()}catch(e){}})})();


/* ================= V2B ================= */
Object.assign(V2,{
  mask(ph){ph=String(ph||"").trim();if(!ph)return"";const d=ph.replace(/[^\d+]/g,"");return d.length<6?"••••":d.slice(0,d.startsWith("+")?4:3)+" •• ••• "+d.slice(-2)},
  qHTML(r){let parts=r.qparts,score=r.qscore,partial=false;
    if(!Array.isArray(parts)||score==null){const risk=Math.abs(r.entry-r.sl),rr=risk&&r.tp2!=null?Math.abs(r.tp2-r.entry)/risk:0;
      parts=[["قوة الإشارة",Math.round(Math.min(100,r.pct||0)/100*30),30],["العائد للمخاطرة",Math.round(Math.min(1,rr/3)*25),25]];score=parts.reduce((s,x)=>s+x[1],0);partial=true}
    const max=parts.reduce((s,x)=>s+x[2],0),pc=Math.round(score/max*100),col=pc>=75?"var(--buy)":pc>=55?"#f0b040":"var(--sell)";
    return`<div class="v2-q"><div class="v2-qs" style="--p:${pc};--c:${col}"><b class="num">${score}</b><small>/ ${max}</small></div><div class="v2-qb">${parts.map(([l,g,m])=>`<div><span>${esc(l)}</span><i><em style="width:${m?g/m*100:0}%"></em></i><b class="num">${g}/${m}</b></div>`).join("")}</div></div>
      ${partial?'<p class="v2-note" style="margin:-4px 0 10px">تقييم جزئي (التوصيات قبل التحديث ما بيها كل التفاصيل).</p>':""}`},
  consDetail(A,lead){if(!lead)return"";const d=lead==="buy"?1:-1,ag=[],cf=[];
    for(const k in A.M){(A.M[k].items||[]).forEach(x=>{if(!x.v)return;const w=Math.abs(x.v)*(W[k]||.1);(Math.sign(x.v)===d?ag:cf).push({t:x.t,w,s:NAMES[k]||k})})}
    ag.sort((a,b)=>b.w-a.w);cf.sort((a,b)=>b.w-a.w);const p=S.plan,f=v=>fx(v,S.sym.dec);
    const zs=(A.M.cls&&A.M.cls.zones||[]).slice().sort((a,b)=>Math.abs(a.mid-A.px)-Math.abs(b.mid-A.px)).slice(0,3);
    return`<div class="v2-cd"><div class="v2-t"><span>✓ نقاط الاتفاق</span><ul>${ag.slice(0,4).map(x=>`<li>${x.t} <small>(${esc(x.s)})</small></li>`).join("")||"<li>—</li>"}</ul></div>
      <div class="v2-t"><span>⚠ نقاط التعارض</span><ul>${cf.slice(0,3).map(x=>`<li>${x.t} <small>(${esc(x.s)})</small></li>`).join("")||"<li>ما أكو تعارض مهم</li>"}</ul></div>
      <div class="v2-t"><span>📍 المستويات المشتركة</span><ul>${p?`<li>الدخول <b class="num">${f(p.entry)}</b> · الوقف <b class="num down">${f(p.sl)}</b></li><li>الأهداف <b class="num up">${p.tps.map(t=>f(t.p)).join(" · ")}</b></li>`:""}${zs.map(z=>`<li>${z.mid<A.px?"دعم":"مقاومة"} <b class="num">${f(z.lo)} – ${f(z.hi)}</b> (${z.n} لمسات)</li>`).join("")}</ul></div></div>`},
  async news(){const el=$("v2News");if(!el)return;let L=[];try{L=await DB.econ(new Date().toISOString(),new Date(Date.now()+7*864e5).toISOString())||[]}catch(e){}
    const nx=L.find(e=>e.impact==="High"&&new Date(e.at)>Date.now());
    if(!nx){el.innerHTML='<div class="v2-h"><h3>📅 الخبر القوي الجاي</h3></div><p class="label" style="margin:0;font-size:13px">ما أكو أخبار قوية مسجّلة للأيام الجاية.</p>';return}
    const m=Math.round((new Date(nx.at)-Date.now())/6e4),t=m<60?`بعد ${m} دقيقة`:m<1440?`بعد ${Math.floor(m/60)} ساعة و ${m%60} دقيقة`:`بعد ${Math.floor(m/1440)} يوم`;
    el.innerHTML=`<div class="v2-h"><h3>📅 الخبر القوي الجاي</h3><a class="gold" href="#calendar" data-go="calendar" style="font-size:13px">التقويم ←</a></div><div class="v2-t"><span>${FLAG[nx.country]||"🌐"} ${esc(nx.country)} · ${new Date(nx.at).toLocaleString(window.LANG||"ar",{weekday:"short",hour:"2-digit",minute:"2-digit"})}</span><b style="font-size:16px">${econAr(nx.title)?esc(econAr(nx.title)):`<span class="ltr">${esc(nx.title)}</span>`}</b><b class="down" style="font-size:14px;margin-top:4px">⏳ ${t}</b></div><p class="v2-note">قبل الخبر بـ 30 دقيقة المحرك يوكف التوصيات الجديدة تلقائياً.</p>`},
  learn(){const el=$("v2Learn");if(!el)return;let d=null;try{d=JSON.parse(localStorage.getItem("vx_last_lesson")||"null")}catch(e){}
    el.innerHTML=d&&d.title?`<div class="v2-h"><h3>🎓 كمّل التعلّم</h3></div><div class="v2-t"><span>${esc(d.course||"")}</span><b style="font-size:15px">${esc(d.title)}</b></div><a class="btn primary v2s" style="margin-top:10px;display:inline-block;text-decoration:none;color:#111" href="index.html#lesson/${encodeURIComponent(d.id)}">كمّل الدرس ←</a>`
      :`<div class="v2-h"><h3>🎓 الأكاديمية</h3></div><p class="label" style="margin:0 0 10px;font-size:13px">تعلّم شلون تقرا التوصية وتطبّقها بنفسك. أول درس بكل دورة مجاني.</p><a class="btn primary v2s" style="display:inline-block;text-decoration:none;color:#111" href="index.html#courses">ابدأ التعلّم ←</a>`},
  async comp(){const el=$("v2Comp"),p=ME.profile;if(!el||!p)return;let mfa=false;try{mfa=(await DB.mfaList()).some(f=>f.status==="verified")}catch(e){}
    const items=[["الاسم",!!p.full_name],["الصورة",!!p.avatar_url],["تيليجرام",!!p.telegram],["الهاتف",!!p.phone],["الدولة",!!p.country],["رقم الحساب",!!p.broker_account],["التحقق بخطوتين",mfa]];
    const done=items.filter(x=>x[1]).length,pc=Math.round(done/items.length*100);let subs=[];try{subs=await DB.mySubs(ME.user.id)||[]}catch(e){}
    const act=subs.filter(s=>s.expires_at&&new Date(s.expires_at)>Date.now()),K={monthly:"الاشتراك الشهري",ai:"المساعد الذكي",indicator:"مؤشر"};
    el.innerHTML=`<div class="v2-t" style="text-align:start;margin-bottom:12px"><span>اكتمال ملفك</span><div style="display:flex;align-items:center;gap:10px;margin-top:4px"><div class="v2-pbar"><i style="width:${pc}%"></i></div><b class="num" style="font-size:16px">${pc}%</b></div>
      ${pc<100?`<small class="label" style="display:block;margin-top:6px;font-size:12px">باقي: ${items.filter(x=>!x[1]).map(x=>x[0]).join("، ")}</small>`:'<small class="up" style="display:block;margin-top:6px">✓ ملفك كامل</small>'}
      ${act.map(s=>`<small style="display:block;margin-top:6px">🔄 ${esc(K[s.kind]||s.kind)}${s.item?" "+esc(s.item):""}: يجدد ${new Date(s.expires_at).toLocaleDateString(window.LANG||"ar",{day:"2-digit",month:"2-digit"})}</small>`).join("")}</div>`},
  async up(){const el=$("v2Up");if(!el)return;let L=[];try{L=await DB.uptime()||[]}catch(e){return}if(!L.length)return;
    el.innerHTML=`<h3 style="font-size:14px;margin:14px 0 6px">⏱ نسبة تشغيل المحرك</h3><div class="v2-g" style="grid-template-columns:repeat(auto-fit,minmax(92px,1fr))">${L.map(d=>{const p=d.pct==null?null:+d.pct;return`<div class="v2-t"><span>${new Date(d.day).toLocaleDateString(window.LANG||"ar",{weekday:"short",day:"numeric"})}</span><b class="num ${p==null?"":p>=95?"up":p>=80?"gold":"down"}">${p==null?"—":p.toFixed(p===100?0:1)+"%"}</b><small class="label" style="font-size:11px">${d.ok}/${d.expected} دورة</small></div>`}).join("")}</div>`},
  IBF:"",
  async inbox(){const el=$("ibList");if(!el)return;el.innerHTML='<p class="label">جاري التحميل…</p>';let L=[];try{L=await DB.inbox(ME.user.id)||[]}catch(e){el.innerHTML=`<p class="down">${esc(e.message)}</p>`;return}
    let seen=0;try{seen=+localStorage.getItem(seenKey())||0;localStorage.setItem(seenKey(),String(Date.now()))}catch(e){}$("bellN").hidden=true;
    const cat=n=>{const k=n.kind||"",l=n.link||"";return k==="coach"||n.icon==="💬"?"coach":/^sig/.test(k)||/#(trades|record)/.test(l)?"sig":/cert|zoom/.test(k)||/index\.html/.test(l)?"acad":"sys"};
    const F=V2.IBF,list=L.filter(n=>!F||cat(n)===F);
    el.innerHTML=list.length?`<div class="v2-list">${list.map(n=>{const t=new Date(n.created_at),nw=t.getTime()>seen;return`<a class="v2-li v2-ib${nw?" new":""}" href="${escA(n.link||"#")}"><i style="font-style:normal;font-size:22px">${esc(n.icon||"🔔")}</i><div style="min-width:0;flex:1"><b>${esc(n.title)}</b>${n.body?`<small style="font-size:13px;color:var(--fg);opacity:.85;white-space:pre-wrap">${esc(n.body)}</small>`:""}<small>${t.toLocaleString(window.LANG||"ar",{dateStyle:"medium",timeStyle:"short"})}</small></div>${nw?'<span class="chip gold">جديد</span>':""}</a>`}).join("")}</div>`
      :'<p class="label" style="margin:0">ما أكو رسائل هنا.</p>'}
});
$("ibF").addEventListener("click",e=>{const b=e.target.closest("[data-f]");if(!b)return;V2.IBF=b.dataset.f;$("ibF").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));V2.inbox()});
$("ibList").addEventListener("click",e=>{const a=e.target.closest("a.v2-ib");if(!a)return;const h=a.getAttribute("href")||"";if(h.startsWith("#")||h.startsWith("app.html#")){e.preventDefault();location.hash=h.split("#")[1]||"";showView()}});
$("admRows").addEventListener("click",async e=>{const b=e.target.closest("[data-mmsg]");if(!b)return;e.stopPropagation();
  const t=prompt("عنوان الرسالة (مثلاً: درس الليلة):","");if(t==null)return;const m=prompt("نص الرسالة:","");if(m==null)return;
  try{await DB.message(b.dataset.mmsg,t,m);alert("✓ وصلت الرسالة للعضو بمركز الرسائل والجرس والموبايل")}catch(err){alert(err.message)}},true);


/* ================= V3: AI PRO · الوكلاء · بناء الاستراتيجيات · الماسح · حارس المخاطر ================= */
const V3={chat:null,mode:"pro",lang:null,busy:false,lines:null,pub:null,pubT:0,chats:[],q:"",
  toast(t,bad){let el=$("v3Toast");if(!el){el=document.createElement("div");el.id="v3Toast";el.className="v3-toast";document.body.appendChild(el)}
    el.textContent=t;el.classList.toggle("bad",!!bad);el.classList.add("on");clearTimeout(V3._tt);V3._tt=setTimeout(()=>el.classList.remove("on"),3200)},
  err(e){const m=String(e&&e.message||e||"");return/AI_FREE_LIMIT/.test(m)?"خلص سؤالك المجاني اليوم. اشترك بالمساعد حتى تسأل أكثر، أو ارجع باچر.":/AI_CAP/.test(m)?"المساعد واصل سقف الاستخدام الشهري للمنصة. يرجع يشتغل أول الشهر الجاي.":m.replace(/^[A-Z_]+:\s*/,"")},
  f(v){return fx(v,S.sym.dec)},
  locked(el){if(!ME.locked)return false;el.innerHTML=`<div class="panel"><h3 style="margin:0 0 6px">🔒 هذي الأداة للأعضاء المفعّلين</h3><p class="label" style="margin:0">فعّل عضويتك أول، وبعدها تنفتحلك كل أدوات فيكسورا.</p><a class="btn primary" href="#" data-go="" style="margin-top:10px;display:inline-block;text-decoration:none">رجوع للمنصة</a></div>`;return true},
  async ensure(sym,tf){const x=SYMS.find(y=>y.s===sym)||S.sym;if(x===S.sym&&tf===S.tf&&S.A)return;S.sym=x;if(TFS[tf])S.tf=tf;renderControls();save();await load()},
  age(){const lc=S.candles&&S.candles.at(-1),m=lc?Math.round((Date.now()/1000-lc.time)/60):null,sim=S.src==="sim",stale=!sim&&m!=null&&m>TFS[S.tf].s/60*3;
    return{m,sim,stale,n:S.candles?S.candles.length:0,t:lc?lc.time*1000:null}},
  ageTxt(m){return m==null?"—":m<2?"هسه":m<60?`قبل ${m} د`:m<1440?`قبل ${Math.round(m/60)} س`:`قبل ${Math.round(m/1440)} يوم`},
  async loadPub(){if(Date.now()-V3.pubT<3e5&&V3.pub)return V3.pub;try{V3.pub=await DB.signals(2)||[];V3.pubT=Date.now()}catch(e){V3.pub=[]}return V3.pub},
  pubFor(sym){const L=(V3.pub||[]).filter(r=>r.sym===sym&&Date.now()-new Date(r.sig_time)<864e5);return L[0]||null},
  // ---- التحليل الهيكلي من محرك المنصة (بدون أي تكلفة ذكاء صناعي) ----
  card(){const A=S.A;if(!A)return null;const f=v=>+(+v).toFixed(S.sym.dec),px=A.px,atr=A.atr,ag=V3.age();
    let bull=0,bear=0;for(const k in A.M){if(A.M[k].s>=15)bull++;else if(A.M[k].s<=-15)bear++}
    const d=A.total>=15?1:A.total<=-15?-1:0,zs=(A.M.cls.zones||[]);
    const sup=zs.filter(z=>z.mid<px).sort((a,b)=>b.mid-a.mid)[0],res=zs.filter(z=>z.mid>px).sort((a,b)=>a.mid-b.mid)[0];
    const lead=d||(S.plan?S.plan.d:0)||1,AG=[],CF=[];
    for(const k in A.M)(A.M[k].items||[]).forEach(x=>{if(!x.v)return;(Math.sign(x.v)===lead?AG:CF).push({t:x.t,s:NAMES[k]||k,w:Math.abs(x.v)*(W[k]||.1)})});
    AG.sort((a,b)=>b.w-a.w);CF.sort((a,b)=>b.w-a.w);
    // السيولة: قمم/قيعان متساوية من نقاط الانعكاس + أقرب قمة وقاع + فجوات FVG
    const liq=[],piv=(A.zz&&A.zz.piv||[]).slice(-24),eq=t=>{const P=piv.filter(p=>p.t===t);for(let i=P.length-1;i>0;i--)for(let j=i-1;j>=0&&j>=i-5;j--)if(Math.abs(P[i].p-P[j].p)<.15*atr)return(P[i].p+P[j].p)/2;return null};
    const eh=eq("H"),el=eq("L");if(eh&&eh>px)liq.push({t:`قمم متساوية قرب <b class="num">${V3.f(eh)}</b>: سيولة شراء (Buy-side) محتملة فوقها`,p:f(eh)});
    if(el&&el<px)liq.push({t:`قيعان متساوية قرب <b class="num">${V3.f(el)}</b>: سيولة بيع (Sell-side) محتملة تحتها`,p:f(el)});
    const sh=piv.filter(p=>p.t==="H"&&p.p>px).at(-1),sl_=piv.filter(p=>p.t==="L"&&p.p<px).at(-1);
    if(sh&&!eh)liq.push({t:`أقرب قمة سوينغ <b class="num">${V3.f(sh.p)}</b>: أوامر وقف البائعين غالباً فوقها`,p:f(sh.p)});
    if(sl_&&!el)liq.push({t:`أقرب قاع سوينغ <b class="num">${V3.f(sl_.p)}</b>: أوامر وقف المشترين غالباً تحته`,p:f(sl_.p)});
    const fv=A.M.smc.fvg||{};if(fv.bull)liq.push({t:`فجوة FVG صاعدة غير ممتلئة <b class="num"><bdi dir="ltr">${V3.f(fv.bull.lo)} – ${V3.f(fv.bull.hi)}</bdi></b>`});
    if(fv.bear)liq.push({t:`فجوة FVG هابطة غير ممتلئة <b class="num"><bdi dir="ltr">${V3.f(fv.bear.lo)} – ${V3.f(fv.bear.hi)}</bdi></b>`});
    const sc=(p,dd)=>{if(!p)return null;const t1=p.tps[0],t2=p.tps[1],up=dd>0;
      return{lo:f(p.lo),hi:f(p.hi),sl:f(p.sl),tps:p.tps.slice(0,3).map(t=>f(t.p)),rr:t2?+t2.r.toFixed(1):null,rr1:t1?+t1.r.toFixed(1):null,type:p.type,
        trig:p.type==="limit"?`${up?"ارتداد صاعد":"رفض هابط"} من منطقة ${V3.f(p.lo)} – ${V3.f(p.hi)} بإغلاق شمعة ${S.tf}`:`استمرار ${up?"فوق":"تحت"} ${V3.f(up?p.lo:p.hi)} (دخول من السعر الحالي)`,
        inv:`إغلاق شمعة ${S.tf} ${up?"تحت":"فوق"} ${V3.f(p.sl)}`,pref:!!(S.plan&&S.plan.d===dd)}};
    const I=A.I,e=A.e,why=[];
    if(I.rsi[e]!=null)why.push(`RSI ${I.rsi[e].toFixed(0)}`);if(I.adx[e]!=null)why.push(`ADX ${I.adx[e].toFixed(0)} (${I.adx[e]>=25?"ترند قوي":"ترند ضعيف"})`);
    if(I.hist[e]!=null)why.push(`هيستوجرام MACD ${I.hist[e]>=0?"موجب":"سالب"}`);
    if(I.e20[e]!=null&&I.e50[e]!=null&&I.e200[e]!=null)why.push(I.e20[e]>I.e50[e]&&I.e50[e]>I.e200[e]?"المتوسطات مرتبة صعوداً":I.e20[e]<I.e50[e]&&I.e50[e]<I.e200[e]?"المتوسطات مرتبة هبوطاً":"المتوسطات متداخلة");
    const fb=A.M.wav.fib;if(fb)why.push(`فيبوناتشي من ${V3.f(fb.start)} إلى ${V3.f(fb.end)}`);
    ["tim","num"].forEach(k=>{const kv=(A.M[k].kv||[])[0];if(kv)why.push(`${kv[0]}: ${kv[1]}`)});
    why.push(`${ag.n} شمعة ${S.tf}`);
    const agents=Object.keys(A.M).map(k=>{const m=A.M[k],st=m.s>=15?1:m.s<=-15?-1:0,its=(m.items||[]).filter(x=>x.v&&(st?Math.sign(x.v)===st:true)).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
      return{k,n:NAMES[k]||k,st,c:Math.min(100,Math.round(Math.abs(m.s))),w:W[k],r:its.slice(0,2).map(x=>x.t)}});
    const vd=S.plan?S.plan.d:0;
    return{sym:S.sym.s,name:S.sym.n,tf:S.tf,dec:S.sym.dec,px:f(px),src:ag.sim?"sim":S.src,age:ag.m,stale:ag.stale,n:ag.n,
      d,bull,bear,total:A.total,sup:sup?{lo:f(sup.lo),hi:f(sup.hi),n:sup.n}:null,res:res?{lo:f(res.lo),hi:f(res.hi),n:res.n}:null,
      ag:AG.slice(0,4).map(x=>({t:x.t,s:x.s})),cf:CF.slice(0,3).map(x=>({t:x.t,s:x.s})),liq:liq.slice(0,4),
      bullS:sc(S.altB,1),bearS:sc(S.altS,-1),why,agents,verdict:{d:vd,pct:S.pct??null}}},
  ctx(mode,c){const base=aiContext(),p=V3.pubFor(S.sym.s);
    const strip=t=>String(t||"").replace(/<[^>]+>/g,"");
    return{...base,card:c?{sym:c.sym,tf:c.tf,px:c.px,d:c.d,bull:c.bull,bear:c.bear,sup:c.sup,res:c.res,bullS:c.bullS,bearS:c.bearS,liq:c.liq,ag:c.ag,cf:c.cf,why:c.why,src:c.src,age:c.age,stale:c.stale,n:c.n,dec:c.dec,name:c.name,agents:mode==="agents"?c.agents:undefined,verdict:c.verdict}:null,
      scenarios:c?{bullish:c.bullS&&{trigger:c.bullS.trig,entry_zone:[c.bullS.lo,c.bullS.hi],invalidation:c.bullS.inv,stop:c.bullS.sl,targets:c.bullS.tps,risk_reward_tp2:c.bullS.rr,engine_prefers:c.bullS.pref},
        bearish:c.bearS&&{trigger:c.bearS.trig,entry_zone:[c.bearS.lo,c.bearS.hi],invalidation:c.bearS.inv,stop:c.bearS.sl,targets:c.bearS.tps,risk_reward_tp2:c.bearS.rr,engine_prefers:c.bearS.pref}}:null,
      liquidity:c&&c.liq.length?c.liq.map(x=>strip(x.t)):"not available in current data",
      published_signal:p?{side:p.side,timeframe:p.tf,published:p.sig_time,status:p.status_label||p.status,quality:p.qscore??undefined}:null,
      agents:mode==="agents"&&c?c.agents.map(a=>({school:a.n,stance:a.st>0?"buy":a.st<0?"sell":"neutral",confidence:a.c,weight:a.w,reasons:a.r})):undefined,
      verdict:mode==="agents"&&c?(c.verdict.d>0?"BUY (engine consensus)":c.verdict.d<0?"SELL (engine consensus)":"WAIT: no sufficient consensus"):undefined}},
  // ---- رسم البطاقة ----
  cardHTML(c,mode){if(!c)return'<div class="v3-warn red">⛔ <b>بيانات ناقصة:</b> ما أكو شموع كافية لهذا الزوج والفريم حتى يحسب المحرك التحليل (يحتاج 220 شمعة على الأقل). جرّب فريم ثاني.</div>';
    const F=v=>fx(v,c.dec),B=(a,b)=>`<bdi dir="ltr">${F(a)} – ${F(b)}</bdi>`,tr=c.d>0?'<b class="up">▲ صاعد</b>':c.d<0?'<b class="down">▼ هابط</b>':'<b class="gold">◆ متذبذب</b>';
    const warn=c.src==="sim"?'<div class="v3-warn red">⛔ <b>أسعار محاكاة:</b> هذي مو أسعار السوق الحقيقية، فالمستويات للتوضيح بس وما تنفع للدخول.</div>'
      :c.stale?`<div class="v3-warn">⚠️ <b>البيانات قديمة:</b> آخر شمعة ${V3.ageTxt(c.age)} (السوق مسكّر أو البيانات متأخرة). التحليل للتعلّم بس، مو للدخول الحي.</div>`:"";
    const scn=(s,up)=>s?`<div class="v3-sc ${up?"up":"down"}"><h4>${up?"▲ السيناريو الصاعد":"▼ السيناريو الهابط"}${s.pref?' <span class="chip">يرجّحه المحرك</span>':""}</h4>
      <p><b>شرط التفعيل:</b> ${esc(s.trig)}</p><p><b>الأهداف:</b> <bdi dir="ltr" class="num">${s.tps.map(F).join(" · ")}</bdi></p><p><b>الإبطال:</b> ${esc(s.inv)}</p>
      ${s.rr?`<p class="rr">العائد للمخاطرة <b><bdi dir="ltr">1 : ${s.rr}</bdi></b> <small>(للهدف 2)</small></p>`:""}</div>`:"";
    const ag=mode==="agents"&&c.agents?`<div class="v3-ags">${c.agents.map(a=>`<div class="v3-ag ${a.st>0?"up":a.st<0?"down":""}"><span>${esc(a.n)}</span><b>${a.st>0?"▲ شراء":a.st<0?"▼ بيع":"◆ محايد"}</b><i><em style="width:${a.c}%"></em></i><small>${a.r.map(esc).join(" · ")||"ما عنده إشارة واضحة"}</small></div>`).join("")}</div>
      <div class="v3-judge">⚖️ <b>حكم الحَكَم (إجماع المحرك الموزون):</b> ${c.verdict.d>0?'<b class="up">شراء</b>':c.verdict.d<0?'<b class="down">بيع</b>':'<b class="gold">انتظار، ما في إجماع كافي</b>'} <small>· النتيجة الكلية <bdi dir="ltr">${c.total>0?"+":""}${c.total}</bdi></small></div>`:"";
    return`<div class="v3-card">${warn}<div class="v3-src"><span>📊 من محرك المنصة · <bdi dir="ltr">${esc(c.sym)} · ${esc(c.tf)} · ${F(c.px)}</bdi> · ${V3.ageTxt(c.age)}</span><span class="chip gold">📘 تحليل تعليمي، مو توصية منشورة</span></div>
      ${ag}
      <div class="v3-sum"><div class="v2-t"><span>الاتجاه العام</span>${tr}<small>${c.d>0?c.bull:c.d<0?c.bear:Math.max(c.bull,c.bear)} من 6 مدارس</small></div>
        <div class="v2-t"><span>نتيجة المحرك</span><b class="num"><bdi dir="ltr">${c.total>0?"+":""}${c.total}</bdi></b><small>من −100 إلى +100</small></div>
        <div class="v2-t"><span>أقرب دعم</span><b class="num">${c.sup?B(c.sup.lo,c.sup.hi):"—"}</b><small>${c.sup?c.sup.n+" لمسات":"ما متوفر"}</small></div>
        <div class="v2-t"><span>أقرب مقاومة</span><b class="num">${c.res?B(c.res.lo,c.res.hi):"—"}</b><small>${c.res?c.res.n+" لمسات":"ما متوفر"}</small></div></div>
      <div class="v3-two"><div class="v2-t"><span>✓ نقاط الاتفاق</span><ul>${c.ag.map(x=>`<li>${x.t} <small>${esc(x.s)}</small></li>`).join("")||"<li>—</li>"}</ul></div>
        <div class="v2-t"><span>⚠ نقاط التعارض</span><ul>${c.cf.map(x=>`<li>${x.t} <small>${esc(x.s)}</small></li>`).join("")||"<li>ما أكو تعارض مهم</li>"}</ul></div></div>
      <div class="v2-t"><span>💧 مناطق السيولة (Smart Money)</span><ul>${c.liq.map(x=>`<li>${x.t}</li>`).join("")||"<li>ما متوفرة بالبيانات الحالية</li>"}</ul></div>
      <div class="v3-two">${scn(c.bullS,1)}${scn(c.bearS,0)}</div>
      <details class="v3-why"><summary>🔍 ليش هيچ؟ البيانات المستخدمة</summary><p>${c.why.map(esc).join(" · ")}</p></details></div>`},
  pubHTML(){const p=V3.pubFor(S.sym.s);return p?`<div class="v3-pub">📣 أكو <b>توصية منشورة</b> على <bdi dir="ltr">${esc(p.sym)} ${esc(p.tf)}</bdi> ${ago(p.sig_time)} (${p.side==="buy"?"شراء":"بيع"}${p.qscore!=null?` · ⭐ ${p.qscore}/100`:""}${p.status_label?" · "+esc(p.status_label):""}). <a href="#record" data-go="record">افتح السجل</a></div>`:""},
  disc:'<p class="v3-disc">⚠️ تحليل تعليمي من بيانات المنصة، مو نصيحة مالية ولا نسبة نجاح مضمونة. التزم بالوقف ولا تخاطر بأكثر من 1–2% بالصفقة.</p>',
  // ---- صفحة AI PRO ----
  async aiPage(){const el=$("v3AiBody");if(V3.locked(el))return;if(!V3.lang)V3.lang=(window.LANG&&window.LANG!=="ar")?window.LANG:"iq";
    if(!el.dataset.ok){el.dataset.ok=1;el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl"><span class="v3-logo">🤖</span><div><h2>VEXORA AI PRO</h2><p>مساعد التحليل: يقرا محرك المنصة بالمدارس الست ويشرحلك. تعليمي، مو نصيحة مالية.</p></div></div>
      <div class="v3-ctl"><label>الأصل<select id="v3Sym">${SYMS.map(x=>`<option value="${esc(x.s)}">${esc(x.n)} · ${esc(x.s)}</option>`).join("")}</select></label>
        <label>الفريم<div class="v3-tf" id="v3Tf">${["M15","H1","H4","D1"].map(t=>`<button type="button" data-t="${t}">${t}</button>`).join("")}</div></label>
        <label>اللغة<select id="v3Lang" data-noi18n><option value="iq">عراقي</option><option value="ar">العربية الفصحى</option><option value="en">English</option><option value="fr">Français</option><option value="de">Deutsch</option></select></label>
        <label>الوضع<div class="v3-tf" id="v3Mode"><button type="button" data-m="pro">🧠 تحليل متقدم</button><button type="button" data-m="agents">⚖️ نقاش الوكلاء</button></div></label>
        <button class="btn primary" type="button" id="v3New">＋ تحليل جديد</button></div>
      <div class="v3-st" id="v3St"></div></div>
      <div class="v3-grid"><aside class="panel v3-hist"><div class="v3-hh"><b>💬 محادثاتي</b><input id="v3Find" placeholder="🔎 بحث"></div><div id="v3List"></div>
        <p class="v3-note">المحادثات تنحفظ بحسابك بس وما يشوفها غيرك. تكدر تمسح أي محادثة 🗑. تنمسح تلقائياً بعد 180 يوم.</p></aside>
        <section class="panel v3-chat"><div id="v3Msgs" class="v3-msgs"></div>
          <div class="v3-in"><div class="v3-chips" id="v3Chips"></div><form class="v3-box" id="v3Form"><textarea id="v3Q" maxlength="600" placeholder="اسأل عن الزوج والفريم الحالي…"></textarea><button class="btn primary" type="submit" id="v3Send">إرسال</button></form></div></section></div>`;
      $("v3Sym").onchange=async e=>{await V3.switch(e.target.value,S.tf)};
      $("v3Tf").onclick=async e=>{const b=e.target.closest("[data-t]");if(b)await V3.switch(S.sym.s,b.dataset.t)};
      $("v3Mode").onclick=e=>{const b=e.target.closest("[data-m]");if(!b)return;V3.mode=b.dataset.m;V3.hdr();if(!V3.chat)V3.welcome()};
      $("v3Lang").onchange=e=>{V3.lang=e.target.value};
      $("v3New").onclick=()=>V3.newDlg();
      $("v3Find").oninput=e=>{V3.q=e.target.value.trim();V3.list()};
      $("v3Form").onsubmit=e=>{e.preventDefault();V3.ask($("v3Q").value)};
      $("v3Q").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();V3.ask($("v3Q").value)}};
      $("v3Chips").onclick=e=>{const b=e.target.closest("[data-q]");if(b)V3.ask(b.dataset.q)};
      $("v3List").onclick=async e=>{const d=e.target.closest("[data-del]");if(d){e.stopPropagation();return V3.del(+d.dataset.del)}const a=e.target.closest("[data-chat]");if(a)V3.open(+a.dataset.chat)};
      $("v3Msgs").onclick=e=>{const b=e.target.closest("[data-draw]");if(b)V3.draw()}}
    $("v3Lang").value=V3.lang;if(!S.A&&S.candles.length===0)await load();await V3.loadPub();V3.hdr();V3.chips();await V3.loadChats();if(V3.chat)V3.open(V3.chat);else V3.welcome()},
  async switch(sym,tf){$("v3Msgs").classList.add("loading");try{await V3.ensure(sym,tf)}finally{$("v3Msgs").classList.remove("loading")}V3.hdr();if(!V3.chat)V3.welcome();else V3.toast(`صار التحليل على ${S.sym.s} ${S.tf}. السؤال الجاي يستخدم البيانات الجديدة.`)},
  async hdr(){$("v3Sym").value=S.sym.s;$("v3Tf").querySelectorAll("[data-t]").forEach(b=>b.classList.toggle("on",b.dataset.t===S.tf));$("v3Mode").querySelectorAll("[data-m]").forEach(b=>b.classList.toggle("on",b.dataset.m===V3.mode));
    const a=V3.age();let st=null;try{st=await DB.aiStatus()}catch(e){}
    $("v3St").innerHTML=`<span class="chip ${a.sim?"down":a.stale?"gold":"up"}">${a.sim?"🔴 أسعار محاكاة":a.stale?"🟠 بيانات قديمة":"🟢 بيانات حية"} · آخر تحديث ${V3.ageTxt(a.m)}</span>${st?`<span class="chip">الاستخدام اليوم <bdi dir="ltr">${st.used} / ${st.limit}</bdi></span>`:""}<span class="chip gold">📘 تحليل تعليمي</span>${V3.pubFor(S.sym.s)?'<span class="chip acc">📣 أكو توصية منشورة على هذا الزوج</span>':""}`},
  chips(){const Q=V3.mode==="agents"?["خلّي الوكلاء يتناقشون على الزوج الحالي","ليش الحكم هيچ؟","منو المخالف وليش؟"]:["📈 حلّل الزوج الحالي والسيناريوهات","💧 وين السيولة؟","🌊 عدّ الموجات","⏱ شنو يكول التحليل الزمني؟","🧱 أهم الدعوم والمقاومات"];
    $("v3Chips").innerHTML=Q.map(q=>`<button type="button" data-q="${escA(q.replace(/^[^\p{L}\p{N}]+/u,""))}">${esc(q)}</button>`).join("")},
  welcome(){V3.chips();const c=V3.card();$("v3Msgs").innerHTML=`<div class="v3-msg v3-a"><p style="margin:0">أهلاً ${esc((ME.profile&&ME.profile.full_name||"").split(" ")[0])} 👋 هذا <b>التحليل الهيكلي</b> من محرك المنصة لـ <bdi dir="ltr">${esc(S.sym.s)} · ${esc(S.tf)}</bdi>. ببلاش وما ينحسب من أسئلتك. اسأل تحت حتى أشرحه بالتفصيل.</p>
    ${V3.cardHTML(c,V3.mode)}${V3.pubHTML()}<div class="v3-act"><button type="button" class="btn v2s" data-draw>📐 ارسم المستويات على شارت المنصة</button></div>${V3.disc}</div>`},
  newDlg(){const m=$("mdl"),c=$("mdlC");c.innerHTML=`<h3 style="margin:0 0 10px">＋ تحليل جديد</h3><div class="v3-fm"><label>الأصل<select id="v3nS">${SYMS.map(x=>`<option value="${esc(x.s)}"${x===S.sym?" selected":""}>${esc(x.n)} · ${esc(x.s)}</option>`).join("")}</select></label>
      <label>الفريم<select id="v3nT">${["M15","H1","H4","D1"].map(t=>`<option${t===S.tf?" selected":""}>${t}</option>`).join("")}</select></label>
      <label>الوضع<select id="v3nM"><option value="pro">🧠 تحليل متقدم (المدارس الست)</option><option value="agents"${V3.mode==="agents"?" selected":""}>⚖️ نقاش الوكلاء الستة + حكم موحّد</option></select></label></div>
      <p class="label" style="font-size:12.5px">يبدي محادثة جديدة بالبيانات الحالية للزوج. أول سؤال تسأله ينحسب من استخدامك اليومي.</p><button class="btn primary" type="button" id="v3nGo" style="width:100%">ابدأ</button>`;
    m.hidden=false;$("v3nGo").onclick=async()=>{m.hidden=true;V3.chat=null;V3.mode=$("v3nM").value;await V3.switch($("v3nS").value,$("v3nT").value);V3.list();V3.welcome();$("v3Q").focus()}},
  async loadChats(){try{V3.chats=await DB.aiChats()||[]}catch(e){V3.chats=[];$("v3List").innerHTML=`<p class="down" style="font-size:12.5px">${esc(e.message)} (شغّل vexora_v3.sql)</p>`;return}V3.list()},
  list(){const q=V3.q.toLowerCase(),L=V3.chats.filter(c=>!q||(c.title+" "+c.sym).toLowerCase().includes(q));
    $("v3List").innerHTML=L.map(c=>`<a class="${c.id===V3.chat?"on":""}" data-chat="${c.id}"><b>${c.mode==="agents"?"⚖️ ":""}${c.sym?`<bdi dir="ltr">${esc(c.sym)} ${esc(c.tf)}</bdi>: `:""}${esc(c.title)}</b><small>${ago(c.updated_at)}</small><button type="button" class="v3-del" data-del="${c.id}" title="مسح المحادثة" aria-label="مسح المحادثة">🗑</button></a>`).join("")||'<p class="label" style="font-size:12.5px;margin:4px 0">ما عندك محادثات بعد.</p>'},
  async open(id){V3.chat=id;V3.list();const box=$("v3Msgs");box.innerHTML='<p class="label">جاري التحميل…</p>';let L=[];try{L=await DB.aiMsgs(id)||[]}catch(e){box.innerHTML=`<p class="down">${esc(e.message)}</p>`;return}
    const ch=V3.chats.find(c=>c.id===id);if(ch)V3.mode=ch.mode||"pro";V3.hdr();V3.chips();
    box.innerHTML=L.map(m=>V3.msgHTML(m)).join("")||'<p class="label">المحادثة فارغة.</p>';L.filter(m=>m.status==="pending"&&m.req_id).forEach(m=>V3.poll(m.req_id));box.scrollTop=1e9},
  msgHTML(m){if(m.role==="user")return`<div class="v3-msg v3-u">${esc(m.content)}</div>`;const c=m.meta&&m.meta.card;
    return`<div class="v3-msg v3-a" data-aid="${m.req_id||""}">${c?V3.cardHTML(c,m.meta.mode):""}<div class="v3-ans">${m.status==="pending"?'<span class="v3-dots">المساعد يكتب<i>.</i><i>.</i><i>.</i></span>':m.status==="error"?`<span class="down">${esc(m.content)}</span>`:mdLite(m.content)}</div>${c?V3.disc:""}</div>`},
  async ask(q){q=String(q||"").trim();if(!q||V3.busy)return;if(!S.A){V3.toast("التحليل بعده ما جاهز. انتظر ثواني.",1);return}V3.busy=true;$("v3Send").disabled=true;
    const c=V3.card(),ctx=V3.ctx(V3.mode,c),box=$("v3Msgs");if(!V3.chat)box.innerHTML="";
    box.insertAdjacentHTML("beforeend",`<div class="v3-msg v3-u">${esc(q)}</div><div class="v3-msg v3-a" id="v3Pend">${V3.cardHTML(c,V3.mode)}${V3.pubHTML()}<div class="v3-ans"><span class="v3-dots">المساعد يكتب<i>.</i><i>.</i><i>.</i></span></div><div class="v3-act"><button type="button" class="btn v2s" data-draw>📐 ارسم المستويات على شارت المنصة</button></div>${V3.disc}</div>`);
    box.scrollTop=1e9;$("v3Q").value="";
    try{const r=await DB.aiPro(V3.chat,q,ctx,V3.lang,V3.mode);V3.chat=r.chat;$("v3Pend").dataset.aid=r.aid;$("v3Pend").removeAttribute("id");V3.loadChats();V3.poll(r.aid);V3.hdr()}
    catch(e){const p=$("v3Pend");if(p){p.querySelector(".v3-ans").innerHTML=`<div class="v3-warn gold">🔒 ${esc(V3.err(e))}${/AI_FREE_LIMIT/.test(e.message)?' <a href="index.html#buy-ai">اشترك بالمساعد</a>':""}</div><p class="label" style="font-size:12.5px;margin:6px 0 0">التحليل الهيكلي فوق محسوب من المحرك ومتاح دايماً حتى بدون أسئلة.</p>`;p.removeAttribute("id")}}
    finally{V3.busy=false;$("v3Send").disabled=false}},
  async poll(aid){for(let k=0;k<50;k++){let r;try{r=await DB.aiResult(aid)}catch(e){r={status:"error",answer:e.message}}
      const el=document.querySelector(`.v3-msg[data-aid="${aid}"] .v3-ans`);
      if(r.status!=="pending"){if(el)el.innerHTML=r.status==="done"?mdLite(r.answer):`<span class="down">${esc(r.answer)}</span>`;return}await new Promise(z=>setTimeout(z,2000))}},
  async del(id){if(!confirm("تمسح هذي المحادثة نهائياً؟ ما تكدر ترجعها."))return;try{await DB.aiDelChat(id);if(V3.chat===id){V3.chat=null;V3.welcome()}V3.chats=V3.chats.filter(c=>c.id!==id);V3.list();V3.toast("🗑 انمسحت المحادثة")}catch(e){V3.toast(e.message,1)}},
  // ---- ربط الشارت ----
  levels(c){if(!c)return[];const L=[],a=css("--accent"),b=css("--buy"),s=css("--sell");
    if(c.bullS){L.push({p:c.bullS.hi,c:a,t:"تفعيل ▲"},{p:c.bullS.sl,c:s,t:"إبطال ▲"});c.bullS.tps.slice(0,2).forEach((t,k)=>L.push({p:t,c:b,t:"هدف ▲"+(k+1)}))}
    if(c.bearS){L.push({p:c.bearS.lo,c:a,t:"تفعيل ▼"},{p:c.bearS.sl,c:s,t:"إبطال ▼"});c.bearS.tps.slice(0,2).forEach((t,k)=>L.push({p:t,c:s,t:"هدف ▼"+(k+1)}))}
    if(c.sup)L.push({p:(c.sup.lo+c.sup.hi)/2,c:"#5b8def",t:"دعم"});if(c.res)L.push({p:(c.res.lo+c.res.hi)/2,c:"#5b8def",t:"مقاومة"});return L},
  draw(){const c=V3.card();if(!c)return;V3.lines={sym:c.sym,tf:c.tf,L:V3.levels(c)};location.hash="";setTimeout(()=>{try{drawChart(false)}catch(e){}V3.chartBar();const el=$("chart");if(el)el.scrollIntoView({block:"center"})},350)},
  chartBar(){let bar=$("v3CBar");const host=$("chart");if(!host)return;if(!bar){bar=document.createElement("div");bar.id="v3CBar";bar.className="v3-cbar";host.parentNode.insertBefore(bar,host)}
    const on=V3.lines&&V3.lines.sym===S.sym.s&&V3.lines.tf===S.tf;
    bar.innerHTML=on?`<span class="chip">🤖 المستويات مرسومة من AI PRO (${V3.lines.L.length} خط)</span><button type="button" class="btn v2s" id="v3Hide">إخفاء الخطوط</button><a class="btn v2s" href="#ai" data-go="ai">💬 افتح AI PRO</a>`
      :`<button type="button" class="btn v2s" id="v3Ana">⚡ حلّل الزوج والفريم الحالي بـ AI PRO</button>`;
    const h=$("v3Hide");if(h)h.onclick=()=>{V3.lines=null;drawChart(false);V3.chartBar()};const an=$("v3Ana");if(an)an.onclick=()=>{V3.chat=null;location.hash="ai"}},
  cvLevels(){const el=$("v3Cv");if(!el)return;const c=V3.card();if(!c){el.innerHTML="";return}const F=v=>fx(v,c.dec),L=V3.levels(c);
    el.innerHTML=`<div class="v3-cvh"><b>🤖 مستويات AI PRO · <bdi dir="ltr">${esc(c.sym)} ${esc(c.tf)}</bdi></b><span class="label" style="font-size:11.5px">${V3.ageTxt(c.age)}</span></div>
      <div class="v2-t" style="margin:6px 0"><span>الخلاصة</span>${c.d>0?'<b class="up">▲ صاعد':c.d<0?'<b class="down">▼ هابط':'<b class="gold">◆ متذبذب'} (${Math.max(c.bull,c.bear)} من 6)</b></div>
      <div class="v3-lv">${L.map(l=>`<div><i style="background:${l.c}"></i>${esc(l.t)}<b class="num">${F(l.p)}</b></div>`).join("")}</div>
      <p class="v3-note">شارت TradingView المدمج ما يسمح بالرسم عليه من برا، فالمستويات هنا كقائمة. ارسمها بنفسك أو <a class="gold" href="#" data-v3draw>اعرضها مرسومة على شارت المنصة</a>.</p>
      <a class="btn v2s" href="#ai" data-go="ai" style="width:100%;text-align:center;text-decoration:none;display:block;margin-top:6px">💬 افتح المحادثة الكاملة</a>`;
    const d=el.querySelector("[data-v3draw]");if(d)d.onclick=e=>{e.preventDefault();V3.draw()}},
  // ---- إدارة المساعد (للمدير) ----
  async usage(){const el=$("v3Use");if(!el||!isAdminUser())return;let u=null;try{u=await DB.aiUsage()}catch(e){el.innerHTML=`<p class="down" style="font-size:12.5px">${esc(e.message)} (شغّل vexora_v3.sql)</p>`;return}
    let c={};try{c=await DB.getConfig()}catch(e){}const pc=u.cap>0?Math.min(100,Math.round(u.month_cost/u.cap*100)):0,mx=Math.max(1,...u.days.map(d=>d.n));
    el.innerHTML=`<h3 style="font-size:14px;margin:14px 0 6px">📊 استخدام AI PRO والكلفة</h3><div class="v3-sum"><div class="v2-t"><span>أسئلة آخر 24 ساعة</span><b class="num">${u.today}</b><small>${u.today_users} عضو</small></div><div class="v2-t"><span>أسئلة هذا الشهر</span><b class="num">${u.month}</b></div>
      <div class="v2-t"><span>الكلفة التقديرية هذا الشهر</span><b class="num ${pc>=100?"down":pc>=80?"gold":""}">$${(+u.month_cost).toFixed(2)}</b><div class="v2-pbar" style="margin-top:4px"><i style="width:${pc}%"></i></div></div><div class="v2-t"><span>سقف الكلفة الشهري</span><b class="num">$${u.cap}</b><small>${pc}% مستخدم</small></div></div>
      <div class="v3-bars">${u.days.map(d=>`<div title="${esc(d.d)}: ${d.n}"><i style="height:${Math.round(d.n/mx*100)}%"></i><small>${new Date(d.d).getDate()}</small></div>`).join("")}</div>
      <div class="v3-two"><div class="v2-t"><span>حسب النوع</span><ul>${u.by_kind.map(k=>`<li>${({chat:"مساعد الشارت",pro:"AI PRO",agents:"نقاش الوكلاء",mentor:"المرشد"})[k.kind]||esc(k.kind)}: <b class="num">${k.n}</b> · $${k.cost}</li>`).join("")||"<li>—</li>"}</ul></div>
        <div class="v2-t"><span>أكثر الأعضاء استخداماً</span><ul>${u.top.map(t=>`<li>${esc(t.name)}: <b class="num">${t.n}</b> · $${t.cost}</li>`).join("")||"<li>—</li>"}</ul></div></div>
      <div class="fm" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));align-items:end;margin-top:10px">
        <label>سقف الكلفة الشهري $<input id="v3Cap" type="number" min="0" step="1" class="ltr" value="${escA(c.ai_month_cap||"40")}"></label>
        <label>سعر مليون توكن داخل $<input id="v3Pi" type="number" min="0" step="0.01" class="ltr" value="${escA(c.ai_price_in||"1")}"></label>
        <label>سعر مليون توكن طالع $<input id="v3Po" type="number" min="0" step="0.01" class="ltr" value="${escA(c.ai_price_out||"5")}"></label>
        <label>حذف المحادثات بعد (يوم)<input id="v3Keep" type="number" min="7" max="730" class="ltr" value="${escA(c.ai_keep_days||"180")}"></label>
        <button class="btn" type="button" id="v3UseSave">حفظ الحدود</button></div>
      <p class="v3-note">إذا الكلفة وصلت السقف: المساعد يوكف للأعضاء لحاله (المدير يبقى يشتغل) ويوصلك تنبيه بتيليجرام الخاص عند 80% و100%. الكلفة تقديرية حسب التوكنات، راجع فاتورة Anthropic للرقم الدقيق.</p>`;
    $("v3UseSave").onclick=async()=>{try{await DB.setConfig("ai_month_cap",String(Math.max(0,+$("v3Cap").value||0)),false);await DB.setConfig("ai_price_in",String(+$("v3Pi").value||0),false);await DB.setConfig("ai_price_out",String(+$("v3Po").value||0),false);await DB.setConfig("ai_keep_days",String(Math.min(730,Math.max(7,+$("v3Keep").value||180))),false);V3.toast("✅ انحفظت حدود المساعد");V3.usage()}catch(e){V3.toast(e.message,1)}}},

  // ================= بناء الاستراتيجيات =================
  CONDS:{rsi_lt:["RSI أقل من",30,1],rsi_gt:["RSI أكبر من",70,1],above_ema:["السعر فوق EMA",200,2],below_ema:["السعر تحت EMA",200,2],ema_up:["EMA20 تقطع EMA50 لفوق",null],ema_down:["EMA20 تقطع EMA50 لجوّه",null],
    macd_up:["MACD يقطع الإشارة لفوق",null],macd_down:["MACD يقطع الإشارة لجوّه",null],adx_gt:["ADX أكبر من",25,1],stoch_lt:["ستوكاستك أقل من",20,1],stoch_gt:["ستوكاستك أكبر من",80,1],brk_hi:["اختراق أعلى قمة لآخر N شمعة",20,3],brk_lo:["كسر أدنى قاع لآخر N شمعة",20,3]},
  st:{rules:null,res:null,list:[]},
  defRules(){return{name:"ارتداد RSI مع الترند",sym:S.sym.s,tf:"H1",dir:1,conds:[{k:"above_ema",v:200},{k:"rsi_lt",v:35}],sl:1.5,tp:2,hold:48}},
  async stratPage(){const el=$("v3StBody");if(V3.locked(el))return;if(!V3.st.rules)V3.st.rules=V3.defRules();V3.stForm();V3.stList()},
  stForm(){const r=V3.st.rules,el=$("v3StBody"),C=V3.CONDS;
    el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl"><span class="v3-logo">🧪</span><div><h2>بناء الاستراتيجيات</h2><p>ركّب شروطك بدون كود، واختبرها على الشموع التاريخية المخزّنة بالسيرفر، مع حساب السبريد.</p></div></div></div>
      <div class="v3-grid2"><section class="panel"><div class="v3-fm"><label>اسم الاستراتيجية<input id="stN" maxlength="80" value="${escA(r.name)}"></label>
        <label>الأصل<select id="stS">${SYMS.map(x=>`<option value="${esc(x.s)}"${x.s===r.sym?" selected":""}>${esc(x.n)} · ${esc(x.s)}</option>`).join("")}</select></label>
        <label>الفريم<select id="stT">${["M15","H1","H4","D1"].map(t=>`<option${t===r.tf?" selected":""}>${t}</option>`).join("")}</select></label>
        <label>الاتجاه<select id="stD"><option value="1"${r.dir>0?" selected":""}>▲ شراء</option><option value="-1"${r.dir<0?" selected":""}>▼ بيع</option></select></label></div>
        <h4 class="v3-h4">شروط الدخول (لازم كلها تتحقق)</h4><div id="stC">${r.conds.map((c,i)=>`<div class="v3-cond"><span class="num">${i+1}</span><select data-ck="${i}">${Object.entries(C).map(([k,v])=>`<option value="${k}"${k===c.k?" selected":""}>${esc(v[0])}</option>`).join("")}</select>${C[c.k][1]!=null?`<input type="number" data-cv="${i}" value="${escA(c.v??C[c.k][1])}" class="ltr">`:'<span class="label" style="font-size:12px">بدون رقم</span>'}<button type="button" class="v3-del" data-cx="${i}" aria-label="شيل الشرط">✕</button></div>`).join("")}</div>
        ${r.conds.length<5?'<button type="button" class="btn v2s" id="stAdd">＋ شرط</button>':""}
        <h4 class="v3-h4">الخروج وإدارة الصفقة</h4><div class="v3-fm"><label>الوقف = ATR ×<input id="stSl" type="number" min="0.3" max="6" step="0.1" value="${r.sl}" class="ltr"></label><label>الهدف = R ×<input id="stTp" type="number" min="0.5" max="10" step="0.1" value="${r.tp}" class="ltr"></label><label>أقصى مدة (شموع)<input id="stH" type="number" min="3" max="500" value="${r.hold}" class="ltr"></label></div>
        <div class="v3-act"><button class="btn primary" type="button" id="stRun">▶ اختبر على التاريخ</button><button class="btn" type="button" id="v3sSave">💾 احفظ</button></div>
        <p class="v3-note">الدخول على افتتاح الشمعة اللي بعد الإشارة، والسبريد التقديري محسوب على كل صفقة. إذا الوقف والهدف انضربوا بنفس الشمعة نحسبها وقف (الحالة الأسوأ). النتائج التاريخية ما تضمن نتائج مستقبلية.</p></section>
        <section class="panel" id="stOut"><p class="label">اضغط «اختبر على التاريخ» حتى تطلع النتائج.</p></section></div>
      <section class="panel"><h3 style="margin:0 0 8px;font-size:15px">📁 استراتيجياتي</h3><div id="stList" class="v3-slist"></div></section>`;
    const sync=()=>{r.name=$("stN").value.trim()||"استراتيجيتي";r.sym=$("stS").value;r.tf=$("stT").value;r.dir=+$("stD").value;r.sl=+$("stSl").value||1.5;r.tp=+$("stTp").value||2;r.hold=Math.round(+$("stH").value||48);
      el.querySelectorAll("[data-ck]").forEach(s=>{const i=+s.dataset.ck;if(r.conds[i].k!==s.value){r.conds[i]={k:s.value,v:C[s.value][1]}}});el.querySelectorAll("[data-cv]").forEach(s=>{r.conds[+s.dataset.cv].v=+s.value})};
    el.querySelectorAll("[data-ck]").forEach(s=>s.onchange=()=>{sync();V3.stForm();V3.stList()});
    el.onclick=e=>{const x=e.target.closest("[data-cx]");if(x){sync();r.conds.splice(+x.dataset.cx,1);V3.stForm();V3.stList()}};
    const add=$("stAdd");if(add)add.onclick=()=>{sync();r.conds.push({k:"macd_up",v:null});V3.stForm();V3.stList()};
    $("stRun").onclick=async()=>{sync();await V3.stRun()};$("v3sSave").onclick=async()=>{sync();await V3.stSave()};
    if(V3.st.res)V3.stShow(V3.st.res)},
  async stRun(){const r=V3.st.rules,out=$("stOut");if(!r.conds.length)return V3.toast("ضيف شرط واحد على الأقل",1);out.innerHTML='<p class="label">جاري الاختبار على الشموع…</p>';
    const sym=SYMS.find(x=>x.s===r.sym)||S.sym;let c;try{c=await getData(sym,r.tf,false)}catch(e){out.innerHTML=`<p class="down">${esc(e.message)}</p>`;return}
    const cs=c.data,I=indicators(cs),n=cs.length,d=r.dir,spr=(SPR[sym.s]||1.5)*sym.pip,T=[];
    const ok=(i)=>r.conds.every(q=>{const v=q.v;switch(q.k){case"rsi_lt":return I.rsi[i]!=null&&I.rsi[i]<v;case"rsi_gt":return I.rsi[i]!=null&&I.rsi[i]>v;
      case"above_ema":{const e=I["e"+v]||I.e200;return e[i]!=null&&cs[i].close>e[i]}case"below_ema":{const e=I["e"+v]||I.e200;return e[i]!=null&&cs[i].close<e[i]}
      case"ema_up":return I.e20[i]>I.e50[i]&&I.e20[i-1]<=I.e50[i-1];case"ema_down":return I.e20[i]<I.e50[i]&&I.e20[i-1]>=I.e50[i-1];
      case"macd_up":return I.macd[i]!=null&&I.sig[i]!=null&&I.macd[i]>I.sig[i]&&I.macd[i-1]<=I.sig[i-1];case"macd_down":return I.macd[i]!=null&&I.sig[i]!=null&&I.macd[i]<I.sig[i]&&I.macd[i-1]>=I.sig[i-1];
      case"adx_gt":return I.adx[i]!=null&&I.adx[i]>v;case"stoch_lt":return I.K&&I.K[i]!=null&&I.K[i]<v;case"stoch_gt":return I.K&&I.K[i]!=null&&I.K[i]>v;
      case"brk_hi":{const N=Math.max(2,Math.round(v));if(i<N)return false;let h=-1e18;for(let j=i-N;j<i;j++)h=Math.max(h,cs[j].high);return cs[i].close>h}
      case"brk_lo":{const N=Math.max(2,Math.round(v));if(i<N)return false;let l=1e18;for(let j=i-N;j<i;j++)l=Math.min(l,cs[j].low);return cs[i].close<l}}return false});
    let i=Math.min(210,n-2);
    while(i<n-2){if(!I.atr[i]||!ok(i)){i++;continue}const en=cs[i+1].open+(d>0?spr:0),risk=r.sl*I.atr[i],sl=en-d*risk,tp=en+d*risk*r.tp;let res=null,j=i+1,ex=null;
      for(;j<n&&j<=i+r.hold;j++){const b=cs[j],bh=b.high+(d<0?spr:0),bl=b.low+(d<0?spr:0);if(d>0?b.low<=sl:bh>=sl){res=-1;ex=sl;break}if(d>0?b.high>=tp:bl<=tp){res=r.tp;ex=tp;break}}
      if(res==null){if(j>=n){break}const cl=cs[Math.min(j,n-1)].close+(d<0?spr:0);ex=cl;res=(cl-en)*d/risk}
      T.push({t:cs[i+1].time,en,ex,r:+res.toFixed(2),risk});i=j+1}
    const N=T.length,wins=T.filter(t=>t.r>0).length,gp=T.filter(t=>t.r>0).reduce((s,t)=>s+t.r,0),gl=-T.filter(t=>t.r<0).reduce((s,t)=>s+t.r,0);
    let eq=0,pk=0,dd=0,st=0,ms=0;const curve=[0];T.forEach(t=>{eq+=t.r;curve.push(eq);pk=Math.max(pk,eq);dd=Math.max(dd,pk-eq);st=t.r<0?st+1:0;ms=Math.max(ms,st)});
    V3.st.res={sym:sym.s,tf:r.tf,dir:d,src:c.src,n,from:cs[0].time,to:cs[n-1].time,trades:N,wins,wr:N?Math.round(wins/N*100):0,total:+eq.toFixed(2),avg:N?+(eq/N).toFixed(2):0,pf:gl?+(gp/gl).toFixed(2):(gp?99:0),dd:+dd.toFixed(2),streak:ms,curve,last:T.slice(-8).reverse(),spr:SPR[sym.s]||1.5,dec:sym.dec,pip:sym.pip,T};
    V3.stShow(V3.st.res)},
  stShow(R){const out=$("stOut");if(!out)return;const dt=t=>new Date(t*1000).toLocaleDateString(window.LANG||"ar",{day:"numeric",month:"short",year:"2-digit"});
    out.innerHTML=`<div class="v3-src"><span>📊 <bdi dir="ltr">${esc(R.sym)} · ${esc(R.tf)}</bdi> · ${R.n} شمعة (${dt(R.from)} ← ${dt(R.to)}) · السبريد ${R.spr} نقطة</span></div>
      ${R.src==="sim"?'<div class="v3-warn red">⛔ <b>أسعار محاكاة:</b> النتائج هنا للتجربة بس، مو على أسعار السوق الحقيقية.</div>':""}
      ${R.trades<20?`<div class="v3-warn">⚠️ <b>عينة صغيرة:</b> ${R.trades} صفقة بس. النتيجة ما يعتمد عليها إحصائياً، جرّب فريم أصغر أو شروط أقل تشدد.</div>`:""}
      <div class="v3-sum"><div class="v2-t"><span>عدد الصفقات</span><b class="num">${R.trades}</b></div><div class="v2-t"><span>نسبة الربح</span><b class="num">${R.wr}%</b><small>${R.wins} رابحة</small></div>
        <div class="v2-t"><span>صافي النتيجة</span><b class="num ${R.total>=0?"up":"down"}"><bdi dir="ltr">${R.total>0?"+":""}${R.total}R</bdi></b><small>متوسط <bdi dir="ltr">${R.avg}R</bdi></small></div><div class="v2-t"><span>معامل الربح</span><b class="num">${R.pf}</b><small>أقصى تراجع <bdi dir="ltr">${R.dd}R</bdi></small></div></div>
      ${V3.spark(R.curve)}<p class="v3-note">R = مقدار المخاطرة بالصفقة. +2R يعني ربحت ضعف اللي خاطرت بيه. أطول سلسلة خسائر: ${R.streak}.</p>
      <h4 class="v3-h4">آخر الصفقات</h4><div class="v3-tl">${R.last.map(t=>`<div><span>${dt(t.t)}</span><span class="num"><bdi dir="ltr">${fx(t.en,R.dec)} → ${fx(t.ex,R.dec)}</bdi></span><b class="num ${t.r>=0?"up":"down"}"><bdi dir="ltr">${t.r>0?"+":""}${t.r}R</bdi></b></div>`).join("")||'<p class="label">ما تحققت الشروط ولا مرة بهذي الفترة.</p>'}</div>`},
  spark(a){if(a.length<2)return"";const W_=600,H=120,mn=Math.min(...a),mx=Math.max(...a),Y=v=>H-6-(v-mn)/((mx-mn)||1)*(H-12),X=i=>i/(a.length-1)*W_;
    const d=a.map((v,i)=>(i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)).join(" "),z=Y(0);
    return`<svg class="v3-spark" viewBox="0 0 ${W_} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W_}" y1="${z}" y2="${z}" stroke="rgba(255,255,255,.15)" stroke-dasharray="4 4"/><path d="${d}" fill="none" stroke="${a.at(-1)>=0?"#34c98e":"#f0606f"}" stroke-width="2"/></svg>`},
  async stSave(){const r=V3.st.rules,R=V3.st.res;try{const row={name:r.name,sym:r.sym,tf:r.tf,rules:r,result:R&&R.sym===r.sym&&R.tf===r.tf?{trades:R.trades,wr:R.wr,total:R.total,pf:R.pf,dd:R.dd,n:R.n,at:Date.now()}:{}};
      if(r.id)await DB.stratUpd(r.id,row);else{const x=await DB.stratAdd(row);if(x&&x.id)r.id=x.id}V3.toast("💾 انحفظت الاستراتيجية");V3.stList()}catch(e){V3.toast(V3.err(e),1)}},
  async stList(){const el=$("stList");if(!el)return;try{V3.st.list=await DB.stratList()||[]}catch(e){el.innerHTML=`<p class="down" style="font-size:12.5px">${esc(e.message)}</p>`;return}
    el.innerHTML=V3.st.list.map(s=>`<div class="v3-srow${V3.st.rules&&V3.st.rules.id===s.id?" on":""}"><b>${esc(s.name)}</b><span class="label"><bdi dir="ltr">${esc(s.sym)} ${esc(s.tf)}</bdi> · ${(s.rules.conds||[]).length} شروط</span>${s.result&&s.result.trades!=null?`<span>${s.result.trades} صفقة · ربح ${s.result.wr}% · <b class="${s.result.total>=0?"up":"down"}"><bdi dir="ltr">${s.result.total>0?"+":""}${s.result.total}R</bdi></b></span>`:'<span class="label">ما اختُبرت</span>'}<button type="button" class="btn v2s" data-sl="${s.id}">فتح</button><button type="button" class="v3-del" data-sd="${s.id}" aria-label="مسح">🗑</button></div>`).join("")||'<p class="label" style="margin:0">ما عندك استراتيجيات محفوظة بعد.</p>';
    el.onclick=async e=>{const l=e.target.closest("[data-sl]"),d=e.target.closest("[data-sd]");
      if(l){const s=V3.st.list.find(x=>x.id==l.dataset.sl);V3.st.rules={...s.rules,id:s.id,name:s.name};V3.st.res=null;V3.stForm();V3.stList()}
      if(d){if(!confirm("تمسح الاستراتيجية؟"))return;try{await DB.stratDel(+d.dataset.sd);if(V3.st.rules.id==d.dataset.sd)delete V3.st.rules.id;V3.stList()}catch(err){V3.toast(err.message,1)}}}},

  // ================= ماسح السوق =================
  SC:{uni:[],rows:[],mine:[],hits:[]},
  SCOND:{price_above:"السعر يصعد فوق",price_below:"السعر ينزل تحت",rsi_above:"RSI يصعد فوق",rsi_below:"RSI ينزل تحت",ema_up:"تقاطع صاعد EMA20/50",ema_down:"تقاطع هابط EMA20/50",move_pct:"تحرّك % بآخر 20 شمعة أكثر من"},
  async scanPage(){const el=$("v3ScBody");if(V3.locked(el))return;
    el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl"><span class="v3-logo">📡</span><div><h2>ماسح السوق</h2><p>يراقب الذهب والعملات على شموع السيرفر، ويطلعلك الوضع الحالي وينبهك لما شروطك تتحقق.</p></div></div><div class="v3-st" id="scSt"></div></div>
      <section class="panel"><div class="v2-h" style="margin:0 0 8px"><h3 style="margin:0;font-size:15px">🌐 الوضع الحالي</h3><button class="btn v2s" type="button" id="scRef">↻ تحديث</button></div><div class="v3-tw"><table class="v3-tb" id="scTb"><tbody><tr><td class="label">جاري التحميل…</td></tr></tbody></table></div>
        <p class="v3-note">الأرقام محسوبة من آخر شموع محفوظة بالسيرفر (نفس اللي يستخدمها المحرك). اضغط على أي سطر حتى تحلّله بـ AI PRO.</p></section>
      <div class="v3-grid2"><section class="panel"><h3 style="margin:0 0 8px;font-size:15px">🔔 تنبيهاتي</h3><div class="v3-fm"><label>الاسم (اختياري)<input id="scN" maxlength="60" placeholder="مثلاً: ذهب فوق القمة"></label>
          <label>الزوج والفريم<select id="scU"></select></label><label>الشرط<select id="scC">${Object.entries(V3.SCOND).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("")}</select></label><label>القيمة<input id="scV" type="number" step="any" class="ltr"></label></div>
          <div class="v3-act"><button class="btn primary" type="button" id="scAdd">＋ أضف التنبيه</button></div><div id="scMine" class="v3-slist" style="margin-top:10px"></div>
          <p class="v3-note">السيرفر يفحص كل 5 دقائق، ويدزلك إشعار (وعلى التلفون إذا مفعّل الإشعارات) لحظة ما الشرط يتحقق، مرة وحدة كل 30 دقيقة كحد أقصى. ما يطلق تنبيه إذا البيانات أقدم من 3 ساعات. حد أقصى 15 تنبيه.</p></section>
        <section class="panel"><h3 style="margin:0 0 8px;font-size:15px">⚡ آخر التنبيهات اللي وصلتك</h3><div id="scHits" class="v3-tl"></div></section></div>`;
    $("scRef").onclick=()=>V3.scanLoad(true);$("scAdd").onclick=()=>V3.scanAdd();$("scC").onchange=()=>V3.scanHint();$("scU").onchange=()=>V3.scanHint();
    $("scTb").onclick=async e=>{const tr=e.target.closest("[data-u]");if(!tr)return;const[s,t]=tr.dataset.u.split("|");V3.chat=null;location.hash="ai";await V3.ensure(s,t);if($("v3Sym"))V3.aiPage()};
    $("scMine").onclick=async e=>{const t=e.target.closest("[data-st]"),d=e.target.closest("[data-sx]");try{if(t){const x=V3.SC.mine.find(m=>m.id==t.dataset.st);await DB.scanSet(x.id,{active:!x.active});V3.scanMine()}
      if(d){if(!confirm("تمسح التنبيه؟"))return;await DB.scanDel(+d.dataset.sx);V3.scanMine()}}catch(err){V3.toast(err.message,1)}};
    await V3.scanLoad();V3.scanMine()},
  async scanLoad(force){let U=[];try{U=await DB.scanUni()||[]}catch(e){$("scTb").innerHTML=`<tbody><tr><td class="down">${esc(e.message)} (شغّل vexora_v3.sql)</td></tr></tbody>`;return}
    V3.SC.uni=U;$("scU").innerHTML=U.map(u=>`<option value="${esc(u.sym)}|${esc(u.tf)}">${esc(u.sym)} · ${esc(u.tf)}</option>`).join("")||'<option value="">ما أكو بيانات بالسيرفر بعد</option>';
    const rows=[];for(const u of U){let r=null;try{r=await DB.candles(u.sym,u.tf)}catch(e){}if(!r||!r.data||r.data.length<60)continue;
      const cs=r.data.map(x=>({time:x[0],open:x[1],high:x[2],low:x[3],close:x[4]})),I=indicators(cs),e=cs.length-1,sym=SYMS.find(x=>x.s===u.sym)||{dec:5,n:u.sym};
      rows.push({sym:u.sym,tf:u.tf,n:sym.n,dec:sym.dec,px:cs[e].close,rsi:I.rsi[e],up:I.e20[e]>I.e50[e],adx:I.adx[e],chg:(cs[e].close-cs[e-20].close)/cs[e-20].close*100,age:Math.round((Date.now()-new Date(r.updated_at))/6e4)})}
    V3.SC.rows=rows;const fresh=rows.filter(r=>r.age<180).length;
    $("scSt").innerHTML=`<span class="chip ${fresh?"up":"gold"}">${fresh?"🟢":"🟠"} ${fresh} من ${rows.length} محدّثة</span><span class="chip">يفحص كل 5 دقائق</span>`;
    $("scTb").innerHTML=`<thead><tr><th>الزوج</th><th>الفريم</th><th>السعر</th><th>RSI</th><th>الترند</th><th>التغيّر (20 شمعة)</th><th>آخر تحديث</th></tr></thead><tbody>${rows.map(r=>`<tr data-u="${escA(r.sym+"|"+r.tf)}"><td><b>${esc(r.n)}</b> <small class="label ltr">${esc(r.sym)}</small></td><td class="num">${esc(r.tf)}</td><td class="num">${fx(r.px,r.dec)}</td>
      <td class="${r.rsi>=70?"down":r.rsi<=30?"up":""}"><b class="num">${r.rsi!=null?r.rsi.toFixed(0):"—"}</b>${r.rsi>=70?" <small>تشبّع شراء</small>":r.rsi<=30?" <small>تشبّع بيع</small>":""}</td><td class="${r.up?"up":"down"}">${r.up?"▲ صاعد":"▼ هابط"}${r.adx!=null?` <small class="label">ADX ${r.adx.toFixed(0)}</small>`:""}</td>
      <td class="num ${r.chg>=0?"up":"down"}"><bdi dir="ltr">${r.chg>0?"+":""}${r.chg.toFixed(2)}%</bdi></td><td class="${r.age>180?"gold":"label"}">${V3.ageTxt(r.age)}</td></tr>`).join("")||'<tr><td colspan="7" class="label">ما أكو شموع مخزّنة بالسيرفر بعد. الماسح يشتغل أول ما المحرك يحفظ أسعار.</td></tr>'}</tbody>`;V3.scanHint()},
  scanHint(){const[s,t]=($("scU").value||"|").split("|"),r=V3.SC.rows.find(x=>x.sym===s&&x.tf===t),k=$("scC").value,v=$("scV");v.disabled=k==="ema_up"||k==="ema_down";
    v.placeholder=!r?"":k.startsWith("price")?fx(r.px,r.dec):k.startsWith("rsi")?(k==="rsi_above"?"70":"30"):k==="move_pct"?"1.5":"";if(v.disabled)v.value=""},
  async scanAdd(){const[s,t]=($("scU").value||"|").split("|"),k=$("scC").value,v=$("scV").value===""?null:+$("scV").value;if(!s)return V3.toast("ما أكو زوج متوفر",1);
    if(!(k==="ema_up"||k==="ema_down")&&(v==null||!isFinite(v)))return V3.toast("اكتب القيمة",1);
    try{await DB.scanAdd({name:$("scN").value.trim(),sym:s,tf:t,cond:k,val:v});$("scN").value="";$("scV").value="";V3.toast("✅ انضاف التنبيه");V3.scanMine()}catch(e){V3.toast(/row-level/.test(e.message)?"وصلت الحد الأقصى (15 تنبيه) أو عضويتك مو مفعّلة":e.message,1)}},
  async scanMine(){try{V3.SC.mine=await DB.scans()||[];V3.SC.hits=await DB.scanHits()||[]}catch(e){$("scMine").innerHTML=`<p class="down" style="font-size:12.5px">${esc(e.message)}</p>`;return}
    $("scMine").innerHTML=V3.SC.mine.map(m=>`<div class="v3-srow${m.active?"":" off"}"><b>${m.name?esc(m.name):esc(V3.SCOND[m.cond])}</b><span class="label"><bdi dir="ltr">${esc(m.sym)} ${esc(m.tf)}</bdi> · ${esc(V3.SCOND[m.cond])}${m.val!=null?` <b class="num">${m.val}</b>`:""}</span><span class="label">${m.hits?`انطلق ${m.hits} مرة · ${ago(m.last_hit)}`:m.last_state?"✓ متحقق هسه، ينبهك بالمرة الجاية":"ينتظر"}</span><button type="button" class="btn v2s" data-st="${m.id}">${m.active?"⏸ إيقاف":"▶ تشغيل"}</button><button type="button" class="v3-del" data-sx="${m.id}" aria-label="مسح">🗑</button></div>`).join("")||'<p class="label" style="margin:0">ما عندك تنبيهات بعد.</p>';
    $("scHits").innerHTML=V3.SC.hits.map(h=>`<div><span>${ago(h.created_at)}</span><span><bdi dir="ltr">${esc(h.sym)} ${esc(h.tf)}</bdi> · ${esc(h.msg)}</span><b class="num">${h.px!=null?fx(+h.px,(SYMS.find(x=>x.s===h.sym)||{dec:5}).dec):""}</b></div>`).join("")||'<p class="label" style="margin:0">ما وصلك تنبيه بعد.</p>'},

  // ================= حارس المخاطر =================
  RK:{set:null,tr:[],corr:{}},
  valPer(s,px){const x=SYMS.find(y=>y.s===s);if(!x)return 0;if(x.q==="usd")return x.lot;if(x.q==="base")return x.lot/px;const uj=cache["USD/JPY|H1"]?.data?.at(-1)?.close||cache["USD/JPY|"+S.tf]?.data?.at(-1)?.close||153;return x.lot/uj},
  tRisk(t){return Math.abs(t.entry-t.sl)*t.lots*V3.valPer(t.sym,t.entry)},
  async riskPage(){const el=$("v3RkBody");if(V3.locked(el))return;
    el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl"><span class="v3-logo">🛡</span><div><h2>حارس المخاطر</h2><p>سجّل صفقاتك المفتوحة، ويحسبلك المخاطرة الكلية والارتباط بين الأزواج وينبهك قبل ما تتجاوز حدودك.</p></div></div></div>
      <div id="rkWarn"></div><div class="v3-sum" id="rkG"></div>
      <div class="v3-grid2"><section class="panel"><h3 style="margin:0 0 8px;font-size:15px">⚙️ حدودي</h3><div class="v3-fm"><label>رصيد الحساب $<input id="rkB" type="number" min="0" class="ltr"></label><label>مخاطرة الصفقة %<input id="rkR" type="number" min="0.1" max="10" step="0.1" class="ltr"></label>
          <label>أقصى مخاطرة مفتوحة %<input id="rkM" type="number" min="0.5" max="50" step="0.5" class="ltr"></label><label>أقصى خسارة باليوم %<input id="rkD" type="number" min="0.5" max="50" step="0.5" class="ltr"></label></div>
          <div class="v3-act"><button class="btn" type="button" id="rkSave">حفظ الحدود</button></div>
          <h3 style="margin:14px 0 8px;font-size:15px">＋ صفقة مفتوحة</h3><div class="v3-act" style="margin:0 0 8px"><button class="btn v2s" type="button" id="rkFromA">📈 من التحليل الحالي</button><button class="btn v2s" type="button" id="rkFromS">📣 من آخر توصية منشورة</button></div>
          <div class="v3-fm"><label>الزوج<select id="rkS">${SYMS.map(x=>`<option value="${esc(x.s)}">${esc(x.n)} · ${esc(x.s)}</option>`).join("")}</select></label><label>الاتجاه<select id="rkDir"><option value="1">▲ شراء</option><option value="-1">▼ بيع</option></select></label>
            <label>الدخول<input id="rkE" type="number" step="any" class="ltr"></label><label>الوقف<input id="rkSl" type="number" step="any" class="ltr"></label><label>الهدف (اختياري)<input id="rkTp" type="number" step="any" class="ltr"></label><label>اللوت<input id="rkL" type="number" min="0.01" step="0.01" class="ltr"></label></div>
          <div id="rkPrev" class="v3-prev"></div><div class="v3-act"><button class="btn primary" type="button" id="rkAdd">＋ سجّل الصفقة</button></div>
          <p class="v3-note">للمتابعة والحساب بس: المنصة ما تفتح ولا تسكّر صفقات بحسابك ولا مربوطة بالبروكر.</p></section>
        <section class="panel"><h3 style="margin:0 0 8px;font-size:15px">📂 صفقاتي المفتوحة</h3><div id="rkList" class="v3-slist"></div><h3 style="margin:14px 0 8px;font-size:15px">🔗 الارتباط بين الأزواج (H1)</h3><div id="rkCorr"></div></section></div>`;
    ["rkS","rkDir","rkE","rkSl","rkTp","rkL"].forEach(i=>$(i).addEventListener("input",()=>V3.rkPrev()));
    $("rkSave").onclick=async()=>{try{const s={user_id:ME.user.id,balance:+$("rkB").value||0,risk_pct:+$("rkR").value||1,max_total_pct:+$("rkM").value||5,max_daily_pct:+$("rkD").value||3};await DB.riskSet(s);V3.RK.set=s;V3.toast("✅ انحفظت الحدود");V3.rkRender()}catch(e){V3.toast(e.message,1)}};
    $("rkFromA").onclick=()=>{const p=S.plan||S.altB;if(!p)return V3.toast("ما في خطة بالتحليل الحالي",1);V3.rkFill(S.sym.s,p.d,p.entry,p.sl,p.tps[1]?p.tps[1].p:null)};
    $("rkFromS").onclick=async()=>{await V3.loadPub();const p=(V3.pub||[])[0];if(!p)return V3.toast("ما في توصيات منشورة حديثة",1);V3.rkFill(p.sym,p.side==="buy"?1:-1,+p.entry,+p.sl,p.tp2!=null?+p.tp2:null)};
    $("rkAdd").onclick=()=>V3.rkAdd();
    $("rkList").onclick=async e=>{const c=e.target.closest("[data-rc]"),d=e.target.closest("[data-rd]");try{if(c){const v=prompt("نتيجة الصفقة بالدولار (مثلاً -25 أو 60):","");if(v==null)return;await DB.riskUpd(+c.dataset.rc,{status:"closed",pnl:+v||0,closed_at:new Date().toISOString()});await V3.rkLoad()}
      if(d){if(!confirm("تمسح الصفقة من السجل؟"))return;await DB.riskDel(+d.dataset.rd);await V3.rkLoad()}}catch(err){V3.toast(err.message,1)}};
    await V3.rkLoad()},
  rkFill(sym,d,e,sl,tp){$("rkS").value=sym;$("rkDir").value=String(d);const dec=(SYMS.find(x=>x.s===sym)||S.sym).dec,r=v=>v==null?"":(+v).toFixed(dec);$("rkE").value=r(e);$("rkSl").value=r(sl);$("rkTp").value=r(tp);
    const s=V3.RK.set;if(s){const per=Math.abs(e-sl)*V3.valPer(sym,e);if(per>0)$("rkL").value=Math.max(.01,Math.floor(s.balance*s.risk_pct/100/per*100)/100).toFixed(2)}V3.rkPrev()},
  rkNew(){return{sym:$("rkS").value,dir:+$("rkDir").value,entry:+$("rkE").value,sl:+$("rkSl").value,tp:$("rkTp").value===""?null:+$("rkTp").value,lots:+$("rkL").value}},
  rkCheck(extra){const s=V3.RK.set||{balance:0,risk_pct:1,max_total_pct:5,max_daily_pct:3},open=V3.RK.tr.filter(t=>t.status==="open"),all=extra?[...open,extra]:open,W_=[];
    const bal=+s.balance||0,tot=all.reduce((a,t)=>a+V3.tRisk(t),0),totP=bal?tot/bal*100:0,today=new Date().toDateString(),
      dl=-V3.RK.tr.filter(t=>t.status==="closed"&&t.closed_at&&new Date(t.closed_at).toDateString()===today).reduce((a,t)=>a+(+t.pnl||0),0),dlP=bal?Math.max(0,dl)/bal*100:0;
    if(!bal)W_.push({l:2,t:"اكتب رصيد حسابك بالحدود حتى أكدر أحسب النسب."});
    all.forEach(t=>{const p=bal?V3.tRisk(t)/bal*100:0;if(p>s.risk_pct*1.001)W_.push({l:p>s.risk_pct*2?3:2,t:`<bdi dir="ltr">${esc(t.sym)}</bdi>: مخاطرة الصفقة ${p.toFixed(2)}% أكثر من حدّك ${s.risk_pct}%`});
      if(t.dir>0?t.sl>=t.entry:t.sl<=t.entry)W_.push({l:3,t:`<bdi dir="ltr">${esc(t.sym)}</bdi>: الوقف بالجهة الغلط من الدخول`});
      if(t.tp!=null&&Math.abs(t.tp-t.entry)<Math.abs(t.entry-t.sl))W_.push({l:1,t:`<bdi dir="ltr">${esc(t.sym)}</bdi>: الهدف أصغر من الوقف (عائد أقل من 1:1)`})});
    if(totP>=s.max_total_pct)W_.push({l:3,t:`المخاطرة المفتوحة الكلية ${totP.toFixed(2)}% تجاوزت حدّك ${s.max_total_pct}%`});else if(totP>=s.max_total_pct*.8)W_.push({l:2,t:`المخاطرة الكلية ${totP.toFixed(2)}% قريبة من حدّك ${s.max_total_pct}%`});
    if(dlP>=s.max_daily_pct)W_.push({l:3,t:`خسارة اليوم ${dlP.toFixed(2)}% وصلت حدّك اليومي ${s.max_daily_pct}%. وكّف تداول لباچر`});else if(dlP>=s.max_daily_pct*.7)W_.push({l:2,t:`خسارة اليوم ${dlP.toFixed(2)}% قريبة من حدّك اليومي`});
    for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j],k=[a.sym,b.sym].sort().join("|"),c=a.sym===b.sym?1:V3.RK.corr[k];if(c==null)continue;
      const eff=c*a.dir*b.dir;if(eff>=.7)W_.push({l:2,t:`<bdi dir="ltr">${esc(a.sym)}</bdi> و <bdi dir="ltr">${esc(b.sym)}</bdi> مرتبطين (${c.toFixed(2)}) وبنفس الاتجاه الفعلي: كأنها صفقة وحدة بمخاطرة مضاعفة`});
      else if(eff<=-.7)W_.push({l:1,t:`<bdi dir="ltr">${esc(a.sym)}</bdi> و <bdi dir="ltr">${esc(b.sym)}</bdi> يلغون بعض تقريباً (${c.toFixed(2)})`})}
    return{W:W_.sort((a,b)=>b.l-a.l),tot,totP,dl,dlP,s,bal}},
  rkPrev(){const t=V3.rkNew(),el=$("rkPrev");if(!t.entry||!t.sl||!t.lots){el.innerHTML="";return}const r=V3.tRisk(t),C=V3.rkCheck(t),p=C.bal?r/C.bal*100:0;
    el.innerHTML=`<div class="v2-t"><span>مخاطرة هذي الصفقة</span><b class="num ${p>C.s.risk_pct?"down":"up"}">$${r.toFixed(2)} · ${p.toFixed(2)}%</b><small>المخاطرة الكلية بعد إضافتها ${C.totP.toFixed(2)}% من ${C.s.max_total_pct}%</small></div>${C.W.filter(w=>w.l>=2).slice(0,3).map(w=>`<div class="v3-warn${w.l>=3?" red":""}">${w.l>=3?"⛔":"⚠️"} ${w.t}</div>`).join("")}`},
  async rkAdd(){const t=V3.rkNew();if(!t.entry||!t.sl||!t.lots)return V3.toast("اكتب الدخول والوقف واللوت",1);const C=V3.rkCheck(t);
    if(C.W.some(w=>w.l>=3)&&!confirm("حارس المخاطر: هذي الصفقة تتجاوز حدودك:\n\n"+C.W.filter(w=>w.l>=3).map(w=>"• "+w.t.replace(/<[^>]+>/g,"")).join("\n")+"\n\nتريد تسجّلها رغم هذا؟"))return;
    try{await DB.riskAdd({sym:t.sym,dir:t.dir,entry:t.entry,sl:t.sl,tp:t.tp,lots:t.lots});["rkE","rkSl","rkTp","rkL"].forEach(i=>$(i).value="");$("rkPrev").innerHTML="";await V3.rkLoad();V3.toast("✅ تسجّلت الصفقة")}catch(e){V3.toast(e.message,1)}},
  async rkLoad(){try{const[s,t]=await Promise.all([DB.riskGet(),DB.riskTrades()]);V3.RK.set=s||null;V3.RK.tr=t||[]}catch(e){$("rkList").innerHTML=`<p class="down" style="font-size:12.5px">${esc(e.message)} (شغّل vexora_v3.sql)</p>`;return}
    const s=V3.RK.set||{balance:"",risk_pct:1,max_total_pct:5,max_daily_pct:3};$("rkB").value=s.balance;$("rkR").value=s.risk_pct;$("rkM").value=s.max_total_pct;$("rkD").value=s.max_daily_pct;
    await V3.rkCorr();V3.rkRender()},
  async rkCorr(){const syms=[...new Set(V3.RK.tr.filter(t=>t.status==="open").map(t=>t.sym))],R={};
    for(const s of syms){const x=SYMS.find(y=>y.s===s);if(!x)continue;try{const c=await getData(x,"H1",false);if(c.src!=="sim")R[s]=c.data}catch(e){}}
    V3.RK.corr={};const ks=Object.keys(R);for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const a=R[ks[i]],b=R[ks[j]],mb=new Map(b.map(c=>[c.time,c.close])),ra=[],rb=[];let pa=null,pb=null;
      for(const c of a.slice(-160)){const v=mb.get(c.time);if(v==null)continue;if(pa!=null){ra.push(Math.log(c.close/pa));rb.push(Math.log(v/pb))}pa=c.close;pb=v}
      if(ra.length<40)continue;const m=x=>x.reduce((s,v)=>s+v,0)/x.length,ma=m(ra),mb_=m(rb);let sab=0,saa=0,sbb=0;ra.forEach((v,k)=>{const da=v-ma,db=rb[k]-mb_;sab+=da*db;saa+=da*da;sbb+=db*db});
      V3.RK.corr[[ks[i],ks[j]].sort().join("|")]=sab/Math.sqrt(saa*sbb||1)}
    V3.RK.cs=ks;V3.RK.miss=syms.filter(s=>!R[s])},
  rkRender(){const C=V3.rkCheck(),open=V3.RK.tr.filter(t=>t.status==="open"),dec=s=>(SYMS.find(x=>x.s===s)||{dec:5}).dec,g=(v,m)=>Math.min(100,m?v/m*100:0);
    $("rkWarn").innerHTML=C.W.length?C.W.map(w=>`<div class="v3-warn${w.l>=3?" red":w.l===1?" gold":""}">${w.l>=3?"⛔":w.l===2?"⚠️":"ℹ️"} ${w.t}</div>`).join(""):'<div class="v3-warn ok">✅ كل شي ضمن حدودك هسه.</div>';
    $("rkG").innerHTML=`<div class="v2-t"><span>الرصيد</span><b class="num">$${(+C.bal).toLocaleString("en-US")}</b><small>مخاطرة الصفقة ${C.s.risk_pct}% = $${(C.bal*C.s.risk_pct/100).toFixed(2)}</small></div>
      <div class="v2-t"><span>المخاطرة المفتوحة</span><b class="num ${C.totP>=C.s.max_total_pct?"down":C.totP>=C.s.max_total_pct*.8?"gold":"up"}">${C.totP.toFixed(2)}%</b><div class="v2-pbar" style="margin-top:4px"><i style="width:${g(C.totP,C.s.max_total_pct)}%"></i></div><small>$${C.tot.toFixed(2)} من حد ${C.s.max_total_pct}%</small></div>
      <div class="v2-t"><span>خسارة اليوم</span><b class="num ${C.dlP>=C.s.max_daily_pct?"down":""}">${C.dlP.toFixed(2)}%</b><div class="v2-pbar" style="margin-top:4px"><i style="width:${g(C.dlP,C.s.max_daily_pct)}%"></i></div><small>من حد ${C.s.max_daily_pct}%</small></div>
      <div class="v2-t"><span>صفقات مفتوحة</span><b class="num">${open.length}</b><small>${V3.RK.tr.filter(t=>t.status==="closed").length} مسكّرة</small></div>`;
    $("rkList").innerHTML=open.map(t=>{const r=V3.tRisk(t);return`<div class="v3-srow"><b class="${t.dir>0?"up":"down"}">${t.dir>0?"▲":"▼"} <bdi dir="ltr">${esc(t.sym)}</bdi></b><span class="num">${fx(+t.entry,dec(t.sym))} · SL ${fx(+t.sl,dec(t.sym))} · ${(+t.lots).toFixed(2)} lot</span><span class="num ${C.bal&&r/C.bal*100>C.s.risk_pct?"down":""}">$${r.toFixed(2)}${C.bal?` · ${(r/C.bal*100).toFixed(2)}%`:""}</span><button type="button" class="btn v2s" data-rc="${t.id}">سكّر</button><button type="button" class="v3-del" data-rd="${t.id}" aria-label="مسح">🗑</button></div>`}).join("")||'<p class="label" style="margin:0">ما عندك صفقات مفتوحة مسجّلة.</p>';
    const ks=V3.RK.cs||[];$("rkCorr").innerHTML=ks.length<2?'<p class="label" style="margin:0;font-size:12.5px">يطلع الارتباط لمن تكون عندك صفقتين أو أكثر على أزواج مختلفة.</p>'
      :`<div class="v3-tw"><table class="v3-tb v3-corr"><thead><tr><th></th>${ks.map(k=>`<th class="ltr">${esc(k)}</th>`).join("")}</tr></thead><tbody>${ks.map(a=>`<tr><th class="ltr">${esc(a)}</th>${ks.map(b=>{const c=a===b?1:V3.RK.corr[[a,b].sort().join("|")];return`<td class="num" style="background:${c==null?"transparent":c>0?`rgba(240,96,111,${Math.abs(c)*.45})`:`rgba(91,141,239,${Math.abs(c)*.45})`}">${c==null?"—":c.toFixed(2)}</td>`}).join("")}</tr>`).join("")}</tbody></table></div>
        <p class="v3-note">من عوائد آخر 160 شمعة ساعة. +1 = يتحركون سوا، −1 = عكس بعض. ${V3.RK.miss&&V3.RK.miss.length?"ما متوفر لـ: "+V3.RK.miss.map(esc).join("، "):""}</p>`},
  view(v){const sec={ai:"v3AiView",strategy:"v3StView",scanner:"v3ScView",risk:"v3RkView"};for(const k in sec){const e=$(sec[k]);if(e)e.hidden=v!==k}
    if(v==="ai")V3.aiPage().catch(e=>console.warn(e));if(v==="strategy")V3.stratPage();if(v==="scanner")V3.scanPage();if(v==="risk")V3.riskPage();
    if(v==="")setTimeout(()=>V3.chartBar(),400);if(v==="chart")setTimeout(()=>V3.cvLevels(),300);if(v==="settings")V3.usage()}
};
window.__v3=V3;

/* ================= V9: رادار السوق · دفتر التداول الذكي · محرك مخاطر المحفظة ================= */
const V9={rtf:"H1",R:null,J:{tab:"log",rows:[],set:null,flt:{sym:"",st:"",res:""},edit:null,ld:false},
  api(){return DB.v9},
  toast(t,bad){try{V3.toast(t,bad)}catch(e){alert(t)}},
  err(e){return String(e&&e.message||e||"").replace(/^[A-Z_]+:\s*/,"")},
  demo(){return V9.api().demo?'<span class="v9-demo">بيانات توضيحية</span>':""},
  num(v,d){return`<bdi dir="ltr" class="num">${fx(+v,d==null?2:d)}</bdi>`},
  money(v,c,sh){const n=+v||0;return`<bdi dir="ltr" class="num v9-m ${n>0?"up":n<0?"down":""}">${n>0?"+":n<0?"−":""}${Math.abs(n).toLocaleString("en-US",{maximumFractionDigits:sh?0:2,minimumFractionDigits:sh?0:2})}${sh?"":` <small>${esc(c||"USD")}</small>`}</bdi>`},
  symN(s){const x=SYMS.find(y=>y.s===s);return x?x.n:s},
  dec(s){return(SYMS.find(x=>x.s===s)||{dec:5}).dec},
  ago(t){const m=Math.round((Date.now()-new Date(t))/6e4);return m<2?"هسه":m<60?`قبل ${m} د`:m<1440?`قبل ${Math.round(m/60)} س`:`قبل ${Math.round(m/1440)} يوم`},
  until(t){const m=Math.round((new Date(t)-Date.now())/6e4);return m<=0?"هسه":m<60?`بعد ${m} د`:`بعد ${Math.floor(m/60)} س ${m%60?m%60+" د":""}`.trim()},
  dt(t){try{return new Date(t).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}catch(e){return""}},
  spark(v,col,w,h){if(!v||v.length<2)return"";w=w||340;h=h||56;const lo=Math.min(...v),hi=Math.max(...v),r=hi-lo||1,id="v9g"+Math.random().toString(36).slice(2,8);
    const pts=v.map((y,i)=>`${(i/(v.length-1)*w).toFixed(1)},${(h-4-(y-lo)/r*(h-8)).toFixed(1)}`).join(" ");
    return`<svg class="v9-spark" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".32"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><polygon points="0,${h} ${pts} ${w},${h}" fill="url(#${id})"/><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`},
  ST:{trend_up:["ترند صاعد","up","#34c98e"],trend_down:["ترند هابط","down","#f0606f"],sideways:["عرضي","side","#D4AF37"],high_vol:["تذبذب عالي","hv","#f0a040"],low_vol:["تذبذب منخفض","lv","#8fb6ff"],abnormal:["حركة غير طبيعية","ab","#ff5d6c"]},
  VOL:{high:"عالي",normal:"متوسط",low:"منخفض"},
  stChip(s){const x=V9.ST[s]||[s,"side"];return`<span class="v9-st ${x[1]}">${esc(x[0])}</span>`},

  /* ---------------- رادار السوق ---------------- */
  async rPage(){const el=$("v9RdBody");if(V3.locked(el))return;
    el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl v9-hrow"><div class="v3-ttl"><span class="v3-logo">📡</span><div><h2>رادار السوق ${V9.demo()}</h2><p>حالة كل أصل الحين: الاتجاه والتقلب وسبب التصنيف، يتحدث كل 15 دقيقة من الشموع المسكّرة.</p></div></div><div class="rc-per" id="v9Tf">${["H1","H4","D1"].map(t=>`<button type="button" data-t="${t}" class="${t===V9.rtf?"on":""}">${t}</button>`).join("")}</div></div></div>
      <div id="v9RdSum" class="v3-sum"></div><div id="v9RdNote"></div><div id="v9RdGrid" class="v9-rgrid"><div class="panel label">جاري التحميل…</div></div><div id="v9RdAdm"></div>`;
    $("v9Tf").onclick=e=>{const b=e.target.closest("[data-t]");if(!b)return;V9.rtf=b.dataset.t;$("v9Tf").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));V9.rLoad()};
    await V9.rLoad();if(isAdminUser())V9.rAdmin()},
  async rLoad(){let d;try{d=await V9.api().radar(V9.rtf)}catch(e){$("v9RdGrid").innerHTML=`<div class="panel down">${esc(V9.err(e))} (شغّل vexora_v9.sql)</div>`;return}V9.R=d;
    const rows=(d&&d.rows||[]).slice().sort((a,b)=>SYMS.findIndex(x=>x.s===a.sym)-SYMS.findIndex(x=>x.s===b.sym)),c=k=>rows.filter(r=>!r.stale&&k.includes(r.state)).length,st=rows.filter(r=>r.stale).length;
    $("v9RdSum").innerHTML=`<div class="v2-t"><span>بترند</span><b class="num up">${c(["trend_up","trend_down"])}</b><small>صاعد ${c(["trend_up"])} · هابط ${c(["trend_down"])}</small></div>
      <div class="v2-t"><span>عرضي</span><b class="num gold">${c(["sideways","low_vol"])}</b><small><span>منها تذبذب منخفض</span> <bdi>${c(["low_vol"])}</bdi></small></div>
      <div class="v2-t"><span>تذبذب عالي أو غير طبيعي</span><b class="num ${c(["high_vol","abnormal"])?"down":""}">${c(["high_vol","abnormal"])}</b><small>انتبه لحجم الصفقة</small></div>
      <div class="v2-t"><span>بيانات قديمة</span><b class="num ${st?"down":""}">${st}</b><small><bdi>${rows.length}</bdi> <span>أصل</span> · <bdi>${esc(V9.rtf)}</bdi></small></div>`;
    $("v9RdNote").innerHTML=`<div class="v3-warn gold">ℹ️ <span>نسبة «توافق المؤشرات» تعني كم مؤشر يأيد التصنيف (المتوسطات، ADX، RSI، الميل، بولنجر). هي مو احتمال ربح ولا توصية.</span></div>`;
    $("v9RdGrid").innerHTML=rows.length?rows.map(r=>V9.rCard(r)).join(""):`<div class="panel"><h3 style="margin:0 0 6px;font-size:15px">لسه ما أكو قراءات</h3><p class="label" style="margin:0">الرادار يحتاج أسعار محدّثة من محرك المنصة. أول قراءة تطلع خلال 15 دقيقة من تشغيل التحديث.</p></div>`;
    $("v9RdGrid").onclick=e=>{const b=e.target.closest("[data-why]");if(b){const w=b.closest(".v9-rc").querySelector(".v9-why");w.hidden=!w.hidden;b.textContent=w.hidden?"ليش؟":"إخفاء"}}},
  rCard(r){const x=V9.ST[r.state]||["","",""],m=r.metrics||{},h=(r.hist||[]),last=h.length>1?h[h.length-2]:null,rs=(r.reasons||[]);
    const nw=r.news?`<span class="down">🔴 <bdi>${esc(r.news.title)}</bdi> <span>${esc(V9.until(r.news.at))}</span></span>`:"";
    return`<section class="panel v9-rc ${r.stale?"stale":""}"><div class="ph v9-rch"><b>${esc(V9.symN(r.sym))} <span class="label ltr">${esc(r.sym)}</span></b>${V9.stChip(r.state)}</div>
      ${V9.spark(m.spark,x[2])}
      <div class="v9-rrow"><span>التقلب: <b>${esc(V9.VOL[r.vol]||r.vol)}</b></span><span>توافق المؤشرات <b class="num">${+r.score||0}%</b></span></div>
      <div class="v2-pbar v9-bar"><i style="width:${Math.max(0,Math.min(100,+r.score||0))}%;background:${x[2]}"></i></div>
      <div class="label v9-r1">${rs.slice(0,2).map(esc).join(" · ")}</div>
      <div class="v9-why" hidden><ul>${rs.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>${last?`<p class="label" style="margin:4px 0 0">آخر تغيّر: ${esc((V9.ST[last.state]||[last.state])[0])} ← ${esc(x[0])} <span>${esc(V9.ago(h[h.length-1].at))}</span></p>`:""}</div>
      <div class="v9-rft"><span class="label">${r.stale?'<b class="down">⚠️ البيانات قديمة</b>':`<span>شمعة مسكّرة</span> <bdi>${esc(r.tf)}</bdi> · <bdi dir="ltr">${esc(V9.dt(r.candle_t))}</bdi>`}</span>${nw}<button type="button" class="v9-lnk" data-why>ليش؟</button></div></section>`},
  async rAdmin(){const el=$("v9RdAdm");if(!el)return;const ru=(V9.R&&V9.R.rules)||{};let st=[];try{st=await V9.api().rstats(90)||[]}catch(e){}
    const L={block_abnormal:"الحركة غير الطبيعية",block_sideways:"السوق العرضي",block_high_vol:"التذبذب العالي",block_stale:"البيانات القديمة"};
    el.innerHTML=`<div class="v3-grid2"><section class="panel"><h3 class="v9-h3">⚙️ قواعد الفلترة (للإدارة)</h3>
      <p class="label" style="margin:0 0 8px;font-size:12.5px">كل توصية جديدة تنحفظ وياها حالة السوق وقت صدورها. القواعد هنا تعلّم التوصيات اللي <b>كانت راح تنمنع</b> حتى تقيس أثرها قبل التفعيل.</p>
      <div class="v9-chk">${Object.keys(L).map(k=>`<label><input type="checkbox" data-k="${k}" ${ru[k]?"checked":""}> <span>علّم التوصية بحالة</span> <span>${L[k]}</span></label>`).join("")}</div>
      <div class="v3-warn" style="margin-top:8px">🔒 <span>الوضع الحالي: <b>مراقبة بس</b>. المنع الفعلي يحتاج تحديث محرك التوصيات، وما يتفعّل إلا بموافقتك.</span></div>
      <div class="v3-act"><button class="btn primary" type="button" id="v9RuSave">حفظ القواعد</button></div></section>
      <section class="panel"><h3 class="v9-h3">📊 نتائج التوصيات حسب حالة السوق (90 يوم) ${V9.demo()}</h3>${st.length?`<div class="v3-tw"><table class="v3-tb"><thead><tr><th>الحالة وقت الصدور</th><th>التوصيات</th><th>ربح</th><th>خسارة</th><th>نسبة النجاح</th><th>كانت راح تنمنع</th></tr></thead><tbody>${st.map(s=>{const d=s.win+s.loss;return`<tr><td>${s.state==="untagged"?'<span class="label">قبل الرادار</span>':V9.stChip(s.state)}</td><td class="num">${s.n}</td><td class="num up">${s.win}</td><td class="num down">${s.loss}</td><td class="num">${d?Math.round(s.win/d*100)+"%":"—"}</td><td class="num">${s.would_block||0}</td></tr>`}).join("")}</tbody></table></div><p class="v3-note">من النتائج المسجّلة فعلاً. أقل من 30 توصية بالحالة = عينة صغيرة ما تكفي للحكم.</p>`:'<p class="label" style="margin:0">لسه ما أكو توصيات مصنّفة. تبدي تتجمع من أول توصية بعد التحديث.</p>'}</section></div>`;
    $("v9RuSave").onclick=async()=>{const j={mode:"observe"};el.querySelectorAll("[data-k]").forEach(c=>j[c.dataset.k]=c.checked);try{const v=await V9.api().rules(j);if(V9.R)V9.R.rules=v;V9.toast("✅ انحفظت القواعد")}catch(e){V9.toast(V9.err(e),1)}}},

  /* ---------------- دفتر التداول ---------------- */
  EMO:["هادئ","واثق","متردد","خايف","طمعان","انتقام","ملل","مستعجل"],
  CCY:["USD","EUR","GBP","IQD","AED","SAR","KWD","TRY","JOD","EGP"],
  ccy(){return(V9.J.set&&V9.J.set.acct_ccy)||"USD"},
  sess(t){const h=new Date(t).getUTCHours();return h>=7&&h<12?"لندن":h>=12&&h<16?"تداخل لندن ونيويورك":h>=16&&h<22?"نيويورك":"آسيا"},
  WD:["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"],
  // الحساب: مواصفات العقد من قائمة الأصول + تحويل عملة التسعير للدولار
  calc(t){const dir=t.side==="buy"?1:-1,ex=(t.exits||[]).filter(e=>+e.lots>0&&+e.price>0),fxr=+t.fx_rate||1;
    let g=0;ex.forEach(e=>g+=(+e.price-+t.entry)*dir*+e.lots*V3.valPer(t.sym,+e.price));
    const risk=t.sl?Math.abs(+t.entry-+t.sl)*+t.lots*V3.valPer(t.sym,+t.entry):0,closed=ex.reduce((a,e)=>a+ +e.lots,0);
    const gross=g*fxr,net=gross-(+t.commission||0)-(+t.spread_cost||0)+(+t.swap||0);
    return{gross,net,risk:risk*fxr,r:risk>0?g/risk:null,closed,full:closed>=+t.lots*.999,avg:closed?ex.reduce((a,e)=>a+ +e.price*+e.lots,0)/closed:null}},
  pnl(t){return t.pnl!=null?+t.pnl:null},
  stats(L){const c=L.filter(t=>t.closed_at&&t.pnl!=null).sort((a,b)=>new Date(a.closed_at)-new Date(b.closed_at)),n=c.length,w=c.filter(t=>+t.pnl>0),l=c.filter(t=>+t.pnl<0);
    const gw=w.reduce((a,t)=>a+ +t.pnl,0),gl=-l.reduce((a,t)=>a+ +t.pnl,0),net=gw-gl,rs=c.filter(t=>t.r_mult!=null).map(t=>+t.r_mult);
    let eq=0,pk=0,dd=0;const curve=c.map(t=>{eq+=+t.pnl;pk=Math.max(pk,eq);dd=Math.max(dd,pk-eq);return eq});
    const pl=c.filter(t=>t.followed_plan!=null);
    return{n,win:n?w.length/n*100:null,net,exp:n?net/n:null,expR:rs.length?rs.reduce((a,v)=>a+v,0)/rs.length:null,pf:gl>0?gw/gl:gw>0?Infinity:null,dd,curve,
      plan:pl.length?pl.filter(t=>t.followed_plan).length/pl.length*100:null,avgW:w.length?gw/w.length:null,avgL:l.length?gl/l.length:null}},
  group(L,key){const m={};L.filter(t=>t.closed_at&&t.pnl!=null).forEach(t=>{const k=key(t);if(k==null||k==="")return;(m[k]=m[k]||[]).push(t)});
    return Object.entries(m).map(([k,a])=>{const s=V9.stats(a);return{k,n:s.n,win:s.win,net:s.net,expR:s.expR}}).sort((a,b)=>b.n-a.n)},
  async jPage(){const el=$("v9JrBody");if(V3.locked(el))return;
    el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl v9-hrow"><div class="v3-ttl"><span class="v3-logo">📒</span><div><h2>دفتر التداول الذكي ${V9.demo()}</h2><p>سجّل صفقاتك وأسبابك ومشاعرك، وشوف وين تربح ووين تخسر بالأرقام.</p></div></div><div class="v3-act" style="margin:0"><button class="btn v2s" type="button" data-jt="set">⬆️ استيراد CSV</button><button class="btn primary v2s" type="button" data-jt="add">＋ صفقة</button></div></div>
      <div class="rc-per" id="v9JTabs">${[["log","📋 السجل"],["add","＋ صفقة"],["an","📊 التحليل"],["wk","🗓 التقرير الأسبوعي"],["set","⚙️ الإعدادات"]].map(([k,t])=>`<button type="button" data-jt="${k}" class="${k===V9.J.tab?"on":""}">${t}</button>`).join("")}</div></div>
      <div id="v9JK" class="rc-k v9-k"></div><div id="v9JB"></div>`;
    el.addEventListener("click",e=>{const b=e.target.closest("[data-jt]");if(b){if(b.dataset.jt==="add")V9.J.edit=null;V9.jTab(b.dataset.jt)}});
    await V9.jLoad();V9.jTab(V9.J.tab)},
  async jLoad(){try{const[r,s]=await Promise.all([V9.api().jList(),V9.api().jSet()]);V9.J.rows=r||[];V9.J.set=s||null;V9.J.ld=true}catch(e){V9.J.rows=[];V9.J.err=V9.err(e)}V9.jKpi()},
  jKpi(){const s=V9.stats(V9.J.rows),c=V9.ccy(),sb=+(V9.J.set&&V9.J.set.start_balance)||0,el=$("v9JK");if(!el)return;
    const k=(l,v,cl,sm)=>`<div class="kp"><span>${l}</span><b class="${cl||""}">${v}</b>${sm?`<small>${sm}</small>`:""}</div>`;
    el.innerHTML=k("صفقات مسكّرة",`<bdi dir="ltr">${s.n}</bdi>`)+k("نسبة النجاح",s.win==null?"—":`<bdi dir="ltr">${s.win.toFixed(0)}%</bdi>`)+k("صافي الربح",V9.money(s.net,c))+
      k("المتوقع لكل صفقة",s.expR==null?(s.exp==null?"—":V9.money(s.exp,c)):`<bdi dir="ltr" class="${s.expR>=0?"up":"down"}">${s.expR>=0?"+":""}${s.expR.toFixed(2)}R</bdi>`,"")+
      k("Profit Factor",s.pf==null?"—":`<bdi dir="ltr">${s.pf===Infinity?"∞":s.pf.toFixed(2)}</bdi>`,s.pf!=null&&s.pf>=1?"gold":"down")+
      k("أقصى تراجع",s.n?`<bdi dir="ltr" class="down">−${sb?(s.dd/sb*100).toFixed(1)+"%":s.dd.toFixed(0)+" "+esc(c)}</bdi>`:"—")+k("الالتزام بالخطة",s.plan==null?"—":`<bdi dir="ltr">${s.plan.toFixed(0)}%</bdi>`,s.plan!=null&&s.plan>=80?"up":"gold");
    if(V9.J.err)el.insertAdjacentHTML("afterend",`<div class="v3-warn red">${esc(V9.J.err)} (شغّل vexora_v9.sql)</div>`),V9.J.err=null},
  jTab(t){V9.J.tab=t;const tb=$("v9JTabs");if(tb)tb.querySelectorAll("[data-jt]").forEach(b=>b.classList.toggle("on",b.dataset.jt===t));
    const B=$("v9JB");if(!B)return;({log:V9.jLog,add:V9.jForm,an:V9.jAn,wk:V9.jWeek,set:V9.jSettings}[t]||V9.jLog)(B)},
  jLog(B){const f=V9.J.flt,c=V9.ccy(),syms=[...new Set(V9.J.rows.map(t=>t.sym))],strs=[...new Set(V9.J.rows.map(t=>t.strategy).filter(Boolean))];
    const L=V9.J.rows.filter(t=>(!f.sym||t.sym===f.sym)&&(!f.st||t.strategy===f.st)&&(!f.res||(f.res==="open"?!t.closed_at:f.res==="w"?+t.pnl>0:f.res==="l"?+t.pnl<0:true)));
    B.innerHTML=`<section class="panel"><div class="v9-flt"><select id="v9FS"><option value="">كل الأصول</option>${syms.map(s=>`<option ${s===f.sym?"selected":""} value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
      <select id="v9FT"><option value="">كل الاستراتيجيات</option>${strs.map(s=>`<option ${s===f.st?"selected":""} value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
      <select id="v9FR"><option value="">كل النتائج</option><option value="w" ${f.res==="w"?"selected":""}>رابحة</option><option value="l" ${f.res==="l"?"selected":""}>خاسرة</option><option value="open" ${f.res==="open"?"selected":""}>مفتوحة</option></select><span class="label">${L.length} صفقة</span></div>
      ${L.length?`<div class="v3-tw"><table class="v3-tb v9-jt"><thead><tr><th>الدخول</th><th>الأصل</th><th>الحجم</th><th>دخول ← خروج</th><th>الصافي</th><th>R</th><th>الاستراتيجية</th><th>الشعور</th><th>الخطة</th><th></th></tr></thead><tbody>
      ${L.slice(0,300).map(t=>{const k=V9.calc(t);return`<tr><td class="num">${esc(V9.dt(t.opened_at))}</td><td><b class="${t.side==="buy"?"up":"down"}">${t.side==="buy"?"▲":"▼"}</b> <bdi dir="ltr">${esc(t.sym)}</bdi>${t.source==="signal"?' <span class="label">📣</span>':""}${(t.images||[]).length?' <span class="label">🖼</span>':""}</td><td class="num">${(+t.lots).toFixed(2)}</td>
        <td class="num"><bdi dir="ltr">${fx(+t.entry,V9.dec(t.sym))} → ${k.avg!=null?fx(k.avg,V9.dec(t.sym)):"…"}</bdi></td><td>${t.pnl!=null?V9.money(t.pnl,c):'<span class="label">مفتوحة</span>'}</td><td class="num">${t.r_mult!=null?(+t.r_mult).toFixed(2):"—"}</td><td data-noi18n>${esc(t.strategy||"—")}</td><td>${esc(t.emotion||"—")}</td><td>${t.followed_plan==null?"—":t.followed_plan?'<span class="up">✓</span>':'<span class="down">✗</span>'}</td>
        <td class="v9-ra"><button type="button" class="btn v2s" data-je="${t.id}">تعديل</button><button type="button" class="v3-del" data-jd="${t.id}" aria-label="مسح">🗑</button></td></tr>`}).join("")}</tbody></table></div>`
      :`<div class="v9-empty"><b>دفترك فارغ</b><p class="label">سجّل أول صفقة، أو انسخها من توصية، أو استورد ملف CSV من منصتك.</p><button class="btn primary" type="button" data-jt="add">＋ أول صفقة</button></div>`}</section>`;
    $("v9FS").onchange=e=>{f.sym=e.target.value;V9.jLog(B)};$("v9FT").onchange=e=>{f.st=e.target.value;V9.jLog(B)};$("v9FR").onchange=e=>{f.res=e.target.value;V9.jLog(B)};
    B.querySelector("table")&&(B.querySelector("table").onclick=async e=>{const ed=e.target.closest("[data-je]"),dl=e.target.closest("[data-jd]");
      if(ed){V9.J.edit=V9.J.rows.find(t=>String(t.id)===ed.dataset.je);V9.jTab("add")}
      if(dl){if(!confirm("تمسح هذي الصفقة من دفترك؟"))return;try{await V9.api().jDel(dl.dataset.jd);await V9.jLoad();V9.jLog(B);V9.toast("انمسحت")}catch(err){V9.toast(V9.err(err),1)}}})},
  dtl(v){if(!v)return"";const d=new Date(v),p=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`},
  jForm(B){const t=V9.J.edit||{},c=V9.ccy(),strs=[...new Set(V9.J.rows.map(x=>x.strategy).filter(Boolean))],ex=(t.exits&&t.exits.length?t.exits:[{lots:"",price:""}]);
    B.innerHTML=`<section class="panel"><div class="ph"><h3 class="v9-h3" style="margin:0">${t.id?"✏️ تعديل صفقة":"＋ صفقة جديدة"}</h3><div class="v3-act" style="margin:0"><button class="btn v2s" type="button" id="v9FromSig">📣 انسخ من توصية</button></div></div>
      <div id="v9SigPick"></div>
      <div class="v3-fm"><label>الأصل<select id="jS">${SYMS.map(x=>`<option value="${esc(x.s)}" ${x.s===t.sym?"selected":""}>${esc(x.n)} · ${esc(x.s)}</option>`).join("")}</select></label>
        <label>الاتجاه<select id="jD"><option value="buy">▲ شراء</option><option value="sell" ${t.side==="sell"?"selected":""}>▼ بيع</option></select></label>
        <label>وقت الدخول<input id="jO" type="datetime-local" class="ltr" value="${V9.dtl(t.opened_at||new Date())}"></label><label>وقت الخروج<input id="jC" type="datetime-local" class="ltr" value="${V9.dtl(t.closed_at)}"></label>
        <label>اللوت<input id="jL" type="number" min="0.01" step="0.01" class="ltr" value="${t.lots??""}"></label><label>سعر الدخول<input id="jE" type="number" step="any" class="ltr" value="${t.entry??""}"></label>
        <label>الوقف<input id="jSl" type="number" step="any" class="ltr" value="${t.sl??""}"></label><label>الهدف<input id="jTp" type="number" step="any" class="ltr" value="${(t.tp&&t.tp[0])??""}"></label></div>
      <h4 class="v9-h4">الخروج <span class="label">(إذا سكّرت على مراحل، أضف كل إغلاق جزئي)</span></h4><div id="jX">${ex.map(e=>V9.xRow(e)).join("")}</div><button class="btn v2s" type="button" id="jXAdd">＋ إغلاق جزئي</button>
      <h4 class="v9-h4">التكاليف بعملة الحساب (<bdi>${esc(c)}</bdi>)</h4><div class="v3-fm"><label>العمولة<input id="jCm" type="number" step="any" min="0" class="ltr" value="${t.commission??0}"></label><label>السبريد<input id="jSp" type="number" step="any" min="0" class="ltr" value="${t.spread_cost??0}"></label><label>السواب (+ أو −)<input id="jSw" type="number" step="any" class="ltr" value="${t.swap??0}"></label>
        ${c!=="USD"?`<label>سعر الصرف: 1 USD = ? ${esc(c)}<input id="jFx" type="number" step="any" min="0" class="ltr" value="${t.fx_rate??(V9.J.set&&V9.J.set.fx)??""}"></label>`:""}</div>
      <label class="v9-ck"><input type="checkbox" id="jPm" ${t.pnl_manual?"checked":""}> <span>أكتب الربح النهائي من كشف البروكر بدل الحساب التلقائي</span></label><div id="jPmBox" ${t.pnl_manual?"":"hidden"} class="v3-fm"><label>الربح/الخسارة النهائي<input id="jPn" type="number" step="any" class="ltr" value="${t.pnl_manual?t.pnl:""}"></label></div>
      <div id="jPrev" class="v3-sum v9-prev"></div>
      <h4 class="v9-h4">ليش دخلت وليش طلعت</h4><div class="v3-fm"><label>الاستراتيجية<input id="jSt" list="jStL" maxlength="60" value="${esc(t.strategy||"")}"><datalist id="jStL">${strs.map(s=>`<option value="${esc(s)}">`).join("")}</datalist></label>
        <label>شعورك وقت الدخول<select id="jEm"><option value="">—</option>${V9.EMO.map(m=>`<option ${m===t.emotion?"selected":""}>${m}</option>`).join("")}</select></label>
        <label>التزمت بالخطة؟<select id="jFp"><option value="">—</option><option value="1" ${t.followed_plan===true?"selected":""}>✓ نعم</option><option value="0" ${t.followed_plan===false?"selected":""}>✗ لا</option></select></label></div>
      <div class="v9-ta"><label>سبب الدخول<textarea data-noi18n id="jRi" maxlength="1000" rows="2">${esc(t.reason_in||"")}</textarea></label><label>سبب الخروج<textarea data-noi18n id="jRo" maxlength="1000" rows="2">${esc(t.reason_out||"")}</textarea></label><label>ملاحظات ودروس<textarea id="jNo" maxlength="2000" rows="2">${esc(t.notes||"")}</textarea></label></div>
      <h4 class="v9-h4">صور الشارت <span class="label">(خاصة بيك، أقصى شي 6)</span></h4><div id="jImgs" class="v9-imgs"></div><input type="file" id="jIf" accept="image/png,image/jpeg,image/webp" multiple>
      <div class="v3-act"><button class="btn primary" type="button" id="jSave">${t.id?"حفظ التعديل":"＋ سجّل الصفقة"}</button>${t.id?'<button class="btn" type="button" id="jCancel">إلغاء</button>':""}</div>
      <p class="v3-note">الربح يتحسب من مواصفات العقد (الذهب 100 أونصة، العملات 100,000) وتحويل عملة التسعير للدولار بآخر سعر متوفر. إذا رقم البروكر يختلف، اعتمد رقم البروكر.</p></section>`;
    V9.J.imgs=(t.images||[]).slice();V9.jImgs();V9.J.sig=t.signal_id||null;V9.J.src=t.source||"manual";
    const upd=()=>V9.jPrev();B.querySelectorAll("input,select").forEach(i=>i.addEventListener("input",upd));
    $("jPm").onchange=e=>{$("jPmBox").hidden=!e.target.checked;upd()};
    $("jXAdd").onclick=()=>{$("jX").insertAdjacentHTML("beforeend",V9.xRow({}));$("jX").lastElementChild.querySelectorAll("input").forEach(i=>i.addEventListener("input",upd))};
    $("jX").onclick=e=>{const d=e.target.closest("[data-xd]");if(d&&$("jX").children.length>1){d.parentElement.remove();upd()}};
    $("jIf").onchange=async e=>{const fs=[...e.target.files];e.target.value="";for(const f of fs){if(V9.J.imgs.length>=6){V9.toast("أقصى شي 6 صور",1);break}if(f.size>4e6){V9.toast("الصورة أكبر من 4MB",1);continue}
      try{V9.J.imgs.push(await V9.api().jImg(f));V9.jImgs()}catch(err){V9.toast(V9.err(err),1)}}};
    $("v9FromSig").onclick=()=>V9.jSigPick();$("jSave").onclick=()=>V9.jSave();if($("jCancel"))$("jCancel").onclick=()=>{V9.J.edit=null;V9.jTab("log")};upd()},
  xRow(e){return`<div class="v3-fm v9-x"><label>لوت الإغلاق<input data-xl type="number" min="0.01" step="0.01" class="ltr" value="${e.lots??""}"></label><label>سعر الخروج<input data-xp type="number" step="any" class="ltr" value="${e.price??""}"></label><button type="button" class="v3-del" data-xd aria-label="مسح">✕</button></div>`},
  async jImgs(){const el=$("jImgs");if(!el)return;el.innerHTML=V9.J.imgs.map((p,i)=>`<span class="v9-im"><img alt="" data-p="${esc(p)}"><button type="button" data-ri="${i}" aria-label="مسح">✕</button></span>`).join("");
    el.onclick=e=>{const b=e.target.closest("[data-ri]");if(b){V9.J.imgs.splice(+b.dataset.ri,1);V9.jImgs()}};
    for(const im of el.querySelectorAll("img"))try{im.src=await V9.api().jImgUrl(im.dataset.p)}catch(e){}},
  jRead(){const v=i=>$(i)?$(i).value:"",nm=i=>v(i)===""?null:+v(i),sym=v("jS"),lots=nm("jL"),c=V9.ccy();
    let ex=[...document.querySelectorAll("#jX .v9-x")].map(r=>({lots:+r.querySelector("[data-xl]").value||0,price:+r.querySelector("[data-xp]").value||0})).filter(e=>e.price>0);
    if(ex.length===1&&!ex[0].lots&&lots)ex[0].lots=lots;
    const closed=v("jC")?new Date(v("jC")).toISOString():null;ex=ex.map(e=>({...e,at:closed}));
    const t={sym,side:v("jD"),opened_at:v("jO")?new Date(v("jO")).toISOString():null,closed_at:closed,lots,entry:nm("jE"),sl:nm("jSl"),tp:nm("jTp")!=null?[nm("jTp")]:null,exits:ex,
      commission:nm("jCm")||0,spread_cost:nm("jSp")||0,swap:nm("jSw")||0,fx_rate:c==="USD"?1:nm("jFx"),quote_ccy:c,contract:(SYMS.find(x=>x.s===sym)||{}).lot||null,
      strategy:v("jSt").trim(),emotion:v("jEm"),followed_plan:v("jFp")===""?null:v("jFp")==="1",reason_in:v("jRi"),reason_out:v("jRo"),notes:v("jNo"),images:V9.J.imgs,signal_id:V9.J.sig,source:V9.J.src,pnl_manual:$("jPm").checked};
    const k=V9.calc(t);t.r_mult=k.r!=null&&k.closed?+k.r.toFixed(3):null;
    t.pnl=t.pnl_manual?nm("jPn"):(k.closed&&t.closed_at?+k.net.toFixed(2):null);
    if(t.pnl_manual&&t.pnl!=null&&k.risk>0)t.r_mult=+(((t.pnl+(+t.commission)+(+t.spread_cost)-(+t.swap))/k.risk)).toFixed(3);return{t,k}},
  jPrev(){const el=$("jPrev");if(!el)return;const{t,k}=V9.jRead(),c=V9.ccy();if(!t.entry||!t.lots){el.innerHTML="";return}
    const ft=V9.J.set&&+V9.J.set.start_balance;
    el.innerHTML=`<div class="v2-t"><span>مخاطرة الصفقة</span><b class="num">${k.risk?V9.money(-k.risk,c):"—"}</b><small>${k.risk&&ft?(k.risk/ft*100).toFixed(2)+"% من رصيد البداية":t.sl?"":"حط وقف حتى تنحسب R"}</small></div>
      <div class="v2-t"><span>الربح قبل التكاليف</span><b class="num">${k.closed?V9.money(k.gross,c):"—"}</b><small>${k.closed?`مسكّر ${k.closed.toFixed(2)} من ${(+t.lots).toFixed(2)} لوت`:"لسه مفتوحة"}</small></div>
      <div class="v2-t"><span>الصافي</span><b class="num">${t.pnl!=null?V9.money(t.pnl,c):"—"}</b><small>${t.pnl_manual?"من كشف البروكر":"بعد العمولة والسبريد والسواب"}</small></div>
      <div class="v2-t"><span>R</span><b class="num ${t.r_mult>0?"up":t.r_mult<0?"down":""}">${t.r_mult!=null?(t.r_mult>0?"+":"")+t.r_mult.toFixed(2)+"R":"—"}</b><small>الربح ÷ المخاطرة</small></div>
      ${k.closed>+t.lots*1.0001?'<div class="v3-warn red" style="grid-column:1/-1">⛔ مجموع الإغلاقات أكبر من حجم الصفقة</div>':""}${t.sl&&(t.side==="buy"?t.sl>=t.entry:t.sl<=t.entry)?'<div class="v3-warn red" style="grid-column:1/-1">⛔ الوقف بالجهة الغلط من الدخول</div>':""}${V9.ccy()!=="USD"&&!t.fx_rate?'<div class="v3-warn" style="grid-column:1/-1">⚠️ اكتب سعر الصرف حتى يتحول الربح لعملة حسابك</div>':""}`},
  async jSave(){const{t,k}=V9.jRead();if(!t.entry||!t.lots||!t.opened_at)return V9.toast("اكتب وقت الدخول وسعر الدخول واللوت",1);
    if(k.closed>+t.lots*1.0001)return V9.toast("مجموع الإغلاقات أكبر من حجم الصفقة",1);if(t.closed_at&&new Date(t.closed_at)<new Date(t.opened_at))return V9.toast("وقت الخروج قبل الدخول",1);
    if(t.closed_at&&!k.closed&&!t.pnl_manual)return V9.toast("اكتب سعر الخروج أو الربح من كشف البروكر",1);
    try{if(V9.J.edit&&V9.J.edit.id)await V9.api().jUpd(V9.J.edit.id,t);else await V9.api().jAdd(t);V9.J.edit=null;await V9.jLoad();V9.toast("✅ انحفظت الصفقة");V9.jTab("log")}catch(e){V9.toast(V9.err(e),1)}},
  async jSigPick(){const el=$("v9SigPick");await V3.loadPub();const L=(V3.pub||[]).slice(0,12);
    el.innerHTML=L.length?`<div class="v3-slist v9-sig">${L.map((p,i)=>`<button type="button" class="v3-srow" data-si="${i}"><b class="${p.side==="buy"?"up":"down"}">${p.side==="buy"?"▲":"▼"} <bdi dir="ltr">${esc(p.sym)}</bdi></b><span class="num"><bdi dir="ltr">${fx(+p.entry,+p.dec||V9.dec(p.sym))} · SL ${fx(+p.sl,+p.dec||V9.dec(p.sym))}</bdi></span><span class="label">${esc(V9.dt(p.sig_time))}</span></button>`).join("")}</div>`:'<p class="label">ما في توصيات منشورة حديثة.</p>';
    el.onclick=e=>{const b=e.target.closest("[data-si]");if(!b)return;const p=L[+b.dataset.si];$("jS").value=p.sym;$("jD").value=p.side;$("jE").value=p.entry;$("jSl").value=p.sl;$("jTp").value=p.tp1??"";$("jSt").value=$("jSt").value||"توصية فيكسورا";
      V9.J.sig=String(p.id);V9.J.src="signal";el.innerHTML=`<div class="v3-warn ok">✅ <span>انسخت التوصية. اكتب اللوت وسعر دخولك الفعلي إذا يختلف.</span></div>`;V9.jPrev()}},
  jCurve(v,w,h){if(v.length<2)return'<p class="label">يحتاج صفقتين مسكّرة على الأقل.</p>';const a=[0,...v];return V9.spark(a,a.at(-1)>=0?"#D4AF37":"#f0606f",w||520,h||150)},
  gTable(t,G,c){return`<section class="panel"><h3 class="v9-h3">${t}</h3>${G.length?`<div class="v3-tw"><table class="v3-tb"><thead><tr><th></th><th>صفقات</th><th>نجاح</th><th>الصافي <bdi>${esc(c)}</bdi></th><th>متوسط R</th></tr></thead><tbody>${G.map(g=>`<tr><td ${G.noi?"data-noi18n":""}>${esc(g.k)}</td><td class="num">${g.n}${g.n<5?' <span class="label">·عينة صغيرة</span>':""}</td><td class="num">${g.win==null?"—":g.win.toFixed(0)+"%"}</td><td>${V9.money(g.net,c,1)}</td><td class="num">${g.expR==null?"—":g.expR.toFixed(2)}</td></tr>`).join("")}</tbody></table></div>`:'<p class="label" style="margin:0">ما في بيانات كافية.</p>'}</section>`},
  insights(L){const c=V9.ccy(),out=[],MIN=5,cl=L.filter(t=>t.closed_at&&t.pnl!=null);if(cl.length<10)return[{l:1,t:`عندك ${cl.length} صفقة مسكّرة. الملاحظات تصير موثوقة بعد 30 صفقة على الأقل؛ لهسه الأرقام للاطلاع بس.`}];
    const pick=(G,lbl)=>{const g=G.filter(x=>x.n>=MIN);if(g.length<2)return;const w=g.slice().sort((a,b)=>a.net-b.net)[0],b=g.slice().sort((a,b)=>b.net-a.net)[0];
      if(w.net<0)out.push({l:2,t:`أضعف ${lbl}: <b>${esc(w.k)}</b> (${w.n} صفقة، صافي ${V9.money(w.net,c)}). أفضل ${lbl}: <b>${esc(b.k)}</b> (${V9.money(b.net,c)}).`})};
    pick(V9.group(L,t=>V9.sess(t.opened_at)),"جلسة");pick(V9.group(L,t=>t.sym),"أصل");pick(V9.group(L,t=>t.strategy),"استراتيجية");pick(V9.group(L,t=>V9.WD[new Date(t.opened_at).getDay()]),"يوم");
    const P=V9.group(L,t=>t.followed_plan==null?null:t.followed_plan?"التزمت":"ما التزمت"),y=P.find(x=>x.k==="التزمت"),n=P.find(x=>x.k==="ما التزمت");
    if(n&&n.n>=3)out.push({l:n.net<0?3:1,t:`لمن ما التزمت بخطتك (${n.n} صفقة) كان الصافي ${V9.money(n.net,c)}${y?`، ولمن التزمت (${y.n}) ${V9.money(y.net,c)}`:""}.`});
    const E=V9.group(L,t=>t.emotion).filter(x=>x.n>=3&&x.net<0).sort((a,b)=>a.net-b.net)[0];if(E)out.push({l:2,t:`صفقات شعور «${esc(E.k)}» كلفتك ${V9.money(E.net,c)} من ${E.n} صفقة.`});
    const s=V9.stats(L);if(s.avgW&&s.avgL&&s.avgL>s.avgW*1.3)out.push({l:2,t:`متوسط خسارتك (${V9.money(-s.avgL,c)}) أكبر من متوسط ربحك (${V9.money(s.avgW,c)}). راجع مكان الوقف والخروج المبكر.`});
    const ns=cl.filter(t=>!t.sl).length;if(ns)out.push({l:ns/cl.length>.2?3:1,t:`${ns} صفقة بدون وقف خسارة مسجّل.`});
    return out.length?out:[{l:0,t:"ما لكيت نمط سلبي واضح بالعينة الحالية."}]},
  jAn(B){const L=V9.J.rows,c=V9.ccy(),s=V9.stats(L);
    B.innerHTML=`<div class="v9-an1"><section class="panel"><h3 class="v9-h3">📈 منحنى الربح التراكمي</h3>${V9.jCurve(s.curve)}<p class="label" style="font-size:12px;margin:6px 0 0">بعد العمولة والسبريد والسواب · بعملة <bdi>${esc(c)}</bdi></p></section>
      <section class="panel"><h3 class="v9-h3">🧠 ملاحظات من بياناتك</h3><div class="v9-ins">${V9.insights(L).map(i=>`<div class="v3-warn ${i.l>=3?"red":i.l===2?"":i.l===0?"ok":"gold"}">${i.l>=3?"⛔":i.l===2?"⚠️":i.l===0?"✅":"ℹ️"} <span>${i.t}</span></div>`).join("")}</div><p class="v3-note">ملاحظات بقواعد حسابية ثابتة من صفقاتك، مو ذكاء صناعي ولا نصيحة مالية.</p></section></div>
      <div class="v9-an2">${V9.gTable("🌍 حسب الجلسة (UTC)",V9.group(L,t=>V9.sess(t.opened_at)),c)}${V9.gTable("💱 حسب الأصل",V9.group(L,t=>t.sym),c)}${V9.gTable("🧩 حسب الاستراتيجية",Object.assign(V9.group(L,t=>t.strategy),{noi:1}),c)}
      ${V9.gTable("📅 حسب اليوم",V9.group(L,t=>V9.WD[new Date(t.opened_at).getDay()]),c)}${V9.gTable("💭 حسب الشعور",V9.group(L,t=>t.emotion),c)}${V9.gTable("📏 الالتزام بالخطة",V9.group(L,t=>t.followed_plan==null?null:t.followed_plan?"التزمت":"ما التزمت"),c)}</div>`},
  jWeek(B){const L=V9.J.rows,c=V9.ccy(),now=Date.now(),wk=7*864e5,inR=(t,a,b)=>t.closed_at&&new Date(t.closed_at)>=a&&new Date(t.closed_at)<b;
    const A=L.filter(t=>inR(t,new Date(now-wk),new Date(now+1))),P=L.filter(t=>inR(t,new Date(now-2*wk),new Date(now-wk))),a=V9.stats(A),p=V9.stats(P);
    const d=(x,y,f)=>x==null||y==null?"":`<small class="${x>=y?"up":"down"}">${x>=y?"▲":"▼"} الأسبوع الماضي ${f(y)}</small>`,best=A.filter(t=>t.pnl!=null).sort((x,y)=>y.pnl-x.pnl);
    B.innerHTML=`<section class="panel"><div class="ph"><h3 class="v9-h3" style="margin:0">🗓 تقرير آخر 7 أيام</h3><span class="label"><bdi dir="ltr">${esc(new Date(now-wk).toLocaleDateString("en-GB"))} – ${esc(new Date(now).toLocaleDateString("en-GB"))}</bdi></span></div>
      ${a.n?`<div class="v3-sum"><div class="v2-t"><span>الصفقات</span><b class="num">${a.n}</b>${d(a.n,p.n,x=>x)}</div><div class="v2-t"><span>الصافي</span><b>${V9.money(a.net,c)}</b>${d(a.net,p.net,x=>x.toFixed(0))}</div>
        <div class="v2-t"><span>نسبة النجاح</span><b class="num">${a.win.toFixed(0)}%</b>${d(a.win,p.win,x=>x.toFixed(0)+"%")}</div><div class="v2-t"><span>الالتزام بالخطة</span><b class="num">${a.plan==null?"—":a.plan.toFixed(0)+"%"}</b>${d(a.plan,p.plan,x=>x.toFixed(0)+"%")}</div></div>
        <div class="v9-wk">${best[0]?`<div class="v3-warn ok">🏆 <span>أفضل صفقة: <bdi dir="ltr">${esc(best[0].sym)}</bdi> ${V9.money(best[0].pnl,c)}${best[0].strategy?` · ${esc(best[0].strategy)}`:""}</span></div>`:""}${best.length>1&&best.at(-1).pnl<0?`<div class="v3-warn red">📉 <span>أسوأ صفقة: <bdi dir="ltr">${esc(best.at(-1).sym)}</bdi> ${V9.money(best.at(-1).pnl,c)}${best.at(-1).reason_out?` · ${esc(best.at(-1).reason_out.slice(0,90))}`:""}</span></div>`:""}
        ${V9.insights(A).slice(0,4).map(i=>`<div class="v3-warn ${i.l>=3?"red":i.l===2?"":"gold"}">${i.l>=3?"⛔":i.l===2?"⚠️":"ℹ️"} <span>${i.t}</span></div>`).join("")}</div>
        <p class="v3-note">التقرير يتولد من صفقاتك المسجّلة بقواعد ثابتة. ${a.n<20?"عدد الصفقات قليل، فالنسب ممكن تتغير كثير بصفقة وحدة.":""}</p>`
      :'<p class="label">ما سكّرت صفقات خلال آخر 7 أيام.</p>'}</section>`},
  jSettings(B){const s=V9.J.set||{acct_ccy:"USD",start_balance:0,share_coach:false};
    B.innerHTML=`<div class="v3-grid2"><section class="panel"><h3 class="v9-h3">⚙️ إعدادات الدفتر</h3><div class="v3-fm"><label>عملة الحساب<select id="jsC">${V9.CCY.map(c=>`<option ${c===s.acct_ccy?"selected":""}>${c}</option>`).join("")}</select></label><label>رصيد البداية<input id="jsB" type="number" min="0" step="any" class="ltr" value="${+s.start_balance||""}"></label></div>
      <label class="v9-ck"><input type="checkbox" id="jsS" ${s.share_coach?"checked":""}> <span>أسمح للكوتش يشوف دفتري (الصفقات والملاحظات، بدون الصور). أكدر ألغيها بأي وقت.</span></label>
      <div class="v3-act"><button class="btn primary" type="button" id="jsSave">حفظ</button></div></section>
      <section class="panel"><h3 class="v9-h3">⇅ استيراد وتصدير</h3><p class="label" style="margin:0 0 8px;font-size:12.5px">الاستيراد يقبل ملف CSV من MT5 أو أي جدول فيه أعمدة: Symbol, Type, Volume, Open Time, Open Price, Close Time, Close Price, S/L, T/P, Commission, Swap, Profit.</p>
      <div class="v3-act" style="margin:0"><label class="btn v2s" style="cursor:pointer">⬆️ اختار ملف CSV<input type="file" id="jsIm" accept=".csv,text/csv" hidden></label><button class="btn v2s" type="button" id="jsEx">⬇️ تصدير CSV</button></div><div id="jsImP"></div>
      <h3 class="v9-h3" style="margin-top:16px">🗑 مسح الدفتر</h3><p class="label" style="margin:0 0 8px;font-size:12.5px">يمسح كل صفقاتك من الدفتر نهائياً. صدّر نسخة أول.</p><button class="btn v2s v9-danger" type="button" id="jsDel">مسح كل الصفقات</button></section></div>`;
    $("jsSave").onclick=async()=>{const r={acct_ccy:$("jsC").value,start_balance:+$("jsB").value||0,share_coach:$("jsS").checked};try{await V9.api().jSetSave(r);V9.J.set={...(V9.J.set||{}),...r};V9.jKpi();V9.toast("✅ انحفظت")}catch(e){V9.toast(V9.err(e),1)}};
    $("jsEx").onclick=()=>V9.csvOut();$("jsIm").onchange=e=>{const f=e.target.files[0];e.target.value="";if(f)V9.csvIn(f)};
    $("jsDel").onclick=async()=>{const v=prompt("حتى تأكد، اكتب كلمة: امسح","");if(v!=="امسح")return;try{const n=await V9.api().jDelAll();await V9.jLoad();V9.toast(`انمسحت ${n} صفقة`);V9.jSettings(B)}catch(e){V9.toast(V9.err(e),1)}}},
  COLS:["opened_at","closed_at","sym","side","lots","entry","exit","sl","tp","commission","spread_cost","swap","pnl","r_mult","strategy","emotion","followed_plan","reason_in","reason_out","notes"],
  csvOut(){const q=v=>{v=v==null?"":String(v);return/[",\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};
    const rows=V9.J.rows.map(t=>{const k=V9.calc(t);return V9.COLS.map(c=>c==="exit"?(k.avg!=null?+k.avg.toFixed(6):""):c==="tp"?(t.tp&&t.tp[0])??"":c==="followed_plan"?(t.followed_plan==null?"":t.followed_plan?"yes":"no"):t[c]).map(q).join(",")});
    const b=new Blob(["﻿"+[V9.COLS.join(","),...rows].join("\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`vexora-journal-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3e3)},
  parseCsv(txt){const out=[];let row=[],f="",q=false;txt=txt.replace(/^﻿/,"");const sep=(txt.split("\n")[0].match(/;/g)||[]).length>(txt.split("\n")[0].match(/,/g)||[]).length?";":(txt.split("\n")[0].includes("\t")?"\t":",");
    for(let i=0;i<txt.length;i++){const ch=txt[i];if(q){if(ch==='"'){if(txt[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}else if(ch==='"')q=true;else if(ch===sep){row.push(f);f=""}else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&txt[i+1]==="\n")i++;row.push(f);f="";if(row.some(x=>x.trim()!==""))out.push(row);row=[]}else f+=ch}
    row.push(f);if(row.some(x=>x.trim()!==""))out.push(row);return out},
  ALIAS:{sym:["symbol","sym","asset","instrument","الأصل"],side:["type","side","direction","action","الاتجاه"],lots:["volume","lots","size","qty","lot","اللوت"],opened_at:["open time","opened_at","time","open date","entry time","وقت الدخول"],
    entry:["open price","entry","price","entry price","سعر الدخول"],closed_at:["close time","closed_at","exit time","close date","وقت الخروج"],exit:["close price","exit","exit price","سعر الخروج"],sl:["s / l","s/l","sl","stop loss","الوقف"],tp:["t / p","t/p","tp","take profit","الهدف"],
    commission:["commission","fee","العمولة"],swap:["swap","السواب"],pnl:["profit","pnl","p/l","net","الربح"],strategy:["strategy","setup","الاستراتيجية"],notes:["notes","comment","ملاحظات"],emotion:["emotion"],spread_cost:["spread_cost","spread"],followed_plan:["followed_plan"],reason_in:["reason_in"],reason_out:["reason_out"]},
  normSym(s){s=String(s||"").toUpperCase().replace(/[^A-Z0-9/]/g,"");const m=s.match(/^(XAU|XAG|BTC|ETH|EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)\/?(USD|JPY|CAD|CHF|EUR|GBP|AUD|NZD)/);return m?m[1]+"/"+m[2]:s.slice(0,15)},
  date(v){if(!v)return null;v=String(v).trim().replace(/^(\d{4})\.(\d{2})\.(\d{2})/,"$1-$2-$3");const d=new Date(/\d{2}:\d{2}/.test(v)&&!/Z|[+-]\d{2}:?\d{2}$/.test(v)?v.replace(" ","T")+"Z":v);return isNaN(d)?null:d.toISOString()},
  async csvIn(file){const el=$("jsImP");if(file.size>3e6)return V9.toast("الملف كبير (أقصى 3MB)",1);const R=V9.parseCsv(await file.text());if(R.length<2)return V9.toast("الملف فارغ",1);
    const H=R[0].map(h=>h.trim().toLowerCase()),ix={};for(const k in V9.ALIAS){const i=H.findIndex(h=>V9.ALIAS[k].includes(h));if(i>=0)ix[k]=i}
    if(ix.sym==null||ix.side==null||ix.lots==null||ix.entry==null||ix.opened_at==null){el.innerHTML=`<div class="v3-warn red">⛔ <span>ما لكيت الأعمدة الأساسية (Symbol, Type, Volume, Open Time, Open Price).</span></div>`;return}
    const g=(r,k)=>ix[k]==null?"":String(r[ix[k]]??"").trim(),n=(r,k)=>{const v=g(r,k).replace(/\s/g,"").replace(",",".");return v===""||isNaN(+v)?null:+v},rows=[],bad=[];
    R.slice(1,1001).forEach((r,i)=>{const sd=g(r,"side").toLowerCase(),side=/sell|بيع|short/.test(sd)?"sell":/buy|شراء|long/.test(sd)?"buy":null,o=V9.date(g(r,"opened_at")),c=V9.date(g(r,"closed_at")),lots=n(r,"lots"),e=n(r,"entry"),x=n(r,"exit"),p=n(r,"pnl");
      if(!side||!o||!lots||!e){bad.push(i+2);return}
      const t={sym:V9.normSym(g(r,"sym")),side,opened_at:o,closed_at:c,lots,entry:e,sl:n(r,"sl")||null,tp:n(r,"tp")?[n(r,"tp")]:null,exits:x&&c?[{lots,price:x,at:c}]:[],commission:Math.abs(n(r,"commission")||0),spread_cost:Math.abs(n(r,"spread_cost")||0),swap:n(r,"swap")||0,
        strategy:g(r,"strategy").slice(0,60),notes:g(r,"notes").slice(0,2000),emotion:g(r,"emotion").slice(0,40),reason_in:g(r,"reason_in").slice(0,1000),reason_out:g(r,"reason_out").slice(0,1000),followed_plan:/^(yes|1|true|نعم)$/i.test(g(r,"followed_plan"))?true:/^(no|0|false|لا)$/i.test(g(r,"followed_plan"))?false:null,source:"csv",fx_rate:1,quote_ccy:V9.ccy()};
      if(p!=null&&c){t.pnl=p;t.pnl_manual=true;const k=V9.calc(t);if(k.risk>0)t.r_mult=+((p+t.commission-t.swap)/k.risk).toFixed(3)}else if(c&&x){const k=V9.calc(t);t.pnl=+k.net.toFixed(2);t.r_mult=k.r!=null?+k.r.toFixed(3):null}
      rows.push(t)});
    const ex=new Set(V9.J.rows.map(t=>t.sym+"|"+new Date(t.opened_at).getTime()+"|"+(+t.lots))),fresh=rows.filter(t=>!ex.has(t.sym+"|"+new Date(t.opened_at).getTime()+"|"+(+t.lots)));
    el.innerHTML=`<div class="v3-warn gold" style="margin-top:8px">📄 <span>لكيت ${rows.length} صفقة صالحة${fresh.length<rows.length?`، منها ${rows.length-fresh.length} موجودة من قبل`:""}${bad.length?`، و${bad.length} سطر ناقص (${bad.slice(0,6).join("، ")}${bad.length>6?"…":""})`:""}.</span></div>${fresh.length?`<div class="v3-act"><button class="btn primary" type="button" id="jsImGo">استورد ${fresh.length} صفقة</button></div>`:""}`;
    if($("jsImGo"))$("jsImGo").onclick=async()=>{$("jsImGo").disabled=true;try{for(let i=0;i<fresh.length;i+=200)await V9.api().jAddMany(fresh.slice(i,i+200));await V9.jLoad();V9.toast(`✅ انستوردت ${fresh.length} صفقة`);V9.jTab("log")}catch(e){V9.toast(V9.err(e),1);$("jsImGo").disabled=false}}},

  /* ---------------- محرك مخاطر المحفظة (إضافات على حارس المخاطر) ---------------- */
  rk:{acct:"USD",fx:1},
  ccyOf(s){const[a,b]=s.split("/");return[a,b]},
  usdPx(cur){if(cur==="USD")return 1;const d=(s,inv)=>{const c=cache[s+"|H1"]||cache[s+"|"+S.tf],v=c&&c.data&&c.data.at(-1)&&c.data.at(-1).close;return v?(inv?1/v:v):null};
    const m={EUR:["EUR/USD",0],GBP:["GBP/USD",0],AUD:["AUD/USD",0],XAU:["XAU/USD",0],XAG:["XAG/USD",0],BTC:["BTC/USD",0],ETH:["ETH/USD",0],JPY:["USD/JPY",1],CAD:["USD/CAD",1],CHF:["USD/CHF",1]}[cur];
    if(!m)return null;const v=d(m[0],m[1]);if(v)return v;const x=SYMS.find(y=>y.s===m[0]);return x?(m[1]?1/x.p:x.p):null},
  exposure(open){const E={};open.forEach(t=>{const x=SYMS.find(y=>y.s===t.sym);if(!x)return;const[b,q]=V9.ccyOf(t.sym),units=+t.lots*x.lot,bu=V9.usdPx(b)||0,notional=units*bu;
    E[b]=(E[b]||0)+t.dir*notional;E[q]=(E[q]||0)-t.dir*notional});return E},
  scen(open,kind,pct){let s=0;open.forEach(t=>{const x=SYMS.find(y=>y.s===t.sym);if(!x)return;const[b,q]=V9.ccyOf(t.sym);let ch=0;
    if(kind==="usd"){if(q==="USD")ch=-pct;else if(b==="USD")ch=pct}else if(kind===t.sym)ch=pct;
    const px=+t.entry;s+=t.dir*px*ch/100*+t.lots*V3.valPer(t.sym,px)});return s},
  rkExt(){const body=$("v3RkBody");if(!body||!$("rkG"))return;let el=$("v9Rk");if(!el){el=document.createElement("div");el.id="v9Rk";el.className="v9-rk";body.appendChild(el);V9.rkBuild(el)}V9.rkUpd()},
  rkBuild(el){const s=V3.RK.set||{};V9.rk.acct=s.acct_ccy||"USD";
    el.innerHTML=`<div class="v9-rk3"><section class="panel"><h3 class="v9-h3">🧮 حاسبة حجم الصفقة</h3><div class="v3-fm"><label>عملة الحساب<select id="v9Ac">${V9.CCY.map(c=>`<option ${c===V9.rk.acct?"selected":""}>${c}</option>`).join("")}</select></label><label id="v9FxL" ${V9.rk.acct==="USD"?"hidden":""}>1 USD = ?<input id="v9Fx" type="number" step="any" min="0" class="ltr" value="${s.fx||""}"></label>
        <label>الأصل<select id="v9Cs">${SYMS.map(x=>`<option value="${esc(x.s)}" ${x.s===S.sym.s?"selected":""}>${esc(x.n)} · ${esc(x.s)}</option>`).join("")}</select></label><label>مخاطرة %<input id="v9Cr" type="number" min="0.05" max="10" step="0.05" class="ltr" value="${s.risk_pct||1}"></label>
        <label>الدخول<input id="v9Ce" type="number" step="any" class="ltr"></label><label>الوقف<input id="v9Cl" type="number" step="any" class="ltr"></label></div><div id="v9CO"></div></section>
      <section class="panel"><h3 class="v9-h3">🥧 التعرض حسب العملة</h3><div id="v9Ex"></div></section>
      <section class="panel"><h3 class="v9-h3">🎯 لو صار هذا…</h3><div id="v9Sc"></div><div class="v3-fm" style="margin-top:8px"><label>حركة مخصصة على<select id="v9Ss">${SYMS.map(x=>`<option value="${esc(x.s)}">${esc(x.s)}</option>`).join("")}</select></label><label>بنسبة %<input id="v9Sp" type="number" step="0.1" class="ltr" value="-2"></label></div><div id="v9ScC"></div></section></div>
      <div class="v3-grid2"><section class="panel"><h3 class="v9-h3">📉 التراجع من أعلى رصيد</h3><div class="v3-fm"><label>أعلى رصيد وصلته<input id="v9Pk" type="number" min="0" step="any" class="ltr"></label><label>أقصى تراجع مسموح %<input id="v9Md" type="number" min="1" max="90" step="0.5" class="ltr" value="${s.max_dd_pct||10}"></label></div><div id="v9DD"></div><div class="v3-act"><button class="btn" type="button" id="v9DdSave">حفظ</button></div></section>
      <section class="panel"><h3 class="v9-h3">🔔 سجل التنبيهات</h3><div id="v9Al" class="v3-slist"></div></section></div>
      <p class="v3-note">كل الأرقام تقديرية من مواصفات العقد وآخر سعر متوفر. ماكو حجم صفقة «آمن» أو مضمون؛ الحساب يحدد الخسارة المتوقعة لو ضرب الوقف بس، والانزلاق والفجوات ممكن تزيدها.</p>`;
    const calc=()=>V9.rkCalc();["v9Cs","v9Cr","v9Ce","v9Cl","v9Fx"].forEach(i=>$(i).addEventListener("input",calc));
    $("v9Ac").onchange=e=>{V9.rk.acct=e.target.value;$("v9FxL").hidden=V9.rk.acct==="USD";calc();V9.rkSaveExt({acct_ccy:V9.rk.acct})};
    $("v9Cs").addEventListener("change",()=>{const x=SYMS.find(y=>y.s===$("v9Cs").value),c=cache[x.s+"|"+S.tf]||cache[x.s+"|H1"],p=c&&c.data&&c.data.at(-1)&&c.data.at(-1).close;if(p)$("v9Ce").value=(+p).toFixed(x.dec);calc()});
    ["v9Ss","v9Sp"].forEach(i=>$(i).addEventListener("input",()=>V9.rkUpd()));
    $("v9DdSave").onclick=async()=>{await V9.rkSaveExt({peak_balance:+$("v9Pk").value||null,max_dd_pct:+$("v9Md").value||10});V9.rkUpd();V9.toast("✅ انحفظ")};
    ["v9Pk","v9Md"].forEach(i=>$(i).addEventListener("input",()=>V9.rkDD()));
    const p=S.A&&S.A.px;if(p){$("v9Ce").value=(+p).toFixed(S.sym.dec)}V9.rkCalc()},
  async rkSaveExt(r){try{await V9.api().rkExt(r);V3.RK.set={...(V3.RK.set||{}),...r}}catch(e){V9.toast(V9.err(e),1)}},
  rkCalc(){const o=$("v9CO");if(!o)return;const sym=$("v9Cs").value,x=SYMS.find(y=>y.s===sym),e=+$("v9Ce").value,sl=+$("v9Cl").value,rp=+$("v9Cr").value,bal=+(V3.RK.set&&V3.RK.set.balance)||0,ac=V9.rk.acct,fxr=ac==="USD"?1:+$("v9Fx").value;
    if(!bal){o.innerHTML='<div class="v3-warn">⚠️ <span>اكتب رصيد حسابك بـ«حدودي» فوق أول.</span></div>';return}if(ac!=="USD"&&!fxr){o.innerHTML=`<div class="v3-warn">⚠️ <span>اكتب سعر الصرف: 1 USD = كم <bdi>${esc(ac)}</bdi></span></div>`;return}
    if(!e||!sl||e===sl){o.innerHTML='<p class="label" style="margin:8px 0 0">اكتب الدخول والوقف.</p>';return}
    const vp=V3.valPer(sym,e),dist=Math.abs(e-sl),riskAcct=bal*rp/100,riskUsd=riskAcct/fxr,perLot=dist*vp,lots=Math.floor(riskUsd/perLot*100)/100,real=lots*perLot*fxr,pip=x.pip*vp*fxr;
    o.innerHTML=`<div class="v2-t v9-big"><span>الحجم المحسوب</span><b class="num ${lots>=.01?"up":"down"}"><bdi dir="ltr">${lots>=.01?lots.toFixed(2):"0.00"}</bdi> لوت</b><small><span>الخسارة لو ضرب الوقف</span> ${V9.money(-real,ac)} · <span>قيمة النقطة للوت</span> <bdi dir="ltr">${pip.toFixed(2)} ${esc(ac)}</bdi></small></div>
      <div class="v9-kv"><span>حجم العقد</span><bdi dir="ltr">${x.lot.toLocaleString("en-US")}</bdi><span>مسافة الوقف</span><bdi dir="ltr">${fx(dist,x.dec)} (${(dist/x.pip).toFixed(0)} pip)</bdi><span>عملة التسعير</span><bdi dir="ltr">${esc(sym.split("/")[1])}${x.q!=="usd"?" → USD":""}</bdi></div>
      ${lots<.01?'<div class="v3-warn red">⛔ <span>الوقف بعيد على هذا الرصيد: حتى أصغر لوت (0.01) يتجاوز المخاطرة اللي حددتها.</span></div>':""}
      <div class="v3-act"><button class="btn v2s" type="button" id="v9Use" ${lots<.01?"disabled":""}>استخدم بالصفقة ↑</button></div>`;
    if($("v9Use"))$("v9Use").onclick=()=>{V3.rkFill(sym,e>sl?1:-1,e,sl,null);$("rkL").value=lots.toFixed(2);V3.rkPrev();$("rkS").scrollIntoView({behavior:"smooth",block:"center"})}},
  rkDD(){const el=$("v9DD");if(!el)return;const bal=+(V3.RK.set&&V3.RK.set.balance)||0,pk=Math.max(+$("v9Pk").value||0,bal),md=+$("v9Md").value||10,dd=pk?(pk-bal)/pk*100:0;
    el.innerHTML=bal?`<div class="v2-t"><span>التراجع الحالي</span><b class="num ${dd>=md?"down":dd>=md*.7?"gold":"up"}">${dd.toFixed(2)}%</b><div class="v2-pbar" style="margin-top:4px"><i style="width:${Math.min(100,dd/md*100)}%"></i></div><small>من حد ${md}% · القمة <bdi dir="ltr">${pk.toLocaleString("en-US")}</bdi></small></div>${dd>=md?'<div class="v3-warn red">⛔ <span>وصلت أقصى تراجع حددته. خفّف الحجم أو وكّف لحد ما تراجع خطتك.</span></div>':""}`:'<p class="label">اكتب رصيدك بالحدود فوق.</p>';return{dd,md}},
  async rkUpd(){if(!$("v9Rk"))return;const open=V3.RK.tr.filter(t=>t.status==="open"),C=V3.rkCheck(),ac="USD",s=V3.RK.set||{};
    if(s.peak_balance&&$("v9Pk")&&!$("v9Pk").value)$("v9Pk").value=s.peak_balance;
    const E=V9.exposure(open),tot=Object.values(E).reduce((a,v)=>a+Math.abs(v),0);
    $("v9Ex").innerHTML=open.length&&tot?`<div class="v9-exl">${Object.entries(E).filter(([,v])=>Math.abs(v)>1e-6).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k,v])=>`<div class="v9-exr"><b class="ltr">${esc(k)}</b><div class="v9-exb"><i class="${v>0?"l":"s"}" style="width:${Math.abs(v)/tot*200}%"></i></div><span class="num ${v>0?"up":"down"}"><bdi dir="ltr">${v>0?"+":"−"}$${Math.round(Math.abs(v)).toLocaleString("en-US")}</bdi></span></div>`).join("")}</div><p class="v3-note">قيمة العقد الاسمية بالدولار: + شراء العملة، − بيعها. صفقتين على نفس العملة تتجمع هنا.</p>`:'<p class="label" style="margin:0">ما عندك صفقات مفتوحة مسجّلة.</p>';
    const bal=C.bal,pc=v=>bal?` · ${(v/bal*100).toFixed(2)}%`:"",row=(l,v)=>`<div class="v3-srow"><span>${l}</span><span class="num" style="margin-inline-start:auto">${V9.money(v,ac)}<span class="label">${pc(v)}</span></span></div>`;
    $("v9Sc").innerHTML=open.length?`<div class="v3-slist">${row("كل الوقوف تضرب",-C.tot)}${row("الدولار يقوى 1%",V9.scen(open,"usd",1))}${row("الدولار يضعف 1%",V9.scen(open,"usd",-1))}${open.some(t=>t.sym==="XAU/USD")?row("الذهب ينزل 2%",V9.scen(open,"XAU/USD",-2)):""}</div>`:'<p class="label" style="margin:0">سجّل صفقاتك المفتوحة حتى تشوف السيناريوهات.</p>';
    const cs=$("v9Ss")&&$("v9Ss").value,cp=+($("v9Sp")&&$("v9Sp").value)||0;$("v9ScC").innerHTML=open.length&&cs?`<div class="v3-slist" style="margin-top:6px">${row(`<bdi dir="ltr">${esc(cs)} ${cp>0?"+":""}${cp}%</bdi>`,V9.scen(open,cs,cp))}</div>`:"";
    const d=V9.rkDD();
    // التنبيهات المهمة تنسجل مرة وحدة باليوم
    const al=[];if(C.totP>=C.s.max_total_pct&&bal)al.push(["total_risk",`المخاطرة المفتوحة ${C.totP.toFixed(2)}% تجاوزت ${C.s.max_total_pct}%`,"crit"]);if(C.dlP>=C.s.max_daily_pct&&bal)al.push(["daily_loss",`خسارة اليوم ${C.dlP.toFixed(2)}% وصلت حد ${C.s.max_daily_pct}%`,"crit"]);
    if(d&&d.dd>=d.md&&bal)al.push(["max_dd",`التراجع ${d.dd.toFixed(2)}% وصل حد ${d.md}%`,"crit"]);if(C.W.some(w=>/مرتبطين/.test(w.t)))al.push(["corr","صفقات مرتبطة بنفس الاتجاه","warn"]);
    for(const a of al)try{await V9.api().alertLog(a[0],a[1],a[2])}catch(e){}
    let L=[];try{L=await V9.api().alerts()||[]}catch(e){}
    $("v9Al").innerHTML=L.length?L.slice(0,8).map(a=>`<div class="v3-srow"><span>${a.level==="crit"?"⛔":"⚠️"}</span><span>${esc(a.msg)}</span><span class="label" style="margin-inline-start:auto"><bdi dir="ltr">${esc(V9.dt(a.created_at))}</bdi></span></div>`).join(""):'<p class="label" style="margin:0">ما في تنبيهات. كل تجاوز مهم ينسجل هنا مرة وحدة باليوم.</p>'},

  view(v){const sec={journal:"v9JrView",radar:"v9RdView"};for(const k in sec){const e=$(sec[k]);if(e)e.hidden=v!==k}
    if(v==="journal")V9.jPage().catch(e=>console.warn(e));if(v==="radar")V9.rPage().catch(e=>console.warn(e))}
};
{const _r=V3.rkRender;V3.rkRender=function(){const o=_r.apply(this,arguments);try{V9.rkExt()}catch(e){console.warn(e)}return o}}
window.__v9=V9;

/* ================= V10: نسبة النجاح · مناطق الليمت الذكية · التحليل المتقدم ================= */
const V10={sym:null,days:90,
  api(){return DB.v10},
  toast(t,b){V9.toast(t,b)},err(e){return V9.err(e)},
  demo(){return V10.api().demo?'<span class="v9-demo">بيانات توضيحية</span>':""},
  pct(v){return v==null?"—":`<bdi dir="ltr">${Math.round(v)}%</bdi>`},
  ci(c){return c&&c.lo!=null?`<bdi dir="ltr">${c.lo}–${c.hi}%</bdi>`:"—"},
  r(v){return v==null?"—":`<bdi dir="ltr" class="${v>0?"up":v<0?"down":""}">${v>0?"+":""}${(+v).toFixed(2)}R</bdi>`},
  wil(k,n){if(!n)return{lo:null,hi:null};const p=k/n,z=1.96,d=1+z*z/n,c=p+z*z/(2*n),m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return{lo:Math.round(100*(c-m)/d),hi:Math.round(100*(c+m)/d)}},
  bar(g){const c=g.ci||{};if(g.rate==null)return"";return`<div class="v10-ci"><i class="rng" style="inset-inline-start:${c.lo}%;width:${Math.max(1,c.hi-c.lo)}%"></i><i class="pt" style="inset-inline-start:${g.rate}%"></i><i class="mid"></i></div>`},
  SESS:{asia:"آسيا",london:"لندن",overlap:"تداخل لندن ونيويورك",ny:"نيويورك"},
  Q:{q85:"جودة 85+",q70:"جودة 70–84",q55:"جودة 55–69",q0:"أقل من 55",none:"بدون درجة"},
  SIDE:{buy:"شراء",sell:"بيع"},
  lbl(dim,k){return dim==="sess"?V10.SESS[k]||k:dim==="q"?V10.Q[k]||k:dim==="reg"?(k==="untagged"?"قبل الرادار":(V9.ST[k]||[k])[0]):dim==="side"?V10.SIDE[k]||k:k},
  symSel(id){const s=V10.sym||S.sym.s;return`<div class="rc-per v10-syms" id="${id}">${SYMS.map(x=>`<button type="button" data-s="${esc(x.s)}" class="${x.s===s?"on":""}">${esc(x.s)}</button>`).join("")}</div>`},
  bindSym(id,fn){$(id).onclick=e=>{const b=e.target.closest("[data-s]");if(!b)return;V10.sym=b.dataset.s;$(id).querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));fn()}},

  /* ---------------- نسبة النجاح ---------------- */
  async wPage(){const el=$("v10WrBody");if(V3.locked(el))return;
    el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl v9-hrow"><div class="v3-ttl"><span class="v3-logo">✅</span><div><h2>نسبة نجاح الصفقات ${V10.demo()}</h2><p>من نتائج التوصيات المنشورة والمسجّلة فعلاً، ووياها عدد الصفقات والمدى الحقيقي لكل نسبة.</p></div></div>
      <div class="rc-per" id="v10Days">${[[30,"30 يوم"],[90,"90 يوم"],[365,"سنة"],[3650,"الكل"]].map(([d,t])=>`<button type="button" data-d="${d}" class="${d===V10.days?"on":""}">${t}</button>`).join("")}</div></div></div><div id="v10WrB"><div class="panel label">جاري التحميل…</div></div>`;
    $("v10Days").onclick=e=>{const b=e.target.closest("[data-d]");if(!b)return;V10.days=+b.dataset.d;$("v10Days").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));V10.wLoad()};V10.wLoad()},
  async wLoad(){const B=$("v10WrB");let s;try{s=await V10.api().stats(V10.days)}catch(e){B.innerHTML=`<div class="panel down">${esc(V10.err(e))} (شغّل vexora_v10.sql)</div>`;return}
    const a=s.all||{},t=(l,v,sm,c)=>`<div class="v2-t"><span>${l}</span><b class="num ${c||""}">${v}</b><small>${sm}</small></div>`;
    if(!a.n){B.innerHTML=`<div class="panel"><h3 class="v9-h3">لسه ما أكو توصيات مسكّرة بهاي الفترة</h3><p class="label" style="margin:0">النسبة تنحسب بس من التوصيات اللي انتهت بربح أو خسارة. ${s.open?`<bdi>${s.open}</bdi> <span>توصية بعدها مفتوحة.</span>`:""}</p></div>`;return}
    const tb=(t,dim,rows)=>`<section class="panel"><h3 class="v9-h3">${t}</h3><div class="v3-tw"><table class="v3-tb v10-t"><thead><tr><th></th><th>صفقات</th><th>نجاح</th><th>المدى المحتمل</th><th></th><th>متوسط R</th><th>PF</th></tr></thead><tbody>${(rows||[]).map(g=>`<tr class="${g.n<30?"v10-small":""}"><td ${dim==="sym"?'dir="ltr"':""}>${esc(V10.lbl(dim,g.k))}</td><td class="num">${g.n}</td><td class="num"><b>${V10.pct(g.rate)}</b></td><td class="num">${V10.ci(g.ci)}</td><td style="min-width:110px">${V10.bar(g)}</td><td class="num">${V10.r(g.avg_r)}</td><td class="num">${g.pf==null?"—":`<bdi dir="ltr">${(+g.pf).toFixed(2)}</bdi>`}${g.n<30?' <span class="label">· عينة صغيرة</span>':""}</td></tr>`).join("")||'<tr><td colspan="7" class="label">—</td></tr>'}</tbody></table></div></section>`;
    B.innerHTML=`<div class="v3-sum v10-sum">${t("نسبة النجاح",V10.pct(a.rate),`<span>المدى</span> ${V10.ci(a.ci)} · <bdi>${a.n}</bdi> <span>توصية مسكّرة</span>`,a.rate>=50?"up":"down")}${t("متوسط R",V10.r(a.avg_r),"الخسارة = −1R، الربح = أبعد هدف ÷ الوقف")}${t("Profit Factor",a.pf==null?"—":`<bdi dir="ltr">${(+a.pf).toFixed(2)}</bdi>`,"مجموع الأرباح ÷ مجموع الخسائر",a.pf>=1?"gold":"down")}${t("أطول سلسلة خسائر",`<bdi>${s.max_loss_streak}</bdi>`,"خسائر متتالية بالفترة","down")}${t("ما انحسبت",`<bdi>${(s.open||0)+(s.expired||0)}</bdi>`,`<bdi>${s.open||0}</bdi> <span>مفتوحة</span> · <bdi>${s.expired||0}</bdi> <span>انتهت بدون تفعيل</span>`)}</div>
      ${a.n<30?`<div class="v3-warn">⚠️ <span>العينة بهاي الفترة</span> <bdi>${a.n}</bdi> <span>توصية بس. المدى المحتمل واسع، فلا تعتمد على النسبة لحالها.</span></div>`:""}
      <div class="v10-g2">${tb("💱 حسب الزوج","sym",s.by_sym)}${tb("🎚 حسب درجة الجودة","q",(s.by_q||[]).slice().sort((x,y)=>Object.keys(V10.Q).indexOf(x.k)-Object.keys(V10.Q).indexOf(y.k)))}${tb("📡 حسب حالة السوق وقت التوصية","reg",s.by_reg)}${tb("🌍 حسب الجلسة (UTC)","sess",s.by_sess)}${tb("⏱ حسب الفريم","tf",s.by_tf)}${tb("↕️ حسب الاتجاه","side",s.by_side)}</div>
      <p class="v3-note">«نجاح» = التوصية وصلت الهدف الأول على الأقل، مثل ما ينحسب بتيليجرام. المدى المحتمل (95%) يوضح وين ممكن تكون النسبة الحقيقية؛ كلما صغرت العينة كبر المدى. النتائج السابقة ما تضمن اللاحقة.</p>`},

  /* ---------------- محرك المناطق ---------------- */
  atr(cs,p){p=p||14;const a=new Array(cs.length).fill(null);let s=0;for(let i=1;i<cs.length;i++){const tr=Math.max(cs[i].high-cs[i].low,Math.abs(cs[i].high-cs[i-1].close),Math.abs(cs[i].low-cs[i-1].close));if(i<=p){s+=tr;if(i===p)a[i]=s/p}else a[i]=(a[i-1]*(p-1)+tr)/p}return a},
  rsi(cs,p){p=p||14;let g=0,l=0;for(let i=1;i<cs.length;i++){const d=cs[i].close-cs[i-1].close,u=Math.max(d,0),w=Math.max(-d,0);if(i<=p){g+=u/p;l+=w/p}else{g=(g*(p-1)+u)/p;l=(l*(p-1)+w)/p}}return l===0?100:100-100/(1+g/l)},
  step(sym){return{"XAU/USD":25,"XAG/USD":.5,"BTC/USD":1000,"ETH/USD":50}[sym]||(/JPY/.test(sym)?.5:.005)},
  // كل المرشحين عند الشمعة e (بدون ما نشوف المستقبل)
  cands(cs,e,A,src){const out=[],P=[],lo=Math.max(2,e-200);
    for(let i=lo;i<=e-2;i++){const c=cs[i];if(c.high>=cs[i-1].high&&c.high>=cs[i-2].high&&c.high>=cs[i+1].high&&c.high>=cs[i+2].high)P.push({i,t:"H",p:c.high});if(c.low<=cs[i-1].low&&c.low<=cs[i-2].low&&c.low<=cs[i+1].low&&c.low<=cs[i+2].low)P.push({i,t:"L",p:c.low})}
    const maxAfter=(f)=>{let m=-Infinity;for(let k=f;k<=e;k++)m=Math.max(m,cs[k].close);return m},minAfter=(f)=>{let m=Infinity;for(let k=f;k<=e;k++)m=Math.min(m,cs[k].close);return m};
    // سيولة: قمم/قيعان متساوية ما انسحبت
    const H=P.filter(x=>x.t==="H").slice(-30),L=P.filter(x=>x.t==="L").slice(-30);
    for(let a=0;a<H.length;a++)for(let b=a+1;b<H.length;b++)if(Math.abs(H[a].p-H[b].p)<=.15*A&&H[b].i-H[a].i>=3){const lv=Math.max(H[a].p,H[b].p);if(maxAfter(H[b].i+1)<lv+.05*A)out.push({lo:lv,hi:lv+.3*A,dir:-1,tags:["liq"],f:H[b].i,src})}
    for(let a=0;a<L.length;a++)for(let b=a+1;b<L.length;b++)if(Math.abs(L[a].p-L[b].p)<=.15*A&&L[b].i-L[a].i>=3){const lv=Math.min(L[a].p,L[b].p);if(minAfter(L[b].i+1)>lv-.05*A)out.push({lo:lv-.3*A,hi:lv,dir:1,tags:["liq"],f:L[b].i,src})}
    // Order Block + FVG
    for(let i=Math.max(12,e-200);i<=e;i++){const c=cs[i],body=Math.abs(c.close-c.open);
      if(body>=1.2*A){let ph=-Infinity,pl=Infinity;for(let k=i-10;k<i;k++){ph=Math.max(ph,cs[k].high);pl=Math.min(pl,cs[k].low)}
        if(c.close>c.open&&c.close>ph){for(let j=i-1;j>=i-3;j--)if(cs[j].close<cs[j].open){const z={lo:cs[j].low,hi:cs[j].high,dir:1,tags:["ob"],f:i,src};if(minAfter(i+1)>z.lo)out.push(z);break}}
        if(c.close<c.open&&c.close<pl){for(let j=i-1;j>=i-3;j--)if(cs[j].close>cs[j].open){const z={lo:cs[j].low,hi:cs[j].high,dir:-1,tags:["ob"],f:i,src};if(maxAfter(i+1)<z.hi)out.push(z);break}}}
      if(i>=2){const a=cs[i-2];
        if(c.low-a.high>=.3*A){let top=c.low,ok=true;for(let k=i+1;k<=e;k++){top=Math.min(top,cs[k].low);if(top<=a.high){ok=false;break}}if(ok)out.push({lo:a.high,hi:top,dir:1,tags:["fvg"],f:i,src})}
        if(a.low-c.high>=.3*A){let bot=c.high,ok=true;for(let k=i+1;k<=e;k++){bot=Math.max(bot,cs[k].high);if(bot>=a.low){ok=false;break}}if(ok)out.push({lo:bot,hi:a.low,dir:-1,tags:["fvg"],f:i,src})}}}
    return out},
  levels(cs,e,A){const out=[],day=t=>Math.floor(t/86400),D={};for(let i=Math.max(0,e-400);i<=e;i++){const k=day(cs[i].time);(D[k]=D[k]||{h:-Infinity,l:Infinity});D[k].h=Math.max(D[k].h,cs[i].high);D[k].l=Math.min(D[k].l,cs[i].low)}
    const ks=Object.keys(D).map(Number).sort((a,b)=>a-b),cur=day(cs[e].time),prev=ks.filter(k=>k<cur).pop();
    if(prev!=null){out.push({lv:D[prev].h,tags:["pd"],nm:"قمة أمس"},{lv:D[prev].l,tags:["pd"],nm:"قاع أمس"})}
    const wk=k=>Math.floor((k+3)/7),cw=wk(cur),pw=ks.filter(k=>wk(k)===cw-1);if(pw.length){out.push({lv:Math.max(...pw.map(k=>D[k].h)),tags:["pw"],nm:"قمة الأسبوع الماضي"},{lv:Math.min(...pw.map(k=>D[k].l)),tags:["pw"],nm:"قاع الأسبوع الماضي"})}
    return out.map(x=>({lo:x.lv-.12*A,hi:x.lv+.12*A,dir:0,tags:x.tags,nm:x.nm,f:e}))},
  W:{liq:30,ob:30,fvg:20,pd:15,pw:15,round:10,htf:15},
  TAG:{liq:"سيولة (قمم/قيعان متساوية)",ob:"Order Block",fvg:"فجوة FVG",pd:"قمة/قاع أمس",pw:"قمة/قاع الأسبوع الماضي",round:"رقم مدوّر",htf:"فريم H4"},
  // نسبة الارتداد بالماضي لكل نوع، على نفس البيانات بدون ما نشوف المستقبل
  backtest(cs,A){const R={},n=cs.length,seen=new Set();for(let e=60;e<n-30;e+=6){const at=A[e];if(!at)continue;
      for(const z of V10.cands(cs,e,at,"h1").concat(V10.levels(cs,e,at).map(z=>({...z,dir:(z.lo+z.hi)/2>cs[e].close?-1:1})))){const key=z.tags[0]+"|"+z.dir+"|"+z.lo.toFixed(6);if(seen.has(key))continue;
        if(z.dir===-1?cs[e].close>=z.lo:cs[e].close<=z.hi)continue;let t=-1;for(let k=e+1;k<Math.min(n,e+100);k++)if(cs[k].high>=z.lo&&cs[k].low<=z.hi){t=k;break}if(t<0)continue;seen.add(key);
        const a=A[t]||at,inv=z.dir===-1?z.hi+.3*a:z.lo-.3*a;let ok=null;
        for(let k=t;k<Math.min(n,t+24);k++){const c=cs[k];if(z.dir===-1){if(c.close>inv){ok=false;break}if(c.low<=z.lo-a){ok=true;break}}else{if(c.close<inv){ok=false;break}if(c.high>=z.hi+a){ok=true;break}}}
        if(ok==null)continue;const tg=z.tags[0];(R[tg]=R[tg]||{n:0,k:0});R[tg].n++;if(ok)R[tg].k++}}
    for(const k in R){R[k].rate=Math.round(R[k].k/R[k].n*100);R[k].ci=V10.wil(R[k].k,R[k].n)}return R},
  async zones(sym){const x=SYMS.find(y=>y.s===sym);const[h1,h4]=await Promise.all([getData(x,"H1",false),getData(x,"H4",false)]);
    const c1=(h1.data||[]).slice(0,-1),c4=(h4.data||[]).slice(0,-1);if(c1.length<80)throw new Error("الشموع غير كافية لحساب المناطق");
    const A1=V10.atr(c1),A4=c4.length>40?V10.atr(c4):null,e=c1.length-1,a=A1[e],px=h1.data.at(-1).close;
    let Z=V10.cands(c1,e,a,"h1");if(A4&&A4[c4.length-1])Z=Z.concat(V10.cands(c4,c4.length-1,A4[c4.length-1],"h4").map(z=>({...z,tags:[...z.tags,"htf"]})));
    Z=Z.concat(V10.levels(c1,e,a));const st=V10.step(sym);for(const r of[Math.ceil(px/st)*st,Math.floor(px/st)*st])Z.push({lo:r-.1*a,hi:r+.1*a,dir:0,tags:["round"],nm:"رقم مدوّر"});
    // الاتجاه حسب مكان المنطقة من السعر الحالي
    const WMAX=1.5*(A4&&A4[c4.length-1]?Math.min(A4[c4.length-1],3*a):2*a);Z=Z.filter(z=>z.hi-z.lo>0).map(z=>{const sd=(z.lo+z.hi)/2>px?-1:1;let lo=z.lo,hi=z.hi;if(hi-lo>WMAX){if(sd===-1)hi=lo+WMAX;else lo=hi-WMAX}return{...z,lo,hi,side:sd}}).filter(z=>(z.dir===0||z.dir===z.side)&&(z.side===-1?z.lo>px:z.hi<px));
    Z.sort((p,q)=>p.lo-q.lo);const M=[];for(const z of Z){const m=M.find(y=>y.side===z.side&&z.lo<=y.hi+.2*a&&z.hi>=y.lo-.2*a&&Math.max(y.hi,z.hi)-Math.min(y.lo,z.lo)<=WMAX);if(m){m.lo=Math.min(m.lo,z.lo);m.hi=Math.max(m.hi,z.hi);z.tags.forEach(t=>{if(!m.tags.includes(t))m.tags.push(t)});if(z.nm&&!m.nms.includes(z.nm))m.nms.push(z.nm)}else M.push({...z,tags:[...z.tags],nms:z.nm?[z.nm]:[]})}
    const bt=V10.backtest(c1,A1),lim=4*(A4?A4[c4.length-1]:a*2);
    M.forEach(z=>{z.score=Math.min(100,z.tags.reduce((s,t)=>s+(V10.W[t]||0),0));z.dist=z.side===-1?z.lo-px:px-z.hi;z.inv=z.side===-1?z.hi+.3*a:z.lo-.3*a;
      const pt=z.tags.filter(t=>t!=="htf").sort((p,q)=>(V10.W[q]||0)-(V10.W[p]||0))[0];z.bt=bt[pt]?{...bt[pt],tag:pt}:null});
    const near=M.filter(z=>z.dist<=lim&&z.score>=15);
    const up=near.filter(z=>z.side===-1).sort((p,q)=>p.dist-q.dist).slice(0,3),dn=near.filter(z=>z.side===1).sort((p,q)=>p.dist-q.dist).slice(0,3);
    return{sym,px,atr:a,dec:x.dec,c1,up,dn,bt,bars:c1.length,src:h1.src,from:c1[0].time}},
  zChart(Z){const cs=Z.c1.slice(-90),zs=[...Z.up,...Z.dn],w=760,h=360;let lo=Math.min(...cs.map(c=>c.low),...zs.map(z=>z.lo)),hi=Math.max(...cs.map(c=>c.high),...zs.map(z=>z.hi));const pad=(hi-lo)*.04;lo-=pad;hi+=pad;
    const Y=v=>h-8-(v-lo)/(hi-lo)*(h-16),cw=(w-150)/cs.length;let s=`<svg class="v10-ch" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" direction="ltr" aria-label="شارت المناطق">`;
    zs.forEach(z=>{const col=z.side===-1?"#f0606f":"#34c98e";s+=`<rect x="0" y="${Y(z.hi).toFixed(1)}" width="${w}" height="${Math.max(2,Y(z.lo)-Y(z.hi)).toFixed(1)}" fill="${col}" opacity="${.08+z.score/600}"/><line x1="0" x2="${w}" y1="${Y(z.hi).toFixed(1)}" y2="${Y(z.hi).toFixed(1)}" stroke="${col}" stroke-opacity=".5" stroke-dasharray="4 4"/><line x1="0" x2="${w}" y1="${Y(z.lo).toFixed(1)}" y2="${Y(z.lo).toFixed(1)}" stroke="${col}" stroke-opacity=".5" stroke-dasharray="4 4"/><text x="${w-6}" y="${((Y(z.lo)+Y(z.hi))/2+4).toFixed(1)}" fill="${col}" font-size="11" text-anchor="end">${z.side===-1?"Sell Limit":"Buy Limit"} · ${z.score}</text>`});
    cs.forEach((c,i)=>{const x=i*cw+cw/2,col=c.close>=c.open?"#34c98e":"#f0606f";s+=`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(c.high).toFixed(1)}" y2="${Y(c.low).toFixed(1)}" stroke="${col}"/><rect x="${(x-cw*.32).toFixed(1)}" y="${Y(Math.max(c.open,c.close)).toFixed(1)}" width="${(cw*.64).toFixed(1)}" height="${Math.max(1,Math.abs(Y(c.open)-Y(c.close))).toFixed(1)}" fill="${col}"/>`});
    s+=`<line x1="0" x2="${w}" y1="${Y(Z.px).toFixed(1)}" y2="${Y(Z.px).toFixed(1)}" stroke="#D4AF37" stroke-width="1.2"/><text x="4" y="${(Y(Z.px)-4).toFixed(1)}" fill="#D4AF37" font-size="11">${fx(Z.px,Z.dec)}</text>`;return s+"</svg>"},
  zRow(z,d){return`<tr><td><span class="v9-st ${z.side===-1?"down":"up"}">${z.side===-1?"Sell Limit":"Buy Limit"}</span></td><td class="num"><bdi dir="ltr">${fx(z.lo,d)} – ${fx(z.hi,d)}</bdi></td><td class="v10-why">${z.tags.map(t=>`<span class="v10-tag">${esc(V10.TAG[t]||t)}</span>`).join("")}</td>
    <td class="num"><bdi dir="ltr">${z.side===-1?"+":"−"}${fx(z.dist,d)}</bdi></td><td><b class="num">${z.score}</b><div class="v2-pbar v9-bar"><i style="width:${z.score}%"></i></div></td>
    <td class="num">${z.bt?`<b>${z.bt.rate}%</b> <span class="label">(n=${z.bt.n})</span>`:'<span class="label">ما أكو حالات كافية</span>'}</td><td class="num"><bdi dir="ltr">${fx(z.inv,d)}</bdi></td></tr>`},
  async zPage(){const el=$("v10ZnBody");if(V3.locked(el))return;
    el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl v9-hrow"><div class="v3-ttl"><span class="v3-logo">🎯</span><div><h2>مناطق الليمت الذكية</h2><p>أماكن السيولة وهيكل السعر اللي ممكن يرتد منها السعر، ووياها كم مرة ارتد من مناطق مشابهة.</p></div></div></div>${V10.symSel("v10ZS")}</div><div id="v10ZB"><div class="panel label">جاري الحساب…</div></div>`;
    V10.bindSym("v10ZS",()=>V10.zLoad());V10.zLoad()},
  async zLoad(){const B=$("v10ZB"),sym=V10.sym||S.sym.s;B.innerHTML='<div class="panel label">جاري الحساب…</div>';let Z,cot=null;
    try{Z=await V10.zones(sym)}catch(e){B.innerHTML=`<div class="panel down">${esc(V10.err(e))}</div>`;return}try{cot=await V10.api().cot()}catch(e){}
    const d=Z.dec,rows=[...Z.up.slice().reverse(),...Z.dn],bt=Z.bt,days=Math.round((Z.c1.at(-1).time-Z.from)/86400);
    B.innerHTML=`${Z.src==="sim"?'<div class="v3-warn">⚠️ <span>الأسعار هنا محاكاة (ما أكو اتصال بأسعار حقيقية)، فالمناطق للعرض بس.</span></div>':""}
      <div class="v10-zg"><section class="panel"><div class="ph"><h3 class="v9-h3" style="margin:0">📈 <bdi dir="ltr">${esc(sym)}</bdi> H1 · <span>المناطق النشطة</span></h3><span class="label">آخر سعر <b class="num"><bdi dir="ltr">${fx(Z.px,d)}</bdi></b></span></div>${V10.zChart(Z)}</section>
      <div class="v10-side">${V10.cotBox(cot)}<section class="panel"><h3 class="v9-h3">🧭 شلون تنحسب؟</h3><ul class="v10-ul"><li><b>سيولة:</b> <span>قمتين أو قاعين بنفس المستوى تقريباً وما انكسرت؛ هناك تتجمع أوامر الوقف.</span></li><li><b>Order Block:</b> <span>آخر شمعة عكسية قبل حركة قوية كسرت آخر 10 شموع.</span></li><li><b>FVG:</b> <span>فجوة بين شمعة وثالث شمعة بعدها ما انملت.</span></li><li><b>مستويات:</b> <span>قمة وقاع أمس والأسبوع الماضي والأرقام المدوّرة.</span></li><li><b>قوة التوافق:</b> <span>مجموع أوزان الأسباب: سيولة 30، OB 30، FVG 20، يوم/أسبوع 15، H4 +15، رقم مدوّر 10.</span></li></ul></section></div></div>
      <section class="panel"><div class="ph"><h3 class="v9-h3" style="margin:0">📋 المناطق المقترحة</h3><span class="label">تتحدث مع كل شمعة مسكّرة</span></div>${!Z.dn.length?`<div class="v3-warn gold" style="margin-bottom:8px">ℹ️ <span>ما أكو منطقة Buy Limit قوية قريبة: السعر تحت كل القيعان الأخيرة، فما تحته هيكل واضح. لا تدخل شراء بدون منطقة.</span></div>`:""}${!Z.up.length?`<div class="v3-warn gold" style="margin-bottom:8px">ℹ️ <span>ما أكو منطقة Sell Limit قوية قريبة: السعر فوق كل القمم الأخيرة، فما فوقه هيكل واضح. لا تدخل بيع بدون منطقة.</span></div>`:""}${rows.length?`<div class="v3-tw"><table class="v3-tb v10-zt"><thead><tr><th>النوع</th><th>المنطقة</th><th>السبب</th><th>المسافة</th><th>قوة التوافق</th><th>ارتداد بالماضي</th><th>إلغاء المنطقة (وقف)</th></tr></thead><tbody>${rows.map(z=>V10.zRow(z,d)).join("")}</tbody></table></div>`:'<p class="label" style="margin:0">ما لكيت مناطق قوية قريبة من السعر هسه.</p>'}</section>
      <section class="panel"><h3 class="v9-h3">🔁 احترام كل نوع بالماضي على <bdi dir="ltr">${esc(sym)}</bdi></h3><div class="v10-bt">${["liq","ob","fvg","pd","pw","round"].map(t=>{const r=bt[t];return`<div class="v2-t"><span>${esc(V10.TAG[t])}</span><b class="num">${r?r.rate+"%":"—"}</b><small>${r?`<bdi>n=${r.n}</bdi> · <span>المدى</span> <bdi dir="ltr">${r.ci.lo}–${r.ci.hi}%</bdi>`:"ما أكو حالات"}</small></div>`}).join("")}</div>
      <p class="v3-note">على آخر <bdi>${Z.bars}</bdi> شمعة H1 (<bdi>${days}</bdi> يوم تقريباً). «ارتداد» = بعد أول لمسة، السعر ابتعد عن المنطقة بمقدار ATR كامل قبل ما يسكّر وراها. كل منطقة انحسبت من البيانات اللي كانت متوفرة وقتها بس.</p></section>
      <div class="v3-warn red">⚠️ <span>هاي <b>مو أوامر صناع السوق الفعلية</b>؛ سوق الفوركس ما ينشر دفتر أوامره، وما أحد يعرف أوامرهم بالضبط. المناطق محسوبة من هيكل السعر والسيولة المعروفة، والنسب من الماضي وما تضمن المستقبل. المنصة ما تحط أوامر بحسابك.</span></div>`},
  COT_NM:{XAU:"الذهب",XAG:"الفضة",EUR:"اليورو",GBP:"الباوند",JPY:"الين",CHF:"الفرنك",CAD:"الكندي",AUD:"الأسترالي",BTC:"بيتكوين"},
  cotBox(c){const R=(c&&c.rows)||[];if(!R.length)return`<section class="panel"><h3 class="v9-h3">🏦 مراكز كبار المضاربين (COT)</h3><p class="label" style="margin:0">${c&&c.err?`<span class="down">${esc(c.err)}</span>`:"التقرير الرسمي يتحمّل تلقائياً من موقع CFTC، وأول بيانات تطلع خلال ساعة من التشغيل."}</p>${isAdminUser()?'<div class="v3-act"><button class="btn v2s" type="button" id="v10Cot">تحميل التقرير هسه</button></div>':""}</section>`;
    const mx=Math.max(...R.map(r=>Math.abs(r.net)))||1,ord=["XAU","EUR","GBP","JPY","AUD","CAD","CHF","XAG","BTC"];
    return`<section class="panel"><h3 class="v9-h3">🏦 مراكز كبار المضاربين (COT · CFTC) ${V10.demo()}</h3>${R.slice().sort((a,b)=>ord.indexOf(a.asset)-ord.indexOf(b.asset)).map(r=>`<div class="v10-cot"><b>${esc(V10.COT_NM[r.asset]||r.asset)}</b><div class="v10-cb"><i class="${r.net>0?"l":"s"}" style="width:${Math.abs(r.net)/mx*50}%"></i><i class="z"></i></div><span class="num ${r.net>0?"up":"down"}"><bdi dir="ltr">${r.net>0?"+":"−"}${Math.round(Math.abs(r.net)/1000)}K</bdi></span><small class="label"><bdi dir="ltr">${r.chg==null?"":(r.chg>=0?"▲":"▼")+Math.round(Math.abs(r.chg)/1000)+"K"}</bdi></small></div>`).join("")}
      <p class="label" style="font-size:12px;margin:6px 0 0"><span>صافي عقود المضاربين الكبار بالعقود الآجلة، تقرير رسمي أسبوعي.</span> <span>آخر تقرير:</span> <bdi dir="ltr">${esc(R[0].date)}</bdi>. <span>يوضح ميل الكبار، مو توقيت دخول.</span></p></section>`},

  /* ---------------- التحليل المتقدم ---------------- */
  async aPage(){const el=$("v10AnBody");if(V3.locked(el))return;
    el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl v9-hrow"><div class="v3-ttl"><span class="v3-logo">🔬</span><div><h2>التحليل المتقدم</h2><p>كل العوامل بمكان واحد: الفريمات، المناطق، الأخبار، مراكز الكبار، ونتائج التوصيات، وكل عامل بوزنه.</p></div></div></div>${V10.symSel("v10AS")}</div><div id="v10AB"><div class="panel label">جاري التحليل…</div></div>`;
    V10.bindSym("v10AS",()=>V10.aLoad());V10.aLoad()},
  async aGather(sym){const x=SYMS.find(y=>y.s===sym),[b,q]=sym.split("/"),now=Date.now();
    const rg=async tf=>{try{const d=await V9.api().radar(tf);return(d.rows||[]).find(r=>r.sym===sym)||null}catch(e){return null}};
    const[D1,H4,H1,Z,cot,st,ev]=await Promise.all([rg("D1"),rg("H4"),rg("H1"),V10.zones(sym),V10.api().cot().catch(()=>null),V10.api().stats(365).catch(()=>null),DB.econ(new Date(now).toISOString(),new Date(now+6*36e5).toISOString()).catch(()=>[])]);
    const news=(ev||[]).filter(e=>e.impact==="High"&&[b,q].includes(e.country)).sort((p,r)=>new Date(p.at)-new Date(r.at));
    const cr=(cot&&cot.rows)||[],cb=cr.find(r=>r.asset===b),cq=cr.find(r=>r.asset===q);
    return{sym,x,D1,H4,H1,Z,news,cot:{b:cb,q:cq},stat:st&&(st.by_sym||[]).find(g=>g.k===sym),rsi:V10.rsi(Z.c1)}},
  score(G){const F=[],add=(t,w,ok,d)=>F.push({t,w,ok,d});const dirOf=r=>!r||r.stale?0:r.trend==="up"?1:r.trend==="down"?-1:0;
    const ds=[G.D1,G.H4,G.H1].map(dirOf),sum=ds.reduce((a,v)=>a+v,0),bias=sum>=2?1:sum<=-2?-1:0;const BN=bias>0?"صعود":"نزول";
    if(Math.abs(sum)===3)add("الفريمات الثلاثة بنفس الاتجاه ("+BN+")",20,1);else if(bias)add("فريمين من ثلاثة باتجاه "+BN+" والثالث مو عكسه",10,1);else add("الفريمات مو متفقة على اتجاه",0,0,"بدون اتجاه واضح ما نقترح دخول");
    const Z=G.Z,zone=bias>0?Z.dn[0]:bias<0?Z.up[0]:null;
    if(zone){const k=zone.dist/Z.atr;if(k<=.5)add(`السعر قريب من منطقة ${bias>0?"Buy":"Sell"} Limit بقوة ${zone.score}`,20,1);else if(k<=2)add(`أقرب منطقة ${bias>0?"Buy":"Sell"} Limit تبعد ${k.toFixed(1)} ATR (انتظر الرجوع)`,10,2);else add("المنطقة بعيدة عن السعر",0,2)}else if(bias)add("ما أكو منطقة قريبة باتجاه الترند",0,2);
    const cb=G.cot.b,cq=G.cot.q;let cs=0;if(cb)cs+=Math.sign(cb.net);if(cq)cs-=Math.sign(cq.net);
    if(!cb&&!cq)add("مراكز كبار المضاربين: ما متوفرة لهذا الزوج",0,2);else if(bias&&Math.sign(cs)===bias)add("مراكز كبار المضاربين بنفس الاتجاه",10,1);else if(bias&&cs&&Math.sign(cs)===-bias)add("مراكز كبار المضاربين عكس الاتجاه",-10,0);else add("مراكز كبار المضاربين محايدة",0,2);
    const r=G.rsi;if(bias>0)r>70?add(`RSI H1 ${r.toFixed(0)}: تشبع شراء`,-10,0):add(`RSI H1 ${r.toFixed(0)}: مو بتشبع شراء`,10,1);else if(bias<0)r<30?add(`RSI H1 ${r.toFixed(0)}: تشبع بيع`,-10,0):add(`RSI H1 ${r.toFixed(0)}: مو بتشبع بيع`,10,1);
    const n0=G.news[0];if(n0){const h=(new Date(n0.at)-Date.now())/36e5;h<=2?add(`خبر قوي (${n0.title}) بعد ${Math.max(0,h).toFixed(1)} ساعة`,-15,0):add(`خبر قوي (${n0.title}) بعد ${h.toFixed(1)} ساعة`,-5,2)}else add("ما أكو خبر قوي بالـ 6 ساعات الجاية",5,1);
    const v=G.H1;if(v&&v.state==="abnormal")add("حركة غير طبيعية على H1",-20,0);else if(v&&v.vol==="high")add("التذبذب عالي على H1",-10,2);else if(v&&v.vol==="low")add("التذبذب منخفض (حركة ضعيفة)",-5,2);else if(v)add("التذبذب طبيعي",0,1);
    const s=G.stat;if(s&&s.n>=30)s.rate>=55?add(`توصيات ${G.sym} السابقة نجحت ${s.rate}% (n=${s.n})`,10,1):s.rate<=45?add(`توصيات ${G.sym} السابقة نجحت ${s.rate}% بس (n=${s.n})`,-10,0):add(`توصيات ${G.sym} السابقة ${s.rate}% (n=${s.n})`,0,2);else add(`نتائج توصيات ${G.sym}: عينة صغيرة (${s?s.n:0})`,0,2);
    const total=Math.max(0,Math.min(100,30+F.reduce((a,f)=>a+f.w,0)));return{F,total,bias,zone}},
  plan(G,R){const Z=G.Z,b=R.bias,z=R.zone;if(!b||!z)return null;const opp=b>0?Z.up:Z.dn,mid=(z.lo+z.hi)/2,sl=z.inv,risk=Math.abs(mid-sl);
    const t1=opp[0]?(b>0?opp[0].lo:opp[0].hi):mid+b*2*risk,t2=opp[1]?(b>0?opp[1].lo:opp[1].hi):mid+b*3*risk;return{lo:z.lo,hi:z.hi,mid,sl,t1,t2,rr:Math.abs(t1-mid)/risk}},
  async aLoad(){const B=$("v10AB"),sym=V10.sym||S.sym.s;B.innerHTML='<div class="panel label">جاري التحليل…</div>';let G;try{G=await V10.aGather(sym)}catch(e){B.innerHTML=`<div class="panel down">${esc(V10.err(e))}</div>`;return}
    const R=V10.score(G),P=V10.plan(G,R),d=G.x.dec,f=v=>`<bdi dir="ltr">${fx(v,d)}</bdi>`,nw=G.news[0]&&(new Date(G.news[0].at)-Date.now())/36e5<=2;
    const verdict=!R.bias?["انتظار","gold","الفريمات مو متفقة"]:R.total>=65&&P?[R.bias>0?"شراء من منطقة":"بيع من منطقة",R.bias>0?"up":"down",""]:R.total>=50?[R.bias>0?"ميل صعود ضعيف":"ميل نزول ضعيف","gold","انتظر تأكيد"]:["انتظار","gold","العوامل ضعيفة"];
    const tf=(t,r)=>`<div class="v2-t"><span>${t}</span><b>${r?(r.stale?'<span class="v9-st ab">قديمة</span>':V9.stChip(r.state)):'<span class="label">—</span>'}</b><small>${r?esc((r.reasons||[]).slice(0,1).join("")):"ما أكو قراءة"}</small></div>`;
    B.innerHTML=`${G.Z.src==="sim"?'<div class="v3-warn">⚠️ <span>الأسعار هنا محاكاة، فالتحليل للعرض بس.</span></div>':""}
      <div class="v10-ag"><div class="v10-col"><section class="panel"><h3 class="v9-h3">🧭 توافق الفريمات</h3><div class="v3-sum v10-tf3">${tf("D1",G.D1)}${tf("H4",G.H4)}${tf("H1",G.H1)}</div></section>
        <section class="panel v10-ver"><h3 class="v9-h3">⚖️ الخلاصة</h3><div class="v10-vb"><span class="label">ميل التحليل</span><b class="${verdict[1]}">${verdict[0]}</b>${verdict[2]?`<small class="label">${verdict[2]}</small>`:""}<div class="num"><span>توافق</span> <bdi dir="ltr" class="gold">${R.total} / 100</bdi></div><div class="v2-pbar v9-bar"><i style="width:${R.total}%"></i></div></div>
        ${P?`<div class="v9-kv v10-kv"><span>الدخول المقترح</span><bdi dir="ltr">${R.bias>0?"Buy":"Sell"} Limit ${fx(P.lo,d)} – ${fx(P.hi,d)}</bdi><span>الوقف (إلغاء المنطقة)</span><b class="down">${f(P.sl)}</b><span>الهدف 1 / 2</span><b class="up"><bdi dir="ltr">${fx(P.t1,d)} / ${fx(P.t2,d)}</bdi></b><span>العائد للمخاطرة</span><b><bdi dir="ltr">1 : ${P.rr.toFixed(1)}</bdi></b>${nw?'<span>ملاحظة</span><b class="gold">انتظر بعد الخبر</b>':""}</div>`:'<p class="label" style="margin:8px 0 0">ما أكو خطة دخول لأن الشروط مو مكتملة.</p>'}</section></div>
      <div class="v10-col"><section class="panel"><h3 class="v9-h3">🧾 ليش؟ (العوامل وأوزانها)</h3>${R.F.map(x=>`<div class="v10-f"><span>${x.ok===1?'<b class="up">✓</b>':x.ok===0?'<b class="down">✗</b>':'<b class="gold">!</b>'} <span>${esc(x.t)}</span>${x.d?` <small class="label">${esc(x.d)}</small>`:""}</span><b class="num ${x.w>0?"up":x.w<0?"down":"label"}"><bdi dir="ltr">${x.w>0?"+":""}${x.w}</bdi></b></div>`).join("")}
        <p class="label" style="font-size:12px;margin:8px 0 0">الدرجة = 30 + مجموع الأوزان (بين 0 و100). الأوزان ثابتة ومنشورة هنا.</p></section>
        ${P?`<div class="v10-g2"><section class="panel"><h3 class="v9-h3">${R.bias>0?"🟢 سيناريو الصعود":"🔴 سيناريو النزول"}</h3><p class="v10-p"><span>ارتداد من المنطقة</span> ${f(P.lo)}–${f(P.hi)} <span>→ الهدف الأول</span> ${f(P.t1)} <span>ثم</span> ${f(P.t2)}.</p></section><section class="panel"><h3 class="v9-h3">⛔ سيناريو الإلغاء</h3><p class="v10-p"><span>إغلاق شمعة H1 ورا</span> ${f(P.sl)} <span>يلغي المنطقة، ونرجع ننتظر المنطقة الجاية.</span></p></section></div>`:""}</div></div>
      <div class="v3-warn">ℹ️ <span>التحليل يجمع أدوات معروفة بقواعد ثابتة وشفافة. ما يضمن نتيجة، ودرجة التوافق مو احتمال نجاح؛ نسبة النجاح الحقيقية بصفحة «نسبة النجاح» من النتائج المسجّلة بس. مو نصيحة مالية.</span></div>`},

  view(v){const sec={winrate:"v10WrView",zones:"v10ZnView",analysis:"v10AnView"};for(const k in sec){const e=$(sec[k]);if(e)e.hidden=v!==k}
    if(v==="winrate")V10.wPage().catch(e=>console.warn(e));if(v==="zones")V10.zPage().catch(e=>console.warn(e));if(v==="analysis")V10.aPage().catch(e=>console.warn(e))}
};
document.addEventListener("click",async e=>{const b=e.target.closest("#v10Cot");if(!b)return;b.disabled=true;try{const r=await V10.api().cotFetch();V10.toast(r==="requested"?"انطلب التقرير، يوصل خلال دقايق":r)}catch(err){V10.toast(V10.err(err),1)}});
window.__v10=V10;

/* ================= V11: الأخبار · الملخص اليومي · مساري التعليمي · الدعم · مختبر PRO · مركز التشغيل · التقارير · الامتثال ================= */
const V11={
  api(){return DB.v11},toast(t,b){V9.toast(t,b)},err(e){return V9.err(e)},
  demo(){return V11.api().demo?'<span class="v9-demo">بيانات توضيحية</span>':""},
  hdr(ic,t,p,right){return`<div class="panel v3-hdr"><div class="v3-ttl v9-hrow"><div class="v3-ttl"><span class="v3-logo">${ic}</span><div><h2>${t} ${V11.demo()}</h2><p>${p}</p></div></div>${right||""}</div></div>`},
  dt(t){return V9.dt(t)},
  bg(t){try{return new Date(t).toLocaleString("en-GB",{timeZone:"Asia/Baghdad",weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}catch(e){return V9.dt(t)}},
  isStaff(){return isAdminUser()||(typeof can==="function"&&can("members"))},

  /* ---------------- توقعات الأخبار ---------------- */
  async nPage(){const el=$("v11NwBody");if(V3.locked(el))return;el.innerHTML=V11.hdr("📰","توقعات الأخبار القوية","التوقع الرسمي لكل خبر، وتاريخه، وشلون تحرّكت الأزواج بعده بالأرقام المسجّلة.")+'<div id="v11NwB"><div class="panel label">جاري التحميل…</div></div>';
    let d;try{d=await V11.api().news(7)}catch(e){$("v11NwB").innerHTML=`<div class="panel down">${esc(V11.err(e))} (شغّل vexora_v11.sql)</div>`;return}
    const R=(d.rows||[]).filter(r=>new Date(r.at)>Date.now()-2*36e5),nx=R.find(r=>new Date(r.at)>Date.now());
    const pc=v=>v==null?"—":`<bdi dir="ltr" class="${v>0?"up":v<0?"down":""}">${v>0?"+":""}${(+v).toFixed(2)}%</bdi>`,share=(o)=>o&&o.n?Math.round(o.up/o.n*100):null;
    $("v11NwB").innerHTML=`<div class="v3-sum">${[["أحداث قوية بالـ 7 أيام الجاية",`<bdi>${R.length}</bdi>`,[...new Set(R.map(r=>r.country))].join(" · ")||"—",""],["الأقرب",nx?`<bdi>${esc(nx.title_ar||nx.title)}</bdi>`:"—",nx?`<span>${esc(V9.until(nx.at))}</span> · <span>نافذة خطر ±15 دقيقة</span>`:"","down"],["أخبار انقاست حركتها",`<bdi>${d.measured||0}</bdi>`,`<bdi>${d.with_actual||0}</bdi> <span>منها معروف رقمها الفعلي</span>`,""],["التوقع","إجماع المحللين","مو توقع فيكسورا",""]].map(([a,b,c,k])=>`<div class="v2-t"><span>${a}</span><b class="num ${k}">${b}</b><small>${c}</small></div>`).join("")}</div>
      ${R.length?R.map(r=>{const h=r.hist||{},rx=r.react||{},syms=Object.keys(rx).sort((a,b)=>(rx[b].all.n-rx[a].all.n));
        return`<section class="panel v11-ev"><div class="ph"><div><b class="v11-evt">${esc(r.title_ar||r.title)}</b> <span class="label ltr">${esc(r.country)} · ${esc(r.title)}</span></div><span class="label"><bdi dir="ltr">${esc(V11.bg(r.at))}</bdi> <span>بتوقيت بغداد</span></span></div>
        <div class="v11-evg"><div class="v2-t"><span>التوقع</span><b class="num">${esc(r.forecast||"—")}</b><small><span>السابق</span> <bdi dir="ltr">${esc(r.previous||"—")}</bdi></small></div>
          <div class="v2-t"><span>جاء أعلى من التوقع</span><b class="num">${h.n?Math.round(h.above/h.n*100)+"%":"—"}</b><small>${h.n?`<bdi>${h.above}</bdi> <span>من</span> <bdi>${h.n}</bdi> <span>مرة · أقل</span> <bdi>${h.below}</bdi>`:r.past?`<span>صدر</span> <bdi>${r.past}</bdi> <span>مرة مسجّلة، والرقم الفعلي يتسجّل مع الإصدار الجاي</span>`:"ما أكو تاريخ مسجّل بعد"}</small></div>
          <div class="v11-rx">${syms.length?`<table class="v3-tb"><thead><tr><th></th><th>بعد الخبر: صعد</th><th>إذا جاء أعلى: صعد</th><th>إذا جاء أقل: صعد</th><th>متوسط الحركة 60د</th></tr></thead><tbody>${syms.slice(0,5).map(s=>{const a=rx[s].above,b=rx[s].below;return`<tr><td dir="ltr"><b>${esc(s)}</b></td><td class="num">${rx[s].all.n?`${share(rx[s].all)}% <span class="label">(n=${rx[s].all.n})</span>`:"—"}</td><td class="num">${a.n?`${share(a)}% <span class="label">(n=${a.n})</span>`:"—"}</td><td class="num">${b.n?`${share(b)}% <span class="label">(n=${b.n})</span>`:"—"}</td><td class="num">±${pc(rx[s].all.abs).replace(/[+−-]/,"")}</td></tr>`}).join("")}</tbody></table>`:'<p class="label" style="margin:0">لسه ما انقاست حركة الأزواج بعد هذا الخبر. تنقاس تلقائياً بعد كل صدور.</p>'}</div></div></section>`}).join(""):'<div class="panel label">ما أكو أخبار قوية بالأيام الجاية.</div>'}
      <div class="v3-warn">ℹ️ <span>ما أحد يكدر يعرف رقم الخبر قبل صدوره. اللي ينعرض: التوقع الرسمي المنشور، والرقم الفعلي (من «السابق» بالإصدار اللي بعده)، وكم مرة جاء الخبر أعلى أو أقل، ونسبة صعود كل زوج بعد كل حالة من الشموع المسجّلة، ووياها عدد الحالات. السبريد ينفتح وقت الخبر، والنتائج السابقة ما تضمن اللاحقة.</span></div>`},

  /* ---------------- الملخص اليومي + شرح التوصيات ---------------- */
  async bPage(day){const el=$("v11BrBody");if(V3.locked(el))return;el.innerHTML=V11.hdr("🧠","ملخص السوق اليومي","يطلع كل يوم 07:00 بتوقيت بغداد من بيانات المنصة نفسها: الرادار والأخبار ومراكز الكبار.")+'<div id="v11BrB"><div class="panel label">جاري التحميل…</div></div>';
    let b;try{b=await V11.api().brief(day||null)}catch(e){$("v11BrB").innerHTML=`<div class="panel down">${esc(V11.err(e))} (شغّل vexora_v11.sql)</div>`;return}
    const B=$("v11BrB");if(!b){B.innerHTML=`<div class="panel"><p class="label" style="margin:0">أول ملخص يطلع باچر 07:00.</p>${isAdminUser()?'<div class="v3-act"><button class="btn primary v2s" type="button" id="v11BrBuild">اكتب ملخص اليوم هسه</button></div>':""}</div>`;V11.bBind();return}
    const bd=b.body||{},ST=V9.ST,mk=bd.market||[],ev=bd.events||[];
    B.innerHTML=`<div class="v11-br"><section class="panel"><div class="ph"><h3 class="v9-h3" style="margin:0">☀️ <span>ملخص</span> <bdi dir="ltr">${esc(b.day)}</bdi></h3>${(b.days||[]).length>1?`<select id="v11BrDay" class="v11-sel">${b.days.map(d=>`<option ${d===b.day?"selected":""}>${esc(d)}</option>`).join("")}</select>`:""}</div>
        ${mk.length?mk.map(m=>`<div class="v11-mk"><b>${esc(V9.symN(m.sym))} <span class="label ltr">${esc(m.sym)}</span></b><span>${V9.stChip(m.h4)} <span class="label">H4</span>${m.d1?` ${V9.stChip(m.d1)} <span class="label">D1</span>`:""}</span><small class="label">${esc(m.reason||"")}</small></div>`).join(""):'<p class="label">ما أكو قراءات رادار محدّثة.</p>'}
        <p class="v3-note">مكتوب تلقائياً بقواعد ثابتة من بيانات المنصة. تعليمي وليس نصيحة مالية.</p></section>
      <div class="v11-col"><section class="panel"><h3 class="v9-h3">📰 الأخبار وأزواجها اليوم</h3>${ev.length?`<div class="v3-tw"><table class="v3-tb"><thead><tr><th>الوقت (بغداد)</th><th>الخبر</th><th>التوقع</th><th>يأثر على</th></tr></thead><tbody>${ev.map(e=>`<tr><td class="num"><bdi dir="ltr">${esc(new Date(e.at).toLocaleTimeString("en-GB",{timeZone:"Asia/Baghdad",hour:"2-digit",minute:"2-digit"}))}</bdi></td><td>${esc(e.title)} <span class="label">${esc(e.country)}</span></td><td class="num">${esc(e.forecast||"—")}</td><td class="ltr v11-syms">${(e.syms||[]).slice(0,5).map(esc).join(" · ")}</td></tr>`).join("")}</tbody></table></div>`:'<p class="label" style="margin:0">ما أكو أخبار قوية اليوم.</p>'}</section>
        <section class="panel"><h3 class="v9-h3">📲 نص تيليجرام</h3><pre class="v11-pre" data-noi18n>${esc(b.txt)}</pre>${b.admin?`<div class="v3-act"><span class="label">الإرسال للقناة: <b class="${b.tg_on?"up":"gold"}">${b.tg_on?"مفعّل":"مطفّي"}</b>${b.tg_sent?" · انرسل اليوم":""}</span><button class="btn v2s" type="button" data-bra="${b.tg_on?"tg_off":"tg_on"}">${b.tg_on?"إطفاء الإرسال":"تفعيل الإرسال اليومي"}</button><button class="btn v2s" type="button" data-bra="build">إعادة كتابة ملخص اليوم</button></div>`:""}</section></div></div>
      <section class="panel"><h3 class="v9-h3">💬 شرح آخر التوصيات</h3><div id="v11Exp"><p class="label">جاري التحميل…</p></div></section>`;
    V11.bBind();V11.explain()},
  bBind(){const d=$("v11BrDay");if(d)d.onchange=()=>V11.bPage(d.value);const bb=$("v11BrBuild");if(bb)bb.onclick=()=>V11.bAct("build");
    document.querySelectorAll("[data-bra]").forEach(b=>b.onclick=()=>{if(b.dataset.bra==="tg_on"&&!confirm("تفعيل إرسال الملخص كل يوم لقناة الأخبار بتيليجرام؟"))return;V11.bAct(b.dataset.bra)})},
  async bAct(a){try{await V11.api().briefAct(a);V11.toast("✅ تم");V11.bPage()}catch(e){V11.toast(V11.err(e),1)}},
  async explain(){const el=$("v11Exp");if(!el)return;await V3.loadPub();const L=(V3.pub||[]).slice(0,5);if(!L.length){el.innerHTML='<p class="label" style="margin:0">ما أكو توصيات منشورة حديثة.</p>';return}
    const sims=await Promise.all(L.map(s=>V10.api().similar(s.id).catch(()=>null)));
    el.innerHTML=L.map((s,i)=>{const P=Array.isArray(s.qparts)?s.qparts:[],sm=sims[i],dec=+s.dec||V9.dec(s.sym),rr=s.sl&&s.tp1?Math.abs(s.tp1-s.entry)/Math.abs(s.entry-s.sl):null;
      return`<div class="v11-ex"><div class="ph"><b class="${s.side==="buy"?"up":"down"}">${s.side==="buy"?"▲ شراء":"▼ بيع"} <bdi dir="ltr">${esc(s.sym)} ${esc(s.tf)}</bdi></b><span class="label"><bdi dir="ltr">${esc(V9.dt(s.sig_time))}</bdi> · ${esc(s.status_label||"")}</span></div>
        <p class="v10-p"><span>الدخول</span> <bdi dir="ltr">${fx(+s.entry,dec)}</bdi> · <span>الوقف</span> <bdi dir="ltr">${fx(+s.sl,dec)}</bdi> · <span>الهدف الأول</span> <bdi dir="ltr">${fx(+s.tp1,dec)}</bdi>${rr?` · <span>العائد للمخاطرة</span> <bdi dir="ltr">1:${rr.toFixed(1)}</bdi>`:""}</p>
        ${P.length?`<div class="v11-qp">${P.map(p=>`<span class="v10-tag">${esc(p[0])} <bdi dir="ltr">${p[1]}/${p[2]}</bdi></span>`).join("")}${s.qscore!=null?`<b class="gold"><span>درجة الجودة</span> <bdi dir="ltr">${s.qscore}/100</bdi></b>`:""}</div>`:""}
        ${sm&&sm.n?`<p class="label" style="margin:6px 0 0"><span>توصيات مشابهة بالماضي</span> (${esc(sm.rule)}): <b>${sm.rate}%</b> <span>نجحت من</span> <bdi>${sm.n}</bdi> · <span>المدى</span> <bdi dir="ltr">${sm.ci.lo}–${sm.ci.hi}%</bdi>${sm.n<30?" · عينة صغيرة":""}</p>`:'<p class="label" style="margin:6px 0 0">ما أكو توصيات مشابهة كافية للمقارنة.</p>'}</div>`}).join("")},

  /* ---------------- مساري التعليمي (الأكاديمية التكيفية) ---------------- */
  QZ:[["tech","الشمعة اللي جسمها صغير وظلها السفلي طويل بعد نزول تسمى:",["مطرقة","ابتلاع بيعي","دوجي نجمي"],0],["tech","RSI فوق 70 يعني عادةً:",["تشبع بيع","تشبع شراء","ترند عرضي"],1],
    ["cls","كسر خط العنق بنموذج الرأس والكتفين يعطي:",["إشارة استمرار","إشارة انعكاس","ما يعني شي"],1],["cls","الاختراق الكاذب هو:",["كسر يرجع بسرعة داخل النطاق","كسر بحجم كبير","شمعة دوجي"],0],
    ["wav","بقواعد إليوت، الموجة 3 ما تكون:",["الأطول","الأقصر بين 1 و3 و5","موجة دافعة"],1],["wav","التصحيح الأساسي يتكوّن من:",["5 موجات","3 موجات ABC","موجتين"],1],
    ["tim","أكثر جلسة سيولة بالعادة:",["آسيا","تداخل لندن ونيويورك","نهاية الجمعة"],1],["tim","قبل خبر قوي مثل CPI الأفضل:",["تفتح صفقة كبيرة","تنتبه للسبريد والانزلاق","تشيل الوقف"],1],
    ["num","Profit Factor = 1.5 يعني:",["الأرباح 1.5 ضعف الخسائر","نسبة النجاح 15%","العائد 1.5R لكل صفقة"],0],["num","نسبة نجاح 40% ممكن تربح إذا:",["العائد للمخاطرة أكبر من 1.5","ما تستخدم وقف","تضاعف اللوت"],0],
    ["risk","حساب 1000$ ومخاطرة 1% يعني أقصى خسارة للصفقة:",["1$","10$","100$"],1],["risk","تحريك الوقف أبعد لمن الصفقة تخسر:",["إدارة ذكية","يزيد المخاطرة عن الخطة","يقلل الخسارة دائماً"],1]],
  CN:{tech:"التحليل الفني",cls:"الكلاسيكي",wav:"الموجي",tim:"الزمني",num:"الرقمي",risk:"إدارة المخاطر"},
  LV:{beginner:"مبتدئ",intermediate:"متوسط",advanced:"متقدم"},
  async pPage(){const el=$("v11PtBody");if(V3.locked(el))return;el.innerHTML=V11.hdr("🧭","مساري التعليمي","اختبار مستوى قصير، ودروسك الجاية بكل دورة، ودروس مقترحة من أخطاء دفتر تداولك.")+'<div id="v11PtB"><div class="panel label">جاري التحميل…</div></div>';
    let P;try{P=await V11.api().path()}catch(e){$("v11PtB").innerHTML=`<div class="panel down">${esc(V11.err(e))} (شغّل vexora_v11.sql)</div>`;return}V11.P=P;V11.pRender()},
  pRender(){const P=V11.P,B=$("v11PtB"),lv=P.level;
    const order=Object.keys(V11.CN).filter(k=>k!=="risk").sort((a,b)=>((lv&&lv.scores[a])??50)-((lv&&lv.scores[b])??50));
    const C=(P.courses||[]).slice().sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
    B.innerHTML=`<div class="v11-pt"><section class="panel">${lv?`<h3 class="v9-h3">🎯 <span>مستواك:</span> <b class="gold">${esc(V11.LV[lv.level]||lv.level)}</b></h3><div class="v11-sc">${Object.entries(lv.scores).map(([k,v])=>`<div><span>${esc(V11.CN[k]||k)}</span><div class="v2-pbar v9-bar"><i style="width:${v}%"></i></div><b class="num">${v}%</b></div>`).join("")}</div><div class="v3-act"><button class="btn v2s" type="button" id="v11Qz">إعادة اختبار المستوى</button></div>`
        :`<h3 class="v9-h3">🎯 اختبار المستوى</h3><p class="label" style="margin:0 0 8px">12 سؤال (دقيقتين) حتى نرتّب دوراتك من الأضعف للأقوى.</p><button class="btn primary" type="button" id="v11Qz">ابدأ الاختبار</button>`}</section>
      <section class="panel"><h3 class="v9-h3">📒 من دفتر تداولك</h3>${(P.recs||[]).length?(P.recs||[]).map(r=>`<div class="v11-rec"><b class="gold">⚠️ <span>${esc(r.why)}</span></b>${(r.items||[]).map(l=>`<a class="v11-ls ${l.done?"done":""}" href="index.html#lesson/${encodeURIComponent(l.id)}"><span>${l.done?"✓":"▶"}</span><span>${esc(l.title)}</span></a>`).join("")}</div>`).join("")
        :`<p class="label" style="margin:0">${P.journal&&P.journal.closed?"ما لكينا أخطاء متكررة بدفترك. استمر 👏":"سجّل صفقاتك بدفتر التداول حتى نقترحلك دروس حسب أخطائك."}</p><a class="btn v2s" href="#journal" style="margin-top:8px;display:inline-block;text-decoration:none">📒 دفتر التداول</a>`}</section></div>
      <section class="panel"><h3 class="v9-h3">🗺 دوراتك ${lv?"(مرتّبة من الأضعف)":""}</h3><div class="v11-cg">${C.map(c=>{const p=c.total?Math.round(c.done/c.total*100):0;return`<div class="v2-t v11-cc"><span>${esc(c.title)}</span><b class="num">${p}%</b><div class="v2-pbar v9-bar"><i style="width:${p}%"></i></div><small><bdi>${c.done}</bdi> <span>من</span> <bdi>${c.total}</bdi> <span>درس</span></small>${c.next?`<a class="v11-ls" href="index.html#lesson/${encodeURIComponent(c.next.id)}"><span>▶</span><span>${esc(c.next.title)}</span></a>`:'<b class="up">✓ خلصت الدورة</b>'}</div>`}).join("")}</div></section>`;
    $("v11Qz").onclick=()=>V11.quiz()},
  quiz(){const B=$("v11PtB"),Q=V11.QZ;B.innerHTML=`<section class="panel"><h3 class="v9-h3">🎯 اختبار المستوى</h3><form id="v11QF">${Q.map((q,i)=>`<fieldset class="v11-q"><legend><bdi>${i+1}.</bdi> <span>${esc(q[1])}</span></legend>${q[2].map((o,j)=>`<label><input type="radio" name="q${i}" value="${j}"> <span>${esc(o)}</span></label>`).join("")}</fieldset>`).join("")}
      <div class="v3-act"><button class="btn primary" type="submit">احسب مستواي</button><button class="btn" type="button" id="v11QC">إلغاء</button></div></form></section>`;
    $("v11QC").onclick=()=>V11.pRender();
    $("v11QF").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),sc={},cnt={};let miss=0;Q.forEach((q,i)=>{const v=f.get("q"+i);if(v==null)miss++;cnt[q[0]]=(cnt[q[0]]||0)+1;sc[q[0]]=(sc[q[0]]||0)+(+v===q[3]?1:0)});
      if(miss)return V11.toast(`باقي ${miss} سؤال`,1);Object.keys(sc).forEach(k=>sc[k]=Math.round(sc[k]/cnt[k]*100));
      try{const lv=await V11.api().levelSave(sc);V11.toast("✅ مستواك: "+(V11.LV[lv]||lv));V11.P=await V11.api().path();V11.pRender()}catch(err){V11.toast(V11.err(err),1)}}},

  /* ---------------- الدعم: تذاكري ---------------- */
  CAT:{general:"عام",account:"الحساب والدخول",payment:"الدفع والاشتراك",academy:"الأكاديمية",signals:"التوصيات",partners:"الشركاء",tech:"مشكلة تقنية"},
  TST:{open:["مفتوحة","gold"],pending:["بانتظار ردك","up"],closed:["مسكّرة",""]},
  async hPage(){const el=$("v11HpBody");el.innerHTML=V11.hdr("🎫","الدعم والتذاكر","اكتب مشكلتك أو سؤالك، ويرد عليك الفريق هنا ويوصلك إشعار.")+'<div id="v11HpB"></div>';V11.hList()},
  async hList(){const B=$("v11HpB");let L=[];try{L=await V11.api().myTickets()||[]}catch(e){B.innerHTML=`<div class="panel down">${esc(V11.err(e))} (شغّل vexora_v11.sql)</div>`;return}
    B.innerHTML=`<div class="v3-grid2"><section class="panel"><h3 class="v9-h3">＋ تذكرة جديدة</h3><div class="v3-fm"><label>الموضوع<input id="v11TS" maxlength="120"></label><label>النوع<select id="v11TC">${Object.entries(V11.CAT).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select></label></div>
        <div class="v9-ta" style="grid-template-columns:1fr;margin-top:8px"><label>الرسالة<textarea id="v11TB" rows="4" maxlength="4000" data-noi18n></textarea></label></div><div class="v3-act"><button class="btn primary" type="button" id="v11TGo">إرسال</button></div></section>
      <section class="panel"><h3 class="v9-h3">📂 تذاكري</h3><div class="v3-slist">${L.length?L.map(t=>`<button type="button" class="v3-srow v11-tk" data-tk="${t.id}"><b><bdi>#${t.id}</bdi></b><span data-noi18n>${esc(t.subject)}</span><span class="v9-st ${V11.TST[t.status][1]==="up"?"up":V11.TST[t.status][1]==="gold"?"side":"lv"}">${V11.TST[t.status][0]}</span><span class="label" style="margin-inline-start:auto"><bdi dir="ltr">${esc(V9.dt(t.updated_at))}</bdi></span></button>`).join(""):'<p class="label" style="margin:0">ما عندك تذاكر.</p>'}</div></section></div><div id="v11TV"></div>`;
    $("v11TGo").onclick=async()=>{try{const id=await V11.api().ticketOpen($("v11TS").value,$("v11TC").value,$("v11TB").value);V11.toast("✅ انفتحت التذكرة #"+id);V11.hList()}catch(e){V11.toast(V11.err(e),1)}};
    B.querySelectorAll("[data-tk]").forEach(b=>b.onclick=()=>V11.tView(+b.dataset.tk,$("v11TV"),false))},
  async tView(id,el,staff){let t;try{t=await V11.api().ticketGet(id)}catch(e){V11.toast(V11.err(e),1);return}
    el.innerHTML=`<section class="panel v11-tv"><div class="ph"><h3 class="v9-h3" style="margin:0"><bdi>#${t.id}</bdi> <span data-noi18n>${esc(t.subject)}</span></h3><span class="label">${esc(V11.CAT[t.cat]||t.cat)} · ${V11.TST[t.status][0]}</span></div>
      <div class="v11-msgs">${t.msgs.map(m=>`<div class="v11-m ${m.staff?"st":""}"><b>${esc(m.name||"")}</b><p data-noi18n>${esc(m.body)}</p><small class="label"><bdi dir="ltr">${esc(V9.dt(m.at))}</bdi></small></div>`).join("")}</div>
      <div class="v9-ta" style="grid-template-columns:1fr"><label>${staff?"رد الفريق":"ردّك"}<textarea data-tr rows="3" maxlength="4000" data-noi18n></textarea></label></div>
      <div class="v3-act"><button class="btn primary" type="button" data-trgo>إرسال</button>${t.status!=="closed"?'<button class="btn" type="button" data-tclose>تسكير التذكرة</button>':""}</div></section>`;
    const q=k=>el.querySelector(k);q("[data-trgo]").onclick=async()=>{try{await V11.api().ticketReply(id,q("[data-tr]").value);V11.toast("✅ انرسل");staff?V11.crmLoad(id):V11.tView(id,el,false)}catch(e){V11.toast(V11.err(e),1)}};
    if(q("[data-tclose]"))q("[data-tclose]").onclick=async()=>{try{await V11.api().ticketClose(id);V11.toast("انسكرت");staff?V11.crmLoad():V11.hList()}catch(e){V11.toast(V11.err(e),1)}};el.scrollIntoView({behavior:"smooth",block:"start"})},

  /* ---------------- الإدارة: الدعم والعملاء ---------------- */
  async crmPage(){const el=$("v11CrBody");if(!V11.isStaff()){el.innerHTML='<div class="panel">🔒 للإدارة بس</div>';return}el.innerHTML=V11.hdr("🗂","الدعم والعملاء","كل التذاكر، وبطاقة كل عضو: بياناته، مشترياته، تقدّمه، تذاكره، وملاحظات الفريق.",`<div class="rc-per" id="v11CrF"><button type="button" data-f="active" class="on">النشطة</button><button type="button" data-f="closed">المسكّرة</button><button type="button" data-f="all">الكل</button></div>`)+'<div id="v11CrB"></div>';
    $("v11CrF").onclick=e=>{const b=e.target.closest("[data-f]");if(!b)return;V11.crmF=b.dataset.f;$("v11CrF").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));V11.crmLoad()};V11.crmF="active";V11.crmLoad()},
  async crmLoad(openId){const B=$("v11CrB");let d;try{d=await V11.api().adminTickets(V11.crmF||"active")}catch(e){B.innerHTML=`<div class="panel down">${esc(V11.err(e))}</div>`;return}const c=d.counts||{};
    B.innerHTML=`<div class="v3-sum"><div class="v2-t"><span>مفتوحة (تنتظر ردنا)</span><b class="num ${c.open?"down":"up"}">${c.open||0}</b><small>آخر رسالة من العضو</small></div><div class="v2-t"><span>بانتظار العضو</span><b class="num">${c.pending||0}</b><small>ردّينا عليها</small></div><div class="v2-t"><span>انسكرت بـ 7 أيام</span><b class="num">${c.closed7||0}</b><small></small></div><div class="v2-t"><span>متوسط أول رد</span><b class="num">${c.first_reply_h==null?"—":`<bdi dir="ltr">${c.first_reply_h}h</bdi>`}</b><small>آخر 30 يوم</small></div></div>
      <div class="v11-crm"><section class="panel"><div class="v3-tw"><table class="v3-tb"><thead><tr><th>#</th><th>الموضوع</th><th>العضو</th><th>النوع</th><th>الحالة</th><th>الأولوية</th><th>آخر تحديث</th></tr></thead><tbody>${(d.rows||[]).map(t=>`<tr data-u="${t.id}" data-uid="${esc(t.user_id)}"><td class="num">${t.id}</td><td data-noi18n>${esc(t.subject)}</td><td data-noi18n>${esc(t.name||t.email||"")}</td><td>${esc(V11.CAT[t.cat]||t.cat)}</td><td>${t.status==="open"?'<span class="v9-st down">ينتظر ردنا</span>':t.status==="pending"?'<span class="v9-st side">ردّينا</span>':'<span class="v9-st lv">مسكّرة</span>'}</td><td>${t.priority==="high"?'<b class="down">عالية</b>':t.priority==="low"?"منخفضة":"عادية"}</td><td class="num"><bdi dir="ltr">${esc(V9.dt(t.updated_at))}</bdi></td></tr>`).join("")||'<tr><td colspan="7" class="label">ما أكو تذاكر.</td></tr>'}</tbody></table></div></section><div id="v11CrD"></div></div>`;
    B.querySelector("tbody").onclick=e=>{const r=e.target.closest("[data-u]");if(r)V11.crmOpen(+r.dataset.u,r.dataset.uid)};if(openId){const r=B.querySelector(`[data-u="${openId}"]`);if(r)V11.crmOpen(openId,r.dataset.uid)}},
  async crmOpen(id,uid){const D=$("v11CrD");D.innerHTML='<div class="panel label">…</div>';let c=null;try{c=await V11.api().memberCard(uid)}catch(e){}
    D.innerHTML=`<div id="v11CrT"></div>${c?`<section class="panel"><h3 class="v9-h3">👤 بطاقة العضو</h3><div class="v9-kv"><span>الاسم</span><b data-noi18n>${esc(c.profile.name||"")}</b><span>الإيميل</span><bdi dir="ltr">${esc(c.profile.email||"")}</bdi><span>تيليجرام</span><bdi dir="ltr">${esc(c.profile.telegram||"—")}</bdi><span>الحالة</span><b>${esc(c.profile.status||"")}</b><span>آخر ظهور</span><bdi dir="ltr">${esc(V9.dt(c.profile.last_seen)||"—")}</bdi><span>الأكاديمية</span><span><bdi>${c.academy.lessons_done}</bdi> <span>درس ·</span> <bdi>${c.academy.certs}</bdi> <span>شهادة</span>${c.academy.level?` · ${esc(V11.LV[c.academy.level])}`:""}</span><span>دفتر التداول</span><bdi>${c.journal}</bdi><span>المشتريات</span><span>${(c.purchases||[]).slice(0,3).map(p=>`<bdi dir="ltr">${esc(p.kind)} ${p.amount??""} (${esc(p.status)})</bdi>`).join(" · ")||"—"}</span></div>
      <h4 class="v9-h4">📝 ملاحظات الفريق (العضو ما يشوفها)</h4>${(c.notes||[]).map(n=>`<div class="v11-note"><p data-noi18n>${esc(n.body)}</p><small class="label">${esc(n.by||"")} · <bdi dir="ltr">${esc(V9.dt(n.at))}</bdi></small></div>`).join("")}
      <div class="v9-ta" style="grid-template-columns:1fr"><textarea id="v11Nt" rows="2" maxlength="2000" data-noi18n></textarea></div><div class="v3-act"><button class="btn v2s" type="button" id="v11NtGo">＋ ملاحظة</button><button class="btn v2s" type="button" id="v11Pri">⬆️ أولوية عالية + لي</button></div></section>`:""}`;
    V11.tView(id,$("v11CrT"),true);
    if($("v11NtGo"))$("v11NtGo").onclick=async()=>{try{await V11.api().memberNote(uid,$("v11Nt").value);V11.toast("✅ انحفظت");V11.crmOpen(id,uid)}catch(e){V11.toast(V11.err(e),1)}};
    if($("v11Pri"))$("v11Pri").onclick=async()=>{try{await V11.api().ticketSet(id,{priority:"high",assign_me:1});V11.toast("✅ تم");V11.crmLoad(id)}catch(e){V11.toast(V11.err(e),1)}}},

  /* ---------------- الإدارة: مركز التشغيل ---------------- */
  async opsPage(){const el=$("v11OpBody");if(!isAdminUser()){el.innerHTML='<div class="panel">🔒 للمدير بس</div>';return}el.innerHTML=V11.hdr("🛡","مركز التشغيل والأمان","صحة المحرك والأسعار والمهام المجدولة والأخطاء، وآخر أعمال الإدارة، ونسخ احتياطية للإعدادات.",'<button class="btn v2s" type="button" id="v11OpR">🔄 تحديث</button>')+'<div id="v11OpB"><div class="panel label">…</div></div>';
    $("v11OpR").onclick=()=>V11.opsLoad();V11.opsLoad()},
  async opsLoad(){const B=$("v11OpB");let o;try{o=await V11.api().ops()}catch(e){B.innerHTML=`<div class="panel down">${esc(V11.err(e))} (شغّل vexora_v11.sql)</div>`;return}
    const e=o.engine||{},ok=e.runs24?Math.round(e.ok24/e.runs24*100):null,mins=e.last?Math.round((Date.now()-new Date(e.last))/6e4):null,er=o.errors||{},h=o.http24||{};
    const dot=(g,t)=>`<span class="v11-dot ${g}"></span><span>${t}</span>`,lvl=(c,w)=>c?"bad":w?"warn":"ok";
    const issues=[];if(mins==null||mins>30)issues.push("المحرك ما اشتغل من "+(mins==null?"24 ساعة":mins+" دقيقة"));if(ok!=null&&ok<90)issues.push("نجاح تشغيل المحرك "+ok+"%");if(er.cot)issues.push("COT: "+er.cot);if(+er.news_fail>=3)issues.push("مزامنة الأخبار فشلت "+er.news_fail+" مرات");if(er.tr_failed)issues.push(er.tr_failed+" ترجمة فاشلة");
    (o.jobs||[]).forEach(j=>{if(j.fails24)issues.push(`المهمة ${j.name} فشلت ${j.fails24} مرة بـ 24 ساعة`)});(o.prices||[]).forEach(p=>{if(["H1"].includes(p.tf)&&p.newest_min>180)issues.push("أسعار H1 قديمة")});
    B.innerHTML=`<div class="v3-warn ${issues.length?"red":"ok"}">${issues.length?"⛔ "+issues.map(esc).join(" · "):"✅ كل الأنظمة شغّالة طبيعي"}</div>
      <div class="v3-sum"><div class="v2-t"><span>محرك التوصيات</span><b class="num ${lvl(mins==null||mins>30,mins>15)==="ok"?"up":"down"}">${mins==null?"—":`<bdi dir="ltr">${mins}m</bdi>`}</b><small>آخر تشغيل · <bdi>${e.runs24||0}</bdi> <span>تشغيل بـ 24س</span> · <bdi>${ok??"—"}%</bdi> <span>ناجح</span></small></div>
        <div class="v2-t"><span>طلبات الإنترنت (24س)</span><b class="num ${h.errors?"gold":"up"}">${h.total??"—"}</b><small><bdi>${h.errors??0}</bdi> <span>فاشلة</span></small></div>
        <div class="v2-t"><span>رادار السوق</span><b class="num ${o.regime&&o.regime.stale?"gold":"up"}">${o.regime?o.regime.rows:0}</b><small><bdi>${o.regime?o.regime.stale:0}</bdi> <span>قديمة</span></small></div>
        <div class="v2-t"><span>المدراء ويا التحقق الثنائي</span><b class="num ${o.mfa&&o.mfa.with_mfa<o.mfa.admins?"down":"up"}">${o.mfa?`<bdi dir="ltr">${o.mfa.with_mfa}/${o.mfa.admins}</bdi>`:"—"}</b><small>${o.mfa&&o.mfa.with_mfa<o.mfa.admins?"فعّل 2FA لكل المدراء":"حماية الحسابات"}</small></div></div>
      <div class="v3-grid2"><section class="panel"><h3 class="v9-h3">⏱ المهام المجدولة</h3><div class="v3-tw"><table class="v3-tb"><thead><tr><th>المهمة</th><th>الجدول</th><th>آخر تشغيل</th><th>فشل 24س</th></tr></thead><tbody>${(o.jobs||[]).map(j=>`<tr><td class="ltr">${dot(j.last&&j.last.status==="failed"?"bad":j.fails24?"warn":"ok",esc(j.name))}</td><td class="num ltr">${esc(j.schedule)}</td><td class="num">${j.last?`<bdi dir="ltr">${esc(V9.dt(j.last.at))}</bdi>`:"—"}</td><td class="num ${j.fails24?"down":""}">${j.fails24??"—"}</td></tr>`).join("")}</tbody></table></div></section>
        <section class="panel"><h3 class="v9-h3">💹 الأسعار المحفوظة</h3><div class="v3-tw"><table class="v3-tb"><thead><tr><th>الفريم</th><th>أزواج</th><th>أحدث</th><th>أقدم</th></tr></thead><tbody>${(o.prices||[]).map(p=>`<tr><td class="ltr">${esc(p.tf)}</td><td class="num">${p.syms}</td><td class="num"><bdi dir="ltr">${p.newest_min}m</bdi></td><td class="num ${p.oldest_min>1440?"gold":""}"><bdi dir="ltr">${p.oldest_min}m</bdi></td></tr>`).join("")}</tbody></table></div>
          <h3 class="v9-h3" style="margin-top:14px">⚠️ آخر الأخطاء</h3><div class="v9-kv"><span>المحرك</span><span data-noi18n>${e.last_err?esc(V9.dt(e.last_err.at)+" · "+(e.last_err.note||"")):"—"}</span><span>الأخبار</span><span data-noi18n>${er.news_last?esc((er.news_last.ok?"✓ ":"✗ ")+V9.dt(er.news_last.at)+" "+(er.news_last.err||"")):"—"}</span><span>COT</span><span data-noi18n>${esc(er.cot||"—")}</span><span>إشعارات معلّقة</span><bdi>${er.push_pending??0}</bdi></div></section></div>
      <div class="v3-grid2"><section class="panel"><h3 class="v9-h3">🧾 آخر أعمال الإدارة</h3><div class="v3-slist">${(o.admin_log||[]).map(a=>`<div class="v3-srow"><b data-noi18n>${esc(a.actor||"")}</b><span class="ltr">${esc(a.action)}</span><span class="label" data-noi18n>${esc(a.target||"")}</span><span class="label" style="margin-inline-start:auto"><bdi dir="ltr">${esc(V9.dt(a.at))}</bdi></span></div>`).join("")}</div></section>
        <section class="panel"><h3 class="v9-h3">💾 النسخ الاحتياطي</h3><p class="label" style="margin:0 0 8px;font-size:12.5px">تنزيل نسخة JSON من الإعدادات (المفاتيح والأسرار مخفية) أو من الدورات والدروس. النسخ الكاملة لقاعدة البيانات تعتمد على خطة Supabase (Database → Backups).</p><div class="v3-act" style="margin:0"><button class="btn v2s" type="button" data-exp="config">⬇️ الإعدادات</button><button class="btn v2s" type="button" data-exp="academy">⬇️ الأكاديمية</button></div></section></div>`;
    B.querySelectorAll("[data-exp]").forEach(b=>b.onclick=async()=>{try{const j=await V11.api().exportJson(b.dataset.exp),bl=new Blob([JSON.stringify(j,null,1)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(bl);a.download=`vexora-${b.dataset.exp}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3e3)}catch(e){V11.toast(V11.err(e),1)}})},

  /* ---------------- الإدارة: التقارير ---------------- */
  biDays:90,
  async biPage(){const el=$("v11BiBody");if(!isAdminUser()){el.innerHTML='<div class="panel">🔒 للمدير بس</div>';return}el.innerHTML=V11.hdr("📈","التقارير والإحصائيات","النمو، والإيرادات المدفوعة فعلاً، ومسار العضو من التسجيل للشهادة، والاحتفاظ بالأعضاء.",`<div class="rc-per" id="v11BiD">${[[30,"30 يوم"],[90,"90 يوم"],[365,"سنة"]].map(([d,t])=>`<button type="button" data-d="${d}" class="${d===V11.biDays?"on":""}">${t}</button>`).join("")}</div>`)+'<div id="v11BiB"></div>';
    $("v11BiD").onclick=e=>{const b=e.target.closest("[data-d]");if(!b)return;V11.biDays=+b.dataset.d;$("v11BiD").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));V11.biLoad()};V11.biLoad()},
  bars(v,col,h){h=h||90;const mx=Math.max(1,...v),w=100/Math.max(1,v.length);return`<svg class="v11-bars" viewBox="0 0 100 ${h}" preserveAspectRatio="none" aria-hidden="true">${v.map((x,i)=>`<rect x="${(i*w+w*.12).toFixed(2)}" y="${(h-x/mx*(h-2)).toFixed(2)}" width="${(w*.76).toFixed(2)}" height="${(x/mx*(h-2)).toFixed(2)}" fill="${col}" rx=".4"/>`).join("")}</svg>`},
  async biLoad(){const B=$("v11BiB");let b;try{b=await V11.api().bi(V11.biDays)}catch(e){B.innerHTML=`<div class="panel down">${esc(V11.err(e))} (شغّل vexora_v11.sql)</div>`;return}
    const k=b.kpi||{},f=b.funnel||{},D=b.daily||[],m=v=>`<bdi dir="ltr">$${Math.round(+v||0).toLocaleString("en-US")}</bdi>`,pc=(a,c)=>c?Math.round(a/c*100)+"%":"—";
    const fs=[["سجّل",f.signup],["انقبل عضو",f.approved],["بدأ يتعلم",f.lesson],["دفع",f.paid],["أخذ شهادة",f.cert]];
    B.innerHTML=`<div class="rc-k v9-k">${[["الأعضاء",`<bdi>${k.members}</bdi>`,`<span>من</span> <bdi>${k.users}</bdi> <span>مسجّل</span>`],["جدد بالفترة",`<bdi>${k.new}</bdi>`,""],["نشطين 7 أيام",`<bdi>${k.active7}</bdi>`,`<bdi>${k.active30}</bdi> <span>بـ 30 يوم</span>`],["الإيراد المدفوع",m(k.revenue),`<bdi>${k.paid_orders}</bdi> <span>طلب</span>`],["دروس خلصت",`<bdi>${k.lessons_done}</bdi>`,""],["شهادات",`<bdi>${k.certs}</bdi>`,""],["تذاكر دعم",`<bdi>${k.tickets}</bdi>`,""]].map(([a,v,s])=>`<div class="kp"><span>${a}</span><b>${v}</b>${s?`<small>${s}</small>`:""}</div>`).join("")}</div>
      <div class="v11-bi"><section class="panel"><h3 class="v9-h3">👥 التسجيلات اليومية</h3>${V11.bars(D.map(d=>d.signups),"#D4AF37")}<p class="label v11-ax"><bdi dir="ltr">${esc(D[0]&&D[0].day)}</bdi><bdi dir="ltr">${esc(D.at(-1)&&D.at(-1).day)}</bdi></p></section>
        <section class="panel"><h3 class="v9-h3">💵 الإيراد المدفوع يومياً</h3>${V11.bars(D.map(d=>+d.paid),"#34c98e")}<p class="label v11-ax"><bdi dir="ltr">${esc(D[0]&&D[0].day)}</bdi><bdi dir="ltr">${esc(D.at(-1)&&D.at(-1).day)}</bdi></p></section></div>
      <div class="v3-grid2"><section class="panel"><h3 class="v9-h3">🪜 مسار العضو (المسجّلين بالفترة)</h3>${fs.map(([a,v],i)=>`<div class="v11-fn"><span>${a}</span><div class="v2-pbar v9-bar"><i style="width:${f.signup?Math.max(2,v/f.signup*100):0}%"></i></div><b class="num"><bdi>${v||0}</bdi></b><small class="label">${i?pc(v,fs[i-1][1]):""}</small></div>`).join("")}<p class="v3-note">النسبة جنب كل مرحلة = من المرحلة اللي قبلها.</p></section>
        <section class="panel"><h3 class="v9-h3">🔁 الاحتفاظ حسب أسبوع التسجيل</h3><div class="v3-tw"><table class="v3-tb"><thead><tr><th>أسبوع التسجيل</th><th>عدد</th><th>الأسبوع 1</th><th>الأسبوع 2</th><th>الأسبوع 4</th></tr></thead><tbody>${(b.cohorts||[]).map(c=>`<tr><td class="num"><bdi dir="ltr">${esc(c.week)}</bdi></td><td class="num">${c.n}</td>${[["w1","ready1"],["w2","ready2"],["w4","ready4"]].map(([x,r])=>`<td class="num">${c[r]?`<span class="v11-heat" style="--a:${c.n?c[x]/c.n:0}">${pc(c[x],c.n)}</span>`:'<span class="label">—</span>'}</td>`).join("")}</tr>`).join("")||'<tr><td colspan="5" class="label">ما أكو تسجيلات بالفترة.</td></tr>'}</tbody></table></div><p class="v3-note">«نشط» = خلّص درس، أو سجّل صفقة بالدفتر، أو سأل VEXORA AI، أو فتح صفقة تجريبية بذاك الأسبوع.</p></section></div>
      <div class="v3-grid2"><section class="panel"><h3 class="v9-h3">🧾 الإيراد حسب النوع</h3><div class="v3-slist">${(b.by_kind||[]).map(x=>`<div class="v3-srow"><b>${esc(x.kind)}</b><span class="label"><bdi>${x.n}</bdi> <span>طلب</span></span><span style="margin-inline-start:auto">${m(x.sum)}</span></div>`).join("")||'<p class="label" style="margin:0">ما أكو مدفوعات بالفترة.</p>'}</div></section>
        <section class="panel"><h3 class="v9-h3">🌍 الدول</h3><div class="v3-slist">${(b.countries||[]).map(x=>`<div class="v3-srow"><b data-noi18n>${esc(x.k)}</b><span style="margin-inline-start:auto" class="num">${x.n}</span></div>`).join("")}</div></section></div>`},

  /* ---------------- الإدارة: الامتثال ---------------- */
  async cmpPage(){const el=$("v11CmBody");if(!isAdminUser()){el.innerHTML='<div class="panel">🔒 للمدير بس</div>';return}el.innerHTML=V11.hdr("⚖️","الامتثال","الإفصاحات وموافقة الأعضاء عليها، وطلبات البيانات، وسجل تدقيق كل أعمال الإدارة.")+'<div id="v11CmB"></div>';V11.cmpLoad()},
  async cmpLoad(){const B=$("v11CmB");let c;try{c=await V11.api().compliance()}catch(e){B.innerHTML=`<div class="panel down">${esc(V11.err(e))} (شغّل vexora_v11.sql)</div>`;return}
    B.innerHTML=`<div class="v3-grid2"><div class="v11-col">${(c.docs||[]).map(d=>`<section class="panel"><div class="ph"><h3 class="v9-h3" style="margin:0" data-noi18n>${esc(d.title)}</h3><span class="label"><span>نسخة</span> <bdi>${d.version}</bdi> · ${d.required?'<b class="gold">إلزامي</b>':"اختياري"}</span></div>
        <div class="v11-fn"><span>وافق عليها</span><div class="v2-pbar v9-bar"><i style="width:${d.users?Math.min(100,d.accepted/d.users*100):0}%"></i></div><b class="num"><bdi dir="ltr">${d.accepted}/${d.users}</bdi></b><small class="label">عضو</small></div>
        <div class="v9-ta" style="grid-template-columns:1fr"><label>العنوان<input data-dt="${esc(d.code)}" value="${esc(d.title)}" class="v11-in" data-noi18n></label><label>النص<textarea data-db="${esc(d.code)}" rows="5" data-noi18n>${esc(d.body)}</textarea></label></div>
        <label class="v9-ck"><input type="checkbox" data-dr="${esc(d.code)}" ${d.required?"checked":""}> <span>إلزامي: العضو لازم يوافق قبل ما يكمل</span></label>
        <div class="v3-act"><button class="btn v2s" type="button" data-ds="${esc(d.code)}">حفظ</button><span class="label">تغيير النص يرفع رقم النسخة ويطلب موافقة جديدة من الكل.</span></div></section>`).join("")}</div>
      <div class="v11-col"><section class="panel"><h3 class="v9-h3">📮 طلبات البيانات</h3><div class="v3-slist">${(c.data_requests||[]).map(r=>`<div class="v3-srow"><b>${esc(r.kind)}</b><bdi dir="ltr">${esc(r.email||"")}</bdi><span class="label">${esc(r.status)}</span><span class="label" style="margin-inline-start:auto"><bdi dir="ltr">${esc(V9.dt(r.at))}</bdi></span></div>`).join("")||'<p class="label" style="margin:0">ما أكو طلبات.</p>'}</div></section>
        <section class="panel"><h3 class="v9-h3">🔎 سجل التدقيق <span class="label">(<bdi>${c.admin_actions_30d}</bdi> <span>عملية بـ 30 يوم</span>)</span></h3><div class="v9-flt"><input id="v11AuQ" placeholder="ابحث: عملية، هدف، اسم" class="v11-in"><button class="btn v2s" type="button" id="v11AuGo">بحث</button></div><div id="v11AuL" class="v3-slist"></div></section></div></div>`;
    B.querySelectorAll("[data-ds]").forEach(b=>b.onclick=async()=>{const k=b.dataset.ds;try{const v=await V11.api().consentSave(k,B.querySelector(`[data-dt="${k}"]`).value,B.querySelector(`[data-db="${k}"]`).value,B.querySelector(`[data-dr="${k}"]`).checked);V11.toast("✅ انحفظ · نسخة "+v);V11.cmpLoad()}catch(e){V11.toast(V11.err(e),1)}});
    const au=async()=>{let L=[];try{L=await V11.api().audit($("v11AuQ").value||"",100)}catch(e){}$("v11AuL").innerHTML=L.map(a=>`<div class="v3-srow"><b data-noi18n>${esc(a.actor)}</b><span class="ltr">${esc(a.action)}</span><span class="label" data-noi18n>${esc(a.target||"")}</span><span class="label" style="margin-inline-start:auto"><bdi dir="ltr">${esc(V9.dt(a.at))}</bdi></span></div>`).join("")||'<p class="label" style="margin:0">ما أكو نتائج.</p>'};
    $("v11AuGo").onclick=au;au()},
  // نافذة الإفصاح الإلزامي (مرة وحدة لكل نسخة)
  async consents(){if(V11._cc||!ME.user)return;V11._cc=1;let L=[];try{L=await V11.api().consentsNeeded()||[]}catch(e){return}if(!L.length)return;
    const d=L[0],ov=document.createElement("div");ov.className="v11-ov";ov.innerHTML=`<div class="panel v11-cm" role="dialog" aria-modal="true" aria-labelledby="v11CmT"><h3 id="v11CmT" class="v9-h3">⚖️ ${esc(d.title)}</h3><div class="v11-cmb" data-noi18n>${esc(d.body)}</div><label class="v9-ck"><input type="checkbox" id="v11CmOk"> <span>قريت وفهمت</span></label><div class="v3-act"><button class="btn primary" type="button" id="v11CmGo" disabled>موافق</button></div></div>`;
    document.body.appendChild(ov);$("v11CmOk").onchange=e=>$("v11CmGo").disabled=!e.target.checked;
    $("v11CmGo").onclick=async()=>{try{await V11.api().consentAccept(d.code,d.version);ov.remove();V11._cc=0;V11.consents()}catch(e){V11.toast(V11.err(e),1)}}},

  /* ---------------- مختبر الاستراتيجيات PRO ---------------- */
  lab(R){if(!R||!R.T)return"";const T=R.T,N=T.length;if(N<5)return`<section class="panel v11-lab"><h3 class="v9-h3">🧪 تحليل PRO</h3><p class="label" style="margin:0">يحتاج 5 صفقات على الأقل.</p></section>`;
    const st=a=>{const n=a.length,w=a.filter(x=>x>0).length,gp=a.filter(x=>x>0).reduce((s,x)=>s+x,0),gl=-a.filter(x=>x<0).reduce((s,x)=>s+x,0);return{n,wr:n?w/n*100:0,avg:n?(gp-gl)/n:0,pf:gl?gp/gl:(gp?99:0)}};
    const cut=Math.floor(N*.7),IS=st(T.slice(0,cut).map(t=>t.r)),OS=st(T.slice(cut).map(t=>t.r)),deg=IS.avg>0?(OS.avg/IS.avg):null;
    const cost=k=>st(T.map(t=>t.r-(t.risk?k*R.spr*R.pip/t.risk:0)));const C=[0,1,2].map(k=>({k,...cost(k)}));
    let seed=42;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648,M=[],F=[],rs=T.map(t=>t.r);
    for(let s=0;s<1000;s++){let eq=0,pk=0,dd=0;for(let i=0;i<N;i++){eq+=rs[Math.floor(rnd()*N)];pk=Math.max(pk,eq);dd=Math.max(dd,pk-eq)}M.push(dd);F.push(eq)}
    M.sort((a,b)=>a-b);F.sort((a,b)=>a-b);const q=(A,p)=>A[Math.min(A.length-1,Math.floor(p*A.length))],neg=F.filter(x=>x<0).length/10;
    const r2=v=>`<bdi dir="ltr">${v>=0?"+":""}${v.toFixed(2)}R</bdi>`,row=(l,s)=>`<tr><td>${l}</td><td class="num">${s.n}</td><td class="num">${s.wr.toFixed(0)}%</td><td class="num">${r2(s.avg)}</td><td class="num">${s.pf>=99?"∞":s.pf.toFixed(2)}</td></tr>`;
    return`<section class="panel v11-lab"><h3 class="v9-h3">🧪 تحليل PRO</h3>${N<30?`<div class="v3-warn">⚠️ <span>عدد الصفقات</span> <bdi>${N}</bdi> <span>قليل. النتائج تحتاج 30 صفقة أو أكثر حتى يعتمد عليها.</span></div>`:""}
      <div class="v11-lg"><div><h4 class="v9-h4">📐 داخل العينة ↔ خارج العينة (Walk-forward)</h4><div class="v3-tw"><table class="v3-tb"><thead><tr><th></th><th>صفقات</th><th>نجاح</th><th>متوسط</th><th>PF</th></tr></thead><tbody>${row("أول 70%",IS)}${row("آخر 30% (خارج العينة)",OS)}</tbody></table></div>
        <p class="label v11-lp">${deg==null?"الأداء داخل العينة مو موجب أصلاً.":deg<.5?'<b class="down">⚠️ الأداء خارج العينة ضعف كثير: احتمال الاستراتيجية مضبوطة على الماضي (Overfitting).</b>':deg<.8?'<b class="gold">الأداء خارج العينة أقل، بس بعده موجب.</b>':'<b class="up">الأداء خارج العينة قريب من داخلها.</b>'}</p></div>
        <div><h4 class="v9-h4">💸 حساسية التكاليف</h4><div class="v3-tw"><table class="v3-tb"><thead><tr><th>السبريد</th><th>صفقات</th><th>نجاح</th><th>متوسط</th><th>PF</th></tr></thead><tbody>${C.map(c=>row(c.k?`+${c.k}× سبريد إضافي`:"الحالي",c)).join("")}</tbody></table></div><p class="label v11-lp">إذا الربح يختفي بسبريد إضافي بسيط، الاستراتيجية حساسة للتنفيذ الفعلي.</p></div>
        <div><h4 class="v9-h4">🎲 مونت كارلو (1000 ترتيب عشوائي)</h4><div class="v9-kv"><span>أسوأ تراجع متوقع (الوسيط)</span><b class="down"><bdi dir="ltr">−${q(M,.5).toFixed(1)}R</bdi></b><span>أسوأ تراجع (95%)</span><b class="down"><bdi dir="ltr">−${q(M,.95).toFixed(1)}R</bdi></b><span>النتيجة النهائية (5% – 95%)</span><b><bdi dir="ltr">${q(F,.05).toFixed(1)}R … ${q(F,.95).toFixed(1)}R</bdi></b><span>احتمال تنتهي بخسارة</span><b class="${neg>20?"down":"gold"}"><bdi dir="ltr">${neg.toFixed(1)}%</bdi></b></div><p class="label v11-lp">نفس الصفقات بترتيب مختلف: يوضح شكد ممكن يصير التراجع بالحظ وحده.</p></div></div>
      <p class="v3-note">اختبار على بيانات سابقة، ما يضمن المستقبل. التنفيذ الحقيقي فيه انزلاق وسبريد متغير.</p></section>`},

  side(){const a=isAdminUser(),st=V11.isStaff();document.querySelectorAll(".v11-adm").forEach(x=>x.hidden=!a);document.querySelectorAll(".v11-stf").forEach(x=>x.hidden=!st)},
  view(v){V11.side();V11.consents();const sec={forecast:"v11NwView",brief:"v11BrView",path:"v11PtView",help:"v11HpView",crm:"v11CrView",ops:"v11OpView",bi:"v11BiView",compliance:"v11CmView"};for(const k in sec){const e=$(sec[k]);if(e)e.hidden=v!==k}
    const F={forecast:V11.nPage,brief:()=>V11.bPage(),path:V11.pPage,help:V11.hPage,crm:V11.crmPage,ops:V11.opsPage,bi:V11.biPage,compliance:V11.cmpPage}[v];if(F)Promise.resolve(F()).catch(e=>console.warn(e))}
};
{const _s=V3.stShow;V3.stShow=function(R){const o=_s.apply(this,arguments);try{const out=$("stOut");if(out&&R&&R.T)out.insertAdjacentHTML("beforeend",V11.lab(R))}catch(e){console.warn(e)}return o}}
window.__v11=V11;
/* ================= V13: الناسخ التلقائي (VEXORA COPIER) ================= */
const V13={tab:"me",d:null,
  api(){return DB.v13},toast(t,b){V9.toast(t,b)},err(e){return V9.err(e)},
  num(v,d){return v==null||v===""||isNaN(+v)?"—":(+v).toLocaleString("en-US",{minimumFractionDigits:d==null?2:d,maximumFractionDigits:d==null?2:d})},
  ago(t){if(!t)return"ما اتصل بعد";const s=(Date.now()-new Date(t))/1e3;return s<60?`قبل ${Math.max(1,Math.round(s))} ثانية`:s<3600?`قبل ${Math.round(s/60)} دقيقة`:s<86400?`قبل ${Math.round(s/3600)} ساعة`:new Date(t).toLocaleString("en-GB")},
  WHY:{GLOBAL_OFF:"الناسخ متوقف من الإدارة حالياً",NOT_APPROVED:"بانتظار موافقة الإدارة",USER_OFF:"إنت موقف الناسخ",LIVE_LOCKED:"الحسابات الحقيقية مقفولة حالياً (Demo بس)",LOW_BALANCE:"الرصيد أقل من الحد الأدنى",DAY_MAX_TRADES:"وصلت أقصى صفقات اليوم",DAY_TARGET:"وصلت هدف الربح اليومي",DAY_STOP:"وصلت حد الخسارة اليومي"},
  ST:{pending:["ty","⏳ بانتظار الموافقة"],approved:["tg","✓ مقبول"],rejected:["tr","⛔ مرفوض"],paused:["ty","⏸ موقوف من الإدارة"]},
  hdr(){return`<div class="panel v3-hdr"><div class="v3-ttl v9-hrow"><div class="v3-ttl"><span class="v3-logo">🔁</span><div><h2>الناسخ التلقائي ${V11.demo()}</h2><p>صفقات منصة فيكسورا تنفتح تلقائياً بحسابك MT5 على INFINOX، بالإعدادات اللي إنت تحددها. تكدر توقفه بأي وقت.</p></div></div>
    ${isAdminUser()?`<div class="v13-tabs"><button type="button" data-v13t="me" class="${V13.tab==="me"?"on":""}">👤 ناسخي</button><button type="button" data-v13t="adm" class="${V13.tab==="adm"?"on":""}">🛠 إدارة الناسخ</button></div>`:""}</div></div>`},
  async page(){const el=$("v13CpBody");if(!el)return;if(V3.locked(el))return;
    el.innerHTML=V13.hdr()+'<div id="v13B"><div class="panel label">جاري التحميل…</div></div>';
    el.querySelectorAll("[data-v13t]").forEach(b=>b.onclick=()=>{V13.tab=b.dataset.v13t;V13.page()});
    if(V13.tab==="adm"&&isAdminUser())return V13.adm();
    try{V13.d=await V13.api().me();V13.me()}catch(e){$("v13B").innerHTML=`<div class="panel down">${esc(V13.err(e))} (شغّل vexora_v13_copier.sql)</div>`}},
  steps(d){const a=d.acct,s=[[!!d.eligible,"حسابك بـ INFINOX","من رابط فيكسورا · مفعّل"],[!!a,"ربط حساب MT5","رقم الحساب + السيرفر"],[a&&a.status==="approved","موافقة الإدارة","تتأكد من الحساب"],[a&&a.active&&a.last_seen,"تشغيل الناسخ","البوت متصل"]];
    let cur=s.findIndex(x=>!x[0]);return`<div class="v13-steps">${s.map((x,i)=>`<div class="v13-st ${x[0]?"ok":i===cur?"on":"off"}"><b>${x[0]?"✓":i+1}</b><span>${x[1]}<small>${x[2]}</small></span></div>`).join("")}</div>`},
  me(){const d=V13.d,B=$("v13B"),a=d.acct,L=d.limits;
    if(!d.eligible){B.innerHTML=V13.steps(d)+`<div class="panel"><h3 class="v9-h3">🔒 الناسخ للأعضاء المفعّلين بس</h3><p class="label">لازم يكون حسابك بالموقع مفعّل أول (يعني فاتح حساب INFINOX من رابط فيكسورا والإدارة فعّلتك).</p>
      <div class="v9-kv"><span>حالة حسابك</span><b>${esc(d.profile.status||"—")}</b><span>رقم حساب INFINOX</span><b class="ltr">${esc(d.profile.account||"ما مكتوب")}</b></div></div>`;return}
    if(!a){B.innerHTML=V13.steps(d)+`<div class="panel v13-join"><h3 class="v9-h3">🔗 اربط حسابك MT5</h3><p class="label">الناسخ يشتغل بس على حساب INFINOX المفتوح من رابط الوكالة.</p>
      <div class="v13-f"><label>رقم حساب MT5${d.profile.account?`<div class="v13-ro ltr ok">${esc(d.profile.account)} <em>✓ INFINOX · من ملفك</em></div>`:`<input class="f ltr" id="v13Acc" inputmode="numeric" maxlength="12" placeholder="مثال: 9935360"><span class="label">لازم يكون حساب INFINOX مفتوح من رابط فيكسورا. الإدارة تتأكد قبل الموافقة.</span>`}</label>
      <label>السيرفر<input class="f ltr" id="v13Srv" value="INFINOX-Live" maxlength="60"></label><label class="w">الاسم على الحساب<input class="f" id="v13Hol" value="${escA(d.profile.name||"")}" maxlength="80"></label></div>
      <button class="btn primary" type="button" id="v13Join" style="margin-top:12px">📨 اطلب ربط الناسخ</button><p class="v3-note">ما نطلب كلمة سر حسابك أبداً. بعد موافقة الإدارة تاخذ رمز خاص تحطه بالبوت على MT5.</p></div>`;
      $("v13Join").onclick=async()=>{try{V13.d=await V13.api().join({server:$("v13Srv").value,holder:$("v13Hol").value,account:($("v13Acc")||{}).value||""});V13.toast("✅ انرسل الطلب. تنتظر موافقة الإدارة.");V13.me()}catch(e){V13.toast(V13.err(e),1)}};return}
    const s={...d.defaults,...a.settings},bal=+a.balance||0,usd=p=>bal?` <span class="label">≈ $${V13.num(bal*p/100)}</span>`:"";
    const live=a.last_seen&&(Date.now()-new Date(a.last_seen))<120e3,st=V13.ST[a.status]||["ty",a.status];
    B.innerHTML=V13.steps(d)+`<div class="v13-g"><div class="panel"><h3 class="v9-h3">⚙️ إعدادات النسخ <small class="label">تتحفظ وتتطبق على الصفقة الجاية</small></h3><div class="v13-f">
      <label>الاسم<div class="v13-ro">${esc(a.holder||d.profile.name||"")}</div></label>
      <label>رقم حساب MT5<div class="v13-ro ltr ok">${esc(a.account)} <em>✓ INFINOX</em></div></label>
      <label>السيرفر<div class="v13-ro ltr">${esc(a.server||"—")}</div></label>
      <label>رصيد الحساب<div class="v13-ro ltr">${a.balance!=null?"$"+V13.num(a.balance):"—"} <em class="label">${a.balance!=null?"يتحدث من MT5":"يطلع بعد تشغيل البوت"}</em></div></label>
      <label class="w">نسبة المخاطرة لكل صفقة: <b class="gold" id="v13RiskV">${s.risk}%</b> <span class="label" id="v13RiskU">${bal?`(≈ $${V13.num(bal*s.risk/100)} خسارة كحد أقصى بالصفقة)`:""}</span>
        <input type="range" id="v13Risk" min="0.1" max="${L.max_risk}" step="0.1" value="${s.risk}"><span class="v13-row"><span>0.1%</span><span>الحد الأقصى المسموح ${L.max_risk}%</span></span></label>
      <label>حجم اللوت<div class="v13-seg" id="v13LM"><button type="button" data-v="auto" class="${s.lot_mode==="auto"?"on":""}">تلقائي حسب المخاطرة</button><button type="button" data-v="fixed" class="${s.lot_mode==="fixed"?"on":""}">ثابت</button></div><span class="label">تلقائي = البوت يحسب اللوت من الوقف ونسبة المخاطرة</span></label>
      <label>اللوت الثابت<input class="f ltr" id="v13Lot" type="number" min="0.01" max="${L.max_lot}" step="0.01" value="${s.lot}" ${s.lot_mode==="fixed"?"":"disabled"}></label>
      <label>أقصى عدد صفقات باليوم<input class="f" id="v13MD" type="number" min="1" max="${L.max_day}" step="1" value="${s.max_day}"></label>
      <label>أقصى صفقات مفتوحة سوه<input class="f" id="v13MO" type="number" min="1" max="${L.max_open}" step="1" value="${s.max_open}"></label>
      <label>هدف الربح اليومي % <span class="label">(يوقف لباچر · 0 = بدون)</span><input class="f" id="v13DT" type="number" min="0" max="50" step="0.5" value="${s.day_target}"></label>
      <label>حد الخسارة اليومي % <span class="label">(يوقف لباچر)</span><input class="f" id="v13DS" type="number" min="0.5" max="20" step="0.5" value="${s.day_stop}"></label>
      <label class="w">الأزواج اللي ينسخها<div class="v13-chips" id="v13Sy">${L.syms.map(x=>`<button type="button" data-v="${x}" class="${(s.syms||[]).includes(x)?"on":""}">${x==="XAU/USD"?"XAU/USD الذهب":x}</button>`).join("")}</div></label>
      <label class="w">يسكر الصفقة عند<div class="v13-seg" id="v13TP">${[["tp1","الهدف 1"],["tp2","الهدف 2"],["tp3","الهدف 3"],["split","تقسيم على 3"]].map(([k,l])=>`<button type="button" data-v="${k}" class="${s.tp===k?"on":""}">${l}</button>`).join("")}</div></label></div>
      <div class="n-btns" style="margin-top:14px"><button class="btn primary" type="button" id="v13Save">💾 حفظ الإعدادات</button><button class="btn" type="button" id="v13Safe">↺ الإعدادات الآمنة</button></div></div>
      <div class="v13-side"><div class="panel"><h3 class="v9-h3">📡 حالة الناسخ <span class="v13-tag ${st[0]}">${st[1]}</span></h3>
        <div class="v13-live ${live?"on":""}"><i></i>${live?"متصل":"غير متصل"} · آخر اتصال ${V13.ago(a.last_seen)}${a.ea_version?` · البوت v${esc(a.ea_version)}`:""}${a.is_demo!=null?` · <b>${a.is_demo?"حساب Demo":"حساب حقيقي"}</b>`:""}</div>
        ${!L.on?`<p class="v13-note">⏸ الناسخ متوقف من الإدارة حالياً. إعداداتك محفوظة، ويشتغل أول ما ينفتح.</p>`:""}${L.on&&!L.live?`<p class="v13-note">🧪 الناسخ بمرحلة التجربة: يشتغل على حسابات <b>Demo</b> بس.</p>`:""}
        <div class="v13-kpi"><div><span>صفقات اليوم</span><b><bdi dir="ltr">${d.today.opened} / ${s.max_day}</bdi></b></div><div><span>ربح/خسارة اليوم</span><b class="${d.today.pnl>0?"up":d.today.pnl<0?"down":""}">${d.today.pnl>0?"+":""}$${V13.num(d.today.pnl)}</b></div>
          <div><span>المخاطرة لكل صفقة</span><b class="gold">${s.risk}%</b></div><div><span>الحالة</span><b class="${a.active?"up":""}">${a.active?"▶ شغّال":"⏸ متوقف"}</b></div></div>
        <div class="n-btns">${a.active?`<button class="btn" type="button" data-v13a="off">⏸ إيقاف مؤقت</button>`:`<button class="btn primary" type="button" data-v13a="on" ${a.status!=="approved"?"disabled":""}>▶ تشغيل الناسخ</button>`}<button class="btn v13-danger" type="button" data-v13a="close_all">⛔ إغلاق كل صفقات الناسخ</button></div></div>
        ${a.status==="approved"||a.status==="paused"?`<div class="panel"><h3 class="v9-h3">🔑 رمز البوت الخاص بيك</h3><p class="label">حطه بإعدادات بوت فيكسورا على MT5. لا تشاركه ويّا أحد.</p>
          <div class="v13-tok"><code class="ltr" id="v13Tok">${a.token?esc(a.token.slice(0,6))+"••••••••••••"+esc(a.token.slice(-4)):"—"}</code><button class="btn" type="button" id="v13Cp">📋 نسخ</button></div>
</div>${V13.guide(a)}`:""}
        ${a.status==="rejected"?`<div class="panel down">⛔ انرفض الطلب: ${esc(a.reason||"راسل الدعم")}</div>`:""}
        <div class="panel"><h3 class="v9-h3">🧾 آخر الصفقات المنسوخة</h3>${d.events.length?`<div class="v3-tw"><table class="n-tbl"><tr><th>الوقت</th><th>الزوج</th><th>اللوت</th><th>النتيجة</th></tr>${d.events.map(e=>`<tr><td>${new Date(e.at).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td><td>${e.side==="buy"?"🟢 شراء":e.side==="sell"?"🔴 بيع":""} ${esc(e.sym||"")}</td><td class="ltr">${e.lot!=null?esc(e.lot):"—"}</td><td>${e.kind==="close"?`<span class="v13-tag ${+e.pnl>=0?"tg":"tr"}">${+e.pnl>=0?"+":""}$${V13.num(e.pnl)}</span>`:e.kind==="open"?`<span class="v13-tag ty">مفتوحة</span>`:e.kind==="skip"?`<span class="v13-tag ty">⏭ ${esc(e.reason||"تجاوز")}</span>`:`<span class="v13-tag tr">${esc(e.reason||e.kind)}</span>`}</td></tr>`).join("")}</table></div>`:`<p class="label">ماكو صفقات منسوخة بعد.</p>`}</div>
        ${d.consent?`<div class="v13-warn">⚠️ <b>${esc(d.consent.title)}</b><div class="v13-cb" data-noi18n>${esc(d.consent.body)}</div>${d.consent.ok?`<p class="up" style="margin:6px 0 0">✓ وافقت على الإفصاح</p>`:`<label class="v13-ok"><input type="checkbox" id="v13Cons"> قريت وأوافق على شروط الناسخ وإفصاح المخاطر</label>`}</div>`:""}</div></div>`;
    const seg=(id,cb)=>$(id).querySelectorAll("button").forEach(b=>b.onclick=()=>{$(id).querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));cb&&cb(b.dataset.v)});
    seg("v13LM",v=>{$("v13Lot").disabled=v!=="fixed"});seg("v13TP");$("v13Sy").querySelectorAll("button").forEach(b=>b.onclick=()=>b.classList.toggle("on"));
    $("v13Risk").oninput=e=>{const r=+e.target.value;$("v13RiskV").textContent=r+"%";$("v13RiskU").textContent=bal?`(≈ $${V13.num(bal*r/100)} خسارة كحد أقصى بالصفقة)`:""};
    const val=()=>({risk:+$("v13Risk").value,lot_mode:$("v13LM").querySelector(".on").dataset.v,lot:+$("v13Lot").value,max_day:+$("v13MD").value,max_open:+$("v13MO").value,day_target:+$("v13DT").value,day_stop:+$("v13DS").value,syms:[...$("v13Sy").querySelectorAll(".on")].map(b=>b.dataset.v),tp:$("v13TP").querySelector(".on").dataset.v});
    $("v13Save").onclick=async()=>{try{V13.d=await V13.api().save(val());V13.toast("✅ انحفظت الإعدادات");V13.me()}catch(e){V13.toast(V13.err(e),1)}};
    $("v13Safe").onclick=async()=>{try{V13.d=await V13.api().save({...d.defaults});V13.toast("↺ رجعت الإعدادات الآمنة");V13.me()}catch(e){V13.toast(V13.err(e),1)}};
    B.querySelectorAll("[data-v13a]").forEach(b=>b.onclick=async()=>{const act=b.dataset.v13a;
      if(act==="close_all"&&!b.dataset.ok){b.dataset.ok="1";b.textContent="⚠️ متأكد؟ اضغط مرة ثانية";setTimeout(()=>{if(b.isConnected){delete b.dataset.ok;b.textContent="⛔ إغلاق كل صفقات الناسخ"}},5000);return}
      if(act==="on"&&d.consent&&!d.consent.ok){const c=$("v13Cons");if(!c||!c.checked){V13.toast("وافق على إفصاح المخاطر أول (المربع جوّه)",1);return}try{await V13.api().consent(d.consent.code,d.consent.version)}catch(e){V13.toast(V13.err(e),1);return}}
      try{V13.d=await V13.api().toggle(act);V13.toast(act==="on"?"▶ انشغّل الناسخ":act==="off"?"⏸ توقف الناسخ":"⛔ انرسل أمر إغلاق كل صفقات الناسخ للبوت");V13.me()}catch(e){V13.toast(V13.err(e),1)}});
    V13.bindGuide();const cp=$("v13Cp");if(cp)cp.onclick=async()=>{try{await navigator.clipboard.writeText(a.token||"");V13.toast("📋 انتسخ الرمز")}catch(e){V13.toast("ما گدرت أنسخ، انسخه يدوي",1)}}},
  EA:"downloads/VexoraCopier.ex5",URL:"https://rczvkpzxkwxzoivyiblo.supabase.co",
  guide(a){const st=(n,t,b)=>`<li class="v13-gs"><b>${n}</b><div><strong>${t}</strong><div class="v13-gb">${b}</div></div></li>`;
    return`<div class="panel v13-guide"><h3 class="v9-h3">📥 تحميل البوت وتفعيله <small class="label">خطوات مرة وحدة بس</small></h3>
    <div class="v13-dl"><a class="btn primary" id="v13Dl" href="${V13.EA}" download="VexoraCopier.ex5">📥 تحميل البوت <bdi dir="ltr">VexoraCopier.ex5</bdi></a><span class="label" id="v13DlSt">لـ MetaTrader 5 · يشتغل بس على حسابك بـ INFINOX</span></div>
    <ol class="v13-gl">
      ${st(1,"حط الملف بمجلد البوتات",`بـ MT5 من فوك: <b>File ← Open Data Folder</b>، وادخل <b dir="ltr">MQL5 ← Experts</b>، وحط ملف <bdi dir="ltr">VexoraCopier.ex5</bdi> هناك. بعدين سد MT5 وافتحه، أو من «المستكشف» كلك يمين ← <b>Refresh</b>.`)}
      ${st(2,"اسمح للبوت يتصل بالموقع",`<b>Tools ← Options ← Expert Advisors</b> ← علّم على <b>Allow WebRequest for listed URL</b> وضيف هذا الرابط:<div class="v13-tok" style="margin-top:6px"><code class="ltr">${V13.URL}</code><button class="btn" type="button" data-v13copy="${V13.URL}">📋 نسخ</button></div>`)}
      ${st(3,"شغّل التداول الآلي",`اضغط زر <b>Algo Trading</b> فوك بـ MT5 لحد ما يصير أخضر.`)}
      ${st(4,"حط البوت على شارت واحد",`اسحب <b>VexoraCopier</b> من «المستكشف» على أي شارت (مثلاً الذهب). <b>شارت واحد بس</b>، لأنه ينسخ كل الأزواج منه.`)}
      ${st(5,"الصق رمزك",`بالنافذة اللي تطلع: تبويب <b>Inputs (المدخلات)</b> ← دبل كلك على <b dir="ltr">InpToken</b> ← الصق الرمز اللي فوك (زر «📋 نسخ»). بتبويب <b>Common</b> علّم على <b>Allow Algo Trading</b> ← <b>OK</b>.`)}
      ${st(6,"شغّل الناسخ من هنا",`علّم على إفصاح المخاطر جوّه، واضغط <b>«▶ تشغيل الناسخ»</b>. خلال 10 ثواني يصير المربع «متصل» فوك، وبزاوية الشارت يطلع <b dir="ltr">[&gt;] شغّال</b>.`)}
    </ol>
    <details class="v13-trb"><summary>🛠 البوت ما يشتغل؟ شوف شنو مكتوب بزاوية الشارت</summary><table class="n-tbl">
      ${[["[II] متوقف: GLOBAL_OFF","الناسخ متوقف من الإدارة حالياً. انتظر."],["[II] متوقف: USER_OFF","اضغط «▶ تشغيل الناسخ» بهاي الصفحة."],["[II] متوقف: NOT_APPROVED","طلبك بعده ما انقبل، أو موقوف."],["[II] متوقف: LIVE_LOCKED","الناسخ بمرحلة التجربة: يشتغل على حسابات Demo بس."],["[II] متوقف: DAY_TARGET / DAY_STOP","وصلت هدف الربح أو حد الخسارة لليوم. يرجع باچر."],["[II] متوقف: DAY_MAX_TRADES","وصلت أقصى صفقات اليوم."],["[II] متوقف: LOW_BALANCE","رصيدك أقل من الحد الأدنى."],["[X] BAD_TOKEN","الرمز غلط، أو رقم حساب MT5 غير الرقم المربوط هنا."],["[X] NOT_INFINOX","البوت يشتغل بس على حسابات INFINOX."],["[!] ما گدر يتصل بالموقع","الرابط مو مضاف بـ Allow WebRequest (الخطوة 2)."],["[!] زر Algo Trading مطفي","شغّل زر Algo Trading (الخطوة 3)."]].map(([k,v])=>`<tr><td class="ltr"><code>${k}</code></td><td>${v}</td></tr>`).join("")}</table></details>
    <p class="v3-note">⚠️ لازم MT5 يبقى مفتوح حتى ينسخ. إذا تسد الكمبيوتر، استخدم VPS (مثل VPS اللي داخل MT5). لا تشارك الرمز ويّا أحد.</p></div>`},
  bindGuide(){document.querySelectorAll("[data-v13copy]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.v13copy);V13.toast("📋 انتسخ")}catch(e){V13.toast("انسخه يدوي",1)}});
    const dl=$("v13Dl");if(dl&&!V13._dlChecked){V13._dlChecked=1;fetch(V13.EA,{method:"HEAD",cache:"no-store"}).then(r=>{V13._dlOk=r.ok;V13.markDl()}).catch(()=>{V13._dlOk=null})}else V13.markDl()},
  markDl(){const dl=$("v13Dl"),st=$("v13DlSt");if(!dl||V13._dlOk!==false)return;dl.classList.add("v13-off");dl.removeAttribute("href");dl.onclick=e=>{e.preventDefault();V13.toast("ملف البوت بعده ما انرفع على الموقع. راسل الإدارة.",1)};if(st)st.textContent="⏳ ملف البوت بعده ما انرفع، يجهز قريباً"},
  // ---------- الإدارة ----------
  async adm(){const B=$("v13B");let r;try{r=await V13.api().aList()}catch(e){B.innerHTML=`<div class="panel down">${esc(V13.err(e))}</div>`;return}
    const L=r.limits,R=r.rows,live=x=>x.last_seen&&(Date.now()-new Date(x.last_seen))<120e3;
    B.innerHTML=`<div class="v13-g v13-ga"><div class="v13-side"><div class="panel"><h3 class="v9-h3">🚦 التحكم العام</h3>
      <div class="v13-kpi"><div><span>حسابات متصلة</span><b class="up">${R.filter(live).length}</b></div><div><span>بانتظار الموافقة</span><b class="gold">${R.filter(x=>x.status==="pending").length}</b></div><div><span>صفقات اليوم (الكل)</span><b>${R.reduce((s,x)=>s+(+(x.today||{}).opened||0),0)}</b></div><div><span>مشغّلين الناسخ</span><b>${R.filter(x=>x.active).length}</b></div></div>
      <label class="v13-sw"><span>🔁 الناسخ شغّال للكل<small>إذا مطفي، ولا حساب ينسخ</small></span><input type="checkbox" id="v13On" ${L.on?"checked":""}></label>
      <label class="v13-sw"><span>💰 مسموح على الحسابات الحقيقية<small>مطفي = حسابات Demo بس (للتجربة)</small></span><input type="checkbox" id="v13Live" ${L.live?"checked":""}></label>
      <button class="btn v13-kill" type="button" id="v13Kill">⛔ إيقاف الناسخ لكل الحسابات فوراً</button><label class="v13-ok"><input type="checkbox" id="v13KillC"> وإغلاق الصفقات المفتوحة من الناسخ هم</label></div>
      <div class="panel"><h3 class="v9-h3">📏 الحدود العامة <small class="label">المتدرب ما يكدر يتجاوزها</small></h3><div class="v13-f">
        <label>أعلى نسبة مخاطرة للصفقة %<input class="f" id="v13Lr" type="number" step="0.1" value="${L.max_risk}"></label><label>أعلى صفقات باليوم<input class="f" id="v13Ld" type="number" value="${L.max_day}"></label>
        <label>أعلى صفقات مفتوحة<input class="f" id="v13Lo" type="number" value="${L.max_open}"></label><label>أعلى لوت ثابت<input class="f ltr" id="v13Ll" type="number" step="0.01" value="${L.max_lot}"></label>
        <label>أقل رصيد للتشغيل $<input class="f ltr" id="v13Lb" type="number" value="${L.min_bal}"></label><label>حد «الصفقات القوية»<input class="f" id="v13Lp" type="number" value="${L.min_pct}"></label>
        <label class="w">صفقات تتنسخ<div class="v13-seg" id="v13Src"><button type="button" data-v="all" class="${L.src==="all"?"on":""}">كل صفقات المنصة</button><button type="button" data-v="strong" class="${L.src==="strong"?"on":""}">بس القوية (≥ ${L.min_pct})</button></div></label></div>
        <button class="btn primary" type="button" id="v13LSave" style="margin-top:12px">💾 حفظ الحدود</button></div></div>
      <div class="panel"><h3 class="v9-h3">👥 الحسابات <small class="label">${R.length} حساب</small></h3>${R.length?`<div class="v3-tw"><table class="n-tbl"><tr><th>المتدرب</th><th>حساب MT5</th><th>الرصيد</th><th>المخاطرة</th><th>صفقات اليوم</th><th>اليوم</th><th>الحالة</th><th></th></tr>
        ${R.map(x=>{const st=V13.ST[x.status]||["ty",x.status],t=x.today||{},s=x.settings||{};return`<tr><td>${esc(x.name||"")}${x.profile_account&&x.profile_account!==x.account?`<div class="down" style="font-size:11.5px">⚠️ ما يطابق ملفه (${esc(x.profile_account)})</div>`:""}</td><td class="ltr">${esc(x.account)}${x.is_demo!=null?`<div class="label" style="font-size:11px">${x.is_demo?"Demo":"Real"}</div>`:""}</td><td class="ltr">${x.balance!=null?"$"+V13.num(x.balance,0):"—"}</td><td>${s.risk!=null?s.risk+"%":"—"}</td><td><bdi dir="ltr">${+t.opened||0}/${s.max_day||"—"}</bdi></td><td class="${+t.pnl>0?"up":+t.pnl<0?"down":""}">${+t.pnl?(+t.pnl>0?"+":"")+"$"+V13.num(t.pnl):"—"}</td>
          <td><span class="v13-tag ${st[0]}">${st[1]}</span>${live(x)?` <span class="v13-tag tg">● متصل</span>`:""}${x.active?` <span class="v13-tag tg">▶</span>`:""}</td>
          <td class="v13-acts">${x.status==="pending"||x.status==="rejected"?`<button class="btn primary" type="button" data-u="${escA(x.user_id)}" data-a="approve">موافقة</button>`:""}${x.status==="pending"?`<button class="btn" type="button" data-u="${escA(x.user_id)}" data-a="reject">رفض</button>`:""}${x.status==="approved"?`<button class="btn" type="button" data-u="${escA(x.user_id)}" data-a="pause">⏸</button>`:""}${x.status==="paused"?`<button class="btn" type="button" data-u="${escA(x.user_id)}" data-a="resume">▶</button>`:""}</td></tr>`}).join("")}</table></div>`:`<p class="label">ماكو طلبات ناسخ بعد.</p>`}
        <p class="v3-note">الموافقة تشتغل بس إذا رقم الحساب يطابق رقم INFINOX المفعّل بملف العضو (يعني من رابط الوكالة).</p></div></div>`;
    $("v13Src").querySelectorAll("button").forEach(b=>b.onclick=()=>$("v13Src").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)));
    const cfg=async p=>{try{await V13.api().aCfg(p);V13.toast("✅ انحفظ");V13.adm()}catch(e){V13.toast(V13.err(e),1);V13.adm()}};
    $("v13On").onchange=e=>cfg({on:e.target.checked});
    $("v13Live").onchange=e=>{if(e.target.checked&&!confirm("تشغيل الناسخ على الحسابات الحقيقية يفتح صفقات بفلوس حقيقية. تأكدت من INFINOX والمحامي وجربت على Demo؟")){e.target.checked=false;return}cfg({live:e.target.checked})};
    $("v13LSave").onclick=()=>cfg({max_risk:$("v13Lr").value,max_day:$("v13Ld").value,max_open:$("v13Lo").value,max_lot:$("v13Ll").value,min_bal:$("v13Lb").value,min_pct:$("v13Lp").value,src:$("v13Src").querySelector(".on").dataset.v});
    $("v13Kill").onclick=async e=>{const b=e.target;if(!b.dataset.ok){b.dataset.ok="1";b.textContent="⚠️ متأكد؟ اضغط مرة ثانية";setTimeout(()=>{if(b.isConnected){delete b.dataset.ok;b.textContent="⛔ إيقاف الناسخ لكل الحسابات فوراً"}},5000);return}
      try{const n=await V13.api().aKill($("v13KillC").checked);V13.toast(`⛔ توقف الناسخ (${n} حساب)`);V13.adm()}catch(err){V13.toast(V13.err(err),1)}};
    B.querySelectorAll("[data-a]").forEach(b=>b.onclick=async()=>{const a=b.dataset.a;let why="";if(a==="reject"){why=prompt("سبب الرفض (يوصل للمتدرب):","الحساب مو من رابط الوكالة")||"";}
      try{await V13.api().aSet(b.dataset.u,a,why);V13.toast("✅ تم");V13.adm()}catch(e){V13.toast(V13.err(e),1)}})},
  view(v){const e=$("v13CpView");if(e)e.hidden=v!=="copier";if(v==="copier")V13.page().catch(x=>console.warn(x))}
};
window.__v13=V13;






/* ================= V4: المسابقات · النقاط · الجوائز · السحوبات · الإعلانات · النمو ================= */
const V4={tab:"comps",gt:"comps",cache:{},
  api(){return DB.v4},
  toast(t,bad){try{V3.toast(t,bad)}catch(e){alert(t)}},
  err(e){return String(e&&e.message||e||"").replace(/^[A-Z_]+:\s*/,"")},
  TY:{analysis:"📐 تحليل الذهب",prediction:"🎯 توقّع الاتجاه",paper:"📈 حساب ورقي",quiz:"❓ أسئلة تداول",technical:"📊 تحليل فني/موجي/زمني/رقمي",smc:"🧠 تحدي Smart Money",lessons:"📚 إكمال الدروس",referral:"🔗 مسابقة الدعوات",team:"👥 مجموعات",manual:"🏆 مسابقة"},
  AUD:{all:"كل المسجّلين",members:"الأعضاء المفعّلين",vip:"أعضاء VIP"},
  LV:{bronze:["🥉","برونزي"],silver:["🥈","فضي"],gold:["🥇","ذهبي"],diamond:["💎","ماسي"]},
  ST:{joined:["مشترك","chip"],pending:["⏳ قيد المراجعة","chip gold"],accepted:["✅ مقبولة","chip up"],rejected:["⛔ مرفوضة","chip down"],disqualified:["⛔ غير مؤهل","chip down"]},
  RST:{pending:["⏳ بانتظار موافقة الإدارة","gold"],approved:["✅ انقبلت","up"],delivered:["🎉 انسلّمت","up"],rejected:["⛔ مرفوضة","down"]},
  prizeTop(c){const p=(c.prizes||[]).find(x=>+x.rank===1);return p&&p.text||c.prize||""},
  // ---- العدّاد التنازلي (كل الأرقام من تاريخ النهاية الحقيقي) ----
  cd(end,big){if(!end)return"";return`<div class="${big?"hx-cd":"pm-cd"}" data-cd="${escA(end)}"></div>`},
  tick(){document.querySelectorAll("[data-cd]").forEach(el=>{let s=Math.max(0,Math.floor((new Date(el.dataset.cd)-Date.now())/1000));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;
    const p=v=>String(v).padStart(2,"0");el.innerHTML=[[s,"ثانية"],[m,"دقيقة"],[h,"ساعة"],[d,"يوم"]].reverse().map(([v,l])=>`<div><b>${p(v)}</b><small>${l}</small></div>`).join("")})},
  // ---- تتبّع الحملات (رابط ?c=) ----
  track(){return window.VexoraAttribution?.visit("campaign",(c,a,p)=>DB.v4.track(c,a,p))?.catch(()=>{})},
  afterLogin(){window.VexoraAttribution?.assign("campaign",ME.user?.id,c=>DB.v4.setCamp(c))?.catch(()=>{});
    setTimeout(()=>V4.popup(),1500)},
  // ================= البانر أعلى الصفحة الرئيسية =================
  async hero(){const el=$("v4Hero");if(!el)return;let L=[];try{L=await V4.api().adsHome()||[]}catch(e){L=[]}
    if(!L.length){el.hidden=true;el.innerHTML="";return}el.hidden=false;V4.slides=L;V4.si=Math.min(V4.si||0,L.length-1);V4.slide();
    clearInterval(V4._ht);if(L.length>1)V4._ht=setInterval(()=>{if(document.hidden||el.hidden||el.matches(":hover"))return;V4.si=(V4.si+1)%V4.slides.length;V4.slide()},8000)},
  slide(){const el=$("v4Hero"),c=V4.slides[V4.si],n=V4.slides.length;if(!c)return;
    el.innerHTML=`<section class="hx"><div class="hx-bg" style="${c.image_url?`background-image:url('${escA(c.image_url)}')`:"background:radial-gradient(500px 300px at 40% 50%,rgba(212,175,55,.35),transparent 70%),#0e0e10"}">${c.image_url?"":'<span class="hx-ph">🏆</span>'}</div>
      ${n>1?'<button type="button" class="hx-arr" data-hx="1" style="right:10px" aria-label="التالي">›</button><button type="button" class="hx-arr" data-hx="-1" style="left:10px" aria-label="السابق">‹</button>':""}
      <div class="hx-c"><span class="hx-tag">🏆 ${n>1?`المسابقة ${V4.si+1} من ${n}`:"المسابقة الحالية"}</span><h2>${esc(c.title)}</h2>${c.body?`<p class="hx-sub">${esc(c.body.length>110?c.body.slice(0,110)+"…":c.body)}</p>`:""}
        <div class="hx-chips"><span>${V4.TY[c.ctype]||V4.TY.manual}</span><span>👥 ${esc(V4.AUD[c.audience]||"")}</span>${c.joined?'<span class="up">✓ أنت مشترك</span>':""}</div>
        <div class="hx-boxes">${c.ends_at?`<div class="hx-box"><small>⏱ الوقت المتبقي على انتهاء التحدي</small>${V4.cd(c.ends_at,1)}</div>`:""}
          ${V4.prizeTop(c)?`<div class="hx-box"><small>🎁 الجائزة الرئيسية</small><b>${esc(V4.prizeTop(c))}</b></div>`:""}<div class="hx-box"><small>عدد المشاركين</small><span class="big num">${c.participants}</span></div></div>
        <div class="hx-act"><button class="btn primary" type="button" data-hxj="${c.id}">${c.joined?"📂 افتح المسابقة":"🚀 انضم للتحدي"}</button><a class="btn" href="#rewards" data-go="rewards" style="text-decoration:none;text-align:center">☰ كل المسابقات</a></div></div>
      ${n>1?`<div class="hx-dots">${V4.slides.map((_,i)=>`<i class="${i===V4.si?"on":""}"></i>`).join("")}</div>`:""}</section>`;
    V4.tick();el.onclick=e=>{const a=e.target.closest("[data-hx]");if(a){V4.si=(V4.si+ +a.dataset.hx+n)%n;V4.slide();return}
      const j=e.target.closest("[data-hxj]");if(j){V4.api().adMark(+j.dataset.hxj,"click").catch(()=>{});location.hash="comp/"+j.dataset.hxj}}},
  // ================= النافذة بعد التسجيل/الدخول =================
  async popup(){if(V4._pop||!ME.user||ME.locked&&false)return;V4._pop=1;if(/^#(comp|gw)\//.test(location.hash))return;let a=null;try{a=await V4.api().adNext()}catch(e){return}if(!a)return;
    const pz=V4.prizeTop(a),ov=document.createElement("div");ov.className="pm-ov";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","false");
    ov.innerHTML=`<div class="pm-box"><button type="button" class="pm-x" aria-label="إغلاق" data-pmx>✕</button>${a.image?`<img src="${escA(a.image)}" alt="">`:'<div class="pm-ph">🏆</div>'}<div class="pm-b">
      <span class="chip gold" style="justify-self:center">${V4.TY[a.ctype]||V4.TY.manual}</span><h3 style="text-align:center;margin:0">${esc(a.title)}</h3>
      ${pz?`<p class="label" style="margin:0;text-align:center;font-size:13.5px">🎁 الجائزة الأولى: ${esc(pz)}${a.winners>1?` · 🏅 ${a.winners} فائزين`:""}</p>`:""}${V4.cd(a.ends_at)}
      <div class="pm-meta"><span class="chip">👥 ${a.participants} مشارك لحد هسه</span><span class="chip up">✅ أنت مؤهل</span></div>
      <div class="pm-act"><button class="btn primary" type="button" data-pmj>🏆 شارك الآن</button><button class="btn" type="button" data-pmx>لاحقاً</button></div>
      <p class="v3-note" style="text-align:center;margin:0">تكدر توصلها بعدين من الصفحة الرئيسية. هذا الإعلان ما يرجع يطلعلك بعد ما تسكره.</p></div></div>`;
    document.body.appendChild(ov);V4.tick();const close=act=>{V4.api().adMark(a.id,act).catch(()=>{});ov.remove();document.removeEventListener("keydown",esc_)};const esc_=e=>{if(e.key==="Escape")close("close")};
    document.addEventListener("keydown",esc_);ov.onclick=e=>{if(e.target===ov||e.target.closest("[data-pmx]"))close("close");if(e.target.closest("[data-pmj]")){close("click");location.hash="comp/"+a.id}}},
  // ================= مركز المسابقات والجوائز (صفحة المكافآت) =================
  async hub(sub){const el=$("v4Hub");if(!el)return;if(sub)V4.tab={badges:"points",prizes:"prizes",invite:"invite",comps:"comps",mine:"mine",rank:"rank",events:"events",gw:"gw",points:"points"}[sub]||V4.tab;
    let P=null;try{P=await V4.api().points()}catch(e){el.innerHTML=`<div class="panel"><p class="down" style="margin:0">${esc(V4.err(e))} (شغّل vexora_v4.sql)</p></div>`;return}
    V4.P=P;const lv=V4.LV[P.level]||V4.LV.bronze,nx=P.level==="bronze"?["silver",P.silver]:P.level==="silver"?["gold",P.gold]:P.level==="gold"?["diamond",P.diamond]:null,
      lo=P.level==="silver"?P.silver:P.level==="gold"?P.gold:P.level==="diamond"?P.diamond:0,pc=nx?Math.min(100,Math.round((P.earned-lo)/(nx[1]-lo)*100)):100;
    el.innerHTML=`<div class="panel"><div class="k-lv"><div class="k-badge">${lv[0]}</div><div><h2>مستواك: ${lv[1]}</h2><p>${nx?`باقيلك <b class="gold">${(nx[1]-P.earned).toLocaleString("en-US")} نقطة</b> حتى توصل للمستوى ${V4.LV[nx[0]][1]} ${V4.LV[nx[0]][0]}`:"وصلت أعلى مستوى 💎"} · ترتيبك هذا الأسبوع <b class="gold">#${P.week_rank}</b> من ${P.week_total}</p>
      <div class="v2-pbar"><i style="width:${pc}%"></i></div><div class="k-meta" style="margin-top:6px"><span>🥉 برونزي 0</span><span>🥈 فضي ${P.silver}</span><span>🥇 ذهبي ${P.gold.toLocaleString("en-US")}</span><span>💎 ماسي ${P.diamond.toLocaleString("en-US")}</span></div></div>
      <div style="text-align:center"><div class="k-pts num">${P.balance.toLocaleString("en-US")}</div><small class="label">نقطة VEXORA</small><br><span class="chip gold" style="margin-top:6px;display:inline-block">ما إلها قيمة نقدية</span></div></div></div>
      <div class="panel"><div class="k-tabs" id="v4Tabs">${[["comps","🏆 المسابقات المتاحة"],["mine","📌 مسابقاتي"],["rank","📊 ترتيبي"],["prizes","🎁 الجوائز"],["gw","🎉 السحوبات"],["events","🎟 الفعاليات"],["invite","🔗 رابط دعوتي"],["points","🧾 سجل نقاطي"]].map(([k,t])=>`<button type="button" class="${V4.tab===k?"on":""}" data-t="${k}">${t}</button>`).join("")}</div></div>
      <div id="v4Tab"></div>`;
    $("v4Tabs").onclick=e=>{const b=e.target.closest("[data-t]");if(!b)return;V4.tab=b.dataset.t;$("v4Tabs").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));V4.tabRender()};V4.tabRender()},
  async tabRender(){const el=$("v4Tab"),t=V4.tab,A=V4.api();el.innerHTML='<div class="panel"><p class="label" style="margin:0">جاري التحميل…</p></div>';
    try{
    if(t==="comps"||t==="mine"){const[L,M]=await Promise.all([A.comps(),A.myEntries()]),me={};(M||[]).forEach(x=>me[x.comp_id]=x);
      const list=(L||[]).filter(c=>t==="comps"?c.status==="published"&&(!c.ends_at||new Date(c.ends_at)>Date.now()):me[c.id]);
      let lb=[];try{lb=await A.ptsBoard("week")||[]}catch(e){}
      el.innerHTML=`<div class="k-g2"><div class="k-cards">${list.map(c=>V4.card(c,me[c.id])).join("")||`<div class="panel"><p class="label" style="margin:0">${t==="comps"?"ما في مسابقات شغالة هسه. تابع الإشعارات 🔔":"ما اشتركت بأي مسابقة بعد."}</p></div>`}</div>${V4.lbHTML(lb,"📊 المتصدرين بالنقاط هذا الأسبوع")}</div>`;V4.tick()}
    if(t==="rank"){const[w,m]=await Promise.all([A.ptsBoard("week"),A.ptsBoard("month")]);el.innerHTML=`<div class="v3-grid2">${V4.lbHTML(w||[],"📊 ترتيب الأسبوع")}${V4.lbHTML(m||[],"📅 ترتيب الشهر")}</div>`}
    if(t==="prizes"){const[R,C,Wn]=await Promise.all([A.rewards(),A.myClaims(),A.myWins()]),bal=V4.P.balance,ord=["bronze","silver","gold","diamond"],my=ord.indexOf(V4.P.level);
      const winFor=r=>(Wn||[]).find(w=>w.reward_id===r.id&&!(C||[]).some(c=>c.winner_id===w.id&&c.status!=="rejected"));
      el.innerHTML=`<div class="k-g4">${(R||[]).map(r=>{const w=winFor(r),lvOk=ord.indexOf(r.min_level)<=my,out=r.stock!=null&&r.stock<=0;
        const btn=r.cost==null?(w?`<button class="btn primary" type="button" data-cl="${r.id}" data-w="${w.id}">🏆 اطلب جائزة فوزك</button>`:'<button class="btn" type="button" disabled>🏆 تنكسب بالفوز بس</button>')
          :out?'<button class="btn" type="button" disabled>📦 خلص المخزون</button>':!lvOk?`<button class="btn" type="button" disabled>🔒 تحتاج مستوى ${V4.LV[r.min_level][1]}</button>`:bal<r.cost?`<button class="btn" type="button" disabled>💠 تحتاج ${r.cost.toLocaleString("en-US")} نقطة</button>`:`<button class="btn primary" type="button" data-cl="${r.id}">🎁 اطلب الجائزة</button>`;
        return`<div class="panel k-cc${r.kind==="funded"?" k-wide":""}"><div class="k-row" style="justify-content:space-between"><span class="k-ic">${esc(r.icon)}</span>${r.cost==null?'<span class="k-st vip">جائزة الفائزين فقط</span>':""}</div><h4>${esc(r.title)}</h4><p>${esc(r.descr)}</p>
          <div class="k-meta"><span class="gold">${r.cost==null?"🏆 ما ينشرى بالنقاط":"💠 "+r.cost.toLocaleString("en-US")+" نقطة"}</span><span>📦 ${r.stock==null?"متوفر":"باقي "+r.stock}</span></div>${btn}</div>`}).join("")||'<div class="panel"><p class="label" style="margin:0">ما في جوائز بعد.</p></div>'}</div>
        <div class="panel"><h3 style="margin:0 0 10px;font-size:15px">📦 جوائزي</h3><div class="v3-slist">${(C||[]).map(c=>{const s=V4.RST[c.status]||V4.RST.pending,d=c.delivery||{};return`<div class="v3-srow"><b>${esc((c.rewards&&c.rewards.icon)||"🎁")} ${esc(c.rewards&&c.rewards.title||"")}</b><span class="chip ${s[1]}">${s[0]}</span>${d.code?`<span class="num ltr">${esc(d.code)}</span>`:""}${d.note?`<span class="label">${esc(d.note)}</span>`:""}${c.reason?`<span class="label">السبب: ${esc(c.reason)}</span>`:""}<span class="label">${ago(c.created_at)}</span></div>`}).join("")||'<p class="label" style="margin:0">ما طلبت جوائز بعد.</p>'}</div>
          <p class="v3-note">النقاط ما إلها قيمة نقدية وما تتحول لفلوس. الجوائز تحتاج موافقة الإدارة، وإذا انرفض الطلب ترجعلك نقاطك.</p></div>`;
      el.onclick=async e=>{const b=e.target.closest("[data-cl]");if(!b)return;const r=(R||[]).find(x=>x.id==b.dataset.cl);if(!confirm(r.cost==null?`تطلب جائزة فوزك: ${r.title}؟`:`تصرف ${r.cost} نقطة على «${r.title}»؟`))return;
        b.disabled=true;try{await A.claim(+b.dataset.cl,b.dataset.w?+b.dataset.w:null);V4.toast("✅ انرسل طلبك. يوصلك إشعار لمن الإدارة توافق.");V4.hub()}catch(err){V4.toast(V4.err(err),1);b.disabled=false}}}
    if(t==="gw"){const G=await A.gws()||[];el.innerHTML=`<div class="k-cards">${G.map(g=>`<div class="panel k-cc"><div class="k-row" style="justify-content:space-between"><span class="k-ic">🎉</span><span class="k-st ${g.status==="open"&&new Date(g.reg_to)>Date.now()?"live":"end"}">${g.status==="drawn"?"انسحب":new Date(g.reg_to)>Date.now()?"التسجيل مفتوح":"بانتظار السحب"}</span></div><h4>${esc(g.title)}</h4><p>🎁 ${esc(g.prize)}</p><div class="k-meta"><span>⏳ يقفل ${new Date(g.reg_to).toLocaleString(window.LANG||"ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span></div><a class="btn ${g.status==="open"?"primary":""}" href="#gw/${g.id}" style="text-align:center;text-decoration:none">${g.status==="drawn"?"🔐 النتيجة والتحقق":"🎟 التفاصيل والتسجيل"}</a></div>`).join("")||'<div class="panel"><p class="label" style="margin:0">ما في سحوبات حالياً.</p></div>'}</div>`}
    if(t==="events"){let S=[],seats=[];try{[S,seats]=await Promise.all([A.sessions(),A.seats()])}catch(e){}const sm={};(seats||[]).forEach(x=>sm[x.session_id]=x);
      el.innerHTML=`<div class="panel"><h3 style="margin:0 0 10px;font-size:15px">🎟 الفعاليات القادمة</h3><div class="v3-slist">${(S||[]).map(s=>{const x=sm[s.id]||{},cap=s.capacity,pc=cap?Math.min(100,Math.round((x.going||0)/cap*100)):0;
        return`<div class="v3-srow" style="display:grid;gap:6px"><div class="k-row" style="justify-content:space-between"><b>${({zoom:"🎥",workshop:"🛠",qa:"❓",challenge:"👥",live_comp:"🏆"})[s.kind]||"🎥"} ${esc(s.title)}</b>${x.my_status==="going"?'<span class="chip up">✓ مسجّل</span>':x.my_status==="waitlist"?'<span class="chip gold">قائمة الانتظار</span>':""}</div>
          <span class="label">${new Date(s.starts_at).toLocaleString(window.LANG||"ar",{weekday:"long",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})} · ${s.minutes} دقيقة${s.cert?" · شهادة مشاركة":""}</span>
          ${cap?`<div class="k-seat"><i style="width:${pc}%"></i></div><span class="label">${x.going||0} من ${cap} مقعد${x.waitlist?` · ${x.waitlist} بالانتظار`:""}</span>`:""}</div>`}).join("")||'<p class="label" style="margin:0">ما في فعاليات قادمة.</p>'}</div>
        <a class="btn" href="index.html#live" style="margin-top:10px;display:inline-block;text-decoration:none">🎥 التسجيل بالفعاليات من صفحة دروس الزوم</a><p class="v3-note">إذا المقاعد امتلأت تنضاف لقائمة الانتظار، وإذا أحد انسحب ينفتحلك مقعد ويوصلك إشعار.</p></div>`}
    if(t==="invite"){const R=await A.refStats()||{},L=refLink(R.code||myCode());el.innerHTML=`<div class="panel"><h3 style="margin:0 0 10px;font-size:15px">🔗 رابط دعوتي</h3><div class="rw-link"><input class="ltr" readonly value="${escA(L)}" id="v4L"><button class="btn primary" type="button" id="v4Copy">📋 نسخ</button></div><div class="rw-share" style="margin-top:8px">${shareBtns(shareMsg(L),L)}</div>
      <div class="v3-sum" style="margin-top:12px"><div class="v2-t"><span>سجّلوا من رابطك</span><b class="num">${R.total||0}</b></div><div class="v2-t"><span>إحالات مؤهلة</span><b class="num up">${R.qualified||0}</b><small>فعّل حسابه + خلّص درس</small></div><div class="v2-t"><span>قيد التحقق</span><b class="num gold">${R.pending||0}</b></div><div class="v2-t"><span>غير مؤهلة</span><b class="num down">${R.invalid||0}</b><small>حساب مكرر</small></div></div>
      <p class="v3-note">على كل إحالة مؤهلة تاخذ نقاط تعليمية، وما إلها علاقة بأي إيداع أو حجم تداول. الإحالة الذاتية والحسابات المكررة ما تنحسب.</p></div>`;$("v4Copy").onclick=e=>copyTxt(L,e.target)}
    if(t==="points"){const L=await A.ledger()||[],B=V4.P.badges||[];el.innerHTML=`<div class="k-g2"><div class="panel"><h3 style="margin:0 0 8px;font-size:15px">🧾 سجل نقاطي</h3><div class="k-led">${L.map(x=>`<div><span>${esc(x.note||x.reason)}</span><span class="label">${ago(x.created_at)}</span><b class="num ${x.delta>0?"up":"down"}">${x.delta>0?"+":""}${x.delta}</b></div>`).join("")||'<p class="label">ما عندك نقاط بعد. ابدي بدرس 📚</p>'}</div><p class="v3-note">كل حركة تنسجل بالسيرفر مع سببها، ونفس المكافأة ما تنحسب مرتين.</p></div>
      <div class="panel"><h3 style="margin:0 0 10px;font-size:15px">🏅 شاراتي</h3><div class="k-bdg">${B.map(b=>`<span class="${b.has?"":"off"}" title="${escA(b.descr)}"><em>${esc(b.icon)}</em>${esc(b.name)}</span>`).join("")}</div>
        <h4 class="v3-h4">شلون أجمع نقاط؟</h4><div class="v3-slist" id="v4Rules"></div></div></div>`;
      try{const R=await A.rules()||[];$("v4Rules").innerHTML=R.filter(r=>r.active&&r.points>0).map(r=>`<div class="v3-srow"><span>${esc(r.label)}</span><b class="num gold">+${r.points}</b></div>`).join("")}catch(e){}}
    }catch(e){el.innerHTML=`<div class="panel"><p class="down" style="margin:0">${esc(V4.err(e))}</p></div>`}},
  card(c,me){const end=c.ends_at&&new Date(c.ends_at),live=c.status==="published"&&(!end||end>Date.now())&&(!c.starts_at||new Date(c.starts_at)<=Date.now()),soon=c.starts_at&&new Date(c.starts_at)>Date.now();
    const st=me?V4.ST[me.status]||V4.ST.joined:null;
    return`<div class="panel k-cc"><div class="k-row" style="justify-content:space-between"><span class="k-ic">${(V4.TY[c.ctype]||V4.TY.manual).split(" ")[0]}</span><span class="k-st ${c.audience==="vip"?"vip":soon?"soon":live?"live":"end"}">${c.audience==="vip"?"VIP":soon?"قريباً":live?"● شغالة":"انتهت"}</span></div>
      <h4>${esc(c.title)}</h4>${c.body?`<p>${esc(c.body.length>140?c.body.slice(0,140)+"…":c.body)}</p>`:""}
      <div class="k-meta"><span>${V4.TY[c.ctype]||""}</span>${end?`<span>⏳ ${live?"تنتهي":"انتهت"} ${end.toLocaleDateString(window.LANG||"ar",{day:"numeric",month:"short"})}</span>`:""}<span>🏅 ${c.winners} فائز</span></div>
      ${V4.prizeTop(c)?`<div class="k-prize">🎁 ${esc(V4.prizeTop(c))}</div>`:""}${st?`<span class="${st[1]}" style="justify-self:start">${st[0]}</span>`:""}
      <a class="btn ${me?"":"primary"}" href="#comp/${c.id}" style="text-align:center;text-decoration:none">${me?"📂 افتح مشاركتي":"🏆 التفاصيل والاشتراك"}</a></div>`},
  lbHTML(L,t){return`<div class="panel"><h3 style="margin:0 0 10px;font-size:15px">${t}</h3><div class="k-lb">${L.map(x=>`<div class="${x.is_me?"me":""}"><b class="n">${["🥇","🥈","🥉"][x.pos-1]||x.pos}</b><i>${esc((x.name||"؟")[0])}</i><span>${x.is_me?"أنت":esc(x.name)}</span><b class="num ${x.is_me?"gold":""}">${(+x.pts||+x.score||0).toLocaleString("en-US")}</b></div>`).join("")||'<p class="label" style="margin:0">ما أكو ترتيب بعد.</p>'}</div><p class="v3-note">الأسماء مختصرة لحماية الخصوصية. النقاط تنحسب بالسيرفر وما تتعدّل من المتصفح.</p></div>`},
  // ================= صفحة المسابقة =================
  async compPage(id){const el=$("v4CompBody"),A=V4.api();el.innerHTML='<div class="panel"><p class="label" style="margin:0">جاري التحميل…</p></div>';
    let c,me,board=[],wins=[],np=null;try{[c,me]=await Promise.all([A.comp(+id),A.myEntry(+id)]);if(!c)throw new Error("المسابقة مو موجودة");[board,wins,np]=await Promise.all([A.board(+id).catch(()=>[]),A.winners(+id).catch(()=>[]),A.count(+id).catch(()=>null)])}
    catch(e){el.innerHTML=`<div class="panel"><p class="down" style="margin:0">${esc(V4.err(e))}</p><a class="btn" href="#rewards" style="margin-top:10px;display:inline-block;text-decoration:none">رجوع للمسابقات</a></div>`;return}
    V4.cur=c;const end=c.ends_at&&new Date(c.ends_at),open=c.status==="published"&&(!end||end>Date.now())&&(!c.starts_at||new Date(c.starts_at)<=Date.now()),pz=c.prizes||[];
    el.innerHTML=`<section class="hx hx-sm"><div class="hx-bg" style="${c.image_url?`background-image:url('${escA(c.image_url)}')`:"background:radial-gradient(500px 300px at 40% 50%,rgba(212,175,55,.35),transparent 70%),#0e0e10"}">${c.image_url?"":'<span class="hx-ph">🏆</span>'}</div>
      <div class="hx-c"><span class="hx-tag">${V4.TY[c.ctype]||V4.TY.manual}</span><h2>${esc(c.title)}</h2>${c.body?`<p class="hx-sub" style="font-size:15px;line-height:1.8">${esc(c.body)}</p>`:""}
      <div class="hx-chips"><span>👥 ${esc(V4.AUD[c.audience])}</span><span>🏅 ${c.winners} فائز</span>${c.max_entries?`<span>🎫 حد أقصى ${c.max_entries}</span>`:""}<span>${c.status==="closed"?"🏁 انتهت والنتائج معتمدة":open?"● شغالة":end&&end<Date.now()?"⏳ انتهت، بانتظار النتائج":"قريباً"}</span></div>
      <div class="hx-boxes">${end&&open?`<div class="hx-box"><small>⏱ الوقت المتبقي</small>${V4.cd(c.ends_at,1)}</div>`:""}${V4.prizeTop(c)?`<div class="hx-box"><small>🎁 الجائزة الرئيسية</small><b>${esc(V4.prizeTop(c))}</b></div>`:""}<div class="hx-box"><small>المشاركين</small><span class="big num">${np??"—"}</span></div></div>
      <div class="hx-act" id="v4Join"></div></div></section>
      <div class="v3-grid2"><section class="panel" id="v4Play"></section><section class="panel"><h3 style="margin:0 0 10px;font-size:15px">📜 الشروط والجوائز</h3>
        ${pz.length?`<div class="v3-slist">${pz.map(p=>`<div class="v3-srow"><b>${["🥇","🥈","🥉"][p.rank-1]||"🏅"} المركز ${p.rank}</b><span>${esc(p.text||"")}</span>${p.points?`<span class="num gold">+${p.points} نقطة</span>`:""}</div>`).join("")}</div>`:c.prize?`<p>🎁 ${esc(c.prize)}</p>`:""}
        ${c.rules?`<div style="white-space:pre-wrap;font-size:13.5px;line-height:1.9;color:#d6d6dc;margin-top:10px">${esc(c.rules)}</div>`:""}
        <p class="v3-note">مسابقة تعليمية مجانية. ما تحتاج أي إيداع أو تداول بفلوس حقيقية. النتائج تنحسب بالسيرفر وتنعتمد بعد مراجعة الإدارة.</p></section></div>
      ${wins.length?`<section class="panel"><h3 style="margin:0 0 10px;font-size:15px">🏆 الفائزين المعتمدين</h3><div class="k-lb">${wins.map(w=>`<div class="${w.is_me?"me":""}"><b class="n">${["🥇","🥈","🥉"][w.rank-1]||w.rank}</b><i>${esc((w.name||"؟")[0])}</i><span>${w.is_me?"أنت 🎉":esc(w.name)}</span><span class="gold">${esc(w.prize)}</span></div>`).join("")}</div></section>`:""}
      <section class="panel"><h3 style="margin:0 0 10px;font-size:15px">📊 لوحة المتصدرين</h3><div class="k-lb">${board.map(x=>`<div class="${x.is_me?"me":""}"><b class="n">${["🥇","🥈","🥉"][x.pos-1]||x.pos}</b><i>${esc((x.name||"؟")[0])}</i><span>${x.is_me?"أنت":esc(x.name)}${x.flag?` <small class="label">⚠ ${esc(x.flag)}</small>`:""}</span><b class="num">${x.score==null?"—":x.score}</b></div>`).join("")||'<p class="label" style="margin:0">ما أكو نتائج بعد.</p>'}</div>
        <p class="v3-note">${({paper:"الترتيب = العائد ÷ أقصى تراجع (العائد المعدّل بالمخاطرة).",prediction:"الترتيب = عدد التوقعات الصحيحة.",lessons:"الترتيب = عدد الدروس اللي خلّصتها بالنسبة المطلوبة خلال المسابقة.",referral:"الترتيب = عدد الدعوات المؤهلة من رابطك خلال المسابقة. التعادل: الأسبق يتقدّم.",quiz:"الترتيب = نسبة الإجابات الصحيحة.",smc:"الترتيب = نسبة الإجابات الصحيحة.",team:"ترتيب المجموعات = مجموع نقاط أعضائها."})[c.ctype]||"الترتيب حسب تقييم لجنة الكوتش للمشاركات المقبولة."}</p></section>`;
    V4.tick();V4.joinBox(c,me,open);V4.play(c,me,open)},
  joinBox(c,me,open){const el=$("v4Join");if(me){el.innerHTML=`<span class="${(V4.ST[me.status]||V4.ST.joined)[1]}" style="padding:10px 14px">${(V4.ST[me.status]||V4.ST.joined)[0]}${me.team?` · فريق ${esc(me.team)}`:""}</span><button class="btn" type="button" id="v4Share">🔗 شارك المسابقة</button>`}
    else if(open){const teams=(c.cfg&&c.cfg.teams)||[];el.innerHTML=`${c.ctype==="team"?`<select id="v4Team" class="f" style="max-width:200px">${teams.map(t=>`<option>${esc(t)}</option>`).join("")}</select>`:""}<button class="btn primary" type="button" id="v4J">🚀 انضم للتحدي</button><button class="btn" type="button" id="v4Share">🔗 شارك المسابقة</button>`;
      $("v4J").onclick=async()=>{$("v4J").disabled=true;try{let src="";try{src=localStorage.getItem("vx_c")||""}catch(e){}await V4.api().join(c.id,src,$("v4Team")?$("v4Team").value:"");V4.toast("✅ اشتركت بالمسابقة");V4.compPage(c.id)}catch(e){V4.toast(V4.err(e),1);$("v4J").disabled=false}}}
    else el.innerHTML=`<button class="btn" type="button" id="v4Share">🔗 شارك المسابقة</button>`;
    $("v4Share").onclick=()=>{const u=location.origin+location.pathname+"#comp/"+c.id,m=`🏆 ${c.title}\n${V4.prizeTop(c)?"🎁 "+V4.prizeTop(c)+"\n":""}شارك مجاناً بأكاديمية فيكسورا:\n${u}`;
      const ov=document.createElement("div");ov.className="pm-ov";ov.innerHTML=`<div class="pm-box" style="width:min(460px,100%)"><button type="button" class="pm-x" data-x>✕</button><div class="pm-b" style="padding-top:20px"><h3 style="margin:0">🔗 شارك المسابقة</h3><div class="k-hash">${esc(u)}</div><div class="rw-share">${shareBtns(m,u)}</div><button class="btn" type="button" data-cp>📋 نسخ الرسالة</button></div></div>`;
      document.body.appendChild(ov);ov.onclick=e=>{if(e.target===ov||e.target.closest("[data-x]"))ov.remove();if(e.target.closest("[data-cp]"))copyTxt(m,e.target)}}},
  async play(c,me,open){const el=$("v4Play"),A=V4.api();
    if(!me){el.innerHTML=`<h3 style="margin:0 0 8px;font-size:15px">🎯 شلون تشارك؟</h3><p class="label" style="margin:0;line-height:1.9">${({paper:"تاخذ حساب ورقي برصيد افتراضي، وتداول عليه بسعر السيرفر. بدون فلوس حقيقية.",prediction:"كل يوم تتوقع إغلاق الذهب أعلى لو أوطأ من الافتتاح. النتيجة من سعر إغلاق السيرفر.",quiz:"تجاوب على أسئلة، والتصحيح تلقائي بالسيرفر.",smc:"تجاوب على أسئلة Smart Money، والتصحيح تلقائي.",lessons:"تخلّص الدروس وتجتاز اختباراتها خلال فترة المسابقة.",referral:"تاخذ رابطك الخاص من هنا وتنشره. كل شخص يسجّل منه ويتفعّل ويخلّص أول درس ينحسبلك.",team:"تختار فريقك، ونقاطك تنضاف لمجموع الفريق."})[c.ctype]||"ترسل تحليلك (نص وصورة اختيارية)، ولجنة الكوتش تقيّمه."}</p>${open?"":'<p class="label">المسابقة مو مفتوحة للاشتراك هسه.</p>'}`;return}
    if(c.ctype==="paper")return V4.paper(c,me,open);
    if(c.ctype==="prediction"){let P=[];try{P=await A.myPreds(c.id)||[]}catch(e){}const today=new Date().toISOString().slice(0,10),done=P.some(p=>p.day===today),ok=P.filter(p=>p.correct).length,res=P.filter(p=>p.correct!=null).length;
      el.innerHTML=`<h3 style="margin:0 0 10px;font-size:15px">🎯 توقّعك لليوم</h3><p class="label" style="margin:0 0 10px;font-size:13px">إغلاق اليوم (D1) لـ <b class="ltr">${esc((c.cfg&&c.cfg.sym)||"XAU/USD")}</b> راح يكون أعلى لو أوطأ من افتتاح اليوم؟ يقفل الساعة ${(c.cfg&&c.cfg.lock_hour)||20}:00 UTC.</p>
        ${done?`<div class="v3-warn ok">✅ سجّلت توقّعك لليوم. النتيجة تطلع بعد إغلاق الشمعة.</div>`:open?`<div class="v3-act" style="margin:0"><button class="btn" type="button" data-pd="1" style="flex:1;border-color:var(--buy);color:var(--buy)">▲ أعلى</button><button class="btn" type="button" data-pd="-1" style="flex:1;border-color:var(--sell);color:var(--sell)">▼ أوطأ</button></div>`:""}
        <div class="v3-sum" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:12px"><div class="v2-t"><span>توقعات صحيحة</span><b class="num up">${ok}</b></div><div class="v2-t"><span>دقّتك</span><b class="num">${res?Math.round(ok/res*100)+"%":"—"}</b></div></div>
        <div class="v3-tl" style="margin-top:10px">${P.map(p=>`<div><span>${esc(p.day)}</span><span>${p.dir>0?"▲ أعلى":"▼ أوطأ"} · افتتاح <bdi dir="ltr">${p.open_px}</bdi>${p.close_px!=null?` ← إغلاق <bdi dir="ltr">${p.close_px}</bdi>`:""}</span><b class="${p.correct==null?"":p.correct?"up":"down"}">${p.correct==null?"⏳":p.correct?"✓":"✕"}</b></div>`).join("")}</div>
        <p class="v3-note">توقّع واحد لكل يوم، وما يتعدّل بعد الإرسال.</p>`;
      el.onclick=async e=>{const b=e.target.closest("[data-pd]");if(!b)return;b.disabled=true;try{await A.pred(c.id,+b.dataset.pd);V4.toast("✅ انسجل توقّعك");V4.compPage(c.id)}catch(err){V4.toast(V4.err(err),1);b.disabled=false}};return}
    if(c.ctype==="referral"){let R={};try{R=await A.refStats()||{}}catch(e){}const L=refLink(R.code||myCode()),my=((await A.board(c.id).catch(()=>[]))||[]).find(x=>x.is_me)||{},msg=shareMsg(L);
      el.innerHTML=`<h3 style="margin:0 0 10px;font-size:15px">🔗 رابطك الخاص بالمسابقة</h3><div class="rw-link"><input class="ltr" readonly value="${escA(L)}" id="v4RL"><button class="btn primary" type="button" id="v4RC">📋 نسخ</button></div>
        <div class="rw-share" style="margin-top:8px">${shareBtns(msg,L)}</div><button class="btn v2s" type="button" id="v4RM" style="margin-top:8px">📋 نسخ رسالة الدعوة الجاهزة</button>
        <div class="v3-sum" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:12px"><div class="v2-t"><span>دعوات مؤهلة بالمسابقة</span><b class="num up">${my.score!=null?Math.round(my.score):0}</b></div><div class="v2-t"><span>ترتيبك</span><b class="num gold">${my.pos?"#"+my.pos:"—"}</b></div><div class="v2-t"><span>قيد التحقق</span><b class="num">${R.pending||0}</b><small>بانتظار التفعيل أو أول درس</small></div></div>
        <p class="v3-note">الدعوة تنحسب لمن الشخص يسجّل من رابطك، ويتفعّل حسابه، ويخلّص أول درس خلال فترة المسابقة. الحسابات المكررة والدعوة الذاتية ما تنحسب.</p>`;
      $("v4RC").onclick=e=>copyTxt(L,e.target);$("v4RM").onclick=e=>copyTxt(msg,e.target);return}
    if(c.ctype==="lessons"){el.innerHTML=`<h3 style="margin:0 0 10px;font-size:15px">📚 تقدّمك بالماراثون</h3><p class="label" style="margin:0 0 10px">كل درس تخلّصه وتجتاز اختباره بـ ${(c.cfg&&c.cfg.min_score)||80}% أو أكثر خلال المسابقة ينحسبلك.</p><a class="btn primary" href="index.html#courses" style="text-decoration:none;display:inline-block">📚 كمّل الدروس</a>`;return}
    const Q=(c.cfg&&c.cfg.questions)||[];
    if((c.ctype==="quiz"||c.ctype==="smc")&&Q.length){if(me.status==="accepted"){const m=me.meta||{};el.innerHTML=`<h3 style="margin:0 0 10px;font-size:15px">✅ خلّصت الأسئلة</h3><div class="v3-sum" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="v2-t"><span>نتيجتك</span><b class="num gold">${me.score}%</b></div><div class="v2-t"><span>إجابات صحيحة</span><b class="num">${m.correct??"—"} / ${m.total??Q.length}</b></div></div>`;return}
      el.innerHTML=`<h3 style="margin:0 0 10px;font-size:15px">❓ الأسئلة (${Q.length})</h3>${Q.map((q,i)=>`<div class="v4-q"><b>${i+1}. ${esc(q.q)}</b>${(q.o||[]).map((o,j)=>`<label><input type="radio" name="v4q${i}" value="${j}"> ${esc(o)}</label>`).join("")}</div>`).join("")}
        ${open?'<button class="btn primary" type="button" id="v4QS" style="width:100%;margin-top:10px">📨 أرسل الإجابات</button>':""}<p class="v3-note">إرسال واحد بس، والتصحيح بالسيرفر (الأجوبة الصحيحة ما توصل للمتصفح).</p>`;
      const s=$("v4QS");if(s)s.onclick=async()=>{const a=Q.map((_,i)=>{const r=el.querySelector(`input[name="v4q${i}"]:checked`);return r?+r.value:-1});if(a.includes(-1)&&!confirm("أكو أسئلة ما جاوبتها. ترسل هيچ؟"))return;
        s.disabled=true;try{await A.submit(c.id,JSON.stringify(a),"");V4.toast("✅ انرسلت الإجابات");V4.compPage(c.id)}catch(e){V4.toast(V4.err(e),1);s.disabled=false}};return}
    if(c.entry_kind==="none"){el.innerHTML=`<h3 style="margin:0 0 10px;font-size:15px">✅ أنت مشترك</h3><p class="label" style="margin:0">ترتيبك يتحدّث تلقائياً.</p>`;return}
    const locked=!open||["accepted","rejected","disqualified"].includes(me.status),st=V4.ST[me.status]||V4.ST.joined;
    el.innerHTML=`<h3 style="margin:0 0 10px;font-size:15px">✍️ مشاركتي</h3>
      ${me.status==="accepted"?`<div class="v3-warn ok">✅ <b>انقبلت</b>${me.score!=null?` · التقييم ${me.score}/100`:""}${me.reason?` · ${esc(me.reason)}`:""}</div>`:me.status==="rejected"?`<div class="v3-warn red">⛔ <b>انرفضت</b> · السبب: ${esc(me.reason)}</div>`:me.status==="pending"?'<div class="v3-warn">⏳ <b>قيد المراجعة</b>. تكدر تعدّلها لحد ما الإدارة تراجعها أو يخلص الوقت.</div>':""}
      <label class="v4-lb">تحليلك (السيناريو، الدخول، الوقف، الأهداف)<textarea id="v4Ans" maxlength="4000" ${locked?"disabled":""} placeholder="اكتب تحليلك هنا…">${esc(me.answer||"")}</textarea></label>
      ${c.entry_kind==="text_image"?`<div class="v4-up"><label class="btn v2s" ${locked?'style="opacity:.5;pointer-events:none"':""}>🖼 ${me.image_path?"بدّل الصورة":"ارفع صورة الشارت"}<input type="file" id="v4Img" accept="image/jpeg,image/png,image/webp" hidden></label><span class="label" id="v4ImgN">${me.image_path?"✓ في صورة مرفوعة":"JPG / PNG / WebP · أقصى حجم 5MB"}</span></div>`:""}
      ${locked?"":'<button class="btn primary" type="button" id="v4Send" style="width:100%;margin-top:10px">📨 أرسل مشاركتي</button>'}
      <p class="v3-note">الصور تنحفظ بمكان محمي، يشوفها بس أنت والإدارة. ${end_(c)}</p>`;
    function end_(c){return c.ends_at?"آخر موعد للتعديل: "+new Date(c.ends_at).toLocaleString(window.LANG||"ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+".":""}
    let img=me.image_path||"";const f=$("v4Img");if(f)f.onchange=async()=>{const x=f.files[0];if(!x)return;if(!/^image\/(jpeg|png|webp)$/.test(x.type))return V4.toast("نوع الملف لازم JPG أو PNG أو WebP",1);if(x.size>5*1048576)return V4.toast("الصورة أكبر من 5MB",1);
      $("v4ImgN").textContent="جاري الرفع…";try{img=await A.uploadEntry(c.id,x);$("v4ImgN").textContent="✓ انرفعت الصورة"}catch(e){$("v4ImgN").textContent="";V4.toast(V4.err(e),1)}};
    const s=$("v4Send");if(s)s.onclick=async()=>{s.disabled=true;try{await A.submit(c.id,$("v4Ans").value,img);V4.toast("✅ انرسلت مشاركتك");V4.compPage(c.id)}catch(e){V4.toast(V4.err(e),1);s.disabled=false}}},
  async paper(c,me,open){const el=$("v4Play"),A=V4.api();let P=null;try{P=await A.paper(c.id)}catch(e){el.innerHTML=`<p class="down">${esc(V4.err(e))}</p>`;return}if(!P)return;
    const dec=s=>(SYMS.find(x=>x.s===s)||{dec:2}).dec,opn=P.trades.filter(t=>t.status==="open"),cls=P.trades.filter(t=>t.status==="closed"),px=s=>P.prices&&P.prices[s]&&+P.prices[s].px,val=(s,p)=>s==="XAU/USD"?100:s==="XAG/USD"?5000:/\/USD$/.test(s)?100000:/^USD\//.test(s)?100000/p:0;
    el.innerHTML=`<h3 style="margin:0 0 10px;font-size:15px">📈 حسابي الورقي</h3>${P.status==="disqualified"?`<div class="v3-warn red">⛔ <b>غير مؤهل:</b> ${esc(P.reason)}</div>`:""}
      <div class="v3-sum"><div class="v2-t"><span>الرصيد الحالي</span><b class="num">$${(+P.equity).toLocaleString("en-US",{maximumFractionDigits:2})}</b><small class="${P.ret>=0?"up":"down"}"><bdi dir="ltr">${P.ret>0?"+":""}${P.ret}%</bdi></small></div>
        <div class="v2-t"><span>أقصى تراجع</span><b class="num ${P.maxdd>=P.max_dd*.8?"down":"gold"}">${P.maxdd}%</b><small>الحد ${P.max_dd}%</small></div><div class="v2-t"><span>الترتيب</span><b class="num up">${P.rank?"#"+P.rank:"—"}</b><small>النتيجة ${P.score??"—"}</small></div>
        <div class="v2-t"><span>الصفقات المسكّرة</span><b class="num">${P.closed}</b><small>الحد الأدنى ${P.min_trades} ${P.closed>=P.min_trades?"✓":""}</small></div></div>
      ${open&&P.status!=="disqualified"?`<h4 class="v3-h4">＋ صفقة جديدة</h4><div class="v3-fm"><label>الزوج<select id="ppS">${P.syms.map(s=>`<option value="${esc(s)}">${esc(s)}${px(s)?" · "+fx(px(s),dec(s)):""}</option>`).join("")}</select></label><label>الاتجاه<select id="ppD"><option value="1">▲ شراء</option><option value="-1">▼ بيع</option></select></label>
        <label>اللوت<input id="ppL" type="number" min="0.01" step="0.01" value="0.10" class="ltr"></label><label>الوقف (إلزامي)<input id="ppSl" type="number" step="any" class="ltr"></label><label>الهدف<input id="ppTp" type="number" step="any" class="ltr"></label></div>
        <div id="ppPrev" class="v3-prev"></div><div class="v3-act"><button class="btn primary" type="button" id="ppGo">افتح الصفقة بسعر السيرفر</button></div>`:""}
      <h4 class="v3-h4">📂 الصفقات المفتوحة</h4><div class="v3-slist">${opn.map(t=>{const p=px(t.sym),pl=p?(p-t.entry)*t.dir*t.lots*val(t.sym,p):null;return`<div class="v3-srow"><b class="${t.dir>0?"up":"down"}">${t.dir>0?"▲":"▼"} <bdi dir="ltr">${esc(t.sym)}</bdi></b><span class="num">${fx(+t.entry,dec(t.sym))} · SL ${fx(+t.sl,dec(t.sym))}${t.tp?" · TP "+fx(+t.tp,dec(t.sym)):""} · ${(+t.lots).toFixed(2)}</span>${pl!=null?`<b class="num ${pl>=0?"up":"down"}">${pl>=0?"+":"−"}$${Math.abs(pl).toFixed(2)}</b>`:""}${open?`<button class="btn v2s" type="button" data-pc="${t.id}">سكّر</button>`:""}</div>`}).join("")||'<p class="label" style="margin:0">ما عندك صفقات مفتوحة.</p>'}</div>
      ${cls.length?`<h4 class="v3-h4">🧾 آخر الصفقات المسكّرة</h4><div class="v3-tl">${cls.slice(0,8).map(t=>`<div><span>${esc(t.why)}</span><span><bdi dir="ltr">${esc(t.sym)} ${fx(+t.entry,dec(t.sym))} → ${fx(+t.exit_px,dec(t.sym))}</bdi></span><b class="num ${t.pnl>=0?"up":"down"}">${t.pnl>=0?"+":"−"}$${Math.abs(t.pnl).toFixed(2)}</b></div>`).join("")}</div>`:""}
      <p class="v3-note">ما تكدر تكتب سعر الدخول بيدك ولا تفتح صفقة بوقت سابق. السيرفر يسجّل الصفقة بسعره ووقته، ويفحص الوقف والهدف كل 5 دقائق من شموع M15 (إذا انضربوا بنفس الشمعة تنحسب وقف). أقصى مخاطرة بالصفقة ${P.max_risk}%.</p>`;
    const prev=()=>{const s=$("ppS").value,d=+$("ppD").value,l=+$("ppL").value,sl=+$("ppSl").value,p=px(s),pv=$("ppPrev");if(!p||!sl||!l){pv.innerHTML=p?"":'<div class="v3-warn">⚠️ سعر هذا الزوج مو متوفر بالسيرفر هسه.</div>';return}
      const r=Math.abs(p-sl)*l*val(s,p),pc=r/P.equity*100,bad=(d>0?sl>=p:sl<=p);pv.innerHTML=`<div class="v2-t"><span>مخاطرة الصفقة (تقريبية بآخر سعر ${fx(p,dec(s))})</span><b class="num ${pc>P.max_risk||bad?"down":"up"}">$${r.toFixed(2)} · ${pc.toFixed(2)}%</b><small>${bad?"⛔ الوقف بالجهة الغلط":pc>P.max_risk?"⛔ أكثر من الحد "+P.max_risk+"%":"ضمن الحد "+P.max_risk+"%"}</small></div>`};
    if($("ppGo")){["ppS","ppD","ppL","ppSl"].forEach(i=>$(i).addEventListener("input",prev));$("ppS").addEventListener("change",prev);
      $("ppGo").onclick=async()=>{const b=$("ppGo");b.disabled=true;try{await A.paperOpen(c.id,$("ppS").value,+$("ppD").value,+$("ppL").value,+$("ppSl").value,$("ppTp").value===""?null:+$("ppTp").value);V4.toast("✅ انفتحت الصفقة بسعر السيرفر");V4.compPage(c.id)}catch(e){V4.toast(V4.err(e),1);b.disabled=false}}}
    el.onclick=async e=>{const b=e.target.closest("[data-pc]");if(!b)return;if(!confirm("تسكّر الصفقة بسعر السيرفر الحالي؟"))return;b.disabled=true;try{await A.paperClose(+b.dataset.pc);V4.compPage(c.id)}catch(err){V4.toast(V4.err(err),1);b.disabled=false}}},
  // ================= صفحة السحب =================
  async gwPage(id){const el=$("v4GwBody"),A=V4.api();let g,I={};try{g=await A.gw(+id);[I]=await Promise.all([A.gwInfo(+id)])}catch(e){el.innerHTML=`<div class="panel"><p class="down" style="margin:0">${esc(V4.err(e))}</p></div>`;return}
    if(!g){el.innerHTML='<div class="panel"><p class="label" style="margin:0">السحب مو موجود.</p></div>';return}const open=g.status==="open"&&new Date(g.reg_to)>Date.now()&&new Date(g.reg_from)<=Date.now(),W=g.result&&g.result.winners||[];
    el.innerHTML=`<section class="panel"><div class="k-row" style="justify-content:space-between;display:flex;flex-wrap:wrap;gap:8px"><h2 style="margin:0;font-size:20px">🎉 ${esc(g.title)}</h2><span class="k-st ${open?"live":"end"}">${g.status==="drawn"?"انسحب":open?"التسجيل مفتوح":"التسجيل مسكّر"}</span></div>
      ${g.image_url?`<img src="${escA(g.image_url)}" alt="" style="width:100%;max-height:300px;object-fit:cover;border-radius:14px;margin-top:10px">`:""}
      <p class="label" style="font-size:13.5px;line-height:1.8;margin:10px 0">${esc(g.descr)}<br>🎁 <b class="gold">${esc(g.prize)}</b> · مجاني بالكامل: بدون شراء ولا إيداع ولا تداول. الشرط: حساب مفعّل${g.min_lessons?` وتخلّص ${g.min_lessons} درس على الأقل`:""}.</p>
      <div class="v3-sum" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="v2-t"><span>المشاركين</span><b class="num">${I.n??"—"}</b></div><div class="v2-t"><span>يقفل التسجيل</span><b class="num" style="font-size:14px">${new Date(g.reg_to).toLocaleString(window.LANG||"ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</b></div><div class="v2-t"><span>عدد الفائزين</span><b class="num">${g.winners}</b></div></div>
      ${W.length?`<h4 class="v3-h4">🏆 الفائزين</h4><div class="k-lb">${W.map(w=>`<div><b class="n">${["🥇","🥈","🥉"][w.rank-1]||w.rank}</b><i>${esc((w.name||"؟")[0])}</i><span>${esc(w.name)}</span><span class="label">رقم المشارك ${w.index} من ${g.result.n}</span></div>`).join("")}</div>`:""}
      <h4 class="v3-h4">🔐 التحقق من عدالة السحب</h4><p class="label" style="font-size:12.5px;margin:0 0 6px">بصمة البذرة السرية (منشورة من قبل السحب وما تتغيّر):</p><div class="k-hash">SHA-256: ${esc(g.seed_hash)}</div>
      ${g.seed?`<p class="label" style="font-size:12.5px;margin:8px 0 6px">البذرة بعد السحب:</p><div class="k-hash">${esc(g.seed)}</div><p class="label" style="font-size:12.5px;margin:8px 0 6px">بصمة قائمة المشاركين:</p><div class="k-hash">${esc(g.entries_hash||"")}</div><button class="btn v2s" type="button" id="gwV" style="margin-top:8px">🧮 تحقّق بنفسك هنا</button><div id="gwVr" class="v3-note"></div>`:""}
      <p class="v3-note">الطريقة: بصمة(البذرة : بصمة قائمة المشاركين المرتبة) ← رقم ← باقي القسمة على عدد المشاركين = رقم الفائز. أي واحد يكدر يعيد الحساب ويطلع نفس الفائز.</p>
      <div class="v3-act">${I.joined?'<span class="chip up" style="padding:10px 14px">✓ أنت مسجّل بالسحب</span>':open?'<button class="btn primary" type="button" id="gwE">🎟 سجّلني بالسحب (مجاني)</button>':""}<a class="btn" href="#rewards/gw" style="text-decoration:none">رجوع</a></div></section>`;
    const e=$("gwE");if(e)e.onclick=async()=>{e.disabled=true;try{await A.gwEnter(g.id);V4.toast("✅ تسجّلت بالسحب");V4.gwPage(g.id)}catch(err){V4.toast(V4.err(err),1);e.disabled=false}};
    const v=$("gwV");if(v)v.onclick=async()=>{const sh=async t=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t)))].map(b=>b.toString(16).padStart(2,"0")).join("");
      const ids=(g.result&&g.result.ids)||[],eh=await sh(ids.join(",")),s1=await sh(g.seed);let h=await sh(g.seed+":"+eh),out=[],used=new Set();
      for(let i=0;i<Math.min(g.winners,ids.length);i++){let idx;do{idx=Number(BigInt("0x"+h.slice(0,15))%BigInt(ids.length))+1;h=await sh(h)}while(used.has(idx));used.add(idx);out.push(idx)}
      $("gwVr").innerHTML=`${s1===g.seed_hash?"✅ البذرة تطابق البصمة المنشورة":"⛔ البذرة ما تطابق البصمة"} · ${eh===g.entries_hash?"✅ قائمة المشاركين مطابقة":"⛔ القائمة ما تطابق"} · أرقام الفائزين المحسوبة: <b>${out.join("، ")}</b> ${JSON.stringify(out)===JSON.stringify(W.map(w=>w.index))?"✅ نفس النتيجة المعلنة":"⛔ تختلف"}`}},
  view(v,arg){const sec={comp:"v4CompView",gw:"v4GwView",growth:"v4GrowthView"};for(const k in sec){const e=$(sec[k]);if(e)e.hidden=v!==k}
    const hero=$("v4Hero");if(hero){if(v===""&&!ME.locked)V4.hero();else hero.hidden=true}
    if(v==="rewards")V4.hub(arg);if(v==="comp")V4.compPage(arg);if(v==="gw")V4.gwPage(arg);if(v==="growth")V4.growth(arg)}
};
setInterval(()=>{try{V4.tick()}catch(e){}},1000);
window.__v4=V4;

/* ================= V4: لوحة إدارة المسابقات والنمو ================= */
Object.assign(V4,{
  GT:[["comps","🏆 المسابقات"],["review","📝 المراجعة والفائزين"],["rewards","🎁 الجوائز"],["gws","🎉 السحوبات"],["points","💠 النقاط"],["events","🎟 الفعاليات"],["mkt","📣 التسويق"],["refs","🔗 الإحالات"],["reports","📊 التقارير"],["audit","🧾 سجل التدقيق"]],
  async growth(tab){const el=$("v4GrowthBody");if(tab==="marketing-ai"&&window.VexoraMarketing&&DB.marketing){el.onclick=null;return window.VexoraMarketing.open(el,DB.marketing)}if(!isAdminUser()){el.innerHTML='<div class="panel"><p class="label" style="margin:0">هذي الصفحة للمدير بس.</p></div>';return}
    if(tab&&V4.GT.some(t=>t[0]===tab))V4.gt=tab;
    el.innerHTML=`<div class="panel v3-hdr"><div class="v3-ttl"><span class="v3-logo">🏆</span><div><h2>إدارة المسابقات والنمو</h2><p>المسابقات · المشاركات · النتائج · الجوائز · السحوبات · النقاط · الفعاليات · الحملات · الإحالات · التقارير</p></div></div>
      <div class="k-tabs" id="gTabs">${V4.GT.map(([k,t])=>`<button type="button" class="${V4.gt===k?"on":""}" data-g="${k}">${t}</button>`).join("")}</div></div><div id="gBody" class="v3-wrap"></div>`;
    $("gTabs").onclick=e=>{const b=e.target.closest("[data-g]");if(!b)return;V4.gt=b.dataset.g;history.replaceState(null,"","#growth/"+V4.gt);$("gTabs").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));V4.gRender()};V4.gRender()},
  async gRender(){const el=$("gBody");el.innerHTML='<div class="panel"><p class="label" style="margin:0">جاري التحميل…</p></div>';try{await V4["g_"+V4.gt](el)}catch(e){el.innerHTML=`<div class="panel"><p class="down" style="margin:0">${esc(V4.err(e))} (تأكد إنك شغّلت vexora_v4.sql)</p></div>`}},
  dt(v){if(!v)return"";const d=new Date(v),p=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`},
  iso(v){return v?new Date(v).toISOString():null},
  // ---------- المسابقات ----------
  async g_comps(el){const A=V4.api(),[L,S,R]=await Promise.all([A.aComps(),A.aStats().catch(()=>[]),A.aRewards().catch(()=>[])]),sm={};(S||[]).forEach(x=>sm[x.id]=x);V4._rw=R||[];
    el.innerHTML=`<section class="panel" id="gForm"></section><section class="panel"><h3 style="margin:0 0 10px;font-size:15px">📋 المسابقات</h3><div class="v3-tw"><table class="v3-tb"><thead><tr><th>المسابقة</th><th>النوع</th><th>الحالة</th><th>المشاركين</th><th>مراجعة</th><th>المشاهدات</th><th>الضغطات</th><th>انضموا من الإعلان</th><th></th></tr></thead><tbody>
      ${(L||[]).map(c=>{const s=sm[c.id]||{},end=c.ends_at&&new Date(c.ends_at)<Date.now(),ad=c.ad_home||c.ad_signup||c.ad_existing;return`<tr><td><b>${esc(c.title)}</b>${ad?' <span class="chip gold">📣 إعلان</span>':""}</td><td>${V4.TY[c.ctype]||"—"}</td>
        <td><span class="k-st ${c.status==="draft"?"soon":c.status==="closed"?"end":end?"end":"live"}">${c.status==="draft"?"مسودة":c.status==="closed"?"انتهت · معتمدة":end?"انتهت · بانتظار الاعتماد":"منشورة"}</span></td>
        <td class="num">${s.entries??0}</td><td class="num ${s.pending?"gold":""}">${s.pending??0}</td><td class="num">${s.views??0}</td><td class="num">${s.clicks??0}</td><td class="num up">${s.ad_joins??0}</td>
        <td style="display:flex;gap:4px"><button class="btn v2s" type="button" data-ed="${c.id}">تعديل</button><button class="btn v2s" type="button" data-rv="${c.id}">مشاركات</button>${ad&&c.status==="published"?`<button class="btn v2s" type="button" data-stop="${c.id}">⏸ إيقاف الإعلان</button>`:""}</td></tr>`}).join("")||'<tr><td colspan="9" class="label">ما في مسابقات بعد. سوّي أول وحدة من فوق.</td></tr>'}</tbody></table></div></section>`;
    V4.gForm(null);el.querySelector(".v3-tb").onclick=async e=>{const ed=e.target.closest("[data-ed]"),rv=e.target.closest("[data-rv]"),sp=e.target.closest("[data-stop]");
      if(ed){const c=L.find(x=>x.id==ed.dataset.ed);let sec=null;try{sec=await A.aSecret(c.id)}catch(err){}V4.gForm(c,sec);$("gForm").scrollIntoView({behavior:"smooth"})}
      if(rv){V4.rvComp=+rv.dataset.rv;V4.gt="review";V4.growth()}
      if(sp){if(!confirm("توكّف الإعلان (السلايدر والنافذة) لهذي المسابقة؟ المسابقة نفسها تبقى شغالة."))return;try{await A.aSave({id:+sp.dataset.stop,ad_home:false,ad_signup:false,ad_existing:false});V4.toast("⏸ توكّف الإعلان");V4.gRender()}catch(err){V4.toast(V4.err(err),1)}}}},
  gForm(c,sec){const el=$("gForm"),x=c||{ctype:"analysis",audience:"members",winners:3,entry_kind:"text_image",prizes:[{rank:1,text:"",points:500},{rank:2,text:"",points:300},{rank:3,text:"",points:150}],cfg:{},ad_priority:1,status:"draft",kind:"contest"},cf=x.cfg||{},Q=(cf.questions||[]),ans=(sec&&sec.answers)||[];
    V4._img=x.image_url||"";V4._pimg=x.popup_url||"";
    el.innerHTML=`<h3 style="margin:0 0 10px;font-size:15px">${c?"✏️ تعديل: "+esc(c.title):"＋ مسابقة جديدة"}</h3>
      <div class="k-form"><label class="w2">اسم المسابقة<input class="f" id="gT" maxlength="120" value="${escA(x.title||"")}"></label><label>النوع<select class="f" id="gTy">${Object.entries(V4.TY).map(([k,v])=>`<option value="${k}"${x.ctype===k?" selected":""}>${v}</option>`).join("")}</select></label>
        <label class="w3">الوصف<textarea class="f" id="gB" maxlength="800">${esc(x.body||"")}</textarea></label><label class="w3">الشروط وقواعد احتساب النتائج<textarea class="f" id="gRu" maxlength="3000">${esc(x.rules||"")}</textarea></label>
        <label>البداية<input class="f ltr" type="datetime-local" id="gS" value="${V4.dt(x.starts_at)}"></label><label>النهاية<input class="f ltr" type="datetime-local" id="gE" value="${V4.dt(x.ends_at)}"></label><label>من يكدر يشترك<select class="f" id="gAu">${Object.entries(V4.AUD).map(([k,v])=>`<option value="${k}"${x.audience===k?" selected":""}>${v}</option>`).join("")}</select></label>
        <label>عدد الفائزين<input class="f ltr" type="number" min="1" max="50" id="gW" value="${x.winners||1}"></label><label>أقصى عدد مشاركين (اختياري)<input class="f ltr" type="number" min="1" id="gMx" value="${x.max_entries||""}"></label>
        <label>نوع المشاركة<select class="f" id="gEk"><option value="none"${x.entry_kind==="none"?" selected":""}>بدون إرسال (تلقائي)</option><option value="text"${x.entry_kind==="text"?" selected":""}>نص</option><option value="text_image"${x.entry_kind==="text_image"?" selected":""}>نص + صورة (اختياري)</option></select></label></div>
      <div id="gCfg" style="margin-top:10px"></div>
      <h4 class="v3-h4">🎁 الجوائز حسب المركز</h4><div id="gPz">${(x.prizes||[]).map((p,i)=>V4.pzRow(p,i)).join("")}</div><button type="button" class="btn v2s" id="gPzA">＋ مركز</button>
      <h4 class="v3-h4">📣 الإعلان المصوّر</h4><div class="k-form"><div class="upl w2"><img id="gImgP" src="${escA(V4._img)}" alt="" ${V4._img?"":"hidden"}><div><b style="color:var(--fg)">الصورة الرئيسية</b><br><span class="label">JPG / PNG / WebP · أقصى حجم 3MB · الأفضل 1200×630</span><br><label class="btn v2s" style="margin-top:6px">🔄 ارفع صورة<input type="file" id="gImg" accept="image/jpeg,image/png,image/webp" hidden></label> <button type="button" class="btn v2s" id="gImgX" style="margin-top:6px;color:var(--sell)">🗑 حذف</button></div></div>
        <div class="upl"><img id="gPImgP" src="${escA(V4._pimg)}" alt="" ${V4._pimg?"":"hidden"}><div><b style="color:var(--fg)">صورة النافذة (اختيارية)</b><br><label class="btn v2s" style="margin-top:6px">ارفع<input type="file" id="gPImg" accept="image/jpeg,image/png,image/webp" hidden></label> <button type="button" class="btn v2s" id="gPImgX" style="margin-top:6px;color:var(--sell)">🗑 حذف</button></div></div>
        <label>الأولوية (1 = الإعلان الرئيسي)<input class="f ltr" type="number" min="1" max="99" id="gPr" value="${x.ad_priority||1}"></label><label>بداية العرض<input class="f ltr" type="datetime-local" id="gAf" value="${V4.dt(x.ad_from)}"></label><label>نهاية العرض (فارغ = مع نهاية المسابقة)<input class="f ltr" type="datetime-local" id="gAt" value="${V4.dt(x.ad_to)}"></label></div>
      <div style="display:grid;gap:8px;margin-top:10px">${[["gAH","ad_home","الظهور بالصفحة الرئيسية (السلايدر)"],["gAS","ad_signup","نافذة بعد أول تسجيل للمستخدم الجديد"],["gAE","ad_existing","نافذة للأعضاء الحاليين عند الدخول (مرة وحدة)"],["gAR","ad_repeat","يرجع يطلع حتى بعد ما يسكّره المستخدم"]].map(([i,k,t])=>`<label class="tgl"><input type="checkbox" id="${i}"${x[k]?" checked":""}> ${t}</label>`).join("")}
        <label class="tgl"><input type="checkbox" id="gNt"${cf.notify!=="0"?" checked":""}> إرسال إشعار داخلي للمؤهلين لمن تنشر</label></div>
      <div class="v3-act"><button class="btn" type="button" id="gSv" data-st="draft">💾 احفظ كمسودة</button><button class="btn primary" type="button" id="gPb">📣 نشر</button><button class="btn v2s" type="button" id="gPv">👁 معاينة</button>${c?'<button class="btn v2s" type="button" id="gNew">＋ جديدة بدل التعديل</button>':""}</div>
      ${c?`<h4 class="v3-h4">🔗 رابط المشاركة المباشر</h4><div class="k-row" style="display:flex;gap:6px;flex-wrap:wrap"><div class="k-hash" style="flex:1">${esc(location.origin+location.pathname+"#comp/"+c.id)}</div><div class="rw-share">${shareBtns(`🏆 ${c.title}\nشارك مجاناً: ${location.origin+location.pathname}#comp/${c.id}`,location.origin+location.pathname+"#comp/"+c.id)}</div></div><p class="v3-note">حتى تتبّع الزيارات والتسجيلات، سوّي حملة من تبويب التسويق واربطها بهذي المسابقة.</p>`:""}
      <p class="msg" id="gMsg"></p>`;
    const cfgR=()=>{const t=$("gTy").value,g=$("gCfg");
      g.innerHTML=t==="paper"?`<div class="k-form"><label>الرصيد الافتراضي $<input class="f ltr" id="cB" type="number" value="${cf.balance||10000}"></label><label>أقصى تراجع %<input class="f ltr" id="cD" type="number" value="${cf.max_dd||10}"></label><label>أقل عدد صفقات للتأهل<input class="f ltr" id="cN" type="number" value="${cf.min_trades||10}"></label><label>أقصى مخاطرة بالصفقة %<input class="f ltr" id="cR" type="number" value="${cf.max_risk||5}"></label><label class="w2">الأزواج (فاصلة)<input class="f ltr" id="cSy" value="${escA((cf.syms||["XAU/USD","EUR/USD","GBP/USD","USD/JPY"]).join(", "))}"></label></div>`
        :t==="prediction"?`<div class="k-form"><label>الأصل<input class="f ltr" id="cSym" value="${escA(cf.sym||"XAU/USD")}"></label><label>يقفل التوقع الساعة (UTC)<input class="f ltr" id="cLk" type="number" min="1" max="24" value="${cf.lock_hour||20}"></label></div><p class="v3-note">النتيجة من شمعة D1 بالسيرفر. +${"نقاط"} لكل توقع صحيح حسب قواعد النقاط.</p>`
        :t==="lessons"?`<div class="k-form"><label>أقل نسبة اختبار للدرس %<input class="f ltr" id="cMs" type="number" value="${cf.min_score||80}"></label></div>`
        :t==="team"?`<div class="k-form"><label class="w3">أسماء المجموعات (فاصلة)<input class="f" id="cTm" value="${escA((cf.teams||["الصقور","الأسود"]).join("، "))}"></label></div>`
        :(t==="quiz"||t==="smc")?`<div id="cQ">${(Q.length?Q:[{q:"",o:["",""]}]).map((q,i)=>V4.qRow(q,i,ans[i])).join("")}</div><button type="button" class="btn v2s" id="cQA">＋ سؤال</button><p class="v3-note">الجواب الصحيح ينحفظ بجدول مخفي عن الأعضاء، والتصحيح بالسيرفر.</p>`:"";
      const qa=$("cQA");if(qa)qa.onclick=()=>{$("cQ").insertAdjacentHTML("beforeend",V4.qRow({q:"",o:["",""]},$("cQ").children.length,0))}};
    cfgR();$("gTy").onchange=cfgR;
    $("gPzA").onclick=()=>{const n=$("gPz").children.length+1;$("gPz").insertAdjacentHTML("beforeend",V4.pzRow({rank:n,text:"",points:0},n-1))};
    const up=(inp,prev,key)=>{$(inp).onchange=async()=>{const f=$(inp).files[0];if(!f)return;if(!/^image\/(jpeg|png|webp)$/.test(f.type))return V4.toast("الصورة لازم JPG أو PNG أو WebP",1);if(f.size>3*1048576)return V4.toast("الصورة أكبر من 3MB",1);
      try{const u=await V4.api().uploadMedia(f);V4[key]=u;$(prev).src=u;$(prev).hidden=false;V4.toast("✓ انرفعت الصورة")}catch(e){V4.toast(V4.err(e),1)}}};up("gImg","gImgP","_img");up("gPImg","gPImgP","_pimg");[["gImgX","gImgP","_img"],["gPImgX","gPImgP","_pimg"]].forEach(([b,pv,k])=>{$(b).onclick=()=>{V4[k]="";$(pv).removeAttribute("src");$(pv).hidden=true;V4.toast("🗑 انشالت الصورة. اضغط حفظ حتى يثبت التغيير")}});
    const collect=st=>{const t=$("gTy").value,cfg={notify:$("gNt").checked?"1":"0"},secA=[];
      if(t==="paper")Object.assign(cfg,{balance:+$("cB").value||10000,max_dd:+$("cD").value||10,min_trades:+$("cN").value||10,max_risk:+$("cR").value||5,syms:$("cSy").value.split(/[,،]/).map(s=>s.trim().toUpperCase()).filter(Boolean)});
      if(t==="prediction")Object.assign(cfg,{sym:$("cSym").value.trim().toUpperCase()||"XAU/USD",lock_hour:+$("cLk").value||20});
      if(t==="lessons")cfg.min_score=+$("cMs").value||80;if(t==="team")cfg.teams=$("cTm").value.split(/[,،]/).map(s=>s.trim()).filter(Boolean);
      if(t==="quiz"||t==="smc"){cfg.questions=[...document.querySelectorAll("#cQ .v4-qe")].map(r=>{secA.push(+(r.querySelector("[data-qc]:checked")||{value:0}).value);return{q:r.querySelector("[data-qq]").value.trim(),o:[...r.querySelectorAll("[data-qo]")].map(i=>i.value.trim()).filter(Boolean)}}).filter(q=>q.q&&q.o.length>1)}
      const pz=[...document.querySelectorAll("#gPz .v4-pz")].map((r,i)=>({rank:i+1,text:r.querySelector("[data-pt]").value.trim(),points:+r.querySelector("[data-pp]").value||0,reward_id:r.querySelector("[data-pr]").value||""})).filter(p=>p.text||p.points||p.reward_id);
      return{row:{id:c&&c.id,kind:"contest",title:$("gT").value.trim(),body:$("gB").value.trim(),rules:$("gRu").value.trim(),ctype:t,audience:$("gAu").value,starts_at:V4.iso($("gS").value),ends_at:V4.iso($("gE").value),
        winners:+$("gW").value||1,max_entries:+$("gMx").value||null,entry_kind:(t==="quiz"||t==="smc")?"text":t==="paper"||t==="prediction"||t==="lessons"||t==="team"||t==="referral"?"none":$("gEk").value,prizes:pz,prize:(pz[0]&&pz[0].text)||"",cfg,
        image_url:V4._img||"",popup_url:V4._pimg||"",ad_home:$("gAH").checked,ad_signup:$("gAS").checked,ad_existing:$("gAE").checked,ad_repeat:$("gAR").checked,ad_priority:+$("gPr").value||1,ad_from:V4.iso($("gAf").value),ad_to:V4.iso($("gAt").value),status:st,updated_at:new Date().toISOString()},answers:secA}};
    const save=async st=>{const{row,answers}=collect(st);if(!row.title)return say("gMsg","اكتب اسم المسابقة");if(!row.ends_at)return say("gMsg","حدد تاريخ النهاية");if(row.starts_at&&row.starts_at>row.ends_at)return say("gMsg","البداية لازم قبل النهاية");
      if(st==="published"&&!(c&&c.status==="published")&&!confirm(row.cfg.notify==="1"?"تنشر المسابقة وينرسل إشعار للمؤهلين؟":"تنشر المسابقة؟"))return;
      try{const id=await V4.api().aSave(row);if(answers.length)await V4.api().aSetSecret(id||row.id,{answers});V4.toast(st==="published"?"📣 انشرت المسابقة":"💾 انحفظت");V4.gRender()}catch(e){say("gMsg",V4.err(e))}};
    $("gSv").onclick=()=>save(c&&c.status==="published"?"published":"draft");$("gPb").onclick=()=>save("published");if($("gNew"))$("gNew").onclick=()=>V4.gForm(null);
    if(c&&c.status!=="draft")$("gSv").textContent="💾 احفظ التعديلات";
    $("gPv").onclick=()=>{const{row}=collect("draft");const ov=document.createElement("div");ov.className="pm-ov";ov.innerHTML=`<div style="width:min(1100px,100%);display:grid;gap:12px;max-height:92vh;overflow:auto"><div class="k-row" style="display:flex;justify-content:space-between"><b>👁 معاينة: السلايدر بالرئيسية</b><button class="btn" type="button" data-x>✕ إغلاق المعاينة</button></div><div id="pvH"></div><b>👁 معاينة: النافذة</b><div id="pvP" style="display:grid;place-items:center"></div></div>`;
      document.body.appendChild(ov);const s0=V4.slides,i0=V4.si;V4.slides=[{...row,id:0,participants:"—",joined:false}];V4.si=0;const h=$("v4Hero"),tmp=document.createElement("div");tmp.id="v4Hero";h.id="v4HeroX";$("pvH").appendChild(tmp);V4.slide();tmp.removeAttribute("id");h.id="v4Hero";V4.slides=s0;V4.si=i0;
      $("pvP").innerHTML=`<div class="pm-box" style="position:relative"><span class="pm-x">✕</span>${row.popup_url||row.image_url?`<img src="${escA(row.popup_url||row.image_url)}" alt="">`:'<div class="pm-ph">🏆</div>'}<div class="pm-b"><span class="chip gold" style="justify-self:center">${V4.TY[row.ctype]}</span><h3 style="text-align:center;margin:0">${esc(row.title)}</h3>${row.prize?`<p class="label" style="margin:0;text-align:center">🎁 الجائزة الأولى: ${esc(row.prize)}</p>`:""}${V4.cd(row.ends_at)}<div class="pm-act"><button class="btn primary">🏆 شارك الآن</button><button class="btn">لاحقاً</button></div></div></div>`;
      V4.tick();ov.onclick=e=>{if(e.target===ov||e.target.closest("[data-x]"))ov.remove()}}},
  pzRow(p,i){return`<div class="v4-pz k-form" style="grid-template-columns:60px 2fr 1fr 1.4fr;margin-bottom:6px"><span class="num gold" style="align-self:center">${["🥇","🥈","🥉"][i]||"#"+(i+1)}</span><input class="f" data-pt placeholder="وصف الجائزة (مثلاً: حساب ممول 10,000$)" value="${escA(p.text||"")}"><input class="f ltr" data-pp type="number" min="0" placeholder="نقاط" value="${p.points||""}"><select class="f" data-pr><option value="">بدون جائزة من الكتالوج</option>${(V4._rw||[]).map(r=>`<option value="${r.id}"${String(p.reward_id)===String(r.id)?" selected":""}>${esc(r.icon+" "+r.title)}</option>`).join("")}</select></div>`},
  qRow(q,i,a){return`<div class="v4-qe v4-q"><input class="f" data-qq placeholder="السؤال ${i+1}" value="${escA(q.q||"")}">${[0,1,2,3].map(j=>`<label style="display:flex;gap:6px;align-items:center"><input type="radio" name="qc${i}" data-qc value="${j}"${(a||0)===j?" checked":""} title="الجواب الصحيح"><input class="f" data-qo placeholder="خيار ${j+1}" value="${escA((q.o||[])[j]||"")}" style="flex:1"></label>`).join("")}</div>`},
  // ---------- المراجعة والفائزين ----------
  async g_review(el){const A=V4.api(),L=(await A.aComps()||[]);if(!V4.rvComp&&L.length)V4.rvComp=L[0].id;const c=L.find(x=>x.id===V4.rvComp);
    el.innerHTML=`<section class="panel"><label class="v4-lb">المسابقة<select class="f" id="rvSel">${L.map(x=>`<option value="${x.id}"${x.id===V4.rvComp?" selected":""}>${esc(x.title)}</option>`).join("")}</select></label></section><div id="rvB" class="v3-wrap"></div>`;
    $("rvSel").onchange=e=>{V4.rvComp=+e.target.value;V4.gRender()};if(!c)return;
    const[E,B,W,F]=await Promise.all([A.aEntries(c.id),A.board(c.id).catch(()=>[]),A.winners(c.id).catch(()=>[]),c.ctype==="paper"?A.aPaperFlags(c.id).catch(()=>[]):[]]);
    const pend=(E||[]).filter(x=>x.status==="pending");
    $("rvB").innerHTML=`<div class="v3-grid2"><section class="panel"><h3 style="margin:0 0 10px;font-size:15px">📝 بانتظار المراجعة (${pend.length})</h3><div class="v3-slist">${pend.map(x=>`<div class="v3-srow" style="display:grid;gap:6px"><div class="k-row" style="display:flex;justify-content:space-between;gap:6px"><b>${esc(x.name)}</b><span class="label">${ago(x.updated_at)}${x.src?" · من: "+esc(x.src):""}</span></div>
        <div style="white-space:pre-wrap;font-size:13px;line-height:1.8;max-height:160px;overflow:auto;background:rgba(255,255,255,.03);padding:8px;border-radius:10px">${esc(x.answer)}</div>
        <div class="k-row" style="display:flex;gap:6px;flex-wrap:wrap">${x.image_path?`<button class="btn v2s" type="button" data-im="${escA(x.image_path)}">🖼 فتح الصورة</button>`:""}<input class="f ltr" type="number" min="0" max="100" placeholder="التقييم /100" data-sc="${x.id}" style="width:120px"><button class="btn v2s" type="button" data-ok="${x.id}" style="color:var(--buy)">✓ قبول</button><button class="btn v2s" type="button" data-no="${x.id}" style="color:var(--sell)">✕ رفض + سبب</button></div></div>`).join("")||'<p class="label" style="margin:0">ما أكو مشاركات بانتظار المراجعة.</p>'}</div></section>
      <section class="panel"><h3 style="margin:0 0 10px;font-size:15px">🏆 اعتماد الفائزين</h3>${W.length?`<div class="k-lb">${W.map(w=>`<div><b class="n">${["🥇","🥈","🥉"][w.rank-1]||w.rank}</b><i>${esc((w.name||"؟")[0])}</i><span>${esc(w.name)}</span><span class="gold">${esc(w.prize)}</span></div>`).join("")}</div><p class="v3-note">الفائزين معتمدين، والمسابقة مقفولة.</p>`
        :`<p class="label" style="margin:0 0 8px;font-size:13px">اختار ${c.winners} فائز بالترتيب من لوحة المتصدرين (راجع التلاعب قبل الاعتماد):</p><div class="v3-slist">${(B||[]).slice(0,30).map(b=>`<label class="v3-srow" style="cursor:pointer"><input type="checkbox" data-wn="${b.pos}"> <b class="num">${b.pos}</b><span>${esc(b.name)}</span><b class="num gold">${b.score??"—"}</b>${b.flag?`<span class="chip down">⚠ ${esc(b.flag)}</span>`:""}</label>`).join("")||'<p class="label">ما أكو مشاركين مؤهلين.</p>'}</div>
          <button class="btn primary" type="button" id="rvFin" style="margin-top:10px">🏆 اعتمد الفائزين وأرسل الإشعارات</button><p class="v3-note">بعد الاعتماد: النقاط والشارات تنضاف، والفائز يكدر يطلب جائزته (مثل الحساب الممول) من صفحة الجوائز.</p>`}</section></div>
      ${F&&F.length?`<section class="panel"><h3 style="margin:0 0 10px;font-size:15px">🔍 كشف التلاعب بالحساب الورقي</h3><div class="v3-tw"><table class="v3-tb"><thead><tr><th>العضو</th><th>العائد</th><th>أقصى تراجع</th><th>الصفقات</th><th>أكبر صفقة من الربح</th><th>ملاحظة</th></tr></thead><tbody>${F.map(f=>`<tr><td>${esc(f.name)}</td><td class="num">${f.ret??"—"}%</td><td class="num">${f.maxdd??"—"}%</td><td class="num">${f.trades}</td><td class="num">${f.top_share??"—"}%</td><td>${f.flag?`<span class="chip down">⚠ ${esc(f.flag)}</span>`:'<span class="chip up">سليم</span>'}</td></tr>`).join("")}</tbody></table></div></section>`:""}
      <section class="panel"><h3 style="margin:0 0 10px;font-size:15px">📋 كل المشاركات (${(E||[]).length})</h3><div class="v3-tw"><table class="v3-tb"><thead><tr><th>العضو</th><th>الحالة</th><th>النتيجة</th><th>المصدر</th><th>آخر تحديث</th></tr></thead><tbody>${(E||[]).map(x=>`<tr><td>${esc(x.name)}${x.team?` <small class="label">${esc(x.team)}</small>`:""}</td><td><span class="${(V4.ST[x.status]||V4.ST.joined)[1]}">${(V4.ST[x.status]||V4.ST.joined)[0]}</span>${x.reason?` <small class="label">${esc(x.reason)}</small>`:""}</td><td class="num">${x.score??"—"}</td><td class="label">${esc(x.src||"—")}</td><td class="label">${ago(x.updated_at)}</td></tr>`).join("")}</tbody></table></div></section>`;
    $("rvB").onclick=async e=>{const im=e.target.closest("[data-im]"),ok=e.target.closest("[data-ok]"),no=e.target.closest("[data-no]");
      try{if(im){const u=await A.entryUrl(im.dataset.im);window.open(u,"_blank","noopener")}
        if(ok){const sc=$("rvB").querySelector(`[data-sc="${ok.dataset.ok}"]`).value;await A.aReview(+ok.dataset.ok,true,sc===""?null:+sc,"");V4.toast("✅ انقبلت");V4.gRender()}
        if(no){const w=prompt("سبب الرفض (يوصل للمشارك):","");if(!w)return;await A.aReview(+no.dataset.no,false,null,w);V4.toast("⛔ انرفضت وانرسل السبب");V4.gRender()}}catch(err){V4.toast(V4.err(err),1)}};
    const fin=$("rvFin");if(fin)fin.onclick=async()=>{const pos=[...$("rvB").querySelectorAll("[data-wn]:checked")].map(i=>+i.dataset.wn).sort((a,b)=>a-b),ids=pos.map(p=>(B.find(x=>x.pos===p)||{}).uid).filter(Boolean);
      if(!pos.length)return V4.toast("اختار الفائزين",1);if(ids.length!==pos.length)return V4.toast("ما كدرت أحدد كل الفائزين، جرّب مرة ثانية",1);if(!confirm(`تعتمد ${ids.length} فائز؟ ما تكدر تتراجع.`))return;
      try{await A.aFinalize(c.id,ids);V4.toast("🏆 انعتمدوا الفائزين");V4.gRender()}catch(err){V4.toast(V4.err(err),1)}}},
  shortName(n){const p=String(n||"").trim().split(/\s+/);return(p[0]||"عضو")+(p[1]?" "+p[1][0]+".":"")},
  // ---------- الجوائز ----------
  async g_rewards(el){const A=V4.api(),[R,C]=await Promise.all([A.aRewards(),A.aClaims()]);
    el.innerHTML=`<section class="panel"><h3 style="margin:0 0 10px;font-size:15px">📦 طلبات الجوائز</h3><div class="v3-slist">${(C||[]).map(c=>{const s=V4.RST[c.status]||V4.RST.pending;return`<div class="v3-srow" style="display:grid;gap:6px"><div class="k-row" style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><b>${esc(c.reward)} · ${esc(c.name)}</b><span class="chip ${s[1]}">${s[0]}</span></div>
        <span class="label">${c.winner?`🏆 فوز: ${esc(c.winner.comp)} · المركز ${c.winner.rank}${c.winner.score!=null?" · النتيجة "+c.winner.score:""}`:`💠 ${c.cost} نقطة`} · ${ago(c.created_at)} · <span class="ltr">${esc((c.email||"").replace(/^(.).*?(@.*)$/,"$1***$2"))}</span></span>
        ${c.status==="pending"||c.status==="approved"?`<div class="k-form" style="grid-template-columns:repeat(4,minmax(0,1fr))">${c.kind==="funded"?`<input class="f" data-df="${c.id}" placeholder="شركة التمويل"><input class="f ltr" data-ds="${c.id}" placeholder="حجم الحساب"><input class="f ltr" data-do="${c.id}" placeholder="رقم الطلب/الإيصال">`:`<input class="f ltr" data-dc="${c.id}" placeholder="الكود (اختياري)">`}<input class="f" data-dn="${c.id}" placeholder="ملاحظة للفائز"></div>
          <div class="v3-act" style="margin:0">${c.status==="pending"?`<button class="btn v2s" type="button" data-ap="${c.id}">✅ موافقة</button>`:""}<button class="btn primary" type="button" data-dv="${c.id}">🎉 سجّل التسليم وأرسل إشعار</button><button class="btn v2s" type="button" data-rj="${c.id}" style="color:var(--sell)">✕ رفض + سبب</button></div>`
          :c.delivery&&Object.keys(c.delivery).length?`<span class="label">${Object.entries(c.delivery).map(([k,v])=>esc(v)).join(" · ")}</span>`:c.reason?`<span class="label">السبب: ${esc(c.reason)}</span>`:""}</div>`}).join("")||'<p class="label" style="margin:0">ما أكو طلبات.</p>'}</div>
        <p class="v3-note">الحساب الممول: تشتريه أنت باسم الفائز من شركة التمويل، والشركة ترسل بيانات الدخول لإيميله مباشرة. المنصة ما تحفظ أي كلمة سر، بس تسجّل الشركة والحجم ورقم الطلب ومن سلّمه.</p></section>
      <section class="panel"><h3 style="margin:0 0 10px;font-size:15px">🎁 كتالوج الجوائز</h3><p class="label" style="margin:0 0 8px;font-size:12.5px">النقاط فارغة = الجائزة تنكسب بالفوز بس (مثل الحساب الممول). المخزون فارغ = بلا حد.</p><div class="v3-slist">
        ${[...(R||[]),{id:"",icon:"🎁",title:"",descr:"",kind:"digital",cost:null,stock:null,min_level:"bronze",active:true}].map(r=>`<div class="v3-srow v4-rw" data-rw="${r.id}"><input class="f" data-k="icon" value="${escA(r.icon)}" aria-label="أيقونة"><input class="f" data-k="title" value="${escA(r.title)}" placeholder="${r.id?"اسم الجائزة":"＋ جائزة جديدة"}"><input class="f" data-k="descr" value="${escA(r.descr)}" placeholder="الوصف">
          <select class="f" data-k="kind">${[["vip","👑 VIP"],["indicator","📊 مؤشر"],["course","🎓 دورة"],["session","🧑‍🏫 جلسة"],["membership","⭐ عضوية"],["coupon","🎟 كود خصم"],["digital","🖼 هدية رقمية"],["funded","💼 حساب ممول"],["certificate","🏅 شهادة"]].map(([k,t])=>`<option value="${k}"${r.kind===k?" selected":""}>${t}</option>`).join("")}</select><input class="f ltr" data-k="cost" type="number" min="1" value="${r.cost??""}" placeholder="النقاط"><input class="f ltr" data-k="stock" type="number" min="0" value="${r.stock??""}" placeholder="المخزون">
          <select class="f" data-k="min_level">${Object.keys(V4.LV).map(k=>`<option value="${k}"${r.min_level===k?" selected":""}>${V4.LV[k][0]} ${V4.LV[k][1]}</option>`).join("")}</select><label class="tgl"><input type="checkbox" data-k="active"${r.active?" checked":""}> مفعّلة</label><button class="btn v2s" type="button" data-rs="${r.id}">${r.id?"حفظ":"＋ أضف"}</button></div>`).join("")}</div></section>`;
    el.onclick=async e=>{const g=(a,id)=>{const i=el.querySelector(`[${a}="${id}"]`);return i?i.value.trim():""},b=e.target.closest("[data-ap],[data-dv],[data-rj],[data-rs]");if(!b)return;
      try{if(b.dataset.ap){await A.aDecide(+b.dataset.ap,"approved",{},"");V4.toast("✅ انقبل الطلب")}
        if(b.dataset.dv){const id=b.dataset.dv,d={firm:g("data-df",id),size:g("data-ds",id),order_no:g("data-do",id),code:g("data-dc",id),note:g("data-dn",id)};Object.keys(d).forEach(k=>{if(!d[k])delete d[k]});
          if(!confirm("تسجّل إن الجائزة انسلّمت؟"))return;await A.aDecide(+id,"delivered",d,"");V4.toast("🎉 انسجل التسليم ووصل إشعار للفائز")}
        if(b.dataset.rj){const w=prompt("سبب الرفض (يوصل للعضو، وترجعله نقاطه):","");if(!w)return;await A.aDecide(+b.dataset.rj,"rejected",{},w);V4.toast("⛔ انرفض الطلب")}
        if(b.dataset.rs!==undefined){const tr=b.closest("[data-rw]"),v=k=>tr.querySelector(`[data-k="${k}"]`),row={icon:v("icon").value||"🎁",title:v("title").value.trim(),descr:v("descr").value.trim(),kind:v("kind").value,cost:v("cost").value===""?null:+v("cost").value,stock:v("stock").value===""?null:+v("stock").value,min_level:v("min_level").value,active:v("active").checked};
          if(!row.title)return V4.toast("اكتب اسم الجائزة",1);if(b.dataset.rs)row.id=+b.dataset.rs;await A.aRewardSave(row);V4.toast("💾 انحفظت الجائزة")}
        V4.gRender()}catch(err){V4.toast(V4.err(err),1)}}},
  // ---------- السحوبات ----------
  async g_gws(el){const A=V4.api(),G=await A.gws()||[];
    el.innerHTML=`<section class="panel"><h3 style="margin:0 0 10px;font-size:15px">＋ سحب مجاني جديد</h3><div class="k-form"><label class="w2">العنوان<input class="f" id="gwT" maxlength="120"></label><label>الجائزة<input class="f" id="gwP" placeholder="مثلاً: VIP 3 أشهر"></label><label class="w3">الوصف<textarea class="f" id="gwD"></textarea></label>
        <label>يقفل التسجيل<input class="f ltr" type="datetime-local" id="gwTo"></label><label>عدد الفائزين<input class="f ltr" type="number" min="1" max="20" value="1" id="gwW"></label><label>أقل عدد دروس<input class="f ltr" type="number" min="0" value="1" id="gwL"></label></div>
      <div class="v3-act"><button class="btn primary" type="button" id="gwGo">🎉 أنشئ السحب وانشر البصمة</button></div><p class="v3-note">السحب مجاني بالكامل (بدون شراء ولا إيداع ولا نقاط). البذرة السرية تتولّد بالسيرفر وتنشر بصمتها فوراً، وتنكشف بعد السحب حتى الكل يتحقق. قبل الإطلاق التجاري بفرنسا لازم يكون عندك نظام مكتوب للسحب (règlement).</p></section>
      <section class="panel"><h3 style="margin:0 0 10px;font-size:15px">📋 السحوبات</h3><div class="v3-slist">${G.map(g=>`<div class="v3-srow"><b>${esc(g.title)}</b><span class="label">🎁 ${esc(g.prize)} · يقفل ${new Date(g.reg_to).toLocaleString(window.LANG||"ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span><span class="chip ${g.status==="drawn"?"up":""}">${g.status==="drawn"?"انسحب":"مفتوح"}</span>${g.status==="open"&&new Date(g.reg_to)<Date.now()?`<button class="btn primary" type="button" data-dr="${g.id}">🎲 اسحب الآن</button>`:""}<a class="btn v2s" href="#gw/${g.id}" style="text-decoration:none">عرض</a></div>`).join("")||'<p class="label" style="margin:0">ما في سحوبات.</p>'}</div></section>`;
    $("gwGo").onclick=async()=>{const t=$("gwT").value.trim(),to=$("gwTo").value;if(!t||!to)return V4.toast("اكتب العنوان وموعد القفل",1);try{await A.aGwCreate(t,$("gwD").value.trim(),$("gwP").value.trim(),"",V4.iso(to),null,+$("gwW").value||1,+$("gwL").value||0);V4.toast("🎉 انشأ السحب");V4.gRender()}catch(e){V4.toast(V4.err(e),1)}};
    el.onclick=async e=>{const d=e.target.closest("[data-dr]");if(!d)return;if(!confirm("تسوي السحب هسه؟ النتيجة نهائية وتنعلن للكل."))return;try{const r=await A.aGwDraw(+d.dataset.dr);V4.toast("🎉 الفائز: "+(r||[]).map(w=>w.name).join("، "));V4.gRender()}catch(err){V4.toast(V4.err(err),1)}}},
  // ---------- النقاط ----------
  async g_points(el){const A=V4.api(),R=await A.rules()||[];
    el.innerHTML=`<div class="v3-grid2"><section class="panel"><h3 style="margin:0 0 10px;font-size:15px">💠 قواعد النقاط</h3><div class="v3-slist">${R.filter(r=>!["admin_adjust","reward","reward_refund","comp_win"].includes(r.key)).map(r=>`<div class="v3-srow"><span style="flex:1">${esc(r.label)}</span><input class="f ltr" type="number" min="0" max="10000" value="${r.points}" data-rp="${r.key}" style="width:90px"><label class="tgl"><input type="checkbox" data-ra="${r.key}"${r.active?" checked":""}> مفعّلة</label></div>`).join("")}</div>
        <div class="v3-act"><button class="btn primary" type="button" id="rpSv">💾 احفظ القواعد</button></div><p class="v3-note">نقاط الفوز تتحدد بكل مسابقة. التعديل يطبّق على الحركات الجاية بس، والسجل القديم يبقى مثل ما هو.</p></section>
      <section class="panel"><h3 style="margin:0 0 10px;font-size:15px">✍️ تعديل يدوي لنقاط عضو</h3><div class="k-form" style="grid-template-columns:1fr"><label>إيميل العضو<input class="f ltr" id="apE"></label><label>النقاط (+ أو −)<input class="f ltr" type="number" id="apD"></label><label>السبب<input class="f" id="apN" maxlength="200"></label></div>
        <div class="v3-act"><button class="btn" type="button" id="apGo">تطبيق</button></div><p class="v3-note">كل تعديل ينسجل بسجل التدقيق باسمك.</p>
        <h4 class="v3-h4">المستويات</h4><p class="label" style="margin:0;font-size:13px">🥉 برونزي 0 · 🥈 فضي 500 · 🥇 ذهبي 1,500 · 💎 ماسي 3,000 (من مجموع النقاط المكتسبة، والصرف ما ينزّل المستوى)</p></section></div>`;
    $("rpSv").onclick=async()=>{try{for(const i of el.querySelectorAll("[data-rp]")){await A.saveRule(i.dataset.rp,+i.value||0,el.querySelector(`[data-ra="${i.dataset.rp}"]`).checked)}V4.toast("💾 انحفظت القواعد")}catch(e){V4.toast(V4.err(e),1)}};
    $("apGo").onclick=async()=>{const em=$("apE").value.trim().toLowerCase(),d=+$("apD").value,n=$("apN").value.trim();if(!em||!d||!n)return V4.toast("اكتب الإيميل والنقاط والسبب",1);
      try{const u=await A.aFindUser(em);if(!u)throw new Error("ما لكيت عضو بهذا الإيميل");if(!confirm(`${d>0?"تضيف":"تنقص"} ${Math.abs(d)} نقطة لـ ${u.full_name||u.email}؟`))return;await A.aPoints(u.id,d,n);V4.toast("✅ انطبق التعديل");$("apD").value="";$("apN").value=""}catch(e){V4.toast(V4.err(e),1)}}},
  // ---------- الفعاليات ----------
  async g_events(el){const A=V4.api(),S=await A.aSessions()||[];let seats=[];try{seats=await A.seats()||[]}catch(e){}const sm={};seats.forEach(x=>sm[x.session_id]=x);
    el.innerHTML=`<section class="panel"><h3 style="margin:0 0 10px;font-size:15px">🎟 الفعاليات: المقاعد وقائمة الانتظار</h3><div class="v3-tw"><table class="v3-tb"><thead><tr><th>الفعالية</th><th>الموعد</th><th>النوع</th><th>المقاعد (فارغ = بلا حد)</th><th>شهادة مشاركة</th><th>مسجّلين</th><th>انتظار</th><th></th></tr></thead><tbody>
      ${S.map(s=>`<tr data-ss="${s.id}"><td>${esc(s.title)}</td><td class="label">${new Date(s.starts_at).toLocaleString(window.LANG||"ar",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</td><td><select class="f" data-k="kind">${[["zoom","🎥 بث زوم"],["workshop","🛠 ورشة"],["qa","❓ أسئلة وأجوبة"],["challenge","👥 تحدي جماعي"],["live_comp","🏆 مسابقة مباشرة"]].map(([k,t])=>`<option value="${k}"${s.kind===k?" selected":""}>${t}</option>`).join("")}</select></td>
        <td><input class="f ltr" type="number" min="1" data-k="capacity" value="${s.capacity??""}" style="width:90px"></td><td><input type="checkbox" data-k="cert"${s.cert?" checked":""}></td><td class="num">${(sm[s.id]||{}).going??"—"}</td><td class="num">${(sm[s.id]||{}).waitlist??"—"}</td><td><button class="btn v2s" type="button" data-sv="${s.id}">حفظ</button></td></tr>`).join("")||'<tr><td colspan="8" class="label">ما في فعاليات. أضفها من إدارة الزوم بالأكاديمية.</td></tr>'}</tbody></table></div>
      <p class="v3-note">إضافة الفعاليات وروابط الحضور والتذكير وتسجيل الحضور من إدارة دروس الزوم بالأكاديمية مثل قبل. حضور الفعالية يعطي نقاط تلقائياً.</p></section>`;
    el.onclick=async e=>{const b=e.target.closest("[data-sv]");if(!b)return;const tr=b.closest("tr"),v=k=>tr.querySelector(`[data-k="${k}"]`);try{await A.aSessionSet(+b.dataset.sv,{kind:v("kind").value,capacity:v("capacity").value===""?null:+v("capacity").value,cert:v("cert").checked});V4.toast("💾 انحفظت")}catch(err){V4.toast(V4.err(err),1)}}},
  // ---------- التسويق ----------
  async g_mkt(el){const A=V4.api(),[C,P,L]=await Promise.all([A.aCamps(),A.aPromos(),A.aComps()]);const base=location.origin+location.pathname.replace(/[^/]*$/,"");
    el.innerHTML=`<section class="panel"><div class="v2-h" style="margin:0 0 10px"><h3 style="margin:0;font-size:15px">📋 مقارنة الحملات</h3></div><div class="v3-tw"><table class="v3-tb"><thead><tr><th>الحملة</th><th>الهدف</th><th>القناة</th><th>الزيارات</th><th>التسجيلات</th><th>تفعيل</th><th>اشتركوا بالمسابقة</th><th>التحويل</th><th>الرابط</th></tr></thead><tbody>
      ${(C||[]).map(c=>`<tr><td><b>${esc(c.name)}</b>${c.active?"":' <span class="chip">موقوفة</span>'}</td><td>${esc(c.goal)}</td><td>${esc(c.channel)}</td><td class="num">${c.visits}</td><td class="num">${c.signups}</td><td class="num">${c.activated}</td><td class="num">${c.joins}</td><td class="num ${c.conv>=10?"up":""}">${c.conv??0}%</td><td><button class="btn v2s" type="button" data-cp="${escA(base+(c.comp_id?"app.html?c="+c.code+"#comp/"+c.comp_id:"?c="+c.code))}">📋 ${esc(c.code)}</button></td></tr>`).join("")||'<tr><td colspan="9" class="label">ما في حملات بعد.</td></tr>'}</tbody></table></div></section>
      <div class="v3-grid2"><section class="panel"><h3 style="margin:0 0 10px;font-size:15px">＋ حملة جديدة</h3><div class="k-form" style="grid-template-columns:1fr 1fr"><label>اسم الحملة<input class="f" id="cpN"></label><label>الكود بالرابط (حروف إنكليزية صغيرة)<input class="f ltr" id="cpC" placeholder="gold-tg"></label>
          <label>الهدف<select class="f" id="cpG"><option value="signup">تسجيلات</option><option value="comp">مسابقة</option><option value="giveaway">سحب</option><option value="event">فعالية</option></select></label><label>القناة<select class="f" id="cpCh"><option>telegram</option><option>whatsapp</option><option>instagram</option><option>tiktok</option><option>youtube</option><option>other</option></select></label>
          <label>مربوطة بمسابقة (اختياري)<select class="f" id="cpComp"><option value="">—</option>${(L||[]).filter(x=>x.status!=="draft").map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join("")}</select></label><label>ينتهي العرض<input class="f ltr" type="datetime-local" id="cpE"></label></div>
        <div class="v3-act"><button class="btn primary" type="button" id="cpGo">＋ أنشئ الحملة</button></div><p class="v3-note">الرسائل التسويقية تروح بس للأعضاء اللي وافقوا عليها بإعدادات الإشعارات، وكل إيميل بيه إلغاء اشتراك.</p></section>
        <section class="panel"><h3 style="margin:0 0 10px;font-size:15px">🎟 الأكواد الترويجية</h3><div class="v3-slist">${(P||[]).map(p=>`<div class="v3-srow${p.active?"":" off"}"><b class="num ltr">${esc(p.code)}</b><span class="label">خصم ${p.pct}% · استُخدم ${p.used}${p.max_uses?" من "+p.max_uses:""}${p.ends_at?" · ينتهي "+new Date(p.ends_at).toLocaleDateString(window.LANG||"ar"):""}</span><button class="btn v2s" type="button" data-pt="${escA(p.code)}" data-on="${p.active?0:1}">${p.active?"⏸ إيقاف":"▶ تفعيل"}</button></div>`).join("")||'<p class="label" style="margin:0">ما في أكواد.</p>'}</div>
          <div class="k-form" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:10px"><input class="f ltr" id="pcC" placeholder="GOLD30"><input class="f ltr" id="pcP" type="number" min="1" max="100" placeholder="%"><input class="f ltr" id="pcM" type="number" min="1" placeholder="أقصى استخدام"><input class="f ltr" id="pcE" type="date"></div>
          <div class="v3-act"><button class="btn" type="button" id="pcGo">＋ أضف كود</button></div><p class="v3-note">الأكواد تنحفظ وتنتابع هنا. تطبيق الخصم تلقائياً عند الدفع ما فعّلته لأنه يمس نظام الدفع، ويحتاج موافقتك أول.</p></section></div>`;
    $("cpGo").onclick=async()=>{const r={name:$("cpN").value.trim(),code:$("cpC").value.trim().toLowerCase(),goal:$("cpG").value,channel:$("cpCh").value,comp_id:+$("cpComp").value||null,ends_at:V4.iso($("cpE").value)};
      if(!r.name||!/^[a-z0-9-]{2,40}$/.test(r.code))return V4.toast("اكتب اسم الحملة وكود بحروف إنكليزية صغيرة وأرقام",1);try{await A.aCampSave(r);V4.toast("✅ انشأت الحملة");V4.gRender()}catch(e){V4.toast(V4.err(e),1)}};
    $("pcGo").onclick=async()=>{const r={code:$("pcC").value.trim().toUpperCase(),pct:+$("pcP").value,max_uses:+$("pcM").value||null,ends_at:$("pcE").value?new Date($("pcE").value+"T23:59").toISOString():null,active:true};
      if(!/^[A-Z0-9]{3,20}$/.test(r.code)||!r.pct)return V4.toast("الكود 3–20 حرف إنكليزي/رقم والنسبة لازم",1);try{await A.aPromoSave(r);V4.gRender()}catch(e){V4.toast(V4.err(e),1)}};
    if(DB.marketing)DB.marketing.rpc("vx_marketing_access").then(access=>{if(access?.owner&&el.isConnected&&V4.gt==="mkt"){const link=document.createElement("a");link.className="btn";link.href="#growth/marketing-ai";link.textContent="VEXORA AI MARKETING SYSTEM";el.prepend(link)}}).catch(()=>{});
    el.onclick=async e=>{const cp=e.target.closest("[data-cp]"),pt=e.target.closest("[data-pt]");if(cp)copyTxt(cp.dataset.cp,cp);if(pt){try{await A.aPromoSave({code:pt.dataset.pt,active:pt.dataset.on==="1"});V4.gRender()}catch(err){V4.toast(V4.err(err),1)}}}},
  // ---------- الإحالات ----------
  async g_refs(el){const R=await V4.api().aRef()||[];el.innerHTML=`<section class="panel"><h3 style="margin:0 0 10px;font-size:15px">🔗 مراقبة الإحالات</h3><div class="v3-tw"><table class="v3-tb"><thead><tr><th>العضو</th><th>سجّلوا</th><th>مؤهلة</th><th>حسابات مكررة</th><th>الحالة</th></tr></thead><tbody>
    ${R.map(r=>`<tr><td>${esc(r.name)}</td><td class="num">${r.total}</td><td class="num up">${r.qualified}</td><td class="num ${r.dup?"down":""}">${r.dup}</td><td>${r.flag||r.dup>2?'<span class="chip down">⚠️ تحتاج فحص</span>':'<span class="chip up">سليم</span>'}</td></tr>`).join("")||'<tr><td colspan="5" class="label">ما في إحالات بعد.</td></tr>'}</tbody></table></div>
    <p class="v3-note">الإحالة تنحسب مؤهلة لمن العضو يتفعّل ويخلّص أول درس. نفس الإيميل (حتى مع النقاط أو +) أو نفس رقم التلفون ما تنحسب. مكافآت الإحالة نقاط تعليمية بس، وما إلها علاقة بالإيداع أو حجم التداول.</p></section>`},
  // ---------- التقارير ----------
  async g_reports(el){const G=await V4.api().aGrowth()||{},d=G.signups_prev?Math.round((G.signups_30-G.signups_prev)/G.signups_prev*100):null,mx=Math.max(1,...(G.sources||[]).map(s=>s.n));
    el.innerHTML=`<div class="v3-sum"><div class="v2-t"><span>تسجيلات جديدة (30 يوم)</span><b class="num">${G.signups_30}</b><small>${d==null?"":(d>=0?"+":"")+d+"% عن الشهر الماضي"}</small></div><div class="v2-t"><span>نشطين هذا الأسبوع</span><b class="num">${G.active_week}</b><small>${G.active_month} بالشهر</small></div>
      <div class="v2-t"><span>مشاركين بالمسابقات (أسبوع)</span><b class="num">${G.participants_week}</b><small>معدل الإكمال ${G.completion??0}%</small></div><div class="v2-t"><span>الاحتفاظ بعد 30 يوم</span><b class="num gold">${G.retention_30??"—"}%</b></div></div>
      <div class="v3-sum"><div class="v2-t"><span>الفائزين</span><b class="num">${G.winners}</b></div><div class="v2-t"><span>جوائز مسلّمة</span><b class="num up">${G.delivered}</b><small>${G.pending_claims} بالانتظار</small></div><div class="v2-t"><span>مشاركات للمراجعة</span><b class="num gold">${G.pending_entries}</b></div><div class="v2-t"><span>نقاط هذا الشهر</span><b class="num">${(+G.points_month).toLocaleString("en-US")}</b><small>${G.visits_30} زيارة من الحملات</small></div></div>
      <section class="panel"><h3 style="margin:0 0 10px;font-size:15px">📍 مصادر التسجيل (30 يوم)</h3><div class="v3-slist">${(G.sources||[]).map(s=>`<div class="v3-srow"><span style="min-width:140px">${esc(s.src)}</span><div class="k-seat" style="flex:1"><i style="width:${s.n/mx*100}%"></i></div><b class="num">${s.n}</b></div>`).join("")||'<p class="label" style="margin:0">ما في تسجيلات بعد.</p>'}</div></section>`},
  async g_audit(el){let L=[];try{L=await DB.adminActivity(60)||[]}catch(e){}el.innerHTML=`<section class="panel"><h3 style="margin:0 0 10px;font-size:15px">🧾 سجل التدقيق (آخر 60 عملية)</h3><div class="v3-tl">${L.map(x=>`<div><span>${ago(x.at)}</span><span>${esc(x.actor_name||"")} · <b>${esc(x.action)}</b> ${esc(x.target||"")}</span><span class="label">${x.details&&x.details.title?esc(x.details.title):""}</span></div>`).join("")||'<p class="label" style="margin:0">ما أكو عمليات مسجّلة.</p>'}</div><p class="v3-note">كل عملية حساسة (مسابقات، فائزين، جوائز، تسليم، سحوبات، نقاط، حملات) تنسجل تلقائياً باسم الأدمن.</p></section>`}
});

setTimeout(()=>{try{V4.track()}catch(e){}},0)


/* ================= V5: VEXORA NEWS · الشركاء (النواة) ================= */
const L5=(ar,en)=>{const l=window.LANG||"ar";if(l==="ar")return ar;if(l==="uz"||l==="ckb"||l==="kmr"||l==="tr"){try{if(typeof ar==="string"&&typeof en==="string")(window.__L5||(window.__L5={}))[ar.trim()]=en}catch(e){}return ar}return en};
const V5={
  api(){return DB.v5},
  toast(t,bad){try{V3.toast(t,bad)}catch(e){alert(t)}},
  err(e){return String(e&&e.message||e||"").replace(/^[A-Z_]+:\s*/,"")},
  demoBadge(){return V5.api()&&V5.api().demo?`<span class="n-demo">🧪 ${L5("معاينة محلية · بيانات تجريبية مو أخبار حقيقية","Local preview · demo data, not real news")}</span>`:""},
  view(v,a){
    const map={news:"v5NewsView",partners:"v5PartView",newsadm:"v5NewsAdmView",partadm:"v5PartAdmView"};
    Object.entries(map).forEach(([k,id])=>{const el=$(id);if(el)el.hidden=k!==v});
    clearInterval(V5._t);
    if(v==="news")V5N.open(a||"");else if(v==="partners")V5P.open(a||"");else if(v==="newsadm")V5NA.open(a||"");else if(v==="partadm")V5PA.open(a||"");
    if(v==="news"||v==="partners")V5._t=setInterval(V5.tick,1000);
  },
  // عدّاد تنازلي من وقت الحدث الحقيقي فقط
  cd(at){return`<div class="n-tm" data-ncd="${escA(at)}"></div>`},
  tick(){document.querySelectorAll("[data-ncd]").forEach(el=>{let s=Math.max(0,Math.floor((new Date(el.dataset.ncd)-Date.now())/1000));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;const p=x=>String(x).padStart(2,"0");
    const parts=(d?[[d,L5("يوم","day")]]:[]).concat([[h,L5("ساعة","hr")],[m,L5("دقيقة","min")],[s,L5("ثانية","sec")]]);el.innerHTML=parts.map(([v,l])=>`<div><b>${p(v)}</b><span>${l}</span></div>`).join("")})},
  track(){return window.VexoraAttribution?.visit("partner",(c,a)=>V5.api().visit(c,a))?.catch(()=>{})},
  async afterLogin(){
    const userId=ME.user?.id, attribution=window.VexoraAttribution;
    if(!userId||!attribution)return;
    // Capture the current URL before assigning a stored referral on a restored session.
    const visit=V5.track();
    try{await attribution.assign("partner",userId,c=>V5.api().setRef(c))}catch(e){}
    await visit;
  }
};

/* ---------- VEXORA NEWS ---------- */
const V5N={tab:"",cat:"all",calTab:"today",calQ:"",calCc:null,ev:[],evAt:0,
  FLAG:{USD:"🇺🇸",EUR:"🇪🇺",GBP:"🇬🇧",JPY:"🇯🇵",AUD:"🇦🇺",CAD:"🇨🇦",CHF:"🇨🇭",NZD:"🇳🇿",CNY:"🇨🇳",XAU:"🥇"},
  CC:["USD","EUR","GBP","JPY","AUD","CAD","CHF","NZD","CNY"],
  imp(i){const k=i==="High"?"h":i==="Medium"?"m":i==="Low"?"l":"";return`<span class="n-imp ${k}" title="${escA(i)}"><i></i><i></i><i></i></span>`},
  name(e){const ar=e.title_ar||(typeof econAr==="function"?econAr(e.title):"");return L5(ar||e.title,e.title)},
  sub(e){return L5(e.title_ar||(typeof econAr==="function"&&econAr(e.title))?e.title:"",[e.title_ar].filter(Boolean)[0]||"")},
  st(e){const now=Date.now(),t=new Date(e.at).getTime();
    if(e.status==="cancelled")return["can",L5("⛔ ملغى","⛔ Cancelled")];if(e.status==="postponed")return["post",L5("⏸ مؤجل","⏸ Postponed")];
    if(e.actual)return["done",L5("✅ صدرت النتيجة","✅ Released")];if(t<=now&&now-t<3*36e5)return["live",L5("⏳ جارٍ · بانتظار النتيجة","⏳ Live · awaiting result")];
    if(t<=now)return["live",L5("بانتظار النتيجة","Awaiting result")];return["up",L5("⏳ قادم","⏳ Upcoming")]},
  n(x){return`<bdi dir="ltr">${esc(x)}</bdi>`},
  hm(at){return new Date(at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})},
  day(at){return new Date(at).toLocaleDateString(L5("ar","en-GB"),{weekday:"long",day:"numeric",month:"long"})},
  dshort(at){const d=new Date(at),k=d.toLocaleDateString("en-CA"),t=new Date().toLocaleDateString("en-CA"),tm=new Date(Date.now()+864e5).toLocaleDateString("en-CA"),y=new Date(Date.now()-864e5).toLocaleDateString("en-CA");
    return k===t?L5("اليوم","Today"):k===tm?L5("باجر","Tomorrow"):k===y?L5("أمس","Yesterday"):d.toLocaleDateString(L5("ar","en-GB"),{weekday:"short",day:"numeric"})},
  async load(force){if(!force&&Date.now()-V5N.evAt<60000&&V5N.ev.length)return V5N.ev;
    try{V5N.ev=await V5.api().events(new Date(Date.now()-8*864e5).toISOString(),new Date(Date.now()+9*864e5).toISOString())||[];V5N.evAt=Date.now()}catch(e){V5.toast(V5.err(e),1)}return V5N.ev},
  head(){const T=[["","📰 "+L5("الأخبار","News")],["calendar","📅 "+L5("التقويم الاقتصادي","Economic calendar")],["alerts","🔔 "+L5("تنبيهاتي","My alerts")],["channel","✈️ "+L5("قناة الأخبار","News channel")]];
    const t=V5N.tab.startsWith("ev/")?"":V5N.tab;
    return`<div class="panel"><div class="n-hd"><h2>📰 VEXORA NEWS | ${L5("أخبار فيكسورا","News")}<small>${L5("الأخبار والأحداث اللي تحرك الذهب والعملات، بتوقيت جهازك","News and events that move gold and FX, in your local time")}</small></h2><div class="k-row">${V5.demoBadge()}${can("news")?`<a class="btn v2s" href="#admin/news">🛠 ${L5("إدارة الأخبار","Manage news")}</a>`:""}</div></div>
      <nav class="n-nav" style="margin-top:12px">${T.map(([k,l])=>`<a href="#news${k?"/"+k:""}" class="${k===t?"on":""}">${l}</a>`).join("")}</nav></div>`},
  async open(a){V5N.tab=a;const b=$("v5NewsBody");if(!b)return;
    if(a==="economic-calendar")V5N.tab="calendar";
    b.innerHTML=V5N.head()+`<div class="panel label">${L5("جاري التحميل…","Loading…")}</div>`;
    try{if(V5N.tab.startsWith("ev/"))await V5N.evPage(decodeURIComponent(V5N.tab.slice(3)));else if(V5N.tab==="calendar")await V5N.cal();else if(V5N.tab==="alerts")await V5N.alerts();else if(V5N.tab==="channel")await V5N.channel();else await V5N.home()}
    catch(e){b.innerHTML=V5N.head()+`<div class="panel rc-empty">⚠️ ${esc(V5.err(e))}</div>`}
    V5.tick()},
  evRow(e){const[sc,sl]=V5N.st(e);return`<a class="n-ev" href="#news/ev/${encodeURIComponent(e.id)}"><div class="t">${V5N.hm(e.at)}<small>${V5N.dshort(e.at)}</small></div><div><h5>${V5N.FLAG[e.country]||"🌐"} <b>${esc(e.country)}</b> · ${esc(V5N.name(e))} ${V5N.imp(e.impact)}${e.manual?` <span class="n-tag man">${L5("من فيكسورا","VEXORA")}</span>`:""}</h5>
    <p><bdi dir="ltr">${esc(e.title)}</bdi>${e.previous?` · ${L5("السابق","Prev")} ${V5N.n(e.previous)}`:""}${e.forecast?` · ${L5("المتوقع","Fcst")} ${V5N.n(e.forecast)}`:""}${e.actual?` · <b>${L5("الفعلي","Actual")} ${V5N.n(e.actual)}</b>`:""}</p></div><span class="n-s ${sc}">${sl}</span></a>`},
  catOk(e){const c=V5N.cat;return c==="all"||(c==="gold"&&e.country==="USD")||(c==="usd"&&e.country==="USD")||(c==="eur"&&e.country==="EUR")||(c==="high"&&e.impact==="High")||e.category===c},
  async home(){const[ev,fd]=await Promise.all([V5N.load(true),V5.api().feed().catch(()=>({articles:[],headlines:[]}))]);const now=Date.now();
    const vis=ev.filter(e=>e.status!=="cancelled"&&V5N.catOk(e)),tk=new Date().toLocaleDateString("en-CA");
    const today=vis.filter(e=>new Date(e.at).toLocaleDateString("en-CA")===tk&&e.impact!=="Low"),nx=ev.find(e=>e.impact==="High"&&e.status==="upcoming"&&new Date(e.at)>now&&V5N.catOk(e));
    const wk=vis.filter(e=>e.impact==="High"&&new Date(e.at)>now-36e5&&new Date(e.at)<now+7*864e5).slice(0,6);
    const art=(fd.articles||[]).filter(a=>V5N.cat==="all"||a.category===V5N.cat||(V5N.cat==="usd"&&a.ccy==="USD")||(V5N.cat==="eur"&&a.ccy==="EUR")),brk=(fd.articles||[]).find(a=>a.breaking&&now-new Date(a.published_at)<24*36e5);
    const ago=t=>{const m=Math.max(1,Math.round((now-new Date(t))/6e4));return m<60?L5(`قبل ${m} دقيقة`,`${m} min ago`):m<1440?L5(`قبل ${Math.round(m/60)} ساعة`,`${Math.round(m/60)} h ago`):L5(`قبل ${Math.round(m/1440)} يوم`,`${Math.round(m/1440)} d ago`)};
    const CI={gold:"🥇",usd:"💵",eur:"🇪🇺",rates:"🏦",inflation:"📈",jobs:"👷",analysis:"✍️",breaking:"⚡",fx:"💱",fed:"🏦",oil:"🛢",crypto:"₿",stocks:"📊"};
    const C=[["all",L5("الكل","All")],["gold","🥇 "+L5("الذهب XAUUSD","Gold XAUUSD")],["usd","🇺🇸 "+L5("الدولار","USD")],["eur","🇪🇺 "+L5("اليورو","EUR")],["rates","🏦 "+L5("الفائدة","Rates")],["inflation","📈 "+L5("التضخم","Inflation")],["jobs","👷 "+L5("البطالة والوظائف","Jobs")],["high","🔴 "+L5("القوية بس","High impact")]];
    const ch=fd.channel||"";
    $("v5NewsBody").innerHTML=V5N.head()+
      (brk?`<div class="panel n-brk"><b class="l">${L5("عاجل","BREAKING")}</b><span>${esc(L5(brk.title,brk.title_en||brk.title))}</span><span class="label" style="margin-inline-start:auto;font-size:12px">${ago(brk.published_at)}</span></div>`:"")+
      (nx?`<div class="panel n-cd"><div><span class="label">🔴 ${L5("الخبر القوي الجاي","Next high-impact event")}</span><h3>${V5N.FLAG[nx.country]||"🌐"} ${esc(nx.country)} · ${esc(V5N.name(nx))} ${V5N.imp(nx.impact)}</h3>
        <div class="label" style="font-size:12.5px">${esc(V5N.day(nx.at))} · ${V5N.hm(nx.at)} ${L5("بتوقيت جهازك","your time")}${nx.previous?` · ${L5("السابق","Prev")} ${V5N.n(nx.previous)}`:""}${nx.forecast?` · ${L5("المتوقع","Fcst")} ${V5N.n(nx.forecast)}`:""}</div>
        <div class="n-btns" style="margin-top:10px"><a class="btn primary" href="#news/ev/${encodeURIComponent(nx.id)}">${L5("التفاصيل ←","Details →")}</a><button class="btn" type="button" data-nalert="${escA(nx.id)}">🔔 ${L5("نبهني","Alert me")}</button>${ch?`<a class="btn" href="${escA(ch)}" target="_blank" rel="noopener">✈️ ${L5("قناة الأخبار","News channel")}</a>`:""}</div></div>${V5.cd(nx.at)}</div>`
        :`<div class="panel label">${ev.length?L5("ما أكو أخبار قوية جاية بهذا الفلتر.","No upcoming high-impact news for this filter."):L5("التقويم بعده ما تحمّل.","Calendar not loaded yet.")}</div>`)+
      `<div class="k-tabs n-cats">${C.map(([k,l])=>`<button type="button" data-ncat="${k}" class="${k===V5N.cat?"on":""}">${l}</button>`).join("")}</div>
      <div class="k-g2"><div class="panel"><div class="n-hd"><h3 style="margin:0">📌 ${L5("أهم أحداث اليوم","Today's key events")}</h3><a class="gold" style="font-size:13px" href="#news/calendar">${L5("التقويم الكامل ←","Full calendar →")}</a></div>${today.length?today.map(V5N.evRow).join(""):`<p class="label">${L5("ما أكو أحداث مهمة اليوم بهذا الفلتر.","No key events today for this filter.")}</p>`}</div>
      <div style="display:grid;gap:12px;align-content:start"><div class="panel"><h3 style="margin:0 0 4px">🗞 ${L5("آخر الأخبار","Latest news")}</h3>
        ${art.slice(0,4).map(a=>`<div class="n-art"><div class="im">${a.image_url?`<img src="${escA(a.image_url)}" alt="" loading="lazy">`:(CI[a.category]||"📰")}</div><div><h5>${esc(L5(a.title,a.title_en||a.title))} ${a.source_name==="VEXORA"?`<span class="n-tag man">${L5("من فيكسورا","VEXORA")}</span>`:""}</h5>${a.body?`<p class="n-ab">${esc(L5(a.body,a.body_en||a.body)).slice(0,220)}</p>`:""}<p>${esc(a.ccy||"")} · ${ago(a.published_at)}${a.source_url?` · <a href="${escA(a.source_url)}" target="_blank" rel="noopener">${L5("المصدر","Source")} ↗</a>`:""}</p></div></div>`).join("")}
        ${(fd.headlines||[]).slice(0,Math.max(0,6-Math.min(4,art.length))).map(h=>`<div class="n-art"><div class="im">${CI[h.cat]||"📰"}</div><div><h5><a href="${escA(h.link)}" target="_blank" rel="noopener nofollow">${esc(h.title)}</a></h5><p>${esc(h.feed||"")} · ${ago(h.at)} · ${L5("المصدر","Source")} ↗</p></div></div>`).join("")}
        ${!art.length&&!(fd.headlines||[]).length?`<p class="label">${L5("ما أكو أخبار منشورة حالياً.","No news published yet.")}</p>`:""}</div>
        <div class="panel"><h3 style="margin:0 0 8px">🗓 ${L5("أهم أحداث الأسبوع","Key events this week")}</h3>${wk.length?wk.map(e=>`<a class="n-pv" href="#news/ev/${encodeURIComponent(e.id)}"><span>${V5N.FLAG[e.country]||"🌐"} ${esc(V5N.name(e))} ${V5N.imp(e.impact)}</span><span class="label">${V5N.dshort(e.at)} ${V5N.hm(e.at)}</span></a>`).join(""):`<p class="label">—</p>`}</div>
        ${ch?`<div class="panel n-tg"><div class="ic">✈️</div><div><b>${L5("قناة VEXORA NEWS على تيليجرام","VEXORA NEWS on Telegram")}</b><p class="label" style="margin:4px 0 8px;font-size:12.5px">${L5("تذكير قبل الأخبار القوية، والنتيجة أول ما تنزل.","Reminders before high-impact news and results as they land.")}</p><a class="btn primary" href="${escA(ch)}" target="_blank" rel="noopener">${L5("انضم للقناة","Join channel")}</a></div></div>`:""}</div></div>
      <p class="v3-note">${L5("المحتوى تعليمي ومو توصية. الأوقات بتوقيت جهازك وتنحفظ بالسيرفر بصيغة UTC.","Educational content, not advice. Times shown in your local time; stored in UTC.")}</p>`;
    $("v5NewsBody").querySelectorAll("[data-ncat]").forEach(x=>x.onclick=()=>{V5N.cat=x.dataset.ncat;V5N.home()});
    V5N.bindAlert()},
  bindAlert(){$("v5NewsBody").querySelectorAll("[data-nalert]").forEach(x=>x.onclick=async()=>{const e=V5N.ev.find(y=>y.id===x.dataset.nalert)||V5N.cur;if(!e)return;
    try{const m=await V5.api().myNews(),p=m.prefs||{};const ccys=[...new Set([...(p.ccys||[]),e.country])],imps=[...new Set([...(p.impacts||[]),e.impact])].filter(i=>["High","Medium","Low"].includes(i));
      await V5.api().savePrefs({...p,ccys,impacts:imps,leads:(p.leads&&p.leads.length?p.leads:[30]),paused:false,in_site:p.in_site!==false,on_result:p.on_result!==false});
      V5.toast(L5(`✅ تفعّل التنبيه لأخبار ${e.country} (${e.impact}). تعدّلها من «تنبيهاتي».`,`✅ Alerts on for ${e.country} (${e.impact}). Edit in «My alerts».`))}catch(er){V5.toast(V5.err(er),1)}})},
  // ---------- صفحة الحدث ----------
  async evPage(id){const e=await V5.api().event(id);const b=$("v5NewsBody");
    if(!e){b.innerHTML=V5N.head()+`<div class="panel rc-empty">${L5("الحدث مو موجود أو انحذف من المصدر.","Event not found.")} <a class="gold" href="#news/calendar">${L5("التقويم ←","Calendar →")}</a></div>`;return}
    V5N.cur=e;const[sc,sl]=V5N.st(e),cmp=(()=>{const n=x=>parseFloat(String(x).replace(/[^0-9.\-]/g,""));const a=n(e.actual),f=n(e.forecast);return isNaN(a)||isNaN(f)?"":a>f?"up":a<f?"down":"eq"})();
    const LOGK={created:L5("➕ انضاف الحدث","➕ Event added"),updated:L5("✏️ تحديث بيانات","✏️ Data updated"),rescheduled:L5("🕐 تغيّر الموعد","🕐 Rescheduled"),actual:L5("✅ نزلت النتيجة الفعلية","✅ Actual released"),status:L5("🔁 تغيّرت الحالة","🔁 Status changed"),sent:L5("✈️ انرسل إشعار للقناة","✈️ Channel notified")};
    const KN={actual:L5("الفعلي","actual"),forecast:L5("المتوقع","forecast"),previous:L5("السابق","previous"),at:L5("الموعد","time"),status:L5("الحالة","status"),impact:L5("التأثير","impact"),title:L5("العنوان","title")},SK={r60:L5("تذكير قبل 60 دقيقة","60-min reminder"),r30:L5("تذكير قبل 30 دقيقة","30-min reminder"),r15:L5("تذكير قبل 15 دقيقة","15-min reminder"),result:L5("النتيجة","result"),test:"test"};
    const fv=(k,x)=>V5N.n(k==="at"&&x?new Date(x).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):x||"—");
    const chg=c=>Object.entries(c||{}).filter(([k])=>!["source","manual","chat"].includes(k)).map(([k,v])=>k==="kind"?esc(SK[v]||v):Array.isArray(v)?`${esc(KN[k]||k)}: ${fv(k,v[0])} ← ${fv(k,v[1])}`:`${esc(KN[k]||k)}: ${esc(v)}`).join(" · ");
    const expl=e.actual&&cmp&&cmp!=="eq"?(()=>{const usd=e.country==="USD",hot=["inflation","rates","jobs","gdp","pmi"].includes(e.category);if(!hot)return L5("قارن الرقم الفعلي بالمتوقع: الفرق الكبير عادة يسبب حركة سريعة.","Compare actual vs forecast: big surprises usually cause sharp moves.");
      const strong=cmp==="up"&&e.category!=="jobs"||cmp==="up"&&/claims|unemployment rate/i.test(e.title)===false;
      return L5(`الفعلي ${cmp==="up"?"أعلى":"أقل"} من المتوقع. ${usd?`هذا عادة ${(cmp==="up")!==(/claims|unemployment rate/i.test(e.title))?"يدعم الدولار ويضغط على الذهب":"يضغط على الدولار ويدعم الذهب"}`:"هذا عادة يأثر على عملة "+e.country+" باتجاه المفاجأة"}.`,
        `Actual came in ${cmp==="up"?"above":"below"} forecast. ${usd?`This usually ${(cmp==="up")!==(/claims|unemployment rate/i.test(e.title))?"supports USD and weighs on gold":"weighs on USD and supports gold"}`:"This usually moves "+e.country+" in the direction of the surprise"}.`)})():"";
    const ch=e.channel||"";
    b.innerHTML=V5N.head()+`<div class="panel"><div class="n-hd"><div><span class="label"><a class="gold" href="#news/calendar">📅 ${L5("التقويم","Calendar")}</a> ← ${L5("حدث اقتصادي","Economic event")}</span><h2 style="margin:6px 0">${V5N.FLAG[e.country]||"🌐"} ${esc(V5N.name(e))} ${V5N.imp(e.impact)}</h2><div class="label ltr" style="text-align:start">${esc(e.title)} · ${esc(e.country)}</div></div><span class="n-s ${sc}" style="font-size:13px;padding:6px 14px">${sl}</span></div>
      <div class="k-row" style="margin-top:10px;font-size:13px"><span class="chip">🕐 ${esc(V5N.day(e.at))} ${V5N.hm(e.at)} ${L5("بتوقيت جهازك","your time")}</span><span class="chip">${L5("التأثير","Impact")}: ${esc(e.impact)}</span><span class="chip">${e.manual?`<span class="n-tag man">${L5("حدث يدوي من فيكسورا","Manual · VEXORA")}</span>`:`${L5("مستورد من مزود البيانات","Imported from data provider")} <span class="n-tag ext">${esc(e.source)}</span>`}</span></div></div>
      ${e.status==="upcoming"&&!e.actual&&new Date(e.at)>Date.now()?`<div class="panel n-cd"><div><span class="label">⏳ ${L5("باقي على الخبر","Time to release")}</span><h3 style="margin:4px 0">${V5N.hm(e.at)}</h3></div>${V5.cd(e.at)}</div>`:""}
      <div class="n-vals"><div><span>${L5("السابق","Previous")}</span><b>${V5N.n(e.previous||"—")}</b></div><div><span>${L5("المتوقع","Forecast")}</span><b>${V5N.n(e.forecast||"—")}</b></div><div class="${e.actual?"act":""}"><span>${L5("الفعلي","Actual")}</span><b>${e.actual?V5N.n(e.actual):`<small class="label">${L5("بانتظار النتيجة","Awaiting result")}</small>`}</b></div></div>
      <div class="k-g2"><div class="panel">${expl?`<h3 style="margin:0 0 6px">📈 ${L5("شنو يعني هالرقم؟","What does it mean?")}</h3><p class="label" style="line-height:1.9;margin:0">${esc(expl)} <b>${L5("هذا شرح تعليمي، مو توصية.","Educational, not advice.")}</b></p>`:""}
        ${e.note?`<p style="line-height:1.9">${esc(e.note)}</p>`:""}
        <h3 style="margin:${expl?"16px":"0"} 0 6px">🧾 ${L5("سجل التحديثات","Update log")}</h3><div class="n-log">${(e.log||[]).map(l=>`<div><span>${new Date(l.at).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span>${LOGK[l.kind]||esc(l.kind)}${chg(l.changes)?` <small class="label">${chg(l.changes)}</small>`:""}</span></div>`).join("")||`<p class="label">—</p>`}</div></div>
      <div style="display:grid;gap:12px;align-content:start"><div class="panel"><h3 style="margin:0 0 10px">⚡ ${L5("إجراءات","Actions")}</h3><div style="display:grid;gap:8px"><button class="btn primary" type="button" data-nalert="${escA(e.id)}">🔔 ${L5("فعّل التنبيه لهذا الحدث","Alert me for this")}</button><button class="btn" type="button" id="nShare">🔗 ${L5("شارك الحدث","Share event")}</button>${ch?`<a class="btn" href="${escA(ch)}" target="_blank" rel="noopener">✈️ ${L5("انضم لقناة الأخبار","Join news channel")}</a>`:""}</div></div>
        <div class="panel"><h3 style="margin:0 0 8px">ℹ️ ${L5("المصدر","Source")}</h3><div class="label" style="font-size:12.5px;line-height:2">${L5("المزود","Provider")}: <b>${esc(e.manual?"VEXORA":e.source)}</b>${e.source_url?` · <a href="${escA(e.source_url)}" target="_blank" rel="noopener">↗</a>`:""}<br>${L5("آخر تحديث","Last update")}: ${new Date(e.updated_at).toLocaleString("en-GB")}<br><small>${L5("الأوقات محفوظة UTC وتظهر بتوقيتك.","Stored in UTC, shown in your time.")}</small></div></div>
        ${(e.related||[]).length?`<div class="panel"><h3 style="margin:0 0 8px">🔗 ${L5("أحداث مرتبطة","Related events")}</h3>${e.related.map(r=>{const[rc,rl]=V5N.st(r);return`<a class="n-pv" href="#news/ev/${encodeURIComponent(r.id)}"><span>${V5N.FLAG[r.country]||"🌐"} ${esc(V5N.name(r))}</span><span class="n-s ${rc}">${V5N.dshort(r.at)}</span></a>`}).join("")}</div>`:""}</div></div>`;
    V5N.bindAlert();
    $("nShare").onclick=async()=>{const url=location.origin+location.pathname+"#news/ev/"+encodeURIComponent(e.id),t=V5N.name(e)+" · VEXORA NEWS";try{if(navigator.share){await navigator.share({title:t,url});return}}catch(x){}try{await navigator.clipboard.writeText(url);V5.toast(L5("✅ انسخ الرابط","✅ Link copied"))}catch(x){prompt("URL",url)}};
    clearTimeout(V5N._et);if(e.status==="upcoming"&&!e.actual&&Math.abs(new Date(e.at)-Date.now())<3*36e5)V5N._et=setTimeout(()=>{if(!$("v5NewsView").hidden&&V5N.tab==="ev/"+id)V5N.evPage(id)},60000)},
  // ---------- التقويم ----------
  async cal(){await V5N.load(true);V5N.calRender();clearInterval(V5N._ct);V5N._ct=setInterval(async()=>{if($("v5NewsView").hidden||V5N.tab!=="calendar"){clearInterval(V5N._ct);return}await V5N.load(true);V5N.calRender(true)},60000)},
  calRender(keep){const ev=V5N.ev,now=Date.now();if(!V5N.calCc){V5N.calCc=new Set(["USD","EUR","GBP","JPY"])}
    const day=k=>new Date(Date.now()+k*864e5).toLocaleDateString("en-CA"),T=V5N.calTab,q=V5N.calQ.trim().toLowerCase();
    const list=ev.filter(e=>V5N.calCc.has(e.country)&&(T==="week"?new Date(e.at)>now-864e5*1&&new Date(e.at)<now+7*864e5:T==="high"?e.impact==="High"&&new Date(e.at)>now-864e5:new Date(e.at).toLocaleDateString("en-CA")===day(T==="yday"?-1:T==="tom"?1:0))
      &&(!q||(e.title+" "+(e.title_ar||"")+" "+V5N.name(e)+" "+e.country).toLowerCase().includes(q)));
    const days={};list.forEach(e=>{const k=new Date(e.at).toLocaleDateString("en-CA");(days[k]=days[k]||[]).push(e)});
    const nx=ev.find(e=>V5N.calCc.has(e.country)&&e.status==="upcoming"&&!e.actual&&new Date(e.at)>now&&e.impact!=="Low");
    const TH=`<tr><th>${L5("الوقت","Time")}</th><th>${L5("العملة","Cur.")}</th><th>${L5("التأثير","Impact")}</th><th>${L5("الحدث","Event")}</th><th>${L5("الفعلي","Actual")}</th><th>${L5("المتوقع","Fcst")}</th><th class="hm">${L5("السابق","Prev")}</th><th></th></tr>`;
    const cc=[...new Set(ev.map(e=>e.country))].sort((a,b)=>(V5N.CC.indexOf(a)+99)%99-(V5N.CC.indexOf(b)+99)%99);
    const T5=[["yday",L5("أمس","Yesterday")],["today",L5("اليوم","Today")],["tom",L5("باجر","Tomorrow")],["week",L5("هذا الأسبوع","This week")],["high","🔴 "+L5("القوية بس","High only")]];
    const body=`<div class="panel"><div class="n-hd"><div class="k-tabs">${T5.map(([k,l])=>`<button type="button" data-ct="${k}" class="${k===T?"on":""}">${l}</button>`).join("")}</div><input class="f" id="nCalQ" type="search" placeholder="🔍 ${L5("دوّر على حدث…","Search events…")}" value="${escA(V5N.calQ)}" style="max-width:260px"></div>
      <div class="n-chk" style="margin-top:12px">${cc.map(c=>`<button type="button" data-cc="${escA(c)}" class="${V5N.calCc.has(c)?"on":""}">${V5N.FLAG[c]||"🌐"} ${esc(c)}</button>`).join("")}</div></div>
      ${nx?`<div class="panel n-cd"><div><span class="label">⏳ ${L5("الحدث الجاي","Next event")}</span><h3><a href="#news/ev/${encodeURIComponent(nx.id)}">${V5N.FLAG[nx.country]||"🌐"} ${esc(nx.country)} · ${esc(V5N.name(nx))}</a> ${V5N.imp(nx.impact)}</h3></div>${V5.cd(nx.at)}</div>`:""}
      ${Object.keys(days).sort().map(k=>`<div class="panel"><h4 class="n-day">${esc(V5N.day(k+"T12:00:00"))} ${k===day(0)?`<span class="chip acc">${L5("اليوم","Today")}</span>`:k===day(1)?`<span class="chip">${L5("باجر","Tomorrow")}</span>`:""}</h4>
        <div class="v3-tw"><table class="n-tbl">${TH}${days[k].map(e=>{const[sc,sl]=V5N.st(e),past=new Date(e.at)<now;return`<tr class="${e.impact==="High"?"hi":""}${e.status==="cancelled"?" can":""}" data-ev="${escA(e.id)}" tabindex="0"><td class="v">${V5N.hm(e.at)}</td><td>${V5N.FLAG[e.country]||"🌐"} <b>${esc(e.country)}</b></td><td>${V5N.imp(e.impact)}</td><td><a href="#news/ev/${encodeURIComponent(e.id)}">${esc(V5N.name(e))}</a>${e.manual?` <span class="n-tag man">VEXORA</span>`:""}</td>
          <td class="v">${e.actual?`<b>${V5N.n(e.actual)}</b>`:past?`<span class="label">${L5("بانتظار النتيجة","Awaiting")}</span>`:"—"}</td><td class="v">${V5N.n(e.forecast||"—")}</td><td class="v hm">${V5N.n(e.previous||"—")}</td><td><span class="n-s ${sc}">${sl}</span></td></tr>`}).join("")}</table></div></div>`).join("")||`<div class="panel rc-empty">${L5("ما أكو أحداث بهذا الفلتر.","No events for this filter.")}</div>`}
      <p class="v3-note">${L5("كل سطر يفتح صفحة الحدث نفسها بمركز الأخبار. يتحدث تلقائياً كل دقيقة. المصدر يظهر بصفحة كل حدث.","Each row opens the same event page in the news center. Auto-refreshes every minute. Source shown on each event page.")}</p>`;
    const b=$("v5NewsBody"),fo=document.activeElement&&document.activeElement.id==="nCalQ";b.innerHTML=V5N.head()+body;
    b.querySelectorAll("[data-ct]").forEach(x=>x.onclick=()=>{V5N.calTab=x.dataset.ct;V5N.calRender()});
    b.querySelectorAll("[data-cc]").forEach(x=>x.onclick=()=>{const c=x.dataset.cc;V5N.calCc.has(c)?V5N.calCc.delete(c):V5N.calCc.add(c);V5N.calRender()});
    b.querySelectorAll("tr[data-ev]").forEach(x=>x.onclick=e=>{if(e.target.closest("a"))return;location.hash="#news/ev/"+encodeURIComponent(x.dataset.ev)});
    const qi=$("nCalQ");qi.oninput=()=>{V5N.calQ=qi.value;clearTimeout(V5N._qt);V5N._qt=setTimeout(()=>{V5N.calRender();const n=$("nCalQ");n.focus();n.setSelectionRange(n.value.length,n.value.length)},250)};if(fo){qi.focus();qi.setSelectionRange(qi.value.length,qi.value.length)}
    V5.tick()},
  // ---------- التنبيهات ----------
  async alerts(){const m=await V5.api().myNews(),p=m.prefs||{};const b=$("v5NewsBody");
    const CC=["XAU","USD","EUR","GBP","JPY","CAD","AUD","CHF"],on=(arr,v)=>(arr||[]).map(String).includes(String(v));
    const chip=(g,v,l,arr)=>`<button type="button" class="${on(arr,v)?"on":""}" data-g="${g}" data-v="${escA(v)}" aria-pressed="${on(arr,v)}">${l}</button>`;
    const sw=(k,l,v)=>`<label class="n-sw"><span>${l}</span><input type="checkbox" data-sw="${k}" ${v?"checked":""}><i></i></label>`;
    b.innerHTML=V5N.head()+`<div class="k-g2"><div class="panel"><h3 style="margin:0 0 4px">🔔 ${L5("إعدادات تنبيهاتي","My alert settings")}</h3><p class="label" style="margin:0 0 12px;font-size:12.5px">${L5("اختار شنو يهمك، ونبهك بالمنصة أو على تيليجرام الخاص.","Choose what matters; we'll alert you in the platform or on private Telegram.")}${p.new?` <b>${L5("(ما محفوظة بعد)","(not saved yet)")}</b>`:""}</p>
      <div class="label" style="font-size:12.5px;margin-bottom:6px">${L5("العملات","Currencies")}</div><div class="n-chk">${CC.map(c=>chip("ccys",c,(V5N.FLAG[c]||"🌐")+" "+(c==="XAU"?"XAUUSD":c),p.ccys)).join("")}</div>
      <div class="label" style="font-size:12.5px;margin:14px 0 6px">${L5("درجة التأثير","Impact")}</div><div class="n-chk">${chip("impacts","High","🔴 "+L5("عالي","High"),p.impacts)}${chip("impacts","Medium","🟠 "+L5("متوسط","Medium"),p.impacts)}${chip("impacts","Low","🟡 "+L5("منخفض","Low"),p.impacts)}</div>
      <div class="label" style="font-size:12.5px;margin:14px 0 6px">${L5("نبهني قبل الخبر بـ","Remind me before")}</div><div class="n-chk">${[60,30,15].map(x=>chip("leads",x,x+" "+L5("دقيقة","min"),p.leads)).join("")}</div>
      <div style="margin-top:12px">${sw("on_result","✅ "+L5("نبهني أول ما تنزل النتيجة","Alert me when the result is released"),p.on_result!==false)}${sw("in_site","🔔 "+L5("تنبيهات داخل المنصة","In-platform alerts"),p.in_site!==false)}${sw("tg","✈️ "+L5("تنبيهات تيليجرام الخاصة","Private Telegram alerts")+(m.tg?"":` <small class="label">(${L5("اربط حسابك أول","link Telegram first")})</small>`),!!p.tg&&!!m.tg)}${sw("paused","⏸ "+L5("إيقاف كل التنبيهات مؤقتاً","Pause all alerts"),!!p.paused)}</div>
      <div class="st-bar" style="margin-top:12px"><button class="btn primary" type="button" id="nPrefSave">💾 ${L5("حفظ","Save")}</button><span class="msg" id="nPrefMsg"></span></div></div>
      <div style="display:grid;gap:12px;align-content:start"><div class="panel" id="nTgBox"></div><p class="v3-note">${L5("التذكير ينرسل مرة وحدة لكل حدث، والأحداث اللي بنفس الدقيقة تنجمع برسالة وحدة. تكدر توقف أو تعدل بأي وقت.","Each reminder is sent once per event; simultaneous events are grouped. Change or stop anytime.")}</p></div></div>`;
    b.querySelectorAll(".n-chk [data-g]").forEach(x=>x.onclick=()=>{x.classList.toggle("on");x.setAttribute("aria-pressed",x.classList.contains("on"))});
    const tgBox=()=>{const el=$("nTgBox");if(m.tg){el.innerHTML=`<div class="n-tg"><div class="ic">✈️</div><div><b>✅ ${L5("مربوط","Linked")}${m.tg.username?`: @${esc(m.tg.username)}`:""}</b><p class="label" style="font-size:12.5px;margin:4px 0 10px">${m.tg.active?L5("التنبيهات الخاصة توصلك على تيليجرام.","Private alerts reach you on Telegram."):L5("⚠️ البوت ما يكدر يراسلك (يمكن حاظره). افتح البوت واضغط Start.","⚠️ The bot can't message you (blocked?). Open it and press Start.")}</p><button class="btn" type="button" id="nTgUn">${L5("فك الربط","Unlink")}</button></div></div>`;
        $("nTgUn").onclick=async()=>{try{await V5.api().tgUnlink();m.tg=null;tgBox();V5.toast(L5("انفك الربط","Unlinked"))}catch(e){V5.toast(V5.err(e),1)}}}
      else{el.innerHTML=`<div class="n-tg"><div class="ic">✈️</div><div><b>${L5("اربط حسابك ببوت تيليجرام","Link your Telegram")}</b><p class="label" style="margin:4px 0 0;font-size:12.5px">${L5("حتى توصلك التنبيهات على الخاص.","To get alerts privately.")}</p></div></div>
        <ol class="label" style="font-size:13px;line-height:2.1;padding-inline-start:18px;margin:12px 0"><li>${L5("اضغط «اطلع رمز الربط»","Press «Get link code»")}</li><li>${L5("اضغط «افتح البوت» واضغط Start، والربط يصير تلقائي","Open the bot and press Start — linking is automatic")}</li></ol>
        <div id="nTgCode"><button class="btn primary" type="button" id="nTgGo">🔑 ${L5("اطلع رمز الربط","Get link code")}</button></div><p class="label" style="font-size:11.5px;margin:8px 0 0">${L5("الرمز يستخدم مرة وحدة وينتهي بعد 10 دقايق. ما نطلب منك أي كلمة سر.","One-time code, expires in 10 minutes. We never ask for passwords.")}</p>`;
        $("nTgGo").onclick=async()=>{try{const c=await V5.api().tgCode();$("nTgCode").innerHTML=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${c.url?`<a class="btn primary" href="${escA(c.url)}" target="_blank" rel="noopener">${L5("افتح البوت","Open bot")} ✈️</a>`:`<span class="label">${L5("البوت بعده ما مضبوط من الإدارة. أرسل للبوت:","Bot not configured yet. Send the bot:")}</span>`}<span class="n-code">${esc(c.url?c.code:"/start "+c.code)}</span><button class="btn v2s" type="button" id="nTgChk">🔄 ${L5("تحققت","I've started it")}</button></div>`;
          $("nTgChk").onclick=async()=>{const r=await V5.api().myNews();if(r.tg){m.tg=r.tg;tgBox();V5.toast(L5("✅ انربط حسابك","✅ Linked"))}else V5.toast(L5("بعده ما انربط. اضغط Start بالبوت واستنى دقيقة.","Not linked yet. Press Start in the bot and wait a minute."),1)}}catch(e){V5.toast(V5.err(e),1)}}}};tgBox();
    $("nPrefSave").onclick=async()=>{const g=k=>[...b.querySelectorAll(`.n-chk [data-g="${k}"].on`)].map(x=>x.dataset.v),s=k=>b.querySelector(`[data-sw="${k}"]`).checked;
      const d={ccys:g("ccys"),impacts:g("impacts"),leads:g("leads").map(Number),on_result:s("on_result"),in_site:s("in_site"),tg:s("tg"),paused:s("paused")};
      if(s("tg")&&!m.tg){V5.toast(L5("اربط تيليجرام أول حتى تفعّل التنبيهات الخاصة.","Link Telegram first."),1);return}
      if(!d.paused&&(!d.ccys.length||!d.impacts.length||(!d.leads.length&&!d.on_result))){V5.toast(L5("اختار عملة وتأثير ووقت تذكير على الأقل.","Pick at least one currency, impact and timing."),1);return}
      try{await V5.api().savePrefs(d);$("nPrefMsg").textContent="✅ "+L5("انحفظ","Saved")}catch(e){V5.toast(V5.err(e),1)}}},
  async channel(){let m={};try{m=await V5.api().myNews()}catch(e){}const ch=m.channel||"";
    $("v5NewsBody").innerHTML=V5N.head()+`<div class="k-g2"><div class="panel n-tg" style="align-items:start"><div class="ic">✈️</div><div><h3 style="margin:0">${L5("قناة VEXORA NEWS الرسمية","Official VEXORA NEWS channel")}</h3><p class="label" style="line-height:1.9;font-size:13px">${L5("كل حدث اقتصادي قوي يوصلك على القناة:","Every high-impact event on the channel:")}<br>• ${L5("تذكير قبل الخبر (الأوقات يحددها الأدمن، بدون إغراق)","Reminders before release (no flooding)")}<br>• ${L5("النتيجة الفعلية مع مقارنة السابق والمتوقع","Actual result vs previous and forecast")}<br>• ${L5("رابط الحدث داخل فيكسورا","Link to the event in VEXORA")}</p>
      ${ch?`<a class="btn primary" href="${escA(ch)}" target="_blank" rel="noopener">${L5("انضم للقناة","Join channel")}</a>`:`<span class="chip">${L5("رابط القناة يضيفه الأدمن قريباً","Channel link coming soon")}</span>`} <a class="btn" href="#news/alerts">🔔 ${L5("تنبيهات خاصة إلي","Private alerts")}</a></div></div>
      <div class="panel"><span class="label" style="font-size:12px">${L5("شكل الرسالة بالقناة (مثال)","Channel message sample")}</span><div class="n-tgmsg" style="margin-top:8px">👑 <b>${L5("فيكسورا","VEXORA")}</b> | VEXORA NEWS<br>━━━━━━━━━━━━━━━<br>✅ <b>${L5("صدرت النتيجة","Result released")}</b><br>🇺🇸 <b>USD</b> · ${L5("مؤشر أسعار المستهلك CPI","CPI")}<br>${L5("السابق","Prev")}: 0.3% · ${L5("المتوقع","Fcst")}: 0.3%<br>${L5("الفعلي","Actual")}: <b>0.4%</b> ⬆️<br><br>🕐 15:30 · ${L5("المصدر","Source")}<br><a>🔗 ${L5("التفاصيل على فيكسورا","Details on VEXORA")}</a></div><p class="v3-note">${L5("الأرقام بالمثال توضيحية.","Sample figures are illustrative.")}</p></div></div>`}
};

/* ---------- V12: نشر خبر يدوي بقناة الأخبار (الأسلوب 3) ---------- */
const V12NP={
  CATS:[["gold","🪙 الذهب"],["rates","🏦 الفائدة والبنوك المركزية"],["fx","💱 الدولار والعملات"],["oil","🛢 النفط"],["stocks","📈 الأسهم"],["crypto","₿ الكريبتو"],["news","📰 أخبار الأسواق"]],
  val(){const g=id=>{const e=document.getElementById(id);return e?(e.type==="checkbox"?e.checked:e.value.trim()):""};
    return{cat:g("npCat"),urgent:g("npUrg"),title:g("npT"),meaning:g("npM"),tags:g("npTags"),src:g("npSrc"),url:g("npUrl")}},
  ui(){const nb=document.getElementById("naBody");if(!nb)return;
    nb.innerHTML=`<div class="panel np-wrap"><div><h3 style="margin:0 0 4px">📝 نشر خبر بالقناة</h3><p class="label" style="margin:0 0 12px">ينزل بقناة الأخبار ويّا صورة فيكسورا وزر الموقع. اكتب تحليلك بخانة «شنو يعني للسوق؟»، وشوف الشكل قبل النشر.</p>
      <div class="k-form"><label>القسم<select class="f" id="npCat">${V12NP.CATS.map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select></label>
      <label class="np-chk"><input type="checkbox" id="npUrg"> ⚡️ عاجل</label>
      <label class="w3">عنوان الخبر<input class="f" id="npT" maxlength="220" placeholder="مثال: الذهب يقفز لأعلى مستوى بأسبوعين بعد بيانات التضخم"></label>
      <label class="w3">🧭 شنو يعني للسوق؟ <small class="label">(اختياري · 500 حرف)</small><textarea class="f" id="npM" maxlength="500" rows="3" placeholder="مثال: تضخم أعلى من المتوقع ← احتمال فائدة أعلى لفترة أطول ← عادةً ضغط على الذهب"></textarea></label>
      <label>الرموز <small class="label">(اختياري)</small><input class="f" id="npTags" maxlength="40" placeholder="XAU ▲ · USD ▼"></label>
      <label>المصدر <small class="label">(اختياري)</small><input class="f" id="npSrc" maxlength="40" placeholder="رويترز"></label>
      <label class="w2">رابط المصدر <small class="label">(اختياري)</small><input class="f ltr" id="npUrl" placeholder="https://"></label></div>
      <div class="n-btns" style="margin-top:12px"><button class="btn primary" type="button" id="npSend" disabled>📤 انشر بالقناة</button><span class="label" id="npMsg"></span></div>
      <p class="v3-note">⚠️ لا تكتب توقع أكيد أو أرقام غير موثّقة. التحليل رأي تعليمي وليس نصيحة استثمارية.</p></div>
      <div class="np-prev"><div class="label" style="margin-bottom:6px">👁 شكله بالقناة</div><div class="np-tg" id="npPrev"><div class="np-empty">اكتب العنوان حتى تشوف الشكل</div></div></div></div>`;
    let t;const upd=()=>{clearTimeout(t);t=setTimeout(V12NP.preview,350)};
    nb.querySelectorAll("#npCat,#npUrg,#npT,#npM,#npTags,#npSrc,#npUrl").forEach(e=>e.addEventListener("input",upd));
    const s=document.getElementById("npSend");s.onclick=async()=>{
      if(!s.dataset.ok){s.dataset.ok="1";s.textContent="✅ متأكد؟ اضغط مرة ثانية للنشر";setTimeout(()=>{if(s.dataset.ok){delete s.dataset.ok;s.textContent="📤 انشر بالقناة"}},5000);return}
      delete s.dataset.ok;s.disabled=true;s.textContent="⏳ جاري النشر…";
      try{const r=await V5.api().admPost({...V12NP.val(),dry:false});V5.toast("✅ انحط الخبر بطابور النشر. يوصل القناة خلال دقيقة.");
        ["npT","npM","npTags","npSrc","npUrl"].forEach(id=>document.getElementById(id).value="");document.getElementById("npUrg").checked=false;V12NP.preview()}
      catch(e){V5.toast(V5.err(e),1)}finally{s.textContent="📤 انشر بالقناة";s.disabled=!V12NP.val().title}};},
  async preview(){const v=V12NP.val(),pv=document.getElementById("npPrev"),s=document.getElementById("npSend"),m=document.getElementById("npMsg");if(!pv)return;
    s.disabled=!v.title;m.textContent="";
    if(!v.title){pv.innerHTML=`<div class="np-empty">اكتب العنوان حتى تشوف الشكل</div>`;return}
    if(v.url&&!/^https?:\/\//i.test(v.url)){m.textContent="⚠️ الرابط لازم يبدي بـ https://";s.disabled=true}
    try{const r=await V5.api().admPost({...v,dry:true});const kb=(r.kb&&r.kb.inline_keyboard)||[];
      const ph=r.photo?String(r.photo).replace(/^https?:\/\/[^/]+\//,""):"";
      pv.innerHTML=`<div class="np-bub">${ph?`<img src="${escA(ph)}" alt="">`:""}<div class="np-tx"><span class="np-ch">أخبار فيكسورا</span>${String(r.body||"").replace(/\n/g,"<br>")}</div></div>
        <div class="np-kb">${kb.map(row=>`<div>${row.map(b=>`<span>${esc(b.text)}</span>`).join("")}</div>`).join("")}</div>`}
    catch(e){pv.innerHTML=`<div class="np-empty">⚠️ ${esc(V5.err(e))}</div>`;s.disabled=true}}
};

/* ---------- إدارة VEXORA NEWS (/admin/news) ---------- */
const V5NA={tab:"events",post(){V12NP.ui()},
  async open(a){V5NA.tab=a&&["events","articles","sources","telegram","post","auto","logs"].includes(a)?a:V5NA.tab;const b=$("v5NewsAdmBody");if(!b)return;
    if(!can("news")){b.innerHTML=`<div class="panel rc-empty">⛔ ${L5("هذي الصفحة للإدارة والطاقم المخوّل بس.","Admins and authorized staff only.")}</div>`;return}
    b.innerHTML=`<div class="panel label">${L5("جاري التحميل…","Loading…")}</div>`;
    try{const[st,ls]=await Promise.all([V5.api().admStatus(),V5.api().admNews(new Date(Date.now()-3*864e5).toISOString(),new Date(Date.now()+10*864e5).toISOString())]);V5NA.st=st;V5NA.ls=ls;V5NA.render()}
    catch(e){b.innerHTML=`<div class="panel rc-empty">⚠️ ${esc(V5.err(e))}</div>`}},
  render(){const st=V5NA.st,ls=V5NA.ls,c=st.counts||{},own=isAdminUser(),b=$("v5NewsAdmBody");
    const T=[["events","📅 "+L5("الأحداث","Events")],["articles","🗞 "+L5("الأخبار والمقالات","Articles")],["sources","🌐 "+L5("المصادر","Sources")],["telegram","✈️ "+L5("تيليجرام","Telegram")],["post","📝 "+L5("نشر خبر","Post news")],["auto","⚙️ "+L5("النشر التلقائي","Auto-posting")],["logs","📜 "+L5("السجلات","Logs")]];
    const dot=ok=>`<i class="n-dot ${ok===true?"g":ok===false?"r":"y"}"></i>`;
    b.innerHTML=`<div class="panel"><div class="n-hd"><h2>🛠 ${L5("إدارة VEXORA NEWS","VEXORA NEWS admin")}<small>${L5("المحتوى للطاقم المخوّل، والإعدادات للمالك بس. كل تعديل ينحفظ بسجل الإدارة.","Content for authorized staff; settings owner-only. Every change is audit-logged.")}</small></h2><div class="k-row">${V5.demoBadge()}<a class="btn v2s" href="#news">← ${L5("مركز الأخبار","News center")}</a></div></div>
      <div class="k-tabs" style="margin-top:12px">${T.map(([k,l])=>`<button type="button" data-at="${k}" class="${k===V5NA.tab?"on":""}">${l}</button>`).join("")}</div></div>
      <div class="n-kpi"><div><span>${L5("أحداث هالأسبوع","Events this week")}</span><b>${c.events_week||0}</b></div><div><span>${L5("مشتركين بالتنبيهات","Alert subscribers")}</span><b>${c.subs||0}</b></div><div><span>${L5("حسابات تيليجرام مربوطة","Linked Telegram")}</span><b>${c.linked||0}</b></div><div><span>${L5("رسائل انرسلت (7 أيام)","Sent (7d)")}</span><b style="color:#7fe0b8">${c.sent7||0}</b></div><div><span>${L5("رسائل فشلت (7 أيام)","Failed (7d)")}</span><b style="color:#ff8a80">${c.failed7||0}</b></div><div><span>${L5("بالطابور / مسودات","Queued / drafts")}</span><b style="color:#f2d27a">${c.queued||0} / ${c.articles_draft||0}</b></div></div>
      <div class="panel"><h3 style="margin:0 0 6px">📡 ${L5("حالة الأنظمة","System status")}</h3><div class="n-st3">
        <div class="n-pv"><span>${dot(st.fails==="0"||!st.fails)}${L5("مزود التقويم","Calendar provider")}: <b>${esc(st.active_provider)}</b></span><span class="label">${st.last_sync?L5("آخر مزامنة ","Last sync ")+new Date(st.last_sync).toLocaleString("en-GB"):"—"}</span></div>
        <div class="n-pv"><span>${dot(st.api_key_set?true:null)}${L5("مزود النتائج الفعلية (Actual)","Actual-values provider")}</span><span class="label">${st.api_key_set?L5("المفتاح مضاف","Key set"):L5("يحتاج مفتاح API رسمي (الملف الحالي ما بيه Actual)","Needs an official API key (current feed has no Actual)")}</span></div>
        <div class="n-pv"><span>${dot(st.token_set?true:false)}${L5("بوت تيليجرام","Telegram bot")}</span><span class="label">${st.token_set?L5("التوكن مضاف بالسيرفر","Token set on server"):L5("التوكن ناقص","Token missing")}${st.tg_hook===false?" · ⚠️ "+L5("ربط /start يحتاج تدخل يدوي","/start hook missing"):""}</span></div>
        <div class="n-pv"><span>${dot((st.chats||[]).length?true:false)}${L5("قناة النشر","Posting channel")}</span><span class="label ltr">${esc((st.chats||[]).join(", ")||"—")}</span></div></div>
        <div class="n-btns" style="margin-top:10px"><button class="btn" type="button" id="naSync">🔄 ${L5("مزامنة الآن","Sync now")}</button>${own?`<button class="btn" type="button" id="naTest">✈️ ${L5("اختبار اتصال تيليجرام","Test Telegram")}</button>`:""}</div></div>
      <div id="naBody"></div>`;
    b.querySelectorAll("[data-at]").forEach(x=>x.onclick=()=>{V5NA.tab=x.dataset.at;history.replaceState(null,"","#admin/news");V5NA.render()});
    $("naSync").onclick=async()=>{try{await V5.api().admSync();V5.toast(L5("✅ انطلبت مزامنة. النتيجة تبين بالسجل خلال دقايق.","✅ Sync requested. See logs in a few minutes."));V5NA.open()}catch(e){V5.toast(V5.err(e),1)}};
    if($("naTest"))$("naTest").onclick=async()=>{try{await V5.api().admTgTest();V5.toast(L5("✅ انرسلت رسالة اختبار. تأكد من القناة، والنتيجة (نجح/فشل) تبين بالسجل بعد دقيقة.","✅ Test sent. Check the channel; result appears in logs within a minute."))}catch(e){V5.toast(V5.err(e),1)}};
    V5NA[V5NA.tab]()},
  // ---------- الأحداث ----------
  events(){const ev=V5NA.ls.events||[],nb=$("naBody");
    nb.innerHTML=`<div class="panel"><div class="n-hd"><h3 style="margin:0">📅 ${L5("الأحداث","Events")} <small class="label">(${L5("آخر 3 أيام والـ 10 الجاية","last 3 days and next 10")})</small></h3><button class="btn primary" type="button" id="naNew">➕ ${L5("حدث يدوي","Manual event")}</button></div>
      <div id="naForm"></div><div class="v3-tw"><table class="n-tbl" style="margin-top:8px"><tr><th>${L5("الحدث","Event")}</th><th>${L5("الموعد","Time")}</th><th>${L5("النوع","Type")}</th><th>${L5("السابق/المتوقع/الفعلي","Prev/Fcst/Actual")}</th><th>${L5("الحالة","Status")}</th><th></th></tr>
      ${ev.map(e=>{const[sc,sl]=V5N.st(e);return`<tr><td>${V5N.FLAG[e.country]||"🌐"} <b>${esc(e.country)}</b> ${esc(V5N.name(e))} ${V5N.imp(e.impact)}</td><td class="v">${new Date(e.at).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td><td><span class="n-tag ${e.manual?"man":"ext"}">${e.manual?L5("يدوي","Manual"):L5("مستورد","Imported")}</span></td><td class="v">${esc(e.previous||"—")} / ${esc(e.forecast||"—")} / <b>${esc(e.actual||"—")}</b></td><td><span class="n-s ${sc}">${sl}</span></td><td><button class="btn v2s" type="button" data-ed="${escA(e.id)}">${L5("تعديل","Edit")}</button></td></tr>`}).join("")||`<tr><td colspan="6" class="label">—</td></tr>`}</table></div>
      <p class="v3-note">${L5("الأحداث المستوردة تتحدث تلقائياً من المزود. تعديلك اليدوي ينسجل بسجل الحدث. إذا غيّرت الموعد تنعاد جدولة التذكيرات. «صدرت» تحتاج رقم فعلي.","Imported events update automatically. Manual edits are logged. Changing time reschedules reminders. «Released» requires an actual value.")}</p></div>`;
    $("naNew").onclick=()=>V5NA.evForm({});nb.querySelectorAll("[data-ed]").forEach(x=>x.onclick=()=>V5NA.evForm(ev.find(e=>e.id===x.dataset.ed)))},
  evForm(e){const loc=d=>{const x=new Date(d||Date.now()+36e5);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,16)};
    $("naForm").innerHTML=`<div class="panel" style="margin:10px 0;border-color:rgba(212,175,55,.6)"><h4 style="margin:0 0 10px">${e.id?L5("تعديل حدث","Edit event")+` <span class="n-tag ${e.manual?"man":"ext"}">${e.manual?L5("يدوي","Manual"):L5("مستورد","Imported")}</span>`:L5("حدث يدوي جديد","New manual event")}</h4>
      <div class="k-form"><label class="w2">${L5("العنوان (إنجليزي/الأصلي)","Title")}<input class="f" id="neT" value="${escA(e.title||"")}"></label><label>${L5("العنوان بالعربي","Arabic title")}<input class="f" id="neTA" value="${escA(e.title_ar||"")}"></label>
      <label>${L5("العملة","Currency")}<input class="f ltr" id="neC" value="${escA(e.country||"USD")}" maxlength="3"></label><label>${L5("الموعد (بتوقيتك)","Time (your TZ)")}<input class="f ltr" type="datetime-local" id="neAt" value="${loc(e.at)}"></label>
      <label>${L5("التأثير","Impact")}<select class="f" id="neI">${["High","Medium","Low","Holiday"].map(i=>`<option ${i===(e.impact||"High")?"selected":""}>${i}</option>`).join("")}</select></label>
      <label>${L5("السابق","Previous")}<input class="f ltr" id="neP" value="${escA(e.previous||"")}"></label><label>${L5("المتوقع","Forecast")}<input class="f ltr" id="neF" value="${escA(e.forecast||"")}"></label><label>${L5("الفعلي","Actual")}<input class="f ltr" id="neA" value="${escA(e.actual||"")}" placeholder="${L5("فارغ = بانتظار النتيجة","empty = awaiting")}"></label>
      <label>${L5("الحالة","Status")}<select class="f" id="neS">${[["upcoming",L5("قادم","Upcoming")],["released",L5("صدرت النتيجة","Released")],["postponed",L5("مؤجل","Postponed")],["cancelled",L5("ملغى","Cancelled")]].map(([k,l])=>`<option value="${k}" ${k===(e.status||"upcoming")?"selected":""}>${l}</option>`).join("")}</select></label>
      <label class="w2">${L5("رابط المصدر","Source URL")}<input class="f ltr" id="neU" value="${escA(e.source_url||"")}" placeholder="https://"></label><label class="w3">${L5("ملاحظة تظهر بصفحة الحدث","Note shown on event page")}<textarea class="f" id="neN">${esc(e.note||"")}</textarea></label></div>
      <div class="n-btns" style="margin-top:10px"><button class="btn primary" type="button" id="neSave">💾 ${L5("حفظ","Save")}</button>${e.id&&e.status!=="cancelled"?`<button class="btn" type="button" id="neCancel">⛔ ${L5("إلغاء الحدث","Cancel event")}</button>`:""}<button class="btn" type="button" id="neClose">${L5("سكّر","Close")}</button>${e.id?`<a class="btn v2s" href="#news/ev/${encodeURIComponent(e.id)}">${L5("صفحة الحدث","Event page")} ↗</a>`:""}</div></div>`;
    $("naForm").scrollIntoView({behavior:"smooth",block:"center"});
    const g=id=>$(id).value.trim();$("neClose").onclick=()=>$("naForm").innerHTML="";
    $("neSave").onclick=async()=>{const d={id:e.id||"",title:g("neT"),title_ar:g("neTA"),country:g("neC").toUpperCase(),at:new Date($("neAt").value).toISOString(),impact:$("neI").value,previous:g("neP"),forecast:g("neF"),actual:g("neA"),status:$("neS").value,source_url:g("neU"),note:$("neN").value};
      if(d.source_url&&!/^https:\/\//.test(d.source_url)){V5.toast(L5("رابط المصدر لازم يبدي بـ https://","Source URL must start with https://"),1);return}
      try{await V5.api().admEvent(d);V5.toast("✅ "+L5("انحفظ","Saved"));V5NA.open("events")}catch(x){V5.toast(V5.err(x),1)}};
    if($("neCancel"))$("neCancel").onclick=async()=>{if(!confirm(L5("تلغي هذا الحدث؟ يبقى بالسجل.","Cancel this event? It stays in the log.")))return;try{await V5.api().admEvent({id:e.id,status:"cancelled"});V5NA.open("events")}catch(x){V5.toast(V5.err(x),1)}}},
  // ---------- المقالات ----------
  articles(){const A=V5NA.ls.articles||[],nb=$("naBody"),CAT=[["analysis",L5("تحليل","Analysis")],["breaking",L5("عاجل","Breaking")],["gold",L5("الذهب","Gold")],["usd","USD"],["eur","EUR"],["rates",L5("الفائدة","Rates")],["inflation",L5("التضخم","Inflation")],["jobs",L5("البطالة","Jobs")]];
    nb.innerHTML=`<div class="panel"><div class="n-hd"><h3 style="margin:0">🗞 ${L5("الأخبار والمقالات","News & articles")}</h3><button class="btn primary" type="button" id="naANew">➕ ${L5("خبر/مقال","New")}</button></div><div id="naAForm"></div>
      <div class="v3-tw"><table class="n-tbl" style="margin-top:8px"><tr><th>${L5("العنوان","Title")}</th><th>${L5("التصنيف","Category")}</th><th>${L5("الحالة","Status")}</th><th>${L5("التاريخ","Date")}</th><th></th></tr>${A.map(a=>`<tr><td>${a.breaking?"⚡ ":""}${esc(a.title)}</td><td>${esc(a.category)}</td><td><span class="n-s ${a.status==="published"?"done":a.status==="draft"?"up":"can"}">${esc(a.status)}</span></td><td class="v">${a.published_at?new Date(a.published_at).toLocaleDateString("en-GB"):"—"}</td><td><button class="btn v2s" type="button" data-ae="${a.id}">${L5("تعديل","Edit")}</button></td></tr>`).join("")||`<tr><td colspan="5" class="label">—</td></tr>`}</table></div>
      <p class="v3-note">${L5("كل خبر يضاف من هنا ينعرض بشارة «من فيكسورا» حتى يتميز عن الأخبار المستوردة.","Articles added here carry a «VEXORA» badge to distinguish them from imported news.")}</p></div>`;
    const form=a=>{$("naAForm").innerHTML=`<div class="panel" style="margin:10px 0"><div class="k-form"><label class="w2">${L5("العنوان بالعربي","Title (AR)")}<input class="f" id="naT" value="${escA(a.title||"")}"></label><label>${L5("التصنيف","Category")}<select class="f" id="naC">${CAT.map(([k,l])=>`<option value="${k}" ${k===(a.category||"analysis")?"selected":""}>${l}</option>`).join("")}</select></label>
      <label class="w2">${L5("العنوان بالإنجليزي","Title (EN)")}<input class="f ltr" id="naTE" value="${escA(a.title_en||"")}"></label><label>${L5("العملة","Currency")}<input class="f ltr" id="naCc" value="${escA(a.ccy||"")}" maxlength="3"></label>
      <label class="w3">${L5("النص بالعربي","Body (AR)")}<textarea class="f" id="naB">${esc(a.body||"")}</textarea></label><label class="w3">${L5("النص بالإنجليزي","Body (EN)")}<textarea class="f ltr" id="naBE">${esc(a.body_en||"")}</textarea></label>
      <label>${L5("اسم المصدر","Source name")}<input class="f" id="naSN" value="${escA(a.source_name||"VEXORA")}"></label><label>${L5("رابط المصدر","Source URL")}<input class="f ltr" id="naSU" value="${escA(a.source_url||"")}"></label><label>${L5("صورة (رابط)","Image URL")}<input class="f ltr" id="naI" value="${escA(a.image_url||"")}"></label>
      <label class="tgl"><input type="checkbox" id="naBr" ${a.breaking?"checked":""}> ⚡ ${L5("خبر عاجل","Breaking")}</label><label>${L5("الحالة","Status")}<select class="f" id="naS">${[["draft",L5("مسودة","Draft")],["published",L5("منشور","Published")],["archived",L5("أرشيف","Archived")]].map(([k,l])=>`<option value="${k}" ${k===(a.status||"draft")?"selected":""}>${l}</option>`).join("")}</select></label></div>
      <div class="n-btns" style="margin-top:10px"><button class="btn primary" type="button" id="naSave">💾 ${L5("حفظ","Save")}</button><button class="btn" type="button" onclick="this.closest('.panel').remove()">${L5("سكّر","Close")}</button></div></div>`;
      $("naSave").onclick=async()=>{const g=id=>$(id).value.trim(),d={id:a.id||"",title:g("naT"),title_en:g("naTE"),category:$("naC").value,ccy:g("naCc"),body:$("naB").value,body_en:$("naBE").value,source_name:g("naSN"),source_url:g("naSU"),image_url:g("naI"),breaking:$("naBr").checked,status:$("naS").value};
        for(const u of[d.source_url,d.image_url])if(u&&!/^https:\/\//.test(u)){V5.toast(L5("الروابط لازم تبدي بـ https://","Links must start with https://"),1);return}
        try{await V5.api().admArticle(d);V5.toast("✅");V5NA.open("articles")}catch(x){V5.toast(V5.err(x),1)}}};
    $("naANew").onclick=()=>form({});nb.querySelectorAll("[data-ae]").forEach(x=>x.onclick=()=>form(A.find(a=>a.id==x.dataset.ae)))},
  sources(){const F=V5NA.ls.feeds||[],own=isAdminUser(),st=V5NA.st;
    $("naBody").innerHTML=`<div class="panel"><h3 style="margin:0 0 8px">🌐 ${L5("مصادر البيانات والأخبار","Data & news sources")}</h3>
      <div class="n-pv"><span>📅 ${L5("التقويم الاقتصادي","Economic calendar")}: <b>${esc(st.active_provider)}</b></span><span class="label">${st.active_provider==="fmp"?"Financial Modeling Prep API":"ForexFactory (JSON)"}</span></div>
      <p class="v3-note">${L5("المزود الحالي (ملف ForexFactory العام) ما يعطي الرقم الفعلي، وشروط إعادة نشره غير موضحة. للنتائج الفعلية التلقائية فعّل مزود رسمي بمفتاح API من تبويب «النشر التلقائي». بدون مفتاح، أدخل الفعلي يدوياً من تبويب الأحداث.","The current public ForexFactory feed has no Actual values and unclear redistribution terms. For automatic results, enable an official API provider with a key in «Auto-posting». Without a key, enter actuals manually.")}</p>
      <h4 style="margin:14px 0 6px">📰 ${L5("مصادر عناوين الأخبار (RSS)","Headline feeds (RSS)")}</h4>${own?F.map(f=>`<div class="n-pv"><span>${f.enabled?"🟢":"⚪"} ${esc(f.name)} <small class="label ltr">${esc(String(f.url).slice(0,60))}…</small></span><label class="tgl"><input type="checkbox" data-fd="${f.id}" ${f.enabled?"checked":""}> ${L5("مفعّل","Enabled")}</label></div>`).join("")||`<p class="label">—</p>`:`<p class="label">${L5("إدارة المصادر للمالك بس.","Owner only.")}</p>`}
      <p class="v3-note">${L5("نعرض العنوان ورابط الناشر الأصلي فقط (بدون نسخ المحتوى)، حسب شروط كل مصدر.","We show only headlines with links to the original publisher, per each source's terms.")}</p></div>`;
    $("naBody").querySelectorAll("[data-fd]").forEach(x=>x.onchange=async()=>{try{await V5.api().admFeed({id:x.dataset.fd,enabled:x.checked});V5.toast("✅")}catch(e){V5.toast(V5.err(e),1);x.checked=!x.checked}})},
  cfgRow(k,l,type,help){const v=(V5NA.st.cfg||{})[k]||"",own=isAdminUser();
    return`<label>${l}${type==="sel"?`<select class="f" data-cfg="${k}" ${own?"":"disabled"}>${help.map(o=>`<option ${o===v?"selected":""}>${o}</option>`).join("")}</select>`:type==="bool"?`<select class="f" data-cfg="${k}" ${own?"":"disabled"}><option value="1" ${v==="1"?"selected":""}>${L5("مفعّل","On")}</option><option value="0" ${v!=="1"?"selected":""}>${L5("مطفّى","Off")}</option></select>`:`<input class="f ltr" data-cfg="${k}" value="${escA(v)}" ${own?"":"disabled"} ${type==="pw"?'type="password" placeholder="••••••"':""}>`}${type!=="sel"&&help?`<small class="label">${help}</small>`:""}</label>`},
  bindCfg(){$("naBody").querySelectorAll("[data-cfg]").forEach(x=>x.onchange=async()=>{try{await V5.api().admCfg(x.dataset.cfg,x.value.trim());V5.toast("✅ "+L5("انحفظ","Saved"));if(x.type==="password")x.value=""}catch(e){V5.toast(V5.err(e),1)}})},
  telegram(){$("naBody").innerHTML=`<div class="panel"><h3 style="margin:0 0 8px">✈️ ${L5("إدارة قناة تيليجرام","Telegram channel")}</h3>${isAdminUser()?"":`<p class="chip">${L5("للقراءة فقط، التعديل للمالك.","Read-only; owner can edit.")}</p>`}
      <div class="k-form">${V5NA.cfgRow("news_chat",L5("معرّف قناة الأخبار (chat id)","News channel chat id"),"txt",L5("فارغ = نفس قناة التنبيهات الحالية. مثال: -100123…","Empty = current alert channel. e.g. -100123…"))}${V5NA.cfgRow("news_ch_link",L5("رابط الانضمام العام","Public join link"),"txt","https://t.me/…")}${V5NA.cfgRow("tg_bot_user",L5("يوزر البوت (للربط الخاص)","Bot username (private linking)"),"txt",L5("بدون @","without @"))}</div>
      <p class="v3-note">🔐 ${L5("توكن البوت ما يتخزن بالواجهة أبداً. ينضاف بالسيرفر فقط (جدول الإعدادات بـ Supabase، المفتاح tg_token) وما يرجع للمتصفح.","The bot token is never stored in the front-end. It lives only on the server (Supabase config key tg_token) and is never returned to the browser.")}</p></div>`;V5NA.bindCfg()},
  auto(){const own=isAdminUser(),r=((V5NA.st.cfg||{}).news_rem||"").split(",").map(x=>x.trim()).filter(Boolean);
    $("naBody").innerHTML=`<div class="k-g2"><div class="panel"><h3 style="margin:0 0 8px">⚙️ ${L5("إعدادات النشر التلقائي","Auto-posting settings")}</h3>${own?"":`<p class="chip">${L5("للقراءة فقط، التعديل للمالك.","Read-only; owner can edit.")}</p>`}
      <div class="label" style="font-size:12.5px;margin-bottom:6px">${L5("تذكيرات القناة قبل الخبر","Channel reminders before release")}</div><div class="n-chk">${[60,30,15].map(x=>`<button type="button" class="${r.includes(String(x))?"on":""}" data-rem="${x}" ${own?"":"disabled"}>${x} ${L5("دقيقة","min")}</button>`).join("")}</div>
      <div class="k-form" style="margin-top:12px">${V5NA.cfgRow("cal_alerts",L5("النشر بالقناة","Channel posting"),"bool")}${V5NA.cfgRow("news_result",L5("نشر النتيجة الفعلية","Post actual results"),"bool")}${V5NA.cfgRow("news_min_imp",L5("أقل تأثير يُنشر","Minimum impact"),"sel",["High","Medium","Low"])}
        ${V5NA.cfgRow("cal_currencies",L5("العملات المنشورة","Posted currencies"),"txt","USD,EUR,GBP,JPY")}${V5NA.cfgRow("news_rate",L5("أقصى رسائل بالدقيقة","Max messages/min"),"txt",L5("حماية من حد تيليجرام","Telegram rate guard"))}</div>
      <p class="v3-note">${L5("ضد الإغراق: الأحداث اللي بنفس الدقيقة تنجمع برسالة وحدة، وكل نوع إشعار ينرسل مرة وحدة لكل حدث، وما ينرسل تذكيرين لنفس الحدث خلال 12 دقيقة. أقصى 4 أوقات.","Anti-flood: simultaneous events grouped, each notification type once per event, no two reminders for the same event within 12 minutes. Max 4 timings.")}</p></div>
      <div class="panel"><h3 style="margin:0 0 8px">📡 ${L5("مزود البيانات الرسمي","Official data provider")}</h3><div class="k-form" style="grid-template-columns:minmax(0,1fr)">${V5NA.cfgRow("news_provider",L5("المزود","Provider"),"sel",["forexfactory","fmp"])}${V5NA.cfgRow("news_api_key",L5("مفتاح API (يُحفظ بالسيرفر بس)","API key (server-side only)"),"pw",V5NA.st.api_key_set?"✅ "+L5("مضاف. اكتب مفتاح جديد للتغيير أو امسح للحذف.","Set. Type to replace.") :L5("ما مضاف","Not set"))}${V5NA.cfgRow("news_fetch_min",L5("أقل فترة بين الطلبات (دقيقة)","Min minutes between requests"),"txt",L5("Rate limit للمزود","Provider rate limit"))}</div>
      <p class="v3-note">${L5("FMP = Financial Modeling Prep (فيه Actual). راجع شروط الترخيص وإعادة النشر بحسابك عندهم قبل التفعيل. إذا فشل المزود 3 مرات، النظام يبطّئ المحاولات تلقائياً ويرجع يحاول.","FMP includes Actual values. Review their licensing/redistribution terms before enabling. After 3 failures the system backs off automatically.")}</p></div></div>`;
    V5NA.bindCfg();$("naBody").querySelectorAll("[data-rem]").forEach(x=>x.onclick=async()=>{x.classList.toggle("on");const v=[...$("naBody").querySelectorAll("[data-rem].on")].map(y=>y.dataset.rem).join(",");try{await V5.api().admCfg("news_rem",v);V5NA.st.cfg.news_rem=v;V5.toast("✅")}catch(e){V5.toast(V5.err(e),1);x.classList.toggle("on")}})},
  logs(){const st=V5NA.st,K={r60:"⏰ 60",r30:"⏰ 30",r15:"⏰ 15",result:"✅ "+L5("نتيجة","result"),test:"🧪 test"};
    $("naBody").innerHTML=`<div class="k-g2"><div class="panel"><h3 style="margin:0 0 6px">✈️ ${L5("سجل الرسائل","Message log")}</h3><div class="v3-tw"><table class="n-tbl"><tr><th>${L5("الوقت","Time")}</th><th>${L5("النوع","Kind")}</th><th>${L5("إلى","To")}</th><th>${L5("الحالة","Status")}</th></tr>
      ${(st.outbox||[]).map(o=>`<tr><td class="v">${new Date(o.at).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td><td>${K[o.kind]||esc(o.kind)}</td><td>${o.target==="channel"?L5("القناة","Channel"):L5("مستخدم","User")}</td><td><span class="n-s ${o.status==="sent"?"done":o.status==="failed"?"can":"up"}">${esc(o.status)}</span>${o.err?`<br><small class="label ltr">${esc(o.err).slice(0,90)}</small>`:""}</td></tr>`).join("")||`<tr><td colspan="4" class="label">—</td></tr>`}</table></div></div>
      <div class="panel"><h3 style="margin:0 0 6px">🔄 ${L5("سجل المزامنة والأخطاء","Sync & error log")}</h3><div class="n-log">${(st.sync||[]).map(s=>`<div><span>${new Date(s.at).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span>${s.ok?"✅":"⚠️"} ${esc(s.provider)} ${s.http?`· HTTP ${s.http}`:""} ${s.ok?`· ${L5("جديد","new")} ${s.n_new} · ${L5("تحديث","upd")} ${s.n_upd} · ${L5("تأجيل","resched")} ${s.n_resched} · ${L5("نتائج","actual")} ${s.n_actual}`:`<small class="label ltr" style="color:#ff8a80">${esc(s.err).slice(0,140)}</small>`}</span></div>`).join("")||`<p class="label">—</p>`}</div></div></div>`}
};

/* ---------- شركاء فيكسورا (/partners ...) — هوية خاصة بنفسجي/نيون ---------- */
const V5P={tab:"",
  PT:{sales:["💼",()=>L5("شريك مبيعات","Sales Partner"),"VEXORA Sales Partner"],distributor:["🏬",()=>L5("موزع معتمد","Distributor"),"VEXORA Distributor"],ib:["🏦",()=>L5("متقدم IB لدى INFINOX","IB Applicant (INFINOX)"),"IB Applicant"]},
  PST:{PENDING:["pe",()=>L5("بانتظار المراجعة","Pending")],UNDER_REVIEW:["v",()=>L5("قيد المراجعة","Under review")],APPROVED:["a",()=>L5("مقبول","Approved")],REJECTED:["r",()=>L5("مرفوض","Rejected")],SUSPENDED:["r",()=>L5("معلّق","Suspended")]},
  CST:{PENDING:"pe",VERIFIED:"v",APPROVED:"a",PAID:"a",REVERSED:"r"},
  IST:{DRAFT:()=>L5("مسودة","Draft"),SUBMITTED:()=>L5("انرسل","Submitted"),VEXORA_REVIEW:()=>L5("مراجعة فيكسورا","VEXORA review"),BROKER_PENDING:()=>L5("بانتظار موافقة الوسيط","Awaiting broker"),BROKER_APPROVED:()=>L5("وافق الوسيط","Broker approved"),BROKER_REJECTED:()=>L5("رفض الوسيط","Broker rejected")},
  money(v,c){return(c||"$")+(Math.round((+v||0)*100)/100).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:2})},
  spark(vals,col){const v=(vals&&vals.length?vals:[0,0]).slice(-20),mx=Math.max(1,...v),n=v.length,pts=v.map((y,i)=>`${Math.round(i*300/Math.max(1,n-1))},${Math.round(44-y/mx*38)}`).join(" "),id="sg"+Math.random().toString(36).slice(2,7),c=col||"#5cf28a";
    return`<svg viewBox="0 0 300 48" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><polygon points="0,48 ${pts} 300,48" fill="url(#${id})"/><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2"/></svg>`},
  nav(){const me=V5P.me,T=[["","🏠 "+L5("البرنامج","Program")],["apply","📝 "+L5("طلب الانضمام","Apply")],...(me&&me.status==="APPROVED"?[["dashboard","📊 "+L5("لوحتي","My dashboard")]]:[]),["ib","🏦 "+L5("طلب IB","IB request")],["agreement","📄 "+L5("العقد","Agreement")],["support","🎧 "+L5("دعم الوسيط","Broker support")]];
    return`<nav class="px-nav">${T.map(([k,l])=>`<a href="#${k==="dashboard"?"partner/dashboard":k==="support"?"broker-support":"partners"+(k?"/"+k:"")}" class="${k===V5P.tab?"on":""}">${l}</a>`).join("")}${isAdminUser()?`<a href="#admin/partners">🛠 ${L5("الإدارة","Admin")}</a>`:""}</nav>`},
  hero(t1,t2,pill,ic){return`<div class="px-hero"><div><h1>${t1} <em>${t2}</em></h1><div class="k-row" style="margin-top:14px">${pill?`<span class="px-pill">${pill}</span>`:""}${V5.api().demo?`<span class="px-demo">🧪 ${L5("معاينة محلية · بيانات تجريبية","Local preview · demo data")}</span>`:""}</div></div><div class="px-logo">${ic}</div></div>`},
  async open(a){V5P.tab=["","apply","dashboard","ib","agreement","support"].includes(a)?a:"";const b=$("v5PartBody");if(!b)return;
    b.innerHTML=`<div class="px"><div class="px-c">${L5("جاري التحميل…","Loading…")}</div></div>`;
    try{V5P.po=await V5.api().portal();V5P.me=V5P.po.me;
      const f={"":V5P.home,apply:V5P.apply,dashboard:V5P.dash,ib:V5P.ib,agreement:V5P.agreement,support:V5P.support}[V5P.tab];await f()}
    catch(e){b.innerHTML=`<div class="px">${V5P.nav()}<div class="px-c">⚠️ ${esc(V5.err(e))}</div></div>`}},
  // ---------- البرنامج ----------
  home(){const L=V5P.po.levels||[],me=V5P.me,top=L.reduce((m,l)=>Math.max(m,+l.rate),0),cur=me&&me.status==="APPROVED";
    $("v5PartBody").innerHTML=`<div class="px">${V5P.hero("VEXORA","PARTNERS",L5("برنامج شركاء فيكسورا","VEXORA partner program"),"🤝")}${V5P.nav()}
      <div class="px-c px-strip"><span>🔗 ${L5("رابط إحالة","Referral link")} <b>${L5("خاص بيك","of your own")}</b></span><span>📊 ${L5("لوحة أرباح","Earnings dashboard")} <b>${L5("لحظية","live")}</b></span><span>🏅 ${L5("مستويات","Levels that")} <b>${L5("ترفع نسبتك","raise your rate")}</b></span></div>
      <div class="px-g3">
        <div class="px-c top"><h3 class="g">💼 ${V5P.PT.sales[1]()}</h3><div class="px-li"><i>🔗</i><span>${L5("رابط إحالة شخصي","Personal referral link")}<small>${L5("كل بيع من رابطك ينسجل باسمك","Every sale from your link is attributed to you")}</small></span></div><div class="px-li"><i>💵</i><span>${L5("عمولة على كل بيع مؤكد","Commission on confirmed sales")}<small>${esc((V5P.po.products||[]).map(p=>p.name).join("، "))}</small></span></div><div class="px-li"><i>📈</i><span>${L5("نسبة ترتفع ويه مستواك","Rate grows with your level")}<small>${esc(L.map(l=>l.name).join(" → "))}</small></span></div></div>
        <div class="px-c top"><h3 class="vio">🏬 ${V5P.PT.distributor[1]()}</h3><div class="px-li"><i>🎨</i><span>${L5("مواد تسويقية جاهزة","Ready marketing kit")}<small>${L5("بانرات، فيديوهات، نصوص","Banners, videos, copy")}</small></span></div><div class="px-li"><i>🧑‍🏫</i><span>${L5("المنصة والأكاديمية لعملائك","Platform & academy for your clients")}<small>${L5("نفس تجربة فيكسورا الكاملة","The full VEXORA experience")}</small></span></div><div class="px-li"><i>⚡</i><span>${L5("دعم أولوية","Priority support")}<small>${L5("طلبات دعم من لوحتك","Support tickets from your dashboard")}</small></span></div></div>
        <div class="px-c top"><h3 class="y">🏦 ${L5("طلب IB لدى INFINOX","IB with INFINOX")}</h3><div class="px-li"><i>📝</i><span>${L5("نراجع طلبك ونرفعه","We review and forward it")}<small>${L5("فيكسورا تجهز ملفك","VEXORA prepares your file")}</small></span></div><div class="px-li"><i>✅</i><span>${L5("الموافقة من الوسيط نفسه","Approval by the broker only")}<small>${L5("رقم IB رسمي من INFINOX","Official IB number from INFINOX")}</small></span></div><div class="px-li"><i>📊</i><span>${L5("لوحة أرباح IB منفصلة","Separate IB earnings")}<small>${L5("من كشف الوسيط المعتمد","From the broker's official statement")}</small></span></div></div></div>
      <div class="px-c" style="border:1.5px solid var(--pg)"><h3 style="border:0;margin:0 0 4px;font-size:24px">⚡ ${L5("مستويات","Partner")} <em style="color:var(--pg)">${L5("الشركاء","levels")}</em></h3><div class="px-g4" style="margin-top:10px">
        ${L.map(l=>`<div class="px-c px-lv${cur&&V5P.myLevel===l.code?" cur":""}"><em>${esc(l.icon)}</em><h4>${esc(l.name)}</h4><b>${+l.rate}%</b><p>${esc(l.upgrade_rule||"")}${l.perks?`<br>+ ${esc(l.perks)}`:""}</p></div>`).join("")}</div>
        <p style="text-align:center;color:#b9a9d6;font-size:12.5px;margin:12px 0 0">${L5("النسب والشروط تحددها الإدارة وممكن تتعدل لاحقاً (ما تأثر على عمولات معتمدة). العمولة على المبيعات المؤكدة بس. التسجيل عند الوسيط أو الإيداع مو بيع. عمولات IB مو ضمن هذا الجدول.","Rates are set by VEXORA and may change (never retroactively). Commission on confirmed sales only. Broker signups or deposits are not sales. IB commissions are not part of this table.")}</p></div>
      <div class="px-g2"><div class="px-c"><b style="color:#fff;font-size:17px">🧮 ${L5("شلون تنحسب العمولة؟","How commission works")}</b><div class="p-tl" style="margin-top:8px">
        <div class="ok"><b>1</b><span>${L5("العميل يشتري من رابطك","Client buys via your link")}<small>${L5("البيع ينسجل باسمك مع المصدر","Sale recorded with its source")}</small></span></div><div class="ok"><b>2</b><span>${L5("التحقق من الدفع","Payment verified")}<small>PENDING → VERIFIED</small></span></div><div class="ok"><b>3</b><span>${L5("تخلص فترة الاسترجاع وتعتمدها الإدارة","Refund window ends, admin approves")}<small>APPROVED</small></span></div><div class="on"><b>4</b><span>${L5("تطلب سحب والإدارة تدفع","You request payout, admin pays")}<small>PAID · ${L5("وإذا انسترجع المبلغ تصير","refunds become")} REVERSED</small></span></div></div></div>
        <div class="px-c"><b style="color:#fff;font-size:17px">❓ ${L5("الأسئلة الشائعة","FAQ")}</b>${[[L5("هل الانضمام مجاني؟","Is joining free?"),L5("إي، ما أكو أي رسوم انضمام.","Yes, there are no fees.")],[L5("شوكت أكدر أسحب أرباحي؟","When can I withdraw?"),L5(`بعد ما تنعتمد العمولة ويوصل رصيدك للحد الأدنى (${esc(V5P.po.min_payout||"—")}$)، تطلب سحب من لوحتك والإدارة تراجعه.`,`Once approved and above the minimum (${esc(V5P.po.min_payout||"—")}$), request a payout from your dashboard.`)],[L5("إيداع العميل يحسبلي عمولة؟","Do client deposits earn commission?"),L5("لا. العمولة بس على مبيعات خدمات فيكسورا المؤكدة.","No. Only confirmed VEXORA service sales.")],[L5("شنو الفرق بين الشريك والـ IB؟","Partner vs IB?"),L5("الشريك يكسب من مبيعات فيكسورا. الـ IB صفة يمنحها الوسيط INFINOX نفسه وعمولاته حسب اتفاقيته.","Partners earn on VEXORA sales. IB status is granted by INFINOX under its own agreement.")],[L5("أكدر أوعد الناس بأرباح؟","Can I promise profits?"),L5("لا. ممنوع الوعد بأرباح أو نتائج تداول، ولازم تفصح إنك شريك.","No. Profit promises are prohibited and you must disclose the partnership.")]].map(([q,a])=>`<details class="px-faq"><summary>${q}</summary><p>${a}</p></details>`).join("")}</div></div>
      <div class="px-tags"><span class="vio">SALES PARTNER</span><span>DISTRIBUTOR</span><span>IB APPLICANT</span><span>MARKETING KIT</span><span>LIVE DASHBOARD</span></div>
      <div class="px-cta"><div><div class="ok">✅ ${L5("مجاني · بدون رسوم انضمام","Free · no joining fee")}</div><h2>${L5("صير","Become a")} <em>Partner</em> ${L5("ويه فيكسورا","with VEXORA")}</h2><p>${L5("قدّم، وقّع العقد إلكترونياً، وتنفتح لوحتك بعد موافقة الإدارة","Apply, e-sign the agreement, your dashboard opens after approval")}</p></div><div class="px-big"><b>${top}%</b><span>${L5("أعلى نسبة بأعلى مستوى","Top-level rate")}</span></div>${me?`<a class="px-btn" href="#${me.status==="APPROVED"?"partner/dashboard":"partners/apply"}">${me.status==="APPROVED"?"📊 "+L5("افتح لوحتي","Open dashboard"):"📮 "+L5("حالة طلبي","My application")}</a>`:`<a class="px-btn" href="#partners/apply">🚀 ${L5("قدّم الآن","Apply now")}</a>`}</div></div>`},
  // ---------- طلب الانضمام ----------
  apply(){const me=V5P.me,b=$("v5PartBody");
    if(me&&me.status!=="REJECTED"){const st=V5P.PST[me.status]||["v",()=>me.status],steps=[["PENDING",L5("انرسل الطلب","Submitted")],["UNDER_REVIEW",L5("قيد المراجعة","Under review")],["APPROVED",L5("مقبول · تنفتح لوحتك","Approved · dashboard opens")]],idx=steps.findIndex(s=>s[0]===me.status);
      b.innerHTML=`<div class="px">${V5P.hero(L5("طلب","PARTNER"),L5("الشراكة","APPLICATION"),`<span class="px-s ${st[0]}">${st[1]()}</span>`,"📮")}${V5P.nav()}
        <div class="px-g2"><div class="px-c"><b style="color:#fff;font-size:17px">📮 ${L5("حالة طلبك","Your application")}</b><div class="p-tl" style="margin-top:10px">${me.status==="SUSPENDED"?`<div class="on"><b>!</b><span>SUSPENDED · ${L5("الحساب معلّق","Account suspended")}<small>${esc(me.admin_note||"")}</small></span></div>`:steps.map((s,i)=>`<div class="${i<idx||me.status==="APPROVED"?"ok":i===idx?"on":""}"><b>${i<idx||me.status==="APPROVED"?"✓":i+1}</b><span>${s[0]} · ${s[1]}${i===0?`<small>${new Date(me.created_at).toLocaleString("en-GB")}</small>`:""}</span></div>`).join("")}</div>
          ${me.status==="APPROVED"?`<a class="px-btn" style="margin-top:12px;font-size:15px;padding:12px 22px" href="#partner/dashboard">📊 ${L5("افتح لوحة الشريك","Open dashboard")}</a>`:""}</div>
          <div style="display:grid;gap:14px;align-content:start"><div class="px-c p-warn">🔒 ${L5("صلاحيات الشريك (الرابط واللوحة والعمولات) ما تنفتح إلا بعد موافقة الإدارة اليدوية.","Partner features open only after manual admin approval.")}</div>
          <div class="px-c"><b style="color:#fff">🧾 ${L5("سجل التوقيع","Signature record")}</b><div class="label" style="font-size:12.5px;line-height:2;margin-top:6px">${L5("نوع الشراكة","Type")}: ${esc((V5P.PT[me.ptype]||["",()=>me.ptype])[1]())}<br>${L5("إصدار العقد","Agreement version")}: ${esc(me.contract_version||"—")}<br>${L5("وقت القبول","Accepted at")}: ${me.signed_at?new Date(me.signed_at).toLocaleString("en-GB"):"—"} (UTC ${L5("محفوظ","stored")})</div></div></div></div></div>`;return}
    const C=V5P.po.contracts||[],pt=V5P.applyType||"sales",k=C.find(c=>c.ptype===pt)||{};
    b.innerHTML=`<div class="px">${V5P.hero(L5("طلب","PARTNER"),L5("الانضمام","APPLICATION"),me&&me.status==="REJECTED"?`⛔ ${L5("الطلب السابق ما انقبل","Previous application rejected")}${me.admin_note?": "+esc(me.admin_note):""}`:L5("4 خطوات وتخلص","4 quick steps"),"📝")}${V5P.nav()}
      <div class="px-c"><div class="p-step"><span class="ok">✓ ${L5("الحساب","Account")}</span><i>←</i><span class="on">2 ${L5("نوع الشراكة وبياناتك","Type & details")}</span><i>←</i><span class="on">3 ${L5("العقد والتوقيع","Agreement & signature")}</span><i>←</i><span>4 ${L5("الإرسال والمتابعة","Submit & track")}</span></div></div>
      <div class="px-g3">${["sales","distributor"].map(t=>`<button type="button" class="px-c px-type${t===pt?" on":""}" data-pt="${t}"><span class="px-demo">${V5P.PT[t][2]}</span><h4>${V5P.PT[t][0]} ${V5P.PT[t][1]()}</h4></button>`).join("")}<a class="px-c px-type" href="#partners/ib"><span class="px-demo">IB Applicant</span><h4>🏦 ${V5P.PT.ib[1]()} ←</h4></a></div>
      <div class="px-g2"><div class="px-c"><b style="color:#fff;font-size:17px">👤 ${L5("بياناتك","Your details")}</b><div class="k-form px-form" style="margin-top:10px">
        <label class="w2">${L5("الاسم الكامل","Full name")} *<input class="f" id="paN" value="${escA((ME.profile&&ME.profile.full_name)||"")}"></label><label>${L5("الدولة","Country")}<input class="f" id="paC" value="${escA((ME.profile&&ME.profile.country)||"")}"></label>
        <label>${L5("الهاتف","Phone")}<input class="f ltr" id="paP" value="${escA((ME.profile&&ME.profile.phone)||"")}"></label><label class="w2">${L5("قنوات الترويج","Promotion channels")}<input class="f" id="paCh" placeholder="${L5("تيليجرام، إنستغرام، يوتيوب…","Telegram, Instagram, YouTube…")}"></label>
        <label class="w3">${L5("خبرتك وجمهورك","Experience & audience")}<textarea class="f" id="paE"></textarea></label></div></div>
      <div class="px-c"><b style="color:#fff;font-size:17px">📄 ${esc(k.title||"")}</b><p class="label" style="font-size:12px;margin:4px 0 10px">${L5("الإصدار","Version")} ${esc(k.version||"")} · ${L5("قالب يحتاج مراجعة مختص قانوني قبل اعتماده نهائياً","Template pending legal review")}</p>
        <div class="p-doc" tabindex="0">${esc(k.body||"").replace(/\n/g,"<br>")}</div>
        <label class="tgl" style="margin-top:10px"><input type="checkbox" id="paA"> ${L5("قريت العقد كامل وأوافق على الشروط","I have read and accept the agreement")}</label><label class="tgl"><input type="checkbox" id="paD"> ${L5("ألتزم بالإفصاح عن علاقتي التجارية بفيكسورا بالتسويق","I will disclose my commercial relationship with VEXORA")}</label>
        <label class="px-sigl">✍️ ${L5("اكتب اسمك الكامل كتوقيع إلكتروني","Type your full name as e-signature")}<input class="f px-sig" id="paS" autocomplete="off"></label>
        <button class="px-btn" type="button" id="paGo" style="margin-top:12px;font-size:15px;padding:12px 22px">✅ ${L5("وقّع وأرسل الطلب","Sign & submit")}</button></div></div></div>`;
    b.querySelectorAll("[data-pt]").forEach(x=>x.onclick=()=>{V5P.applyType=x.dataset.pt;V5P.apply()});
    $("paGo").onclick=async()=>{const g=id=>$(id).value.trim();const d={ptype:pt,full_name:g("paN"),country:g("paC"),phone:g("paP"),channels:g("paCh"),experience:g("paE"),contract_id:k.id,accept:$("paA").checked,disclose:$("paD").checked,sign_name:g("paS"),ua:navigator.userAgent.slice(0,200)};
      if(d.full_name.length<3){V5.toast(L5("اكتب اسمك الكامل","Enter your full name"),1);return}if(!d.accept||!d.disclose){V5.toast(L5("لازم توافق على العقد والإفصاح","Accept the agreement and disclosure"),1);return}if(d.sign_name.length<3){V5.toast(L5("اكتب اسمك كتوقيع","Type your name as signature"),1);return}
      $("paGo").disabled=true;try{await V5.api().apply(d);V5.toast(L5("✅ انرسل طلبك. نبلغك أول ما تراجعه الإدارة.","✅ Submitted. We'll notify you after review."));V5P.open("apply")}catch(e){V5.toast(V5.err(e),1);$("paGo").disabled=false}}},
  // ---------- لوحة الشريك ----------
  async dash(){const b=$("v5PartBody");let d;try{d=await V5.api().dash()}catch(e){b.innerHTML=`<div class="px">${V5P.hero("PARTNER","DASHBOARD","","📊")}${V5P.nav()}<div class="px-c">🔒 ${esc(V5.err(e))} <a class="px-btn2" href="#partners/apply">${L5("قدّم طلب","Apply")}</a></div></div>`;return}
    V5P.myLevel=d.level&&d.level.code;const lv=d.level||{},nx=d.next,L=d.levels||[],n=d.confirmed||0,mx=Math.max(n,...L.map(l=>l.min_sales)),sum=d.sum||{};
    const link=`${location.origin}${location.pathname.replace(/[^/]*$/,"")}app.html?p=${d.code}`;
    // شريط المراحل: محطات المستويات + نقاط وسطية
    const stops=[...new Set([0,...L.map(l=>+l.min_sales),n].concat(L.length?[]:[1]))].sort((a,b)=>a-b),ms=stops.map((s,i)=>{const l=L.find(x=>+x.min_sales===s),ok=n>=s;return(i?`<div class="ln${n>=s?" ok":""}"></div>`:"")+`<div class="d${l?" big":""}${ok?" ok":""}">${l?(ok&&s===0?"✓":esc(l.icon)):""}<label>${l?esc(l.name)+" "+(s||""):s===n?L5("أنت ","you ")+s:s}</label></div>`}).join("");
    const dv=(d.daily||[]).map(x=>x.v),trend=d.visits_prev30?Math.round((d.visits30-d.visits_prev30)/d.visits_prev30*100):null;
    const ST={PENDING:L5("معلقة","Pending"),VERIFIED:L5("متحقق منها","Verified"),APPROVED:L5("معتمدة","Approved"),PAID:L5("مدفوعة","Paid"),REVERSED:L5("ملغاة","Reversed")};
    b.innerHTML=`<div class="px">${V5P.hero("PARTNER","DASHBOARD",`${esc(lv.icon||"🏅")} ${esc(lv.name||"")} · ${+lv.rate||0}%`,"📊")}${V5P.nav()}
      ${d.demoView?`<div class="px-c p-warn">🧪 ${L5("معاينة الإدارة: هاي لوحة شريك تجريبي.","Admin preview: demo partner dashboard.")}</div>`:""}
      <div class="px-c"><div class="px-ach"><span>${L5("المبيعات المؤكدة","Confirmed sales")}<b>${n}</b></span><span>${L5("العمولة المدفوعة","Paid commission")}<b>${V5P.money(sum.paid)}</b></span>${nx?`<span>${L5("للمستوى الجاي","To next level")} ${esc(nx.icon)}<b class="y">${Math.max(0,nx.min_sales-n)} ${L5("مبيعة","sales")}</b></span>`:`<span>💎 ${L5("وصلت أعلى مستوى","Top level reached")}</span>`}</div>
        <div class="px-ms" style="margin-bottom:30px">${ms}</div></div>
      <div class="px-g4"><div class="px-kpi"><span>${L5("الزيارات (30 يوم)","Visits (30d)")}</span><b>${(d.visits30||0).toLocaleString("en-US")}</b><small${trend!=null&&trend<0?' class="dn"':""}>${trend==null?L5("المجموع ","total ")+d.visits:(trend>=0?"↑ ":"↓ ")+Math.abs(trend)+"%"}</small>${V5P.spark(dv)}</div>
        <div class="px-kpi"><span>${L5("العملاء المحالين","Referred clients")}</span><b>${d.referred||0}</b><small>+${d.referred30||0} ${L5("آخر 30 يوم","last 30d")}</small>${V5P.spark(dv.map((x,i)=>i))}</div>
        <div class="px-kpi"><span>${L5("عمولة مستحقة","Available")}</span><b style="color:var(--pg)">${V5P.money(sum.approved)}</b><small>${sum.in_payout?L5("بطلب سحب: ","in payout: ")+V5P.money(sum.in_payout):L5("جاهزة للسحب","ready to withdraw")}</small>${V5P.spark([1,2,2,3,4,5])}</div>
        <div class="px-kpi"><span>${L5("عمولة معلقة","Pending")}</span><b style="color:var(--py)">${V5P.money(sum.pending)}</b><small class="dn">${L5("بانتظار التحقق والاعتماد","awaiting verification")}</small>${V5P.spark([3,2,3,2,2,1],"#ffd84d")}</div></div>
      <div class="px-g2"><div class="px-c"><div class="n-hd"><b style="font-size:16px;color:#fff">🧾 ${L5("سجل العمليات","Transactions")}</b><button class="px-btn2" type="button" id="pdCsv">⬇️ CSV</button></div>
        <div class="v3-tw"><table class="px-tbl"><tr><th>${L5("التاريخ","Date")}</th><th>${L5("المنتج","Product")}</th><th class="hm">${L5("المبلغ","Amount")}</th><th>${L5("العمولة","Commission")}</th><th>${L5("الحالة","Status")}</th></tr>
        ${(d.ledger||[]).slice(0,40).map(r=>`<tr><td class="v">${new Date(r.at).toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"})}</td><td>${r.kind==="commission"?esc(r.product||""):r.kind==="reversal"?"↩️ "+L5("خصم استرجاع","Refund deduction"):"🧾 "+L5("تسوية","Adjustment")+": "+esc(r.note||"")}</td><td class="v hm">${r.amount!=null?V5P.money(r.amount,r.currency):"—"}</td><td class="v ${r.commission>=0&&r.status!=="REVERSED"?"g":""}">${V5P.money(r.commission,r.currency)}</td><td><span class="px-s ${V5P.CST[r.status]||"v"}" title="${escA(ST[r.status]||"")}">${esc(r.status)}</span></td></tr>`).join("")||`<tr><td colspan="5" class="label">${L5("لسه ما أكو عمليات. شارك رابطك!","No transactions yet. Share your link!")}</td></tr>`}</table></div>
        <div id="pdPay" style="margin-top:14px"></div></div>
      <div style="display:grid;gap:14px;align-content:start"><div class="px-c"><b style="color:#fff">🔗 ${L5("رابط الإحالة","Referral link")}</b><div class="px-ref" style="margin-top:10px"><div id="pdLink">${esc(link)}</div><button class="px-btn2" type="button" id="pdCopy">${L5("نسخ","Copy")}</button></div><p class="label" style="font-size:11.5px;margin:8px 0 0">${L5("أي شخص يسجل من رابطك خلال 30 يوم ينحسب إلك (أول رابط بس).","Signups from your link are attributed for 30 days (first touch).")}</p></div>
        <div class="px-c"><b style="color:#fff">🎨 ${L5("المواد التسويقية","Marketing kit")}</b>${(d.assets||[]).map(a=>`<a class="px-li" href="${escA(a.url)}" target="_blank" rel="noopener"><i>${a.kind==="video"?"🎬":a.kind==="doc"?"📄":"🖼"}</i><span>${esc(a.title)}</span></a>`).join("")||`<p class="label">${L5("تنضاف قريباً.","Coming soon.")}</p>`}<a class="px-li" href="#partners/agreement"><i>📄</i><span>${L5("عقد الشراكة الموقّع","Signed agreement")} · ${esc(d.contract&&d.contract.version||"")}</span></a></div>
        <div class="px-c"><b style="color:#fff">🎧 ${L5("طلبات الدعم","Support tickets")}</b>${(d.tickets||[]).slice(0,4).map(t=>`<details class="px-faq"><summary>${esc(t.subject)} <span class="px-s ${t.status==="open"?"pe":"a"}">${t.status==="open"?L5("مفتوح","Open"):L5("انرد","Answered")}</span></summary><p>${esc(t.body)}</p>${t.reply?`<p style="color:var(--pg)">↩️ ${esc(t.reply)}</p>`:""}</details>`).join("")}
          <div class="k-form px-form" style="grid-template-columns:minmax(0,1fr);margin-top:8px"><input class="f" id="ptS" placeholder="${L5("الموضوع","Subject")}"><textarea class="f" id="ptB" placeholder="${L5("تفاصيل طلبك","Details")}"></textarea></div><button class="px-btn2" type="button" id="ptGo" style="margin-top:8px">➕ ${L5("أرسل طلب دعم","Send ticket")}</button></div></div></div></div>`;
    const open=(d.payouts||[]).find(p=>["requested","approved"].includes(p.status)),av=+sum.approved||0,minp=+d.min_payout||0;
    $("pdPay").innerHTML=open?`<div class="px-c p-warn">💸 ${L5("طلب سحب","Payout")} #${open.id} · ${V5P.money(open.amount)} · ${open.status==="approved"?L5("معتمد وبانتظار التحويل","approved, awaiting transfer"):L5("قيد المراجعة","under review")}</div>`
      :av>0&&av>=minp?`<div class="k-form px-form"><label>${L5("طريقة الاستلام","Method")}<select class="f" id="poM"><option>USDT TRC20</option><option>${L5("حوالة بنكية","Bank transfer")}</option><option>${L5("أخرى","Other")}</option></select></label><label class="w2">${L5("تفاصيل الاستلام","Payout details")}<input class="f ltr" id="poD"></label></div><button class="px-btn" type="button" id="poGo" style="margin-top:10px;font-size:15px;padding:12px 22px">💸 ${L5("اطلب سحب","Request payout")} ${V5P.money(av)}</button> <span class="label" style="font-size:12px">${L5("السحب يحتاج اعتماد الإدارة","Requires admin approval")}</span>`
      :`<span class="label" style="font-size:12.5px">💸 ${L5(`السحب يتفعل لما يوصل رصيدك المعتمد ${minp}$.`,`Payout unlocks at ${minp}$ approved.`)}</span>`;
    if($("poGo"))$("poGo").onclick=async()=>{const det=$("poD").value.trim();if(det.length<4){V5.toast(L5("اكتب تفاصيل الاستلام","Enter payout details"),1);return}try{await V5.api().payout($("poM").value,det);V5.toast(L5("✅ انرسل طلب السحب","✅ Payout requested"));V5P.open("dashboard")}catch(e){V5.toast(V5.err(e),1)}};
    $("pdCopy").onclick=async()=>{try{await navigator.clipboard.writeText(link);V5.toast(L5("✅ انسخ الرابط","✅ Copied"))}catch(e){prompt("",link)}};
    $("pdCsv").onclick=()=>V5P.csv("vexora-partner-ledger.csv",[["date","kind","product","amount","commission","rate","status"],...(d.ledger||[]).map(r=>[r.at,r.kind,r.product||r.note||"",r.amount==null?"":r.amount,r.commission,r.rate==null?"":r.rate,r.status])]);
    $("ptGo").onclick=async()=>{try{await V5.api().ticket($("ptS").value.trim(),$("ptB").value.trim());V5.toast("✅");V5P.open("dashboard")}catch(e){V5.toast(V5.err(e),1)}}},
  csv(name,rows){const s="﻿"+rows.map(r=>r.map(c=>{let v=String(c==null?"":c);if(/^[=+\-@]/.test(v))v="'"+v;return/[",\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v}).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([s],{type:"text/csv"}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)},
  // ---------- IB ----------
  async ib(){const r=await V5.api().myIb(),a=r.app,k=r.contract||{},b=$("v5PartBody"),edit=!a||["DRAFT","BROKER_REJECTED"].includes(a.status);V5P.ibDocs=(a&&a.docs)||[];
    const steps=["SUBMITTED","VEXORA_REVIEW","BROKER_PENDING","BROKER_APPROVED"],idx=a?steps.indexOf(a.status):-1;
    b.innerHTML=`<div class="px">${V5P.hero("IB","REQUEST",L5("Introducing Broker لدى INFINOX","Introducing Broker with INFINOX"),"🏦")}${V5P.nav()}
      <div class="px-c p-warn">⚠️ ${L5("فيكسورا <b>ما تعتمد IB</b> نيابة عن INFINOX. احنا نراجع طلبك ونرفعه، والموافقة النهائية ورقم IB الرسمي يجون من الوسيط بس. وما تظهر عندك صفة «IB معتمد» إلا بعد ما يوصل إثبات الموافقة.","VEXORA <b>cannot approve IBs</b> on behalf of INFINOX. We review and forward your request; final approval and the official IB number come from the broker only.")}</div>
      <div class="px-g2"><div class="px-c"><b style="color:#fff;font-size:17px">ℹ️ ${L5("شنو يعني IB؟","What is an IB?")}</b><p class="label" style="line-height:1.9;font-size:13px">${L5("الـ Introducing Broker شخص أو جهة تعرّف عملاء على الوسيط، ويحصل على عمولة من الوسيط حسب اتفاقية الوسيط نفسه. شروط التقديم: حساب فيكسورا، بيانات صحيحة، مستند هوية، والموافقة على الإقرار.","An Introducing Broker refers clients to a broker and is paid by the broker under the broker's own agreement. Requirements: a VEXORA account, accurate details, an ID document and accepting the declaration.")}</p>
        ${a?`<b style="color:#fff">📮 ${L5("حالة طلبك","Status")}</b><div class="p-tl" style="margin-top:8px">${a.status==="DRAFT"?`<div class="on"><b>✎</b><span>${V5P.IST.DRAFT()}</span></div>`:a.status==="BROKER_REJECTED"?`<div class="on"><b>!</b><span>BROKER_REJECTED · ${V5P.IST.BROKER_REJECTED()}<small>${esc(a.admin_notes||"")}</small></span></div>`:steps.map((s,i)=>`<div class="${i<idx||(i===idx&&s==="BROKER_APPROVED")?"ok":i===idx?"on":""}"><b>${i<idx||(i===idx&&s==="BROKER_APPROVED")?"✓":i+1}</b><span>${s} · ${V5P.IST[s]()}${i===0&&a.submitted_at?`<small>${new Date(a.submitted_at).toLocaleString("en-GB")}</small>`:""}${i===idx&&a.admin_notes?`<small>${L5("ملاحظة الإدارة","Admin note")}: ${esc(a.admin_notes)}</small>`:""}</span></div>`).join("")}</div>`:""}
        ${edit?`<div class="k-form px-form" style="margin-top:12px"><label class="w2">${L5("الاسم الكامل (مثل الهوية)","Full legal name")} *<input class="f" id="ibN" value="${escA(a&&a.full_name||(ME.profile&&ME.profile.full_name)||"")}"></label><label>${L5("الدولة","Country")} *<input class="f" id="ibC" value="${escA(a&&a.country||(ME.profile&&ME.profile.country)||"")}"></label>
          <label class="w2">${L5("الإيميل","Email")} *<input class="f ltr" id="ibE" type="email" value="${escA(a&&a.email||(ME.profile&&ME.profile.email)||(ME.user&&ME.user.email)||"")}"></label><label>${L5("الهاتف","Phone")}<input class="f ltr" id="ibP" value="${escA(a&&a.phone||"")}"></label>
          <label class="w2">${L5("قنواتك وجمهورك","Channels & audience")}<input class="f" id="ibCh" value="${escA(a&&a.channels||"")}"></label><label>${L5("عدد العملاء المتوقع","Expected clients")}<input class="f ltr" id="ibX" value="${escA(a&&a.expected_clients||"")}"></label>
          <label class="w3">${L5("خبرتك","Experience")}<textarea class="f" id="ibEx">${esc(a&&a.experience||"")}</textarea></label>
          <label class="w3">📎 ${L5("المستندات (هوية، إثبات عنوان) · PDF/JPG/PNG حتى 5MB · تنحفظ بمخزن خاص","Documents (ID, proof of address) · PDF/JPG/PNG up to 5MB · stored privately")}<input class="f" type="file" id="ibF" accept="application/pdf,image/jpeg,image/png,image/webp" multiple></label><div class="w3" id="ibDocs"></div></div>
          <div class="p-doc" style="margin-top:10px;max-height:160px" tabindex="0">${esc(k.body||"").replace(/\n/g,"<br>")}</div>
          <label class="tgl" style="margin-top:10px"><input type="checkbox" id="ibA"> ${L5("قريت الإقرار وأوافق","I accept the declaration")} (${esc(k.version||"")})</label><label class="px-sigl">✍️ ${L5("التوقيع: اكتب اسمك الكامل","Signature: type your full name")}<input class="f px-sig" id="ibS"></label>
          <div class="k-row" style="margin-top:12px"><button class="px-btn" type="button" id="ibGo" style="font-size:15px;padding:12px 22px">📮 ${L5("أرسل الطلب","Submit")}</button><button class="px-btn2" type="button" id="ibDraft">💾 ${L5("حفظ كمسودة","Save draft")}</button></div>`:""}</div>
      <div style="display:grid;gap:14px;align-content:start">${(()=>{const p=r.plan;if(!p)return"";const c=p.currency||"$",row=(l,v,s)=>v==null||v===""?"":`<div class="n-pv"><span>${l}</span><b style="color:var(--pg)">${s?esc(v)+"%":V5P.money(v,c)}</b></div>`;
        return`<div class="px-c" style="border:1.5px solid var(--pg)"><b style="color:#fff">💼 ${L5("خطتك ويه فيكسورا","Your plan with VEXORA")}</b><div style="margin-top:8px">${row(L5("عمولة لكل لوت","Commission per lot"),p.per_lot)}${row(L5("نسبة من العمولة","Commission share"),p.share_pct,1)}${row(L5("كاش باك إلك لكل لوت","Your cashback per lot"),p.cashback_ib)}${row(L5("كاش باك لعملائك لكل لوت","Clients cashback per lot"),p.cashback_clients)}${row(L5("راتب شهري","Monthly salary"),p.salary)}</div>
          ${p.salary_terms?`<p class="label" style="font-size:12.5px;margin:8px 0 0">📌 ${L5("شرط الراتب","Salary condition")}: ${esc(p.salary_terms)}</p>`:""}${p.notes?`<p class="label" style="font-size:12.5px;margin:6px 0 0;white-space:pre-wrap">${esc(p.notes)}</p>`:""}<p class="label" style="font-size:11px;margin:8px 0 0">${L5("آخر تحديث","Updated")}: ${new Date(p.updated_at).toLocaleDateString("en-GB")}</p></div>`})()}<div class="px-c"><b style="color:#fff">💰 ${L5("أرباح IB","IB earnings")}</b><p class="label" style="font-size:12.5px;margin:4px 0 10px">${L5("لوحة منفصلة عن مبيعات فيكسورا. تنفتح بعد اعتماد الوسيط.","Separate from VEXORA sales. Opens after broker approval.")}</p>
        <div class="n-pv"><span>${L5("رقم IB","IB number")}</span><b class="ltr">${a&&a.ib_number?esc(a.ib_number):`<span class="label">— ${L5("بانتظار الوسيط","awaiting broker")}</span>`}</b></div>
        <div class="n-pv"><span>${L5("حالة اعتماد الوسيط","Broker status")}</span><span class="label">${a?esc(V5P.IST[a.status]?V5P.IST[a.status]():a.status):"—"}</span></div>
        ${(r.earnings||[]).length?`<div class="v3-tw"><table class="px-tbl" style="margin-top:8px"><tr><th>${L5("الفترة","Period")}</th><th>${L5("عملاء معتمدين","Clients")}</th><th>${L5("مؤكدة","Confirmed")}</th><th>${L5("معلقة","Pending")}</th><th>${L5("مدفوعة","Paid")}</th></tr>${r.earnings.map(e=>`<tr><td class="v">${esc(e.period)}</td><td class="v">${e.clients}</td><td class="v g">${V5P.money(e.confirmed,e.currency)}</td><td class="v">${V5P.money(e.pending,e.currency)}</td><td class="v">${V5P.money(e.paid,e.currency)}</td></tr>`).join("")}</table></div>`:""}
        <div class="n-pv"><span>${L5("آخر مزامنة / المصدر","Last sync / source")}</span><span class="label">${r.last_sync?new Date(r.last_sync).toLocaleString("en-GB")+" · ":""}${L5("كشف الوسيط المعتمد من الإدارة","Broker statement imported by admin")}</span></div>
        <p class="label" style="font-size:11.5px;margin:8px 0 0">${L5("الأرقام تجي بس من كشف الوسيط الرسمي، وما نحسب أي عمولة تداول افتراضية. أي مشاركة لعمولات IB لازم تكون مصرّح بيها باتفاقية الوسيط والقوانين.","Figures come only from the broker's official statement; we never compute hypothetical trading commissions.")}</p></div></div></div></div>`;
    if(!edit)return;
    const docs=()=>{$("ibDocs").innerHTML=V5P.ibDocs.map((p,i)=>`<span class="px-s v" style="margin:2px">📎 ${esc(p.split("/").pop())} <button type="button" data-rm="${i}" class="px-x" aria-label="remove">✕</button></span>`).join("");$("ibDocs").querySelectorAll("[data-rm]").forEach(x=>x.onclick=()=>{V5P.ibDocs.splice(+x.dataset.rm,1);docs()})};docs();
    $("ibF").onchange=async()=>{for(const f of $("ibF").files){if(f.size>5242880){V5.toast(L5("الملف أكبر من 5MB","File over 5MB"),1);continue}if(!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type)){V5.toast(L5("نوع الملف مو مسموح","File type not allowed"),1);continue}
      try{V5P.ibDocs.push(await V5.api().uploadDoc(f,ME.user&&ME.user.id));docs()}catch(e){V5.toast(V5.err(e),1)}}$("ibF").value=""};
    const data=()=>{const g=id=>$(id).value.trim();return{full_name:g("ibN"),country:g("ibC"),email:g("ibE"),phone:g("ibP"),channels:g("ibCh"),expected_clients:g("ibX"),experience:$("ibEx").value,docs:V5P.ibDocs,accept:$("ibA").checked,sign_name:g("ibS"),ua:navigator.userAgent.slice(0,200)}};
    $("ibDraft").onclick=async()=>{try{await V5.api().ibSave(data(),false);V5.toast("✅ "+L5("انحفظت المسودة","Draft saved"))}catch(e){V5.toast(V5.err(e),1)}};
    $("ibGo").onclick=async()=>{const d=data();if(!d.docs.length){V5.toast(L5("ارفع مستند الهوية","Upload your ID"),1);return}if(!d.accept||d.sign_name.length<3){V5.toast(L5("وافق على الإقرار ووقّع","Accept and sign"),1);return}
      try{await V5.api().ibSave(d,true);V5.toast(L5("✅ انرسل طلب IB","✅ IB request submitted"));V5P.open("ib")}catch(e){V5.toast(V5.err(e),1)}}},
  // ---------- العقد ----------
  agreement(){const C=V5P.po.contracts||[],t=V5P.agT||(V5P.me&&V5P.me.ptype)||"sales",k=C.find(c=>c.ptype===t)||{},me=V5P.me;
    $("v5PartBody").innerHTML=`<div class="px">${V5P.hero(L5("عقد","PARTNER"),L5("الشراكة","AGREEMENT"),L5("قالب قابل للتعديل · يحتاج مراجعة قانونية","Editable template · pending legal review"),"📄")}${V5P.nav()}
      <div class="px-nav">${["sales","distributor","ib"].map(x=>`<button type="button" data-ag="${x}" class="${x===t?"on":""}">${V5P.PT[x][0]} ${V5P.PT[x][1]()}</button>`).join("")}</div>
      <div class="px-c"><b style="color:#fff;font-size:18px">${esc(k.title||"")}</b><p class="label" style="font-size:12px">${L5("الإصدار","Version")} ${esc(k.version||"")}</p><div class="p-doc" style="max-height:none" tabindex="0">${esc(k.body||"").replace(/\n/g,"<br>")}</div>
      ${me&&me.ptype===t&&me.signed_at?`<div class="px-c" style="margin-top:12px"><b style="color:var(--pg)">✅ ${L5("وقّعت هذا العقد","You signed this agreement")}</b><div class="label" style="font-size:12.5px;line-height:2">${L5("الإصدار","Version")}: ${esc(me.contract_version)} · ${new Date(me.signed_at).toLocaleString("en-GB")}</div></div>`:""}</div></div>`;
    $("v5PartBody").querySelectorAll("[data-ag]").forEach(x=>x.onclick=()=>{V5P.agT=x.dataset.ag;V5P.agreement()})},
  // ---------- دعم الوسيط ----------
  async support(){const lg=(window.LANG||"ar"),B=await V5.api().brokers(lg,(ME.profile&&ME.profile.country)||""),b=$("v5PartBody");
    const tg=u=>u?`https://t.me/${encodeURIComponent(String(u).replace(/^@/,""))}`:"",wa=n=>n?`https://wa.me/${String(n).replace(/[^0-9]/g,"")}`:"";
    b.innerHTML=`<div class="px">${V5P.hero(L5("دعم","BROKER"),L5("الوسيط","SUPPORT"),L5("جهات الدعم الرسمية للوسيط","Official broker support contacts"),"🎧")}${V5P.nav()}
      <div class="px-g2">${B.map(x=>`<div class="px-c"><div class="p-bk"><div class="lg">${x.logo_url?`<img src="${escA(x.logo_url)}" alt="">`:esc(x.broker)}</div><div><h3 style="margin:0;color:#fff">${esc(x.broker)} <span class="px-s a">✓ ${L5("جهة دعم موثّقة","Verified contact")}</span>${x.is_default?` <span class="px-s v">${L5("افتراضي","Default")}</span>`:""}</h3>
        <p class="label" style="margin:4px 0 0;font-size:12.5px">${x.agent_name?`${L5("مسؤول الدعم","Agent")}: ${esc(x.agent_name)} · `:""}${x.hours?`🕐 ${esc(x.hours)} · `:""}🌐 ${esc((x.langs||[]).join(", "))}</p></div></div>
        <div class="p-ct">${x.telegram?`<a href="${escA(tg(x.telegram))}" target="_blank" rel="noopener">✈️ Telegram</a>`:""}${x.whatsapp?`<a href="${escA(wa(x.whatsapp))}" target="_blank" rel="noopener">🟢 WhatsApp</a>`:""}${x.email?`<a href="mailto:${escA(x.email)}">✉️ Email</a>`:""}${x.website?`<a href="${escA(x.website)}" target="_blank" rel="noopener">🌐 ${L5("الموقع الرسمي","Website")}</a>`:""}</div>
        ${x.notes?`<p class="label" style="font-size:12.5px;line-height:1.8;margin:10px 0 0">${esc(x.notes)}</p>`:""}</div>`).join("")||`<div class="px-c">${L5("جهات دعم الوسيط تنضاف من الإدارة بعد التحقق منها.","Broker contacts are added by admin after verification.")}</div>`}
      <div class="px-c p-warn">📌 ${L5("لفتح حساب أو مشاكل الإيداع والسحب تواصل ويه دعم الوسيط مباشرة. فيكسورا ولا الوسيط يطلبون منك كلمة سر حسابك أبداً.","For account opening, deposits or withdrawals contact the broker directly. Neither VEXORA nor the broker will ever ask for your password.")}<br><br><a class="px-btn2" href="#" data-sup>🎧 ${L5("دعم فيكسورا","VEXORA support")}</a></div></div></div>`}
};

/* ---------- إدارة الشركاء (/admin/partners, /admin/broker-support) ---------- */
const V5PA={tab:"requests",f:"open",
  async open(a){if(a==="brokers")V5PA.tab="brokers";const b=$("v5PartAdmBody");if(!b)return;
    if(!isAdminUser()){b.innerHTML=`<div class="panel rc-empty">⛔ ${L5("إدارة الشركاء للمالك/الأدمن بس.","Owner/admin only.")}</div>`;return}
    b.innerHTML=`<div class="panel label">${L5("جاري التحميل…","Loading…")}</div>`;
    try{V5PA.d=await V5.api().adm.data();try{V5PA.v6=await V5.api().adm.v6()}catch(e){V5PA.v6={incentives:[],claims:[],tree:{},cfg:{}}}V5PA.render()}catch(e){b.innerHTML=`<div class="panel rc-empty">⚠️ ${esc(V5.err(e))}</div>`}},
  act(fn,ok){return async()=>{try{await fn();V5.toast("✅ "+(ok||L5("تم","Done")));await V5PA.open()}catch(e){V5.toast(V5.err(e),1)}}},
  render(){const d=V5PA.d,P=d.partners||[],b=$("v5PartAdmBody"),C=d.comms||[];
    const T=[["requests","📝 "+L5("الطلبات والشركاء","Applications")],["comms","💰 "+L5("العمولات","Commissions")],["payouts","💸 "+L5("السحوبات","Payouts")],["levels","🏅 "+L5("الرتب والنسب والفريق","Ranks, rates & team")],["incent","🎁 "+L5("الحوافز والهدايا","Rewards")],["contracts","📄 "+L5("العقود","Agreements")],["ib","🏦 IB"],["brokers","🎧 "+L5("دعم الوسيط","Broker support")],["assets","🎨 "+L5("المواد والدعم","Assets & tickets")],["reports","📊 "+L5("التقارير","Reports")],["audit","📜 "+L5("السجل","Audit")],["network","🌳 "+L5("الخطة الشبكية","Network plan")],["ibset","🏦 "+L5("تسوية IB","IB settlement")],["v7","⚙️ "+L5("إعدادات إضافية","More settings")]];
    const sm=f=>Math.round(C.filter(f).reduce((s,c)=>s+(+c.amount||0),0)*100)/100;
    b.innerHTML=`<div class="panel"><div class="n-hd"><h2>🛠 ${L5("إدارة الشركاء","Partner admin")}<small>${L5("قبول ورفض، مستويات، عمولات، سحوبات، IB، ودعم الوسيط. كل إجراء ينحفظ بسجل التدقيق. ما يكدر أي شريك يغير نسبته أو يعتمد أرباحه.","Approvals, levels, commissions, payouts, IB and broker support. Every action is audit-logged.")}</small></h2><div class="k-row">${V5.demoBadge()}<a class="btn v2s" href="#partners">← ${L5("بوابة الشركاء","Partner portal")}</a></div></div>
      <div class="k-tabs" style="margin-top:12px">${T.map(([k,l])=>`<button type="button" data-pt="${k}" class="${k===V5PA.tab?"on":""}">${l}</button>`).join("")}</div></div>
      <div class="n-kpi"><div><span>${L5("طلبات جديدة","New applications")}</span><b style="color:#f2d27a">${P.filter(p=>["PENDING","UNDER_REVIEW"].includes(p.status)).length}</b></div><div><span>${L5("شركاء فعّالين","Active partners")}</span><b>${P.filter(p=>p.status==="APPROVED").length}</b></div><div><span>${L5("طلبات IB مفتوحة","Open IB requests")}</span><b>${(d.ib||[]).filter(a=>!["BROKER_APPROVED","BROKER_REJECTED"].includes(a.status)).length}</b></div><div><span>${L5("عمولات بانتظار الاعتماد","Awaiting approval")}</span><b style="color:#ffc46b">$${sm(c=>c.status==="VERIFIED")}</b></div><div><span>${L5("سحوبات معلقة","Open payouts")}</span><b>${(d.payouts||[]).filter(x=>["requested","approved"].includes(x.status)).length}</b></div><div><span>${L5("مدفوع (الكل)","Paid (all)")}</span><b style="color:#7fe0b8">$${sm(c=>c.status==="PAID")}</b></div></div>
      <div id="paBody"></div>`;
    b.querySelectorAll("[data-pt]").forEach(x=>x.onclick=()=>{V5PA.tab=x.dataset.pt;V5PA.render()});V5PA[V5PA.tab]()},
  requests(){const d=V5PA.d,F={open:p=>["PENDING","UNDER_REVIEW"].includes(p.status),APPROVED:p=>p.status==="APPROVED",SUSPENDED:p=>p.status==="SUSPENDED",REJECTED:p=>p.status==="REJECTED",all:()=>true},P=(d.partners||[]).filter(F[V5PA.f]||F.all);
    $("paBody").innerHTML=`<div class="panel"><div class="k-tabs">${[["open",L5("الجديدة","New")],["APPROVED",L5("المقبولين","Approved")],["SUSPENDED",L5("المعلّقين","Suspended")],["REJECTED",L5("المرفوضين","Rejected")],["all",L5("الكل","All")]].map(([k,l])=>`<button type="button" data-f="${k}" class="${k===V5PA.f?"on":""}">${l}</button>`).join("")}</div>
      <div class="v3-tw"><table class="n-tbl" style="margin-top:8px"><tr><th>${L5("المتقدم","Applicant")}</th><th>${L5("النوع","Type")}</th><th>${L5("العقد","Agreement")}</th><th>${L5("المستوى","Level")}</th><th>${L5("الأرقام","Figures")}</th><th>${L5("الحالة","Status")}</th><th></th></tr>
      ${P.map(p=>`<tr><td><b>${esc(p.full_name)}</b><br><small class="label ltr">${esc(p.email||"")}${p.code?" · "+esc(p.code):""}</small></td><td>${esc(V5P.PT[p.ptype]?V5P.PT[p.ptype][1]():p.ptype)}</td><td>${p.signed_at?`<span class="n-s done">${L5("موقّع","Signed")} ${esc(p.contract_version||"")}</span>`:`<span class="n-s can">${L5("غير موقّع","Unsigned")}</span>`}</td><td>${p.level?esc(p.level_icon||"")+" "+esc(p.level)+" · "+p.rate+"%":"—"}</td>
        <td class="v"><small>${L5("مبيعات","sales")} ${p.confirmed||0} · ${L5("معلق","pend")} $${p.pending||0} · ${L5("معتمد","appr")} $${p.approved||0} · ${L5("مدفوع","paid")} $${p.paid||0}</small></td><td><span class="n-s ${p.status==="APPROVED"?"done":p.status==="REJECTED"||p.status==="SUSPENDED"?"can":"up"}">${esc(p.status)}</span></td><td><button class="btn v2s" type="button" data-pd="${escA(p.user_id)}">${L5("فتح","Open")}</button></td></tr>`).join("")||`<tr><td colspan="7" class="label">—</td></tr>`}</table></div><div id="paDet"></div></div>`;
    $("paBody").querySelectorAll("[data-f]").forEach(x=>x.onclick=()=>{V5PA.f=x.dataset.f;V5PA.requests()});
    $("paBody").querySelectorAll("[data-pd]").forEach(x=>x.onclick=()=>V5PA.partner((d.partners||[]).find(p=>p.user_id===x.dataset.pd)))},
  partner(p){const L=V5PA.d.levels||[];$("paDet").innerHTML=`<div class="panel" style="margin-top:12px;border-color:rgba(212,175,55,.6)"><div class="n-hd"><h3 style="margin:0">${esc(p.full_name)} <span class="n-s up">${esc(p.status)}</span></h3><button class="btn v2s" type="button" onclick="this.closest('.panel').remove()">✕</button></div>
      <div class="k-g2" style="margin-top:8px"><div class="label" style="font-size:13px;line-height:2">${L5("النوع","Type")}: ${esc(p.ptype)} · ${L5("الدولة","Country")}: ${esc(p.country||"—")} · ${L5("الهاتف","Phone")}: <span class="ltr">${esc(p.phone||"—")}</span><br>${L5("القنوات","Channels")}: ${esc(p.channels||"—")}<br>${L5("الخبرة","Experience")}: ${esc(p.experience||"—")}<br>
        ${L5("التوقيع","Signature")}: <b>${esc(p.sign_name||"—")}</b> · ${p.signed_at?new Date(p.signed_at).toLocaleString("en-GB"):"—"} · ${L5("الإصدار","ver")} ${esc(p.contract_version||"—")}${(()=>{const t=(V5PA.v6.tree||{})[p.user_id]||{};return t.sponsor||t.leg?`<br>👥 ${L5("الراعي","Sponsor")}: ${esc(t.sponsor||"—")} · ${L5("بالشجرة","In tree")}: ${t.leg==="L"?L5("يسار","Left"):t.leg==="R"?L5("يمين","Right"):"—"}${t.parent?" "+L5("تحت","under")+" "+esc(t.parent):""}`:""})()}<br><small class="ltr">sha256: ${esc(String(p.contract_hash||"").slice(0,24))}…</small>${p.admin_note?`<br>${L5("ملاحظة سابقة","Prev. note")}: ${esc(p.admin_note)}`:""}</div>
      <div><div class="k-form" style="grid-template-columns:minmax(0,1fr)"><label>${L5("ملاحظة للقرار (تظهر للمتقدم عند الرفض/التعليق)","Decision note")}<input class="f" id="pdN"></label>${p.status==="APPROVED"?`<label>${L5("نسبة خاصة لهذا الشريك % (فارغ = حسب رتبته)","Custom rate % (empty = by rank)")}<input class="f ltr" id="pdR" type="number" min="0" max="90" step="0.5" value="${((V5PA.v6.tree||{})[p.user_id]||{}).rate_override==null?"":(V5PA.v6.tree||{})[p.user_id].rate_override}"></label><button class="btn v2s" type="button" id="pdRS">💾 ${L5("حفظ النسبة الخاصة","Save custom rate")}</button>`:""}${p.status==="APPROVED"?`<label>${L5("المستوى (يدوي)","Level (manual)")}<select class="f" id="pdL">${L.map(l=>`<option value="${l.id}" ${l.name===p.level?"selected":""}>${esc(l.icon)} ${esc(l.name)} · ${l.rate}%</option>`).join("")}</select></label>`:""}</div>
        <div class="n-btns" style="margin-top:10px">${["PENDING"].includes(p.status)?`<button class="btn" type="button" data-dc="UNDER_REVIEW">🔎 ${L5("قيد المراجعة","Under review")}</button>`:""}${["PENDING","UNDER_REVIEW","SUSPENDED"].includes(p.status)?`<button class="btn primary" type="button" data-dc="APPROVED">✅ ${p.status==="SUSPENDED"?L5("إعادة تفعيل","Reactivate"):L5("قبول وتفعيل","Approve")}</button>`:""}${["PENDING","UNDER_REVIEW"].includes(p.status)?`<button class="btn" type="button" data-dc="REJECTED">⛔ ${L5("رفض","Reject")}</button>`:""}${p.status==="APPROVED"?`<button class="btn" type="button" data-dc="SUSPENDED">⏸ ${L5("تعليق","Suspend")}</button><button class="btn" type="button" id="pdLv">🏅 ${L5("حفظ المستوى","Save level")}</button>`:""}</div>
        ${p.status==="APPROVED"?`<div class="k-form" style="margin-top:12px"><label>${L5("قيد تسوية ($، سالب للخصم)","Adjustment ($, negative to deduct)")}<input class="f ltr" id="pdAm" type="number" step="0.01"></label><label class="w2">${L5("السبب (إلزامي)","Reason (required)")}<input class="f" id="pdAn"></label></div><button class="btn v2s" type="button" id="pdAdj" style="margin-top:8px">🧾 ${L5("إضافة قيد تسوية موثّق","Add documented adjustment")}</button>`:""}</div></div></div>`;
    $("paDet").scrollIntoView({behavior:"smooth",block:"center"});
    $("paDet").querySelectorAll("[data-dc]").forEach(x=>x.onclick=()=>{const st=x.dataset.dc,nt=$("pdN").value.trim();if((st==="REJECTED"||st==="SUSPENDED")&&!nt){V5.toast(L5("اكتب سبب القرار","Enter a reason"),1);return}if(!confirm(L5(`تأكيد: ${st}؟`,`Confirm ${st}?`)))return;V5PA.act(()=>V5.api().adm.decide(p.user_id,st,nt))()});
    if($("pdRS"))$("pdRS").onclick=()=>{const v=$("pdR").value.trim();if(v!==""&&(+v<0||+v>90)){V5.toast(L5("النسبة بين 0 و 90","0–90"),1);return}V5PA.act(()=>V5.api().adm.rate(p.user_id,v===""?null:+v))()};
    if($("pdLv"))$("pdLv").onclick=V5PA.act(()=>V5.api().adm.level(p.user_id,+$("pdL").value));
    if($("pdAdj"))$("pdAdj").onclick=()=>{const a=+$("pdAm").value,n=$("pdAn").value.trim();if(!a||!n){V5.toast(L5("المبلغ والسبب مطلوبين","Amount and reason required"),1);return}if(!confirm(L5(`قيد تسوية ${a}$ لـ ${p.full_name}؟`,`Adjust ${a}$?`)))return;V5PA.act(()=>V5.api().adm.adjust(p.user_id,a,n))()}},
  comms(){const C=V5PA.d.comms||[],f=V5PA.cf||"VERIFIED",L=f==="all"?C:C.filter(c=>c.status===f);
    $("paBody").innerHTML=`<div class="panel"><div class="n-hd"><div class="k-tabs">${["PENDING","VERIFIED","APPROVED","PAID","REVERSED","all"].map(k=>`<button type="button" data-cf="${k}" class="${k===f?"on":""}">${k==="all"?L5("الكل","All"):k} (${k==="all"?C.length:C.filter(c=>c.status===k).length})</button>`).join("")}</div><button class="btn v2s" type="button" id="pcCsv">⬇️ CSV</button></div>
      <div class="v3-tw"><table class="n-tbl" style="margin-top:8px"><tr><th>#</th><th>${L5("الشريك","Partner")}</th><th>${L5("البيع","Sale")}</th><th>${L5("العمولة","Commission")}</th><th>${L5("الحالة","Status")}</th><th>${L5("التاريخ","Date")}</th><th></th></tr>
      ${L.slice(0,150).map(c=>`<tr><td class="v">${c.id}</td><td>${esc(c.partner||"")} <small class="label">${esc(c.code||"")}</small></td><td>${c.kind==="commission"?`${esc(c.product||"")} · $${c.sale_amount} <small class="label">#${c.purchase_id||""} · ${esc(c.buyer||"")}</small>`:`${c.kind==="reversal"?"↩️":"🧾"} ${esc(c.note||"")}`}</td><td class="v">$${c.amount}${c.rate!=null?` <small class="label">${c.rate}%</small>`:""}</td><td><span class="n-s ${c.status==="PAID"||c.status==="APPROVED"?"done":c.status==="REVERSED"?"can":"up"}">${c.status}</span>${c.payout_id?` <small class="label">💸#${c.payout_id}</small>`:""}</td><td class="v">${new Date(c.created_at).toLocaleDateString("en-GB")}</td>
        <td>${c.kind==="commission"?`${c.status==="PENDING"?`<button class="btn v2s" type="button" data-ca="verify" data-id="${c.id}">${L5("تحقق","Verify")}</button>`:""}${c.status==="VERIFIED"?`<button class="btn v2s" type="button" data-ca="approve" data-id="${c.id}">${L5("اعتماد","Approve")}</button>`:""}${["PENDING","VERIFIED","APPROVED"].includes(c.status)&&!c.payout_id?`<button class="btn v2s" type="button" data-ca="reverse" data-id="${c.id}">${L5("عكس","Reverse")}</button>`:""}`:""}</td></tr>`).join("")||`<tr><td colspan="7" class="label">—</td></tr>`}</table></div>
      <p class="v3-note">${L5("السجل المالي ما ينعدل ولا ينمسح. المبالغ ثابتة، والحالة تتغير بس من هنا، وكل تغيير ينسجل. التصحيح يكون بقيد تسوية من صفحة الشريك. الاعتماد قبل نهاية فترة الاسترجاع يحتاج ملاحظة تبدي بـ !","The ledger is immutable. Corrections use documented adjustments. Approving before the refund window ends needs a note starting with !")}</p></div>`;
    $("paBody").querySelectorAll("[data-cf]").forEach(x=>x.onclick=()=>{V5PA.cf=x.dataset.cf;V5PA.comms()});
    $("paBody").querySelectorAll("[data-ca]").forEach(x=>x.onclick=()=>{const a=x.dataset.ca;let nt="";if(a==="reverse"){nt=prompt(L5("سبب العكس (إلزامي):","Reason (required):"))||"";if(!nt)return}if(a==="approve")nt=prompt(L5("ملاحظة (اختياري). للاعتماد المبكر ابدأ بـ !","Note (optional). Start with ! for early approval"),"")||"";V5PA.act(()=>V5.api().adm.comm(+x.dataset.id,a,nt))()});
    $("pcCsv").onclick=()=>V5P.csv("vexora-commissions.csv",[["id","partner","code","kind","product","sale_amount","purchase_id","commission","rate","status","payout_id","created_at","note"],...L.map(c=>[c.id,c.partner,c.code,c.kind,c.product,c.sale_amount,c.purchase_id,c.amount,c.rate,c.status,c.payout_id,c.created_at,c.note])])},
  payouts(){const X=V5PA.d.payouts||[];
    $("paBody").innerHTML=`<div class="panel"><h3 style="margin:0 0 8px">💸 ${L5("طلبات السحب","Payout requests")}</h3><div class="v3-tw"><table class="n-tbl"><tr><th>#</th><th>${L5("الشريك","Partner")}</th><th>${L5("المبلغ","Amount")}</th><th>${L5("الطريقة والتفاصيل","Method & details")}</th><th>${L5("الحالة","Status")}</th><th></th></tr>
      ${X.map(x=>`<tr><td class="v">${x.id}</td><td>${esc(x.partner||"")}</td><td class="v">$${x.amount}</td><td>${esc(x.method)} <small class="label ltr">${esc(x.details)}</small></td><td><span class="n-s ${x.status==="paid"?"done":x.status==="rejected"?"can":"up"}">${esc(x.status)}</span>${x.paid_ref?`<br><small class="label ltr">${esc(x.paid_ref)}</small>`:""}${x.admin_note?`<br><small class="label">${esc(x.admin_note)}</small>`:""}</td>
        <td>${x.status==="requested"?`<button class="btn v2s" type="button" data-po="approve" data-id="${x.id}">${L5("اعتماد","Approve")}</button>`:""}${["requested","approved"].includes(x.status)?`<button class="btn v2s" type="button" data-po="paid" data-id="${x.id}">${L5("تم الدفع","Mark paid")}</button><button class="btn v2s" type="button" data-po="reject" data-id="${x.id}">${L5("رفض","Reject")}</button>`:""}</td></tr>`).join("")||`<tr><td colspan="6" class="label">—</td></tr>`}</table></div>
      <p class="v3-note">${L5("«تم الدفع» يحتاج رقم/مرجع التحويل، ويحوّل العمولات المرتبطة إلى PAID. الرفض يرجع العمولات لرصيد الشريك.","«Mark paid» requires a transfer reference and marks linked commissions PAID. Rejecting returns them to the partner's balance.")}</p></div>`;
    $("paBody").querySelectorAll("[data-po]").forEach(x=>x.onclick=()=>{const a=x.dataset.po;let nt="",ref="";if(a==="paid"){ref=prompt(L5("رقم/مرجع التحويل:","Transfer reference:"))||"";if(!ref)return}if(a==="reject"){nt=prompt(L5("سبب الرفض:","Reason:"))||"";if(!nt)return}V5PA.act(()=>V5.api().adm.payout(+x.dataset.id,a,nt,ref))()})},
  levels(){const d=V5PA.d,L=d.levels||[],PR=d.products||[];
    $("paBody").innerHTML=`<div class="k-g2"><div class="panel"><h3 style="margin:0 0 8px">🏅 ${L5("المستويات","Levels")}</h3><div class="v3-tw"><table class="n-tbl" id="lvT"><tr><th>${L5("الأيقونة","Icon")}</th><th>${L5("الاسم","Name")}</th><th>${L5("مبيعات مؤكدة","Min sales")}</th><th>${L5("النسبة %","Rate %")}</th><th>${L5("فريق 1 %","Team L1 %")}</th><th>${L5("فريق 2 %","Team L2 %")}</th><th>${L5("المميزات","Perks")}</th><th>${L5("شرط الترقية","Upgrade rule")}</th><th>${L5("التفعيل","Active from")}</th><th>${L5("فعّال","On")}</th></tr>
      ${L.map(l=>`<tr data-id="${l.id}"><td><input class="f" data-k="icon" value="${escA(l.icon)}" style="width:52px"></td><td><input class="f" data-k="name" value="${escA(l.name)}"></td><td><input class="f ltr" data-k="min_sales" type="number" min="0" value="${l.min_sales}" style="width:80px"></td><td><input class="f ltr" data-k="rate" type="number" min="0" max="90" step="0.5" value="${l.rate}" style="width:80px"></td><td><input class="f ltr" data-k="team1_pct" type="number" min="0" max="50" step="0.5" value="${l.team1_pct||0}" style="width:72px"></td><td><input class="f ltr" data-k="team2_pct" type="number" min="0" max="50" step="0.5" value="${l.team2_pct||0}" style="width:72px"></td><td><input class="f" data-k="perks" value="${escA(l.perks||"")}"></td><td><input class="f" data-k="upgrade_rule" value="${escA(l.upgrade_rule||"")}"></td><td><input class="f ltr" data-k="active_from" type="date" value="${escA(l.active_from||"")}"></td><td><input type="checkbox" data-k="active" ${l.active?"checked":""}></td></tr>`).join("")}</table></div>
      <div class="n-btns" style="margin-top:10px"><button class="btn primary" type="button" id="lvSave">💾 ${L5("حفظ المستويات","Save levels")}</button><button class="btn" type="button" id="lvAdd">➕ ${L5("مستوى","Level")}</button></div><p class="v3-note">${L5("عمولة الفريق: «فريق 1» من مبيعات الشركاء اللي سجلوا من رابطه مباشرة، و«فريق 2» من مبيعات مستواهم الثاني. تنحسب بس على مبيعات مؤكدة، وما أكو أرباح على التسجيل.","Team L1 = direct recruits' confirmed sales; Team L2 = their recruits. Only on confirmed sales; nothing for sign-ups.")}</p><p class="v3-note">${L5("تغيير النسبة يطبق على المبيعات الجديدة بس، والعمولات القديمة تبقى بنسبتها. الترقية تلقائية حسب المبيعات المؤكدة، وما أكو تنزيل تلقائي.","Rate changes apply to new sales only. Upgrades are automatic; no automatic downgrades.")}</p></div>
      <div class="panel"><h3 style="margin:0 0 8px">🛒 ${L5("المنتجات المؤهلة للعمولة","Commissionable products")}</h3>${PR.map(p=>`<div class="k-form" style="margin-bottom:8px" data-pr="${escA(p.code)}"><label>${esc(p.code)}<input class="f" data-k="name" value="${escA(p.name)}"></label><label>${L5("نسبة خاصة % (فارغ = حسب المستوى)","Override % (empty = level)")}<input class="f ltr" data-k="rate_override" value="${p.rate_override==null?"":p.rate_override}"></label><label>${L5("فترة الاسترجاع (يوم)","Hold days")}<input class="f ltr" data-k="hold_days" type="number" value="${p.hold_days}"></label><label class="tgl w3"><input type="checkbox" data-k="commissionable" ${p.commissionable?"checked":""}> ${L5("مؤهل للعمولة","Commissionable")} <button class="btn v2s" type="button" data-prs="${escA(p.code)}">💾</button></label></div>`).join("")}
      <p class="v3-note">${L5("العمولة تنحسب بس على هالمنتجات لما تنباع داخل المنصة. تسجيل حساب بالوسيط أو الإيداع ما يعتبر بيع.","Commission only on these products sold in-platform. Broker signups/deposits are not sales.")}</p>
      <div class="k-form" style="margin-top:10px"><label>${L5("الحد الأدنى للسحب $","Min payout $")}<input class="f ltr" id="pcMin" value="${escA(d.cfg.partner_min_payout||"")}"></label><label>${L5("عمولة الفريق","Team commission")}<select class="f" id="pcTeam"><option value="1" ${(V5PA.v6.cfg||{}).partner_team_on!=="0"?"selected":""}>${L5("مفعّلة","On")}</option><option value="0" ${(V5PA.v6.cfg||{}).partner_team_on==="0"?"selected":""}>${L5("متوقفة","Off")}</option></select></label><label>${L5("ترتيب الجدد بالشجرة","New member placement")}<select class="f" id="pcPlace"><option value="auto" ${(V5PA.v6.cfg||{}).partner_place_mode!=="choice"?"selected":""}>${L5("تلقائي (الطرف الأضعف)","Auto (weaker leg)")}</option><option value="choice" ${(V5PA.v6.cfg||{}).partner_place_mode==="choice"?"selected":""}>${L5("الشريك يختار يمين/يسار","Partner chooses")}</option></select></label><label>${L5("استقبال طلبات جديدة","Accept applications")}<select class="f" id="pcEn"><option value="1" ${d.cfg.partner_enabled==="1"?"selected":""}>${L5("مفتوح","Open")}</option><option value="0" ${d.cfg.partner_enabled!=="1"?"selected":""}>${L5("مسكّر","Closed")}</option></select></label></div></div></div>`;
    $("lvAdd").onclick=()=>{const t=$("lvT"),r=t.insertRow();r.dataset.id="";r.innerHTML=`<td><input class="f" data-k="icon" value="🏅" style="width:52px"></td><td><input class="f" data-k="name" placeholder="Platinum"></td><td><input class="f ltr" data-k="min_sales" type="number" value="100" style="width:80px"></td><td><input class="f ltr" data-k="rate" type="number" value="30" style="width:80px"></td><td><input class="f ltr" data-k="team1_pct" type="number" value="0" style="width:72px"></td><td><input class="f ltr" data-k="team2_pct" type="number" value="0" style="width:72px"></td><td><input class="f" data-k="perks"></td><td><input class="f" data-k="upgrade_rule"></td><td><input class="f ltr" data-k="active_from" type="date"></td><td><input type="checkbox" data-k="active" checked></td>`};
    $("lvSave").onclick=()=>{const rows=[...$("lvT").querySelectorAll("tr[data-id]")].map(tr=>{const o={id:tr.dataset.id};tr.querySelectorAll("[data-k]").forEach(i=>o[i.dataset.k]=i.type==="checkbox"?i.checked:i.value.trim());if(!o.id)o.code=(o.name||"lv").toLowerCase().replace(/[^a-z0-9]/g,"")||"lv"+Date.now();return o});
      if(rows.some(r=>!r.name||r.rate===""||+r.rate<0||+r.rate>90)){V5.toast(L5("تأكد من الاسم والنسبة (0–90)","Check names and rates (0–90)"),1);return}if(!confirm(L5("حفظ المستويات والنسب؟ يطبق على المبيعات الجديدة.","Save levels? Applies to new sales.")))return;V5PA.act(()=>V5.api().adm.levels(rows))()};
    $("paBody").querySelectorAll("[data-prs]").forEach(x=>x.onclick=()=>{const box=$("paBody").querySelector(`[data-pr="${x.dataset.prs}"]`),o={code:x.dataset.prs};box.querySelectorAll("[data-k]").forEach(i=>o[i.dataset.k]=i.type==="checkbox"?i.checked:i.value.trim());V5PA.act(()=>V5.api().adm.product(o))()});
    $("pcTeam").onchange=V5PA.act(()=>V5.api().adm.cfg("partner_team_on",$("pcTeam").value));$("pcPlace").onchange=V5PA.act(()=>V5.api().adm.cfg("partner_place_mode",$("pcPlace").value));
    $("pcMin").onchange=V5PA.act(()=>V5.api().adm.cfg("partner_min_payout",$("pcMin").value.trim()));$("pcEn").onchange=V5PA.act(()=>V5.api().adm.cfg("partner_enabled",$("pcEn").value))},
  contracts(){const K=V5PA.d.contracts||[];
    $("paBody").innerHTML=`<div class="k-g2"><div class="panel"><h3 style="margin:0 0 8px">📄 ${L5("إصدارات العقود","Agreement versions")}</h3>${K.map(k=>`<details class="n-pv" style="display:block"><summary>${k.active?"🟢":"⚪"} <b>${esc(k.ptype)}</b> · ${esc(k.version)} · ${esc(k.title)} <small class="label">${k.created_at?new Date(k.created_at).toLocaleDateString("en-GB"):""}</small></summary><div class="p-doc" style="max-height:260px;overflow:auto;margin-top:8px">${esc(k.body).replace(/\n/g,"<br>")}</div><button class="btn v2s" type="button" data-cp="${k.id}" style="margin-top:6px">${L5("نسخ كأساس لإصدار جديد","Use as base for new version")}</button></details>`).join("")}
      <p class="v3-note">${L5("الإصدارات ما تنعدل ولا تنمسح. أي تعديل = إصدار جديد، والموقّعين القدامى يبقى عندهم إصدارهم. القالب يحتاج مراجعة محامي قبل اعتماده نهائياً.","Versions are immutable; edits create a new version. Needs legal review before final use.")}</p></div>
      <div class="panel"><h3 style="margin:0 0 8px">➕ ${L5("إصدار جديد","New version")}</h3><div class="k-form"><label>${L5("النوع","Type")}<select class="f" id="kT"><option value="sales">sales</option><option value="distributor">distributor</option><option value="ib">ib</option></select></label><label>${L5("رقم الإصدار","Version")}<input class="f ltr" id="kV" placeholder="v1.1"></label><label class="w3">${L5("العنوان","Title")}<input class="f" id="kTi"></label><label class="w3">${L5("النص","Body")}<textarea class="f" id="kB" style="min-height:260px"></textarea></label></div><button class="btn primary" type="button" id="kSave" style="margin-top:10px">💾 ${L5("نشر الإصدار","Publish version")}</button></div></div>`;
    $("paBody").querySelectorAll("[data-cp]").forEach(x=>x.onclick=()=>{const k=K.find(c=>c.id==x.dataset.cp);$("kT").value=k.ptype;$("kTi").value=k.title;$("kB").value=k.body;$("kV").focus()});
    $("kSave").onclick=()=>{const v=$("kV").value.trim(),b=$("kB").value;if(!v||b.length<50){V5.toast(L5("رقم الإصدار والنص مطلوبين","Version and body required"),1);return}if(!confirm(L5("نشر إصدار جديد؟ الطلبات الجديدة لازم توقع عليه.","Publish new version?")))return;V5PA.act(()=>V5.api().adm.contract($("kT").value,v,$("kTi").value.trim(),b))()}},
  async ib(){const A=V5PA.d.ib||[],I=V5PA.d.ib_imports||[];let PL={};try{PL=await V5.api().adm.ibPlans()||{}}catch(e){}V5PA.pl=PL;
    $("paBody").innerHTML=`<div class="panel"><h3 style="margin:0 0 8px">🏦 ${L5("طلبات IB","IB requests")}</h3><div class="v3-tw"><table class="n-tbl"><tr><th>${L5("المتقدم","Applicant")}</th><th>${L5("الدولة","Country")}</th><th>${L5("المستندات","Docs")}</th><th>${L5("الحالة","Status")}</th><th>${L5("رقم IB","IB #")}</th><th></th></tr>
      ${A.map(a=>`<tr><td><b>${esc(a.full_name)}</b><br><small class="label ltr">${esc(a.email)} · ${esc(a.phone||"")}</small></td><td>${esc(a.country)}</td><td>${(a.docs||[]).map(p=>`<button class="btn v2s" type="button" data-doc="${escA(p)}">📎</button>`).join("")}${a.broker_proof?`<button class="btn v2s" type="button" data-doc="${escA(a.broker_proof)}">🧾 ${L5("إثبات","proof")}</button>`:""}</td><td><span class="n-s ${a.status==="BROKER_APPROVED"?"done":a.status==="BROKER_REJECTED"?"can":"up"}">${esc(a.status)}</span></td><td class="v">${esc(a.ib_number||"—")}</td><td><button class="btn v2s" type="button" data-ibe="${a.id}">${L5("تحديث","Update")}</button> <button class="btn v2s" type="button" data-ibp="${escA(a.user_id)}">💼 ${L5("الخطة","Plan")}${PL[a.user_id]?" ✓":""}</button></td></tr>`).join("")||`<tr><td colspan="6" class="label">—</td></tr>`}</table></div><div id="ibEd"></div>
      <p class="v3-note">${L5("فيكسورا ما تعتمد IB. «وافق الوسيط» يحتاج رقم IB الرسمي وإثبات موافقة الوسيط (ملف).","VEXORA does not approve IBs. «Broker approved» needs the official IB number and a proof file.")}</p></div>
      <div class="panel"><h3 style="margin:0 0 8px">📥 ${L5("استيراد كشف عمولات الوسيط (CSV)","Import broker commission statement (CSV)")}</h3><div class="k-form"><label>${L5("الفترة","Period")}<input class="f ltr" id="imP" type="month" value="${new Date().toISOString().slice(0,7)}"></label><label class="w2">${L5("ملف CSV: ib_number,clients,confirmed,pending,paid","CSV: ib_number,clients,confirmed,pending,paid")}<input class="f" id="imF" type="file" accept=".csv,text/csv"></label></div><div id="imPrev"></div>
      <h4 style="margin:12px 0 6px">${L5("سجل الاستيراد","Import history")}</h4>${I.map(i=>`<div class="n-pv"><span>${esc(i.period)} · ${esc(i.file_name)} · ${i.rows} ${L5("سطر","rows")} · ✅ ${i.matched}${(i.unmatched||[]).length?` · ⚠️ ${L5("غير مطابق","unmatched")}: ${esc(i.unmatched.join(", "))}`:""}</span><span class="label">${new Date(i.at).toLocaleString("en-GB")}</span></div>`).join("")||`<p class="label">—</p>`}</div>`;
    $("paBody").querySelectorAll("[data-ibp]").forEach(x=>x.onclick=()=>V5PA.ibPlan(A.find(y=>y.user_id===x.dataset.ibp)));
    $("paBody").querySelectorAll("[data-doc]").forEach(x=>x.onclick=async()=>{try{window.open(await V5.api().docUrl(x.dataset.doc),"_blank","noopener")}catch(e){V5.toast(V5.err(e),1)}});
    $("paBody").querySelectorAll("[data-ibe]").forEach(x=>x.onclick=()=>{const a=A.find(y=>y.id==x.dataset.ibe);$("ibEd").innerHTML=`<div class="panel" style="margin-top:10px"><div class="k-form"><label>${L5("الحالة","Status")}<select class="f" id="ieS">${["VEXORA_REVIEW","BROKER_PENDING","BROKER_APPROVED","BROKER_REJECTED","DRAFT"].map(s=>`<option ${s===a.status?"selected":""}>${s}</option>`).join("")}</select></label><label>${L5("رقم IB الرسمي","Official IB #")}<input class="f ltr" id="ieN" value="${escA(a.ib_number||"")}"></label><label>${L5("إثبات موافقة الوسيط (ملف)","Broker approval proof (file)")}<input class="f" id="ieF" type="file" accept="application/pdf,image/*"></label><label class="w3">${L5("ملاحظات الإدارة (تظهر للمتقدم)","Admin notes (visible to applicant)")}<input class="f" id="ieT" value="${escA(a.admin_notes||"")}"></label></div><button class="btn primary" type="button" id="ieGo" style="margin-top:8px">💾 ${L5("حفظ","Save")}</button></div>`;
      $("ieGo").onclick=async()=>{let proof="";const f=$("ieF").files[0];try{if(f){if(f.size>5242880)throw new Error(L5("الملف أكبر من 5MB","File over 5MB"));proof=await V5.api().uploadDoc(f,a.user_id)}await V5.api().adm.ib(a.id,$("ieS").value,$("ieT").value.trim(),$("ieN").value.trim(),proof);V5.toast("✅");V5PA.open()}catch(e){V5.toast(V5.err(e),1)}}});
    $("imF").onchange=async()=>{const f=$("imF").files[0];if(!f)return;const txt=await f.text(),lines=txt.replace(/^﻿/,"").split(/\r?\n/).filter(l=>l.trim());const hd=lines.shift().split(",").map(h=>h.trim().toLowerCase());
      const need=["ib_number"];if(!need.every(n=>hd.includes(n))){V5.toast(L5("لازم عمود ib_number","ib_number column required"),1);return}
      const rows=lines.map(l=>{const c=l.split(",");const o={};hd.forEach((h,i)=>o[h]=(c[i]||"").trim());return o}).filter(r=>r.ib_number);
      $("imPrev").innerHTML=`<div class="v3-tw"><table class="n-tbl" style="margin-top:8px"><tr>${["ib_number","clients","confirmed","pending","paid","lots"].map(h=>`<th>${h}</th>`).join("")}</tr>${rows.slice(0,20).map(r=>`<tr>${["ib_number","clients","confirmed","pending","paid","lots"].map(h=>`<td class="v">${esc(r[h]||"")}</td>`).join("")}</tr>`).join("")}</table></div><p class="label">${rows.length} ${L5("سطر · معاينة قبل الحفظ","rows · preview")}</p><button class="btn primary" type="button" id="imGo">📥 ${L5("تأكيد الاستيراد","Confirm import")}</button>`;
      $("imGo").onclick=async()=>{try{const r=await V5.api().adm.ibImport($("imP").value,f.name,rows);V5.toast(L5(`✅ مطابق ${r.matched} من ${r.rows}`,`✅ matched ${r.matched}/${r.rows}`)+(r.unmatched.length?` · ⚠️ ${r.unmatched.join(", ")}`:""));V5PA.open()}catch(e){V5.toast(V5.err(e),1)}}}},
  ibPlan(a){const p=(V5PA.pl||{})[a.user_id]||{},v=k=>p[k]==null?"":p[k];
    $("ibEd").innerHTML=`<div class="panel" style="margin-top:10px;border-color:rgba(212,175,55,.6)"><div class="n-hd"><h4 style="margin:0">💼 ${L5("خطة الـ IB","IB plan")}: ${esc(a.full_name)}</h4><button class="btn v2s" type="button" onclick="this.closest('.panel').remove()">✕</button></div>
      <p class="label" style="font-size:12.5px;margin:6px 0 10px">${L5("اكتب الأرقام اللي اتفقت عليها ويه هذا الـ IB. الخانة الفارغة ما تظهر له. هو يشوف خطته بصفحة «طلب IB».","Enter the terms agreed with this IB. Empty fields are hidden.")}</p>
      <div class="k-form"><label>${L5("عمولة $ لكل لوت","Commission $/lot")}<input class="f ltr" id="pl1" type="number" min="0" step="0.01" value="${escA(v("per_lot"))}"></label><label>${L5("أو نسبة % من العمولة","Or % of commission")}<input class="f ltr" id="pl2" type="number" min="0" max="100" step="0.1" value="${escA(v("share_pct"))}"></label><label>${L5("العملة","Currency")}<input class="f ltr" id="pl8" value="${escA(p.currency||"$")}" maxlength="4"></label>
      <label>${L5("كاش باك للـ IB ($ لكل لوت)","IB cashback $/lot")}<input class="f ltr" id="pl3" type="number" min="0" step="0.01" value="${escA(v("cashback_ib"))}"></label><label>${L5("كاش باك لعملائه ($ لكل لوت)","Clients cashback $/lot")}<input class="f ltr" id="pl4" type="number" min="0" step="0.01" value="${escA(v("cashback_clients"))}"></label><label>${L5("راتب شهري $","Monthly salary $")}<input class="f ltr" id="pl5" type="number" min="0" step="1" value="${escA(v("salary"))}"></label>
      <label class="w3">${L5("شرط الراتب (اختياري)","Salary condition (optional)")}<input class="f" id="pl6" value="${escA(p.salary_terms||"")}" placeholder="${L5("مثلاً: 20 عميل فعال أو 100 لوت بالشهر","e.g. 20 active clients or 100 lots/month")}"></label>
      <label class="w3">${L5("ملاحظات وتفاصيل أخرى","Other notes")}<textarea class="f" id="pl7">${esc(p.notes||"")}</textarea></label></div>
      <button class="btn primary" type="button" id="plGo" style="margin-top:8px">💾 ${L5("حفظ الخطة","Save plan")}</button><p class="v3-note">${L5("تأكد إن أي مشاركة لعمولات IB مسموحة باتفاقيتك ويه INFINOX.","Make sure any IB commission sharing is allowed by your INFINOX agreement.")}</p></div>`;
    $("ibEd").scrollIntoView({behavior:"smooth",block:"center"});
    $("plGo").onclick=()=>{const g=id=>$(id).value.trim(),d={per_lot:g("pl1"),share_pct:g("pl2"),cashback_ib:g("pl3"),cashback_clients:g("pl4"),salary:g("pl5"),salary_terms:g("pl6"),notes:$("pl7").value,currency:g("pl8")||"$"};
      if(["per_lot","share_pct","cashback_ib","cashback_clients","salary"].some(k=>d[k]!==""&&+d[k]<0)){V5.toast(L5("الأرقام لازم تكون موجبة","Values must be positive"),1);return}if(d.share_pct!==""&&+d.share_pct>100){V5.toast(L5("النسبة أكثر من 100%","Over 100%"),1);return}
      V5PA.act(()=>V5.api().adm.ibPlan(a.user_id,d),L5("انحفظت الخطة","Plan saved"))()}},
  brokers(){const B=(V5PA.d.brokers||[]).slice().sort((a,b)=>a.sort-b.sort);
    $("paBody").innerHTML=`<div class="panel"><div class="n-hd"><h3 style="margin:0">🎧 ${L5("جهات دعم الوسيط","Broker support contacts")}</h3><button class="btn primary" type="button" id="bkNew">➕ ${L5("جهة دعم","Contact")}</button></div><div id="bkF"></div>
      ${B.map((x,i)=>`<div class="n-pv"><span>${i>0?`<button class="btn v2s" type="button" data-up="${i}">▲</button>`:""} <b>${esc(x.broker)}</b> · ${esc(x.agent_name||"")} · 🌐 ${esc((x.langs||[]).join(","))}${(x.countries||[]).length?" · 📍"+esc(x.countries.join(",")):""} · ${x.audience==="traders"?L5("للمتدربين","trainees"):x.audience==="partners"?L5("للشركاء","partners"):L5("للكل","everyone")}</span><span>${x.verified?`<span class="n-s done">✓ ${L5("متحقق","Verified")}</span>`:`<span class="n-s up">${L5("بانتظار التحقق","Unverified")}</span>`} ${x.visible?`<span class="n-s done">${L5("ظاهر","Visible")}</span>`:`<span class="n-s can">${L5("مخفي","Hidden")}</span>`} ${x.is_default?`<span class="n-s live">${L5("افتراضي","Default")}</span>`:""} <button class="btn v2s" type="button" data-bk="${x.id}">${L5("تعديل","Edit")}</button></span></div>`).join("")}
      <p class="v3-note">${L5("الجهة ما تظهر للأعضاء إلا إذا «متحقق منها» و«ظاهرة». تكدر تحدد جهة حسب اللغة أو الدولة، وجهة افتراضية.","Contacts show to members only when verified and visible. Route by language/country; one default.")}</p></div>`;
    const form=x=>{$("bkF").innerHTML=`<div class="panel" style="margin:10px 0"><div class="k-form"><label>${L5("اسم الوسيط","Broker")}<input class="f" id="bkB" value="${escA(x.broker||"INFINOX")}"></label><label>${L5("الشعار (رابط)","Logo URL")}<input class="f ltr" id="bkLo" value="${escA(x.logo_url||"")}"></label><label>${L5("مسؤول الدعم","Agent name")}<input class="f" id="bkA" value="${escA(x.agent_name||"")}"></label>
      <label>Telegram<input class="f ltr" id="bkT" value="${escA(x.telegram||"")}" placeholder="@username"></label><label>WhatsApp<input class="f ltr" id="bkW" value="${escA(x.whatsapp||"")}" placeholder="+964…"></label><label>Email<input class="f ltr" id="bkE" value="${escA(x.email||"")}"></label>
      <label>${L5("الموقع الرسمي","Website")}<input class="f ltr" id="bkU" value="${escA(x.website||"")}" placeholder="https://"></label><label>${L5("ساعات الدعم","Hours")}<input class="f" id="bkH" value="${escA(x.hours||"")}"></label><label>${L5("اللغات (ar,en)","Languages (ar,en)")}<input class="f ltr" id="bkL" value="${escA((x.langs||["ar"]).join(","))}"></label>
      <label>${L5("الدول (IQ,JO… فارغ = الكل)","Countries (empty = all)")}<input class="f ltr" id="bkC" value="${escA((x.countries||[]).join(","))}"></label><label>${L5("لمنو تظهر؟","Shown to")}<select class="f" id="bkAu">${[["both",L5("الكل","Everyone")],["traders",L5("المتدربين بس","Trainees only")],["partners",L5("الشركاء/IB بس","Partners/IB only")]].map(([k,l])=>`<option value="${k}" ${k===(x.audience||"both")?"selected":""}>${l}</option>`).join("")}</select></label><label class="w2">${L5("ملاحظات وتعليمات","Notes")}<input class="f" id="bkN" value="${escA(x.notes||"")}"></label>
      <label class="tgl"><input type="checkbox" id="bkV" ${x.verified?"checked":""}> ✓ ${L5("تحققت إنها جهة رسمية","Verified official")}</label><label class="tgl"><input type="checkbox" id="bkS" ${x.visible?"checked":""}> 👁 ${L5("ظاهرة للأعضاء","Visible")}</label><label class="tgl"><input type="checkbox" id="bkD" ${x.is_default?"checked":""}> ⭐ ${L5("افتراضية","Default")}</label></div>
      <button class="btn primary" type="button" id="bkGo" style="margin-top:8px">💾 ${L5("حفظ","Save")}</button></div>`;
      $("bkGo").onclick=()=>{const g=id=>$(id).value.trim(),sp=v=>v.split(",").map(s=>s.trim()).filter(Boolean);const b={id:x.id||"",broker:g("bkB"),logo_url:g("bkLo"),agent_name:g("bkA"),telegram:g("bkT"),whatsapp:g("bkW"),email:g("bkE"),website:g("bkU"),hours:g("bkH"),langs:sp(g("bkL")),countries:sp(g("bkC")),notes:g("bkN"),audience:$("bkAu").value,verified:$("bkV").checked,visible:$("bkS").checked,is_default:$("bkD").checked,sort:x.sort||99};
        if(b.visible&&!b.verified)V5.toast(L5("ملاحظة: الجهة ما تظهر إلا بعد التحقق.","Note: hidden until verified."));for(const u of[b.website,b.logo_url])if(u&&!/^https:\/\//.test(u)){V5.toast(L5("الروابط لازم تبدي بـ https://","Links must start with https://"),1);return}V5PA.act(()=>V5.api().adm.broker(b))()}};
    $("bkNew").onclick=()=>form({});$("paBody").querySelectorAll("[data-bk]").forEach(x=>x.onclick=()=>form(B.find(b=>b.id==x.dataset.bk)));
    $("paBody").querySelectorAll("[data-up]").forEach(x=>x.onclick=()=>{const i=+x.dataset.up,ids=B.map(b=>b.id);[ids[i-1],ids[i]]=[ids[i],ids[i-1]];V5PA.act(()=>V5.api().adm.brokerOrder(ids))()})},
  assets(){const A=V5PA.d.assets||[],T=V5PA.d.tickets||[];
    $("paBody").innerHTML=`<div class="k-g2"><div class="panel"><h3 style="margin:0 0 8px">🎨 ${L5("المواد التسويقية","Marketing assets")}</h3>${A.map(a=>`<div class="n-pv"><span>${a.active?"🟢":"⚪"} ${esc(a.title)} <small class="label ltr">${esc(String(a.url).slice(0,40))}</small></span><label class="tgl"><input type="checkbox" data-as="${a.id}" ${a.active?"checked":""}> ${L5("ظاهر","Visible")}</label></div>`).join("")}
      <div class="k-form" style="margin-top:10px"><label>${L5("العنوان","Title")}<input class="f" id="asT"></label><label>${L5("النوع","Kind")}<select class="f" id="asK"><option value="image">image</option><option value="video">video</option><option value="doc">doc</option></select></label><label>${L5("الرابط https","URL https")}<input class="f ltr" id="asU"></label></div><button class="btn" type="button" id="asGo" style="margin-top:8px">➕ ${L5("إضافة","Add")}</button></div>
      <div class="panel"><h3 style="margin:0 0 8px">🎧 ${L5("طلبات الدعم (شركاء + الوسيط)","Support tickets (partners + broker)")}</h3>${T.map(t=>`<details class="n-pv" style="display:block"><summary>${t.status==="open"?"🟡":"✅"} <span class="chip">${t.channel==="broker_trader"?L5("🎧 وسيط · متدرب","Broker · trainee"):t.channel==="broker_ib"?L5("🏦 وسيط · IB","Broker · IB"):L5("🤝 شريك","Partner")}</span> <b>${esc(t.name||"")}</b> · ${esc(t.subject)} <small class="label">${new Date(t.created_at).toLocaleDateString("en-GB")}</small></summary><p style="line-height:1.8">${esc(t.body)}</p>${t.reply?`<p style="color:#7fe0b8">↩️ ${esc(t.reply)}</p>`:""}<textarea class="f" data-tr="${t.id}" placeholder="${L5("الرد","Reply")}"></textarea><button class="btn v2s" type="button" data-trg="${t.id}" style="margin-top:6px">↩️ ${L5("رد","Reply")}</button></details>`).join("")||`<p class="label">—</p>`}</div></div>`;
    $("paBody").querySelectorAll("[data-as]").forEach(x=>x.onchange=V5PA.act(()=>V5.api().adm.asset({id:x.dataset.as,active:x.checked})));
    $("asGo").onclick=()=>{const u=$("asU").value.trim();if(!$("asT").value.trim()||!/^https:\/\//.test(u)){V5.toast(L5("العنوان ورابط https مطلوبين","Title and https URL required"),1);return}V5PA.act(()=>V5.api().adm.asset({title:$("asT").value.trim(),kind:$("asK").value,url:u}))()};
    $("paBody").querySelectorAll("[data-trg]").forEach(x=>x.onclick=()=>{const r=$("paBody").querySelector(`[data-tr="${x.dataset.trg}"]`).value.trim();if(!r)return;V5PA.act(()=>V5.api().adm.ticket(+x.dataset.trg,r,false))()})},
  incent(){const I=(V5PA.v6.incentives||[]),C=(V5PA.v6.claims||[]),M={personal_sales:L5("مبيعات شخصية","Personal sales"),team_sales:L5("مبيعات الفريق","Team sales"),rank:L5("الوصول لرتبة","Reach rank"),balance:L5("توازن يمين/يسار","Left/right balance")},LV=V5PA.d.levels||[];
    $("paBody").innerHTML=`<div class="k-g2"><div class="panel"><div class="n-hd"><h3 style="margin:0">🎁 ${L5("الحوافز والهدايا","Rewards")}</h3><button class="btn primary" type="button" id="inNew">➕ ${L5("حافز","Reward")}</button></div><div id="inF"></div>
      ${I.map(i=>`<div class="n-pv"><span>${i.active===false?"⚪":"🟢"} ${esc(i.icon)} <b>${esc(i.title)}</b> · ${esc(M[i.metric]||i.metric)} ${i.metric==="rank"?esc(i.rank_code||""):i.target}${i.period==="month"?" · "+L5("شهري","monthly"):""} · 🎁 ${esc(i.reward||"")}${i.reward_amount?" ($"+i.reward_amount+")":""}</span><button class="btn v2s" type="button" data-ie="${i.id}">${L5("تعديل","Edit")}</button></div>`).join("")||`<p class="label">—</p>`}
      <p class="v3-note">${L5("الأهداف تنحسب من المبيعات المؤكدة بس. إذا حطيت «مبلغ نقدي»، ينضاف للشريك كقيد مكافأة موثّق لما تعتمد الطلب.","Targets use confirmed sales only. A cash amount is added as a documented bonus when you approve the claim.")}</p></div>
      <div class="panel"><h3 style="margin:0 0 8px">📮 ${L5("طلبات الاستلام","Claims")}</h3>${C.map(c=>`<div class="n-pv"><span>${esc(c.icon||"🎁")} <b>${esc(c.partner||"")}</b> · ${esc(c.title||"")} <small class="label">${esc(c.period||"")}</small></span><span><span class="n-s ${c.status==="requested"?"up":c.status==="rejected"?"can":"done"}">${esc(c.status)}</span> ${c.status==="requested"?`<button class="btn v2s" type="button" data-ic="approve" data-id="${c.id}">${L5("اعتماد","Approve")}</button><button class="btn v2s" type="button" data-ic="reject" data-id="${c.id}">${L5("رفض","Reject")}</button>`:c.status==="approved"?`<button class="btn v2s" type="button" data-ic="deliver" data-id="${c.id}">${L5("تم التسليم","Delivered")}</button>`:""}</span></div>`).join("")||`<p class="label">—</p>`}</div></div>`;
    const form=i=>{$("inF").innerHTML=`<div class="panel" style="margin:10px 0"><div class="k-form"><label>${L5("الأيقونة","Icon")}<input class="f" id="inIc" value="${escA(i.icon||"🎁")}"></label><label class="w2">${L5("العنوان","Title")}<input class="f" id="inT" value="${escA(i.title||"")}"></label>
      <label>${L5("نوع الهدف","Target type")}<select class="f" id="inM">${Object.entries(M).map(([k,l])=>`<option value="${k}" ${k===(i.metric||"personal_sales")?"selected":""}>${l}</option>`).join("")}</select></label><label>${L5("الهدف (عدد مبيعات)","Target (sales)")}<input class="f ltr" id="inTg" type="number" min="1" value="${escA(i.target||10)}"></label><label>${L5("الرتبة (لنوع الرتبة)","Rank (for rank type)")}<select class="f" id="inR"><option value=""></option>${LV.map(l=>`<option value="${escA(l.code)}" ${l.code===i.rank_code?"selected":""}>${esc(l.name)}</option>`).join("")}</select></label>
      <label class="w2">${L5("الجائزة (نص)","Reward (text)")}<input class="f" id="inRw" value="${escA(i.reward||"")}"></label><label>${L5("مبلغ نقدي $ (اختياري)","Cash $ (optional)")}<input class="f ltr" id="inA" type="number" min="0" value="${escA(i.reward_amount==null?"":i.reward_amount)}"></label>
      <label>${L5("الفترة","Period")}<select class="f" id="inP"><option value="all" ${i.period!=="month"?"selected":""}>${L5("مرة وحدة","Once")}</option><option value="month" ${i.period==="month"?"selected":""}>${L5("كل شهر","Monthly")}</option></select></label><label class="w2">${L5("الوصف","Description")}<input class="f" id="inD" value="${escA(i.descr||"")}"></label><label class="tgl"><input type="checkbox" id="inOn" ${i.active!==false?"checked":""}> ${L5("فعّال","Active")}</label></div>
      <button class="btn primary" type="button" id="inGo" style="margin-top:8px">💾 ${L5("حفظ","Save")}</button></div>`;
      $("inGo").onclick=()=>{const g=id=>$(id).value.trim();const r={id:i.id||"",icon:g("inIc"),title:g("inT"),metric:$("inM").value,target:g("inTg"),rank_code:$("inR").value,reward:g("inRw"),reward_amount:g("inA"),period:$("inP").value,descr:g("inD"),active:$("inOn").checked};
        if(!r.title){V5.toast(L5("اكتب العنوان","Title required"),1);return}if(r.metric==="rank"&&!r.rank_code){V5.toast(L5("اختار الرتبة","Pick a rank"),1);return}V5PA.act(()=>V5.api().adm.incSave(r))()}};
    $("inNew").onclick=()=>form({});$("paBody").querySelectorAll("[data-ie]").forEach(x=>x.onclick=()=>form(I.find(i=>i.id==x.dataset.ie)));
    $("paBody").querySelectorAll("[data-ic]").forEach(x=>x.onclick=()=>{const a=x.dataset.ic;let nt="";if(a==="reject"){nt=prompt(L5("السبب:","Reason:"))||"";if(!nt)return}V5PA.act(()=>V5.api().adm.incClaim(+x.dataset.id,a,nt))()})},
  async reports(){const m=V5PA.mon||new Date().toISOString().slice(0,7);let R=[];try{R=await V5.api().adm.report(m)||[]}catch(e){V5.toast(V5.err(e),1)}
    $("paBody").innerHTML=`<div class="panel"><div class="n-hd"><h3 style="margin:0">📊 ${L5("تقرير شهري","Monthly report")}</h3><div class="k-row"><input class="f ltr" type="month" id="rpM" value="${m}" style="width:auto"><button class="btn v2s" type="button" id="rpCsv">⬇️ CSV</button></div></div>
      <div class="v3-tw"><table class="n-tbl" style="margin-top:8px"><tr><th>${L5("الشريك","Partner")}</th><th>${L5("المستوى","Level")}</th><th>${L5("زيارات","Visits")}</th><th>${L5("مبيعات","Sales")}</th><th>${L5("الإيراد","Revenue")}</th><th>${L5("العمولات","Commission")}</th><th>${L5("ملغاة","Reversed")}</th><th>${L5("مدفوع","Paid out")}</th></tr>
      ${R.map(r=>`<tr><td>${esc(r.partner)} <small class="label">${esc(r.code||"")}</small></td><td>${esc(r.level||"")}</td><td class="v">${r.visits}</td><td class="v">${r.sales}</td><td class="v">$${r.revenue}</td><td class="v">$${r.commission}</td><td class="v">$${r.reversed}</td><td class="v">$${r.paid_out}</td></tr>`).join("")||`<tr><td colspan="8" class="label">—</td></tr>`}</table></div></div>`;
    $("rpM").onchange=()=>{V5PA.mon=$("rpM").value;V5PA.reports()};$("rpCsv").onclick=()=>V5P.csv(`vexora-partners-${m}.csv`,[["partner","code","level","visits","sales","revenue","commission","reversed","paid_out"],...R.map(r=>[r.partner,r.code,r.level,r.visits,r.sales,r.revenue,r.commission,r.reversed,r.paid_out])])},
  audit(){const A=V5PA.d.audit||[];$("paBody").innerHTML=`<div class="panel"><h3 style="margin:0 0 8px">📜 ${L5("سجل التدقيق","Audit log")}</h3><div class="n-log">${A.map(l=>`<div><span>${new Date(l.at||l.created_at).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span><b>${esc(l.actor_name||"")}</b> · ${esc(l.action)} · <small class="label ltr">${esc(l.target||"")} ${esc(JSON.stringify(l.details||{})).slice(0,140)}</small></span></div>`).join("")||`<p class="label">${V5.api().demo?L5("السجل يتعبى بالسيرفر.","Populated on the server."):"—"}</p>`}</div></div>`}
};

/* ================= V6: بوابة الشركاء المعزولة ================= */
const PP={
  nav(){const me=V5P.po&&V5P.po.me,ok=me&&me.status==="APPROVED",adm=isAdminUser();
    const L=[["dashboard","📊",L5("لوحتي","Dashboard"),"#partner/dashboard",1],["team","👥",L5("فريقي","My team"),"#partners/team",1],["ranks","🏅",L5("الرتب والحوافز","Ranks & rewards"),"#partners/ranks",1],["links","🔗",L5("روابطي والتسويق","Links & marketing"),"#partners/links",1],["money","💸",L5("العمولات والسحب","Commissions & payouts"),"#partners/money",1],
      ["ib","🏦",L5("طلب IB","IB request"),"#partners/ib",0],["support","🎧",L5("دعم وسيط الشركاء","Partner broker desk"),"#broker-support",0],["help","💬",L5("دعم الشركاء","Partner support"),"#partners/help",1],["agreement","📄",L5("العقد","Agreement"),"#partners/agreement",0]];
    const top=ok?[]:[["","🏠",L5("البرنامج","Program"),"#partners",0],["apply","📝",me?L5("حالة طلبي","My application"):L5("طلب الانضمام","Apply"),"#partners/apply",0]];
    const end=(ok?[["","ℹ️",L5("عن البرنامج","About the program"),"#partners",0]]:[]).concat(adm?[["admin","⚙️",L5("إعدادات الشركاء","Partner settings"),"#admin/partners",0]]:[]);
    return{items:top.concat(L,end),ok}},
  title(){const T={"":[L5("شركاء","VEXORA"),L5("فيكسورا","PARTNERS"),L5("روّج لخدمات فيكسورا واكسب عمولة على المبيعات المؤكدة","Promote VEXORA and earn on confirmed sales")],dashboard:[L5("لوحة","Partner"),L5("الشريك","dashboard"),L5("كل أرقامك ومبيعاتك وفريقك بمكان واحد","Your numbers, sales and team in one place")],team:[L5("فريقي","My"),"TEAM",L5("كل شريك يسجل من رابط فريقك ينضاف تحتك باليمين أو اليسار","Partners joining via your team link are placed left or right under you")],
      ranks:[L5("الرتب","Ranks"),L5("والحوافز","& rewards"),L5("ارتقِ بالرتب وافتح هدايا وحوافز حقيقية","Climb ranks and unlock real rewards")],links:[L5("روابطي","Links"),L5("والتسويق","& marketing"),L5("رابط البيع، رابط الفريق، والمواد الجاهزة","Sales link, team link and ready-made assets")],money:[L5("العمولات","Commissions"),L5("والسحب","& payouts"),L5("سجل مالي موثّق، والسحب باعتماد الإدارة","Audited ledger; payouts approved by admin")],
      ib:[L5("طلب","IB"),"IB",L5("Introducing Broker لدى INFINOX","Introducing Broker with INFINOX")],support:[L5("دعم وسيط","Partner"),L5("الشركاء","broker desk"),L5("مكتب خاص لشركاء IB: ربط العملاء، العمولات من الوسيط، والتقارير","For IB partners: client linking, broker commissions and reports")],help:[L5("دعم","Partner"),L5("الشركاء","support"),L5("اسألنا عن أي شي يخص شراكتك","Ask us anything about your partnership")],
      agreement:[L5("عقد","Partner"),L5("الشراكة","agreement"),L5("قالب قابل للتعديل · يحتاج مراجعة قانونية","Editable template · pending legal review")],apply:[L5("طلب","Partner"),L5("الانضمام","application"),L5("4 خطوات وتخلص","4 quick steps")],admin:[L5("إعدادات","Partner"),L5("الشركاء","settings"),L5("للمدير بس: النسب والرتب والفريق والحوافز والسحوبات","Owner only: rates, ranks, team, rewards, payouts")]};
    return T[PP.tab]||T[""]},
  async mount(tab){PP.tab=tab;const host=$("v5PartView");if(!host)return;
    try{V5P.po=await V5.api().portal();PP._pt=Date.now()}catch(e){V5P.po=V5P.po||{levels:[],contracts:[],me:null}}
    V5P.me=V5P.po&&V5P.po.me;const{items}=PP.nav();
    let marketingAccess=null;try{if(DB.marketing)marketingAccess=await DB.marketing.rpc("vx_marketing_access")}catch(e){}
    if(PP.tab!==tab||!host.isConnected)return;
    /* Marketing workspace is available from the single partner marketing navigation entry. */
    const [t1,t2,sub]=PP.title(),nm=(ME.profile&&ME.profile.full_name||"").trim(),ini=(nm[0]||"V").toUpperCase();
    host.innerHTML=`<div class="pp"><div class="pp-bg" aria-hidden="true"></div>
      <aside class="pp-side"><a class="pp-brand" href="#partners"><span class="lg">${ME.profile&&ME.profile.avatar_url?`<img src="${escA(ME.profile.avatar_url)}" alt="" class="vx-partner-avatar" onerror="this.style.display='none';this.parentElement.textContent='V'">`:"V"}</span><span><b>${L5("شركاء فيكسورا","VEXORA Partners")}</b><small>VEXORA PARTNERS</small></span></a><div class="pp-sec">${L5("بوابة الشركاء","Partner portal")}</div>
        ${items.map(([k,ic,l,h,lk])=>`<a class="pp-it${k===PP.tab?" on":""}${lk&&!PP.nav().ok?" lock":""}" href="${h}"><i>${ic}</i>${esc(l)}${lk&&!PP.nav().ok?"<em style='background:#94a9c9'>🔒</em>":""}</a>`).join("")}
        <a class="pp-back" href="#">↩ ${L5("رجوع لمنصة فيكسورا","Back to VEXORA")}</a></aside>
      <div class="pp-main"><div class="pp-top"><div><h1>${esc(t1)} <em>${esc(t2)}</em></h1><p>${esc(sub)}</p></div><div class="pp-hr">${V5.api().demo?`<span class="px-demo" style="border:1px dashed #3da5ff;border-radius:999px;padding:4px 10px;font-size:11px;color:#7cc8ff">🧪 ${L5("معاينة · بيانات تجريبية","Preview · demo data")}</span>`:""}<a class="pp-goback" href="#" id="ppBack">↩ ${L5("منصة فيكسورا","VEXORA platform")}</a><span class="pp-av" title="${escA(nm)}">${esc(ini)}</span></div></div>
        <div id="v5PartBody"${PP.tab==="admin"?" hidden":""}></div><div id="v5PartAdmBody" class="v3-wrap"${PP.tab==="admin"?"":" hidden"}></div></div>
      <nav class="pp-mnav">${items.map(([k,ic,l,h])=>`<a href="${h}" class="${k===PP.tab?"on":""}"><b>${ic}</b>${esc(l)}</a>`).join("")}<a href="#"><b>↩</b>${L5("المنصة","Platform")}</a></nav></div>`;
    const on=host.querySelector(".pp-mnav a.on");if(on)on.scrollIntoView({block:"nearest",inline:"center"});window.scrollTo(0,0)},
  locked(){$("v5PartBody").innerHTML=`<div class="q-c q-lock"><em>🔒</em><h3>${L5("هذا القسم للشركاء المعتمدين","Approved partners only")}</h3><p class="q-mut">${L5("ينفتح بعد ما تقدّم وتوافق الإدارة على طلبك.","Opens after you apply and the admin approves.")}</p><a class="q-btn" href="#partners/apply">📝 ${V5P.po&&V5P.po.me?L5("حالة طلبي","My application"):L5("قدّم الآن","Apply now")}</a></div>`},
  sp(vals,c){return V5P.spark(vals,c||"#3da5ff")},
  m:(v,c)=>V5P.money(v,c),
  KIND:{commission:()=>L5("بيع شخصي","Personal sale"),team1:()=>L5("فريق مستوى 1","Team L1"),team2:()=>L5("فريق مستوى 2","Team L2"),bonus:()=>L5("حافز","Reward"),adjustment:()=>L5("تسوية","Adjustment"),reversal:()=>L5("خصم استرجاع","Refund deduction"),team1_rev:()=>L5("خصم استرجاع فريق","Team refund"),team2_rev:()=>L5("خصم استرجاع فريق","Team refund")},
  CS:{PENDING:"y",VERIFIED:"b",APPROVED:"g",PAID:"g",REVERSED:"r"},
  rankCard(d){const L=d.levels||[],lv=d.level||{},nx=d.next,n=d.confirmed||0,mx=Math.max(1,nx?nx.min_sales:n),pc=nx?Math.min(100,Math.round((n-(lv.min_sales||0))/Math.max(1,nx.min_sales-(lv.min_sales||0))*100)):100;
    return`<div class="q-c q-rank"><div class="q-badge">${esc(lv.icon||"🏅")}</div><div><h2>${L5("رتبتك","Rank")}: <bdi>${esc(lv.name||"—")}</bdi> <small><bdi>${n}</bdi> ${L5("مبيعة مؤكدة","confirmed sales")}</small></h2><div class="q-bar"><i style="width:${Math.max(4,pc)}%"></i></div>
      <div class="q-steps">${L.map(l=>`<span>${l.code===lv.code?`<b>${esc(l.icon)} ${esc(l.name)} · ${L5("أنت هنا","you")}</b>`:`${esc(l.icon)} ${esc(l.name)}${nx&&l.code===nx.code?` · ${L5("باقي","left")} ${Math.max(0,nx.min_sales-n)}`:""}`}</span>`).join("")}</div></div>
      <div class="q-pct"><b>${+d.rate||0}%</b><span>${L5("نسبة أرباحك الحالية","Your current rate")}${d.rate_override!=null?` · ${L5("نسبة خاصة","custom")}`:""}${d.team_on&&+d.team1_pct?`<br>+${+d.team1_pct}% ${L5("من مبيعات فريقك المباشر","from direct team sales")}${+d.team2_pct?` · +${+d.team2_pct}% ${L5("مستوى ثاني","level 2")}`:""}`:""}</span></div></div>`},
  ago(t){const m=Math.max(1,Math.round((Date.now()-new Date(t))/6e4));return m<60?L5(`قبل ${m} دقيقة`,`${m} min ago`):m<1440?L5(`قبل ${Math.round(m/60)} ساعة`,`${Math.round(m/60)} h ago`):L5(`قبل ${Math.round(m/1440)} يوم`,`${Math.round(m/1440)} d ago`)},
  async getDash(){return V5.api().dash6()},
  async dashboard(){let d;try{d=await PP.getDash()}catch(e){return PP.locked()}PP.d=d;const sum=d.sum||{},dv=(d.daily||[]).map(x=>x.v),gr=d.prev_month_total?Math.round((d.month_total-d.prev_month_total)/d.prev_month_total*100):null,link=PP.links_(d);
    const LS={L:L5("باليسار ⬅️","on the left ⬅️"),R:L5("باليمين ➡️","on the right ➡️")};
    $("v5PartBody").innerHTML=PP.rankCard(d)+(d.demoView?`<div class="q-c" style="border-color:rgba(255,211,107,.5)">🧪 ${L5("معاينة الإدارة: هاي لوحة شريك تجريبي.","Admin preview: demo partner dashboard.")}</div>`:"")+
      `<div class="q-g4"><div class="q-k"><span>${L5("أرباحي هالشهر","Earnings this month")}</span><b style="color:var(--pg)">${PP.m(d.month_total)}</b><small${gr!=null&&gr<0?' class="dn"':""}>${gr==null?L5("أول شهر","first month"):(gr>=0?"↑ ":"↓ ")+Math.abs(gr)+"% "+L5("عن الشهر الماضي","vs last month")}</small>${PP.sp([1,2,2,3,4,5,6],"#45e6a5")}</div>
        <div class="q-k"><span>${L5("أرباح الفريق","Team earnings")}</span><b>${PP.m(d.team_month)}</b><small>${d.team_size||0} ${L5("شريك بفريقك","in your team")}</small>${PP.sp([1,1,2,3,3,4,5])}</div>
        <div class="q-k"><span>${L5("عملائي","My clients")}</span><b>${d.referred||0}</b><small>+${d.referred30||0} ${L5("آخر 30 يوم","last 30d")}</small>${PP.sp(dv.length?dv:[1,2,3])}</div>
        <div class="q-k"><span>${L5("جاهز للسحب","Available")}</span><b style="color:var(--py)">${PP.m(sum.approved)}</b><small><a href="#partners/money" style="color:var(--py)">${L5("طلب سحب ←","Request payout →")}</a></small>${PP.sp([3,3,2,3,2,2],"#ffd36b")}</div></div>
      <div class="q-g2"><div class="q-c"><h3>⚡ ${L5("آخر النشاطات","Recent activity")}</h3><div class="q-feed">${(d.feed||[]).sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,8).map(f=>f.t==="join"?`<div><span class="a">${esc((f.name||"?")[0])}</span><span><b>${esc(f.name)}</b> ${L5("سجّل تحتك","joined your team")} ${f.leg?LS[f.leg]:""}<br><small class="q-mut">${PP.ago(f.at)}</small></span><span class="q-s b">${f.status==="APPROVED"?L5("فعّال","active"):L5("بانتظار القبول","pending")}</span></div>`
          :`<div><span class="a">${f.kind==="commission"?"💵":f.kind==="bonus"?"🎁":f.kind&&f.kind.startsWith("team")?"👥":"🧾"}</span><span>${esc((PP.KIND[f.kind]||(()=>f.kind))())}${f.note?`: <b>${esc(f.note)}</b>`:""}<br><small class="q-mut">${PP.ago(f.at)}</small></span><span class="q-s ${PP.CS[f.status]||"b"}">${f.amount>=0?"+":""}${PP.m(f.amount)}</span></div>`).join("")||`<p class="q-mut">${L5("لسه ما أكو نشاط. شارك رابطك!","No activity yet. Share your link!")}</p>`}</div></div>
      <div style="display:grid;gap:16px;align-content:start"><div class="q-c"><h3>🔗 ${L5("رابطك","Your link")}</h3><div class="q-row" style="direction:ltr;font-family:var(--mono,monospace);color:var(--b2)">${esc(link.sale)}</div><div class="q-row"><span>${L5("رابط بناء الفريق","Team link")}</span><span style="direction:ltr;font-family:var(--mono,monospace);color:var(--pg);font-size:12px">…?p=${esc(d.code)}&t=${esc(d.code)}</span></div><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="q-btn" type="button" data-cp="${escA(link.sale)}">📋 ${L5("نسخ الرابط الموحد","Copy unified link")}</button><button class="q-btn2" type="button" data-cp="${escA(link.team)}">👥 ${L5("نسخ نفس الرابط","Copy same link")}</button></div></div>
        ${(d.incentives||[]).filter(i=>!i.claim).slice(0,1).map(i=>`<div class="q-c q-gift"><em>${esc(i.icon)}</em><h4>${esc(i.title)}</h4><div class="q-bar"><i style="width:${Math.min(100,Math.round(i.value/Math.max(1,i.target)*100))}%"></i></div><p>${i.value} / ${i.target}</p></div>`).join("")}</div></div>`;
    PP.bindCopy()},
  links_(d){const base=`${location.origin}${location.pathname.replace(/[^/]*$/,"")}app.html`;return{sale:`${base}?p=${encodeURIComponent(d.code)}&t=${encodeURIComponent(d.code)}`,team:`${base}?p=${encodeURIComponent(d.code)}&t=${encodeURIComponent(d.code)}`}},
  bindCopy(){$("v5PartBody").querySelectorAll("[data-cp]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.cp);V5.toast(L5("✅ انسخ الرابط","✅ Copied"))}catch(e){prompt("",b.dataset.cp)}})},
  // ---------- الفريق ----------
  async team(){let t;try{t=await V5.api().team()}catch(e){return PP.locked()}const T=t.tree||[],by=(p,l)=>T.find(x=>(x.parent||null)===p&&x.leg===l),nm=(ME.profile&&ME.profile.full_name||"").split(" ")[0]||L5("أنت","You");
    const node=(x,leg)=>x?`<div class="q-nd${x.status!=="APPROVED"?" pend":""}"><div class="a">${esc((x.name||"?")[0])}</div><b>${esc(x.name)}</b><small class="q-mut">${leg==="L"?"⬅️ "+L5("يسار","Left"):L5("يمين","Right")+" ➡️"} · ${esc(x.icon||"")} ${esc(x.level||"")}</small></div>`:`<div class="q-nd empty"><div class="a">＋</div><b>${L5("مكان فارغ","Open slot")}</b><small>${leg==="L"?L5("يسار","Left"):L5("يمين","Right")}</small></div>`;
    const l1=by(null,"L"),r1=by(null,"R"),kids=x=>x?[by(x.id,"L"),by(x.id,"R")]:[null,null],[a,b]=kids(l1),[c,d2]=kids(r1),lg=t.legs||{},weak=(lg.L_sales||0)<=(lg.R_sales||0)?"L":"R",choice=t.place_mode==="choice";
    $("v5PartBody").innerHTML=`<div class="q-g4"><div class="q-k"><span>${L5("حجم فريقي","Team size")}</span><b>${t.size||0}</b><small>${L5("شريك","partners")}</small></div><div class="q-k"><span>${L5("مبيعات الفريق هالشهر","Team sales this month")}</span><b>${t.team_sales_month||0}</b><small>${L5("مبيعة مؤكدة","confirmed")}</small></div><div class="q-k"><span>${L5("عمولة الفريق","Team commission")}</span><b style="color:var(--pg)">${PP.m(t.team_month)}</b><small>${t.team_on?L5("من مبيعات فريقك","from team sales"):L5("متوقفة من الإدارة","paused by admin")}</small></div><div class="q-k"><span>${L5("الطرف الأضعف","Weaker leg")}</span><b style="color:var(--py)">${weak==="L"?L5("اليسار","Left"):L5("اليمين","Right")}</b><small>${L5("ركّز عليه لحافز التوازن","focus here for the balance reward")}</small></div></div>
      <div class="q-g2"><div class="q-c"><h3>🌳 ${L5("شجرة الفريق","Team tree")}</h3><div class="q-tree"><div class="q-nd me"><div class="a">${esc(nm[0]||"V")}</div><b>${L5("أنت","You")} · ${esc(nm)}</b><span class="q-s g">${esc(t.code||"")}</span></div>
        <div class="q-lvl"><div class="q-cell">${node(l1,"L")}</div><div class="q-cell">${node(r1,"R")}</div></div>
        <div class="q-lvl q-lvl4"><div class="q-cell">${l1?node(a,"L"):""}</div><div class="q-cell">${l1?node(b,"R"):""}</div><div class="q-cell">${r1?node(c,"L"):""}</div><div class="q-cell">${r1?node(d2,"R"):""}</div></div></div>
        <div class="q-leg"><div><small>⬅️ ${L5("الطرف اليسار","Left leg")}</small><b>${lg.L||0} ${L5("شريك","partners")}</b><small>${lg.L_sales||0} ${L5("مبيعة مؤكدة","confirmed sales")}</small></div><div><small>${L5("الطرف اليمين","Right leg")} ➡️</small><b>${lg.R||0} ${L5("شريك","partners")}</b><small>${lg.R_sales||0} ${L5("مبيعة مؤكدة","confirmed sales")}</small></div></div>
        <p class="q-note">${L5("الشجرة تبين 3 مستويات تحتك. الأسماء مختصرة لحماية خصوصية الشركاء.","Shows 3 levels below you. Names are shortened for privacy.")}</p></div>
      <div style="display:grid;gap:16px;align-content:start"><div class="q-c"><h3>🆕 ${L5("سجلوا من رابط فريقك","Joined via your team link")}</h3><div class="q-feed">${(t.direct||[]).map(x=>`<div><span class="a">${esc((x.name||"?")[0])}</span><span><b>${esc(x.name)}</b><br><small class="q-mut">${x.leg==="L"?L5("يسار","Left"):x.leg==="R"?L5("يمين","Right"):L5("بانتظار الترتيب","awaiting placement")} · ${PP.ago(x.at)}</small></span><span class="q-s ${x.status==="APPROVED"?"g":"y"}">${x.status==="APPROVED"?L5("فعّال","active"):L5("بانتظار القبول","pending")}</span></div>`).join("")||`<p class="q-mut">${L5("شارك رابط الفريق حتى يبدي فريقك.","Share your team link to start your team.")}</p>`}</div></div>
        <div class="q-c"><h3>⚙️ ${L5("وين ينحط الجديد؟","Where do new members go?")}</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${[["L","⬅️ "+L5("يسار","Left")],["auto","⚖️ "+L5("تلقائي (الأضعف)","Auto (weaker leg)")],["R",L5("يمين","Right")+" ➡️"]].map(([k,l])=>`<button type="button" class="q-btn2${(t.place_pref||"auto")===k?" on":""}" data-pl="${k}" ${!choice&&k!=="auto"?"disabled":""}>${l}</button>`).join("")}</div>
          <p class="q-note">${choice?"":L5("المدير مخلّي الترتيب تلقائي على الطرف الأضعف. ","Admin set placement to automatic (weaker leg). ")}${L5("العمولات تنحسب بس على <b>المبيعات المؤكدة</b> لفريقك (مستويين)، ما أكو أرباح على التسجيل نفسه، والنسب يحددها المدير.","Commissions only on <b>confirmed sales</b> by your team (2 levels); no earnings for sign-ups; rates set by admin.")}</p>
          <div class="q-row" style="direction:ltr;font-family:var(--mono,monospace);font-size:12px;color:var(--pg)">${esc(PP.links_({code:t.code}).team)}</div><button class="q-btn" type="button" data-cp="${escA(PP.links_({code:t.code}).team)}" style="margin-top:8px">👥 ${L5("نسخ نفس الرابط","Copy same link")}</button></div></div></div>`;
    $("v5PartBody").querySelectorAll("[data-pl]").forEach(b=>b.onclick=async()=>{try{await V5.api().setPlace(b.dataset.pl);V5.toast("✅");PP.team()}catch(e){V5.toast(V5.err(e),1)}});PP.bindCopy()},
  // ---------- الرتب والحوافز ----------
  async ranks(){let d;try{d=await PP.getDash()}catch(e){return PP.locked()}const L=d.levels||[],I=d.incentives||[],full=V5P.po.levels||L;
    const st=c=>c?({requested:["y",L5("قيد المراجعة","Under review")],approved:["g",L5("انقبل","Approved")],delivered:["g",L5("انسلّم ✓","Delivered ✓")],rejected:["r",L5("مرفوض","Rejected")]}[c.status]||["b",c.status]):null;
    $("v5PartBody").innerHTML=PP.rankCard(d)+`<div class="q-g3">${I.map(i=>{const p=Math.min(100,Math.round(i.value/Math.max(1,i.target)*100)),s=st(i.claim);return`<div class="q-c q-gift${i.done?" done":""}"><em>${esc(i.icon)}</em><h4>${esc(i.title)}</h4><p>${esc(i.descr||"")}</p><div class="q-bar"><i style="width:${Math.max(3,p)}%"></i></div>
        <p>${i.value} / ${i.target}${i.period==="month"?" · "+L5("هالشهر","this month"):""} · 🎁 ${esc(i.reward||"")}</p>${s?`<span class="q-s ${s[0]}">${s[1]}</span>`:i.done?`<button class="q-btn" type="button" data-claim="${i.id}" style="justify-self:center">🎁 ${L5("استلم الهدية","Claim")}</button>`:`<span class="q-s b">${L5("بعدك","In progress")}</span>`}</div>`}).join("")}</div>
      <div class="q-c"><h3>📊 ${L5("جدول الرتب","Rank table")}</h3><div class="v3-tw"><table class="q-tbl"><tr><th>${L5("الرتبة","Rank")}</th><th>${L5("نسبتك الشخصية","Personal")}</th><th>${L5("فريق مستوى 1","Team L1")}</th><th>${L5("فريق مستوى 2","Team L2")}</th><th>${L5("الشرط","Requirement")}</th></tr>
        ${full.map(l=>`<tr style="${d.level&&l.code===d.level.code?"background:rgba(61,165,255,.12)":""}"><td><b>${esc(l.icon)} ${esc(l.name)}</b></td><td class="v g">${+l.rate}%</td><td class="v">${+(l.team1_pct||0)?+l.team1_pct+"%":"—"}</td><td class="v">${+(l.team2_pct||0)?+l.team2_pct+"%":"—"}</td><td class="q-mut">${esc(l.upgrade_rule||"")}${l.perks?" · "+esc(l.perks):""}</td></tr>`).join("")}</table></div>
        <p class="q-note">${L5("كل الأرقام والنسب والهدايا يحددها المدير. الترقية تلقائية حسب المبيعات المؤكدة.","All rates and rewards are set by the admin. Upgrades are automatic on confirmed sales.")}</p></div>`;
    $("v5PartBody").querySelectorAll("[data-claim]").forEach(b=>b.onclick=async()=>{try{await V5.api().claimInc(+b.dataset.claim);V5.toast(L5("✅ انرسل طلب الاستلام للإدارة","✅ Claim sent to admin"));PP.ranks()}catch(e){V5.toast(V5.err(e),1)}})},
  // ---------- الروابط والتسويق ----------
  async links(){let d;try{d=await PP.getDash()}catch(e){return PP.locked()}const k=PP.links_(d);
    $("v5PartBody").innerHTML=`<div class="q-g2"><div class="q-c"><h3>💵 ${L5("الرابط الموحد","Unified link")}</h3><p class="q-note">${L5("أي عميل يسجل من هذا الرابط ويشتري خلال 30 يوم ينحسب إلك (أول رابط بس).","Clients who sign up via this link and buy within 30 days are attributed to you (first touch).")}</p><div class="q-row" style="direction:ltr;font-family:var(--mono,monospace);color:var(--b2)">${esc(k.sale)}</div><button class="q-btn" type="button" data-cp="${escA(k.sale)}" style="margin-top:10px">📋 ${L5("نسخ","Copy")}</button>
        <h3 style="margin-top:18px">👥 ${L5("نفس الرابط لبناء الفريق","Same link for team")}</h3><p class="q-note">${L5("للأشخاص اللي يريدون يصيرون شركاء تحتك. ما ياخذون أي رسوم، وما تاخذ أرباح على تسجيلهم، بس على مبيعاتهم المؤكدة.","For people who want to become partners under you. No fees, and no earnings for their sign-up — only on their confirmed sales.")}</p><div class="q-row" style="direction:ltr;font-family:var(--mono,monospace);color:var(--pg)">${esc(k.team)}</div><button class="q-btn2" type="button" data-cp="${escA(k.team)}" style="margin-top:10px">👥 ${L5("نسخ","Copy")}</button></div>
      <div style="display:grid;gap:16px;align-content:start"><div class="q-c"><h3>🎨 ${L5("المواد التسويقية","Marketing kit")}</h3>${(d.assets||[]).map(a=>`<a class="q-row" href="${escA(a.url)}" target="_blank" rel="noopener" style="color:#eaf2ff;text-decoration:none"><span>${a.kind==="video"?"🎬":a.kind==="doc"?"📄":"🖼"} ${esc(a.title)}</span><span class="q-s b">${L5("تحميل","Download")}</span></a>`).join("")||`<p class="q-mut">${L5("تنضاف قريباً.","Coming soon.")}</p>`}</div>
        <div class="q-c"><h3>📌 ${L5("قواعد التسويق","Marketing rules")}</h3><p class="q-note">• ${L5("لا تعِد بأرباح أو نتائج تداول.","Never promise profits or trading results.")}<br>• ${L5("وضّح إنك شريك تجاري لفيكسورا.","Disclose that you are a VEXORA partner.")}<br>• ${L5("لا رسائل مزعجة ولا انتحال.","No spam or impersonation.")}<br>• ${L5("نبّه على مخاطر التداول.","Mention trading risks.")}</p></div></div></div>`;PP.bindCopy()},
  // ---------- العمولات والسحب ----------
  async money(){let d;try{d=await PP.getDash()}catch(e){return PP.locked()}const sum=d.sum||{},open=(d.payouts||[]).find(p=>["requested","approved"].includes(p.status)),av=+sum.approved||0,minp=+d.min_payout||0;
    $("v5PartBody").innerHTML=`<div class="q-g4"><div class="q-k"><span>${L5("معلقة","Pending")}</span><b style="color:var(--py)">${PP.m(sum.pending)}</b><small class="dn">${L5("بانتظار التحقق والاعتماد","awaiting verification")}</small></div><div class="q-k"><span>${L5("جاهزة للسحب","Available")}</span><b style="color:var(--pg)">${PP.m(sum.approved)}</b><small>${L5("معتمدة","approved")}</small></div><div class="q-k"><span>${L5("بطلب سحب","In payout")}</span><b>${PP.m(sum.in_payout)}</b><small>${L5("قيد التحويل","processing")}</small></div><div class="q-k"><span>${L5("مدفوعة","Paid")}</span><b>${PP.m(sum.paid)}</b><small>${L5("المجموع","total")}</small></div></div>
      <div class="q-g2"><div class="q-c"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">🧾 ${L5("السجل المالي","Ledger")}</h3><button class="q-btn2" type="button" id="mCsv">⬇️ CSV</button></div>
        <div class="v3-tw"><table class="q-tbl" style="margin-top:8px"><tr><th>${L5("التاريخ","Date")}</th><th>${L5("النوع","Type")}</th><th>${L5("التفاصيل","Details")}</th><th>${L5("المبلغ","Amount")}</th><th>${L5("الحالة","Status")}</th></tr>
        ${(d.ledger||[]).slice(0,60).map(r=>`<tr><td class="v">${new Date(r.at).toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"})}</td><td>${esc((PP.KIND[r.kind]||(()=>r.kind))())}</td><td class="q-mut" style="font-size:12px">${esc(r.product||r.note||"")}${r.amount!=null?` · ${PP.m(r.amount,r.currency)}`:""}${r.rate!=null?` · ${+r.rate}%`:""}</td><td class="v ${r.commission>=0&&r.status!=="REVERSED"?"g":""}">${PP.m(r.commission,r.currency)}</td><td><span class="q-s ${PP.CS[r.status]||"b"}">${esc(r.status)}</span></td></tr>`).join("")||`<tr><td colspan="5" class="q-mut">${L5("لسه ما أكو عمليات.","No transactions yet.")}</td></tr>`}</table></div></div>
      <div style="display:grid;gap:16px;align-content:start"><div class="q-c"><h3>💸 ${L5("طلب سحب","Payout")}</h3><div id="mPay"></div></div>
        <div class="q-c"><h3>📜 ${L5("طلبات السحب","Payouts")}</h3>${(d.payouts||[]).map(p=>`<div class="q-row"><span>#${p.id} · ${PP.m(p.amount)}<br><small class="q-mut">${esc(p.method)} · ${new Date(p.created_at).toLocaleDateString("en-GB")}</small></span><span class="q-s ${p.status==="paid"?"g":p.status==="rejected"?"r":"y"}">${esc(p.status)}</span></div>`).join("")||`<p class="q-mut">—</p>`}</div></div></div>`;
    $("mPay").innerHTML=open?`<p>💸 #${open.id} · ${PP.m(open.amount)} · ${open.status==="approved"?L5("معتمد وبانتظار التحويل","approved, awaiting transfer"):L5("قيد المراجعة","under review")}</p>`
      :av>0&&av>=minp?`<div class="q-form"><label>${L5("طريقة الاستلام","Method")}<select class="f" id="poM"><option>USDT TRC20</option><option>${L5("حوالة بنكية","Bank transfer")}</option><option>${L5("أخرى","Other")}</option></select></label><label>${L5("تفاصيل الاستلام","Payout details")}<input class="f ltr" id="poD"></label></div><button class="q-btn" type="button" id="poGo" style="margin-top:10px">💸 ${L5("اطلب سحب","Request")} ${PP.m(av)}</button><p class="q-note">${L5("السحب يحتاج اعتماد الإدارة.","Requires admin approval.")}</p>`
      :`<p class="q-mut">${L5(`السحب يتفعل لما يوصل رصيدك المعتمد ${minp}$.`,`Unlocks at ${minp}$ approved.`)}</p>`;
    if($("poGo"))$("poGo").onclick=async()=>{const det=$("poD").value.trim();if(det.length<4){V5.toast(L5("اكتب تفاصيل الاستلام","Enter payout details"),1);return}try{await V5.api().payout($("poM").value,det);V5.toast(L5("✅ انرسل طلب السحب","✅ Payout requested"));PP.money()}catch(e){V5.toast(V5.err(e),1)}};
    $("mCsv").onclick=()=>V5P.csv("vexora-partner-ledger.csv",[["date","kind","details","sale_amount","commission","rate","status"],...(d.ledger||[]).map(r=>[r.at,r.kind,r.product||r.note||"",r.amount==null?"":r.amount,r.commission,r.rate==null?"":r.rate,r.status])])},
  // ---------- دعم الشركاء ----------
  async help(){let d;try{d=await PP.getDash()}catch(e){return PP.locked()}
    $("v5PartBody").innerHTML=`<div class="q-g2"><div class="q-c"><h3>💬 ${L5("طلباتي","My tickets")}</h3>${(d.tickets||[]).map(t=>`<details class="q-row" style="display:block"><summary style="cursor:pointer">${t.status==="open"?"🟡":"✅"} ${esc(t.subject)} <small class="q-mut">${new Date(t.created_at).toLocaleDateString("en-GB")}</small></summary><p style="line-height:1.8">${esc(t.body)}</p>${t.reply?`<p style="color:var(--pg)">↩️ ${esc(t.reply)}</p>`:""}</details>`).join("")||`<p class="q-mut">—</p>`}</div>
      <div class="q-c"><h3>➕ ${L5("طلب جديد","New ticket")}</h3><div class="q-form"><label>${L5("الموضوع","Subject")}<input class="f" id="hS"></label><label>${L5("التفاصيل","Details")}<textarea class="f" id="hB" style="min-height:120px"></textarea></label></div><button class="q-btn" type="button" id="hGo" style="margin-top:10px">${L5("إرسال","Send")}</button></div></div>`;
    $("hGo").onclick=async()=>{try{await V5.api().ticket($("hS").value.trim(),$("hB").value.trim());V5.toast("✅");PP.help()}catch(e){V5.toast(V5.err(e),1)}}},
  // ---------- دعم وسيط الشركاء (IB) ----------
  async support(){const lg=window.LANG||"ar",B=await V5.api().brokers(lg,(ME.profile&&ME.profile.country)||"","partners");let T=[];try{T=await V5.api().myTickets("broker_ib")}catch(e){}
    $("v5PartBody").innerHTML=`<div class="q-g2"><div style="display:grid;gap:16px">${B.map(x=>PP.contact(x)).join("")||`<div class="q-c q-mut">${L5("جهات دعم الوسيط للشركاء تنضاف من الإدارة بعد التحقق منها.","Partner broker contacts are added by admin after verification.")}</div>`}
        <div class="q-c"><p class="q-note">${L5("لمشاكل ربط العملاء بالـ IB، تأخر العمولات من الوسيط، روابط الإحالة الخاصة بالوسيط، وتقارير الحسابات.","For client-to-IB linking, delayed broker commissions, broker referral links and account reports.")}</p></div></div>
      <div class="q-c"><h3>🎫 ${L5("تذاكري ويه مكتب الشركاء","My partner-desk tickets")}</h3>${T.map(t=>`<div class="q-tk"><span>${t.status==="open"?"🟡":"✅"}</span><span>${esc(t.subject)}<br><small class="q-mut">#${t.id} · ${new Date(t.created_at).toLocaleDateString("en-GB")}</small>${t.reply?`<br><small style="color:var(--pg)">↩️ ${esc(t.reply)}</small>`:""}</span><span class="q-s ${t.status==="open"?"y":"g"}">${t.status==="open"?L5("مفتوحة","Open"):L5("انرد","Answered")}</span></div>`).join("")||`<p class="q-mut">—</p>`}
        <div class="q-form" style="margin-top:12px"><label>${L5("الموضوع","Topic")}<select class="f" id="bT"><option>${L5("ربط عميل تحت IB","Client linking")}</option><option>${L5("عمولات الوسيط","Broker commissions")}</option><option>${L5("رابط إحالة الوسيط","Broker referral link")}</option><option>${L5("أخرى","Other")}</option></select></label><label>${L5("اشرح المشكلة","Describe the issue")}<textarea class="f" id="bB" style="min-height:100px"></textarea></label></div><button class="q-btn" type="button" id="bGo" style="margin-top:10px">➕ ${L5("تذكرة جديدة","New ticket")}</button></div></div>`;
    $("bGo").onclick=async()=>{try{await V5.api().brokerTicket("broker_ib",$("bT").value,$("bB").value.trim());V5.toast("✅");PP.support()}catch(e){V5.toast(V5.err(e),1)}}},
  contact(x){const tg=u=>u?`https://t.me/${encodeURIComponent(String(u).replace(/^@/,""))}`:"",wa=n=>n?`https://wa.me/${String(n).replace(/[^0-9]/g,"")}`:"";
    return`<div class="q-c"><div style="display:flex;gap:14px;align-items:center"><div class="q-badge" style="width:64px;height:64px;font-size:13px;border-radius:18px;font-weight:800">${x.logo_url?`<img src="${escA(x.logo_url)}" alt="" style="max-width:100%;max-height:100%;border-radius:14px">`:esc(x.broker)}</div><div><h3 style="margin:0">${esc(x.broker)}${x.agent_name?" · "+esc(x.agent_name):""} <span class="q-s g">✓ ${L5("موثّق","Verified")}</span></h3><p class="q-mut" style="margin:4px 0 0;font-size:13px">${x.hours?"🕐 "+esc(x.hours)+" · ":""}🌐 ${esc((x.langs||[]).join(", "))}</p></div></div>
      <div class="q-ct">${x.telegram?`<a href="${escA(tg(x.telegram))}" target="_blank" rel="noopener">✈️ Telegram</a>`:""}${x.whatsapp?`<a href="${escA(wa(x.whatsapp))}" target="_blank" rel="noopener">🟢 WhatsApp</a>`:""}${x.email?`<a href="mailto:${escA(x.email)}">✉️ Email</a>`:""}${x.website?`<a href="${escA(x.website)}" target="_blank" rel="noopener">🌐 ${L5("الموقع","Website")}</a>`:""}</div>${x.notes?`<p class="q-note" style="margin-top:10px">${esc(x.notes)}</p>`:""}</div>`},
  async open(tab){const me=()=>V5P.po&&V5P.po.me,ok=()=>me()&&me().status==="APPROVED";
    if(tab==="")tab=null;await PP.mount(tab==null?(V5P.po&&V5P.po.me&&V5P.po.me.status==="APPROVED"?"dashboard":""):tab);tab=PP.tab;
    try{if(tab==="admin"){await V5PA.open(PP.admTab||"");return}
      const map={dashboard:PP.dashboard,team:PP.team,ranks:PP.ranks,links:PP.links,money:PP.money,help:PP.help,support:PP.support};
      if(map[tab]){if(!ok()&&!isAdminUser()&&tab!=="support")return PP.locked();await map[tab]();return}
      V5P.tab=tab;await({"":V5P.home,apply:V5P.apply,ib:V5P.ib,agreement:V5P.agreement}[tab]||V5P.home)()}
    catch(e){$("v5PartBody").innerHTML=`<div class="q-c">⚠️ ${esc(V5.err(e))}</div>`}}
};
// ربط البوابة بالراوتر
(function(){const base=V5.view.bind(V5);V5.view=function(v,a){const pp=v==="partners"||v==="partadm";document.body.classList.toggle("pp-mode",pp);const bh=$("v6BrokerView");if(bh)bh.hidden=v!=="brokerhelp";if(v==="brokerhelp")VBH.open();
  if(pp){["v5NewsView","v5NewsAdmView"].forEach(id=>{const el=$(id);if(el)el.hidden=true});$("v5PartView").hidden=false;clearInterval(V5._t);PP.admTab=v==="partadm"?a:"";PP.open(v==="partadm"?"admin":(a==="dashboard"?"dashboard":a||""));return}
  if($("v5PartView"))$("v5PartView").hidden=true;base(v,a)}})();
V5P.open=function(a){PP._pt=0;return PP.open(a||"")};

/* ---------- دعم الوسيط المالي للمتدربين (المنصة الرئيسية) ---------- */
const VBH={async open(){const b=$("v6BrokerBody");if(!b)return;b.innerHTML=`<div class="panel label">${L5("جاري التحميل…","Loading…")}</div>`;
  let B=[],T=[];try{B=await V5.api().brokers(window.LANG||"ar",(ME.profile&&ME.profile.country)||"","traders")}catch(e){}try{T=await V5.api().myTickets("broker_trader")}catch(e){}
  const tg=u=>u?`https://t.me/${encodeURIComponent(String(u).replace(/^@/,""))}`:"",wa=n=>n?`https://wa.me/${String(n).replace(/[^0-9]/g,"")}`:"";
  const FAQ=[[L5("الإيداع ما وصل لحسابي","My deposit hasn't arrived"),L5("الإيداعات عادة توصل خلال دقايق لساعات حسب الطريقة. تأكد إنك أودعت لنفس رقم الحساب، واحتفظ بإيصال التحويل، وإذا تأخر أكثر من 24 ساعة راسل دعم الوسيط ويه الإيصال.","Deposits usually arrive within minutes to hours. Make sure you used the correct account number, keep the receipt, and if it takes over 24h contact broker support with it.")],
    [L5("شلون أسحب أرباحي؟","How do I withdraw?"),L5("السحب يكون من بوابة العميل عند الوسيط (Client Portal) لنفس طريقة الإيداع عادة. ممكن يطلبون توثيق الهوية قبل أول سحب.","Withdraw from the broker's client portal, usually to the same method you deposited with. ID verification may be required first.")],
    [L5("نسيت كلمة سر MT5","Forgot my MT5 password"),L5("تكدر تعيد تعيينها من بوابة العميل عند الوسيط. لا تعطي كلمة السر لأي أحد.","Reset it from the broker's client portal. Never share your password.")],
    [L5("شلون أربط حسابي بفيكسورا؟","How do I link my account to VEXORA?"),L5("اكتب رقم حساب INFINOX بملفك بالمنصة، والإدارة تتأكد منه وتفعّل حسابك.","Add your INFINOX account number in your profile; the admin verifies and activates you.")]];
  b.innerHTML=`<div class="panel"><div class="n-hd"><h2>🎧 ${L5("دعم الوسيط المالي","Broker support")}<small>${L5("عندك مشكلة بحسابك عند الوسيط؟ (فتح حساب، إيداع، سحب، منصة MT5) تواصل ويه دعمهم الرسمي مباشرة، أو اكتبلنا ونتابعها وياك.","Problem with your broker account (opening, deposit, withdrawal, MT5)? Contact their official support, or write to us and we'll follow up.")}</small></h2></div></div>
    <div class="k-g2"><div style="display:grid;gap:12px;align-content:start">${B.map(x=>`<div class="panel"><div class="p-bk"><div class="lg">${x.logo_url?`<img src="${escA(x.logo_url)}" alt="" style="max-width:100%;max-height:100%">`:esc(x.broker)}</div><div><h3 style="margin:0">${esc(x.broker)}${x.agent_name?" · "+esc(x.agent_name):""} <span class="k-st live">✓ ${L5("موثّق","Verified")}</span></h3><p class="label" style="margin:4px 0 0;font-size:12.5px">${x.hours?"🕐 "+esc(x.hours)+" · ":""}🌐 ${esc((x.langs||[]).join(", "))}</p></div></div>
        <div class="p-ct">${x.telegram?`<a href="${escA(tg(x.telegram))}" target="_blank" rel="noopener">✈️ Telegram</a>`:""}${x.whatsapp?`<a href="${escA(wa(x.whatsapp))}" target="_blank" rel="noopener">🟢 WhatsApp</a>`:""}${x.email?`<a href="mailto:${escA(x.email)}">✉️ Email</a>`:""}${x.website?`<a href="${escA(x.website)}" target="_blank" rel="noopener">🌐 ${L5("الموقع","Website")}</a>`:""}</div>${x.notes?`<p class="label" style="font-size:12.5px;margin:10px 0 0">${esc(x.notes)}</p>`:""}</div>`).join("")||`<div class="panel label">${L5("جهات دعم الوسيط تنضاف من الإدارة بعد التحقق منها.","Broker contacts are added by the admin after verification.")}</div>`}
      <div class="panel"><h3 style="margin:0 0 8px">❓ ${L5("مشاكل شائعة","Common issues")}</h3>${FAQ.map(([q,a])=>`<details class="n-pv" style="display:block"><summary style="cursor:pointer">${q}</summary><p class="label" style="line-height:1.9;margin:8px 0 0">${a}</p></details>`).join("")}</div></div>
      <div style="display:grid;gap:12px;align-content:start"><div class="panel"><h3 style="margin:0 0 8px">🎫 ${L5("ما انحلت؟ اكتبلنا","Still stuck? Write to us")}</h3><p class="label" style="font-size:12.5px">${L5("نوصّل مشكلتك لدعم الوسيط ونتابعها وياك.","We'll pass it to broker support and follow up.")}</p>
        <div class="k-form" style="grid-template-columns:minmax(0,1fr)"><label>${L5("نوع المشكلة","Issue type")}<select class="f" id="bhT"><option>${L5("إيداع","Deposit")}</option><option>${L5("سحب","Withdrawal")}</option><option>${L5("فتح حساب","Account opening")}</option><option>MT5</option><option>${L5("أخرى","Other")}</option></select></label><label>${L5("اشرح المشكلة","Describe the issue")}<textarea class="f" id="bhB" style="min-height:100px"></textarea></label></div><button class="btn primary" type="button" id="bhGo" style="margin-top:10px">${L5("إرسال","Send")}</button></div>
        ${T.length?`<div class="panel"><h3 style="margin:0 0 8px">📮 ${L5("طلباتي","My requests")}</h3>${T.map(t=>`<details class="n-pv" style="display:block"><summary>${t.status==="open"?"🟡":"✅"} ${esc(t.subject)} <small class="label">${new Date(t.created_at).toLocaleDateString("en-GB")}</small></summary><p style="line-height:1.8">${esc(t.body)}</p>${t.reply?`<p style="color:#7fe0b8">↩️ ${esc(t.reply)}</p>`:""}</details>`).join("")}</div>`:""}
        <div class="panel p-warn">🔒 ${L5("لا تعطي كلمة سر حسابك لأي أحد. فيكسورا والوسيط ما يطلبونها أبداً.","Never share your password. VEXORA and the broker will never ask for it.")}</div></div></div>`;
  $("bhGo").onclick=async()=>{try{await V5.api().brokerTicket("broker_trader",$("bhT").value,$("bhB").value.trim());V5.toast(L5("✅ انرسل طلبك","✅ Sent"));VBH.open()}catch(e){V5.toast(V5.err(e),1)}}}};

window.__V5={db:()=>DB.v5,me:()=>ME,V5:V5};V5.sideInit=async function(){try{document.querySelectorAll(".need-news").forEach(x=>x.hidden=!can("news"));const r=await DB.v5.portal();void r}catch(e){}};
setTimeout(()=>{try{V5.track()}catch(e){}},0);
window.addEventListener("online",()=>{
  V4.track();
  V5.track();
  window.VexoraAttribution?.assign("campaign",ME.user?.id,c=>DB.v4.setCamp(c))?.catch(()=>{});
  V5.afterLogin();
});
// زر «الإعدادات» لوحته موجودة بالصفحة الرئيسية: من أي صفحة ثانية نرجع للرئيسية ونفتحها
(function(){const b=document.getElementById("setBtn");if(!b)return;b.addEventListener("click",()=>{const tv=$("terminalView"),show=()=>{const pn=$("settings");if(!pn)return;pn.hidden=false;b.setAttribute("aria-expanded","true");pn.scrollIntoView({behavior:"smooth",block:"start"})};
  if(tv&&tv.hidden){location.hash="";setTimeout(show,350)}else setTimeout(()=>{const pn=$("settings");if(pn&&!pn.hidden)pn.scrollIntoView({behavior:"smooth",block:"start"})},30)})})();

/* ================= V7: الخطة الشبكية + المتصدرين + الروابط والطلبات + إعدادات إضافية ================= */
const P7={
  m:(n,c)=>`<bdi dir="ltr" class="p7-num">${c||"$"}${(Math.round((+n||0)*100)/100).toLocaleString("en-US")}</bdi>`,
  n:x=>`<bdi dir="ltr" class="p7-num">${(+x||0).toLocaleString("en-US")}</bdi>`,
  fd:d=>{try{return new Date(d).toLocaleDateString(window.LANG==="ar"||window.LANG==="ckb"||!window.LANG?"ar-IQ-u-nu-latn":window.LANG,{day:"numeric",month:"long"})}catch(e){return String(d).slice(0,10)}},
  lvName:(L,id)=>{const l=(L||[]).find(x=>x.id==id);return l?l.name:"—"},
  demo:()=>V5.api().demo?`<span class="p7-demo">${L5("بيانات توضيحية","Demo data")}</span>`:"",
  async d7(){return V5.api().dash7()},
  chart(months){const v=(months||[]).map(x=>+x.s||0);if(v.length<2)v.unshift(0);const mx=Math.max(1,...v),W=1000,H=170,pts=v.map((y,i)=>[i*(W/(v.length-1)),H-12-(y/mx)*(H-30)]);
    const d=pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
    return`<svg viewBox="0 0 ${W} ${H}" class="p7-chart" preserveAspectRatio="none"><defs><linearGradient id="p7g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3da5ff" stop-opacity=".45"/><stop offset="1" stop-color="#3da5ff" stop-opacity="0"/></linearGradient></defs><path d="${d} L${W} ${H} L0 ${H}Z" fill="url(#p7g)"/><path d="${d}" fill="none" stroke="#7cc8ff" stroke-width="3" vector-effect="non-scaling-stroke"/><circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="7" fill="#fff"/></svg>
      <div class="p7-axis">${(months||[]).map(x=>`<span>${esc(x.m)}</span>`).join("")}</div>`},
  pg(a,b){const p=b>0?Math.min(100,Math.round(a/b*100)):100;return`<div class="p7-pg"><i style="width:${p}%"></i></div>`},
  // ---------- اللوحة ----------
  async dashboard(){let d;try{d=await P7.d7()}catch(e){return P7.old?P7.old():PP.locked()}if(d.status!=="APPROVED")return isAdminUser()&&P7.old?P7.old():PP.locked();
    const w=d.week||{},nx=d.next,lv=d.level,W=(d.weeks||[]).slice(0,4).reverse(),qn=(d.weeks||[]).filter(x=>x.level_id).length,bk=d.by_kind||{};
    const tabs=[["all",L5("الكل","All time"),d.total],["month",L5("هالشهر","This month"),((d.months||[]).slice(-1)[0]||{}).s||0],["week",L5("آخر أسبوع","Last week"),((d.weeks||[])[0]||{}).paid||0]];
    const k5=[["⚡",L5("بيع مباشر","Direct sales"),bk.commission||0,L5("عمولة مبيعاتك","Your sales commission")],["🌳",L5("عمولة الفريق","Team commission"),(bk.binary||0)+(bk.team1||0)+(bk.team2||0),L5("ثنائي يمين/يسار","Binary left/right")],["🏅",L5("مكافأة الرتبة","Rank bonus"),bk.bonus||0,L5("من مبيعات الفريق","From team sales")],["⏳",L5("بانتظار الصرف","Pending payout"),d.pending_payout||0,L5("معتمد وجاهز","Approved, ready")]];
    $("v5PartBody").innerHTML=`
      <div class="q-c p7-hero">${P7.demo()}<div class="p7-sky"></div><div class="p7-hin">
        <div class="p7-k" style="color:#ffd36b">${L5("تأهيل الرتبة","Rank qualification")}${nx?` · ${esc(nx.name)}`:""}</div>
        <h2>${nx&&nx.name?L5(`تأهيل رتبة ${esc(nx.name)}`,`${esc(nx.name)} qualification`):L5("أعلى رتبة 👑","Top rank 👑")}</h2>
        <div class="p7-k" style="margin-top:12px">${L5("الأسبوع الحالي","Current week")}</div><div class="p7-wk">${P7.fd(w.start)} – ${P7.fd(new Date(+new Date(w.end)-864e5))}</div>
        ${d.bin_on?`<div class="p7-qbox"><div>${nx?L5(`حقّق شروط ${esc(nx.name)}: ${P7.n(nx.req_pts)} نقطة مبيعات مؤكدة و${P7.n(nx.req_refs)} إحالة فعّالة بكل ساق.`,`Reach ${esc(nx.name)}: ${P7.n(nx.req_pts)} confirmed sales points and ${P7.n(nx.req_refs)} active referrals per leg.`):L5("انت بأعلى رتبة.","You're at the top rank.")}</div><div class="p7-qn">${P7.n(qn)} / ${P7.n((d.weeks||[]).length||0)}</div></div>`
          :`<div class="p7-qbox"><div>${L5("الخطة الشبكية بعدها مو مفعّلة من الإدارة. عمولة البيع المباشر شغالة.","Network plan is not enabled yet. Direct sales commission is active.")}</div></div>`}
        <div class="p7-weeks">${W.map((x,i)=>`<div class="${x.level_id?"ok":""}"><b></b>${L5("أسبوع","Week")} ${P7.fd(x.wk)}</div>`).join("")}<div class="now"><b></b>${L5("هذا الأسبوع","This week")}</div></div></div></div>
      <div class="q-c">${P7.demo()}<div class="p7-row"><div><div class="p7-k">${L5("إجمالي العمولات المعتمدة","Total confirmed commissions")}</div><div class="p7-big" id="p7Tot">${P7.m(d.total)}</div><div class="q-mut" style="font-size:12.5px">${L5("من مبيعات حقيقية مؤكدة فقط","From real confirmed sales only")}</div></div>
        <div class="p7-tabs">${tabs.map(([k,l],i)=>`<button type="button" data-t="${k}" class="${i===0?"on":""}">${l}</button>`).join("")}</div></div>
        ${P7.chart(d.months)}
        <div class="q-g4 p7-minis">${k5.map(([ic,l,v,s])=>`<div class="p7-mini"><span class="p7-k">${ic} ${l}</span><b>${P7.m(v)}</b><small>${s}</small></div>`).join("")}</div></div>
      <div class="q-g3">
        <a class="p7-prog" href="#partners/links"><i>⚡</i><div><b>${L5("البيع المباشر","Direct sales")}</b><small>${L5("نسبة على كل بيع من رابطك","A share of every sale from your link")}</small></div></a>
        <a class="p7-prog" href="#partners/team"><i>🌳</i><div><b>${L5("الفريق الثنائي","Binary team")}</b><small>${L5("يمين ويسار · مبيعات حقيقية","Left & right · real sales")}</small></div></a>
        <a class="p7-prog" href="#partners/ranks"><i>🏅</i><div><b>${L5("حوافز الرتب","Rank rewards")}</b><small>${L5("هدايا ومكافآت التأهيل","Qualification rewards")}</small></div></a></div>
      <div class="q-c"><h3>${L5("رتبتك الحالية:","Your current rank:")} <span style="color:#7cc8ff">${esc(lv&&lv.name||"Starter")}</span></h3>
        <div class="p7-rk">${(d.levels||[]).map(l=>`<div class="${lv&&l.sort<=lv.sort?"on":""}">${esc(l.name)}</div>`).join("")}</div>
        <div class="q-g2" style="margin-top:14px">
          <div class="p7-mini"><span class="p7-k">${L5("نقاط المبيعات هالأسبوع","Sales points this week")}</span>${L5("يسار","Left")} <span class="p7-r">${P7.n(w.l_pts)} / ${P7.n(nx?nx.req_pts:w.l_pts)}</span>${P7.pg(w.l_pts,nx?nx.req_pts:0)}${L5("يمين","Right")} <span class="p7-r">${P7.n(w.r_pts)} / ${P7.n(nx?nx.req_pts:w.r_pts)}</span>${P7.pg(w.r_pts,nx?nx.req_pts:0)}</div>
          <div class="p7-mini"><span class="p7-k">${L5("إحالات فعّالة","Active referrals")}</span>${L5("يسار","Left")} <span class="p7-r">${P7.n(w.l_refs)} / ${P7.n(nx?nx.req_refs:w.l_refs)}</span>${P7.pg(w.l_refs,nx?nx.req_refs:0)}${L5("يمين","Right")} <span class="p7-r">${P7.n(w.r_refs)} / ${P7.n(nx?nx.req_refs:w.r_refs)}</span>${P7.pg(w.r_refs,nx?nx.req_refs:0)}</div></div>
        <p class="q-mut" style="font-size:12.5px;margin-top:10px">${L5("النقطة = 1$ من مبيعات حقيقية مؤكدة (مدفوعة) لأعضاء الساق. التسجيل أو الانضمام ما يعطي نقاط ولا أرباح.","1 point = $1 of real confirmed (paid) sales in the leg. Signups give no points and no earnings.")}</p></div>`;
    if(P7.old){const B=$("v5PartBody"),keep=[...B.children];const tmp=document.createElement("div");tmp.id="v5PartBody";B.id="p7Hold";B.after(tmp);
      try{await P7.old()}catch(e){}const g=tmp.querySelector(".q-g2:last-of-type");tmp.remove();B.id="v5PartBody";if(g)B.append(g);PP.bindCopy()}
    const tot=$("p7Tot");$("v5PartBody").querySelectorAll(".p7-tabs button").forEach(b=>b.onclick=()=>{$("v5PartBody").querySelectorAll(".p7-tabs button").forEach(x=>x.classList.toggle("on",x===b));tot.innerHTML=P7.m(tabs.find(t=>t[0]===b.dataset.t)[2])})},
  // ---------- خطة الأرباح ----------
  async plan(){let d;try{d=await P7.d7()}catch(e){return PP.locked()}const L=(d.levels||[]).filter(l=>l.active!==false),cur=d.level,nx=d.next;
    const st=l=>cur&&l.id===cur.id?L5("الرتبة الحالية","Current rank"):nx&&l.id===nx.id?L5("الرتبة الجاية","Next rank"):cur&&l.sort<cur.sort?L5("محققة ✓","Achieved ✓"):L5("مقفلة 🔒","Locked 🔒");
    const lock=l=>!(cur&&l.sort<=cur.sort)&&!(nx&&l.id===nx.id);
    $("v5PartBody").innerHTML=`
      <div class="q-c p7-row"><div><b>${L5("فترة التأهيل:","Qualification period:")}</b> ${P7.fd(d.week.start)} – ${P7.fd(new Date(+new Date(d.week.end)-864e5))} · ${L5("الرتب تتثبت السبت 00:00 بتوقيت بغداد","Ranks lock Saturday 00:00 Baghdad time")}</div><span class="p7-pill" id="p7Lock"></span></div>
      <div class="q-g4">
        <div class="p7-mini"><span class="p7-k">${L5("فترة التأهيل","Period")}</span><b class="p7-s">${L5("من السبت للجمعة","Saturday to Friday")}</b><small>${L5("الرتبة تتحسب كل أسبوع","Rank is computed weekly")}</small></div>
        <div class="p7-mini"><span class="p7-k">${L5("موعد الصرف","Payout")}</span><b class="p7-s">${L5("بعد اعتماد الإدارة","After admin approval")}</b><small>${L5("وبعد فترة الإرجاع","After the refund window")}</small></div>
        <div class="p7-mini"><span class="p7-k">${L5("سقف عمولة الفريق","Team commission cap")}</span><b class="p7-s">${P7.n(d.cap||40)}% ${L5("من المبيعات","of sales")}</b><small>${L5("إذا تجاوزت، تتوزع بالنسبة","Scaled down proportionally if exceeded")}</small></div>
        <div class="p7-mini"><span class="p7-k">${L5("المرجع","Governing terms")}</span><b class="p7-s">${L5("العقد","The agreement")}</b><small><a href="#partners/agreement" style="color:#7cc8ff">${L5("اقرأ العقد ←","Read it →")}</a></small></div></div>
      <div class="q-c"><div class="p7-lad"><div class="p7-ladl">${L.map(l=>`<div class="${cur&&l.id===cur.id?"on":""}" style="--c:${escA(l.color||"#7cc8ff")}"><b></b>${esc(String(l.name).toUpperCase())}</div>`).join("")}</div><div>
        ${L.map(l=>`<div class="p7-rc${lock(l)?" lock":""}"><div class="ic">${esc(l.icon||"🏅")}</div><div style="min-width:0"><h4>${esc(l.name)}</h4>
          <div class="q-mut">${+l.req_refs?L5(`${l.req_refs} إحالة فعّالة بكل ساق`,`${l.req_refs} active referral(s) per leg`):L5("بدون شرط إحالات","No referral requirement")} · ${P7.n(l.req_pts)} ${L5("نقطة بكل ساق","points per leg")}${+l.req_leaders?` · ${l.req_leaders} ${L5("قادة","leaders")}`:""}</div>
          <div class="p7-l2">${L5("عمولة البيع المباشر:","Direct sales:")} <b>${P7.n(l.rate)}%</b>${+l.bin_pct?` · ${L5("عمولة الفريق:","Team commission:")} <b>${P7.n(l.bin_pct)}%</b> ${L5("من مبيعات الساق الأضعف","of the weaker leg's sales")}`:""}</div>
          ${cur&&l.id===cur.id||nx&&l.id===nx.id?`<ul class="p7-req"><li>${L5("شريك معتمد وفعّال","Approved, active partner")}</li>${+l.req_refs?`<li>${L5(`${l.req_refs} إحالة فعّالة (اشترت فعلاً) بكل ساق`,`${l.req_refs} active (paying) referral(s) per leg`)}</li>`:""}<li>${L5(`${P7.n(l.req_pts)} نقطة من مبيعات حقيقية بكل ساق`,`${P7.n(l.req_pts)} points of real sales per leg`)}</li><li>${L5("ما تنحسب نقاط على التسجيل أو الانضمام","No points for signups")}</li></ul>`:""}
          </div><div class="st">${L5("الحالة","Status")}<b>${st(l)}</b></div></div>`).join("")}</div></div></div>`;
    const lk=$("p7Lock"),end=+new Date(d.week.end),tick=()=>{if(!document.body.contains(lk))return clearInterval(P7._t);const s=Math.max(0,Math.floor((end-Date.now())/1e3));lk.textContent=L5(`تتثبت بعد ${Math.floor(s/86400)}ي ${Math.floor(s%86400/3600)}س ${Math.floor(s%3600/60)}د`,`Locks in ${Math.floor(s/86400)}d ${Math.floor(s%86400/3600)}h ${Math.floor(s%3600/60)}m`)};clearInterval(P7._t);tick();P7._t=setInterval(tick,3e4)},
  // ---------- المتصدرين ----------
  async lead(){const sc=P7.lbScope||"all",pr=P7.lbPer||"week";let R,d;try{[R,d]=await Promise.all([V5.api().lb(sc,pr),P7.d7()])}catch(e){return PP.locked()}
    const fl=c=>{try{return c?String.fromCodePoint(...[...c.toUpperCase()].map(x=>127397+x.charCodeAt(0))):""}catch(e){return""}},md=["🥇","🥈","🥉"];
    $("v5PartBody").innerHTML=`<div class="p7-row" style="flex-wrap:wrap;gap:10px"><div class="p7-tabs">${[["week",L5("هالأسبوع","This week")],["month",L5("هالشهر","This month")],["all",L5("الكل","All time")]].map(([k,l])=>`<button type="button" data-per="${k}" class="${k===pr?"on":""}">${l}</button>`).join("")}</div>
        <div class="p7-tabs">${[["team",L5("فريقي","My team")],["all",L5("كل الشركاء","All partners")]].map(([k,l])=>`<button type="button" data-sc="${k}" class="${k===sc?"on":""}">${l}</button>`).join("")}</div>
        <label class="p7-chk"><input type="checkbox" id="p7Hide"${d.hide_lb?" checked":""}> ${L5("اخفيني من لوحة المتصدرين","Hide me from the leaderboard")}</label></div>
      <div class="q-c">${P7.demo()}<h3>🏆 ${L5("أعلى مبيعات مؤكدة","Top confirmed sales")}</h3><table class="p7-t"><thead><tr><th>${L5("الترتيب","Rank")}</th><th>${L5("الشريك","Partner")}</th><th>${L5("الدولة","Country")}</th><th>${L5("مبيعات مؤكدة","Confirmed sales")}</th><th>${L5("الرتبة","Level")}</th></tr></thead><tbody>
        ${R.length?R.map((x,i)=>`<tr class="${x.me?"me":""}"><td>${md[i]||"#"+(i+1)}</td><td>${esc(x.me?L5("أنت","You"):x.name)}</td><td>${fl(x.country)} ${esc(x.country||"")}</td><td>${P7.n(x.n)}</td><td><span class="p7-tag">${esc(x.level||"—")}</span></td></tr>`).join(""):`<tr><td colspan="5" class="q-mut">${L5("لسه ماكو مبيعات بهالفترة.","No sales in this period yet.")}</td></tr>`}</tbody></table>
        <p class="q-mut" style="font-size:12px;margin-top:10px">${L5("الأسماء مخفية جزئياً للخصوصية، وما تنعرض أي مبالغ. الترتيب حسب عدد المبيعات المؤكدة (المدفوعة).","Names are partially hidden and no amounts are shown. Ranked by confirmed (paid) sales.")}</p></div>`;
    const B=$("v5PartBody");B.querySelectorAll("[data-per]").forEach(b=>b.onclick=()=>{P7.lbPer=b.dataset.per;P7.lead()});B.querySelectorAll("[data-sc]").forEach(b=>b.onclick=()=>{P7.lbScope=b.dataset.sc;P7.lead()});
    $("p7Hide").onchange=async e=>{try{await V5.api().hideLb(e.target.checked);V5.toast("✅")}catch(x){V5.toast(V5.err(x),1)}}},
  // ---------- إضافة للفريق (فوق صفحة الفريق القديمة) ----------
  async teamTop(){let d,T;try{[d,T]=await Promise.all([P7.d7(),V5.api().tree(3)])}catch(e){return}const w=d.week||{},B=$("v5PartBody");if(!B)return;
    const by=(p,l)=>T.find(x=>x.parent===p&&x.leg===l),node=(x,me)=>x?`<div class="p7-tn${me?" me":""}"><span class="pp-av" style="width:30px;height:30px;font-size:12px">${esc((x.name||"?")[0])}</span><div>${esc(me?L5("أنت","You"):x.name)}<small>${esc(x.level||"")}</small></div></div>`:`<div class="p7-tn empty">＋ ${L5("مكان فارغ","Empty slot")}</div>`;
    const root=T.length?T[0].parent:null,a=by(root,"L"),b=by(root,"R");
    const top=document.createElement("div");top.className="p7-teamtop";top.innerHTML=`
      <div class="q-g2"><div class="q-c">${P7.demo()}<div class="p7-k">${L5("نقاط هالأسبوع","This week's points")}</div><table class="p7-t2"><tr><td>${L5("اليسار","Left")}</td><td>${P7.n(w.l_pts)}</td></tr><tr><td>${L5("اليمين","Right")}</td><td>${P7.n(w.r_pts)}</td></tr></table></div>
        <div class="q-c"><div class="p7-k">${L5("الإحالات الفعّالة","Active referrals")}</div><table class="p7-t2"><tr><td>${L5("اليسار","Left")}</td><td>${P7.n(w.l_refs)}</td></tr><tr><td>${L5("اليمين","Right")}</td><td>${P7.n(w.r_refs)}</td></tr></table></div></div>
      ${+d.tank?`<div class="q-c" style="padding:12px 18px"><p class="q-mut" style="font-size:12.5px;margin:0">🕘 ${L5(`خزان الانتظار: ${d.tank} عضو بانتظار تحديد مكانهم — يتوزعون تلقائياً حسب الإعدادات.`,`Holding tank: ${d.tank} member(s) waiting for placement.`)}</p></div>`:""}`;
    B.prepend(top)},
  // ---------- إضافة للروابط: رابط منتج + طلباتي ----------
  async linksBottom(){let P,O,d;try{[P,O,d]=await Promise.all([V5.api().linkProducts(),V5.api().orders(),P7.d7()])}catch(e){return}const B=$("v5PartBody");if(!B)return;
    const base=`${location.origin}${location.pathname.replace(/[^/]*$/,"")}`,mk=v=>v.startsWith("c:")?`${base}index.html?p=${d.code}#course/${v.slice(2)}`:`${base}app.html?p=${d.code}&k=${v.slice(2)}`;
    const opts=(P.courses||[]).map(c=>`<option value="c:${escA(c.id)}">${esc(c.icon||"")} ${esc(c.title)} — $${esc(c.price)}</option>`).join("")+(P.products||[]).map(p=>`<option value="p:${escA(p.code)}">${esc(p.name)}</option>`).join("");
    const kn={monthly:L5("اشتراك شهري","Monthly"),course:L5("دورة","Course"),zoom:L5("جلسة خاصة","Private session"),ai:"AI",indicator:L5("مؤشر","Indicator")},stc={paid:"g",done:"g",pending:"y",rejected:"r",refunded:"r"};
    const box=document.createElement("div");box.className="p7-linksb";box.innerHTML=`
      <div class="q-c"><h3>🎯 ${L5("رابط مخصص لمنتج","Product link")}</h3><p class="q-mut" style="font-size:13px">${L5("اختار منتج، وشارك رابط يفتح عليه مباشرة — وكل بيع منه ينحسب إلك.","Pick a product and share a link that opens it directly — sales still count for you.")}</p>
        <div class="q-g2"><select id="p7Prod" class="f">${opts}</select><div class="p7-inp"><span id="p7PL" class="p7-num" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span><button type="button" class="btn v2s" id="p7PC">⧉ ${L5("نسخ","Copy")}</button></div></div></div>
      <div class="q-c">${P7.demo()}<h3>🧾 ${L5("اشتراكي وطلباتي","My subscriptions & orders")}</h3>${O.length?`<table class="p7-t"><thead><tr><th>${L5("الطلب","Order")}</th><th>${L5("النوع","Type")}</th><th>${L5("التاريخ","Date")}</th><th>${L5("الحالة","Status")}</th><th>${L5("المبلغ","Amount")}</th></tr></thead><tbody>
        ${O.map(o=>`<tr><td>${P7.n(o.id).replace(">",">#")}</td><td>${esc(kn[o.kind]||o.kind)}${o.title?` · ${esc(o.title)}`:""}</td><td>${P7.fd(o.created_at)}</td><td><span class="p7-tag ${stc[o.status]||""}">${esc(o.status)}</span>${o.expires_at?`<small class="q-mut"> · ${L5("ينتهي","ends")} ${P7.fd(o.expires_at)}</small>`:""}</td><td>${P7.m(o.amount,o.currency)}</td></tr>`).join("")}</tbody></table>`:`<p class="q-mut">${L5("ما عندك طلبات بعد.","No orders yet.")}</p>`}</div>`;
    B.append(box);const sel=$("p7Prod"),out=$("p7PL"),upd=()=>{out.textContent=sel.value?mk(sel.value):""};sel.onchange=upd;upd();
    $("p7PC").onclick=async()=>{try{await navigator.clipboard.writeText(out.textContent);V5.toast("✅ "+L5("انسخ","Copied"))}catch(e){V5.toast(out.textContent)}}}
};
// ربط بالبوابة
(function(){
  const nav0=PP.nav.bind(PP);PP.nav=function(){const r=nav0();const i=r.items.findIndex(x=>x[0]==="dashboard");if(i>=0&&!r.items.some(x=>x[0]==="plan")){r.items.splice(i+1,0,["plan","🧭",L5("خطة الأرباح","Compensation plan"),"#partners/plan",1],["lead","🏆",L5("المتصدرين","Leaderboard"),"#partners/lead",1])}
    r.items=r.items.map(x=>x[0]==="links"?["links","🔗",L5("روابطي والطلبات","Links & orders"),x[3],x[4]]:x);return r};
  const t0=PP.title.bind(PP);PP.title=function(){if(PP.tab==="plan")return[L5("خطة","Compensation"),L5("الأرباح","plan"),L5("البرامج والرتب — كل النسب يحددها المدير، والعقد هو المرجع","Programs and ranks — all rates are set by the admin; the agreement governs")];
    if(PP.tab==="lead")return["🏆 "+L5("المتصدرين","Leader"),L5("","boards"),L5("ترتيب الشركاء حسب المبيعات المؤكدة","Partners ranked by confirmed sales")];return t0()};
  P7.old=PP.dashboard.bind(PP);PP.dashboard=P7.dashboard;
  const team0=PP.team.bind(PP);PP.team=async function(){await team0();await P7.teamTop()};
  const links0=PP.links.bind(PP);PP.links=async function(){await links0();await P7.linksBottom()};
  const open0=PP.open.bind(PP);PP.open=async function(tab){if(tab==="plan"||tab==="lead"){await PP.mount(tab);const me=V5P.po&&V5P.po.me;if(!(me&&me.status==="APPROVED")&&!isAdminUser())return PP.locked();try{await P7[tab]()}catch(e){$("v5PartBody").innerHTML=`<div class="q-c">⚠️ ${esc(V5.err(e))}</div>`}return}return open0(tab)};
})();

/* PARTNERS 3.0 — staging only; existing financial ledger unchanged */
(function(){
 const nav=PP.nav.bind(PP); PP.nav=function(){const r=nav(); if(r.ok||isAdminUser())r.items.splice(1,0,["royal","♛",L5("الصندوق الملكي","Royal pool"),"#partners/royal",1],["marketing","✦",L5("مركز التسويق AI","AI marketing"),"#partners/marketing",1]);return r};
 const title=PP.title.bind(PP);PP.title=function(){if(PP.tab==="royal")return ["VEXORA","ROYAL POOL",L5("معاينة النظام المالي الجديد — غير مفعل","New financial plan preview — inactive")];if(PP.tab==="marketing")return ["VEXORA","AI MARKETING",L5("مركز التسويق داخل الشركاء","Partner marketing workspace")];return title()};
 const open=PP.open.bind(PP);PP.open=async function(tab){if(!["royal","marketing"].includes(tab))return open(tab);await PP.mount(tab);if(!PP.nav().ok&&!isAdminUser())return PP.locked();const el=$("v5PartBody");if(tab==="marketing"){if(window.VexoraMarketing&&DB.marketing)return window.VexoraMarketing.open(el,DB.marketing);el.textContent="Marketing unavailable";return;}el.innerHTML=`<div class="q-c"><h2>♛ VEXORA ROYAL POOL</h2><p>معاينة فقط — لم يتم تفعيل النظام المالي أو تغيير الأرصدة.</p><div class="q-g4"><div class="q-k">المسوق<b>40%</b></div><div class="q-k">الصندوق<b>30%</b></div><div class="q-k">قائد الفريق المباشر<b>10%</b></div><div class="q-k">الأكاديمية<b>20–30%</b></div></div><p>التوزيع حسب المبيعات الشخصية المؤهلة. عند عدم وجود قائد تعود حصته للأكاديمية.</p><p>شروط التأهل المقترحة: 10 مبيعات و2500 دولار شهرياً. لا توجد أرصدة جديدة معتمدة.</p></div>`;};
 const oldIb=V5P.ib.bind(V5P); V5P.ib=async function(){await oldIb();const host=document.getElementById("v5PartBody");if(!host)return;const panel=document.createElement("div");panel.className="q-c";panel.innerHTML=`<h2>VEXORA IB NETWORK</h2><div class="q-g4"><div class="q-k">العمولة المستهدفة<b>$10 / LOT</b></div><div class="q-k">استقطاع فيكسورا<b>0%</b></div><div class="q-k">حوافز الإيداعات المستهدفة<b>حتى 10%</b></div><div class="q-k">Cashback<b>حسب الاتفاقية</b></div></div><p>مقترح غير مفعل. تخضع المزايا لموافقة البروكر والقيود القانونية. رابط الوكيل الرسمي يصدر من INFINOX؛ لا يعتبر رابط الأكاديمية رابط وكالة.</p>`;host.prepend(panel)};
 const css=document.createElement("style");css.textContent=`#v5PartView .pp{--b1:#d5ae58;--b2:#f4d58a;--b3:#8f692d;--pl:rgba(213,174,88,.35);--py:#f4d58a;--glass:linear-gradient(145deg,#172235,#0b101a)}#v5PartView .pp-bg{background:radial-gradient(ellipse at top right,#1d2a42,transparent 65%),#080d16}#v5PartView .pp-brand .lg,#v5PartView .pp-it.on{background:linear-gradient(145deg,#82602c,#302719);border-color:#d5ae58}#v5PartView .pp-it i{background:linear-gradient(145deg,#344052,#101720);border:1px solid #8f7445;box-shadow:inset 0 1px 2px #ffffff33,0 4px 8px #0008}#v5PartView .pp-top h1 em{background:linear-gradient(90deg,#f4d58a,#b98a39);background-clip:text;color:transparent}#v5PartView .q-c,#v5PartView .q-k{border-color:#76613b;background:linear-gradient(145deg,#172235,#0b101a)}#v5PartView .pp-it.on{box-shadow:0 0 15px #d5ae5822}`;document.head.append(css);
})();


/* V3 owner settings — isolated policy, not live commission activation */
(function(){
 const fields=[["seller_bp","s","الشريك المباشر %",100],["leader_bp","l","قائد الفريق %",100],["academy_bp","a","الأكاديمية %",100],["pool_bp","p","الصندوق الملكي %",100],["min_sales","n","المبيعات الشهرية",1],["min_net_cents","m","صافي المبيعات بالدولار",100],["ib_lot_cents","i","دولار لكل لوت",100],["deposit_bp","d","حوافز الإيداع %",100],["cashback_bp","c","الكاش باك %",100]];
 const nav=PP.nav.bind(PP);PP.nav=function(){const r=nav();if(isAdminUser())r.items.push(["owner-policy","⚙️","إعدادات المالك V3","#partners/owner-policy",0]);return r};
 const open=PP.open.bind(PP);PP.open=async function(tab){if(tab!=="owner-policy")return open(tab);await PP.mount(tab);const host=$("v5PartBody"),api=V5.api();host.textContent="جاري التحقق من صلاحية المالك…";if(!isAdminUser()){host.textContent="الحساب الحالي لا يحمل دور admin في الملف الشخصي. يرجى التحقق من جلسة تسجيل الدخول وصلاحية المالك في Supabase.";return}if(api.demo||!api.ownerPolicyRead){host.textContent="ربط قاعدة البيانات غير متاح في هذه البيئة.";return}let row;try{row=await api.ownerPolicyRead()}catch(e){const code=String(e?.code||"").slice(0,32),msg=String(e?.message||"").slice(0,180);host.textContent="تعذّر تحميل إعدادات المالك. "+(code?"رمز الخطأ: "+code+". ":"")+(code==="PGRST202"?"دالة القراءة غير متاحة في مخطط API.":code==="42501"?"صلاحية تنفيذ الدالة مرفوضة.":code==="PGRST301"?"الجلسة غير صالحة؛ سجّل الدخول من جديد.":"يرجى مراجعة صلاحيات الدالة والاتصال.")+(msg?" التفاصيل: "+msg:"");return}if(!row){host.textContent="لا توجد سياسة مالية";return}
 host.innerHTML='<div class="q-c"><h2>إعدادات المالك V3</h2><p>سياسة اختبارية منفصلة — لا تغير الأرصدة أو العمولات الفعلية</p><form id="vxPolicyForm" class="q-form"></form><div id="vxPolicyStatus" role="status"></div></div>';
 const form=$("vxPolicyForm"),status=$("vxPolicyStatus");for(const [key,arg,label,scale] of fields){const l=document.createElement("label"),i=document.createElement("input");l.textContent=label;i.name=arg;i.type="number";i.min="0";i.step=scale===100?"0.01":"1";i.required=arg!=="c";i.value=row[key]==null?"":String(row[key]/scale);i.className="f";l.append(i);form.append(l)}const btn=document.createElement("button");btn.className="q-btn";btn.textContent="حفظ سياسة جديدة";form.append(btn);
 form.onsubmit=async e=>{e.preventDefault();const args={expected_version:row.version};for(const [key,arg,label,scale] of fields){const raw=form.elements.namedItem(arg).value;const v=Number(raw)*scale;if(raw===""&&arg==="c"){args[arg]=null;continue}if(raw===""||!Number.isSafeInteger(Math.round(v))||Math.abs(v-Math.round(v))>1e-6||v<0){status.textContent="قيمة غير صحيحة";return}args[arg]=Math.round(v)}if(args.s+args.l+args.a+args.p!==10000||args.n<1||args.m<1||args.d>1000||(args.c!==null&&args.c>10000)){status.textContent="تحقق من النسب والحدود؛ المجموع يجب أن يكون 100%";return}btn.disabled=true;try{await api.ownerPolicySave(args);row=await api.ownerPolicyRead();status.textContent="تم حفظ نسخة السياسة الاختبارية"}catch(e){status.textContent="تعذر الحفظ؛ أعد فتح الصفحة للتحقق من أحدث نسخة"}finally{btn.disabled=false}};
 };
})();

/* ================= V7: إدارة — الخطة الشبكية + إعدادات إضافية ================= */
Object.assign(V5PA,{
  async network(){const B=$("paBody"),A=V5.api().a7;B.innerHTML=`<div class="panel label">…</div>`;let c,W,L;
    try{[c,W]=await Promise.all([A.cfg(),A.binWeeks()]);L=(await V5.api().dash7().catch(()=>null)||{}).levels||V5PA.d.levels||[]}catch(e){B.innerHTML=`<div class="panel rc-empty">⚠️ ${esc(V5.err(e))}</div>`;return}
    const lv=V5PA.d.levels||L,X=Object.fromEntries((L||[]).map(l=>[l.id,l]));
    B.innerHTML=`<div class="panel"><h3>🌳 ${L5("الخطة الشبكية (ثنائي على مبيعات حقيقية)","Network plan (binary on real sales)")}</h3>
      <p class="label">${L5("عمولة الفريق = نسبة الرتبة × مبيعات الساق الأضعف المؤكدة بالأسبوع. ما توجد أرباح على التسجيل. المجموع ما يتجاوز السقف من مبيعات الأسبوع. كل عمولة تنزل «VERIFIED» وتحتاج اعتمادك.","Team commission = rank % × weaker leg's confirmed weekly sales. No earnings on signups. Total capped by a % of weekly sales. Every commission lands as VERIFIED and needs your approval.")}</p>
      <div class="p7-adm-g"><label class="p7-chk"><input type="checkbox" id="nbOn"${c.partner_bin_on==="1"?" checked":""}> ${L5("تشغيل الخطة الشبكية","Enable network plan")}</label>
        <label>${L5("سقف العمولات % من المبيعات (0–60)","Cap % of sales (0–60)")}<input class="f" id="nbCap" type="number" min="0" max="60" value="${escA(c.partner_bin_cap)}"></label>
        <label>${L5("عمق الشجرة المحسوب (0 = كامل)","Depth counted (0 = full)")}<input class="f" id="nbDep" type="number" min="0" value="${escA(c.partner_bin_depth)}"></label>
        <label>${L5("خزان الانتظار (ساعات)","Holding tank (hours)")}<input class="f" id="nbTank" type="number" min="0" value="${escA(c.partner_tank_hours)}"></label></div>
      <div class="tbl-w"><table class="tbl" id="nbT"><thead><tr><th>${L5("الرتبة","Rank")}</th><th>${L5("عمولة الفريق %","Team %")}</th><th>${L5("نقاط/ساق","Points/leg")}</th><th>${L5("إحالات/ساق","Refs/leg")}</th><th>${L5("قادة","Leaders")}</th></tr></thead><tbody>
        ${lv.map(l=>{const x=X[l.id]||l;return`<tr data-id="${l.id}"><td>${esc(l.icon||"")} ${esc(l.name)}</td><td><input class="f" data-k="bin_pct" type="number" min="0" max="50" step="0.5" value="${escA(x.bin_pct||0)}"></td><td><input class="f" data-k="req_pts" type="number" min="0" value="${escA(x.req_pts||0)}"></td><td><input class="f" data-k="req_refs" type="number" min="0" value="${escA(x.req_refs||0)}"></td><td><input class="f" data-k="req_leaders" type="number" min="0" value="${escA(x.req_leaders||0)}"></td></tr>`}).join("")}</tbody></table></div>
      <div class="k-row" style="margin-top:10px"><button class="btn primary" id="nbSave">💾 ${L5("حفظ الإعدادات","Save")}</button><button class="btn v2s" id="nbPrev">🔎 ${L5("معاينة الأسبوع الحالي","Preview this week")}</button><button class="btn" id="nbCommit">✅ ${L5("احسب الأسبوع الماضي وسجّل العمولات","Close last week & record")}</button></div>
      <div id="nbOut" class="label" style="margin-top:8px"></div></div>
      <div class="panel"><h3>📅 ${L5("الأسابيع","Weeks")}</h3><div class="tbl-w"><table class="tbl"><thead><tr><th>${L5("الأسبوع","Week")}</th><th>${L5("شركاء","Partners")}</th><th>${L5("قبل السقف","Raw")}</th><th>${L5("بعد السقف","Paid")}</th><th>${L5("المعامل","Scale")}</th><th></th></tr></thead><tbody>
        ${(W.weeks||[]).map(w=>`<tr><td>${esc(w.wk)}</td><td>${w.n}</td><td>$${w.raw}</td><td>$${w.paid}</td><td>${w.scale}</td><td>${w.committed?"✅":"🔎"}</td></tr>`).join("")||`<tr><td colspan="6" class="label">—</td></tr>`}</tbody></table></div>
        ${(W.rows||[]).length?`<div class="tbl-w"><table class="tbl"><thead><tr><th>${L5("الشريك","Partner")}</th><th>L</th><th>R</th><th>refs</th><th>${L5("الرتبة","Rank")}</th><th>%</th><th>${L5("المستحق","Due")}</th></tr></thead><tbody>${W.rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.l}</td><td>${r.r}</td><td>${r.lr}/${r.rr}</td><td>${esc(r.level||"—")}</td><td>${r.pct}</td><td>$${r.paid}</td></tr>`).join("")}</tbody></table></div>`:""}</div>`;
    const wkStart=()=>{const d=new Date(Date.now()+3*36e5),dow=(d.getUTCDay()+1)%7;d.setUTCHours(0,0,0,0);return new Date(d-dow*864e5-3*36e5).toISOString()};
    const show=r=>{$("nbOut").innerHTML=`${L5("الأسبوع","Week")} <b>${esc(r.wk)}</b> · ${r.partners} ${L5("شريك","partners")} · ${L5("مبيعات","sales")} $${r.sales} · ${L5("قبل السقف","raw")} $${r.raw} · ${L5("السقف","cap")} $${r.cap} · ${L5("المعامل","scale")} ${r.scale}${r.committed?" · ✅ "+L5("انسجلت العمولات (VERIFIED) — اعتمدها من تبويب العمولات","Recorded as VERIFIED — approve them in Commissions"):""}`};
    $("nbSave").onclick=V5PA.act(async()=>{await A.set("partner_bin_on",$("nbOn").checked?"1":"0");await A.set("partner_bin_cap",$("nbCap").value);await A.set("partner_bin_depth",$("nbDep").value);await A.set("partner_tank_hours",$("nbTank").value);
      await A.binLevels([...document.querySelectorAll("#nbT tr[data-id]")].map(tr=>({id:+tr.dataset.id,...Object.fromEntries([...tr.querySelectorAll("[data-k]")].map(i=>[i.dataset.k,i.value]))})))},L5("انحفظت","Saved"));
    $("nbPrev").onclick=async()=>{try{show(await A.binCompute(wkStart(),false))}catch(e){V5.toast(V5.err(e),1)}};
    $("nbCommit").onclick=async()=>{if(!confirm(L5("تسجيل عمولات الأسبوع الماضي؟ ما ينعاد لنفس الأسبوع.","Record last week's commissions? Can't be repeated.")))return;try{show(await A.binCompute(null,true))}catch(e){V5.toast(V5.err(e),1)}}},
  async v7(){const B=$("paBody"),A=V5.api().a7;B.innerHTML=`<div class="panel label">…</div>`;let c,ch,ad,ts;
    try{[c,ch,ts]=await Promise.all([A.cfg(),A.chList(),A.trStatus()]);ad=await A.admins()}catch(e){B.innerHTML=`<div class="panel rc-empty">⚠️ ${esc(V5.err(e))}</div>`;return}
    const chk=s=>{try{const j=JSON.parse(s);return j.ok?`<span class="p7-tag g">✓ ${esc(j.result&&j.result.title||"OK")}</span>`:`<span class="p7-tag r">${esc(j.description||"ERR")}</span>`}catch(e){return s?`<span class="p7-tag r">ERR</span>`:`<span class="p7-tag y">${L5("ينتظر الفحص","Checking…")}</span>`}};
    const q=ts.queue||{},qn=Object.values(q).reduce((s,x)=>s+(+x||0),0);
    B.innerHTML=`<div class="p7-adm2">
      <div class="panel"><h3>👑 ${L5("المدراء","Admins")}</h3><table class="tbl">${(ad||[]).map(a=>`<tr><td>${esc(a.name||"")}<div class="label">${esc(a.email||"")}</div></td><td><span class="p7-tag ${a.role==="admin"?"y":""}">${esc(a.role)}</span></td><td>${a.me||a.role!=="admin"?"":`<button class="btn v2s" data-rm="${escA(a.email)}">${L5("شيل","Remove")}</button>`}</td></tr>`).join("")}</table>
        <div class="k-row" style="margin-top:10px"><input class="f" id="v7Adm" placeholder="${escA(L5("إيميل الشخص المسجّل بالمنصة","Registered user's email"))}" style="flex:1"><button class="btn primary" id="v7AdmGo">＋ ${L5("أضف مدير","Add admin")}</button></div>
        <p class="label">${L5("المدير الكامل يكدر يغير كل الإعدادات. للصلاحيات المحدودة استخدم «الطاقم» بالإعدادات.","A full admin can change everything. For limited access use Staff in Settings.")}</p></div>
      <div class="panel"><h3>🏦 ${L5("حماية طلب IB","IB request protection")}</h3><label class="p7-chk"><input type="checkbox" id="v7Ib"${c.ib_clients_only==="1"?" checked":""}> ${L5("طلب IB بس للمسجّلين تحت وكالتي لدى INFINOX","IB requests only for my INFINOX agency clients")}</label>
        <p class="label">${L5("العضو لازم يكون مفعّل بالمنصة ومسجّل رقم حساب INFINOX فتحه من رابط الوكالة. غيره يطلعله: «طلب IB متاح بس لعملاء وكالة فيكسورا».","Members must be activated with an INFINOX account opened from the agency link.")}</p></div>
      <div class="panel"><h3>🎧 ${L5("دعم البروكر (يطلع بالأكاديمية والمنصة)","Broker support (academy & platform)")}</h3>
        <label>✈️ ${L5("يوزر تيليجرام","Telegram username")}<input class="f" id="v7Tg" value="${escA(c.support_tg||"")}" placeholder="@username"></label>
        <label>🟢 ${L5("رقم واتساب","WhatsApp number")}<input class="f ltr" id="v7Wa" value="${escA(c.support_wa||"")}" placeholder="+9647xxxxxxxx"></label>
        <button class="btn primary" id="v7SupGo" style="margin-top:8px">💾 ${L5("حفظ","Save")}</button></div>
      <div class="panel"><h3>🎓 ${L5("قنوات الكورسات على تيليجرام","Course Telegram channels")}</h3>
        <p class="label">${L5("ضيف البوت مشرف بالقناة (صلاحية دعوة أعضاء + حظر)، واكتب ID القناة (يبدي بـ ‎-100). لمن الطالب يشتري الدورة أو الاشتراك الشهري، البوت يسوي رابط دخول لمرة وحدة ويدزه إله، ويطلعه لمن ينتهي الاشتراك.","Add the bot as channel admin (invite + ban rights) and enter the channel ID (-100…). On purchase the bot sends a one-time invite link and removes members when a monthly plan expires.")}</p>
        <table class="tbl">${ch.map(x=>`<tr><td>${esc(x.icon||"")} ${esc(x.title)}</td><td><input class="f ltr" data-ch="${escA(x.id)}" value="${escA(x.tg_chat||"")}" placeholder="-100…" style="min-width:150px"></td><td>${x.tg_chat?chk(x.check):""}</td><td class="label">${x.sent?`✉️ ${x.sent}`:""}${x.failed?` · ⚠️ ${x.failed}`:""}</td></tr>`).join("")}</table>
        <button class="btn primary" id="v7ChGo" style="margin-top:8px">💾 ${L5("حفظ وفحص البوت","Save & check bot")}</button>${c.tg_bot?"":`<p class="label" style="color:#ff8b8b">${L5("توكن البوت مو محطوط بالإعدادات.","Bot token is not set.")}</p>`}</div>
      <div class="panel"><h3>🌐 ${L5("اللغات والترجمة التلقائية","Languages & auto-translation")}</h3>
        <p class="label">${L5("اللغات: العربية، English، Français، Deutsch، O‘zbekcha، کوردی (سۆرانی)، Kurdî (Kurmancî)، Türkçe. الترجمة التلقائية للدورات والدروس والاختبارات تشتغل بمفتاح Google Cloud Translation (ينحفظ بالسيرفر ولا يطلع لأي أحد).","Auto-translation of courses, lessons and quizzes uses a Google Cloud Translation key (stored server-side only).")}</p>
        <label>🔑 ${L5("مفتاح الترجمة","Translation API key")}<input class="f ltr" id="v7Key" type="password" autocomplete="off" placeholder="${escA(c.translate_key_set?L5("محفوظ ✓ — اكتب مفتاح جديد للتبديل","Saved ✓ — type a new key to replace"):"AIza…")}"></label>
        <div class="k-row" style="margin:8px 0"><button class="btn" id="v7KeyGo">💾 ${L5("حفظ المفتاح","Save key")}</button></div>
        <div class="k-row">${[["uz","O‘zbekcha"],["ckb","کوردی (سۆرانی)"],["kmr","Kurdî (Kurmancî)"],["tr","Türkçe"],["en","English"],["fr","Français"],["de","Deutsch"]].map(([k,l])=>`<label class="p7-chk"><input type="checkbox" data-lg="${k}"${["uz","ckb","kmr","tr"].includes(k)?" checked":""}> ${l}</label>`).join("")}</div>
        <label class="p7-chk" style="margin-top:8px"><input type="checkbox" id="v7AutoC"${c.tr_auto_content!=="0"?" checked":""}> ${L5("ترجم المسابقات والإعلانات تلقائياً لمن تنشرها أو تعدّلها (لكل اللغات)","Auto-translate contests & ads when published or edited (all languages)")}</label>
        <div class="k-row" style="margin-top:8px"><button class="btn primary" id="v7TrGo">🌐 ${L5("ترجم كل الدورات والدروس والمسابقات + الواجهة","Translate all courses, lessons, contests + UI")}</button><button class="btn v2s" id="v7TrRe">↻ ${L5("إعادة الفاشلة","Retry failed")}</button></div>
        <div class="label" style="margin-top:8px">${L5("بالطابور","Queued")}: <b>${qn}</b> · ${L5("واجهة","UI")}: uz ${ts.ui.uz}/${ts.ui.total} · ckb ${ts.ui.ckb}/${ts.ui.total} · kmr ${ts.ui.kmr}/${ts.ui.total} · tr ${ts.ui.tr||0}/${ts.ui.total}${Object.keys(ts.done||{}).length?" · "+Object.entries(ts.done).map(([k,v])=>`${esc(k)}: ${v}`).join(" · "):""}${ts.last_err?`<div style="color:#ff8b8b">⚠️ ${esc(ts.last_err)}</div>`:""}</div>
        <p class="label">${L5("الترجمة الآلية تحتاج مراجعة شخص يحچي اللغة قبل الإعلان.","Machine translation should be reviewed by a native speaker.")}</p></div></div>`;
    const go=(fn,ok)=>V5PA.act(fn,ok);
    $("v7AdmGo").onclick=async()=>{const m=$("v7Adm").value.trim();if(!m)return;if(!confirm(L5(`تعطي ${m} صلاحية مدير كاملة؟`,`Grant full admin to ${m}?`)))return;try{await A.setAdmin(m,true);V5.toast("✅");V5PA.v7()}catch(e){V5.toast(V5.err(e),1)}};
    B.querySelectorAll("[data-rm]").forEach(b=>b.onclick=async()=>{if(!confirm(L5("تشيل صلاحية المدير؟","Remove admin?")))return;try{await A.setAdmin(b.dataset.rm,false);V5.toast("✅");V5PA.v7()}catch(e){V5.toast(V5.err(e),1)}});
    $("v7Ib").onchange=async e=>{try{await A.set("ib_clients_only",e.target.checked?"1":"0");V5.toast("✅")}catch(x){V5.toast(V5.err(x),1)}};
    $("v7SupGo").onclick=async()=>{try{await A.set("support_tg",$("v7Tg").value);await A.set("support_wa",$("v7Wa").value);V5.toast("✅");V5PA.v7()}catch(e){V5.toast(V5.err(e),1)}};
    $("v7ChGo").onclick=async()=>{try{for(const i of B.querySelectorAll("[data-ch]")){const o=ch.find(x=>x.id===i.dataset.ch);if((o.tg_chat||"")!==i.value.trim())await A.chSet(i.dataset.ch,i.value.trim())}V5.toast("✅ "+L5("انحفظ — نتيجة فحص البوت تطلع خلال ثواني","Saved — bot check result appears in a few seconds"));setTimeout(()=>V5PA.tab==="v7"&&V5PA.v7(),4000)}catch(e){V5.toast(V5.err(e),1)}};
    $("v7KeyGo").onclick=async()=>{const k=$("v7Key").value.trim();if(!k)return;try{await A.set("translate_api_key",k);$("v7Key").value="";V5.toast("✅");V5PA.v7()}catch(e){V5.toast(V5.err(e),1)}};
    $("v7TrGo").onclick=async()=>{const L=[...B.querySelectorAll("[data-lg]:checked")].map(x=>x.dataset.lg);if(!L.length)return;try{const r=await A.trStart(L,"all");V5.toast("✅ "+L5(`انضاف ${r.queued} عنصر للترجمة — تشتغل بالخلفية (120 بالدقيقة)`,`${r.queued} items queued — runs in background`));V5PA.v7()}catch(e){V5.toast(V5.err(e),1)}};
    $("v7AutoC").onchange=async e=>{try{await A.setC("tr_auto_content",e.target.checked?"1":"0");V5.toast("✅")}catch(x){V5.toast(V5.err(x),1)}};
    $("v7TrRe").onclick=async()=>{try{const n=await A.trRetry();V5.toast("✅ "+n);V5PA.v7()}catch(e){V5.toast(V5.err(e),1)}}}
});
/* ================= V7: حماية IB + جهات دعم البروكر بالمنصة ================= */
const V7S={html(s){if(!s||(!s.tg&&!s.wa))return"";const tg=s.tg?`<a class="tg" href="https://t.me/${encodeURIComponent(s.tg)}" target="_blank" rel="noopener">✈️ Telegram · @${esc(s.tg)}</a>`:"",wa=s.wa?`<a class="wa" href="https://wa.me/${encodeURIComponent(String(s.wa).replace(/[^0-9]/g,""))}" target="_blank" rel="noopener">🟢 WhatsApp · <bdi dir="ltr">${esc(s.wa)}</bdi></a>`:"";
  return`<div class="q-c panel" style="margin-bottom:14px"><h3 style="margin:0 0 6px">🎧 ${L5("تواصل مباشر مع دعم البروكر","Talk to broker support")}</h3><p class="label" style="margin:0 0 10px">${L5("لأي مشكلة بحساب INFINOX: فتح حساب، إيداع، سحب، أو ربط MT5.","For any INFINOX account issue: opening, deposits, withdrawals or MT5.")}</p><div class="vx-sup">${tg}${wa}</div></div>`}};
(function(){
  if(typeof V5P!=="undefined"&&V5P.ib){const ib0=V5P.ib.bind(V5P);V5P.ib=async function(){await ib0();try{const e=await V5.api().ibElig();if(e.ok)return;const B=$("v5PartBody");if(!B)return;const w=document.createElement("div");w.className="q-c p7-ibw";
    w.innerHTML=`<h3>🔒 ${L5("طلب IB متاح بس لعملاء وكالة فيكسورا","IB requests are for VEXORA agency clients only")}</h3><p class="q-mut">${L5("حتى تقدّم على IB لازم يكون حساب INFINOX مالتك مفتوح من رابط وكالة فيكسورا ومفعّل بالمنصة. افتح حسابك من الرابط، وبعدها أكمل بياناتك واكتب رقم حسابك.","Your INFINOX account must be opened via the VEXORA agency link and activated on the platform first.")}</p>
      <div class="k-row" style="margin-top:10px"><a class="pp-goback" href="${escA(e.ib_link||"#")}" target="_blank" rel="noopener">🏦 ${L5("افتح حساب INFINOX من رابط الوكالة","Open INFINOX via the agency link")}</a></div>`;
    B.prepend(w);B.querySelectorAll("#ibGo,#ibDraft,#ibF").forEach(b=>{b.disabled=true})}catch(x){}}}
  if(typeof VBH!=="undefined"&&VBH.open){const vb0=VBH.open.bind(VBH);VBH.open=async function(){await vb0();try{const s=await V5.api().support(),b=$("v6BrokerBody");if(b&&s&&(s.tg||s.wa)){const d=document.createElement("div");d.innerHTML=V7S.html(s);b.prepend(d.firstElementChild)}}catch(x){}}}
})();

/* ================= V7d: التسوية الشهرية للـ IB ================= */
Object.assign(V5PA,{
  async ibset(){const B=$("paBody"),A=V5.api().a7;const d0=new Date();d0.setDate(1);d0.setMonth(d0.getMonth()-1);const per=V5PA.ibPer||d0.toISOString().slice(0,7);V5PA.ibPer=per;
    B.innerHTML=`<div class="panel label">…</div>`;let L;try{L=await A.ibsList(per)}catch(e){B.innerHTML=`<div class="panel rc-empty">⚠️ ${esc(V5.err(e))}</div>`;return}
    const m=v=>`<bdi dir="ltr">$${(+v||0).toLocaleString("en-US",{maximumFractionDigits:2})}</bdi>`,stc={DRAFT:"y",APPROVED:"",PAID:"g"},stl={DRAFT:L5("مسودة","Draft"),APPROVED:L5("معتمدة","Approved"),PAID:L5("مدفوعة","Paid")};
    B.innerHTML=`<div class="panel"><h3>🏦 ${L5("التسوية الشهرية للـ IB","Monthly IB settlement")}</h3>
      <p class="label">${L5("الحساب من كشف عمولات INFINOX اللي تستورده (عمود lots + confirmed) وخطة كل IB. ما في أي رقم افتراضي. كل تسوية تطلع «مسودة» ← تعتمدها ← تسجلها مدفوعة ويه مرجع التحويل. يوم 3 من كل شهر تنحسب المسودات تلقائياً إذا الكشف مستورد.","Computed from the imported INFINOX statement (lots + confirmed) and each IB's plan. Draft → approve → mark paid with a transfer reference. Drafts auto-compute on the 3rd of each month.")}</p>
      <div class="k-row"><label>${L5("الشهر","Month")} <input class="f" type="month" id="isPer" value="${escA(per)}"></label><button class="btn primary" id="isGo">🧮 ${L5("احسب المسودات","Compute drafts")}</button></div>
      <div class="label" style="margin-top:8px">${L5("مستورد","Imported")}: <b>${L.imported}</b> / ${L.ibs} IB · ${L5("مسودة","Draft")} ${m(L.totals.draft)} · ${L5("معتمدة","Approved")} ${m(L.totals.approved)} · ${L5("مدفوعة","Paid")} ${m(L.totals.paid)} · ${L5("كاش باك العملاء","Client cashback")} ${m(L.totals.client_cashback)}
        ${(L.no_plan||[]).length?`<div style="color:#ffd36b">⚠️ ${L5("بدون خطة (ما تنحسب):","No plan (skipped):")} ${L.no_plan.map(esc).join("، ")}</div>`:""}</div></div>
      <div class="panel"><div class="tbl-w"><table class="tbl"><thead><tr><th>IB</th><th>${L5("لوتات","Lots")}</th><th>${L5("عمولة الوسيط","Broker comm.")}</th><th>${L5("لكل لوت","Per lot")}</th><th>${L5("نسبة","Share")}</th><th>${L5("كاش باك IB","IB cashback")}</th><th>${L5("الراتب","Salary")}</th><th>${L5("الإجمالي","Total")}</th><th>${L5("كاش باك العملاء","Client cashback")}</th><th>${L5("الحالة","Status")}</th><th></th></tr></thead><tbody>
      ${L.rows.map(x=>`<tr><td><b>${esc(x.name||"")}</b><div class="label ltr">${esc(x.ib_number)}</div></td><td>${x.lots}</td><td>${m(x.broker_comm)}</td><td>${m(x.per_lot_amt)}</td><td>${m(x.share_amt)}</td><td>${m(x.cashback_ib_amt)}</td>
        <td><label class="p7-chk" title="${escA(x.salary_terms||"")}"><input type="checkbox" data-sal="${x.id}"${x.salary_ok?" checked":""}${x.status!=="DRAFT"?" disabled":""}> ${m(x.salary_amt)}</label><div class="label">${esc(x.salary_terms||"")}</div></td>
        <td><b>${m(x.total)}</b></td><td class="label">${m(x.cashback_clients_amt)}</td><td><span class="p7-tag ${stc[x.status]}">${stl[x.status]}</span>${x.paid_ref?`<div class="label ltr">${esc(x.paid_ref)}</div>`:""}</td>
        <td>${x.status==="DRAFT"?`<button class="btn v2s" data-ok="${x.id}">✅ ${L5("اعتماد","Approve")}</button>`:x.status==="APPROVED"?`<button class="btn v2s" data-paid="${x.id}">💸 ${L5("انصرفت","Mark paid")}</button> <button class="btn v2s" data-back="${x.id}">↩</button>`:""}</td></tr>`).join("")||`<tr><td colspan="11" class="label">${L5("ماكو تسويات لهذا الشهر. استورد كشف INFINOX من تبويب IB، وبعدين اضغط «احسب المسودات».","No settlements. Import the INFINOX statement in the IB tab, then compute.")}</td></tr>`}</tbody></table></div></div>`;
    $("isPer").onchange=e=>{V5PA.ibPer=e.target.value;V5PA.ibset()};
    $("isGo").onclick=async()=>{try{const r=await A.ibsCompute($("isPer").value);V5.toast(`✅ ${r.drafts} ${L5("مسودة","drafts")}${r.locked?` · ${r.locked} ${L5("معتمدة ما تغيّرت","locked")}`:""}`);V5PA.ibset()}catch(e){V5.toast(V5.err(e),1)}};
    B.querySelectorAll("[data-sal]").forEach(c=>c.onchange=async()=>{try{await A.ibsSet(c.dataset.sal,c.checked,"");V5PA.ibset()}catch(e){V5.toast(V5.err(e),1)}});
    B.querySelectorAll("[data-ok]").forEach(b=>b.onclick=async()=>{if(!confirm(L5("اعتماد التسوية؟ الـ IB راح يشوفها وتوصله إشعار.","Approve? The IB will see it.")))return;try{await A.ibsStatus(b.dataset.ok,"APPROVED","");V5PA.ibset()}catch(e){V5.toast(V5.err(e),1)}});
    B.querySelectorAll("[data-paid]").forEach(b=>b.onclick=async()=>{const ref=prompt(L5("رقم/مرجع التحويل:","Transfer reference:"));if(!ref)return;try{await A.ibsStatus(b.dataset.paid,"PAID",ref);V5PA.ibset()}catch(e){V5.toast(V5.err(e),1)}});
    B.querySelectorAll("[data-back]").forEach(b=>b.onclick=async()=>{try{await A.ibsStatus(b.dataset.back,"DRAFT","");V5PA.ibset()}catch(e){V5.toast(V5.err(e),1)}})}
});
(function(){if(typeof V5P==="undefined"||!V5P.ib)return;const ib1=V5P.ib.bind(V5P);V5P.ib=async function(){await ib1();try{const S=await V5.api().myIbSet();if(!S||!S.length)return;const B=$("v5PartBody");if(!B)return;
  const m=(v,c)=>`<bdi dir="ltr">${c||"$"}${(+v||0).toLocaleString("en-US",{maximumFractionDigits:2})}</bdi>`,d=document.createElement("div");d.className="q-c";d.style.marginTop="14px";
  d.innerHTML=`<h3>🏦 ${L5("تسوياتي الشهرية","My monthly settlements")}</h3><table class="p7-t"><thead><tr><th>${L5("الشهر","Month")}</th><th>${L5("لوتات","Lots")}</th><th>${L5("لكل لوت","Per lot")}</th><th>${L5("نسبة","Share")}</th><th>${L5("كاش باك","Cashback")}</th><th>${L5("الراتب","Salary")}</th><th>${L5("الإجمالي","Total")}</th><th>${L5("الحالة","Status")}</th></tr></thead><tbody>
    ${S.map(x=>`<tr><td>${esc(x.period)}</td><td>${x.lots}</td><td>${m(x.per_lot_amt,x.currency)}</td><td>${m(x.share_amt,x.currency)}</td><td>${m(x.cashback_ib_amt,x.currency)}</td><td>${m(x.salary_amt,x.currency)}</td><td><b>${m(x.total,x.currency)}</b></td><td><span class="p7-tag ${x.status==="PAID"?"g":""}">${x.status==="PAID"?L5("مدفوعة","Paid"):L5("معتمدة","Approved")}</span></td></tr>`).join("")}</tbody></table>
    <p class="q-mut" style="font-size:12px">${L5("محسوبة من كشف INFINOX الرسمي حسب خطتك.","Computed from the official INFINOX statement per your plan.")}</p>`;B.append(d)}catch(e){}}})();


/* V8: بانر خريج الأكاديمية — يبقى 24 ساعة من وقت النشر */
async function V8B(){const el=$("v8Grad");if(!el)return;let b=null;try{b=await window.__V5.db().grad()}catch(e){}
  if(!b||!b.pub_until||new Date(b.pub_until)<=new Date()){el.hidden=true;return}try{if(localStorage.getItem("v8ban")===String(b.id)){el.hidden=true;return}}catch(e){}
  const p=Math.max(0,Math.min(100,+b.score||0)),ms=new Date(b.pub_until)-Date.now(),left=Math.floor(ms/36e5)+":"+String(Math.floor(ms%36e5/6e4)).padStart(2,"0");
  el.innerHTML=`<div class="v8-ban"><span class="v8-bi">🎓</span><div class="v8-bt"><b><span>مبروك لـ</span> <bdi>${esc(b.name)}</bdi><span>! نجح بشهادة</span> <bdi>${esc((window.LANG&&window.LANG!=="ar"&&b.course_en)||b.course)}</bdi> <span>بنسبة</span> <span style="color:var(--buy)" dir="ltr">${p}%</span></b><small class="muted">خلّص دوراتك واطلب اختبارك ويا الكوتش، ممكن تكون إنت الجاي 💪</small></div><span class="v8-ring" style="--p:${p}"><b class="num">${p}%</b></span><a class="btn primary" href="index.html#cert/${encodeURIComponent(b.code)}">شوف الشهادة</a><a class="btn" href="index.html#grads">🏆 الخريجين</a><button type="button" class="v8-x" aria-label="إغلاق">×</button></div>`;
  el.querySelector(".v8-x").onclick=()=>{try{localStorage.setItem("v8ban",String(b.id))}catch(e){}el.hidden=true};el.hidden=false}

/* routing by account state */
function route(){
  const p=ME.profile;
  if(!ME.user||!p)return gate("vAuth");
  ME.locked=!isAdminUser()&&p.status!=="approved";
  enterApp();
  try{V4.afterLogin()}catch(e){}
  try{V5.afterLogin();V5.sideInit()}catch(e){}
  const d=ME.locked&&["new","rejected"].includes(p.status)&&obDraft();if(d&&d.open){fillOnboard();gate("vOnboard")}
}
async function onSession(u,ev){
  ME.user=u;
  if(ev==="PASSWORD_RECOVERY")return gate("vReset");
  if(!u){ME.profile=null;$("app").hidden=true;setMode("in");return gate("vAuth")}
  let p=null;for(let i=0;i<4&&!p;i++){try{p=await DB.getProfile(u.id)}catch(e){}if(!p)await new Promise(r=>setTimeout(r,600))}
  if(!p){gate("vAuth");return say("aMsg","ما قدرنا نجيب ملفك. تأكد إن قاعدة البيانات مجهّزة (ملف SQL).")}
  ME.profile=p;try{DB.allInfo().then(o=>{try{const v=JSON.parse((o||{}).vx_contacts||"");if(Array.isArray(v)&&v.length)window.__VXC=v}catch(e){}}).catch(()=>{})}catch(e){}ME.perms=[];try{ME.perms=await DB.myPerms()||[]}catch(e){}route();
}
function suRestore(){try{const s=JSON.parse(localStorage.getItem("vx_su")||"{}");if(s.n&&!$("aName").value)$("aName").value=s.n;if(s.e&&!$("aEmail").value)$("aEmail").value=s.e}catch(e){}}suRestore();setTimeout(suRestore,400);setTimeout(suRestore,1500);$("tabUp").addEventListener("click",suRestore);
["aName","aEmail"].forEach(k=>$(k).addEventListener("input",()=>{try{localStorage.setItem("vx_su",JSON.stringify({n:$("aName").value,e:$("aEmail").value}))}catch(e){}}));
if(location.hash==="#signup"){history.replaceState(null,"",location.pathname);setTimeout(()=>{const t=$("tabUp");if(t)t.click()},0)}
DB.onAuth((u,ev)=>{if(ev==="TOKEN_REFRESHED"||ev==="USER_UPDATED"||ev==="INITIAL_SESSION")return;if(ev==="SIGNED_IN"&&u&&ME.user&&ME.user.id===u.id&&ME.profile)return;onSession(u,ev)});
DB.session().then(u=>onSession(u,"INITIAL"));
})();
