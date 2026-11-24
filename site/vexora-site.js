/* VEXORA site finish (app.html + index.html): flat gold line icons in the navigation and one drawn illustration per section.
   Visual only; never touches data, links or handlers. Needs portal-gold.js (window.VXG) loaded first. */
(()=>{
"use strict";
const G="#d8b46a",C="#f3ece0",D="rgba(216,180,106,.10)";
const W=(inner)=>`<svg viewBox="0 0 240 160" fill="none" stroke="${G}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const cand=(x,y1,y2,o,c,up)=>`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><rect x="${x-5}" y="${Math.min(o,c)}" width="10" height="${Math.max(3,Math.abs(c-o))}" rx="1.5" fill="${up?D:"rgba(243,236,224,.08)"}" stroke="${up?G:C}"/>`;
const ART={
  signals:W(`<rect x="14" y="18" width="212" height="124" rx="10" fill="rgba(20,17,13,.6)"/><path d="M14 40h212" opacity=".35"/>
    <circle cx="28" cy="29" r="3" fill="${G}"/><circle cx="40" cy="29" r="3" opacity=".5"/><circle cx="52" cy="29" r="3" opacity=".3"/>
    ${cand(48,58,120,70,108,1)}${cand(72,66,126,104,84,0)}${cand(96,52,110,86,62,1)}${cand(120,60,112,66,96,0)}${cand(144,44,98,92,56,1)}${cand(168,38,86,58,46,1)}
    <path d="M30 70h180" stroke-dasharray="4 5" opacity=".7"/><path d="M30 118h180" stroke="${C}" stroke-dasharray="4 5" opacity=".45"/>
    <rect x="186" y="62" width="34" height="16" rx="4" fill="${G}" stroke="none"/><text x="203" y="74" font-size="9" text-anchor="middle" fill="#1b140a" stroke="none" font-family="Georgia,serif">TP</text>
    <rect x="186" y="110" width="34" height="16" rx="4" stroke="${C}" opacity=".7"/><text x="203" y="122" font-size="9" text-anchor="middle" fill="${C}" stroke="none" font-family="Georgia,serif">SL</text>`),
  trades:W(`<rect x="30" y="16" width="180" height="128" rx="10" fill="rgba(20,17,13,.6)"/><path d="M30 44h180M30 72h180M30 100h180M30 128h180" opacity=".25"/>
    ${[30,58,86,114].map((y,i)=>`<circle cx="50" cy="${y+14}" r="6" fill="${i%3?D:G}" stroke="${G}"/><path d="M66 ${y+11}h60M66 ${y+18}h36" opacity=".6"/><path d="M${i%3?168:166} ${y+14}l8 ${i%3?6:-6} 8 ${i%3?-6:6}" stroke="${i%3?C:G}"/>`).join("")}`),
  deep:W(`<rect x="16" y="26" width="160" height="110" rx="10" fill="rgba(20,17,13,.6)"/><path d="M28 112l26-22 22 12 30-38 26 18 34-30" /><path d="M28 112l26-22 22 12 30-38 26 18 34-30V124H28z" fill="${D}" stroke="none"/>
    <circle cx="164" cy="74" r="40" fill="rgba(11,10,8,.85)"/><circle cx="164" cy="74" r="40"/><path d="M193 103l26 26" stroke-width="5"/><path d="M140 92l12-14 10 6 16-22 8 6" stroke="${C}"/><circle cx="178" cy="62" r="3" fill="${G}"/>`),
  chart:W(`<rect x="14" y="16" width="212" height="128" rx="10" fill="rgba(20,17,13,.6)"/><path d="M26 32v100h192" opacity=".4"/>
    <path d="M30 116c20-6 26-30 46-30s24 22 44 18 24-40 44-44 26 12 50 4" /><path d="M30 104c20-2 30-18 50-20s26 10 46 4 30-28 50-30 22 6 38 0" stroke="${C}" opacity=".55" stroke-dasharray="3 4"/>
    <path d="M146 26v110M26 74h192" stroke="${C}" opacity=".35" stroke-dasharray="2 4"/><circle cx="146" cy="74" r="5" fill="${G}" stroke="none"/><rect x="152" y="40" width="58" height="22" rx="5" fill="rgba(11,10,8,.9)"/><path d="M160 51h42" opacity=".7"/>`),
  ai:W(`<rect x="22" y="22" width="196" height="116" rx="12" fill="rgba(20,17,13,.6)"/><path d="M22 50h196" opacity=".3"/>
    <rect x="38" y="64" width="80" height="54" rx="8" fill="${D}"/><path d="M48 104l14-14 12 8 18-20 16 12"/>
    <path d="M134 68h68M134 82h56M134 96h64M134 110h40" opacity=".7"/><circle cx="40" cy="36" r="5" fill="${G}" stroke="none"/><path d="M52 36h48" opacity=".6"/>
    <rect x="160" y="28" width="46" height="16" rx="8" fill="${G}" stroke="none"/><text x="183" y="40" font-size="9" text-anchor="middle" fill="#1b140a" stroke="none" font-family="Georgia,serif">PRO</text>`),
  strategy:W(`<rect x="24" y="20" width="192" height="120" rx="10" fill="rgba(20,17,13,.6)"/><path d="M24 50h192M84 20v120" opacity=".25"/>
    <rect x="36" y="32" width="36" height="10" rx="3" fill="${D}"/><rect x="36" y="62" width="36" height="12" rx="3"/><rect x="36" y="86" width="36" height="12" rx="3"/><rect x="36" y="110" width="36" height="12" rx="3" fill="${G}" stroke="none"/>
    <path d="M96 118l24-30 20 14 26-40 26 20" /><circle cx="120" cy="88" r="3" fill="${G}"/><circle cx="166" cy="62" r="3" fill="${G}"/><path d="M100 34h44M100 40h28" opacity=".6"/><path d="M182 32l8 8-8 8M200 32l-8 8 8 8" opacity=".7"/>`),
  scanner:W(`<circle cx="92" cy="80" r="58" fill="rgba(20,17,13,.6)"/><circle cx="92" cy="80" r="58"/><circle cx="92" cy="80" r="38" opacity=".5"/><circle cx="92" cy="80" r="18" opacity=".35"/>
    <path d="M92 80L134 40" stroke-width="2.4"/><path d="M92 80L134 40A58 58 0 0 1 150 80z" fill="${D}" stroke="none"/><circle cx="120" cy="60" r="4" fill="${G}" stroke="none"/><circle cx="66" cy="100" r="3" fill="${C}" stroke="none"/>
    ${[30,58,86,114].map((y,i)=>`<rect x="164" y="${y}" width="58" height="18" rx="5" ${i===0?`fill="${D}"`:""}/><path d="M172 ${y+9}h${20+i*4}" opacity=".7"/>`).join("")}`),
  risk:W(`<path d="M120 18l62 22v38c0 34-26 56-62 66-36-10-62-32-62-66V40z" fill="rgba(20,17,13,.7)"/><path d="M120 18l62 22v38c0 34-26 56-62 66-36-10-62-32-62-66V40z"/>
    <path d="M84 98l20-18 14 10 22-26 14 10" /><path d="M86 112h68" stroke="${C}" stroke-dasharray="4 4" opacity=".6"/><circle cx="154" cy="74" r="3" fill="${G}" stroke="none"/>
    <path d="M30 70h22M188 70h22M30 92h14M196 92h14" opacity=".4"/>`),
  rewards:W(`<rect x="40" y="96" width="50" height="40" rx="4" fill="rgba(20,17,13,.6)"/><rect x="95" y="76" width="50" height="60" rx="4" fill="${D}"/><rect x="150" y="108" width="50" height="28" rx="4" fill="rgba(20,17,13,.6)"/>
    <path d="M106 26h28v18a14 14 0 0 1-28 0z" fill="${D}"/><path d="M106 32h-10a10 10 0 0 0 12 12M134 32h10a10 10 0 0 1-12 12M120 58v10M110 70h20"/>
    <text x="120" y="112" font-size="20" text-anchor="middle" fill="${G}" stroke="none" font-family="Georgia,serif">1</text><text x="65" y="122" font-size="16" text-anchor="middle" fill="${C}" stroke="none" font-family="Georgia,serif" opacity=".8">2</text><text x="175" y="128" font-size="14" text-anchor="middle" fill="${C}" stroke="none" font-family="Georgia,serif" opacity=".6">3</text>
    <path d="M30 136h180" opacity=".4"/><path d="M70 40l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z M172 50l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" opacity=".7"/>`),
  record:W(`<rect x="44" y="14" width="140" height="132" rx="10" fill="rgba(20,17,13,.6)"/><path d="M60 38h76M60 52h56" opacity=".7"/>
    ${[72,92,112].map((y,i)=>`<path d="M60 ${y}h64" opacity=".4"/><path d="M${136} ${y}h${20+i*6}" stroke="${G}"/>`).join("")}
    <circle cx="186" cy="112" r="24" fill="rgba(11,10,8,.92)"/><circle cx="186" cy="112" r="24"/><path d="M175 112l8 8 14-16" stroke-width="2.2"/>`),
  news:W(`<rect x="26" y="22" width="170" height="118" rx="10" fill="rgba(20,17,13,.6)"/><path d="M196 52h18v74a14 14 0 0 1-14 14" /><rect x="40" y="36" width="70" height="44" rx="5" fill="${D}"/>
    <path d="M48 70l14-14 10 8 16-16" /><path d="M122 40h60M122 52h48M122 64h56M122 76h40" opacity=".7"/><path d="M40 96h142M40 108h120M40 120h134" opacity=".45"/>`),
  calendar:W(`<rect x="46" y="22" width="148" height="120" rx="12" fill="rgba(20,17,13,.6)"/><path d="M46 50h148M82 14v18M158 14v18" />
    ${[0,1,2,3].map(r=>[0,1,2,3,4].map(c=>`<rect x="${58+c*26}" y="${60+r*19}" width="18" height="12" rx="3" ${r===1&&c===2?`fill="${G}" stroke="none"`:r*5+c===8||r*5+c===14?`fill="${D}"`:'opacity=".45"'}/>`).join("")).join("")}`),
  academy:W(`<path d="M120 26l84 36-84 36-84-36z" fill="${D}"/><path d="M76 80v28c26 18 62 18 88 0V80" /><path d="M204 62v38" /><circle cx="204" cy="104" r="4" fill="${G}" stroke="none"/>
    <rect x="58" y="118" width="124" height="22" rx="4" fill="rgba(20,17,13,.6)"/><path d="M70 129h100" opacity=".5"/>`),
  partners:W(`<circle cx="120" cy="40" r="16" fill="${D}"/><path d="M96 78c4-14 14-20 24-20s20 6 24 20"/><circle cx="62" cy="96" r="12"/><circle cx="178" cy="96" r="12"/><path d="M44 130c3-10 10-15 18-15s15 5 18 15M160 130c3-10 10-15 18-15s15 5 18 15"/>
    <path d="M106 64l-34 22M134 64l34 22" opacity=".5" stroke-dasharray="3 4"/><path d="M80 110h80" opacity=".3"/>`),
  support:W(`<path d="M68 92V78a52 52 0 0 1 104 0v14"/><rect x="56" y="88" width="24" height="38" rx="8" fill="${D}"/><rect x="160" y="88" width="24" height="38" rx="8" fill="${D}"/><path d="M172 126c0 10-12 16-28 16h-12"/>
    <rect x="98" y="40" width="44" height="26" rx="8" fill="rgba(20,17,13,.6)"/><path d="M108 53h.01M120 53h.01M132 53h.01" stroke-width="3"/>`),
  settings:W(`<circle cx="104" cy="82" r="30" fill="${D}"/><circle cx="104" cy="82" r="11"/><path d="M104 40v12M104 112v12M62 82h12M134 82h12M74 52l9 9M125 103l9 9M74 112l9-9M125 61l9-9"/>
    <path d="M160 50h52M160 72h52M160 94h52M160 116h52" opacity=".4"/><circle cx="196" cy="50" r="5" fill="${G}" stroke="none"/><circle cx="174" cy="72" r="5" fill="${C}" stroke="none"/><circle cx="202" cy="94" r="5" fill="${G}" stroke="none"/><circle cx="168" cy="116" r="5" fill="${C}" stroke="none"/>`),
  inbox:W(`<path d="M40 86l20-50h120l20 50v42H40z" fill="rgba(20,17,13,.6)"/><path d="M40 86h44l8 16h56l8-16h44"/><path d="M92 56h56M98 70h44" opacity=".6"/><circle cx="182" cy="40" r="10" fill="${G}" stroke="none"/>`),
  profile:W(`<rect x="40" y="26" width="160" height="108" rx="12" fill="rgba(20,17,13,.6)"/><circle cx="92" cy="72" r="20" fill="${D}"/><path d="M64 118c4-14 16-20 28-20s24 6 28 20"/><path d="M134 60h50M134 76h38M134 92h44" opacity=".6"/>`),
  marketing:W(`<path d="M44 70v26h20l58 34V36L64 70z" fill="${D}"/><path d="M148 62a24 24 0 0 1 0 42M164 50a40 40 0 0 1 0 66" /><rect x="176" y="20" width="44" height="30" rx="6" fill="rgba(20,17,13,.6)"/><path d="M184 30h28M184 38h18" opacity=".6"/>`),
  copier:W(`<rect x="18" y="40" width="80" height="62" rx="8" fill="rgba(20,17,13,.6)"/><rect x="142" y="40" width="80" height="62" rx="8" fill="${D}"/><path d="M30 86l14-12 10 6 16-18 14 10" /><path d="M154 86l14-12 10 6 16-18 14 10" stroke="${C}" opacity=".75"/>
    <path d="M104 62h30M126 54l8 8-8 8" stroke-width="2"/><path d="M136 84h-30M114 76l-8 8 8 8" stroke="${C}" opacity=".6"/><circle cx="210" cy="30" r="6" fill="#3fbf7f" stroke="none"/><path d="M58 120h124" opacity=".3"/>`),
  journal:W(`<rect x="56" y="18" width="128" height="124" rx="8" fill="rgba(20,17,13,.6)"/><path d="M74 18v124" opacity=".5"/><path d="M90 44h74M90 58h60M90 72h70M90 98h50M90 112h64" opacity=".6"/><path d="M150 120l26-26 8 8-26 26h-8z" fill="${D}"/>`),
  radar:W(`<path d="M30 130a90 90 0 0 1 180 0" /><path d="M60 130a60 60 0 0 1 120 0" opacity=".55"/><path d="M90 130a30 30 0 0 1 60 0" opacity=".35"/><path d="M120 130L176 70" stroke-width="2.2"/><circle cx="160" cy="88" r="4" fill="${G}" stroke="none"/><circle cx="84" cy="104" r="3" fill="${C}" stroke="none"/><path d="M24 130h192" opacity=".4"/>`),
  zones:W(`<rect x="14" y="18" width="212" height="124" rx="10" fill="rgba(20,17,13,.6)"/><rect x="24" y="44" width="192" height="18" fill="${D}" stroke="none"/><rect x="24" y="100" width="192" height="18" fill="rgba(243,236,224,.06)" stroke="none"/><path d="M28 112l30-30 22 14 26-40 30 26 26-22 28 30 18-10"/>`),
  winrate:W(`<circle cx="94" cy="80" r="50" fill="rgba(20,17,13,.6)"/><circle cx="94" cy="80" r="50" opacity=".3"/><path d="M94 30a50 50 0 1 1-47 67" stroke-width="7"/><text x="94" y="88" font-size="22" text-anchor="middle" fill="${C}" stroke="none" font-family="Georgia,serif">%</text>
    ${[40,66,92,118].map((y,i)=>`<path d="M162 ${y}h${30+i*8}" stroke-width="6" opacity="${1-i*.2}"/>`).join("")}`),
  forecast:W(`<rect x="22" y="22" width="120" height="116" rx="10" fill="rgba(20,17,13,.6)"/><path d="M38 46h88M38 60h70M38 74h80" opacity=".6"/><path d="M38 118l20-16 14 8 22-24 20 12" /><path d="M150 96c10-30 30-46 66-50" stroke-dasharray="4 5"/><path d="M206 38l12 8-10 10" />`),
  brief:W(`<rect x="40" y="16" width="160" height="128" rx="10" fill="rgba(20,17,13,.6)"/><rect x="56" y="32" width="128" height="34" rx="6" fill="${D}"/><path d="M66 56l16-12 12 6 18-14 14 8" /><path d="M56 82h128M56 96h100M56 110h116M56 124h70" opacity=".55"/><circle cx="186" cy="20" r="12" fill="${G}" stroke="none"/><text x="186" y="25" font-size="12" text-anchor="middle" fill="#1b140a" stroke="none" font-family="Georgia,serif">AM</text>`),
  path:W(`<path d="M30 132c40 0 30-40 70-40s30-44 70-44 30-24 40-24" stroke-dasharray="1 0"/>${[[30,132],[100,92],[170,48],[208,24]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i===3?9:7}" fill="${i<2?G:i===2?D:"rgba(20,17,13,.9)"}" ${i<2?'stroke="none"':''}/>`).join("")}<path d="M204 24l3 3 6-6" stroke="#1b140a"/>`),
  help:W(`<rect x="30" y="30" width="120" height="76" rx="12" fill="rgba(20,17,13,.6)"/><path d="M60 106l-12 20 30-20" fill="rgba(20,17,13,.6)"/><path d="M50 56h80M50 72h56" opacity=".6"/><rect x="110" y="70" width="104" height="60" rx="12" fill="${D}"/><path d="M126 94h70M126 108h44" opacity=".7"/>`),
  crm:W(`<rect x="24" y="24" width="192" height="112" rx="10" fill="rgba(20,17,13,.6)"/>${[44,70,96].map((y,i)=>`<circle cx="48" cy="${y+8}" r="8" fill="${i?D:G}" ${i?"":'stroke="none"'}/><path d="M66 ${y+5}h70M66 ${y+12}h44" opacity=".6"/><rect x="158" y="${y+1}" width="44" height="14" rx="7" ${i===1?`fill="${D}"`:'opacity=".6"'}/>`).join("")}`),
  ops:W(`<rect x="20" y="24" width="96" height="54" rx="8" fill="rgba(20,17,13,.6)"/><rect x="124" y="24" width="96" height="54" rx="8" fill="${D}"/><rect x="20" y="86" width="200" height="50" rx="8" fill="rgba(20,17,13,.6)"/><path d="M32 60l16-12 12 6 16-14 16 8" /><circle cx="172" cy="51" r="14"/><path d="M172 51l8-8" /><path d="M34 112h40M84 104v16M100 100v24M116 108v8M132 98v28M148 106v12" />`),
  bi:W(`<rect x="22" y="20" width="196" height="120" rx="10" fill="rgba(20,17,13,.6)"/><path d="M40 120V84M64 120V60M88 120V72M112 120V44M136 120V66" stroke-width="12" opacity=".8"/><circle cx="182" cy="70" r="26" fill="${D}"/><path d="M182 44v26h26"/>`),
  compliance:W(`<rect x="60" y="16" width="120" height="128" rx="10" fill="rgba(20,17,13,.6)"/><path d="M78 40h84M78 54h64M78 68h76" opacity=".6"/><path d="M84 96l8 8 14-16M84 120l8 8 14-16" /><path d="M118 100h40M118 124h30" opacity=".5"/><circle cx="178" cy="34" r="14" fill="${D}"/><path d="M172 34l4 4 8-8"/>`),
  plans:W(`${[0,1,2].map(i=>`<rect x="${24+i*68}" y="${i===1?20:36}" width="60" height="${i===1?120:104}" rx="8" ${i===1?`fill="${D}" stroke-width="2"`:'fill="rgba(20,17,13,.6)"'}/><path d="M${36+i*68} ${i===1?52:66}h36M${36+i*68} ${i===1?70:82}h24M${36+i*68} ${i===1?86:98}h30" opacity=".6"/>`).join("")}<circle cx="120" cy="20" r="8" fill="${G}" stroke="none"/>`),
  courses:W(`${[0,1,2].map(i=>`<rect x="${30+i*20}" y="${30+i*10}" width="120" height="86" rx="8" fill="${i===2?"rgba(20,17,13,.92)":"rgba(20,17,13,.6)"}" opacity="${.5+i*.25}"/>`).join("")}<path d="M88 76l26 16-26 16z" fill="${G}" stroke="none"/><path d="M190 60v70M178 130h24" /><path d="M170 52h40l-20-14z" fill="${D}"/>`),
  indicators:W(`<rect x="14" y="18" width="212" height="124" rx="10" fill="rgba(20,17,13,.6)"/><path d="M26 92c18-30 34-34 52-18s30 20 50-6 38-26 56-4 24 10 30 6" /><path d="M26 104c18-14 34-18 52-10s30 10 50-4 38-12 56 0 24 4 30 2" stroke="${C}" opacity=".5"/><path d="M26 124h188" opacity=".25"/>${[40,72,104,136,168,200].map((x,i)=>`<path d="M${x} 136v-${6+((i*7)%14)}" stroke-width="4" opacity=".55"/>`).join("")}`),
  live:W(`<rect x="22" y="26" width="150" height="100" rx="10" fill="rgba(20,17,13,.6)"/><circle cx="97" cy="68" r="16" fill="${D}"/><path d="M76 108c4-12 12-16 21-16s17 4 21 16"/><path d="M178 56l40-20v84l-40-20z" fill="${D}"/><circle cx="40" cy="42" r="5" fill="#e0605a" stroke="none"/>`),
  certs:W(`<rect x="30" y="24" width="180" height="112" rx="8" fill="rgba(20,17,13,.6)"/><rect x="40" y="34" width="160" height="92" rx="4" opacity=".4"/><path d="M70 60h100M84 76h72" opacity=".7"/><circle cx="120" cy="104" r="12" fill="${D}"/><path d="M114 114l-4 16 10-6 10 6-4-16"/>`),
  lab:W(`<path d="M100 20h40M106 20v40l-36 64a10 10 0 0 0 9 15h82a10 10 0 0 0 9-15l-36-64V20"/><path d="M84 104h72l14 26H70z" fill="${D}" stroke="none"/><circle cx="110" cy="114" r="4" fill="${G}" stroke="none"/><circle cx="132" cy="122" r="3" fill="${C}" stroke="none"/>`),
  mentor:W(`<circle cx="84" cy="56" r="20" fill="${D}"/><path d="M50 120c4-20 18-30 34-30s30 10 34 30"/><rect x="134" y="36" width="84" height="48" rx="10" fill="rgba(20,17,13,.6)"/><path d="M148 54h56M148 66h36" opacity=".6"/><path d="M146 84l-10 14 22-14"/>`),
  coach:W(`<circle cx="120" cy="46" r="22" fill="${D}"/><path d="M80 130c6-26 22-40 40-40s34 14 40 40"/><path d="M112 96l8 14 8-14"/><path d="M40 70h22M178 70h22" opacity=".4"/>`),
  join:W(`<path d="M30 120h40v-30h40V60h40V30h40" stroke-width="2"/>${[[70,120],[110,90],[150,60],[190,30]].map(([x,y],i)=>`<circle cx="${x-20}" cy="${y-14}" r="9" fill="${i===3?G:D}" ${i===3?'stroke="none"':""}/>`).join("")}`),
  tools:W(`<rect x="24" y="24" width="88" height="112" rx="10" fill="rgba(20,17,13,.6)"/><path d="M40 44h56M40 60h56" opacity=".6"/>${[0,1,2].map(r=>[0,1,2].map(c=>`<rect x="${40+c*20}" y="${76+r*18}" width="14" height="12" rx="2" ${r===2&&c===2?`fill="${G}" stroke="none"`:'opacity=".55"'}/>`).join("")).join("")}<path d="M136 120l60-60M150 50l46 46" /><circle cx="196" cy="56" r="12" fill="${D}"/>`),
  challenge:W(`<path d="M96 22h48v30a24 24 0 0 1-48 0z" fill="${D}"/><path d="M96 30H80a16 16 0 0 0 20 20M144 30h16a16 16 0 0 1-20 20M120 76v16M104 96h32v12h-32z"/>
    <path d="M40 140l24-22 18 10 26-30 20 14 28-26 24 16 20-12" opacity=".8"/><circle cx="200" cy="90" r="3" fill="${G}" stroke="none"/><path d="M30 140h190" opacity=".3"/>`)
};
/* route → illustration + nav icon */
const ROUTES=[["#v4Hero","challenge"]];
const NAV=[[/منصة التداول|التحليل والإشارة|الرئيسية/,"chartUp"],[/الصفقات/,"receipt"],[/التحليل التفصيلي/,"search"],[/الشارت/,"chart"],[/AI|الذكاء/,"spark"],[/استراتيجي/,"flask"],[/ماسح/,"target"],[/المخاطر/,"shield"],[/المسابقات|الهدايا|الجوائز/,"trophy"],[/النمو/,"chartUp"],[/سجل الأداء|السجل/,"clip"],[/التقويم/,"clock"],[/أخبار/,"doc"],[/الشركاء|شريك/,"users"],[/الوسيط/,"bank"],[/الدعم/,"chat"],[/الرسائل/,"inbox"],[/إعدادات/,"gear"],[/ملفي|الحساب/,"user"],[/الأكاديمية|الدورات|التعلّم|دروس/,"cap"],[/التسويق/,"bell"],[/الإدارة/,"shield"],[/الناسخ|Copier/i,"link"]];
const VXG=()=>window.VXG;
function navIcons(){const g=VXG();if(!g)return;
  document.querySelectorAll(".gic:not([data-vxs])").forEach(box=>{const a=box.closest("a,button")||box.parentElement;const t=(a&&(a.getAttribute("title")||a.textContent)||"").trim();
    const hit=NAV.find(([re])=>re.test(t));box.dataset.vxs="1";box.innerHTML=g.svg(hit?hit[1]:"dot","vxs-nav")});
}
const HASHART={trades:"trades",deep:"deep",chart:"chart",ai:"ai",strategy:"strategy",scanner:"scanner",risk:"risk",journal:"journal",radar:"radar",analysis:"deep",zones:"zones",winrate:"winrate",copier:"copier",forecast:"forecast",brief:"brief",path:"path",help:"help",crm:"crm",ops:"ops",bi:"bi",compliance:"compliance",record:"record",news:"news","news/calendar":"calendar",calendar:"calendar",inbox:"inbox",rewards:"rewards","broker-help":"support",support:"support",settings:"settings",profile:"profile",growth:"marketing","growth/marketing-ai":"marketing",
  courses:"courses",certs:"certs",live:"live",plans:"plans",tools:"tools",indicators:"indicators",lab:"lab",mentor:"mentor",coach:"coach",join:"join",admin:"settings"};
function sec(){return(location.hash||"#").slice(1).split("?")[0]}
function hashArt(){const k=HASHART[sec()];if(!k||!ART[k])return;
  const hs=[...document.querySelectorAll("#app h1, #app h2, main h1, main h2, body > div h1, body > div h2")].filter(h=>h.offsetParent&&!h.closest(".side,.glist,nav,header,.vxs-art,.hx,.modal,dialog")&&h.getBoundingClientRect().top<700);
  const h=hs[0];if(!h)return;const box=h.parentElement;if(!box||box.classList.contains("vxs-has-art")||box.querySelector(":scope > .vxs-art"))return;
  box.classList.add("vxs-has-art");const d=document.createElement("div");d.className="vxs-art";d.setAttribute("aria-hidden","true");d.innerHTML=ART[k];box.appendChild(d)}
function tabbar(){if(document.getElementById("vxsTabs")||!document.querySelector(".gi"))return;const g=VXG();if(!g)return;const app=/app\.html/.test(location.pathname)||location.pathname.endsWith("/app");
  const T=[["app.html","chartUp","الرئيسية"],["app.html#deep","search","التحليل"],["app.html#trades","receipt","التوصيات"],["app.html#copier","link","الناسخ"],["index.html#courses","cap","الأكاديمية"],["app.html#profile","user","حسابي"]];
  const n=document.createElement("nav");n.id="vxsTabs";n.className="vxs-tabs";n.setAttribute("aria-label","التنقل السريع");
  n.innerHTML=T.map(([h,i,t])=>`<a href="${h}">${g.svg(i,"vxs-nav")}<span>${t}</span></a>`).join("");document.body.appendChild(n);mark()}
function mark(){const n=document.getElementById("vxsTabs");if(!n)return;const here=location.pathname.split("/").pop()+(location.hash||"");n.querySelectorAll("a").forEach(a=>a.classList.toggle("on",a.getAttribute("href")===here||(a.getAttribute("href")==="app.html"&&/app\.html$/.test(here))))}
function art(){document.body.dataset.sec=sec()||"home";hashArt();
  for(const[sel,key]of ROUTES){const v=document.querySelector(sel);if(!v||v.querySelector(":scope .vxs-art"))continue;
    if(sel==="#v4Hero"){const ph=v.querySelector(".hx-ph");if(ph&&!ph.dataset.vxs){ph.dataset.vxs="1";ph.innerHTML=`<span class="vxs-art vxs-hero">${ART[key]}</span>`}continue}
    const h=[...v.querySelectorAll("h1,h2")].find(x=>x.offsetParent!==null||true);if(!h)continue;const box=h.parentElement;if(!box||box.classList.contains("vxs-has-art"))continue;
    box.classList.add("vxs-has-art");const d=document.createElement("div");d.className="vxs-art";d.setAttribute("aria-hidden","true");d.innerHTML=ART[key];box.appendChild(d)}
}
window.VXS_after=()=>{try{navIcons();art();tabbar();mark()}catch(e){}};
window.VXS_ART=ART;
const go=()=>{if(!document.getElementById("vxsDefs")){const d=document.createElement("div");d.id="vxsDefs";d.innerHTML='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="vxsGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e2ad"/><stop offset=".55" stop-color="#d8b46a"/><stop offset="1" stop-color="#9c7a3c"/></linearGradient></defs></svg>';document.body.appendChild(d)}window.VXS_after();setTimeout(window.VXS_after,800)};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();
addEventListener("hashchange",()=>setTimeout(window.VXS_after,300));
})();
